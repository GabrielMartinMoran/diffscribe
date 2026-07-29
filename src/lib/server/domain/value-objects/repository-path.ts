import path from 'node:path';

export class RepositoryPath {
  public readonly value: string;

  constructor(value: string) {
    if (typeof value !== 'string' || value.trim() === '') {
      throw new Error('RepositoryPath must be a non-empty string');
    }

    if (!path.isAbsolute(value)) {
      throw new Error(`RepositoryPath must be an absolute path, got: "${value}"`);
    }

    this.value = path.normalize(value).replace(/\/+$/, '') || '/';
  }

  equals(other: RepositoryPath): boolean {
    return this.value === other.value;
  }
}
