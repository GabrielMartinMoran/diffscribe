import { json } from '@sveltejs/kit';

import { createWorkspaceServices } from '$lib/server/composition/workspace-services';
import { getDb, runMigrations } from '$lib/server/infrastructure/database/connection';

import type { RequestHandler } from './$types';

function getServices() {
  const db = getDb();
  runMigrations(db);
  return createWorkspaceServices(db);
}

export const GET: RequestHandler = async ({ params }) => {
  const { getUseCase, getGitContextUseCase } = getServices();

  const ws = await getUseCase.execute({ id: params.id });
  if (!ws.workspace) {
    return json({ error: 'Workspace not found' }, { status: 404 });
  }

  if (ws.workspace.status === 'invalid') {
    return json(
      {
        error: 'Workspace path is invalid',
        errorCode: 'INVALID_WORKSPACE',
      },
      { status: 200 },
    );
  }

  const context = await getGitContextUseCase.execute(ws.workspace.repositoryPath);

  return json({
    ...context,
    workspaceId: params.id,
  });
};
