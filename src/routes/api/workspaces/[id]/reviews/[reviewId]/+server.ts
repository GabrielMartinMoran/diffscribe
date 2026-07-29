import { json } from '@sveltejs/kit';

import { createWorkspaceServices } from '$lib/server/composition/workspace-services';
import { ReviewNotFoundError } from '$lib/server/domain/errors/review-errors';
import { WorkspaceNotFoundError } from '$lib/server/domain/errors/workspace-not-found-error';
import { WorkspaceId } from '$lib/server/domain/value-objects/workspace-id';
import { getDb, runMigrations } from '$lib/server/infrastructure/database/connection';

import type { RequestHandler } from './$types';

function getServices() {
  const db = getDb();
  runMigrations(db);
  return createWorkspaceServices(db);
}

export const GET: RequestHandler = async ({ params }) => {
  try {
    const { listUseCase, getReviewUseCase } = getServices();

    // Verify workspace exists
    const wsResult = await listUseCase.execute();
    const workspaceId = new WorkspaceId(params.id);
    const ws = wsResult.workspaces.find((w) => w.id === workspaceId.value);
    if (!ws) {
      return json({ error: 'Workspace not found' }, { status: 404 });
    }

    const review = await getReviewUseCase.execute({ reviewId: params.reviewId });

    // Verify ownership
    if (review.workspaceId !== params.id) {
      return json({ error: 'Review not found' }, { status: 404 });
    }

    return json(review);
  } catch (error) {
    if (error instanceof ReviewNotFoundError) {
      return json({ error: error.message }, { status: 404 });
    }
    if (error instanceof WorkspaceNotFoundError) {
      return json({ error: error.message }, { status: 404 });
    }
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};
