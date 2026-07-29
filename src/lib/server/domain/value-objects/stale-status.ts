export enum StaleStatus {
  CURRENT = 'current',
  STALE_CONTENT_CHANGED = 'stale-content-changed',
  STALE_RANGE_MISSING = 'stale-range-missing',
  STALE_FILE_DELETED = 'stale-file-deleted',
  STALE_FILE_RENAMED = 'stale-file-renamed',
  STALE_BINARY = 'stale-binary',
  STALE_TRUNCATED = 'stale-truncated',
  STALE_COMPARISON_CHANGED = 'stale-comparison-changed',
  STALE_UNKNOWN = 'stale-unknown',
}
