import type { CompleteDiffResult } from '$lib/server/application/dto/results/complete-diff-results';
import type { GitCompleteDiffReader } from '$lib/server/application/git-complete-diff-reader';
import type { Comparison } from '$lib/server/domain/value-objects/comparison';

export class GetCompleteDiffUseCase {
  constructor(private readonly completeDiffReader: GitCompleteDiffReader) {}

  async execute(
    repositoryPath: string,
    comparison: Comparison,
    fileLimit?: number,
  ): Promise<CompleteDiffResult> {
    return this.completeDiffReader.read({
      repositoryPath,
      comparisonType: comparison.comparisonType,
      baseRef: comparison.base.value,
      targetRef: comparison.target.value,
      fileLimit,
    });
  }
}
