import { describe, expect, it } from 'vitest';

import { RepositoryPath } from '../../../../src/lib/server/domain/value-objects/repository-path';

describe('RepositoryPath', () => {
  it('creates a RepositoryPath with a valid absolute path', () => {
    const rp = new RepositoryPath('/home/user/my-repo');
    expect(rp.value).toBe('/home/user/my-repo');
  });

  it('normalizes a path with trailing slash', () => {
    const rp = new RepositoryPath('/home/user/my-repo/');
    expect(rp.value).toBe('/home/user/my-repo');
  });

  it('normalizes a path with double slashes', () => {
    const rp = new RepositoryPath('/home/user//my-repo');
    expect(rp.value).toBe('/home/user/my-repo');
  });

  it('normalizes a path with dot segments', () => {
    const rp = new RepositoryPath('/home/user/./my-repo');
    expect(rp.value).toBe('/home/user/my-repo');
  });

  it('throws for an empty path', () => {
    expect(() => new RepositoryPath('')).toThrow();
  });

  it('throws for a relative path', () => {
    expect(() => new RepositoryPath('my-repo')).toThrow();
  });

  it('throws for a non-string value', () => {
    expect(() => new RepositoryPath(null as unknown as string)).toThrow();
  });

  it('two RepositoryPaths with the same value are equal', () => {
    const rp1 = new RepositoryPath('/home/user/repo');
    const rp2 = new RepositoryPath('/home/user/repo');
    expect(rp1.equals(rp2)).toBe(true);
  });

  it('two RepositoryPaths with different values are not equal', () => {
    const rp1 = new RepositoryPath('/home/user/repo-a');
    const rp2 = new RepositoryPath('/home/user/repo-b');
    expect(rp1.equals(rp2)).toBe(false);
  });
});
