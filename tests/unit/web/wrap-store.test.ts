import { describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_WRAP,
  readStoredWrap,
  resolveWrap,
  WRAP_STORAGE_KEY,
  writeStoredWrap,
} from '$lib/web/stores/wrap-store';

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

describe('wrap-store constants', () => {
  it('DEFAULT_WRAP is false (diff stays no-wrap by default)', () => {
    expect(DEFAULT_WRAP).toBe(false);
  });

  it('WRAP_STORAGE_KEY is "diffscribe-line-wrap"', () => {
    expect(WRAP_STORAGE_KEY).toBe('diffscribe-line-wrap');
  });
});

describe('resolveWrap', () => {
  it('returns false for null', () => {
    expect(resolveWrap(null)).toBe(false);
  });

  it('returns true for "true"', () => {
    expect(resolveWrap('true')).toBe(true);
  });

  it('returns false for "false"', () => {
    expect(resolveWrap('false')).toBe(false);
  });

  it('falls back to default for any other value', () => {
    expect(resolveWrap('banana')).toBe(false);
  });
});

describe('readStoredWrap / writeStoredWrap', () => {
  it('reads the stored value', () => {
    const storage = createMockStorage({ [WRAP_STORAGE_KEY]: 'true' });
    expect(readStoredWrap(storage)).toBe('true');
  });

  it('returns null when nothing is stored', () => {
    const storage = createMockStorage();
    expect(readStoredWrap(storage)).toBeNull();
  });

  it('writes the enabled flag', () => {
    const storage = createMockStorage();
    writeStoredWrap(true, storage);
    expect(storage.setItem).toHaveBeenCalledWith(WRAP_STORAGE_KEY, 'true');
  });

  it('writes the disabled flag', () => {
    const storage = createMockStorage();
    writeStoredWrap(false, storage);
    expect(storage.setItem).toHaveBeenCalledWith(WRAP_STORAGE_KEY, 'false');
  });
});
