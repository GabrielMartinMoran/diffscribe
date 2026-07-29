import { derived, writable } from 'svelte/store';

export interface ActiveFile {
  path: string;
  label: string;
}

/**
 * Single client-side source of truth for the selected/open file.
 * Replaces any local `selectedFile` state in +page.svelte.
 */
export const activeFile = writable<ActiveFile | null>(null);

/** Derived convenience — just the file path, or null. */
export const activeFilePath = derived(activeFile, ($f) => $f?.path ?? null);

/** Derived convenience — just the file label, or null. */
export const activeFileLabel = derived(activeFile, ($f) => $f?.label ?? null);

/** Set the active / selected file and derive a label from the path. */
export function setActiveFile(path: string, label?: string): void {
  activeFile.set({ path, label: label ?? path });
}

/** Clear the active file selection. */
export function clearActiveFile(): void {
  activeFile.set(null);
}
