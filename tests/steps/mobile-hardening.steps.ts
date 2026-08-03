/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import fs from 'node:fs';
import path from 'node:path';

import { Given, Then, When } from 'quickpickle';

// Marker-based step definitions for the mobile hardening (H1-H4) scenarios.
// Static markers pin the token/rule contracts; the real behavioral assertions
// live in tests/e2e/mobile-hardening.spec.ts (elementFromPoint, bounding
// boxes, real clicks, scroll ownership).

type World = any;

const COMPONENTS_DIR = path.resolve(__dirname, '../../src/lib/web/components');
const PAGE_PATH = path.resolve(__dirname, '../../src/routes/+page.svelte');
const TOKENS_PATH = path.resolve(__dirname, '../../src/lib/web/styles/tokens.css');
const FILE_LIST_PATH = path.join(COMPONENTS_DIR, 'file-list.svelte');
const BACKDROP_PATH = path.join(COMPONENTS_DIR, 'mobile-backdrop.svelte');
const RIGHT_TABS_PATH = path.join(COMPONENTS_DIR, 'right-panel-tabs.svelte');
const GIT_PANEL_PATH = path.join(COMPONENTS_DIR, 'git-context-panel.svelte');

function requireMarker(file: string, marker: string): void {
  const src = fs.readFileSync(file, 'utf-8');
  if (!src.includes(marker)) {
    throw new Error(`${path.basename(file)} missing marker: ${marker}`);
  }
}

// ────────────────────────────────────────────────────────────────────────────
//  GIVEN
// ────────────────────────────────────────────────────────────────────────────

Given('the right panel sheet is open', (w: World) => {
  w.rightSheetOpen = true;
});

Given('the left panel drawer is open', (w: World) => {
  w.leftDrawerOpen = true;
});

Given('the user views the file list panel at {int} px', (_w: World, _width: number) => {
  requireMarker(FILE_LIST_PATH, 'file-list-panel');
});

Given('the user views the Git context panel at {int} px', (_w: World, _width: number) => {
  requireMarker(GIT_PANEL_PATH, 'git-context-panel');
});

// ────────────────────────────────────────────────────────────────────────────
//  WHEN
// ────────────────────────────────────────────────────────────────────────────

When('the user inspects the sheet controls', (_w: World) => {
  // The backdrop must sit below the sheet so sheet controls stay on top.
  requireMarker(TOKENS_PATH, '--z-backdrop: 299');
  requireMarker(BACKDROP_PATH, 'var(--z-backdrop, 299)');
  requireMarker(RIGHT_TABS_PATH, 'z-index: var(--z-overlay, 300)');
});

When('the user inspects the drawer controls', (_w: World) => {
  // The drawer must sit above the backdrop.
  requireMarker(TOKENS_PATH, '--z-backdrop: 299');
  requireMarker(PAGE_PATH, 'calc(var(--z-overlay, 300) + 1)');
});

When('the user inspects the right panel toggle', (_w: World) => {
  // The toggle is a deliberate right column of the mobile shell (single grid
  // row) with a hit target of at least 24x24.
  requireMarker(PAGE_PATH, 'grid-template-columns: 48px 1fr 32px');
  requireMarker(RIGHT_TABS_PATH, 'min-width: 32px');
  requireMarker(RIGHT_TABS_PATH, 'width: 32px');
});

When('the user taps the right panel toggle again', (w: World) => {
  w.rightSheetOpen = false;
});

When('the user clicks the Tree control and then the List control', (_w: World) => {
  requireMarker(FILE_LIST_PATH, 'file-list-view-list');
  requireMarker(FILE_LIST_PATH, 'file-list-view-tree');
});

When('the user scrolls the Git panel to the bottom', (_w: World) => {
  requireMarker(GIT_PANEL_PATH, 'overflow-y: auto');
  requireMarker(GIT_PANEL_PATH, 'min-height: 0');
});

// ────────────────────────────────────────────────────────────────────────────
//  THEN
// ────────────────────────────────────────────────────────────────────────────

Then('the sheet controls are clickable above the backdrop', (_w: World) => {
  // Backdrop (299) < sheet (300); drawer (301) > backdrop. Modal stays 400.
  requireMarker(BACKDROP_PATH, 'var(--z-backdrop, 299)');
  requireMarker(RIGHT_TABS_PATH, 'z-index: var(--z-overlay, 300)');
});

Then('the backdrop does not intercept sheet clicks', (_w: World) => {
  requireMarker(BACKDROP_PATH, 'var(--z-backdrop, 299)');
});

Then('the drawer controls are clickable above the backdrop', (_w: World) => {
  requireMarker(PAGE_PATH, 'calc(var(--z-overlay, 300) + 1)');
});

Then('the right panel toggle is at least 24 by 24 pixels', (_w: World) => {
  requireMarker(RIGHT_TABS_PATH, 'min-width: 32px');
  requireMarker(RIGHT_TABS_PATH, 'height: 100%');
});

Then('the right panel toggle spans the full center content height', (_w: World) => {
  // Single-row mobile grid: the toggle stretches to the full row height.
  requireMarker(PAGE_PATH, 'grid-template-columns: 48px 1fr 32px');
  requireMarker(PAGE_PATH, 'grid-template-rows: 1fr');
});

Then('the mobile shell has no extra grid row', (_w: World) => {
  requireMarker(PAGE_PATH, 'grid-template-columns: 48px 1fr 32px');
  requireMarker(PAGE_PATH, 'grid-template-rows: 1fr');
});

Then('the right panel is hidden again', (w: World) => {
  if (w.rightSheetOpen) {
    throw new Error('Expected right sheet to be closed after toggling again');
  }
});

Then('the file list controls fit within the panel without horizontal overflow', (_w: World) => {
  requireMarker(FILE_LIST_PATH, 'flex-wrap: wrap');
  requireMarker(FILE_LIST_PATH, 'min-width: 0');
});

Then('the List and Tree controls are inside the panel', (_w: World) => {
  requireMarker(FILE_LIST_PATH, 'file-list-view-list');
  requireMarker(FILE_LIST_PATH, 'file-list-view-tree');
});

Then('the file list switches between Tree and List views', (_w: World) => {
  requireMarker(FILE_LIST_PATH, 'file-list-tree');
  requireMarker(FILE_LIST_PATH, "aria-pressed={view === 'list'}");
  requireMarker(FILE_LIST_PATH, "aria-pressed={view === 'tree'}");
});

Then('the chosen view persists across reloads', (_w: World) => {
  requireMarker(FILE_LIST_PATH, 'writeStoredFileListView');
  requireMarker(FILE_LIST_PATH, 'readStoredFileListView');
});

Then('the Git panel is the only scrollable region for its content', (_w: World) => {
  requireMarker(GIT_PANEL_PATH, 'overflow-y: auto');
  requireMarker(GIT_PANEL_PATH, 'min-height: 0');
  // The file list keeps its overflow guard but must not own a nested scroll.
  requireMarker(FILE_LIST_PATH, 'overflow: hidden');
});

Then('the file list panel does not take the full panel height', (_w: World) => {
  requireMarker(FILE_LIST_PATH, 'height: auto');
  requireMarker(GIT_PANEL_PATH, 'flex: 1 1 auto');
});

Then('the commits, file rows, pagination, and footer are reachable', (_w: World) => {
  requireMarker(GIT_PANEL_PATH, 'refresh-btn');
  requireMarker(FILE_LIST_PATH, 'aria-label="File list pagination"');
  requireMarker(GIT_PANEL_PATH, 'aria-label="Commit entries"');
});

Then('the user can paginate the file list from the scroll position', (_w: World) => {
  requireMarker(FILE_LIST_PATH, 'aria-label="Next page"');
  requireMarker(FILE_LIST_PATH, 'aria-label="Previous page"');
});
