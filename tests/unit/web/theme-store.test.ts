import { describe, expect, it, vi } from 'vitest';

import {
  applyThemeToDocument,
  DEFAULT_THEME,
  readStoredTheme,
  resolveThemeKey,
  STORAGE_KEY,
  THEMES,
  writeStoredTheme,
} from '$lib/web/stores/theme-store';

// ── Helpers ──

function createMockStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
    clear: vi.fn(() => store.clear()),
    key: vi.fn(() => null),
    length: 0,
  };
}

function createMockDocument(): Document {
  const attrs = new Map<string, string>();
  return {
    documentElement: {
      dataset: new Proxy(
        {},
        {
          get(_target, prop: string) {
            return attrs.get(prop) ?? '';
          },
          set(_target, prop: string, value) {
            attrs.set(prop, value);
            return true;
          },
        },
      ),
      setAttribute: vi.fn((name: string, value: string) => {
        attrs.set(name, value);
      }),
      getAttribute: vi.fn((name: string) => attrs.get(name) ?? null),
    },
  } as unknown as Document;
}

// ── Constants ──

describe('ThemeKey constants', () => {
  it('DEFAULT_THEME is "dark"', () => {
    expect(DEFAULT_THEME).toBe('dark');
  });

  it('STORAGE_KEY is "diffscribe-theme"', () => {
    expect(STORAGE_KEY).toBe('diffscribe-theme');
  });

  it('THEMES contains both valid theme keys', () => {
    expect(THEMES).toEqual(['dark', 'synthwave-84']);
  });
});

// ── resolveThemeKey ──

describe('resolveThemeKey', () => {
  it('returns "dark" for "dark"', () => {
    expect(resolveThemeKey('dark')).toBe('dark');
  });

  it('returns "synthwave-84" for "synthwave-84"', () => {
    expect(resolveThemeKey('synthwave-84')).toBe('synthwave-84');
  });

  it('returns "dark" for null', () => {
    expect(resolveThemeKey(null)).toBe('dark');
  });

  it('returns "dark" for undefined', () => {
    expect(resolveThemeKey(undefined)).toBe('dark');
  });

  it('returns "dark" for empty string', () => {
    expect(resolveThemeKey('')).toBe('dark');
  });

  it('returns "dark" for unknown theme key', () => {
    expect(resolveThemeKey('nonexistent-theme')).toBe('dark');
  });

  it('returns "dark" for garbage input', () => {
    expect(resolveThemeKey('!!invalid!!')).toBe('dark');
  });
});

// ── readStoredTheme ──

describe('readStoredTheme', () => {
  it('reads stored theme from localStorage', () => {
    const storage = createMockStorage();
    storage.setItem(STORAGE_KEY, 'synthwave-84');
    expect(readStoredTheme(storage)).toBe('synthwave-84');
  });

  it('returns null when no theme is stored', () => {
    const storage = createMockStorage();
    expect(readStoredTheme(storage)).toBeNull();
  });

  it('returns null when storage is null', () => {
    expect(readStoredTheme(null)).toBeNull();
  });

  it('returns null when storage throws on getItem', () => {
    const storage = createMockStorage();
    storage.getItem = vi.fn(() => {
      throw new Error('storage inaccessible');
    });
    expect(readStoredTheme(storage)).toBeNull();
  });
});

// ── writeStoredTheme ──

describe('writeStoredTheme', () => {
  it('writes theme to localStorage', () => {
    const storage = createMockStorage();
    writeStoredTheme('synthwave-84', storage);
    expect(storage.getItem(STORAGE_KEY)).toBe('synthwave-84');
  });

  it('writes dark theme to localStorage', () => {
    const storage = createMockStorage();
    writeStoredTheme('dark', storage);
    expect(storage.getItem(STORAGE_KEY)).toBe('dark');
  });

  it('silently handles null storage', () => {
    expect(() => writeStoredTheme('dark', null)).not.toThrow();
  });

  it('silently handles storage errors on setItem', () => {
    const storage = createMockStorage();
    storage.setItem = vi.fn(() => {
      throw new Error('quota exceeded');
    });
    expect(() => writeStoredTheme('dark', storage)).not.toThrow();
  });
});

// ── applyThemeToDocument ──

describe('applyThemeToDocument', () => {
  it('sets data-theme attribute on documentElement', () => {
    const doc = createMockDocument();
    applyThemeToDocument('synthwave-84', doc);
    expect(doc.documentElement.dataset.theme).toBe('synthwave-84');
  });

  it('sets data-theme to dark', () => {
    const doc = createMockDocument();
    applyThemeToDocument('dark', doc);
    expect(doc.documentElement.dataset.theme).toBe('dark');
  });

  it('silently handles null document', () => {
    expect(() => applyThemeToDocument('dark', null)).not.toThrow();
  });
});
