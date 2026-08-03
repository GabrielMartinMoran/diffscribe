import { describe, expect, it } from 'vitest';

import type { BranchDto } from '$lib/server/application/dto/results/git-context-results';
import {
  filterBranchGroups,
  findBranchByCanonicalRef,
  fuzzyMatchBranch,
  groupBranches,
} from '$lib/web/utils/branch-options';

/**
 * Pure branch grouping/filtering contract for the Git ref popup (tranche C).
 * The server delivers branches already ordered (local first, then cached
 * remote, recency within group); these helpers split them into groups and
 * filter both groups with one fuzzy pass without disturbing that order.
 */

function branch(name: string, canonicalRef: string, overrides: Partial<BranchDto> = {}): BranchDto {
  return {
    name,
    canonicalRef,
    isCurrent: false,
    ...overrides,
  };
}

describe('groupBranches', () => {
  it('splits branches into Local and Cached remote groups preserving order', () => {
    const branches = [
      branch('dev', 'refs/heads/dev', { committerDate: '2026-02-01T00:00:00.000Z' }),
      branch('old', 'refs/heads/old', { committerDate: '2026-01-01T00:00:00.000Z' }),
      branch('origin/dev', 'refs/remotes/origin/dev', {
        isRemote: true,
        remoteName: 'origin',
      }),
    ];
    const groups = groupBranches(branches);
    expect(groups.map((g) => g.title)).toEqual(['Local', 'Cached remote']);
    expect(groups[0].options.map((o) => o.label)).toEqual(['dev', 'old']);
    expect(groups[1].options.map((o) => o.label)).toEqual(['origin/dev']);
  });

  it('keeps server-side order untouched within each group', () => {
    const branches = [
      branch('a', 'refs/heads/a'),
      branch('b', 'refs/heads/b'),
      branch('r', 'refs/remotes/o/r', { isRemote: true }),
      branch('s', 'refs/remotes/o/s', { isRemote: true }),
    ];
    const groups = groupBranches(branches);
    expect(groups[0].options.map((o) => o.label)).toEqual(['a', 'b']);
    expect(groups[1].options.map((o) => o.label)).toEqual(['r', 's']);
  });

  it('exposes the canonical ref as the stable selection key', () => {
    const groups = groupBranches([
      branch('dev', 'refs/heads/dev'),
      branch('origin/dev', 'refs/remotes/origin/dev', { isRemote: true, remoteName: 'origin' }),
    ]);
    expect(groups[0].options[0].canonicalRef).toBe('refs/heads/dev');
    expect(groups[1].options[0].canonicalRef).toBe('refs/remotes/origin/dev');
  });
});

describe('fuzzyMatchBranch', () => {
  it('matches a case-insensitive subsequence', () => {
    const match = fuzzyMatchBranch('dv', 'dev');
    expect(match).not.toBeNull();
    expect(match!.ranges).toEqual([
      [0, 1],
      [2, 3],
    ]);
  });

  it('matches across the visible remote label', () => {
    const match = fuzzyMatchBranch('od', 'origin/dev');
    expect(match).not.toBeNull();
  });

  it('returns null when the query does not match', () => {
    expect(fuzzyMatchBranch('zzz', 'dev')).toBeNull();
    expect(fuzzyMatchBranch('x', 'origin/dev')).toBeNull();
  });

  it('scores an exact match above a bare subsequence', () => {
    const exact = fuzzyMatchBranch('dev', 'dev');
    const subseq = fuzzyMatchBranch('dv', 'dev');
    expect(exact).not.toBeNull();
    expect(subseq).not.toBeNull();
    expect(exact!.score).toBeGreaterThan(subseq!.score);
  });

  it('treats an empty query as a match for everything', () => {
    expect(fuzzyMatchBranch('', 'anything')).not.toBeNull();
  });
});

describe('filterBranchGroups', () => {
  const groups = () =>
    groupBranches([
      branch('dev', 'refs/heads/dev'),
      branch('docs', 'refs/heads/docs'),
      branch('origin/dev', 'refs/remotes/origin/dev', { isRemote: true }),
      branch('origin/ops', 'refs/remotes/origin/ops', { isRemote: true }),
    ]);

  it('returns every group untouched for an empty query', () => {
    const filtered = filterBranchGroups(groups(), '');
    expect(filtered[0].options.map((o) => o.label)).toEqual(['dev', 'docs']);
    expect(filtered[1].options.map((o) => o.label)).toEqual(['origin/dev', 'origin/ops']);
  });

  it('filters both groups with the same fuzzy query', () => {
    const filtered = filterBranchGroups(groups(), 'dv');
    expect(filtered[0].options.map((o) => o.label)).toEqual(['dev']);
    expect(filtered[1].options.map((o) => o.label)).toEqual(['origin/dev']);
  });

  it('drops groups with no matches but keeps group order', () => {
    const filtered = filterBranchGroups(groups(), 'ops');
    expect(filtered.map((g) => g.title)).toEqual(['Cached remote']);
    expect(filtered[0].options.map((o) => o.label)).toEqual(['origin/ops']);
  });

  it('returns empty groups for a no-match query', () => {
    const filtered = filterBranchGroups(groups(), 'zzz');
    expect(filtered).toHaveLength(0);
  });
});

describe('findBranchByCanonicalRef', () => {
  it('finds a branch by its canonical ref', () => {
    const groups = groupBranches([
      branch('dev', 'refs/heads/dev'),
      branch('origin/dev', 'refs/remotes/origin/dev', { isRemote: true }),
    ]);
    const hit = findBranchByCanonicalRef(groups, 'refs/remotes/origin/dev');
    expect(hit?.label).toBe('origin/dev');
  });

  it('disambiguates local vs cached remote with identical visible names', () => {
    const groups = groupBranches([
      branch('origin/main', 'refs/heads/origin/main'),
      branch('origin/main', 'refs/remotes/origin/main', { isRemote: true, remoteName: 'origin' }),
    ]);
    expect(groups[0].options[0].label).toBe('origin/main');
    expect(groups[1].options[0].label).toBe('origin/main');
    expect(findBranchByCanonicalRef(groups, 'refs/heads/origin/main')?.isRemote).toBe(false);
    expect(findBranchByCanonicalRef(groups, 'refs/remotes/origin/main')?.isRemote).toBe(true);
  });

  it('returns null for an unknown canonical ref', () => {
    const groups = groupBranches([branch('dev', 'refs/heads/dev')]);
    expect(findBranchByCanonicalRef(groups, 'refs/heads/missing')).toBeNull();
  });
});
