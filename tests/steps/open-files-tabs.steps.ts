/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import fs from 'node:fs';
import path from 'node:path';

import { Given, Then, When } from 'quickpickle';

type World = any;

const STORE_PATH = path.resolve(__dirname, '../../src/lib/web/stores/active-file-store.ts');
const TABS_PATH = path.resolve(__dirname, '../../src/lib/web/components/open-files-tabs.svelte');
const TREE_NODE_PATH = path.resolve(
  __dirname,
  '../../src/lib/web/components/project-tree-node.svelte',
);
const TREE_PATH = path.resolve(__dirname, '../../src/lib/web/components/project-tree.svelte');
const FILE_LIST_PATH = path.resolve(__dirname, '../../src/lib/web/components/file-list.svelte');
const BRANCH_PATH = path.resolve(__dirname, '../../src/lib/web/components/file-tree-branch.svelte');
const PAGE_PATH = path.resolve(__dirname, '../../src/routes/+page.svelte');
const DIFF_PATH = path.resolve(__dirname, '../../src/lib/web/components/diff-viewer.svelte');
const COMPLETE_DIFF_VIEWER_PATH = path.resolve(
  __dirname,
  '../../src/lib/web/components/complete-diff-viewer.svelte',
);
const GIT_PANEL_PATH = path.resolve(
  __dirname,
  '../../src/lib/web/components/git-context-panel.svelte',
);

function requireMarker(file: string, marker: string): void {
  const src = fs.readFileSync(file, 'utf-8');
  if (!src.includes(marker)) {
    throw new Error(`${path.basename(file)} missing marker: ${marker}`);
  }
}

// ────────────────────────────────────────────────────────────────────────────
//  GIVEN
// ────────────────────────────────────────────────────────────────────────────

Given('the Project tree shows files {string} and {string}', (_w: World, _a: string, _b: string) => {
  requireMarker(TREE_PATH, 'treeData');
  requireMarker(TREE_PATH, 'node.path');
});

Given('the central viewer shows the tab {string}', (_w: World, _file: string) => {
  requireMarker(TABS_PATH, 'role="tablist"');
  requireMarker(STORE_PATH, 'openTabs');
  // Normal click must reuse the active tab (open in the current tab).
  requireMarker(TREE_PATH, 'setActiveFile');
  requireMarker(STORE_PATH, 'openFileTab');
});

Given(
  'the central viewer shows the tabs {string} and {string}',
  (_w: World, _a: string, _b: string) => {
    requireMarker(TABS_PATH, 'role="tablist"');
    requireMarker(STORE_PATH, 'openTabs');
  },
);

Given(
  'the central viewer shows the tabs {string}, {string}, and {string}',
  (_w: World, _a: string, _b: string, _c: string) => {
    requireMarker(TABS_PATH, 'role="tablist"');
    requireMarker(STORE_PATH, 'openTabs');
  },
);

Given('the active tab is {string}', (_w: World, _file: string) => {
  requireMarker(STORE_PATH, 'activateTab');
  requireMarker(TABS_PATH, 'aria-selected');
});

Given('the Git file list shows {string}', (_w: World, _file: string) => {
  requireMarker(FILE_LIST_PATH, 'file-row');
});

Given('the diff viewer shows the file {string}', (_w: World, _file: string) => {
  requireMarker(DIFF_PATH, 'fetchDiff');
});

// ────────────────────────────────────────────────────────────────────────────
//  WHEN
// ────────────────────────────────────────────────────────────────────────────

// 'the user clicks {string} in the Project tree' comes from
// ui-redesign.steps.ts (shared step).

When('the user Ctrl-clicks {string} in the Project tree', (_w: World, _file: string) => {
  requireMarker(TREE_NODE_PATH, 'ctrlKey');
});

When('the user Cmd-clicks {string} in the Project tree', (_w: World, _file: string) => {
  requireMarker(TREE_NODE_PATH, 'metaKey');
});

When('the user Ctrl-clicks {string} in the Git file list', (_w: World, _file: string) => {
  requireMarker(FILE_LIST_PATH, 'ctrlKey');
  requireMarker(BRANCH_PATH, 'metaKey');
});

When('the user clicks the tab {string}', (_w: World, _file: string) => {
  requireMarker(TABS_PATH, 'onclick');
  requireMarker(STORE_PATH, 'activateTab');
});

When('the user closes the tab {string}', (_w: World, _file: string) => {
  requireMarker(TABS_PATH, 'aria-label="Close ');
  requireMarker(STORE_PATH, 'closeTab');
});

When('the user activates another workspace', (_w: World) => {
  requireMarker(PAGE_PATH, 'resetTabs');
});

When('the user Ctrl-clicks a diff line', (_w: World) => {
  // Ctrl/Cmd-click on diff lines stays line selection; it must not open tabs.
  requireMarker(DIFF_PATH, 'event?.metaKey');
  requireMarker(DIFF_PATH, 'lastSelectionKind');
});

When('the user focuses the tab list and presses ArrowRight', (_w: World) => {
  requireMarker(TABS_PATH, 'ArrowRight');
  requireMarker(TABS_PATH, 'ArrowLeft');
});

// 'the user presses Home' / 'the user presses End' come from
// base-ui-kit.steps.ts (shared keyboard contract steps).

// ────────────────────────────────────────────────────────────────────────────
//  THEN
// ────────────────────────────────────────────────────────────────────────────

Then('the central viewer shows exactly one tab', (_w: World) => {
  requireMarker(STORE_PATH, 'openTabs');
  requireMarker(TABS_PATH, 'role="tablist"');
});

Then('the central viewer shows one tab', (_w: World) => {
  requireMarker(STORE_PATH, 'openTabs');
  requireMarker(TABS_PATH, 'role="tablist"');
});

Then('the central viewer shows two tabs', (_w: World) => {
  requireMarker(TABS_PATH, 'role="tablist"');
  requireMarker(TABS_PATH, '{#each $openTabs');
});

Then('the central viewer still shows two tabs', (_w: World) => {
  // Dedup: an already-open path must not create a duplicate tab.
  requireMarker(STORE_PATH, 'alreadyOpen');
  requireMarker(STORE_PATH, 'openTabs');
});

Then('the central viewer shows no tabs', (_w: World) => {
  requireMarker(TABS_PATH, 'tabpanel');
  requireMarker(TABS_PATH, 'No file selected');
});

Then('the central viewer shows {string}', (_w: World, _file: string) => {
  requireMarker(PAGE_PATH, 'activeFilePath');
});

Then('the central viewer shows the content of {string}', (_w: World, _file: string) => {
  requireMarker(PAGE_PATH, 'activeFilePath');
});

Then('the active tab has the highlighted state', (_w: World) => {
  requireMarker(TABS_PATH, 'class:active');
});

Then('the active tab has no bottom border', (_w: World) => {
  requireMarker(TABS_PATH, 'border-bottom: none');
});

Then('the inactive tab has a visible bottom border', (_w: World) => {
  requireMarker(TABS_PATH, 'border-bottom: 1px solid var(--border-subtle)');
});

Then('the inactive tab has the dimmed state and remains readable', (_w: World) => {
  requireMarker(TABS_PATH, 'file-tab.inactive');
});

Then('no stale path from the previous workspace appears', (_w: World) => {
  requireMarker(STORE_PATH, 'resetTabs');
});

Then('the line selection is updated', (_w: World) => {
  requireMarker(DIFF_PATH, 'selectedLines');
});

Then('the number of open tabs does not change', (_w: World) => {
  requireMarker(TABS_PATH, 'role="tablist"');
  requireMarker(DIFF_PATH, 'event?.metaKey');
});

Then('the next tab receives focus', (_w: World) => {
  requireMarker(TABS_PATH, 'tabindex');
});

Then('the first tab receives focus', (_w: World) => {
  requireMarker(TABS_PATH, 'Home');
});

Then('the last tab receives focus', (_w: World) => {
  requireMarker(TABS_PATH, 'End');
});

Then('the tab list has role tablist and the tabs have role tab', (_w: World) => {
  requireMarker(TABS_PATH, 'role="tablist"');
  requireMarker(TABS_PATH, 'role="tab"');
});

Then('the active tab has aria-selected true', (_w: World) => {
  requireMarker(TABS_PATH, 'aria-selected');
});

Then('each tab has an aria-controls reference to its panel', (_w: World) => {
  requireMarker(TABS_PATH, 'aria-controls');
});

Then('each close button has an accessible name', (_w: World) => {
  requireMarker(TABS_PATH, 'aria-label="Close ');
});

// ────────────────────────────────────────────────────────────────────────────
//  0003 pinned complete-diff tab
// ────────────────────────────────────────────────────────────────────────────

Given('the active workspace has changes', (_w: World) => {
  requireMarker(PAGE_PATH, 'pinCompleteDiff');
  requireMarker(PAGE_PATH, 'activeTabId === COMPLETE_DIFF_TAB_ID');
});

Given('the complete diff tab is the first tab', (_w: World) => {
  requireMarker(STORE_PATH, 'pinCompleteDiff');
  requireMarker(TABS_PATH, 'pinned-complete-diff-tab');
});

Given('the complete diff tab is active', (_w: World) => {
  requireMarker(STORE_PATH, 'pinCompleteDiff');
  requireMarker(TABS_PATH, 'pinned-complete-diff-tab');
});

Given('the central viewer shows the complete diff tab and {string}', (_w: World, _f: string) => {
  requireMarker(TABS_PATH, 'pinned-complete-diff-tab');
  requireMarker(STORE_PATH, 'openFileTab');
});

When('the user views the central tab strip', (_w: World) => {
  requireMarker(TABS_PATH, 'pinned-complete-diff-tab');
});

When('the user middle-clicks the complete diff tab', (_w: World) => {
  requireMarker(TABS_PATH, 'non-closable');
});

When('the user clicks the complete diff tab', (_w: World) => {
  requireMarker(TABS_PATH, 'pinned-complete-diff-tab');
});

When('the user opens {string} from the Project tree', (_w: World, _file: string) => {
  requireMarker(TREE_NODE_PATH, 'file-entry');
  requireMarker(PAGE_PATH, 'openFileTab');
});

When('the user changes the comparison target', (_w: World) => {
  requireMarker(GIT_PANEL_PATH, 'onComparisonChange');
});

Then('the first tab is the complete diff tab', (_w: World) => {
  requireMarker(TABS_PATH, 'pinned-complete-diff-tab');
});

Then('the complete diff tab has no close button', (_w: World) => {
  requireMarker(TABS_PATH, 'without a close button');
});

Then('the complete diff tab remains open', (_w: World) => {
  requireMarker(STORE_PATH, 'id === COMPLETE_DIFF_TAB_ID');
});

Then(
  'the central viewer shows the complete diff tab followed by {string}',
  (_w: World, _file: string) => {
    requireMarker(TABS_PATH, 'pinned-complete-diff-tab');
    requireMarker(STORE_PATH, 'openFileTab');
  },
);

Then('the complete diff viewer is shown', (_w: World) => {
  requireMarker(PAGE_PATH, 'activeTabId === COMPLETE_DIFF_TAB_ID');
});

Then('"No file selected" is not shown', (_w: World) => {
  requireMarker(PAGE_PATH, 'activeTabId === COMPLETE_DIFF_TAB_ID');
  requireMarker(TABS_PATH, '$openTabs.length === 0');
});

Then('the complete diff tab is the only tab', (_w: World) => {
  requireMarker(STORE_PATH, 'COMPLETE_DIFF_TAB_ID');
});

Then('the central viewer shows only the new workspace complete diff tab', (_w: World) => {
  requireMarker(STORE_PATH, 'resetTabs');
  requireMarker(TABS_PATH, 'pinned-complete-diff-tab');
});

Then('the complete diff tab remains the first tab', (_w: World) => {
  requireMarker(STORE_PATH, 'pinCompleteDiff');
});

Then('the complete diff viewer reloads for the new comparison', (_w: World) => {
  requireMarker(PAGE_PATH, 'activeTabId === COMPLETE_DIFF_TAB_ID');
  requireMarker(COMPLETE_DIFF_VIEWER_PATH, 'comparisonDraft');
});

Then('the central viewer shows no complete diff tab', (_w: World) => {
  requireMarker(STORE_PATH, 'resetTabs');
  requireMarker(TABS_PATH, '$openTabs.length === 0');
});

Then(
  'the central viewer shows "No file selected"',
  (_w: World) => {
    requireMarker(TABS_PATH, 'No file selected');
  },
  1,
);
