import path from 'node:path';

import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

const libAlias = path.resolve('./src/lib');

export default defineConfig({
  // The SvelteKit plugin is applied per project below: Vitest projects do not
  // inherit root-level plugins, and .svelte.ts runes modules (e.g.
  // observation-draft-store) need the Svelte transform in the unit project.
  test: {
    exclude: ['tests/e2e/**', 'node_modules/**', '.svelte-kit/**', 'build/**'],
    projects: [
      {
        plugins: [sveltekit()],
        resolve: {
          alias: {
            $lib: libAlias,
          },
        },
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.ts'],
          globalSetup: ['./tests/setup/global-setup.ts'],
          setupFiles: ['./tests/setup/vitest-setup.ts'],
        },
      },
      {
        plugins: [sveltekit()],
        resolve: {
          alias: {
            $lib: libAlias,
          },
        },
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.ts'],
          globalSetup: ['./tests/setup/global-setup.ts'],
          setupFiles: ['./tests/setup/vitest-setup.ts'],
        },
      },
    ],
  },
});
