import type { Review } from '../entities/review';
import type { ReviewId } from '../value-objects/review-id';
import type { WorkspaceId } from '../value-objects/workspace-id';

export interface ReviewFileMark {
  filePath: string;
  reviewedAt: Date;
}

export interface ReviewRepository {
  save(review: Review): Promise<void>;
  findById(id: ReviewId): Promise<Review | null>;
  findByWorkspaceId(workspaceId: WorkspaceId): Promise<Review[]>;
  deleteByWorkspaceId(workspaceId: WorkspaceId): Promise<void>;
  markFile(reviewId: ReviewId, filePath: string): Promise<Date>;
  unmarkFile(reviewId: ReviewId, filePath: string): Promise<void>;
  getMarks(reviewId: ReviewId): Promise<ReviewFileMark[]>;
  getMarksIntersecting(reviewId: ReviewId, currentFiles: string[]): Promise<ReviewFileMark[]>;
}
