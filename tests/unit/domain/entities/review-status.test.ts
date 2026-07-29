import { describe, expect, it } from 'vitest';

import { ReviewStatus } from '../../../../src/lib/server/domain/entities/review';

describe('ReviewStatus', () => {
  it('has four defined values', () => {
    expect(ReviewStatus.DRAFT).toBe('draft');
    expect(ReviewStatus.IN_PROGRESS).toBe('in_progress');
    expect(ReviewStatus.COMPLETED).toBe('completed');
    expect(ReviewStatus.ARCHIVED).toBe('archived');
  });

  it('is immutable set of values', () => {
    const values = Object.values(ReviewStatus);
    expect(values).toHaveLength(4);
    expect(values).toContain('draft');
    expect(values).toContain('in_progress');
    expect(values).toContain('completed');
    expect(values).toContain('archived');
  });
});
