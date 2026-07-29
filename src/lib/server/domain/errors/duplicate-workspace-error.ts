export class DuplicateWorkspaceError extends Error {
  public readonly path: string;

  constructor(path: string) {
    super(`Workspace with path "${path}" is already registered`);
    this.name = 'DuplicateWorkspaceError';
    this.path = path;
  }
}
