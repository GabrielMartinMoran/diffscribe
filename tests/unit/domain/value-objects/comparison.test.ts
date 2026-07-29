import { describe, expect, it } from 'vitest';

import {
  Comparison,
  ComparisonType,
} from '../../../../src/lib/server/domain/value-objects/comparison';
import { GitRef } from '../../../../src/lib/server/domain/value-objects/git-ref';

describe('Comparison (domain value object)', () => {
  const headRef = new GitRef('head', 'HEAD');
  const wtRef = new GitRef('working-tree', 'working-tree');
  const mainRef = new GitRef('branch', 'main');
  const featRef = new GitRef('branch', 'feat/a');
  const commitRef = new GitRef('commit', 'abc1234');

  it('creates a working-tree-vs-head comparison (default)', () => {
    const cmp = new Comparison({
      base: headRef,
      target: wtRef,
      comparisonType: ComparisonType.WORKING_TREE_VS_HEAD,
    });
    expect(cmp.base.equals(headRef)).toBe(true);
    expect(cmp.target.equals(wtRef)).toBe(true);
    expect(cmp.comparisonType).toBe(ComparisonType.WORKING_TREE_VS_HEAD);
  });

  it('creates a branch-vs-branch comparison', () => {
    const cmp = new Comparison({
      base: mainRef,
      target: featRef,
      comparisonType: ComparisonType.BRANCH_VS_BRANCH,
    });
    expect(cmp.base.equals(mainRef)).toBe(true);
    expect(cmp.target.equals(featRef)).toBe(true);
    expect(cmp.comparisonType).toBe(ComparisonType.BRANCH_VS_BRANCH);
  });

  it('creates a commit-vs-working-tree comparison', () => {
    const cmp = new Comparison({
      base: commitRef,
      target: wtRef,
      comparisonType: ComparisonType.COMMIT_VS_WORKING_TREE,
    });
    expect(cmp.comparisonType).toBe(ComparisonType.COMMIT_VS_WORKING_TREE);
  });

  it('equals compares by base, target, and comparisonType', () => {
    const a = new Comparison({
      base: mainRef,
      target: featRef,
      comparisonType: ComparisonType.BRANCH_VS_BRANCH,
    });
    const b = new Comparison({
      base: new GitRef('branch', 'main'),
      target: new GitRef('branch', 'feat/a'),
      comparisonType: ComparisonType.BRANCH_VS_BRANCH,
    });
    const c = new Comparison({
      base: mainRef,
      target: mainRef,
      comparisonType: ComparisonType.BRANCH_VS_BRANCH,
    });
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });

  it('provides a serializable shape with base and target as plain objects', () => {
    const cmp = new Comparison({
      base: mainRef,
      target: featRef,
      comparisonType: ComparisonType.BRANCH_VS_BRANCH,
    });
    const serialized = cmp.toJSON();
    expect(serialized.base).toEqual({ type: 'branch', value: 'main', label: 'main' });
    expect(serialized.target).toEqual({ type: 'branch', value: 'feat/a', label: 'feat/a' });
    expect(serialized.comparisonType).toBe(ComparisonType.BRANCH_VS_BRANCH);
  });

  it('defaults createdAt to the current time', () => {
    const before = Date.now();
    const cmp = new Comparison({
      base: headRef,
      target: wtRef,
      comparisonType: ComparisonType.WORKING_TREE_VS_HEAD,
    });
    const after = Date.now();
    expect(cmp.createdAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(cmp.createdAt.getTime()).toBeLessThanOrEqual(after);
  });

  it('accepts an explicit createdAt', () => {
    const date = new Date('2026-01-15T12:00:00Z');
    const cmp = new Comparison({
      base: headRef,
      target: wtRef,
      comparisonType: ComparisonType.WORKING_TREE_VS_HEAD,
      createdAt: date,
    });
    expect(cmp.createdAt).toEqual(date);
  });

  it('rejects mismatched base/target for working-tree-vs-head', () => {
    expect(
      () =>
        new Comparison({
          base: mainRef,
          target: wtRef,
          comparisonType: ComparisonType.WORKING_TREE_VS_HEAD,
        }),
    ).toThrow();
  });

  it('rejects null base reference', () => {
    expect(
      () =>
        new Comparison({
          base: null as unknown as GitRef,
          target: wtRef,
          comparisonType: ComparisonType.WORKING_TREE_VS_HEAD,
        }),
    ).toThrow();
  });

  it('rejects null target reference', () => {
    expect(
      () =>
        new Comparison({
          base: headRef,
          target: null as unknown as GitRef,
          comparisonType: ComparisonType.WORKING_TREE_VS_HEAD,
        }),
    ).toThrow();
  });
});
