import { json } from '@sveltejs/kit';

import { createWorkspaceServices } from '$lib/server/composition/workspace-services';
import { WorkspaceNotFoundError } from '$lib/server/domain/errors/workspace-not-found-error';
import { WorkspaceId } from '$lib/server/domain/value-objects/workspace-id';
import { getDb, runMigrations } from '$lib/server/infrastructure/database/connection';

import type { RequestHandler } from './$types';

function getServices() {
  const db = getDb();
  runMigrations(db);
  return createWorkspaceServices(db);
}

export const GET: RequestHandler = async ({ params, url }) => {
  try {
    const { listUseCase, listReviewsUseCase } = getServices();

    // Verify workspace exists
    const wsResult = await listUseCase.execute();
    const workspaceId = new WorkspaceId(params.id);
    const ws = wsResult.workspaces.find((w) => w.id === workspaceId.value);
    if (!ws) {
      return json({ error: 'Workspace not found' }, { status: 404 });
    }

    const currentFilesParam = url.searchParams.get('currentFiles');
    const currentFiles = currentFilesParam ? currentFilesParam.split(',') : [];

    const reviews = await listReviewsUseCase.execute({
      workspaceId: params.id,
      currentFiles,
    });
    return json({ reviews });
  } catch (error) {
    if (error instanceof WorkspaceNotFoundError) {
      return json({ error: error.message }, { status: 404 });
    }
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};

export const POST: RequestHandler = async ({ params, request }) => {
  try {
    const { listUseCase, createReviewUseCase } = getServices();

    // Verify workspace exists
    const wsResult = await listUseCase.execute();
    const workspaceId = new WorkspaceId(params.id);
    const ws = wsResult.workspaces.find((w) => w.id === workspaceId.value);
    if (!ws) {
      return json({ error: 'Workspace not found' }, { status: 404 });
    }

    const body = await request.json();
    if (!body.comparison) {
      return json({ error: 'Comparison is required' }, { status: 400 });
    }

    const result = await createReviewUseCase.execute({
      workspaceId: params.id,
      comparison: body.comparison,
      title: body.title ?? null,
    });
    return json(result, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Comparison requires')) {
      return json({ error: error.message }, { status: 422 });
    }
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};
