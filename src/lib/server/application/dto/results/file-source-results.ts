export type SourceChangeType = 'added' | 'removed' | 'modified' | 'unchanged' | null;

export interface SourceLine {
  lineNumber: number;
  content: string;
  changeType: SourceChangeType;
  html?: string;
  text?: string;
}

export interface FileSourceError {
  message: string;
  errorCode: string;
}

export interface FileSourceResult {
  path: string;
  language: string;
  lines: SourceLine[];
  isBinary: boolean;
  isTruncated: boolean;
  truncationReason?: string;
  isDeleted: boolean;
  readAt: string;
  error?: FileSourceError;
}
