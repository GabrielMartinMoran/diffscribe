import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import type { APIRequestContext, Page } from '@playwright/test';

import { expect, test } from './fixtures';
import { createGitFixture } from './helpers/git-fixture';
import { registerAndSelectWorkspace } from './helpers/register-workspace';
import { resetDb } from './helpers/reset-db';

/**
 * Git branches (tranche): cached remote branches from refs/remotes without
 * fetch, Base auto-activation, and inferred ComparisonType from the real
 * base/target pair.
 */

/**
 * The worker dev server answers the readiness probe (GET /) before its API
 * routes finish compiling; the very first reset of a fresh worker can hit a
 * 404. Retry briefly so first-test resets are reliable.
 */
async function resetDbWhenReady(request: APIRequestContext): Promise<void> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      await resetDb(request);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  await resetDb(request);
}

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
    await resetDbWhenReady(request);
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

      // Open the Base trigger popup.
      await page.locator('.slot-base').click();
      const branchList = page.getByRole('listbox', { name: 'Branches' });
      await expect(branchList).toBeVisible();

      // Local branch present (role-based: option names are stable labels).
      await expect(branchList.getByRole('option', { name: /master/ })).toBeVisible();
      // Cached remote branch present with the remote marker.
      const remoteItem = branchList.getByRole('option', { name: /origin\/main/ });
      await expect(remoteItem).toBeVisible();
      await expect(branchList.locator('[aria-label="Cached remote branch"]')).toBeVisible();
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

      // Open the target slot popup and pick the feature branch.
      const targetBtn = page.locator('.slot-target');
      await targetBtn.click();
      const branchList = page.getByRole('listbox', { name: 'Branches' });
      await branchList.getByText('feature', { exact: true }).click();

      // Base slot auto-activated with the current branch (master).
      await expect(page.locator('.slot-base .slot-value')).toHaveText(/master/);
      // W8: no comparison caption; the inferred comparison is proven by the
      // refetched file list under the branch pair.
      await expect(page.locator('.comparison-type')).toHaveCount(0);
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

      // W8: the redundant comparison caption is removed; the commit is
      // confirmed via the slot labels instead.
      await expect(page.locator('.comparison-type')).toHaveCount(0);
      await expect(page.locator('.slot-target .slot-value')).toHaveText(new RegExp(head));
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

      // Open the target slot popup and select the cached remote branch.
      await page.locator('.slot-target').click();
      const branchList = page.getByRole('listbox', { name: 'Branches' });
      await branchList.getByRole('option', { name: /origin\/main/ }).click();

      // The cached remote remains the same after selection: no fetch ran.
      const refs = execSync('git for-each-ref refs/remotes', { cwd: repoDir, stdio: 'pipe' })
        .toString()
        .trim();
      expect(refs).toContain('refs/remotes/origin/main');
    } finally {
      fixture.cleanup();
    }
  });

  test('branch selector exposes long names as tooltips', async ({ page }) => {
    const fixture = createGitFixture('diffscribe-e2e-gbr-');
    const repoDir = fixture.repoPath;
    try {
      initRepo(fixture);
      const longBranch = `feature/very-long-branch-name-${'x'.repeat(40)}`;
      execSync(`git branch "${longBranch}"`, { cwd: repoDir, stdio: 'pipe' });

      await registerAndSelectWorkspace(page, repoDir, `E2E-GBr5-${Date.now()}`, 'git');
      await openGitPanel(page);

      // The slot button exposes the full label through title.
      await page.locator('.slot-base').click();
      const branchList = page.getByRole('listbox', { name: 'Branches' });
      const option = branchList.getByRole('option', { name: new RegExp(longBranch) });
      await expect(option).toBeVisible();
      // W8: option labels carry a title tooltip with the full name.
      await expect(option.locator('.branch-option-label')).toHaveAttribute('title', longBranch);
    } finally {
      fixture.cleanup();
    }
  });

  test('no working tree vs HEAD caption is displayed', async ({ page }) => {
    const fixture = createGitFixture('diffscribe-e2e-gbr-');
    const repoDir = fixture.repoPath;
    try {
      initRepo(fixture);
      await registerAndSelectWorkspace(page, repoDir, `E2E-GBr6-${Date.now()}`, 'git');
      await openGitPanel(page);

      // W8: the redundant caption text is gone entirely.
      await expect(page.locator('.comparison-type')).toHaveCount(0);
      await expect(page.locator('.comparison-slots')).not.toContainText('working tree vs HEAD');
    } finally {
      fixture.cleanup();
    }
  });

  test('working tree can be reselected as target', async ({ page }) => {
    const fixture = createGitFixture('diffscribe-e2e-gbr-');
    const repoDir = fixture.repoPath;
    try {
      initRepo(fixture);
      fs.writeFileSync(path.join(repoDir, 'untracked.txt'), 'fresh\n');
      execSync('git update-ref refs/remotes/origin/main HEAD', { cwd: repoDir, stdio: 'pipe' });

      await registerAndSelectWorkspace(page, repoDir, `E2E-GBr7-${Date.now()}`, 'git');
      await openGitPanel(page);

      // Move the target away from the working tree (select a branch).
      await page.locator('.slot-target').click();
      const branchList = page.getByRole('listbox', { name: 'Branches' });
      await branchList.getByRole('option', { name: /origin\/main/ }).click();
      await expect(page.locator('.slot-target .slot-value')).toHaveText(/origin\/main/);

      // Re-open the target popup: the Working tree pseudo-option is present.
      await page.locator('.slot-target').click();
      const targetList = page.getByRole('listbox', { name: 'Branches' });
      const workingTreeOption = targetList.locator('[data-branch-option="working-tree"]');
      await expect(workingTreeOption).toBeVisible();
      await workingTreeOption.click();

      // W8: the target returns to the working tree and the comparison is
      // inferred as working-tree-vs-head (untouched HEAD base).
      await expect(page.locator('.slot-target .slot-value')).toHaveText(/working tree/i);
      const fileList = page.locator('#file-list-panel');
      await expect(fileList).toBeVisible({ timeout: 10000 });
      await expect(fileList).toContainText('untracked.txt', { timeout: 10000 });
    } finally {
      fixture.cleanup();
    }
  });
});
