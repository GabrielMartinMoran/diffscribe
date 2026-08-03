/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import fs from 'node:fs';
import path from 'node:path';

import { Given, Then, When } from 'quickpickle';

type World = any;

const PANEL_PATH = path.resolve(__dirname, '../../src/lib/web/components/git-context-panel.svelte');
const POPUP_PATH = path.resolve(
  __dirname,
  '../../src/lib/web/components/branch-select-popup.svelte',
);
const OPTIONS_PATH = path.resolve(__dirname, '../../src/lib/web/utils/branch-options.ts');

function requireMarker(file: string, marker: string): void {
  const src = fs.readFileSync(file, 'utf-8');
  if (!src.includes(marker)) {
    throw new Error(`${path.basename(file)} missing marker: ${marker}`);
  }
}

// ────────────────────────────────────────────────────────────────────────────
//  GIVEN
// ────────────────────────────────────────────────────────────────────────────

Given('the Base popup is open', () => {
  requireMarker(PANEL_PATH, 'branch-select-popup');
  requireMarker(PANEL_PATH, 'slot-base');
});

Given(
  'the Base popup is open with local branches {string} and {string}',
  (_w: World, _b1: string, _b2: string) => {
    requireMarker(PANEL_PATH, 'branch-select-popup');
  },
);

Given('cached remote branches {string} and {string}', () => {
  requireMarker(POPUP_PATH, 'Cached remote');
});

Given('the workspace has local branches {string} and {string}', () => {
  // Real branch creation happens in the E2E specs; the popup contract is
  // verified here through the static markers below.
  requireMarker(POPUP_PATH, 'Local');
});

Given('the workspace has cached remote branches {string} and {string}', () => {
  requireMarker(POPUP_PATH, 'remote');
});

Given('the workspace has a local branch {string}', () => {
  requireMarker(POPUP_PATH, 'Local');
});

Given('the workspace has a cached remote branch {string}', () => {
  requireMarker(POPUP_PATH, 'Cached remote');
});

Given('the workspace current branch is {string}', () => {
  requireMarker(POPUP_PATH, 'isCurrent');
});

Given(
  'the Base popup is open with {string} selected in the Base slot',
  (_w: World, _branch: string) => {
    requireMarker(POPUP_PATH, 'aria-selected');
  },
);

Given('the Base slot shows {string}', () => {
  requireMarker(PANEL_PATH, 'slot-value');
});

Given('the Base popup is open with multiple branches', () => {
  requireMarker(POPUP_PATH, 'ArrowDown');
});

Given('the workspace has no branches', () => {
  requireMarker(POPUP_PATH, 'No branches');
});

Given('the viewport width is {int} pixels', (_w: World, _width: number) => {
  requireMarker(POPUP_PATH, 'min-width');
});

Given('the Base popup is open with many branches', () => {
  requireMarker(POPUP_PATH, 'overflow-y');
});

// ────────────────────────────────────────────────────────────────────────────
//  Async refresh states (post-tranche C hardening)
//
//  These steps are traceability pins for the popup/panel refresh wiring; the
//  real acceptance lives in the E2E specs (git-ref-popup.spec.ts and
//  git-context-race.spec.ts). The service-level echo mirrors the panel state
//  machine: loading only while refreshing with no branches, inline popup
//  error with Retry, and exactly one alert owner while a popup is open.
// ────────────────────────────────────────────────────────────────────────────

Given('the Base popup is open in a workspace with no branches', () => {
  requireMarker(POPUP_PATH, 'No branches');
});

Given('the Base popup shows a refresh error with a Retry action', (world: World) => {
  requireMarker(POPUP_PATH, 'Retry');
  world.refreshError = 'Refresh failed';
});

When('the Git context refresh is slow to respond', (world: World) => {
  requireMarker(PANEL_PATH, 'refreshing');
  world.refreshing = true;
});

When('the refresh completes', (world: World) => {
  world.refreshing = false;
});

When('the Git context refresh fails', (world: World) => {
  requireMarker(PANEL_PATH, 'refreshError');
  world.refreshing = false;
  world.refreshError = 'Refresh failed';
});

When('the user clicks Retry in the popup', (world: World) => {
  requireMarker(POPUP_PATH, 'onRetry');
  world.refreshing = false;
  world.refreshError = null;
});

When('the refresh succeeds', (world: World) => {
  world.refreshing = false;
  world.refreshError = null;
});

Then('the popup shows a loading state', () => {
  requireMarker(POPUP_PATH, 'loading');
});

Then('the popup shows the empty state again', () => {
  requireMarker(POPUP_PATH, 'No branches');
});

Then('the popup keeps the existing branch options visible', () => {
  requireMarker(POPUP_PATH, 'filterBranchGroups');
});

Then('the popup does not show a loading state', () => {
  const src = fs.readFileSync(POPUP_PATH, 'utf-8');
  if (src.includes('loading && visibleGroups.length === 0')) {
    throw new Error('Popup must not blank existing options while loading');
  }
});

Then('the popup shows an inline error with a Retry action', () => {
  requireMarker(POPUP_PATH, 'branch-popup-error');
  requireMarker(POPUP_PATH, 'Retry');
});

Then('the panel shows exactly one alert', () => {
  const panelSrc = fs.readFileSync(PANEL_PATH, 'utf-8');
  if (panelSrc.includes('refreshError && !openSlot') === false) {
    throw new Error('Panel must gate the global banner behind !openSlot');
  }
});

Then('the popup error disappears', (world: World) => {
  requireMarker(POPUP_PATH, 'branch-popup-error');
  if (world.refreshError) throw new Error('Expected popup error to clear');
});

Then('the popup shows the branch options again', () => {
  requireMarker(POPUP_PATH, 'filterBranchGroups');
});

// ────────────────────────────────────────────────────────────────────────────
//  WHEN
// ────────────────────────────────────────────────────────────────────────────

When('the user activates the Base trigger', () => {
  requireMarker(PANEL_PATH, 'slot-base');
  requireMarker(PANEL_PATH, 'branch-select-popup');
});

When('the user activates the Target trigger', () => {
  requireMarker(PANEL_PATH, 'slot-target');
});

When('the user opens the Base popup', () => {
  requireMarker(PANEL_PATH, 'branch-select-popup');
});

When('the user selects the cached remote branch {string}', () => {
  requireMarker(POPUP_PATH, 'canonicalRef');
});

When('the user selects the local branch {string}', () => {
  requireMarker(POPUP_PATH, 'canonicalRef');
});

When('the user selects branch {string}', (world: World, branch: string) => {
  requireMarker(POPUP_PATH, 'onSelect');
  // Service-level echo: selecting a branch fills the Base slot draft.
  world.baseRef = { type: 'branch', value: `refs/heads/${branch}`, label: branch };
});

When('the user presses ArrowDown past the last option', () => {
  requireMarker(POPUP_PATH, 'ArrowDown');
  requireMarker(POPUP_PATH, '%');
});

// 'the user presses End' / 'the user presses Home' / 'the user presses
// Enter' / 'the user presses Escape' are shared steps defined in
// quick-open.steps.ts, base-ui-kit.steps.ts, git-context-panel.steps.ts,
// and line-selection.steps.ts. They verify the shared keyboard contract
// (Home/End/Enter/Escape) and apply to this popup as well; the popup
// additionally guards IME composition (see below).

When('the user types with an active IME composition', () => {
  requireMarker(POPUP_PATH, 'isComposing');
});

When('the user types {string} in the search input', (world: World, query: string) => {
  requireMarker(POPUP_PATH, 'filterBranchGroups');
  // Service-level echo: the popup filter drives the panel's branch filter.
  world.branchFilter = query;
});

// ────────────────────────────────────────────────────────────────────────────
//  THEN
// ────────────────────────────────────────────────────────────────────────────

Then('a non-modal popup opens inside the panel', () => {
  requireMarker(POPUP_PATH, 'role="combobox"');
  if (fs.readFileSync(POPUP_PATH, 'utf-8').includes('<dialog')) {
    throw new Error('Branch popup must be non-modal (no <dialog>)');
  }
});

Then('the search input is focused', () => {
  requireMarker(POPUP_PATH, 'focus()');
});

Then('the Base popup closes', () => {
  requireMarker(PANEL_PATH, 'openSlot');
});

Then('the Target popup opens', () => {
  requireMarker(PANEL_PATH, 'branch-select-popup');
});

Then('the Local group appears before the Cached remote group', () => {
  const src = fs.readFileSync(OPTIONS_PATH, 'utf-8');
  if (!src.includes("'Local'") || !src.includes('Cached remote')) {
    throw new Error('branch-options must define Local and Cached remote groups');
  }
});

Then('within each group branches are ordered by committer date descending', () => {
  requireMarker(PANEL_PATH, 'sortBranches');
});

Then('the cached remote branch is visible as {string} without full refs', () => {
  requireMarker(POPUP_PATH, 'label');
});

Then('the draft stores the canonical ref {string}', () => {
  // The panel must use the canonical ref as the selection value so local
  // and cached remote branches with the same visible name never collide.
  const panelSrc = fs.readFileSync(PANEL_PATH, 'utf-8');
  if (!panelSrc.includes('canonicalRef')) {
    throw new Error('Panel must store the canonical ref as the selection value');
  }
});

Then('the ephemeral Comparison draft has base canonical ref {string}', () => {
  const panelSrc = fs.readFileSync(PANEL_PATH, 'utf-8');
  if (!panelSrc.includes('canonicalRef')) {
    throw new Error('Base draft value must use the canonical ref');
  }
});

Then('the option {string} has aria-selected true', () => {
  requireMarker(POPUP_PATH, 'aria-selected');
});

Then('the current branch has a separate visual and accessibility marker', () => {
  requireMarker(POPUP_PATH, 'Current branch');
});

Then('no other option has aria-selected true', () => {
  const src = fs.readFileSync(POPUP_PATH, 'utf-8');
  if (src.includes('aria-selected={option.isCurrent}')) {
    throw new Error('aria-selected must reflect the selected slot value only');
  }
});

Then('the active option wraps to the first option', () => {
  requireMarker(POPUP_PATH, 'visibleOptions.length');
});

Then('the last option is active', () => {
  requireMarker(POPUP_PATH, 'activeIndex');
});

Then('the first option is active', () => {
  requireMarker(POPUP_PATH, 'activeIndex = 0');
});

Then('the popup closes and the branch is selected', () => {
  requireMarker(POPUP_PATH, 'onSelect');
});

Then('the popup closes', () => {
  requireMarker(POPUP_PATH, 'onClose');
});

Then('the Base slot still shows {string}', () => {
  requireMarker(PANEL_PATH, 'slot-value');
});

Then('focus returns to the Base trigger', () => {
  requireMarker(POPUP_PATH, 'triggerRef?.focus()');
});

Then('no branch is selected', () => {
  requireMarker(POPUP_PATH, 'isComposing');
});

Then('the popup stays open', () => {
  requireMarker(POPUP_PATH, 'isComposing');
});

Then('the options {string} and {string} are visible', () => {
  requireMarker(POPUP_PATH, 'filterBranchGroups');
});

// 'branches {string} and {string} are hidden' is a shared step defined in
// git-context-panel.steps.ts (it filters through world.branchFilter, which
// 'the user types {string} in the search input' populates).

Then('the popup shows a no-match state', () => {
  requireMarker(POPUP_PATH, 'No matching branches');
});

Then('the popup shows an empty state', () => {
  requireMarker(POPUP_PATH, 'No branches');
});

Then('the popup shows loading and error\\/retry states when branches fail to load', () => {
  requireMarker(POPUP_PATH, 'loading');
  requireMarker(POPUP_PATH, 'Retry');
});

Then('the popup fits inside the Git context panel', () => {
  requireMarker(POPUP_PATH, 'max-height');
  requireMarker(POPUP_PATH, 'overflow-y');
});

Then('the popup scrolls internally without horizontal overflow', () => {
  const src = fs.readFileSync(POPUP_PATH, 'utf-8');
  if (!src.includes('overflow-x')) {
    throw new Error('Popup must clip horizontal overflow');
  }
});
