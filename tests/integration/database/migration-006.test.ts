import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  createTestDb,
  runMigrations,
} from '../../../src/lib/server/infrastructure/database/connection';

const MIGRATIONS_DIR = path.resolve(
  __dirname,
  '../../../src/lib/server/infrastructure/database/migrations',
);

function readMigration(name: string): string {
  return fs.readFileSync(path.join(MIGRATIONS_DIR, `${name}.sql`), 'utf-8');
}

function applyLegacyObservationSchema(db: ReturnType<typeof createTestDb>): void {
  // Simulate a pre-006 database: create the tracking table, run 001-005 then
  // mark them as applied.
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  const names = [
    '001_create_workspaces',
    '002_app_state',
    '003_create_reviews',
    '004_create_review_files',
    '005_create_observations',
  ];
  for (const name of names) {
    db.exec(readMigration(name));
    db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(name);
  }
}

function seedLegacyWorkspace(db: ReturnType<typeof createTestDb>, id: string): void {
  db.prepare(
    'INSERT INTO workspaces (id, display_name, repository_path, created_at, last_opened_at) VALUES (?, ?, ?, ?, ?)',
  ).run(id, 'Test', `/tmp/${id}`, '2026-01-01', '2026-01-01');
}

function seedLegacyReview(db: ReturnType<typeof createTestDb>, reviewId: string): void {
  seedLegacyWorkspace(db, 'ws-1');
  db.prepare(
    'INSERT INTO reviews (id, workspace_id, status, comparison_json, comparison_type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).run(
    reviewId,
    'ws-1',
    'draft',
    '{"base":{"type":"head","value":"HEAD","label":"HEAD"},"target":{"type":"working-tree","value":"working-tree","label":"working tree"},"comparisonType":"working-tree-vs-head","createdAt":"2026-01-01T00:00:00.000Z"}',
    'working-tree-vs-head',
    '2026-01-01',
    '2026-01-01',
  );
}

function seedLegacyObservation(
  db: ReturnType<typeof createTestDb>,
  id: string,
  body: string,
  title: string,
): void {
  db.prepare(
    `INSERT INTO observations (
      id, review_id, type, severity, origin, status, title, body, agent_instruction,
      file_path, side, line_start, line_end, comparison_snapshot_json,
      diff_snapshot, content_hash, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    'review-1',
    'note',
    null,
    'human',
    'open',
    title,
    body,
    '',
    null,
    'new',
    null,
    null,
    '{"base":{"type":"head","value":"HEAD","label":"HEAD"},"target":{"type":"working-tree","value":"working-tree","label":"working tree"},"comparisonType":"working-tree-vs-head","createdAt":"2026-01-01T00:00:00.000Z"}',
    null,
    null,
    '2026-01-01T00:00:00.000Z',
    '2026-01-01T00:00:00.000Z',
  );
}

describe('Migration 006 — drop observation title, require body (integration)', () => {
  it('drops the title column and keeps the remaining columns', () => {
    const db = createTestDb();
    applyLegacyObservationSchema(db);
    seedLegacyReview(db, 'review-1');
    seedLegacyObservation(db, 'obs-1', 'A real body', 'A title');

    runMigrations(db);

    const columns = (db.prepare('PRAGMA table_info(observations)').all() as { name: string }[]).map(
      (c) => c.name,
    );
    expect(columns).not.toContain('title');
    expect(columns).toContain('body');

    const row = db.prepare('SELECT id, body FROM observations WHERE id = ?').get('obs-1') as {
      body: string;
    };
    expect(row.body).toBe('A real body');

    db.close();
  });

  it('deletes rows with empty or whitespace-only bodies before dropping the column', () => {
    const db = createTestDb();
    applyLegacyObservationSchema(db);
    seedLegacyReview(db, 'review-1');
    seedLegacyObservation(db, 'obs-empty', '', 'Empty body');
    seedLegacyObservation(db, 'obs-space', '   ', 'Whitespace body');
    seedLegacyObservation(db, 'obs-kept', 'Kept body', 'Kept title');

    runMigrations(db);

    const ids = (db.prepare('SELECT id FROM observations').all() as { id: string }[]).map(
      (r) => r.id,
    );
    expect(ids).toContain('obs-kept');
    expect(ids).not.toContain('obs-empty');
    expect(ids).not.toContain('obs-space');

    db.close();
  });

  it('enforces body NOT NULL with a non-empty trimmed CHECK', () => {
    const db = createTestDb();
    applyLegacyObservationSchema(db);
    seedLegacyReview(db, 'review-1');
    seedLegacyObservation(db, 'obs-1', 'A real body', 'A title');
    runMigrations(db);

    expect(() =>
      db
        .prepare(
          'INSERT INTO observations (id, review_id, type, body, comparison_snapshot_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        )
        .run(
          'obs-new',
          'review-1',
          'note',
          '',
          '{"base":{"type":"head","value":"HEAD","label":"HEAD"},"target":{"type":"working-tree","value":"working-tree","label":"working tree"},"comparisonType":"working-tree-vs-head","createdAt":"2026-01-01T00:00:00.000Z"}',
          '2026-01-01T00:00:00.000Z',
          '2026-01-01T00:00:00.000Z',
        ),
    ).toThrow(/CHECK/);

    db.close();
  });

  it('recreates the observations indexes', () => {
    const db = createTestDb();
    applyLegacyObservationSchema(db);
    seedLegacyReview(db, 'review-1');
    seedLegacyObservation(db, 'obs-1', 'A real body', 'A title');
    runMigrations(db);

    const indexes = (
      db.prepare("PRAGMA index_list('observations')").all() as { name: string }[]
    ).map((i) => i.name);
    expect(indexes).toContain('idx_observations_review_id');
    expect(indexes).toContain('idx_observations_type');
    expect(indexes).toContain('idx_observations_status');

    db.close();
  });

  it('preserves the review FK and cascade behavior', () => {
    const db = createTestDb();
    applyLegacyObservationSchema(db);
    seedLegacyReview(db, 'review-1');
    seedLegacyObservation(db, 'obs-1', 'A real body', 'A title');
    runMigrations(db);

    db.prepare('DELETE FROM reviews WHERE id = ?').run('review-1');
    const count = db.prepare('SELECT COUNT(*) as c FROM observations').get() as { c: number };
    expect(count.c).toBe(0);

    db.close();
  });

  it('records itself in _migrations and is idempotent', () => {
    const db = createTestDb();
    applyLegacyObservationSchema(db);
    seedLegacyReview(db, 'review-1');
    seedLegacyObservation(db, 'obs-1', 'A real body', 'A title');
    runMigrations(db);
    expect(() => runMigrations(db)).not.toThrow();

    const applied = db
      .prepare('SELECT name FROM _migrations WHERE name = ?')
      .get('006_drop_observation_title_require_body');
    expect(applied).toBeTruthy();

    db.close();
  });

  it('runs on a fresh database with no legacy rows', () => {
    const db = createTestDb();
    expect(() => runMigrations(db)).not.toThrow();

    const columns = (db.prepare('PRAGMA table_info(observations)').all() as { name: string }[]).map(
      (c) => c.name,
    );
    expect(columns).not.toContain('title');
    expect(columns).toContain('body');

    db.close();
  });
});
