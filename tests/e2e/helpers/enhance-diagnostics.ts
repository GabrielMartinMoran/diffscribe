/**
 * Test-only enhance-submit diagnostics (0005 Phase 9, D21/D22).
 *
 * Failure-time evidence for the 175 flake: per-form monotonic identity,
 * attach/detach lifecycle, and bubble-phase submit capture (ordinal, target
 * identity, final `defaultPrevented`, submitter). The observer is strictly
 * observation-only: it never calls `preventDefault`, never dispatches
 * events, and never mutates production behavior.
 *
 * `installEnhanceObserver` is deliberately self-contained (no module-scope
 * references in its body) so Playwright can serialize it into the page via
 * `page.evaluate`. The integration suite (`@enhance-diagnostics`) pins the
 * same contract deterministically with a fake DOM.
 */

/** Minimal form surface the observer needs (browser: HTMLFormElement). */
export interface EnhanceObserverFormLike {
  readonly isConnected: boolean;
}

/** Minimal submit-event surface (browser: SubmitEvent). */
export interface EnhanceObserverSubmitEventLike {
  readonly defaultPrevented: boolean;
  readonly submitter: unknown;
  readonly target: unknown;
}

/** Environment the observer installs into (browser: window + HTMLFormElement.prototype). */
export interface EnhanceObserverWindowLike {
  /** Bubble-phase submit listener host (browser: window). */
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): unknown;
  /** Shared form listener surface (browser: HTMLFormElement.prototype). */
  formPrototype: {
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
  /** Published observer state; the predicate and snapshot read it. */
  __enhanceObserver?: EnhanceObserverState;
}

/** Internal per-form record with lifecycle timestamps. */
export interface EnhanceObservedFormRecord {
  readonly form: EnhanceObserverFormLike;
  attachedAtMs: number | null;
  detachedAtMs: number | null;
}

/** Immutable snapshot record for one observed form. */
export interface EnhanceFormRecord {
  /** Monotonic per-form identity (1-based). */
  readonly formId: number;
  /** Whether the form is still connected at snapshot time. */
  readonly connected: boolean;
  /** Observed `submit` listeners currently attached. */
  readonly listenerCount: number;
  readonly attachedAtMs: number | null;
  readonly detachedAtMs: number | null;
}

/** Immutable snapshot record for one observed submit. */
export interface EnhanceSubmitRecord {
  /** 1-based submit ordinal across the page. */
  readonly ordinal: number;
  /** Identity of the submit target, or `null` when never observed (native fallback). */
  readonly formId: number | null;
  /** Final `defaultPrevented` as seen by the bubble-phase observer. */
  readonly defaultPrevented: boolean;
  /** Serialized submitter descriptor (tag, type, data-testid). */
  readonly submitter: string;
  readonly timestampMs: number;
}

/** Serialized observer state; safe to attach to test output. */
export interface EnhanceObserverSnapshot {
  readonly forms: readonly EnhanceFormRecord[];
  readonly submits: readonly EnhanceSubmitRecord[];
  /** Contract pin: the observer never calls `preventDefault`. */
  readonly preventDefaultCalls: number;
}

/** Mutable observer state published on the host (read by the readiness predicate). */
export interface EnhanceObserverState {
  /** Observed `submit` listeners per form (read by the D20 readiness predicate). */
  formListeners: WeakMap<EnhanceObserverFormLike, Set<EventListener>>;
  /** Monotonic identity per observed form. */
  formIds: WeakMap<EnhanceObserverFormLike, number>;
  /** Identity → lifecycle record, in attach order. */
  forms: Map<number, EnhanceObservedFormRecord>;
  /** Append-only submit evidence. */
  submits: EnhanceSubmitRecord[];
  nextFormId: number;
  submitCount: number;
  snapshot(): EnhanceObserverSnapshot;
}

/**
 * Install the observation-only enhance observer.
 *
 * Self-contained by design: the body references only its parameter and
 * browser globals, so Playwright can serialize it into the page. When called
 * with no argument (from `page.evaluate`), it derives the environment from
 * the page's `window` and `HTMLFormElement.prototype`.
 *
 * The bubble-phase submit listener is registered on the window, so it runs
 * AFTER the application's target-phase `use:enhance` listener and reads the
 * final `defaultPrevented`. The observer never calls `preventDefault`.
 */
export function installEnhanceObserver(win?: EnhanceObserverWindowLike): EnhanceObserverState {
  const browserWindow = globalThis as unknown as {
    __enhanceObserver?: EnhanceObserverState;
    readonly addEventListener: (
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions,
    ) => void;
    readonly HTMLFormElement: { readonly prototype: EnhanceObserverWindowLike['formPrototype'] };
  };
  const host: EnhanceObserverWindowLike = win ?? {
    addEventListener: browserWindow.addEventListener.bind(browserWindow),
    formPrototype: browserWindow.HTMLFormElement.prototype,
    __enhanceObserver: browserWindow.__enhanceObserver,
  };
  if (host.__enhanceObserver) {
    return host.__enhanceObserver;
  }

  function describeSubmitter(submitter: unknown): string {
    if (submitter === null || submitter === undefined) return 'null';
    if (
      typeof submitter === 'object' &&
      typeof (submitter as { tagName?: unknown }).tagName === 'string'
    ) {
      const element = submitter as {
        tagName: string;
        getAttribute?: (name: string) => string | null;
      };
      const parts: string[] = [element.tagName];
      const type = element.getAttribute ? element.getAttribute('type') : null;
      const testId = element.getAttribute ? element.getAttribute('data-testid') : null;
      if (type !== null) parts.push(`type=${type}`);
      if (testId !== null) parts.push(`testid=${testId}`);
      return parts.join(' ');
    }
    return String(submitter);
  }

  const state: EnhanceObserverState = {
    formListeners: new WeakMap<EnhanceObserverFormLike, Set<EventListener>>(),
    formIds: new WeakMap<EnhanceObserverFormLike, number>(),
    forms: new Map<number, EnhanceObservedFormRecord>(),
    submits: [],
    nextFormId: 1,
    submitCount: 0,
    snapshot: (): EnhanceObserverSnapshot => {
      const forms = Array.from(state.forms.entries()).map(([formId, record]) => ({
        formId,
        connected: record.form.isConnected,
        listenerCount: state.formListeners.get(record.form)?.size ?? 0,
        attachedAtMs: record.attachedAtMs,
        detachedAtMs: record.detachedAtMs,
      }));
      return {
        forms,
        submits: Array.from(state.submits),
        preventDefaultCalls: 0,
      };
    },
  };
  host.__enhanceObserver = state;
  // The browser path runs on a facade (window is not directly the host):
  // publish the state on the real window so the readiness predicate and the
  // snapshot capture can read it from the page context.
  if (!win) {
    browserWindow.__enhanceObserver = state;
  }

  const originalAdd = host.formPrototype.addEventListener;
  const originalRemove = host.formPrototype.removeEventListener;

  host.formPrototype.addEventListener = function (
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): unknown {
    const form = this as unknown as EnhanceObserverFormLike;
    if (type === 'submit') {
      let listeners = state.formListeners.get(form);
      if (!listeners) {
        listeners = new Set<EventListener>();
        state.formListeners.set(form, listeners);
      }
      listeners.add(listener as EventListener);
      const record = state.formIds.get(form);
      if (!record) {
        const formId = state.nextFormId;
        state.nextFormId += 1;
        state.formIds.set(form, formId);
        state.forms.set(formId, { form, attachedAtMs: Date.now(), detachedAtMs: null });
      }
    }
    return originalAdd.call(form, type, listener, options);
  };

  host.formPrototype.removeEventListener = function (
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): unknown {
    const form = this as unknown as EnhanceObserverFormLike;
    if (type === 'submit') {
      state.formListeners.get(form)?.delete(listener as EventListener);
      const formId = state.formIds.get(form);
      if (formId !== undefined) {
        const record = state.forms.get(formId);
        if (record) record.detachedAtMs = Date.now();
      }
    }
    return originalRemove.call(form, type, listener, options);
  };

  // Bubble-phase submit listener: registered on the window so it runs after
  // the application's target-phase `use:enhance` listener — `defaultPrevented`
  // is final here. Observation-only: never calls `preventDefault`.
  host.addEventListener(
    'submit',
    (event: Event): void => {
      const submitEvent = event as unknown as EnhanceObserverSubmitEventLike;
      state.submitCount += 1;
      const target = submitEvent.target as EnhanceObserverFormLike | null;
      const formId =
        target !== null && target !== undefined ? (state.formIds.get(target) ?? null) : null;
      state.submits.push({
        ordinal: state.submitCount,
        formId,
        defaultPrevented: submitEvent.defaultPrevented,
        submitter: describeSubmitter(submitEvent.submitter),
        timestampMs: Date.now(),
      });
    },
    false,
  );

  return state;
}

/**
 * Capture the observer snapshot from a page, or `null` when the observer was
 * never installed or the page navigated away (native navigation) — the
 * failure-time diagnostics must never fail the test.
 */
export async function captureEnhanceObserverSnapshot(page: {
  evaluate<R>(script: string | ((arg?: unknown) => R)): Promise<R>;
}): Promise<EnhanceObserverSnapshot | null> {
  try {
    return await page.evaluate(() => {
      const win = window as unknown as {
        __enhanceObserver?: { snapshot(): EnhanceObserverSnapshot };
      };
      return win.__enhanceObserver ? win.__enhanceObserver.snapshot() : null;
    });
  } catch {
    return null;
  }
}
