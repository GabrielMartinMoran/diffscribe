import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

import { waitForHydration } from './hydration';

/**
 * Register a workspace from a repo path, select it, and wait for full
 * activation. Uses the canonical pattern: hydrate, toggle form, fill,
 * submit, select workspace, confirm `.status-indicator` is visible.
 */
export async function registerAndSelectWorkspace(
  page: Page,
  repoPath: string,
  name: string,
): Promise<void> {
  await waitForHydration(page);

  const toggle = page.getByTestId('open-workspace-toggle');
  if (
    !(await page
      .locator('[data-testid="open-workspace-form"]')
      .isVisible()
      .catch(() => false))
  ) {
    await toggle.click();
  }

  await page.waitForSelector('[data-testid="open-workspace-form"]', {
    state: 'visible',
    timeout: 10000,
  });

  await page.fill('#ws-path', repoPath);
  await page.fill('#ws-name', name);
  await page.click('#open-workspace-form button[type="submit"]');
  await page.waitForLoadState('networkidle');

  // Select the workspace to activate it
  const wsItem = page.locator(`#workspace-sidebar li:has-text("${name}")`).first();
  await expect(wsItem).toBeVisible({ timeout: 10000 });

  const selectBtn = wsItem.getByRole('button', { name: /Select/ });
  await expect(selectBtn).toBeVisible({ timeout: 5000 });
  await selectBtn.click();

  // Wait for the form action (SvelteKit enhance) to complete
  // AND for invalidateAll() to re-render the page with the active workspace.
  // networkidle alone is not enough — we need observable proof that the
  // workspace activation has been committed to appState and reflected in the DOM.
  await page.waitForLoadState('networkidle');

  // Confirm the workspace is active: git-context-panel must show the status
  // indicator, not "No active workspace".
  const panel = page.locator('#git-context-panel');
  await expect(panel).toBeVisible({ timeout: 10000 });
  await expect(panel.locator('.status-indicator')).toBeVisible({ timeout: 8000 });
}
