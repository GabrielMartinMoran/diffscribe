import { describe, expect, it } from 'vitest';

import {
  type BranchSortable,
  compareBranches,
  sortBranches,
} from '$lib/server/infrastructure/git/branch-sort';

/**
 * Pure TypeScript branch ordering contract (tranche C):
 * - Local group first, Cached remote group second.
 * - Within a group, committerDate descending (newest first).
 * - Branches without a date sort last within their group.
 * - Equal dates (or equal missing-date groups) tie-break by canonicalRef
 *   ascending.
 *
 * Sorting must not rely on multiple Git `--sort` keys: the adapter reads the
 * refs and this pure helper orders them deterministically.
 */

function branch(canonicalRef: string, isRemote: boolean, committerDate?: string): BranchSortable {
  return { canonicalRef, isRemote, ...(committerDate ? { committerDate } : {}) };
}

describe('sortBranches', () => {
  it('puts local branches before cached remote branches', () => {
    const sorted = sortBranches([
      branch('refs/remotes/origin/main', true, '2026-01-01T00:00:00.000Z'),
      branch('refs/heads/dev', false, '2026-01-02T00:00:00.000Z'),
    ]);
    expect(sorted.map((b) => b.canonicalRef)).toEqual([
      'refs/heads/dev',
      'refs/remotes/origin/main',
    ]);
  });

  it('orders a group by committerDate descending', () => {
    const sorted = sortBranches([
      branch('refs/heads/old', false, '2026-01-01T00:00:00.000Z'),
      branch('refs/heads/new', false, '2026-03-01T00:00:00.000Z'),
      branch('refs/heads/mid', false, '2026-02-01T00:00:00.000Z'),
    ]);
    expect(sorted.map((b) => b.canonicalRef)).toEqual([
      'refs/heads/new',
      'refs/heads/mid',
      'refs/heads/old',
    ]);
  });

  it('tie-breaks equal committerDate by canonicalRef ascending', () => {
    const sorted = sortBranches([
      branch('refs/heads/zeta', false, '2026-01-01T00:00:00.000Z'),
      branch('refs/heads/alpha', false, '2026-01-01T00:00:00.000Z'),
    ]);
    expect(sorted.map((b) => b.canonicalRef)).toEqual(['refs/heads/alpha', 'refs/heads/zeta']);
  });

  it('sorts branches without a committerDate last within their group', () => {
    const sorted = sortBranches([
      branch('refs/heads/undated', false),
      branch('refs/heads/dated-old', false, '2020-01-01T00:00:00.000Z'),
      branch('refs/heads/dated-new', false, '2026-01-01T00:00:00.000Z'),
    ]);
    expect(sorted.map((b) => b.canonicalRef)).toEqual([
      'refs/heads/dated-new',
      'refs/heads/dated-old',
      'refs/heads/undated',
    ]);
  });

  it('sorts undated branches among themselves by canonicalRef ascending', () => {
    const sorted = sortBranches([
      branch('refs/heads/zeta', false),
      branch('refs/heads/alpha', false),
    ]);
    expect(sorted.map((b) => b.canonicalRef)).toEqual(['refs/heads/alpha', 'refs/heads/zeta']);
  });

  it('applies group order before recency: an old local branch precedes a new remote one', () => {
    const sorted = sortBranches([
      branch('refs/remotes/origin/main', true, '2026-06-01T00:00:00.000Z'),
      branch('refs/heads/legacy', false, '2020-01-01T00:00:00.000Z'),
    ]);
    expect(sorted.map((b) => b.canonicalRef)).toEqual([
      'refs/heads/legacy',
      'refs/remotes/origin/main',
    ]);
  });

  it('does not mutate the input array', () => {
    const input = [
      branch('refs/heads/b', false, '2026-01-01T00:00:00.000Z'),
      branch('refs/heads/a', false, '2026-02-01T00:00:00.000Z'),
    ];
    const copy = [...input];
    sortBranches(input);
    expect(input).toEqual(copy);
  });
});

describe('compareBranches', () => {
  it('is a strict weak ordering usable by Array.sort', () => {
    const items = [
      branch('refs/heads/undated', false),
      branch('refs/heads/a', false, '2026-02-01T00:00:00.000Z'),
      branch('refs/remotes/origin/x', true, '2026-03-01T00:00:00.000Z'),
      branch('refs/heads/b', false, '2026-02-01T00:00:00.000Z'),
      branch('refs/remotes/origin/a', true),
    ];
    const sorted = [...items].sort(compareBranches);
    expect(sorted.map((b) => b.canonicalRef)).toEqual([
      'refs/heads/a',
      'refs/heads/b',
      'refs/heads/undated',
      'refs/remotes/origin/x',
      'refs/remotes/origin/a',
    ]);
  });
});
