import { Review } from '$lib/server/domain/entities/review';
import type { AppStateRepository } from '$lib/server/domain/repositories/app-state-repository';
import type { ReviewRepository } from '$lib/server/domain/repositories/review-repository';
import { Comparison } from '$lib/server/domain/value-objects/comparison';
import { GitRef } from '$lib/server/domain/value-objects/git-ref';
import { ReviewId } from '$lib/server/domain/value-objects/review-id';
import { WorkspaceId } from '$lib/server/domain/value-objects/workspace-id';

import type { CreateReviewCommand } from '../dto/commands/create-review-command';
import type { ReviewResult } from '../dto/results/review-results';

export class CreateReviewUseCase {
  constructor(
    private readonly reviewRepository: ReviewRepository,
    private readonly appState: AppStateRepository,
  ) {}

  async execute(command: CreateReviewCommand): Promise<ReviewResult> {
    const workspaceId = new WorkspaceId(command.workspaceId);
    const id = ReviewId.generate();

    const comparison = new Comparison({
      base: new GitRef(
        command.comparison.base.type as GitRef['type'],
        command.comparison.base.value,
      ),
      target: new GitRef(
        command.comparison.target.type as GitRef['type'],
        command.comparison.target.value,
      ),
      comparisonType: command.comparison.comparisonType as Comparison['comparisonType'],
      createdAt: new Date(command.comparison.createdAt),
    });

    const review = new Review({
      id,
      workspaceId,
      comparison,
      title: command.title?.trim() || null,
    });

    await this.reviewRepository.save(review);
    this.appState.set(`active_review:${workspaceId.value}`, id.value);

    return toResult(review);
  }
}

function toResult(review: Review): ReviewResult {
  return {
    id: review.id.value,
    workspaceId: review.workspaceId.value,
    title: review.title,
    status: review.status,
    comparison: review.comparison.toJSON(),
    createdAt: review.createdAt.toISOString(),
    updatedAt: review.updatedAt.toISOString(),
    completedAt: review.completedAt?.toISOString() ?? null,
  };
}
