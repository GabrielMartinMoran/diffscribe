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

  test('panel exposes List and Tree toggles with pressed state', async ({ page }) => {
    await openPanelWithNestedFiles(page);

    const listToggle = page.getByTestId('file-list-view-list');
    const treeToggle = page.getByTestId('file-list-view-tree');
    await expect(listToggle).toBeVisible();
    await expect(listToggle).toHaveAttribute('aria-pressed', 'true');
    await expect(treeToggle).toHaveAttribute('aria-pressed', 'false');

    await treeToggle.click();
    await expect(listToggle).toHaveAttribute('aria-pressed', 'false');
    await expect(treeToggle).toHaveAttribute('aria-pressed', 'true');
  });

  test('tree view groups files by directory with expandable directories', async ({ page }) => {
    await openPanelWithNestedFiles(page);
    await page.getByTestId('file-list-view-tree').click();

    const tree = page.getByTestId('file-list-tree');
    await expect(tree).toBeVisible();

    // Directories start collapsed; the src node exposes an expand toggle.
    const srcToggle = page.getByTestId('file-tree-toggle-src');
    await expect(srcToggle).toBeVisible();
    await expect(srcToggle).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByTestId('file-tree-node-src/app.ts')).toHaveCount(0);

    // Expanding reveals the files and nested directories.
    await srcToggle.click();
    await expect(srcToggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByTestId('file-tree-node-src/app.ts')).toBeVisible();
    await expect(page.getByTestId('file-tree-node-src/components')).toBeVisible();

    // Collapsing hides them again.
    await srcToggle.click();
    await expect(srcToggle).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByTestId('file-tree-node-src/app.ts')).toHaveCount(0);
  });

  test('chosen view persists across reloads', async ({ page }) => {
    await openPanelWithNestedFiles(page);
    await page.getByTestId('file-list-view-tree').click();
    await expect(page.getByTestId('file-list-tree')).toBeVisible();

    const stored = await page.evaluate(() => localStorage.getItem('diffscribe-file-list-view'));
    expect(stored).toBe('tree');

    await page.reload();
    await page.waitForLoadState('networkidle');
    // The workspace stays registered in the isolated DB; re-select the Git
    // rail so the file list panel renders again.
    await page.getByTestId('rail-tab-git').click();
    const fileList = page.locator('#file-list-panel');
    await expect(fileList).toBeVisible({ timeout: 8000 });
    await expect(page.getByTestId('file-list-tree')).toBeVisible({ timeout: 8000 });
  });

  test('selecting a file inside a directory opens the diff viewer', async ({ page }) => {
    await openPanelWithNestedFiles(page);
    await page.getByTestId('file-list-view-tree').click();
    await page.getByTestId('file-tree-toggle-src').click();

    const fileRow = page.getByTestId('file-tree-node-src/app.ts');
    await expect(fileRow).toBeVisible();
    await clickAndWaitForDiff(page, fileRow);
    await expect(page.locator('.diff-viewer')).toBeVisible({ timeout: 10000 });
  });
});
