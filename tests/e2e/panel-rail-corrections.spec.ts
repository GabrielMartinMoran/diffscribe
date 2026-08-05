import fs from 'node:fs';
import path from 'node:path';

import { expect, test } from './fixtures';
import { createGitFixture } from './helpers/git-fixture';
import { waitForHydration } from './helpers/hydration';
import { registerAndSelectWorkspace } from './helpers/register-workspace';
import { resetDb } from './helpers/reset-db';

/**
 * Browser-observable contract for the panel/rail UX corrections:
 * - Desktop expanded right navigation is a vertical tablist with real,
 *   reciprocal tabpanels (one tablist per state).
 * - Left rail option selection opens a collapsed panel idempotently; the
 *   collapsed left subtree is inert + aria-hidden; focus transfers.
 * - Left reopen + Help are bottom-aligned (Help below reopen); icon-only
 *   controls expose title fallbacks; the right panel fits its grid column.
 * - Mobile sheet/drawer behavior is preserved.
 */

test.describe('Panel rail corrections (0002)', () => {
  test.beforeEach(async ({ page, request }) => {
    await resetDb(request);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await waitForHydration(page);
  });

  // ────── Phase 1: expanded right navigation semantics ──────

  test('expanded right panel exposes exactly one vertical tablist with Comments and Review', async ({
    page,
  }) => {
    const rightPanel = page.getByTestId('right-panel');
    await expect(rightPanel).toBeVisible({ timeout: 10000 });

    const tablists = rightPanel.locator('[role="tablist"]');
    await expect(tablists).toHaveCount(1);
    await expect(tablists.first()).toHaveAttribute('aria-orientation', 'vertical');

    const commentsTab = rightPanel.getByTestId('right-tab-comments');
    const reviewTab = rightPanel.getByTestId('right-tab-review');
    await expect(commentsTab).toBeVisible();
    await expect(reviewTab).toBeVisible();
    await expect(commentsTab).toHaveAttribute('aria-selected', 'true');
  });

  test('ArrowUp/ArrowDown navigate the expanded vertical tablist without collapsing the panel', async ({
    page,
  }) => {
    const rightPanel = page.getByTestId('right-panel');
    const commentsTab = rightPanel.getByTestId('right-tab-comments');
    const reviewTab = rightPanel.getByTestId('right-tab-review');
    await expect(commentsTab).toBeVisible({ timeout: 10000 });

    // Vertical keyboard contract: ArrowDown moves to Review, ArrowUp back.
    await commentsTab.focus();
    await page.keyboard.press('ArrowDown');
    await expect(reviewTab).toBeFocused();
    await expect(reviewTab).toHaveAttribute('aria-selected', 'true');

    await page.keyboard.press('ArrowUp');
    await expect(commentsTab).toBeFocused();
    await expect(commentsTab).toHaveAttribute('aria-selected', 'true');

    // Activating a tab never collapses the panel: it stays expanded.
    const box = await rightPanel.boundingBox();
    expect(box!.width).toBeGreaterThan(48);
  });

  test('right panel tabs link to real tabpanels with reciprocal aria relationships', async ({
    page,
  }) => {
    const rightPanel = page.getByTestId('right-panel');
    await expect(rightPanel).toBeVisible({ timeout: 10000 });

    const commentsTab = rightPanel.getByTestId('right-tab-comments');
    const reviewTab = rightPanel.getByTestId('right-tab-review');

    // aria-controls targets exist as role=tabpanel elements with the
    // deterministic tabPanelId ids.
    await expect(commentsTab).toHaveAttribute('aria-controls', 'ui-tab-panel-comments');
    await expect(reviewTab).toHaveAttribute('aria-controls', 'ui-tab-panel-review');

    const commentsPanel = page.locator('#ui-tab-panel-comments');
    const reviewPanel = page.locator('#ui-tab-panel-review');
    await expect(commentsPanel).toHaveAttribute('role', 'tabpanel');
    await expect(reviewPanel).toHaveAttribute('role', 'tabpanel');

    // Reciprocal aria-labelledby points at the tab button id.
    await expect(commentsPanel).toHaveAttribute('aria-labelledby', 'ui-tab-comments');
    await expect(reviewPanel).toHaveAttribute('aria-labelledby', 'ui-tab-review');

    // Both tabpanels stay mounted; the inactive one is hidden.
    await expect(commentsPanel).toBeVisible();
    await expect(reviewPanel).toBeHidden();
    await expect(rightPanel.locator('[role="tabpanel"]')).toHaveCount(2);

    // Activating Review flips visibility without unmounting either panel.
    await reviewTab.click();
    await expect(reviewPanel).toBeVisible();
    await expect(commentsPanel).toBeHidden();
    await expect(reviewPanel).toHaveAttribute('aria-labelledby', 'ui-tab-review');
  });

  test('expanding via a collapsed strip tab selects the tab and returns focus to it', async ({
    page,
  }) => {
    const rightPanel = page.getByTestId('right-panel');
    await expect(rightPanel).toBeVisible({ timeout: 10000 });

    // Collapse via the footer control.
    await rightPanel.getByTestId('right-panel-collapse-btn').click();
    const strip = page.getByTestId('right-panel');
    await expect(strip.locator('[role="tablist"]')).toHaveCount(1);
    await expect(strip.locator('[role="tablist"]')).toHaveAttribute('aria-orientation', 'vertical');

    // Strip tab activation expands the panel and selects the tab.
    await strip.getByTestId('right-tab-review').click();
    await expect(strip.getByTestId('right-tab-review')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#ui-tab-panel-review')).toBeVisible({ timeout: 5000 });

    // Focus returns to the active tab button in the expanded branch.
    await expect(strip.getByTestId('right-tab-review')).toBeFocused({ timeout: 5000 });
  });

  test('expanding via the strip reopen button returns focus to the active tab', async ({
    page,
  }) => {
    const rightPanel = page.getByTestId('right-panel');
    await expect(rightPanel).toBeVisible({ timeout: 10000 });

    await rightPanel.getByTestId('right-panel-collapse-btn').click();
    const strip = page.getByTestId('right-panel');
    await expect(strip.getByTestId('right-panel-reopen-btn')).toBeVisible({ timeout: 5000 });

    // Reopen without changing the selected tab: Comments stays selected.
    await strip.getByTestId('right-panel-reopen-btn').click();
    const expanded = page.getByTestId('right-panel');
    await expect(expanded.getByTestId('right-tab-comments')).toHaveAttribute(
      'aria-selected',
      'true',
      { timeout: 5000 },
    );
    await expect(expanded.getByTestId('right-tab-comments')).toBeFocused({ timeout: 5000 });
  });

  test('right panel fits its grid column with border-box sizing', async ({ page }) => {
    const rightPanel = page.getByTestId('right-panel');
    await expect(rightPanel).toBeVisible({ timeout: 10000 });

    const metrics = await page.evaluate(() => {
      const panel = document.querySelector('[data-testid="right-panel"]');
      const shell = document.querySelector('[data-testid="shell-layout"]');
      const p = panel!.getBoundingClientRect();
      const cols = getComputedStyle(shell!)
        .gridTemplateColumns.split(' ')
        .map((s) => parseFloat(s));
      return {
        width: p.width,
        right: p.right,
        gridColumn: cols[3],
        viewportWidth: window.innerWidth,
        boxSizing: getComputedStyle(panel!).boxSizing,
      };
    });

    expect(metrics.boxSizing).toBe('border-box');
    // Panel width equals its grid column (tolerance 2 px) and its right
    // edge reaches the viewport edge (tolerance 1 px) — no overflow.
    expect(Math.abs(metrics.width - metrics.gridColumn)).toBeLessThanOrEqual(2);
    expect(Math.abs(metrics.right - metrics.viewportWidth)).toBeLessThanOrEqual(1);
  });
});

test.describe('Panel rail corrections — left rail (0002)', () => {
  test.beforeEach(async ({ page, request }) => {
    await resetDb(request);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await waitForHydration(page);
  });

  test('selecting a collapsed left rail option expands the panel and selects the option', async ({
    page,
  }) => {
    const aside = page.getByTestId('left-contextual-panel');
    await expect(aside).toBeVisible({ timeout: 10000 });

    // Collapse the left panel from its desktop footer.
    await page.getByTestId('left-panel-collapse-btn').click();
    await expect(aside).not.toBeVisible();

    // Direct rail click while collapsed: idempotent open + selection.
    await page.getByTestId('rail-tab-project').click();
    await expect(page.getByTestId('rail-tab-project')).toHaveAttribute('aria-selected', 'true');
    await expect(aside).toBeVisible({ timeout: 5000 });

    // Selecting while the panel is open only changes selection; it never
    // toggles the panel closed.
    await page.getByTestId('rail-tab-git').click();
    await expect(page.getByTestId('rail-tab-git')).toHaveAttribute('aria-selected', 'true');
    await expect(aside).toBeVisible();
  });

  test('collapsing the left panel moves focus to a visible rail control and hides the subtree', async ({
    page,
  }) => {
    const aside = page.getByTestId('left-contextual-panel');
    await expect(aside).toBeVisible({ timeout: 10000 });

    // No workspace is registered: the default active rail tab is Workspaces.
    await page.getByTestId('left-panel-collapse-btn').click();
    await expect(aside).not.toBeVisible();

    // Focus transfers to a visible rail control (the active rail tab).
    await expect(page.getByTestId('rail-tab-workspaces')).toBeFocused({ timeout: 5000 });

    // The collapsed desktop subtree is hidden from the accessibility tree
    // and inert: aria-hidden=true, inert present, and programmatic focus()
    // into the subtree is a no-op.
    await expect(aside).toHaveAttribute('aria-hidden', 'true');
    await expect(aside).toHaveAttribute('inert', '');

    const inertProof = await page.evaluate(() => {
      const asideEl = document.querySelector('[data-testid="left-contextual-panel"]');
      const btn = asideEl?.querySelector('button');
      const activeBefore = document.activeElement;
      (btn as HTMLButtonElement | null)?.focus();
      return {
        focusStuck: document.activeElement === btn,
        beforeTestId: activeBefore?.getAttribute('data-testid') ?? '',
      };
    });
    expect(inertProof.focusStuck).toBe(false);
    expect(inertProof.beforeTestId).toMatch(/rail-tab-|left-panel-reopen/);
  });

  test('reopening via the left rail reopen button returns focus to the active rail tab', async ({
    page,
  }) => {
    const aside = page.getByTestId('left-contextual-panel');
    await expect(aside).toBeVisible({ timeout: 10000 });

    await page.getByTestId('left-panel-collapse-btn').click();
    await expect(aside).not.toBeVisible();

    const reopenBtn = page.getByTestId('left-panel-reopen-btn');
    await expect(reopenBtn).toBeVisible();
    await reopenBtn.click();

    // Panel expands and focus returns to the active rail tab button.
    await expect(aside).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('rail-tab-workspaces')).toBeFocused({ timeout: 5000 });
  });

  test('programmatic rail switches do not reopen the collapsed left panel', async ({ page }) => {
    const fixture = createGitFixture('diffscribe-e2e-prc-');
    const uniqueName = `E2E-PRC-${Date.now()}`;

    try {
      // A workspace with a change lands the shell on the Git rail.
      fs.writeFileSync(path.join(fixture.repoPath, 'README.md'), '# e2e\n');
      fixture.runGit(['add', '.']);
      fixture.runGit(['commit', '-m', 'init']);
      fs.writeFileSync(path.join(fixture.repoPath, 'README.md'), '# e2e\nmore\n');
      await registerAndSelectWorkspace(page, fixture.repoPath, uniqueName, 'git');
      await expect(page.locator('[data-testid="complete-diff-viewer"]')).toBeVisible({
        timeout: 15000,
      });

      // Collapse the left panel.
      const aside = page.getByTestId('left-contextual-panel');
      await page.getByTestId('left-panel-collapse-btn').click();
      await expect(aside).not.toBeVisible();

      // Programmatic switch (Git Ctrl/Cmd-click opens Project) must NOT
      // reopen the collapsed panel — only direct rail clicks do.
      const targetBtn = page
        .locator('[data-testid="complete-diff-index"]')
        .getByRole('button', { name: /README\.md/ });
      await expect(targetBtn).toBeVisible();
      await targetBtn.click({ modifiers: ['Control'] });
      await expect(page.getByTestId('rail-tab-project')).toHaveAttribute('aria-selected', 'true', {
        timeout: 10000,
      });
      await expect(aside).not.toBeVisible();
    } finally {
      fixture.cleanup();
    }
  });

  test('left collapse control sits at the absolute bottom with Help directly above it', async ({
    page,
  }) => {
    // Expanded state: the collapse control is the bottom-most control of the
    // left region and Help sits directly above it (Help stays in the rail).
    const collapseBtn = page.getByTestId('left-panel-collapse-btn');
    await expect(collapseBtn).toBeVisible({ timeout: 10000 });
    const helpBtn = page.getByTestId('help-btn');
    await expect(helpBtn).toBeVisible();

    const footer = page.getByTestId('left-region-footer');
    await expect(footer).toBeVisible();
    const footerBox = (await footer.boundingBox())!;
    const shellBox = (await page.getByTestId('shell-layout').boundingBox())!;
    const collapseBox = (await collapseBtn.boundingBox())!;
    const helpBox = (await helpBtn.boundingBox())!;

    // The collapse control row is the bottom-most row of the shell.
    expect(shellBox.y + shellBox.height - (footerBox.y + footerBox.height)).toBeLessThanOrEqual(2);
    // Help sits directly above the footer row (rail bottom padding + gap).
    expect(helpBox.y + helpBox.height).toBeLessThanOrEqual(collapseBox.y + 16);
    expect(collapseBox.y - (helpBox.y + helpBox.height)).toBeLessThanOrEqual(16);
  });

  test('collapsed left reopen control stays at the absolute bottom with Help directly above it', async ({
    page,
  }) => {
    await page.getByTestId('left-panel-collapse-btn').click();
    const reopenBtn = page.getByTestId('left-panel-reopen-btn');
    await expect(reopenBtn).toBeVisible({ timeout: 5000 });

    const helpBtn = page.getByTestId('help-btn');
    await expect(helpBtn).toBeVisible();
    const footer = page.getByTestId('left-region-footer');
    await expect(footer).toBeVisible();

    const footerBox = (await footer.boundingBox())!;
    const shellBox = (await page.getByTestId('shell-layout').boundingBox())!;
    const reopenBox = (await reopenBtn.boundingBox())!;
    const helpBox = (await helpBtn.boundingBox())!;

    // The reopen control row stays the bottom-most row of the shell.
    expect(shellBox.y + shellBox.height - (footerBox.y + footerBox.height)).toBeLessThanOrEqual(2);
    // Help sits directly above the reopen control (rail bottom padding +
    // gap).
    expect(helpBox.y + helpBox.height).toBeLessThanOrEqual(reopenBox.y + 16);
    expect(reopenBox.y - (helpBox.y + helpBox.height)).toBeLessThanOrEqual(16);
  });

  test('expanded left control row spans the panel width; collapsed spans the rail width', async ({
    page,
  }) => {
    const aside = page.getByTestId('left-contextual-panel');
    await expect(aside).toBeVisible({ timeout: 10000 });
    const asideBox = (await aside.boundingBox())!;

    // Expanded: the collapse control row spans the rail + panel columns.
    const footer = page.getByTestId('left-region-footer');
    const collapseBtn = page.getByTestId('left-panel-collapse-btn');
    const expandedFooter = (await footer.boundingBox())!;
    const expandedBtn = (await collapseBtn.boundingBox())!;
    // Footer starts at the shell/rail left edge and ends at the panel edge.
    expect(expandedFooter.x).toBeLessThanOrEqual(2);
    expect(
      Math.abs(expandedFooter.x + expandedFooter.width - (asideBox.x + asideBox.width)),
    ).toBeLessThanOrEqual(2);
    // The control itself fills the row.
    expect(Math.abs(expandedBtn.width - expandedFooter.width)).toBeLessThanOrEqual(2);

    // Collapsed: the row spans only the rail width (48 px).
    await collapseBtn.click();
    await expect(aside).not.toBeVisible();
    const reopenBtn = page.getByTestId('left-panel-reopen-btn');
    await expect(reopenBtn).toBeVisible({ timeout: 5000 });
    const collapsedFooter = (await footer.boundingBox())!;
    expect(Math.abs(collapsedFooter.width - 48)).toBeLessThanOrEqual(2);
  });

  test('desktop right-panel tablist sits at the panel right edge', async ({ page }) => {
    const rightPanel = page.getByTestId('right-panel');
    await expect(rightPanel).toBeVisible({ timeout: 10000 });

    const tablist = rightPanel.locator('[role="tablist"]');
    await expect(tablist).toHaveCount(1);
    const panelBox = (await rightPanel.boundingBox())!;
    const tablistBox = (await tablist.boundingBox())!;
    const contentBox = (await rightPanel.locator('.right-panel-content').boundingBox())!;

    // The vertical tablist right edge aligns with the panel right edge.
    expect(
      Math.abs(tablistBox.x + tablistBox.width - (panelBox.x + panelBox.width)),
    ).toBeLessThanOrEqual(2);
    // The tablist sits to the right of the panel content.
    expect(tablistBox.x).toBeGreaterThanOrEqual(contentBox.x + contentBox.width - 2);
    // Still a single vertical tablist.
    await expect(tablist).toHaveAttribute('aria-orientation', 'vertical');
    await expect(rightPanel.getByTestId('right-tab-comments')).toBeVisible();
    await expect(rightPanel.getByTestId('right-tab-review')).toBeVisible();

    // The active indicator flips to the outer (right) edge: a 2 px accent
    // border on the right, none on the left.
    const activeTab = rightPanel.getByTestId('right-tab-comments');
    const styles = await activeTab.evaluate((el) => {
      const s = getComputedStyle(el);
      return {
        rightColor: s.borderRightColor,
        rightWidth: s.borderRightWidth,
        leftWidth: s.borderLeftWidth,
      };
    });
    expect(styles.rightWidth).toBe('2px');
    expect(styles.rightColor).not.toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
    expect(styles.leftWidth).toBe('0px');
  });

  test('icon-only rail controls expose accessible names and title fallbacks', async ({ page }) => {
    // Left rail: reopen (collapsed) + Help.
    await page.getByTestId('left-panel-collapse-btn').click();
    const reopenBtn = page.getByTestId('left-panel-reopen-btn');
    await expect(reopenBtn).toBeVisible({ timeout: 5000 });
    await expect(reopenBtn).toHaveAttribute('aria-label', 'Open left panel');
    await expect(reopenBtn).toHaveAttribute('title', 'Open left panel');
    await expect(page.getByTestId('help-btn')).toHaveAttribute('aria-label', 'Help');
    await expect(page.getByTestId('help-btn')).toHaveAttribute('title', 'Keyboard shortcuts');

    // Right strip reopen + expanded collapse button.
    await page.getByTestId('right-panel-collapse-btn').click();
    const stripReopen = page.getByTestId('right-panel-reopen-btn');
    await expect(stripReopen).toBeVisible({ timeout: 5000 });
    await expect(stripReopen).toHaveAttribute('title', 'Open right panel');
    await stripReopen.click();
    await expect(page.getByTestId('right-panel-collapse-btn')).toHaveAttribute(
      'title',
      'Collapse right panel',
    );
  });

  test('mobile sheet keeps horizontal navigation and drawer behavior', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    // Right panel sheet: opens from the toggle, keeps a horizontal header.
    const toggle = page.getByTestId('mobile-right-panel-toggle');
    await expect(toggle).toBeVisible({ timeout: 10000 });
    await toggle.click();
    const sheet = page.locator('[data-testid="right-panel"].mobile-sheet');
    await expect(sheet).toBeVisible({ timeout: 5000 });
    await expect(sheet.locator('[role="tablist"]')).toHaveAttribute(
      'aria-orientation',
      'horizontal',
    );
    // The sheet wrapper links to the active tab (no visual change).
    await expect(sheet).toHaveAttribute('id', 'ui-tab-panel-comments');
    await expect(sheet).toHaveAttribute('aria-labelledby', 'ui-tab-comments');

    // Escape closes the sheet.
    await page.keyboard.press('Escape');
    await expect(sheet).not.toBeVisible();

    // Left drawer opens from a rail tap (mobile drawer, not a desktop
    // grid expansion).
    await page.getByTestId('rail-tab-project').click();
    const drawer = page.getByTestId('left-contextual-panel');
    await expect(drawer).toHaveClass(/mobile-drawer-open/);
    await expect(drawer).toBeVisible({ timeout: 5000 });
    await page.keyboard.press('Escape');
    await expect(drawer).not.toBeVisible();
  });
});
