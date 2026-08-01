/**
 * DiffScribe — file list view preference (client-only).
 *
 * Follows the theme-store/wrap-store pattern: the list/tree view choice is
 * stored exclusively in browser localStorage and defaults to the list view.
 */

export type FileListView = 'list' | 'tree';

export const FILE_LIST_VIEW_STORAGE_KEY = 'diffscribe-file-list-view';

export const DEFAULT_FILE_LIST_VIEW: FileListView = 'list';

export function resolveFileListView(stored: string | null): FileListView {
  return stored === 'tree' ? 'tree' : DEFAULT_FILE_LIST_VIEW;
}

export function readStoredFileListView(storage: Storage | null): string | null {
  if (!storage) return null;
  return storage.getItem(FILE_LIST_VIEW_STORAGE_KEY);
}

export function writeStoredFileListView(view: FileListView, storage: Storage | null): void {
  if (!storage) return;
  storage.setItem(FILE_LIST_VIEW_STORAGE_KEY, view);
}
