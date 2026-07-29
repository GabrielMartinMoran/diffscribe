import type { FileListResult } from '$lib/server/application/dto/results/file-list-results';
import type { GitFileListReader } from '$lib/server/application/git-file-list-reader';
import type { Comparison, ComparisonType } from '$lib/server/domain/value-objects/comparison';

export class GetFileListUseCase {
  constructor(private readonly fileListReader: GitFileListReader) {}

  async execute(repositoryPath: string, comparison: Comparison): Promise<FileListResult> {
    const refs = this.resolveRefs(
      comparison.comparisonType,
      comparison.base.value,
      comparison.target.value,
    );

    return this.fileListReader.read({
      repositoryPath,
      comparisonType: comparison.comparisonType,
      baseRef: refs.baseRef,
      targetRef: refs.targetRef,
    });
  }

  private resolveRefs(
    comparisonType: ComparisonType,
    baseValue: string,
    targetValue: string,
  ): { baseRef: string; targetRef: string } {
    return { baseRef: baseValue, targetRef: targetValue };
  }
}
