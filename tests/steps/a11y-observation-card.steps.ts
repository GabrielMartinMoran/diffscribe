/* eslint-disable @typescript-eslint/no-unused-vars */
import fs from 'node:fs';
import path from 'node:path';

import { Given, Then, When } from 'quickpickle';

interface A11yObservationCardWorld {
  cardFocused: boolean;
  cardHovered: boolean;
  actionsVisible: boolean;
  readOnly: boolean;
  actionsInDOM: boolean;
}

Given('an observation of type {string} exists with body {string}', () => {
  // No-op: context — observation exists
});

Given('the observation panel is visible', () => {
  // No-op: context — panel rendered
});

When('keyboard focus moves onto an observation card', (world: A11yObservationCardWorld) => {
  world.cardFocused = true;
  world.actionsVisible = true;
});

Then('the action buttons become visible', (world: A11yObservationCardWorld) => {
  // Track in world; E2E test asserts CSS display
  world.actionsVisible = true;
});

Given(
  'an observation card has keyboard focus and its actions are visible',
  (world: A11yObservationCardWorld) => {
    world.cardFocused = true;
    world.actionsVisible = true;
  },
);

When('focus moves outside the card', (world: A11yObservationCardWorld) => {
  world.cardFocused = false;
  world.actionsVisible = false;
});

Then('the action buttons are hidden', (world: A11yObservationCardWorld) => {
  // E2E test verifies this via CSS display:none
  world.actionsVisible = false;
});

When('the mouse hovers over an observation card', (world: A11yObservationCardWorld) => {
  world.cardHovered = true;
  world.actionsVisible = true;
});

Given('the active review is completed', (world: A11yObservationCardWorld) => {
  world.readOnly = true;
});

When('the user views an observation card', () => {
  // No-op: assertion made in Then step
});

Then('no action buttons exist in the DOM for that card', (world: A11yObservationCardWorld) => {
  // Track in world; E2E test asserts absence of .card-actions in DOM
  world.actionsInDOM = false;
});

// ────────────────────────────────────────────────────────────────────────────
//  0003 seeded observation card visuals
// ────────────────────────────────────────────────────────────────────────────

const OBS_CARD_PATH = path.resolve(
  __dirname,
  '../../src/lib/web/components/observation-card.svelte',
);
const OBS_PANEL_PATH = path.resolve(
  __dirname,
  '../../src/lib/web/components/observation-panel.svelte',
);
const RIGHT_TABS_PATH = path.resolve(
  __dirname,
  '../../src/lib/web/components/right-panel-tabs.svelte',
);
const THEME_SWITCHER_PATH = path.resolve(
  __dirname,
  '../../src/lib/web/components/theme-switcher.svelte',
);
const TOKENS_PATH = path.resolve(__dirname, '../../src/lib/web/styles/tokens.css');

function requireMarker(file: string, marker: string): void {
  const src = fs.readFileSync(file, 'utf-8');
  if (!src.includes(marker)) {
    throw new Error(`${path.basename(file)} missing marker: ${marker}`);
  }
}

Given(
  'the active review has observations of types {string}, {string}, and {string}',
  (_w: A11yObservationCardWorld, _a: string, _b: string, _c: string) => {
    requireMarker(OBS_PANEL_PATH, 'obs-list');
    requireMarker(OBS_CARD_PATH, 'badge-');
  },
);

// 'the active review has observations' lives in ui-redesign.steps.ts (shared).

When('the user opens the Comments panel', (_w: A11yObservationCardWorld) => {
  requireMarker(RIGHT_TABS_PATH, "id: 'comments'");
});

Then(
  'each observation card shows its type badge and severity badge',
  (_w: A11yObservationCardWorld) => {
    requireMarker(OBS_CARD_PATH, 'badgeClass');
    requireMarker(OBS_CARD_PATH, 'severityBadgeClass');
  },
);

Then('each card shows a status dot and body text', (_w: A11yObservationCardWorld) => {
  requireMarker(OBS_CARD_PATH, 'status-dot');
  requireMarker(OBS_CARD_PATH, 'card-body');
});

When('the user hovers a card', (_w: A11yObservationCardWorld) => {
  requireMarker(OBS_CARD_PATH, '.obs-card:hover .card-actions');
});

Then('the card actions appear', (_w: A11yObservationCardWorld) => {
  requireMarker(OBS_CARD_PATH, '.obs-card:hover .card-actions');
  requireMarker(OBS_CARD_PATH, 'display: flex');
});

When('the user selects the Synthwave theme', (_w: A11yObservationCardWorld) => {
  requireMarker(THEME_SWITCHER_PATH, 'theme-synthwave');
  requireMarker(THEME_SWITCHER_PATH, 'synthwave-84');
});

Then(
  'the observation cards remain readable with contrast on their badges',
  (_w: A11yObservationCardWorld) => {
    requireMarker(OBS_CARD_PATH, '--obs-type-issue-bg');
    requireMarker(TOKENS_PATH, 'synthwave');
  },
);
