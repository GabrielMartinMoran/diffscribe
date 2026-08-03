import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { WorkerServer, WorkerServerOptions } from '../../e2e/helpers/worker-server';
// RED: these imports fail — the module does not exist yet
import {
  cleanupAllActiveServers,
  resetBackstopForTesting,
  startWorkerServer,
  stopWorkerServer,
} from '../../e2e/helpers/worker-server';

// ── Test infrastructure ──────────────────────────────────

let portCounter = 18_900;
const tmpDir = mkdtempSync(join(tmpdir(), 'ws-test-'));
const cleanupServers: WorkerServer[] = [];

function makeOpts(overrides: Partial<WorkerServerOptions> = {}): WorkerServerOptions {
  return {
    workerIndex: 1,
    parallelIndex: portCounter++,
    basePort: 18_900,
    startupTimeoutMs: 3000,
    ...overrides,
  };
}

/** Inline script that starts a minimal HTTP server on the given port. */
function httpServerScript(port: number): string {
  // Single-line expression for node -e to avoid escaping issues
  return [
    `const http=require('http');`,
    `const s=http.createServer((_q,r)=>{r.writeHead(200);r.end('OK')});`,
    `s.listen(${port},'127.0.0.1');`,
    `process.on('SIGTERM',()=>s.close(()=>process.exit(0)));`,
  ].join('');
}

/** Inline script that writes env vars to a file, then exits. */
function envWriterScript(): string {
  return [
    `const fs=require('fs');`,
    `fs.writeFileSync(process.env.OUTPUT_FILE,JSON.stringify({`,
    `IN_MEMORY_DB:process.env.DIFFSCRIBE_E2E_IN_MEMORY_DB,`,
    `RESET_SECRET:process.env.DIFFSCRIBE_E2E_RESET_SECRET,`,
    `WORKER_INDEX:process.env.DIFFSCRIBE_E2E_WORKER_INDEX,`,
    `}));`,
    `process.exit(0);`,
  ].join('');
}

/** Inline script that hangs forever (for timeout testing). */
function hangScript(): string {
  return 'setTimeout(()=>{},100000);';
}

afterEach(async () => {
  const list = [...cleanupServers];
  cleanupServers.length = 0;
  await Promise.all(list.map((s) => stopWorkerServer(s).catch(() => {})));
  resetBackstopForTesting();
  vi.restoreAllMocks();
});

afterAll(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

// ── Tests ────────────────────────────────────────────────

describe('WorkerServer lifecycle', () => {
  it('calculates port as basePort + parallelIndex and returns WorkerServer', async () => {
    const pi = portCounter++;
    const basePort = 18_900;
    const port = basePort + pi;

    const server = await startWorkerServer({
      workerIndex: 0,
      parallelIndex: pi,
      basePort,
      startupTimeoutMs: 10_000,
      overrideCommand: process.execPath,
      overrideArgs: ['-e', httpServerScript(port)],
    });

    cleanupServers.push(server);

    expect(server.workerIndex).toBe(0);
    expect(server.parallelIndex).toBe(pi);
    expect(server.port).toBe(port);
    expect(server.baseURL).toBe(`http://127.0.0.1:${port}`);
    expect(server.pid).toBeGreaterThan(0);
  });

  it('passes correct env vars to the child process', async () => {
    const outFile = join(tmpDir, `env-${portCounter}.json`);

    await expect(
      startWorkerServer(
        makeOpts({
          workerIndex: 42,
          overrideCommand: process.execPath,
          overrideArgs: ['-e', envWriterScript()],
          overrideEnv: { OUTPUT_FILE: outFile },
        }),
      ),
    ).rejects.toThrow();

    const raw = readFileSync(outFile, 'utf-8');
    const env = JSON.parse(raw);

    expect(env.IN_MEMORY_DB).toBe('1');
    expect(env.RESET_SECRET).toBeDefined();
    expect(env.WORKER_INDEX).toBe('42');
  });

  it('rejects when child exits before readiness', async () => {
    await expect(
      startWorkerServer(
        makeOpts({
          overrideCommand: process.execPath,
          overrideArgs: ['-e', 'process.exit(1);'],
        }),
      ),
    ).rejects.toThrow();
  });

  it('rejects on readiness timeout', async () => {
    await expect(
      startWorkerServer(
        makeOpts({
          startupTimeoutMs: 500,
          overrideCommand: process.execPath,
          overrideArgs: ['-e', hangScript()],
        }),
      ),
    ).rejects.toThrow();
  });

  it('stops gracefully with SIGTERM and is idempotent on second call', async () => {
    const pi = portCounter++;
    const port = 18_900 + pi;

    const server = await startWorkerServer({
      workerIndex: 0,
      parallelIndex: pi,
      basePort: 18_900,
      startupTimeoutMs: 10_000,
      overrideCommand: process.execPath,
      overrideArgs: ['-e', httpServerScript(port)],
    });

    // First stop — graceful SIGTERM
    await stopWorkerServer(server);

    // Second stop — idempotent (must not throw)
    await expect(stopWorkerServer(server)).resolves.toBeUndefined();
  });

  it('falls back to SIGKILL when SIGTERM is ignored', async () => {
    const pi = portCounter++;
    const port = 18_900 + pi;

    // Server that handles HTTP but ignores SIGTERM — forces SIGKILL path
    const server = await startWorkerServer({
      workerIndex: 0,
      parallelIndex: pi,
      basePort: 18_900,
      startupTimeoutMs: 10_000,
      overrideCommand: process.execPath,
      overrideArgs: [
        '-e',
        [
          `const http=require('http');`,
          `const s=http.createServer((_q,r)=>{r.writeHead(200);r.end('OK')});`,
          `s.listen(${port},'127.0.0.1');`,
          `process.on('SIGTERM',()=>{});`, // ignore — needs SIGKILL
        ].join(''),
      ],
    });

    // This sends SIGTERM, waits up to 5 s, then SIGKILL
    await expect(stopWorkerServer(server)).resolves.toBeUndefined();

    // Second call is also idempotent
    await expect(stopWorkerServer(server)).resolves.toBeUndefined();
  }, 20_000);

  it('kills grandchild process via process-group kill', async () => {
    // Skip on non-Linux — negative-PID process-group kill is POSIX-only
    if (process.platform !== 'linux') return;

    const pi = portCounter++;
    const port = 18_900 + pi;
    const gcPidFile = join(tmpDir, `gc-pid-${pi}`);

    // Child script: starts HTTP server AND forks a hanging grandchild
    const server = await startWorkerServer({
      workerIndex: 0,
      parallelIndex: pi,
      basePort: 18_900,
      startupTimeoutMs: 10_000,
      overrideCommand: process.execPath,
      overrideArgs: [
        '-e',
        [
          `const http=require('http');`,
          `const cp=require('child_process');`,
          `const fs=require('fs');`,
          `const s=http.createServer((_q,r)=>{r.writeHead(200);r.end('OK')});`,
          `s.listen(${port},'127.0.0.1');`,
          // Spawn a grandchild that hangs — inherits the process group
          `const gc=cp.spawn(process.execPath,['-e','setTimeout(()=>{},100000)']);`,
          `fs.writeFileSync('${gcPidFile}',String(gc.pid));`,
          `process.on('SIGTERM',()=>s.close(()=>process.exit(0)));`,
        ].join(''),
      ],
    });

    // Read the grandchild PID
    const gcPid = Number(readFileSync(gcPidFile, 'utf-8').trim());

    // Grandchild must be alive before stop
    expect(() => process.kill(gcPid, 0)).not.toThrow();

    await stopWorkerServer(server);

    // Grandchild must be dead after stop (process-group kill killed it).
    // Linux may briefly expose the terminated grandchild as a zombie until
    // init/subreaper reaps it, so poll with a bounded deadline instead of
    // asserting the kill result immediately. A truly live grandchild is never
    // hidden: the deadline error reports it with PID, elapsed time, and the
    // last observed state.
    const startedAt = Date.now();
    const deadline = startedAt + 2_000;
    const pollIntervalMs = 25;
    for (;;) {
      try {
        process.kill(gcPid, 0);
      } catch {
        // kill(gcPid, 0) failed — the grandchild is no longer reachable
        break;
      }
      if (Date.now() >= deadline) {
        throw new Error(
          `grandchild process ${gcPid} is still alive ${Date.now() - startedAt} ms after stop; ` +
            `last observed state: process.kill(${gcPid}, 0) succeeded`,
        );
      }
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
  });
});

// ── R1: Idempotency via exitCode / signalCode ──────────────

describe('stopWorkerServer idempotency (exitCode/signalCode guard)', () => {
  it('does not call process.kill on second stop when child already exited', async () => {
    const pi = portCounter++;
    const port = 18_900 + pi;

    const server = await startWorkerServer({
      workerIndex: 0,
      parallelIndex: pi,
      basePort: 18_900,
      startupTimeoutMs: 10_000,
      overrideCommand: process.execPath,
      overrideArgs: ['-e', httpServerScript(port)],
    });

    // First stop — graceful
    await stopWorkerServer(server);

    // Spy on process.kill after first stop
    const killSpy = vi.spyOn(process, 'kill');

    // Second stop — must be idempotent, NOT call process.kill
    await stopWorkerServer(server);

    const callsTargetingServer = killSpy.mock.calls.filter(
      ([p]) => p === -server.pid || p === server.pid,
    );
    expect(callsTargetingServer).toHaveLength(0);

    killSpy.mockRestore();
  });
});

// ── R2: Backstop, cleanupAllActiveServers, registry ────────

describe('backstop and cleanupAllActiveServers', () => {
  beforeEach(() => {
    resetBackstopForTesting();
  });

  afterEach(() => {
    resetBackstopForTesting();
  });

  it('R2a: registers backstop handlers exactly once', async () => {
    const sigtermBefore = process.listenerCount('SIGTERM');
    const sigintBefore = process.listenerCount('SIGINT');
    const exitBefore = process.listenerCount('exit');

    // First start — must register backstop
    const pi1 = portCounter++;
    const port1 = 18_900 + pi1;
    const s1 = await startWorkerServer({
      workerIndex: 0,
      parallelIndex: pi1,
      basePort: 18_900,
      startupTimeoutMs: 10_000,
      overrideCommand: process.execPath,
      overrideArgs: ['-e', httpServerScript(port1)],
    });
    cleanupServers.push(s1);

    expect(process.listenerCount('SIGTERM')).toBe(sigtermBefore + 1);
    expect(process.listenerCount('SIGINT')).toBe(sigintBefore + 1);
    expect(process.listenerCount('exit')).toBe(exitBefore + 1);

    // Second start — must NOT register again
    const pi2 = portCounter++;
    const port2 = 18_900 + pi2;
    const s2 = await startWorkerServer({
      workerIndex: 0,
      parallelIndex: pi2,
      basePort: 18_900,
      startupTimeoutMs: 10_000,
      overrideCommand: process.execPath,
      overrideArgs: ['-e', httpServerScript(port2)],
    });
    cleanupServers.push(s2);

    expect(process.listenerCount('SIGTERM')).toBe(sigtermBefore + 1);
    expect(process.listenerCount('SIGINT')).toBe(sigintBefore + 1);
    expect(process.listenerCount('exit')).toBe(exitBefore + 1);

    await stopWorkerServer(s1);
    await stopWorkerServer(s2);

    // resetBackstopForTesting must restore original counts
    resetBackstopForTesting();
    expect(process.listenerCount('SIGTERM')).toBe(sigtermBefore);
    expect(process.listenerCount('SIGINT')).toBe(sigintBefore);
    expect(process.listenerCount('exit')).toBe(exitBefore);
  });

  it('R2b: cleanupAllActiveServers kills registered PIDs', async () => {
    const pi = portCounter++;
    const port = 18_900 + pi;

    const server = await startWorkerServer({
      workerIndex: 0,
      parallelIndex: pi,
      basePort: 18_900,
      startupTimeoutMs: 10_000,
      overrideCommand: process.execPath,
      overrideArgs: ['-e', httpServerScript(port)],
    });
    // Not pushed to cleanupServers — manual cleanup via cleanupAllActiveServers

    const pid = server.pid;
    expect(() => process.kill(pid, 0)).not.toThrow(); // alive

    await cleanupAllActiveServers();

    // Brief wait for OS to reap
    await new Promise((r) => setTimeout(r, 300));

    expect(() => process.kill(pid, 0)).toThrow(); // dead
  });

  it('R2c: PID added to registry on start and removed after stop', async () => {
    const pi = portCounter++;
    const port = 18_900 + pi;

    const server = await startWorkerServer({
      workerIndex: 0,
      parallelIndex: pi,
      basePort: 18_900,
      startupTimeoutMs: 10_000,
      overrideCommand: process.execPath,
      overrideArgs: ['-e', httpServerScript(port)],
    });
    cleanupServers.push(server);

    // PID must be in the registry after start
    // Verify indirectly: the PID is alive and cleanupAllActiveServers
    // would kill it — but we can't call cleanup without destroying state.
    // Instead, verify that process.kill(pid, 0) succeeds AND that after
    // stop, the registry no longer contains it (verified by calling
    // cleanupAllActiveServers which should be a no-op for this PID).
    const pid = server.pid;
    expect(() => process.kill(pid, 0)).not.toThrow(); // alive

    await stopWorkerServer(server);

    // After stop, PID should be removed from registry.
    // cleanupAllActiveServers must not affect this PID.
    const killSpy = vi.spyOn(process, 'kill');
    await cleanupAllActiveServers();
    killSpy.mockRestore();

    // process.kill should NOT have been called targeting this server's pid
    // (the registry is empty after stop).
    const callsTargetingServer = killSpy.mock.calls.filter(([p]) => p === -pid || p === pid);
    expect(callsTargetingServer).toHaveLength(0);

    // PID should also be dead after stop
    expect(() => process.kill(pid, 0)).toThrow();
  });
});

// ── R3: Real npm back-to-back regression ───────────────────

describe('real npm-chain back-to-back', () => {
  it('R3: starts, stops, and restarts using real npm run dev', async () => {
    const pi1 = portCounter++;
    const pi2 = portCounter++;

    const s1 = await startWorkerServer({
      workerIndex: 0,
      parallelIndex: pi1,
      basePort: 18_900,
      startupTimeoutMs: 60_000,
    });
    await stopWorkerServer(s1);

    const s2 = await startWorkerServer({
      workerIndex: 1,
      parallelIndex: pi2,
      basePort: 18_900,
      startupTimeoutMs: 60_000,
    });
    await stopWorkerServer(s2);
  }, 120_000);
});

// ── R4: Env override reduces SIGTERM grace ──────────────────

describe('DIFFSCRIBE_E2E_STOP_TIMEOUT_MS', () => {
  const originalEnv = process.env.DIFFSCRIBE_E2E_STOP_TIMEOUT_MS;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.DIFFSCRIBE_E2E_STOP_TIMEOUT_MS;
    } else {
      process.env.DIFFSCRIBE_E2E_STOP_TIMEOUT_MS = originalEnv;
    }
    resetBackstopForTesting();
  });

  it('R4: respects DIFFSCRIBE_E2E_STOP_TIMEOUT_MS for reduced grace period', async () => {
    process.env.DIFFSCRIBE_E2E_STOP_TIMEOUT_MS = '500';

    const pi = portCounter++;
    const port = 18_900 + pi;

    // Server that ignores SIGTERM — forces timeout path
    const server = await startWorkerServer({
      workerIndex: 0,
      parallelIndex: pi,
      basePort: 18_900,
      startupTimeoutMs: 10_000,
      overrideCommand: process.execPath,
      overrideArgs: [
        '-e',
        [
          `const http=require('http');`,
          `const s=http.createServer((_q,r)=>{r.writeHead(200);r.end('OK')});`,
          `s.listen(${port},'127.0.0.1');`,
          `process.on('SIGTERM',()=>{});`, // ignore — must hit timeout
        ].join(''),
      ],
    });

    const start = Date.now();
    await stopWorkerServer(server);
    const elapsed = Date.now() - start;

    // Must complete well below default 5000 ms (allow 2× env for overhead)
    expect(elapsed).toBeLessThan(2000);
  }, 10_000);
});
