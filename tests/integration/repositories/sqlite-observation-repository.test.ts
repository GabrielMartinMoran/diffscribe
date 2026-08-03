import type Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { Observation } from '../../../src/lib/server/domain/entities/observation';
import {
  Comparison,
  ComparisonType,
} from '../../../src/lib/server/domain/value-objects/comparison';
import { GitRef } from '../../../src/lib/server/domain/value-objects/git-ref';
import { LineRange } from '../../../src/lib/server/domain/value-objects/line-range';
import {
  ObservationSeverity,
  ObservationType,
} from '../../../src/lib/server/domain/value-objects/observation-enums';
import { ObservationId } from '../../../src/lib/server/domain/value-objects/observation-id';
import { ReviewId } from '../../../src/lib/server/domain/value-objects/review-id';
import {
  createTestDb,
  runMigrations,
} from '../../../src/lib/server/infrastructure/database/connection';
import { SqliteObservationRepository } from '../../../src/lib/server/infrastructure/repositories/sqlite-observation-repository';

function makeComparison(): Comparison {
  return new Comparison({
    base: new GitRef('head', 'HEAD'),
    target: new GitRef('working-tree', 'working-tree'),
    comparisonType: ComparisonType.WORKING_TREE_VS_HEAD,
  });
}

function seedWorkspace(db: Database.Database, id: string): void {
  db.prepare(
    'INSERT INTO workspaces (id, display_name, repository_path, created_at, last_opened_at) VALUES (?, ?, ?, ?, ?)',
  ).run(id, 'Test', `/tmp/${id}`, '2026-01-01', '2026-01-01');
}

function seedReview(db: Database.Database, reviewId: string, workspaceId: string): void {
  const comparison = makeComparison();
  db.prepare(
    'INSERT INTO reviews (id, workspace_id, status, comparison_json, comparison_type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).run(
    reviewId,
    workspaceId,
    'draft',
    JSON.stringify(comparison.toJSON()),
    'working-tree-vs-head',
    '2026-01-01',
    '2026-01-01',
  );
}

describe('SqliteObservationRepository', () => {
  let db: Database.Database;
  let repo: SqliteObservationRepository;

  beforeEach(() => {
    db = createTestDb();
    runMigrations(db);
    repo = new SqliteObservationRepository(db);
  });

  afterEach(() => {
    db.close();
  });

  it('saves and retrieves an observation by id', async () => {
    const workspaceId = '550e8400-e29b-41d4-a716-446655440000';
    const reviewId = '550e8400-e29b-41d4-a716-446655440001';
    seedWorkspace(db, workspaceId);
    seedReview(db, reviewId, workspaceId);

    const obs = new Observation({
      id: ObservationId.generate(),
      reviewId: new ReviewId(reviewId),
      type: ObservationType.ISSUE,
      severity: ObservationSeverity.MAJOR,
      body: 'Missing validation',
      filePath: 'src/app.ts',
      lineRange: new LineRange(10, 15),
      comparisonSnapshotJson: JSON.stringify(makeComparison().toJSON()),
      diffSnapshot: '+added\n-removed\n unchanged',
      contentHash: 'abc123',
    });

    await repo.save(obs);

    const found = await repo.findById(obs.id);
    expect(found).not.toBeNull();
    expect(found!.body).toBe('Missing validation');
    expect(found!.type).toBe(ObservationType.ISSUE);
    expect(found!.filePath).toBe('src/app.ts');
    expect(found!.lineRange?.start).toBe(10);
    expect(found!.lineRange?.end).toBe(15);
    expect(found!.diffSnapshot).toBe('+added\n-removed\n unchanged');
    expect(found!.contentHash).toBe('abc123');
  });

  it('finds observations by review id', async () => {
    const workspaceId = '550e8400-e29b-41d4-a716-446655440000';
    const reviewId = '550e8400-e29b-41d4-a716-446655440001';
    seedWorkspace(db, workspaceId);
    seedReview(db, reviewId, workspaceId);

    const obs1 = new Observation({
      id: ObservationId.generate(),
      reviewId: new ReviewId(reviewId),
      type: ObservationType.NOTE,
      body: 'Obs 1',
      filePath: 'src/a.ts',
      comparisonSnapshotJson: JSON.stringify(makeComparison().toJSON()),
      diffSnapshot: 'content',
      contentHash: 'h1',
    });

    const obs2 = new Observation({
      id: ObservationId.generate(),
      reviewId: new ReviewId(reviewId),
      type: ObservationType.QUESTION,
      body: 'Obs 2',
      filePath: 'src/b.ts',
      comparisonSnapshotJson: JSON.stringify(makeComparison().toJSON()),
      diffSnapshot: 'content',
      contentHash: 'h2',
    });

    await repo.save(obs1);
    await repo.save(obs2);

    const list = await repo.findByReviewId(new ReviewId(reviewId));
    expect(list).toHaveLength(2);
    const bodies = list.map((o) => o.body);
    expect(bodies).toContain('Obs 1');
    expect(bodies).toContain('Obs 2');
  });

  it('deletes an observation by id', async () => {
    const workspaceId = '550e8400-e29b-41d4-a716-446655440000';
    const reviewId = '550e8400-e29b-41d4-a716-446655440001';
    seedWorkspace(db, workspaceId);
    seedReview(db, reviewId, workspaceId);

    const obs = new Observation({
      id: ObservationId.generate(),
      reviewId: new ReviewId(reviewId),
      type: ObservationType.NOTE,
      body: 'To delete',
      filePath: 'src/a.ts',
      comparisonSnapshotJson: JSON.stringify(makeComparison().toJSON()),
      diffSnapshot: 'content',
      contentHash: 'h1',
    });

    await repo.save(obs);
    expect(await repo.findById(obs.id)).not.toBeNull();

    await repo.delete(obs.id);
    expect(await repo.findById(obs.id)).toBeNull();
  });

  it('deletes all observations for a review', async () => {
    const workspaceId = '550e8400-e29b-41d4-a716-446655440000';
    const reviewId = '550e8400-e29b-41d4-a716-446655440001';
    seedWorkspace(db, workspaceId);
    seedReview(db, reviewId, workspaceId);

    const obs = new Observation({
      id: ObservationId.generate(),
      reviewId: new ReviewId(reviewId),
      type: ObservationType.NOTE,
      body: 'Obs',
      filePath: 'src/a.ts',
      comparisonSnapshotJson: JSON.stringify(makeComparison().toJSON()),
      diffSnapshot: 'content',
      contentHash: 'h1',
    });

    await repo.save(obs);
    await repo.deleteByReviewId(new ReviewId(reviewId));
    const list = await repo.findByReviewId(new ReviewId(reviewId));
    expect(list).toHaveLength(0);
  });

  it('counts observations for a review', async () => {
    const workspaceId = '550e8400-e29b-41d4-a716-446655440000';
    const reviewId = '550e8400-e29b-41d4-a716-446655440001';
    seedWorkspace(db, workspaceId);
    seedReview(db, reviewId, workspaceId);

    const obs = new Observation({
      id: ObservationId.generate(),
      reviewId: new ReviewId(reviewId),
      type: ObservationType.NOTE,
      body: 'Obs',
      filePath: 'src/a.ts',
      comparisonSnapshotJson: JSON.stringify(makeComparison().toJSON()),
      diffSnapshot: 'content',
      contentHash: 'h1',
    });

    await repo.save(obs);
    const count = await repo.countByReviewId(new ReviewId(reviewId));
    expect(count).toBe(1);
  });

  it('updates an existing observation on save', async () => {
    const workspaceId = '550e8400-e29b-41d4-a716-446655440000';
    const reviewId = '550e8400-e29b-41d4-a716-446655440001';
    seedWorkspace(db, workspaceId);
    seedReview(db, reviewId, workspaceId);

    const obsId = ObservationId.generate();
    const obs = new Observation({
      id: obsId,
      reviewId: new ReviewId(reviewId),
      type: ObservationType.NOTE,
      body: 'Original',
      filePath: 'src/a.ts',
      comparisonSnapshotJson: JSON.stringify(makeComparison().toJSON()),
      diffSnapshot: 'content',
      contentHash: 'h1',
    });

    await repo.save(obs);

    obs.editBody('Updated');
    await repo.save(obs);

    const found = await repo.findById(obsId);
    expect(found!.body).toBe('Updated');
  });

  it('returns null for non-existent observation', async () => {
    const result = await repo.findById(ObservationId.generate());
    expect(result).toBeNull();
  });

  it('saves and retrieves a review-level observation (no file/range)', async () => {
    const workspaceId = '550e8400-e29b-41d4-a716-446655440000';
    const reviewId = '550e8400-e29b-41d4-a716-446655440001';
    seedWorkspace(db, workspaceId);
    seedReview(db, reviewId, workspaceId);

    const obs = new Observation({
      id: ObservationId.generate(),
      reviewId: new ReviewId(reviewId),
      type: ObservationType.QUESTION,
      body: 'Review-level question',
      comparisonSnapshotJson: JSON.stringify(makeComparison().toJSON()),
    });

    await repo.save(obs);

    const found = await repo.findById(obs.id);
    expect(found).not.toBeNull();
    expect(found!.filePath).toBeNull();
    expect(found!.lineRange).toBeNull();
    expect(found!.diffSnapshot).toBeNull();
    expect(found!.contentHash).toBeNull();
  });
});
