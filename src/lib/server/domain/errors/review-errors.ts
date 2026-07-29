export class ReviewNotFoundError extends Error {
  constructor(id: string) {
    super(`Review not found: ${id}`);
    this.name = 'ReviewNotFoundError';
  }
}

export class ReviewNotOwnedByWorkspaceError extends Error {
  constructor(reviewId: string, workspaceId: string) {
    super(`Review ${reviewId} does not belong to workspace ${workspaceId}`);
    this.name = 'ReviewNotOwnedByWorkspaceError';
  }
}

export class ReviewAlreadyCompletedError extends Error {
  constructor(id: string) {
    super(`Review ${id} is already completed`);
    this.name = 'ReviewAlreadyCompletedError';
  }
}

export class ReviewAlreadyActiveError extends Error {
  constructor(reviewId: string, workspaceId: string) {
    super(`Review ${reviewId} is already the active review for workspace ${workspaceId}`);
    this.name = 'ReviewAlreadyActiveError';
  }
}
