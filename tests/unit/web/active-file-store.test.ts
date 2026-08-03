import { get } from 'svelte/store';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  activateTab,
  activeFile,
  activeFileLabel,
  activeFilePath,
  clearActiveFile,
  closeTab,
  openFileTab,
  openTabs,
  resetTabs,
  setActiveFile,
} from '$lib/web/stores/active-file-store';

function paths(): string[] {
  return get(openTabs).map((t) => t.path);
}

function activePath(): string | null {
  return get(activeFilePath);
}

describe('active-file-store tab collection', () => {
  beforeEach(() => {
    resetTabs();
  });

  it('starts with an empty collection and no active file', () => {
    expect(paths()).toEqual([]);
    expect(activePath()).toBeNull();
    expect(get(activeFile)).toBeNull();
  });

  it('openFileTab without an active tab creates the first tab', () => {
    openFileTab('src/app.ts', 'app.ts', false);
    expect(paths()).toEqual(['src/app.ts']);
    expect(activePath()).toBe('src/app.ts');
  });

  it('a normal open reuses the active tab instead of growing the collection', () => {
    openFileTab('src/app.ts', 'app.ts', false);
    openFileTab('src/lib/util.ts', 'util.ts', false);
    expect(paths()).toEqual(['src/lib/util.ts']);
    expect(activePath()).toBe('src/lib/util.ts');
  });

  it('a modifier open appends a new tab and activates it', () => {
    openFileTab('src/app.ts', 'app.ts', false);
    openFileTab('src/lib/util.ts', 'util.ts', true);
    expect(paths()).toEqual(['src/app.ts', 'src/lib/util.ts']);
    expect(activePath()).toBe('src/lib/util.ts');
  });

  it('an already-open path activates the existing tab without duplicating', () => {
    openFileTab('src/app.ts', 'app.ts', false);
    openFileTab('src/lib/util.ts', 'util.ts', true);
    openFileTab('src/app.ts', 'app.ts', true);
    expect(paths()).toEqual(['src/app.ts', 'src/lib/util.ts']);
    expect(activePath()).toBe('src/app.ts');
  });

  it('activateTab switches the active tab without reordering', () => {
    openFileTab('src/app.ts', 'app.ts', false);
    openFileTab('src/lib/util.ts', 'util.ts', true);
    activateTab('src/app.ts');
    expect(activePath()).toBe('src/app.ts');
    expect(paths()).toEqual(['src/app.ts', 'src/lib/util.ts']);
  });

  it('closing the active tab selects the next tab', () => {
    openFileTab('src/app.ts', 'app.ts', false);
    openFileTab('src/lib/util.ts', 'util.ts', true);
    openFileTab('src/lib/more.ts', 'more.ts', true);
    activateTab('src/app.ts');
    closeTab('src/app.ts');
    expect(activePath()).toBe('src/lib/util.ts');
    expect(paths()).toEqual(['src/lib/util.ts', 'src/lib/more.ts']);
  });

  it('closing the last active tab selects the previous tab', () => {
    openFileTab('src/app.ts', 'app.ts', false);
    openFileTab('src/lib/util.ts', 'util.ts', true);
    closeTab('src/lib/util.ts');
    expect(activePath()).toBe('src/app.ts');
    expect(paths()).toEqual(['src/app.ts']);
  });

  it('closing the only tab leaves the collection empty', () => {
    openFileTab('src/app.ts', 'app.ts', false);
    closeTab('src/app.ts');
    expect(paths()).toEqual([]);
    expect(activePath()).toBeNull();
    expect(get(activeFile)).toBeNull();
  });

  it('closing an inactive tab preserves the active tab', () => {
    openFileTab('src/app.ts', 'app.ts', false);
    openFileTab('src/lib/util.ts', 'util.ts', true);
    activateTab('src/app.ts');
    closeTab('src/lib/util.ts');
    expect(paths()).toEqual(['src/app.ts']);
    expect(activePath()).toBe('src/app.ts');
  });

  it('resetTabs clears the collection and the active file', () => {
    openFileTab('src/app.ts', 'app.ts', false);
    openFileTab('src/lib/util.ts', 'util.ts', true);
    resetTabs();
    expect(paths()).toEqual([]);
    expect(activePath()).toBeNull();
  });

  it('labels default to the path and follow the active tab', () => {
    openFileTab('src/app.ts', undefined, false);
    expect(get(activeFile)).toEqual({ path: 'src/app.ts', label: 'src/app.ts' });
    openFileTab('src/lib/util.ts', 'util.ts', true);
    expect(get(activeFileLabel)).toBe('util.ts');
  });
});

describe('active-file-store compatibility exports', () => {
  beforeEach(() => {
    resetTabs();
  });

  it('setActiveFile opens the file in the current tab (normal click semantics)', () => {
    setActiveFile('src/app.ts');
    setActiveFile('src/lib/util.ts');
    expect(paths()).toEqual(['src/lib/util.ts']);
    expect(get(activeFilePath)).toBe('src/lib/util.ts');
  });

  it('clearActiveFile closes the active tab', () => {
    setActiveFile('src/app.ts');
    clearActiveFile();
    expect(paths()).toEqual([]);
    expect(get(activeFilePath)).toBeNull();
  });
});
