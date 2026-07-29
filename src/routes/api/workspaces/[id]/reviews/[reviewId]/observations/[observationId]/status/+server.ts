import { json } from '@sveltejs/kit';

import { createWorkspaceServices } from '$lib/server/composition/workspace-services';
import {
  ObservationNotFoundError,
  ReviewReadOnlyError,
} from '$lib/server/domain/errors/observation-errors';
import { getDb, runMigrations } from '$lib/server/infrastructure/database/connection';

import type { RequestHandler } from './$types';

function getServices() {
  const db = getDb();
  runMigrations(db);
  return createWorkspaceServices(db);
}

export const POST: RequestHandler = async ({ params, request }) => {
  try {
    const body = await request.json();
    const services = getServices();

    // Verify workspace exists
    const wsResult = await services.getUseCase.execute({ id: params.id });
    if (!wsResult) {
      return json({ error: 'Workspace not found' }, { status: 404 });
    }

    // Verify observation ownership
    const observation = await services.getObservationUseCase.execute(params.observationId);
    if (observation.reviewId !== params.reviewId) {
      return json({ error: 'Observation not found' }, { status: 404 });
    }

    const validStatuses = ['open', 'resolved', 'dismissed', 'pending'];
    if (!body.status || !validStatuses.includes(body.status)) {
      return json({ error: `Invalid status: "${body.status}"` }, { status: 400 });
    }

    const result = await services.transitionObservationStatusUseCase.execute(
      params.observationId,
      body.status,
    );

    return json(result);
  } catch (error) {
    if (error instanceof ReviewReadOnlyError) {
      return json({ error: error.message }, { status: 409 });
    }
    if (error instanceof ObservationNotFoundError) {
      return json({ error: error.message }, { status: 404 });
    }
    if (error instanceof Error) {
      return json({ error: error.message }, { status: 422 });
    }
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};
