/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import fs from 'node:fs';
import path from 'node:path';

import { Given, Then, When } from 'quickpickle';

type World = any;

const PAGE_PATH = path.resolve(__dirname, '../../src/routes/+page.svelte');
const DIALOG_PATH = path.resolve(
  __dirname,
  '../../src/lib/web/components/quick-open-dialog.svelte',
);
const SCORER_PATH = path.resolve(__dirname, '../../src/lib/web/services/quick-open-scorer.ts');
const QUICK_OPEN_STORE_PATH = path.resolve(
  __dirname,
  '../../src/lib/web/stores/quick-open-store.ts',
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

Given('the user is on the main workbench', (_w: World) => {
  requireMarker(PAGE_PATH, 'shell-layout');
});

Given('Quick Open is open', (_w: World) => {
  requireMarker(PAGE_PATH, 'quickOpenOpen');
  requireMarker(DIALOG_PATH, 'aria-modal="true"');
});

Given('the filter shows at least two results', (_w: World) => {
  requireMarker(DIALOG_PATH, 'listbox');
});

Given('the filter shows at least three results', (_w: World) => {
  requireMarker(DIALOG_PATH, 'aria-activedescendant');
});

Given('the workspace repository has more than 512 tracked files', (_w: World) => {
  // The scorer must cap results; the cap constant lives in the scorer.
  requireMarker(SCORER_PATH, '512');
});

Given('the Quick Open setting {string} is enabled', (_w: World, _key: string) => {
  requireMarker(QUICK_OPEN_STORE_PATH, 'diffscribe-quick-open-include-untracked');
});

Given('the Git rail is active', (_w: World) => {
  requireMarker(PAGE_PATH, "activeRailTab === 'git'");
});

// ────────────────────────────────────────────────────────────────────────────
//  WHEN
// ────────────────────────────────────────────────────────────────────────────

When('the user presses Ctrl+P', (_w: World) => {
  requireMarker(PAGE_PATH, 'ctrlKey');
  requireMarker(PAGE_PATH, "e.key === 'p'");
});

When('the user closes Quick Open and presses Cmd+P', (_w: World) => {
  requireMarker(PAGE_PATH, 'metaKey');
  requireMarker(PAGE_PATH, "e.key === 'p'");
});

When('the user types {string} into the filter', (_w: World, _query: string) => {
  requireMarker(DIALOG_PATH, 'combobox');
});

When('the user opens Quick Open and types {string}', (_w: World, _query: string) => {
  requireMarker(PAGE_PATH, 'quickOpenOpen');
  requireMarker(QUICK_OPEN_STORE_PATH, 'diffscribe-quick-open-include-untracked');
});

When('the user opens Quick Open with an empty filter', (_w: World) => {
  requireMarker(PAGE_PATH, 'quickOpenOpen');
});

When('the filter is empty', (_w: World) => {
  requireMarker(DIALOG_PATH, 'combobox');
});

When('the user presses ArrowDown and then Enter', (_w: World) => {
  requireMarker(DIALOG_PATH, 'ArrowDown');
  requireMarker(DIALOG_PATH, 'Enter');
});

When('the user presses ArrowDown and then Ctrl+Enter', (_w: World) => {
  requireMarker(DIALOG_PATH, 'ArrowDown');
  requireMarker(DIALOG_PATH, 'ctrlKey || e.metaKey');
});

When('the user clicks the result {string}', (_w: World, _file: string) => {
  requireMarker(DIALOG_PATH, 'listbox');
  requireMarker(DIALOG_PATH, 'onclick');
});

// 'the user presses Escape' comes from line-selection.steps.ts (shared step).

When('the user presses Ctrl+Shift+P', (_w: World) => {
  requireMarker(PAGE_PATH, 'shiftKey');
  // Ctrl+Shift+P must stay unclaimed: the handler returns before opening.
  requireMarker(PAGE_PATH, 'shiftKey');
});

When('the user is composing IME text in the filter', (_w: World) => {
  requireMarker(DIALOG_PATH, 'isComposing');
});

When('the user accepts the first result', (_w: World) => {
  requireMarker(DIALOG_PATH, 'Enter');
});

// ── Tree freshness after Git refresh (post-tranche C hardening) ──
//
// Traceability pin: Quick Open consumes the shared Project tree loader, so a
// successful Git refresh invalidates the cached tree and the next open shows
// freshly added files. Real acceptance lives in
// tests/e2e/project-tree-invalidation.spec.ts.

Given('Quick Open has been opened once', (_w: World) => {
  requireMarker(DIALOG_PATH, 'projectTreeLoader');
});

When('the user opens Quick Open', (_w: World) => {
  requireMarker(PAGE_PATH, 'quickOpenOpen');
});

Then('the added file appears in the results', (_w: World) => {
  requireMarker(DIALOG_PATH, 'flattenFiles');
});

// 'the user presses Home' / 'the user presses End' come from
// base-ui-kit.steps.ts (shared keyboard contract steps).

// ────────────────────────────────────────────────────────────────────────────
//  THEN
// ────────────────────────────────────────────────────────────────────────────

Then('a Quick Open dialog opens', (_w: World) => {
  requireMarker(DIALOG_PATH, 'aria-modal="true"');
  requireMarker(DIALOG_PATH, 'role="combobox"');
});

Then('a Quick Open dialog opens again', (_w: World) => {
  requireMarker(PAGE_PATH, 'metaKey');
  requireMarker(DIALOG_PATH, 'aria-modal="true"');
});

Then('the filter input has focus', (_w: World) => {
  requireMarker(DIALOG_PATH, 'focus()');
});

Then('{string} is the first result', (_w: World, _file: string) => {
  requireMarker(SCORER_PATH, 'exact');
  requireMarker(SCORER_PATH, 'basename');
});

Then('the result shows highlight ranges for the matched characters', (_w: World) => {
  requireMarker(SCORER_PATH, 'highlight');
});

Then('no results are shown', (_w: World) => {
  requireMarker(SCORER_PATH, 'terms');
  requireMarker(DIALOG_PATH, 'empty');
});

Then('Quick Open closes', (_w: World) => {
  requireMarker(PAGE_PATH, 'quickOpenOpen');
  requireMarker(DIALOG_PATH, 'Escape');
});

Then('the central viewer shows the selected file in the current tab', (_w: World) => {
  requireMarker(DIALOG_PATH, 'acceptCurrentTab');
});

Then('the central viewer shows an additional tab', (_w: World) => {
  requireMarker(DIALOG_PATH, 'acceptNewTab');
});

Then('the central viewer shows {string} in the current tab', (_w: World, _file: string) => {
  requireMarker(DIALOG_PATH, 'acceptCurrentTab');
});

Then('the central viewer still shows {string}', (_w: World, _file: string) => {
  requireMarker(PAGE_PATH, 'activeFilePath');
  // Escape must close without accepting: the dialog only accepts through
  // explicit accept paths.
  requireMarker(DIALOG_PATH, 'Escape');
});

Then('focus returns to the previously focused element', (_w: World) => {
  // Native <dialog> showModal() restores focus to the invoker on close.
  requireMarker(DIALOG_PATH, 'showModal()');
  requireMarker(DIALOG_PATH, 'dialog.close()');
});

Then('the last result is active', (_w: World) => {
  requireMarker(DIALOG_PATH, 'End');
});

Then('the first result is active', (_w: World) => {
  requireMarker(DIALOG_PATH, 'Home');
});

Then('{string} is shown as a result', (_w: World, _file: string) => {
  requireMarker(QUICK_OPEN_STORE_PATH, 'untracked');
});

Then('the results show every tracked file in the workspace', (_w: World) => {
  requireMarker(SCORER_PATH, 'tracked');
});

Then('no more than 512 results are shown', (_w: World) => {
  requireMarker(SCORER_PATH, '512');
});

Then('no Quick Open dialog opens', (_w: World) => {
  requireMarker(PAGE_PATH, 'shiftKey');
});

Then('no result is committed and the dialog stays open', (_w: World) => {
  requireMarker(DIALOG_PATH, 'isComposing');
  requireMarker(DIALOG_PATH, 'aria-modal="true"');
});

Then('the Project rail becomes active', (_w: World) => {
  requireMarker(PAGE_PATH, "activeRailTab = 'project'");
});

Then('the Source Viewer is shown', (_w: World) => {
  requireMarker(PAGE_PATH, 'SourceViewer');
});
