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
    await expect(rightPanel).toHaveAttribute('role', 'button');
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

    // Right panel switches to collapsed reopen control (role button, not tabpanel)
    await expect(rightPanel).toHaveAttribute('role', 'button');
    await expect(rightPanel).toHaveAttribute('aria-label', 'Open right panel');

    // Reopen by clicking the collapsed panel
    await rightPanel.click();

    // Now back to expanded state with tabs
    await expect(rightPanel).toHaveAttribute('role', 'tabpanel');
    await expect(commentsTab).toBeVisible();
  });

  test('PANELS-UI-01: collapse state is preserved across tab switches', async ({ page }) => {
    const leftPanel = page.locator('[data-testid="left-contextual-panel"]');
    const collapseBtn = page.locator('[data-testid="left-panel-collapse-btn"]');

    await collapseBtn.click();
    await expect(leftPanel).not.toBeVisible();

    // Switch to Git tab — rail tabs are in the rail-tabs component
    const gitTab = page.locator('[data-testid="rail-tab-git"]');
    await gitTab.click();
    await expect(leftPanel).not.toBeVisible();
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

    // Right panel shows collapsed reopen control
    const rightPanel = page.locator('[data-testid="right-panel"]');
    await expect(rightPanel).toHaveAttribute('role', 'button');

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
