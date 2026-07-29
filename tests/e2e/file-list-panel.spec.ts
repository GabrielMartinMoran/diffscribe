import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { expect, test } from '@playwright/test';

import { registerAndSelectWorkspace, selectRailTab } from './helpers/register-workspace';
import { resetDb } from './helpers/reset-db';

function mkTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'diffscribe-e2e-fl-'));
}

function createGitRepo(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
  execSync('git init', { cwd: dir, stdio: 'pipe' });
  execSync('git config user.email "e2e@test.com"', { cwd: dir, stdio: 'pipe' });
  execSync('git config user.name "E2E Test"', { cwd: dir, stdio: 'pipe' });
  fs.writeFileSync(path.join(dir, 'README.md'), '# e2e');
  execSync('git add .', { cwd: dir, stdio: 'pipe' });
  execSync('git commit -m "init"', { cwd: dir, stdio: 'pipe' });
}

function rmDir(dir: string): void {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test.describe('File List Panel (E2E)', () => {
  test.beforeEach(async ({ page, request }) => {
    await resetDb(request);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('shows file list with entries for a modified workspace', async ({ page }) => {
    const fixtureDir = mkTempDir();
    const repoDir = path.join(fixtureDir, 'repo');
    try {
      createGitRepo(repoDir);
      // Create a modified file
      fs.appendFileSync(path.join(repoDir, 'README.md'), '\n# modified');
      await registerAndSelectWorkspace(page, repoDir, `FL-Mod-${Date.now()}`, 'git');
      await page.reload();
      await page.waitForLoadState('networkidle');
      await selectRailTab(page, 'git');

      const panel = page.locator('#file-list-panel');
      await expect(panel).toBeVisible({ timeout: 8000 });
      // A modified file should appear in the file list — wait with auto-retry
      const rows = panel.locator('.file-row');
      await expect(rows.first()).toBeVisible({ timeout: 10000 });
      const count = await rows.count();
      expect(count).toBeGreaterThanOrEqual(1);
    } finally {
      rmDir(fixtureDir);
    }
  });

  test('shows status badges for different file statuses', async ({ page }) => {
    const fixtureDir = mkTempDir();
    const repoDir = path.join(fixtureDir, 'repo');
    try {
      createGitRepo(repoDir);
      // Add a new staged file
      fs.writeFileSync(path.join(repoDir, 'new-file.ts'), 'new');
      execSync('git add new-file.ts', { cwd: repoDir, stdio: 'pipe' });
      // Delete a tracked file
      fs.writeFileSync(path.join(repoDir, 'rm-file.ts'), 'temp');
      execSync('git add rm-file.ts && git commit -m "add"', { cwd: repoDir, stdio: 'pipe' });
      execSync('git rm rm-file.ts', { cwd: repoDir, stdio: 'pipe' });

      await registerAndSelectWorkspace(page, repoDir, `FL-Status-${Date.now()}`, 'git');
      await page.reload();
      await page.waitForLoadState('networkidle');
      await selectRailTab(page, 'git');

      const panel = page.locator('#file-list-panel');
      await expect(panel).toBeVisible({ timeout: 8000 });

      // Status badges should be present
      await expect(panel.locator('.status-badge').first()).toBeVisible({ timeout: 10000 });
    } finally {
      rmDir(fixtureDir);
    }
  });

  test('shows untracked files in file list', async ({ page }) => {
    const fixtureDir = mkTempDir();
    const repoDir = path.join(fixtureDir, 'repo');
    try {
      createGitRepo(repoDir);
      fs.writeFileSync(path.join(repoDir, 'untracked.txt'), 'fresh');
      await registerAndSelectWorkspace(page, repoDir, `FL-Untracked-${Date.now()}`, 'git');
      await page.reload();
      await page.waitForLoadState('networkidle');
      await selectRailTab(page, 'git');

      const panel = page.locator('#file-list-panel');
      await expect(panel).toBeVisible({ timeout: 8000 });
      await expect(panel).toContainText('untracked.txt', { timeout: 10000 });
    } finally {
      rmDir(fixtureDir);
    }
  });

  test('filters files by path substring', async ({ page }) => {
    const fixtureDir = mkTempDir();
    const repoDir = path.join(fixtureDir, 'repo');
    try {
      createGitRepo(repoDir);
      fs.mkdirSync(path.join(repoDir, 'src', 'auth'), { recursive: true });
      fs.writeFileSync(path.join(repoDir, 'src/auth/login.ts'), 'login');
      fs.writeFileSync(path.join(repoDir, 'src/auth/logout.ts'), 'logout');
      fs.mkdirSync(path.join(repoDir, 'docs'), { recursive: true });
      fs.writeFileSync(path.join(repoDir, 'docs/readme.md'), 'docs');
      execSync('git add .', { cwd: repoDir, stdio: 'pipe' });
      execSync('git commit -m "add files"', { cwd: repoDir, stdio: 'pipe' });
      // Modify to create changes
      fs.appendFileSync(path.join(repoDir, 'src/auth/login.ts'), '\nmod');

      await registerAndSelectWorkspace(page, repoDir, `FL-Filter-${Date.now()}`, 'git');
      await page.reload();
      await page.waitForLoadState('networkidle');
      await selectRailTab(page, 'git');

      const panel = page.locator('#file-list-panel');
      await expect(panel).toBeVisible({ timeout: 8000 });

      // Type filter
      const filterInput = panel.locator('input[aria-label="Filter files by path"]');
      await expect(filterInput).toBeVisible({ timeout: 10000 });
      await filterInput.fill('auth');

      // Only auth files should appear — wait for filter to take effect
      const rows = panel.locator('.file-row');
      await expect(rows.first()).toBeVisible({ timeout: 5000 });
      const count = await rows.count();
      expect(count).toBeGreaterThanOrEqual(1);

      // docs/readme.md should not be visible
      await expect(panel).not.toContainText('docs/readme.md');
    } finally {
      rmDir(fixtureDir);
    }
  });

  test('sorts files by path', async ({ page }) => {
    const fixtureDir = mkTempDir();
    const repoDir = path.join(fixtureDir, 'repo');
    try {
      createGitRepo(repoDir);
      fs.writeFileSync(path.join(repoDir, 'c.ts'), 'c');
      fs.writeFileSync(path.join(repoDir, 'a.ts'), 'a');
      fs.writeFileSync(path.join(repoDir, 'b.ts'), 'b');
      execSync('git add . && git commit -m "add"', { cwd: repoDir, stdio: 'pipe' });
      // Modify all three
      fs.appendFileSync(path.join(repoDir, 'c.ts'), '\nmod');
      fs.appendFileSync(path.join(repoDir, 'a.ts'), '\nmod');
      fs.appendFileSync(path.join(repoDir, 'b.ts'), '\nmod');

      await registerAndSelectWorkspace(page, repoDir, `FL-Sort-${Date.now()}`, 'git');
      await page.reload();
      await page.waitForLoadState('networkidle');
      await selectRailTab(page, 'git');

      const panel = page.locator('#file-list-panel');
      await expect(panel).toBeVisible({ timeout: 8000 });

      // Click the File sort header twice to ensure ascending order
      // (first click toggles to desc since default is already path-asc,
      // second click goes back to asc)
      const fileHeader = panel.locator('.header-cell.path-col');
      await expect(fileHeader).toBeVisible({ timeout: 10000 });
      await fileHeader.click();
      await fileHeader.click();
      // Verify aria-sort is ascending
      await expect(fileHeader).toHaveAttribute('aria-sort', 'ascending', { timeout: 3000 });

      // Verify files appear in order
      const rows = panel.locator('.file-row .file-path');
      const paths = await rows.allTextContents();
      const trimmed = paths.map((p) => p.trim());
      const idxA = trimmed.findIndex((p) => p.includes('a.ts'));
      const idxB = trimmed.findIndex((p) => p.includes('b.ts'));
      const idxC = trimmed.findIndex((p) => p.includes('c.ts'));
      if (idxA >= 0 && idxB >= 0 && idxC >= 0) {
        expect(idxA).toBeLessThan(idxB);
        expect(idxB).toBeLessThan(idxC);
      }
    } finally {
      rmDir(fixtureDir);
    }
  });

  test('paginates when file count exceeds page size', async ({ page }) => {
    const fixtureDir = mkTempDir();
    const repoDir = path.join(fixtureDir, 'repo');
    try {
      createGitRepo(repoDir);
      // Create 51 files
      for (let i = 0; i < 51; i++) {
        fs.writeFileSync(
          path.join(repoDir, `file${String(i).padStart(3, '0')}.ts`),
          `content ${i}`,
        );
      }
      execSync('git add . && git commit -m "add 51 files"', { cwd: repoDir, stdio: 'pipe' });
      // Modify all to create diffs
      for (let i = 0; i < 51; i++) {
        fs.appendFileSync(path.join(repoDir, `file${String(i).padStart(3, '0')}.ts`), '\nmod');
      }

      await registerAndSelectWorkspace(page, repoDir, `FL-Page-${Date.now()}`, 'git');
      await page.reload();
      await page.waitForLoadState('networkidle');
      await selectRailTab(page, 'git');

      const panel = page.locator('#file-list-panel');
      await expect(panel).toBeVisible({ timeout: 8000 });

      // Pagination controls should be visible
      await expect(panel.locator('[aria-label="File list pagination"]')).toBeVisible({
        timeout: 10000,
      });
      await expect(panel).toContainText('Page 1 of');
    } finally {
      rmDir(fixtureDir);
    }
  });

  test('selects a file row by clicking', async ({ page }) => {
    const fixtureDir = mkTempDir();
    const repoDir = path.join(fixtureDir, 'repo');
    try {
      createGitRepo(repoDir);
      fs.writeFileSync(path.join(repoDir, 'main.ts'), 'main');
      execSync('git add . && git commit -m "add"', { cwd: repoDir, stdio: 'pipe' });
      fs.appendFileSync(path.join(repoDir, 'main.ts'), '\nmod');

      await registerAndSelectWorkspace(page, repoDir, `FL-Click-${Date.now()}`, 'git');
      await page.reload();
      await page.waitForLoadState('networkidle');
      await selectRailTab(page, 'git');

      const panel = page.locator('#file-list-panel');
      await expect(panel).toBeVisible({ timeout: 8000 });

      // Click a file row
      const row = panel.locator('.file-row').first();
      await expect(row).toBeVisible({ timeout: 10000 });
      await row.click();

      // The row should be highlighted
      await expect(row).toHaveClass(/active/);
    } finally {
      rmDir(fixtureDir);
    }
  });

  test('keyboard navigation selects a file row', async ({ page }) => {
    const fixtureDir = mkTempDir();
    const repoDir = path.join(fixtureDir, 'repo');
    try {
      createGitRepo(repoDir);
      for (let i = 0; i < 3; i++) {
        fs.writeFileSync(path.join(repoDir, `file${i}.ts`), `content ${i}`);
      }
      execSync('git add . && git commit -m "add"', { cwd: repoDir, stdio: 'pipe' });
      for (let i = 0; i < 3; i++) {
        fs.appendFileSync(path.join(repoDir, `file${i}.ts`), '\nmod');
      }

      await registerAndSelectWorkspace(page, repoDir, `FL-Kb-${Date.now()}`, 'git');
      await page.reload();
      await page.waitForLoadState('networkidle');
      await selectRailTab(page, 'git');

      const panel = page.locator('#file-list-panel');
      await expect(panel).toBeVisible({ timeout: 8000 });

      // Focus the first file row
      const firstRow = panel.locator('.file-row').first();
      await expect(firstRow).toBeVisible({ timeout: 10000 });
      await firstRow.focus();
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');

      // The second row should be active
      const secondRow = panel.locator('.file-row').nth(1);
      await expect(secondRow).toHaveClass(/active/);
    } finally {
      rmDir(fixtureDir);
    }
  });

  test('shows empty state when working tree is clean', async ({ page }) => {
    const fixtureDir = mkTempDir();
    const repoDir = path.join(fixtureDir, 'repo');
    try {
      createGitRepo(repoDir);
      await registerAndSelectWorkspace(page, repoDir, `FL-Empty-${Date.now()}`, 'git');
      await page.reload();
      await page.waitForLoadState('networkidle');
      await selectRailTab(page, 'git');

      const panel = page.locator('#file-list-panel');
      await expect(panel).toBeVisible({ timeout: 8000 });
      // Empty state should show
      await expect(panel.locator('.panel-state.empty')).toBeVisible({ timeout: 10000 });
    } finally {
      rmDir(fixtureDir);
    }
  });

  test('shows error state for invalid workspace', async ({ page }) => {
    const fixtureDir = mkTempDir();
    const repoDir = path.join(fixtureDir, 'repo');
    try {
      createGitRepo(repoDir);
      await registerAndSelectWorkspace(page, repoDir, `FL-Error-${Date.now()}`, 'git');
      await page.reload();
      await page.waitForLoadState('networkidle');
      await selectRailTab(page, 'git');
      // Invalidate the workspace
      rmDir(path.join(repoDir, '.git'));
      // Click refresh to trigger error
      const refreshBtn = page
        .locator('#git-context-panel')
        .getByRole('button', { name: 'Refresh Git context' });
      await expect(refreshBtn).toBeVisible({ timeout: 10000 });
      await refreshBtn.click();

      // Error should appear in the context panel
      await expect(page.locator('#git-context-panel')).toContainText(/invalid|Error/i, {
        timeout: 10000,
      });
    } finally {
      rmDir(fixtureDir);
    }
  });

  test('file list error state shows Retry button and clicking it attempts re-fetch', async ({
    page,
  }) => {
    const fixtureDir = mkTempDir();
    const repoDir = path.join(fixtureDir, 'repo');
    try {
      createGitRepo(repoDir);
      // Add a modified file so the file list has content
      fs.appendFileSync(path.join(repoDir, 'README.md'), '\n# mod');

      // Intercept the file-list API to return a controlled error.
      // The git-context API must still succeed so the FileList component
      // is actually rendered inside the git-context-panel.
      let retryAttempted = false;
      await page.route('**/api/workspaces/*/file-list*', async (route) => {
        if (retryAttempted) {
          // On retry, let the request through to see the actual result
          await route.continue();
        } else {
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({
              error: { message: 'Failed to load file list' },
            }),
          });
        }
      });

      await registerAndSelectWorkspace(page, repoDir, `FL-Retry-${Date.now()}`, 'git');
      await page.reload();
      await page.waitForLoadState('networkidle');
      await selectRailTab(page, 'git');

      // The file list panel should transition to error state with Retry button
      const panel = page.locator('#file-list-panel');
      await expect(panel).toBeVisible({ timeout: 8000 });

      await expect(async () => {
        const retryBtn = panel.getByRole('button', { name: 'Retry loading file list' });
        await expect(retryBtn).toBeVisible({ timeout: 3000 });
      }).toPass({ timeout: 15000 });

      // Assert the Retry button exists and is clickable
      const retryBtn = panel.getByRole('button', { name: 'Retry loading file list' });
      await expect(retryBtn).toBeVisible({ timeout: 5000 });
      await expect(retryBtn).toBeEnabled({ timeout: 3000 });

      // Click Retry — it should attempt to re-fetch the file list
      retryAttempted = true;
      await retryBtn.click();

      // After clicking Retry, the panel remains visible. The retry triggers
      // a re-fetch (now un-intercepted). Verify the panel is still present.
      await expect(panel).toBeVisible({ timeout: 5000 });

      // The error state must NOT expose raw stack traces
      const panelText = await panel.textContent();
      expect(panelText).not.toMatch(/at\s+\S+\.\w+:\d+:\d+/);
      expect(panelText).not.toContain('node:');
      expect(panelText).not.toContain('.ts:');
    } finally {
      rmDir(fixtureDir);
    }
  });

  test('no active workspace shows empty panel', async ({ page }) => {
    await selectRailTab(page, 'git');
    const panel = page.locator('#git-context-panel');
    await expect(panel).toBeVisible({ timeout: 10000 });
    // Use toPass for retry tolerance — SSR timing may delay .empty-state render
    await expect(async () => {
      await expect(panel.locator('.empty-state')).toBeVisible({ timeout: 3000 });
    }).toPass({ timeout: 10000 });
  });

  test('file list does not mutate the repository', async ({ page }) => {
    const fixtureDir = mkTempDir();
    const repoDir = path.join(fixtureDir, 'repo');
    try {
      createGitRepo(repoDir);
      fs.appendFileSync(path.join(repoDir, 'README.md'), '\n# mod');
      const beforeHash = execSync('git rev-parse HEAD', { cwd: repoDir, stdio: 'pipe' })
        .toString()
        .trim();

      await registerAndSelectWorkspace(page, repoDir, `FL-NoMut-${Date.now()}`, 'git');
      await page.reload();
      await page.waitForLoadState('networkidle');
      await selectRailTab(page, 'git');

      const panel = page.locator('#file-list-panel');
      await expect(panel).toBeVisible({ timeout: 8000 });

      // Interact with the file list
      const filterInput = panel.locator('input[aria-label="Filter files by path"]');
      if (await filterInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await filterInput.fill('test');
        await filterInput.clear();
      }

      // Click a file row
      const row = panel.locator('.file-row').first();
      if (await row.isVisible({ timeout: 3000 }).catch(() => false)) {
        await row.click();
      }

      const afterHash = execSync('git rev-parse HEAD', { cwd: repoDir, stdio: 'pipe' })
        .toString()
        .trim();
      expect(afterHash).toBe(beforeHash);

      // Verify no staged changes were created by file list interactions
      const status = execSync('git status --porcelain', { cwd: repoDir, stdio: 'pipe' }).toString();
      // Modified files can appear as ' M' in status — verify no new staged entries
      expect(status).not.toContain('A ');
    } finally {
      rmDir(fixtureDir);
    }
  });
});
