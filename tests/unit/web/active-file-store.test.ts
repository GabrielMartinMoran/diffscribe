import { get } from 'svelte/store';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  activateTab,
  activeFile,
  activeFileLabel,
  activeFilePath,
  clearActiveFile,
  closeTab,
  COMPLETE_DIFF_TAB_ID,
  openFileTab,
  openTabs,
  pinCompleteDiff,
  resetTabs,
  setActiveFile,
  tabId,
} from '$lib/web/stores/active-file-store';

function paths(): string[] {
  return get(openTabs)
    .filter((t) => t.kind === 'file')
    .map((t) => t.path);
}

function tabIds(): string[] {
  return get(openTabs).map(tabId);
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
    expect(get(activeFile)).toEqual({
      kind: 'file',
      path: 'src/app.ts',
      label: 'src/app.ts',
    });
    openFileTab('src/lib/util.ts', 'util.ts', true);
    expect(get(activeFileLabel)).toBe('util.ts');
  });
});

describe('active-file-store pinned complete-diff tab', () => {
  beforeEach(() => {
    resetTabs();
  });

  it('pinCompleteDiff creates the pinned tab first and activates it', () => {
    pinCompleteDiff();
    expect(tabIds()).toEqual([COMPLETE_DIFF_TAB_ID]);
    expect(get(activeFilePath)).toBeNull();
    expect(get(activeFile)).toBeNull();
  });

  it('pinCompleteDiff is idempotent and keeps the pin first', () => {
    pinCompleteDiff();
    pinCompleteDiff();
    expect(tabIds()).toEqual([COMPLETE_DIFF_TAB_ID]);
  });

  it('closeTab ignores the pinned tab', () => {
    pinCompleteDiff();
    closeTab(COMPLETE_DIFF_TAB_ID);
    expect(tabIds()).toEqual([COMPLETE_DIFF_TAB_ID]);
  });

  it('a normal open with the pin active appends a file tab instead of replacing the pin', () => {
    pinCompleteDiff();
    openFileTab('src/app.ts', 'app.ts', false);
    expect(tabIds()).toEqual([COMPLETE_DIFF_TAB_ID, 'src/app.ts']);
    expect(activePath()).toBe('src/app.ts');
  });

  it('a modifier open keeps the pin first and appends at the end', () => {
    pinCompleteDiff();
    openFileTab('src/app.ts', 'app.ts', false);
    openFileTab('src/lib/util.ts', 'util.ts', true);
    expect(tabIds()).toEqual([COMPLETE_DIFF_TAB_ID, 'src/app.ts', 'src/lib/util.ts']);
  });

  it('an already-open path with the pin active activates it without duplicating', () => {
    pinCompleteDiff();
    openFileTab('src/app.ts', 'app.ts', false);
    openFileTab('src/app.ts', 'app.ts', true);
    expect(tabIds()).toEqual([COMPLETE_DIFF_TAB_ID, 'src/app.ts']);
    expect(activePath()).toBe('src/app.ts');
  });

  it('closing the last file tab activates the pinned tab', () => {
    pinCompleteDiff();
    openFileTab('src/app.ts', 'app.ts', false);
    closeTab('src/app.ts');
    expect(tabIds()).toEqual([COMPLETE_DIFF_TAB_ID]);
    expect(get(activeFilePath)).toBeNull();
  });

  it('activateTab accepts the pinned tab id', () => {
    pinCompleteDiff();
    openFileTab('src/app.ts', 'app.ts', false);
    activateTab(COMPLETE_DIFF_TAB_ID);
    expect(get(activeFilePath)).toBeNull();
  });

  it('resetTabs clears file tabs and drops the pin', () => {
    pinCompleteDiff();
    openFileTab('src/app.ts', 'app.ts', false);
    resetTabs();
    expect(tabIds()).toEqual([]);
    expect(get(activeFilePath)).toBeNull();
  });

  it('reuse-active with the pin active appends and activates a new file tab', () => {
    pinCompleteDiff();
    openFileTab('src/app.ts', 'app.ts', false);
    activateTab(COMPLETE_DIFF_TAB_ID);
    openFileTab('src/lib/util.ts', 'util.ts', false);
    expect(tabIds()).toEqual([COMPLETE_DIFF_TAB_ID, 'src/app.ts', 'src/lib/util.ts']);
    expect(activePath()).toBe('src/lib/util.ts');
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

  it('setActiveFile with a pinned tab active appends and activates the file', () => {
    pinCompleteDiff();
    setActiveFile('src/app.ts');
    expect(tabIds()).toEqual([COMPLETE_DIFF_TAB_ID, 'src/app.ts']);
    expect(get(activeFilePath)).toBe('src/app.ts');
  });

  it('clearActiveFile closes the active tab', () => {
    setActiveFile('src/app.ts');
    clearActiveFile();
    expect(paths()).toEqual([]);
    expect(get(activeFilePath)).toBeNull();
  });

  it('clearActiveFile with a pinned tab active returns to the pinned tab', () => {
    pinCompleteDiff();
    setActiveFile('src/app.ts');
    clearActiveFile();
    expect(tabIds()).toEqual([COMPLETE_DIFF_TAB_ID]);
    expect(get(activeFilePath)).toBeNull();
  });
});
