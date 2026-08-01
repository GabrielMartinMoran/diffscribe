import { expect, test } from './fixtures';
import { waitForHydration } from './helpers/hydration';
import { resetDb } from './helpers/reset-db';

test.describe('UI Shell — Rail tabs, theme switcher, file tabs, right panel tabs (SHELL-UI-01)', () => {
  test.beforeEach(async ({ page, request }) => {
    await resetDb(request);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  // ────── SvelteKit body wrapper regression ──────

  test('SHELL-UI-01: no SvelteKit warning about %sveltekit.body% in body element', async ({
    page,
  }) => {
    const warnings: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'warning' && msg.text().includes('sveltekit.body')) {
        warnings.push(msg.text());
      }
    });

    await page.reload();
    await page.waitForLoadState('networkidle');
    await waitForHydration(page);

    expect(warnings).toHaveLength(0);
  });

  test('SHELL-UI-01: shell layout is visible and stable after hydration', async ({ page }) => {
    await waitForHydration(page);

    // Shell layout must be visible
    const layout = page.locator('[data-testid="shell-layout"]');
    await expect(layout).toBeVisible({ timeout: 10000 });

    // Rail tabs must be visible and interactive
    const rail = page.locator('[data-testid="rail-tabs"]');
    await expect(rail).toBeVisible({ timeout: 5000 });
    const tabs = rail.locator('[role="tab"]');
    await expect(tabs.nth(0)).toBeVisible();

    // Center content must be visible
    await expect(page.locator('[data-testid="center-content"]')).toBeVisible();
  });

  // ────── Rail tabs ──────

  test('SHELL-UI-01: rail renders four icon tabs with accessible labels', async ({ page }) => {
    const rail = page.locator('[data-testid="rail-tabs"]');
    await expect(rail).toBeVisible({ timeout: 10000 });

    const tabs = rail.locator('[role="tab"]');
    await expect(tabs).toHaveCount(4);

    await expect(tabs.nth(0)).toHaveAttribute('aria-label', /workspaces/i);
    await expect(tabs.nth(1)).toHaveAttribute('aria-label', /project/i);
    await expect(tabs.nth(2)).toHaveAttribute('aria-label', /git/i);
    await expect(tabs.nth(3)).toHaveAttribute('aria-label', /settings/i);
  });

  test('SHELL-UI-01: active tab has aria-selected true, others false', async ({ page }) => {
    const rail = page.locator('[data-testid="rail-tabs"]');
    const tabs = rail.locator('[role="tab"]');

    // Default active is Workspaces (first tab)
    await expect(tabs.nth(0)).toHaveAttribute('aria-selected', 'true');
    await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'false');
    await expect(tabs.nth(2)).toHaveAttribute('aria-selected', 'false');

    // Click Git tab
    await tabs.nth(2).click();
    await expect(tabs.nth(2)).toHaveAttribute('aria-selected', 'true');
    await expect(tabs.nth(0)).toHaveAttribute('aria-selected', 'false');
    await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'false');
  });

  test('SHELL-UI-01: rail keyboard navigation with ArrowDown/ArrowUp', async ({ page }) => {
    const rail = page.locator('[data-testid="rail-tabs"]');
    const firstTab = rail.locator('[role="tab"]').first();

    // Focus the rail
    await firstTab.focus();
    await expect(firstTab).toBeFocused();

    // ArrowDown moves to next tab
    await page.keyboard.press('ArrowDown');
    await expect(rail.locator('[role="tab"]').nth(1)).toBeFocused();

    // ArrowDown again
    await page.keyboard.press('ArrowDown');
    await expect(rail.locator('[role="tab"]').nth(2)).toBeFocused();

    // ArrowUp moves back
    await page.keyboard.press('ArrowUp');
    await expect(rail.locator('[role="tab"]').nth(1)).toBeFocused();
  });

  test('SHELL-UI-01: Home/End keys navigate to first/last tab', async ({ page }) => {
    const rail = page.locator('[data-testid="rail-tabs"]');
    const tabs = rail.locator('[role="tab"]');

    // Focus middle tab, press Home → first
    await tabs.nth(1).focus();
    await page.keyboard.press('Home');
    await expect(tabs.nth(0)).toBeFocused();

    // Press End → last (Settings with the 4-tab rail)
    await page.keyboard.press('End');
    await expect(tabs.nth(3)).toBeFocused();
  });

  test('SHELL-UI-01: Enter key activates a focused rail tab', async ({ page }) => {
    const rail = page.locator('[data-testid="rail-tabs"]');
    const tabs = rail.locator('[role="tab"]');

    await tabs.nth(2).focus();
    await page.keyboard.press('Enter');
    await expect(tabs.nth(2)).toHaveAttribute('aria-selected', 'true');
  });

  test('SHELL-UI-01: Workspaces tab shows workspace sidebar content', async ({ page }) => {
    const rail = page.locator('[data-testid="rail-tabs"]');
    const tabs = rail.locator('[role="tab"]');

    // First tab (Workspaces) should be active by default
    await tabs.nth(0).click();
    const panel = page.locator('[data-testid="left-contextual-panel"]');
    // WorkspaceSidebar has id="workspace-sidebar"
    await expect(panel).toBeVisible();
  });

  test('SHELL-UI-01: Git tab renders GitContextPanel', async ({ page }) => {
    const rail = page.locator('[data-testid="rail-tabs"]');
    const tabs = rail.locator('[role="tab"]');

    // Click Git tab
    await tabs.nth(2).click();
    const gitPanel = page.locator('#git-context-panel');
    await expect(gitPanel).toBeVisible();
  });

  test('SHELL-UI-01: Project tab shows placeholder panel', async ({ page }) => {
    const rail = page.locator('[data-testid="rail-tabs"]');
    const tabs = rail.locator('[role="tab"]');

    // Click Project tab
    await tabs.nth(1).click();
    const panel = page.locator('[data-testid="left-contextual-panel"]');
    await expect(panel).toBeVisible();
    // Project tree content will be added in PROJECT-VIEW-UI-01
  });

  // ────── Theme switcher ──────

  test('SHELL-UI-01: ThemeSwitcher shows and toggles between Dark Deep and Synthwave 84', async ({
    page,
  }) => {
    // The theme switcher lives in Settings (tranche: themes out of header).
    await page.getByTestId('rail-tab-settings').click();
    const switcher = page.locator('[data-testid="theme-switcher"]');
    await expect(switcher).toBeVisible({ timeout: 10000 });

    // Default: Dark Deep should be active
    const darkBtn = switcher.locator('button').first();
    const synthBtn = switcher.locator('button').last();

    await expect(darkBtn).toHaveAttribute('aria-checked', 'true');
    await expect(synthBtn).toHaveAttribute('aria-checked', 'false');

    // Switch to Synthwave '84
    await synthBtn.click();
    await expect(darkBtn).toHaveAttribute('aria-checked', 'false');
    await expect(synthBtn).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'synthwave-84');

    // Switch back to Dark Deep
    await darkBtn.click();
    await expect(darkBtn).toHaveAttribute('aria-checked', 'true');
    await expect(synthBtn).toHaveAttribute('aria-checked', 'false');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('SHELL-UI-01: theme selection persists in localStorage', async ({ page }) => {
    // Switch to Synthwave from Settings
    await page.getByTestId('rail-tab-settings').click();
    await page.locator('[data-testid="theme-switcher"] button').last().click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'synthwave-84');

    // Reload and verify persistence
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'synthwave-84');
  });

  // ────── Open file tabs ──────

  test('SHELL-UI-01: OpenFilesTabs shows selected file label', async ({ page }) => {
    const fileTabs = page.locator('[data-testid="open-files-tabs"]');
    // When no file is selected, show empty/placeholder state
    await expect(fileTabs).toBeVisible({ timeout: 10000 });
  });

  // ────── Right panel tabs ──────

  test('SHELL-UI-01: Right panel shows Comments and Review tabs with accessible labels', async ({
    page,
  }) => {
    const rightPanel = page.locator('[data-testid="right-panel"]');
    await expect(rightPanel).toBeVisible({ timeout: 10000 });

    const tabs = rightPanel.locator('[role="tab"]');
    await expect(tabs).toHaveCount(2);
    await expect(tabs.nth(0)).toHaveAttribute('aria-label', /comments/i);
    await expect(tabs.nth(1)).toHaveAttribute('aria-label', /review/i);
  });

  test('SHELL-UI-01: Comments tab renders ObservationPanel content', async ({ page }) => {
    const rightPanel = page.locator('[data-testid="right-panel"]');
    const commentsTab = rightPanel.locator('[role="tab"]').first();

    await commentsTab.click();
    await expect(commentsTab).toHaveAttribute('aria-selected', 'true');

    // Observation panel should be visible
    const obsPanel = page.locator('#observation-panel');
    await expect(obsPanel).toBeVisible();
  });

  test('SHELL-UI-01: Review tab renders ReviewPanel content', async ({ page }) => {
    const rightPanel = page.locator('[data-testid="right-panel"]');
    const reviewTab = rightPanel.locator('[role="tab"]').last();

    await reviewTab.click();
    await expect(reviewTab).toHaveAttribute('aria-selected', 'true');

    // Review panel should be visible (scope to right panel)
    const reviewPanel = rightPanel.locator('#review-panel');
    await expect(reviewPanel).toBeVisible();

    // Verify only one #review-panel exists on the page (no duplicate center render)
    await expect(page.locator('#review-panel')).toHaveCount(1);
  });

  // ────── Layout structure ──────

  test('SHELL-UI-01: page uses shell layout with rail, left panel, center, right panel', async ({
    page,
  }) => {
    const layout = page.locator('[data-testid="shell-layout"]');
    await expect(layout).toBeVisible();

    const rail = page.locator('[data-testid="rail-tabs"]');
    await expect(rail).toBeVisible();

    const leftPanel = page.locator('[data-testid="left-contextual-panel"]');
    await expect(leftPanel).toBeVisible();

    const center = page.locator('[data-testid="center-content"]');
    await expect(center).toBeVisible();

    const rightPanel = page.locator('[data-testid="right-panel"]');
    await expect(rightPanel).toBeVisible();
  });
});
