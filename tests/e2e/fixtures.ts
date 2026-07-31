import type { APIRequestContext, BrowserContext } from '@playwright/test';
import { expect, test as base } from '@playwright/test';

import type { WorkerServer } from './helpers/worker-server';
import { startWorkerServer, stopWorkerServer } from './helpers/worker-server';

// ── Fixture types ─────────────────────────────────────────

type WorkerFixtures = {
  /** Each worker spawns its own SvelteKit dev server. */
  workerServer: WorkerServer;
  /** Base URL derived from the worker server port. */
  workerBaseURL: string;
};

type TestFixtures = {
  /** Override built-in context with the worker-specific baseURL. */
  context: BrowserContext;
  /** Override built-in request context with the worker-specific baseURL. */
  request: APIRequestContext;
};

// ── Custom test ───────────────────────────────────────────

export const test = base.extend<TestFixtures, WorkerFixtures>({
  // ── Worker-scoped fixtures ────────────────────────────────

  /**
   * Auto fixture: starts a SvelteKit dev server for this Playwright
   * worker and stops it when the worker scope ends (even on test failure).
   */
  workerServer: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use, workerInfo) => {
      const server = await startWorkerServer({
        workerIndex: workerInfo.workerIndex,
        parallelIndex: workerInfo.parallelIndex,
      });
      await use(server);
      await stopWorkerServer(server);
    },
    { scope: 'worker', auto: true },
  ],

  /**
   * Worker-scoped base URL derived from the worker server.
   * Used by the context and request fixtures below.
   */
  workerBaseURL: [
    async ({ workerServer }, use) => {
      await use(workerServer.baseURL);
    },
    { scope: 'worker' },
  ],

  // ── Test-scoped fixtures (override built-ins) ─────────────

  /**
   * Override the built-in context fixture so that every page in a test
   * navigates relative to the worker's server.
   */
  context: [
    async ({ browser, workerBaseURL }, use) => {
      const ctx = await browser.newContext({ baseURL: workerBaseURL });
      await use(ctx);
      await ctx.close();
    },
    { scope: 'test' },
  ],

  /**
   * Override the built-in request fixture so that API calls target the
   * worker's server. Disposed after each test.
   */
  request: [
    async ({ playwright, workerBaseURL }, use) => {
      const ctx = await playwright.request.newContext({
        baseURL: workerBaseURL,
      });
      await use(ctx);
      await ctx.dispose();
    },
    { scope: 'test' },
  ],
});

export { expect };
