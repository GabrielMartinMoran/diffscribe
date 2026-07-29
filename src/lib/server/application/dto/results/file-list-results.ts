import type { FileChangeStatus } from '$lib/server/domain/value-objects/file-change-status';

export interface FileListError {
  message: string;
  errorCode: string;
}

export interface FileListEntry {
  path: string;
  status: FileChangeStatus;
  binary: boolean;
  additions?: number;
  deletions?: number;
  oldPath?: string;
  error?: string;
}

export interface FileListResult {
  entries: FileListEntry[];
  readAt: string;
  error?: FileListError;
}
