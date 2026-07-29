import { Observation } from '$lib/server/domain/entities/observation';
import {
  ObservationNotFoundError,
  ReviewReadOnlyError,
} from '$lib/server/domain/errors/observation-errors';

const BINARY_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.bmp',
  '.ico',
  '.webp',
  '.pdf',
  '.zip',
  '.gz',
  '.tar',
  '.exe',
  '.dll',
  '.so',
  '.bin',
  '.mp3',
  '.mp4',
  '.avi',
  '.mov',
  '.wav',
  '.ttf',
  '.woff',
  '.woff2',
]);

function isBinaryFilePath(filePath: string | null | undefined): boolean {
  if (!filePath) return false;
  const ext = filePath.substring(filePath.lastIndexOf('.')).toLowerCase();
  return BINARY_EXTENSIONS.has(ext);
}
import type { ObservationRepository } from '$lib/server/domain/repositories/observation-repository';
import type { ReviewRepository } from '$lib/server/domain/repositories/review-repository';
import { LineRange } from '$lib/server/domain/value-objects/line-range';
import { ObservationId } from '$lib/server/domain/value-objects/observation-id';
import { ReviewId } from '$lib/server/domain/value-objects/review-id';

import type { CreateObservationCommand } from '../dto/commands/observation-commands';
import type { ObservationResult } from '../dto/results/observation-results';

export class CreateObservationUseCase {
  constructor(
    private readonly observationRepository: ObservationRepository,
    private readonly reviewRepository: ReviewRepository,
  ) {}

  async execute(command: CreateObservationCommand): Promise<ObservationResult> {
    const reviewId = new ReviewId(command.reviewId);

    const review = await this.reviewRepository.findById(reviewId);
    if (!review) {
      throw new Error(`Review ${command.reviewId} not found`);
    }

    if (review.isReadOnly) {
      throw new ReviewReadOnlyError(command.reviewId);
    }

    // Reject range observations on binary files
    const hasLineRange =
      command.lineRangeStart !== null &&
      command.lineRangeStart !== undefined &&
      command.lineRangeEnd !== null &&
      command.lineRangeEnd !== undefined;
    if (hasLineRange && isBinaryFilePath(command.filePath)) {
      throw new Error('Range observations are not allowed on binary files');
    }

    const lineRange = hasLineRange
      ? new LineRange(command.lineRangeStart!, command.lineRangeEnd!)
      : null;

    const observation = new Observation({
      id: ObservationId.generate(),
      reviewId,
      type: command.type,
      severity: command.severity,
      title: command.title,
      body: command.body,
      agentInstruction: command.agentInstruction,
      filePath: command.filePath,
      side: command.side,
      lineRange,
      comparisonSnapshotJson: command.comparisonSnapshotJson,
      diffSnapshot: command.diffSnapshot,
      contentHash: command.contentHash,
    });

    await this.observationRepository.save(observation);

    return toResult(observation);
  }
}

export class GetObservationUseCase {
  constructor(
    private readonly observationRepository: ObservationRepository,
    private readonly reviewRepository: ReviewRepository,
  ) {}

  async execute(observationId: string): Promise<ObservationResult> {
    const id = new ObservationId(observationId);
    const observation = await this.observationRepository.findById(id);

    if (!observation) {
      throw new ObservationNotFoundError(observationId);
    }

    return toResult(observation);
  }
}

export class ListObservationsUseCase {
  constructor(
    private readonly observationRepository: ObservationRepository,
    private readonly reviewRepository: ReviewRepository,
  ) {}

  async execute(reviewId: string): Promise<ObservationResult[]> {
    const rid = new ReviewId(reviewId);

    const review = await this.reviewRepository.findById(rid);
    if (!review) {
      throw new Error(`Review ${reviewId} not found`);
    }

    const observations = await this.observationRepository.findByReviewId(rid);
    return observations.map(toResult);
  }
}

export class UpdateObservationUseCase {
  constructor(
    private readonly observationRepository: ObservationRepository,
    private readonly reviewRepository: ReviewRepository,
  ) {}

  async execute(
    observationId: string,
    update: { title?: string; body?: string; agentInstruction?: string },
  ): Promise<ObservationResult> {
    const id = new ObservationId(observationId);
    const observation = await this.observationRepository.findById(id);

    if (!observation) {
      throw new ObservationNotFoundError(observationId);
    }

    const review = await this.reviewRepository.findById(observation.reviewId);
    if (review?.isReadOnly) {
      throw new ReviewReadOnlyError(observation.reviewId.value);
    }

    if (update.title !== undefined) {
      observation.editTitle(update.title);
    }
    if (update.body !== undefined) {
      observation.editBody(update.body);
    }
    if (update.agentInstruction !== undefined) {
      observation.editAgentInstruction(update.agentInstruction);
    }

    await this.observationRepository.save(observation);

    return toResult(observation);
  }
}

export class DeleteObservationUseCase {
  constructor(
    private readonly observationRepository: ObservationRepository,
    private readonly reviewRepository: ReviewRepository,
  ) {}

  async execute(observationId: string): Promise<void> {
    const id = new ObservationId(observationId);
    const observation = await this.observationRepository.findById(id);

    if (!observation) {
      throw new ObservationNotFoundError(observationId);
    }

    const review = await this.reviewRepository.findById(observation.reviewId);
    if (review?.isReadOnly) {
      throw new ReviewReadOnlyError(observation.reviewId.value);
    }

    await this.observationRepository.delete(id);
  }
}

export class TransitionObservationStatusUseCase {
  constructor(
    private readonly observationRepository: ObservationRepository,
    private readonly reviewRepository: ReviewRepository,
  ) {}

  async execute(observationId: string, newStatus: string): Promise<ObservationResult> {
    const id = new ObservationId(observationId);
    const observation = await this.observationRepository.findById(id);

    if (!observation) {
      throw new ObservationNotFoundError(observationId);
    }

    const review = await this.reviewRepository.findById(observation.reviewId);
    if (review?.isReadOnly) {
      throw new ReviewReadOnlyError(observation.reviewId.value);
    }

    switch (newStatus) {
      case 'resolved':
        observation.resolve();
        break;
      case 'dismissed':
        observation.dismiss();
        break;
      case 'pending':
        observation.markPending();
        break;
      case 'open':
        observation.reopen();
        break;
      default:
        throw new Error(`Invalid observation status: "${newStatus}"`);
    }

    await this.observationRepository.save(observation);

    return toResult(observation);
  }
}

function toResult(obs: Observation): ObservationResult {
  return {
    id: obs.id.value,
    reviewId: obs.reviewId.value,
    type: obs.type,
    severity: obs.severity,
    origin: obs.origin,
    status: obs.status,
    title: obs.title,
    body: obs.body,
    agentInstruction: obs.agentInstruction,
    filePath: obs.filePath,
    side: obs.side,
    lineStart: obs.lineRange?.start ?? null,
    lineEnd: obs.lineRange?.end ?? null,
    comparisonSnapshotJson: obs.comparisonSnapshotJson,
    diffSnapshot: obs.diffSnapshot,
    contentHash: obs.contentHash,
    createdAt: obs.createdAt.toISOString(),
    updatedAt: obs.updatedAt.toISOString(),
  };
}
