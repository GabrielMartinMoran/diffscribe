import type {
  ObservationSeverity,
  ObservationStatus,
  ObservationType,
} from '$lib/server/domain/value-objects/observation-enums';

export interface ObservationResult {
  id: string;
  reviewId: string;
  type: ObservationType;
  severity: ObservationSeverity | null;
  origin: string;
  status: ObservationStatus;
  body: string;
  agentInstruction: string;
  filePath: string | null;
  side: string;
  lineStart: number | null;
  lineEnd: number | null;
  comparisonSnapshotJson: string;
  diffSnapshot: string | null;
  contentHash: string | null;
  createdAt: string;
  updatedAt: string;
}
