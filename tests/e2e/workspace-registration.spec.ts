import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { waitForHydration } from './helpers/hydration';
import { resetDb } from './helpers/reset-db';

function createGitRepo(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
  execSync('git init', { cwd: dir, stdio: 'pipe' });
  execSync('git config user.email "e2e@test.com"', { cwd: dir, stdio: 'pipe' });
  execSync('git config user.name "E2E Test"', { cwd: dir, stdio: 'pipe' });
  fs.writeFileSync(path.join(dir, 'README.md'), '# e2e');
  execSync('git add .', { cwd: dir, stdio: 'pipe' });
  execSync('git commit -m "init"', { cwd: dir, stdio: 'pipe' });
}

function rmDir(dir: string): void {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

async function openWorkspaceForm(page: Page): Promise<void> {
  await waitForHydration(page);
  const toggle = page.getByTestId('open-workspace-toggle');
  if (await toggle.isVisible({ timeout: 2000 }).catch(() => false)) {
    await toggle.click();
  }
  await page.waitForSelector('[data-testid="open-workspace-form"]', {
    state: 'visible',
    timeout: 10000,
  });
}

test.describe('Workspace Registration UI (E2E)', () => {
  test.beforeEach(async ({ page, request }) => {
    await resetDb(request);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('hydration smoke proves Svelte 5 delegated handler is attached', async ({ page }) => {
    // RED: waitForHydration handles the non-destructive toggle smoke
    await waitForHydration(page);
    // After hydration smoke, the toggle must still be visible
    await expect(page.getByTestId('open-workspace-toggle')).toBeVisible();
    // And the form must be closed (smoke restores original state)
    await expect(page.locator('[data-testid="open-workspace-form"]')).toBeHidden();
    // A direct click on the toggle must now open the form — this proves
    // the Svelte 5 delegated handler is actually attached, not just SSR-rendered
    await page.getByTestId('open-workspace-toggle').click();
    await expect(page.locator('[data-testid="open-workspace-form"]')).toBeVisible({
      timeout: 5000,
    });
  });

  test('displays the workspace registration page', async ({ page }) => {
    await expect(page.locator('#workspace-sidebar')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('open-workspace-toggle')).toBeVisible();
  });

  test('shows the open workspace form after toggle', async ({ page }) => {
    await openWorkspaceForm(page);
    const form = page.locator('[data-testid="open-workspace-form"]');
    await expect(form).toBeVisible();
  });

  test('form has required fields', async ({ page }) => {
    await openWorkspaceForm(page);
    const pathInput = page.locator('#ws-path');
    const nameInput = page.locator('#ws-name');
    const submitButton = page.locator('#open-workspace-form button[type="submit"]');
    await expect(pathInput).toBeVisible();
    await expect(nameInput).toBeVisible();
    await expect(submitButton).toBeVisible();
  });

  test('shows workspace sidebar', async ({ page }) => {
    const sidebar = page.locator('#workspace-sidebar');
    await expect(sidebar).toBeVisible();
  });

  test('sidebar shows empty state or workspace list', async ({ page }) => {
    const sidebar = page.locator('#workspace-sidebar');
    await expect(sidebar).toBeVisible();
    // Sidebar shows empty state or items depending on shared DB state.
    const empty = sidebar.locator('.empty-state');
    const listItems = sidebar.locator('.workspace-list li');
    const hasItems = (await listItems.count()) > 0;
    if (!hasItems) {
      await expect(empty).toBeVisible();
    }
  });

  test('open, invalidate, repair, and validate a workspace', async ({ page }) => {
    const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'diffscribe-e2e-'));
    const repoA = path.join(fixtureRoot, 'repo-a');
    const repoB = path.join(fixtureRoot, 'repo-b');
    const uniqueName = `E2E-${Date.now()}`;

    try {
      // 1. Create initial repo and register via the form
      createGitRepo(repoA);
      await openWorkspaceForm(page);
      await page.fill('#ws-path', repoA);
      await page.fill('#ws-name', uniqueName);
      await page.click('#open-workspace-form button[type="submit"]');
      await page.waitForLoadState('networkidle');

      // 2. Confirm workspace appears in sidebar as valid
      const wsItem = page.locator(`#workspace-sidebar li:has-text("${uniqueName}")`).first();
      await expect(wsItem).toBeVisible();
      await expect(wsItem.locator('.status-dot.status-valid')).toBeVisible();

      // 3. Invalidate by removing the repo
      rmDir(repoA);
      await page.reload();
      await page.waitForLoadState('networkidle');
      await expect(wsItem.locator('.invalid-badge')).toBeVisible();

      // 4. Repair: create new repo and use the in-UI Repair action
      createGitRepo(repoB);

      // Click the Repair button (only visible for invalid workspaces)
      const repairBtn = wsItem.getByRole('button', { name: /Repair/ });
      await expect(repairBtn).toBeVisible();
      await repairBtn.click();

      // Repair form should appear with a path input
      await page.waitForSelector('[data-repair-form] input[name="newPath"]', {
        state: 'visible',
        timeout: 10000,
      });
      await page.fill('[data-repair-form] input[name="newPath"]', repoB);
      await page.click('[data-repair-form] .save-btn');

      // Wait for repair form to close and sidebar to update
      await page.waitForSelector('[data-repair-form]', { state: 'hidden', timeout: 10000 });
      await page.reload();
      await page.waitForLoadState('networkidle');

      // 5. Confirm workspace is valid again
      await expect(wsItem.locator('.status-dot.status-valid')).toBeVisible();
      await expect(wsItem.locator('.invalid-badge')).toHaveCount(0);
    } finally {
      rmDir(fixtureRoot);
    }
  });

  test('form closes after successful workspace registration', async ({ page }) => {
    const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'diffscribe-e2e-'));
    const repo = path.join(fixtureRoot, 'repo');
    const uniqueName = `E2E-Close-${Date.now()}`;

    try {
      createGitRepo(repo);

      // Open the form
      await openWorkspaceForm(page);
      await expect(page.locator('[data-testid="open-workspace-form"]')).toBeVisible();

      // Fill and submit
      await page.fill('#ws-path', repo);
      await page.fill('#ws-name', uniqueName);
      await page.click('#open-workspace-form button[type="submit"]');

      // Wait for the success flow to complete — form should close
      await expect(page.locator('[data-testid="open-workspace-form"]')).toBeHidden({
        timeout: 10000,
      });

      // The toggle button should show "Open Workspace" (not "Close")
      const toggle = page.getByTestId('open-workspace-toggle');
      await expect(toggle).toBeVisible();
      await expect(toggle).toHaveText(/Open Workspace/i);
    } finally {
      rmDir(fixtureRoot);
    }
  });

  test('sequential workspace registrations open fresh forms', async ({ page }) => {
    const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'diffscribe-e2e-'));
    const repo1 = path.join(fixtureRoot, 'ws-1');
    const repo2 = path.join(fixtureRoot, 'ws-2');
    const name1 = `E2E-Seq1-${Date.now()}`;
    const name2 = `E2E-Seq2-${Date.now()}`;

    try {
      // First registration
      createGitRepo(repo1);
      await openWorkspaceForm(page);
      await page.fill('#ws-path', repo1);
      await page.fill('#ws-name', name1);
      await page.click('#open-workspace-form button[type="submit"]');
      await expect(page.locator('[data-testid="open-workspace-form"]')).toBeHidden({
        timeout: 10000,
      });

      // Second registration — form must be fresh (empty inputs)
      createGitRepo(repo2);
      await openWorkspaceForm(page);
      await expect(page.locator('[data-testid="open-workspace-form"]')).toBeVisible();

      // Form inputs must be empty (fresh form)
      const pathInput = page.locator('#ws-path');
      const nameInput = page.locator('#ws-name');
      await expect(pathInput).toHaveValue('');
      await expect(nameInput).toHaveValue('');

      // Fill and submit second
      await pathInput.fill(repo2);
      await nameInput.fill(name2);
      await page.click('#open-workspace-form button[type="submit"]');
      await expect(page.locator('[data-testid="open-workspace-form"]')).toBeHidden({
        timeout: 10000,
      });

      // Both workspaces should appear in the sidebar
      await expect(page.locator(`#workspace-sidebar li:has-text("${name1}")`)).toBeVisible();
      await expect(page.locator(`#workspace-sidebar li:has-text("${name2}")`)).toBeVisible();
    } finally {
      rmDir(fixtureRoot);
    }
  });
});
