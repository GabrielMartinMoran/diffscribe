import { describe, expect, it } from 'vitest';

// RED: The DTO types don't exist yet
import type {
  FileListEntry,
  FileListError,
  FileListResult,
} from '../../../../src/lib/server/application/dto/results/file-list-results';
import { FileChangeStatus } from '../../../../src/lib/server/domain/value-objects/file-change-status';

describe('FileListEntry DTO', () => {
  it('has path, status, binary, additions, deletions fields', () => {
    const entry: FileListEntry = {
      path: 'src/main.ts',
      status: FileChangeStatus.MODIFIED,
      binary: false,
      additions: 5,
      deletions: 2,
    };
    expect(entry.path).toBe('src/main.ts');
    expect(entry.status).toBe(FileChangeStatus.MODIFIED);
    expect(entry.binary).toBe(false);
    expect(entry.additions).toBe(5);
    expect(entry.deletions).toBe(2);
  });

  it('oldPath is optional and undefined by default', () => {
    const entry: FileListEntry = {
      path: 'src/main.ts',
      status: FileChangeStatus.MODIFIED,
      binary: false,
    };
    expect(entry.oldPath).toBeUndefined();
  });

  it('oldPath is present for renamed files', () => {
    const entry: FileListEntry = {
      path: 'new.ts',
      status: FileChangeStatus.RENAMED,
      binary: false,
      oldPath: 'old.ts',
    };
    expect(entry.oldPath).toBe('old.ts');
  });

  it('additions and deletions are optional (undefined when not available)', () => {
    const entry: FileListEntry = {
      path: 'src/untracked.ts',
      status: FileChangeStatus.UNTRACKED,
      binary: false,
    };
    expect(entry.additions).toBeUndefined();
    expect(entry.deletions).toBeUndefined();
  });

  it('error is optional on a FileListEntry for unreadable files', () => {
    const entry: FileListEntry = {
      path: 'restricted/secrets.env',
      status: FileChangeStatus.UNTRACKED,
      binary: false,
      error: 'Cannot read file for binary detection',
    };
    expect(entry.error).toBe('Cannot read file for binary detection');
  });
});

describe('FileListResult DTO', () => {
  it('is a successful result with entries and readAt', () => {
    const result: FileListResult = {
      entries: [],
      readAt: new Date().toISOString(),
    };
    expect(result.entries).toEqual([]);
    expect(result.readAt).toBeDefined();
  });

  it('is an error result with error and readAt', () => {
    const errorResult: FileListResult = {
      entries: [],
      readAt: new Date().toISOString(),
      error: {
        message: 'Git command failed',
        errorCode: 'GIT_ERROR',
      },
    };
    expect(errorResult.error).toBeDefined();
    expect(errorResult.error!.message).toBe('Git command failed');
    expect(errorResult.error!.errorCode).toBe('GIT_ERROR');
  });
});

describe('FileListError DTO', () => {
  it('has message and errorCode fields', () => {
    const err: FileListError = {
      message: 'Something went wrong',
      errorCode: 'ERROR_CODE',
    };
    expect(err.message).toBe('Something went wrong');
    expect(err.errorCode).toBe('ERROR_CODE');
  });
});
