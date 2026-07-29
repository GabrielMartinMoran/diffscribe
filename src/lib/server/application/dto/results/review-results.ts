import type { ReviewStatus } from '$lib/server/domain/entities/review';
import type { ComparisonSerialized } from '$lib/server/domain/value-objects/comparison';

export interface ReviewResult {
  id: string;
  workspaceId: string;
  title: string | null;
  status: ReviewStatus;
  comparison: ComparisonSerialized;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface ReviewListItem {
  id: string;
  workspaceId: string;
  title: string | null;
  status: ReviewStatus;
  createdAt: string;
  completedAt: string | null;
  reviewedCount: number;
  totalCount: number;
}

export interface ReviewProgressResult {
  reviewId: string;
  reviewedCount: number;
  totalCount: number;
  reviewedFiles: Array<{ filePath: string; reviewedAt: string }>;
}
