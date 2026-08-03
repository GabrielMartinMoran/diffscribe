/**
 * DiffScribe — Quick Open untracked-inclusion preference (client-only).
 *
 * Follows the wrap-store pattern: stored exclusively in browser
 * localStorage, defaults to `false` (Quick Open shows tracked files only),
 * and resolved defensively against invalid stored values. The setting
 * affects only Quick Open — never the Git/file list.
 */

export const QUICK_OPEN_INCLUDE_UNTRACKED_STORAGE_KEY = 'diffscribe-quick-open-include-untracked';

export const DEFAULT_QUICK_OPEN_INCLUDE_UNTRACKED = false;

export function resolveQuickOpenIncludeUntracked(stored: string | null): boolean {
  return stored === 'true';
}

export function readStoredQuickOpenIncludeUntracked(storage: Storage | null): string | null {
  if (!storage) return null;
  return storage.getItem(QUICK_OPEN_INCLUDE_UNTRACKED_STORAGE_KEY);
}

export function writeStoredQuickOpenIncludeUntracked(
  enabled: boolean,
  storage: Storage | null,
): void {
  if (!storage) return;
  storage.setItem(QUICK_OPEN_INCLUDE_UNTRACKED_STORAGE_KEY, String(enabled));
}
