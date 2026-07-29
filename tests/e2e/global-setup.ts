import fs from 'node:fs';

/**
 * E2E global setup: the unique per-run DB directory is created in
 * playwright.config.ts (before webServer spawns) and stored in
 * process.env.DIFFSCRIBE_DB_DIR. This setup function is a no-op.
 *
 * Teardown removes the temp directory to ensure no DB state leaks.
 */

async function globalSetup(): Promise<void> {
  // DB dir creation handled in playwright.config.ts
}

export default globalSetup;

export async function globalTeardown(): Promise<void> {
  const dbDir = process.env.DIFFSCRIBE_DB_DIR;
  if (dbDir && fs.existsSync(dbDir)) {
    fs.rmSync(dbDir, { recursive: true, force: true });
  }
}
