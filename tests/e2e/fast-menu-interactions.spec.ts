import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import type { APIRequestContext, Page } from '@playwright/test';

import { expect, test } from './fixtures';
import { createGitFixture } from './helpers/git-fixture';
import { waitForHydration } from './helpers/hydration';
import {
  registerAndActivate,
  registerAndSelectWorkspace,
  selectRailTab,
} from './helpers/register-workspace';
import { resetDb } from './helpers/reset-db';

/**
 * Fast-menu interactions (feat-fast-menu-interactions).
 *
 * Behavioral E2E contract for the approved scenarios:
 * - overflow menu opens without any API request (pure local UI)
 * - Quick Open shell + focus precede remote tree data
 * - the review list is fetched at most once per open
 * - the file-list status map is fetched once per workspace+comparison
 *   across the three consumers (Project tree, Git context panel, Quick Open)
 * - the file-list cache is scoped to the active workspace (no inactive
 *   prefetch; workspace B never reuses workspace A statuses)
 * - a Git refresh invalidates the affected workspace's file-list cache
 * - server-seeded data (workspaces, git context, active review) is not
 *   refetched on first render
 * - observation loads discard stale responses from a previous review
 */

function initRepo(fixture: { repoPath: string; runGit(args: readonly string[]): void }): void {
  mkdirSync(path.join(fixture.repoPath, 'src'), { recursive: true });
  writeFileSync(path.join(fixture.repoPath, 'README.md'), '# e2e\n');
  writeFileSync(path.join(fixture.repoPath, 'src', 'app.ts'), 'export const app = 1;\n');
  fixture.runGit(['add', '.']);
  fixture.runGit(['commit', '-m', 'init']);
}

async function countApiRequests(page: Page): Promise<() => number> {
  let count = 0;
  page.on('request', (request) => {
    if (request.url().includes('/api/')) count += 1;
  });
  return () => count;
}

/** Select the workspace with the given name from the sidebar. */
async function selectWorkspaceByName(page: Page, name: string): Promise<void> {
  const item = page.locator(`#workspace-sidebar li:has-text("${name}")`).first();
  await expect(item).toBeVisible({ timeout: 10_000 });
  await item.getByRole('button', { name: /Select/ }).click();
  const gitTab = page.getByTestId('rail-tab-git');
  await expect(gitTab).toHaveAttribute('aria-selected', 'true', { timeout: 10_000 });
}

/** Capture the workspace ids seen in /api/workspaces URLs, in order. */
async function captureWorkspaceIds(page: Page): Promise<{ first(): string; last(): string }> {
  const ids: string[] = [];
  page.on('request', (request) => {
    const match = request.url().match(/\/api\/workspaces\/([^/]+)\//);
    if (match && !ids.includes(match[1])) ids.push(match[1]);
  });
  return {
    first(): string {
      expect(ids.length).toBeGreaterThan(0);
      return ids[0];
    },
    last(): string {
      expect(ids.length).toBeGreaterThan(0);
      return ids[ids.length - 1];
    },
  };
}

function defaultComparison(): Record<string, unknown> {
  return {
    base: { type: 'head', value: 'HEAD', label: 'HEAD' },
    target: { type: 'working-tree', value: 'WORKING_TREE', label: 'Working tree' },
    comparisonType: 'working-tree-vs-head',
    createdAt: new Date().toISOString(),
  };
}

/** Create and activate a review through the API (same endpoint the UI uses). */
async function createReview(
  request: APIRequestContext,
  workspaceId: string,
): Promise<{ id: string }> {
  const res = await request.post(`/api/workspaces/${workspaceId}/reviews`, {
    data: { comparison: defaultComparison() },
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()) as { id: string };
}

function observationPayload(id: string, body: string): unknown[] {
  return [
    {
      id,
      reviewId: id,
      type: 'note',
      severity: 'info',
      origin: 'user',
      status: 'open',
      body,
      agentInstruction: '',
      filePath: null,
      side: 'right',
      lineStart: null,
      lineEnd: null,
      comparisonSnapshotJson: '{}',
      diffSnapshot: null,
      contentHash: null,
      createdAt: '2026-08-06T00:00:00.000Z',
      updatedAt: '2026-08-06T00:00:00.000Z',
    },
  ];
}

test.describe('Fast menu interactions', () => {
  test.beforeEach(async ({ page, request }) => {
    await resetDb(request);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await waitForHydration(page);
  });

  test('the overflow menu opens without any API request', async ({ page }) => {
    const fixture = createGitFixture('diffscribe-e2e-fmi-');
    try {
      initRepo(fixture);
      await registerAndActivate(page, fixture.repoPath, `FMI-Menu-${Date.now()}`);

      const apiRequests = await countApiRequests(page);
      const item = page.locator('#workspace-sidebar li').first();
      await expect(item).toBeVisible({ timeout: 10_000 });
      await item.getByTestId('workspace-actions').click();
      const menu = page.getByRole('menu');
      await expect(menu).toBeVisible({ timeout: 5000 });
      await expect(menu.getByRole('menuitem').first()).toBeFocused({ timeout: 5000 });
      expect(apiRequests()).toBe(0);
    } finally {
      fixture.cleanup();
    }
  });

  test('Quick Open shows its shell and focus before the tree data arrives', async ({ page }) => {
    const fixture = createGitFixture('diffscribe-e2e-fmi-');
    try {
      initRepo(fixture);
      await registerAndActivate(page, fixture.repoPath, `FMI-QO-${Date.now()}`);

      // Slow down the tree response; the shell must not wait on it.
      await page.route('**/api/workspaces/*/tree', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 1800));
        await route.continue();
      });

      await page.keyboard.press('Control+p');
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible({ timeout: 1200 });
      await expect(page.getByTestId('quick-open-filter')).toBeFocused({ timeout: 1200 });
      // After the tree resolves, results appear.
      await expect(page.getByTestId('quick-open-result').first()).toBeVisible({ timeout: 10_000 });
    } finally {
      fixture.cleanup();
    }
  });

  test('the review list is fetched at most once per open', async ({ page }) => {
    const fixture = createGitFixture('diffscribe-e2e-fmi-');
    try {
      initRepo(fixture);
      await registerAndSelectWorkspace(page, fixture.repoPath, `FMI-Rv-${Date.now()}`, 'git');

      let reviewsGets = 0;
      page.on('request', (request) => {
        if (request.method() !== 'GET') return;
        const url = new URL(request.url());
        if (/\/api\/workspaces\/[^/]+\/reviews$/.test(url.pathname)) reviewsGets += 1;
      });

      const panel = page.locator('#review-panel');
      await page.getByTestId('right-tab-review').click();
      await expect(panel.locator('.review-placeholder')).toBeVisible({ timeout: 10_000 });

      reviewsGets = 0;
      await panel.locator('button:has-text("View Reviews")').click();
      await expect(panel.locator('.review-list-container')).toBeVisible({ timeout: 10_000 });
      // Give a duplicate (buggy) load time to fire before asserting.
      await page.waitForTimeout(600);
      expect(reviewsGets).toBe(1);
    } finally {
      fixture.cleanup();
    }
  });

  test('the file-list status map is fetched once across the three consumers', async ({ page }) => {
    const fixture = createGitFixture('diffscribe-e2e-fmi-');
    try {
      initRepo(fixture);

      let fileListGets = 0;
      page.on('request', (request) => {
        if (request.method() !== 'GET') return;
        const url = new URL(request.url());
        if (url.pathname.includes('/file-list')) fileListGets += 1;
      });

      // Consumer 1: Git context panel mounts on the Git rail.
      await registerAndSelectWorkspace(page, fixture.repoPath, `FMI-Share-${Date.now()}`, 'git');
      expect(fileListGets).toBe(1);

      // Consumer 2: Project tree mounts on the Project rail.
      await selectRailTab(page, 'project');
      await expect(page.getByTestId('project-tree')).toBeVisible({ timeout: 10_000 });
      await expect(page.getByTestId('project-tree')).toContainText('README.md', {
        timeout: 10_000,
      });

      // Consumer 3: Quick Open requests the status map on open.
      await page.keyboard.press('Control+p');
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10_000 });
      await expect(page.getByTestId('quick-open-result').first()).toBeVisible({ timeout: 10_000 });
      await page.keyboard.press('Escape');

      expect(fileListGets).toBe(1);
    } finally {
      fixture.cleanup();
    }
  });

  test('the file-list cache is scoped to the active workspace without prefetch', async ({
    page,
  }) => {
    const fixtureA = createGitFixture('diffscribe-e2e-fmi-');
    const fixtureB = createGitFixture('diffscribe-e2e-fmi-');
    const nameA = `FMI-A-${Date.now()}`;
    const nameB = `FMI-B-${Date.now()}`;
    try {
      initRepo(fixtureA);
      initRepo(fixtureB);

      const perWorkspace = new Map<string, number>();
      page.on('request', (request) => {
        if (request.method() !== 'GET') return;
        const match = request.url().match(/\/api\/workspaces\/([^/]+)\/file-list/);
        if (match) perWorkspace.set(match[1], (perWorkspace.get(match[1]) ?? 0) + 1);
      });

      await registerAndSelectWorkspace(page, fixtureA.repoPath, nameA, 'git');
      const wsA = [...perWorkspace.keys()][0];
      expect(perWorkspace.get(wsA)).toBe(1);

      // Workspace B loads its own statuses: never served from A's cache.
      await registerAndSelectWorkspace(page, fixtureB.repoPath, nameB, 'git');
      const wsB = [...perWorkspace.keys()][1];
      expect(perWorkspace.get(wsB)).toBe(1);
      // While B is active, A is neither refetched nor prefetched.
      expect(perWorkspace.get(wsA)).toBe(1);

      // Rail switches with B active never touch A's data.
      await selectRailTab(page, 'project');
      await expect(page.getByTestId('project-tree')).toBeVisible({ timeout: 10_000 });
      await page.keyboard.press('Control+p');
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10_000 });
      await expect(page.getByTestId('quick-open-result').first()).toBeVisible({ timeout: 10_000 });
      await page.keyboard.press('Escape');

      expect(perWorkspace.get(wsA)).toBe(1);
      expect(perWorkspace.get(wsB) ?? 0).toBeGreaterThanOrEqual(1);
    } finally {
      fixtureA.cleanup();
      fixtureB.cleanup();
    }
  });

  test('a Git refresh invalidates the affected workspace file-list cache', async ({ page }) => {
    const fixture = createGitFixture('diffscribe-e2e-fmi-');
    try {
      initRepo(fixture);

      let fileListGets = 0;
      page.on('request', (request) => {
        if (request.method() !== 'GET') return;
        const url = new URL(request.url());
        if (url.pathname.includes('/file-list')) fileListGets += 1;
      });

      await registerAndSelectWorkspace(page, fixture.repoPath, `FMI-Inv-${Date.now()}`, 'git');
      expect(fileListGets).toBe(1);

      // Warm the shared cache on the Project rail (cache hit after Phase 3).
      await selectRailTab(page, 'project');
      await expect(page.getByTestId('project-tree')).toBeVisible({ timeout: 10_000 });
      const afterProjectWarm = fileListGets;

      // Refresh the Git context: the mutation invalidates the workspace cache.
      await selectRailTab(page, 'git');
      const panel = page.locator('#git-context-panel');
      await expect(panel).toBeVisible({ timeout: 10_000 });
      const refreshResponse = page.waitForResponse(
        (resp) => resp.url().includes('/git-context') && resp.request().method() === 'GET',
      );
      await panel.getByRole('button', { name: 'Refresh Git context' }).click();
      await refreshResponse;

      // The next load (Project rail remount) fetches the fresh map exactly once.
      await selectRailTab(page, 'project');
      await expect(page.getByTestId('project-tree')).toBeVisible({ timeout: 10_000 });
      await expect(page.getByTestId('project-tree')).toContainText('README.md', {
        timeout: 10_000,
      });
      expect(fileListGets).toBe(afterProjectWarm + 1);
    } finally {
      fixture.cleanup();
    }
  });

  test('server-seeded data is not refetched on first render', async ({ page }) => {
    const fixture = createGitFixture('diffscribe-e2e-fmi-');
    try {
      initRepo(fixture);
      await registerAndActivate(page, fixture.repoPath, `FMI-Seed-${Date.now()}`);

      const seedRefetches: string[] = [];
      page.on('request', (request) => {
        if (request.method() !== 'GET') return;
        const url = new URL(request.url());
        if (!url.pathname.includes('/api/workspaces/')) return;
        if (/\/git-context$/.test(url.pathname)) seedRefetches.push(url.pathname);
        if (/\/reviews$/.test(url.pathname)) seedRefetches.push(url.pathname);
      });

      // SSR reload with an active workspace + seeded git context.
      await page.reload();
      await page.waitForLoadState('networkidle');
      await waitForHydration(page);
      await page.waitForTimeout(1000);

      expect(seedRefetches).toEqual([]);
    } finally {
      fixture.cleanup();
    }
  });

  test('observation panel discards stale responses from a previous review', async ({
    page,
    request,
  }) => {
    const fixtureA = createGitFixture('diffscribe-e2e-fmi-');
    const fixtureB = createGitFixture('diffscribe-e2e-fmi-');
    const nameA = `FMI-ObsA-${Date.now()}`;
    const nameB = `FMI-ObsB-${Date.now()}`;
    try {
      initRepo(fixtureA);
      initRepo(fixtureB);

      const wsIds = await captureWorkspaceIds(page);

      await registerAndSelectWorkspace(page, fixtureA.repoPath, nameA, 'git');
      const wsA = wsIds.last();
      const reviewA = await createReview(request, wsA);

      await registerAndSelectWorkspace(page, fixtureB.repoPath, nameB, 'git');
      const wsB = wsIds.last();
      const reviewB = await createReview(request, wsB);

      // Comments tab is where the observation panel lives.
      await page.getByTestId('right-tab-comments').click();

      // Review A's observations arrive late and must never overwrite B's.
      await page.route('**/api/workspaces/*/reviews/*/observations', async (route) => {
        const url = route.request().url();
        const reviewId = url.match(/\/reviews\/([^/]+)\/observations/)?.[1] ?? '';
        if (reviewId === reviewA.id) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          await route.fulfill({ json: observationPayload(reviewA.id, 'STALE-OBSERVATION-R1') });
        } else {
          await new Promise((resolve) => setTimeout(resolve, 100));
          await route.fulfill({ json: observationPayload(reviewB.id, 'FRESH-OBSERVATION-R2') });
        }
      });

      // Race: activate workspace A (R1 fetch in flight), then quickly B.
      await selectRailTab(page, 'workspaces');
      const staleRequested = page.waitForRequest((req) =>
        req.url().includes(`/reviews/${reviewA.id}/observations`),
      );
      await selectWorkspaceByName(page, nameA);
      await staleRequested;

      await selectRailTab(page, 'workspaces');
      const freshResponse = page.waitForResponse(
        (resp) =>
          resp.url().includes(`/reviews/${reviewB.id}/observations`) &&
          resp.request().method() === 'GET',
      );
      await selectWorkspaceByName(page, nameB);
      await freshResponse;

      // Give the stale response time to land; it must be discarded.
      await page.waitForTimeout(1400);
      await expect(page.getByText('FRESH-OBSERVATION-R2')).toBeVisible({ timeout: 5000 });
      await expect(page.getByText('STALE-OBSERVATION-R1')).toHaveCount(0);
    } finally {
      fixtureA.cleanup();
      fixtureB.cleanup();
    }
  });
});
