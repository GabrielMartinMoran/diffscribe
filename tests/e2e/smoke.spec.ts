import { expect, test } from '@playwright/test';

import { selectRailTab } from './helpers/register-workspace';

test('landing page shows DiffScribe', async ({ page }) => {
  await page.goto('/');
  await selectRailTab(page, 'workspaces');
  await expect(page).toHaveTitle('DiffScribe');
  await expect(page.locator('#workspace-sidebar')).toBeVisible();
});
