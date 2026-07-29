import { get } from 'svelte/store';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PanelLayoutData } from '$lib/web/stores/panel-layout-store';
import {
  LEFT_PANEL_DEFAULT,
  LEFT_PANEL_MAX,
  LEFT_PANEL_MIN,
  panelLayout,
  readStoredLayout,
  resetLayout,
  RIGHT_PANEL_DEFAULT,
  RIGHT_PANEL_MAX,
  RIGHT_PANEL_MIN,
  setLeftWidth,
  setRightWidth,
  toggleLeft,
  toggleRight,
  writeStoredLayout,
} from '$lib/web/stores/panel-layout-store';

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

const STORAGE_KEY = 'diffscribe-panel-layout';

// ── Constants ──

describe('PanelLayout constants', () => {
  it('LEFT_PANEL_MIN is 200', () => {
    expect(LEFT_PANEL_MIN).toBe(200);
  });

  it('LEFT_PANEL_MAX is 480', () => {
    expect(LEFT_PANEL_MAX).toBe(480);
  });

  it('LEFT_PANEL_DEFAULT is 300', () => {
    expect(LEFT_PANEL_DEFAULT).toBe(300);
  });

  it('RIGHT_PANEL_MIN is 240', () => {
    expect(RIGHT_PANEL_MIN).toBe(240);
  });

  it('RIGHT_PANEL_MAX is 480', () => {
    expect(RIGHT_PANEL_MAX).toBe(480);
  });

  it('RIGHT_PANEL_DEFAULT is 320', () => {
    expect(RIGHT_PANEL_DEFAULT).toBe(320);
  });
});

// ── readStoredLayout ──
// Also exercises parseStoredLayout and clamp through the public API.

describe('readStoredLayout', () => {
  it('returns null when storage is null', () => {
    expect(readStoredLayout(null)).toBeNull();
  });

  it('returns null when storage throws on getItem', () => {
    const storage = createMockStorage();
    storage.getItem = vi.fn(() => {
      throw new Error('storage error');
    });
    expect(readStoredLayout(storage)).toBeNull();
  });

  it('returns null when no data is stored (null from getItem)', () => {
    const storage = createMockStorage();
    expect(readStoredLayout(storage)).toBeNull();
  });

  it('returns null when stored JSON is unparseable', () => {
    const storage = createMockStorage();
    storage.setItem(STORAGE_KEY, 'not-valid-json{');
    expect(readStoredLayout(storage)).toBeNull();
  });

  it('returns defaulted layout when stored value is an array (no overlap with PanelLayoutData keys)', () => {
    const storage = createMockStorage();
    storage.setItem(STORAGE_KEY, '[1, 2, 3]');
    const result = readStoredLayout(storage);
    expect(result).not.toBeNull();
    expect(result!.leftWidth).toBe(LEFT_PANEL_DEFAULT);
    expect(result!.rightWidth).toBe(RIGHT_PANEL_DEFAULT);
    expect(result!.leftCollapsed).toBe(false);
    expect(result!.rightCollapsed).toBe(false);
  });

  it('returns null when stored value is a bare string (not an object)', () => {
    const storage = createMockStorage();
    storage.setItem(STORAGE_KEY, '"hello"');
    expect(readStoredLayout(storage)).toBeNull();
  });

  it('returns null when stored value is null JSON literal', () => {
    const storage = createMockStorage();
    storage.setItem(STORAGE_KEY, 'null');
    expect(readStoredLayout(storage)).toBeNull();
  });

  // ── clamp via readStoredLayout (below min, within bounds, above max) ──

  it('clamps leftWidth to minimum when stored below min', () => {
    const storage = createMockStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify({ leftWidth: 0 }));
    const result = readStoredLayout(storage);
    expect(result).not.toBeNull();
    expect(result!.leftWidth).toBe(LEFT_PANEL_MIN);
  });

  it('clamps leftWidth to maximum when stored above max', () => {
    const storage = createMockStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify({ leftWidth: 9999 }));
    const result = readStoredLayout(storage);
    expect(result).not.toBeNull();
    expect(result!.leftWidth).toBe(LEFT_PANEL_MAX);
  });

  it('clamps rightWidth to minimum when stored below min', () => {
    const storage = createMockStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify({ rightWidth: -10 }));
    const result = readStoredLayout(storage);
    expect(result).not.toBeNull();
    expect(result!.rightWidth).toBe(RIGHT_PANEL_MIN);
  });

  it('clamps rightWidth to maximum when stored above max', () => {
    const storage = createMockStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify({ rightWidth: 9999 }));
    const result = readStoredLayout(storage);
    expect(result).not.toBeNull();
    expect(result!.rightWidth).toBe(RIGHT_PANEL_MAX);
  });

  it('returns leftWidth within bounds unchanged', () => {
    const storage = createMockStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify({ leftWidth: 350 }));
    const result = readStoredLayout(storage);
    expect(result).not.toBeNull();
    expect(result!.leftWidth).toBe(350);
  });

  it('returns rightWidth within bounds unchanged', () => {
    const storage = createMockStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify({ rightWidth: 400 }));
    const result = readStoredLayout(storage);
    expect(result).not.toBeNull();
    expect(result!.rightWidth).toBe(400);
  });

  // ── parseStoredLayout type-coercion guards ──

  it('uses default leftWidth when stored leftWidth is not a number', () => {
    const storage = createMockStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify({ leftWidth: 'abc' }));
    const result = readStoredLayout(storage);
    expect(result).not.toBeNull();
    expect(result!.leftWidth).toBe(LEFT_PANEL_DEFAULT);
  });

  it('uses default rightWidth when stored rightWidth is not a number', () => {
    const storage = createMockStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify({ rightWidth: null }));
    const result = readStoredLayout(storage);
    expect(result).not.toBeNull();
    expect(result!.rightWidth).toBe(RIGHT_PANEL_DEFAULT);
  });

  it('uses default leftCollapsed when stored leftCollapsed is not a boolean', () => {
    const storage = createMockStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify({ leftCollapsed: 'yes' }));
    const result = readStoredLayout(storage);
    expect(result).not.toBeNull();
    expect(result!.leftCollapsed).toBe(false);
  });

  it('preserves stored collapse states', () => {
    const storage = createMockStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify({ leftCollapsed: true, rightCollapsed: true }));
    const result = readStoredLayout(storage);
    expect(result).not.toBeNull();
    expect(result!.leftCollapsed).toBe(true);
    expect(result!.rightCollapsed).toBe(true);
  });

  it('uses defaults for missing fields', () => {
    const storage = createMockStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify({ leftCollapsed: true }));
    const result = readStoredLayout(storage);
    expect(result).not.toBeNull();
    expect(result!.leftWidth).toBe(LEFT_PANEL_DEFAULT);
    expect(result!.rightWidth).toBe(RIGHT_PANEL_DEFAULT);
    expect(result!.leftCollapsed).toBe(true);
    expect(result!.rightCollapsed).toBe(false);
  });

  it('reads full valid layout correctly', () => {
    const storage = createMockStorage();
    const layout: Partial<PanelLayoutData> = {
      leftWidth: 250,
      rightWidth: 350,
      leftCollapsed: false,
      rightCollapsed: true,
    };
    storage.setItem(STORAGE_KEY, JSON.stringify(layout));
    const result = readStoredLayout(storage);
    expect(result).toEqual({
      leftWidth: 250,
      rightWidth: 350,
      leftCollapsed: false,
      rightCollapsed: true,
    });
  });
});

// ── writeStoredLayout ──

describe('writeStoredLayout', () => {
  it('writes layout data to storage as JSON', () => {
    const storage = createMockStorage();
    const data: PanelLayoutData = {
      leftWidth: 250,
      rightWidth: 350,
      leftCollapsed: false,
      rightCollapsed: true,
    };
    writeStoredLayout(data, storage);
    expect(storage.setItem).toHaveBeenCalledWith(STORAGE_KEY, JSON.stringify(data));
  });

  it('writes and stores retrievable data', () => {
    const storage = createMockStorage();
    const data: PanelLayoutData = {
      leftWidth: 250,
      rightWidth: 350,
      leftCollapsed: false,
      rightCollapsed: true,
    };
    writeStoredLayout(data, storage);
    const stored = storage.getItem(STORAGE_KEY);
    expect(JSON.parse(stored!)).toEqual(data);
  });

  it('silently handles null storage', () => {
    const data: PanelLayoutData = {
      leftWidth: 250,
      rightWidth: 350,
      leftCollapsed: false,
      rightCollapsed: true,
    };
    expect(() => writeStoredLayout(data, null)).not.toThrow();
  });

  it('silently handles storage errors on setItem', () => {
    const storage = createMockStorage();
    storage.setItem = vi.fn(() => {
      throw new Error('quota exceeded');
    });
    const data: PanelLayoutData = {
      leftWidth: 250,
      rightWidth: 350,
      leftCollapsed: false,
      rightCollapsed: true,
    };
    expect(() => writeStoredLayout(data, storage)).not.toThrow();
  });
});

// ── Store actions ──

describe('Store actions', () => {
  beforeEach(() => {
    resetLayout();
  });

  it('toggleLeft flips leftCollapsed from false to true', () => {
    expect(get(panelLayout).leftCollapsed).toBe(false);
    toggleLeft();
    expect(get(panelLayout).leftCollapsed).toBe(true);
  });

  it('toggleLeft flips leftCollapsed from true to false', () => {
    toggleLeft();
    expect(get(panelLayout).leftCollapsed).toBe(true);
    toggleLeft();
    expect(get(panelLayout).leftCollapsed).toBe(false);
  });

  it('toggleRight flips rightCollapsed from false to true', () => {
    expect(get(panelLayout).rightCollapsed).toBe(false);
    toggleRight();
    expect(get(panelLayout).rightCollapsed).toBe(true);
  });

  it('toggleRight flips rightCollapsed from true to false', () => {
    toggleRight();
    expect(get(panelLayout).rightCollapsed).toBe(true);
    toggleRight();
    expect(get(panelLayout).rightCollapsed).toBe(false);
  });

  // ── setLeftWidth clamps ──

  it('setLeftWidth clamps below minimum', () => {
    setLeftWidth(0);
    expect(get(panelLayout).leftWidth).toBe(LEFT_PANEL_MIN);
  });

  it('setLeftWidth clamps above maximum', () => {
    setLeftWidth(9999);
    expect(get(panelLayout).leftWidth).toBe(LEFT_PANEL_MAX);
  });

  it('setLeftWidth accepts in-range value', () => {
    setLeftWidth(350);
    expect(get(panelLayout).leftWidth).toBe(350);
  });

  // ── setRightWidth clamps ──

  it('setRightWidth clamps below minimum', () => {
    setRightWidth(0);
    expect(get(panelLayout).rightWidth).toBe(RIGHT_PANEL_MIN);
  });

  it('setRightWidth clamps above maximum', () => {
    setRightWidth(9999);
    expect(get(panelLayout).rightWidth).toBe(RIGHT_PANEL_MAX);
  });

  it('setRightWidth accepts in-range value', () => {
    setRightWidth(420);
    expect(get(panelLayout).rightWidth).toBe(420);
  });

  // ── setLeftWidth preserves other fields ──

  it('setLeftWidth does not affect rightWidth or collapse states', () => {
    toggleRight();
    setLeftWidth(400);
    const state = get(panelLayout);
    expect(state.leftWidth).toBe(400);
    expect(state.rightWidth).toBe(RIGHT_PANEL_DEFAULT);
    expect(state.leftCollapsed).toBe(false);
    expect(state.rightCollapsed).toBe(true);
  });

  it('setRightWidth does not affect leftWidth or collapse states', () => {
    toggleLeft();
    setRightWidth(300);
    const state = get(panelLayout);
    expect(state.rightWidth).toBe(300);
    expect(state.leftWidth).toBe(LEFT_PANEL_DEFAULT);
    expect(state.leftCollapsed).toBe(true);
    expect(state.rightCollapsed).toBe(false);
  });

  // ── resetLayout ──

  it('resetLayout restores all default values after changes', () => {
    setLeftWidth(LEFT_PANEL_MAX);
    setRightWidth(RIGHT_PANEL_MIN);
    toggleLeft();
    toggleRight();
    resetLayout();
    const state = get(panelLayout);
    expect(state.leftWidth).toBe(LEFT_PANEL_DEFAULT);
    expect(state.rightWidth).toBe(RIGHT_PANEL_DEFAULT);
    expect(state.leftCollapsed).toBe(false);
    expect(state.rightCollapsed).toBe(false);
  });

  it('resetLayout restores defaults from a partially modified state', () => {
    setLeftWidth(250);
    toggleRight();
    resetLayout();
    const state = get(panelLayout);
    expect(state.leftWidth).toBe(LEFT_PANEL_DEFAULT);
    expect(state.rightCollapsed).toBe(false);
  });
});

// ── Store subscription ──

describe('Store subscription', () => {
  beforeEach(() => {
    resetLayout();
  });

  it('emits current state on subscribe', () => {
    const values: PanelLayoutData[] = [];
    const unsub = panelLayout.subscribe((v) => values.push(v));
    expect(values.length).toBeGreaterThanOrEqual(1);
    expect(values[0].leftWidth).toBe(LEFT_PANEL_DEFAULT);
    unsub();
  });

  it('notifies subscribers when toggleLeft is called', () => {
    const values: PanelLayoutData[] = [];
    const unsub = panelLayout.subscribe((v) => values.push(v));
    toggleLeft();
    expect(values[values.length - 1].leftCollapsed).toBe(true);
    unsub();
  });

  it('notifies subscribers when setLeftWidth is called', () => {
    const values: PanelLayoutData[] = [];
    const unsub = panelLayout.subscribe((v) => values.push(v));
    setLeftWidth(400);
    expect(values[values.length - 1].leftWidth).toBe(400);
    unsub();
  });
});
