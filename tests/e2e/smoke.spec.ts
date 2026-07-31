import { expect, test } from './fixtures';
import { selectRailTab } from './helpers/register-workspace';
import { resetDb } from './helpers/reset-db';

test.beforeEach(async ({ request }) => {
  await resetDb(request);
});

test('landing page shows DiffScribe', async ({ page }) => {
  await page.goto('/');
  await selectRailTab(page, 'workspaces');
  await expect(page).toHaveTitle('DiffScribe');
  await expect(page.locator('#workspace-sidebar')).toBeVisible();
});
