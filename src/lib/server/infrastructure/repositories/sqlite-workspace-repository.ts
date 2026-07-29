import type Database from 'better-sqlite3';

import type { Workspace } from '$lib/server/domain/entities/workspace';
import type { WorkspaceRepository } from '$lib/server/domain/repositories/workspace-repository';
import type { WorkspaceId } from '$lib/server/domain/value-objects/workspace-id';
import type { WorkspaceRow } from '$lib/server/infrastructure/mappers/workspace-mapper';
import {
  rowToWorkspace,
  workspaceToRow,
} from '$lib/server/infrastructure/mappers/workspace-mapper';

export class SqliteWorkspaceRepository implements WorkspaceRepository {
  constructor(private readonly db: Database.Database) {}

  findById(id: WorkspaceId): Workspace | null {
    const row = this.db.prepare('SELECT * FROM workspaces WHERE id = ?').get(id.value) as
      WorkspaceRow | undefined;

    if (!row) return null;
    return rowToWorkspace(row);
  }

  findAll(): Workspace[] {
    const rows = this.db
      .prepare('SELECT * FROM workspaces ORDER BY last_opened_at DESC')
      .all() as WorkspaceRow[];
    return rows.map((r) => rowToWorkspace(r));
  }

  findByPath(path: string): Workspace | null {
    const row = this.db.prepare('SELECT * FROM workspaces WHERE repository_path = ?').get(path) as
      WorkspaceRow | undefined;

    if (!row) return null;
    return rowToWorkspace(row);
  }

  save(workspace: Workspace): void {
    const row = workspaceToRow(workspace);
    const existing = this.findById(workspace.id);

    if (existing) {
      this.db
        .prepare(
          `
        UPDATE workspaces
        SET display_name = ?, repository_path = ?, created_at = ?, last_opened_at = ?
        WHERE id = ?
      `,
        )
        .run(row.display_name, row.repository_path, row.created_at, row.last_opened_at, row.id);
    } else {
      this.db
        .prepare(
          `
        INSERT INTO workspaces (id, display_name, repository_path, created_at, last_opened_at)
        VALUES (?, ?, ?, ?, ?)
      `,
        )
        .run(row.id, row.display_name, row.repository_path, row.created_at, row.last_opened_at);
    }
  }

  delete(id: WorkspaceId): void {
    this.db.prepare('DELETE FROM workspaces WHERE id = ?').run(id.value);
  }
}
