import {
  ReviewAlreadyCompletedError,
  ReviewNotFoundError,
} from '$lib/server/domain/errors/review-errors';
import type { AppStateRepository } from '$lib/server/domain/repositories/app-state-repository';
import type { ReviewRepository } from '$lib/server/domain/repositories/review-repository';
import { ReviewId } from '$lib/server/domain/value-objects/review-id';
import { WorkspaceId } from '$lib/server/domain/value-objects/workspace-id';

import type {
  CompleteReviewCommand,
  MarkFileCommand,
  UnmarkFileCommand,
} from '../dto/commands/review-commands';
import type { ReviewResult } from '../dto/results/review-results';

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

export class MarkFileUseCase {
  constructor(private readonly reviewRepository: ReviewRepository) {}

  async execute(command: MarkFileCommand): Promise<Date> {
    const reviewId = new ReviewId(command.reviewId);
    const workspaceId = new WorkspaceId(command.workspaceId);

    const review = await this.reviewRepository.findById(reviewId);
    if (!review || !review.workspaceId.equals(workspaceId)) {
      throw new ReviewNotFoundError(command.reviewId);
    }

    if (review.isReadOnly) {
      throw new ReviewAlreadyCompletedError(command.reviewId);
    }

    // Reject paths with '..', absolute, or null bytes
    if (command.filePath.includes('..') || command.filePath.includes('\0')) {
      throw new Error('Invalid file path');
    }

    return this.reviewRepository.markFile(reviewId, command.filePath);
  }
}

export class UnmarkFileUseCase {
  constructor(private readonly reviewRepository: ReviewRepository) {}

  async execute(command: UnmarkFileCommand): Promise<void> {
    const reviewId = new ReviewId(command.reviewId);
    const workspaceId = new WorkspaceId(command.workspaceId);

    const review = await this.reviewRepository.findById(reviewId);
    if (!review || !review.workspaceId.equals(workspaceId)) {
      throw new ReviewNotFoundError(command.reviewId);
    }

    if (review.isReadOnly) {
      throw new ReviewAlreadyCompletedError(command.reviewId);
    }

    // Reject paths with '..', absolute, or null bytes
    if (command.filePath.includes('..') || command.filePath.includes('\0')) {
      throw new Error('Invalid file path');
    }

    return this.reviewRepository.unmarkFile(reviewId, command.filePath);
  }
}

export class CompleteReviewUseCase {
  constructor(
    private readonly reviewRepository: ReviewRepository,
    private readonly appState: AppStateRepository,
  ) {}

  async execute(command: CompleteReviewCommand): Promise<ReviewResult> {
    const reviewId = new ReviewId(command.reviewId);
    const workspaceId = new WorkspaceId(command.workspaceId);

    const review = await this.reviewRepository.findById(reviewId);
    if (!review || !review.workspaceId.equals(workspaceId)) {
      throw new ReviewNotFoundError(command.reviewId);
    }

    review.complete();
    await this.reviewRepository.save(review);

    // Clear active review key
    const activeKey = `active_review:${workspaceId.value}`;
    const currentActive = this.appState.get(activeKey);
    if (currentActive === reviewId.value) {
      this.appState.delete(activeKey);
    }

    return toResult(review);
  }
}
