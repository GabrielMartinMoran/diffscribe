import { describe, expect, it } from 'vitest';

import {
  InvalidObservationTransitionError,
  ObservationNotFoundError,
  ObservationNotOwnedByReviewError,
  ReviewReadOnlyError,
} from '$lib/server/domain/errors/observation-errors';

describe('Observation errors', () => {
  it('ObservationNotFoundError includes the id', () => {
    const err = new ObservationNotFoundError('obs-1');
    expect(err.message).toBe('Observation not found: obs-1');
    expect(err.name).toBe('ObservationNotFoundError');
  });

  it('ObservationNotOwnedByReviewError includes both ids', () => {
    const err = new ObservationNotOwnedByReviewError('obs-1', 'rev-1');
    expect(err.message).toBe('Observation obs-1 does not belong to review rev-1');
    expect(err.name).toBe('ObservationNotOwnedByReviewError');
  });

  it('ReviewReadOnlyError includes the review id', () => {
    const err = new ReviewReadOnlyError('rev-1');
    expect(err.message).toBe('Review rev-1 is completed and read-only');
    expect(err.name).toBe('ReviewReadOnlyError');
  });

  it('InvalidObservationTransitionError includes the from and to statuses', () => {
    const err = new InvalidObservationTransitionError('resolved', 'resolved');
    expect(err.message).toBe('Cannot transition observation from "resolved" to "resolved"');
    expect(err.name).toBe('InvalidObservationTransitionError');
  });
});
