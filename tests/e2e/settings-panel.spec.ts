import { expect, test } from './fixtures';
import { waitForHydration } from './helpers/hydration';
import { resetDb } from './helpers/reset-db';

/**
 * Settings panel (tranche): rail Settings entry, Appearance/Editor sections,
 * theme selection inside Settings, and the wrapping default switch persisted
 * in localStorage.
 */

test.describe('Settings panel', () => {
  test.beforeEach(async ({ page, request }) => {
    await resetDb(request);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await waitForHydration(page);
  });

  test('rail exposes Settings at the bottom with an accessible label', async ({ page }) => {
    const settingsTab = page.getByTestId('rail-tab-settings');
    await expect(settingsTab).toBeVisible({ timeout: 10000 });
    await expect(settingsTab).toHaveAttribute('aria-label', 'Settings');

    // Settings sits after Workspaces, Project, and Git.
    const rail = page.getByTestId('rail-tabs');
    await expect(rail.getByTestId('rail-tab-workspaces')).toBeVisible();
    await expect(rail.getByTestId('rail-tab-project')).toBeVisible();
    await expect(rail.getByTestId('rail-tab-git')).toBeVisible();
  });

  test('activating Settings shows Appearance and Editor sections', async ({ page }) => {
    await page.getByTestId('rail-tab-settings').click();
    await expect(page.getByTestId('settings-panel')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('settings-section-appearance')).toBeVisible();
    await expect(page.getByTestId('settings-section-editor')).toBeVisible();
  });

  test('theme selection happens inside Settings and applies', async ({ page }) => {
    await page.getByTestId('rail-tab-settings').click();
    await expect(page.getByTestId('settings-panel')).toBeVisible({ timeout: 10000 });

    const switcher = page.getByTestId('theme-switcher');
    await expect(switcher).toBeVisible();
    await switcher.locator('button').last().click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'synthwave-84');
  });

  test('Editor wrapping switch persists in localStorage', async ({ page }) => {
    await page.getByTestId('rail-tab-settings').click();
    await expect(page.getByTestId('settings-panel')).toBeVisible({ timeout: 10000 });

    const wrapSwitch = page.getByTestId('settings-wrap-switch');
    await expect(wrapSwitch).not.toBeChecked();
    // The native input is visually hidden behind the track; the user toggles
    // the switch through its wrapping label, which activates the input.
    await wrapSwitch.locator('..').click();
    await expect(wrapSwitch).toBeChecked();

    const stored = await page.evaluate(() => localStorage.getItem('diffscribe-line-wrap'));
    expect(stored).toBe('true');

    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.getByTestId('rail-tab-settings').click();
    await expect(page.getByTestId('settings-wrap-switch')).toBeChecked();
  });

  test('theme switcher is not rendered in the panel header', async ({ page }) => {
    // With Settings hosting the theme switcher, no desktop panel header must
    // contain it. W9 moved the desktop collapse control into the bottom
    // footer, so the desktop header no longer exists at all.
    const header = page.locator('.left-panel-header');
    await expect(header).toHaveCount(0);
    await expect(page.locator('[data-testid="theme-switcher"]')).toHaveCount(0);
  });
});
