import type { Page, Response } from '@playwright/test';
import { expect } from '@playwright/test';

import { waitForHydration } from './hydration';

export type TargetRail = 'workspaces' | 'project' | 'git' | 'settings';
export type RightPanelTab = 'comments' | 'review';

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
