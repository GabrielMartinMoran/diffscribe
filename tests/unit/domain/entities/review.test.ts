import { describe, expect, it } from 'vitest';

import { Review, ReviewStatus } from '../../../../src/lib/server/domain/entities/review';
import {
  Comparison,
  ComparisonType,
} from '../../../../src/lib/server/domain/value-objects/comparison';
import { GitRef } from '../../../../src/lib/server/domain/value-objects/git-ref';
import { ReviewId } from '../../../../src/lib/server/domain/value-objects/review-id';
import { WorkspaceId } from '../../../../src/lib/server/domain/value-objects/workspace-id';

function makeComparison(): Comparison {
  return new Comparison({
    base: new GitRef('head', 'HEAD'),
    target: new GitRef('working-tree', 'working-tree'),
    comparisonType: ComparisonType.WORKING_TREE_VS_HEAD,
  });
}

describe('Review', () => {
  const id = ReviewId.generate();
  const workspaceId = WorkspaceId.generate();
  const comparison = makeComparison();

  it('creates a review with draft status by default', () => {
    const review = new Review({
      id,
      workspaceId,
      comparison,
    });
    expect(review.id).toBe(id);
    expect(review.workspaceId).toBe(workspaceId);
    expect(review.status).toBe(ReviewStatus.DRAFT);
    expect(review.comparison).toBe(comparison);
    expect(review.title).toBeNull();
    expect(review.createdAt).toBeInstanceOf(Date);
    expect(review.updatedAt).toBeInstanceOf(Date);
    expect(review.completedAt).toBeNull();
  });

  it('accepts an optional title', () => {
    const review = new Review({
      id,
      workspaceId,
      comparison,
      title: 'My Review',
    });
    expect(review.title).toBe('My Review');
  });

  it('title is trimmed and null when empty', () => {
    const review1 = new Review({
      id,
      workspaceId,
      comparison,
      title: '',
    });
    expect(review1.title).toBeNull();

    const review2 = new Review({
      id,
      workspaceId,
      comparison,
      title: '  ',
    });
    expect(review2.title).toBeNull();
  });

  describe('complete', () => {
    it('transitions from draft to completed', () => {
      const review = new Review({ id, workspaceId, comparison });
      review.complete();
      expect(review.status).toBe(ReviewStatus.COMPLETED);
    });

    it('sets completedAt timestamp', () => {
      const review = new Review({ id, workspaceId, comparison });
      expect(review.completedAt).toBeNull();
      review.complete();
      expect(review.completedAt).toBeInstanceOf(Date);
    });

    it('throws when already completed', () => {
      const review = new Review({ id, workspaceId, comparison });
      review.complete();
      expect(() => review.complete()).toThrow(/already completed/);
    });

    it('sets updatedAt on completion', () => {
      const review = new Review({ id, workspaceId, comparison });
      const before = review.updatedAt;
      review.complete();
      expect(review.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });
  });

  describe('isReadOnly', () => {
    it('draft is not read-only', () => {
      const review = new Review({ id, workspaceId, comparison });
      expect(review.isReadOnly).toBe(false);
    });

    it('completed is read-only', () => {
      const review = new Review({ id, workspaceId, comparison });
      review.complete();
      expect(review.isReadOnly).toBe(true);
    });
  });

  describe('reopen', () => {
    it('reopened review stays completed', () => {
      const review = new Review({ id, workspaceId, comparison });
      review.complete();
      review.reopen();
      expect(review.status).toBe(ReviewStatus.COMPLETED);
    });

    it('reopen sets updatedAt', () => {
      const review = new Review({ id, workspaceId, comparison });
      review.complete();
      const before = review.updatedAt;
      review.reopen();
      expect(review.updatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });
  });
});
