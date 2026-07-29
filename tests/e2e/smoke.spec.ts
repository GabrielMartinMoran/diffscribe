import { expect, test } from '@playwright/test';

test('landing page shows DiffScribe', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('DiffScribe');
  await expect(page.locator('#workspace-sidebar')).toBeVisible();
});
