import fs from 'node:fs';
import path from 'node:path';

import { expect, test } from './fixtures';
import { createGitFixture } from './helpers/git-fixture';
import {
  registerAndSelectWorkspace,
  selectRailTab,
  switchFileListToListView,
} from './helpers/register-workspace';
import { resetDb } from './helpers/reset-db';

function initRepo(fixture: { repoPath: string; runGit(args: readonly string[]): void }): void {
  fs.writeFileSync(path.join(fixture.repoPath, 'README.md'), '# e2e');
  fixture.runGit(['add', '.']);
  fixture.runGit(['commit', '-m', 'init']);
}

// W4/0003: fresh contexts default to the tree view and Settings is the sole
// presentation source; these list-view contracts opt into the flat list
// through the shared helper.
const switchToListView = switchFileListToListView;

test.describe('Comparison Propagation (E2E)', () => {
  test.beforeEach(async ({ page, request }) => {
    await resetDb(request);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('file list and diff viewer share the same default comparison', async ({ page }) => {
    const fixture = createGitFixture('diffscribe-e2e-cp-');
    try {
      initRepo(fixture);
      fs.appendFileSync(path.join(fixture.repoPath, 'README.md'), '\n# changed');

      await registerAndSelectWorkspace(page, fixture.repoPath, `CP-Default-${Date.now()}`, 'git');
      await page.reload();
      await page.waitForLoadState('networkidle');
      await selectRailTab(page, 'git');
      await switchToListView(page);

      const fileList = page.locator('#file-list-panel');

      // Click a file to load diff
      const fileRow = fileList.locator('.file-row').first();
      await expect(fileRow).toBeVisible({ timeout: 10000 });
      await fileRow.click();

      const diffViewer = page.locator('.diff-viewer');
      await expect(diffViewer).toBeVisible({ timeout: 8000 });

      // Verify comparison slots show default HEAD vs working tree
      const comparisonSlots = page.locator('.comparison-slots');
      await expect(comparisonSlots).toBeVisible({ timeout: 10000 });

      const slotValues = comparisonSlots.locator('.slot-value');
      // Base should show HEAD
      await expect(slotValues.nth(0)).toContainText(/HEAD/i, { timeout: 3000 });
      // Target should show working tree
      await expect(slotValues.nth(1)).toContainText(/working tree/i, { timeout: 3000 });

      // Diff viewer should show the actual changed content for the default
      // comparison (content assertion, not selector labels).
      await expect(diffViewer).toContainText('# changed', { timeout: 5000 });
    } finally {
      fixture.cleanup();
    }
  });

  test('changing base updates file list, complete diff, and per-file diff content', async ({
    page,
  }) => {
    const fixture = createGitFixture('diffscribe-e2e-cp-');
    try {
      initRepo(fixture);
      // Create another branch with committed content
      fixture.runGit(['checkout', '-b', 'feature-branch']);
      fs.writeFileSync(path.join(fixture.repoPath, 'feature.txt'), 'feature content');
      fixture.runGit(['add', '.']);
      fixture.runGit(['commit', '-m', 'feature']);
      fixture.runGit(['checkout', 'master']);

      // Modify working tree for visibility
      fs.appendFileSync(path.join(fixture.repoPath, 'README.md'), '\n# modified');

      await registerAndSelectWorkspace(page, fixture.repoPath, `CP-Change-${Date.now()}`, 'git');
      await page.reload();
      await page.waitForLoadState('networkidle');
      await selectRailTab(page, 'git');

      const fileList = page.locator('#file-list-panel');
      await expect(fileList).toBeVisible({ timeout: 8000 });
      await switchToListView(page);

      // Default comparison (working tree vs HEAD): only README.md changed.
      const rows = fileList.locator('.file-row');
      await expect(rows.first()).toBeVisible({ timeout: 10000 });
      await expect(fileList).toContainText('README.md');
      await expect(fileList).not.toContainText('feature.txt');

      // The complete diff shows the default comparison content.
      const viewer = page.locator('[data-testid="complete-diff-viewer"]');
      await expect(viewer).toBeVisible({ timeout: 10000 });
      await expect(viewer).toContainText('# modified', { timeout: 5000 });

      // Change the base slot to feature-branch (via the branch popup)
      const comparisonSlots = page.locator('.comparison-slots');
      const baseBtn = comparisonSlots.locator('.slot-btn').first();
      const slotValues = comparisonSlots.locator('.slot-value');
      await baseBtn.click();

      const branchList = page.getByRole('listbox', { name: 'Branches' });
      await expect(branchList).toBeVisible({ timeout: 10000 });

      const branchItem = branchList.getByRole('option', { name: /feature-branch/ });
      await expect(branchItem).toBeVisible({ timeout: 10000 });
      await branchItem.click();

      // Wait for file list to update with new comparison
      await expect(fileList).toBeVisible({ timeout: 8000 });

      // Base slot should now show feature-branch
      await expect(slotValues.nth(0)).toContainText(/feature-branch/i, { timeout: 10000 });

      // The file list now includes feature.txt (deleted in the working tree
      // relative to feature-branch).
      await expect(fileList).toContainText('feature.txt', { timeout: 10000 });

      // The complete diff shows content from the new comparison: the
      // feature.txt lines are deleted relative to feature-branch.
      await expect(viewer).toContainText('feature content', { timeout: 5000 });

      // Open feature.txt: the per-file diff shows the actual content too.
      const featureRow = fileList.locator('.file-row', { hasText: 'feature.txt' });
      await expect(featureRow).toBeVisible({ timeout: 10000 });
      await featureRow.click();

      const diffViewer = page.locator('.diff-viewer');
      await expect(diffViewer).toBeVisible({ timeout: 8000 });
      await expect(diffViewer).toContainText('feature content', { timeout: 5000 });
    } finally {
      fixture.cleanup();
    }
  });
});
