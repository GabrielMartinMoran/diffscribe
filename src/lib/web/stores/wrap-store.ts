/**
 * DiffScribe — Editor line wrapping preference (client-only).
 *
 * Follows the theme-store pattern: the preference is stored exclusively in
 * browser localStorage, defaults to `false` (diffs stay no-wrap), and is
 * resolved defensively against invalid stored values.
 */

export const WRAP_STORAGE_KEY = 'diffscribe-line-wrap';

export const DEFAULT_WRAP = false;

export function resolveWrap(stored: string | null): boolean {
  return stored === 'true';
}

export function readStoredWrap(storage: Storage | null): string | null {
  if (!storage) return null;
  return storage.getItem(WRAP_STORAGE_KEY);
}

export function writeStoredWrap(enabled: boolean, storage: Storage | null): void {
  if (!storage) return;
  storage.setItem(WRAP_STORAGE_KEY, String(enabled));
}
