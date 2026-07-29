export interface SetActiveReviewCommand {
  workspaceId: string;
  reviewId: string;
}

export interface MarkFileCommand {
  workspaceId: string;
  reviewId: string;
  filePath: string;
}

export interface UnmarkFileCommand {
  workspaceId: string;
  reviewId: string;
  filePath: string;
}

export interface CompleteReviewCommand {
  workspaceId: string;
  reviewId: string;
}
