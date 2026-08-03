import fs from 'node:fs';
import path from 'node:path';

import type { APIRequestContext } from '@playwright/test';

import { expect, test } from './fixtures';
import { createGitFixture } from './helpers/git-fixture';
import { registerAndSelectWorkspace } from './helpers/register-workspace';
import { resetDb } from './helpers/reset-db';

/**
 * Async/error safety (tranche C): the Git context refresh and the file-list
 * fetch run under request guards so stale responses never overwrite newer
 * state, and a failed refresh preserves the last good context with a
 * visible error and a Retry action.
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

function cleanContextJson(): Record<string, unknown> {
  return {
    status: {
      stagedCount: 0,
      unstagedCount: 0,
      untrackedCount: 0,
      conflictedCount: 0,
      isDirty: false,
      currentBranch: 'master',
      headState: 'clean',
    },
    branches: [
      {
        name: 'master',
        canonicalRef: 'refs/heads/master',
        isCurrent: true,
        committerDate: '2026-01-01T00:00:00.000Z',
      },
    ],
    commits: [],
    headState: 'clean',
    error: null,
    readAt: '2026-01-01T00:00:00.000Z',
    workspaceId: 'mock',
  };
}

function dirtyContextJson(): Record<string, unknown> {
  return {
    status: {
      stagedCount: 0,
      unstagedCount: 1,
      untrackedCount: 0,
      conflictedCount: 0,
      isDirty: true,
      currentBranch: 'master',
      headState: 'dirty',
    },
    branches: [
      {
        name: 'master',
        canonicalRef: 'refs/heads/master',
        isCurrent: true,
        committerDate: '2026-01-01T00:00:00.000Z',
      },
    ],
    commits: [],
    headState: 'dirty',
    error: null,
    readAt: '2026-01-01T00:00:01.000Z',
    workspaceId: 'mock',
  };
}

function initRepo(fixture: { repoPath: string; runGit(args: readonly string[]): void }): void {
  fs.writeFileSync(path.join(fixture.repoPath, 'README.md'), '# e2e');
  fixture.runGit(['add', '.']);
  fixture.runGit(['commit', '-m', 'init']);
}

test.describe('Git context async/error safety (tranche C)', () => {
  test.beforeEach(async ({ page, request }) => {
    await resetDbWhenReady(request);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  test('discards a stale file-list response when the comparison changes', async ({ page }) => {
    const fixture = createGitFixture('diffscribe-e2e-gcr-');
    const repoDir = fixture.repoPath;
    try {
      initRepo(fixture);
      fixture.runGit(['branch', 'feature']);

      // Intercept BEFORE the panel mounts so the initial (default
      // comparison) file-list request is captured and slowed down. The
      // request promise must also be created before mounting so the request
      // event cannot be missed.
      const staleRequested = page.waitForRequest(
        (req) => req.url().includes('file-list') && req.url().includes('working-tree'),
        { timeout: 15000 },
      );
      await page.route('**/api/workspaces/*/file-list*', async (route) => {
        const url = route.request().url();
        if (url.includes('working-tree')) {
          // Stale response: the default draft resolves late.
          await new Promise((resolve) => setTimeout(resolve, 600));
          await route.fulfill({
            json: {
              entries: [{ path: 'stale.txt', status: 'M', binary: false }],
              readAt: '2026-01-01T00:00:00.000Z',
            },
          });
        } else {
          // Newer response: the selected branch resolves quickly.
          await new Promise((resolve) => setTimeout(resolve, 100));
          await route.fulfill({
            json: {
              entries: [{ path: 'fresh.txt', status: 'M', binary: false }],
              readAt: '2026-01-01T00:00:01.000Z',
            },
          });
        }
      });

      await registerAndSelectWorkspace(page, repoDir, `E2E-GCr1-${Date.now()}`, 'git');

      const panel = page.locator('#git-context-panel');
      await expect(panel).toBeVisible({ timeout: 10000 });

      // Ensure the slow (stale) request for the default draft is in flight.
      await staleRequested;

      // Change the comparison: select the feature branch as Target via the
      // branch popup.
      await page.locator('.slot-target').click();
      await page
        .getByRole('listbox', { name: 'Branches' })
        .getByRole('option', { name: /feature/ })
        .click();

      // The fresh response wins; the stale one must never overwrite it.
      await expect(panel).toContainText('fresh.txt', { timeout: 8000 });
      // Give the stale response time to resolve before asserting it is gone.
      await page.waitForTimeout(700);
      await expect(panel).not.toContainText('stale.txt');
    } finally {
      fixture.cleanup();
    }
  });

  test('a failed refresh preserves the last good context with a visible error and retry', async ({
    page,
  }) => {
    const fixture = createGitFixture('diffscribe-e2e-gcr-');
    const repoDir = fixture.repoPath;
    try {
      initRepo(fixture);
      await registerAndSelectWorkspace(page, repoDir, `E2E-GCr2-${Date.now()}`, 'git');

      const panel = page.locator('#git-context-panel');
      await expect(panel).toBeVisible({ timeout: 10000 });
      await expect(panel.locator('.status-clean')).toBeVisible({ timeout: 8000 });

      // The next refresh fails at the network level.
      await page.route('**/api/workspaces/*/git-context*', (route) => route.abort());
      await panel.getByRole('button', { name: 'Refresh Git context' }).click();

      // Visible error with a Retry action…
      await expect(panel.locator('[role="alert"]')).toBeVisible({ timeout: 8000 });
      await expect(panel.getByRole('button', { name: /retry/i })).toBeVisible({ timeout: 5000 });
      // …and the last good context is preserved, never silently discarded.
      await expect(panel.locator('.status-clean')).toBeVisible({ timeout: 5000 });
      await expect(panel).toContainText('master');
    } finally {
      fixture.cleanup();
    }
  });

  test('discards a stale refresh response', async ({ page }) => {
    const fixture = createGitFixture('diffscribe-e2e-gcr-');
    const repoDir = fixture.repoPath;
    try {
      initRepo(fixture);
      await registerAndSelectWorkspace(page, repoDir, `E2E-GCr3-${Date.now()}`, 'git');

      const panel = page.locator('#git-context-panel');
      await expect(panel).toBeVisible({ timeout: 10000 });
      await expect(panel.locator('.status-clean')).toBeVisible({ timeout: 8000 });

      let calls = 0;
      await page.route('**/api/workspaces/*/git-context*', async (route) => {
        calls += 1;
        if (calls === 1) {
          // The first refresh is slow and would arrive last.
          await new Promise((resolve) => setTimeout(resolve, 600));
          await route.fulfill({ json: cleanContextJson() });
        } else {
          // The second refresh finishes first and must win.
          await new Promise((resolve) => setTimeout(resolve, 60));
          await route.fulfill({ json: dirtyContextJson() });
        }
      });

      const refreshBtn = panel.getByRole('button', { name: 'Refresh Git context' });
      await refreshBtn.dblclick();

      // The panel reflects the second refresh, not the stale first one.
      await expect(panel.locator('.status-dirty')).toBeVisible({ timeout: 8000 });
      await expect(panel.locator('.status-clean')).not.toBeVisible();
    } finally {
      fixture.cleanup();
    }
  });
});
