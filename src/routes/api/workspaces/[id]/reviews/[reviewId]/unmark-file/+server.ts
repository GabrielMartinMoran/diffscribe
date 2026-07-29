import { json } from '@sveltejs/kit';

import { createWorkspaceServices } from '$lib/server/composition/workspace-services';
import {
  ReviewAlreadyCompletedError,
  ReviewNotFoundError,
} from '$lib/server/domain/errors/review-errors';
import { WorkspaceNotFoundError } from '$lib/server/domain/errors/workspace-not-found-error';
import { WorkspaceId } from '$lib/server/domain/value-objects/workspace-id';
import { getDb, runMigrations } from '$lib/server/infrastructure/database/connection';

import type { RequestHandler } from './$types';

function getServices() {
  const db = getDb();
  runMigrations(db);
  return createWorkspaceServices(db);
}

export const POST: RequestHandler = async ({ params, request }) => {
  try {
    const { listUseCase, getReviewUseCase, unmarkFileUseCase } = getServices();

    // Verify workspace exists
    const wsResult = await listUseCase.execute();
    const workspaceId = new WorkspaceId(params.id);
    const ws = wsResult.workspaces.find((w) => w.id === workspaceId.value);
    if (!ws) {
      return json({ error: 'Workspace not found' }, { status: 404 });
    }

    // Verify review exists and belongs to workspace
    const review = await getReviewUseCase.execute({ reviewId: params.reviewId });
    if (review.workspaceId !== params.id) {
      return json({ error: 'Review not found' }, { status: 404 });
    }

    const body = await request.json();
    if (!body.filePath || typeof body.filePath !== 'string') {
      return json({ error: 'filePath is required' }, { status: 400 });
    }

    const filePath = body.filePath.trim();

    // Reject path traversal and null bytes
    if (filePath.includes('..') || filePath.includes('\0') || filePath.startsWith('/')) {
      return json({ error: 'Invalid file path' }, { status: 422 });
    }

    await unmarkFileUseCase.execute({
      workspaceId: params.id,
      reviewId: params.reviewId,
      filePath,
    });

    return json({ success: true });
  } catch (error) {
    if (error instanceof ReviewNotFoundError) {
      return json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ReviewAlreadyCompletedError) {
      return json({ error: error.message }, { status: 409 });
    }
    if (error instanceof WorkspaceNotFoundError) {
      return json({ error: error.message }, { status: 404 });
    }
    if (error instanceof Error && error.message.includes('Invalid file path')) {
      return json({ error: error.message }, { status: 422 });
    }
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};
