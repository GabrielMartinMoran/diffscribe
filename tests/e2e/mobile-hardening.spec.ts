import fs from 'node:fs';
import path from 'node:path';

import { expect, test } from './fixtures';
import { createGitFixture, type GitFixture } from './helpers/git-fixture';
import { registerAndSelectWorkspace } from './helpers/register-workspace';
import { resetDb } from './helpers/reset-db';

/**
 * Mobile hardening H1-H4: real geometry, hit-testing, stacking, and scroll
 * ownership assertions at 320 / 375 / 768 / 1280. No screenshots, no fixed
 * sleeps, no retry/config changes. Every interaction is a real click; every
 * stacking claim is proven with `elementFromPoint` plus a click that would
 * fail if the backdrop intercepted it.
 */

const VIEWPORT_HEIGHT: Record<number, number> = {
  320: 568,
  375: 667,
  768: 800,
  1280: 800,
};

const isMobileWidth = (width: number) => width <= 768;

interface WorkspaceSetup {
  fixture: GitFixture;
  repoDir: string;
  name: string;
}

/**
 * Create a disposable git repo with `commitCount` commits (a base README plus
 * one commit per extra) and `fileCount` untracked files so the file list is
 * non-empty and pagination kicks in above 50 files.
 */
function setupRepo(fileCount: number, commitCount: number): WorkspaceSetup {
  const fixture = createGitFixture();
  const repoDir = fixture.repoPath;
  fs.writeFileSync(path.join(repoDir, 'README.md'), '# e2e\n');
  fixture.runGit(['add', '.']);
  fixture.runGit(['commit', '-m', 'init']);
  for (let i = 1; i < commitCount; i += 1) {
    fs.appendFileSync(path.join(repoDir, 'README.md'), `# commit ${i}\n`);
    fixture.runGit(['add', '.']);
    fixture.runGit(['commit', '-m', `commit ${i}`]);
  }
  fs.mkdirSync(path.join(repoDir, 'src'), { recursive: true });
  for (let i = 0; i < fileCount; i += 1) {
    fs.writeFileSync(path.join(repoDir, `src/file-${i}.ts`), `// file ${i}\n`);
  }
  return { fixture, repoDir, name: `Hardening-${Date.now()}` };
}

/**
 * Resize the page and reload, then wait until the responsive shell actually
 * applied the media query (`.is-mobile` class present exactly when the width
 * is mobile). This is a DOM barrier: the reload may race with SvelteKit's
 * deferred invalidation navigation, so the MQ application is asserted instead
 * of assumed.
 */
async function applyViewport(page: import('@playwright/test').Page, width: number): Promise<void> {
  await page.setViewportSize({ width, height: VIEWPORT_HEIGHT[width] });
  await page.reload();
  await expect(async () => {
    const isMobile = await page.evaluate(
      () => document.querySelector('.shell-layout')?.classList.contains('is-mobile') ?? false,
    );
    expect(isMobile).toBe(isMobileWidth(width));
  }).toPass({ timeout: 15000 });
}

async function openGitPanel(page: import('@playwright/test').Page, width: number): Promise<void> {
  await applyViewport(page, width);
  const gitPanel = page.locator('#git-context-panel');
  // Hydration is proven by the click itself: retry real clicks until the git
  // panel renders (a pre-hydration click is simply lost). The git panel only
  // exists after the rail switch, so it is a class-gated signal in both the
  // mobile drawer and the desktop left panel.
  await expect(async () => {
    await page.locator('[data-testid="rail-tab-git"]').click();
    await expect(gitPanel).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 20000 });
  if (isMobileWidth(width)) {
    await waitForDrawerSettled(page);
  }
  await expect(gitPanel).toBeVisible({ timeout: 15000 });
  // 0003: the Git panel exposes no List/Tree toggles; Settings is the sole
  // presentation source. Fresh contexts default to the tree view.
  await expect(gitPanel.getByTestId('file-list-view-list')).toHaveCount(0);
  await expect(gitPanel.getByTestId('file-list-view-tree')).toHaveCount(0);
  await expect(gitPanel.locator('[data-testid="file-list-tree"]').first()).toBeVisible({
    timeout: 15000,
  });
}

/**
 * DOM barrier: wait until the mobile drawer finished its slide-in transition
 * (translateX(-100%) → 0). Measuring/hit-testing during the transition reads
 * off-screen boxes; the barrier avoids fixed sleeps.
 */
async function waitForDrawerSettled(page: import('@playwright/test').Page): Promise<void> {
  const drawer = page.locator('[data-testid="left-contextual-panel"]');
  await expect(async () => {
    const box = await drawer.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
  }).toPass({ timeout: 5000 });
}

/**
 * DOM barrier: wait until the mobile bottom sheet finished its slide-up
 * transition (translateY(100%) → 0).
 */
async function waitForSheetSettled(
  page: import('@playwright/test').Page,
  viewportHeight: number,
): Promise<void> {
  const sheet = page.locator('[data-testid="right-panel"]');
  await expect(async () => {
    const box = await sheet.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewportHeight + 1);
  }).toPass({ timeout: 5000 });
}

function boxOf(locator: import('@playwright/test').Locator) {
  return locator.boundingBox();
}

test.describe('H1 — file list controls fit, stay inside the panel, and hit-test (FILE-LIST-PANEL-01)', () => {
  for (const width of [320, 375, 768, 1280]) {
    test(`Settings view controls fit, Tree/List work, and the view persists at ${width}px`, async ({
      page,
      request,
    }) => {
      const setup = setupRepo(8, 3);
      try {
        await resetDb(request);
        await page.goto('/');
        await registerAndSelectWorkspace(page, setup.repoDir, setup.name, 'git');
        await openGitPanel(page, width);

        // ── Git panel: no local List/Tree toggles; controls fit ──
        await expect(async () => {
          const fit = await page.evaluate(() => {
            const el = document.querySelector('#file-list-panel .controls');
            if (!el) return false;
            return el.scrollWidth <= el.clientWidth + 1;
          });
          expect(fit).toBe(true);
        }).toPass({ timeout: 5000 });

        // Select keeps its readability minimum.
        const selectMinWidth = await page.evaluate(() => {
          const el = document.querySelector('.filter-select');
          return el ? parseFloat(getComputedStyle(el).minWidth) : 0;
        });
        expect(selectMinWidth).toBeGreaterThanOrEqual(100);

        // ── Settings owns the view switcher: fit inside the panel ──
        if (isMobileWidth(width)) {
          // The open drawer overlays the rail; close it before switching.
          await page.keyboard.press('Escape');
          await expect(page.locator('[data-testid="left-contextual-panel"]')).not.toBeVisible();
        }
        await page.locator('[data-testid="rail-tab-settings"]').click();
        const settingsPanel = page.locator('[data-testid="settings-panel"]');
        await expect(settingsPanel).toBeVisible({ timeout: 10000 });
        if (isMobileWidth(width)) {
          await waitForDrawerSettled(page);
        }
        const switcher = page.locator('[data-testid="settings-file-list-view"]');
        const treeBtn = page.getByTestId('settings-file-list-tree');
        const listBtn = page.getByTestId('settings-file-list-list');
        await expect(switcher).toBeVisible({ timeout: 10000 });

        const panelBox = await boxOf(settingsPanel);
        const switcherBox = await boxOf(switcher);
        const treeBox = await boxOf(treeBtn);
        expect(panelBox).not.toBeNull();
        expect(switcherBox).not.toBeNull();
        expect(treeBox).not.toBeNull();
        expect(switcherBox!.x).toBeGreaterThanOrEqual(panelBox!.x - 1);
        expect(switcherBox!.x + switcherBox!.width).toBeLessThanOrEqual(
          panelBox!.x + panelBox!.width + 1,
        );
        expect(treeBox!.x).toBeGreaterThanOrEqual(panelBox!.x - 1);
        expect(treeBox!.x + treeBox!.width).toBeLessThanOrEqual(panelBox!.x + panelBox!.width + 1);

        // Tree and List stay side by side within the switcher.
        const listBox = await boxOf(listBtn);
        expect(listBox).not.toBeNull();
        expect(Math.abs(listBox!.y - treeBox!.y)).toBeLessThanOrEqual(4);

        // ── Hit-testable: elementFromPoint resolves to the Tree button ──
        const hitTest = await page.evaluate(() => {
          const btn = document.querySelector('[data-testid="settings-file-list-tree"]');
          if (!btn) return false;
          const rect = btn.getBoundingClientRect();
          const el = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
          return el === btn || btn.contains(el);
        });
        expect(hitTest).toBe(true);

        // ── Real click: List → Tree switch inside Settings ──
        await listBtn.click();
        await expect(listBtn).toHaveAttribute('aria-pressed', 'true');
        await treeBtn.click();
        await expect(treeBtn).toHaveAttribute('aria-pressed', 'true');
        await listBtn.click();
        await expect(listBtn).toHaveAttribute('aria-pressed', 'true');

        // ── The Git panel follows the Settings choice ──
        if (isMobileWidth(width)) {
          // The open drawer overlays the rail; close it before switching.
          await page.keyboard.press('Escape');
          await expect(page.locator('[data-testid="left-contextual-panel"]')).not.toBeVisible();
        }
        await page.locator('[data-testid="rail-tab-git"]').click();
        if (isMobileWidth(width)) {
          await waitForDrawerSettled(page);
        }
        await expect(page.locator('#git-context-panel')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('.file-row').first()).toBeVisible({ timeout: 10000 });
        await expect(page.locator('[data-testid="file-list-tree"]')).toHaveCount(0);

        // ── Persistence: view survives a reload ──
        await page.reload();
        // MQ barrier: after the reload the responsive shell must re-apply the
        // media query before clicking the rail (a pre-effect click can land
        // while the desktop layout is still active and never open the drawer).
        await expect(async () => {
          const isMobile = await page.evaluate(
            () => document.querySelector('.shell-layout')?.classList.contains('is-mobile') ?? false,
          );
          expect(isMobile).toBe(isMobileWidth(width));
        }).toPass({ timeout: 15000 });
        await expect(async () => {
          await page.locator('[data-testid="rail-tab-git"]').click();
          await expect(page.locator('#git-context-panel')).toBeVisible({ timeout: 3000 });
        }).toPass({ timeout: 20000 });
        if (isMobileWidth(width)) {
          await waitForDrawerSettled(page);
        }
        await expect(page.locator('#git-context-panel')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('.file-row').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('[data-testid="file-list-tree"]')).toHaveCount(0);
        // The Git panel still exposes no toggles after the reload.
        await expect(page.getByTestId('file-list-view-list')).toHaveCount(0);
        await expect(page.getByTestId('file-list-view-tree')).toHaveCount(0);
      } finally {
        setup.fixture.cleanup();
      }
    });
  }
});

test.describe('H2 — backdrop below sheet and drawer, dismissal preserved (RESPONSIVE-UI-01)', () => {
  test('right sheet controls are clickable above the backdrop at 375px', async ({
    page,
    request,
  }) => {
    const setup = setupRepo(4, 2);
    try {
      await resetDb(request);
      await page.goto('/');
      await registerAndSelectWorkspace(page, setup.repoDir, setup.name, 'git');
      await applyViewport(page, 375);

      const toggle = page.locator('[data-testid="mobile-right-panel-toggle"]');
      const sheet = page.locator('[data-testid="right-panel"]');
      const mobileSheet = page.locator('[data-testid="right-panel"].mobile-sheet');
      await expect(async () => {
        await toggle.click();
        // Class-gated: the desktop right panel also matches [data-testid="right-panel"]
        // in the SSR pre-hydration DOM, so assert the mobile sheet class instead.
        await expect(mobileSheet).toBeVisible({ timeout: 3000 });
      }).toPass({ timeout: 20000 });
      await waitForSheetSettled(page, 667);
      await expect(page.locator('[data-testid="mobile-backdrop"]')).toBeVisible();

      // Token-consistent z-order: backdrop < sheet.
      const z = await page.evaluate(() => {
        const backdrop = document.querySelector('[data-testid="mobile-backdrop"]');
        const sheetEl = document.querySelector('[data-testid="right-panel"]');
        return {
          backdrop: backdrop ? getComputedStyle(backdrop).zIndex : null,
          sheet: sheetEl ? getComputedStyle(sheetEl).zIndex : null,
        };
      });
      expect(z.backdrop).toBe('299');
      expect(z.sheet).toBe('300');
      expect(Number(z.backdrop)).toBeLessThan(Number(z.sheet));

      // elementFromPoint at the sheet close button resolves to the button,
      // not the backdrop.
      const closeBtn = page.locator('[data-testid="right-panel-collapse-btn"]');
      const closeBox = await boxOf(closeBtn);
      expect(closeBox).not.toBeNull();
      const hitTest = await page.evaluate(() => {
        const btn = document.querySelector('[data-testid="right-panel-collapse-btn"]');
        if (!btn) return { inButton: false, top: null };
        const rect = btn.getBoundingClientRect();
        const el = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
        return {
          inButton: el === btn || btn.contains(el),
          top: el?.getAttribute('data-testid') ?? null,
        };
      });
      expect(hitTest.inButton).toBe(true);

      // Real click on a sheet control that must NOT close the sheet: the
      // Review tab activates and the sheet stays open (backdrop intercept
      // would have closed the sheet instead).
      const reviewTab = page.locator('[data-testid="right-tab-review"]');
      await reviewTab.click();
      await expect(reviewTab).toHaveAttribute('aria-selected', 'true', { timeout: 10000 });
      await expect(sheet).toBeVisible();
    } finally {
      setup.fixture.cleanup();
    }
  });

  test('left drawer controls are clickable above the backdrop at 375px', async ({
    page,
    request,
  }) => {
    const setup = setupRepo(4, 2);
    try {
      await resetDb(request);
      await page.goto('/');
      await registerAndSelectWorkspace(page, setup.repoDir, setup.name, 'git');
      await applyViewport(page, 375);

      const drawer = page.locator('[data-testid="left-contextual-panel"]');
      const backdrop = page.locator('[data-testid="mobile-backdrop"]');
      await expect(async () => {
        await page.locator('[data-testid="rail-tab-git"]').click();
        // Class-gated on the backdrop: the aside also renders visible in the
        // desktop SSR pre-hydration DOM, but the backdrop only exists when
        // the mobile drawer is actually open.
        await expect(backdrop).toBeVisible({ timeout: 3000 });
      }).toPass({ timeout: 20000 });
      await waitForDrawerSettled(page);
      await expect(backdrop).toBeVisible();

      // Drawer must sit above the backdrop (elementFromPoint proves it).
      const collapseBtn = page.locator('[data-testid="left-panel-collapse-btn"]');
      const collapseBox = await boxOf(collapseBtn);
      expect(collapseBox).not.toBeNull();
      const hitTest = await page.evaluate(() => {
        const btn = document.querySelector('[data-testid="left-panel-collapse-btn"]');
        if (!btn) return { inButton: false, top: null };
        const rect = btn.getBoundingClientRect();
        const el = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
        return {
          inButton: el === btn || btn.contains(el),
          top: el?.getAttribute('data-testid') ?? null,
        };
      });
      expect(hitTest.inButton).toBe(true);

      // Real click on a drawer control that must NOT close the drawer.
      const targetSlot = drawer.locator('.slot-target');
      await targetSlot.click();
      await expect(targetSlot).toHaveAttribute('aria-pressed', 'true', { timeout: 10000 });
      await expect(drawer).toBeVisible();

      // Escape closes the drawer and focus returns to the trigger.
      await page.keyboard.press('Escape');
      await expect(drawer).not.toBeVisible();
      await expect(page.locator('[data-testid="rail-tab-git"]')).toBeFocused();
    } finally {
      setup.fixture.cleanup();
    }
  });

  test('backdrop click dismissal still closes the left drawer at 375px', async ({
    page,
    request,
  }) => {
    const setup = setupRepo(4, 2);
    try {
      await resetDb(request);
      await page.goto('/');
      await registerAndSelectWorkspace(page, setup.repoDir, setup.name, 'git');
      await applyViewport(page, 375);

      const drawerPanel = page.locator('[data-testid="left-contextual-panel"]');
      const backdrop = page.locator('[data-testid="mobile-backdrop"]');
      await expect(async () => {
        await page.locator('[data-testid="rail-tab-project"]').click();
        await expect(backdrop).toBeVisible({ timeout: 3000 });
      }).toPass({ timeout: 20000 });

      // Click the backdrop in the strip between the drawer (max 320px) and
      // the right toggle column (343px+ at 375px) — a pure backdrop area.
      await backdrop.click({ position: { x: 330, y: 200 } });
      await expect(drawerPanel).not.toBeVisible();
      await expect(backdrop).not.toBeVisible();
    } finally {
      setup.fixture.cleanup();
    }
  });
});

test.describe('H3 — mobile right panel toggle is a deliberate grid column (RESPONSIVE-UI-01)', () => {
  test('collapsed right toggle is at least 24x24 and spans the center height at 320px', async ({
    page,
    request,
  }) => {
    const setup = setupRepo(4, 2);
    try {
      await resetDb(request);
      await page.goto('/');
      await registerAndSelectWorkspace(page, setup.repoDir, setup.name, 'git');
      await applyViewport(page, 320);

      const toggle = page.locator('[data-testid="mobile-right-panel-toggle"]');
      await expect(toggle).toBeVisible({ timeout: 10000 });
      const toggleBox = await boxOf(toggle);
      expect(toggleBox).not.toBeNull();
      expect(toggleBox!.width).toBeGreaterThanOrEqual(24);
      expect(toggleBox!.height).toBeGreaterThanOrEqual(24);

      const centerBox = await boxOf(page.locator('[data-testid="center-content"]'));
      expect(centerBox).not.toBeNull();

      // Full center height: same grid row as the center content.
      expect(Math.abs(toggleBox!.height - centerBox!.height)).toBeLessThanOrEqual(1);
      // Deliberate right column: flush with the right viewport edge.
      expect(toggleBox!.x + toggleBox!.width).toBeGreaterThanOrEqual(320 - 1);
      // No implicit second grid row: nothing overflows the viewport height.
      const fitsViewport = await page.evaluate(
        () => document.documentElement.scrollHeight <= document.documentElement.clientHeight + 1,
      );
      expect(fitsViewport).toBe(true);
      expect(toggleBox!.y + toggleBox!.height).toBeLessThanOrEqual(568 + 1);
    } finally {
      setup.fixture.cleanup();
    }
  });

  test('toggle opens and closes the right sheet at 375px', async ({ page, request }) => {
    const setup = setupRepo(4, 2);
    try {
      await resetDb(request);
      await page.goto('/');
      await registerAndSelectWorkspace(page, setup.repoDir, setup.name, 'git');
      await applyViewport(page, 375);

      const toggle = page.locator('[data-testid="mobile-right-panel-toggle"]');
      const mobileSheet = page.locator('[data-testid="right-panel"].mobile-sheet');
      await expect(mobileSheet).not.toBeVisible();

      await expect(async () => {
        await toggle.click();
        await expect(mobileSheet).toBeVisible({ timeout: 3000 });
      }).toPass({ timeout: 20000 });
      await waitForSheetSettled(page, 667);

      // The sheet covers the bottom 50vh, so the exposed upper part of the
      // full-height toggle is the real tap target for closing.
      await toggle.click({ position: { x: 16, y: 150 } });
      await expect(mobileSheet).not.toBeVisible({ timeout: 10000 });
    } finally {
      setup.fixture.cleanup();
    }
  });
});

test.describe('H4 — Git panel is the single scroll owner (GIT-CONTEXT-PANEL-01)', () => {
  for (const width of [320, 1280]) {
    test(`Git panel scrolls as the single owner, footer and pagination reachable at ${width}px`, async ({
      page,
      request,
    }) => {
      const setup = setupRepo(55, 6);
      try {
        await resetDb(request);
        await page.goto('/');
        await registerAndSelectWorkspace(page, setup.repoDir, setup.name, 'git');
        await openGitPanel(page, width);

        // H4 exercises the flat list (pagination); the list view is owned by
        // Settings, so seed the versioned preference and re-enter Git.
        await page.evaluate(() => {
          localStorage.setItem(
            'diffscribe-visual-settings',
            JSON.stringify({ version: 1, fileListView: 'list', markdownView: 'preview' }),
          );
        });
        if (isMobileWidth(width)) {
          // The open drawer overlays the rail; close it before switching.
          await page.keyboard.press('Escape');
          await expect(page.locator('[data-testid="left-contextual-panel"]')).not.toBeVisible();
        }
        await page.locator('[data-testid="rail-tab-workspaces"]').click();
        if (isMobileWidth(width)) {
          // The workspaces drawer also overlays the rail; close it again.
          await page.keyboard.press('Escape');
          await expect(page.locator('[data-testid="left-contextual-panel"]')).not.toBeVisible();
        }
        await expect(async () => {
          await page.locator('[data-testid="rail-tab-git"]').click();
          await expect(page.locator('#git-context-panel')).toBeVisible({ timeout: 3000 });
        }).toPass({ timeout: 20000 });
        if (isMobileWidth(width)) {
          await waitForDrawerSettled(page);
        }
        await expect(page.locator('#git-context-panel')).toBeVisible({ timeout: 15000 });
        await expect(page.locator('.file-row').first()).toBeVisible({ timeout: 15000 });

        const gitPanel = page.locator('#git-context-panel');
        const viewportHeight = VIEWPORT_HEIGHT[width];

        // The Git panel is the scroll owner: it scrolls, and its content is
        // taller than its scrollport.
        const scrollMetrics = await gitPanel.evaluate((el) => {
          const style = getComputedStyle(el);
          return {
            overflowY: style.overflowY,
            scrollHeight: el.scrollHeight,
            clientHeight: el.clientHeight,
            scrollable: el.scrollHeight > el.clientHeight,
          };
        });
        expect(scrollMetrics.overflowY).toBe('auto');
        expect(scrollMetrics.scrollable).toBe(true);

        // No nested uncontrolled scroll: the file rows area cannot scroll by
        // itself, and the file list panel keeps its overflow guard.
        const fileListMetrics = await page.evaluate(() => {
          const panel = document.querySelector('#file-list-panel');
          const rows = document.querySelector('#file-list-panel .file-rows');
          if (!panel || !rows) return null;
          return {
            panelOverflow: getComputedStyle(panel).overflow,
            rowsScrollable: rows.scrollHeight > rows.clientHeight + 1,
            rowsOverflowY: getComputedStyle(rows).overflowY,
          };
        });
        expect(fileListMetrics).not.toBeNull();
        expect(fileListMetrics!.panelOverflow).toBe('hidden');
        expect(fileListMetrics!.rowsScrollable).toBe(false);

        // Commits, rows, pagination, and footer must be reachable by
        // scrolling the Git panel — scrollTop must actually move.
        const scrollable = await gitPanel.evaluate((el) => {
          el.scrollTop = el.scrollHeight;
          return el.scrollTop > 0;
        });
        expect(scrollable).toBe(true);

        // Footer visible inside the viewport after the scroll.
        await expect(async () => {
          const footerBox = await page.locator('.panel-footer').boundingBox();
          expect(footerBox).not.toBeNull();
          expect(footerBox!.y + footerBox!.height).toBeLessThanOrEqual(viewportHeight + 1);
        }).toPass({ timeout: 5000 });

        // Commits are reachable in the same scroll flow.
        await expect(page.locator('.commit-item').first()).toBeVisible({ timeout: 10000 });

        // Pagination is usable from the scroll position: a real click on the
        // Next page button changes the visible page.
        const nextPage = page.getByRole('button', { name: 'Next page' });
        await nextPage.click({ timeout: 10000 });
        await expect(page.locator('.pagination')).toContainText('Page 2 of 2', { timeout: 10000 });

        // The refresh button in the footer is a real click target.
        const refreshBtn = page.getByRole('button', { name: 'Refresh Git context' });
        await expect(refreshBtn).toBeVisible();
        await refreshBtn.click();
        await expect(gitPanel).toBeVisible({ timeout: 10000 });
      } finally {
        setup.fixture.cleanup();
      }
    });
  }
});
