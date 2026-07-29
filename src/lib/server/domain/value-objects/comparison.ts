import { GitRef, type GitRefSerialized } from './git-ref';

export enum ComparisonType {
  WORKING_TREE_VS_HEAD = 'working-tree-vs-head',
  STAGED_VS_HEAD = 'staged-vs-head',
  UNSTAGED = 'unstaged',
  BRANCH_VS_BRANCH = 'branch-vs-branch',
  COMMIT_VS_COMMIT = 'commit-vs-commit',
  COMMIT_VS_WORKING_TREE = 'commit-vs-working-tree',
  BRANCH_VS_WORKING_TREE = 'branch-vs-working-tree',
  COMMIT_RANGE = 'commit-range',
}

export interface ComparisonProps {
  base: GitRef;
  target: GitRef;
  comparisonType: ComparisonType;
  createdAt?: Date;
}

export type ComparisonSerialized = {
  base: GitRefSerialized;
  target: GitRefSerialized;
  comparisonType: ComparisonType;
  createdAt: string;
};

const REQUIRED_PAIRS: Partial<Record<ComparisonType, { base: string; target: string }>> = {
  [ComparisonType.WORKING_TREE_VS_HEAD]: { base: 'head', target: 'working-tree' },
};

export class Comparison {
  public readonly base: GitRef;
  public readonly target: GitRef;
  public readonly comparisonType: ComparisonType;
  public readonly createdAt: Date;

  constructor(props: ComparisonProps) {
    if (!props.base || !props.target) {
      throw new Error('Comparison requires both base and target GitRef');
    }

    const required = REQUIRED_PAIRS[props.comparisonType];
    if (required) {
      if (props.base.type !== required.base || props.target.type !== required.target) {
        throw new Error(
          `Comparison type "${props.comparisonType}" requires base="${required.base}" and target="${required.target}"`,
        );
      }
    }

    this.base = props.base;
    this.target = props.target;
    this.comparisonType = props.comparisonType;
    this.createdAt = props.createdAt ?? new Date();
  }

  equals(other: Comparison): boolean {
    return (
      this.base.equals(other.base) &&
      this.target.equals(other.target) &&
      this.comparisonType === other.comparisonType
    );
  }

  toJSON(): ComparisonSerialized {
    return {
      base: this.base.toJSON(),
      target: this.target.toJSON(),
      comparisonType: this.comparisonType,
      createdAt: this.createdAt.toISOString(),
    };
  }
}
