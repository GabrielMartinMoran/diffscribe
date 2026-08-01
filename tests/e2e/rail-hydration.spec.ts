import { expect, test } from './fixtures';
import { waitForHydration } from './helpers/hydration';
import { resetDb } from './helpers/reset-db';

// ── Console / pageerror interceptors ──
//
// Each test registers these listeners BEFORE `page.goto` so that
// errors emitted during navigation, SSR, or hydration are captured.

interface ErrorLog {
  type: 'pageerror' | 'console-error';
  message: string;
}

test.beforeEach(async ({ request }) => {
  await resetDb(request);
});

test('rail hydration completes without TypeError or pageerror', async ({ page }) => {
  const errors: ErrorLog[] = [];

  page.on('pageerror', (err) => {
    errors.push({ type: 'pageerror', message: err.message });
  });

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push({ type: 'console-error', message: msg.text() });
    }
  });

  await page.goto('/');
  await waitForHydration(page);

  // Verify no page-level errors
  const pageErrors = errors.filter((e) => e.type === 'pageerror');
  expect(pageErrors).toEqual([]);

  // Verify no TypeError or hydration failures in console
  const criticalErrors = errors.filter(
    (e) =>
      e.message.includes('TypeError') ||
      e.message.includes('undefined.call') ||
      e.message.includes('Failed to hydrate'),
  );
  expect(criticalErrors).toEqual([]);
});

test('four SVG icons are rendered after hydration', async ({ page }) => {
  await page.goto('/');
  await waitForHydration(page);

  // Each rail tab button should contain one SVG icon
  const railTabKeys = ['workspaces', 'project', 'git', 'settings'];

  for (const key of railTabKeys) {
    const tab = page.locator(`[data-testid="rail-tab-${key}"]`);
    await expect(tab).toBeVisible({ timeout: 5000 });

    // The icon is an SVG element inside the tab button
    const svg = tab.locator('svg');
    await expect(svg).toBeVisible({ timeout: 5000 });

    // Each SVG should have an accessible label (aria-label on the button, or ariaLabel on the icon)
    const ariaLabel = await tab.getAttribute('aria-label');
    expect(ariaLabel).toBeTruthy();
  }
});

test('keyboard navigation after hydration produces no console errors', async ({ page }) => {
  const consoleErrors: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  await page.goto('/');
  await waitForHydration(page);

  // Focus the rail tabs container
  const rail = page.locator('[data-testid="rail-tabs"]');
  await rail.focus();

  // ArrowDown: move focus
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(300);

  // ArrowUp: move focus back
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(300);

  // No console errors during keyboard navigation
  expect(consoleErrors).toEqual([]);
});

test('cold-start readiness and hydration produces no errors', async ({ page }) => {
  const errors: ErrorLog[] = [];

  page.on('pageerror', (err) => {
    errors.push({ type: 'pageerror', message: err.message });
  });

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push({ type: 'console-error', message: msg.text() });
    }
  });

  // Navigate to the application (dev server must be ready before this step)
  await page.goto('/');
  await waitForHydration(page);

  // All four rail tab icons should be visible
  const railTabKeys = ['workspaces', 'project', 'git', 'settings'];
  for (const key of railTabKeys) {
    const tab = page.locator(`[data-testid="rail-tab-${key}"]`);
    await expect(tab).toBeVisible({ timeout: 5000 });
  }

  // No hydration-related errors
  const criticalErrors = errors.filter(
    (e) =>
      e.message.includes('TypeError') ||
      e.message.includes('undefined.call') ||
      e.message.includes('Failed to hydrate'),
  );
  expect(criticalErrors).toEqual([]);
});
