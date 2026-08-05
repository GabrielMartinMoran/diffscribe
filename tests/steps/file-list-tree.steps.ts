/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import fs from 'node:fs';
import path from 'node:path';

import { Given, Then, When } from 'quickpickle';

import {
  DEFAULT_VISUAL_SETTINGS,
  LEGACY_FILE_LIST_VIEW_STORAGE_KEY,
  VISUAL_SETTINGS_STORAGE_KEY,
} from '../../src/lib/web/stores/visual-settings-store';

type World = any;

const FILE_LIST_PATH = path.resolve(__dirname, '../../src/lib/web/components/file-list.svelte');
const TREE_HELPER_PATH = path.resolve(__dirname, '../../src/lib/web/components/file-list-tree.ts');
const SETTINGS_PATH = path.resolve(__dirname, '../../src/lib/web/components/settings-panel.svelte');
const PAGE_PATH = path.resolve(__dirname, '../../src/routes/+page.svelte');
const GIT_PANEL_PATH = path.resolve(
  __dirname,
  '../../src/lib/web/components/git-context-panel.svelte',
);

function requireMarker(file: string, marker: string): void {
  const src = fs.readFileSync(file, 'utf-8');
  if (!src.includes(marker)) {
    throw new Error(`${path.basename(file)} missing marker: ${marker}`);
  }
}

function requireNoMarker(file: string, marker: string): void {
  const src = fs.readFileSync(file, 'utf-8');
  if (src.includes(marker)) {
    throw new Error(`${path.basename(file)} must not contain marker: ${marker}`);
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
  // 0003: the Git panel no longer renders a local view switcher.
  requireNoMarker(FILE_LIST_PATH, 'file-list-view-list');
  requireNoMarker(FILE_LIST_PATH, 'file-list-view-tree');
});

When('the user switches to the tree view', (_w: World) => {
  requireMarker(FILE_LIST_PATH, 'file-list-tree');
});

When('the user switches to the list view in Settings', (_w: World) => {
  requireMarker(SETTINGS_PATH, 'settings-file-list-list');
  requireMarker(SETTINGS_PATH, 'writeVisualSettings');
});

Given('the Git rail is active with changed files', (_w: World) => {
  requireMarker(PAGE_PATH, "activeRailTab === 'git'");
  requireMarker(GIT_PANEL_PATH, 'git-context-panel');
  requireMarker(FILE_LIST_PATH, 'readVisualSettings');
});

When('the user inspects the file list controls', (_w: World) => {
  requireMarker(FILE_LIST_PATH, 'readVisualSettings');
  requireNoMarker(FILE_LIST_PATH, 'file-list-view-list');
  requireNoMarker(FILE_LIST_PATH, 'file-list-view-tree');
});

Then('no List or Tree toggle is present in the Git panel', (_w: World) => {
  requireNoMarker(FILE_LIST_PATH, 'file-list-view-list');
  requireNoMarker(FILE_LIST_PATH, 'file-list-view-tree');
  // The Git panel still reads the Settings-owned preference.
  requireMarker(FILE_LIST_PATH, 'readVisualSettings');
});

Then('the file list follows the File list view setting from Settings', (_w: World) => {
  requireMarker(FILE_LIST_PATH, 'readVisualSettings');
  requireMarker(SETTINGS_PATH, 'settings-file-list-view');
});

When('the user switches the file list view in Settings', (_w: World) => {
  requireMarker(SETTINGS_PATH, 'settings-file-list-view');
  requireMarker(SETTINGS_PATH, 'writeVisualSettings');
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
  const storePath = path.resolve(__dirname, '../../src/lib/web/stores/visual-settings-store.ts');
  requireMarker(storePath, VISUAL_SETTINGS_STORAGE_KEY);
  if (DEFAULT_VISUAL_SETTINGS.fileListView !== 'tree') {
    throw new Error('File list view must default to the tree view');
  }
});

When('the user switches to the list view', (_w: World) => {
  requireMarker(FILE_LIST_PATH, 'file-list-view-list');
  const storePath = path.resolve(__dirname, '../../src/lib/web/stores/visual-settings-store.ts');
  requireMarker(storePath, 'writeVisualSettings');
  requireMarker(storePath, LEGACY_FILE_LIST_VIEW_STORAGE_KEY);
});

Then('the list view remains active', (_w: World) => {
  // 0003: the Git panel has no local switcher; the list view comes from the
  // Settings-owned preference.
  requireMarker(SETTINGS_PATH, 'settings-file-list-list');
  const storePath = path.resolve(__dirname, '../../src/lib/web/stores/visual-settings-store.ts');
  requireMarker(storePath, 'readVisualSettings');
  requireMarker(FILE_LIST_PATH, 'readVisualSettings');
});

Then('the file opens in the diff viewer', (_w: World) => {
  requireMarker(FILE_LIST_PATH, 'selectFile');
});
