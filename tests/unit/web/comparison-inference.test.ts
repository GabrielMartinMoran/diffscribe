import { describe, expect, it } from 'vitest';

import { ComparisonType } from '$lib/server/domain/value-objects/comparison';
import {
  COMPARISON_TYPE_VALUES,
  type GitRefLike,
  inferComparisonType,
} from '$lib/web/types/comparison-inference';

const head: GitRefLike = { type: 'head', value: 'HEAD' };
const workingTree: GitRefLike = { type: 'working-tree', value: 'working-tree' };
const index: GitRefLike = { type: 'index', value: 'index' };
const branch = (name: string): GitRefLike => ({ type: 'branch', value: name });
const commit = (hash: string): GitRefLike => ({ type: 'commit', value: hash });

describe('comparison inference parity', () => {
  it('client literals stay in parity with the domain ComparisonType enum', () => {
    const serverValues = Object.values(ComparisonType).sort();
    const clientValues = [...COMPARISON_TYPE_VALUES].sort();
    expect(clientValues).toEqual(serverValues);
  });
});

describe('inferComparisonType', () => {
  it('infers working-tree-vs-head for HEAD vs working tree', () => {
    expect(inferComparisonType(head, workingTree)).toBe('working-tree-vs-head');
    expect(inferComparisonType(workingTree, head)).toBe('working-tree-vs-head');
  });

  it('infers branch-vs-branch for two branches', () => {
    expect(inferComparisonType(branch('main'), branch('feature'))).toBe('branch-vs-branch');
  });

  it('infers commit-vs-commit for two commits', () => {
    expect(inferComparisonType(commit('abc1234'), commit('def5678'))).toBe('commit-vs-commit');
  });

  it('infers commit-vs-working-tree', () => {
    expect(inferComparisonType(commit('abc1234'), workingTree)).toBe('commit-vs-working-tree');
  });

  it('infers branch-vs-working-tree', () => {
    expect(inferComparisonType(branch('main'), workingTree)).toBe('branch-vs-working-tree');
  });

  it('treats HEAD as a branch when paired with a branch', () => {
    expect(inferComparisonType(head, branch('feature'))).toBe('branch-vs-branch');
  });

  it('treats HEAD as a commit when paired with a commit', () => {
    expect(inferComparisonType(head, commit('abc1234'))).toBe('commit-vs-commit');
  });

  it('treats a branch as a commit when paired with a commit', () => {
    expect(inferComparisonType(branch('main'), commit('abc1234'))).toBe('commit-vs-commit');
  });

  it('infers staged-vs-head for index vs HEAD', () => {
    expect(inferComparisonType(index, head)).toBe('staged-vs-head');
  });

  it('infers unstaged for index vs working tree', () => {
    expect(inferComparisonType(index, workingTree)).toBe('unstaged');
  });

  it('falls back to branch-vs-branch for unknown pairs', () => {
    expect(inferComparisonType(workingTree, branch('main'))).toBe('branch-vs-branch');
  });
});
