import { json } from '@sveltejs/kit';

import type { CreateObservationCommand } from '$lib/server/application/dto/commands/observation-commands';
import { createWorkspaceServices } from '$lib/server/composition/workspace-services';
import {
  ObservationNotFoundError,
  ReviewReadOnlyError,
} from '$lib/server/domain/errors/observation-errors';
import { ReviewNotFoundError } from '$lib/server/domain/errors/review-errors';
import { WorkspaceNotFoundError } from '$lib/server/domain/errors/workspace-not-found-error';
import { getDb, runMigrations } from '$lib/server/infrastructure/database/connection';

import type { RequestHandler } from './$types';

function getServices() {
  const db = getDb();
  runMigrations(db);
  return createWorkspaceServices(db);
}

export const GET: RequestHandler = async ({ params }) => {
  try {
    const { getUseCase, getReviewUseCase } = getServices();

    const wsResult = await getUseCase.execute({ id: params.id });
    if (!wsResult) {
      return json({ error: 'Workspace not found' }, { status: 404 });
    }

    const review = await getReviewUseCase.execute({ reviewId: params.reviewId });
    if (!review || review.workspaceId !== params.id) {
      return json({ error: 'Review not found' }, { status: 404 });
    }

    // Get observation list — use listObservations
    const db = getDb();
    runMigrations(db);
    const services = createWorkspaceServices(db);
    const observations = await services.listObservationsUseCase.execute(params.reviewId);

    return json(observations);
  } catch (error) {
    if (error instanceof ReviewNotFoundError || error instanceof ObservationNotFoundError) {
      return json({ error: error.message }, { status: 404 });
    }
    if (error instanceof ReviewReadOnlyError) {
      return json({ error: error.message }, { status: 409 });
    }
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};

export const POST: RequestHandler = async ({ params, request }) => {
  try {
    const body = await request.json();

    const db = getDb();
    runMigrations(db);
    const services = createWorkspaceServices(db);

    // Verify workspace and review ownership
    const wsResult = await services.getUseCase.execute({ id: params.id });
    if (!wsResult) {
      return json({ error: 'Workspace not found' }, { status: 404 });
    }

    const review = await services.getReviewUseCase.execute({ reviewId: params.reviewId });
    if (!review || review.workspaceId !== params.id) {
      return json({ error: 'Review not found' }, { status: 404 });
    }

    if (review.status === 'completed' || review.status === 'archived') {
      return json(
        { error: `Review ${params.reviewId} is completed and read-only` },
        { status: 409 },
      );
    }

    // Validate required fields
    if (!body.type) {
      return json({ error: '"type" is required' }, { status: 400 });
    }
    if (!body.title || body.title.trim().length === 0) {
      return json({ error: '"title" must not be empty' }, { status: 400 });
    }
    if (body.title && body.title.length > 200) {
      return json({ error: '"title" exceeds 200 characters' }, { status: 400 });
    }
    if (body.body && body.body.length > 5000) {
      return json({ error: '"body" exceeds 5000 characters' }, { status: 400 });
    }
    if (body.agentInstruction && body.agentInstruction.length > 2000) {
      return json({ error: '"agentInstruction" exceeds 2000 characters' }, { status: 400 });
    }

    // Validate type
    const validTypes = ['issue', 'risk', 'suggestion', 'question', 'praise', 'note'];
    if (!validTypes.includes(body.type)) {
      return json({ error: `Invalid observation type: "${body.type}"` }, { status: 400 });
    }

    // Validate severity for issue/risk
    if ((body.type === 'issue' || body.type === 'risk') && !body.severity) {
      return json({ error: `${body.type} requires a severity` }, { status: 400 });
    }

    // Validate file/range compatibility
    if (body.lineRangeStart && !body.filePath) {
      return json({ error: 'line range requires a file path' }, { status: 400 });
    }

    // Reject range observations on binary files
    const binaryExts = [
      '.png',
      '.jpg',
      '.jpeg',
      '.gif',
      '.bmp',
      '.ico',
      '.webp',
      '.pdf',
      '.zip',
      '.gz',
      '.exe',
      '.bin',
      '.mp3',
      '.mp4',
      '.avi',
    ];
    if (body.lineRangeStart && body.filePath) {
      const ext = body.filePath.substring(body.filePath.lastIndexOf('.')).toLowerCase();
      if (binaryExts.includes(ext)) {
        return json(
          { error: 'Range observations are not allowed on binary files' },
          { status: 422 },
        );
      }
    }

    const command: CreateObservationCommand = {
      reviewId: params.reviewId,
      type: body.type,
      severity: body.severity ?? null,
      title: body.title,
      body: body.body ?? '',
      agentInstruction: body.agentInstruction ?? '',
      filePath: body.filePath ?? null,
      side: body.side ?? 'new',
      lineRangeStart: body.lineRangeStart ?? null,
      lineRangeEnd: body.lineRangeEnd ?? null,
      comparisonSnapshotJson: body.comparisonSnapshotJson,
      diffSnapshot: body.diffSnapshot ?? null,
      contentHash: body.contentHash ?? null,
    };

    const result = await services.createObservationUseCase.execute(command);
    return json(result, { status: 201 });
  } catch (error) {
    if (error instanceof ReviewReadOnlyError) {
      return json({ error: error.message }, { status: 409 });
    }
    if (error instanceof WorkspaceNotFoundError || error instanceof ReviewNotFoundError) {
      return json({ error: error.message }, { status: 404 });
    }
    if (error instanceof Error) {
      return json({ error: error.message }, { status: 422 });
    }
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};
