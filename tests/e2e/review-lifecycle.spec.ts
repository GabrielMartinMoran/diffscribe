import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { expect, test } from '@playwright/test';

import {
  registerAndSelectWorkspace,
  selectRailTab,
  selectRightPanelTab,
} from './helpers/register-workspace';
import { resetDb } from './helpers/reset-db';

function mkTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'diffscribe-e2e-rv-'));
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

test.describe('Review Lifecycle (E2E)', () => {
  test.beforeEach(async ({ page, request }) => {
    await resetDb(request);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('shows New Review button when no active review', async ({ page }) => {
    const fixtureDir = mkTempDir();
    const repoDir = path.join(fixtureDir, 'repo');
    try {
      createGitRepo(repoDir);
      fs.appendFileSync(path.join(repoDir, 'README.md'), '\nchanged');

      await registerAndSelectWorkspace(page, repoDir, `RV-New-${Date.now()}`, 'git');
      await page.reload();
      await page.waitForLoadState('networkidle');
      // Right panel resets to Comments on reload; select Review to see #review-panel
      await selectRightPanelTab(page, 'review');

      const reviewPanel = page.locator('#review-panel');
      await expect(reviewPanel).toBeVisible({ timeout: 10000 });
      await expect(reviewPanel.locator('.review-placeholder')).toContainText(/no active review/i);

      const newBtn = reviewPanel.getByRole('button', { name: /new review/i });
      await expect(newBtn).toBeVisible({ timeout: 3000 });
    } finally {
      rmDir(fixtureDir);
    }
  });

  test('creates a review draft and shows it active', async ({ page }) => {
    const fixtureDir = mkTempDir();
    const repoDir = path.join(fixtureDir, 'repo');
    try {
      createGitRepo(repoDir);
      fs.writeFileSync(path.join(repoDir, 'a.ts'), 'a');
      fs.writeFileSync(path.join(repoDir, 'b.ts'), 'b');
      execSync('git add . && git commit -m "add files"', { cwd: repoDir, stdio: 'pipe' });
      fs.appendFileSync(path.join(repoDir, 'a.ts'), '\nmod');

      await registerAndSelectWorkspace(page, repoDir, `RV-Create-${Date.now()}`, 'git');
      await page.reload();
      await page.waitForLoadState('networkidle');
      // Right panel resets to Comments on reload; select Review to see #review-panel
      await selectRightPanelTab(page, 'review');

      const reviewPanel = page.locator('#review-panel');
      await expect(reviewPanel).toBeVisible({ timeout: 10000 });

      const newBtn = reviewPanel.getByRole('button', { name: /new review/i });
      await newBtn.click();
      // Wait for page reload after creation
      await page.waitForLoadState('networkidle');

      // After reload, select Review tab again and verify active review
      await selectRightPanelTab(page, 'review');
      await expect(reviewPanel.locator('.review-active')).toBeVisible({ timeout: 8000 });
      await expect(reviewPanel).toContainText(/draft/i);
    } finally {
      rmDir(fixtureDir);
    }
  });

  test('completes a review and shows completed in list after reload', async ({ page }) => {
    const fixtureDir = mkTempDir();
    const repoDir = path.join(fixtureDir, 'repo');
    try {
      createGitRepo(repoDir);
      fs.writeFileSync(path.join(repoDir, 'a.ts'), 'a');
      execSync('git add . && git commit -m "add"', { cwd: repoDir, stdio: 'pipe' });
      fs.appendFileSync(path.join(repoDir, 'a.ts'), '\nmod');

      await registerAndSelectWorkspace(page, repoDir, `RV-Complete-${Date.now()}`, 'git');
      // Verify workspace is loaded — use goto instead of reload to ensure clean state
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      // Right panel resets to Comments on goto; select Review to see #review-panel
      await selectRightPanelTab(page, 'review');

      // Create review
      await page
        .locator('#review-panel')
        .getByRole('button', { name: /new review/i })
        .click();
      await page.waitForLoadState('networkidle');
      // After creation the page reloads; select Review tab again
      await selectRightPanelTab(page, 'review');
      await page
        .locator('#review-panel .review-active')
        .waitFor({ state: 'visible', timeout: 8000 });

      // Complete it — ensure button is interactive before clicking
      const completeBtn = page
        .locator('#review-panel')
        .getByRole('button', { name: /complete review/i });
      await expect(completeBtn).toBeEnabled({ timeout: 10000 });
      const dialogAppeared = page.waitForSelector('[role="dialog"]', {
        state: 'visible',
        timeout: 10000,
      });
      await completeBtn.click();
      await dialogAppeared;
      await page
        .locator('[role="dialog"]')
        .getByRole('button', { name: /yes, complete/i })
        .click();

      // Page reloads automatically via onReviewChange. Wait for fresh page.
      await page.waitForLoadState('networkidle');
      // After completion reload, select Review tab again
      await selectRightPanelTab(page, 'review');
      // Confirm Svelte hydration by waiting for recognizable text
      await page.waitForSelector('#review-panel', { state: 'visible', timeout: 10000 });
      await expect(page.locator('#review-panel')).toContainText(
        /No active review|Untitled Review|New Review/,
        { timeout: 10000 },
      );

      // Open review list — completed review should appear
      // Use visible text locator; ensure button is interactive before clicking
      const viewBtn = page.locator('#review-panel button:has-text("View Reviews")');
      await expect(viewBtn).toBeEnabled({ timeout: 10000 });
      const listAppeared = page.waitForSelector('#review-panel .review-list-container', {
        state: 'visible',
        timeout: 10000,
      });
      await viewBtn.click();
      await listAppeared;
      await expect(page.locator('#review-panel .review-list-container')).toContainText(
        /completed/i,
        { timeout: 3000 },
      );
    } finally {
      rmDir(fixtureDir);
    }
  });

  test('shows reviewed markers in file list for active review', async ({ page }) => {
    const fixtureDir = mkTempDir();
    const repoDir = path.join(fixtureDir, 'repo');
    try {
      createGitRepo(repoDir);
      fs.writeFileSync(path.join(repoDir, 'a.ts'), 'a');
      fs.writeFileSync(path.join(repoDir, 'b.ts'), 'b');
      execSync('git add . && git commit -m "add"', { cwd: repoDir, stdio: 'pipe' });
      fs.appendFileSync(path.join(repoDir, 'a.ts'), '\nmod');

      await registerAndSelectWorkspace(page, repoDir, `RV-Marker-${Date.now()}`, 'git');
      await page.reload();
      await page.waitForLoadState('networkidle');
      await selectRailTab(page, 'git');
      // Right panel resets to Comments on reload; select Review to see #review-panel
      await selectRightPanelTab(page, 'review');

      const reviewPanel = page.locator('#review-panel');
      await expect(reviewPanel).toBeVisible({ timeout: 10000 });
      await reviewPanel.getByRole('button', { name: /new review/i }).click();
      await page.waitForLoadState('networkidle');

      // After page reload, select Review tab again and verify active review
      await selectRightPanelTab(page, 'review');
      await expect(reviewPanel.locator('.review-active')).toBeVisible({ timeout: 8000 });

      // File list should show review markers
      const fileList = page.locator('#file-list-panel');
      await expect(fileList).toBeVisible({ timeout: 8000 });

      // Every file row should have a review marker cell (.review-cell)
      const reviewCell = fileList.locator('.review-cell');
      await expect(reviewCell.first()).toBeVisible({ timeout: 10000 });

      // Markers should be visible (○ for unreviewed)
      const unreviewedMarkers = fileList.locator('.review-marker.unreviewed');
      const count = await unreviewedMarkers.count();
      expect(count).toBeGreaterThanOrEqual(1);
    } finally {
      rmDir(fixtureDir);
    }
  });

  test('no active review hides review markers in file list', async ({ page }) => {
    const fixtureDir = mkTempDir();
    const repoDir = path.join(fixtureDir, 'repo');
    try {
      createGitRepo(repoDir);
      fs.appendFileSync(path.join(repoDir, 'README.md'), '\nchanged');

      await registerAndSelectWorkspace(page, repoDir, `RV-NoMarker-${Date.now()}`, 'git');
      await page.reload();
      await page.waitForLoadState('networkidle');
      await selectRailTab(page, 'git');

      const fileList = page.locator('#file-list-panel');
      await expect(fileList).toBeVisible({ timeout: 8000 });

      // Review cells should NOT be present
      const reviewCells = fileList.locator('.review-cell');
      await expect(reviewCells).toHaveCount(0);
    } finally {
      rmDir(fixtureDir);
    }
  });

  test('shows review list with completed reviews', async ({ page }) => {
    const fixtureDir = mkTempDir();
    const repoDir = path.join(fixtureDir, 'repo');
    try {
      createGitRepo(repoDir);
      fs.appendFileSync(path.join(repoDir, 'README.md'), '\nchanged');

      await registerAndSelectWorkspace(page, repoDir, `RV-List-${Date.now()}`, 'git');
      await page.reload();
      await page.waitForLoadState('networkidle');
      // Right panel resets to Comments on reload; select Review to see #review-panel
      await selectRightPanelTab(page, 'review');

      // Create review
      await page
        .locator('#review-panel')
        .getByRole('button', { name: /new review/i })
        .click();
      await page.waitForLoadState('networkidle');
      // After creation the page reloads; select Review tab again
      await selectRightPanelTab(page, 'review');

      // Complete it — wait for active state, then ensure button interactive
      await page
        .locator('#review-panel .review-active')
        .waitFor({ state: 'visible', timeout: 8000 });
      const completeBtn2 = page
        .locator('#review-panel')
        .getByRole('button', { name: /complete review/i });
      await expect(completeBtn2).toBeEnabled({ timeout: 10000 });
      const dialogAppeared2 = page.waitForSelector('[role="dialog"]', {
        state: 'visible',
        timeout: 10000,
      });
      await completeBtn2.click();
      await dialogAppeared2;
      await page
        .locator('[role="dialog"]')
        .getByRole('button', { name: /yes, complete/i })
        .click();

      // Page reloads. Wait for it to settle and hydrate.
      await page.waitForLoadState('networkidle');
      // After completion reload, select Review tab again
      await selectRightPanelTab(page, 'review');
      await page.locator('#review-panel').waitFor({ state: 'visible', timeout: 8000 });
      await expect(page.locator('#review-panel')).toContainText(
        /No active review|Untitled|New Review/,
        { timeout: 10000 },
      );

      // View Reviews button — then check list
      await page.locator('#review-panel button:has-text("View Reviews")').click();
      await page
        .locator('#review-panel .review-list-container')
        .waitFor({ state: 'visible', timeout: 10000 });
      await expect(page.locator('#review-panel .review-list-container')).toContainText(
        /completed/i,
        { timeout: 3000 },
      );
    } finally {
      rmDir(fixtureDir);
    }
  });
});

test.describe('Review Cascade and Reset (E2E)', () => {
  test.beforeEach(async ({ page, request }) => {
    await resetDb(request);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('reset removes all reviews', async ({ page, request }) => {
    const fixtureDir = mkTempDir();
    const repoDir = path.join(fixtureDir, 'repo');
    try {
      createGitRepo(repoDir);
      fs.appendFileSync(path.join(repoDir, 'README.md'), '\nchanged');

      await registerAndSelectWorkspace(page, repoDir, `RV-Reset-${Date.now()}`, 'git');
      await page.reload();
      await page.waitForLoadState('networkidle');
      // Right panel resets to Comments on reload; select Review to see #review-panel
      await selectRightPanelTab(page, 'review');

      const reviewPanel = page.locator('#review-panel');
      await expect(reviewPanel).toBeVisible({ timeout: 10000 });
      await reviewPanel.getByRole('button', { name: /new review/i }).click();
      await page.waitForLoadState('networkidle');
      // After creation the page reloads; select Review tab again
      await selectRightPanelTab(page, 'review');

      await expect(reviewPanel.locator('.review-active')).toBeVisible({ timeout: 8000 });

      // Reset DB
      await resetDb(request);
      await page.reload();
      await page.waitForLoadState('networkidle');
      // After reset + reload, select Review tab again
      await selectRightPanelTab(page, 'review');

      // After reset, no active review should be shown
      await expect(reviewPanel.locator('.review-placeholder')).toBeVisible({ timeout: 10000 });
    } finally {
      rmDir(fixtureDir);
    }
  });
});
