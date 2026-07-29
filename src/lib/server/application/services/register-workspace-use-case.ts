import type { RegisterWorkspaceCommand } from '$lib/server/application/dto/commands/register-workspace-command';
import type { RegisterWorkspaceResult } from '$lib/server/application/dto/results/workspace-results';
import type { GitValidator } from '$lib/server/application/git-validator';
import { Workspace } from '$lib/server/domain/entities/workspace';
import { DuplicateWorkspaceError } from '$lib/server/domain/errors/duplicate-workspace-error';
import { InvalidWorkspacePathError } from '$lib/server/domain/errors/invalid-workspace-path-error';
import type { WorkspaceRepository } from '$lib/server/domain/repositories/workspace-repository';
import { RepositoryPath } from '$lib/server/domain/value-objects/repository-path';
import { WorkspaceId } from '$lib/server/domain/value-objects/workspace-id';

export class RegisterWorkspaceUseCase {
  constructor(
    private readonly repository: WorkspaceRepository,
    private readonly gitValidator: GitValidator,
  ) {}

  async execute(command: RegisterWorkspaceCommand): Promise<RegisterWorkspaceResult> {
    const validation = await this.gitValidator.validate(command.repositoryPath);

    if (!validation.isValid) {
      throw new InvalidWorkspacePathError(
        command.repositoryPath,
        validation.error ?? 'Path is not a valid Git repository',
      );
    }

    if (!validation.isRoot) {
      throw new InvalidWorkspacePathError(
        command.repositoryPath,
        'Path is not the root of a Git repository',
      );
    }

    const normalizedPath = new RepositoryPath(command.repositoryPath);

    const existing = this.repository.findByPath(normalizedPath.value);
    if (existing) {
      throw new DuplicateWorkspaceError(normalizedPath.value);
    }

    const now = new Date();
    const workspace = new Workspace({
      id: WorkspaceId.generate(),
      displayName: command.displayName,
      repositoryPath: normalizedPath,
      createdAt: now,
      lastOpenedAt: now,
    });

    this.repository.save(workspace);

    return {
      workspace: {
        id: workspace.id.value,
        displayName: workspace.displayName,
        repositoryPath: workspace.repositoryPath.value,
        status: 'valid',
        createdAt: workspace.createdAt.toISOString(),
        lastOpenedAt: workspace.lastOpenedAt.toISOString(),
      },
    };
  }
}
