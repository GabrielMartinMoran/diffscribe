import { describe, expect, it } from 'vitest';

import { WorkspaceId } from '../../../../src/lib/server/domain/value-objects/workspace-id';

describe('WorkspaceId', () => {
  it('creates an id with a given value', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    const id = new WorkspaceId(uuid);
    expect(id.value).toBe(uuid);
  });

  it('generates a valid UUID when created without a value', () => {
    const id = WorkspaceId.generate();
    expect(id.value).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('generates unique IDs on each call', () => {
    const id1 = WorkspaceId.generate();
    const id2 = WorkspaceId.generate();
    expect(id1.value).not.toBe(id2.value);
  });

  it('two WorkspaceIds with the same value are equal', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    const id1 = new WorkspaceId(uuid);
    const id2 = new WorkspaceId(uuid);
    expect(id1.equals(id2)).toBe(true);
  });

  it('two WorkspaceIds with different values are not equal', () => {
    const id1 = new WorkspaceId('550e8400-e29b-41d4-a716-446655440000');
    const id2 = new WorkspaceId('550e8400-e29b-41d4-a716-446655440001');
    expect(id1.equals(id2)).toBe(false);
  });

  it('throws for an empty string', () => {
    expect(() => new WorkspaceId('')).toThrow();
  });

  it('throws for a non-UUID string', () => {
    expect(() => new WorkspaceId('not-a-uuid')).toThrow();
  });
});
