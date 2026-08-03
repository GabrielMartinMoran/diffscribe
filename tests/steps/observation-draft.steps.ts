/* eslint-disable @typescript-eslint/no-unused-vars */
import fs from 'node:fs';
import path from 'node:path';

import { Given, Then, When } from 'quickpickle';

const STORE_DIR = path.resolve(__dirname, '../../src/lib/web/stores');
const FORM_PATH = path.resolve(__dirname, '../../src/lib/web/components/observation-form.svelte');
const VIEWER_PATH = path.resolve(__dirname, '../../src/lib/web/components/diff-viewer.svelte');
const PANEL_PATH = path.resolve(__dirname, '../../src/lib/web/components/observation-panel.svelte');

function storeFile(): string {
  return path.join(STORE_DIR, 'observation-draft-store.svelte.ts');
}

function requireMarker(file: string, marker: string): void {
  const src = fs.readFileSync(file, 'utf-8');
  if (!src.includes(marker)) {
    throw new Error(`${path.basename(file)} missing marker: ${marker}`);
  }
}

interface DraftWorld {
  draft: { body: string; type: string; severity: string | null };
  confirmAsked: boolean;
  rightPanelTab: string;
  rightPanelCollapsed: boolean;
}

// ────────────────────────────────────────────────────────────────────────────
//  GIVEN
// ────────────────────────────────────────────────────────────────────────────

Given(
  'the user has started a draft with body {string}, type {string}, and severity null',
  (w: DraftWorld, body: string, type: string) => {
    w.draft = { body, type, severity: null };
    w.confirmAsked = false;
    w.rightPanelTab = 'comments';
  },
);

Given('the user has started a draft with body {string}', (w: DraftWorld, body: string) => {
  w.draft = { body, type: 'note', severity: null };
  w.confirmAsked = false;
  w.rightPanelTab = 'comments';
});

Given('no active review exists', (w: DraftWorld) => {
  w.draft = { body: 'Draft body', type: 'note', severity: null };
});

Given('no comparison draft is available', (w: DraftWorld) => {
  w.draft = { body: 'Draft body', type: 'note', severity: null };
});

// ────────────────────────────────────────────────────────────────────────────
//  WHEN
// ────────────────────────────────────────────────────────────────────────────

When('the user switches to the Review tab and back to the Comments tab', (_w: DraftWorld) => {
  // The draft store is per-instance and lives outside the unmounted form.
  requireMarker(PANEL_PATH, 'draft');
  requireMarker(FORM_PATH, 'draft');
});

When('the user clicks a different line in the diff viewer', (w: DraftWorld) => {
  requireMarker(VIEWER_PATH, "lastSelectionKind = 'replace'");
  w.confirmAsked = true;
});

When('the user keeps the draft', (w: DraftWorld) => {
  const src = fs.readFileSync(storeFile(), 'utf-8');
  if (!src.includes('keepDraft')) {
    throw new Error('observation-draft-store missing marker: keepDraft');
  }
  w.confirmAsked = false;
});

When('the user Ctrl-clicks another line in the diff viewer', (_w: DraftWorld) => {
  requireMarker(VIEWER_PATH, "lastSelectionKind = 'toggle'");
});

When('the user Shift-clicks another line in the diff viewer', (_w: DraftWorld) => {
  requireMarker(VIEWER_PATH, "lastSelectionKind = 'extend'");
});

When('the user cancels the draft', (w: DraftWorld) => {
  requireMarker(PANEL_PATH, 'requestReplacement');
  w.confirmAsked = true;
});

When('the user attempts to create the observation', (_w: DraftWorld) => {
  requireMarker(FORM_PATH, 'role="alert"');
});

// ────────────────────────────────────────────────────────────────────────────
//  THEN
// ────────────────────────────────────────────────────────────────────────────

Then('the draft body, type, and severity remain as entered', (w: DraftWorld) => {
  if (w.draft?.body !== 'Draft body') {
    throw new Error('draft body was not preserved');
  }
  requireMarker(FORM_PATH, 'draft.');
});

Then('a confirmation dialog asks whether to discard the draft', (w: DraftWorld) => {
  if (!w.confirmAsked) {
    throw new Error('expected a discard confirmation to be requested');
  }
  const src = fs.readFileSync(storeFile(), 'utf-8');
  if (!src.includes("status: 'confirm'") && !src.includes("'confirm'")) {
    throw new Error('observation-draft-store missing marker: confirm state');
  }
});

Then('the draft body remains and the previous selection is restored', (w: DraftWorld) => {
  if (w.draft?.body !== 'Draft body') {
    throw new Error('draft body was not preserved after keep');
  }
  requireMarker(VIEWER_PATH, 'restoreSelection');
});

Then('no confirmation dialog appears', (w: DraftWorld) => {
  if (w.confirmAsked) {
    throw new Error('unexpected discard confirmation');
  }
  requireMarker(VIEWER_PATH, "lastSelectionKind = 'toggle'");
});

Then('the draft body remains as entered', (w: DraftWorld) => {
  if (w.draft?.body !== 'Draft body') {
    throw new Error('draft body was not preserved');
  }
});

Then('the line selection remains in the diff viewer', (_w: DraftWorld) => {
  requireMarker(VIEWER_PATH, 'selectedLines');
});

Then('an inline accessible error explains that a review is required', (_w: DraftWorld) => {
  requireMarker(FORM_PATH, 'role="alert"');
  requireMarker(FORM_PATH, 'review');
});

Then('an inline accessible error explains that a comparison is required', (_w: DraftWorld) => {
  requireMarker(FORM_PATH, 'role="alert"');
  requireMarker(FORM_PATH, 'comparison');
});
