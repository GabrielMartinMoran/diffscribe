import Database from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';

import { Workspace } from '../../../src/lib/server/domain/entities/workspace';
import { RepositoryPath } from '../../../src/lib/server/domain/value-objects/repository-path';
import { WorkspaceId } from '../../../src/lib/server/domain/value-objects/workspace-id';
import { runMigrations } from '../../../src/lib/server/infrastructure/database/connection';
import { SqliteAppStateRepository } from '../../../src/lib/server/infrastructure/repositories/sqlite-app-state-repository';
import { SqliteWorkspaceRepository } from '../../../src/lib/server/infrastructure/repositories/sqlite-workspace-repository';

describe('SqliteAppStateRepository', () => {
  let db: Database.Database;
  let repo: SqliteAppStateRepository;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('journal_mode = WAL');
    runMigrations(db);
    repo = new SqliteAppStateRepository(db);
  });

  it('returns null when key does not exist', () => {
    expect(repo.get('nonexistent')).toBeNull();
  });

  it('sets and gets a string value', () => {
    repo.set('active_workspace_id', 'some-uuid');
    expect(repo.get('active_workspace_id')).toBe('some-uuid');
  });

  it('overwrites an existing key', () => {
    repo.set('active_workspace_id', 'uuid-1');
    repo.set('active_workspace_id', 'uuid-2');
    expect(repo.get('active_workspace_id')).toBe('uuid-2');
  });

  it('deletes a key and returns null afterwards', () => {
    repo.set('active_workspace_id', 'uuid-1');
    repo.delete('active_workspace_id');
    expect(repo.get('active_workspace_id')).toBeNull();
  });

  it('deleting a non-existent key does not throw', () => {
    expect(() => repo.delete('nonexistent')).not.toThrow();
  });

  it('sets and gets multiple keys independently', () => {
    repo.set('key-a', 'value-a');
    repo.set('key-b', 'value-b');
    expect(repo.get('key-a')).toBe('value-a');
    expect(repo.get('key-b')).toBe('value-b');
    repo.delete('key-a');
    expect(repo.get('key-a')).toBeNull();
    expect(repo.get('key-b')).toBe('value-b');
  });
});

describe('SqliteWorkspaceRepository.delete', () => {
  let db: Database.Database;
  let repo: SqliteWorkspaceRepository;

  beforeEach(() => {
    db = new Database(':memory:');
    db.pragma('journal_mode = WAL');
    runMigrations(db);
    repo = new SqliteWorkspaceRepository(db);
  });

  function createWorkspace(displayName: string, path: string): Workspace {
    const ws = new Workspace({
      id: WorkspaceId.generate(),
      displayName,
      repositoryPath: new RepositoryPath(path),
      createdAt: new Date(),
      lastOpenedAt: new Date(),
    });
    repo.save(ws);
    return ws;
  }

  it('removes a workspace so findById returns null', () => {
    const ws = createWorkspace('Repo A', '/home/user/repo-a');
    repo.delete(ws.id);
    expect(repo.findById(ws.id)).toBeNull();
  });

  it('removes workspace so findAll no longer includes it', () => {
    const ws = createWorkspace('Repo A', '/home/user/repo-a');
    repo.delete(ws.id);
    const all = repo.findAll();
    expect(all).toHaveLength(0);
  });

  it('deleting a non-existent workspace does not throw', () => {
    const fakeId = WorkspaceId.generate();
    expect(() => repo.delete(fakeId)).not.toThrow();
  });

  it('only deletes the target workspace, not others', () => {
    const ws1 = createWorkspace('Repo A', '/home/user/repo-a');
    const ws2 = createWorkspace('Repo B', '/home/user/repo-b');
    repo.delete(ws1.id);
    expect(repo.findById(ws1.id)).toBeNull();
    expect(repo.findById(ws2.id)).not.toBeNull();
    expect(repo.findAll()).toHaveLength(1);
  });

  it('delete then re-create with same id works (UPSERT)', () => {
    const ws = createWorkspace('Repo A', '/home/user/repo-a');
    repo.delete(ws.id);
    const ws2 = new Workspace({
      id: ws.id,
      displayName: 'Repo A v2',
      repositoryPath: new RepositoryPath('/home/user/repo-a-v2'),
      createdAt: new Date(),
      lastOpenedAt: new Date(),
    });
    repo.save(ws2);
    const found = repo.findById(ws.id);
    expect(found).not.toBeNull();
    expect(found!.displayName).toBe('Repo A v2');
  });
});
