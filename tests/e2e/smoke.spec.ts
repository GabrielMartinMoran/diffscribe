import { expect, test } from '@playwright/test';

test('landing page shows DiffScribe', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('body')).toContainText('DiffScribe');
});
