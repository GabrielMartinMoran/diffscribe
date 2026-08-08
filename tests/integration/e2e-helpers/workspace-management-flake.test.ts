import { describe, expect, it } from 'vitest';

import {
  type EnhanceObserverSnapshot,
  type EnhanceObserverState,
  type EnhanceObserverWindowLike,
  installEnhanceObserver,
} from '../../e2e/helpers/enhance-diagnostics';
import { openWorkspaceForm, submitRegistration } from '../../e2e/helpers/register-workspace';
import { createWorkerTelemetry } from '../../e2e/helpers/worker-telemetry';

// ── Simulated page (no browser) ─────────────────────────────
//
// The canonical registration barrier is exercised against a deterministic
// fake page that models the SvelteKit deferred-invalidation timing: the form
// action succeeds, `networkidle` can be reached, but the deferred
// `__data.json` response (from `invalidateAll()` inside `use:enhance`) and
// the sidebar DOM update happen afterwards. The fake gives the test manual
// control over exactly when those deferred steps complete, so the race from
// 0005 is reproducible without a browser.

type WaitForSelectorOptions = {
  state?: 'attached' | 'detached' | 'hidden' | 'visible';
  timeout?: number;
};

class FakeRegistrationPage {
  /** Whether the submit click has been performed. */
  submitted = false;
  /** Number of submit clicks performed (sequential registrations). */
  submits = 0;
  /**
   * Set when a submit click happens while a gated `networkidle` is still
   * pending — the fresh-form race of the sequential registration pattern.
   */
  settlingAtSubmit = false;
  /** Whether the deferred `__data.json` response has arrived. */
  dataJsonResolved = false;
  /** Whether the registered sidebar item has become visible. */
  sidebarItemVisible = false;
  /**
   * When `true`, `waitForLoadState('networkidle')` does not resolve until
   * `simulateNetworkSettled()` is called — models the revalidation traffic
   * the page fires AFTER the deferred `__data.json` response (0005 load
   * flake). Defaults to `false` so existing barrier tests are unaffected.
   */
  gateNetworkidle = false;
  networkSettled = false;
  /**
   * Whether the enhanced submit listener is attached to the workspace form.
   * When `false`, the enhanced-submit readiness guard must fail fast with
   * diagnostics instead of letting the form submit natively.
   */
  enhanceReady = true;
  /**
   * When `false`, `waitForFunction` (enhance-readiness probe) resolves only
   * after `simulateEnhanceReady()` — models the enhanced listener attaching
   * late under load.
   */
  gateEnhanceReady = false;
  enhanceReadyNow = false;
  /**
   * When set, a pending `__data.json` barrier rejects after this many
   * milliseconds — simulates the bounded-barrier timeout expiring because
   * the deferred response never arrived.
   */
  barrierRejectAfterMs: number | null = null;
  /** Gated networkidle currently awaiting the settle. */
  private networkidlePending = false;
  /** Ordered record of barrier/submit interactions. */
  readonly actionLog: string[] = [];
  /**
   * Current form input values. The real form is unmounted after a successful
   * submit (onRegistered closes it), so a freshly opened form starts empty —
   * the fresh-form contract of sequential registrations.
   */
  inputValues: { path: string; name: string } = { path: '', name: '' };
  private readonly dataJsonWaiters: Array<() => void> = [];
  getByTestId(testId: string): { click(): Promise<void>; isVisible(): Promise<boolean> } {
    if (testId === 'open-workspace-toggle') {
      return {
        click: async () => {
          this.actionLog.push('toggle');
        },
        isVisible: async () => true,
      };
    }
    throw new Error(`Unexpected getByTestId: ${testId}`);
  }

  locator(selector: string): { isVisible(): Promise<boolean> } {
    if (selector === '[data-testid="open-workspace-form"]') {
      // The form is closed when the helper starts (the helper must toggle).
      return { isVisible: async () => false };
    }
    throw new Error(`Unexpected locator: ${selector}`);
  }

  async waitForSelector(selector: string, options?: WaitForSelectorOptions): Promise<unknown> {
    if (selector === '[data-testid="open-workspace-form"]') {
      return true;
    }
    if (selector.includes('#workspace-sidebar li:has-text')) {
      const deadline = Date.now() + (options?.timeout ?? 2000);
      while (!this.sidebarItemVisible) {
        if (Date.now() > deadline) {
          throw new Error(`FakeRegistrationPage: sidebar item never became visible (${selector})`);
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      return true;
    }
    throw new Error(`Unexpected waitForSelector: ${selector}`);
  }

  async fill(selector: string, value: string): Promise<void> {
    this.actionLog.push(`fill:${value}`);
    if (selector === '#ws-path') {
      this.inputValues.path = value;
    }
    if (selector === '#ws-name') {
      this.inputValues.name = value;
    }
  }

  async click(selector: string): Promise<void> {
    if (selector.includes('submit')) {
      if (this.networkidlePending) {
        this.settlingAtSubmit = true;
      }
      this.actionLog.push('submit');
      this.submitted = true;
      this.submits += 1;
      // Model the real form closing after a successful registration: the
      // next opened form starts fresh (empty inputs).
      this.inputValues = { path: '', name: '' };
      return;
    }
    throw new Error(`Unexpected click: ${selector}`);
  }

  async waitForResponse(
    predicate: (response: { url(): string; request(): { method(): string } }) => boolean,
    options?: { timeout?: number },
  ): Promise<unknown> {
    void predicate;
    this.actionLog.push(
      options?.timeout !== undefined ? `barrier:timeout:${options.timeout}` : 'barrier',
    );
    return new Promise<void>((resolve, reject) => {
      this.dataJsonWaiters.push(() => resolve());
      if (this.barrierRejectAfterMs !== null) {
        setTimeout(
          () => reject(new Error('TimeoutError: waiting for __data.json response')),
          this.barrierRejectAfterMs,
        );
      }
    });
  }

  async waitForLoadState(state: string): Promise<void> {
    void state;
    // `networkidle` is the ONLY completion signal of the legacy helper.
    this.actionLog.push('networkidle');
    if (!this.gateNetworkidle) return;
    // 0005: after the deferred __data.json response the page fires
    // revalidation traffic; networkidle only settles once it finished.
    this.networkidlePending = true;
    const deadline = Date.now() + 2000;
    while (!this.networkSettled) {
      if (Date.now() > deadline) {
        throw new Error('FakeRegistrationPage: networkidle never settled');
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    this.networkidlePending = false;
  }

  async evaluate<T, TArg>(script: string | ((arg: TArg) => T), arg?: TArg): Promise<T> {
    void script;
    void arg;
    this.actionLog.push('evaluate');
    return undefined as T;
  }

  async waitForFunction<TArg>(
    script: string | ((arg: TArg) => boolean),
    _arg?: TArg,
    options?: { timeout?: number },
  ): Promise<unknown> {
    void _arg;
    this.actionLog.push('waitForFunction');
    if (typeof script === 'function' && !this.enhanceReady) {
      // The enhanced submit listener never attaches: the readiness guard
      // must time out with diagnostics instead of submitting natively.
      const deadline = Date.now() + Math.min(options?.timeout ?? 2000, 2000);
      while (!this.enhanceReadyNow) {
        if (Date.now() > deadline) {
          throw new Error('TimeoutError: waiting for enhanced submit listener');
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      return true;
    }
    if (this.gateEnhanceReady && !this.enhanceReadyNow) {
      const deadline = Date.now() + Math.min(options?.timeout ?? 2000, 2000);
      while (!this.enhanceReadyNow) {
        if (Date.now() > deadline) {
          throw new Error('TimeoutError: waiting for enhanced submit listener');
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    }
    return true;
  }

  /** The enhanced submit listener attaches (late under load). */
  simulateEnhanceReady(): void {
    this.enhanceReadyNow = true;
  }

  /** The deferred `__data.json` response arrives. */
  simulateDataJsonResponse(): void {
    this.dataJsonResolved = true;
    for (const resolve of this.dataJsonWaiters.splice(0)) {
      resolve();
    }
  }

  /** The registered workspace becomes visible in the sidebar. */
  simulateSidebarItemVisible(): void {
    this.sidebarItemVisible = true;
  }

  /** The post-`__data.json` revalidation traffic settles (networkidle). */
  simulateNetworkSettled(): void {
    this.networkSettled = true;
  }

  /**
   * Gated networkidle currently pending (a registration is still settling).
   * Read-only for tests that assert the sequential-registration ordering.
   */
  get isSettling(): boolean {
    return this.networkidlePending;
  }
}

// ── Legacy semantics under test in the RED regression ────────
//
// Faithful reproduction of the CURRENT local helper in
// `tests/e2e/workspace-management.spec.ts` (pre-canonical-helper): after the
// submit it waits for `networkidle` and nothing else.

async function registerWithNetworkidleOnly(
  page: FakeRegistrationPage,
  repoPath: string,
  name: string,
): Promise<void> {
  await page.getByTestId('open-workspace-toggle').click();
  await page.waitForSelector('[data-testid="open-workspace-form"]', { state: 'visible' });
  await page.fill('#ws-path', repoPath);
  await page.fill('#ws-name', name);
  await page.click('#open-workspace-form button[type="submit"]');
  await page.waitForLoadState('networkidle');
}

async function waitUntil(predicate: () => boolean, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) {
      throw new Error('waitUntil: condition never became true');
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

// ── @h2: post-submit registration barrier ────────────────────

describe('registration helper barrier (@h2)', () => {
  it('doc: legacy networkidle-only semantics resolve before the deferred __data.json response (documented race)', async () => {
    const page = new FakeRegistrationPage();

    // Documentation of the historical 0005 race: the networkidle-only
    // semantics return BEFORE the deferred __data.json response arrives.
    // The canonical helper fixes this — asserted by the ordering-contract
    // tests below. This test pins the legacy behavior so the race stays
    // documented instead of silent.
    await registerWithNetworkidleOnly(page, '/tmp/repo', 'E2E-RED');

    expect(page.dataJsonResolved).toBe(false);
  });

  it('@h2: the __data.json response barrier is registered before the submit', async () => {
    const page = new FakeRegistrationPage();

    const registration = submitRegistration(page, '/tmp/repo', 'E2E-WS');
    await waitUntil(() => page.submitted, 2000);

    const barrierIdx = page.actionLog.findIndex((entry) => entry.startsWith('barrier'));
    const submitIdx = page.actionLog.indexOf('submit');
    expect(barrierIdx, 'barrier must be registered').toBeGreaterThan(-1);
    expect(barrierIdx).toBeLessThan(submitIdx);

    page.simulateDataJsonResponse();
    page.simulateSidebarItemVisible();
    await registration;
  });

  it('@h2: does not resolve until the deferred __data.json response and the sidebar DOM assertion complete', async () => {
    const page = new FakeRegistrationPage();
    let completed = false;
    const registration = submitRegistration(page, '/tmp/repo', 'E2E-WS').then(() => {
      completed = true;
    });

    // The form has been submitted and `networkidle` would already be
    // reachable, but the deferred invalidation response has not arrived.
    await waitUntil(() => page.submitted, 2000);
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(
      completed,
      'registration completed before the deferred __data.json response (networkidle-only race)',
    ).toBe(false);

    // The deferred response arrives, then the sidebar item becomes visible.
    page.simulateDataJsonResponse();
    page.simulateSidebarItemVisible();

    await registration;
    expect(page.dataJsonResolved).toBe(true);
    expect(page.sidebarItemVisible).toBe(true);
    expect(completed).toBe(true);
  });

  it('RED: registration must not complete while the page is still settling after the __data.json response', async () => {
    // The page fires revalidation traffic after the deferred __data.json
    // response (invalid sidebar items, lazy modules); under full-suite
    // load the clicks that follow a too-early return hang until the test
    // timeout. The helper must wait for the page to settle (networkidle
    // as a PRECONDITION, never the sole completion signal).
    const page = new FakeRegistrationPage();
    page.gateNetworkidle = true;
    let completed = false;
    const registration = submitRegistration(page, '/tmp/repo', 'E2E-WS').then(() => {
      completed = true;
    });

    await waitUntil(() => page.submitted, 2000);
    page.simulateDataJsonResponse();
    page.simulateSidebarItemVisible();
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(
      completed,
      'registration completed before the page settled after the __data.json response (post-registration click hang)',
    ).toBe(false);

    page.simulateNetworkSettled();
    await registration;
    expect(completed).toBe(true);
  });

  it('RED: the registration barrier is bounded and reports the missing deferred response', async () => {
    // The __data.json barrier must be installed with an explicit timeout:
    // when the deferred response never arrives (slow worker under load),
    // the helper must fail fast with a readable error instead of hanging
    // until the test timeout.
    const page = new FakeRegistrationPage();
    page.barrierRejectAfterMs = 100;
    const registration = submitRegistration(page, '/tmp/repo', 'E2E-WS');

    await waitUntil(() => page.submitted, 2000);

    const outcome = await Promise.race([
      registration.then(
        () => 'resolved' as const,
        (err: unknown) => `rejected:${err instanceof Error ? err.message : String(err)}`,
      ),
      new Promise<'pending'>((resolve) => setTimeout(() => resolve('pending'), 300)),
    ]);

    expect(
      outcome,
      'registration barrier is not bounded: the helper hangs when the deferred __data.json never arrives',
    ).not.toBe('pending');
    expect(outcome).toContain('never arrived');
  });

  it('doc: a second registration submitted while the first is still settling (documented race)', async () => {
    // Documentation of the sequential-registration race
    // (workspace-registration.spec.ts:175): launching a second registration
    // while the first is still settling DOES submit early — the fresh form
    // it opened can be torn down mid-flight. Sequential specs must await the
    // first registration (canonical pattern); the ordering-contract test
    // below asserts the correct behavior.
    const page = new FakeRegistrationPage();
    page.gateNetworkidle = true;

    const first = submitRegistration(page, '/tmp/repo-1', 'E2E-1');
    await waitUntil(() => page.submitted, 2000);
    page.simulateDataJsonResponse();
    page.simulateSidebarItemVisible();
    // The first registration is now awaiting the settle (networkidle gate).

    const second = submitRegistration(page, '/tmp/repo-2', 'E2E-2');
    await waitUntil(() => page.submits >= 2, 2000);

    // The race is documented: the second submit happened while the first
    // registration was still settling.
    expect(page.settlingAtSubmit).toBe(true);

    page.simulateNetworkSettled();
    await first;
    page.simulateDataJsonResponse();
    page.simulateSidebarItemVisible();
    await second;
  });

  it('a second registration started after the first settled never submits while settling', async () => {
    const page = new FakeRegistrationPage();
    page.gateNetworkidle = true;

    // First registration completes fully (including the settle) before the
    // second one starts — the canonical sequential-registration pattern.
    const first = submitRegistration(page, '/tmp/repo-1', 'E2E-1');
    await waitUntil(() => page.submitted, 2000);
    page.simulateDataJsonResponse();
    page.simulateSidebarItemVisible();
    page.simulateNetworkSettled();
    await first;

    const second = submitRegistration(page, '/tmp/repo-2', 'E2E-2');
    await waitUntil(() => page.submits >= 2, 2000);

    expect(page.settlingAtSubmit, 'second registration raced the first settle').toBe(false);

    page.simulateDataJsonResponse();
    page.simulateSidebarItemVisible();
    await second;
    expect(page.submits).toBe(2);
  });

  it('RED: submitRegistration fails fast with diagnostics when the form has no enhanced submit listener', async () => {
    // D20 guard: before submitting, the workspace form must have its
    // enhanced submit listener attached. Without it the submit would
    // navigate natively (no __data.json, torn-down DOM). The guard must
    // fail fast with form/action diagnostics and NEVER submit natively.
    const page = new FakeRegistrationPage();
    page.enhanceReady = false;

    const outcome = await Promise.race([
      submitRegistration(page, '/tmp/repo', 'E2E-WS').then(
        () => 'resolved' as const,
        (err: unknown) => `rejected:${err instanceof Error ? err.message : String(err)}`,
      ),
      new Promise<'pending'>((resolve) => setTimeout(() => resolve('pending'), 3000)),
    ]);

    expect(
      outcome,
      'submitRegistration must reject when the enhanced submit listener is missing (native-navigation guard)',
    ).not.toBe('pending');
    expect(outcome).toContain('Enhanced submit not ready');
    expect(outcome).toContain('?/register');
    // No native navigation: the submit click never happened.
    expect(page.submits).toBe(0);
  });

  it('the enhanced submit readiness guard waits for the listener when it attaches late', async () => {
    const page = new FakeRegistrationPage();
    page.gateEnhanceReady = true;

    let completed = false;
    const registration = submitRegistration(page, '/tmp/repo', 'E2E-WS').then(() => {
      completed = true;
    });

    // The form is filled but the enhanced listener has not attached yet:
    // the helper must still be pending (no native submit).
    await waitUntil(() => page.actionLog.includes('waitForFunction'), 2000);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(page.submits).toBe(0);
    expect(completed).toBe(false);

    // The listener attaches late (under load): the guard proceeds.
    page.simulateEnhanceReady();
    await waitUntil(() => page.submitted, 2000);
    page.simulateDataJsonResponse();
    page.simulateSidebarItemVisible();
    await registration;
    expect(page.submits).toBe(1);
  });

  it('RED: sequential registrations open a fresh form with empty inputs after the first registration settles', async () => {
    // The sequential-registration contract (workspace-registration.spec.ts:175):
    // first registration settles completely, then the second registration
    // opens a FRESH form (empty path/name) and submits. Requires the
    // open-only helper `openWorkspaceForm` so the empty-input assertion is
    // expressible between registrations.
    const page = new FakeRegistrationPage();
    page.gateNetworkidle = true;

    // First registration settles completely.
    const first = submitRegistration(page, '/tmp/repo-1', 'E2E-1');
    await waitUntil(() => page.submitted, 2000);
    page.simulateDataJsonResponse();
    page.simulateSidebarItemVisible();
    page.simulateNetworkSettled();
    await first;

    // Second registration: the form opens fresh — inputs are empty again.
    await openWorkspaceForm(page);
    expect(page.inputValues.path, 'second form must open with an empty path (fresh form)').toBe('');
    expect(page.inputValues.name, 'second form must open with an empty name (fresh form)').toBe('');

    // Second registration fills and submits without racing the settle.
    const second = submitRegistration(page, '/tmp/repo-2', 'E2E-2');
    await waitUntil(() => page.submits >= 2, 2000);
    expect(page.settlingAtSubmit, 'second registration raced the first settle').toBe(false);
    page.simulateDataJsonResponse();
    page.simulateSidebarItemVisible();
    await second;
    expect(page.submits).toBe(2);
  });
});

// ── @observation-crud: response ordering under barriers ──────

type ObservationPredicate = (response: {
  url(): string;
  request(): { method(): string };
}) => boolean;

/**
 * Deterministic model of the observation panel (read-only reference: the
 * real component owns the fetch order). The create flow is: POST (201) →
 * panel invalidates → reload GET (200) → card list refresh. A networkidle
 * signal can resolve between the POST and the reload GET, so it is never a
 * sufficient completion signal.
 */
class FakeObservationPage {
  cards: { id: string }[] = [];
  private readonly waiters: Array<{
    predicate: ObservationPredicate;
    resolve: (value: { status: number }) => void;
  }> = [];

  waitForResponse(predicate: ObservationPredicate): Promise<{ status: number }> {
    return new Promise((resolve) => {
      this.waiters.push({ predicate, resolve });
    });
  }

  /** The POST /observations response arrives (201); the reload GET stays pending. */
  submitCreate(): void {
    this.deliver('POST', '/api/workspaces/w/reviews/r/observations', 201);
  }

  /** The reload GET completes and the refreshed list is observable. */
  simulateReload(): void {
    this.deliver('GET', '/api/workspaces/w/reviews/r/observations', 200);
    this.cards = [{ id: 'obs-1' }];
  }

  /** The DELETE response arrives (204) and the card is removed. */
  deleteCard(): void {
    this.deliver('DELETE', '/api/workspaces/w/reviews/r/observations/obs-1', 204);
    this.cards = [];
  }

  /** The generic networkidle signal — resolves regardless of pending reloads. */
  async networkidle(): Promise<void> {
    // no-op: the reload GET may still be pending
  }

  private deliver(method: string, url: string, status: number): void {
    const index = this.waiters.findIndex((waiter) =>
      waiter.predicate({
        url: () => url,
        request: () => ({ method: () => method }),
      }),
    );
    if (index !== -1) {
      this.waiters.splice(index, 1)[0].resolve({ status });
    }
  }
}

describe('observation CRUD ordering (@observation-crud)', () => {
  it('doc: networkidle-only observation assertion resolves before the reload GET (documented race)', async () => {
    const page = new FakeObservationPage();

    // Documentation of the observation race: the create POST answered (201)
    // but the reload GET is still pending when the networkidle-only signal
    // resolves — the card assertion would see an empty list. The
    // response-barrier ordering contract is asserted by the test below
    // (networkidle-only race: never a sufficient completion signal).
    page.submitCreate();
    await page.networkidle();

    expect(page.cards).toHaveLength(0);
  });

  it('asserts the card only after the create POST and the reload GET (ordering contract)', async () => {
    const page = new FakeObservationPage();

    const createPost = page.waitForResponse(
      (r) => r.url().includes('/observations') && r.request().method() === 'POST',
    );
    const reloadGet = page.waitForResponse(
      (r) => r.url().includes('/observations') && r.request().method() === 'GET',
    );

    page.submitCreate();
    await createPost;
    // The reload GET must complete before the card assertion runs.
    page.simulateReload();
    await reloadGet;

    expect(page.cards).toHaveLength(1);
  });

  it('asserts the card removal only after the DELETE response (204)', async () => {
    const page = new FakeObservationPage();
    page.cards = [{ id: 'obs-1' }];

    const deleteResponse = page.waitForResponse(
      (r) => r.url().includes('/observations/') && r.request().method() === 'DELETE',
    );

    page.deleteCard();
    await deleteResponse;

    expect(page.cards).toHaveLength(0);
  });
});

// ── @diagnostics: failure telemetry ──────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TelemetryListener = (...args: any[]) => void;

class FakeTelemetryPage {
  private readonly listeners: Record<string, TelemetryListener[]> = {
    pageerror: [],
    response: [],
  };

  on(event: 'pageerror' | 'response', listener: TelemetryListener): this {
    this.listeners[event].push(listener);
    return this;
  }

  emitPageError(message: string): void {
    for (const listener of this.listeners['pageerror']) {
      listener(new Error(message));
    }
  }

  emitResponse(url: string, status: number): void {
    for (const listener of this.listeners['response']) {
      listener({ url: () => url, status: () => status });
    }
  }
}

describe('worker telemetry (@diagnostics)', () => {
  it('@diagnostics: records worker context, stderr snapshot, first page error, and failed JS resources', () => {
    const page = new FakeTelemetryPage();
    let stderr = 'VITE ready in 123 ms';

    const telemetry = createWorkerTelemetry(page, {
      workerIndex: 2,
      parallelIndex: 3,
      port: 5176,
      baseURL: 'http://127.0.0.1:5176',
      stderrSnapshot: () => stderr,
    });

    page.emitResponse('http://127.0.0.1:5176/assets/index-abc.js', 200);
    page.emitResponse('http://127.0.0.1:5176/assets/chunk-xyz.js', 503);
    page.emitPageError('Hydration failed: missing anchor');
    stderr = 'VITE ready in 456 ms';

    const snapshot = telemetry.snapshot();

    expect(snapshot.workerIndex).toBe(2);
    expect(snapshot.parallelIndex).toBe(3);
    expect(snapshot.port).toBe(5176);
    expect(snapshot.baseURL).toBe('http://127.0.0.1:5176');
    expect(snapshot.stderrSnapshot).toBe('VITE ready in 456 ms');
    expect(snapshot.firstPageError).toBe('Hydration failed: missing anchor');
    expect(snapshot.jsResourceCount).toBe(2);
    expect(snapshot.failedJsResources).toEqual([
      { url: 'http://127.0.0.1:5176/assets/chunk-xyz.js', status: 503 },
    ]);
  });

  it('@diagnostics: reset clears page errors and resource status', () => {
    const page = new FakeTelemetryPage();
    const telemetry = createWorkerTelemetry(page, {
      workerIndex: 0,
      parallelIndex: 0,
      port: 5173,
      baseURL: 'http://127.0.0.1:5173',
      stderrSnapshot: () => '',
    });

    page.emitPageError('first');
    page.emitResponse('http://127.0.0.1:5173/assets/chunk-a.js', 404);

    telemetry.reset();

    const snapshot = telemetry.snapshot();
    expect(snapshot.firstPageError).toBeNull();
    expect(snapshot.failedJsResources).toHaveLength(0);
    expect(snapshot.jsResourceCount).toBe(0);
  });
});

// ── @enhance-diagnostics: deterministic observer lifecycle ──
//
// Deterministic fake DOM for the enhance observer (0005 D21/D22): the
// observer patches the form prototype's add/removeEventListener and listens
// for bubble-phase submits on the window. The fake models the same surfaces:
// a shared form prototype (patched at install time), per-form listener sets
// (target phase) and window-level submit listeners (bubble phase, AFTER the
// form's own listeners so `defaultPrevented` is final). No browser, no
// network — the lifecycle ordering from the H2 hypothesis is reproducible.

type FakePrototypeSurface = {
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): unknown;
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): unknown;
};

class FakeObserverForm {
  isConnected = true;
  /** Target-phase listeners (the application's enhanced submit listeners). */
  readonly listeners = new Set<EventListener>();

  constructor(private readonly prototypeSurface: FakePrototypeSurface) {}

  addListener(type: string, listener: EventListener): void {
    this.listeners.add(listener);
    this.prototypeSurface.addEventListener.call(this, type, listener);
  }

  removeListener(type: string, listener: EventListener): void {
    this.listeners.delete(listener);
    this.prototypeSurface.removeEventListener.call(this, type, listener);
  }
}

type FakeSubmitEventRecord = {
  defaultPrevented: boolean;
  submitter: unknown;
  target: FakeObserverForm;
  preventDefaultCalls: number;
};

class FakeObserverPage {
  /** Shared form prototype; the observer replaces its add/removeEventListener. */
  readonly formPrototype: FakePrototypeSurface = {
    addEventListener: (
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions,
    ): unknown => {
      void type;
      void listener;
      void options;
      return undefined;
    },
    removeEventListener: (
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions,
    ): unknown => {
      void type;
      void listener;
      void options;
      return undefined;
    },
  };
  readonly window: EnhanceObserverWindowLike;
  /** Bubble-phase listeners registered on the window (the observer's). */
  private readonly bubbleListeners = new Set<EventListener>();

  constructor() {
    this.window = {
      addEventListener: (type: string, listener: EventListener): unknown => {
        if (type === 'submit') {
          this.bubbleListeners.add(listener);
        }
        return undefined;
      },
      formPrototype: this.formPrototype,
      __enhanceObserver: undefined,
    };
  }

  install(): void {
    installEnhanceObserver(this.window);
  }

  createForm(isConnected = true): FakeObserverForm {
    const form = new FakeObserverForm(this.formPrototype);
    form.isConnected = isConnected;
    return form;
  }

  snapshot(): EnhanceObserverSnapshot {
    if (!this.window.__enhanceObserver) {
      throw new Error('FakeObserverPage: the enhance observer is not installed');
    }
    return this.window.__enhanceObserver.snapshot();
  }

  /**
   * Simulate a submit: the form's own (target-phase) listeners run first,
   * then the window's (bubble-phase) listeners — so the observer reads the
   * FINAL `defaultPrevented` decided by the application listener.
   */
  dispatchSubmit(form: FakeObserverForm, init: { submitter: unknown }): FakeSubmitEventRecord {
    const event: FakeSubmitEventRecord = {
      defaultPrevented: false,
      submitter: init.submitter,
      target: form,
      preventDefaultCalls: 0,
    };
    const record = event as unknown as {
      defaultPrevented: boolean;
      preventDefaultCalls: number;
      preventDefault(): void;
    };
    record.preventDefault = () => {
      record.preventDefaultCalls += 1;
      record.defaultPrevented = true;
    };
    for (const listener of [...form.listeners]) {
      listener(event as unknown as Event);
    }
    for (const listener of [...this.bubbleListeners]) {
      listener(event as unknown as Event);
    }
    return event;
  }
}

describe('enhance observer diagnostics (@enhance-diagnostics)', () => {
  it('RED: records attach and detach with per-form monotonic identity', () => {
    const page = new FakeObserverPage();
    page.install();
    const listenerA: EventListener = () => {};
    const listenerB: EventListener = () => {};
    const formA = page.createForm();
    const formB = page.createForm();
    formA.addListener('submit', listenerA);
    formB.addListener('submit', listenerB);
    formA.removeListener('submit', listenerA);

    const snapshot = page.snapshot();

    expect(snapshot.forms).toHaveLength(2);
    expect(
      snapshot.forms.map((form) => form.formId),
      'form identities must be assigned monotonically',
    ).toEqual([1, 2]);
    expect(snapshot.forms[0].formId).toBeLessThan(snapshot.forms[1].formId);
    expect(snapshot.forms[0].attachedAtMs, 'attach must record a timestamp').not.toBeNull();
    expect(snapshot.forms[0].detachedAtMs, 'detach must record a timestamp').not.toBeNull();
    expect(snapshot.forms[0].listenerCount, 'detached listener is no longer observed').toBe(0);
    expect(snapshot.forms[1].listenerCount).toBe(1);
    expect(snapshot.forms[1].detachedAtMs, 'form B was never detached').toBeNull();
    expect(snapshot.forms[0].connected).toBe(true);
  });

  it('RED: records submit ordinal, target identity, and defaultPrevented without calling preventDefault', () => {
    const page = new FakeObserverPage();
    page.install();
    const enhancedAppListener: EventListener = (event) => {
      (event as unknown as { preventDefault(): void }).preventDefault();
    };
    const submitter = {
      tagName: 'BUTTON',
      getAttribute: (name: string): string | null => (name === 'type' ? 'submit' : null),
    };

    // Enhanced submit: the application listener preventDefaults during the
    // target phase; the bubble-phase observer must see the final value.
    const enhancedForm = page.createForm();
    enhancedForm.addListener('submit', enhancedAppListener);
    const first = page.dispatchSubmit(enhancedForm, { submitter });

    // Native fallback: a form with NO observed submit listener (H3: the
    // enhanced listener never attached) — the submit must record no form
    // identity and defaultPrevented=false.
    const nativeForm = page.createForm();
    page.dispatchSubmit(nativeForm, { submitter });

    const snapshot = page.snapshot();

    expect(snapshot.submits.map((submit) => submit.ordinal)).toEqual([1, 2]);
    expect(snapshot.submits[0].formId).toBe(snapshot.forms[0].formId);
    expect(snapshot.submits[0].defaultPrevented).toBe(true);
    expect(snapshot.submits[0].submitter).toContain('BUTTON');
    expect(snapshot.submits[1].formId, 'native submit has no observed form identity').toBeNull();
    expect(snapshot.submits[1].defaultPrevented).toBe(false);
    expect(first.preventDefaultCalls).toBe(1);
    expect(snapshot.preventDefaultCalls, 'the observer never calls preventDefault').toBe(0);
  });

  it('RED: diagnostics distinguish the old detached form from the replaced connected form', () => {
    const page = new FakeObserverPage();
    page.install();
    const appListener: EventListener = () => {};

    // Svelte lifecycle hypothesis (H2): the observed form A is replaced by a
    // fresh form B after the listener attached — A is detached from the DOM.
    const formA = page.createForm();
    formA.addListener('submit', appListener);
    formA.isConnected = false;
    const formB = page.createForm();
    formB.addListener('submit', appListener);

    page.dispatchSubmit(formA, { submitter: null });
    page.dispatchSubmit(formB, { submitter: null });
    const snapshot = page.snapshot();

    expect(snapshot.forms).toHaveLength(2);
    expect(snapshot.forms[0].connected, 'old form must be recorded as detached').toBe(false);
    expect(snapshot.forms[1].connected, 'replaced form must be recorded as connected').toBe(true);
    expect(snapshot.submits[0].formId).toBe(snapshot.forms[0].formId);
    expect(snapshot.submits[1].formId).toBe(snapshot.forms[1].formId);
    expect(snapshot.submits[0].formId).not.toBe(snapshot.submits[1].formId);
  });
});

// ── Fake lifecycle page (Phase 10, D23) ────────────────────
//
// Deterministic model of the D20 guard + enhanced submit lifecycle: every
// form node has a fake DOM identity, attach/detach go through the REAL
// Phase 9 observer (read-only contract), and `checkReadiness` reproduces the
// CURRENT guard predicate (queries only the current DOM form's observed
// listeners). The fake never calls `preventDefault` (D22): the enhanced app
// listener is the only actor that prevents, and `dispatchSubmit` reports the
// event outcomes explicitly.

class FakeLifecyclePage {
  /** Current form in the simulated DOM (what `querySelector` would return). */
  currentForm: FakeObserverForm | null = null;
  /** Ordered lifecycle log: attach/detach/replace with fake identities. */
  readonly lifecycleLog: string[] = [];
  /** How many times the enhanced app listener called `preventDefault`. */
  appPreventDefaultCalls = 0;
  private readonly dom = new FakeObserverPage();
  private nextIdentity = 1;
  private readonly identities = new Map<FakeObserverForm, number>();
  private readonly enhancedAppListener: EventListener = (event) => {
    this.appPreventDefaultCalls += 1;
    (event as unknown as { preventDefault(): void }).preventDefault();
  };

  constructor() {
    this.dom.install();
  }

  /** The Phase 9 observer state installed on the fake window. */
  get observer(): EnhanceObserverState {
    if (!this.dom.window.__enhanceObserver) {
      throw new Error('FakeLifecyclePage: the enhance observer is not installed');
    }
    return this.dom.window.__enhanceObserver;
  }

  /** Monotonic DOM identity of a form node (the fake knows every node). */
  identityOf(form: FakeObserverForm): number {
    let identity = this.identities.get(form);
    if (identity === undefined) {
      identity = this.nextIdentity;
      this.nextIdentity += 1;
      this.identities.set(form, identity);
    }
    return identity;
  }

  /** Identity of the current DOM form. */
  get currentFormId(): number | null {
    return this.currentForm ? this.identityOf(this.currentForm) : null;
  }

  createForm(): FakeObserverForm {
    const form = this.dom.createForm();
    this.identityOf(form);
    return form;
  }

  /** The enhanced (`use:enhance`) submit listener attaches to the form. */
  attachEnhanced(form: FakeObserverForm): void {
    form.addListener('submit', this.enhancedAppListener);
    this.lifecycleLog.push(`attach:${this.identityOf(form)}`);
  }

  /** The enhanced submit listener is removed from the form. */
  detachEnhanced(form: FakeObserverForm): void {
    form.removeListener('submit', this.enhancedAppListener);
    this.lifecycleLog.push(`detach:${this.identityOf(form)}`);
  }

  /**
   * Svelte conditional lifecycle: `detached` leaves the DOM (its listener
   * record stays in the observer — no removeEventListener fired) and
   * `current` becomes the live form.
   */
  replaceForm(detached: FakeObserverForm, current: FakeObserverForm): void {
    detached.isConnected = false;
    this.currentForm = current;
    this.lifecycleLog.push(`replace:${this.identityOf(detached)}->${this.identityOf(current)}`);
  }

  /**
   * Model of the CURRENT D20 readiness predicate (`register-workspace.ts`
   * ENHANCE_READY_PREDICATE): queries only the current DOM form's observed
   * listeners. No identity, no ordinal, no stale-record detection — the
   * Phase 10 RED contracts document exactly that gap.
   */
  checkReadiness(): boolean {
    if (!this.currentForm) return false;
    const listeners = this.observer.formListeners.get(this.currentForm);
    return !!listeners && listeners.size > 0;
  }

  /** The guard outcome as the CURRENT guard exposes it: a boolean only. */
  guardOutcome(): { satisfied: boolean; observedFormId: number | null } {
    return { satisfied: this.checkReadiness(), observedFormId: null };
  }

  /**
   * Simulate a submit: the enhanced app listener (target phase) decides
   * `defaultPrevented`; the bubble-phase observer records the final value.
   * The fake itself never calls `preventDefault` (D22) — `fakeIntercepted`
   * is always `false`.
   */
  dispatchSubmit(form: FakeObserverForm): FakeSubmitEventRecord & { fakeIntercepted: boolean } {
    const record = this.dom.dispatchSubmit(form, { submitter: null });
    return { ...record, fakeIntercepted: false };
  }

  snapshot(): EnhanceObserverSnapshot {
    return this.dom.snapshot();
  }
}

// ── @enhance-diagnostics: deterministic lifecycle guard fakes ──
//
// Phase 10 (D23): deterministic lifecycle fakes that pin the guard semantics
// BEFORE any E2E change. The fakes model attach/detach, form replacement,
// stale observer records, native fallback (no interception), and enhanced
// interception with final `defaultPrevented` — the fakes never call
// `preventDefault` as a way to make tests green; they represent event
// outcomes explicitly (D22: the observer never masks native navigation).
//
// The RED contracts document the CURRENT lifecycle gap: the D20 guard
// (`register-workspace.ts` ENHANCE_READY_PREDICATE) queries only the current
// DOM form, so it cannot distinguish "listener never attached" (H3) from
// "form replaced after attach" (H2), guard+click are non-atomic, and the
// guard outcome exposes no identity, ordinal, or per-submit evidence.

describe('deterministic lifecycle guard fakes (@enhance-diagnostics)', () => {
  it('RED: the current guard can pass while the observed form is replaced before the click (lifecycle false-positive)', () => {
    const page = new FakeLifecyclePage();
    const formA = page.createForm();
    page.attachEnhanced(formA);
    page.currentForm = formA;

    // The D20 guard resolves: the CURRENT form has its enhanced listener.
    expect(page.checkReadiness()).toBe(true);
    expect(
      page.guardOutcome().observedFormId,
      'the current guard exposes no observed identity',
    ).toBeNull();

    // Svelte conditional lifecycle replaces form A with form B before the
    // click; form B never gets the enhanced listener (H2 mechanism).
    const formB = page.createForm();
    page.detachEnhanced(formA);
    page.replaceForm(formA, formB);

    // The gap: the guard outcome is ambiguous — it cannot distinguish
    // "listener never attached" (H3) from "form replaced after attach" (H2),
    // and guard+click are non-atomic (the click hits the CURRENT form).
    expect(page.guardOutcome().satisfied).toBe(false);
    expect(page.guardOutcome().observedFormId, 'no identity check in the guard outcome').toBeNull();
    // The fake lifecycle records the detach and the replacement with
    // identities, and the current identity is form B.
    expect(page.lifecycleLog).toContain(`detach:${page.identityOf(formA)}`);
    expect(page.lifecycleLog).toContain(
      `replace:${page.identityOf(formA)}->${page.identityOf(formB)}`,
    );
    expect(page.currentFormId).toBe(page.identityOf(formB));
  });

  it('RED: a stale observer record must not satisfy the readiness guard', () => {
    const page = new FakeLifecyclePage();
    const formA = page.createForm();
    page.attachEnhanced(formA);
    page.currentForm = formA;
    expect(page.checkReadiness()).toBe(true);

    // Form A is detached and replaced; the observer still holds form A's
    // listener record (no removeEventListener fired — the node was
    // discarded by the conditional lifecycle).
    const formB = page.createForm();
    page.replaceForm(formA, formB);

    expect(page.observer.formListeners.get(formA)?.size).toBe(1);
    expect(page.checkReadiness(), 'a stale record must never satisfy the guard').toBe(false);
  });

  it('RED: records first and second submits with ordinal and target identity', () => {
    const page = new FakeLifecyclePage();
    const form = page.createForm();
    page.attachEnhanced(form);
    page.currentForm = form;

    page.dispatchSubmit(form);
    page.dispatchSubmit(form);
    const snapshot = page.snapshot();

    expect(snapshot.submits.map((submit) => submit.ordinal)).toEqual([1, 2]);
    expect(snapshot.submits[0].formId).toBe(page.identityOf(form));
    expect(snapshot.submits[1].formId).toBe(page.identityOf(form));
    // The current guard exposes no ordinal or per-submit evidence: its
    // outcome is a single boolean, decoupled from the submit lifecycle.
    expect(page.guardOutcome().satisfied).toBe(true);
    expect(page.guardOutcome().observedFormId).toBeNull();
  });

  it('RED: the native fallback has defaultPrevented=false and no fake interception', () => {
    const page = new FakeLifecyclePage();
    const form = page.createForm();
    page.currentForm = form;

    const submit = page.dispatchSubmit(form);
    const snapshot = page.snapshot();

    expect(submit.defaultPrevented).toBe(false);
    expect(submit.fakeIntercepted, 'the fake never intercepts native navigation').toBe(false);
    expect(snapshot.submits[0].formId, 'native submit has no observed form identity').toBeNull();
    expect(snapshot.submits[0].defaultPrevented).toBe(false);
    expect(snapshot.preventDefaultCalls).toBe(0);
    expect(page.appPreventDefaultCalls).toBe(0);
  });

  it('RED: the enhanced path records final defaultPrevented=true without the observer calling preventDefault', () => {
    const page = new FakeLifecyclePage();
    const form = page.createForm();
    page.attachEnhanced(form);
    page.currentForm = form;

    const submit = page.dispatchSubmit(form);
    const snapshot = page.snapshot();

    expect(submit.defaultPrevented).toBe(true);
    expect(
      submit.fakeIntercepted,
      'the fake does not preventDefault; the enhanced app listener does',
    ).toBe(false);
    expect(snapshot.submits[0].formId).toBe(page.identityOf(form));
    expect(snapshot.submits[0].defaultPrevented).toBe(true);
    expect(page.appPreventDefaultCalls).toBe(1);
    expect(snapshot.preventDefaultCalls, 'the observer never calls preventDefault').toBe(0);
  });
});
