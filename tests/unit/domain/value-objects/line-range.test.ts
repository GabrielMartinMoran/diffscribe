import { describe, expect, it } from 'vitest';

import { LineRange } from '$lib/server/domain/value-objects/line-range';

describe('LineRange', () => {
  it('creates a valid range with start <= end', () => {
    const range = new LineRange(10, 15);
    expect(range.start).toBe(10);
    expect(range.end).toBe(15);
  });

  it('allows a single-line range', () => {
    const range = new LineRange(5, 5);
    expect(range.start).toBe(5);
    expect(range.end).toBe(5);
  });

  it('rejects a range where end < start', () => {
    expect(() => new LineRange(15, 10)).toThrow('endLine must be >= startLine');
  });

  it('rejects a negative start line', () => {
    expect(() => new LineRange(-1, 5)).toThrow('startLine must be >= 1');
  });

  it('rejects a zero start line', () => {
    expect(() => new LineRange(0, 5)).toThrow('startLine must be >= 1');
  });
});
