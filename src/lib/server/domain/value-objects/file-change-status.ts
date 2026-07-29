export enum FileChangeStatus {
  ADDED = 'added',
  MODIFIED = 'modified',
  DELETED = 'deleted',
  RENAMED = 'renamed',
  COPIED = 'copied',
  TYPE_CHANGED = 'type-changed',
  UNMERGED = 'unmerged',
  UNTRACKED = 'untracked',
  UNKNOWN = 'unknown',
}
