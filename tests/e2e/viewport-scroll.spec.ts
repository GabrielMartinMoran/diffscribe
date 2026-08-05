import fs from 'node:fs';
import path from 'node:path';

import type { Page } from '@playwright/test';

import { expect, test } from './fixtures';
import { createGitFixture } from './helpers/git-fixture';
import {
  registerAndSelectWorkspace,
  selectRailTab,
  switchFileListToListView,
} from './helpers/register-workspace';
import { resetDb } from './helpers/reset-db';

/**
 * Viewport-bound scroll ownership (tranche): the app never scrolls at the
 * page level; each zone (rail, contextual panel, central area) owns its own
 * scroll. The Project tree scrolls inside the contextual panel and the diff
 * viewer scrolls inside the central area.
 */

test.describe('Viewport-bound scroll ownership', () => {
  test.beforeEach(async ({ page, request }) => {
    await resetDb(request);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('document does not scroll at page level', async ({ page }) => {
    await waitForShell(page);
    const doc = await page.evaluate(() => {
      const html = document.documentElement;
      return {
        htmlOverflowY: getComputedStyle(html).overflowY,
        htmlOverflowX: getComputedStyle(html).overflowX,
        bodyOverflowY: getComputedStyle(document.body).overflowY,
        scrollHeight: html.scrollHeight,
        clientHeight: html.clientHeight,
        scrollWidth: html.scrollWidth,
        clientWidth: html.clientWidth,
      };
    });
    expect(doc.htmlOverflowY).toBe('hidden');
    expect(doc.htmlOverflowX).toBe('hidden');
    expect(doc.bodyOverflowY).toBe('hidden');
    expect(doc.scrollHeight).toBeLessThanOrEqual(doc.clientHeight + 1);
    expect(doc.scrollWidth).toBeLessThanOrEqual(doc.clientWidth + 1);
  });

  test('rail fits its four tabs without clipping or scrolling', async ({ page }) => {
    await waitForShell(page);
    const rail = page.getByTestId('rail-tabs');
    await expect(rail).toBeVisible();

    const railSizes = await rail.evaluate((el) => {
      const cs = getComputedStyle(el);
      return {
        overflowY: cs.overflowY,
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
      };
    });
    // With four tabs the rail must not clip: content fits without scrolling.
    expect(railSizes.scrollHeight).toBeLessThanOrEqual(railSizes.clientHeight + 1);

    // Every tab is fully visible (no clipping of labels or icons).
    for (const key of ['workspaces', 'project', 'git', 'settings']) {
      const tab = page.getByTestId(`rail-tab-${key}`);
      await expect(tab).toBeVisible();
      const box = await tab.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.height).toBeGreaterThanOrEqual(24);
      expect(box!.width).toBeGreaterThanOrEqual(24);
    }
  });

  test('Project tree scrolls inside the contextual panel', async ({ page }) => {
    const fixture = createGitFixture('diffscribe-e2e-scroll-');
    const repoDir = fixture.repoPath;
    try {
      fs.writeFileSync(path.join(repoDir, 'README.md'), '# e2e');
      fixture.runGit(['add', '.']);
      fixture.runGit(['commit', '-m', 'init']);
      // Many files at the repo root so the tree overflows the panel without
      // needing directory expansion.
      for (let i = 0; i < 60; i++) {
        fs.writeFileSync(path.join(repoDir, `file-${i}.ts`), `// file ${i}\n`);
      }
      fixture.runGit(['add', '.']);
      fixture.runGit(['commit', '-m', 'many files']);

      await registerAndSelectWorkspace(page, repoDir, `E2E-Scroll-${Date.now()}`, 'git');
      await selectRailTab(page, 'project');

      const tree = page.locator('.project-tree');
      await expect(tree).toBeVisible({ timeout: 10000 });

      const treeScroll = await tree.evaluate((el) => {
        const cs = getComputedStyle(el);
        return {
          overflowY: cs.overflowY,
          scrollHeight: el.scrollHeight,
          clientHeight: el.clientHeight,
        };
      });
      // Many entries overflow the panel height: the tree must scroll itself.
      expect(treeScroll.scrollHeight).toBeGreaterThan(treeScroll.clientHeight);
      expect(['auto', 'scroll']).toContain(treeScroll.overflowY);

      // The page itself still does not scroll.
      const doc = await page.evaluate(() => getComputedStyle(document.documentElement).overflowY);
      expect(doc).toBe('hidden');
    } finally {
      fixture.cleanup();
    }
  });

  test('diff viewer scrolls vertically inside the central area', async ({ page }) => {
    const fixture = createGitFixture('diffscribe-e2e-scroll-');
    const repoDir = fixture.repoPath;
    try {
      fs.writeFileSync(path.join(repoDir, 'README.md'), '# e2e');
      fixture.runGit(['add', '.']);
      fixture.runGit(['commit', '-m', 'init']);
      // Untracked file with many lines: the full file appears as added lines,
      // so the diff overflows the viewer vertically.
      const manyLines = Array.from({ length: 300 }, (_, i) => `line${i}`).join('\n');
      fs.mkdirSync(path.join(repoDir, 'src'), { recursive: true });
      fs.writeFileSync(path.join(repoDir, 'src', 'app.ts'), manyLines + '\n');

      await registerAndSelectWorkspace(page, repoDir, `E2E-ScrollD-${Date.now()}`, 'git');

      const fileList = page.locator('#file-list-panel');
      await expect(fileList).toBeVisible({ timeout: 8000 });
      await switchFileListToListView(page);
      const fileRow = fileList.locator('.file-row').first();
      await expect(fileRow).toBeVisible({ timeout: 10000 });

      const diffResponse = page.waitForResponse(
        (resp) => resp.url().includes('/file-diff') && resp.request().method() === 'GET',
      );
      await fileRow.click();
      await diffResponse;

      const viewer = page.locator('.diff-viewer');
      await expect(viewer).toBeVisible({ timeout: 10000 });
      await expect(viewer.locator('.diff-line').first()).toBeVisible({ timeout: 10000 });
      const viewerScroll = await viewer.evaluate((el) => {
        const cs = getComputedStyle(el);
        return {
          overflowY: cs.overflowY,
          scrollHeight: el.scrollHeight,
          clientHeight: el.clientHeight,
        };
      });
      expect(viewerScroll.scrollHeight).toBeGreaterThan(viewerScroll.clientHeight);
      expect(['auto', 'scroll']).toContain(viewerScroll.overflowY);
    } finally {
      fixture.cleanup();
    }
  });
});

async function waitForShell(page: Page): Promise<void> {
  await expect(page.getByTestId('shell-layout')).toBeVisible({ timeout: 10000 });
  await selectRailTab(page, 'workspaces').catch(() => undefined);
}
