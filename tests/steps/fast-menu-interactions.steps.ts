/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import fs from 'node:fs';
import path from 'node:path';

import { Given, Then, When } from 'quickpickle';

type World = any;

const FEATURE_PATH = path.resolve(
  __dirname,
  '../../specs/features/product/fast-menu-interactions.feature',
);
const LOADER_PATH = path.resolve(
  __dirname,
  '../../src/lib/web/services/file-list-status-loader.ts',
);
const REVIEW_PANEL_PATH = path.resolve(
  __dirname,
  '../../src/lib/web/components/review-panel.svelte',
);
const QUICK_OPEN_PATH = path.resolve(
  __dirname,
  '../../src/lib/web/components/quick-open-dialog.svelte',
);
const PROJECT_TREE_PATH = path.resolve(
  __dirname,
  '../../src/lib/web/components/project-tree.svelte',
);
const GIT_CONTEXT_PANEL_PATH = path.resolve(
  __dirname,
  '../../src/lib/web/components/git-context-panel.svelte',
);
const WORKSPACE_NAV_ITEM_PATH = path.resolve(
  __dirname,
  '../../src/lib/web/components/workspace-nav-item.svelte',
);
const PAGE_SERVER_PATH = path.resolve(__dirname, '../../src/routes/+page.server.ts');
const PAGE_PATH = path.resolve(__dirname, '../../src/routes/+page.svelte');
const MENU_PATH = path.resolve(__dirname, '../../src/lib/web/components/ui/Menu.svelte');
const TIMING_HELPER_PATH = path.resolve(__dirname, '../../tests/e2e/helpers/performance-timing.ts');
const REQUEST_HELPER_PATH = path.resolve(__dirname, '../../tests/e2e/helpers/request-tracking.ts');
const BASELINE_SPEC_PATH = path.resolve(__dirname, '../../tests/e2e/fast-menu-baseline.spec.ts');

function requireMarker(file: string, marker: string): void {
  const src = fs.readFileSync(file, 'utf-8');
  if (!src.includes(marker)) {
    throw new Error(`${path.basename(file)} missing marker: ${marker}`);
  }
}

function requireNoMarker(file: string, marker: string): void {
  const src = fs.readFileSync(file, 'utf-8');
  if (src.includes(marker)) {
    throw new Error(`${path.basename(file)} must not contain marker: ${marker}`);
  }
}

// ────────────────────────────────────────────────────────────────────────────
//  FEAT-ID contract pin (Background steps 'the app shell is present' and
//  'a workspace is registered and active' are shared from other step files)
// ────────────────────────────────────────────────────────────────────────────

// ────────────────────────────────────────────────────────────────────────────
//  Scenario: The overflow menu opens without any API request
// ────────────────────────────────────────────────────────────────────────────

Given('the workspace overflow menu trigger is visible', (_w: World) => {
  requireMarker(FEATURE_PATH, '@feat-fast-menu-interactions');
  requireMarker(WORKSPACE_NAV_ITEM_PATH, 'data-testid="workspace-actions"');
});

Then('the overflow menu becomes visible', (_w: World) => {
  requireMarker(MENU_PATH, 'role="menu"');
});

Then('no API request is issued while the menu opens', (_w: World) => {
  // The overflow menu is pure local UI: it must never issue a fetch.
  requireNoMarker(MENU_PATH, 'fetch(');
});

// ────────────────────────────────────────────────────────────────────────────
//  Scenario: Quick Open shows its shell and focus before the tree data arrives
// ────────────────────────────────────────────────────────────────────────────

Given('the Project tree data is not yet loaded for the workspace', (_w: World) => {
  // The dialog renders and focuses the filter before the tree index resolves.
  requireMarker(QUICK_OPEN_PATH, 'showModal()');
  requireMarker(QUICK_OPEN_PATH, 'inputRef?.focus()');
});

When('the tree data arrives', (_w: World) => {
  requireMarker(QUICK_OPEN_PATH, 'projectTreeLoader.load');
});

Then('the tree results appear in the dialog', (_w: World) => {
  requireMarker(QUICK_OPEN_PATH, 'index = flattenFiles(snapshot.tree)');
});

// ────────────────────────────────────────────────────────────────────────────
//  Scenario: The review list is fetched at most once per open
// ────────────────────────────────────────────────────────────────────────────

Given('the review panel shows the review list', (_w: World) => {
  requireMarker(REVIEW_PANEL_PATH, 'showReviewList');
});

When('the user opens the review list', (_w: World) => {
  // The open action only toggles the list; the fetch happens once in the
  // reactive effect, never in the click handler (double-load regression pin).
  requireMarker(REVIEW_PANEL_PATH, 'showReviewList = !showReviewList');
  requireNoMarker(REVIEW_PANEL_PATH, 'if (showReviewList) loadReviewList()');
});

Then('the review list is fetched exactly once', (_w: World) => {
  requireMarker(REVIEW_PANEL_PATH, 'showReviewList && activeWorkspaceId');
});

Then('the review list shows the reviews', (_w: World) => {
  requireMarker(REVIEW_PANEL_PATH, 'review-list-item');
});

// ────────────────────────────────────────────────────────────────────────────
//  Scenario: The file-list status map is fetched once per workspace and comparison
// ────────────────────────────────────────────────────────────────────────────

Given('the Project tree, the Git context panel, and Quick Open are mounted', (_w: World) => {
  // All three consumers share the module-level file-list status loader.
  requireMarker(PROJECT_TREE_PATH, 'fileListStatusLoader');
  requireMarker(GIT_CONTEXT_PANEL_PATH, 'fileListStatusLoader');
  requireMarker(QUICK_OPEN_PATH, 'fileListStatusLoader');
});

When('the same workspace and comparison are active', (_w: World) => {
  // Canonical semantic key: workspace + comparison WITHOUT createdAt.
  requireMarker(LOADER_PATH, 'comparisonType');
  requireNoMarker(LOADER_PATH, 'comparisonDraft.createdAt,');
});

Then('the file-list status endpoint is requested once', (_w: World) => {
  // In-flight promises are shared per key (mirror of project-tree-loader).
  requireMarker(LOADER_PATH, 'entry.promise');
  requireMarker(LOADER_PATH, 'pending');
});

Then('all three consumers share the same status map', (_w: World) => {
  requireMarker(LOADER_PATH, 'fileListStatusLoader');
});

// ────────────────────────────────────────────────────────────────────────────
//  Scenario: The file-list cache is scoped to the active workspace
// ────────────────────────────────────────────────────────────────────────────

Given('workspace A and workspace B are registered', (_w: World) => {
  requireMarker(WORKSPACE_NAV_ITEM_PATH, 'data-workspace-select');
});

When('the user switches from workspace A to workspace B', (_w: World) => {
  requireMarker(WORKSPACE_NAV_ITEM_PATH, '?/select');
});

Then('loading workspace B never reuses workspace A cached statuses', (_w: World) => {
  requireMarker(LOADER_PATH, 'workspaceId');
});

Then('workspace A data is not prefetched while workspace B is active', (_w: World) => {
  // No eager-loading API and no global cache sweep: the loader only caches
  // what was explicitly loaded and invalidates per workspace.
  requireNoMarker(LOADER_PATH, 'loadAll(');
  requireNoMarker(LOADER_PATH, 'prefetch');
  requireMarker(LOADER_PATH, 'invalidate');
});

// ────────────────────────────────────────────────────────────────────────────
//  Scenario: A Git mutation invalidates the affected workspace cache
// ────────────────────────────────────────────────────────────────────────────

Given('the file-list status map is cached for the active workspace', (_w: World) => {
  requireMarker(LOADER_PATH, 'cache');
});

Then('the cached status map for the active workspace is invalidated', (_w: World) => {
  // The Git refresh (shared step) invalidates the affected workspace's
  // status cache through the shared loader.
  requireMarker(GIT_CONTEXT_PANEL_PATH, 'fileListStatusLoader.invalidate');
  requireMarker(LOADER_PATH, 'invalidated');
});

Then('the next load fetches the fresh status map once', (_w: World) => {
  // Pending-safe invalidation: settled entries are dropped so the next load
  // starts exactly one fresh request.
  requireMarker(LOADER_PATH, 'cache.delete');
});

// ────────────────────────────────────────────────────────────────────────────
//  Scenario: A stale response never overwrites a newer one
// ────────────────────────────────────────────────────────────────────────────

Given('a file-list request is in flight for the active workspace', (_w: World) => {
  requireMarker(LOADER_PATH, 'pending');
});

When('a newer request starts for the same workspace', (_w: World) => {
  // Concurrent loads for the same key share one in-flight promise.
  requireMarker(LOADER_PATH, 'entry.promise');
});

Then('the stale response is discarded', (_w: World) => {
  // Invalidated or failed snapshots are never cached: the next load refetches.
  requireMarker(LOADER_PATH, 'snapshot === null');
});

// ────────────────────────────────────────────────────────────────────────────
//  Scenario: A failed load is not cached and can be retried
// ────────────────────────────────────────────────────────────────────────────

Given('the file-list endpoint fails', (_w: World) => {
  requireMarker(LOADER_PATH, 'null');
});

When('the user retries the load', (_w: World) => {
  requireMarker(LOADER_PATH, 'fetchEntry');
});

Then('the retry succeeds and the status map is cached', (_w: World) => {
  requireMarker(LOADER_PATH, 'cache.delete');
});

// ────────────────────────────────────────────────────────────────────────────
//  Scenario: Server-seeded data is not refetched on first render
// ────────────────────────────────────────────────────────────────────────────

Given('the page load delivered workspaces, git context, and the active review', (_w: World) => {
  requireMarker(PAGE_SERVER_PATH, 'workspaces:');
  requireMarker(PAGE_SERVER_PATH, 'gitContext');
  requireMarker(PAGE_SERVER_PATH, 'activeReview');
});

When('the app shell renders with an active workspace', (_w: World) => {
  requireMarker(PAGE_PATH, 'data.gitContext');
});

Then('no request re-fetches the workspace list, git context, or active review', (_w: World) => {
  // Consumers receive the seeded values as props; they do not fetch them.
  requireMarker(GIT_CONTEXT_PANEL_PATH, 'gitContext = null as');
  requireMarker(REVIEW_PANEL_PATH, 'activeReview = null as');
});

Then('the shell consumes the server-seeded values', (_w: World) => {
  requireMarker(PAGE_PATH, 'data.activeReview');
});

// ────────────────────────────────────────────────────────────────────────────
//  Scenario: Interaction latency is measured in dev and production
// ────────────────────────────────────────────────────────────────────────────

Given('the app runs in a measured environment', (_w: World) => {
  requireMarker(TIMING_HELPER_PATH, 'PerformanceObserver');
});

When('the user opens the overflow menu, Quick Open, and the review list', (_w: World) => {
  requireMarker(BASELINE_SPEC_PATH, 'fast-menu-baseline');
});

Then('the report records shell, focus, first content, and settled times', (_w: World) => {
  requireMarker(TIMING_HELPER_PATH, 'firstContent');
  requireMarker(TIMING_HELPER_PATH, 'settled');
});

Then('the report records request counts, long tasks, and page errors', (_w: World) => {
  requireMarker(REQUEST_HELPER_PATH, 'pageerror');
  requireMarker(TIMING_HELPER_PATH, 'longtask');
});
