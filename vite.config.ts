import path from 'node:path';

import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    port: 56823,
    strictPort: true,
    allowedHosts: ['.ts.net'],
  },
  resolve: {
    alias: {
      $lib: path.resolve('./src/lib'),
    },
  },
});
