import { describe, expect, it } from 'vitest';

import { DuplicateWorkspaceError } from '../../../../src/lib/server/domain/errors/duplicate-workspace-error';
import { InvalidWorkspacePathError } from '../../../../src/lib/server/domain/errors/invalid-workspace-path-error';
import { WorkspaceNotFoundError } from '../../../../src/lib/server/domain/errors/workspace-not-found-error';

describe('Domain errors', () => {
  it('DuplicateWorkspaceError contains the path', () => {
    const err = new DuplicateWorkspaceError('/tmp/repo-a');
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toContain('/tmp/repo-a');
    expect(err.path).toBe('/tmp/repo-a');
  });

  it('InvalidWorkspacePathError contains the path and reason', () => {
    const err = new InvalidWorkspacePathError('/tmp/nogit', 'No es un repositorio Git');
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toContain('/tmp/nogit');
    expect(err.message).toContain('No es un repositorio Git');
    expect(err.path).toBe('/tmp/nogit');
  });

  it('WorkspaceNotFoundError contains the id', () => {
    const err = new WorkspaceNotFoundError('abc-123');
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toContain('abc-123');
    expect(err.id).toBe('abc-123');
  });
});
