import { WorkspaceNotFoundError } from '$lib/server/domain/errors/workspace-not-found-error';
import type { AppStateRepository } from '$lib/server/domain/repositories/app-state-repository';
import type { ObservationRepository } from '$lib/server/domain/repositories/observation-repository';
import type { ReviewRepository } from '$lib/server/domain/repositories/review-repository';
import type { WorkspaceRepository } from '$lib/server/domain/repositories/workspace-repository';
import { WorkspaceId } from '$lib/server/domain/value-objects/workspace-id';

export interface DeleteWorkspaceCommand {
  id: string;
}

export class DeleteWorkspaceUseCase {
  constructor(
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly appStateRepository: AppStateRepository,
    private readonly reviewRepository?: ReviewRepository,
    private readonly observationRepository?: ObservationRepository,
  ) {}

  async execute(command: DeleteWorkspaceCommand): Promise<void> {
    let id: WorkspaceId;
    try {
      id = new WorkspaceId(command.id);
    } catch {
      throw new WorkspaceNotFoundError(command.id);
    }

    const existing = this.workspaceRepository.findById(id);
    if (!existing) {
      throw new WorkspaceNotFoundError(command.id);
    }

    // Delete observations first, then reviews (explicit order before FK cascade)
    if (this.reviewRepository) {
      const reviews = await this.reviewRepository.findByWorkspaceId(id);
      if (this.observationRepository) {
        for (const review of reviews) {
          await this.observationRepository.deleteByReviewId(review.id);
        }
      }
      await this.reviewRepository.deleteByWorkspaceId(id);
    }

    this.workspaceRepository.delete(id);

    const activeId = this.appStateRepository.get('active_workspace_id');
    if (activeId === id.value) {
      this.appStateRepository.delete('active_workspace_id');
    }

    // Clear active review key
    const activeReviewKey = `active_review:${id.value}`;
    if (this.appStateRepository.get(activeReviewKey)) {
      this.appStateRepository.delete(activeReviewKey);
    }
  }
}
