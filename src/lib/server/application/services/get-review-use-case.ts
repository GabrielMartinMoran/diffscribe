import { ReviewNotFoundError } from '$lib/server/domain/errors/review-errors';
import type { ReviewRepository } from '$lib/server/domain/repositories/review-repository';
import { ReviewId } from '$lib/server/domain/value-objects/review-id';

import type { ReviewResult } from '../dto/results/review-results';

export interface GetReviewQuery {
  reviewId: string;
}

function toResult(r: NonNullable<Awaited<ReturnType<ReviewRepository['findById']>>>): ReviewResult {
  return {
    id: r.id.value,
    workspaceId: r.workspaceId.value,
    title: r.title,
    status: r.status,
    comparison: r.comparison.toJSON(),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    completedAt: r.completedAt?.toISOString() ?? null,
  };
}

export class GetReviewUseCase {
  constructor(private readonly reviewRepository: ReviewRepository) {}

  async execute(query: GetReviewQuery): Promise<ReviewResult> {
    const reviewId = new ReviewId(query.reviewId);
    const review = await this.reviewRepository.findById(reviewId);
    if (!review) {
      throw new ReviewNotFoundError(query.reviewId);
    }
    return toResult(review);
  }
}
