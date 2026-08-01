/**
 * Client-side ComparisonType inference for the ephemeral comparison draft.
 *
 * The Git context panel keeps the draft in client memory; the inferred type
 * string is validated server-side against the domain ComparisonType enum.
 * The literal list must stay in parity with that enum — enforced by
 * `tests/unit/web/comparison-inference.test.ts`.
 */

export const COMPARISON_TYPE_VALUES = [
  'working-tree-vs-head',
  'staged-vs-head',
  'unstaged',
  'branch-vs-branch',
  'commit-vs-commit',
  'commit-vs-working-tree',
  'branch-vs-working-tree',
  'commit-range',
] as const;

export type ComparisonTypeLiteral = (typeof COMPARISON_TYPE_VALUES)[number];

export type GitRefLike = {
  type: 'branch' | 'commit' | 'head' | 'working-tree' | 'index';
  value: string;
};

/**
 * Infers the comparison type from the real base/target pair instead of
 * hardcoding branch-vs-branch or commit-vs-commit. A branch is a commit
 * pointer, so mixed branch/commit pairs resolve to commit-vs-commit; HEAD
 * behaves as a branch when paired with a branch and as a commit otherwise.
 */
export function inferComparisonType(base: GitRefLike, target: GitRefLike): ComparisonTypeLiteral {
  const baseType = base.type;
  const targetType = target.type;

  if (baseType === 'index') {
    if (targetType === 'head') return 'staged-vs-head';
    if (targetType === 'working-tree') return 'unstaged';
  }

  if (targetType === 'working-tree') {
    if (baseType === 'head' || baseType === 'working-tree') {
      return 'working-tree-vs-head';
    }
    if (baseType === 'branch') {
      return 'branch-vs-working-tree';
    }
    if (baseType === 'commit') {
      return 'commit-vs-working-tree';
    }
  }

  // Symmetric case: working tree as base vs HEAD as target.
  if (baseType === 'working-tree' && targetType === 'head') {
    return 'working-tree-vs-head';
  }

  // HEAD behaves as a branch when paired with a branch.
  const isBranchLike = (t: GitRefLike['type']): boolean => t === 'branch' || t === 'head';
  if (isBranchLike(baseType) && isBranchLike(targetType)) {
    return 'branch-vs-branch';
  }

  // A branch is a commit pointer: any commit in the pair wins.
  if (baseType === 'commit' || targetType === 'commit') {
    return 'commit-vs-commit';
  }

  return 'branch-vs-branch';
}
