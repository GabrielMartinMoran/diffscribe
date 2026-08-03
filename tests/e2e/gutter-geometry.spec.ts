import fs from 'node:fs';
import path from 'node:path';

import type { Page } from '@playwright/test';

import { expect, test } from './fixtures';
import { createGitFixture } from './helpers/git-fixture';
import { registerAndSelectWorkspace } from './helpers/register-workspace';
import { resetDb } from './helpers/reset-db';

/**
 * Line-number gutter geometry (approved adjustment): every `.line-number`
 * cell measures exactly 48 px OUTER width — including its `--space-2`
 * (8 px) inline padding and, in the source viewer, its 1 px divider —
 * via `box-sizing: border-box` on the cell itself. No global reset and no
 * breakpoint-specific values. Verified with real bounding boxes, tolerance
 * <= 1 px, at 320/375/768/1280 px.
 *
 * The product caps file content at 5000 lines (both readers), so rendered
 * line numbers reach at most 4 digits. The 5-digit guarantee is verified
 * with a real-font containment probe: a 5-digit string is injected into an
 * existing cell and its text bounding box must stay inside the 48 px cell.
 */

const CELL_WIDTH = 48;
const TOLERANCE = 1;
const VIEWPORTS = [320, 375, 768, 1280];
const VIEWPORT_HEIGHTS: Record<number, number> = { 320: 568, 375: 667, 768: 800, 1280: 800 };

const isMobileWidth = (width: number): boolean => width <= 768;

interface CellMeasurement {
  width: number;
  left: number;
  right: number;
  text: string;
  textLeft: number;
  textRight: number;
  textWidth: number;
}

// ── Fixture repo ────────────────────────────────────────────────────────────

/**
 * Build a repo whose diff contains 1-digit (small.ts), 4-digit (big.ts)
 * line numbers plus blank, added, deleted, and context lines.
 */
function createGutterFixtureRepo(): { repoDir: string; cleanup: () => void } {
  const fixture = createGitFixture('diffscribe-e2e-gutter-');
  const repoDir = fixture.repoPath;
  try {
    fs.writeFileSync(path.join(repoDir, 'README.md'), '# e2e\n');
    fixture.runGit(['add', '.']);
    fixture.runGit(['commit', '-m', 'init']);
    fs.mkdirSync(path.join(repoDir, 'src'), { recursive: true });

    // Small file: 1-digit numbers, a blank line, context/added/deleted mix.
    const smallOriginal = ['a1', 'a2', 'a3', '', 'a5', 'a6', 'a7', 'a8', 'a9'].join('\n') + '\n';
    fs.writeFileSync(path.join(repoDir, 'src', 'small.ts'), smallOriginal);

    // Big file: 1500 lines so the changed hunk carries 4-digit numbers.
    const bigLines: string[] = [];
    for (let i = 1; i <= 1500; i += 1) bigLines.push(`const v${i} = ${i};`);
    fs.writeFileSync(path.join(repoDir, 'src', 'big.ts'), bigLines.join('\n') + '\n');

    fixture.runGit(['add', '.']);
    fixture.runGit(['commit', '-m', 'add files']);

    // small.ts: line 2 modified (deleted + added), line 6 deleted; the rest
    // are context lines including one blank line.
    const smallModified = ['a1', 'A2', 'a3', '', 'a5', 'a7', 'a8', 'a9'].join('\n') + '\n';
    fs.writeFileSync(path.join(repoDir, 'src', 'small.ts'), smallModified);

    // big.ts: single modified line at 1400 → 4-digit old/new numbers.
    bigLines[1399] = 'const v1400 = 9999; // changed';
    fs.writeFileSync(path.join(repoDir, 'src', 'big.ts'), bigLines.join('\n') + '\n');

    fixture.runGit(['add', '.']);
  } catch (err) {
    fixture.cleanup();
    throw err;
  }
  return { repoDir, cleanup: () => fixture.cleanup() };
}

// ── Observable barriers (no fixed sleeps) ───────────────────────────────────

async function waitForFonts(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([
      document.fonts.load('11px monospace'),
      document.fonts.load('12px monospace'),
      document.fonts.load('13px monospace'),
    ]);
  });
}

/**
 * Resize + reload, then wait until the responsive shell applied the media
 * query (`.is-mobile` present exactly when the width is mobile).
 */
async function applyViewport(page: Page, width: number): Promise<void> {
  await page.setViewportSize({ width, height: VIEWPORT_HEIGHTS[width] });
  await page.reload();
  await page.waitForLoadState('networkidle');
  await expect(async () => {
    const isMobile = await page.evaluate(
      () => document.querySelector('.shell-layout')?.classList.contains('is-mobile') ?? false,
    );
    expect(isMobile).toBe(isMobileWidth(width));
  }).toPass({ timeout: 15000 });
}

/** Wait until the mobile drawer finished its slide-in transition. */
async function waitForDrawerSettled(page: Page): Promise<void> {
  const drawer = page.locator('[data-testid="left-contextual-panel"]');
  await expect(async () => {
    const box = await drawer.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
  }).toPass({ timeout: 5000 });
}

/** Close the mobile drawer via a backdrop click in the strip right of it. */
async function closeMobileDrawer(page: Page, width: number): Promise<void> {
  if (!isMobileWidth(width)) return;
  const backdrop = page.locator('[data-testid="mobile-backdrop"]');
  await expect(backdrop).toBeVisible({ timeout: 5000 });
  const box = await backdrop.boundingBox();
  expect(box).not.toBeNull();
  // The drawer caps at 320 px; click the pure-backdrop strip right of it.
  await backdrop.click({ position: { x: Math.min(box!.width - 4, 335), y: 200 } });
  await expect(backdrop).not.toBeVisible({ timeout: 5000 });
}

// ── Viewers ─────────────────────────────────────────────────────────────────

async function openDiffForFile(page: Page, fileName: string, width: number): Promise<void> {
  await page.locator('[data-testid="rail-tab-git"]').click();
  const panel = page.locator('#git-context-panel');
  await expect(panel).toBeVisible({ timeout: 15000 });
  if (isMobileWidth(width)) await waitForDrawerSettled(page);

  const fileList = page.locator('#file-list-panel');
  await expect(fileList).toBeVisible({ timeout: 8000 });
  const fileRow = fileList.locator('.file-row').filter({ hasText: fileName });
  await expect(fileRow).toBeVisible({ timeout: 10000 });

  const diffResponse = page.waitForResponse(
    (resp) => resp.url().includes('/file-diff') && resp.request().method() === 'GET',
  );
  await fileRow.click();
  await diffResponse;

  const viewer = page.locator('.diff-viewer');
  await expect(viewer).toBeVisible({ timeout: 10000 });
  await expect(viewer.locator('.diff-line').first()).toBeVisible({ timeout: 10000 });
  await waitForFonts(page);
}

async function openSourceForFile(page: Page, fileName: string, width: number): Promise<void> {
  await page.locator('[data-testid="rail-tab-project"]').click();
  const projectTree = page.locator('[data-testid="project-tree"]');
  await expect(projectTree).toBeVisible({ timeout: 10000 });
  if (isMobileWidth(width)) await waitForDrawerSettled(page);

  const srcDir = projectTree.locator('[data-testid="tree-node"]', { hasText: 'src' }).first();
  await expect(srcDir).toBeVisible({ timeout: 10000 });
  await srcDir.locator('[data-testid="expand-toggle"]').click();
  const file = projectTree.getByText(fileName, { exact: true }).first();
  await file.click();

  const viewer = page.getByTestId('source-viewer');
  await expect(viewer).toBeVisible({ timeout: 10000 });
  const content = page.getByTestId('source-content');
  await expect(content).toBeVisible({ timeout: 10000 });
  await expect(content.locator('.source-line').first()).toBeVisible({ timeout: 10000 });
  await waitForFonts(page);
}

// ── Measurements ────────────────────────────────────────────────────────────

async function measureDiffCells(page: Page): Promise<{ cells: CellMeasurement[]; rows: number }> {
  return page.evaluate(() => {
    const rows = document.querySelectorAll('.diff-viewer .diff-line').length;
    const cells = Array.from(document.querySelectorAll('.diff-viewer .line-number')).map((el) => {
      const box = el.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(el);
      const textBox = range.getBoundingClientRect();
      return {
        width: box.width,
        left: box.left,
        right: box.right,
        text: (el.textContent ?? '').trim(),
        textLeft: textBox.left,
        textRight: textBox.right,
        textWidth: textBox.width,
      };
    });
    return { rows, cells };
  });
}

function expectCellWidths(cells: Array<{ width: number }>, expected = CELL_WIDTH): void {
  expect(cells.length).toBeGreaterThan(0);
  for (const cell of cells) {
    expect(Math.abs(cell.width - expected)).toBeLessThanOrEqual(TOLERANCE);
  }
}

function expectNumbersContained(cells: CellMeasurement[]): void {
  for (const cell of cells) {
    if (cell.text === '') continue; // empty side of an added/deleted pair
    expect(cell.textLeft).toBeGreaterThanOrEqual(cell.left - TOLERANCE);
    expect(cell.textRight).toBeLessThanOrEqual(cell.right + TOLERANCE);
  }
}

async function probeFiveDigitDiffCell(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const cell = document.querySelector('.diff-viewer .line-number');
    if (!cell) return false;
    cell.textContent = '10000';
    const box = cell.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(cell);
    const textBox = range.getBoundingClientRect();
    return (
      textBox.left >= box.left - 1 && textBox.right <= box.right + 1 && textBox.width <= box.width
    );
  });
}

async function probeFiveDigitSourceCell(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const cell = document.querySelector('.source-viewer .line-number');
    if (!cell) return false;
    cell.textContent = '10000';
    const box = cell.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(cell);
    const textBox = range.getBoundingClientRect();
    return (
      textBox.left >= box.left - 1 && textBox.right <= box.right + 1 && textBox.width <= box.width
    );
  });
}

// ── Spec ────────────────────────────────────────────────────────────────────

test.describe('Gutter geometry — 48px line-number cells', () => {
  test.beforeEach(async ({ page, request }) => {
    await resetDb(request);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('unified diff gutter cells measure 48 px including padding at every viewport', async ({
    page,
  }) => {
    const { repoDir, cleanup } = createGutterFixtureRepo();
    try {
      await registerAndSelectWorkspace(page, repoDir, `GG-Diff-${Date.now()}`, 'git');

      for (const width of VIEWPORTS) {
        await applyViewport(page, width);
        await openDiffForFile(page, 'small.ts', width);

        const { rows, cells } = await measureDiffCells(page);
        // Unified keeps two cells per row (old + new), 96 px combined.
        expect(cells.length).toBe(rows * 2);
        expectCellWidths(cells);
        for (let i = 0; i < cells.length; i += 2) {
          const pair = cells[i].width + cells[i + 1].width;
          expect(Math.abs(pair - CELL_WIDTH * 2)).toBeLessThanOrEqual(TOLERANCE * 2);
        }
        expectNumbersContained(cells);
      }
    } finally {
      cleanup();
    }
  });

  test('diff line numbers with up to five digits stay inside their 48 px cells', async ({
    page,
  }) => {
    const { repoDir, cleanup } = createGutterFixtureRepo();
    try {
      await registerAndSelectWorkspace(page, repoDir, `GG-Digits-${Date.now()}`, 'git');

      for (const width of [375, 1280]) {
        // 4-digit real numbers from big.ts.
        await applyViewport(page, width);
        await openDiffForFile(page, 'big.ts', width);
        const big = await measureDiffCells(page);
        const fourDigit = big.cells.filter((c) => /^\d{4}$/.test(c.text));
        expect(fourDigit.length).toBeGreaterThan(0);
        expectCellWidths(big.cells);
        expectNumbersContained(big.cells);

        // 5-digit probe with real fonts (product caps at 5000 lines).
        expect(await probeFiveDigitDiffCell(page)).toBe(true);
      }
    } finally {
      cleanup();
    }
  });

  test('source gutter cells measure 48 px with 1 px divider, 4 px marker, 12 px content padding', async ({
    page,
  }) => {
    const { repoDir, cleanup } = createGutterFixtureRepo();
    try {
      await registerAndSelectWorkspace(page, repoDir, `GG-Src-${Date.now()}`, 'git');

      for (const width of VIEWPORTS) {
        await applyViewport(page, width);
        await openSourceForFile(page, 'small.ts', width);

        const geometry = await page.evaluate(() => {
          const cell = document.querySelector('.source-viewer .line-number') as HTMLElement | null;
          const marker = document.querySelector(
            '.source-viewer .change-marker',
          ) as HTMLElement | null;
          const content = document.querySelector(
            '.source-viewer .line-content',
          ) as HTMLElement | null;
          if (!cell || !marker || !content) return null;
          const cellStyle = getComputedStyle(cell);
          return {
            cellWidth: cell.getBoundingClientRect().width,
            dividerWidth: parseFloat(cellStyle.borderRightWidth),
            markerWidth: marker.getBoundingClientRect().width,
            contentPaddingLeft: parseFloat(getComputedStyle(content).paddingLeft),
            contentPaddingRight: parseFloat(getComputedStyle(content).paddingRight),
          };
        });
        expect(geometry).not.toBeNull();
        expect(Math.abs(geometry!.cellWidth - CELL_WIDTH)).toBeLessThanOrEqual(TOLERANCE);
        expect(geometry!.dividerWidth).toBe(1);
        expect(Math.abs(geometry!.markerWidth - 4)).toBeLessThanOrEqual(TOLERANCE);
        expect(geometry!.contentPaddingLeft).toBe(12);
        expect(geometry!.contentPaddingRight).toBe(12);

        // Real numbers (1 digit) stay inside the cell.
        const numbers = await page.evaluate(() =>
          Array.from(document.querySelectorAll('.source-viewer .line-number')).map((el) => {
            const box = el.getBoundingClientRect();
            const range = document.createRange();
            range.selectNodeContents(el);
            const textBox = range.getBoundingClientRect();
            return {
              left: box.left,
              right: box.right,
              textLeft: textBox.left,
              textRight: textBox.right,
            };
          }),
        );
        for (const n of numbers) {
          expect(n.textLeft).toBeGreaterThanOrEqual(n.left - TOLERANCE);
          expect(n.textRight).toBeLessThanOrEqual(n.right + TOLERANCE);
        }
      }
    } finally {
      cleanup();
    }
  });

  test('source line numbers with up to five digits stay inside their 48 px cells', async ({
    page,
  }) => {
    const { repoDir, cleanup } = createGutterFixtureRepo();
    try {
      await registerAndSelectWorkspace(page, repoDir, `GG-SrcDigits-${Date.now()}`, 'git');

      for (const width of [375, 1280]) {
        await applyViewport(page, width);
        await openSourceForFile(page, 'big.ts', width);

        const cells = await page.evaluate(() =>
          Array.from(document.querySelectorAll('.source-viewer .line-number')).map((el) => {
            const box = el.getBoundingClientRect();
            return { width: box.width, text: (el.textContent ?? '').trim() };
          }),
        );
        expectCellWidths(cells);
        expect(cells.some((c) => /^\d{4}$/.test(c.text))).toBe(true);
        expect(await probeFiveDigitSourceCell(page)).toBe(true);
      }
    } finally {
      cleanup();
    }
  });

  test('selected and hovered diff rows keep the 48 px gutter and stay functional', async ({
    page,
  }) => {
    const { repoDir, cleanup } = createGutterFixtureRepo();
    try {
      await registerAndSelectWorkspace(page, repoDir, `GG-Interact-${Date.now()}`, 'git');
      await openDiffForFile(page, 'small.ts', 1280);

      // Selection: click a context row, expect the selected state.
      const row = page.locator('.diff-line-context').first();
      await row.click();
      await expect(row).toHaveClass(/selected/);
      await expect(row).toHaveAttribute('aria-checked', 'true');
      const selectedWidths = await row
        .locator('.line-number')
        .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().width));
      for (const w of selectedWidths) {
        expect(Math.abs(w - CELL_WIDTH)).toBeLessThanOrEqual(TOLERANCE);
      }

      // Hover: another context row gets a visible hover background and keeps
      // the 48 px gutter.
      const hovered = page.locator('.diff-line-context').nth(2);
      await hovered.hover();
      const hoverBackground = await hovered.evaluate((el) => getComputedStyle(el).backgroundColor);
      expect(hoverBackground).not.toBe('rgba(0, 0, 0, 0)');
      const hoverWidths = await hovered
        .locator('.line-number')
        .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().width));
      for (const w of hoverWidths) {
        expect(Math.abs(w - CELL_WIDTH)).toBeLessThanOrEqual(TOLERANCE);
      }
    } finally {
      cleanup();
    }
  });

  test('wrap toggle preserves the 48 px gutter in diff and source viewers', async ({ page }) => {
    const { repoDir, cleanup } = createGutterFixtureRepo();
    try {
      await registerAndSelectWorkspace(page, repoDir, `GG-Wrap-${Date.now()}`, 'git');

      for (const width of [375, 1280]) {
        // Diff viewer.
        await applyViewport(page, width);
        await openDiffForFile(page, 'small.ts', width);
        await closeMobileDrawer(page, width);
        const before = await measureDiffCells(page);
        expectCellWidths(before.cells);

        const wrapToggle = page.locator('.diff-actions button', { hasText: 'Wrap' });
        await expect(wrapToggle).toBeVisible();
        await wrapToggle.click();
        await expect(wrapToggle).toHaveAttribute('aria-pressed', 'true');
        const after = await measureDiffCells(page);
        expectCellWidths(after.cells);

        // Source viewer.
        await openSourceForFile(page, 'small.ts', width);
        await closeMobileDrawer(page, width);
        const sourceCells = await page.evaluate(() =>
          Array.from(document.querySelectorAll('.source-viewer .line-number')).map((el) => ({
            width: el.getBoundingClientRect().width,
          })),
        );
        expectCellWidths(sourceCells);
        const sourceWrap = page.getByTestId('source-viewer').getByRole('button', { name: /wrap/i });
        await expect(sourceWrap).toBeVisible();
        await sourceWrap.click();
        await expect(sourceWrap).toHaveAttribute('aria-pressed', 'true');
        const sourceAfter = await page.evaluate(() =>
          Array.from(document.querySelectorAll('.source-viewer .line-number')).map((el) => ({
            width: el.getBoundingClientRect().width,
          })),
        );
        expectCellWidths(sourceAfter);
      }
    } finally {
      cleanup();
    }
  });
});
