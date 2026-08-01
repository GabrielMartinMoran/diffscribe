import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * Opens the workspace action overflow menu for the sidebar item whose
 * visible text contains `displayName`.
 */
export async function openWorkspaceActionsMenu(page: Page, displayName: string): Promise<void> {
  const item = page.locator(`#workspace-sidebar li:has-text("${displayName}")`);
  await item.locator('[data-testid="workspace-actions"] button').first().click();
  await expect(page.getByRole('menu')).toBeVisible({ timeout: 5000 });
}
