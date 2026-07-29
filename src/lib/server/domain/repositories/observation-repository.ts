import type { Observation } from '../entities/observation';
import type { ObservationId } from '../value-objects/observation-id';
import type { ReviewId } from '../value-objects/review-id';

export interface ObservationRepository {
  save(observation: Observation): Promise<void>;
  findById(id: ObservationId): Promise<Observation | null>;
  findByReviewId(reviewId: ReviewId): Promise<Observation[]>;
  delete(id: ObservationId): Promise<void>;
  deleteByReviewId(reviewId: ReviewId): Promise<void>;
  countByReviewId(reviewId: ReviewId): Promise<number>;
}
