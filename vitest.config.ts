import path from 'node:path';

import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

const libAlias = path.resolve('./src/lib');

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    exclude: ['tests/e2e/**', 'node_modules/**', '.svelte-kit/**', 'build/**'],
    projects: [
      {
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
