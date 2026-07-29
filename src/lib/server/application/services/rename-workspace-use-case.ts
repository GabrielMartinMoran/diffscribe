import type { WorkspaceDetail } from '$lib/server/application/dto/results/workspace-results';
import { WorkspaceNotFoundError } from '$lib/server/domain/errors/workspace-not-found-error';
import type { WorkspaceRepository } from '$lib/server/domain/repositories/workspace-repository';
import { WorkspaceId } from '$lib/server/domain/value-objects/workspace-id';

export interface RenameWorkspaceCommand {
  id: string;
  displayName: string;
}

export interface RenameWorkspaceResult {
  workspace: WorkspaceDetail;
}

export class RenameWorkspaceUseCase {
  constructor(private readonly repository: WorkspaceRepository) {}

  async execute(command: RenameWorkspaceCommand): Promise<RenameWorkspaceResult> {
    let id: WorkspaceId;
    try {
      id = new WorkspaceId(command.id);
    } catch {
      throw new WorkspaceNotFoundError(command.id);
    }

    const existing = this.repository.findById(id);
    if (!existing) {
      throw new WorkspaceNotFoundError(command.id);
    }

    existing.rename(command.displayName);
    this.repository.save(existing);

    return {
      workspace: {
        id: existing.id.value,
        displayName: existing.displayName,
        repositoryPath: existing.repositoryPath.value,
        status: 'valid',
        createdAt: existing.createdAt.toISOString(),
        lastOpenedAt: existing.lastOpenedAt.toISOString(),
      },
    };
  }
}
