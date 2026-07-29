import type Database from 'better-sqlite3';

import type { Observation } from '$lib/server/domain/entities/observation';
import type { ObservationRepository } from '$lib/server/domain/repositories/observation-repository';
import type { ObservationId } from '$lib/server/domain/value-objects/observation-id';
import type { ReviewId } from '$lib/server/domain/value-objects/review-id';

import { type ObservationRow, toDomain, toRow } from '../mappers/observation-mapper';

export class SqliteObservationRepository implements ObservationRepository {
  constructor(private readonly db: Database.Database) {}

  async save(observation: Observation): Promise<void> {
    const row = toRow(observation);
    this.db
      .prepare(
        `INSERT INTO observations (
          id, review_id, type, severity, origin, status, title, body, agent_instruction,
          file_path, side, line_start, line_end,
          comparison_snapshot_json, diff_snapshot, content_hash,
          created_at, updated_at
        ) VALUES (
          @id, @review_id, @type, @severity, @origin, @status, @title, @body, @agent_instruction,
          @file_path, @side, @line_start, @line_end,
          @comparison_snapshot_json, @diff_snapshot, @content_hash,
          @created_at, @updated_at
        ) ON CONFLICT(id) DO UPDATE SET
          type = excluded.type,
          severity = excluded.severity,
          status = excluded.status,
          title = excluded.title,
          body = excluded.body,
          agent_instruction = excluded.agent_instruction,
          file_path = excluded.file_path,
          side = excluded.side,
          line_start = excluded.line_start,
          line_end = excluded.line_end,
          diff_snapshot = excluded.diff_snapshot,
          content_hash = excluded.content_hash,
          updated_at = excluded.updated_at`,
      )
      .run(row);
  }

  async findById(id: ObservationId): Promise<Observation | null> {
    const row = this.db.prepare('SELECT * FROM observations WHERE id = ?').get(id.value) as
      ObservationRow | undefined;
    return row ? toDomain(row) : null;
  }

  async findByReviewId(reviewId: ReviewId): Promise<Observation[]> {
    const rows = this.db
      .prepare('SELECT * FROM observations WHERE review_id = ? ORDER BY created_at ASC')
      .all(reviewId.value) as ObservationRow[];
    return rows.map((r) => toDomain(r));
  }

  async delete(id: ObservationId): Promise<void> {
    this.db.prepare('DELETE FROM observations WHERE id = ?').run(id.value);
  }

  async deleteByReviewId(reviewId: ReviewId): Promise<void> {
    this.db.prepare('DELETE FROM observations WHERE review_id = ?').run(reviewId.value);
  }

  async countByReviewId(reviewId: ReviewId): Promise<number> {
    const row = this.db
      .prepare('SELECT COUNT(*) as count FROM observations WHERE review_id = ?')
      .get(reviewId.value) as { count: number };
    return row.count;
  }
}
