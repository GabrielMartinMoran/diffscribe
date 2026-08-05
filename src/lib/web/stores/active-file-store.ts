import { derived, get, writable } from 'svelte/store';

/** Stable identity of the workspace-scoped synthetic complete-diff tab. */
export const COMPLETE_DIFF_TAB_ID = 'complete-diff';

/** The pinned complete-diff tab label shown in the central tab strip. */
export const COMPLETE_DIFF_TAB_LABEL = 'Complete diff';

export interface CompleteDiffTab {
  kind: 'complete-diff';
  id: typeof COMPLETE_DIFF_TAB_ID;
  label: typeof COMPLETE_DIFF_TAB_LABEL;
}

export interface FileTab {
  kind: 'file';
  path: string;
  label: string;
}

/**
 * Central viewer tab entries. A workspace-scoped synthetic complete-diff tab
 * is pinned first whenever a workspace is active; ordinary file tabs follow
 * it. The pin is a discriminated kind, never a path sentinel.
 */
export type CentralTab = CompleteDiffTab | FileTab;

/** Unique identity of a tab: the file path for file tabs, the stable pin id. */
export function tabId(tab: CentralTab): string {
  return tab.kind === 'file' ? tab.path : tab.id;
}

/**
 * Ordered collection of open tabs. Session-only: never persisted, unique by
 * file path within the active workspace, pinned complete-diff tab first.
 */
export const openTabs = writable<CentralTab[]>([]);

/**
 * Identity of the active tab: a file path or {@link COMPLETE_DIFF_TAB_ID}.
 * Null when no tab is open (no workspace, nothing selected).
 */
export const activeTabId = writable<string | null>(null);

/** File-only convenience: the active file tab's path, or null when the pinned
 * tab (or nothing) is active. */
export const activeTabPath = derived(activeTabId, ($id) =>
  $id && $id !== COMPLETE_DIFF_TAB_ID ? $id : null,
);

/** Derived convenience — the active file tab entry, or null. */
export const activeFile = derived([openTabs, activeTabId], ([$tabs, $id]): FileTab | null => {
  if (!$id || $id === COMPLETE_DIFF_TAB_ID) return null;
  return $tabs.find((t): t is FileTab => t.kind === 'file' && t.path === $id) ?? null;
});

/** Derived convenience — just the file path, or null. */
export const activeFilePath = derived(activeFile, ($f) => $f?.path ?? null);

/** Derived convenience — just the file label, or null. */
export const activeFileLabel = derived(activeFile, ($f) => $f?.label ?? null);

/**
 * Materialize the pinned complete-diff tab: idempotent, always first, and
 * activated. Workspace-scoped: only meaningful while a workspace is active;
 * the shell clears it via `resetTabs()` on workspace change.
 */
export function pinCompleteDiff(): void {
  const tabs = get(openTabs);
  if (!tabs.some((t) => t.kind === 'complete-diff')) {
    openTabs.set([
      { kind: 'complete-diff', id: COMPLETE_DIFF_TAB_ID, label: COMPLETE_DIFF_TAB_LABEL },
      ...tabs,
    ]);
  }
  activeTabId.set(COMPLETE_DIFF_TAB_ID);
}

/**
 * Open a file in the tab collection.
 *
 * - `openNewTab === false` (normal click): reuse the active file tab — the
 *   active tab's content is replaced by this file. The pinned complete-diff
 *   tab is never replaced; when it is active, a new file tab is appended
 *   instead. When no file tab exists, a first tab is created after the pin.
 * - `openNewTab === true` (Ctrl/Cmd-click): append a new tab at the end and
 *   activate it. When the path is already open, the existing tab is activated
 *   instead (tabs stay unique by path).
 */
export function openFileTab(path: string, label?: string, openNewTab = false): void {
  const tabs = get(openTabs);
  const labelValue = label ?? path;
  const alreadyOpen = tabs.findIndex((t) => t.kind === 'file' && t.path === path);
  if (alreadyOpen >= 0) {
    activeTabId.set(path);
    return;
  }

  const fileTab: FileTab = { kind: 'file', path, label: labelValue };

  if (!openNewTab) {
    // Reuse the active FILE tab (never the pinned tab). Fall back to
    // appending when the active path is unknown (defensive).
    const active = get(activeTabId);
    const activeIdx = active ? tabs.findIndex((t) => t.kind === 'file' && t.path === active) : -1;
    if (activeIdx >= 0) {
      const next = tabs.map((t, i) => (i === activeIdx ? fileTab : t));
      openTabs.set(next);
      activeTabId.set(path);
      return;
    }
  }

  // Append at the end: the pinned tab stays first because it is never removed
  // and file tabs always follow it.
  openTabs.set([...tabs, fileTab]);
  activeTabId.set(path);
}

/** Activate an existing tab by id (file path or the pinned tab id). Unknown
 * ids are ignored. */
export function activateTab(id: string): void {
  const tabs = get(openTabs);
  if (tabs.some((t) => tabId(t) === id)) {
    activeTabId.set(id);
  }
}

/**
 * Close a file tab by path. The pinned complete-diff tab cannot be closed.
 * Closing the active file tab selects the next tab, else the previous one;
 * closing the last file tab activates the pinned tab. Closing an inactive
 * tab preserves the active tab.
 */
export function closeTab(id: string): void {
  if (id === COMPLETE_DIFF_TAB_ID) return;
  const tabs = get(openTabs);
  const idx = tabs.findIndex((t) => t.kind === 'file' && t.path === id);
  if (idx < 0) return;
  const next = tabs.filter((t) => t.kind !== 'file' || t.path !== id);
  openTabs.set(next);

  if (get(activeTabId) !== id) return;
  const remainingFiles = next.filter((t) => t.kind === 'file');
  if (remainingFiles.length === 0) {
    // With a workspace the pinned tab is always present; without one the
    // collection is truly empty.
    const hasPin = next.some((t) => t.kind === 'complete-diff');
    activeTabId.set(hasPin ? COMPLETE_DIFF_TAB_ID : null);
    return;
  }
  const nextIdx = Math.min(idx, next.length - 1);
  activeTabId.set(tabId(next[nextIdx]));
}

/** Clear the whole collection and the active tab (workspace switch). */
export function resetTabs(): void {
  openTabs.set([]);
  activeTabId.set(null);
}

/** Set the active / selected file and derive a label from the path. */
export function setActiveFile(path: string, label?: string): void {
  openFileTab(path, label, false);
}

/** Clear the active file selection (closes the active file tab). */
export function clearActiveFile(): void {
  const active = get(activeTabId);
  if (active && active !== COMPLETE_DIFF_TAB_ID) {
    closeTab(active);
  }
}
