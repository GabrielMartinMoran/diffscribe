import fs from 'node:fs';
import path from 'node:path';

import type { Page } from '@playwright/test';

import { expect, test } from './fixtures';
import { createGitFixture } from './helpers/git-fixture';
import { waitForHydration } from './helpers/hydration';
import { resetDb } from './helpers/reset-db';

/**
 * Invalid workspace state (WS-INVALID-*): the sidebar hides the ACTIVE and
 * INVALID text badges, shows a warning icon with an accessible name, and
 * opens a generic dialog with Repair and Close that reuses the existing
 * repair form.
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

async function invalidateWorkspace(page: Page, fixture: { cleanup(): void }): Promise<void> {
  fixture.cleanup();
  await page.reload();
  await page.waitForLoadState('networkidle');
  await waitForHydration(page);
}

test.describe('Invalid workspace state (WS-INVALID)', () => {
  test.beforeEach(async ({ page, request }) => {
    await resetDb(request);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('WS-INVALID-01: invalid workspace hides badges and shows a warning icon', async ({
    page,
  }) => {
    const fixture = createGitFixture('diffscribe-e2e-inv-');
    const name = `E2E-Inv-${Date.now()}`;

    try {
      initRepo(fixture);
      await registerWorkspace(page, fixture.repoPath, name);
      await invalidateWorkspace(page, fixture);

      const item = page.locator(`#workspace-sidebar li:has-text("${name}")`).first();
      await expect(item).toBeVisible({ timeout: 10000 });

      // No text badges for invalid or active state.
      await expect(item.locator('.invalid-badge')).toHaveCount(0);
      await expect(item.locator('.active-badge')).toHaveCount(0);

      // A warning affordance with an accessible name is present.
      const warning = item.locator('[data-testid="invalid-warning-btn"]');
      await expect(warning).toBeVisible();
      await expect(warning).toHaveAttribute('aria-label', /invalid|repair/i);
    } finally {
      fixture.cleanup();
    }
  });

  test('WS-INVALID-02: warning icon opens a dialog with Repair and Close', async ({ page }) => {
    const fixture = createGitFixture('diffscribe-e2e-inv-');
    const name = `E2E-Inv-${Date.now()}`;

    try {
      initRepo(fixture);
      await registerWorkspace(page, fixture.repoPath, name);
      await invalidateWorkspace(page, fixture);

      const item = page.locator(`#workspace-sidebar li:has-text("${name}")`).first();
      await expect(item).toBeVisible({ timeout: 10000 });

      const warning = item.locator('[data-testid="invalid-warning-btn"]');
      await warning.click();

      const dialog = page.getByRole('dialog', { name: /invalid workspace/i });
      await expect(dialog).toBeVisible({ timeout: 5000 });
      await expect(dialog.getByRole('button', { name: 'Repair' })).toBeVisible();
      await expect(dialog.getByRole('button', { name: 'Close' })).toBeVisible();

      // Close dismisses the dialog and keeps the workspace list intact.
      await dialog.getByRole('button', { name: 'Close' }).click();
      await expect(dialog).not.toBeVisible({ timeout: 5000 });
      await expect(item.locator('[data-workspace-select]')).toBeVisible();
    } finally {
      fixture.cleanup();
    }
  });

  test('WS-INVALID-03: Repair in the dialog opens the existing repair form', async ({ page }) => {
    const fixture = createGitFixture('diffscribe-e2e-inv-');
    const name = `E2E-Inv-${Date.now()}`;

    try {
      initRepo(fixture);
      await registerWorkspace(page, fixture.repoPath, name);
      await invalidateWorkspace(page, fixture);

      const item = page.locator(`#workspace-sidebar li:has-text("${name}")`).first();
      await expect(item).toBeVisible({ timeout: 10000 });

      await item.locator('[data-testid="invalid-warning-btn"]').click();
      const dialog = page.getByRole('dialog', { name: /invalid workspace/i });
      await expect(dialog).toBeVisible({ timeout: 5000 });
      await dialog.getByRole('button', { name: 'Repair' }).click();

      // The dialog closes and the existing repair form appears.
      await expect(dialog).not.toBeVisible({ timeout: 5000 });
      await expect(item.locator('[data-repair-form]').first()).toBeVisible({ timeout: 5000 });
    } finally {
      fixture.cleanup();
    }
  });
});
