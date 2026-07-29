import { describe, expect, it } from 'vitest';

import { ReviewId } from '../../../../src/lib/server/domain/value-objects/review-id';

describe('ReviewId', () => {
  it('creates an id with a given UUID value', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    const id = new ReviewId(uuid);
    expect(id.value).toBe(uuid);
  });

  it('generates a valid UUID v4', () => {
    const id = ReviewId.generate();
    expect(id.value).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('generates unique IDs on each call', () => {
    const id1 = ReviewId.generate();
    const id2 = ReviewId.generate();
    expect(id1.value).not.toBe(id2.value);
  });

  it('two ReviewIds with the same value are equal', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    const id1 = new ReviewId(uuid);
    const id2 = new ReviewId(uuid);
    expect(id1.equals(id2)).toBe(true);
  });

  it('two ReviewIds with different values are not equal', () => {
    const id1 = new ReviewId('550e8400-e29b-41d4-a716-446655440000');
    const id2 = new ReviewId('550e8400-e29b-41d4-a716-446655440001');
    expect(id1.equals(id2)).toBe(false);
  });

  it('throws for an empty string', () => {
    expect(() => new ReviewId('')).toThrow();
  });

  it('throws for a non-UUID string', () => {
    expect(() => new ReviewId('not-a-uuid')).toThrow();
  });
});
