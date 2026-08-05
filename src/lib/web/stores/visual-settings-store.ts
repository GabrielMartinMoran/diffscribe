/**
 * DiffScribe — client-only visualization settings aggregate.
 *
 * Versioned replacement for the legacy `diffscribe-file-list-view` key.
 * Carries the file-list presentation (tree/list) and the Markdown viewer
 * default (raw/preview). Read-through migration honors an explicit legacy
 * `list` choice exactly once; the legacy key is removed on the first write.
 */

export type FileListView = 'list' | 'tree';
export type MarkdownView = 'raw' | 'preview';

export interface VisualSettings {
  version: 1;
  fileListView: FileListView;
  markdownView: MarkdownView;
}

export const VISUAL_SETTINGS_STORAGE_KEY = 'diffscribe-visual-settings';
export const LEGACY_FILE_LIST_VIEW_STORAGE_KEY = 'diffscribe-file-list-view';

export const DEFAULT_VISUAL_SETTINGS: VisualSettings = {
  version: 1,
  fileListView: 'tree',
  markdownView: 'preview',
};

function parseFileListView(value: unknown): FileListView {
  return value === 'list' || value === 'tree' ? value : DEFAULT_VISUAL_SETTINGS.fileListView;
}

function parseMarkdownView(value: unknown): MarkdownView {
  return value === 'raw' || value === 'preview' ? value : DEFAULT_VISUAL_SETTINGS.markdownView;
}

function readAggregate(storage: Storage | null): VisualSettings | null {
  if (!storage) return null;
  const raw = storage.getItem(VISUAL_SETTINGS_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const candidate = parsed as Record<string, unknown>;
    if (candidate.version !== 1) return null;
    return {
      version: 1,
      fileListView: parseFileListView(candidate.fileListView),
      markdownView: parseMarkdownView(candidate.markdownView),
    };
  } catch {
    return null;
  }
}

/**
 * Read the visualization settings, applying read-through migration from the
 * legacy `diffscribe-file-list-view` key when the versioned aggregate is
 * absent. An explicit stored `list` is honored once; anything else keeps the
 * fresh-context tree default. Malformed aggregate values fall back per field.
 */
export function readVisualSettings(storage: Storage | null): VisualSettings {
  const aggregate = readAggregate(storage);
  if (aggregate) return aggregate;

  const legacy = storage?.getItem(LEGACY_FILE_LIST_VIEW_STORAGE_KEY);
  if (legacy === 'list') {
    return { ...DEFAULT_VISUAL_SETTINGS, fileListView: 'list' };
  }
  return { ...DEFAULT_VISUAL_SETTINGS };
}

/**
 * Write the visualization settings aggregate and remove the legacy key on the
 * first write (one-time migration cleanup). No explicit stored value is
 * silently overwritten — callers pass the full aggregate they want stored.
 */
export function writeVisualSettings(settings: VisualSettings, storage: Storage | null): void {
  if (!storage) return;
  storage.setItem(VISUAL_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  storage.removeItem(LEGACY_FILE_LIST_VIEW_STORAGE_KEY);
}
