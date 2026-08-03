import fs from 'node:fs';
import path from 'node:path';

import type { APIRequestContext, Page } from '@playwright/test';

import { expect, test } from './fixtures';
import { createGitFixture } from './helpers/git-fixture';
import { registerAndSelectWorkspace, selectRailTab } from './helpers/register-workspace';
import { resetDb } from './helpers/reset-db';

/**
 * Project tree cache invalidation (post-tranche C hardening): the shared
 * client loader keeps the tree cached per workspace; a successful Git
 * context refresh and a successful workspace repair invalidate only the
 * active workspace so the next Project tab (or Quick Open) load shows fresh
 * files. Rail switches never refetch.
 */

/**
 * The worker dev server answers the readiness probe (GET /) before its API
 * routes finish compiling; the very first reset of a fresh worker can hit a
 * 404. Retry briefly so first-test resets are reliable.
 */
async function resetDbWhenReady(request: APIRequestContext): Promise<void> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      await resetDb(request);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  await resetDb(request);
}

function initRepo(fixture: { repoPath: string; runGit(args: readonly string[]): void }): void {
  fs.writeFileSync(path.join(fixture.repoPath, 'README.md'), '# e2e');
  fixture.runGit(['add', '.']);
  fixture.runGit(['commit', '-m', 'init']);
}

function countTreeRequests(page: Page): () => number {
  let count = 0;
  page.on('request', (request) => {
    const url = request.url();
    if (url.includes('/api/workspaces/') && url.includes('/tree')) {
      count += 1;
    }
  });
  return () => count;
}

test.describe('Project tree invalidation (post-tranche C)', () => {
  test.beforeEach(async ({ page, request }) => {
    await resetDbWhenReady(request);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  test('a successful Git refresh invalidates the cached Project tree', async ({ page }) => {
    const fixture = createGitFixture('diffscribe-e2e-tre-');
    try {
      initRepo(fixture);
      const treeRequests = countTreeRequests(page);
      await registerAndSelectWorkspace(page, fixture.repoPath, `E2E-Tree1-${Date.now()}`);
      await selectRailTab(page, 'project');
      const tree = page.getByTestId('project-tree');
      await expect(tree).toBeVisible({ timeout: 15000 });
      await expect(tree).toContainText('README.md');
      expect(treeRequests()).toBe(1);

      // A file appears outside DiffScribe.
      fs.writeFileSync(path.join(fixture.repoPath, 'added-after.txt'), 'new');

      // A successful Git context refresh must invalidate the cached tree.
      await selectRailTab(page, 'git');
      const panel = page.locator('#git-context-panel');
      await expect(panel).toBeVisible({ timeout: 10000 });
      const refreshResponse = page.waitForResponse(
        (resp) => resp.url().includes('/git-context') && resp.request().method() === 'GET',
      );
      await panel.getByRole('button', { name: 'Refresh Git context' }).click();
      // Wait for the refresh to finish so the invalidation has run before
      // the Project rail remounts the tree (event barrier, no fixed sleep).
      await refreshResponse;
      await expect(panel.locator('.status-indicator')).toBeVisible({ timeout: 8000 });

      // Reopening the Project tab loads one fresh request and sees the file.
      await selectRailTab(page, 'project');
      await expect(tree).toBeVisible({ timeout: 15000 });
      await expect(tree).toContainText('added-after.txt', { timeout: 10000 });
      expect(treeRequests()).toBe(2);
    } finally {
      fixture.cleanup();
    }
  });

  test('switching rails keeps the cached tree without a new request', async ({ page }) => {
    const fixture = createGitFixture('diffscribe-e2e-tre-');
    try {
      initRepo(fixture);
      const treeRequests = countTreeRequests(page);

      await registerAndSelectWorkspace(page, fixture.repoPath, `E2E-Tree2-${Date.now()}`);
      await selectRailTab(page, 'project');
      const tree = page.getByTestId('project-tree');
      await expect(tree).toBeVisible({ timeout: 15000 });
      await expect(tree).toContainText('README.md');
      expect(treeRequests()).toBe(1);

      await selectRailTab(page, 'git');
      await expect(page.locator('#git-context-panel')).toBeVisible({ timeout: 10000 });

      await selectRailTab(page, 'project');
      await expect(tree).toBeVisible({ timeout: 15000 });
      await expect(tree).toContainText('README.md');
      expect(treeRequests()).toBe(1);
    } finally {
      fixture.cleanup();
    }
  });

  test('repairing an invalid workspace refreshes the tree', async ({ page }) => {
    const fixture = createGitFixture('diffscribe-e2e-tre-');
    const name = `E2E-Tree3-${Date.now()}`;
    try {
      initRepo(fixture);
      const treeRequests = countTreeRequests(page);

      await registerAndSelectWorkspace(page, fixture.repoPath, name);
      await selectRailTab(page, 'project');
      const tree = page.getByTestId('project-tree');
      await expect(tree).toBeVisible({ timeout: 15000 });
      await expect(tree).toContainText('README.md');
      expect(treeRequests()).toBe(1);

      // Invalidate the workspace: remove the repository metadata, then force
      // a server-side status re-check by re-selecting the workspace.
      fs.rmSync(path.join(fixture.repoPath, '.git'), { recursive: true, force: true });
      await selectRailTab(page, 'workspaces');
      const item = page.locator(`#workspace-sidebar li:has-text("${name}")`).first();
      await item.getByRole('button', { name: /Select/ }).click();
      const warning = item.locator('[data-testid="invalid-warning-btn"]');
      await expect(warning).toBeVisible({ timeout: 10000 });

      // Restore a valid repository with different content at the same path.
      fixture.runGit(['init']);
      fixture.runGit(['config', 'user.email', 'test@test.com']);
      fixture.runGit(['config', 'user.name', 'Test User']);
      fs.writeFileSync(path.join(fixture.repoPath, 'repaired.txt'), 'repaired');
      fixture.runGit(['add', '.']);
      fixture.runGit(['commit', '-m', 'repaired']);

      // Repair the workspace through the warning dialog + repair form.
      await warning.click();
      const dialog = page.getByRole('dialog', { name: /invalid workspace/i });
      await expect(dialog).toBeVisible({ timeout: 5000 });
      await dialog.getByRole('button', { name: 'Repair' }).click();
      const repairForm = item.locator('[data-repair-form]').first();
      await expect(repairForm).toBeVisible({ timeout: 5000 });
      await repairForm.locator('input[name="newPath"]').fill(fixture.repoPath);
      await repairForm.getByRole('button', { name: 'Repair' }).click();
      // Repair success: the form closes (the repair action itself does not
      // auto-invalidate the sidebar list; the form closing is the signal).
      await expect(repairForm).not.toBeVisible({ timeout: 10000 });

      // The Project tab must not reuse the stale cached tree: it refetches
      // and shows the repaired repository.
      await selectRailTab(page, 'project');
      await expect(tree).toBeVisible({ timeout: 15000 });
      await expect(tree).toContainText('repaired.txt', { timeout: 10000 });
      expect(treeRequests()).toBe(2);
    } finally {
      fixture.cleanup();
    }
  });

  test('Quick Open sees files added after a successful Git refresh', async ({ page }) => {
    const fixture = createGitFixture('diffscribe-e2e-tre-');
    try {
      initRepo(fixture);
      const treeRequests = countTreeRequests(page);

      await registerAndSelectWorkspace(page, fixture.repoPath, `E2E-Tree4-${Date.now()}`, 'git');

      // Warm the shared tree cache by opening Quick Open once.
      await page.keyboard.press('Control+p');
      const dialog = page.getByRole('dialog', { name: /Quick Open/i });
      await expect(dialog).toBeVisible({ timeout: 10000 });
      await expect(dialog.getByRole('option').first()).toBeVisible({ timeout: 10000 });
      await page.keyboard.press('Escape');
      await expect(dialog).not.toBeVisible({ timeout: 5000 });
      expect(treeRequests()).toBe(1);

      // A file is added to the repository outside DiffScribe (tracked so
      // Quick Open's default tracked-only index includes it), then a
      // successful refresh runs.
      fs.writeFileSync(path.join(fixture.repoPath, 'quick-after.txt'), 'new');
      fixture.runGit(['add', '.']);
      const panel = page.locator('#git-context-panel');
      const refreshResponse = page.waitForResponse(
        (resp) => resp.url().includes('/git-context') && resp.request().method() === 'GET',
      );
      await panel.getByRole('button', { name: 'Refresh Git context' }).click();
      await refreshResponse;
      await expect(panel.locator('.status-indicator')).toBeVisible({ timeout: 8000 });

      // The next Quick Open session sees the added file (fresh index).
      await page.keyboard.press('Control+p');
      await expect(dialog).toBeVisible({ timeout: 10000 });
      await expect(dialog.getByText('quick-after.txt', { exact: false })).toBeVisible({
        timeout: 10000,
      });
      expect(treeRequests()).toBe(2);
    } finally {
      fixture.cleanup();
    }
  });
});
