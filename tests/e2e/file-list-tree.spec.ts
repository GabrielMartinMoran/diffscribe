import fs from 'node:fs';
import path from 'node:path';

import type { Locator, Page } from '@playwright/test';

import { expect, test } from './fixtures';
import { createGitFixture } from './helpers/git-fixture';
import { registerAndSelectWorkspace } from './helpers/register-workspace';
import { resetDb } from './helpers/reset-db';

/**
 * File list list/tree views (tranche): view switcher, tree grouping,
 * persistence in localStorage, and file selection from the tree.
 */

async function clickAndWaitForDiff(page: Page, fileRow: Locator): Promise<void> {
  const diffResponse = page.waitForResponse(
    (resp) => resp.url().includes('/file-diff') && resp.request().method() === 'GET',
  );
  await fileRow.click();
  await diffResponse;
}

test.describe('File list — list and tree views', () => {
  test.beforeEach(async ({ page, request }) => {
    await resetDb(request);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  async function openPanelWithNestedFiles(page: Page): Promise<void> {
    const fixture = createGitFixture('diffscribe-e2e-fltree-');
    const repoDir = fixture.repoPath;
    fs.writeFileSync(path.join(repoDir, 'README.md'), '# e2e');
    fixture.runGit(['add', '.']);
    fixture.runGit(['commit', '-m', 'init']);
    fs.mkdirSync(path.join(repoDir, 'src', 'components'), { recursive: true });
    fs.writeFileSync(path.join(repoDir, 'src', 'app.ts'), '// app\n');
    fs.writeFileSync(path.join(repoDir, 'src', 'components', 'Button.tsx'), '// button\n');
    fs.writeFileSync(path.join(repoDir, 'src', 'components', 'Input.tsx'), '// input\n');
    fixture.runGit(['add', '.']);
    fixture.runGit(['commit', '-m', 'files']);
    fs.writeFileSync(path.join(repoDir, 'src', 'app.ts'), '// app changed\n');
    fs.writeFileSync(path.join(repoDir, 'src', 'components', 'Button.tsx'), '// button changed\n');
    fixture.runGit(['add', 'src/app.ts', 'src/components/Button.tsx']);

    await registerAndSelectWorkspace(page, repoDir, `E2E-FlTree-${Date.now()}`, 'git');
    const fileList = page.locator('#file-list-panel');
    await expect(fileList).toBeVisible({ timeout: 8000 });
  }

  test('Git panel exposes no List/Tree toggles; Settings owns the view', async ({ page }) => {
    await openPanelWithNestedFiles(page);

    // 0003: the Git panel no longer renders a local view switcher.
    await expect(page.getByTestId('file-list-view-list')).toHaveCount(0);
    await expect(page.getByTestId('file-list-view-tree')).toHaveCount(0);
    // The tree view (the default) renders directly.
    await expect(page.getByTestId('file-list-tree')).toBeVisible();

    // Settings is the sole source: it exposes the segmented control with the
    // tree view pressed by default.
    await page.getByTestId('rail-tab-settings').click();
    await expect(page.getByTestId('settings-panel')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('settings-file-list-tree')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  test('tree view groups files by directory with directories expanded by default', async ({
    page,
  }) => {
    await openPanelWithNestedFiles(page);

    const tree = page.getByTestId('file-list-tree');
    await expect(tree).toBeVisible();

    // Directories are expanded by default; files are visible without a click.
    const srcToggle = page.getByTestId('file-tree-toggle-src');
    await expect(srcToggle).toBeVisible();
    await expect(srcToggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByTestId('file-tree-node-src/app.ts')).toBeVisible();
    await expect(page.getByTestId('file-tree-node-src/components')).toBeVisible();

    // Nested directories are expanded too.
    const componentsToggle = page.getByTestId('file-tree-toggle-src/components');
    await expect(componentsToggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByTestId('file-tree-node-src/components/Button.tsx')).toBeVisible();
  });

  test('directories can be collapsed and expanded manually', async ({ page }) => {
    await openPanelWithNestedFiles(page);

    const srcToggle = page.getByTestId('file-tree-toggle-src');
    await expect(srcToggle).toHaveAttribute('aria-expanded', 'true');

    // Collapse hides the files and nested directories.
    await srcToggle.click();
    await expect(srcToggle).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByTestId('file-tree-node-src/app.ts')).toHaveCount(0);

    // Expanding reveals them again.
    await srcToggle.click();
    await expect(srcToggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByTestId('file-tree-node-src/app.ts')).toBeVisible();
    await expect(page.getByTestId('file-tree-node-src/components')).toBeVisible();
  });

  test('directory expansion is not persisted across reloads', async ({ page }) => {
    await openPanelWithNestedFiles(page);

    const srcToggle = page.getByTestId('file-tree-toggle-src');
    await srcToggle.click();
    await expect(srcToggle).toHaveAttribute('aria-expanded', 'false');

    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.getByTestId('rail-tab-git').click();
    const fileList = page.locator('#file-list-panel');
    await expect(fileList).toBeVisible({ timeout: 8000 });

    // Directories are expanded by default again after the reload.
    const reloadedToggle = page.getByTestId('file-tree-toggle-src');
    await expect(reloadedToggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByTestId('file-tree-node-src/app.ts')).toBeVisible();
  });

  test('chosen view persists across reloads via Settings', async ({ page }) => {
    await openPanelWithNestedFiles(page);

    // The user switches to the list view inside Settings (the Git panel has
    // no local toggle).
    await page.getByTestId('rail-tab-settings').click();
    await expect(page.getByTestId('settings-panel')).toBeVisible({ timeout: 10000 });
    await page.getByTestId('settings-file-list-list').click();
    await expect(page.getByTestId('settings-file-list-list')).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    // The explicit choice is stored in the versioned aggregate.
    const stored = await page.evaluate(() => localStorage.getItem('diffscribe-visual-settings'));
    expect(stored).toBeTruthy();
    const parsed = JSON.parse(stored ?? '{}');
    expect(parsed.version).toBe(1);
    expect(parsed.fileListView).toBe('list');

    // The legacy key is gone after the first write (read-through migration).
    const legacy = await page.evaluate(() => localStorage.getItem('diffscribe-file-list-view'));
    expect(legacy).toBeNull();

    await page.reload();
    await page.waitForLoadState('networkidle');
    // The workspace stays registered in the isolated DB; re-select the Git
    // rail so the file list panel renders again in the list view.
    await page.getByTestId('rail-tab-git').click();
    const fileList = page.locator('#file-list-panel');
    await expect(fileList).toBeVisible({ timeout: 8000 });
    await expect(fileList.locator('.file-row').first()).toBeVisible({ timeout: 8000 });
    await expect(page.getByTestId('file-list-tree')).toHaveCount(0);
  });

  test('an explicit legacy list preference is preserved', async ({ page }) => {
    await openPanelWithNestedFiles(page);

    // Simulate the legacy stored choice before the aggregate exists.
    await page.evaluate(() => {
      localStorage.setItem('diffscribe-file-list-view', 'list');
    });

    // Re-enter the panel: read-through migration honors the legacy list.
    await page.getByTestId('rail-tab-workspaces').click();
    await page.getByTestId('rail-tab-git').click();
    await expect(page.locator('#file-list-panel')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('.file-row').first()).toBeVisible({ timeout: 8000 });
    await expect(page.getByTestId('file-list-tree')).toHaveCount(0);
  });

  test('selecting a file inside a directory opens the diff viewer', async ({ page }) => {
    await openPanelWithNestedFiles(page);

    // Directories are expanded by default, so the file is directly reachable.
    const fileRow = page.getByTestId('file-tree-node-src/app.ts');
    await expect(fileRow).toBeVisible();
    await clickAndWaitForDiff(page, fileRow);
    await expect(page.locator('.diff-viewer')).toBeVisible({ timeout: 10000 });
  });
});
