import type { FileListResult } from '$lib/server/application/dto/results/file-list-results';
import type { ComparisonType } from '$lib/server/domain/value-objects/comparison';

export interface GitFileListReaderReadParams {
  repositoryPath: string;
  comparisonType: ComparisonType;
  baseRef: string;
  targetRef: string;
}

export interface GitFileListReader {
  read(params: GitFileListReaderReadParams): Promise<FileListResult>;
}
