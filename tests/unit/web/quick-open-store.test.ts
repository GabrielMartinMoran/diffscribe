import { describe, expect, it, vi } from 'vitest';

import {
  QUICK_OPEN_INCLUDE_UNTRACKED_STORAGE_KEY,
  removeLegacyQuickOpenSetting,
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

describe('quick-open-store legacy key', () => {
  it('keeps the diffscribe-quick-open-include-untracked storage key', () => {
    expect(QUICK_OPEN_INCLUDE_UNTRACKED_STORAGE_KEY).toBe(
      'diffscribe-quick-open-include-untracked',
    );
  });

  it('removes the legacy include-untracked key when present', () => {
    const storage = createMockStorage({ [QUICK_OPEN_INCLUDE_UNTRACKED_STORAGE_KEY]: 'true' });
    removeLegacyQuickOpenSetting(storage);
    expect(storage.removeItem).toHaveBeenCalledWith(QUICK_OPEN_INCLUDE_UNTRACKED_STORAGE_KEY);
    expect(storage.getItem(QUICK_OPEN_INCLUDE_UNTRACKED_STORAGE_KEY)).toBeNull();
  });

  it('is a no-op when the legacy key is absent', () => {
    const storage = createMockStorage();
    removeLegacyQuickOpenSetting(storage);
    expect(storage.removeItem).toHaveBeenCalledWith(QUICK_OPEN_INCLUDE_UNTRACKED_STORAGE_KEY);
  });

  it('tolerates null storage', () => {
    expect(() => removeLegacyQuickOpenSetting(null)).not.toThrow();
  });
});
