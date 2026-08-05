import fs from 'node:fs';
import path from 'node:path';

import type { Page } from '@playwright/test';

import { expect, test } from './fixtures';
import type { GitFixture } from './helpers/git-fixture';
import { createGitFixture } from './helpers/git-fixture';
import {
  registerAndSelectWorkspace,
  selectRightPanelTab,
  switchFileListToListView,
} from './helpers/register-workspace';
import { resetDb } from './helpers/reset-db';

async function createReviewAndSelectFile(page: Page, fileName = 'src/app.ts'): Promise<void> {
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

  // W4: fresh contexts default to tree; this contract drives the flat list.
  await switchFileListToListView(page);

  const fileRow = page
    .locator('[role="listbox"] [role="option"]')
    .filter({ hasText: fileName })
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
  fileName = 'src/app.ts',
): Promise<void> {
  const repoDir = fixture.repoPath;
  fs.mkdirSync(path.dirname(path.join(repoDir, fileName)), { recursive: true });
  const lines: string[] = [];
  for (let i = 1; i <= 15; i++) lines.push(`line${i}`);
  fs.writeFileSync(path.join(repoDir, fileName), lines.join('\n') + '\n');
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
  fs.writeFileSync(path.join(repoDir, fileName), modified.join('\n') + '\n');
  await resetDb(page.request);
  await page.goto('/', { waitUntil: 'networkidle' });
  await registerAndSelectWorkspace(page, repoDir, workspaceName, 'git');
  await createReviewAndSelectFile(page, fileName);
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

  test('Ctrl-click toggles individual lines', async ({ page }) => {
    const fixture = createGitFixture();
    try {
      await setupLineSelectionTest(page, fixture, 'ls-e2e');
      const a = page.locator('[data-line-num="3"][data-side="new"]').first();
      await a.click();
      const b = page.locator('[data-line-num="6"][data-side="new"]').first();
      await b.click({ modifiers: ['Control'] });
      await expect(a).toHaveAttribute('data-selected', 'true');
      await expect(b).toHaveAttribute('data-selected', 'true');

      await b.click({ modifiers: ['Control'] });
      await expect(a).toHaveAttribute('data-selected', 'true');
      await expect(b).toHaveAttribute('data-selected', 'false');
    } finally {
      fixture.cleanup();
    }
  });

  test('Command-click toggles an individual line', async ({ page }) => {
    const fixture = createGitFixture();
    try {
      await setupLineSelectionTest(page, fixture, 'ls-e2e');
      const a = page.locator('[data-line-num="3"][data-side="new"]').first();
      await a.click();
      const b = page.locator('[data-line-num="6"][data-side="new"]').first();
      await b.click({ modifiers: ['Meta'] });
      await expect(a).toHaveAttribute('data-selected', 'true');
      await expect(b).toHaveAttribute('data-selected', 'true');
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

test.describe('Observation draft auto-open E2E', () => {
  test('clicking a line opens the Comments form and focuses the body', async ({ page }) => {
    const fixture = createGitFixture();
    try {
      await setupLineSelectionTest(page, fixture, 'draft-e2e');
      const line = page.locator('[data-line-num="2"][data-side="new"]').first();
      await line.click();

      // The Comments panel is visible and shows the observation form.
      const form = page.locator('#observation-panel .obs-form');
      await expect(form).toBeVisible({ timeout: 10000 });
      await expect(page.locator('#obs-body')).toBeFocused();
    } finally {
      fixture.cleanup();
    }
  });

  test('clicking a line replaces the previous draft selection', async ({ page }) => {
    const fixture = createGitFixture();
    try {
      await setupLineSelectionTest(page, fixture, 'draft-e2e');
      const a = page.locator('[data-line-num="2"][data-side="new"]').first();
      await a.click();
      await expect(a).toHaveAttribute('data-selected', 'true');

      const b = page.locator('[data-line-num="7"][data-side="new"]').first();
      await b.click();
      await expect(a).toHaveAttribute('data-selected', 'false');
      await expect(b).toHaveAttribute('data-selected', 'true');
      await expect(page.locator('#observation-panel .obs-form')).toBeVisible();
    } finally {
      fixture.cleanup();
    }
  });

  test('cancelling the draft closes the form and clears the selection', async ({ page }) => {
    const fixture = createGitFixture();
    try {
      await setupLineSelectionTest(page, fixture, 'draft-e2e');
      const a = page.locator('[data-line-num="3"][data-side="new"]').first();
      await a.click();
      await expect(a).toHaveAttribute('data-selected', 'true');
      await expect(page.locator('#observation-panel .obs-form')).toBeVisible();

      await page
        .locator('#observation-panel .obs-form')
        .getByRole('button', { name: 'Cancel' })
        .click();
      await expect(page.locator('#observation-panel .obs-form')).toHaveCount(0);
      await expect(a).toHaveAttribute('data-selected', 'false');
    } finally {
      fixture.cleanup();
    }
  });

  test('annotation form fits inside the panel with long file paths', async ({ page }) => {
    const fixture = createGitFixture();
    try {
      const longName = 'src/' + 'very-long-directory-name-'.repeat(4) + 'app.ts';
      await setupLineSelectionTest(page, fixture, 'draft-e2e', longName);

      const line = page.locator('[data-line-num="1"][data-side="new"]').first();
      await line.click();
      const form = page.locator('#observation-panel .obs-form');
      await expect(form).toBeVisible({ timeout: 10000 });

      // Long body text must not push the panel horizontally either.
      await page.fill('#obs-body', 'a'.repeat(300) + ' ' + 'b'.repeat(300) + ' ' + 'c'.repeat(300));

      const noHorizontalOverflow = await page
        .locator('#observation-panel')
        .evaluate((el) => el.scrollWidth <= el.clientWidth + 1);
      expect(noHorizontalOverflow).toBe(true);
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

      // The click already auto-opened the form in creation mode.
      const form = page.locator('#observation-panel .obs-form');
      await expect(form).toBeVisible({ timeout: 10000 });
      await page.fill('#obs-body', 'E2E range observation');
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

      const form = page.locator('#observation-panel .obs-form');
      await expect(form).toBeVisible({ timeout: 10000 });
      await page.fill('#obs-body', 'Status test');
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

  test('create observation sends the real active comparison snapshot', async ({ page }) => {
    const fixture = createGitFixture();
    try {
      await setupLineSelectionTest(page, fixture, 'obs-e2e');
      // Create a branch, commit the working-tree changes onto it, and return
      // to master so the master vs feature Comparison has a real diff.
      fixture.runGit(['branch', 'feature']);
      fixture.runGit(['checkout', 'feature']);
      fixture.runGit(['add', 'src/app.ts']);
      fixture.runGit(['commit', '-m', 'feature changes']);
      fixture.runGit(['checkout', 'master']);

      // Reload so the Git context picks up the new branch.
      await page.reload();
      await page.waitForLoadState('networkidle');

      await page.getByTestId('rail-tab-git').click();
      const gitPanel = page.locator('#git-context-panel');
      await expect(gitPanel).toBeVisible({ timeout: 10000 });
      await page.locator('.slot-target').click();
      const branchList = page.getByRole('listbox', { name: /branches/i });
      await branchList.getByText('feature', { exact: true }).click();
      // W8: the redundant comparison caption is removed; the target slot
      // reflects the selected branch instead.
      await expect(page.locator('.comparison-type')).toHaveCount(0);
      await expect(page.locator('.slot-target .slot-value')).toHaveText(/feature/);

      // The diff refetches automatically when the comparison changes; select
      // the file again (the reload cleared the active file) and wait for the
      // fresh diff before selecting a line.
      const fileList = page.locator('#file-list-panel');
      await expect(fileList).toBeVisible({ timeout: 8000 });
      await switchFileListToListView(page);
      const fileRow = fileList.locator('.file-row').filter({ hasText: 'src/app.ts' });
      await expect(fileRow).toBeVisible({ timeout: 10000 });

      const diffPromise = page.waitForResponse(
        (resp) =>
          resp.url().includes('/file-diff') &&
          resp.request().method() === 'GET' &&
          resp.status() === 200,
      );
      await fileRow.click();
      const diffResp = await diffPromise;
      void diffResp;
      const line = page.locator('[data-line-num="1"][data-side="new"]').first();
      await expect(line).toBeVisible({ timeout: 10000 });
      await line.click();

      const postPromise = page.waitForResponse(
        (resp) =>
          resp.url().includes('/observations') &&
          resp.request().method() === 'POST' &&
          resp.status() === 201,
      );

      await page.fill('#obs-body', 'Comparison snapshot test');
      await page.click('button:has-text("Create")');
      const post = await postPromise;
      const payload = post.request().postDataJSON() as {
        comparisonSnapshotJson: string;
      };
      const snapshot = JSON.parse(payload.comparisonSnapshotJson) as {
        comparisonType: string;
      };
      expect(snapshot.comparisonType).toBe('branch-vs-branch');

      await expect(page.locator('.obs-card').first()).toContainText('Comparison snapshot test');
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
