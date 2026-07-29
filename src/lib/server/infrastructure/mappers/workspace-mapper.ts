import { Workspace } from '$lib/server/domain/entities/workspace';
import { RepositoryPath } from '$lib/server/domain/value-objects/repository-path';
import { WorkspaceId } from '$lib/server/domain/value-objects/workspace-id';

export interface WorkspaceRow {
  id: string;
  display_name: string;
  repository_path: string;
  created_at: string;
  last_opened_at: string;
}

export function rowToWorkspace(row: WorkspaceRow): Workspace {
  return new Workspace({
    id: new WorkspaceId(row.id),
    displayName: row.display_name,
    repositoryPath: new RepositoryPath(row.repository_path),
    createdAt: new Date(row.created_at),
    lastOpenedAt: new Date(row.last_opened_at),
  });
}

export function workspaceToRow(workspace: Workspace): WorkspaceRow {
  return {
    id: workspace.id.value,
    display_name: workspace.displayName,
    repository_path: workspace.repositoryPath.value,
    created_at: workspace.createdAt.toISOString(),
    last_opened_at: workspace.lastOpenedAt.toISOString(),
  };
}
