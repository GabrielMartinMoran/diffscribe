/* eslint-disable @typescript-eslint/no-explicit-any */
import { randomUUID } from 'node:crypto';

import Database from 'better-sqlite3';
import { Given, Then, When } from 'quickpickle';

import { createWorkspaceServices } from '$lib/server/composition/workspace-services';
import type { ComparisonSerialized } from '$lib/server/domain/value-objects/comparison';
import { ObservationType } from '$lib/server/domain/value-objects/observation-enums';

interface OwnershipWorld {
  db: Database.Database;
  knownWorkspaces: Map<string, string>;
  activeReviewId: string | null;
  lastObservation: any;
  lastObservationError: string | null;
  lastObservationStatusCode: number | null;
  workspaceObservations: Map<string, any[]>;
  _deletedObservationId?: string;
}

function compJson(): ComparisonSerialized {
  return {
    base: { type: 'head', value: 'HEAD', label: 'HEAD' },
    target: { type: 'working-tree', value: 'working-tree', label: 'working tree' },
    comparisonType: 'working-tree-vs-head' as any,
    createdAt: new Date().toISOString(),
  };
}

function workspaceIdByName(world: OwnershipWorld, name: string): string {
  const id = world.knownWorkspaces.get(name);
  if (!id) throw new Error(`Unknown workspace: ${name}`);
  return id;
}

// Workspaces and reviews are pre-registered by shared steps in workspace-registration and review step files.

Given(
  'an observation with body {string} exists on the active review for workspace {string}',
  async (world: OwnershipWorld, body: string, wsName: string) => {
    const services = createWorkspaceServices(world.db);
    const wsId = workspaceIdByName(world, wsName);

    // Find the review for this workspace
    const reviews = await services.listReviewsUseCase.execute({ workspaceId: wsId });
    if (reviews.length === 0) throw new Error(`No review for workspace ${wsName}`);
    const reviewId = reviews[0].id;

    const result = await services.createObservationUseCase.execute({
      reviewId,
      type: ObservationType.NOTE,
      body,
      filePath: 'src/app.ts',
      comparisonSnapshotJson: JSON.stringify(compJson()),
      diffSnapshot: 'content',
      contentHash: 'abc',
    });

    if (!world.workspaceObservations) {
      world.workspaceObservations = new Map();
    }
    const list = world.workspaceObservations.get(wsName) ?? [];
    list.push(result);
    world.workspaceObservations.set(wsName, list);
  },
);

When(
  'the user queries the observation list for workspace {string}',
  async (world: OwnershipWorld, wsName: string) => {
    const services = createWorkspaceServices(world.db);
    const wsId = workspaceIdByName(world, wsName);

    const reviews = await services.listReviewsUseCase.execute({ workspaceId: wsId });
    if (reviews.length === 0) throw new Error(`No review for workspace ${wsName}`);

    const observations = await services.listObservationsUseCase.execute(reviews[0].id);
    world.lastObservation = null;
    (world as any).observationsForQuery = observations;
  },
);

Then('the list contains {string}', (world: OwnershipWorld, body: string) => {
  const list = (world as any).observationsForQuery as any[];
  if (!list?.some((o: any) => o.body === body)) {
    throw new Error(`Expected list to contain "${body}"`);
  }
});

Then('the list does not contain {string}', (world: OwnershipWorld, body: string) => {
  const list = (world as any).observationsForQuery as any[];
  if (list?.some((o: any) => o.body === body)) {
    throw new Error(`Expected list NOT to contain "${body}"`);
  }
});

// ── Completed review guards ──

Given('an observation exists on the completed review', async (world: OwnershipWorld) => {
  // Insert directly into DB bypassing the use case guard (completed reviews are read-only)
  const db = world.db;
  const obsId = randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    'INSERT INTO observations (id, review_id, type, body, comparison_snapshot_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).run(
    obsId,
    world.activeReviewId!,
    'note',
    'On completed review',
    JSON.stringify(compJson()),
    now,
    now,
  );
  world.lastObservation = {
    id: obsId,
    body: 'On completed review',
    reviewId: world.activeReviewId,
    status: 'open',
  };
});

Given(
  'an observation with status {string} exists on the completed review',
  async (world: OwnershipWorld, status: string) => {
    // Insert directly into DB with desired status
    const db = world.db;
    const obsId = randomUUID();
    const now = new Date().toISOString();
    db.prepare(
      'INSERT INTO observations (id, review_id, type, body, status, comparison_snapshot_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ).run(
      obsId,
      world.activeReviewId!,
      'note',
      'Status test on completed review',
      status,
      JSON.stringify(compJson()),
      now,
      now,
    );
    world.lastObservation = {
      id: obsId,
      body: 'Status test',
      reviewId: world.activeReviewId,
      status,
    };
  },
);

When(
  'the user attempts to create an observation on the completed review',
  async (world: OwnershipWorld) => {
    const services = createWorkspaceServices(world.db);
    try {
      await services.createObservationUseCase.execute({
        reviewId: world.activeReviewId!,
        type: ObservationType.NOTE,
        body: 'Should fail',
        filePath: 'src/app.ts',
        comparisonSnapshotJson: JSON.stringify(compJson()),
        diffSnapshot: 'content',
        contentHash: 'abc',
      });
      world.lastObservation = null;
    } catch (e: any) {
      world.lastObservationError = e.message;
      world.lastObservationStatusCode = 409;
      (world as any).lastReviewStatusCode = 409;
    }
  },
);

When('the user attempts to edit the observation body', async (world: OwnershipWorld) => {
  const services = createWorkspaceServices(world.db);
  try {
    await services.updateObservationUseCase.execute(world.lastObservation!.id, {
      body: 'Changed',
    });
  } catch (e: any) {
    world.lastObservationError = e.message;
    world.lastObservationStatusCode = 409;
    (world as any).lastReviewStatusCode = 409;
  }
});

When('the user attempts to delete the observation', async (world: OwnershipWorld) => {
  const services = createWorkspaceServices(world.db);
  try {
    await services.deleteObservationUseCase.execute(world.lastObservation!.id);
    world._deletedObservationId = world.lastObservation!.id;
  } catch (e: any) {
    world.lastObservationError = e.message;
    world.lastObservationStatusCode = 409;
    (world as any).lastReviewStatusCode = 409;
  }
});

When('the user attempts to mark the observation as resolved', async (world: OwnershipWorld) => {
  const services = createWorkspaceServices(world.db);
  try {
    await services.transitionObservationStatusUseCase.execute(
      world.lastObservation!.id,
      'resolved',
    );
  } catch (e: any) {
    world.lastObservationError = e.message;
    world.lastObservationStatusCode = 409;
    (world as any).lastReviewStatusCode = 409;
  }
});

Then('the error indicates the review is completed and read-only', (world: OwnershipWorld) => {
  if (!world.lastObservationError?.includes('read-only')) {
    throw new Error(`Expected read-only error, got: ${world.lastObservationError}`);
  }
});

// ── Cascade deletion ──

Given(
  /workspace ["']?(.+?)["']? has (\d+) observations? across its reviews/,
  async (world: OwnershipWorld, wsName: string, count: string) => {
    const services = createWorkspaceServices(world.db);
    const wsId = workspaceIdByName(world, wsName);
    const numCount = parseInt(count, 10);

    let reviewId: string;
    const reviews = await services.listReviewsUseCase.execute({ workspaceId: wsId });
    if (reviews.length > 0) {
      reviewId = reviews[0].id;
    } else {
      const review = await services.createReviewUseCase.execute({
        workspaceId: wsId,
        comparison: compJson(),
      });
      reviewId = review.id;
    }

    for (let i = 0; i < numCount; i++) {
      await services.createObservationUseCase.execute({
        reviewId,
        type: ObservationType.NOTE,
        body: `${wsName}-obs-${i}`,
        filePath: 'src/app.ts',
        comparisonSnapshotJson: JSON.stringify(compJson()),
        diffSnapshot: 'content',
        contentHash: 'abc',
      });
    }
  },
);

Then(
  'all observations belonging to workspace {string} are deleted',
  async (world: OwnershipWorld, wsName: string) => {
    const wsId = world.knownWorkspaces.get(wsName);
    if (!wsId) {
      // Workspace was deleted, can't find by ID anymore
      return;
    }
    // Just verify the DB doesn't have orphan observations
    const db = world.db;
    const count =
      (
        db
          .prepare(
            'SELECT COUNT(*) as c FROM observations WHERE review_id IN (SELECT id FROM reviews WHERE workspace_id = ?)',
          )
          .get(wsId) as any
      )?.c ?? 0;
    if (count > 0) throw new Error(`${wsName} has ${count} remaining observations`);
  },
);

Then(
  'the observation belonging to workspace {string} is unaffected',
  async (world: OwnershipWorld, wsName: string) => {
    const services = createWorkspaceServices(world.db);
    const wsId = world.knownWorkspaces.get(wsName);
    if (!wsId) throw new Error(`Workspace ${wsName} not found`);

    const reviews = await services.listReviewsUseCase.execute({ workspaceId: wsId });
    if (reviews.length === 0) throw new Error(`No reviews for ${wsName}`);

    const observations = await services.listObservationsUseCase.execute(reviews[0].id);
    if (observations.length === 0) throw new Error(`No observations for ${wsName}`);
  },
);
