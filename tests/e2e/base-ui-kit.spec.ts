import fs from 'node:fs';
import path from 'node:path';

import type { Page } from '@playwright/test';

import { expect, test } from './fixtures';
import { createGitFixture } from './helpers/git-fixture';
import { waitForHydration } from './helpers/hydration';
import { resetDb } from './helpers/reset-db';

/**
 * E2E contract for the base UI kit (src/lib/web/components/ui/).
 *
 * The kit primitives are exercised through real product consumers:
 * - TextInput / Button: the open-workspace and rename/repair forms.
 * - Dialog: the workspace delete confirmation dialog.
 * - Tabs: the left rail (vertical) and right panel (horizontal) tablists.
 * - Tokens/themes: computed styles on kit elements across themes.
 * - Target size and reduced motion: computed styles on kit buttons.
 *
 * Primitives without a Stage 1 consumer yet (Menu, Popover, Tooltip,
 * Switch, Checkbox, StatusBadge) are covered at unit and BDD contract
 * level; their E2E coverage lands with the tranche consumers (overflow
 * menu, Settings, file statuses).
 */

function initRepo(fixture: { repoPath: string; runGit(args: readonly string[]): void }): void {
  fs.writeFileSync(path.join(fixture.repoPath, 'README.md'), '# e2e');
  fixture.runGit(['add', '.']);
  fixture.runGit(['commit', '-m', 'init']);
}

async function registerWorkspace(page: Page, repoPath: string, displayName: string): Promise<void> {
  await waitForHydration(page);
  const toggleBtn = page.getByTestId('open-workspace-toggle');
  await toggleBtn.click();
  await page.waitForSelector('[data-testid="open-workspace-form"]', {
    state: 'visible',
    timeout: 10000,
  });
  await page.fill('#ws-path', repoPath);
  await page.fill('#ws-name', displayName);
  await page.click('#open-workspace-form button[type="submit"]');
  await page.waitForSelector('#open-workspace-form', { state: 'hidden', timeout: 10000 });
}

test.describe('Base UI kit — TextInput and Button (open workspace form)', () => {
  test.beforeEach(async ({ page, request }) => {
    await resetDb(request);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('labels are associated and keyboard focus shows the focus ring', async ({ page }) => {
    await waitForHydration(page);
    await page.getByTestId('open-workspace-toggle').click();
    await page.waitForSelector('[data-testid="open-workspace-form"]', {
      state: 'visible',
      timeout: 10000,
    });

    const pathInput = page.locator('#ws-path');

    // Label association: <label for> points at the input id.
    await expect(page.locator('label[for="ws-path"]')).toHaveText('Repository Path');
    await expect(page.locator('label[for="ws-name"]')).toHaveText('Display Name');

    // Keyboard focus produces a visible focus ring via --focus-ring.
    await pathInput.focus();
    await expect(pathInput).toBeFocused();
    const outline = await pathInput.evaluate((el) => {
      const style = getComputedStyle(el);
      return { color: style.outlineColor, width: style.outlineWidth };
    });
    expect(parseFloat(outline.width)).toBeGreaterThan(0);
    expect(outline.color).not.toBe('rgba(0, 0, 0, 0)');
  });

  test('md Button meets the provisional 32px minimum target size', async ({ page }) => {
    await waitForHydration(page);
    await page.getByTestId('open-workspace-toggle').click();
    await page.waitForSelector('[data-testid="open-workspace-form"]', {
      state: 'visible',
      timeout: 10000,
    });

    const submit = page.locator('#open-workspace-form button[type="submit"]');
    const box = await submit.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(32);
    expect(box!.width).toBeGreaterThanOrEqual(32);
  });

  test('kit controls follow the active theme accent token', async ({ page }) => {
    await waitForHydration(page);
    await page.getByTestId('open-workspace-toggle').click();
    await page.waitForSelector('[data-testid="open-workspace-form"]', {
      state: 'visible',
      timeout: 10000,
    });

    const submit = page.locator('#open-workspace-form button[type="submit"]');
    const bgBefore = await submit.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bgBefore).not.toBe('rgba(0, 0, 0, 0)');

    // The theme switcher lives in Settings (tranche: themes out of header).
    // Open Settings and measure a kit control that stays mounted there: the
    // Editor Switch track consumes --accent when checked.
    await page.getByTestId('rail-tab-settings').click();
    const wrapSwitch = page.getByTestId('settings-wrap-switch');
    await expect(wrapSwitch).toBeVisible({ timeout: 10000 });
    const track = page.locator(
      'label:has(input[data-testid="settings-wrap-switch"]) .ui-switch__track',
    );
    await wrapSwitch.locator('..').click();
    const trackBefore = await track.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(trackBefore).not.toBe('rgba(0, 0, 0, 0)');

    // Switch to Synthwave '84 and verify the kit control picks up the themed
    // accent token (polling covers the CSS transition).
    await page.getByTestId('theme-switcher').locator('button').last().click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'synthwave-84');
    await expect
      .poll(async () => track.evaluate((el) => getComputedStyle(el).backgroundColor))
      .not.toBe(trackBefore);
  });

  test('reduced motion zeroes kit transitions', async ({ page }) => {
    await waitForHydration(page);
    await page.getByTestId('open-workspace-toggle').click();
    await page.waitForSelector('[data-testid="open-workspace-form"]', {
      state: 'visible',
      timeout: 10000,
    });

    const submit = page.locator('#open-workspace-form button[type="submit"]');
    const normal = await submit.evaluate((el) => getComputedStyle(el).transitionDuration);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    const reduced = await submit.evaluate((el) => getComputedStyle(el).transitionDuration);
    // Transition durations resolve from --duration-* tokens; reduced motion
    // zeroes them globally in tokens.css.
    expect(reduced).toBe('0s');
    expect(normal).not.toBe('0s');
  });
});

test.describe('Base UI kit — Dialog (delete confirmation)', () => {
  test.beforeEach(async ({ page, request }) => {
    await resetDb(request);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('opens via showModal, links the title, Escape closes, focus returns', async ({ page }) => {
    const fixture = createGitFixture('diffscribe-e2e-kit-');
    const uniqueName = `E2E-Kit-${Date.now()}`;

    try {
      initRepo(fixture);
      await registerWorkspace(page, fixture.repoPath, uniqueName);

      const deleteBtn = page
        .locator(
          `#workspace-sidebar li:has-text("${uniqueName}") [data-testid="workspace-actions"] button`,
        )
        .first();
      await deleteBtn.focus();
      await deleteBtn.click();
      await page.getByRole('menuitem', { name: 'Delete' }).click();

      const dialog = page.getByRole('alertdialog', { name: /delete/i });
      await expect(dialog).toBeVisible({ timeout: 10000 });

      // Native <dialog> opened with showModal: the [open] attribute is present.
      await expect(dialog).toHaveAttribute('open', '');

      // Title link: aria-labelledby resolves to the dialog title element.
      const labelledBy = await dialog.getAttribute('aria-labelledby');
      expect(labelledBy).toBeTruthy();
      const titleEl = page.locator(`#${labelledBy}`);
      await expect(titleEl).toHaveText('Delete workspace');
      const titleId = await titleEl.getAttribute('id');
      expect(titleId).toBe('ui-dialog-title-delete-confirm');

      // Escape closes the dialog and the browser returns focus to the invoker.
      await page.keyboard.press('Escape');
      await expect(dialog).not.toBeVisible({ timeout: 10000 });
      await expect(deleteBtn).toBeFocused();
    } finally {
      fixture.cleanup();
    }
  });
});

test.describe('Base UI kit — Tabs (left rail, vertical)', () => {
  test.beforeEach(async ({ page, request }) => {
    await resetDb(request);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('roving tabindex, arrow navigation, Home/End, and aria-selected', async ({ page }) => {
    const fixture = createGitFixture('diffscribe-e2e-kit-');

    try {
      initRepo(fixture);
      await registerWorkspace(page, fixture.repoPath, `E2E-KitTabs-${Date.now()}`);

      const rail = page.getByTestId('rail-tabs');
      await expect(rail).toBeVisible({ timeout: 10000 });

      const tab = (key: string) => page.getByTestId(`rail-tab-${key}`);

      // Roving tabindex: only the active tab is in the tab order.
      await expect(tab('workspaces')).toHaveAttribute('tabindex', '0');
      await expect(tab('project')).toHaveAttribute('tabindex', '-1');
      await expect(tab('git')).toHaveAttribute('tabindex', '-1');

      // aria-controls links each tab to its panel id; aria-selected reflects state.
      await expect(tab('project')).toHaveAttribute('aria-controls', 'ui-tab-panel-project');
      await expect(tab('project')).toHaveAttribute('aria-selected', 'false');
      await expect(tab('workspaces')).toHaveAttribute('aria-selected', 'true');

      // ArrowDown moves focus and activates the next tab.
      await tab('workspaces').focus();
      await page.keyboard.press('ArrowDown');
      await expect(tab('project')).toBeFocused();
      await expect(tab('project')).toHaveAttribute('aria-selected', 'true');

      // End moves to the last tab (Settings), Home to the first.
      await page.keyboard.press('End');
      await expect(tab('settings')).toBeFocused();
      await expect(tab('settings')).toHaveAttribute('aria-selected', 'true');
      await page.keyboard.press('Home');
      await expect(tab('workspaces')).toBeFocused();

      // ArrowUp moves back from a focused tab.
      await tab('settings').focus();
      await page.keyboard.press('ArrowUp');
      await expect(tab('git')).toBeFocused();
      await page.keyboard.press('ArrowUp');
      await expect(tab('project')).toBeFocused();
    } finally {
      fixture.cleanup();
    }
  });
});

test.describe('Base UI kit — Tabs (right panel, horizontal)', () => {
  test.beforeEach(async ({ page, request }) => {
    await resetDb(request);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('ArrowLeft/ArrowRight navigate between Comments and Review', async ({ page }) => {
    const fixture = createGitFixture('diffscribe-e2e-kit-');

    try {
      initRepo(fixture);
      await registerWorkspace(page, fixture.repoPath, `E2E-KitR-${Date.now()}`);

      const commentsTab = page.getByTestId('right-tab-comments');
      const reviewTab = page.getByTestId('right-tab-review');
      await expect(commentsTab).toBeVisible({ timeout: 10000 });

      // Horizontal tablist: arrows are ArrowRight/ArrowLeft.
      await commentsTab.focus();
      await page.keyboard.press('ArrowRight');
      await expect(reviewTab).toBeFocused();
      await expect(reviewTab).toHaveAttribute('aria-selected', 'true');

      await page.keyboard.press('ArrowLeft');
      await expect(commentsTab).toBeFocused();
      await expect(commentsTab).toHaveAttribute('aria-selected', 'true');
    } finally {
      fixture.cleanup();
    }
  });
});
