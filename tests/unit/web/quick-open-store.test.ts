import { describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_QUICK_OPEN_INCLUDE_UNTRACKED,
  QUICK_OPEN_INCLUDE_UNTRACKED_STORAGE_KEY,
  readStoredQuickOpenIncludeUntracked,
  resolveQuickOpenIncludeUntracked,
  writeStoredQuickOpenIncludeUntracked,
} from '$lib/web/stores/quick-open-store';

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

describe('quick-open-store constants', () => {
  it('defaults to tracked-only (false)', () => {
    expect(DEFAULT_QUICK_OPEN_INCLUDE_UNTRACKED).toBe(false);
  });

  it('uses the diffscribe-quick-open-include-untracked storage key', () => {
    expect(QUICK_OPEN_INCLUDE_UNTRACKED_STORAGE_KEY).toBe(
      'diffscribe-quick-open-include-untracked',
    );
  });
});

describe('resolveQuickOpenIncludeUntracked', () => {
  it('returns false for null', () => {
    expect(resolveQuickOpenIncludeUntracked(null)).toBe(false);
  });

  it('returns true only for the string "true"', () => {
    expect(resolveQuickOpenIncludeUntracked('true')).toBe(true);
    expect(resolveQuickOpenIncludeUntracked('false')).toBe(false);
    expect(resolveQuickOpenIncludeUntracked('banana')).toBe(false);
  });
});

describe('readStoredQuickOpenIncludeUntracked / writeStoredQuickOpenIncludeUntracked', () => {
  it('reads the stored value', () => {
    const storage = createMockStorage({ [QUICK_OPEN_INCLUDE_UNTRACKED_STORAGE_KEY]: 'true' });
    expect(readStoredQuickOpenIncludeUntracked(storage)).toBe('true');
  });

  it('returns null when nothing is stored', () => {
    expect(readStoredQuickOpenIncludeUntracked(createMockStorage())).toBeNull();
  });

  it('writes the enabled and disabled flags', () => {
    const storage = createMockStorage();
    writeStoredQuickOpenIncludeUntracked(true, storage);
    expect(storage.setItem).toHaveBeenCalledWith(QUICK_OPEN_INCLUDE_UNTRACKED_STORAGE_KEY, 'true');
    writeStoredQuickOpenIncludeUntracked(false, storage);
    expect(storage.setItem).toHaveBeenCalledWith(QUICK_OPEN_INCLUDE_UNTRACKED_STORAGE_KEY, 'false');
  });
});
