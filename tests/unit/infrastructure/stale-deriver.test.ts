import { describe, expect, it } from 'vitest';

import { StaleStatus } from '$lib/server/domain/value-objects/stale-status';
import { deriveStaleStatus } from '$lib/server/infrastructure/hash/stale-deriver';

const storedComp = JSON.stringify({ comparisonType: 'working-tree-vs-head' });
const differentComp = JSON.stringify({ comparisonType: 'branch-vs-branch' });

describe('StaleDeriver', () => {
  it('returns CURRENT when nothing has changed', () => {
    const result = deriveStaleStatus({
      storedComparisonJson: storedComp,
      currentComparisonJson: storedComp,
      filePath: 'src/app.ts',
      storedContentHash: 'abc',
      currentContentHash: 'abc',
      lineRangeStart: 10,
      lineRangeEnd: 15,
      fileExists: true,
      fileRenamed: false,
      isBinary: false,
      isTruncated: false,
      isCommitVsCommit: false,
    });
    expect(result).toBe(StaleStatus.CURRENT);
  });

  it('returns STALE_CONTENT_CHANGED when hashes differ', () => {
    const result = deriveStaleStatus({
      storedComparisonJson: storedComp,
      currentComparisonJson: storedComp,
      filePath: 'src/app.ts',
      storedContentHash: 'abc',
      currentContentHash: 'def',
      lineRangeStart: 10,
      lineRangeEnd: 15,
      fileExists: true,
      fileRenamed: false,
      isBinary: false,
      isTruncated: false,
      isCommitVsCommit: false,
    });
    expect(result).toBe(StaleStatus.STALE_CONTENT_CHANGED);
  });

  it('returns STALE_FILE_DELETED when file does not exist', () => {
    const result = deriveStaleStatus({
      storedComparisonJson: storedComp,
      currentComparisonJson: storedComp,
      filePath: 'src/removed.ts',
      storedContentHash: 'abc',
      currentContentHash: null,
      lineRangeStart: null,
      lineRangeEnd: null,
      fileExists: false,
      fileRenamed: false,
      isBinary: false,
      isTruncated: false,
      isCommitVsCommit: false,
    });
    expect(result).toBe(StaleStatus.STALE_FILE_DELETED);
  });

  it('returns STALE_FILE_RENAMED even when file does not exist at old path', () => {
    const result = deriveStaleStatus({
      storedComparisonJson: storedComp,
      currentComparisonJson: storedComp,
      filePath: 'src/old.ts',
      storedContentHash: 'abc',
      currentContentHash: null,
      lineRangeStart: null,
      lineRangeEnd: null,
      fileExists: false,
      fileRenamed: true,
      isBinary: false,
      isTruncated: false,
      isCommitVsCommit: false,
    });
    expect(result).toBe(StaleStatus.STALE_FILE_RENAMED);
  });

  it('returns CURRENT for binary files when comparison is unchanged', () => {
    const result = deriveStaleStatus({
      storedComparisonJson: storedComp,
      currentComparisonJson: storedComp,
      filePath: 'assets/logo.png',
      storedContentHash: 'abc',
      currentContentHash: null,
      lineRangeStart: null,
      lineRangeEnd: null,
      fileExists: true,
      fileRenamed: false,
      isBinary: true,
      isTruncated: false,
      isCommitVsCommit: false,
    });
    expect(result).toBe(StaleStatus.CURRENT);
  });

  it('returns STALE_COMPARISON_CHANGED for binary files when comparison differs', () => {
    const result = deriveStaleStatus({
      storedComparisonJson: storedComp,
      currentComparisonJson: differentComp,
      filePath: 'assets/logo.png',
      storedContentHash: 'abc',
      currentContentHash: null,
      lineRangeStart: null,
      lineRangeEnd: null,
      fileExists: true,
      fileRenamed: false,
      isBinary: true,
      isTruncated: false,
      isCommitVsCommit: false,
    });
    expect(result).toBe(StaleStatus.STALE_COMPARISON_CHANGED);
  });

  it('returns STALE_RANGE_MISSING when lines are out of range', () => {
    const result = deriveStaleStatus({
      storedComparisonJson: storedComp,
      currentComparisonJson: storedComp,
      filePath: 'src/app.ts',
      storedContentHash: 'abc',
      currentContentHash: null,
      lineRangeStart: 50,
      lineRangeEnd: 55,
      fileExists: true,
      fileRenamed: false,
      isBinary: false,
      isTruncated: false,
      isCommitVsCommit: false,
    });
    expect(result).toBe(StaleStatus.STALE_RANGE_MISSING);
  });

  it('returns STALE_COMPARISON_CHANGED for review-level observations', () => {
    const result = deriveStaleStatus({
      storedComparisonJson: storedComp,
      currentComparisonJson: differentComp,
      filePath: null,
      storedContentHash: null,
      currentContentHash: null,
      lineRangeStart: null,
      lineRangeEnd: null,
      fileExists: true,
      fileRenamed: false,
      isBinary: false,
      isTruncated: false,
      isCommitVsCommit: false,
    });
    expect(result).toBe(StaleStatus.STALE_COMPARISON_CHANGED);
  });

  it('returns STALE_COMPARISON_CHANGED for file-level when comparison differs', () => {
    const result = deriveStaleStatus({
      storedComparisonJson: storedComp,
      currentComparisonJson: differentComp,
      filePath: 'src/app.ts',
      storedContentHash: 'abc',
      currentContentHash: 'abc',
      lineRangeStart: null,
      lineRangeEnd: null,
      fileExists: true,
      fileRenamed: false,
      isBinary: false,
      isTruncated: false,
      isCommitVsCommit: false,
    });
    expect(result).toBe(StaleStatus.STALE_COMPARISON_CHANGED);
  });

  it('returns CURRENT for commit-vs-commit', () => {
    const result = deriveStaleStatus({
      storedComparisonJson: storedComp,
      currentComparisonJson: differentComp,
      filePath: 'src/app.ts',
      storedContentHash: 'abc',
      currentContentHash: 'def',
      lineRangeStart: 10,
      lineRangeEnd: 15,
      fileExists: true,
      fileRenamed: false,
      isBinary: false,
      isTruncated: false,
      isCommitVsCommit: true,
    });
    expect(result).toBe(StaleStatus.CURRENT);
  });

  it('returns CURRENT for review-level when comparison is unchanged', () => {
    const result = deriveStaleStatus({
      storedComparisonJson: storedComp,
      currentComparisonJson: storedComp,
      filePath: null,
      storedContentHash: null,
      currentContentHash: null,
      lineRangeStart: null,
      lineRangeEnd: null,
      fileExists: true,
      fileRenamed: false,
      isBinary: false,
      isTruncated: false,
      isCommitVsCommit: false,
    });
    expect(result).toBe(StaleStatus.CURRENT);
  });

  it('returns STALE_TRUNCATED when truncated', () => {
    const result = deriveStaleStatus({
      storedComparisonJson: storedComp,
      currentComparisonJson: storedComp,
      filePath: 'src/app.ts',
      storedContentHash: 'abc',
      currentContentHash: null,
      lineRangeStart: null,
      lineRangeEnd: null,
      fileExists: true,
      fileRenamed: false,
      isBinary: false,
      isTruncated: true,
      isCommitVsCommit: false,
    });
    expect(result).toBe(StaleStatus.STALE_TRUNCATED);
  });
});
