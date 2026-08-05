/**
 * Quick Open untracked-inclusion preference (obsolete).
 *
 * Quick Open now always includes nonignored untracked files; the legacy
 * localStorage key `diffscribe-quick-open-include-untracked` no longer has
 * any effect. The dialog removes the key on every open so stale values can
 * never affect behavior.
 */

export const QUICK_OPEN_INCLUDE_UNTRACKED_STORAGE_KEY = 'diffscribe-quick-open-include-untracked';

/**
 * Remove the obsolete Quick Open include-untracked preference from storage.
 * Called on every Quick Open open; tolerates null storage (SSR/browser-less).
 */
export function removeLegacyQuickOpenSetting(storage: Storage | null): void {
  if (!storage) return;
  storage.removeItem(QUICK_OPEN_INCLUDE_UNTRACKED_STORAGE_KEY);
}
