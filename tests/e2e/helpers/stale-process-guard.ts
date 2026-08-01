import { execSync } from 'node:child_process';
import { cwd } from 'node:process';

// ── Types ──────────────────────────────────────────────

export interface StaleProcess {
  pid: number;
  command: string;
  port: number;
}

export interface StaleProcessReport {
  processes: StaleProcess[];
  foreign: StaleProcess[];
}

/** Injected exec — matches the signature of `execSync` for testing. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ExecFn = (command: string, options?: { encoding: string; timeout: number }) => any;

// ── Constants ──────────────────────────────────────────

const COMMON_PORTS = [5173, 56823, 5174, 5175, 5176, 4173];
const TARGET_COMMAND_PATTERN = 'vite dev';

// ── Public API ─────────────────────────────────────────

/**
 * Detect stale `vite dev` processes running on common ports.
 *
 * Uses `lsof -i` (Linux/macOS) to find processes listening on the common
 * ports, then filters by command name and working directory.  Processes
 * running from a different `cwd` are reported as foreign and are **never**
 * killed by this guard.
 *
 * @param projectCwd - the project working directory to filter by.
 *   Defaults to `process.cwd()`.
 * @param exec - injectable exec function (defaults to `execSync`).
 *   Useful for testing without mocking native modules.
 * @returns a report of detected and foreign processes.
 */
export function detectStaleProcesses(
  projectCwd: string = cwd(),
  exec: ExecFn = execSync,
): StaleProcessReport {
  const report: StaleProcessReport = { processes: [], foreign: [] };

  for (const port of COMMON_PORTS) {
    let output: string;
    try {
      output = exec(`lsof -i :${port} -t -s TCP:LISTEN 2>/dev/null`, {
        encoding: 'utf-8',
        timeout: 2_000,
      }).trim();
    } catch {
      continue; // lsof failed or no process on this port
    }

    if (!output) continue;

    const pids = output
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map(Number)
      .filter((n) => !Number.isNaN(n) && n > 0);

    for (const pid of pids) {
      // Get full command args to check for vite dev.
      //
      // We use `ps -o args=` because `ps -o comm=` reports "MainThread"
      // on Node 24+ (Linux), which would skip legitimate vite processes.
      // We also try /proc/<pid>/cmdline as a faster fallback on Linux.
      let fullCmd: string;
      try {
        fullCmd = exec(`ps -p ${pid} -o args= 2>/dev/null`, {
          encoding: 'utf-8',
          timeout: 1_000,
        }).trim();
      } catch {
        // Fallback to /proc/<pid>/cmdline on Linux
        try {
          fullCmd = exec(`cat /proc/${pid}/cmdline 2>/dev/null`, {
            encoding: 'utf-8',
            timeout: 1_000,
          })
            .replace(/\0/g, ' ')
            .trim();
        } catch {
          continue;
        }
      }

      if (!fullCmd.includes(TARGET_COMMAND_PATTERN)) continue;

      // Get the working directory of the process
      let processCwd: string;
      try {
        processCwd = exec(`lsof -p ${pid} -a -d cwd -Fn 2>/dev/null`, {
          encoding: 'utf-8',
          timeout: 1_000,
        }).trim();
        // lsof -Fn outputs "n<path>"; extract the path
        const match = processCwd.match(/^n(.+)$/m);
        processCwd = match ? match[1].trim() : '';
      } catch {
        // Cannot determine cwd — treat as foreign for safety
        report.foreign.push({ pid, command: fullCmd, port });
        continue;
      }

      const entry: StaleProcess = { pid, command: fullCmd, port };

      if (processCwd && processCwd === projectCwd) {
        report.processes.push(entry);
      } else {
        report.foreign.push(entry);
      }
    }
  }

  return report;
}

/**
 * Check for stale processes and warn the user. Does NOT kill anything
 * unless `DIFFSCRIBE_E2E_KILL_ZOMBIES=true` is set in the environment.
 *
 * @param projectCwd - the project working directory to filter by.
 * @returns the report of detected processes.
 */
export function guardStaleProcesses(
  projectCwd: string = cwd(),
  exec: ExecFn = execSync,
): StaleProcessReport {
  const report = detectStaleProcesses(projectCwd, exec);

  if (report.processes.length === 0 && report.foreign.length === 0) {
    return report;
  }

  if (report.processes.length > 0) {
    const pidList = report.processes.map((p) => p.pid).join(', ');
    const portList = report.processes.map((p) => p.port).join(', ');
    console.warn(
      `[stale-process-guard] Detected ${report.processes.length} stale vite dev ` +
        `process(es) for this project (PIDs: ${pidList}, ports: ${portList}).`,
    );

    if (process.env['DIFFSCRIBE_E2E_KILL_ZOMBIES'] === 'true') {
      for (const proc of report.processes) {
        try {
          process.kill(proc.pid, 'SIGKILL');
          console.warn(`[stale-process-guard] Killed PID ${proc.pid} (port ${proc.port}).`);
        } catch {
          console.warn(`[stale-process-guard] Failed to kill PID ${proc.pid} (port ${proc.port}).`);
        }
      }
    } else {
      console.warn('[stale-process-guard] Set DIFFSCRIBE_E2E_KILL_ZOMBIES=true to auto-kill.');
    }
  }

  if (report.foreign.length > 0) {
    const pidList = report.foreign.map((p) => p.pid).join(', ');
    console.warn(
      `[stale-process-guard] Detected ${report.foreign.length} foreign vite dev ` +
        `process(es) from different project(s) (PIDs: ${pidList}). ` +
        `These will NOT be killed.`,
    );
  }

  return report;
}
