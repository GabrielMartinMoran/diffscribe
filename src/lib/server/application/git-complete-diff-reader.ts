import type { CompleteDiffResult } from '$lib/server/application/dto/results/complete-diff-results';
import type { ComparisonType } from '$lib/server/domain/value-objects/comparison';

export interface GitCompleteDiffReaderReadParams {
  repositoryPath: string;
  comparisonType: ComparisonType;
  baseRef: string;
  targetRef: string;
  /** Max files to include. Default 500, hard cap 1000. */
  fileLimit?: number;
}

export interface GitCompleteDiffReader {
  read(params: GitCompleteDiffReaderReadParams): Promise<CompleteDiffResult>;
}
