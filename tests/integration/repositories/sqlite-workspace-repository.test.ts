import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { Workspace } from '../../../src/lib/server/domain/entities/workspace';
import { RepositoryPath } from '../../../src/lib/server/domain/value-objects/repository-path';
import { WorkspaceId } from '../../../src/lib/server/domain/value-objects/workspace-id';
import { SqliteWorkspaceRepository } from '../../../src/lib/server/infrastructure/repositories/sqlite-workspace-repository';

function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      repository_path TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      last_opened_at TEXT NOT NULL
    )
  `);
  return db;
}

function makeWorkspace(overrides?: { path?: string; name?: string }): Workspace {
  return new Workspace({
    id: WorkspaceId.generate(),
    displayName: overrides?.name ?? 'Test Workspace',
    repositoryPath: new RepositoryPath(overrides?.path ?? '/tmp/test-repo'),
    createdAt: new Date('2026-01-15T10:00:00Z'),
    lastOpenedAt: new Date('2026-01-15T10:00:00Z'),
  });
}

describe('SqliteWorkspaceRepository (integration)', () => {
  let db: Database.Database;
  let repo: SqliteWorkspaceRepository;

  beforeEach(() => {
    db = createTestDb();
    repo = new SqliteWorkspaceRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  it('saves and retrieves a workspace by id', () => {
    const ws = makeWorkspace();
    repo.save(ws);

    const found = repo.findById(ws.id);
    expect(found).not.toBeNull();
    expect(found!.id.value).toBe(ws.id.value);
    expect(found!.displayName).toBe(ws.displayName);
    expect(found!.repositoryPath.value).toBe(ws.repositoryPath.value);
  });

  it('returns null for unknown id', () => {
    const id = WorkspaceId.generate();
    const found = repo.findById(id);
    expect(found).toBeNull();
  });

  it('finds a workspace by path', () => {
    const ws = makeWorkspace({ path: '/tmp/specific-repo' });
    repo.save(ws);

    const found = repo.findByPath('/tmp/specific-repo');
    expect(found).not.toBeNull();
    expect(found!.displayName).toBe('Test Workspace');
  });

  it('returns null for unknown path', () => {
    const found = repo.findByPath('/tmp/nonexistent');
    expect(found).toBeNull();
  });

  it('lists all workspaces', () => {
    repo.save(makeWorkspace({ path: '/tmp/a', name: 'A' }));
    repo.save(makeWorkspace({ path: '/tmp/b', name: 'B' }));

    const all = repo.findAll();
    expect(all).toHaveLength(2);
  });

  it('returns empty list when no workspaces are saved', () => {
    const all = repo.findAll();
    expect(all).toHaveLength(0);
  });

  it('updates an existing workspace on save (same id)', () => {
    const ws = makeWorkspace({ path: '/tmp/update-me', name: 'Before' });
    repo.save(ws);

    const updated = new Workspace({
      id: ws.id,
      displayName: 'After',
      repositoryPath: new RepositoryPath('/tmp/update-me'),
      createdAt: ws.createdAt,
      lastOpenedAt: new Date('2026-06-01T12:00:00Z'),
    });
    repo.save(updated);

    const found = repo.findById(ws.id);
    expect(found!.displayName).toBe('After');
    expect(found!.lastOpenedAt).toEqual(new Date('2026-06-01T12:00:00Z'));
  });

  it('enforces unique repository path', () => {
    repo.save(makeWorkspace({ path: '/tmp/unique', name: 'First' }));

    expect(() => {
      repo.save(makeWorkspace({ path: '/tmp/unique', name: 'Second' }));
    }).toThrow();
  });
});
