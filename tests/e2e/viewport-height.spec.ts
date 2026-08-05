import { expect, test } from './fixtures';
import { waitForHydration } from './helpers/hydration';
import { resetDb } from './helpers/reset-db';

/**
 * 0004 panel viewport height fix — browser-observable geometry.
 *
 * Desktop: the central work area and the right panel (expanded and collapsed
 * strip) must reach the same bottom boundary as the left region, x positions
 * stay unchanged, and the document never scrolls. Mobile: shell, center,
 * rail, toggle, and open sheet keep reaching the viewport bottom.
 *
 * Tolerance: ±2 px for `100dvh`/viewport rounding.
 */

const isMobileWidth = (width: number) => width <= 768;

const MOBILE_VIEWPORT: Record<number, number> = {
  320: 568,
  375: 667,
  768: 800,
};

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
  bottom: number;
  right: number;
}

/**
 * DOM barrier: reload at the target size and wait until the responsive shell
 * actually applied the media query (`.is-mobile` present exactly when the
 * width is mobile), then wait for hydration.
 */
async function applyViewport(
  page: import('@playwright/test').Page,
  width: number,
  height: number,
): Promise<void> {
  await page.setViewportSize({ width, height });
  await page.reload();
  await expect(async () => {
    const isMobile = await page.evaluate(
      () => document.querySelector('.shell-layout')?.classList.contains('is-mobile') ?? false,
    );
    expect(isMobile).toBe(isMobileWidth(width));
  }).toPass({ timeout: 15000 });
  await waitForHydration(page);
}

/** Read the bounding boxes that define the shell's bottom-boundary contract. */
async function readMetrics(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const box = (selector: string): Box | null => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        x: r.x,
        y: r.y,
        width: r.width,
        height: r.height,
        bottom: r.y + r.height,
        right: r.x + r.width,
      };
    };
    return {
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      center: box('[data-testid="center-content"]'),
      rightPanel: box('.right-panel:not(.mobile-sheet)'),
      rightStrip: box('.right-panel-strip-wrap'),
      leftFooter: box('[data-testid="left-region-footer"]'),
      documentScrolls:
        document.documentElement.scrollHeight > document.documentElement.clientHeight + 1,
    };
  });
}

/** Real click on the right collapse button, waiting for the strip branch. */
async function collapseRightPanel(page: import('@playwright/test').Page): Promise<void> {
  await expect(async () => {
    await page.locator('[data-testid="right-panel-collapse-btn"]').click();
    await expect(page.locator('.right-panel-strip-wrap')).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 20000 });
}

/** Real click on the left collapse button, waiting for the rail-width footer. */
async function collapseLeftPanel(page: import('@playwright/test').Page): Promise<void> {
  await expect(async () => {
    await page.locator('[data-testid="left-panel-collapse-btn"]').click();
    const footerBox = await page.getByTestId('left-region-footer').boundingBox();
    expect(footerBox).not.toBeNull();
    expect(footerBox!.width).toBeLessThanOrEqual(50);
  }).toPass({ timeout: 20000 });
}

test.describe('0004 — desktop regions reach the viewport bottom (expanded)', () => {
  for (const [width, height] of [
    [1280, 720],
    [1440, 800],
  ] as const) {
    test(`center and right panel bottom equal the viewport bottom at ${width}x${height}`, async ({
      page,
      request,
    }) => {
      await resetDb(request);
      await page.goto('/');
      await applyViewport(page, width, height);

      const m = await readMetrics(page);
      expect(m.center).not.toBeNull();
      expect(m.rightPanel).not.toBeNull();

      // Bottom boundary: center and right panel end at the viewport bottom.
      expect(Math.abs(m.center!.bottom - m.viewportHeight)).toBeLessThanOrEqual(2);
      expect(Math.abs(m.rightPanel!.bottom - m.viewportHeight)).toBeLessThanOrEqual(2);

      // Right edge flush with the viewport right edge.
      expect(Math.abs(m.rightPanel!.right - m.viewportWidth)).toBeLessThanOrEqual(2);

      // x positions unchanged: center starts after rail + left panel (48+300)
      // and the right panel occupies the explicit right column (320 px).
      expect(Math.abs(m.center!.x - 348)).toBeLessThanOrEqual(2);
      expect(Math.abs(m.rightPanel!.x - (width - 320))).toBeLessThanOrEqual(2);

      // No document overflow.
      expect(m.documentScrolls).toBe(false);
    });
  }
});

test.describe('0004 — collapsed right strip and left footer', () => {
  test('collapsed right strip reaches the viewport bottom and keeps its rail width at 1280x720', async ({
    page,
    request,
  }) => {
    await resetDb(request);
    await page.goto('/');
    await applyViewport(page, 1280, 720);
    await collapseRightPanel(page);

    const m = await readMetrics(page);
    expect(m.rightStrip).not.toBeNull();
    expect(Math.abs(m.rightStrip!.bottom - m.viewportHeight)).toBeLessThanOrEqual(2);
    expect(Math.abs(m.rightStrip!.width - 48)).toBeLessThanOrEqual(2);
    expect(m.documentScrolls).toBe(false);
  });

  test('left footer stays bottom-most and keeps expanded/collapsed widths at 1280x720', async ({
    page,
    request,
  }) => {
    await resetDb(request);
    await page.goto('/');
    await applyViewport(page, 1280, 720);

    // Expanded: footer bottom == viewport bottom, width == rail + panel.
    let m = await readMetrics(page);
    expect(m.leftFooter).not.toBeNull();
    expect(Math.abs(m.leftFooter!.bottom - m.viewportHeight)).toBeLessThanOrEqual(2);
    expect(Math.abs(m.leftFooter!.width - 348)).toBeLessThanOrEqual(2);

    // Collapsed: footer keeps the bottom boundary and shrinks to rail width.
    await collapseLeftPanel(page);
    m = await readMetrics(page);
    expect(Math.abs(m.leftFooter!.bottom - m.viewportHeight)).toBeLessThanOrEqual(2);
    expect(Math.abs(m.leftFooter!.width - 48)).toBeLessThanOrEqual(2);
  });
});

test.describe('0004 — mobile layout still reaches the viewport bottom', () => {
  for (const width of [320, 375, 768]) {
    test(`shell, center, rail, and toggle reach the viewport bottom at ${width}px`, async ({
      page,
      request,
    }) => {
      await resetDb(request);
      await page.goto('/');
      await applyViewport(page, width, MOBILE_VIEWPORT[width]);

      const m = await readMetrics(page);
      expect(m.center).not.toBeNull();
      expect(Math.abs(m.center!.bottom - m.viewportHeight)).toBeLessThanOrEqual(2);

      const railBox = await page.getByTestId('rail-tabs').boundingBox();
      expect(railBox).not.toBeNull();
      expect(Math.abs(railBox!.y + railBox!.height - m.viewportHeight)).toBeLessThanOrEqual(2);

      const toggleBox = await page
        .locator('[data-testid="mobile-right-panel-toggle"]')
        .boundingBox();
      expect(toggleBox).not.toBeNull();
      expect(Math.abs(toggleBox!.y + toggleBox!.height - m.viewportHeight)).toBeLessThanOrEqual(2);

      expect(m.documentScrolls).toBe(false);
    });

    test(`right panel sheet is anchored to the viewport bottom at ${width}px`, async ({
      page,
      request,
    }) => {
      await resetDb(request);
      await page.goto('/');
      await applyViewport(page, width, MOBILE_VIEWPORT[width]);

      const toggle = page.locator('[data-testid="mobile-right-panel-toggle"]');
      const mobileSheet = page.locator('[data-testid="right-panel"].mobile-sheet');
      await expect(async () => {
        await toggle.click();
        await expect(mobileSheet).toBeVisible({ timeout: 3000 });
      }).toPass({ timeout: 20000 });

      // DOM barrier: wait for the slide-up transition to settle, then assert
      // the sheet bottom anchors to the viewport bottom.
      await expect(async () => {
        const box = await mobileSheet.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.y).toBeGreaterThanOrEqual(0);
        expect(Math.abs(box!.y + box!.height - MOBILE_VIEWPORT[width])).toBeLessThanOrEqual(2);
      }).toPass({ timeout: 5000 });
    });
  }
});
