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

  test('overflow menu stays fully visible near the bottom edge of the sidebar', async ({
    page,
  }) => {
    const fixture = createGitFixture('diffscribe-e2e-ovf-');
    const name = `E2E-Ovf3-${Date.now()}`;

    try {
      initRepo(fixture);
      await registerWorkspace(page, fixture.repoPath, name);

      // Squeeze the viewport so the sidebar scrolls and the workspace item
      // sits close to the bottom edge of the viewport.
      await page.setViewportSize({ width: 1280, height: 320 });
      await waitForHydration(page);

      const item = page.locator(`#workspace-sidebar li:has-text("${name}")`);
      const trigger = item.locator('[data-testid="workspace-actions"] button').first();
      await trigger.scrollIntoViewIfNeeded();
      await trigger.click();

      const menu = page.getByRole('menu');
      await expect(menu).toBeVisible({ timeout: 5000 });

      // The whole menu, including its last item, must be inside the viewport.
      const menuBox = (await menu.boundingBox())!;
      const lastItem = menu.getByRole('menuitem', { name: 'Delete' });
      await expect(lastItem).toBeVisible();
      const itemBox = (await lastItem.boundingBox())!;

      expect(menuBox.y).toBeGreaterThanOrEqual(0);
      expect(itemBox.y + itemBox.height).toBeLessThanOrEqual(page.viewportSize()!.height + 1);
      expect(menuBox.x).toBeGreaterThanOrEqual(0);
      expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
    } finally {
      fixture.cleanup();
    }
  });

  test('WS-OVERFLOW-06: invalid workspace menu paints above later rows', async ({ page }) => {
    const fixtureA = createGitFixture('diffscribe-e2e-ovf-');
    const fixtureB = createGitFixture('diffscribe-e2e-ovf-');
    const nameA = `E2E-InvA-${Date.now()}`;
    const nameB = `E2E-InvB-${Date.now()}`;

    try {
      initRepo(fixtureA);
      initRepo(fixtureB);
      await registerWorkspace(page, fixtureA.repoPath, nameA);
      await registerWorkspace(page, fixtureB.repoPath, nameB);

      // Invalidate A by removing its repository so the item renders with the
      // invalid state (opacity < 1 creates a stacking context that used to
      // trap the fixed-position popup below later sidebar rows).
      fixtureA.cleanup();
      await page.reload();
      await page.waitForLoadState('networkidle');
      await waitForHydration(page);

      const itemA = page.locator(`#workspace-sidebar li:has-text("${nameA}")`).first();
      await expect(itemA).toBeVisible({ timeout: 10000 });
      const triggerA = itemA.locator('[data-testid="workspace-actions"] button').first();
      await triggerA.click();

      const menu = page.getByRole('menu');
      await expect(menu).toBeVisible({ timeout: 5000 });
      await expect(menu.getByRole('menuitem', { name: 'Repair' })).toBeVisible();

      // Hit-test the center of the menu: the topmost element there must be
      // the portaled menu (or one of its items), never a later sidebar row.
      const box = (await menu.boundingBox())!;
      const topmostRole = await page.evaluate(
        ([x, y]) => {
          const el = document.elementFromPoint(x, y);
          const closest = el?.closest('[role="menu"], [role="menuitem"]');
          return closest?.getAttribute('role') ?? el?.tagName.toLowerCase() ?? 'none';
        },
        [box.x + box.width / 2, box.y + box.height / 2] as [number, number],
      );
      expect(topmostRole, 'menu must be the topmost painted element at its center').toMatch(
        /menu|menuitem/,
      );

      // The popup must live in the in-mount overlay host, not on document.body.
      const hostOwner = await menu.evaluate((el) => {
        const host = el.closest('[data-overlay-host]');
        return host !== null;
      });
      expect(hostOwner).toBe(true);

      // Every action must remain clickable (Repair is only present on
      // invalid workspaces and must be actionable).
      await menu.getByRole('menuitem', { name: 'Repair' }).click();
      await expect(itemA.locator('[data-repair-form]').first()).toBeVisible({ timeout: 5000 });
    } finally {
      fixtureA.cleanup();
      fixtureB.cleanup();
    }
  });
});
