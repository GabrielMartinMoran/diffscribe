import type { ListWorkspacesResult } from '$lib/server/application/dto/results/workspace-results';
import type { GitValidator } from '$lib/server/application/git-validator';
import type { WorkspaceRepository } from '$lib/server/domain/repositories/workspace-repository';

export class ListWorkspacesUseCase {
  constructor(
    private readonly repository: WorkspaceRepository,
    private readonly gitValidator: GitValidator,
  ) {}

  async execute(): Promise<ListWorkspacesResult> {
    const workspaces = this.repository.findAll();

    const results = await Promise.all(
      workspaces.map(async (ws) => {
        const validation = await this.gitValidator.validate(ws.repositoryPath.value);
        const status: 'valid' | 'invalid' =
          validation.isValid && validation.isRoot ? 'valid' : 'invalid';

        return {
          id: ws.id.value,
          displayName: ws.displayName,
          repositoryPath: ws.repositoryPath.value,
          status,
          createdAt: ws.createdAt.toISOString(),
          lastOpenedAt: ws.lastOpenedAt.toISOString(),
        };
      }),
    );

    return { workspaces: results };
  }
}
