import { StaleStatus } from '$lib/server/domain/value-objects/stale-status';

/**
 * Derived staleness status (not persisted). Recalculated on demand
 * when the observation panel opens, the Comparison changes, or diff refreshes.
 */
export interface StaleCheckInput {
  storedComparisonJson: string;
  currentComparisonJson: string;
  filePath: string | null;
  storedContentHash: string | null;
  currentContentHash: string | null;
  lineRangeStart: number | null;
  lineRangeEnd: number | null;
  fileExists: boolean;
  fileRenamed: boolean;
  isBinary: boolean;
  isTruncated: boolean;
  isCommitVsCommit: boolean;
}

export function deriveStaleStatus(input: StaleCheckInput): StaleStatus {
  // Review-level observations: only comparison matters
  if (!input.filePath) {
    if (input.storedComparisonJson !== input.currentComparisonJson) {
      return StaleStatus.STALE_COMPARISON_CHANGED;
    }
    return StaleStatus.CURRENT;
  }

  // Commit-vs-commit comparisons are immutable — always current for file/range observations
  // (only review-level can be comparison-changed)
  if (input.isCommitVsCommit) {
    return StaleStatus.CURRENT;
  }

  // File-level checks — check rename before deletion
  if (input.fileRenamed) {
    return StaleStatus.STALE_FILE_RENAMED;
  }

  if (!input.fileExists) {
    return StaleStatus.STALE_FILE_DELETED;
  }

  if (input.isBinary) {
    // Binary files: can't detect content changes. Only stale if comparison changed.
    if (input.storedComparisonJson !== input.currentComparisonJson) {
      return StaleStatus.STALE_COMPARISON_CHANGED;
    }
    return StaleStatus.CURRENT;
  }

  // If we have a stored hash but no current hash to compare (e.g., truncated)
  if (input.isTruncated) {
    return StaleStatus.STALE_TRUNCATED;
  }

  // Range-level checks
  if (input.lineRangeStart !== null && input.lineRangeEnd !== null) {
    // If we can't compute a current hash (lines missing), range is missing
    if (input.currentContentHash === null) {
      return StaleStatus.STALE_RANGE_MISSING;
    }
  }

  // Content hash comparison
  if (
    input.storedContentHash !== null &&
    input.currentContentHash !== null &&
    input.storedContentHash !== input.currentContentHash
  ) {
    return StaleStatus.STALE_CONTENT_CHANGED;
  }

  // Comparison changed for file/range observations
  if (input.storedComparisonJson !== input.currentComparisonJson) {
    return StaleStatus.STALE_COMPARISON_CHANGED;
  }

  return StaleStatus.CURRENT;
}
