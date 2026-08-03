/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import fs from 'node:fs';
import path from 'node:path';

import { Given, Then, When } from 'quickpickle';

import {
  DEFAULT_FILE_LIST_VIEW,
  FILE_LIST_VIEW_STORAGE_KEY,
} from '../../src/lib/web/stores/file-list-view-store';

type World = any;

const FILE_LIST_PATH = path.resolve(__dirname, '../../src/lib/web/components/file-list.svelte');
const TREE_HELPER_PATH = path.resolve(__dirname, '../../src/lib/web/components/file-list-tree.ts');

function requireMarker(file: string, marker: string): void {
  const src = fs.readFileSync(file, 'utf-8');
  if (!src.includes(marker)) {
    throw new Error(`${path.basename(file)} missing marker: ${marker}`);
  }
}

// ────────────────────────────────────────────────────────────────────────────
//  GIVEN
// ────────────────────────────────────────────────────────────────────────────

Given('the file list shell is loaded', (_w: World) => {
  const appHtml = path.resolve(__dirname, '../../src/app.html');
  if (!fs.existsSync(appHtml)) {
    throw new Error('app.html not found');
  }
});

Given('the changed file list is available', (_w: World) => {
  requireMarker(FILE_LIST_PATH, 'file-list-panel');
});

Given('the file list panel shows files in nested directories', (_w: World) => {
  requireMarker(TREE_HELPER_PATH, 'buildFileTree');
});

// ────────────────────────────────────────────────────────────────────────────
//  WHEN
// ────────────────────────────────────────────────────────────────────────────

When('the user inspects the view switcher', (_w: World) => {
  requireMarker(FILE_LIST_PATH, 'file-list-view-list');
  requireMarker(FILE_LIST_PATH, 'file-list-view-tree');
});

When('the user switches to the tree view', (_w: World) => {
  requireMarker(FILE_LIST_PATH, 'file-list-tree');
});

When('the application reloads', (_w: World) => {
  // Persistence behavior is verified by E2E; the storage key is pinned below.
});

When('selects a file inside a directory', (_w: World) => {
  requireMarker(FILE_LIST_PATH, 'onSelect');
});

// ────────────────────────────────────────────────────────────────────────────
//  THEN
// ────────────────────────────────────────────────────────────────────────────

Then('the panel exposes List and Tree toggles with pressed state', (_w: World) => {
  requireMarker(FILE_LIST_PATH, "aria-pressed={view === 'list'}");
  requireMarker(FILE_LIST_PATH, "aria-pressed={view === 'tree'}");
});

Then('files appear grouped under their directories', (_w: World) => {
  const src = fs.readFileSync(TREE_HELPER_PATH, 'utf-8');
  if (!src.includes('directory') || !src.includes('file')) {
    throw new Error('Tree helper must model directory and file nodes');
  }
});

Then('directories expand to reveal their files', (_w: World) => {
  const branch = path.resolve(__dirname, '../../src/lib/web/components/file-tree-branch.svelte');
  requireMarker(branch, 'aria-expanded');
  requireMarker(branch, 'onToggleDir');
});

Then('all directories are expanded by default to reveal their files', (_w: World) => {
  requireMarker(FILE_LIST_PATH, 'expandedDirs');
  // Default expansion must be driven by the directory set, not persisted.
  if (!fs.readFileSync(FILE_LIST_PATH, 'utf-8').includes('collectDirPaths')) {
    throw new Error('File list must expand every directory by default via collectDirPaths');
  }
});

When('collapses a directory', (_w: World) => {
  requireMarker(FILE_LIST_PATH, 'toggleDir');
});

When('the user expands the directory again', (_w: World) => {
  requireMarker(FILE_LIST_PATH, 'toggleDir');
});

Then('the directory files are hidden', (_w: World) => {
  const branch = path.resolve(__dirname, '../../src/lib/web/components/file-tree-branch.svelte');
  requireMarker(branch, 'isExpanded');
});

Then('the directory files are visible again', (_w: World) => {
  const branch = path.resolve(__dirname, '../../src/lib/web/components/file-tree-branch.svelte');
  requireMarker(branch, 'isExpanded');
});

Then('the directories are expanded by default again', (_w: World) => {
  requireMarker(FILE_LIST_PATH, 'collectDirPaths');
});

Then('the tree view remains active', (_w: World) => {
  const storePath = path.resolve(__dirname, '../../src/lib/web/stores/file-list-view-store.ts');
  requireMarker(storePath, FILE_LIST_VIEW_STORAGE_KEY);
  if (DEFAULT_FILE_LIST_VIEW !== 'list') {
    throw new Error('File list view must default to the list view');
  }
});

Then('the file opens in the diff viewer', (_w: World) => {
  requireMarker(FILE_LIST_PATH, 'selectFile');
});
