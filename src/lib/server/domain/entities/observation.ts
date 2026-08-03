import { InvalidObservationTransitionError } from '../errors/observation-errors';
import type { LineRange } from '../value-objects/line-range';
import {
  ObservationOrigin,
  ObservationSeverity,
  ObservationStatus,
  ObservationType,
} from '../value-objects/observation-enums';
import type { ObservationId } from '../value-objects/observation-id';
import type { ReviewId } from '../value-objects/review-id';

export interface ObservationProps {
  id: ObservationId;
  reviewId: ReviewId;
  type: ObservationType;
  severity?: ObservationSeverity | null;
  origin?: ObservationOrigin;
  status?: ObservationStatus;
  body: string;
  agentInstruction?: string;
  filePath?: string | null;
  lineRange?: LineRange | null;
  side?: string;
  comparisonSnapshotJson: string;
  diffSnapshot?: string | null;
  contentHash?: string | null;
}

const VALID_SIDES = new Set(['new', 'old']);
const REOPENABLE_STATUSES = new Set([
  ObservationStatus.RESOLVED,
  ObservationStatus.DISMISSED,
  ObservationStatus.PENDING,
]);

export class Observation {
  public readonly id: ObservationId;
  public readonly reviewId: ReviewId;
  public readonly type: ObservationType;
  public readonly severity: ObservationSeverity | null;
  public readonly origin: ObservationOrigin;
  public readonly filePath: string | null;
  public readonly lineRange: LineRange | null;
  public readonly side: string;
  public readonly comparisonSnapshotJson: string;
  public readonly diffSnapshot: string | null;
  public readonly contentHash: string | null;
  public readonly createdAt: Date;

  private _status: ObservationStatus;
  private _body: string;
  private _agentInstruction: string;
  private _updatedAt: Date;

  constructor(props: ObservationProps) {
    this.id = props.id;
    this.reviewId = props.reviewId;
    this.type = props.type;
    this.origin = props.origin ?? ObservationOrigin.HUMAN;
    this.createdAt = new Date();
    this._updatedAt = new Date();

    // Side validation and default
    const rawSide = props.side ?? 'new';
    if (!VALID_SIDES.has(rawSide)) {
      throw new Error('side must be "new" or "old"');
    }
    this.side = rawSide;

    // Severity rules
    this.severity = this.validateSeverity(props.type, props.severity);

    // Body validation (single mandatory description field)
    this._body = (props.body ?? '').trim();
    this.validateBody(this._body);

    // Agent instruction validation
    this._agentInstruction = (props.agentInstruction ?? '').trim();
    this.validateAgentInstruction(this._agentInstruction);

    // File and snapshot validation
    this.filePath = this.validateFilePath(props.filePath);
    this.lineRange = this.validateLineRange(props.lineRange, this.filePath);
    this.diffSnapshot = this.validateDiffSnapshot(props.diffSnapshot, this.filePath);
    this.contentHash = this.validateContentHash(props.contentHash, this.filePath);

    // Comparison snapshot
    this.comparisonSnapshotJson = props.comparisonSnapshotJson;

    // Status
    this._status = props.status ?? ObservationStatus.OPEN;
  }

  get body(): string {
    return this._body;
  }

  get agentInstruction(): string {
    return this._agentInstruction;
  }

  get status(): ObservationStatus {
    return this._status;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  editBody(newBody: string): void {
    this._body = (newBody ?? '').trim();
    this.validateBody(this._body);
    this._updatedAt = new Date();
  }

  editAgentInstruction(newInstruction: string): void {
    this._agentInstruction = (newInstruction ?? '').trim();
    this.validateAgentInstruction(this._agentInstruction);
    this._updatedAt = new Date();
  }

  resolve(): void {
    this.transitionTo(ObservationStatus.RESOLVED);
  }

  dismiss(): void {
    this.transitionTo(ObservationStatus.DISMISSED);
  }

  markPending(): void {
    this.transitionTo(ObservationStatus.PENDING);
  }

  reopen(): void {
    if (!REOPENABLE_STATUSES.has(this._status)) {
      throw new InvalidObservationTransitionError(this._status, ObservationStatus.OPEN);
    }
    this._status = ObservationStatus.OPEN;
    this._updatedAt = new Date();
  }

  private transitionTo(target: ObservationStatus): void {
    if (this._status !== ObservationStatus.OPEN) {
      throw new InvalidObservationTransitionError(this._status, target);
    }
    this._status = target;
    this._updatedAt = new Date();
  }

  private validateSeverity(
    type: ObservationType,
    severity: ObservationSeverity | null | undefined,
  ): ObservationSeverity | null {
    if (
      (type === ObservationType.ISSUE || type === ObservationType.RISK) &&
      (severity === null || severity === undefined)
    ) {
      throw new Error(`${type} requires a severity`);
    }
    if (type === ObservationType.PRAISE && (severity === undefined || severity === null)) {
      return null;
    }
    return severity ?? null;
  }

  private validateBody(body: string): void {
    if (body.length === 0) {
      throw new Error('body must not be empty');
    }
    if (body.length > 5000) {
      throw new Error('body exceeds 5000 characters');
    }
  }

  private validateAgentInstruction(instruction: string): void {
    if (instruction.length > 2000) {
      throw new Error('agentInstruction exceeds 2000 characters');
    }
  }

  private validateFilePath(filePath: string | null | undefined): string | null {
    if (filePath === undefined || filePath === null) return null;
    const trimmed = filePath.trim();
    if (trimmed.length === 0) return null;
    return trimmed;
  }

  private validateLineRange(
    lineRange: LineRange | null | undefined,
    filePath: string | null,
  ): LineRange | null {
    if (lineRange === null || lineRange === undefined) return null;
    if (!filePath) {
      throw new Error('line range requires a file path');
    }
    return lineRange;
  }

  private validateDiffSnapshot(
    snapshot: string | null | undefined,
    filePath: string | null,
  ): string | null {
    if (snapshot === null || snapshot === undefined) {
      if (filePath) {
        throw new Error('file-level observations require a diff snapshot');
      }
      return null;
    }
    if (!filePath) {
      throw new Error('diff snapshot requires a file path');
    }
    return snapshot;
  }

  private validateContentHash(
    hash: string | null | undefined,
    filePath: string | null,
  ): string | null {
    if (hash === null || hash === undefined) {
      if (filePath) {
        throw new Error('file-level observations require a content hash');
      }
      return null;
    }
    if (!filePath) {
      throw new Error('content hash requires a file path');
    }
    return hash;
  }
}
