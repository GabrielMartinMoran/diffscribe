import { writable } from 'svelte/store';

const STORAGE_KEY = 'diffscribe-panel-layout';

// ─── Bounds and defaults ───

export const LEFT_PANEL_MIN = 200;
export const LEFT_PANEL_MAX = 480;
export const LEFT_PANEL_DEFAULT = 300;
export const RIGHT_PANEL_MIN = 240;
export const RIGHT_PANEL_MAX = 480;
export const RIGHT_PANEL_DEFAULT = 320;

// ─── Types ───

export interface PanelLayoutData {
  leftWidth: number;
  rightWidth: number;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
}

// ─── Helpers ───

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function parseStoredLayout(raw: string | null): Partial<PanelLayoutData> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    return {
      leftWidth: typeof parsed.leftWidth === 'number' ? parsed.leftWidth : undefined,
      rightWidth: typeof parsed.rightWidth === 'number' ? parsed.rightWidth : undefined,
      leftCollapsed: typeof parsed.leftCollapsed === 'boolean' ? parsed.leftCollapsed : undefined,
      rightCollapsed:
        typeof parsed.rightCollapsed === 'boolean' ? parsed.rightCollapsed : undefined,
    };
  } catch {
    return null;
  }
}

/** Read stored layout from a Storage instance. Returns null on failure. */
export function readStoredLayout(storage: Storage | null): PanelLayoutData | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    const parsed = parseStoredLayout(raw);
    if (!parsed) return null;
    return {
      leftWidth: clamp(parsed.leftWidth ?? LEFT_PANEL_DEFAULT, LEFT_PANEL_MIN, LEFT_PANEL_MAX),
      rightWidth: clamp(parsed.rightWidth ?? RIGHT_PANEL_DEFAULT, RIGHT_PANEL_MIN, RIGHT_PANEL_MAX),
      leftCollapsed: parsed.leftCollapsed ?? false,
      rightCollapsed: parsed.rightCollapsed ?? false,
    };
  } catch {
    return null;
  }
}

/** Write layout to a Storage instance. Silently handles errors. */
export function writeStoredLayout(data: PanelLayoutData, storage: Storage | null): void {
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Silently handle quota exceeded or other storage errors
  }
}

// ─── Default layout ───

const defaultLayout: PanelLayoutData = {
  leftWidth: LEFT_PANEL_DEFAULT,
  rightWidth: RIGHT_PANEL_DEFAULT,
  leftCollapsed: false,
  rightCollapsed: false,
};

// ─── Store ───

export const panelLayout = writable<PanelLayoutData>(defaultLayout);

// Initialize from localStorage on the client
if (typeof localStorage !== 'undefined') {
  const stored = readStoredLayout(localStorage);
  if (stored) {
    panelLayout.set(stored);
  }
}

// Persist to localStorage on every change
if (typeof localStorage !== 'undefined') {
  panelLayout.subscribe((data) => {
    writeStoredLayout(data, localStorage);
  });
}

// ─── Actions ───

export function toggleLeft(): void {
  panelLayout.update((d) => ({ ...d, leftCollapsed: !d.leftCollapsed }));
}

export function toggleRight(): void {
  panelLayout.update((d) => ({ ...d, rightCollapsed: !d.rightCollapsed }));
}

export function setLeftWidth(width: number): void {
  panelLayout.update((d) => ({
    ...d,
    leftWidth: clamp(width, LEFT_PANEL_MIN, LEFT_PANEL_MAX),
  }));
}

export function setRightWidth(width: number): void {
  panelLayout.update((d) => ({
    ...d,
    rightWidth: clamp(width, RIGHT_PANEL_MIN, RIGHT_PANEL_MAX),
  }));
}

export function resetLayout(): void {
  panelLayout.set({ ...defaultLayout });
}
