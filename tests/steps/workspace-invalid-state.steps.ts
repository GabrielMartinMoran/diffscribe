/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import fs from 'node:fs';
import path from 'node:path';

import { Given, Then, When } from 'quickpickle';

type World = any;

const NAV_ITEM_PATH = path.resolve(
  __dirname,
  '../../src/lib/web/components/workspace-nav-item.svelte',
);
const DIALOG_PATH = path.resolve(__dirname, '../../src/lib/web/components/ui/Dialog.svelte');
const REPAIR_FORM_PATH = path.resolve(
  __dirname,
  '../../src/lib/web/components/workspace-repair-form.svelte',
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

Given('a workspace is listed in the sidebar with status {string}', (w: World, status: string) => {
  w.workspaceStatus = status;
  requireMarker(NAV_ITEM_PATH, 'data-workspace-select');
});

// ────────────────────────────────────────────────────────────────────────────
//  WHEN
// ────────────────────────────────────────────────────────────────────────────

When('the user activates the warning icon of the invalid workspace', (_w: World) => {
  requireMarker(NAV_ITEM_PATH, 'warning');
});

When('the user closes the dialog', (_w: World) => {
  requireMarker(DIALOG_PATH, 'onclose');
});

When('the user activates the Repair action in the dialog', (_w: World) => {
  requireMarker(NAV_ITEM_PATH, "'repair'");
});

// ────────────────────────────────────────────────────────────────────────────
//  THEN
// ────────────────────────────────────────────────────────────────────────────

Then('the workspace item does not show an {string} text badge', (w: World, badge: string) => {
  const src = fs.readFileSync(NAV_ITEM_PATH, 'utf-8');
  if (src.includes(`${badge}-badge`)) {
    throw new Error(`workspace-nav-item still renders the "${badge}-badge"`);
  }
});

Then('the workspace item shows a warning icon with an accessible name', (_w: World) => {
  requireMarker(NAV_ITEM_PATH, 'aria-label');
  requireMarker(NAV_ITEM_PATH, 'warning');
});

Then('a dialog opens with a Repair action and a Close action', (_w: World) => {
  requireMarker(DIALOG_PATH, 'aria-labelledby');
  requireMarker(NAV_ITEM_PATH, "'repair'");
  requireMarker(NAV_ITEM_PATH, 'Close');
});

Then('the dialog closes and the workspace list remains visible', (_w: World) => {
  requireMarker(DIALOG_PATH, 'onclose');
  requireMarker(NAV_ITEM_PATH, 'data-workspace-select');
});

Then('the existing repair form appears for the workspace', (_w: World) => {
  requireMarker(REPAIR_FORM_PATH, 'data-repair-form');
  requireMarker(NAV_ITEM_PATH, 'WorkspaceRepairForm');
});
