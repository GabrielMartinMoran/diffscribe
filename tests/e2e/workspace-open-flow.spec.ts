import fs from 'node:fs';
import path from 'node:path';

import type { Page } from '@playwright/test';

import { expect, test } from './fixtures';
import { createGitFixture } from './helpers/git-fixture';
import { waitForHydration } from './helpers/hydration';
import { resetDb } from './helpers/reset-db';

/**
 * W2: the Open Workspace form keeps an editable repository path AND adds a
 * directory browser (webkitdirectory) that pre-fills the path with the picked
 * directory name plus a hint; manual entry remains authoritative.
 */
function initRepo(fixture: { repoPath: string; runGit(args: readonly string[]): void }): void {
  fs.writeFileSync(path.join(fixture.repoPath, 'README.md'), '# e2e');
  fixture.runGit(['add', '.']);
  fixture.runGit(['commit', '-m', 'init']);
}

async function openForm(page: Page): Promise<void> {
  await waitForHydration(page);
  const toggleBtn = page.getByTestId('open-workspace-toggle');
  await toggleBtn.click();
  await page.waitForSelector('[data-testid="open-workspace-form"]', {
    state: 'visible',
    timeout: 10000,
  });
}

test.describe('Workspace open flow (W2)', () => {
  test.beforeEach(async ({ page, request }) => {
    await resetDb(request);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('repository path field remains editable', async ({ page }) => {
    await openForm(page);
    const pathInput = page.locator('#ws-path');
    await expect(pathInput).toBeEditable();
    await expect(pathInput).toHaveAttribute('name', 'repositoryPath');
  });

  test('directory browser pre-fills the repository path with a hint', async ({ page }) => {
    const fixture = createGitFixture('diffscribe-e2e-openflow-');
    try {
      initRepo(fixture);

      await openForm(page);
      const browseBtn = page.getByTestId('ws-path-browse');
      await expect(browseBtn).toBeVisible();

      const chooserPromise = page.waitForEvent('filechooser');
      await browseBtn.click();
      const chooser = await chooserPromise;
      await chooser.setFiles(fixture.repoPath);

      // The path field is pre-filled with the picked directory name.
      await expect(page.locator('#ws-path')).toHaveValue(path.basename(fixture.repoPath), {
        timeout: 10000,
      });

      // The approved limitation hint is shown.
      await expect(page.getByTestId('ws-path-browse-hint')).toBeVisible();

      // The user can still complete the absolute path manually.
      const pathInput = page.locator('#ws-path');
      await pathInput.fill(fixture.repoPath);
      await expect(pathInput).toHaveValue(fixture.repoPath);
    } finally {
      fixture.cleanup();
    }
  });

  test('manual path entry still registers the workspace', async ({ page }) => {
    const fixture = createGitFixture('diffscribe-e2e-openflow-');
    const uniqueName = `E2E-OpenFlow-${Date.now()}`;

    try {
      initRepo(fixture);
      await openForm(page);

      await page.fill('#ws-path', fixture.repoPath);
      await page.fill('#ws-name', uniqueName);
      await page.click('#open-workspace-form button[type="submit"]');
      await page.waitForLoadState('networkidle');

      await expect(
        page.locator(`#workspace-sidebar li:has-text("${uniqueName}")`).first(),
      ).toBeVisible({ timeout: 10000 });
    } finally {
      fixture.cleanup();
    }
  });
});
