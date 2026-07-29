export class ObservationNotFoundError extends Error {
  constructor(id: string) {
    super(`Observation not found: ${id}`);
    this.name = 'ObservationNotFoundError';
  }
}

export class ObservationNotOwnedByReviewError extends Error {
  constructor(observationId: string, reviewId: string) {
    super(`Observation ${observationId} does not belong to review ${reviewId}`);
    this.name = 'ObservationNotOwnedByReviewError';
  }
}

export class ReviewReadOnlyError extends Error {
  constructor(reviewId: string) {
    super(`Review ${reviewId} is completed and read-only`);
    this.name = 'ReviewReadOnlyError';
  }
}

export class InvalidObservationTransitionError extends Error {
  constructor(from: string, to: string) {
    super(`Cannot transition observation from "${from}" to "${to}"`);
    this.name = 'InvalidObservationTransitionError';
  }
}
