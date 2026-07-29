import type { ReviewStatus } from '$lib/server/domain/entities/review';
import { Review } from '$lib/server/domain/entities/review';
import { Comparison } from '$lib/server/domain/value-objects/comparison';
import { GitRef } from '$lib/server/domain/value-objects/git-ref';
import { ReviewId } from '$lib/server/domain/value-objects/review-id';
import { WorkspaceId } from '$lib/server/domain/value-objects/workspace-id';

export interface ReviewRow {
  id: string;
  workspace_id: string;
  title: string | null;
  status: string;
  comparison_json: string;
  comparison_type: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export function toRow(review: Review): ReviewRow {
  const serialized = review.comparison.toJSON();
  return {
    id: review.id.value,
    workspace_id: review.workspaceId.value,
    title: review.title,
    status: review.status,
    comparison_json: JSON.stringify(serialized),
    comparison_type: serialized.comparisonType,
    created_at: review.createdAt.toISOString(),
    updated_at: review.updatedAt.toISOString(),
    completed_at: review.completedAt?.toISOString() ?? null,
  };
}

export function toDomain(row: ReviewRow): Review {
  const parsed = JSON.parse(row.comparison_json);
  const comparison = new Comparison({
    base: new GitRef(parsed.base.type, parsed.base.value),
    target: new GitRef(parsed.target.type, parsed.target.value),
    comparisonType: parsed.comparisonType,
    createdAt: new Date(parsed.createdAt),
  });

  const review = new Review({
    id: new ReviewId(row.id),
    workspaceId: new WorkspaceId(row.workspace_id),
    comparison,
    title: row.title,
  });

  // Restore state (bypassing constructor defaults)
  const _r = review as unknown as {
    _status: ReviewStatus;
    _updatedAt: Date;
    _completedAt: Date | null;
    status: ReviewStatus;
  };
  _r._status = row.status as ReviewStatus;
  _r._updatedAt = new Date(row.updated_at);
  _r._completedAt = row.completed_at ? new Date(row.completed_at) : null;

  return review;
}
