import type Database from 'better-sqlite3';

import type { Review } from '$lib/server/domain/entities/review';
import type {
  ReviewFileMark,
  ReviewRepository,
} from '$lib/server/domain/repositories/review-repository';
import type { ReviewId } from '$lib/server/domain/value-objects/review-id';
import type { WorkspaceId } from '$lib/server/domain/value-objects/workspace-id';

import { type ReviewRow, toDomain, toRow } from '../mappers/review-mapper';

export class SqliteReviewRepository implements ReviewRepository {
  constructor(private readonly db: Database.Database) {}

  async save(review: Review): Promise<void> {
    const row = toRow(review);
    this.db
      .prepare(
        `INSERT INTO reviews (id, workspace_id, title, status, comparison_json, comparison_type, created_at, updated_at, completed_at)
       VALUES (@id, @workspace_id, @title, @status, @comparison_json, @comparison_type, @created_at, @updated_at, @completed_at)
       ON CONFLICT(id) DO UPDATE SET
         title = excluded.title,
         status = excluded.status,
         comparison_json = excluded.comparison_json,
         comparison_type = excluded.comparison_type,
         updated_at = excluded.updated_at,
         completed_at = excluded.completed_at`,
      )
      .run(row);
  }

  async findById(id: ReviewId): Promise<Review | null> {
    const row = this.db.prepare('SELECT * FROM reviews WHERE id = ?').get(id.value) as
      ReviewRow | undefined;
    return row ? toDomain(row) : null;
  }

  async findByWorkspaceId(workspaceId: WorkspaceId): Promise<Review[]> {
    const rows = this.db
      .prepare('SELECT * FROM reviews WHERE workspace_id = ? ORDER BY created_at DESC')
      .all(workspaceId.value) as ReviewRow[];
    return rows.map((r) => toDomain(r));
  }

  async deleteByWorkspaceId(workspaceId: WorkspaceId): Promise<void> {
    this.db.prepare('DELETE FROM reviews WHERE workspace_id = ?').run(workspaceId.value);
  }

  async markFile(reviewId: ReviewId, filePath: string): Promise<Date> {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO review_files (review_id, file_path, reviewed_at)
       VALUES (?, ?, ?)
       ON CONFLICT(review_id, file_path) DO UPDATE SET reviewed_at = excluded.reviewed_at`,
      )
      .run(reviewId.value, filePath, now);
    return new Date(now);
  }

  async unmarkFile(reviewId: ReviewId, filePath: string): Promise<void> {
    this.db
      .prepare('DELETE FROM review_files WHERE review_id = ? AND file_path = ?')
      .run(reviewId.value, filePath);
  }

  async getMarks(reviewId: ReviewId): Promise<ReviewFileMark[]> {
    const rows = this.db
      .prepare('SELECT file_path, reviewed_at FROM review_files WHERE review_id = ?')
      .all(reviewId.value) as Array<{ file_path: string; reviewed_at: string }>;
    return rows.map((r) => ({
      filePath: r.file_path,
      reviewedAt: new Date(r.reviewed_at),
    }));
  }

  async getMarksIntersecting(
    reviewId: ReviewId,
    currentFiles: string[],
  ): Promise<ReviewFileMark[]> {
    if (currentFiles.length === 0) return [];

    const placeholders = currentFiles.map(() => '?').join(', ');
    const stmt = this.db.prepare(
      `SELECT file_path, reviewed_at FROM review_files
       WHERE review_id = ? AND file_path IN (${placeholders})`,
    );
    const rows = stmt.all(reviewId.value, ...currentFiles) as Array<{
      file_path: string;
      reviewed_at: string;
    }>;
    return rows.map((r) => ({
      filePath: r.file_path,
      reviewedAt: new Date(r.reviewed_at),
    }));
  }
}
