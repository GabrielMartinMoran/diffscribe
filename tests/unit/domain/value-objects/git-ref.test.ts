import { describe, expect, it } from 'vitest';

import { GitRef } from '../../../../src/lib/server/domain/value-objects/git-ref';

describe('GitRef (domain value object)', () => {
  it('accepts a branch type with a name', () => {
    const ref = new GitRef('branch', 'main');
    expect(ref.type).toBe('branch');
    expect(ref.value).toBe('main');
  });

  it('accepts a commit type with a hash', () => {
    const ref = new GitRef('commit', 'abc1234');
    expect(ref.type).toBe('commit');
    expect(ref.value).toBe('abc1234');
  });

  it('accepts a head type with reserved string "HEAD"', () => {
    const ref = new GitRef('head', 'HEAD');
    expect(ref.type).toBe('head');
    expect(ref.value).toBe('HEAD');
  });

  it('accepts a working-tree type', () => {
    const ref = new GitRef('working-tree', 'working-tree');
    expect(ref.type).toBe('working-tree');
  });

  it('accepts an index type', () => {
    const ref = new GitRef('index', 'staged');
    expect(ref.type).toBe('index');
  });

  it('rejects an invalid type', () => {
    expect(() => new GitRef('unknown' as never, 'foo')).toThrow();
  });

  it('rejects an empty branch name', () => {
    expect(() => new GitRef('branch', '')).toThrow();
  });

  it('rejects an empty commit hash', () => {
    expect(() => new GitRef('commit', '')).toThrow();
  });

  it('equals compares by type and value', () => {
    const a = new GitRef('branch', 'main');
    const b = new GitRef('branch', 'main');
    const c = new GitRef('branch', 'develop');
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
  });

  it('provides a serializable representation {type, value, label}', () => {
    const ref = new GitRef('branch', 'feat/login');
    const serialized = ref.toJSON();
    expect(serialized).toEqual({ type: 'branch', value: 'feat/login', label: 'feat/login' });
  });
});
