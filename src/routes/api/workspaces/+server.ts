import { json } from '@sveltejs/kit';

import type { RegisterWorkspaceCommand } from '$lib/server/application/dto/commands/register-workspace-command';
import { createWorkspaceServices } from '$lib/server/composition/workspace-services';
import { DuplicateWorkspaceError } from '$lib/server/domain/errors/duplicate-workspace-error';
import { InvalidWorkspacePathError } from '$lib/server/domain/errors/invalid-workspace-path-error';
import { getDb, runMigrations } from '$lib/server/infrastructure/database/connection';

import type { RequestHandler } from './$types';

function getServices() {
  const db = getDb();
  runMigrations(db);
  return createWorkspaceServices(db);
}

export const GET: RequestHandler = async () => {
  const { listUseCase } = getServices();
  const result = await listUseCase.execute();
  return json(result);
};

export const POST: RequestHandler = async ({ request }) => {
  const { registerUseCase } = getServices();

  try {
    const body = await request.json();
    const command: RegisterWorkspaceCommand = {
      repositoryPath: body.repositoryPath ?? body.path ?? '',
      displayName: body.displayName ?? body.name ?? body.repositoryPath ?? '',
    };

    const result = await registerUseCase.execute(command);
    return json(result, { status: 201 });
  } catch (error) {
    if (error instanceof InvalidWorkspacePathError) {
      return json({ error: error.message, path: error.path }, { status: 422 });
    }
    if (error instanceof DuplicateWorkspaceError) {
      return json({ error: error.message, path: error.path }, { status: 409 });
    }
    return json({ error: 'Internal server error' }, { status: 500 });
  }
};
