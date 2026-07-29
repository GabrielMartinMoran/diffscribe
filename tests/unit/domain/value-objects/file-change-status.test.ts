import { describe, expect, it } from 'vitest';

// RED: The enum module doesn't exist yet — this import will fail
import { FileChangeStatus } from '../../../../src/lib/server/domain/value-objects/file-change-status';

describe('FileChangeStatus (domain enum)', () => {
  const allStatuses: FileChangeStatus[] = [
    FileChangeStatus.ADDED,
    FileChangeStatus.MODIFIED,
    FileChangeStatus.DELETED,
    FileChangeStatus.RENAMED,
    FileChangeStatus.COPIED,
    FileChangeStatus.TYPE_CHANGED,
    FileChangeStatus.UNMERGED,
    FileChangeStatus.UNTRACKED,
    FileChangeStatus.UNKNOWN,
  ];

  it('defines exactly 9 status values (binary is a separate boolean, never a status)', () => {
    expect(allStatuses).toHaveLength(9);
  });

  it('each status has a distinct string value', () => {
    const values = allStatuses.map((s) => s as string);
    const unique = new Set(values);
    expect(unique.size).toBe(9);
  });

  it('has the correct string values', () => {
    expect(FileChangeStatus.ADDED).toBe('added');
    expect(FileChangeStatus.MODIFIED).toBe('modified');
    expect(FileChangeStatus.DELETED).toBe('deleted');
    expect(FileChangeStatus.RENAMED).toBe('renamed');
    expect(FileChangeStatus.COPIED).toBe('copied');
    expect(FileChangeStatus.TYPE_CHANGED).toBe('type-changed');
    expect(FileChangeStatus.UNMERGED).toBe('unmerged');
    expect(FileChangeStatus.UNTRACKED).toBe('untracked');
    expect(FileChangeStatus.UNKNOWN).toBe('unknown');
  });

  it('does not include a "binary" status value', () => {
    const values = allStatuses.map((s) => s as string);
    expect(values).not.toContain('binary');
  });
});
