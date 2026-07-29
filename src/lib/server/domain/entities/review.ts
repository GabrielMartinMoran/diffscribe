import type { Comparison } from '../value-objects/comparison';
import type { ReviewId } from '../value-objects/review-id';
import type { WorkspaceId } from '../value-objects/workspace-id';

export enum ReviewStatus {
  DRAFT = 'draft',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  ARCHIVED = 'archived',
}

export interface ReviewProps {
  id: ReviewId;
  workspaceId: WorkspaceId;
  comparison: Comparison;
  title?: string | null;
}

export class Review {
  public readonly id: ReviewId;
  public readonly workspaceId: WorkspaceId;
  public readonly comparison: Comparison;
  public readonly title: string | null;
  public readonly createdAt: Date;

  private _status: ReviewStatus;
  private _updatedAt: Date;
  private _completedAt: Date | null;

  constructor(props: ReviewProps) {
    this.id = props.id;
    this.workspaceId = props.workspaceId;
    this.comparison = props.comparison;
    this.title = props.title?.trim() || null;
    this.createdAt = new Date();
    this._status = ReviewStatus.DRAFT;
    this._updatedAt = new Date();
    this._completedAt = null;
  }

  get status(): ReviewStatus {
    return this._status;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  get completedAt(): Date | null {
    return this._completedAt;
  }

  get isReadOnly(): boolean {
    return this._status === ReviewStatus.COMPLETED || this._status === ReviewStatus.ARCHIVED;
  }

  complete(): void {
    if (this._status !== ReviewStatus.DRAFT) {
      throw new Error(`Cannot complete review: already ${this._status}`);
    }
    this._status = ReviewStatus.COMPLETED;
    this._completedAt = new Date();
    this._updatedAt = new Date();
  }

  reopen(): void {
    this._updatedAt = new Date();
  }
}
