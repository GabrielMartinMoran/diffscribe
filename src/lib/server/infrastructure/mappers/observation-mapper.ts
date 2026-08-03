import { Observation } from '$lib/server/domain/entities/observation';
import { LineRange } from '$lib/server/domain/value-objects/line-range';
import type { ObservationStatus } from '$lib/server/domain/value-objects/observation-enums';
import {
  ObservationOrigin,
  ObservationSeverity,
  ObservationType,
} from '$lib/server/domain/value-objects/observation-enums';
import { ObservationId } from '$lib/server/domain/value-objects/observation-id';
import { ReviewId } from '$lib/server/domain/value-objects/review-id';

export interface ObservationRow {
  id: string;
  review_id: string;
  type: string;
  severity: string | null;
  origin: string;
  status: string;
  body: string;
  agent_instruction: string;
  file_path: string | null;
  side: string;
  line_start: number | null;
  line_end: number | null;
  comparison_snapshot_json: string;
  diff_snapshot: string | null;
  content_hash: string | null;
  created_at: string;
  updated_at: string;
}

export function toRow(observation: Observation): ObservationRow {
  return {
    id: observation.id.value,
    review_id: observation.reviewId.value,
    type: observation.type,
    severity: observation.severity ?? null,
    origin: observation.origin,
    status: observation.status,
    body: observation.body,
    agent_instruction: observation.agentInstruction,
    file_path: observation.filePath,
    side: observation.side,
    line_start: observation.lineRange?.start ?? null,
    line_end: observation.lineRange?.end ?? null,
    comparison_snapshot_json: observation.comparisonSnapshotJson,
    diff_snapshot: observation.diffSnapshot,
    content_hash: observation.contentHash,
    created_at: observation.createdAt.toISOString(),
    updated_at: observation.updatedAt.toISOString(),
  };
}

export function toDomain(row: ObservationRow): Observation {
  const lineRange =
    row.line_start !== null && row.line_end !== null
      ? new LineRange(row.line_start, row.line_end)
      : null;

  const obs = new Observation({
    id: new ObservationId(row.id),
    reviewId: new ReviewId(row.review_id),
    type: row.type as ObservationType,
    severity: row.severity ? (row.severity as ObservationSeverity) : null,
    origin: row.origin as ObservationOrigin,
    body: row.body,
    agentInstruction: row.agent_instruction,
    filePath: row.file_path,
    lineRange,
    side: row.side,
    comparisonSnapshotJson: row.comparison_snapshot_json,
    diffSnapshot: row.diff_snapshot,
    contentHash: row.content_hash,
  });

  // Restore mutable state from DB (bypassing constructor defaults)
  const _obs = obs as unknown as {
    _status: ObservationStatus;
    _updatedAt: Date;
    createdAt: Date;
  };
  _obs._status = row.status as ObservationStatus;
  _obs._updatedAt = new Date(row.updated_at);
  _obs.createdAt = new Date(row.created_at);

  return obs;
}
