import { json } from '@sveltejs/kit';

import { createWorkspaceServices } from '$lib/server/composition/workspace-services';
import { DuplicateWorkspaceError } from '$lib/server/domain/errors/duplicate-workspace-error';
import { InvalidWorkspacePathError } from '$lib/server/domain/errors/invalid-workspace-path-error';
import { WorkspaceNotFoundError } from '$lib/server/domain/errors/workspace-not-found-error';
import { getDb, runMigrations } from '$lib/server/infrastructure/database/connection';

import type { RequestHandler } from './$types';

function getServices() {
  const db = getDb();
  runMigrations(db);
  return createWorkspaceServices(db);
}

export const GET: RequestHandler = async ({ params }) => {
  const { getUseCase } = getServices();
  const result = await getUseCase.execute({ id: params.id });
  if (!result.workspace) {
    return json({ error: 'Workspace not found' }, { status: 404 });
  }
  return json(result);
};

export const PATCH: RequestHandler = async ({ params, request }) => {
  const { repairUseCase, renameUseCase } = getServices();

  try {
    const body = await request.json();
    const hasDisplayName = 'displayName' in body && body.displayName !== undefined;
    const hasRepositoryPath = 'repositoryPath' in body && body.repositoryPath !== undefined;
    const hasPath = 'path' in body && body.path !== undefined;

    // Discriminated: require exactly one of displayName or repositoryPath
    if (hasDisplayName && (hasRepositoryPath || hasPath)) {
      return json(
        { error: 'Must send exactly one of displayName or repositoryPath' },
        { status: 400 },
      );
    }

    if ((hasRepositoryPath || hasPath) && hasDisplayName) {
      return json(
        { error: 'Must send exactly one of displayName or repositoryPath' },
        { status: 400 },
      );
    }

    if (hasDisplayName) {
      const result = await renameUseCase.execute({
        id: params.id,
        displayName: String(body.displayName),
      });
      return json(result);
    }

    if (hasRepositoryPath || hasPath) {
      const newPath = (body.repositoryPath ?? body.path ?? '').toString();
      const result = await repairUseCase.execute({ id: params.id, newRepositoryPath: newPath });
      return json(result);
    }

    return json(
      { error: 'Must send exactly one of displayName or repositoryPath' },
      { status: 400 },
    );
  } catch (error) {
    if (error instanceof WorkspaceNotFoundError) {
      return json({ error: error.message }, { status: 404 });
    }
    if (error instanceof InvalidWorkspacePathError) {
      return json({ error: error.message, path: error.path }, { status: 422 });
    }
    if (error instanceof DuplicateWorkspaceError) {
      return json({ error: error.message, path: error.path }, { status: 409 });
    }
    if (error instanceof Error && error.message.includes('displayName')) {
      return json({ error: error.message }, { status: 400 });
    }
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};

export const DELETE: RequestHandler = async ({ params }) => {
  const { deleteUseCase } = getServices();

  try {
    await deleteUseCase.execute({ id: params.id });

    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof WorkspaceNotFoundError) {
      return json({ error: error.message }, { status: 404 });
    }
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};
