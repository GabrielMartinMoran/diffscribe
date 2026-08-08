import type { ChildProcess } from 'node:child_process';
import { spawn } from 'node:child_process';

// ── Types ──────────────────────────────────────────────

export type WorkerServerMode = 'dev' | 'production';

export interface WorkerServerOptions {
  /** Sequential worker index (0-based). */
  readonly workerIndex: number;
  /** Playwright parallelIndex (0-based). */
  readonly parallelIndex: number;
  /** Base port; default from DIFFSCRIBE_E2E_BASE_PORT env or 5173. */
  readonly basePort?: number;
  /** Readiness timeout in ms; default 60_000. */
  readonly startupTimeoutMs?: number;
  /**
   * Server mode. `dev` (default) spawns `npm run dev`; `production` spawns
   * `npm run preview` (requires a prior `npm run build`) so the baseline can
   * be measured against the production build.
   */
  readonly mode?: WorkerServerMode;
  /** Test-only: override the command binary (default: `npm`). */
  readonly overrideCommand?: string;
  /** Test-only: override command arguments. */
  readonly overrideArgs?: readonly string[];
  /** Test-only: extra env merged on top of the defaults. */
  readonly overrideEnv?: Record<string, string>;
}

/**
 * Additive readiness/stderr telemetry (0005 Phase 1). Recording this metadata
 * never changes the readiness decision; it only makes the startup observable.
 */
export interface WorkerReadinessTelemetry {
  /** Number of HTTP readiness probes attempted before the first 2xx. */
  readonly attempts: number;
  /** Epoch ms of the first 2xx readiness probe, or `null` if it never succeeded. */
  readonly firstResponseAtMs: number | null;
  /** Last captured stderr snapshot from the child process. */
  readonly stderrSnapshot: string;
}

export interface WorkerServer {
  readonly workerIndex: number;
  readonly parallelIndex: number;
  readonly port: number;
  readonly baseURL: string;
  readonly pid: number;
  /** Additive readiness/stderr telemetry. */
  readonly readiness: WorkerReadinessTelemetry;
  /**
   * @internal Child process handle — exposed so that
   * `stopWorkerServer` can access it.
   */
  readonly _child: ChildProcess;
}

// ── Constants ──────────────────────────────────────────

const DEFAULT_RESET_SECRET = 'e2e-reset-894a7f3c';
const STOP_SIGTERM_TIMEOUT_MS = 5_000;
const DEFAULT_BASE_PORT = 5_173;
const POLL_INTERVAL_MS = 200;
const REQUEST_TIMEOUT_MS = 2_000;
const MAX_STDERR_SNAPSHOT_CHARS = 2_000;

// ── PID registry & backstop state ──────────────────────

const activePids = new Set<number>();

let _backstopRegistered = false;
let _sigtermHandler: (() => void) | null = null;
let _sigintHandler: (() => void) | null = null;
let _exitHandler: (() => void) | null = null;

// ── Public API ─────────────────────────────────────────

/**
 * Build the default npm arguments for a server mode. Dev spawns the Vite dev
 * server; production spawns `vite preview` over the last `vite build` output.
 * Both bind to 127.0.0.1 on the given port and fail fast on port conflicts
 * (`--strictPort`).
 */
export function buildServerArgs(mode: WorkerServerMode, port: number): string[] {
  const script = mode === 'production' ? 'preview' : 'dev';
  return ['run', script, '--', '--host', '127.0.0.1', '--port', String(port), '--strictPort'];
}

/**
 * Spawn a SvelteKit dev server for a single worker and wait until it
 * responds to HTTP GET /.
 *
 * On failure (child exits early, readiness timeout) the child process is
 * killed before the returned promise rejects.
 */
export async function startWorkerServer(options: WorkerServerOptions): Promise<WorkerServer> {
  ensureBackstop();

  const basePort =
    options.basePort ?? Number(process.env.DIFFSCRIBE_E2E_BASE_PORT ?? DEFAULT_BASE_PORT);
  const port = basePort + options.parallelIndex;
  const baseURL = `http://127.0.0.1:${port}`;
  const timeoutMs = options.startupTimeoutMs ?? 60_000;

  const mode = options.mode ?? 'dev';
  const command = options.overrideCommand ?? 'npm';
  const args = options.overrideArgs ?? buildServerArgs(mode, port);

  const child = spawn(command, [...args], {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
    detached: true,
    env: {
      ...process.env,
      // Dev-only: the in-memory test database. Production servers fail
      // closed when this flag is set, so production mode omits it (the
      // production baseline points DIFFSCRIBE_DB_DIR at a temp dir instead).
      ...(mode === 'production' ? {} : { DIFFSCRIBE_E2E_IN_MEMORY_DB: '1' }),
      DIFFSCRIBE_E2E_RESET_SECRET: process.env.DIFFSCRIBE_E2E_RESET_SECRET ?? DEFAULT_RESET_SECRET,
      DIFFSCRIBE_E2E_WORKER_INDEX: String(options.workerIndex),
      ...options.overrideEnv,
    },
  });

  let stderr = '';
  child.stderr?.on('data', (chunk: Buffer) => {
    stderr += chunk.toString();
  });

  // Register the PID BEFORE readiness so the backstop can clean up the
  // process group even when startup fails (0005 H4). The child was spawned
  // with `detached: true`, so it leads its own process group; killing that
  // group never touches processes of other workers or projects.
  const pid = child.pid;
  if (pid) {
    activePids.add(pid);
  }

  let readinessResult: ReadinessResult;
  try {
    readinessResult = await waitForReadiness(baseURL, timeoutMs, child, () => stderr);
  } catch (err) {
    killChild(child);
    if (pid) {
      activePids.delete(pid);
    }
    throw err;
  }

  return {
    workerIndex: options.workerIndex,
    parallelIndex: options.parallelIndex,
    port,
    baseURL,
    pid: child.pid!,
    readiness: {
      attempts: readinessResult.attempts,
      firstResponseAtMs: readinessResult.firstResponseAtMs,
      stderrSnapshot: stderr.slice(-MAX_STDERR_SNAPSHOT_CHARS),
    },
    _child: child,
  };
}

/**
 * Gracefully stop a worker server.
 *
 * - Sends `SIGTERM` and waits up to the stop timeout for the process to
 *   exit. The timeout defaults to 5 000 ms and can be overridden via the
 *   `DIFFSCRIBE_E2E_STOP_TIMEOUT_MS` environment variable.
 * - Falls back to `SIGKILL` if the process is still alive after the grace
 *   period.
 * - Idempotent: calling `stopWorkerServer` on an already-stopped or
 *   already-stopping server is a no-op. The guard checks `exitCode` and
 *   `signalCode` rather than `child.killed` because `process.kill(-pid)`
 *   on a process group does not set `child.killed`.
 */
export async function stopWorkerServer(server: WorkerServer): Promise<void> {
  const child: ChildProcess = (server as { _child: ChildProcess })._child;

  if (!child) return;

  const pid = child.pid;
  if (!pid) return;

  // Idempotency: skip if the child has already exited
  if (child.exitCode !== null || child.signalCode !== null) {
    activePids.delete(pid);
    return;
  }

  const exited = onExit(child);
  const timeoutMs = getStopTimeoutMs();

  // Send SIGTERM to the entire process group (POSIX).
  // The child was spawned with `detached: true`, making it the leader of a
  // new process group. Killing the group (-pid) kills all descendants too.
  try {
    process.kill(-pid, 'SIGTERM');
  } catch {
    // Fallback for platforms without process-group support (e.g. Windows):
    // kill the direct child process.
    child.kill('SIGTERM');
  }

  const winner = await Promise.race([
    exited.then(() => 'exited' as const),
    sleep(timeoutMs).then(() => 'timeout' as const),
  ]);

  if (winner === 'timeout') {
    try {
      process.kill(-pid, 'SIGKILL');
    } catch {
      child.kill('SIGKILL');
    }
    await exited;
  }

  activePids.delete(pid);
}

/**
 * Force-kill all registered worker servers.
 *
 * Sends `SIGKILL` to the process group of every PID in the registry and
 * then clears the registry. Safe to call when the registry is empty.
 */
export function cleanupAllActiveServers(): void {
  for (const pid of activePids) {
    try {
      process.kill(-pid, 'SIGKILL');
    } catch {
      // PID already dead or platform without process-group support — ignore
    }
  }
  activePids.clear();
}

/**
 * **Test-only seam.**
 *
 * Removes the backstop signal/exit handlers that this module registered
 * (if any) and clears the active-PID registry. Call this in
 * `beforeEach` / `afterEach` to isolate tests.
 */
export function resetBackstopForTesting(): void {
  if (_sigtermHandler) {
    process.removeListener('SIGTERM', _sigtermHandler);
    _sigtermHandler = null;
  }
  if (_sigintHandler) {
    process.removeListener('SIGINT', _sigintHandler);
    _sigintHandler = null;
  }
  if (_exitHandler) {
    process.removeListener('exit', _exitHandler);
    _exitHandler = null;
  }
  _backstopRegistered = false;
  activePids.clear();
}

// ── Internal helpers ───────────────────────────────────

/**
 * Ensure the process-level backstop handlers for SIGTERM, SIGINT, and exit
 * are registered exactly once. Subsequent calls are no-ops.
 */
function ensureBackstop(): void {
  if (_backstopRegistered) return;
  _backstopRegistered = true;

  _sigtermHandler = () => {
    cleanupAllActiveServers();
    process.exit(0);
  };
  _sigintHandler = () => {
    cleanupAllActiveServers();
    process.exit(0);
  };
  _exitHandler = () => {
    // 'exit' handler: can only perform synchronous work.
    cleanupAllActiveServers();
  };

  process.on('SIGTERM', _sigtermHandler);
  process.on('SIGINT', _sigintHandler);
  process.on('exit', _exitHandler);
}

/**
 * Read `DIFFSCRIBE_E2E_STOP_TIMEOUT_MS` from the environment.
 * Returns the default `STOP_SIGTERM_TIMEOUT_MS` (5 000 ms) when the
 * variable is absent, empty, or not a positive number.
 */
function getStopTimeoutMs(): number {
  const raw = process.env.DIFFSCRIBE_E2E_STOP_TIMEOUT_MS;
  if (raw !== undefined && raw !== '') {
    const parsed = Number(raw);
    if (!Number.isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return STOP_SIGTERM_TIMEOUT_MS;
}

/**
 * Additive readiness telemetry result: how many probes were attempted and
 * when the first 2xx response arrived.
 */
interface ReadinessResult {
  attempts: number;
  firstResponseAtMs: number | null;
}

/**
 * Poll `GET <url>/` until the server responds with a 2xx status, the child
 * exits, or the deadline is reached. Returns additive readiness telemetry.
 */
async function waitForReadiness(
  url: string,
  timeoutMs: number,
  child: ChildProcess,
  getStderr: () => string,
): Promise<ReadinessResult> {
  const deadline = Date.now() + timeoutMs;
  let attempts = 0;
  let firstResponseAtMs: number | null;

  while (Date.now() < deadline) {
    // Child exited before becoming ready
    if (child.exitCode !== null || child.signalCode !== null) {
      const stderr = getStderr();
      const parts: string[] = [
        `Child process exited before readiness`,
        `(exit=${child.exitCode}, signal=${child.signalCode})`,
      ];
      if (stderr) {
        parts.push(`\nstderr:\n${stderr}`);
      }
      throw new Error(parts.join(' '));
    }

    // Try a single HTTP request with its own short timeout
    attempts += 1;
    const probe = await httpGetText(url);
    if (probe?.ok) {
      firstResponseAtMs = Date.now();
      // H3: readiness also requires every JS chunk referenced by the served
      // HTML to be available. A failing chunk rejects readiness and reports
      // the failing resource instead of merely repeating GET /.
      const failedChunk = await findFailedJsChunk(url, probe.body);
      if (failedChunk) {
        throw new Error(failedChunk);
      }
      return { attempts, firstResponseAtMs };
    }

    await sleep(POLL_INTERVAL_MS);
  }

  // Timeout reached
  const stderr = getStderr();
  const parts: string[] = [`Readiness timeout after ${timeoutMs} ms on ${url}`];
  if (stderr) {
    parts.push(`\nstderr:\n${stderr}`);
  }
  throw new Error(parts.join(' '));
}

/**
 * Attempt a single HTTP GET with a short timeout, returning the status and
 * body. Returns `null` on network errors or timeouts.
 */
async function httpGetText(url: string): Promise<HttpProbeResult | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    const body = await res.text();
    return { ok: res.ok, status: res.status, body };
  } catch {
    return null;
  }
}

/** Result of a single HTTP probe: status plus body. */
interface HttpProbeResult {
  ok: boolean;
  status: number;
  body: string;
}

/** Matches `<script ... src="...">` tags whose src points at a `.js` file. */
const MODULE_SCRIPT_SRC_PATTERN = /<script[^>]*\bsrc\s*=\s*["']([^"']+\.js[^"']*)["']/gi;

/**
 * H3: validate that every JavaScript chunk referenced by the served HTML is
 * available. Returns a readable failure message naming the failing chunk, or
 * `null` when every referenced chunk responds 2xx (or the HTML references
 * no `.js` chunk at all — nothing to validate, readiness falls back to the
 * `GET /` 2xx contract).
 */
async function findFailedJsChunk(baseUrl: string, html: string): Promise<string | null> {
  const chunkUrls = [...html.matchAll(MODULE_SCRIPT_SRC_PATTERN)].map((match) =>
    new URL(match[1], `${baseUrl}/`).toString(),
  );
  for (const chunkUrl of chunkUrls) {
    const probe = await httpGetText(chunkUrl);
    if (!probe) {
      return `Readiness failed: required JS chunk ${chunkUrl} did not respond`;
    }
    if (probe.status >= 400) {
      return `Readiness failed: required JS chunk ${chunkUrl} responded with HTTP ${probe.status}`;
    }
  }
  return null;
}

/**
 * Force-kill a child process and its descendants.
 *
 * The child was spawned with `detached: true`, making it the leader of its
 * own process group, so `process.kill(-pid, 'SIGKILL')` kills the whole
 * group (including any grandchild processes spawned before startup failed).
 * On platforms without negative-PID process-group support (e.g. Windows) it
 * falls back to killing the direct child. Safe to call on an already-dead
 * process; never touches processes outside the child's own group.
 */
function killChild(child: ChildProcess): void {
  const pid = child.pid;
  if (!pid) return;
  try {
    process.kill(-pid, 'SIGKILL');
  } catch {
    if (!child.killed) {
      child.kill('SIGKILL');
    }
  }
}

/**
 * Return a promise that resolves when the child exits or errors.
 * Handles the race between listener registration and exit.
 */
function onExit(child: ChildProcess): Promise<void> {
  return new Promise<void>((resolve) => {
    const done = (): void => {
      child.removeListener('exit', done);
      child.removeListener('error', done);
      resolve();
    };
    child.on('exit', done);
    child.on('error', done);

    // Already exited before our listener was registered
    if (child.exitCode !== null || child.signalCode !== null) {
      child.removeListener('exit', done);
      child.removeListener('error', done);
      resolve();
    }
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
