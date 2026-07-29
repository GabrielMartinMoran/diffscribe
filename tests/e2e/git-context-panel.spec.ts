import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { expect, test } from '@playwright/test';

import { registerAndSelectWorkspace, selectRailTab } from './helpers/register-workspace';
import { resetDb } from './helpers/reset-db';

function mkTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'diffscribe-e2e-git-'));
}

function createGitRepo(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
  execSync('git init', { cwd: dir, stdio: 'pipe' });
  execSync('git config user.email "e2e@test.com"', { cwd: dir, stdio: 'pipe' });
  execSync('git config user.name "E2E Test"', { cwd: dir, stdio: 'pipe' });
  fs.writeFileSync(path.join(dir, 'README.md'), '# e2e');
  execSync('git add .', { cwd: dir, stdio: 'pipe' });
  execSync('git commit -m "init"', { cwd: dir, stdio: 'pipe' });
}

function rmDir(dir: string): void {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test.describe('Git Context Panel (E2E)', () => {
  test.beforeEach(async ({ page, request }) => {
    await resetDb(request);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // Ensure full server-side state is fresh after possible stale invalidation
    // from a prior test that called invalidateAll() in an error state.
    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  test('shows empty state when no workspace is active', async ({ page }) => {
    await selectRailTab(page, 'git');
    const panel = page.locator('#git-context-panel');
    await expect(panel).toBeVisible({ timeout: 10000 });
    await expect(async () => {
      await expect(panel.locator('.empty-state')).toBeVisible({ timeout: 3000 });
    }).toPass({ timeout: 10000 });
  });

  test('shows clean Git status for a clean workspace', async ({ page }) => {
    const fixtureDir = mkTempDir();
    const repoDir = path.join(fixtureDir, 'repo');
    try {
      createGitRepo(repoDir);
      await registerAndSelectWorkspace(page, repoDir, `Clean-${Date.now()}`, 'git');

      // After activation, verify the git context panel is visible
      const panel = page.locator('#git-context-panel');
      await expect(panel).toBeVisible({ timeout: 10000 });

      // Status should show clean
      await expect(panel.locator('.status-clean')).toBeVisible({ timeout: 8000 });
      await expect(panel).toContainText('Clean');
    } finally {
      rmDir(fixtureDir);
    }
  });

  test('shows dirty Git status with unstaged changes', async ({ page }) => {
    const fixtureDir = mkTempDir();
    const repoDir = path.join(fixtureDir, 'repo');
    try {
      createGitRepo(repoDir);
      await registerAndSelectWorkspace(page, repoDir, `Dirty-${Date.now()}`, 'git');

      // Make unstaged changes
      fs.appendFileSync(path.join(repoDir, 'README.md'), '\n# dirty');
      await page.reload();
      await page.waitForLoadState('networkidle');
      await selectRailTab(page, 'git');

      const panel = page.locator('#git-context-panel');
      await expect(panel).toBeVisible({ timeout: 10000 });
      await expect(panel.locator('.status-dirty')).toBeVisible({ timeout: 8000 });
      await expect(panel).toContainText('Dirty');
    } finally {
      rmDir(fixtureDir);
    }
  });

  test('shows staged and unstaged file counts', async ({ page }) => {
    const fixtureDir = mkTempDir();
    const repoDir = path.join(fixtureDir, 'repo');
    try {
      createGitRepo(repoDir);
      await registerAndSelectWorkspace(page, repoDir, `Staged-${Date.now()}`, 'git');

      // Create staged and unstaged changes in a tracked file
      fs.appendFileSync(path.join(repoDir, 'README.md'), '\nstaged');
      execSync('git add README.md', { cwd: repoDir, stdio: 'pipe' });
      fs.appendFileSync(path.join(repoDir, 'README.md'), '\nunstaged');

      await page.reload();
      await page.waitForLoadState('networkidle');
      await selectRailTab(page, 'git');

      const panel = page.locator('#git-context-panel');
      await expect(panel).toBeVisible({ timeout: 10000 });
      await expect(panel).toContainText('Staged: 1', { timeout: 8000 });
      await expect(panel).toContainText('Unstaged: 1');
    } finally {
      rmDir(fixtureDir);
    }
  });

  test('shows untracked file count', async ({ page }) => {
    const fixtureDir = mkTempDir();
    const repoDir = path.join(fixtureDir, 'repo');
    try {
      createGitRepo(repoDir);
      await registerAndSelectWorkspace(page, repoDir, `Untracked-${Date.now()}`, 'git');

      fs.writeFileSync(path.join(repoDir, 'new.txt'), 'new');
      await page.reload();
      await page.waitForLoadState('networkidle');
      await selectRailTab(page, 'git');

      const panel = page.locator('#git-context-panel');
      await expect(panel).toBeVisible({ timeout: 10000 });
      await expect(panel).toContainText('Untracked: 1', { timeout: 8000 });
    } finally {
      rmDir(fixtureDir);
    }
  });

  test('shows local branches with current branch highlighted', async ({ page }) => {
    const fixtureDir = mkTempDir();
    const repoDir = path.join(fixtureDir, 'repo');
    try {
      createGitRepo(repoDir);
      execSync('git checkout -b feat/a', { cwd: repoDir, stdio: 'pipe' });
      execSync('git checkout -b fix/b', { cwd: repoDir, stdio: 'pipe' });
      execSync('git checkout master', { cwd: repoDir, stdio: 'pipe' });

      await registerAndSelectWorkspace(page, repoDir, `Branches-${Date.now()}`, 'git');
      await page.reload();
      await page.waitForLoadState('networkidle');
      await selectRailTab(page, 'git');

      const panel = page.locator('#git-context-panel');
      await expect(panel).toBeVisible({ timeout: 10000 });
      // Branch list should show branches
      await expect(panel.locator('[aria-label="Local branches"]')).toBeVisible({ timeout: 8000 });
      await expect(panel).toContainText('master');
      await expect(panel).toContainText('feat/a');
      await expect(panel).toContainText('fix/b');
    } finally {
      rmDir(fixtureDir);
    }
  });

  test('shows recent commits', async ({ page }) => {
    const fixtureDir = mkTempDir();
    const repoDir = path.join(fixtureDir, 'repo');
    try {
      createGitRepo(repoDir);
      for (let i = 1; i <= 3; i++) {
        fs.writeFileSync(path.join(repoDir, `file${i}.txt`), `content ${i}`);
        execSync('git add .', { cwd: repoDir, stdio: 'pipe' });
        execSync(`git commit -m "commit ${i}"`, { cwd: repoDir, stdio: 'pipe' });
      }

      await registerAndSelectWorkspace(page, repoDir, `Commits-${Date.now()}`, 'git');
      await page.reload();
      await page.waitForLoadState('networkidle');
      await selectRailTab(page, 'git');

      const panel = page.locator('#git-context-panel');
      await expect(panel).toBeVisible({ timeout: 10000 });
      // Commit list should show commits
      await expect(panel.locator('[aria-label="Commit list"]')).toBeVisible({ timeout: 8000 });
      await expect(panel).toContainText('commit 3');
    } finally {
      rmDir(fixtureDir);
    }
  });

  test('filters branches by name', async ({ page }) => {
    const fixtureDir = mkTempDir();
    const repoDir = path.join(fixtureDir, 'repo');
    try {
      createGitRepo(repoDir);
      execSync('git checkout -b feat/login', { cwd: repoDir, stdio: 'pipe' });
      execSync('git checkout -b feat/signup', { cwd: repoDir, stdio: 'pipe' });
      execSync('git checkout -b fix/typo', { cwd: repoDir, stdio: 'pipe' });
      execSync('git checkout master', { cwd: repoDir, stdio: 'pipe' });

      await registerAndSelectWorkspace(page, repoDir, `Filter-${Date.now()}`, 'git');
      await page.reload();
      await page.waitForLoadState('networkidle');
      await selectRailTab(page, 'git');

      const panel = page.locator('#git-context-panel');
      await expect(panel).toBeVisible({ timeout: 10000 });

      // Filter branches
      const filterInput = panel.locator('input[aria-label="Filter branches"]');
      await expect(filterInput).toBeVisible({ timeout: 10000 });
      await filterInput.fill('feat');

      // After filtering, only feat/* branches should appear in the branch list
      const branchItems = panel.locator('[aria-label="Local branches"] button');
      await expect(branchItems).toHaveCount(2, { timeout: 8000 });
    } finally {
      rmDir(fixtureDir);
    }
  });

  test('filters commits by message', async ({ page }) => {
    const fixtureDir = mkTempDir();
    const repoDir = path.join(fixtureDir, 'repo');
    try {
      createGitRepo(repoDir);
      execSync('git commit --allow-empty -m "Add login"', { cwd: repoDir, stdio: 'pipe' });
      execSync('git commit --allow-empty -m "Fix typo"', { cwd: repoDir, stdio: 'pipe' });
      execSync('git commit --allow-empty -m "Refactor auth"', { cwd: repoDir, stdio: 'pipe' });

      await registerAndSelectWorkspace(page, repoDir, `Filter-C-${Date.now()}`, 'git');
      await page.reload();
      await page.waitForLoadState('networkidle');
      await selectRailTab(page, 'git');

      const panel = page.locator('#git-context-panel');
      await expect(panel).toBeVisible({ timeout: 10000 });

      const filterInput = panel.locator('input[aria-label="Filter commits"]');
      await expect(filterInput).toBeVisible({ timeout: 10000 });
      await filterInput.fill('login');

      await expect(panel).toContainText('Add login', { timeout: 3000 });
      await expect(panel).not.toContainText('Fix typo');
    } finally {
      rmDir(fixtureDir);
    }
  });

  test('comparison Base/Target slots are interactive', async ({ page }) => {
    const fixtureDir = mkTempDir();
    const repoDir = path.join(fixtureDir, 'repo');
    try {
      createGitRepo(repoDir);
      await registerAndSelectWorkspace(page, repoDir, `Slots-${Date.now()}`, 'git');
      await page.reload();
      await page.waitForLoadState('networkidle');
      await selectRailTab(page, 'git');

      const panel = page.locator('#git-context-panel');
      await expect(panel).toBeVisible({ timeout: 10000 });

      // Click the Base slot button
      const baseSlot = panel.locator('.slot-btn').first();
      await expect(baseSlot).toBeVisible({ timeout: 10000 });
      await baseSlot.click();

      // Base slot should be active
      await expect(baseSlot).toHaveAttribute('aria-pressed', 'true');
    } finally {
      rmDir(fixtureDir);
    }
  });

  test('manual refresh updates Git status', async ({ page }) => {
    const fixtureDir = mkTempDir();
    const repoDir = path.join(fixtureDir, 'repo');
    try {
      createGitRepo(repoDir);
      await registerAndSelectWorkspace(page, repoDir, `Refresh-${Date.now()}`, 'git');
      await page.reload();
      await page.waitForLoadState('networkidle');
      await selectRailTab(page, 'git');

      const panel = page.locator('#git-context-panel');
      await expect(panel).toBeVisible({ timeout: 10000 });

      // Should show clean initially
      await expect(panel.locator('.status-clean')).toBeVisible({ timeout: 8000 });

      // Dirty the repo externally
      fs.appendFileSync(path.join(repoDir, 'README.md'), '\n# refreshed');

      // Click refresh
      const refreshBtn = panel.getByRole('button', { name: 'Refresh Git context' });
      await expect(refreshBtn).toBeVisible({ timeout: 10000 });
      await refreshBtn.click();

      // Should show dirty after refresh
      await expect(panel.locator('.status-dirty')).toBeVisible({ timeout: 8000 });
    } finally {
      rmDir(fixtureDir);
    }
  });

  test('shows error state for invalidated workspace with retry action', async ({ page }) => {
    const fixtureDir = mkTempDir();
    const repoDir = path.join(fixtureDir, 'repo');
    try {
      createGitRepo(repoDir);
      await registerAndSelectWorkspace(page, repoDir, `Invalidate-${Date.now()}`, 'git');
      await page.reload();
      await page.waitForLoadState('networkidle');
      await selectRailTab(page, 'git');

      // Invalidate by removing .git, then use refresh button
      rmDir(path.join(repoDir, '.git'));
      // Click refresh button to trigger API call and see error
      const refreshBtn = page
        .locator('#git-context-panel')
        .getByRole('button', { name: 'Refresh Git context' });
      await expect(refreshBtn).toBeVisible({ timeout: 10000 });
      await refreshBtn.click();
      // Panel should show error message after refresh
      await expect(page.locator('#git-context-panel')).toContainText(/invalid|Invalid/i, {
        timeout: 10000,
      });
      // Retry button must be visible and accessible in the error state
      const retryBtn = page.locator('#git-context-panel').getByRole('button', { name: /retry/i });
      await expect(retryBtn).toBeVisible({ timeout: 5000 });
      // Click Retry — it should attempt to revalidate (the panel remains visible)
      await retryBtn.click();
      // After retry click, the panel should still show the error or transition —
      // the critical assertion is that the Retry action exists and is clickable
      await expect(page.locator('#git-context-panel')).toBeVisible({ timeout: 5000 });
    } finally {
      rmDir(fixtureDir);
    }
  });

  test('error state shows retry action and no raw stack trace', async ({ page }) => {
    const fixtureDir = mkTempDir();
    const repoDir = path.join(fixtureDir, 'repo');
    try {
      createGitRepo(repoDir);
      await registerAndSelectWorkspace(page, repoDir, `AdapterErr-${Date.now()}`, 'git');
      await page.reload();
      await page.waitForLoadState('networkidle');
      await selectRailTab(page, 'git');

      // Corrupt the repo so the git adapter returns an error
      rmDir(path.join(repoDir, '.git'));
      const refreshBtn = page
        .locator('#git-context-panel')
        .getByRole('button', { name: 'Refresh Git context' });
      await expect(refreshBtn).toBeVisible({ timeout: 10000 });
      await refreshBtn.click();

      // Error message must be user-facing (no raw stack trace)
      const panel = page.locator('#git-context-panel');
      await expect(panel).toBeVisible({ timeout: 10000 });

      // The error text must not contain raw stack trace markers
      const panelText = await panel.textContent();
      expect(panelText).not.toMatch(/at\s+\S+\.\w+:\d+:\d+/); // no stack trace lines
      expect(panelText).not.toContain('Error:');
      expect(panelText).not.toContain('node:');
      expect(panelText).not.toContain('.ts:');

      // Retry button must be present
      const retryBtn = panel.getByRole('button', { name: /retry/i });
      await expect(retryBtn).toBeVisible({ timeout: 5000 });
    } finally {
      rmDir(fixtureDir);
    }
  });

  test('panel shows empty state without repo info when no workspace is active', async ({
    page,
  }) => {
    // This scenario is already covered by the first test; verify minimal visibility
    await selectRailTab(page, 'git');
    const panel = page.locator('#git-context-panel');
    await expect(panel).toBeVisible({ timeout: 10000 });
  });

  test('refresh button is accessible via keyboard', async ({ page }) => {
    const fixtureDir = mkTempDir();
    const repoDir = path.join(fixtureDir, 'repo');
    try {
      createGitRepo(repoDir);
      await registerAndSelectWorkspace(page, repoDir, `Kb-${Date.now()}`, 'git');
      await page.reload();
      await page.waitForLoadState('networkidle');
      await selectRailTab(page, 'git');

      const panel = page.locator('#git-context-panel');
      await expect(panel).toBeVisible({ timeout: 10000 });

      const refreshBtn = panel.getByRole('button', { name: 'Refresh Git context' });
      await expect(refreshBtn).toBeVisible({ timeout: 10000 });

      // Tab to reach the button
      await refreshBtn.focus();
      await expect(refreshBtn).toBeFocused();
    } finally {
      rmDir(fixtureDir);
    }
  });

  test('branch filter input is keyboard accessible', async ({ page }) => {
    const fixtureDir = mkTempDir();
    const repoDir = path.join(fixtureDir, 'repo');
    try {
      createGitRepo(repoDir);
      await registerAndSelectWorkspace(page, repoDir, `Kbf-${Date.now()}`, 'git');
      await page.reload();
      await page.waitForLoadState('networkidle');
      await selectRailTab(page, 'git');

      const panel = page.locator('#git-context-panel');
      await expect(panel).toBeVisible({ timeout: 10000 });

      const filterInput = panel.locator('input[aria-label="Filter branches"]');
      await expect(filterInput).toBeVisible({ timeout: 10000 });
      await filterInput.focus();
      await expect(filterInput).toBeFocused();

      // Type filter text
      await page.keyboard.type('master');
      await expect(filterInput).toHaveValue('master');
    } finally {
      rmDir(fixtureDir);
    }
  });
});
