import type { FileDiffResult } from '$lib/server/application/dto/results/file-diff-results';
import type { ComparisonType } from '$lib/server/domain/value-objects/comparison';

export interface GitFileDiffReaderReadParams {
  repositoryPath: string;
  comparisonType: ComparisonType;
  baseRef: string;
  targetRef: string;
  relativePath: string;
}

export interface GitFileDiffReader {
  read(params: GitFileDiffReaderReadParams): Promise<FileDiffResult>;
}
