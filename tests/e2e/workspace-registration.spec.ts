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

async function openWorkspaceForm(page: Page): Promise<void> {
  await waitForHydration(page);
  const toggle = page.getByTestId('open-workspace-toggle');
  if (await toggle.isVisible({ timeout: 2000 }).catch(() => false)) {
    await toggle.click();
  }
  await page.waitForSelector('[data-testid="open-workspace-form"]', {
    state: 'visible',
    timeout: 10000,
  });
}

test.describe('Workspace Registration UI (E2E)', () => {
  test.beforeEach(async ({ page, request }) => {
    await resetDb(request);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('hydration smoke proves Svelte 5 delegated handler is attached', async ({ page }) => {
    // RED: waitForHydration handles the non-destructive toggle smoke
    await waitForHydration(page);
    // After hydration smoke, the toggle must still be visible
    await expect(page.getByTestId('open-workspace-toggle')).toBeVisible();
    // And the form must be closed (smoke restores original state)
    await expect(page.locator('[data-testid="open-workspace-form"]')).toBeHidden();
    // A direct click on the toggle must now open the form — this proves
    // the Svelte 5 delegated handler is actually attached, not just SSR-rendered
    await page.getByTestId('open-workspace-toggle').click();
    await expect(page.locator('[data-testid="open-workspace-form"]')).toBeVisible({
      timeout: 5000,
    });
  });

  test('displays the workspace registration page', async ({ page }) => {
    await expect(page.locator('#workspace-sidebar')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('open-workspace-toggle')).toBeVisible();
  });

  test('shows the open workspace form after toggle', async ({ page }) => {
    await openWorkspaceForm(page);
    const form = page.locator('[data-testid="open-workspace-form"]');
    await expect(form).toBeVisible();
  });

  test('form has required fields', async ({ page }) => {
    await openWorkspaceForm(page);
    const pathInput = page.locator('#ws-path');
    const nameInput = page.locator('#ws-name');
    const submitButton = page.locator('#open-workspace-form button[type="submit"]');
    await expect(pathInput).toBeVisible();
    await expect(nameInput).toBeVisible();
    await expect(submitButton).toBeVisible();
  });

  test('shows workspace sidebar', async ({ page }) => {
    const sidebar = page.locator('#workspace-sidebar');
    await expect(sidebar).toBeVisible();
  });

  test('sidebar shows empty state or workspace list', async ({ page }) => {
    const sidebar = page.locator('#workspace-sidebar');
    await expect(sidebar).toBeVisible();
    // Sidebar shows empty state or items depending on shared DB state.
    const empty = sidebar.locator('.empty-state');
    const listItems = sidebar.locator('.workspace-list li');
    const hasItems = (await listItems.count()) > 0;
    if (!hasItems) {
      await expect(empty).toBeVisible();
    }
  });

  test('open, invalidate, repair, and validate a workspace', async ({ page }) => {
    const fixtureA = createGitFixture('diffscribe-e2e-');
    const fixtureB = createGitFixture('diffscribe-e2e-');
    const uniqueName = `E2E-${Date.now()}`;

    try {
      // 1. Create initial repo and register via the form
      initRepo(fixtureA);
      await openWorkspaceForm(page);
      await page.fill('#ws-path', fixtureA.repoPath);
      await page.fill('#ws-name', uniqueName);
      await page.click('#open-workspace-form button[type="submit"]');
      await page.waitForLoadState('networkidle');

      // 2. Confirm workspace appears in sidebar as valid
      const wsItem = page.locator(`#workspace-sidebar li:has-text("${uniqueName}")`).first();
      await expect(wsItem).toBeVisible();
      await expect(wsItem.locator('.status-dot.status-valid')).toBeVisible();

      // 3. Invalidate by removing the repo
      fixtureA.cleanup();
      await page.reload();
      await page.waitForLoadState('networkidle');
      await expect(wsItem.locator('[data-testid="invalid-warning-btn"]')).toBeVisible();

      // 4. Repair: create new repo and use the in-UI Repair action
      initRepo(fixtureB);

      // Open the overflow menu and activate Repair (only invalid workspaces
      // expose the Repair action)
      await openWorkspaceActionsMenu(page, uniqueName);
      await page.getByRole('menuitem', { name: 'Repair' }).click();

      // Repair form should appear with a path input
      await page.waitForSelector('[data-repair-form] input[name="newPath"]', {
        state: 'visible',
        timeout: 10000,
      });
      await page.fill('[data-repair-form] input[name="newPath"]', fixtureB.repoPath);
      await page.click('[data-repair-form] button[type="submit"]');

      // Wait for repair form to close and sidebar to update
      await page.waitForSelector('[data-repair-form]', { state: 'hidden', timeout: 10000 });
      await page.reload();
      await page.waitForLoadState('networkidle');

      // 5. Confirm workspace is valid again
      await expect(wsItem.locator('.status-dot.status-valid')).toBeVisible();
      await expect(wsItem.locator('[data-testid="invalid-warning-btn"]')).toHaveCount(0);
    } finally {
      fixtureA.cleanup();
      fixtureB.cleanup();
    }
  });

  test('form closes after successful workspace registration', async ({ page }) => {
    const fixture = createGitFixture('diffscribe-e2e-');
    const uniqueName = `E2E-Close-${Date.now()}`;

    try {
      initRepo(fixture);

      // Open the form
      await openWorkspaceForm(page);
      await expect(page.locator('[data-testid="open-workspace-form"]')).toBeVisible();

      // Fill and submit
      await page.fill('#ws-path', fixture.repoPath);
      await page.fill('#ws-name', uniqueName);
      await page.click('#open-workspace-form button[type="submit"]');

      // Wait for the success flow to complete — form should close
      await expect(page.locator('[data-testid="open-workspace-form"]')).toBeHidden({
        timeout: 10000,
      });

      // The toggle button should show "Open Workspace" (not "Close")
      const toggle = page.getByTestId('open-workspace-toggle');
      await expect(toggle).toBeVisible();
      await expect(toggle).toHaveText(/Open Workspace/i);
    } finally {
      fixture.cleanup();
    }
  });

  test('sequential workspace registrations open fresh forms', async ({ page }) => {
    const fixture1 = createGitFixture('diffscribe-e2e-');
    const fixture2 = createGitFixture('diffscribe-e2e-');
    const name1 = `E2E-Seq1-${Date.now()}`;
    const name2 = `E2E-Seq2-${Date.now()}`;

    try {
      // First registration
      initRepo(fixture1);
      await openWorkspaceForm(page);
      await page.fill('#ws-path', fixture1.repoPath);
      await page.fill('#ws-name', name1);
      await page.click('#open-workspace-form button[type="submit"]');
      await expect(page.locator('[data-testid="open-workspace-form"]')).toBeHidden({
        timeout: 10000,
      });

      // Second registration — form must be fresh (empty inputs)
      initRepo(fixture2);
      await openWorkspaceForm(page);
      await expect(page.locator('[data-testid="open-workspace-form"]')).toBeVisible();

      // Form inputs must be empty (fresh form)
      const pathInput = page.locator('#ws-path');
      const nameInput = page.locator('#ws-name');
      await expect(pathInput).toHaveValue('');
      await expect(nameInput).toHaveValue('');

      // Fill and submit second
      await pathInput.fill(fixture2.repoPath);
      await nameInput.fill(name2);
      await page.click('#open-workspace-form button[type="submit"]');
      await expect(page.locator('[data-testid="open-workspace-form"]')).toBeHidden({
        timeout: 10000,
      });

      // Both workspaces should appear in the sidebar
      await expect(page.locator(`#workspace-sidebar li:has-text("${name1}")`)).toBeVisible();
      await expect(page.locator(`#workspace-sidebar li:has-text("${name2}")`)).toBeVisible();
    } finally {
      fixture1.cleanup();
      fixture2.cleanup();
    }
  });
});
