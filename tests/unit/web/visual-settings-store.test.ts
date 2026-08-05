import { describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_VISUAL_SETTINGS,
  LEGACY_FILE_LIST_VIEW_STORAGE_KEY,
  readVisualSettings,
  VISUAL_SETTINGS_STORAGE_KEY,
  writeVisualSettings,
} from '$lib/web/stores/visual-settings-store';

function createMockStorage(initial: Record<string, string> = {}): Storage {
  const store = new Map<string, string>(Object.entries(initial));
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

const LEGACY_KEY = LEGACY_FILE_LIST_VIEW_STORAGE_KEY;
const NEW_KEY = VISUAL_SETTINGS_STORAGE_KEY;

describe('visual-settings-store constants', () => {
  it('uses the versioned storage key', () => {
    expect(NEW_KEY).toBe('diffscribe-visual-settings');
  });

  it('keeps the legacy file list key constant', () => {
    expect(LEGACY_KEY).toBe('diffscribe-file-list-view');
  });

  it('defaults to tree and preview', () => {
    expect(DEFAULT_VISUAL_SETTINGS).toEqual({
      version: 1,
      fileListView: 'tree',
      markdownView: 'preview',
    });
  });
});

describe('readVisualSettings', () => {
  it('returns defaults when nothing is stored (fresh context → tree)', () => {
    const storage = createMockStorage();
    expect(readVisualSettings(storage)).toEqual(DEFAULT_VISUAL_SETTINGS);
  });

  it('returns defaults when storage is unavailable', () => {
    expect(readVisualSettings(null)).toEqual(DEFAULT_VISUAL_SETTINGS);
  });

  it('reads an explicit stored aggregate', () => {
    const storage = createMockStorage({
      [NEW_KEY]: JSON.stringify({ version: 1, fileListView: 'list', markdownView: 'raw' }),
    });
    expect(readVisualSettings(storage)).toEqual({
      version: 1,
      fileListView: 'list',
      markdownView: 'raw',
    });
  });

  it('preserves an explicit legacy list preference through read-through migration', () => {
    const storage = createMockStorage({ [LEGACY_KEY]: 'list' });
    expect(readVisualSettings(storage).fileListView).toBe('list');
  });

  it('ignores an explicit legacy tree preference (tree is the default anyway)', () => {
    const storage = createMockStorage({ [LEGACY_KEY]: 'tree' });
    expect(readVisualSettings(storage).fileListView).toBe('tree');
  });

  it('ignores unknown legacy values', () => {
    const storage = createMockStorage({ [LEGACY_KEY]: 'gallery' });
    expect(readVisualSettings(storage).fileListView).toBe('tree');
  });

  it('lets the new key win over the legacy key', () => {
    const storage = createMockStorage({
      [NEW_KEY]: JSON.stringify({ version: 1, fileListView: 'tree', markdownView: 'preview' }),
      [LEGACY_KEY]: 'list',
    });
    expect(readVisualSettings(storage).fileListView).toBe('tree');
  });

  it('falls back per field when the aggregate is malformed JSON', () => {
    const storage = createMockStorage({ [NEW_KEY]: '{not-json' });
    expect(readVisualSettings(storage)).toEqual(DEFAULT_VISUAL_SETTINGS);
  });

  it('falls back per field for unknown versions', () => {
    const storage = createMockStorage({
      [NEW_KEY]: JSON.stringify({ version: 99, fileListView: 'list', markdownView: 'raw' }),
    });
    expect(readVisualSettings(storage)).toEqual(DEFAULT_VISUAL_SETTINGS);
  });

  it('falls back per field for invalid field values', () => {
    const storage = createMockStorage({
      [NEW_KEY]: JSON.stringify({ version: 1, fileListView: 'gallery', markdownView: 'cinema' }),
    });
    expect(readVisualSettings(storage)).toEqual({
      version: 1,
      fileListView: 'tree',
      markdownView: 'preview',
    });
  });

  it('falls back per field when fields are missing', () => {
    const storage = createMockStorage({
      [NEW_KEY]: JSON.stringify({ version: 1 }),
    });
    expect(readVisualSettings(storage)).toEqual(DEFAULT_VISUAL_SETTINGS);
  });
});

describe('writeVisualSettings', () => {
  it('writes the aggregate under the new key', () => {
    const storage = createMockStorage();
    writeVisualSettings({ version: 1, fileListView: 'list', markdownView: 'raw' }, storage);
    expect(storage.setItem).toHaveBeenCalledWith(
      NEW_KEY,
      JSON.stringify({ version: 1, fileListView: 'list', markdownView: 'raw' }),
    );
  });

  it('removes the legacy key on the first write (one-time migration cleanup)', () => {
    const storage = createMockStorage({ [LEGACY_KEY]: 'list' });
    writeVisualSettings(DEFAULT_VISUAL_SETTINGS, storage);
    expect(storage.removeItem).toHaveBeenCalledWith(LEGACY_KEY);
  });

  it('does not fail when storage is unavailable', () => {
    expect(() => writeVisualSettings(DEFAULT_VISUAL_SETTINGS, null)).not.toThrow();
  });
});
