import { ReviewNotFoundError } from '$lib/server/domain/errors/review-errors';
import type { AppStateRepository } from '$lib/server/domain/repositories/app-state-repository';
import type { ReviewRepository } from '$lib/server/domain/repositories/review-repository';
import { ReviewId } from '$lib/server/domain/value-objects/review-id';
import { WorkspaceId } from '$lib/server/domain/value-objects/workspace-id';

import type { SetActiveReviewCommand } from '../dto/commands/review-commands';

export class SetActiveReviewUseCase {
  constructor(
    private readonly reviewRepository: ReviewRepository,
    private readonly appState: AppStateRepository,
  ) {}

  async execute(command: SetActiveReviewCommand): Promise<void> {
    const reviewId = new ReviewId(command.reviewId);
    const workspaceId = new WorkspaceId(command.workspaceId);

    const review = await this.reviewRepository.findById(reviewId);
    if (!review) {
      throw new ReviewNotFoundError(command.reviewId);
    }

    // Verify ownership
    if (!review.workspaceId.equals(workspaceId)) {
      throw new ReviewNotFoundError(command.reviewId);
    }

    // Reopen (no-op if already active, just sets the key)
    review.reopen();
    await this.reviewRepository.save(review);

    this.appState.set(`active_review:${workspaceId.value}`, reviewId.value);
  }
}
