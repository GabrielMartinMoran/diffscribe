import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { expect, test } from './fixtures';

test.describe.configure({ mode: 'parallel' });

/**
 * Log worker identity for observable parallel evidence.
 * Called at the top of each test to emit workerIndex, parallelIndex,
 * and baseURL (which includes the unique port per worker).
 */
function logWorkerIdentity(baseURL: string): void {
  const info = test.info();
  const { workerIndex, parallelIndex, title } = info;
  const url = new URL(baseURL);
  process.stdout.write(
    `[worker-evidence] wi=${workerIndex} pi=${parallelIndex} pid=${process.pid} port=${url.port} baseURL=${baseURL} title=${title}\n`,
  );
}

test('worker server responds to page navigation', async ({ page, workerBaseURL }) => {
  logWorkerIdentity(workerBaseURL);
  await page.goto('/');
  await expect(page.locator('#workspace-sidebar')).toBeVisible();
});

test('worker reset endpoint returns 200', async ({ request, workerBaseURL }) => {
  logWorkerIdentity(workerBaseURL);
  const response = await request.delete('/api/test/state', {
    headers: { 'x-reset-secret': 'e2e-reset-894a7f3c' },
  });
  expect(response.ok()).toBeTruthy();
});

test('worker-specific baseURL returns HTML content', async ({ request, workerBaseURL }) => {
  logWorkerIdentity(workerBaseURL);
  const response = await request.get('/');
  expect(response.ok()).toBeTruthy();
  const ct = response.headers()['content-type'] || '';
  expect(ct).toContain('text/html');
});

test('same workspace name registers independently across workers', async ({
  page,
  request,
  workerBaseURL,
}) => {
  logWorkerIdentity(workerBaseURL);
  // Reset DB
  const resetResponse = await request.delete('/api/test/state', {
    headers: { 'x-reset-secret': 'e2e-reset-894a7f3c' },
  });
  expect(resetResponse.ok()).toBeTruthy();

  // Create a temp git repo for this test
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'diffscribe-e2e-isolation-'));
  const repoPath = path.join(fixtureRoot, 'repo');
  try {
    fs.mkdirSync(repoPath, { recursive: true });
    execSync('git init', { cwd: repoPath, stdio: 'pipe' });
    execSync('git config user.email "e2e@test.com"', { cwd: repoPath, stdio: 'pipe' });
    execSync('git config user.name "E2E Test"', { cwd: repoPath, stdio: 'pipe' });
    fs.writeFileSync(path.join(repoPath, 'README.md'), '# isolation test');
    execSync('git add .', { cwd: repoPath, stdio: 'pipe' });
    execSync('git commit -m "init"', { cwd: repoPath, stdio: 'pipe' });

    // Navigate to the app
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Register workspace with the same fixed name (each worker has its own DB)
    const wsName = 'Worker-Isolation-Workspace';
    const toggleBtn = page.getByTestId('open-workspace-toggle');
    await toggleBtn.click();
    await page.waitForSelector('[data-testid="open-workspace-form"]', {
      state: 'visible',
      timeout: 10_000,
    });
    await page.fill('#ws-path', repoPath);
    await page.fill('#ws-name', wsName);
    await page.click('#open-workspace-form button[type="submit"]');
    await page.waitForLoadState('networkidle');

    // Verify the workspace appears in sidebar
    const sidebarItem = page.locator(`#workspace-sidebar li:has-text("${wsName}")`).first();
    await expect(sidebarItem).toBeVisible({ timeout: 10_000 });
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
});
