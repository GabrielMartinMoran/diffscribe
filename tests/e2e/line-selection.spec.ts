import fs from 'node:fs';
import path from 'node:path';

import type { Page } from '@playwright/test';

import { expect, test } from './fixtures';
import type { GitFixture } from './helpers/git-fixture';
import { createGitFixture } from './helpers/git-fixture';
import { registerAndSelectWorkspace, selectRightPanelTab } from './helpers/register-workspace';
import { resetDb } from './helpers/reset-db';

async function createReviewAndSelectFile(page: Page): Promise<void> {
  // Right panel defaults to Comments on every page load; select Review first
  await selectRightPanelTab(page, 'review');

  const newReviewBtn = page.getByRole('button', { name: /New Review|Start a new review/ });
  await expect(newReviewBtn).toBeVisible({ timeout: 15000 });
  await expect(newReviewBtn).toBeEnabled({ timeout: 15000 });

  // Register review POST response promise BEFORE clicking to avoid race
  // conditions. createReview() does fetch POST (returns 201), then calls
  // invalidateAll() which cascades into a __data.json page data refresh
  // and, after re-render, a file-list API fetch. We await the POST
  // response first (fast event-driven barrier), then use networkidle
  // as a safety net for the cascade. This replaces bare networkidle with
  // a targeted event-driven barrier while preserving the cascade wait.
  const reviewPostPromise = page.waitForResponse(
    (resp) =>
      resp.url().includes('/api/workspaces/') &&
      resp.url().includes('/reviews') &&
      resp.request().method() === 'POST' &&
      resp.status() === 201,
  );

  await newReviewBtn.click();
  await reviewPostPromise;
  await page.waitForLoadState('networkidle');

  // Right panel stays on Review after invalidateAll. Switch back to Comments
  // so #observation-panel is available for downstream tests.
  await selectRightPanelTab(page, 'comments');

  const fileRow = page
    .locator('[role="listbox"] [role="option"]')
    .filter({ hasText: 'src/app.ts' })
    .first();
  await expect(fileRow).toBeVisible({ timeout: 15000 });

  // Register file-diff response promise BEFORE clicking the file row.
  // The DiffViewer renders [data-line-num] only after the diff data resolves.
  const fileDiffPromise = page.waitForResponse(
    (resp) =>
      resp.url().includes('/api/workspaces/') &&
      resp.url().includes('/file-diff') &&
      resp.request().method() === 'GET' &&
      resp.status() === 200,
  );

  await fileRow.click();
  await fileDiffPromise;
  await expect(page.locator('[data-line-num]').first()).toBeVisible({ timeout: 10000 });
}

/**
 * Set up the E2E test scene required by all line-selection tests:
 * 1. Create a 15-line file in the fixture repo with 3 modifications (lines 3,6,10)
 * 2. Reset the DB, navigate to the app, register the workspace, create a review,
 *    and select the modified file.
 *
 * Each caller owns the fixture and must clean it in `finally`.
 * This follows the stable group-B per-test fixture ownership pattern.
 */
async function setupLineSelectionTest(
  page: Page,
  fixture: GitFixture,
  workspaceName: string,
): Promise<void> {
  const repoDir = fixture.repoPath;
  fs.mkdirSync(path.join(repoDir, 'src'), { recursive: true });
  const lines: string[] = [];
  for (let i = 1; i <= 15; i++) lines.push(`line${i}`);
  fs.writeFileSync(path.join(repoDir, 'src/app.ts'), lines.join('\n') + '\n');
  fixture.runGit(['add', '.']);
  fixture.runGit(['commit', '-m', 'init']);
  const modified = [
    'line1',
    'line2',
    'lineX',
    'line4',
    'line5',
    'lineY',
    'line7',
    'line8',
    'line9',
    'lineZ',
  ];
  for (let i = 11; i <= 15; i++) modified.push(`line${i}`);
  fs.writeFileSync(path.join(repoDir, 'src/app.ts'), modified.join('\n') + '\n');
  await resetDb(page.request);
  await page.goto('/', { waitUntil: 'networkidle' });
  await registerAndSelectWorkspace(page, repoDir, workspaceName, 'git');
  await createReviewAndSelectFile(page);
}

test.describe.configure({ mode: 'serial' });

test.describe('Line selection E2E', () => {
  test('selects a single line with mouse click', async ({ page }) => {
    const fixture = createGitFixture();
    try {
      await setupLineSelectionTest(page, fixture, 'ls-e2e');
      const line = page.locator('[data-line-num="1"][data-side="new"]').first();
      await expect(line).toBeVisible({ timeout: 8000 });
      await line.click();
      await expect(line).toHaveAttribute('data-selected', 'true');
    } finally {
      fixture.cleanup();
    }
  });

  test('selects a line range with Shift+click', async ({ page }) => {
    const fixture = createGitFixture();
    try {
      await setupLineSelectionTest(page, fixture, 'ls-e2e');
      const a = page.locator('[data-line-num="3"][data-side="new"]').first();
      await a.click();
      const b = page.locator('[data-line-num="6"][data-side="new"]').first();
      await b.click({ modifiers: ['Shift'] });
      for (let i = 3; i <= 6; i++) {
        await expect(
          page.locator(`[data-line-num="${i}"][data-side="new"]`).first(),
        ).toHaveAttribute('data-selected', 'true');
      }
    } finally {
      fixture.cleanup();
    }
  });

  test('clears selection with Escape', async ({ page }) => {
    const fixture = createGitFixture();
    try {
      await setupLineSelectionTest(page, fixture, 'ls-e2e');
      const line = page.locator('[data-line-num="4"][data-side="new"]').first();
      await line.click();
      await expect(line).toHaveAttribute('data-selected', 'true');
      await page.keyboard.press('Escape');
      await expect(line).toHaveAttribute('data-selected', 'false');
    } finally {
      fixture.cleanup();
    }
  });
});

test.describe('Observation CRUD E2E', () => {
  test('creates range observation and can delete it', async ({ page }) => {
    const fixture = createGitFixture();
    try {
      await setupLineSelectionTest(page, fixture, 'obs-e2e');
      const a = page.locator('[data-line-num="3"][data-side="new"]').first();
      await a.click();
      const b = page.locator('[data-line-num="6"][data-side="new"]').first();
      await b.click({ modifiers: ['Shift'] });

      const addBtn = page.locator('#observation-panel').getByRole('button', { name: /Add/ });
      await expect(addBtn).toBeVisible({ timeout: 10000 });
      await addBtn.click();
      await page.fill('#obs-title', 'E2E range observation');
      await page.selectOption('#obs-type', 'issue');
      await page.selectOption('#obs-severity', 'major');
      await page.click('button:has-text("Create")');
      await page.waitForLoadState('networkidle');

      const card = page.locator('.obs-card').first();
      await expect(card).toBeVisible({ timeout: 10000 });
      await expect(card).toContainText('E2E range observation');

      await card.hover();
      await card.getByRole('button', { name: 'Delete' }).click();
      await page.waitForLoadState('networkidle');
      await expect(page.locator('.obs-card')).toHaveCount(0);
    } finally {
      fixture.cleanup();
    }
  });

  test('resolves observation and reopens it', async ({ page }) => {
    const fixture = createGitFixture();
    try {
      await setupLineSelectionTest(page, fixture, 'obs-e2e');
      const line = page.locator('[data-line-num="5"][data-side="new"]').first();
      await line.click();

      const addBtn = page.locator('#observation-panel').getByRole('button', { name: /Add/ });
      await addBtn.click();
      await page.fill('#obs-title', 'Status test');
      await page.selectOption('#obs-type', 'note');
      await page.click('button:has-text("Create")');
      await page.waitForLoadState('networkidle');

      const card = page.locator('.obs-card').first();
      await expect(card).toBeVisible({ timeout: 10000 });

      await card.hover();
      await card.getByRole('button', { name: 'Resolve' }).click();
      await page.waitForLoadState('networkidle');
      await expect(card.locator('.status-resolved')).toBeVisible();

      await card.hover();
      await card.getByRole('button', { name: 'Reopen' }).click();
      await page.waitForLoadState('networkidle');
      await expect(card.locator('.status-open')).toBeVisible();
    } finally {
      fixture.cleanup();
    }
  });
});

test.describe('Responsive observation panel', () => {
  test('right rail visible at wide viewport', async ({ page }) => {
    const fixture = createGitFixture();
    try {
      await setupLineSelectionTest(page, fixture, 'resp-e2e');
      await page.setViewportSize({ width: 1400, height: 900 });
      await expect(page.locator('#observation-panel')).toBeVisible({ timeout: 10000 });
    } finally {
      fixture.cleanup();
    }
  });

  test('drawer visible at narrow viewport', async ({ page }) => {
    const fixture = createGitFixture();
    try {
      await setupLineSelectionTest(page, fixture, 'resp-e2e');
      await page.setViewportSize({ width: 900, height: 900 });
      await expect(page.locator('#observation-panel')).toBeVisible({ timeout: 10000 });
    } finally {
      fixture.cleanup();
    }
  });
});
