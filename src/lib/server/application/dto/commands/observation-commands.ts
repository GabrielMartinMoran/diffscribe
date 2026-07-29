import type {
  ObservationSeverity,
  ObservationType,
} from '$lib/server/domain/value-objects/observation-enums';

export interface CreateObservationCommand {
  reviewId: string;
  type: ObservationType;
  severity?: ObservationSeverity | null;
  title: string;
  body?: string;
  agentInstruction?: string;
  filePath?: string | null;
  side?: string;
  lineRangeStart?: number | null;
  lineRangeEnd?: number | null;
  comparisonSnapshotJson: string;
  diffSnapshot?: string | null;
  contentHash?: string | null;
}

export interface UpdateObservationCommand {
  observationId: string;
  title?: string;
  body?: string;
  agentInstruction?: string;
}

export interface TransitionObservationStatusCommand {
  observationId: string;
  status: string;
}

export interface GetObservationQuery {
  observationId: string;
}

export interface ListObservationsQuery {
  reviewId: string;
}

export interface DeleteObservationCommand {
  observationId: string;
}
