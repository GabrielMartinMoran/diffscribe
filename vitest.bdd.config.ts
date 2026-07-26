import { sveltekit } from '@sveltejs/kit/vite';
import quickpickle from 'quickpickle';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [sveltekit(), quickpickle()],
  test: {
    include: ['specs/features/application/**/*.feature'],
    setupFiles: [
      'tests/steps/smoke.steps.ts',
      'tests/steps/post-setup-discrepancies.steps.ts',
      'tests/steps/pre-commit-quality-gate.steps.ts',
    ],
  },
});
