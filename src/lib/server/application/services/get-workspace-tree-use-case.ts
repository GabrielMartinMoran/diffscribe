import type { WorkspaceTreeResult } from '$lib/server/application/dto/results/workspace-tree-results';
import type { WorkspaceTreeReader } from '$lib/server/application/workspace-tree-reader';

export class GetWorkspaceTreeUseCase {
  constructor(private readonly treeReader: WorkspaceTreeReader) {}

  async execute(repositoryPath: string): Promise<WorkspaceTreeResult> {
    return this.treeReader.readTree(repositoryPath);
  }
}
