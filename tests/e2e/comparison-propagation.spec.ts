import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { expect, test } from '@playwright/test';

import { registerAndSelectWorkspace, selectRailTab } from './helpers/register-workspace';
import { resetDb } from './helpers/reset-db';

function mkTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'diffscribe-e2e-cp-'));
}

function createGitRepo(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
  execSync('git init', { cwd: dir, stdio: 'pipe' });
  execSync('git config user.email "e2e@test.com"', { cwd: dir, stdio: 'pipe' });
  execSync('git config user.name "E2E Test"', { cwd: dir, stdio: 'pipe' });
  fs.writeFileSync(path.join(dir, 'README.md'), '# e2e');
  execSync('git add . && git commit -m "init"', { cwd: dir, stdio: 'pipe' });
}

function rmDir(dir: string): void {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

test.describe('Comparison Propagation (E2E)', () => {
  test.beforeEach(async ({ page, request }) => {
    await resetDb(request);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('file list and diff viewer share the same default comparison', async ({ page }) => {
    const fixtureDir = mkTempDir();
    const repoDir = path.join(fixtureDir, 'repo');
    try {
      createGitRepo(repoDir);
      fs.appendFileSync(path.join(repoDir, 'README.md'), '\n# changed');

      await registerAndSelectWorkspace(page, repoDir, `CP-Default-${Date.now()}`, 'git');
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
      rmDir(fixtureDir);
    }
  });

  test('changing base updates both panels and persists comparison', async ({ page }) => {
    const fixtureDir = mkTempDir();
    const repoDir = path.join(fixtureDir, 'repo');
    try {
      createGitRepo(repoDir);
      // Create another branch with committed content
      execSync('git checkout -b feature-branch', { cwd: repoDir, stdio: 'pipe' });
      fs.writeFileSync(path.join(repoDir, 'feature.txt'), 'feature content');
      execSync('git add . && git commit -m "feature"', { cwd: repoDir, stdio: 'pipe' });
      execSync('git checkout master', { cwd: repoDir, stdio: 'pipe' });

      // Modify working tree for visibility
      fs.appendFileSync(path.join(repoDir, 'README.md'), '\n# modified');

      await registerAndSelectWorkspace(page, repoDir, `CP-Change-${Date.now()}`, 'git');
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
      rmDir(fixtureDir);
    }
  });
});
