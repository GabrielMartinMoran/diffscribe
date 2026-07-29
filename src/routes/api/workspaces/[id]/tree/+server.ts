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
  const { getUseCase, getWorkspaceTreeUseCase } = getServices();

  const ws = await getUseCase.execute({ id: params.id });
  if (!ws.workspace) {
    return json({ error: 'Workspace not found' }, { status: 404 });
  }

  const result = await getWorkspaceTreeUseCase.execute(ws.workspace.repositoryPath);

  return json(result);
};
