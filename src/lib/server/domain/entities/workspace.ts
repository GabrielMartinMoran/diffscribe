import type { RepositoryPath } from '$lib/server/domain/value-objects/repository-path';
import type { WorkspaceId } from '$lib/server/domain/value-objects/workspace-id';

export interface WorkspaceProps {
  id: WorkspaceId;
  displayName: string;
  repositoryPath: RepositoryPath;
  createdAt: Date;
  lastOpenedAt: Date;
}

export class Workspace {
  public readonly id: WorkspaceId;
  private _displayName: string;
  public readonly repositoryPath: RepositoryPath;
  public readonly createdAt: Date;
  private _lastOpenedAt: Date;

  constructor(props: WorkspaceProps) {
    const trimmed = props.displayName.trim();

    if (trimmed.length === 0) {
      throw new Error('displayName must not be empty');
    }
    if (trimmed.length > 200) {
      throw new Error('displayName must not exceed 200 characters');
    }

    this.id = props.id;
    this._displayName = trimmed;
    this.repositoryPath = props.repositoryPath;
    this.createdAt = new Date(props.createdAt);
    this._lastOpenedAt = new Date(props.lastOpenedAt);
  }

  get displayName(): string {
    return this._displayName;
  }

  get lastOpenedAt(): Date {
    return new Date(this._lastOpenedAt);
  }

  rename(newDisplayName: string): void {
    const trimmed = newDisplayName.trim();

    if (trimmed.length === 0) {
      throw new Error('displayName must not be empty');
    }
    if (trimmed.length > 200) {
      throw new Error('displayName must not exceed 200 characters');
    }

    this._displayName = trimmed;
  }
}
