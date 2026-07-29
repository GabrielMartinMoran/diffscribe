import path from 'node:path';

import { sveltekit } from '@sveltejs/kit/vite';
import quickpickle from 'quickpickle';
import { defineConfig } from 'vitest/config';

const libAlias = path.resolve('./src/lib');

export default defineConfig({
  plugins: [sveltekit(), quickpickle()],
  resolve: {
    alias: {
      $lib: libAlias,
    },
  },
  test: {
    testTimeout: 30_000,
    include: ['specs/features/application/**/*.feature', 'specs/features/product/**/*.feature'],
    globalSetup: ['./tests/setup/global-setup.ts'],
    setupFiles: [
      './tests/setup/vitest-setup.ts',
      'tests/steps/smoke.steps.ts',
      'tests/steps/post-setup-discrepancies.steps.ts',
      'tests/steps/pre-commit-quality-gate.steps.ts',
      'tests/steps/workspace-registration.steps.ts',
      'tests/steps/workspace-management.steps.ts',
      'tests/steps/git-context-adapter.steps.ts',
      'tests/steps/git-context-panel.steps.ts',
      'tests/steps/file-list-adapter.steps.ts',
      'tests/steps/file-list-panel.steps.ts',
      'tests/steps/file-diff.steps.ts',
      'tests/steps/review.steps.ts',
      'tests/steps/observation-crud.steps.ts',
      'tests/steps/observation-status.steps.ts',
      'tests/steps/observation-staleness.steps.ts',
      'tests/steps/observation-ownership.steps.ts',
      'tests/steps/line-selection.steps.ts',
      'tests/steps/a11y-diff-viewer.steps.ts',
      'tests/steps/a11y-observation-card.steps.ts',
      'tests/steps/test-db-isolation.steps.ts',
    ],
  },
});
