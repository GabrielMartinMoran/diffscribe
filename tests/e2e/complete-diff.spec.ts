import fs from 'node:fs';
import path from 'node:path';

import type { Page } from '@playwright/test';

import { expect, test } from './fixtures';
import { createGitFixture } from './helpers/git-fixture';
import { registerAndSelectWorkspace } from './helpers/register-workspace';
import { resetDb } from './helpers/reset-db';

/**
 * W6: the Git rail shows the complete diff of the active comparison by
 * default; plain click scrolls to a file section; Ctrl/Cmd-click opens a new
 * full-file tab in Project mode; binary/truncated markers render.
 */

interface Fixture {
  repoPath: string;
  runGit(args: readonly string[]): void;
  cleanup(): void;
}

function createRepo(prefix = 'diffscribe-e2e-cd-'): Fixture {
  const fixture = createGitFixture(prefix);
  fs.writeFileSync(path.join(fixture.repoPath, 'README.md'), '# e2e');
  fixture.runGit(['add', '.']);
  fixture.runGit(['commit', '-m', 'init']);
  return fixture;
}

function addChange(fixture: Fixture, relPath: string, content: string): void {
  const fullPath = path.join(fixture.repoPath, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content);
}

test.describe('Complete diff (W6)', () => {
  test.beforeEach(async ({ page, request }) => {
    await resetDb(request);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  async function openWithChanges(page: Page, fixture: Fixture): Promise<void> {
    addChange(fixture, 'README.md', '# e2e\nmore content\n');
    await registerAndSelectWorkspace(page, fixture.repoPath, `E2E-CD-${Date.now()}`, 'git');
    const viewer = page.locator('[data-testid="complete-diff-viewer"]');
    await expect(viewer).toBeVisible({ timeout: 15000 });
  }

  test('Git shows the complete diff by default with no open file tab', async ({ page }) => {
    const fixture = createRepo();
    try {
      await openWithChanges(page, fixture);
      const viewer = page.locator('[data-testid="complete-diff-viewer"]');
      await expect(viewer).toBeVisible();
      // The complete diff renders as the pinned first tab without a file tab
      // open.
      await expect(page.getByTestId('pinned-complete-diff-tab')).toHaveCount(1);
      await expect(page.getByTestId('pinned-complete-diff-tab')).toHaveAttribute(
        'aria-selected',
        'true',
      );
      await expect(page.getByTestId('open-file-tab')).toHaveCount(0);
      await expect(viewer.locator('text=README.md').first()).toBeVisible();
    } finally {
      fixture.cleanup();
    }
  });

  test('complete diff lists files in deterministic order', async ({ page }) => {
    const fixture = createRepo();
    try {
      addChange(fixture, 'zeta.txt', 'z\n');
      addChange(fixture, 'alpha.txt', 'a\n');
      addChange(fixture, 'README.md', '# e2e\nmore\n');
      await registerAndSelectWorkspace(page, fixture.repoPath, `E2E-CDOrd-${Date.now()}`, 'git');

      const viewer = page.locator('[data-testid="complete-diff-viewer"]');
      await expect(viewer).toBeVisible({ timeout: 15000 });

      const sections = viewer.locator('[data-testid^="file-diff-section-"]');
      await expect(sections.first()).toBeVisible({ timeout: 10000 });
      // Assert DOM order equals ascending path order (localeCompare
      // semantics, matching the adapter contract) using the real paths
      // exposed through the section aria-labels (encoded testids sort
      // differently than real paths).
      const paths = await sections.evaluateAll((els) =>
        els.map((el) => el.getAttribute('aria-label') ?? ''),
      );
      const sorted = [...paths].sort((a, b) => a.localeCompare(b));
      expect(paths).toEqual(sorted);
    } finally {
      fixture.cleanup();
    }
  });

  test('clicking a file scrolls to its diff section', async ({ page }) => {
    const fixture = createRepo();
    try {
      // Enough files to make the first section scroll out of view.
      for (let i = 0; i < 12; i++) {
        addChange(fixture, `dir-${String(i).padStart(2, '0')}/file-${i}.txt`, `content ${i}\n`);
      }
      addChange(fixture, 'zzz-last.txt', 'last\n');
      await registerAndSelectWorkspace(page, fixture.repoPath, `E2E-CDScroll-${Date.now()}`, 'git');

      const viewer = page.locator('[data-testid="complete-diff-viewer"]');
      await expect(viewer).toBeVisible({ timeout: 15000 });

      const target = viewer.locator('[data-testid="file-diff-section-zzz-last.txt"]');

      // Click the file index entry for the last file.
      await viewer
        .locator('[data-testid="complete-diff-index"]')
        .getByRole('button', { name: /zzz-last\.txt/ })
        .click();

      // The target section is scrolled into the viewport of the complete
      // diff scroll container.
      await expect(target).toBeInViewport({ timeout: 10000 });
    } finally {
      fixture.cleanup();
    }
  });

  test('Ctrl/Cmd-click opens a full-file tab and switches to Project', async ({ page }) => {
    const fixture = createRepo();
    try {
      addChange(fixture, 'src/app.ts', '// app\nline2\n');
      await openWithChanges(page, fixture);

      const viewer = page.locator('[data-testid="complete-diff-viewer"]');
      const targetBtn = viewer
        .locator('[data-testid="complete-diff-index"]')
        .getByRole('button', { name: /src\/app\.ts/ });
      await expect(targetBtn).toBeVisible();

      // Ctrl-click opens the file in a new tab and switches to Project rail.
      await targetBtn.click({ modifiers: ['Control'] });
      await expect(page.locator('[data-testid="rail-tab-project"]')).toHaveAttribute(
        'aria-selected',
        'true',
        { timeout: 10000 },
      );
      // The source viewer shows the full file.
      await expect(page.locator('[data-testid="source-viewer"]')).toBeVisible({ timeout: 15000 });
      await expect(page.locator('[data-testid="open-files-tabs"]')).toContainText('src/app.ts');
      // The pinned complete-diff tab remains the first tab.
      await expect(page.getByTestId('pinned-complete-diff-tab')).toHaveCount(1);
      const tabOrder = page
        .locator('[data-testid="open-files-tabs"]')
        .locator('[role="tab"]')
        .evaluateAll((els) => els.map((el) => (el.textContent ?? '').trim()));
      expect(await tabOrder).toEqual(['Complete diff', 'src/app.ts']);
    } finally {
      fixture.cleanup();
    }
  });

  test('binary files render a marker without content', async ({ page }) => {
    const fixture = createRepo();
    try {
      addChange(fixture, 'src/logo.png', 'not really a png but treated as text\n');
      fixture.runGit(['add', '.']);
      fixture.runGit(['commit', '-m', 'add png']);
      fs.writeFileSync(
        path.join(fixture.repoPath, 'src/logo.png'),
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01, 0x02]),
      );
      await registerAndSelectWorkspace(page, fixture.repoPath, `E2E-CDBin-${Date.now()}`, 'git');

      const viewer = page.locator('[data-testid="complete-diff-viewer"]');
      await expect(viewer).toBeVisible({ timeout: 15000 });
      const section = viewer.locator('[data-testid="file-diff-section-src_logo.png"]');
      await expect(section).toBeVisible({ timeout: 10000 });
      await expect(section.locator('[data-testid="complete-diff-binary-marker"]')).toBeVisible();
      await expect(section.locator('[data-testid="complete-diff-hunk"]')).toHaveCount(0);
    } finally {
      fixture.cleanup();
    }
  });

  test('empty comparison shows the empty state', async ({ page }) => {
    const fixture = createRepo();
    try {
      await registerAndSelectWorkspace(page, fixture.repoPath, `E2E-CDEmpty-${Date.now()}`, 'git');
      const viewer = page.locator('[data-testid="complete-diff-viewer"]');
      await expect(viewer).toBeVisible({ timeout: 15000 });
      await expect(page.getByTestId('pinned-complete-diff-tab')).toHaveCount(1);
      await expect(viewer.locator('text=No changes in this comparison')).toBeVisible({
        timeout: 10000,
      });
    } finally {
      fixture.cleanup();
    }
  });
});
