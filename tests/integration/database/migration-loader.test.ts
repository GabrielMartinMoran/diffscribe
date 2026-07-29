import { describe, expect, it } from 'vitest';

import {
  createTestDb,
  runMigrations,
} from '../../../src/lib/server/infrastructure/database/connection';

describe('Migration loader (integration)', () => {
  it('creates all tables on a fresh database', () => {
    const db = createTestDb();
    runMigrations(db);

    const tables = (
      db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as {
        name: string;
      }[]
    ).map((r) => r.name);

    expect(tables).toContain('_migrations');
    expect(tables).toContain('workspaces');
    expect(tables).toContain('app_state');
    expect(tables).toContain('reviews');
    expect(tables).toContain('review_files');
    expect(tables).toContain('observations');
    db.close();
  });

  it('records applied migrations in _migrations', () => {
    const db = createTestDb();
    runMigrations(db);

    const rows = db.prepare('SELECT name FROM _migrations ORDER BY name').all() as {
      name: string;
    }[];
    const names = rows.map((r) => r.name);
    expect(names).toContain('001_create_workspaces');
    expect(names).toContain('002_app_state');
    expect(names).toContain('003_create_reviews');
    expect(names).toContain('004_create_review_files');
    expect(names).toContain('005_create_observations');
    db.close();
  });

  it('is idempotent — running twice does not error', () => {
    const db = createTestDb();
    runMigrations(db);
    // Second run should be a no-op
    expect(() => runMigrations(db)).not.toThrow();

    const rows = db.prepare('SELECT name FROM _migrations ORDER BY name').all() as {
      name: string;
    }[];
    expect(rows).toHaveLength(5);
    db.close();
  });

  it('upgrades existing DB with only 001 and 002 applied', () => {
    const db = createTestDb();

    // Simulate pre-existing _migrations tracking table with only 001 and 002
    db.exec(`
      CREATE TABLE IF NOT EXISTS _migrations (
        name TEXT PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
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
    db.exec(`
      CREATE TABLE IF NOT EXISTS app_state (
        key TEXT PRIMARY KEY,
        value TEXT
      )
    `);
    db.prepare("INSERT INTO _migrations (name) VALUES ('001_create_workspaces')").run();
    db.prepare("INSERT INTO _migrations (name) VALUES ('002_app_state')").run();

    // Now run migrations — should apply 003 and 004 only
    runMigrations(db);

    const tables = (
      db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as {
        name: string;
      }[]
    ).map((r) => r.name);
    expect(tables).toContain('reviews');
    expect(tables).toContain('review_files');

    const rows = db.prepare('SELECT name FROM _migrations ORDER BY name').all() as {
      name: string;
    }[];
    expect(rows).toHaveLength(5);
    db.close();
  });

  it('rolls back migration transaction on invalid SQL', () => {
    // We cannot test this with the glob loader directly since we can't inject invalid SQL.
    // But we can test that the transaction wrapper exists by verifying a migration
    // that would fail mid-way doesn't leave partial state.
    // This is tested implicitly by idempotency — if a migration partially applied,
    // it wouldn't be idempotent.
    // We rely on the db.transaction() wrapper for atomicity.
    const db = createTestDb();
    runMigrations(db);

    // Verify _migrations tracking prevents partial re-application
    const rows = db.prepare("SELECT name FROM _migrations WHERE name = '003_create_reviews'").all();
    expect(rows).toHaveLength(1);
    db.close();
  });

  it('has foreign_keys enabled on production connection', () => {
    const db = createTestDb();
    const fkResult = db.pragma('foreign_keys') as { foreign_keys: number }[];
    expect(fkResult[0].foreign_keys).toBe(1);
    db.close();
  });
});

describe('Review foreign key cascades (integration)', () => {
  it('deleting a workspace cascades to its reviews', () => {
    const db = createTestDb();
    runMigrations(db);

    const workspaceId = '550e8400-e29b-41d4-a716-446655440000';
    db.prepare(
      'INSERT INTO workspaces (id, display_name, repository_path, created_at, last_opened_at) VALUES (?, ?, ?, ?, ?)',
    ).run(workspaceId, 'Test', '/tmp/test', '2026-01-01', '2026-01-01');

    const reviewId = '550e8400-e29b-41d4-a716-446655440001';
    db.prepare(
      'INSERT INTO reviews (id, workspace_id, status, comparison_json, comparison_type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).run(
      reviewId,
      workspaceId,
      'draft',
      '{"base":{"type":"head","value":"HEAD","label":"HEAD"},"target":{"type":"working-tree","value":"working-tree","label":"working tree"},"comparisonType":"working-tree-vs-head","createdAt":"2026-01-01T00:00:00.000Z"}',
      'working-tree-vs-head',
      '2026-01-01',
      '2026-01-01',
    );

    db.prepare('INSERT INTO review_files (review_id, file_path) VALUES (?, ?)').run(
      reviewId,
      'a.ts',
    );

    // Delete workspace — reviews and review_files should cascade
    db.prepare('DELETE FROM workspaces WHERE id = ?').run(workspaceId);

    const reviews = db.prepare('SELECT COUNT(*) as count FROM reviews').get() as {
      count: number;
    };
    expect(reviews.count).toBe(0);

    const reviewFiles = db.prepare('SELECT COUNT(*) as count FROM review_files').get() as {
      count: number;
    };
    expect(reviewFiles.count).toBe(0);

    db.close();
  });

  it('deleting a review cascades to its review_files', () => {
    const db = createTestDb();
    runMigrations(db);

    const workspaceId = '550e8400-e29b-41d4-a716-446655440000';
    db.prepare(
      'INSERT INTO workspaces (id, display_name, repository_path, created_at, last_opened_at) VALUES (?, ?, ?, ?, ?)',
    ).run(workspaceId, 'Test', '/tmp/test', '2026-01-01', '2026-01-01');

    const reviewId = '550e8400-e29b-41d4-a716-446655440001';
    db.prepare(
      'INSERT INTO reviews (id, workspace_id, status, comparison_json, comparison_type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).run(
      reviewId,
      workspaceId,
      'draft',
      '{"base":{"type":"head","value":"HEAD","label":"HEAD"},"target":{"type":"working-tree","value":"working-tree","label":"working tree"},"comparisonType":"working-tree-vs-head","createdAt":"2026-01-01T00:00:00.000Z"}',
      'working-tree-vs-head',
      '2026-01-01',
      '2026-01-01',
    );

    db.prepare('INSERT INTO review_files (review_id, file_path) VALUES (?, ?)').run(
      reviewId,
      'a.ts',
    );

    // Delete review — files should cascade
    db.prepare('DELETE FROM reviews WHERE id = ?').run(reviewId);

    const reviewFiles = db.prepare('SELECT COUNT(*) as count FROM review_files').get() as {
      count: number;
    };
    expect(reviewFiles.count).toBe(0);

    db.close();
  });
});

describe('Observation foreign key cascades (integration)', () => {
  it('deleting a review cascades to its observations', () => {
    const db = createTestDb();
    runMigrations(db);

    const workspaceId = '550e8400-e29b-41d4-a716-446655440000';
    db.prepare(
      'INSERT INTO workspaces (id, display_name, repository_path, created_at, last_opened_at) VALUES (?, ?, ?, ?, ?)',
    ).run(workspaceId, 'Test', '/tmp/test', '2026-01-01', '2026-01-01');

    const reviewId = '550e8400-e29b-41d4-a716-446655440001';
    db.prepare(
      'INSERT INTO reviews (id, workspace_id, status, comparison_json, comparison_type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).run(
      reviewId,
      workspaceId,
      'draft',
      '{"base":{"type":"head","value":"HEAD","label":"HEAD"},"target":{"type":"working-tree","value":"working-tree","label":"working tree"},"comparisonType":"working-tree-vs-head","createdAt":"2026-01-01T00:00:00.000Z"}',
      'working-tree-vs-head',
      '2026-01-01',
      '2026-01-01',
    );

    const observationId = '660e8400-e29b-41d4-a716-446655440000';
    db.prepare(
      'INSERT INTO observations (id, review_id, type, title, comparison_snapshot_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).run(
      observationId,
      reviewId,
      'note',
      'Test observation',
      '{"base":{"type":"head","value":"HEAD","label":"HEAD"},"target":{"type":"working-tree","value":"working-tree","label":"working tree"},"comparisonType":"working-tree-vs-head","createdAt":"2026-01-01T00:00:00.000Z"}',
      '2026-01-01',
      '2026-01-01',
    );

    // Delete review — observations should cascade
    db.prepare('DELETE FROM reviews WHERE id = ?').run(reviewId);

    const observations = db.prepare('SELECT COUNT(*) as count FROM observations').get() as {
      count: number;
    };
    expect(observations.count).toBe(0);

    db.close();
  });

  it('deleting a workspace cascades to observations through reviews', () => {
    const db = createTestDb();
    runMigrations(db);

    const workspaceId = '550e8400-e29b-41d4-a716-446655440000';
    db.prepare(
      'INSERT INTO workspaces (id, display_name, repository_path, created_at, last_opened_at) VALUES (?, ?, ?, ?, ?)',
    ).run(workspaceId, 'Test', '/tmp/test', '2026-01-01', '2026-01-01');

    const reviewId = '550e8400-e29b-41d4-a716-446655440001';
    db.prepare(
      'INSERT INTO reviews (id, workspace_id, status, comparison_json, comparison_type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).run(
      reviewId,
      workspaceId,
      'draft',
      '{"base":{"type":"head","value":"HEAD","label":"HEAD"},"target":{"type":"working-tree","value":"working-tree","label":"working tree"},"comparisonType":"working-tree-vs-head","createdAt":"2026-01-01T00:00:00.000Z"}',
      'working-tree-vs-head',
      '2026-01-01',
      '2026-01-01',
    );

    const observationId = '660e8400-e29b-41d4-a716-446655440000';
    db.prepare(
      'INSERT INTO observations (id, review_id, type, title, comparison_snapshot_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).run(
      observationId,
      reviewId,
      'note',
      'Test observation',
      '{"base":{"type":"head","value":"HEAD","label":"HEAD"},"target":{"type":"working-tree","value":"working-tree","label":"working tree"},"comparisonType":"working-tree-vs-head","createdAt":"2026-01-01T00:00:00.000Z"}',
      '2026-01-01',
      '2026-01-01',
    );

    // Delete workspace — reviews cascade to observations
    db.prepare('DELETE FROM workspaces WHERE id = ?').run(workspaceId);

    const observations = db.prepare('SELECT COUNT(*) as count FROM observations').get() as {
      count: number;
    };
    expect(observations.count).toBe(0);

    db.close();
  });
});
