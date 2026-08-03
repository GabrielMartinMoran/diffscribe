import { json } from '@sveltejs/kit';

import { createWorkspaceServices } from '$lib/server/composition/workspace-services';
import {
  ObservationNotFoundError,
  ReviewReadOnlyError,
} from '$lib/server/domain/errors/observation-errors';
import { ReviewNotFoundError } from '$lib/server/domain/errors/review-errors';
import { getDb, runMigrations } from '$lib/server/infrastructure/database/connection';

import type { RequestHandler } from './$types';

function getServices() {
  const db = getDb();
  runMigrations(db);
  return createWorkspaceServices(db);
}

export const GET: RequestHandler = async ({ params }) => {
  try {
    const services = getServices();

    // Verify workspace exists
    const wsResult = await services.getUseCase.execute({ id: params.id });
    if (!wsResult) {
      return json({ error: 'Workspace not found' }, { status: 404 });
    }

    // Get observation
    const observation = await services.getObservationUseCase.execute(params.observationId);

    // Verify ownership chain
    if (observation.reviewId !== params.reviewId) {
      return json({ error: 'Observation not found' }, { status: 404 });
    }

    const review = await services.getReviewUseCase.execute({ reviewId: params.reviewId });
    if (!review || review.workspaceId !== params.id) {
      return json({ error: 'Review not found' }, { status: 404 });
    }

    return json(observation);
  } catch (error) {
    if (error instanceof ObservationNotFoundError || error instanceof ReviewNotFoundError) {
      return json({ error: error.message }, { status: 404 });
    }
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};

export const PATCH: RequestHandler = async ({ params, request }) => {
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

    // Validate body
    if (body.body !== undefined && body.body.trim().length === 0) {
      return json({ error: '"body" must not be empty' }, { status: 400 });
    }
    if (body.body && body.body.length > 5000) {
      return json({ error: '"body" exceeds 5000 characters' }, { status: 400 });
    }
    if (body.agentInstruction && body.agentInstruction.length > 2000) {
      return json({ error: '"agentInstruction" exceeds 2000 characters' }, { status: 400 });
    }

    const result = await services.updateObservationUseCase.execute(params.observationId, {
      body: body.body,
      agentInstruction: body.agentInstruction,
    });

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

export const DELETE: RequestHandler = async ({ params }) => {
  try {
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

    await services.deleteObservationUseCase.execute(params.observationId);

    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof ReviewReadOnlyError) {
      return json({ error: error.message }, { status: 409 });
    }
    if (error instanceof ObservationNotFoundError) {
      return json({ error: error.message }, { status: 404 });
    }
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};
