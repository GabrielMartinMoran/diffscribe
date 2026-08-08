/**
 * Additive E2E worker telemetry (0005-workspace-management-e2e-flake).
 *
 * Records worker metadata, the first page error, and the status of
 * JavaScript resources for a page, so a flaky E2E failure carries enough
 * context to diagnose readiness/cleanup/load issues. This module is
 * strictly additive: it never changes test behavior, only observes it.
 */

export interface WorkerTelemetryContext {
  /** Sequential worker index (0-based). */
  readonly workerIndex: number;
  /** Playwright parallelIndex (0-based). */
  readonly parallelIndex: number;
  /** Port the worker server listens on. */
  readonly port: number;
  /** Base URL of the worker server. */
  readonly baseURL: string;
  /** Latest stderr snapshot of the worker server process. */
  readonly stderrSnapshot: () => string;
}

export interface FailedJsResource {
  readonly url: string;
  readonly status: number;
}

export interface WorkerTelemetrySnapshot {
  readonly workerIndex: number;
  readonly parallelIndex: number;
  readonly port: number;
  readonly baseURL: string;
  readonly stderrSnapshot: string;
  /** Message of the first `pageerror`, or `null` when none occurred. */
  readonly firstPageError: string | null;
  /** Number of JavaScript resources observed. */
  readonly jsResourceCount: number;
  /** JavaScript resources that failed with an HTTP status >= 400. */
  readonly failedJsResources: readonly FailedJsResource[];
}

export interface WorkerTelemetryRecorder {
  snapshot(): WorkerTelemetrySnapshot;
  reset(): void;
}

/**
 * Minimal event surface needed from the page: `pageerror` and `response`
 * events. Playwright's `Page` satisfies it structurally.
 */
export interface WorkerTelemetryEventSource {
  on(event: 'pageerror', listener: (error: Error) => void): unknown;
  on(event: 'response', listener: (response: { url(): string; status(): number }) => void): unknown;
}

const JS_RESOURCE_PATTERN = /\.(?:js|mjs)(?:\?|$)/;

/**
 * Attach additive worker telemetry to a page.
 *
 * @param page - the page to observe (Playwright `Page` or a simulated event source).
 * @param context - worker metadata and a stderr snapshot accessor.
 */
export function createWorkerTelemetry(
  page: WorkerTelemetryEventSource,
  context: WorkerTelemetryContext,
): WorkerTelemetryRecorder {
  const pageErrors: string[] = [];
  const failedJsResources: FailedJsResource[] = [];
  let jsResourceCount = 0;

  page.on('pageerror', (error: Error) => {
    pageErrors.push(error.message);
  });

  page.on('response', (response: { url(): string; status(): number }) => {
    const url = response.url();
    if (!JS_RESOURCE_PATTERN.test(url)) return;
    jsResourceCount += 1;
    const status = response.status();
    if (status >= 400) {
      failedJsResources.push({ url, status });
    }
  });

  return {
    snapshot(): WorkerTelemetrySnapshot {
      return {
        workerIndex: context.workerIndex,
        parallelIndex: context.parallelIndex,
        port: context.port,
        baseURL: context.baseURL,
        stderrSnapshot: context.stderrSnapshot(),
        firstPageError: pageErrors[0] ?? null,
        jsResourceCount,
        failedJsResources: [...failedJsResources],
      };
    },
    reset(): void {
      pageErrors.length = 0;
      failedJsResources.length = 0;
      jsResourceCount = 0;
    },
  };
}
