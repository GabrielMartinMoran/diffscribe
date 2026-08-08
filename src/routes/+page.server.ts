import { fail } from '@sveltejs/kit';

import { createWorkspaceServices } from '$lib/server/composition/workspace-services';
import { DuplicateWorkspaceError } from '$lib/server/domain/errors/duplicate-workspace-error';
import { InvalidWorkspacePathError } from '$lib/server/domain/errors/invalid-workspace-path-error';
import { WorkspaceNotFoundError } from '$lib/server/domain/errors/workspace-not-found-error';
import { getDb, runMigrations } from '$lib/server/infrastructure/database/connection';

import type { Actions, PageServerLoad } from './$types';

function getServices() {
  const db = getDb();
  runMigrations(db);
  return createWorkspaceServices(db);
}

export const load: PageServerLoad = async ({ depends }) => {
  // Declared SvelteKit invalidation keys (feat-fast-menu-interactions):
  // callers use `invalidate('app:…')` for the resource they touched instead
  // of a broad `invalidateAll()`; only declared keys re-run this load.
  depends('app:workspaces');
  depends('app:git-context');
  depends('app:active-review');

  const services = getServices();
  const result = await services.listUseCase.execute();
  const activeWorkspaceId = services.appState.get('active_workspace_id');

  // Repair active state: clear it if the workspace no longer exists
  if (activeWorkspaceId) {
    const active = services.appState.get('active_workspace_id');
    if (active) {
      const exists = await services.getUseCase.execute({ id: active });
      if (!exists.workspace) {
        services.appState.delete('active_workspace_id');
      }
    }
  }

  // Load git context for the active workspace
  let gitContext = null;
  let activeReview = null;
  const resolvedActiveId = services.appState.get('active_workspace_id');
  if (resolvedActiveId) {
    const active = await services.getUseCase.execute({ id: resolvedActiveId });
    if (active.workspace) {
      // Load or clean orphan active review key
      const activeReviewKey = `active_review:${resolvedActiveId}`;
      const activeReviewId = services.appState.get(activeReviewKey);
      if (activeReviewId) {
        try {
          activeReview = await services.getReviewUseCase.execute({ reviewId: activeReviewId });
          if (activeReview.workspaceId !== resolvedActiveId) {
            services.appState.delete(activeReviewKey);
            activeReview = null;
          }
        } catch {
          services.appState.delete(activeReviewKey);
          activeReview = null;
        }
      }

      if (active.workspace.status === 'valid') {
        gitContext = await services.getGitContextUseCase.execute(active.workspace.repositoryPath);
      } else {
        // Return an error-like context so the UI shows an error state
        gitContext = {
          status: null,
          branches: [],
          commits: [],
          error: {
            message: 'The workspace path is no longer valid.',
            errorCode: 'INVALID_WORKSPACE',
          },
          readAt: null,
          defaultComparison: null,
        };
      }
    }
  }

  return {
    workspaces: result.workspaces,
    activeWorkspaceId: services.appState.get('active_workspace_id'),
    gitContext,
    activeReview,
  };
};

export const actions: Actions = {
  register: async ({ request }) => {
    const data = await request.formData();
    const repositoryPath = data.get('repositoryPath')?.toString() ?? '';
    const displayName = data.get('displayName')?.toString() ?? '';

    if (!repositoryPath.trim()) {
      return fail(422, { error: 'Repository path is required' });
    }

    try {
      const { registerUseCase } = getServices();
      await registerUseCase.execute({ repositoryPath, displayName: displayName || repositoryPath });
      return { success: true };
    } catch (error) {
      if (error instanceof InvalidWorkspacePathError) {
        return fail(422, { error: error.message });
      }
      if (error instanceof DuplicateWorkspaceError) {
        return fail(409, { error: error.message });
      }
      return fail(500, { error: 'Internal server error' });
    }
  },

  repair: async ({ request }) => {
    const data = await request.formData();
    const id = data.get('id')?.toString() ?? '';
    const newPath = data.get('newPath')?.toString() ?? '';

    if (!id.trim()) {
      return fail(422, { error: 'Workspace ID is required' });
    }
    if (!newPath.trim()) {
      return fail(422, { error: 'New repository path is required' });
    }

    try {
      const { repairUseCase } = getServices();
      await repairUseCase.execute({ id, newRepositoryPath: newPath });
      return { success: true };
    } catch (error) {
      if (error instanceof InvalidWorkspacePathError) {
        return fail(422, { error: error.message });
      }
      if (error instanceof DuplicateWorkspaceError) {
        return fail(409, { error: error.message });
      }
      return fail(500, { error: 'Internal server error' });
    }
  },

  select: async ({ request }) => {
    const data = await request.formData();
    const id = data.get('id')?.toString() ?? '';

    if (!id.trim()) {
      return fail(422, { error: 'Workspace ID is required' });
    }

    try {
      const { appState, getUseCase } = getServices();
      const exists = await getUseCase.execute({ id });
      if (!exists.workspace) {
        return fail(404, { error: 'Workspace not found' });
      }
      appState.set('active_workspace_id', id);
      return { success: true };
    } catch {
      return fail(500, { error: 'Internal server error' });
    }
  },

  rename: async ({ request }) => {
    const data = await request.formData();
    const id = data.get('id')?.toString() ?? '';
    const displayName = data.get('displayName')?.toString() ?? '';

    if (!id.trim()) {
      return fail(422, { error: 'Workspace ID is required' });
    }

    try {
      const { renameUseCase } = getServices();
      await renameUseCase.execute({ id, displayName });
      return { success: true };
    } catch (error) {
      if (error instanceof WorkspaceNotFoundError) {
        return fail(404, { error: error.message });
      }
      if (error instanceof Error && error.message.includes('displayName')) {
        return fail(400, { error: error.message });
      }
      return fail(500, { error: 'Internal server error' });
    }
  },

  delete: async ({ request }) => {
    const data = await request.formData();
    const id = data.get('id')?.toString() ?? '';

    if (!id.trim()) {
      return fail(422, { error: 'Workspace ID is required' });
    }

    try {
      const { deleteUseCase } = getServices();
      await deleteUseCase.execute({ id });
      return { success: true };
    } catch (error) {
      if (error instanceof WorkspaceNotFoundError) {
        return fail(404, { error: error.message });
      }
      return fail(500, { error: 'Internal server error' });
    }
  },
};
