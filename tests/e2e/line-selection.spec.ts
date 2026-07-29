import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { registerAndSelectWorkspace, selectRightPanelTab } from './helpers/register-workspace';
import { resetDb } from './helpers/reset-db';

function mkTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'diffscribe-e2e-obs-'));
}

function createGitRepo(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
  execSync('git init', { cwd: dir, stdio: 'pipe' });
  execSync('git config user.email "e2e@test.com"', { cwd: dir, stdio: 'pipe' });
  execSync('git config user.name "E2E Test"', { cwd: dir, stdio: 'pipe' });
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  const lines: string[] = [];
  for (let i = 1; i <= 15; i++) lines.push(`line${i}`);
  fs.writeFileSync(path.join(dir, 'src/app.ts'), lines.join('\n') + '\n');
  execSync('git add . && git commit -m "init"', { cwd: dir, stdio: 'pipe' });
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
  fs.writeFileSync(path.join(dir, 'src/app.ts'), modified.join('\n') + '\n');
}

function rmDir(dir: string): void {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

async function createReviewAndSelectFile(page: Page): Promise<void> {
  // Right panel defaults to Comments on every page load; select Review first
  await selectRightPanelTab(page, 'review');

  const newReviewBtn = page.getByRole('button', { name: /New Review|Start a new review/ });
  await expect(newReviewBtn).toBeVisible({ timeout: 15000 });
  await expect(newReviewBtn).toBeEnabled({ timeout: 15000 });
  await newReviewBtn.click();
  await page.waitForLoadState('networkidle');

  // createReview() uses fetch + invalidateAll (no page reload), so right
  // panel stays on Review. Switch back to Comments so #observation-panel
  // is available for downstream tests.
  await selectRightPanelTab(page, 'comments');

  const fileRow = page
    .locator('[role="listbox"] [role="option"]')
    .filter({ hasText: 'src/app.ts' })
    .first();
  await expect(fileRow).toBeVisible({ timeout: 15000 });
  await fileRow.click();
  await expect(page.locator('[data-line-num]').first()).toBeVisible({ timeout: 10000 });
}

test.describe('Line selection E2E', () => {
  let repoDir: string;

  test.beforeEach(async ({ page }) => {
    repoDir = mkTempDir();
    createGitRepo(repoDir);
    await resetDb(page.request);
    await page.goto('/');
    await registerAndSelectWorkspace(page, repoDir, 'ls-e2e', 'git');
    await createReviewAndSelectFile(page);
  });

  test.afterEach(() => rmDir(repoDir));

  test('selects a single line with mouse click', async ({ page }) => {
    const line = page.locator('[data-line-num="1"][data-side="new"]').first();
    await expect(line).toBeVisible({ timeout: 8000 });
    await line.click();
    await expect(line).toHaveAttribute('data-selected', 'true');
  });

  test('selects a line range with Shift+click', async ({ page }) => {
    const a = page.locator('[data-line-num="3"][data-side="new"]').first();
    await a.click();
    const b = page.locator('[data-line-num="6"][data-side="new"]').first();
    await b.click({ modifiers: ['Shift'] });
    for (let i = 3; i <= 6; i++) {
      await expect(page.locator(`[data-line-num="${i}"][data-side="new"]`).first()).toHaveAttribute(
        'data-selected',
        'true',
      );
    }
  });

  test('clears selection with Escape', async ({ page }) => {
    const line = page.locator('[data-line-num="4"][data-side="new"]').first();
    await line.click();
    await expect(line).toHaveAttribute('data-selected', 'true');
    await page.keyboard.press('Escape');
    await expect(line).toHaveAttribute('data-selected', 'false');
  });
});

test.describe('Observation CRUD E2E', () => {
  let repoDir: string;

  test.beforeEach(async ({ page }) => {
    repoDir = mkTempDir();
    createGitRepo(repoDir);
    await resetDb(page.request);
    await page.goto('/');
    await registerAndSelectWorkspace(page, repoDir, 'obs-e2e', 'git');
    await createReviewAndSelectFile(page);
  });

  test.afterEach(() => rmDir(repoDir));

  test('creates range observation and can delete it', async ({ page }) => {
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
  });

  test('resolves observation and reopens it', async ({ page }) => {
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
  });
});

test.describe('Responsive observation panel', () => {
  let repoDir: string;

  test.beforeEach(async ({ page }) => {
    repoDir = mkTempDir();
    createGitRepo(repoDir);
    await resetDb(page.request);
    await page.goto('/');
    await registerAndSelectWorkspace(page, repoDir, 'resp-e2e', 'git');
    await createReviewAndSelectFile(page);
  });

  test.afterEach(() => rmDir(repoDir));

  test('right rail visible at wide viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 900 });
    await expect(page.locator('#observation-panel')).toBeVisible({ timeout: 10000 });
  });

  test('drawer visible at narrow viewport', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 900 });
    await expect(page.locator('#observation-panel')).toBeVisible({ timeout: 10000 });
  });
});
