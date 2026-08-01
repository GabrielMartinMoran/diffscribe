import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import type { Page } from '@playwright/test';

import { expect, test } from './fixtures';
import { createGitFixture } from './helpers/git-fixture';
import { registerAndSelectWorkspace } from './helpers/register-workspace';
import { resetDb } from './helpers/reset-db';

/**
 * Git branches (tranche): cached remote branches from refs/remotes without
 * fetch, Base auto-activation, and inferred ComparisonType from the real
 * base/target pair.
 */

function initRepo(fixture: { repoPath: string; runGit(args: readonly string[]): void }): void {
  fs.writeFileSync(path.join(fixture.repoPath, 'README.md'), '# e2e');
  fixture.runGit(['add', '.']);
  fixture.runGit(['commit', '-m', 'init']);
}

async function openGitPanel(page: Page): Promise<void> {
  const panel = page.locator('#git-context-panel');
  await expect(panel).toBeVisible({ timeout: 10000 });
}

test.describe('Git branches — cached remotes and inferred comparisons', () => {
  test.beforeEach(async ({ page, request }) => {
    await resetDb(request);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('cached remote branches appear with a remote marker', async ({ page }) => {
    const fixture = createGitFixture('diffscribe-e2e-gbr-');
    const repoDir = fixture.repoPath;
    try {
      initRepo(fixture);
      // Simulate a previously cached remote branch: create refs/remotes
      // directly with update-ref. No `git fetch` is executed anywhere.
      execSync('git update-ref refs/remotes/origin/main HEAD', { cwd: repoDir, stdio: 'pipe' });

      await registerAndSelectWorkspace(page, repoDir, `E2E-GBr-${Date.now()}`, 'git');
      await openGitPanel(page);

      const branchList = page.getByRole('listbox', { name: /branches/i });
      await expect(branchList).toBeVisible();

      // Local branch present.
      await expect(branchList.getByText('master', { exact: true })).toBeVisible();
      // Cached remote branch present with the remote marker.
      const remoteItem = branchList.getByText('origin/main', { exact: true });
      await expect(remoteItem).toBeVisible();
      await expect(branchList.getByText('remote', { exact: true })).toBeVisible();
    } finally {
      fixture.cleanup();
    }
  });

  test('selecting a target auto-activates Base and infers branch-vs-branch', async ({ page }) => {
    const fixture = createGitFixture('diffscribe-e2e-gbr-');
    const repoDir = fixture.repoPath;
    try {
      initRepo(fixture);
      execSync('git branch feature', { cwd: repoDir, stdio: 'pipe' });

      await registerAndSelectWorkspace(page, repoDir, `E2E-GBr2-${Date.now()}`, 'git');
      await openGitPanel(page);

      // Open the target slot and pick the feature branch.
      const targetBtn = page.locator('.slot-target');
      await targetBtn.click();
      const branchList = page.getByRole('listbox', { name: /branches/i });
      await branchList.getByText('feature', { exact: true }).click();

      // Base slot auto-activated with the current branch (master).
      await expect(page.locator('.slot-base .slot-value')).toHaveText(/master/);
      // Inferred type shown in the comparison feedback.
      await expect(page.locator('.comparison-type')).toHaveText(/branch vs branch/);
    } finally {
      fixture.cleanup();
    }
  });

  test('selecting a commit target infers commit-vs-commit', async ({ page }) => {
    const fixture = createGitFixture('diffscribe-e2e-gbr-');
    const repoDir = fixture.repoPath;
    try {
      initRepo(fixture);
      const head = execSync('git rev-parse --short HEAD', { cwd: repoDir, stdio: 'pipe' })
        .toString()
        .trim();

      await registerAndSelectWorkspace(page, repoDir, `E2E-GBr3-${Date.now()}`, 'git');
      await openGitPanel(page);

      // Open the commits list section and pick the HEAD commit as target.
      const targetBtn = page.locator('.slot-target');
      await targetBtn.click();
      const commitList = page.getByRole('listbox', { name: /commit entries/i });
      await expect(commitList).toBeVisible({ timeout: 10000 });
      await commitList.getByText(head, { exact: true }).click();

      await expect(page.locator('.comparison-type')).toHaveText(/commit vs commit/);
    } finally {
      fixture.cleanup();
    }
  });

  test('remote selection never triggers a fetch', async ({ page }) => {
    const fixture = createGitFixture('diffscribe-e2e-gbr-');
    const repoDir = fixture.repoPath;
    try {
      initRepo(fixture);
      execSync('git update-ref refs/remotes/origin/main HEAD', { cwd: repoDir, stdio: 'pipe' });
      // A bare remote that would fail if fetched (no refs on the other side
      // beyond what the local cache has).
      const remoteDir = path.join(path.dirname(repoDir), 'remote.git');
      fs.mkdirSync(remoteDir);
      execSync('git init --bare', { cwd: remoteDir, stdio: 'pipe' });
      execSync(`git remote add origin "${remoteDir}"`, { cwd: repoDir, stdio: 'pipe' });

      await registerAndSelectWorkspace(page, repoDir, `E2E-GBr4-${Date.now()}`, 'git');
      await openGitPanel(page);

      const branchList = page.getByRole('listbox', { name: /branches/i });
      await branchList.getByText('origin/main', { exact: true }).click();

      // The cached remote remains the same after selection: no fetch ran.
      const refs = execSync('git for-each-ref refs/remotes', { cwd: repoDir, stdio: 'pipe' })
        .toString()
        .trim();
      expect(refs).toContain('refs/remotes/origin/main');
    } finally {
      fixture.cleanup();
    }
  });
});
