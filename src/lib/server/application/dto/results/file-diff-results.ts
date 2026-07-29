export type DiffChangeType = 'context' | 'added' | 'deleted';

export interface DiffLine {
  changeType: DiffChangeType;
  content: string;
  oldLineNumber: number;
  newLineNumber: number;
  noNewlineAtEnd?: boolean;
  html?: string;
  text?: string;
}

export interface DiffHunk {
  header: string;
  lines: DiffLine[];
  noNewlineAtEnd?: boolean;
}

export interface FileDiffResult {
  path: string;
  oldPath?: string;
  hunks: DiffHunk[];
  isBinary: boolean;
  isTruncated: boolean;
  truncationReason?: string;
  readAt: string;
  error?: FileDiffError;
}

export interface FileDiffError {
  message: string;
  errorCode: string;
}
