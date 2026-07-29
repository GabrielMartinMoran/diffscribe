import { randomUUID } from 'node:crypto';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class WorkspaceId {
  public readonly value: string;

  constructor(value: string) {
    if (!value || typeof value !== 'string') {
      throw new Error('WorkspaceId must be a non-empty string');
    }
    if (!UUID_PATTERN.test(value)) {
      throw new Error(`Invalid WorkspaceId: "${value}" is not a valid UUID`);
    }
    this.value = value;
  }

  static generate(): WorkspaceId {
    return new WorkspaceId(randomUUID());
  }

  equals(other: WorkspaceId): boolean {
    return this.value === other.value;
  }
}
