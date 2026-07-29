import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Vitest global setup — runs once in the main process before any test worker.
 *
 * Creates a unique temporary directory for isolated test databases and
 * tears it down after all tests finish. Workers receive the path via
 * `inject('dbDir')` in their setup files.
 */

let dbDir: string;

export function setup({ provide }: { provide: (key: string, value: unknown) => void }): void {
  dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'diffscribe-vitest-'));
  provide('dbDir', dbDir);
}

export function teardown(): void {
  try {
    if (dbDir && fs.existsSync(dbDir)) {
      fs.rmSync(dbDir, { recursive: true, force: true });
    }
  } catch {
    // Best-effort cleanup — stale temp dirs are harmless
  }
}
