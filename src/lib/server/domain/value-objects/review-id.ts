import { randomUUID } from 'node:crypto';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class ReviewId {
  public readonly value: string;

  constructor(value: string) {
    if (!value || typeof value !== 'string') {
      throw new Error('ReviewId must be a non-empty string');
    }
    if (!UUID_PATTERN.test(value)) {
      throw new Error(`Invalid ReviewId: "${value}" is not a valid UUID`);
    }
    this.value = value;
  }

  static generate(): ReviewId {
    return new ReviewId(randomUUID());
  }

  equals(other: ReviewId): boolean {
    return this.value === other.value;
  }
}
