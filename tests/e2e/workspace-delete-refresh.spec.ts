import fs from 'node:fs';
import path from 'node:path';

import type { Page } from '@playwright/test';

import { expect, test } from './fixtures';
import { createGitFixture } from './helpers/git-fixture';
import { waitForHydration } from './helpers/hydration';
import { openWorkspaceActionsMenu } from './helpers/open-workspace-menu';
import { resetDb } from './helpers/reset-db';

/**
 * W1 regression: after a confirmed workspace deletion, the sidebar must drop
 * the deleted workspace immediately — without a reload — because the custom
 * delete dialog awaits `invalidateAll()` before closing.
 */
function initRepo(fixture: { repoPath: string; runGit(args: readonly string[]): void }): void {
  fs.writeFileSync(path.join(fixture.repoPath, 'README.md'), '# e2e');
  fixture.runGit(['add', '.']);
  fixture.runGit(['commit', '-m', 'init']);
}

async function registerWorkspace(page: Page, repoPath: string, displayName: string): Promise<void> {
  await waitForHydration(page);
  const toggleBtn = page.getByTestId('open-workspace-toggle');
  await toggleBtn.click();
  await page.waitForSelector('[data-testid="open-workspace-form"]', {
    state: 'visible',
    timeout: 10000,
  });
  await page.fill('#ws-path', repoPath);
  await page.fill('#ws-name', displayName);
  await page.click('#open-workspace-form button[type="submit"]');
  await page.waitForLoadState('networkidle');
}

test.describe('Workspace delete refresh (W1)', () => {
  test.beforeEach(async ({ page, request }) => {
    await resetDb(request);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('deleted workspace disappears from the sidebar without a reload', async ({ page }) => {
    const fixture = createGitFixture('diffscribe-e2e-delref-');
    const uniqueName = `E2E-DelRef-${Date.now()}`;

    try {
      initRepo(fixture);
      await registerWorkspace(page, fixture.repoPath, uniqueName);

      // Select the workspace so deletion targets the active workspace. W3
      // lands the shell on the Git rail; deletion happens from the sidebar,
      // so return to the Workspaces rail first.
      await page
        .locator(`#workspace-sidebar li:has-text("${uniqueName}") .select-btn`)
        .first()
        .click();
      await expect(page.locator('[data-testid="rail-tab-git"]')).toHaveAttribute(
        'aria-selected',
        'true',
        { timeout: 10000 },
      );
      await page.getByTestId('rail-tab-workspaces').click();
      await page.waitForSelector('#workspace-sidebar li.active', {
        state: 'visible',
        timeout: 10000,
      });

      // Delete and confirm.
      await openWorkspaceActionsMenu(page, uniqueName);
      await page.getByRole('menuitem', { name: 'Delete' }).click();
      const dialog = page.getByRole('alertdialog', { name: /delete/i });
      await expect(dialog).toBeVisible({ timeout: 10000 });
      await dialog.getByRole('button', { name: 'Delete' }).click();

      // NO reload: the sidebar must lose the item immediately.
      await expect(dialog).not.toBeVisible({ timeout: 10000 });
      await expect(page.locator(`#workspace-sidebar li:has-text("${uniqueName}")`)).toHaveCount(0, {
        timeout: 10000,
      });

      // Active state is cleared by the refreshed page data.
      await expect(page.locator('#workspace-sidebar li.active')).toHaveCount(0);

      // The shell falls back cleanly to the workspaces rail.
      await expect(page.locator('#workspace-sidebar')).toBeVisible();

      // The repository directory itself is preserved.
      expect(fs.existsSync(fixture.repoPath)).toBe(true);
      expect(fs.existsSync(path.join(fixture.repoPath, '.git'))).toBe(true);
    } finally {
      fixture.cleanup();
    }
  });
});
