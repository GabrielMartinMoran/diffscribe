import type { ComparisonSerialized } from '$lib/server/domain/value-objects/comparison';

export interface CreateReviewCommand {
  workspaceId: string;
  comparison: ComparisonSerialized;
  title?: string | null;
}
