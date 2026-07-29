import type { RepairWorkspaceResult } from '$lib/server/application/dto/results/workspace-results';
import type { GitValidator } from '$lib/server/application/git-validator';
import { Workspace } from '$lib/server/domain/entities/workspace';
import { DuplicateWorkspaceError } from '$lib/server/domain/errors/duplicate-workspace-error';
import { InvalidWorkspacePathError } from '$lib/server/domain/errors/invalid-workspace-path-error';
import { WorkspaceNotFoundError } from '$lib/server/domain/errors/workspace-not-found-error';
import type { WorkspaceRepository } from '$lib/server/domain/repositories/workspace-repository';
import { RepositoryPath } from '$lib/server/domain/value-objects/repository-path';
import { WorkspaceId } from '$lib/server/domain/value-objects/workspace-id';

export interface RepairWorkspaceCommand {
  id: string;
  newRepositoryPath: string;
}

export class RepairWorkspacePathUseCase {
  constructor(
    private readonly repository: WorkspaceRepository,
    private readonly gitValidator: GitValidator,
  ) {}

  async execute(command: RepairWorkspaceCommand): Promise<RepairWorkspaceResult> {
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

    const validation = await this.gitValidator.validate(command.newRepositoryPath);
    if (!validation.isValid) {
      throw new InvalidWorkspacePathError(
        command.newRepositoryPath,
        validation.error ?? 'Path is not a valid Git repository',
      );
    }
    if (!validation.isRoot) {
      throw new InvalidWorkspacePathError(
        command.newRepositoryPath,
        'Path is not the root of a Git repository',
      );
    }

    const normalizedPath = new RepositoryPath(command.newRepositoryPath);

    const duplicate = this.repository.findByPath(normalizedPath.value);
    if (duplicate && duplicate.id.value !== existing.id.value) {
      throw new DuplicateWorkspaceError(normalizedPath.value);
    }

    const repaired = new Workspace({
      id: existing.id,
      displayName: existing.displayName,
      repositoryPath: normalizedPath,
      createdAt: existing.createdAt,
      lastOpenedAt: new Date(),
    });

    this.repository.save(repaired);

    return {
      workspace: {
        id: repaired.id.value,
        displayName: repaired.displayName,
        repositoryPath: repaired.repositoryPath.value,
        status: 'valid',
        createdAt: repaired.createdAt.toISOString(),
        lastOpenedAt: repaired.lastOpenedAt.toISOString(),
      },
    };
  }
}
