import { describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_FILE_LIST_VIEW,
  FILE_LIST_VIEW_STORAGE_KEY,
  readStoredFileListView,
  resolveFileListView,
  writeStoredFileListView,
} from '$lib/web/stores/file-list-view-store';

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

describe('file-list-view-store', () => {
  it('defaults to the list view', () => {
    expect(DEFAULT_FILE_LIST_VIEW).toBe('list');
  });

  it('uses the contract storage key', () => {
    expect(FILE_LIST_VIEW_STORAGE_KEY).toBe('diffscribe-file-list-view');
  });

  it('resolveFileListView accepts list and tree', () => {
    expect(resolveFileListView('list')).toBe('list');
    expect(resolveFileListView('tree')).toBe('tree');
  });

  it('resolveFileListView falls back to the default for any other value', () => {
    expect(resolveFileListView('gallery')).toBe('list');
    expect(resolveFileListView(null)).toBe('list');
  });

  it('readStoredFileListView returns the stored value or null', () => {
    expect(
      readStoredFileListView(createMockStorage({ [FILE_LIST_VIEW_STORAGE_KEY]: 'tree' })),
    ).toBe('tree');
    expect(readStoredFileListView(createMockStorage())).toBeNull();
    expect(readStoredFileListView(null)).toBeNull();
  });

  it('writeStoredFileListView persists the choice', () => {
    const storage = createMockStorage();
    writeStoredFileListView('tree', storage);
    expect(storage.setItem).toHaveBeenCalledWith(FILE_LIST_VIEW_STORAGE_KEY, 'tree');
  });
});
