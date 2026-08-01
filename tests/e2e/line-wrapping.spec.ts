import fs from 'node:fs';
import path from 'node:path';

import type { Locator, Page } from '@playwright/test';

import { expect, test } from './fixtures';
import { createGitFixture } from './helpers/git-fixture';
import { registerAndSelectWorkspace } from './helpers/register-workspace';
import { resetDb } from './helpers/reset-db';

/**
 * Line wrapping (tranche): no-wrap diff lines by default, one horizontal
 * scroll container per file, contextual per-file Wrap toggle, and the
 * Settings Editor default applied to newly opened diffs.
 */

const LONG_LINE = 'const longLine = "' + 'x'.repeat(400) + '";';

async function clickAndWaitForDiff(page: Page, fileRow: Locator): Promise<void> {
  const diffResponse = page.waitForResponse(
    (resp) => resp.url().includes('/file-diff') && resp.request().method() === 'GET',
  );
  await fileRow.click();
  await diffResponse;
}

test.describe('Line wrapping', () => {
  test.beforeEach(async ({ page, request }) => {
    await resetDb(request);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  async function openLongLineDiff(page: Page): Promise<string> {
    const fixture = createGitFixture('diffscribe-e2e-wrap-');
    const repoDir = fixture.repoPath;
    fs.writeFileSync(path.join(repoDir, 'README.md'), '# e2e');
    fixture.runGit(['add', '.']);
    fixture.runGit(['commit', '-m', 'init']);
    fs.mkdirSync(path.join(repoDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(repoDir, 'src', 'app.ts'), LONG_LINE + '\n');
    fs.writeFileSync(path.join(repoDir, 'src', 'lib.ts'), 'export const x = 1;\n');
    fixture.runGit(['add', '.']);
    fixture.runGit(['commit', '-m', 'add']);
    fs.writeFileSync(path.join(repoDir, 'src', 'app.ts'), LONG_LINE + ' // changed\n');
    fs.writeFileSync(path.join(repoDir, 'src', 'lib.ts'), 'export const x = 2;\n');
    fixture.runGit(['add', 'src/app.ts', 'src/lib.ts']);

    await registerAndSelectWorkspace(page, repoDir, `E2E-Wrap-${Date.now()}`, 'git');

    const fileList = page.locator('#file-list-panel');
    await expect(fileList).toBeVisible({ timeout: 8000 });
    const fileRow = fileList.locator('.file-row').filter({ hasText: 'src/app.ts' });
    await expect(fileRow).toBeVisible({ timeout: 10000 });
    await clickAndWaitForDiff(page, fileRow);

    const viewer = page.locator('.diff-viewer');
    await expect(viewer).toBeVisible({ timeout: 10000 });
    return repoDir;
  }

  test('diff lines do not wrap and the file owns a single horizontal scroll', async ({ page }) => {
    await openLongLineDiff(page);

    const line = page.locator('.diff-line').first();
    await expect(line).toBeVisible();
    const whiteSpace = await line.evaluate((el) => getComputedStyle(el).whiteSpace);
    expect(whiteSpace).toBe('pre');

    // One horizontal scroll container: the diff viewer itself.
    const viewer = page.locator('.diff-viewer');
    const viewerOverflowX = await viewer.evaluate((el) => getComputedStyle(el).overflowX);
    expect(viewerOverflowX).toBe('auto');
  });

  test('no per-line horizontal scrollbars exist', async ({ page }) => {
    await openLongLineDiff(page);

    const contentBoxes = page.locator('.line-content');
    await expect(contentBoxes.first()).toBeVisible();
    const count = await contentBoxes.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const overflowX = await contentBoxes.nth(i).evaluate((el) => getComputedStyle(el).overflowX);
      expect(overflowX).not.toBe('auto');
    }
  });

  test('contextual Wrap toggle overrides wrapping for the file', async ({ page }) => {
    await openLongLineDiff(page);

    const wrapToggle = page.locator('.diff-actions button', { hasText: 'Wrap' });
    await expect(wrapToggle).toBeVisible();
    await expect(wrapToggle).toHaveAttribute('aria-pressed', 'false');

    await wrapToggle.click();
    await expect(wrapToggle).toHaveAttribute('aria-pressed', 'true');

    const line = page.locator('.diff-line').first();
    const whiteSpace = await line.evaluate((el) => getComputedStyle(el).whiteSpace);
    expect(whiteSpace).toBe('pre-wrap');
  });

  test('Settings wrapping default applies to newly opened diffs', async ({ page }) => {
    const repoDir = await openLongLineDiff(page);

    // Enable the global default in Settings.
    await page.getByTestId('rail-tab-settings').click();
    await page.getByTestId('settings-wrap-switch').locator('..').click();
    await expect(page.getByTestId('settings-wrap-switch')).toBeChecked();

    // Open a second file so a fresh diff picks up the global default.
    await page.getByTestId('rail-tab-git').click();
    const fileList = page.locator('#file-list-panel');
    await expect(fileList).toBeVisible({ timeout: 8000 });
    const fileRow = fileList.locator('.file-row').filter({ hasText: 'src/lib.ts' });
    await expect(fileRow).toBeVisible({ timeout: 10000 });
    await clickAndWaitForDiff(page, fileRow);

    const line = page.locator('.diff-line').first();
    await expect(line).toBeVisible();
    const whiteSpace = await line.evaluate((el) => getComputedStyle(el).whiteSpace);
    expect(whiteSpace).toBe('pre-wrap');
    expect(repoDir).toBeTruthy();
  });
});
