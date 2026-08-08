import type { Page } from '@playwright/test';

/**
 * Per-interaction API request counting and page-error tracking for E2E
 * performance baselines.
 *
 * The tracker attaches to a page once and counts every request whose URL
 * contains `/api/`. `reset()` opens a new interaction window: call it right
 * before the user action and read the counters after the interaction settled.
 * Page errors are counted from the `pageerror` event.
 */

export interface TrackedRequest {
  url: string;
  method: string;
  startedAt: number;
  settledAt: number | null;
}

export interface RequestTracker {
  /** All tracked API requests since creation (or the last reset). */
  requests(): TrackedRequest[];
  /** Count of tracked requests matching the predicate. */
  count(predicate: (request: TrackedRequest) => boolean): number;
  /** API requests still in flight (started, not yet settled). */
  inFlight(): number;
  /** Page errors since creation (or the last reset). */
  pageErrors(): number;
  /** Reset the interaction window: clears requests and error counts. */
  reset(): void;
}

export function createRequestTracker(page: Page): RequestTracker {
  const apiRequests: TrackedRequest[] = [];
  let errors = 0;

  const onRequest = (request: { url(): string; method(): string }): void => {
    const url = request.url();
    if (!url.includes('/api/')) return;
    apiRequests.push({
      url,
      method: request.method(),
      startedAt: Date.now(),
      settledAt: null,
    });
  };

  const onSettled = (request: { url(): string }): void => {
    const url = request.url();
    if (!url.includes('/api/')) return;
    const found = [...apiRequests].reverse().find((r) => r.url === url && r.settledAt === null);
    if (found) found.settledAt = Date.now();
  };

  const onPageError = (): void => {
    errors += 1;
  };

  page.on('request', onRequest);
  page.on('requestfinished', onSettled);
  page.on('requestfailed', onSettled);
  page.on('pageerror', onPageError);

  return {
    requests(): TrackedRequest[] {
      return [...apiRequests];
    },
    count(predicate: (request: TrackedRequest) => boolean): number {
      return apiRequests.filter(predicate).length;
    },
    inFlight(): number {
      return apiRequests.filter((r) => r.settledAt === null).length;
    },
    pageErrors(): number {
      return errors;
    },
    reset(): void {
      apiRequests.length = 0;
      errors = 0;
    },
  };
}
