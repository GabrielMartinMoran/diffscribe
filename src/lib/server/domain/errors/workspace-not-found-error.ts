export class WorkspaceNotFoundError extends Error {
  public readonly id: string;

  constructor(id: string) {
    super(`Workspace with id "${id}" not found`);
    this.name = 'WorkspaceNotFoundError';
    this.id = id;
  }
}
