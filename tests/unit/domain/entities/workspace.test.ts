import { describe, expect, it } from 'vitest';

import { Workspace } from '../../../../src/lib/server/domain/entities/workspace';
import { RepositoryPath } from '../../../../src/lib/server/domain/value-objects/repository-path';
import { WorkspaceId } from '../../../../src/lib/server/domain/value-objects/workspace-id';

describe('Workspace', () => {
  const id = WorkspaceId.generate();
  const path = new RepositoryPath('/home/user/repo');
  const displayName = 'My Repo';
  const createdAt = new Date('2026-01-15T10:00:00Z');
  const lastOpenedAt = new Date('2026-01-15T10:00:00Z');

  it('creates a workspace with all required fields', () => {
    const ws = new Workspace({
      id,
      displayName,
      repositoryPath: path,
      createdAt,
      lastOpenedAt,
    });

    expect(ws.id).toBe(id);
    expect(ws.displayName).toBe(displayName);
    expect(ws.repositoryPath).toBe(path);
    expect(ws.createdAt).toEqual(createdAt);
    expect(ws.lastOpenedAt).toEqual(lastOpenedAt);
  });

  it('trims displayName whitespace', () => {
    const ws = new Workspace({
      id,
      displayName: '  My Repo  ',
      repositoryPath: path,
      createdAt,
      lastOpenedAt,
    });
    expect(ws.displayName).toBe('My Repo');
  });

  it('throws when displayName is empty', () => {
    expect(
      () =>
        new Workspace({
          id,
          displayName: '',
          repositoryPath: path,
          createdAt,
          lastOpenedAt,
        }),
    ).toThrow('displayName');
  });

  it('throws when displayName is whitespace only', () => {
    expect(
      () =>
        new Workspace({
          id,
          displayName: '   ',
          repositoryPath: path,
          createdAt,
          lastOpenedAt,
        }),
    ).toThrow('displayName');
  });

  it('throws when displayName exceeds 200 characters', () => {
    const longName = 'a'.repeat(201);
    expect(
      () =>
        new Workspace({
          id,
          displayName: longName,
          repositoryPath: path,
          createdAt,
          lastOpenedAt,
        }),
    ).toThrow('displayName');
  });

  it('accepts displayName of exactly 200 characters', () => {
    const name = 'a'.repeat(200);
    const ws = new Workspace({
      id,
      displayName: name,
      repositoryPath: path,
      createdAt,
      lastOpenedAt,
    });
    expect(ws.displayName).toBe(name);
  });

  describe('rename', () => {
    it('changes the displayName with a valid name', () => {
      const ws = new Workspace({
        id,
        displayName: 'Old Name',
        repositoryPath: path,
        createdAt,
        lastOpenedAt,
      });
      ws.rename('New Name');
      expect(ws.displayName).toBe('New Name');
    });

    it('preserves the workspace id after rename', () => {
      const ws = new Workspace({
        id,
        displayName: 'Old Name',
        repositoryPath: path,
        createdAt,
        lastOpenedAt,
      });
      ws.rename('New Name');
      expect(ws.id).toBe(id);
    });

    it('preserves the repositoryPath after rename', () => {
      const ws = new Workspace({
        id,
        displayName: 'Old Name',
        repositoryPath: path,
        createdAt,
        lastOpenedAt,
      });
      ws.rename('New Name');
      expect(ws.repositoryPath).toBe(path);
    });

    it('preserves the createdAt after rename', () => {
      const ws = new Workspace({
        id,
        displayName: 'Old Name',
        repositoryPath: path,
        createdAt,
        lastOpenedAt,
      });
      ws.rename('New Name');
      expect(ws.createdAt).toEqual(createdAt);
    });

    it('throws when new displayName is empty', () => {
      const ws = new Workspace({
        id,
        displayName: 'Old Name',
        repositoryPath: path,
        createdAt,
        lastOpenedAt,
      });
      expect(() => ws.rename('')).toThrow('displayName');
      expect(ws.displayName).toBe('Old Name');
    });

    it('throws when new displayName is only whitespace', () => {
      const ws = new Workspace({
        id,
        displayName: 'Old Name',
        repositoryPath: path,
        createdAt,
        lastOpenedAt,
      });
      expect(() => ws.rename('   ')).toThrow('displayName');
      expect(ws.displayName).toBe('Old Name');
    });

    it('throws when new displayName exceeds 200 characters', () => {
      const ws = new Workspace({
        id,
        displayName: 'Old Name',
        repositoryPath: path,
        createdAt,
        lastOpenedAt,
      });
      const longName = 'a'.repeat(201);
      expect(() => ws.rename(longName)).toThrow('displayName');
      expect(ws.displayName).toBe('Old Name');
    });

    it('renames to a 200 character name correctly', () => {
      const ws = new Workspace({
        id,
        displayName: 'Old Name',
        repositoryPath: path,
        createdAt,
        lastOpenedAt,
      });
      const name = 'a'.repeat(200);
      ws.rename(name);
      expect(ws.displayName).toBe(name);
    });

    it('trims whitespace from new displayName', () => {
      const ws = new Workspace({
        id,
        displayName: 'Old Name',
        repositoryPath: path,
        createdAt,
        lastOpenedAt,
      });
      ws.rename('  Trimmed Name  ');
      expect(ws.displayName).toBe('Trimmed Name');
    });
  });
});
