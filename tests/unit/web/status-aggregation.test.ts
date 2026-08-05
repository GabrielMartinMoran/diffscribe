import { describe, expect, it } from 'vitest';

import { aggregateStatus, descendantStatuses } from '$lib/web/utils/status-aggregation';

describe('aggregateStatus', () => {
  it('returns null for empty input', () => {
    expect(aggregateStatus([])).toBeNull();
  });

  it('returns the single status for one item', () => {
    expect(aggregateStatus(['modified'])).toBe('modified');
  });

  it('applies the approved deterministic precedence', () => {
    // unmerged > deleted > modified > type-changed > added > renamed >
    // copied > untracked > unknown
    expect(aggregateStatus(['untracked', 'modified'])).toBe('modified');
    expect(aggregateStatus(['added', 'untracked'])).toBe('added');
    expect(aggregateStatus(['renamed', 'copied', 'untracked'])).toBe('renamed');
    expect(aggregateStatus(['type-changed', 'added'])).toBe('type-changed');
    expect(aggregateStatus(['deleted', 'type-changed'])).toBe('deleted');
    expect(aggregateStatus(['unmerged', 'deleted'])).toBe('unmerged');
    expect(aggregateStatus(['copied', 'untracked'])).toBe('copied');
    expect(aggregateStatus(['unknown', 'untracked'])).toBe('untracked');
  });

  it('returns the highest-precedence status regardless of input order', () => {
    expect(aggregateStatus(['unknown', 'unmerged', 'modified'])).toBe('unmerged');
    expect(aggregateStatus(['modified', 'unknown', 'unmerged'])).toBe('unmerged');
  });

  it('works with an iterable (Set) input', () => {
    expect(aggregateStatus(new Set(['added', 'untracked']))).toBe('added');
  });
});

describe('descendantStatuses', () => {
  it('collects every status whose path starts with the node path prefix', () => {
    const map = new Map([
      ['src/app.ts', 'modified'],
      ['src/components/Button.tsx', 'added'],
      ['src/components/Input.tsx', 'untracked'],
      ['README.md', 'deleted'],
    ]);
    expect(descendantStatuses('src', map)).toEqual(['modified', 'added', 'untracked']);
  });

  it('collects nested descendants for deep prefixes', () => {
    const map = new Map([
      ['src/components/Button.tsx', 'modified'],
      ['src/components/Input.tsx', 'added'],
    ]);
    expect(descendantStatuses('src/components', map)).toEqual(['modified', 'added']);
  });

  it('does not match sibling paths that merely share a prefix', () => {
    const map = new Map([
      ['src/app.ts', 'modified'],
      ['src-app-other/file.ts', 'deleted'],
    ]);
    expect(descendantStatuses('src', map)).toEqual(['modified']);
  });

  it('returns an empty array when no descendants exist', () => {
    const map = new Map([['README.md', 'modified']]);
    expect(descendantStatuses('src', map)).toEqual([]);
  });

  it('returns an empty array for an empty map', () => {
    expect(descendantStatuses('src', new Map())).toEqual([]);
  });

  it('excludes the exact node path itself (descendants only)', () => {
    const map = new Map([
      ['src', 'modified'],
      ['src/app.ts', 'added'],
    ]);
    expect(descendantStatuses('src', map)).toEqual(['added']);
  });
});
