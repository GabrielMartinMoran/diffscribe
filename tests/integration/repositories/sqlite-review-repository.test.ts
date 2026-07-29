import Database from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';

import { Review, ReviewStatus } from '../../../src/lib/server/domain/entities/review';
import {
  Comparison,
  ComparisonType,
} from '../../../src/lib/server/domain/value-objects/comparison';
import { GitRef } from '../../../src/lib/server/domain/value-objects/git-ref';
import { ReviewId } from '../../../src/lib/server/domain/value-objects/review-id';
import { WorkspaceId } from '../../../src/lib/server/domain/value-objects/workspace-id';
import {
  createTestDb,
  runMigrations,
} from '../../../src/lib/server/infrastructure/database/connection';
import { SqliteReviewRepository } from '../../../src/lib/server/infrastructure/repositories/sqlite-review-repository';

function createDb(): Database.Database {
  const db = createTestDb();
  runMigrations(db);
  return db;
}

function insertWorkspace(db: Database.Database, id: string): void {
  db.prepare(
    'INSERT INTO workspaces (id, display_name, repository_path, created_at, last_opened_at) VALUES (?, ?, ?, ?, ?)',
  ).run(id, 'Test', `/tmp/${id}`, new Date().toISOString(), new Date().toISOString());
}

function makeComparison(): Comparison {
  return new Comparison({
    base: new GitRef('head', 'HEAD'),
    target: new GitRef('working-tree', 'working-tree'),
    comparisonType: ComparisonType.WORKING_TREE_VS_HEAD,
  });
}

function makeReview(
  workspaceId: WorkspaceId,
  overrides?: { title?: string; id?: ReviewId },
): Review {
  return new Review({
    id: overrides?.id ?? ReviewId.generate(),
    workspaceId,
    comparison: makeComparison(),
    title: overrides?.title ?? null,
  });
}

describe('SqliteReviewRepository (integration)', () => {
  let db: Database.Database;
  let repo: SqliteReviewRepository;
  let workspaceId: WorkspaceId;

  beforeEach(() => {
    db = createDb();
    repo = new SqliteReviewRepository(db);
    workspaceId = WorkspaceId.generate();
    insertWorkspace(db, workspaceId.value);
  });

  it('saves and retrieves a review by id', async () => {
    const review = makeReview(workspaceId);
    await repo.save(review);

    const found = await repo.findById(review.id);
    expect(found).not.toBeNull();
    expect(found!.id.equals(review.id)).toBe(true);
    expect(found!.workspaceId.equals(review.workspaceId)).toBe(true);
    expect(found!.status).toBe(ReviewStatus.DRAFT);
    expect(found!.comparison.equals(review.comparison)).toBe(true);
    expect(found!.title).toBe(review.title);
  });

  it('returns null for non-existent review', async () => {
    const found = await repo.findById(ReviewId.generate());
    expect(found).toBeNull();
  });

  it('lists reviews by workspace', async () => {
    const r1 = makeReview(workspaceId, { title: 'First' });
    const r2 = makeReview(workspaceId, { title: 'Second' });
    await repo.save(r1);
    await repo.save(r2);

    const list = await repo.findByWorkspaceId(workspaceId);
    expect(list).toHaveLength(2);
  });

  it('isolates reviews by workspace', async () => {
    const ws2 = WorkspaceId.generate();
    insertWorkspace(db, ws2.value);

    await repo.save(makeReview(workspaceId, { title: 'WS1' }));
    await repo.save(makeReview(ws2, { title: 'WS2' }));

    const ws1List = await repo.findByWorkspaceId(workspaceId);
    expect(ws1List).toHaveLength(1);
    expect(ws1List[0].title).toBe('WS1');

    const ws2List = await repo.findByWorkspaceId(ws2);
    expect(ws2List).toHaveLength(1);
    expect(ws2List[0].title).toBe('WS2');
  });

  it('marks a file as reviewed', async () => {
    const review = makeReview(workspaceId);
    await repo.save(review);
    const reviewedAt = await repo.markFile(review.id, 'a.ts');
    expect(reviewedAt).toBeInstanceOf(Date);

    const marks = await repo.getMarks(review.id);
    expect(marks).toHaveLength(1);
    expect(marks[0].filePath).toBe('a.ts');
    expect(marks[0].reviewedAt).toBeInstanceOf(Date);
  });

  it('unmarks a file', async () => {
    const review = makeReview(workspaceId);
    await repo.save(review);
    await repo.markFile(review.id, 'a.ts');
    await repo.unmarkFile(review.id, 'a.ts');

    const marks = await repo.getMarks(review.id);
    expect(marks).toHaveLength(0);
  });

  it('getMarksIntersecting only returns marks for paths in current list', async () => {
    const review = makeReview(workspaceId);
    await repo.save(review);
    await repo.markFile(review.id, 'a.ts');
    await repo.markFile(review.id, 'b.ts');
    await repo.markFile(review.id, 'c.ts');

    const marks = await repo.getMarksIntersecting(review.id, ['a.ts', 'c.ts']);
    expect(marks).toHaveLength(2);
    const paths = marks.map((m) => m.filePath);
    expect(paths).toContain('a.ts');
    expect(paths).toContain('c.ts');
    expect(paths).not.toContain('b.ts');
  });

  it('markFile is idempotent', async () => {
    const review = makeReview(workspaceId);
    await repo.save(review);
    await repo.markFile(review.id, 'a.ts');
    await repo.markFile(review.id, 'a.ts');

    const marks = await repo.getMarks(review.id);
    expect(marks).toHaveLength(1);
  });

  it('unmarkFile is no-op for unmarked file', async () => {
    const review = makeReview(workspaceId);
    await repo.save(review);
    await expect(repo.unmarkFile(review.id, 'nonexistent.ts')).resolves.not.toThrow();
  });

  it('deleteByWorkspaceId removes all workspace reviews', async () => {
    const r1 = makeReview(workspaceId);
    const r2 = makeReview(workspaceId);
    await repo.save(r1);
    await repo.save(r2);

    await repo.deleteByWorkspaceId(workspaceId);

    const list = await repo.findByWorkspaceId(workspaceId);
    expect(list).toHaveLength(0);
  });

  it('round-trips a completed review', async () => {
    const review = makeReview(workspaceId);
    review.complete();
    await repo.save(review);

    const found = await repo.findById(review.id);
    expect(found).not.toBeNull();
    expect(found!.status).toBe(ReviewStatus.COMPLETED);
    expect(found!.completedAt).toBeInstanceOf(Date);
  });

  it('round-trips a review with title', async () => {
    const review = makeReview(workspaceId, { title: 'My Review' });
    await repo.save(review);

    const found = await repo.findById(review.id);
    expect(found).not.toBeNull();
    expect(found!.title).toBe('My Review');
  });
});
