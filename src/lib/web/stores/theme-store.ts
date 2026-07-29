export type ThemeKey = 'dark' | 'synthwave-84';

export const THEMES: ThemeKey[] = ['dark', 'synthwave-84'];
export const DEFAULT_THEME: ThemeKey = 'dark';
export const STORAGE_KEY = 'diffscribe-theme';

/**
 * Resolves any input to a valid ThemeKey.
 * Unknown, null, undefined, or empty values fall back to DEFAULT_THEME ('dark').
 */
export function resolveThemeKey(value: string | null | undefined): ThemeKey {
  if (value === 'synthwave-84') return 'synthwave-84';
  return 'dark';
}

/**
 * Reads the stored theme key from the given storage instance.
 * Returns null when storage is unavailable or throws.
 */
export function readStoredTheme(storage: Storage | null): string | null {
  if (!storage) return null;
  try {
    return storage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Writes the given theme key to the given storage instance.
 * Silently handles null storage and storage errors.
 */
export function writeStoredTheme(key: ThemeKey, storage: Storage | null): void {
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, key);
  } catch {
    // Silently handle quota exceeded or other storage errors
  }
}

/**
 * Applies the theme by setting data-theme on document.documentElement.
 * Silently handles null document.
 */
export function applyThemeToDocument(key: ThemeKey, doc: Document | null): void {
  if (!doc) return;
  doc.documentElement.dataset.theme = key;
}
