import type { DiffHunk } from '$lib/server/application/dto/results/file-diff-results';
import type { ComparisonType } from '$lib/server/domain/value-objects/comparison';
import type { FileChangeStatus } from '$lib/server/domain/value-objects/file-change-status';

export interface CompleteDiffFile {
  /** New path (rename target). */
  path: string;
  /** Rename/copy source when known. */
  oldPath?: string;
  status: FileChangeStatus;
  binary: boolean;
  isTruncated: boolean;
  truncationReason?: string;
  /** Per-file failure; the file is listed with this error instead of failing the aggregate. */
  error?: { message: string; errorCode: string };
  hunks: DiffHunk[];
  readAt: string;
}

export interface CompleteDiffResult {
  comparisonType: ComparisonType;
  /** Deterministic order: ascending by path. */
  files: CompleteDiffFile[];
  /** Aggregate truncation (file limit / total budget). */
  isTruncated: boolean;
  truncationReason?: string;
  /** Per-file failures collected without failing the result. */
  partialErrors: Array<{ path: string; message: string; errorCode: string }>;
  /** Single snapshot timestamp shared by all file sections. */
  readAt: string;
  /** Fatal error (not a repo, path missing). */
  error?: { message: string; errorCode: string };
}
