import type { Page } from '@playwright/test';

import { createRequestTracker, type RequestTracker } from './request-tracking';

/**
 * Performance instrumentation for interaction baselines.
 *
 * Installs page-side observers (long tasks + fetch/XHR resource timing) via
 * `addInitScript` and provides an `InteractionRecorder` that measures the
 * four latency metrics defined by the fast-menu feature:
 *
 * - trigger → shell visible
 * - trigger → focus/interactive
 * - trigger → first useful content
 * - trigger → settled (no in-flight API requests and no recent long task)
 *
 * All deltas are computed in the page's own `performance.now()` clock so the
 * timing origin matches the observed events. Measurements are recorded only:
 * this helper never asserts budgets (budgets are user decisions after the
 * baseline exists).
 */

const SETTLED_QUIET_MS = 300;
const SETTLED_POLL_MS = 50;
const SETTLED_TIMEOUT_MS = 15_000;

export interface LongTaskEntry {
  startTime: number;
  duration: number;
}

export interface ResourceEntry {
  name: string;
  startTime: number;
  duration: number;
}

interface PageInstruments {
  longTasks: LongTaskEntry[];
  resources: ResourceEntry[];
}

export interface InteractionSamples {
  /** ms since start when the shell/panel became visible. */
  shellVisibleMs: number;
  /** ms since start when the interactive element received focus. */
  focusMs: number;
  /** ms since start when the first data-driven content rendered. */
  firstContentMs: number;
}

export interface InteractionMeasurements extends InteractionSamples {
  settledMs: number;
  requestCount: number;
  longTasks: number;
  pageErrors: number;
}

export interface InteractionRecorder {
  /** Record the interaction start time (page clock) and reset counters. */
  start(): Promise<number>;
  /** Milliseconds since the last `start()` in the page clock. */
  since(): Promise<number>;
  /** Wait until no API request is in flight and no long task ran recently. */
  settled(): Promise<number>;
  /** Assemble the full measurement set for the interaction. */
  read(samples: InteractionSamples): Promise<InteractionMeasurements>;
  /** Node-side request tracker for the interaction window. */
  tracker(): RequestTracker;
}

/**
 * Install long-task and resource-timing observers. Runs on every navigation
 * via `addInitScript`; each fresh document gets its own collector.
 */
export async function installPerformanceInstrumentation(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const instruments: PageInstruments = { longTasks: [], resources: [] };
    (window as unknown as { __diffscribePerf?: PageInstruments }).__diffscribePerf = instruments;

    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          instruments.longTasks.push({ startTime: entry.startTime, duration: entry.duration });
        }
      }).observe({ type: 'longtask', buffered: true });
    } catch {
      // longtask observer unsupported — baseline records zero long tasks.
    }

    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as PerformanceResourceTiming[]) {
          if (entry.initiatorType === 'fetch' || entry.initiatorType === 'xmlhttprequest') {
            instruments.resources.push({
              name: entry.name,
              startTime: entry.startTime,
              duration: entry.duration,
            });
          }
        }
      }).observe({ type: 'resource', buffered: true });
    } catch {
      // resource timing unsupported — baseline records no resources.
    }
  });
}

/**
 * Create an interaction recorder bound to a page. The recorder counts API
 * requests and page errors from the moment it is created; `start()` resets
 * the per-interaction window.
 */
export async function createInteractionRecorder(page: Page): Promise<InteractionRecorder> {
  await installPerformanceInstrumentation(page);
  const tracker = createRequestTracker(page);
  let t0 = 0;
  let lastSettledMs = 0;

  return {
    async start(): Promise<number> {
      tracker.reset();
      t0 = await page.evaluate(() => performance.now());
      lastSettledMs = 0;
      return t0;
    },
    async since(): Promise<number> {
      const now = await page.evaluate(() => performance.now());
      return Math.max(0, now - t0);
    },
    async settled(): Promise<number> {
      const deadline = Date.now() + SETTLED_TIMEOUT_MS;
      for (;;) {
        const longTasks = await readLongTasks(page);
        const lastLongTaskEnd =
          longTasks.length > 0
            ? longTasks[longTasks.length - 1].startTime + longTasks[longTasks.length - 1].duration
            : -Infinity;
        const nowPage = await page.evaluate(() => performance.now());
        const quiet = tracker.inFlight() === 0 && nowPage - lastLongTaskEnd >= SETTLED_QUIET_MS;
        if (quiet) {
          lastSettledMs = Math.max(0, nowPage - t0);
          return lastSettledMs;
        }
        if (Date.now() >= deadline) {
          lastSettledMs = Math.max(0, nowPage - t0);
          return lastSettledMs;
        }
        await sleep(SETTLED_POLL_MS);
      }
    },
    async read(samples: InteractionSamples): Promise<InteractionMeasurements> {
      return {
        ...samples,
        settledMs: lastSettledMs,
        requestCount: tracker.count(() => true),
        longTasks: (await readLongTasks(page)).length,
        pageErrors: tracker.pageErrors(),
      };
    },
    tracker(): RequestTracker {
      return tracker;
    },
  };
}

async function readLongTasks(page: Page): Promise<LongTaskEntry[]> {
  return page.evaluate(() => {
    const instruments = (window as unknown as { __diffscribePerf?: PageInstruments })
      .__diffscribePerf;
    return instruments ? instruments.longTasks : [];
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
