import fs from 'node:fs';
import path from 'node:path';

import type { Page } from '@playwright/test';

import { expect, test } from './fixtures';
import { createGitFixture } from './helpers/git-fixture';
import { waitForHydration } from './helpers/hydration';
import { resetDb } from './helpers/reset-db';

/**
 * Workspace action overflow menu (tranche): sidebar workspace actions are
 * exposed through the kit Menu primitive instead of inline buttons.
 */

function initRepo(fixture: { repoPath: string; runGit(args: readonly string[]): void }): void {
  fs.writeFileSync(path.join(fixture.repoPath, 'README.md'), '# e2e');
  fixture.runGit(['add', '.']);
  fixture.runGit(['commit', '-m', 'init']);
}

async function registerWorkspace(page: Page, repoPath: string, displayName: string): Promise<void> {
  await waitForHydration(page);
  await page.getByTestId('open-workspace-toggle').click();
  await page.waitForSelector('[data-testid="open-workspace-form"]', {
    state: 'visible',
    timeout: 10000,
  });
  await page.fill('#ws-path', repoPath);
  await page.fill('#ws-name', displayName);
  await page.click('#open-workspace-form button[type="submit"]');
  await page.waitForSelector('#open-workspace-form', { state: 'hidden', timeout: 10000 });
}

test.describe('Workspace actions overflow menu', () => {
  test.beforeEach(async ({ page, request }) => {
    await resetDb(request);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('overflow menu exposes actions and keyboard contract', async ({ page }) => {
    const fixture = createGitFixture('diffscribe-e2e-ovf-');
    const name = `E2E-Ovf-${Date.now()}`;

    try {
      initRepo(fixture);
      await registerWorkspace(page, fixture.repoPath, name);

      const item = page.locator(`#workspace-sidebar li:has-text("${name}")`);
      const trigger = item.locator('[data-testid="workspace-actions"] button').first();
      await trigger.focus();
      await expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
      await expect(trigger).toHaveAttribute('aria-expanded', 'false');

      // Open with Enter (keyboard path).
      await page.keyboard.press('Enter');
      await expect(trigger).toHaveAttribute('aria-expanded', 'true');

      // Menu exposes role menu with Rename and Delete actions.
      const menu = page.getByRole('menu');
      await expect(menu).toBeVisible({ timeout: 5000 });
      await expect(menu.getByRole('menuitem', { name: 'Rename' })).toBeVisible();
      await expect(menu.getByRole('menuitem', { name: 'Delete' })).toBeVisible();

      // ArrowDown/Home/End navigation.
      await page.keyboard.press('ArrowDown');
      await expect(menu.getByRole('menuitem', { name: 'Delete' })).toBeFocused();
      await page.keyboard.press('Home');
      await expect(menu.getByRole('menuitem', { name: 'Rename' })).toBeFocused();
      await page.keyboard.press('End');
      await expect(menu.getByRole('menuitem', { name: 'Delete' })).toBeFocused();

      // Escape closes and returns focus to the trigger.
      await page.keyboard.press('Escape');
      await expect(menu).not.toBeVisible({ timeout: 5000 });
      await expect(trigger).toBeFocused();
    } finally {
      fixture.cleanup();
    }
  });

  test('Rename action opens the rename form; Delete opens the dialog', async ({ page }) => {
    const fixture = createGitFixture('diffscribe-e2e-ovf-');
    const name = `E2E-Ovf2-${Date.now()}`;

    try {
      initRepo(fixture);
      await registerWorkspace(page, fixture.repoPath, name);

      const item = page.locator(`#workspace-sidebar li:has-text("${name}")`);
      const trigger = item.locator('[data-testid="workspace-actions"] button').first();
      await trigger.click();
      await page.getByRole('menuitem', { name: 'Rename' }).click();
      await expect(item.locator('[data-rename-form]')).toBeVisible({ timeout: 5000 });

      // Cancel rename and open the delete flow from the menu.
      await item.getByRole('button', { name: 'Cancel' }).click();
      await trigger.click();
      await page.getByRole('menuitem', { name: 'Delete' }).click();
      const dialog = page.getByRole('alertdialog', { name: /delete/i });
      await expect(dialog).toBeVisible({ timeout: 5000 });
      await dialog.getByRole('button', { name: 'Cancel' }).click();
    } finally {
      fixture.cleanup();
    }
  });
});
