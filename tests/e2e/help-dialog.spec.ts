import { expect, test } from './fixtures';
import { waitForHydration } from './helpers/hydration';
import { resetDb } from './helpers/reset-db';

/**
 * W11: Help is a keyboard-accessible dialog opened from the bottom of the
 * left rail; Escape closes it and focus returns to the trigger.
 */
test.describe('Help dialog (W11)', () => {
  test.beforeEach(async ({ page, request }) => {
    await resetDb(request);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('Help button opens a dialog listing keyboard and mouse shortcuts', async ({ page }) => {
    await waitForHydration(page);

    const helpBtn = page.getByTestId('help-btn');
    await expect(helpBtn).toBeVisible({ timeout: 10000 });
    await expect(helpBtn).toHaveAccessibleName(/help/i);

    await helpBtn.click();
    const dialog = page.getByRole('dialog', { name: /keyboard shortcuts/i });
    await expect(dialog).toBeVisible({ timeout: 10000 });

    // Content covers the approved shortcuts.
    await expect(dialog).toContainText(/quick open/i);
    await expect(dialog).toContainText(/middle click/i);
    await expect(dialog).toContainText(/ctrl|cmd/i);
  });

  test('Escape closes the dialog and returns focus to its trigger', async ({ page }) => {
    await waitForHydration(page);

    const helpBtn = page.getByTestId('help-btn');
    await helpBtn.click();
    const dialog = page.getByRole('dialog', { name: /keyboard shortcuts/i });
    await expect(dialog).toBeVisible({ timeout: 10000 });

    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible({ timeout: 10000 });
    await expect(helpBtn).toBeFocused({ timeout: 5000 });
  });
});
