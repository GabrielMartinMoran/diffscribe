import { expect, test } from './fixtures';
import { resetDb } from './helpers/reset-db';

test.describe('Responsive layout (RESPONSIVE-UI-01)', () => {
  test.beforeEach(async ({ page, request }) => {
    await resetDb(request);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test.afterEach(async ({ page }) => {
    // Reset viewport to default after each test
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  // ────── Desktop layout ──────

  test('RESPONSIVE-UI-01: desktop 1280px shows all four layout regions', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForLoadState('networkidle');

    await expect(page.locator('[data-testid="rail-tabs"]')).toBeVisible();
    await expect(page.locator('[data-testid="left-contextual-panel"]')).toBeVisible();
    await expect(page.locator('[data-testid="center-content"]')).toBeVisible();
    await expect(page.locator('[data-testid="right-panel"]')).toBeVisible();

    // No horizontal overflow on the page
    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasOverflow).toBe(false);
  });

  test('RESPONSIVE-UI-01: desktop 1024px shows all four regions', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 800 });
    await page.waitForLoadState('networkidle');

    await expect(page.locator('[data-testid="rail-tabs"]')).toBeVisible();
    await expect(page.locator('[data-testid="left-contextual-panel"]')).toBeVisible();
    await expect(page.locator('[data-testid="center-content"]')).toBeVisible();
    await expect(page.locator('[data-testid="right-panel"]')).toBeVisible();

    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasOverflow).toBe(false);
  });

  test('RESPONSIVE-UI-01: tablet 768px shows rail and center, left and right panels hidden', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 768, height: 800 });
    await page.waitForLoadState('networkidle');

    await expect(page.locator('[data-testid="rail-tabs"]')).toBeVisible();
    await expect(page.locator('[data-testid="center-content"]')).toBeVisible();

    // Left panel should be hidden in mobile/tablet
    const leftPanel = page.locator('[data-testid="left-contextual-panel"]');
    await expect(leftPanel).not.toBeVisible();

    // Right panel should be hidden in mobile/tablet
    const rightPanel = page.locator('[data-testid="right-panel"]');
    await expect(rightPanel).not.toBeVisible();
  });

  // ────── Mobile layout ──────

  test('RESPONSIVE-UI-01: mobile 375px keeps center region as primary area', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForLoadState('networkidle');

    // Center content should be visible and fill most of the viewport
    await expect(page.locator('[data-testid="center-content"]')).toBeVisible();

    // Left panel should be hidden
    const leftPanel = page.locator('[data-testid="left-contextual-panel"]');
    await expect(leftPanel).not.toBeVisible();

    // Right panel should be hidden
    const rightPanel = page.locator('[data-testid="right-panel"]');
    await expect(rightPanel).not.toBeVisible();
  });

  test('RESPONSIVE-UI-01: mobile 320px keeps center region usable', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.waitForLoadState('networkidle');

    await expect(page.locator('[data-testid="center-content"]')).toBeVisible();

    const leftPanel = page.locator('[data-testid="left-contextual-panel"]');
    await expect(leftPanel).not.toBeVisible();

    const rightPanel = page.locator('[data-testid="right-panel"]');
    await expect(rightPanel).not.toBeVisible();
  });

  test('RESPONSIVE-UI-01: mobile left panel opens as an overlay drawer from rail tab', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForLoadState('networkidle');

    // Click the Project rail tab to open the left drawer
    const projectTab = page.locator('[data-testid="rail-tab-project"]');
    await expect(projectTab).toBeVisible();
    await projectTab.click();

    // Left drawer should now be visible as an overlay
    const leftPanel = page.locator('[data-testid="left-contextual-panel"]');
    await expect(leftPanel).toBeVisible();
  });

  test('RESPONSIVE-UI-01: mobile right panel opens as an overlay sheet', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForLoadState('networkidle');

    // Tap the right panel toggle to open the sheet
    const rightPanel = page.locator('[data-testid="right-panel"]');
    await expect(rightPanel).not.toBeVisible();

    // Find and click the right panel toggle button
    const rightToggle = page.locator('[data-testid="mobile-right-panel-toggle"]');
    await expect(rightToggle).toBeVisible();
    await rightToggle.click();

    // The right panel sheet should now be visible as an overlay
    await expect(rightPanel).toBeVisible();
  });

  // ────── Backdrop ──────

  test('RESPONSIVE-UI-01: backdrop is visible when drawer is open on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForLoadState('networkidle');

    // Open left drawer
    await page.locator('[data-testid="rail-tab-project"]').click();

    // Backdrop should be visible
    const backdrop = page.locator('[data-testid="mobile-backdrop"]');
    await expect(backdrop).toBeVisible();
  });

  test('RESPONSIVE-UI-01: backdrop click closes drawer on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForLoadState('networkidle');

    // Open left drawer
    await page.locator('[data-testid="rail-tab-project"]').click();
    await expect(page.locator('[data-testid="left-contextual-panel"]')).toBeVisible();

    // Click backdrop to close — click at a position outside the drawer area
    // The drawer is max 320px wide; click at x=360 (right side) on a 375px viewport
    const backdrop = page.locator('[data-testid="mobile-backdrop"]');
    await backdrop.click({ position: { x: 360, y: 200 } });

    // Drawer should close
    await expect(page.locator('[data-testid="left-contextual-panel"]')).not.toBeVisible();
    await expect(backdrop).not.toBeVisible();
  });

  test('RESPONSIVE-UI-01: backdrop has accessible label', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForLoadState('networkidle');

    // Open left drawer
    await page.locator('[data-testid="rail-tab-project"]').click();

    const backdrop = page.locator('[data-testid="mobile-backdrop"]');
    await expect(backdrop).toHaveAttribute('aria-label');
  });

  // ────── Escape key ──────

  test('RESPONSIVE-UI-01: Escape key closes left drawer on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForLoadState('networkidle');

    // Open left drawer
    await page.locator('[data-testid="rail-tab-project"]').click();
    await expect(page.locator('[data-testid="left-contextual-panel"]')).toBeVisible();

    // Press Escape to close
    await page.keyboard.press('Escape');

    // Drawer should close
    await expect(page.locator('[data-testid="left-contextual-panel"]')).not.toBeVisible();
  });

  test('RESPONSIVE-UI-01: Escape key closes right sheet on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForLoadState('networkidle');

    // Open right sheet
    const rightToggle = page.locator('[data-testid="mobile-right-panel-toggle"]');
    await rightToggle.click();
    const rightPanel = page.locator('[data-testid="right-panel"]');
    await expect(rightPanel).toBeVisible();

    // Press Escape to close
    await page.keyboard.press('Escape');

    // Sheet should close
    await expect(rightPanel).not.toBeVisible();
  });

  // ────── Focus management ──────

  test('RESPONSIVE-UI-01: focus returns to rail tab trigger when drawer closes', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForLoadState('networkidle');

    // Open drawer from Project tab
    const projectTab = page.locator('[data-testid="rail-tab-project"]');
    await projectTab.click();
    await expect(page.locator('[data-testid="left-contextual-panel"]')).toBeVisible();

    // Close via Escape
    await page.keyboard.press('Escape');

    // Focus should have returned to the project tab
    await expect(projectTab).toBeFocused();
  });

  // ────── Overflow prevention ──────

  test('RESPONSIVE-UI-01: no page horizontal overflow at 1280px', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForLoadState('networkidle');

    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasOverflow).toBe(false);
  });

  test('RESPONSIVE-UI-01: no page horizontal overflow at 1024px', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 800 });
    await page.waitForLoadState('networkidle');

    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasOverflow).toBe(false);
  });

  test('RESPONSIVE-UI-01: no page horizontal overflow at 900px', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 800 });
    await page.waitForLoadState('networkidle');

    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasOverflow).toBe(false);
  });

  test('RESPONSIVE-UI-01: no page horizontal overflow at 768px', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 800 });
    await page.waitForLoadState('networkidle');

    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasOverflow).toBe(false);
  });

  test('RESPONSIVE-UI-01: no page horizontal overflow at 375px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForLoadState('networkidle');

    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasOverflow).toBe(false);
  });

  test('RESPONSIVE-UI-01: no page horizontal overflow at 320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.waitForLoadState('networkidle');

    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasOverflow).toBe(false);
  });
});
