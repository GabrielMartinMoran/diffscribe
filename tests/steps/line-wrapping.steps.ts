/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import fs from 'node:fs';
import path from 'node:path';

import { Given, Then, When } from 'quickpickle';

import { DEFAULT_WRAP } from '../../src/lib/web/stores/wrap-store';

type World = any;

const VIEWER_PATH = path.resolve(__dirname, '../../src/lib/web/components/diff-viewer.svelte');
const SETTINGS_PATH = path.resolve(__dirname, '../../src/lib/web/components/settings-panel.svelte');

function requireMarker(file: string, marker: string): void {
  const src = fs.readFileSync(file, 'utf-8');
  if (!src.includes(marker)) {
    throw new Error(`${path.basename(file)} missing marker: ${marker}`);
  }
}

// ────────────────────────────────────────────────────────────────────────────
//  GIVEN
// ────────────────────────────────────────────────────────────────────────────

Given('the DiffScribe application is available', (_w: World) => {
  const appHtml = path.resolve(__dirname, '../../src/app.html');
  if (!fs.existsSync(appHtml)) {
    throw new Error('app.html not found');
  }
});

Given('a workspace with a diff is active', (_w: World) => {
  // Setup happens in E2E; BDD layer pins the viewer contract.
});

Given('a diff with a long line is open', (_w: World) => {
  requireMarker(VIEWER_PATH, 'wrapLines');
});

Given('line wrapping is enabled in Settings', (_w: World) => {
  requireMarker(SETTINGS_PATH, 'Line wrapping');
});

// ────────────────────────────────────────────────────────────────────────────
//  WHEN
// ────────────────────────────────────────────────────────────────────────────

When('the user inspects the line content boxes', (_w: World) => {
  // Scroll ownership is verified by E2E; the CSS contract is pinned below.
});

When('the user activates the Wrap toggle in the diff header', (_w: World) => {
  requireMarker(VIEWER_PATH, 'toggleWrap');
});

When('the user opens a diff for another file', (_w: World) => {
  // Per-file wrap reset is verified by E2E.
});

// ────────────────────────────────────────────────────────────────────────────
//  THEN
// ────────────────────────────────────────────────────────────────────────────

Then('diff lines render with no-wrap', (_w: World) => {
  const src = fs.readFileSync(VIEWER_PATH, 'utf-8');
  const styleMatch = src.match(/<style[^>]*>([\s\S]*?)<\/style>/);
  const styleSource = styleMatch ? styleMatch[1] : '';
  if (!styleSource.includes('white-space: pre;')) {
    throw new Error('Diff lines must default to white-space: pre (no-wrap)');
  }
  if (
    styleSource.includes('overflow-wrap:anywhere') ||
    styleSource.includes('word-break:break-all')
  ) {
    throw new Error('Forbidden wrapping utilities in diff viewer');
  }
  if (DEFAULT_WRAP !== false) {
    throw new Error('Global wrapping default must stay disabled');
  }
});

Then('the diff exposes a single horizontal scroll container for the file', (_w: World) => {
  const src = fs.readFileSync(VIEWER_PATH, 'utf-8');
  const styleMatch = src.match(/<style[^>]*>([\s\S]*?)<\/style>/);
  const styleSource = styleMatch ? styleMatch[1] : '';
  if (!styleSource.includes('.diff-viewer {') || !styleSource.includes('overflow-x: auto')) {
    throw new Error('The diff viewer must own the horizontal scroll');
  }
});

Then('no line content box scrolls horizontally on its own', (_w: World) => {
  const src = fs.readFileSync(VIEWER_PATH, 'utf-8');
  const styleMatch = src.match(/<style[^>]*>([\s\S]*?)<\/style>/);
  const styleSource = styleMatch ? styleMatch[1] : '';
  const rule = styleSource.match(/\.line-content\s*\{[^}]*\}/);
  if (rule && rule[0].includes('overflow-x')) {
    throw new Error(`Per-line horizontal scroll is prohibited: ${rule[0]}`);
  }
});

Then('the toggle reports pressed state', (_w: World) => {
  requireMarker(VIEWER_PATH, 'aria-pressed={wrapLines}');
});

Then('diff lines wrap in the viewer', (_w: World) => {
  const src = fs.readFileSync(VIEWER_PATH, 'utf-8');
  const styleMatch = src.match(/<style[^>]*>([\s\S]*?)<\/style>/);
  const styleSource = styleMatch ? styleMatch[1] : '';
  if (!styleSource.includes('white-space: pre-wrap;')) {
    throw new Error('Wrap mode must use white-space: pre-wrap');
  }
});

Then('the diff lines wrap without a manual toggle', (_w: World) => {
  requireMarker(VIEWER_PATH, 'readStoredWrap');
});

// ── Source viewer wrapping ──

Given('the user opens a source file in the Source viewer', (_w: World) => {
  const sourcePath = path.resolve(__dirname, '../../src/lib/web/components/source-viewer.svelte');
  requireMarker(sourcePath, 'wrapLines');
});

When('the user disables wrapping in the Source viewer header', (_w: World) => {
  const sourcePath = path.resolve(__dirname, '../../src/lib/web/components/source-viewer.svelte');
  requireMarker(sourcePath, 'toggleWrap');
});

Then('the source lines wrap in the viewer', (_w: World) => {
  const sourcePath = path.resolve(__dirname, '../../src/lib/web/components/source-viewer.svelte');
  const src = fs.readFileSync(sourcePath, 'utf-8');
  const styleMatch = src.match(/<style[^>]*>([\s\S]*?)<\/style>/);
  const styleSource = styleMatch ? styleMatch[1] : '';
  if (!styleSource.includes('white-space: pre-wrap;')) {
    throw new Error('Source wrap mode must use white-space: pre-wrap');
  }
});

Then('the Source viewer exposes a single horizontal scroll container', (_w: World) => {
  const sourcePath = path.resolve(__dirname, '../../src/lib/web/components/source-viewer.svelte');
  const src = fs.readFileSync(sourcePath, 'utf-8');
  const styleMatch = src.match(/<style[^>]*>([\s\S]*?)<\/style>/);
  const styleSource = styleMatch ? styleMatch[1] : '';
  if (!styleSource.includes('overflow-x: auto')) {
    throw new Error('The source viewer must own the horizontal scroll');
  }
  if (
    styleSource.includes('overflow-wrap:anywhere') ||
    styleSource.includes('word-break:break-all')
  ) {
    throw new Error('Forbidden wrapping utilities in source viewer');
  }
});

Then('the source lines render no-wrap with a single horizontal scroll container', (_w: World) => {
  const sourcePath = path.resolve(__dirname, '../../src/lib/web/components/source-viewer.svelte');
  const src = fs.readFileSync(sourcePath, 'utf-8');
  const styleMatch = src.match(/<style[^>]*>([\s\S]*?)<\/style>/);
  const styleSource = styleMatch ? styleMatch[1] : '';
  if (!styleSource.includes('white-space: pre;')) {
    throw new Error('Source no-wrap must use white-space: pre');
  }
  if (!styleSource.includes('overflow-x: auto')) {
    throw new Error('The source viewer must own the horizontal scroll');
  }
});

// ────────────────────────────────────────────────────────────────────────────
//  Line-number gutter geometry (CSS contract; real geometry is measured in
//  tests/e2e/gutter-geometry.spec.ts with real fonts, tolerance <= 1 px)
// ────────────────────────────────────────────────────────────────────────────

const SOURCE_VIEWER_PATH = path.resolve(
  __dirname,
  '../../src/lib/web/components/source-viewer.svelte',
);

function requireCssRuleMarker(file: string, selector: string, marker: string): void {
  const src = fs.readFileSync(file, 'utf-8');
  const styleMatch = src.match(/<style[^>]*>([\s\S]*?)<\/style>/);
  const styleSource = styleMatch ? styleMatch[1] : '';
  const rules = styleSource.replace(/\/\*[\s\S]*?\*\//g, '').match(/[^{}]+\{[^}]*\}/g) ?? [];
  const rule = rules.find((r) => r.replace(/\{[\s\S]*$/, '').trim() === selector);
  if (!rule || !rule.includes(marker)) {
    throw new Error(`${path.basename(file)}: rule ${selector} missing marker: ${marker}`);
  }
}

Then(
  'the line-number cells keep a width of 48 px including their internal padding',
  (_w: World) => {
    for (const viewerPath of [VIEWER_PATH, SOURCE_VIEWER_PATH]) {
      requireCssRuleMarker(viewerPath, '.line-number', 'width: 48px');
      requireCssRuleMarker(viewerPath, '.line-number', 'box-sizing: border-box');
    }
  },
);
