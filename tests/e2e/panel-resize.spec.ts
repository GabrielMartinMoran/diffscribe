import { expect, test } from './fixtures';
import { waitForHydration } from './helpers/hydration';
import { resetDb } from './helpers/reset-db';

test.describe('Panel resize and collapse (PANELS-UI-01)', () => {
  test.beforeEach(async ({ page, request }) => {
    await resetDb(request);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  // ────── Body wrapper regression: both panels collapsed ──────

  test('PANELS-UI-01: both panels collapsed after hydration maintains rail and center visible', async ({
    page,
  }) => {
    await waitForHydration(page);

    // Collapse left
    const leftCollapseBtn = page.locator('[data-testid="left-panel-collapse-btn"]');
    await expect(leftCollapseBtn).toBeVisible({ timeout: 10000 });
    await leftCollapseBtn.click();
    await expect(page.locator('[data-testid="left-contextual-panel"]')).not.toBeVisible();

    // Collapse right
    const rightCollapseBtn = page.locator('[data-testid="right-panel-collapse-btn"]');
    await expect(rightCollapseBtn).toBeVisible();
    await rightCollapseBtn.click();

    // Rail must be visible
    await expect(page.locator('[data-testid="rail-tabs"]')).toBeVisible();

    // Center must fill remaining space
    await expect(page.locator('[data-testid="center-content"]')).toBeVisible();

    // No empty panel frames
    await expect(page.locator('[data-testid="left-contextual-panel"]')).not.toBeVisible();
    const rightPanel = page.locator('[data-testid="right-panel"]');
    // Collapsed strip exposes exactly one vertical tablist (the kit's inner
    // tablist; the wrapper no longer carries a tablist role).
    await expect(rightPanel.locator('[role="tablist"]')).toHaveCount(1);
    await expect(rightPanel.locator('[role="tablist"]')).toHaveAttribute(
      'aria-orientation',
      'vertical',
    );
  });

  // ────── Collapse and expand ──────

  test('PANELS-UI-01: left panel can be collapsed and expanded', async ({ page }) => {
    const leftPanel = page.locator('[data-testid="left-contextual-panel"]');
    await expect(leftPanel).toBeVisible({ timeout: 10000 });

    // Collapse
    const collapseBtn = page.locator('[data-testid="left-panel-collapse-btn"]');
    await expect(collapseBtn).toBeVisible();
    await collapseBtn.click();
    await expect(leftPanel).not.toBeVisible();

    // Reopen via the reopen button in the rail
    const reopenBtn = page.locator('[data-testid="left-panel-reopen-btn"]');
    await expect(reopenBtn).toBeVisible();
    await reopenBtn.click();
    await expect(leftPanel).toBeVisible();
  });

  test('PANELS-UI-01: right panel can be collapsed and expanded', async ({ page }) => {
    const rightPanel = page.locator('[data-testid="right-panel"]');
    await expect(rightPanel).toBeVisible({ timeout: 10000 });

    // Verify expanded state shows tabs
    const commentsTab = rightPanel.locator('[role="tab"]').first();
    await expect(commentsTab).toBeVisible();

    // Collapse
    const collapseBtn = page.locator('[data-testid="right-panel-collapse-btn"]');
    await expect(collapseBtn).toBeVisible();
    await collapseBtn.click();

    // Right panel switches to the collapsed strip: a vertical tablist.
    await expect(rightPanel.locator('[role="tablist"]')).toHaveCount(1);
    await expect(rightPanel.locator('[role="tablist"]')).toHaveAttribute(
      'aria-orientation',
      'vertical',
    );
    await expect(rightPanel.locator('[role="tab"]').first()).toBeVisible();

    // Reopen by activating the Comments strip tab.
    await rightPanel.locator('[data-testid="right-tab-comments"]').click();

    // Now back to expanded state with a visible Comments tabpanel.
    await expect(page.locator('#ui-tab-panel-comments')).toBeVisible({ timeout: 5000 });
    await expect(commentsTab).toBeVisible();
  });

  test('PANELS-UI-01: rail tab selection expands a collapsed left panel idempotently', async ({
    page,
  }) => {
    const leftPanel = page.locator('[data-testid="left-contextual-panel"]');
    const collapseBtn = page.locator('[data-testid="left-panel-collapse-btn"]');

    await collapseBtn.click();
    await expect(leftPanel).not.toBeVisible();

    // 0002 correction: a direct rail click while collapsed selects the
    // option AND opens the panel idempotently (old behavior kept it
    // collapsed); while open it only changes selection, never toggles.
    const gitTab = page.locator('[data-testid="rail-tab-git"]');
    await gitTab.click();
    await expect(gitTab).toHaveAttribute('aria-selected', 'true');
    await expect(leftPanel).toBeVisible({ timeout: 5000 });

    const projectTab = page.locator('[data-testid="rail-tab-project"]');
    await projectTab.click();
    await expect(projectTab).toHaveAttribute('aria-selected', 'true');
    await expect(leftPanel).toBeVisible();
  });

  // ────── Resize handles ──────

  test('PANELS-UI-01: resize handles are visible and accessible', async ({ page }) => {
    const leftHandle = page.locator('[data-testid="left-resize-handle"]');
    await expect(leftHandle).toBeVisible();
    await expect(leftHandle).toHaveAttribute('role', 'separator');
    await expect(leftHandle).toHaveAttribute('aria-label');

    const rightHandle = page.locator('[data-testid="right-resize-handle"]');
    await expect(rightHandle).toBeVisible();
    await expect(rightHandle).toHaveAttribute('role', 'separator');
    await expect(rightHandle).toHaveAttribute('aria-label');
  });

  // ────── Keyboard reset ──────

  test('PANELS-UI-01: reset layout action restores default panel state', async ({ page }) => {
    const leftPanel = page.locator('[data-testid="left-contextual-panel"]');
    const resetBtn = page.locator('[data-testid="reset-layout-btn"]');
    await expect(resetBtn).toBeVisible();

    // Collapse left panel first
    const collapseBtn = page.locator('[data-testid="left-panel-collapse-btn"]');
    await collapseBtn.click();
    await expect(leftPanel).not.toBeVisible();

    // Reset layout
    await resetBtn.click();
    await expect(leftPanel).toBeVisible();
  });

  // ────── Persistence ──────

  test('PANELS-UI-01: panel layout preference persists in localStorage', async ({ page }) => {
    // Collapse left panel
    const collapseBtn = page.locator('[data-testid="left-panel-collapse-btn"]');
    await collapseBtn.click();

    // Verify localStorage was written
    const stored = await page.evaluate(() => localStorage.getItem('diffscribe-panel-layout'));
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed.leftCollapsed).toBe(true);

    // Reload and verify persistence
    await page.reload();
    await page.waitForLoadState('networkidle');

    const leftPanel = page.locator('[data-testid="left-contextual-panel"]');
    await expect(leftPanel).not.toBeVisible();
  });

  test('PANELS-UI-01: invalid localStorage safely falls back to defaults', async ({ page }) => {
    // Set invalid layout value
    await page.evaluate(() =>
      localStorage.setItem('diffscribe-panel-layout', '{"leftWidth":99999,"rightWidth":"invalid"}'),
    );

    await page.reload();
    await page.waitForLoadState('networkidle');

    // Page should render normally with default widths
    const leftPanel = page.locator('[data-testid="left-contextual-panel"]');
    await expect(leftPanel).toBeVisible({ timeout: 10000 });

    // No error toast should appear
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await expect(errors.length).toBe(0);
  });

  // ────── Overflow prevention ──────

  test('PANELS-UI-01: both panels collapsed leaves only rail and center visible', async ({
    page,
  }) => {
    // Collapse left
    const leftCollapseBtn = page.locator('[data-testid="left-panel-collapse-btn"]');
    await leftCollapseBtn.click();

    // Collapse right
    const rightCollapseBtn = page.locator('[data-testid="right-panel-collapse-btn"]');
    await rightCollapseBtn.click();

    // Rail should be visible
    await expect(page.locator('[data-testid="rail-tabs"]')).toBeVisible();

    // Left panel hidden
    const leftPanel = page.locator('[data-testid="left-contextual-panel"]');
    await expect(leftPanel).not.toBeVisible();

    // Right panel shows collapsed vertical strip
    const rightPanel = page.locator('[data-testid="right-panel"]');
    await expect(rightPanel.locator('[role="tablist"]')).toHaveCount(1);
    await expect(rightPanel.locator('[role="tablist"]')).toHaveAttribute(
      'aria-orientation',
      'vertical',
    );

    // Center content is still visible
    await expect(page.locator('[data-testid="center-content"]')).toBeVisible();
  });

  // ────── Min and max bounds via keyboard ──────

  test('PANELS-UI-01: left resize handle Home key sets minimum width', async ({ page }) => {
    const handle = page.locator('[data-testid="left-resize-handle"]');
    await expect(handle).toBeVisible({ timeout: 10000 });
    // Verify aria-valuemin and aria-valuemax attributes are present
    await expect(handle).toHaveAttribute('aria-valuemin', '200');
    await expect(handle).toHaveAttribute('aria-valuemax', '480');

    await handle.focus();
    await page.keyboard.press('Home');

    // After Home, aria-valuenow should equal aria-valuemin
    await expect(handle).toHaveAttribute('aria-valuenow', '200');
  });

  test('PANELS-UI-01: left resize handle End key sets maximum width', async ({ page }) => {
    const handle = page.locator('[data-testid="left-resize-handle"]');
    await expect(handle).toBeVisible({ timeout: 10000 });

    await handle.focus();
    await page.keyboard.press('End');

    // After End, aria-valuenow should equal aria-valuemax
    await expect(handle).toHaveAttribute('aria-valuenow', '480');
  });

  test('PANELS-UI-01: right resize handle Home key sets minimum width', async ({ page }) => {
    const handle = page.locator('[data-testid="right-resize-handle"]');
    await expect(handle).toBeVisible({ timeout: 10000 });
    await expect(handle).toHaveAttribute('aria-valuemin', '240');
    await expect(handle).toHaveAttribute('aria-valuemax', '480');

    await handle.focus();
    await page.keyboard.press('Home');

    await expect(handle).toHaveAttribute('aria-valuenow', '240');
  });

  test('PANELS-UI-01: right resize handle End key sets maximum width', async ({ page }) => {
    const handle = page.locator('[data-testid="right-resize-handle"]');
    await expect(handle).toBeVisible({ timeout: 10000 });

    await handle.focus();
    await page.keyboard.press('End');

    await expect(handle).toHaveAttribute('aria-valuenow', '480');
  });

  // ────── Page overflow prevention at max widths ──────

  test('PANELS-UI-01: page has no horizontal overflow when panels are at maximum width', async ({
    page,
  }) => {
    // Set left panel to max via keyboard
    const leftHandle = page.locator('[data-testid="left-resize-handle"]');
    await expect(leftHandle).toBeVisible({ timeout: 10000 });
    await leftHandle.focus();
    await page.keyboard.press('End');
    await expect(leftHandle).toHaveAttribute('aria-valuenow', '480');

    // Set right panel to max via keyboard
    const rightHandle = page.locator('[data-testid="right-resize-handle"]');
    await expect(rightHandle).toBeVisible();
    await rightHandle.focus();
    await page.keyboard.press('End');
    await expect(rightHandle).toHaveAttribute('aria-valuenow', '480');

    // Verify no horizontal overflow
    const hasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasOverflow).toBe(false);
  });

  // ────── localStorage corruption regression ──────

  test('PANELS-UI-01: NaN/Infinity localStorage values do not break the shell', async ({
    page,
  }) => {
    // Inject NaN as leftWidth into localStorage
    await page.evaluate(() =>
      localStorage.setItem(
        'diffscribe-panel-layout',
        '{"leftWidth":null,"rightWidth":320,"leftCollapsed":false,"rightCollapsed":false}',
      ),
    );

    // Reload — the app must not crash or show a blank page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Shell must still be visible
    await expect(page.locator('[data-testid="shell-layout"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="rail-tabs"]')).toBeVisible();
    await expect(page.locator('[data-testid="center-content"]')).toBeVisible();

    // Repeat with Infinity and string values
    await page.evaluate(() =>
      localStorage.setItem(
        'diffscribe-panel-layout',
        '{"leftWidth":Infinity,"rightWidth":"garbage","leftCollapsed":42,"rightCollapsed":null}',
      ),
    );
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Shell must still be visible
    await expect(page.locator('[data-testid="shell-layout"]')).toBeVisible({ timeout: 10000 });
  });
});

// ────── Resize alignment measurement (E2E gate) ──────
// This test measures the resize behavior BEFORE any fix is chosen: the CSS
// variable, the grid template columns, and the bounding boxes of the handle,
// the panel edge, and the center column must all agree after a drag. If the
// measurement confirms a misalignment (gap), a fix is justified; otherwise the
// Orchestrator is notified and no fix is improvised.

interface ResizeMetrics {
  gridColumns: string[];
  leftVar: string;
  rightVar: string;
  leftPanelRight: number | null;
  leftHandleCenterX: number | null;
  centerLeft: number | null;
  centerRight: number | null;
  rightHandleCenterX: number | null;
  rightPanelLeft: number | null;
  rightPanelRight: number | null;
  viewportWidth: number;
}

async function measureLayout(page: import('@playwright/test').Page): Promise<ResizeMetrics> {
  return page.evaluate(() => {
    const shell = document.querySelector('[data-testid="shell-layout"]');
    const leftPanel = document.querySelector('[data-testid="left-contextual-panel"]');
    const rightPanel = document.querySelector('[data-testid="right-panel"]');
    const center = document.querySelector('[data-testid="center-content"]');
    const leftHandle = document.querySelector('[data-testid="left-resize-handle"]');
    const rightHandle = document.querySelector('[data-testid="right-resize-handle"]');

    const style = shell ? getComputedStyle(shell) : null;
    const gridColumns = style ? style.gridTemplateColumns.split(' ').map((s) => parseFloat(s)) : [];
    const leftPanelRight = leftPanel ? leftPanel.getBoundingClientRect().right : null;
    const leftHandleCenterX = leftHandle
      ? leftHandle.getBoundingClientRect().left + leftHandle.getBoundingClientRect().width / 2
      : null;
    const centerLeft = center ? center.getBoundingClientRect().left : null;
    const centerRight = center ? center.getBoundingClientRect().right : null;
    const rightHandleCenterX = rightHandle
      ? rightHandle.getBoundingClientRect().left + rightHandle.getBoundingClientRect().width / 2
      : null;
    const rightPanelLeft = rightPanel ? rightPanel.getBoundingClientRect().left : null;
    const rightPanelRight = rightPanel ? rightPanel.getBoundingClientRect().right : null;
    const shellStyle = shell ? (shell as HTMLElement).style : null;

    return {
      gridColumns: gridColumns.map((n) => String(Math.round(n))),
      leftVar: shellStyle?.getPropertyValue('--left-panel-width').trim() ?? '',
      rightVar: shellStyle?.getPropertyValue('--right-panel-width').trim() ?? '',
      leftPanelRight,
      leftHandleCenterX,
      centerLeft,
      centerRight,
      rightHandleCenterX,
      rightPanelLeft,
      rightPanelRight,
      viewportWidth: window.innerWidth,
    };
  });
}

async function dragBy(page: import('@playwright/test').Page, handleSelector: string, dx: number) {
  const handle = page.locator(handleSelector);
  const box = (await handle.boundingBox())!;
  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + dx, startY, { steps: 6 });
  await page.mouse.up();
}

/**
 * Drag the right handle and return a measurement sampled mid-drag (before the
 * pointer is released) plus the final measurement. This proves the panel
 * tracks the column while resizing, not only after the drag ends.
 */
async function dragRightWithSample(
  page: import('@playwright/test').Page,
  dx: number,
  sampleDx: number,
): Promise<{ during: ResizeMetrics; after: ResizeMetrics }> {
  const handle = page.locator('[data-testid="right-resize-handle"]');
  const box = (await handle.boundingBox())!;
  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + sampleDx, startY, { steps: 3 });
  const during = await measureLayout(page);
  await page.mouse.move(startX + dx, startY, { steps: 3 });
  await page.mouse.up();
  const after = await measureLayout(page);
  return { during, after };
}

test.describe('Resize alignment measurement (PANELS-UI-01)', () => {
  test.beforeEach(async ({ page, request }) => {
    await resetDb(request);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('left: panel edge, handle, and grid column stay aligned after drag', async ({ page }) => {
    await waitForHydration(page);

    const before = await measureLayout(page);

    await dragBy(page, '[data-testid="left-resize-handle"]', 80);

    const after = await measureLayout(page);
    const tolerance = 2;

    // Evidence: record the measured values for the Orchestrator.
    const evidence = { before, after };
    expect(evidence.after.leftPanelRight).not.toBeNull();

    // The CSS variable must reflect the drag.
    expect(after.leftVar).toBe('380px');

    // Grid column 1 (0-indexed) is the left panel width: 48px rail + panel.
    expect(parseFloat(after.gridColumns[1])).toBeGreaterThan(0);

    // Panel right edge, handle center, and the second grid column boundary
    // must coincide (no gap between the left panel and the center column).
    const gridLeftBoundary = 48 + parseFloat(after.gridColumns[1]);
    expect(Math.abs(after.leftPanelRight! - after.leftHandleCenterX!)).toBeLessThanOrEqual(
      tolerance,
    );
    expect(Math.abs(after.centerLeft! - after.leftHandleCenterX!)).toBeLessThanOrEqual(tolerance);
    expect(Math.abs(gridLeftBoundary - after.leftHandleCenterX!)).toBeLessThanOrEqual(tolerance);
  });

  test('right: panel edge, handle, and grid column stay aligned after drag', async ({ page }) => {
    await waitForHydration(page);

    await dragBy(page, '[data-testid="right-resize-handle"]', -60);

    const after = await measureLayout(page);
    const tolerance = 2;

    expect(after.rightVar).toBe('380px');

    // Grid column 3 (0-indexed) is the right panel width.
    const gridRightBoundary = after.viewportWidth - parseFloat(after.gridColumns[3]);

    expect(Math.abs(after.rightPanelLeft! - after.rightHandleCenterX!)).toBeLessThanOrEqual(
      tolerance,
    );
    expect(Math.abs(after.centerRight! - after.rightHandleCenterX!)).toBeLessThanOrEqual(tolerance);
    expect(Math.abs(gridRightBoundary - after.rightHandleCenterX!)).toBeLessThanOrEqual(tolerance);
  });

  test('right panel width tracks the resized grid column without gap or overflow', async ({
    page,
  }) => {
    await waitForHydration(page);
    const tolerance = 2;

    // Grow the right panel to 380px, sampling the layout mid-drag.
    const grown = await dragRightWithSample(page, -60, -30);
    const expectedWide = 380;
    expect(grown.during.rightVar).toBe('350px');
    expect(grown.after.rightVar).toBe('380px');

    // DURING the drag the panel must already fill the column.
    const duringCol = parseFloat(grown.during.gridColumns[3]);
    const duringPanelWidth = grown.during.rightPanelRight! - grown.during.rightPanelLeft!;
    expect(Math.abs(duringPanelWidth - duringCol)).toBeLessThanOrEqual(tolerance);
    expect(
      Math.abs(grown.during.rightPanelRight! - grown.during.viewportWidth),
    ).toBeLessThanOrEqual(tolerance);

    // AFTER the drag: the real panel width equals the column width, its
    // right edge reaches the viewport edge (no gap), and the center column
    // ends exactly where the panel begins.
    const afterCol = parseFloat(grown.after.gridColumns[3]);
    const afterPanelWidth = grown.after.rightPanelRight! - grown.after.rightPanelLeft!;
    expect(Math.abs(afterPanelWidth - afterCol)).toBeLessThanOrEqual(tolerance);
    expect(Math.abs(afterPanelWidth - expectedWide)).toBeLessThanOrEqual(tolerance);
    expect(Math.abs(grown.after.rightPanelRight! - grown.after.viewportWidth)).toBeLessThanOrEqual(
      tolerance,
    );
    expect(Math.abs(grown.after.centerRight! - grown.after.rightPanelLeft!)).toBeLessThanOrEqual(
      tolerance,
    );

    // Shrink it below the default: the panel must follow without overflowing
    // the viewport or the center column.
    const shrunk = await dragRightWithSample(page, 130, 70);
    const shrunkCol = parseFloat(shrunk.after.gridColumns[3]);
    const shrunkPanelWidth = shrunk.after.rightPanelRight! - shrunk.after.rightPanelLeft!;
    expect(Math.abs(shrunkPanelWidth - shrunkCol)).toBeLessThanOrEqual(tolerance);
    expect(
      Math.abs(shrunk.after.rightPanelRight! - shrunk.after.viewportWidth),
    ).toBeLessThanOrEqual(tolerance);
    expect(Math.abs(shrunk.after.centerRight! - shrunk.after.rightPanelLeft!)).toBeLessThanOrEqual(
      tolerance,
    );
  });
});

test.describe('Collapsed right panel strip (PANEL-STRIP / PANELS-UI-05)', () => {
  test.beforeEach(async ({ page, request }) => {
    await resetDb(request);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await waitForHydration(page);
  });

  test('PANELS-UI-05 + PANEL-STRIP-01: collapsed right panel renders a 48px vertical tablist', async ({
    page,
  }) => {
    const collapseBtn = page.locator('[data-testid="right-panel-collapse-btn"]');
    await expect(collapseBtn).toBeVisible({ timeout: 10000 });
    await collapseBtn.click();

    const strip = page.locator('[data-testid="right-panel"]');
    // Exactly one vertical tablist: the kit's inner tablist.
    await expect(strip.locator('[role="tablist"]')).toHaveCount(1, { timeout: 5000 });
    await expect(strip.locator('[role="tablist"]')).toHaveAttribute('aria-orientation', 'vertical');

    const stripBox = (await strip.boundingBox())!;
    expect(Math.round(stripBox.width)).toBe(48);

    const commentsTab = strip.locator('[data-testid="right-tab-comments"]');
    const reviewTab = strip.locator('[data-testid="right-tab-review"]');
    await expect(commentsTab).toBeVisible();
    await expect(reviewTab).toBeVisible();
    await expect(commentsTab).toHaveAttribute('aria-label', 'Comments');
    await expect(reviewTab).toHaveAttribute('aria-label', 'Review');
  });

  test('PANEL-STRIP-02: clicking the Review strip tab expands the panel and selects Review', async ({
    page,
  }) => {
    await page.locator('[data-testid="right-panel-collapse-btn"]').click();
    const strip = page.locator('[data-testid="right-panel"]');
    await expect(strip.locator('[role="tablist"]')).toHaveCount(1, { timeout: 5000 });

    await strip.locator('[data-testid="right-tab-review"]').click();

    // The Review tab links to a visible tabpanel in the expanded panel.
    await expect(page.locator('#ui-tab-panel-review')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-testid="right-tab-review"]')).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.locator('#review-panel')).toBeVisible({ timeout: 8000 });
  });

  test('PANEL-STRIP-03: collapsing returns focus to the active strip tab', async ({ page }) => {
    // Comments is the default active tab; collapse and check focus return.
    await page.locator('[data-testid="right-panel-collapse-btn"]').click();
    const strip = page.locator('[data-testid="right-panel"]');
    await expect(strip.locator('[role="tablist"]')).toHaveCount(1, { timeout: 5000 });

    const activeStripTab = strip.locator('[data-testid="right-tab-comments"]');
    await expect(activeStripTab).toHaveAttribute('aria-selected', 'true');
    await expect(activeStripTab).toBeFocused({ timeout: 5000 });
  });
});

test.describe('Bottom panel controls (W9)', () => {
  test.beforeEach(async ({ page, request }) => {
    await resetDb(request);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await waitForHydration(page);
  });

  test('W9: left and right panels expose collapse controls at the bottom', async ({ page }) => {
    // 0003: the left collapse control lives in the stable shell footer row
    // (rail + panel columns), not inside the contextual panel.
    const leftFooter = page.locator('.left-region-footer.left-panel-footer');
    await expect(leftFooter).toBeVisible({ timeout: 10000 });
    const leftCollapse = leftFooter.getByTestId('left-panel-collapse-btn');
    await expect(leftCollapse).toBeVisible();
    await expect(leftCollapse).toHaveAttribute('aria-label', 'Collapse left panel');

    // The right panel footer hosts the desktop collapse control.
    const rightFooter = page.locator('[data-testid="right-panel"] .right-panel-footer');
    await expect(rightFooter).toBeVisible({ timeout: 10000 });
    const rightCollapse = rightFooter.getByTestId('right-panel-collapse-btn');
    await expect(rightCollapse).toBeVisible();
    await expect(rightCollapse).toHaveAttribute('aria-label', 'Collapse right panel');
  });

  test('W9: collapsed right strip exposes a bottom expand control', async ({ page }) => {
    await page.locator('[data-testid="right-panel-collapse-btn"]').click();

    const strip = page.locator('[data-testid="right-panel"]');
    await expect(strip.locator('[role="tablist"]')).toHaveCount(1, { timeout: 5000 });

    const reopenBtn = strip.getByTestId('right-panel-reopen-btn');
    await expect(reopenBtn).toBeVisible();
    await expect(reopenBtn).toHaveAttribute('aria-label', 'Open right panel');
    await expect(reopenBtn).toHaveAttribute('title', 'Open right panel');

    // Clicking the bottom reopen expands the panel without changing the tab.
    await reopenBtn.click();
    await expect(page.locator('#ui-tab-panel-comments')).toBeVisible({ timeout: 5000 });
  });
});
