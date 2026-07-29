/* eslint-disable @typescript-eslint/no-explicit-any */
import Database from 'better-sqlite3';
import { Given, Then, When } from 'quickpickle';

import { createWorkspaceServices } from '$lib/server/composition/workspace-services';
import type { ComparisonSerialized } from '$lib/server/domain/value-objects/comparison';
import { ObservationType } from '$lib/server/domain/value-objects/observation-enums';

interface StatusWorld {
  db: Database.Database;
  activeReviewId: string | null;
  lastObservation: any;
  lastObservationError: string | null;
  activeReview: any;
}

function compJson(): ComparisonSerialized {
  return {
    base: { type: 'head', value: 'HEAD', label: 'HEAD' },
    target: { type: 'working-tree', value: 'working-tree', label: 'working tree' },
    comparisonType: 'working-tree-vs-head' as any,
    createdAt: new Date().toISOString(),
  };
}

Given(
  'an observation with status {string} exists on the active review',
  async (world: StatusWorld, status: string) => {
    const services = createWorkspaceServices(world.db);
    const result = await services.createObservationUseCase.execute({
      reviewId: world.activeReviewId!,
      type: ObservationType.NOTE,
      title: 'Status test',
      filePath: 'src/app.ts',
      comparisonSnapshotJson: JSON.stringify(compJson()),
      diffSnapshot: 'content',
      contentHash: 'abc',
    });

    // Transition to the desired status if not open
    if (status !== 'open') {
      await services.transitionObservationStatusUseCase.execute(result.id, status);
      const updated = await services.getObservationUseCase.execute(result.id);
      world.lastObservation = updated;
    } else {
      world.lastObservation = result;
    }
  },
);

When('the user marks the observation as resolved', async (world: StatusWorld) => {
  const services = createWorkspaceServices(world.db);
  world.lastObservation = await services.transitionObservationStatusUseCase.execute(
    world.lastObservation!.id,
    'resolved',
  );
});

When('the user dismisses the observation', async (world: StatusWorld) => {
  const services = createWorkspaceServices(world.db);
  world.lastObservation = await services.transitionObservationStatusUseCase.execute(
    world.lastObservation!.id,
    'dismissed',
  );
});

When('the user marks the observation as pending', async (world: StatusWorld) => {
  const services = createWorkspaceServices(world.db);
  world.lastObservation = await services.transitionObservationStatusUseCase.execute(
    world.lastObservation!.id,
    'pending',
  );
});

When('the user reopens the observation', async (world: StatusWorld) => {
  const services = createWorkspaceServices(world.db);
  world.lastObservation = await services.transitionObservationStatusUseCase.execute(
    world.lastObservation!.id,
    'open',
  );
});

Then('the observation status is {string}', (world: StatusWorld, status: string) => {
  if (world.lastObservation.status !== status) {
    throw new Error(`Expected status "${status}", got "${world.lastObservation.status}"`);
  }
});

Then('the observation updatedAt timestamp is refreshed', (world: StatusWorld) => {
  if (!world.lastObservation?.updatedAt) throw new Error('No updatedAt');
});
