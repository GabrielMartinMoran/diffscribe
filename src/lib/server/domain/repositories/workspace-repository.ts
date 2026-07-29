import type { Workspace } from '$lib/server/domain/entities/workspace';
import type { WorkspaceId } from '$lib/server/domain/value-objects/workspace-id';

export interface WorkspaceRepository {
  findById(id: WorkspaceId): Workspace | null;
  findAll(): Workspace[];
  findByPath(path: string): Workspace | null;
  save(workspace: Workspace): void;
  delete(id: WorkspaceId): void;
}
