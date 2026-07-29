import type { ReviewRepository } from '$lib/server/domain/repositories/review-repository';
import type { WorkspaceRepository } from '$lib/server/domain/repositories/workspace-repository';
import { WorkspaceId } from '$lib/server/domain/value-objects/workspace-id';

import type { ReviewListItem } from '../dto/results/review-results';

export interface ListReviewsQuery {
  workspaceId: string;
  currentFiles?: string[];
}

export class ListReviewsUseCase {
  constructor(
    private readonly reviewRepository: ReviewRepository,
    private readonly workspaceRepository: WorkspaceRepository,
  ) {}

  async execute(query: ListReviewsQuery): Promise<ReviewListItem[]> {
    const workspaceId = new WorkspaceId(query.workspaceId);
    const reviews = await this.reviewRepository.findByWorkspaceId(workspaceId);
    const currentFiles = query.currentFiles ?? [];

    const results: ReviewListItem[] = [];
    for (const r of reviews) {
      const marks = await this.reviewRepository.getMarksIntersecting(r.id, currentFiles);
      results.push({
        id: r.id.value,
        workspaceId: r.workspaceId.value,
        title: r.title,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
        completedAt: r.completedAt?.toISOString() ?? null,
        reviewedCount: marks.length,
        totalCount: currentFiles.length,
      });
    }
    return results;
  }
}
