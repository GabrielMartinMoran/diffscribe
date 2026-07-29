import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { defineConfig } from '@playwright/test';

// Generate a unique per-run DB directory BEFORE the webServer spawns.
// Playwright starts webServer before globalSetup, so we must set
// DIFFSCRIBE_DB_DIR at config evaluation time.
const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'diffscribe-e2e-'));
process.env.DIFFSCRIBE_DB_DIR = dbDir;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  retries: 0,
  fullyParallel: false,
  workers: 1,
  globalSetup: './tests/e2e/global-setup.ts',
  globalTeardown: './tests/e2e/global-setup.ts',
  use: {
    baseURL: 'http://localhost:5173',
    browserName: 'chromium',
    headless: true,
  },
  webServer: {
    command: 'npm run dev -- --port 5173',
    url: 'http://localhost:5173',
    reuseExistingServer: false,
    timeout: 30_000,
    env: {
      DIFFSCRIBE_E2E_RESET_SECRET: 'e2e-reset-894a7f3c',
      // DIFFSCRIBE_DB_DIR is set in process.env above and inherited by the child process.
    },
  },
});
