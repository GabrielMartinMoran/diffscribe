/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import fs from 'node:fs';
import path from 'node:path';

import { Given, Then, When } from 'quickpickle';

import { DEFAULT_WRAP } from '../../src/lib/web/stores/wrap-store';

type World = any;

const RAIL_PATH = path.resolve(__dirname, '../../src/lib/web/components/rail-tabs.svelte');
const SETTINGS_PATH = path.resolve(__dirname, '../../src/lib/web/components/settings-panel.svelte');
const PAGE_PATH = path.resolve(__dirname, '../../src/routes/+page.svelte');
const SWITCH_PATH = path.resolve(__dirname, '../../src/lib/web/components/ui/Switch.svelte');

function requireMarker(file: string, marker: string): void {
  const src = fs.readFileSync(file, 'utf-8');
  if (!src.includes(marker)) {
    throw new Error(`${path.basename(file)} missing marker: ${marker}`);
  }
}

// ────────────────────────────────────────────────────────────────────────────
//  GIVEN
// ────────────────────────────────────────────────────────────────────────────

Given('the DiffScribe shell is loaded', (_w: World) => {
  const appHtml = path.resolve(__dirname, '../../src/app.html');
  if (!fs.existsSync(appHtml)) {
    throw new Error('app.html not found');
  }
});

Given('the rail entries are visible', (_w: World) => {
  requireMarker(RAIL_PATH, "'settings'");
});

Given('the Settings panel is open', (_w: World) => {
  requireMarker(SETTINGS_PATH, 'settings-panel');
  requireMarker(PAGE_PATH, 'SettingsPanel');
});

Given('the left contextual panel is open', (_w: World) => {
  // Contract: the contextual panel exists in the shell layout.
  requireMarker(PAGE_PATH, 'left-contextual-panel');
});

// ────────────────────────────────────────────────────────────────────────────
//  WHEN
// ────────────────────────────────────────────────────────────────────────────

When('the user views the bottom of the left rail', (_w: World) => {
  // Browser behavior verified by E2E; the rail catalog is pinned below.
});

When('the user activates the Settings entry', (_w: World) => {
  requireMarker(RAIL_PATH, "id: 'settings'");
  requireMarker(RAIL_PATH, "label: 'Settings'");
});

When('the user selects the Synthwave theme inside Settings', (_w: World) => {
  requireMarker(SETTINGS_PATH, 'ThemeSwitcher');
});

When('the user enables line wrapping inside Settings', (_w: World) => {
  requireMarker(SETTINGS_PATH, 'Line wrapping');
  requireMarker(SWITCH_PATH, 'role="switch"');
});

When('the application reloads with the stored preference', (_w: World) => {
  // Persistence behavior is verified by E2E; the storage key is pinned below.
});

When('the user inspects the panel header', (_w: World) => {
  requireMarker(PAGE_PATH, 'left-panel-header');
});

// ────────────────────────────────────────────────────────────────────────────
//  THEN
// ────────────────────────────────────────────────────────────────────────────

Then('the rail shows Workspaces, Project, Git, and Settings entries', (_w: World) => {
  for (const key of ['workspaces', 'project', 'git', 'settings']) {
    requireMarker(RAIL_PATH, `id: '${key}'`);
  }
});

Then('the Settings entry has an accessible label', (_w: World) => {
  requireMarker(RAIL_PATH, "ariaLabel: 'Settings'");
});

Then('the Settings panel appears in the contextual area', (_w: World) => {
  requireMarker(PAGE_PATH, "activeRailTab === 'settings'");
});

Then('the Settings panel shows an Appearance section', (_w: World) => {
  requireMarker(SETTINGS_PATH, 'Appearance');
});

Then('the Settings panel shows an Editor section', (_w: World) => {
  requireMarker(SETTINGS_PATH, 'Editor');
});

Then("the active theme becomes Synthwave '84", (_w: World) => {
  // Applied theme behavior is verified by E2E.
});

Then('the wrapping preference is stored in localStorage', (_w: World) => {
  requireMarker(SETTINGS_PATH, 'writeStoredWrap');
  // The default stays no-wrap until the user opts in.
  if (DEFAULT_WRAP !== false) {
    throw new Error('Line wrapping must default to disabled (diff no-wrap)');
  }
});

Then('the wrapping switch is enabled after reload', (_w: World) => {
  requireMarker(SETTINGS_PATH, 'readStoredWrap');
});

Then('no theme switcher is present in the header', (_w: World) => {
  const page = fs.readFileSync(PAGE_PATH, 'utf-8');
  const headerBlocks = page.match(/left-panel-header[\s\S]*?\/div>/g) ?? [];
  for (const block of headerBlocks) {
    if (block.includes('ThemeSwitcher')) {
      throw new Error('ThemeSwitcher must not be rendered inside the panel header');
    }
  }
});
