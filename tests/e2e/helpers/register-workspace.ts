import type { Page, Response } from '@playwright/test';
import { expect } from '@playwright/test';

import { type EnhanceObserverState, installEnhanceObserver } from './enhance-diagnostics';
import { waitForHydration } from './hydration';

export type TargetRail = 'workspaces' | 'project' | 'git' | 'settings';
export type RightPanelTab = 'comments' | 'review';

/**
 * Bound for the deferred invalidation barrier (0005): the `__data.json`
 * response triggered by `invalidateAll()` must arrive within this window or
 * the helper fails fast with a readable error instead of hanging until the
 * test timeout (the failure mode observed under full-suite load).
 */
const REGISTRATION_BARRIER_TIMEOUT_MS = 15_000;

/**
 * Bound for the enhanced-submit readiness guard (0005 D20): the form's
 * enhanced submit listener (SvelteKit `use:enhance`) must be attached before
 * the helper submits. Without it the submit would navigate natively (no
 * `__data.json`, torn-down DOM) — the guard fails fast instead.
 */
const ENHANCE_READY_TIMEOUT_MS = 10_000;

/**
 * Test-side observer hook (D20/D21). Installed via `page.evaluate` BEFORE the
 * workspace form is mounted, so every `submit` listener attached to any form
 * is recorded with per-form monotonic identity, attach/detach lifecycle, and
 * bubble-phase submit evidence (ordinal, target, final `defaultPrevented`,
 * submitter). The core lives in `tests/e2e/helpers/enhance-diagnostics.ts`
 * and is observation-only: it never calls `preventDefault`, never dispatches
 * events, and never mutates production behavior. Idempotent: a second
 * install is a no-op.
 */

/** Test-only global: observed submit listeners per form (installed by the hook). */
interface EnhanceObserverWindow extends Window {
  __enhanceObserver?: EnhanceObserverState;
}

/**
 * Browser-side predicate for the enhance-readiness guard: the workspace form
 * (action="?/register") must have at least one observed `submit` listener.
 */
const ENHANCE_READY_PREDICATE = (action: string): boolean => {
  const win = window as EnhanceObserverWindow;
  const form = document.querySelector<HTMLFormElement>(`form[action="${action}"]`);
  if (!form) return false;
  const listeners = win.__enhanceObserver?.formListeners.get(form);
  return !!listeners && listeners.size > 0;
};

/**
 * Pure predicate that matches SvelteKit deferred invalidation responses.
 *
 * SvelteKit's `use:enhance` triggers `invalidateAll()` after a successful
 * form action, which causes a deferred GET to `__data.json`.  This predicate
 * identifies those responses so the E2E helper can register a barrier
 * **before** the workspace select click and await it **after**.
 *
 * The predicate is status-agnostic: it only checks the URL and HTTP method,
 * so a `__data.json` response with status 500 still matches.  This keeps
 * existing error-intercept tests compatible.
 *
 * @param response - a minimal `{ url, method }` shape.
 * @returns `true` when the URL contains `__data.json` and method is `GET`.
 */
export function isDataJsonResponse(response: { url: string; method: string }): boolean {
  return response.url.includes('__data.json') && response.method === 'GET';
}

/**
 * Register a workspace from a repo path, select it, and wait for activation.
 * Does NOT switch to any specific rail — the calling test manages rail selection.
 * Uses observable readiness (visible sidebar item + select button) instead of
 * bare networkidle signals.
 */
export async function registerAndActivate(
  page: Page,
  repoPath: string,
  name: string,
): Promise<void> {
  await waitForHydration(page);

  const toggle = page.getByTestId('open-workspace-toggle');
  if (
    !(await page
      .locator('[data-testid="open-workspace-form"]')
      .isVisible()
      .catch(() => false))
  ) {
    await toggle.click();
  }

  // Ensure the page is stable after the toggle interaction before filling the form
  await page.waitForLoadState('networkidle');

  await page.waitForSelector('[data-testid="open-workspace-form"]', {
    state: 'visible',
    timeout: 10000,
  });

  await page.fill('#ws-path', repoPath);
  await page.fill('#ws-name', name);
  await page.click('#open-workspace-form button[type="submit"]');
  await page.waitForLoadState('networkidle');

  // Select the workspace to activate it
  const wsItem = page.locator(`#workspace-sidebar li:has-text("${name}")`).first();
  await expect(wsItem).toBeVisible({ timeout: 10000 });

  const selectBtn = wsItem.getByRole('button', { name: /Select/ });
  await expect(selectBtn).toBeVisible({ timeout: 5000 });
  await selectBtn.click();

  // Observable readiness: W3 lands the shell on the Git rail after
  // selection; return to the Workspaces rail so the sidebar (and the active
  // item) is visible for callers that keep working there.
  const gitTab = page.locator('[data-testid="rail-tab-git"]');
  await expect(gitTab).toHaveAttribute('aria-selected', 'true', { timeout: 10000 });
  await page.getByTestId('rail-tab-workspaces').click();
  const activeItem = page.locator(`#workspace-sidebar li.active:has-text("${name}")`);
  await expect(activeItem).toBeVisible({ timeout: 10000 });
}

/**
 * Select a rail tab by its data-testid and wait for it to become active.
 *
 * @param readinessPromise - optional promise (e.g. a response promise) that
 *   signals the rail's data has loaded. When provided, this is awaited instead
 *   of a bare networkidle, giving an event-driven readiness barrier.
 */
export async function selectRailTab(
  page: Page,
  target: TargetRail,
  readinessPromise?: Promise<Response> | null,
): Promise<void> {
  const tab = page.locator(`[data-testid="rail-tab-${target}"]`);
  await expect(tab).toBeVisible({ timeout: 5000 });
  await tab.click();
  await expect(tab).toHaveAttribute('aria-selected', 'true', { timeout: 15000 });
  // Use an event-driven barrier when a readiness promise is provided;
  // this is more precise than a bare networkidle.
  if (readinessPromise) {
    await readinessPromise;
  }
}

/**
 * Minimal structural page surface used by the canonical registration helper.
 *
 * Deliberately narrower than Playwright's `Page` so the deferred-invalidation
 * barrier contract can be exercised deterministically with a simulated page
 * in integration tests (see `tests/integration/e2e-helpers/workspace-management-flake.test.ts`).
 */
export interface RegistrationPage {
  getByTestId(testId: string): { click(): Promise<void>; isVisible(): Promise<boolean> };
  locator(selector: string): { isVisible(): Promise<boolean> };
  waitForSelector(
    selector: string,
    options?: { state?: 'attached' | 'detached' | 'hidden' | 'visible'; timeout?: number },
  ): Promise<unknown>;
  fill(selector: string, value: string): Promise<void>;
  click(selector: string): Promise<void>;
  waitForLoadState(state: 'networkidle'): Promise<void>;
  evaluate<T, TArg>(script: string | ((arg: TArg) => T), arg?: TArg): Promise<T>;
  waitForFunction<TArg>(
    script: string | ((arg: TArg) => boolean),
    arg?: TArg,
    options?: { timeout?: number },
  ): Promise<unknown>;
  waitForResponse(
    predicate: (response: { url(): string; request(): { method(): string } }) => boolean,
    options?: { timeout?: number },
  ): Promise<unknown>;
}

/**
 * Open the workspace registration form WITHOUT filling or submitting.
 *
 * 0005 Phase 5: exposes the open-only step so specs can assert the fresh-form
 * contract (empty inputs) between sequential registrations before delegating
 * the fill+submit+barrier to `submitRegistration`. Event-driven only: no
 * `waitForTimeout`, no reload.
 */
export async function openWorkspaceForm(page: RegistrationPage): Promise<void> {
  // D20/D21: install the test-side observer hook BEFORE the form is mounted
  // (the toggle below mounts it, and the `use:enhance` submit listener is
  // attached at mount time). Idempotent: a second install is a no-op. The
  // hook is self-contained so Playwright serializes it into the page.
  await page.evaluate(installEnhanceObserver);

  const toggle = page.getByTestId('open-workspace-toggle');
  if (
    !(await page
      .locator('[data-testid="open-workspace-form"]')
      .isVisible()
      .catch(() => false))
  ) {
    await toggle.click();
  }

  await page.waitForSelector('[data-testid="open-workspace-form"]', {
    state: 'visible',
    timeout: 10000,
  });
}

/**
 * Register a workspace with the canonical event-driven barrier (0005 H2).
 *
 * The open-workspace form action uses `use:enhance` and calls
 * `invalidateAll()` after a successful submit, which schedules a deferred GET
 * to `__data.json` and the sidebar DOM update AFTER the action response. A
 * `networkidle`-only helper can resolve before that deferred work finishes —
 * that is the 0005 flake. This helper instead:
 *
 * 1. installs the `__data.json` response barrier BEFORE the submit;
 * 2. awaits the deferred invalidation response after the submit;
 * 3. asserts the registered workspace is visible in the sidebar.
 *
 * `networkidle` is never the completion signal; there is no
 * `waitForTimeout` and no reload.
 */
export async function submitRegistration(
  page: RegistrationPage,
  repoPath: string,
  name: string,
): Promise<void> {
  await openWorkspaceForm(page);

  await page.fill('#ws-path', repoPath);
  await page.fill('#ws-name', name);

  // D20: the enhanced submit readiness guard. The observer hook was
  // installed by openWorkspaceForm BEFORE the form mounted; here the guard
  // waits (event-driven, no sleep/retry) for the `use:enhance` submit
  // listener. If it never attaches, the helper fails fast with form/action
  // diagnostics instead of submitting natively.
  await ensureEnhancedSubmitReady(page);

  // The barrier MUST be installed before the submit so it catches the
  // deferred invalidateAll() GET issued after the action response. It is
  // bounded: if the response never arrives (slow worker under load) the
  // helper fails fast with a readable error instead of hanging until the
  // test timeout.
  const dataJsonPromise = page.waitForResponse(
    (response) => isDataJsonResponse({ url: response.url(), method: response.request().method() }),
    { timeout: REGISTRATION_BARRIER_TIMEOUT_MS },
  );

  await page.click('#open-workspace-form button[type="submit"]');

  try {
    await dataJsonPromise;
  } catch (err) {
    throw new Error(
      `Registration barrier: deferred __data.json response never arrived after submit ` +
        `(${err instanceof Error ? err.message : String(err)})`,
      { cause: err },
    );
  }

  // networkidle as a PRECONDITION (never the sole completion signal): the
  // deferred response re-renders the page and fires revalidation traffic
  // (invalid sidebar items, lazy modules). Waiting for it here guarantees
  // the page has settled before the helper returns, so the interactions
  // that immediately follow registration (overflow menu, delete dialog) do
  // not hang on a busy main thread under full-suite load.
  await page.waitForLoadState('networkidle');

  // Completion requires the DOM assertion: the registered workspace is
  // visible in the sidebar. No waitForTimeout, no reload.
  await page.waitForSelector(`#workspace-sidebar li:has-text("${name}")`, {
    state: 'visible',
    timeout: 10000,
  });
}

/**
 * D20: enhanced submit readiness guard.
 *
 * Installs the test-side observer hook (idempotent) and waits — bounded and
 * event-driven, no sleep/retry — until the workspace form
 * (`action="?/register"`) has its enhanced `submit` listener attached
 * (`use:enhance`). When the listener never attaches, the helper fails fast
 * with form/action diagnostics instead of letting the form submit natively
 * (the 0005 native-navigation failure mode).
 */
async function ensureEnhancedSubmitReady(page: RegistrationPage): Promise<void> {
  try {
    await page.waitForFunction(ENHANCE_READY_PREDICATE, '?/register', {
      timeout: ENHANCE_READY_TIMEOUT_MS,
    });
  } catch (err) {
    throw new Error(
      `Enhanced submit not ready: the workspace form (action="?/register") has no enhanced ` +
        `submit listener before submit — a native navigation would occur ` +
        `(${err instanceof Error ? err.message : String(err)})`,
      { cause: err },
    );
  }
}

/**
 * Canonical register-only helper (0005): prove hydration, then run the
 * event-driven registration barrier. Returns only after the deferred
 * `__data.json` invalidation response arrives and the registered workspace
 * is visible in the sidebar.
 */
export async function registerWorkspace(page: Page, repoPath: string, name: string): Promise<void> {
  await waitForHydration(page);
  await submitRegistration(page, repoPath, name);
}

/**
 * W4/0003: fresh contexts default the Git file list to the tree view, and
 * Settings is the sole presentation preference source (the Git panel exposes
 * no List/Tree controls). Specs that exercise flat-list contracts (`.file-row`,
 * pagination, list sorting) must opt into the list view explicitly: write the
 * versioned visual-settings aggregate and re-enter the Git rail so the panel
 * re-reads the persisted preference.
 */
export async function switchFileListToListView(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.setItem(
      'diffscribe-visual-settings',
      JSON.stringify({ version: 1, fileListView: 'list', markdownView: 'preview' }),
    );
  });

  const isMobile = await page.evaluate(
    () => document.querySelector('.shell-layout')?.classList.contains('is-mobile') ?? false,
  );

  // The mobile drawer overlays the rail while open; close it before
  // switching rails (desktop is unaffected).
  const drawer = page.locator('[data-testid="left-contextual-panel"]');
  if (isMobile) {
    await page.keyboard.press('Escape');
    await expect(drawer).not.toBeVisible({ timeout: 5000 });
  }

  // Re-mount the Git panel so the persisted list preference is re-read.
  await page.getByTestId('rail-tab-workspaces').click();
  if (isMobile) {
    // The workspaces drawer also overlays the rail; close it again before
    // entering Git.
    await page.keyboard.press('Escape');
    await expect(drawer).not.toBeVisible({ timeout: 5000 });
  }
  const gitTab = page.locator('[data-testid="rail-tab-git"]');
  await gitTab.click();
  await expect(gitTab).toHaveAttribute('aria-selected', 'true', { timeout: 15000 });

  const panel = page.locator('#file-list-panel');
  await expect(panel).toBeVisible({ timeout: 8000 });
  const rows = panel.locator('.file-row');
  await expect(rows.first()).toBeVisible({ timeout: 15000 });
}

/**
 * Select a right panel tab (Comments / Review) by data-testid and wait for
 * the panel content to finish loading. The right panel defaults to Comments
 * on every page load, so call this before interacting with #review-panel.
 */
export async function selectRightPanelTab(
  page: Page,
  target: RightPanelTab,
  readinessPromise?: Promise<Response> | null,
): Promise<void> {
  const tab = page.locator(`[data-testid="right-tab-${target}"]`);
  await expect(tab).toBeVisible({ timeout: 5000 });
  await tab.click();
  await expect(tab).toHaveAttribute('aria-selected', 'true', { timeout: 15000 });
  if (readinessPromise) {
    await readinessPromise;
  }
}

/**
 * Register a workspace from a repo path, select it, and wait for full
 * activation. Uses the canonical pattern: hydrate, toggle form, fill,
 * submit, select workspace, switch to target rail, confirm panel.
 *
 * @param targetRail - which rail tab to activate after workspace selection.
 *   Defaults to `'workspaces'`. Pass `'git'` for specs that interact with
 *   git context, file list, diff viewer, review, or line selection panels.
 */
export async function registerAndSelectWorkspace(
  page: Page,
  repoPath: string,
  name: string,
  targetRail: TargetRail = 'workspaces',
): Promise<void> {
  await waitForHydration(page);

  // Ensure we are on the Workspaces rail to access the sidebar
  await selectRailTab(page, 'workspaces');

  const toggle = page.getByTestId('open-workspace-toggle');
  if (
    !(await page
      .locator('[data-testid="open-workspace-form"]')
      .isVisible()
      .catch(() => false))
  ) {
    await toggle.click();
  }

  await page.waitForSelector('[data-testid="open-workspace-form"]', {
    state: 'visible',
    timeout: 10000,
  });

  await page.fill('#ws-path', repoPath);
  await page.fill('#ws-name', name);
  await page.click('#open-workspace-form button[type="submit"]');
  await page.waitForLoadState('networkidle');

  // Select the workspace to activate it
  const wsItem = page.locator(`#workspace-sidebar li:has-text("${name}")`).first();
  await expect(wsItem).toBeVisible({ timeout: 10000 });

  const selectBtn = wsItem.getByRole('button', { name: /Select/ });
  await expect(selectBtn).toBeVisible({ timeout: 5000 });

  // Register response promises BEFORE clicking Select so they catch
  // requests that arrive during the SvelteKit navigation triggered by
  // use:enhance on the workspace selection form action (?/select).
  //
  // 1. __data.json barrier — SvelteKit's enhance issues invalidateAll()
  //    after a successful form action, which triggers a deferred GET to
  //    __data.json.  Awaiting this promise after the click + networkidle
  //    guarantees the page has finished re-rendering before we check
  //    activation or switch rails.  The predicate is status-agnostic.
  const dataJsonPromise = page.waitForResponse((resp) =>
    isDataJsonResponse({ url: resp.url(), method: resp.request().method() }),
  );

  // 2. /file-list barrier — when switching to the git rail the target
  //    page's load function fetches /api/workspaces/[id]/file-list.
  //    The predicate is status-agnostic: no resp.status()===200 filter,
  //    so the existing 500-intercept test in diff-viewer stays compatible.
  let fileListPromise: Promise<Response> | null = null;
  if (targetRail === 'git') {
    fileListPromise = page.waitForResponse(
      (resp) => resp.url().includes('/file-list') && resp.request().method() === 'GET',
    );
  }

  await selectBtn.click();

  // Wait for all immediate network activity to settle.  SvelteKit's
  // use:enhance submits the form, receives a success response, then
  // fires invalidateAll() which schedules a deferred __data.json GET.
  // networkidle alone is not enough because the deferred GET may still
  // be in flight — we await the dataJsonPromise next.
  await page.waitForLoadState('networkidle');

  // Await the deferred invalidation barrier so the page has finished
  // re-rendering after the __data.json response before we check
  // activation or switch rails.
  await dataJsonPromise;

  // Observable DOM readiness: W3 lands the shell on the Git rail after
  // selection. Await the deferred file-list response when the target rail is
  // Git so the panel content barrier is complete.
  const gitTab = page.locator('[data-testid="rail-tab-git"]');
  await expect(gitTab).toHaveAttribute('aria-selected', 'true', { timeout: 10000 });

  if (targetRail === 'git') {
    if (fileListPromise) {
      await fileListPromise;
    }
    const panel = page.locator('#git-context-panel');
    await expect(panel).toBeVisible({ timeout: 20000 });
    await expect(panel.locator('.status-indicator')).toBeVisible({ timeout: 20000 });
    return;
  }

  // Non-Git targets: switch to the requested rail and confirm the workspace.
  await selectRailTab(page, targetRail);
  if (targetRail === 'project') {
    const panel = page.locator(
      '[data-testid="project-tree"], .project-tree, [data-testid="tree-node"]',
    );
    await expect(panel.first()).toBeVisible({ timeout: 10000 });
    return;
  }
  const panel = page.locator('#workspace-sidebar');
  await expect(panel).toBeVisible({ timeout: 10000 });
  const activeItem = panel.locator('li.active');
  await expect(activeItem).toBeVisible({ timeout: 8000 });
}
