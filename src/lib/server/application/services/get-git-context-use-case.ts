import type { GitContextResult } from '$lib/server/application/dto/results/git-context-results';
import type { GitContextReader } from '$lib/server/application/git-context-reader';
import type { ComparisonSerialized } from '$lib/server/domain/value-objects/comparison';
import { Comparison, ComparisonType } from '$lib/server/domain/value-objects/comparison';
import { GitRef } from '$lib/server/domain/value-objects/git-ref';

import type { BranchDto, CommitDto, StatusDto } from '../dto/results/git-context-results';

export interface GitContextAggregate {
  status: StatusDto | null;
  branches: BranchDto[];
  commits: CommitDto[];
  error: { message: string; errorCode: string } | null;
  readAt: string | null;
  defaultComparison: ComparisonSerialized | null;
}

export class GetGitContextUseCase {
  constructor(private readonly gitContextReader: GitContextReader) {}

  async execute(repositoryPath: string): Promise<GitContextAggregate> {
    const result: GitContextResult = await this.gitContextReader.read(repositoryPath);

    const defaultComparison = result.error
      ? null
      : new Comparison({
          base: new GitRef('head', 'HEAD'),
          target: new GitRef('working-tree', 'working-tree'),
          comparisonType: ComparisonType.WORKING_TREE_VS_HEAD,
        }).toJSON();

    return {
      status: result.status,
      branches: result.branches,
      commits: result.commits,
      error: result.error
        ? { message: result.error.message, errorCode: result.error.errorCode }
        : null,
      readAt: result.readAt,
      defaultComparison,
    };
  }
}
