import type { GetWorkspaceResult } from '$lib/server/application/dto/results/workspace-results';
import type { GitValidator } from '$lib/server/application/git-validator';
import type { WorkspaceRepository } from '$lib/server/domain/repositories/workspace-repository';
import { WorkspaceId } from '$lib/server/domain/value-objects/workspace-id';

export interface GetWorkspaceQuery {
  id: string;
}

export class GetWorkspaceUseCase {
  constructor(
    private readonly repository: WorkspaceRepository,
    private readonly gitValidator: GitValidator,
  ) {}

  async execute(query: GetWorkspaceQuery): Promise<GetWorkspaceResult> {
    let id: WorkspaceId;
    try {
      id = new WorkspaceId(query.id);
    } catch {
      return { workspace: null };
    }

    const ws = this.repository.findById(id);
    if (!ws) {
      return { workspace: null };
    }

    const validation = await this.gitValidator.validate(ws.repositoryPath.value);
    const status: 'valid' | 'invalid' =
      validation.isValid && validation.isRoot ? 'valid' : 'invalid';

    return {
      workspace: {
        id: ws.id.value,
        displayName: ws.displayName,
        repositoryPath: ws.repositoryPath.value,
        status,
        createdAt: ws.createdAt.toISOString(),
        lastOpenedAt: ws.lastOpenedAt.toISOString(),
      },
    };
  }
}
