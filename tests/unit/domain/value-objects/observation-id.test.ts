import { describe, expect, it } from 'vitest';

import { ObservationId } from '$lib/server/domain/value-objects/observation-id';

describe('ObservationId', () => {
  it('accepts a valid UUID v4', () => {
    const id = new ObservationId('550e8400-e29b-41d4-a716-446655440000');
    expect(id.value).toBe('550e8400-e29b-41d4-a716-446655440000');
  });

  it('generates a UUID v4', () => {
    const id = ObservationId.generate();
    expect(id.value).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('rejects an empty string', () => {
    expect(() => new ObservationId('')).toThrow('ObservationId must be a non-empty string');
  });

  it('rejects an invalid UUID format', () => {
    expect(() => new ObservationId('not-a-uuid')).toThrow(/Invalid ObservationId/);
  });

  it('equals another ObservationId with the same value', () => {
    const a = new ObservationId('550e8400-e29b-41d4-a716-446655440000');
    const b = new ObservationId('550e8400-e29b-41d4-a716-446655440000');
    expect(a.equals(b)).toBe(true);
  });

  it('does not equal an ObservationId with a different value', () => {
    const a = new ObservationId('550e8400-e29b-41d4-a716-446655440000');
    const b = new ObservationId('660e8400-e29b-41d4-a716-446655440111');
    expect(a.equals(b)).toBe(false);
  });
});
