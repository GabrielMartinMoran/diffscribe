import { describe, expect, it } from 'vitest';

import {
  canonicalizeForHash,
  computeContentHash,
} from '$lib/server/infrastructure/hash/content-hasher';

describe('ContentHasher', () => {
  it('computes a deterministic SHA-256 hash', () => {
    const hash1 = computeContentHash('src/app.ts', 'new', 10, '+added\n-removed\n unchanged');
    const hash2 = computeContentHash('src/app.ts', 'new', 10, '+added\n-removed\n unchanged');
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces different hashes for different content', () => {
    const hash1 = computeContentHash('src/app.ts', 'new', 10, '+added\n unchanged');
    const hash2 = computeContentHash('src/app.ts', 'new', 10, '+removed\n unchanged');
    expect(hash1).not.toBe(hash2);
  });

  it('produces different hashes for different file paths', () => {
    const hash1 = computeContentHash('src/a.ts', 'new', 10, 'content');
    const hash2 = computeContentHash('src/b.ts', 'new', 10, 'content');
    expect(hash1).not.toBe(hash2);
  });

  it('produces different hashes for different sides', () => {
    const hash1 = computeContentHash('src/app.ts', 'new', 10, 'content');
    const hash2 = computeContentHash('src/app.ts', 'old', 10, 'content');
    expect(hash1).not.toBe(hash2);
  });

  it('normalizes CRLF to LF before hashing', () => {
    const hashLF = computeContentHash('src/app.ts', 'new', 1, 'line1\nline2');
    const hashCRLF = computeContentHash('src/app.ts', 'new', 1, 'line1\r\nline2');
    expect(hashLF).toBe(hashCRLF);
  });

  it('produces consistent hash when content has no trailing newline', () => {
    const hash = computeContentHash('src/app.ts', 'new', 1, 'single line');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('canonicalizes with correct input format', () => {
    const canonical = canonicalizeForHash('src/app.ts', 'new', 10, '+added\n unchanged');
    expect(canonical).toBe('src/app.ts:new:10:+added\n unchanged');
  });

  it('canonicalizeForHash normalizes CRLF', () => {
    const canonical = canonicalizeForHash('src/app.ts', 'new', 1, 'a\r\nb');
    expect(canonical).toBe('src/app.ts:new:1:a\nb');
  });
});
