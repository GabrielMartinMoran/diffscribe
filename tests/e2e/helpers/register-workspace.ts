import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

import { waitForHydration } from './hydration';

export type TargetRail = 'workspaces' | 'git';
export type RightPanelTab = 'comments' | 'review';

/**
 * Select a rail tab by its data-testid and wait for it to become active.
 */
export async function selectRailTab(page: Page, target: TargetRail): Promise<void> {
  const tab = page.locator(`[data-testid="rail-tab-${target}"]`);
  await expect(tab).toBeVisible({ timeout: 5000 });
  await tab.click();
  await expect(tab).toHaveAttribute('aria-selected', 'true', { timeout: 5000 });
  // Allow any async panel data (e.g. GitContextPanel file list) to finish loading
  await page.waitForLoadState('networkidle');
}

/**
 * Select a right panel tab (Comments / Review) by data-testid and wait for
 * the panel content to finish loading. The right panel defaults to Comments
 * on every page load, so call this before interacting with #review-panel.
 */
export async function selectRightPanelTab(page: Page, target: RightPanelTab): Promise<void> {
  const tab = page.locator(`[data-testid="right-tab-${target}"]`);
  await expect(tab).toBeVisible({ timeout: 5000 });
  await tab.click();
  await expect(tab).toHaveAttribute('aria-selected', 'true', { timeout: 5000 });
  await page.waitForLoadState('networkidle');
}

/**
 * Register a workspace from a repo path, select it, and wait for full
 * activation. Uses the canonical pattern: hydrate, toggle form, fill,
 * submit, select workspace, switch to target rail, confirm panel.
 *
 * @param targetRail - which rail tab to activate after workspace selection.
 *   Defaults to `'workspaces'`. Pass `'git'` for specs that interact with
 *   git context, file list, diff viewer, review, or line selection panels.
 */
export async function registerAndSelectWorkspace(
  page: Page,
  repoPath: string,
  name: string,
  targetRail: TargetRail = 'workspaces',
): Promise<void> {
  await waitForHydration(page);

  // Ensure we are on the Workspaces rail to access the sidebar
  await selectRailTab(page, 'workspaces');

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

  // Switch to the target rail and wait for any async panel data to load
  await selectRailTab(page, targetRail);
  await page.waitForLoadState('networkidle');

  // Confirm the workspace is active: verify the corresponding panel
  if (targetRail === 'git') {
    const panel = page.locator('#git-context-panel');
    await expect(panel).toBeVisible({ timeout: 10000 });
    await expect(panel.locator('.status-indicator')).toBeVisible({ timeout: 8000 });
  } else {
    const panel = page.locator('#workspace-sidebar');
    await expect(panel).toBeVisible({ timeout: 10000 });
    const activeItem = panel.locator('li.active');
    await expect(activeItem).toBeVisible({ timeout: 8000 });
  }
}
