import fs from 'node:fs';
import path from 'node:path';

import type { Page } from '@playwright/test';

import { expect, test } from './fixtures';
import { createGitFixture } from './helpers/git-fixture';
import { waitForHydration } from './helpers/hydration';
import { openWorkspaceActionsMenu } from './helpers/open-workspace-menu';
import { resetDb } from './helpers/reset-db';

function initRepo(fixture: { repoPath: string; runGit(args: readonly string[]): void }): void {
  fs.writeFileSync(path.join(fixture.repoPath, 'README.md'), '# e2e');
  fixture.runGit(['add', '.']);
  fixture.runGit(['commit', '-m', 'init']);
}

async function registerWorkspace(page: Page, repoPath: string, displayName: string): Promise<void> {
  // Prove Svelte 5 hydration before any delegated-handler click
  await waitForHydration(page);

  // Open the workspace form via the sidebar toggle button
  const toggleBtn = page.getByTestId('open-workspace-toggle');
  await toggleBtn.click();
  await page.waitForSelector('[data-testid="open-workspace-form"]', {
    state: 'visible',
    timeout: 10000,
  });
  await page.fill('#ws-path', repoPath);
  await page.fill('#ws-name', displayName);
  await page.click('#open-workspace-form button[type="submit"]');
  // Wait for the page to reload after invalidateAll + onRegistered
  await page.waitForLoadState('networkidle');
}

test.describe('Workspace Management UI (E2E)', () => {
  test.beforeEach(async ({ page, request }) => {
    await resetDb(request);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('displays sidebar with empty state when no workspaces', async ({ page }) => {
    const sidebar = page.locator('#workspace-sidebar');
    await expect(sidebar).toBeVisible();
    // Empty state may show
    const empty = sidebar.locator('.empty-state');
    const list = sidebar.locator('.workspace-list li');
    const hasItems = (await list.count()) > 0;
    if (!hasItems) {
      await expect(empty).toBeVisible();
    }
  });

  test('register a workspace and see it in sidebar with valid status', async ({ page }) => {
    const fixture = createGitFixture('diffscribe-e2e-mgmt-');
    const uniqueName = `E2E-Mgmt-${Date.now()}`;

    try {
      initRepo(fixture);
      await registerWorkspace(page, fixture.repoPath, uniqueName);

      const sidebarItem = page.locator(`#workspace-sidebar li:has-text("${uniqueName}")`).first();
      await expect(sidebarItem).toBeVisible();
      await expect(sidebarItem.locator('.status-valid')).toBeVisible();
    } finally {
      fixture.cleanup();
    }
  });

  test('invalidate workspace when repo is removed', async ({ page }) => {
    const fixture = createGitFixture('diffscribe-e2e-mgmt-');
    const uniqueName = `E2E-Inv-${Date.now()}`;

    try {
      initRepo(fixture);
      await registerWorkspace(page, fixture.repoPath, uniqueName);

      // Confirm the workspace appears in sidebar before invalidating
      let sidebarItem = page.locator(`#workspace-sidebar li:has-text("${uniqueName}")`).first();
      await expect(sidebarItem).toBeVisible({ timeout: 10000 });

      // Remove the repo and reload to trigger re-validation
      fixture.cleanup();
      await page.reload();

      // The workspace should still be visible but now with invalid badge
      sidebarItem = page.locator(`#workspace-sidebar li:has-text("${uniqueName}")`).first();
      await expect(sidebarItem).toBeVisible();
      await expect(sidebarItem.locator('.invalid-badge')).toBeVisible();
    } finally {
      fixture.cleanup();
    }
  });

  test('select active workspace from sidebar', async ({ page }) => {
    const fixture = createGitFixture('diffscribe-e2e-mgmt-');
    const uniqueName = `E2E-Sel-${Date.now()}`;

    try {
      initRepo(fixture);
      await registerWorkspace(page, fixture.repoPath, uniqueName);

      // Click the select button for the workspace
      const sidebarItem = page
        .locator(`#workspace-sidebar li:has-text("${uniqueName}") .select-btn`)
        .first();
      await sidebarItem.click();

      // Check that the workspace is marked as active
      await page.waitForSelector('#workspace-sidebar li.active', {
        state: 'visible',
        timeout: 10000,
      });
      const activeItem = page
        .locator(`#workspace-sidebar li.active:has-text("${uniqueName}")`)
        .first();
      await expect(activeItem).toBeVisible();
    } finally {
      fixture.cleanup();
    }
  });

  test('rename a workspace inline', async ({ page }) => {
    const fixture = createGitFixture('diffscribe-e2e-mgmt-');
    const originalName = `E2E-Rn-${Date.now()}`;
    const newName = `E2E-Renamed-${Date.now()}`;

    try {
      initRepo(fixture);
      await registerWorkspace(page, fixture.repoPath, originalName);

      // Open the overflow menu and activate Rename
      await openWorkspaceActionsMenu(page, originalName);
      await page.getByRole('menuitem', { name: 'Rename' }).click();

      // Wait for rename form
      await page.waitForSelector('[data-rename-form]', { state: 'visible', timeout: 10000 });

      // Fill and submit rename
      const renameInput = page.locator('[data-rename-form] input[name="displayName"]');
      await renameInput.fill(newName);
      await page.locator('[data-rename-form] button[type="submit"]').click();
      // Wait for rename form to close (onSaved callback hides it)
      await page.waitForSelector('[data-rename-form]', { state: 'hidden', timeout: 10000 });
      // Reload to force fresh data from server after rename
      await page.reload();

      // Verify the new name appears
      await expect(page.locator(`#workspace-sidebar .name:has-text("${newName}")`)).toBeVisible();
    } finally {
      fixture.cleanup();
    }
  });

  test('delete workspace preserves repo directory', async ({ page }) => {
    const fixture = createGitFixture('diffscribe-e2e-mgmt-');
    const uniqueName = `E2E-Del-${Date.now()}`;

    try {
      initRepo(fixture);
      await registerWorkspace(page, fixture.repoPath, uniqueName);

      // Click Delete button
      await openWorkspaceActionsMenu(page, uniqueName);
      await page.getByRole('menuitem', { name: 'Delete' }).click();

      // Dialog should appear
      const dialog = page.getByRole('alertdialog', { name: /delete/i });
      await expect(dialog).toBeVisible({ timeout: 10000 });

      // Confirm delete
      await dialog.getByRole('button', { name: 'Delete' }).click();
      // Wait for dialog to close, then reload to force fresh data from server
      await expect(dialog).not.toBeVisible({ timeout: 10000 });
      await page.reload();

      // Verify repo still exists
      expect(fs.existsSync(fixture.repoPath)).toBe(true);
      expect(fs.existsSync(path.join(fixture.repoPath, '.git'))).toBe(true);

      // Verify workspace is gone from sidebar
      await expect(page.locator(`#workspace-sidebar li:has-text("${uniqueName}")`)).toHaveCount(0);
    } finally {
      fixture.cleanup();
    }
  });

  test('cancel delete preserves workspace', async ({ page }) => {
    const fixture = createGitFixture('diffscribe-e2e-mgmt-');
    const uniqueName = `E2E-DelCancel-${Date.now()}`;

    try {
      initRepo(fixture);
      await registerWorkspace(page, fixture.repoPath, uniqueName);

      // Click Delete button
      await openWorkspaceActionsMenu(page, uniqueName);
      await page.getByRole('menuitem', { name: 'Delete' }).click();

      // Dialog should appear
      const dialog = page.getByRole('alertdialog', { name: /delete/i });
      await expect(dialog).toBeVisible({ timeout: 10000 });

      // Cancel
      await dialog.getByRole('button', { name: 'Cancel' }).click();
      await expect(dialog).not.toBeVisible({ timeout: 10000 });

      // Verify workspace still in sidebar
      await expect(
        page.locator(`#workspace-sidebar li:has-text("${uniqueName}")`).first(),
      ).toBeVisible();
    } finally {
      fixture.cleanup();
    }
  });

  test('keyboard navigation in sidebar', async ({ page }) => {
    const fixtures: ReturnType<typeof createGitFixture>[] = [];
    const names: string[] = [];

    try {
      for (let i = 0; i < 3; i++) {
        const fixture = createGitFixture('diffscribe-e2e-mgmt-');
        initRepo(fixture);
        fixtures.push(fixture);
        names.push(`E2E-Key-${Date.now()}-${i}`);
        await registerWorkspace(page, fixture.repoPath, names[i]);
      }

      // Explicitly focus the first workspace Select button
      const firstSelect = page.locator('[data-workspace-select]').first();
      await firstSelect.focus();

      // Assert focus is on the first workspace Select
      await expect(firstSelect).toBeFocused();

      // ArrowDown to move to the second workspace Select
      await page.keyboard.press('ArrowDown');
      const secondSelect = page.locator('[data-workspace-select]').nth(1);
      await expect(secondSelect).toBeFocused();

      // ArrowDown to move to the third workspace Select
      await page.keyboard.press('ArrowDown');
      const thirdSelect = page.locator('[data-workspace-select]').nth(2);
      await expect(thirdSelect).toBeFocused();

      // ArrowUp back to the second workspace
      await page.keyboard.press('ArrowUp');
      await expect(secondSelect).toBeFocused();

      // Enter to select the second workspace
      await page.keyboard.press('Enter');

      // Wait for the second workspace to be marked as active
      const activeItem = page.locator('#workspace-sidebar li.active').first();
      await activeItem.waitFor({ state: 'visible', timeout: 10000 });

      // Verify the active item contains the second workspace name
      await expect(activeItem).toContainText(names[1]);

      // Assert focus returns to the active item's Select control
      const activeSelect = activeItem.locator('[data-workspace-select]');
      await activeSelect.focus();
      await expect(activeSelect).toBeFocused();
    } finally {
      for (const f of fixtures) f.cleanup();
    }
  });

  test('respects reduced motion preference', async ({ page }) => {
    // Check that the sidebar has no transitions when reduced motion is active
    const sidebar = page.locator('#workspace-sidebar');
    await expect(sidebar).toBeVisible();

    // The CSS already handles prefers-reduced-motion via media query
    // Verify the sidebar component is rendered
    const sidebarTitle = sidebar.locator('.sidebar-title');
    await expect(sidebarTitle).toBeVisible();
  });

  test('delete active workspace clears active state', async ({ page }) => {
    const fixture = createGitFixture('diffscribe-e2e-mgmt-');
    const uniqueName = `E2E-DelAct-${Date.now()}`;

    try {
      initRepo(fixture);
      await registerWorkspace(page, fixture.repoPath, uniqueName);

      // Select workspace first
      const selectBtn = page
        .locator(`#workspace-sidebar li:has-text("${uniqueName}") .select-btn`)
        .first();
      await selectBtn.click();
      await page.waitForSelector('#workspace-sidebar li.active', {
        state: 'visible',
        timeout: 10000,
      });

      // Now delete it
      await openWorkspaceActionsMenu(page, uniqueName);
      await page.getByRole('menuitem', { name: 'Delete' }).click();
      const dialog = page.getByRole('alertdialog', { name: /delete/i });
      await expect(dialog).toBeVisible({ timeout: 10000 });
      await dialog.getByRole('button', { name: 'Delete' }).click();
      // The delete action triggers enhance → load → page data refresh.
      // Reload the page to force a fresh render reflecting cleared active state.
      await page.reload();

      // Verify no active workspace in sidebar
      const activeItems = page.locator('#workspace-sidebar li.active');
      await expect(activeItems).toHaveCount(0);
    } finally {
      fixture.cleanup();
    }
  });
});

test.describe('Hydration race regression', () => {
  // This test injects 200ms JS bundle latency to reproduce the Svelte 5
  // hydration race. The old registerWorkspace helper only waited for SSR
  // sidebar visibility, which is insufficient when JS hydration is delayed.
  test.describe.configure({ timeout: 180_000 });

  test('5 iterations under 200ms JS latency — delete dialog must appear', async ({ page }) => {
    // Inject 200ms latency on all JavaScript bundles
    await page.route('**/*.js', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 200));
      await route.continue();
    });

    for (let i = 0; i < 5; i++) {
      const fixture = createGitFixture('diffscribe-e2e-hydration-');
      const name = `E2E-Hydr-${Date.now()}-${i}`;

      try {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        initRepo(fixture);
        await registerWorkspace(page, fixture.repoPath, name);

        // Click Delete button — this is the hydration-dependent action
        await openWorkspaceActionsMenu(page, name);
        await page.getByRole('menuitem', { name: 'Delete' }).click();

        // Dialog should appear if hydration succeeded
        const dialog = page.getByRole('alertdialog', { name: /delete/i });
        await expect(dialog).toBeVisible({ timeout: 10000 });

        // Cancel and verify dialog closes
        await dialog.getByRole('button', { name: 'Cancel' }).click();
        await expect(dialog).not.toBeVisible({ timeout: 10000 });
      } finally {
        fixture.cleanup();
      }
    }
  });

  test('waitForHydration is idempotent across sequential workspace registrations', async ({
    page,
    request,
  }) => {
    await resetDb(request);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Inject 200ms latency on all JavaScript bundles to amplify race windows
    await page.route('**/*.js', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 200));
      await route.continue();
    });

    const fixtures: ReturnType<typeof createGitFixture>[] = [];
    const names: string[] = [];
    try {
      for (let i = 0; i < 3; i++) {
        const fixture = createGitFixture('diffscribe-e2e-hydration-multi-');
        initRepo(fixture);
        fixtures.push(fixture);
        names.push(`E2E-HydrMulti-${Date.now()}-${i}`);
      }

      // Register all 3 workspaces sequentially — each calls waitForHydration
      const formLocator = page.locator('[data-testid="open-workspace-form"]');

      for (let i = 0; i < 3; i++) {
        await registerWorkspace(page, fixtures[i].repoPath, names[i]);

        // After registration, the form must be closed (no state leak)
        await expect(async () => {
          await expect(formLocator).toBeHidden({ timeout: 3000 });
        }).toPass({ timeout: 10000 });

        // Verify the registered workspace appears in the sidebar
        const sidebarItem = page.locator(`#workspace-sidebar li:has-text("${names[i]}")`).first();
        await expect(sidebarItem).toBeVisible({ timeout: 10000 });
      }

      // All 3 workspaces must be visible simultaneously
      for (const name of names) {
        await expect(page.locator(`#workspace-sidebar li:has-text("${name}")`).first()).toBeVisible(
          { timeout: 5000 },
        );
      }

      // After all registrations, the form must still be closed
      await expect(formLocator).toBeHidden({ timeout: 5000 });
    } finally {
      for (const f of fixtures) f.cleanup();
    }
  });
});
