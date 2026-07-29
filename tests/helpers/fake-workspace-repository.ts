import type { Workspace } from '$lib/server/domain/entities/workspace';
import type { WorkspaceRepository } from '$lib/server/domain/repositories/workspace-repository';
import type { WorkspaceId } from '$lib/server/domain/value-objects/workspace-id';

export class FakeWorkspaceRepository implements WorkspaceRepository {
  private workspaces: Map<string, Workspace> = new Map();

  findById(id: WorkspaceId): Workspace | null {
    return this.workspaces.get(id.value) ?? null;
  }

  findAll(): Workspace[] {
    return Array.from(this.workspaces.values());
  }

  findByPath(path: string): Workspace | null {
    for (const ws of this.workspaces.values()) {
      if (ws.repositoryPath.value === path) {
        return ws;
      }
    }
    return null;
  }

  save(workspace: Workspace): void {
    this.workspaces.set(workspace.id.value, workspace);
  }

  delete(id: WorkspaceId): void {
    this.workspaces.delete(id.value);
  }

  _clear(): void {
    this.workspaces.clear();
  }
}
