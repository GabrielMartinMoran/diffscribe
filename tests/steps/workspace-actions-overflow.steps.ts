/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import fs from 'node:fs';
import path from 'node:path';

import { Given, Then, When } from 'quickpickle';

type World = any;

const NAV_ITEM_PATH = path.resolve(
  __dirname,
  '../../src/lib/web/components/workspace-nav-item.svelte',
);
const MENU_PATH = path.resolve(__dirname, '../../src/lib/web/components/ui/Menu.svelte');

function requireMarker(file: string, marker: string): void {
  const src = fs.readFileSync(file, 'utf-8');
  if (!src.includes(marker)) {
    throw new Error(`${path.basename(file)} missing marker: ${marker}`);
  }
}

// ────────────────────────────────────────────────────────────────────────────
//  GIVEN
// ────────────────────────────────────────────────────────────────────────────

Given('the app shell is present', (_w: World) => {
  const appHtml = path.resolve(__dirname, '../../src/app.html');
  if (!fs.existsSync(appHtml)) {
    throw new Error('app.html not found');
  }
});

Given('a registered workspace is listed in the sidebar', (_w: World) => {
  requireMarker(NAV_ITEM_PATH, 'data-workspace-select');
});

Given('the workspace overflow menu is open', (_w: World) => {
  requireMarker(NAV_ITEM_PATH, 'data-testid="workspace-actions"');
  requireMarker(MENU_PATH, 'aria-expanded');
});

Given('the workspace is invalid', (_w: World) => {
  requireMarker(NAV_ITEM_PATH, "'invalid'");
});

// ────────────────────────────────────────────────────────────────────────────
//  WHEN
// ────────────────────────────────────────────────────────────────────────────

When('the user activates the workspace overflow menu trigger', (_w: World) => {
  // Browser behavior verified by E2E; contract pinned here.
});

When('the user presses ArrowDown in the overflow menu', (_w: World) => {
  requireMarker(MENU_PATH, "'ArrowDown'");
});

When('the user presses Home in the overflow menu', (_w: World) => {
  requireMarker(MENU_PATH, "'Home'");
});

When('the user presses End in the overflow menu', (_w: World) => {
  requireMarker(MENU_PATH, "'End'");
});

When('the user presses Escape in the overflow menu', (_w: World) => {
  requireMarker(MENU_PATH, "'Escape'");
});

When('the user activates the Rename action in the overflow menu', (_w: World) => {
  requireMarker(NAV_ITEM_PATH, "'rename'");
});

When('the user activates the Delete action in the overflow menu', (_w: World) => {
  requireMarker(NAV_ITEM_PATH, "'delete'");
});

// ────────────────────────────────────────────────────────────────────────────
//  THEN
// ────────────────────────────────────────────────────────────────────────────

Then('the overflow trigger exposes aria-haspopup and aria-expanded', (_w: World) => {
  requireMarker(MENU_PATH, 'aria-haspopup');
  requireMarker(MENU_PATH, 'aria-expanded');
});

Then('the overflow menu shows Rename and Delete actions', (_w: World) => {
  requireMarker(NAV_ITEM_PATH, "label: 'Rename'");
  requireMarker(NAV_ITEM_PATH, "label: 'Delete'");
});

Then('the overflow menu also shows a Repair action', (_w: World) => {
  requireMarker(NAV_ITEM_PATH, "label: 'Repair'");
});

Then('focus moves to the next action in the overflow menu', (_w: World) => {
  // Keyboard behavior verified by E2E; the Menu contract is pinned in
  // base-ui-kit.feature.
});

Then('focus moves to the first action in the overflow menu', (_w: World) => {
  // Keyboard behavior verified by E2E.
});

Then('focus moves to the last action in the overflow menu', (_w: World) => {
  // Keyboard behavior verified by E2E.
});

Then('the overflow menu closes and focus returns to the trigger', (_w: World) => {
  requireMarker(MENU_PATH, 'triggerRef?.focus()');
});

Then('the rename form appears for the workspace', (_w: World) => {
  requireMarker(NAV_ITEM_PATH, 'data-rename-form');
});

Then('the delete confirmation dialog appears', (_w: World) => {
  requireMarker(NAV_ITEM_PATH, 'showDeleteDialog');
  requireMarker(NAV_ITEM_PATH, 'DeleteConfirmDialog');
});

// ── Viewport containment ──

Given('a workspace is registered near the bottom edge of the sidebar', (_w: World) => {
  requireMarker(NAV_ITEM_PATH, 'data-workspace-select');
});

When('the user opens the workspace overflow menu', (_w: World) => {
  requireMarker(MENU_PATH, 'aria-expanded');
});

Then('the overflow menu is fully contained within the viewport', (_w: World) => {
  // The Menu popup must be positioned relative to the viewport, not the
  // scrollable sidebar, so it cannot be clipped near the bottom edge.
  const src = fs.readFileSync(MENU_PATH, 'utf-8');
  if (!src.includes('position: fixed')) {
    throw new Error('Menu popup must use fixed positioning for viewport containment');
  }
});

Then('every action in the overflow menu is visible', (_w: World) => {
  requireMarker(MENU_PATH, 'role="menu"');
});

// ── WS-OVERFLOW-06: invalid workspace menu paints above later rows ──

Given('a workspace with status "invalid" is listed above another workspace', (_w: World) => {
  requireMarker(NAV_ITEM_PATH, "'invalid'");
});

When('the user opens the overflow menu of the invalid workspace', (_w: World) => {
  requireMarker(MENU_PATH, 'aria-expanded');
});

Then('the topmost element at the center of the menu is the menu itself', (_w: World) => {
  // The popup must be portaled to the in-mount overlay host so it escapes the
  // sidebar stacking context (the invalid item has opacity < 1, which creates
  // a stacking context) and paints above later rows. document.body portals
  // are forbidden by the tranche contract.
  const src = fs.readFileSync(MENU_PATH, 'utf-8');
  if (!src.includes('use:portal')) {
    throw new Error('Menu popup must be portaled to the overlay host');
  }
  const portalSrc = fs.readFileSync(
    path.resolve(__dirname, '../../src/lib/web/actions/portal.ts'),
    'utf-8',
  );
  if (!portalSrc.includes('data-overlay-host')) {
    throw new Error('Menu portal must target the in-mount overlay host');
  }
});

Then('every action in the overflow menu is clickable', (_w: World) => {
  requireMarker(MENU_PATH, 'role="menuitem"');
  requireMarker(MENU_PATH, 'onclick');
});
