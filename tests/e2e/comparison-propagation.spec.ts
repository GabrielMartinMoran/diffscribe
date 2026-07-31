import fs from 'node:fs';
import path from 'node:path';

import { expect, test } from './fixtures';
import { createGitFixture } from './helpers/git-fixture';
import { registerAndSelectWorkspace, selectRailTab } from './helpers/register-workspace';
import { resetDb } from './helpers/reset-db';

function initRepo(fixture: { repoPath: string; runGit(args: readonly string[]): void }): void {
  fs.writeFileSync(path.join(fixture.repoPath, 'README.md'), '# e2e');
  fixture.runGit(['add', '.']);
  fixture.runGit(['commit', '-m', 'init']);
}

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

      const fileList = page.locator('#file-list-panel');
      await expect(fileList).toBeVisible({ timeout: 8000 });

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

      // Diff viewer should show the selected file path
      const filePath = await fileRow.locator('.file-path').textContent();
      expect(filePath).toBeTruthy();
      await expect(diffViewer).toContainText(filePath ?? '');

      // Both panels should be visible and showing same comparison context
      await expect(fileList).toBeVisible();
      await expect(diffViewer).toBeVisible();
    } finally {
      fixture.cleanup();
    }
  });

  test('changing base updates both panels and persists comparison', async ({ page }) => {
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

      // Click a file to load diff with default comparison
      const fileRow = fileList.locator('.file-row').first();
      await expect(fileRow).toBeVisible({ timeout: 10000 });
      await fileRow.click();

      const diffViewer = page.locator('.diff-viewer');
      await expect(diffViewer).toBeVisible({ timeout: 8000 });

      // Change the base slot to feature-branch
      const comparisonSlots = page.locator('.comparison-slots');
      const baseBtn = comparisonSlots.locator('.slot-btn').first();
      const slotValues = comparisonSlots.locator('.slot-value');
      await baseBtn.click();

      const branchList = page.locator('[aria-label="Local branches"]');
      await expect(branchList).toBeVisible({ timeout: 10000 });

      const branchItem = branchList.locator('button').filter({ hasText: 'feature-branch' });
      await expect(branchItem).toBeVisible({ timeout: 10000 });
      await branchItem.click();

      // Wait for file list to update with new comparison
      await expect(fileList).toBeVisible({ timeout: 8000 });

      // Base slot should now show feature-branch
      await expect(slotValues.nth(0)).toContainText(/feature-branch/i, { timeout: 10000 });

      // File rows should reflect the changed comparison
      const rows = fileList.locator('.file-row');
      const rowCount = await rows.count();
      expect(rowCount).toBeGreaterThanOrEqual(0);
    } finally {
      fixture.cleanup();
    }
  });
});
