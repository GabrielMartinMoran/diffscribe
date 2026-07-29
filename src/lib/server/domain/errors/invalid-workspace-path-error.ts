export class InvalidWorkspacePathError extends Error {
  public readonly path: string;

  constructor(path: string, reason: string) {
    super(`Invalid workspace path "${path}": ${reason}`);
    this.name = 'InvalidWorkspacePathError';
    this.path = path;
  }
}
