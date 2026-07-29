import type { WorkspaceTreeResult } from '$lib/server/application/dto/results/workspace-tree-results';

export interface WorkspaceTreeReader {
  readTree(repositoryPath: string): Promise<WorkspaceTreeResult>;
}
