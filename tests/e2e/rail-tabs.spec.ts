import { expect, test } from './fixtures';
import { waitForHydration } from './helpers/hydration';
import { resetDb } from './helpers/reset-db';

/**
 * RAIL-02: rail labels fit without clipping at a 1280 px viewport and use
 * the --text-2xs token with ellipsis truncation instead of overflow.
 */
test.describe('Rail labels at 1280px (RAIL-02)', () => {
  test.beforeEach(async ({ page, request }) => {
    await resetDb(request);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('RAIL-02: rail labels fit without clipping and truncate with ellipsis', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await waitForHydration(page);

    const rail = page.locator('[data-testid="rail-tabs"]');
    await expect(rail).toBeVisible({ timeout: 10000 });

    const labels = rail.locator('.ui-tabs__label');
    await expect(labels).toHaveCount(4);

    // Every label uses the --text-2xs token (0.625rem of the root font size).
    const expectedLabelSize = await page.evaluate(() => {
      const rootSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
      return rootSize * 0.625;
    });
    const fontSizes = await labels.evaluateAll((els) =>
      els.map((el) => parseFloat(getComputedStyle(el).fontSize)),
    );
    for (const size of fontSizes) {
      expect(
        Math.abs(size - expectedLabelSize),
        'rail label must use the --text-2xs token',
      ).toBeLessThan(0.01);
    }

    // No label overflows without an ellipsis: any scrollWidth beyond the box
    // must be handled by ellipsis truncation, never raw clipping or wrapping.
    const unhandledOverflow = await labels.evaluateAll(
      (els) =>
        els.filter((el) => {
          const style = getComputedStyle(el);
          const overflows = el.scrollWidth > el.clientWidth + 1;
          return overflows && style.textOverflow !== 'ellipsis';
        }).length,
    );
    expect(unhandledOverflow).toBe(0);

    // Labels stay inside the 48 px rail column (no horizontal escape).
    const railBox = (await rail.boundingBox())!;
    const labelBoxes = await labels.evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return { left: r.left, right: r.right };
      }),
    );
    for (const box of labelBoxes) {
      expect(box.left).toBeGreaterThanOrEqual(railBox.x - 1);
      expect(box.right).toBeLessThanOrEqual(railBox.x + railBox.width + 1);
    }
  });
});
