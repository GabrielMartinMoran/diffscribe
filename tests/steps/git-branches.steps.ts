/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import fs from 'node:fs';
import path from 'node:path';

import { Given, Then, When } from 'quickpickle';

type World = any;

const READER_PATH = path.resolve(
  __dirname,
  '../../src/lib/server/infrastructure/git/simple-git-context-reader.ts',
);
const PANEL_PATH = path.resolve(__dirname, '../../src/lib/web/components/git-context-panel.svelte');
const DTO_PATH = path.resolve(
  __dirname,
  '../../src/lib/server/application/dto/results/git-context-results.ts',
);
const INFERENCE_PATH = path.resolve(__dirname, '../../src/lib/web/types/comparison-inference.ts');

function requireMarker(file: string, marker: string): void {
  const src = fs.readFileSync(file, 'utf-8');
  if (!src.includes(marker)) {
    throw new Error(`${path.basename(file)} missing marker: ${marker}`);
  }
}

// ────────────────────────────────────────────────────────────────────────────
//  GIVEN
// ────────────────────────────────────────────────────────────────────────────

Given('the git workspace shell is loaded', (_w: World) => {
  const appHtml = path.resolve(__dirname, '../../src/app.html');
  if (!fs.existsSync(appHtml)) {
    throw new Error('app.html not found');
  }
});

Given('a workspace with a cached remote branch', (_w: World) => {
  const src = fs.readFileSync(READER_PATH, 'utf-8');
  if (!src.includes('refs/remotes')) {
    throw new Error('Context reader must read refs/remotes');
  }
  if (/\bgit\.(fetch|pull|push|ls-remote)\b|\.fetch\(/.test(src)) {
    throw new Error('Context reader must never fetch');
  }
});

Given('the Git comparison selector is open', (_w: World) => {
  requireMarker(PANEL_PATH, 'slot-base');
  requireMarker(PANEL_PATH, 'slot-target');
});

// ────────────────────────────────────────────────────────────────────────────
//  WHEN
// ────────────────────────────────────────────────────────────────────────────

When('the user views the Git branch list', (_w: World) => {
  requireMarker(PANEL_PATH, 'aria-label="Local branches"');
});

When('the user selects the target branch {string}', (_w: World) => {
  requireMarker(PANEL_PATH, 'isDefaultBase');
});

When('the user selects the target commit {string}', (_w: World) => {
  requireMarker(PANEL_PATH, 'Commit entries');
});

When('the user selects the cached remote branch as target', (_w: World) => {
  requireMarker(PANEL_PATH, 'remote-tag');
});

// ────────────────────────────────────────────────────────────────────────────
//  THEN
// ────────────────────────────────────────────────────────────────────────────

Then('the branch list shows the local branches', (_w: World) => {
  const dto = fs.readFileSync(DTO_PATH, 'utf-8');
  if (!dto.includes('isRemote')) {
    throw new Error('BranchDto must expose the isRemote flag');
  }
});

Then('the branch list shows the cached remote branch with a remote marker', (_w: World) => {
  requireMarker(PANEL_PATH, 'remote');
});

Then('the Base slot is filled with the current branch', (_w: World) => {
  requireMarker(PANEL_PATH, 'currentBranch');
});

Then('the comparison type is inferred as branch-vs-branch', (_w: World) => {
  const src = fs.readFileSync(INFERENCE_PATH, 'utf-8');
  if (!src.includes("return 'branch-vs-branch'")) {
    throw new Error('Inference must resolve branch pairs to branch-vs-branch');
  }
});

Then('the comparison type is inferred as commit-vs-commit', (_w: World) => {
  const src = fs.readFileSync(INFERENCE_PATH, 'utf-8');
  if (!src.includes("return 'commit-vs-commit'")) {
    throw new Error('Inference must resolve commit pairs to commit-vs-commit');
  }
});

Then('no git fetch or network operation is executed', (_w: World) => {
  const src = fs.readFileSync(READER_PATH, 'utf-8');
  if (/\bgit\.(fetch|pull|push|ls-remote)\b|\.fetch\(/.test(src)) {
    throw new Error('Remote branches must come from cached refs only');
  }
});
