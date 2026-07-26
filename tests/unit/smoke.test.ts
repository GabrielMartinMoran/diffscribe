import { describe, expect, it } from 'vitest';

describe('smoke — unit', () => {
  it('arithmetic works', () => {
    expect(2 + 3).toBe(5);
  });

  it('true is truthy', () => {
    expect(true).toBe(true);
  });
});
