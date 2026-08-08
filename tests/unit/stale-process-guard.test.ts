import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  detectStaleProcesses,
  type ExecFn,
  guardStaleProcesses,
} from '../e2e/helpers/stale-process-guard';

// ── Helpers ──────────────────────────────────────────────

/**
 * Build a mock `exec` function from a map of command-substring → result.
 * Throws for any command that doesn't match a key.
 */
const THROW_SENTINEL = Symbol('throw');

function mockExecFromMap(map: Record<string, string | typeof THROW_SENTINEL>): ExecFn {
  return (cmd: string) => {
    for (const [substr, result] of Object.entries(map)) {
      if (cmd.includes(substr)) {
        if (result === THROW_SENTINEL) throw new Error('mock exec failure');
        return result as string;
      }
    }
    throw new Error(`Unexpected exec call: ${cmd.slice(0, 80)}`);
  };
}

/** Create a mock that returns a specific vite process at `cwdPath`. */
function mockSingleViteProcess(pid: number, port: number, cwdPath: string | null): ExecFn {
  return mockExecFromMap(buildViteProcessMap(pid, port, cwdPath));
}

function buildViteProcessMap(
  pid: number,
  port: number,
  cwdPath: string | null,
): Record<string, string | typeof THROW_SENTINEL> {
  const map: Record<string, string | typeof THROW_SENTINEL> = {};
  map[`lsof -i :${port} -t -s TCP:LISTEN`] = `${pid}\n`;
  map[`ps -p ${pid} -o args=`] =
    `node ${cwdPath ?? '/tmp'}/node_modules/.bin/vite dev --port ${port}\n`;
  if (cwdPath !== null) {
    map[`lsof -p ${pid} -a -d cwd -Fn`] = `n${cwdPath}\n`;
  } else {
    map[`lsof -p ${pid} -a -d cwd -Fn`] = THROW_SENTINEL;
  }
  return map;
}

// ── Tests ────────────────────────────────────────────────

describe('stale process guard — detection behaviour', () => {
  const PROJECT_CWD = '/home/user/diffscribe';
  const FOREIGN_CWD = '/home/user/other-project';

  beforeEach(() => {
    delete process.env['DIFFSCRIBE_E2E_KILL_ZOMBIES'];
  });

  it('detects vite dev process when ps args contain vite dev (regardless of comm)', () => {
    const pid = 12345;
    const port = 5173;
    const exec = mockSingleViteProcess(pid, port, PROJECT_CWD);

    const report = detectStaleProcesses(PROJECT_CWD, exec);

    expect(report.processes).toHaveLength(1);
    expect(report.processes[0].pid).toBe(pid);
    expect(report.processes[0].port).toBe(port);
    expect(report.processes[0].command).toContain('vite dev');
    expect(report.foreign).toHaveLength(0);
  });

  it('classifies process from different cwd as foreign', () => {
    const pid = 99999;
    const port = 5173;
    const exec = mockSingleViteProcess(pid, port, FOREIGN_CWD);

    const report = detectStaleProcesses(PROJECT_CWD, exec);

    expect(report.processes).toHaveLength(0);
    expect(report.foreign).toHaveLength(1);
    expect(report.foreign[0].pid).toBe(pid);
    expect(report.foreign[0].port).toBe(port);
  });

  it('classifies process with unresolvable cwd as foreign (safety default)', () => {
    const pid = 55555;
    const port = 5173;
    const exec = mockSingleViteProcess(pid, port, null);

    const report = detectStaleProcesses(PROJECT_CWD, exec);

    expect(report.foreign).toHaveLength(1);
    expect(report.foreign[0].pid).toBe(pid);
    expect(report.processes).toHaveLength(0);
  });

  it('ignores processes without vite dev in args', () => {
    const exec = mockExecFromMap({
      [`lsof -i :5173 -t -s TCP:LISTEN`]: '77777\n',
      [`ps -p 77777 -o args=`]: 'node /home/user/diffscribe/server.js\n',
    });

    const report = detectStaleProcesses(PROJECT_CWD, exec);

    expect(report.processes).toHaveLength(0);
    expect(report.foreign).toHaveLength(0);
  });

  it('handles empty lsof output gracefully', () => {
    const exec = mockExecFromMap({
      [`lsof -i :5173 -t -s TCP:LISTEN`]: '\n',
    });

    const report = detectStaleProcesses(PROJECT_CWD, exec);

    expect(report.processes).toHaveLength(0);
    expect(report.foreign).toHaveLength(0);
  });

  it('handles malformed lsof output (non-numeric PID) gracefully', () => {
    const port = 5173;
    const exec = mockExecFromMap({
      [`lsof -i :${port} -t -s TCP:LISTEN`]: 'abc\nxyz\n12345\n',
      [`ps -p 12345 -o args=`]: `node ${PROJECT_CWD}/node_modules/.bin/vite dev --port ${port}\n`,
      [`lsof -p 12345 -a -d cwd -Fn`]: `n${PROJECT_CWD}\n`,
    });

    const report = detectStaleProcesses(PROJECT_CWD, exec);

    expect(report.processes).toHaveLength(1);
    expect(report.processes[0].pid).toBe(12345);
  });

  it('detects multiple processes on different ports', () => {
    const exec = mockExecFromMap({
      [`lsof -i :5173 -t -s TCP:LISTEN`]: '100\n',
      [`ps -p 100 -o args=`]: `node ${PROJECT_CWD}/node_modules/.bin/vite dev --port 5173\n`,
      [`lsof -p 100 -a -d cwd -Fn`]: `n${PROJECT_CWD}\n`,
      [`lsof -i :56823 -t -s TCP:LISTEN`]: '200\n',
      [`ps -p 200 -o args=`]: `node ${PROJECT_CWD}/node_modules/.bin/vite dev --port 56823\n`,
      [`lsof -p 200 -a -d cwd -Fn`]: `n${PROJECT_CWD}\n`,
    });

    const report = detectStaleProcesses(PROJECT_CWD, exec);

    expect(report.processes).toHaveLength(2);
    expect(report.processes.map((p) => p.pid).sort()).toEqual([100, 200]);
    expect(report.processes.map((p) => p.port).sort()).toEqual([5173, 56823]);
  });

  it('uses /proc fallback when ps -o args= fails', () => {
    const pid = 300;
    const port = 56823;
    const exec = (cmd: string) => {
      if (cmd.includes(`lsof -i :${port} -t -s TCP:LISTEN`)) return `${pid}\n`;
      if (cmd.includes(`ps -p ${pid} -o args=`)) throw new Error('ps failed');
      if (cmd.includes(`cat /proc/${pid}/cmdline`))
        return `node\0${PROJECT_CWD}/node_modules/.bin/vite\0dev\0--port\0${port}\0`;
      if (cmd.includes(`lsof -p ${pid} -a -d cwd -Fn`)) return `n${PROJECT_CWD}\n`;
      throw new Error('no-match');
    };

    const report = detectStaleProcesses(PROJECT_CWD, exec);

    expect(report.processes).toHaveLength(1);
    expect(report.processes[0].pid).toBe(pid);
    expect(report.processes[0].command).toContain('vite dev');
  });

  it('H4 RED: detects vite dev on a dynamic worker port outside COMMON_PORTS', () => {
    const pid = 42001;
    // Dynamic worker port: 0005 workers bind to basePort + parallelIndex
    // (e.g. 5173 + 28 = 5201), which the static COMMON_PORTS list never
    // covers. The stale guard must accept the dynamic worker port range.
    const port = 5999;
    const exec = mockSingleViteProcess(pid, port, PROJECT_CWD);

    const report = detectStaleProcesses(PROJECT_CWD, exec, [5173, 5999]);

    expect(
      report.processes,
      'H4 RED: dynamic worker port not scanned by the stale guard',
    ).toHaveLength(1);
    expect(report.processes[0].pid).toBe(pid);
    expect(report.processes[0].port).toBe(port);
  });

  it('derives the worker port range from DIFFSCRIBE_E2E_BASE_PORT by default', () => {
    process.env.DIFFSCRIBE_E2E_BASE_PORT = '7000';
    try {
      const pid = 43001;
      const port = 7003; // base + parallelIndex, inside the derived range
      const exec = mockSingleViteProcess(pid, port, PROJECT_CWD);

      const report = detectStaleProcesses(PROJECT_CWD, exec);

      expect(report.processes).toHaveLength(1);
      expect(report.processes[0].pid).toBe(pid);
      expect(report.processes[0].port).toBe(port);
    } finally {
      delete process.env.DIFFSCRIBE_E2E_BASE_PORT;
    }
  });
});

describe('stale process guard — kill behaviour', () => {
  const PROJECT_CWD = '/home/user/diffscribe';

  beforeEach(() => {
    delete process.env['DIFFSCRIBE_E2E_KILL_ZOMBIES'];
  });

  it('does NOT kill processes when DIFFSCRIBE_E2E_KILL_ZOMBIES is not set', () => {
    const pid = 12345;
    const port = 5173;
    const exec = mockSingleViteProcess(pid, port, PROJECT_CWD);

    const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true);

    const report = guardStaleProcesses(PROJECT_CWD, exec);

    expect(killSpy).not.toHaveBeenCalled();
    expect(report.processes).toHaveLength(1);

    killSpy.mockRestore();
  });

  it('kills processes when DIFFSCRIBE_E2E_KILL_ZOMBIES is true', () => {
    process.env['DIFFSCRIBE_E2E_KILL_ZOMBIES'] = 'true';
    const pid = 12345;
    const port = 5173;
    const exec = mockSingleViteProcess(pid, port, PROJECT_CWD);

    const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true);

    const report = guardStaleProcesses(PROJECT_CWD, exec);

    expect(killSpy).toHaveBeenCalledTimes(1);
    expect(killSpy).toHaveBeenCalledWith(pid, 'SIGKILL');
    expect(report.processes).toHaveLength(1);

    killSpy.mockRestore();
  });

  it('never kills foreign processes even with kill flag', () => {
    process.env['DIFFSCRIBE_E2E_KILL_ZOMBIES'] = 'true';
    const projectPid = 12345;
    const foreignPid = 99999;
    const port = 5173;

    const exec = mockExecFromMap({
      [`lsof -i :${port} -t -s TCP:LISTEN`]: `${projectPid}\n${foreignPid}\n`,
      [`ps -p ${projectPid} -o args=`]: `node ${PROJECT_CWD}/node_modules/.bin/vite dev --port ${port}\n`,
      [`lsof -p ${projectPid} -a -d cwd -Fn`]: `n${PROJECT_CWD}\n`,
      [`ps -p ${foreignPid} -o args=`]: `node /other/node_modules/.bin/vite dev --port ${port}\n`,
      [`lsof -p ${foreignPid} -a -d cwd -Fn`]: `n/home/user/other\n`,
    });

    const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true);

    const report = guardStaleProcesses(PROJECT_CWD, exec);

    expect(killSpy).toHaveBeenCalledTimes(1);
    expect(killSpy).toHaveBeenCalledWith(projectPid, 'SIGKILL');
    expect(killSpy).not.toHaveBeenCalledWith(foreignPid, 'SIGKILL');

    expect(report.processes).toHaveLength(1);
    expect(report.processes[0].pid).toBe(projectPid);
    expect(report.foreign).toHaveLength(1);
    expect(report.foreign[0].pid).toBe(foreignPid);

    killSpy.mockRestore();
  });

  it('returns empty report when no processes are detected', () => {
    const exec = mockExecFromMap({
      [`lsof -i :5173 -t -s TCP:LISTEN`]: '\n',
    });

    const report = guardStaleProcesses(PROJECT_CWD, exec);

    expect(report.processes).toHaveLength(0);
    expect(report.foreign).toHaveLength(0);
  });
});
