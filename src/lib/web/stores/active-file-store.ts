import { derived, get, writable } from 'svelte/store';

export interface ActiveFile {
  path: string;
  label: string;
}

/** One open tab in the central viewer tab strip. */
export interface OpenFileTab {
  path: string;
  label: string;
}

/**
 * Ordered collection of open tabs. Session-only: never persisted, unique by
 * repo-relative path within the active workspace.
 */
export const openTabs = writable<OpenFileTab[]>([]);

/** Path of the active tab, or null when no tab is open. */
export const activeTabPath = writable<string | null>(null);

/** Derived convenience — the active tab entry, or null. */
export const activeFile = derived([openTabs, activeTabPath], ([$tabs, $path]) => {
  if (!$path) return null;
  return $tabs.find((t) => t.path === $path) ?? null;
});

/** Derived convenience — just the file path, or null. */
export const activeFilePath = derived(activeFile, ($f) => $f?.path ?? null);

/** Derived convenience — just the file label, or null. */
export const activeFileLabel = derived(activeFile, ($f) => $f?.label ?? null);

/**
 * Open a file in the tab collection.
 *
 * - `openNewTab === false` (normal click): reuse the active tab — the active
 *   tab's content is replaced by this file. When no tab exists, a first tab
 *   is created.
 * - `openNewTab === true` (Ctrl/Cmd-click): append a new tab at the end and
 *   activate it. When the path is already open, the existing tab is activated
 *   instead (tabs stay unique by path).
 */
export function openFileTab(path: string, label?: string, openNewTab = false): void {
  const tabs = get(openTabs);
  const labelValue = label ?? path;
  const alreadyOpen = tabs.findIndex((t) => t.path === path);
  if (alreadyOpen >= 0) {
    activeTabPath.set(path);
    return;
  }

  if (!openNewTab && tabs.length > 0) {
    // Reuse the active tab: replace its content with the new path. Fall back
    // to appending when the active path is unknown (defensive).
    const active = get(activeTabPath);
    const activeIdx = active ? tabs.findIndex((t) => t.path === active) : -1;
    if (activeIdx >= 0) {
      const next = tabs.map((t, i) => (i === activeIdx ? { path, label: labelValue } : t));
      openTabs.set(next);
      activeTabPath.set(path);
      return;
    }
  }

  openTabs.set([...tabs, { path, label: labelValue }]);
  activeTabPath.set(path);
}

/** Activate an existing tab by path. Unknown paths are ignored. */
export function activateTab(path: string): void {
  const tabs = get(openTabs);
  if (tabs.some((t) => t.path === path)) {
    activeTabPath.set(path);
  }
}

/**
 * Close a tab by path. Closing the active tab selects the next tab, else the
 * previous one, else the empty viewer. Closing an inactive tab preserves the
 * active tab.
 */
export function closeTab(path: string): void {
  const tabs = get(openTabs);
  const idx = tabs.findIndex((t) => t.path === path);
  if (idx < 0) return;
  const next = tabs.filter((t) => t.path !== path);
  openTabs.set(next);

  if (get(activeTabPath) !== path) return;
  if (next.length === 0) {
    activeTabPath.set(null);
    return;
  }
  const nextIdx = Math.min(idx, next.length - 1);
  activeTabPath.set(next[nextIdx].path);
}

/** Clear the whole collection and the active file (workspace switch). */
export function resetTabs(): void {
  openTabs.set([]);
  activeTabPath.set(null);
}

/** Set the active / selected file and derive a label from the path. */
export function setActiveFile(path: string, label?: string): void {
  openFileTab(path, label, false);
}

/** Clear the active file selection (closes the active tab). */
export function clearActiveFile(): void {
  const active = get(activeTabPath);
  if (active) {
    closeTab(active);
  }
}
