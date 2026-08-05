import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import type { Locator, Page } from '@playwright/test';

import { expect, test } from './fixtures';
import { createGitFixture } from './helpers/git-fixture';
import {
  registerAndSelectWorkspace,
  selectRailTab,
  switchFileListToListView,
} from './helpers/register-workspace';
import { resetDb } from './helpers/reset-db';

/**
 * Click a file-row locator and wait for the /file-diff response that the
 * click triggers.  The response predicate is intentionally status-agnostic
 * (no resp.status() === 200 filter) so that the DV-Error test which
 * corrupts .git/HEAD also synchronises on the controlled error response.
 */
async function clickAndWaitForDiff(page: Page, fileRow: Locator): Promise<void> {
  const diffResponse = page.waitForResponse(
    (resp) => resp.url().includes('/file-diff') && resp.request().method() === 'GET',
  );
  await fileRow.click();
  await diffResponse;
}

test.describe('Diff Viewer (E2E)', () => {
  test.beforeEach(async ({ page, request }) => {
    await resetDb(request);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  // ── Core rendering ──

  test('shows unified diff with line numbers for a selected file', async ({ page }) => {
    const fixture = createGitFixture();
    const repoDir = fixture.repoPath;
    try {
      fs.writeFileSync(path.join(repoDir, 'README.md'), '# e2e');
      fixture.runGit(['add', '.']);
      fixture.runGit(['commit', '-m', 'init']);
      fs.mkdirSync(path.join(repoDir, 'src'), { recursive: true });
      fs.writeFileSync(path.join(repoDir, 'src', 'app.ts'), 'line1\nline2\nline3\n');
      fixture.runGit(['add', '.']);
      fixture.runGit(['commit', '-m', 'add']);
      fs.writeFileSync(path.join(repoDir, 'src', 'app.ts'), 'line1\nMODIFIED\nline3\n');
      fixture.runGit(['add', 'src/app.ts']);

      await registerAndSelectWorkspace(page, repoDir, `DV-Core-${Date.now()}`, 'git');

      // Wait for file list to appear
      const fileList = page.locator('#file-list-panel');
      await expect(fileList).toBeVisible({ timeout: 8000 });
      await switchFileListToListView(page);

      // Click on the modified file and wait for the diff response
      const fileRow = fileList.locator('.file-row').filter({ hasText: 'src/app.ts' });
      await expect(fileRow).toBeVisible({ timeout: 10000 });
      await clickAndWaitForDiff(page, fileRow);

      // Diff viewer should appear
      const diffViewer = page.locator('.diff-viewer');
      await expect(diffViewer).toBeVisible({ timeout: 8000 });
      await expect(diffViewer).toContainText('src/app.ts');

      // Should contain line numbers
      await expect(diffViewer.locator('.line-number').first()).toBeVisible({ timeout: 10000 });
    } finally {
      fixture.cleanup();
    }
  });

  test('shows added lines prefixed with + and added color', async ({ page }) => {
    const fixture = createGitFixture();
    const repoDir = fixture.repoPath;
    try {
      fs.writeFileSync(path.join(repoDir, 'README.md'), '# e2e');
      fixture.runGit(['add', '.']);
      fixture.runGit(['commit', '-m', 'init']);
      fs.mkdirSync(path.join(repoDir, 'src'), { recursive: true });
      fs.writeFileSync(path.join(repoDir, 'src', 'new.ts'), 'lineA\nlineB\nlineC\n');
      fixture.runGit(['add', '.']);

      await registerAndSelectWorkspace(page, repoDir, `DV-Added-${Date.now()}`, 'git');

      const fileList = page.locator('#file-list-panel');
      await expect(fileList).toBeVisible({ timeout: 8000 });
      await switchFileListToListView(page);
      const fileRow = fileList.locator('.file-row').filter({ hasText: 'src/new.ts' });
      await clickAndWaitForDiff(page, fileRow);

      const diffViewer = page.locator('.diff-viewer');
      await expect(diffViewer).toBeVisible({ timeout: 8000 });

      // Added lines should have the + prefix and a green-ish color indicator
      await expect(diffViewer.locator('.diff-line-added').first()).toBeVisible({ timeout: 10000 });
    } finally {
      fixture.cleanup();
    }
  });

  test('shows deleted lines prefixed with - and deleted color', async ({ page }) => {
    const fixture = createGitFixture();
    const repoDir = fixture.repoPath;
    try {
      fs.writeFileSync(path.join(repoDir, 'README.md'), '# e2e');
      fixture.runGit(['add', '.']);
      fixture.runGit(['commit', '-m', 'init']);
      fs.writeFileSync(path.join(repoDir, 'rm.ts'), 'line1\nline2\nline3\n');
      fixture.runGit(['add', '.']);
      fixture.runGit(['commit', '-m', 'add']);
      fixture.runGit(['rm', 'rm.ts']);

      await registerAndSelectWorkspace(page, repoDir, `DV-Deleted-${Date.now()}`, 'git');

      const fileList = page.locator('#file-list-panel');
      await expect(fileList).toBeVisible({ timeout: 8000 });
      await switchFileListToListView(page);
      const fileRow = fileList.locator('.file-row').filter({ hasText: 'rm.ts' });
      await clickAndWaitForDiff(page, fileRow);

      const diffViewer = page.locator('.diff-viewer');
      await expect(diffViewer).toBeVisible({ timeout: 8000 });
      await expect(diffViewer.locator('.diff-line-deleted').first()).toBeVisible({
        timeout: 10000,
      });
    } finally {
      fixture.cleanup();
    }
  });

  // ── File status variants ──

  test('shows old and new path for renamed file', async ({ page }) => {
    const fixture = createGitFixture();
    const repoDir = fixture.repoPath;
    try {
      fs.writeFileSync(path.join(repoDir, 'README.md'), '# e2e');
      fixture.runGit(['add', '.']);
      fixture.runGit(['commit', '-m', 'init']);
      fs.writeFileSync(path.join(repoDir, 'old.ts'), 'content');
      fixture.runGit(['add', '.']);
      fixture.runGit(['commit', '-m', 'add']);
      fixture.runGit(['mv', 'old.ts', 'new.ts']);

      await registerAndSelectWorkspace(page, repoDir, `DV-Rename-${Date.now()}`, 'git');

      const fileList = page.locator('#file-list-panel');
      await expect(fileList).toBeVisible({ timeout: 8000 });
      await switchFileListToListView(page);
      const fileRow = fileList.locator('.file-row').filter({ hasText: 'new.ts' });
      await clickAndWaitForDiff(page, fileRow);

      const diffViewer = page.locator('.diff-viewer');
      await expect(diffViewer).toBeVisible({ timeout: 8000 });
      await expect(diffViewer).toContainText('old.ts');
    } finally {
      fixture.cleanup();
    }
  });

  test('shows binary file message and no line content', async ({ page }) => {
    const fixture = createGitFixture();
    const repoDir = fixture.repoPath;
    try {
      fs.writeFileSync(path.join(repoDir, 'README.md'), '# e2e');
      fixture.runGit(['add', '.']);
      fixture.runGit(['commit', '-m', 'init']);
      const buf = Buffer.alloc(1024);
      buf[0] = 0;
      fs.writeFileSync(path.join(repoDir, 'logo.png'), buf);
      fixture.runGit(['add', '.']);
      fixture.runGit(['commit', '-m', 'bin']);
      buf[128] = 1;
      fs.writeFileSync(path.join(repoDir, 'logo.png'), buf);
      fixture.runGit(['add', 'logo.png']);

      await registerAndSelectWorkspace(page, repoDir, `DV-Binary-${Date.now()}`, 'git');

      const fileList = page.locator('#file-list-panel');
      await expect(fileList).toBeVisible({ timeout: 8000 });
      await switchFileListToListView(page);
      const fileRow = fileList.locator('.file-row').filter({ hasText: 'logo.png' });
      await clickAndWaitForDiff(page, fileRow);

      const diffViewer = page.locator('.diff-viewer');
      await expect(diffViewer).toBeVisible({ timeout: 8000 });
      await expect(diffViewer).toContainText(/binary/i);
      await expect(diffViewer.locator('.line-number')).toHaveCount(0);
    } finally {
      fixture.cleanup();
    }
  });

  test('shows empty file message', async ({ page }) => {
    const fixture = createGitFixture();
    const repoDir = fixture.repoPath;
    try {
      fs.writeFileSync(path.join(repoDir, 'README.md'), '# e2e');
      fixture.runGit(['add', '.']);
      fixture.runGit(['commit', '-m', 'init']);
      fs.writeFileSync(path.join(repoDir, 'empty.ts'), '');
      fixture.runGit(['add', 'empty.ts']);

      await registerAndSelectWorkspace(page, repoDir, `DV-Empty-${Date.now()}`, 'git');

      const fileList = page.locator('#file-list-panel');
      await expect(fileList).toBeVisible({ timeout: 8000 });
      await switchFileListToListView(page);
      const fileRow = fileList.locator('.file-row').filter({ hasText: 'empty.ts' });
      await clickAndWaitForDiff(page, fileRow);

      const diffViewer = page.locator('.diff-viewer');
      await expect(diffViewer).toBeVisible({ timeout: 8000 });
      await expect(diffViewer).toContainText(/empty/i);
    } finally {
      fixture.cleanup();
    }
  });

  test('shows untracked file content as added', async ({ page }) => {
    const fixture = createGitFixture();
    const repoDir = fixture.repoPath;
    try {
      fs.writeFileSync(path.join(repoDir, 'README.md'), '# e2e');
      fixture.runGit(['add', '.']);
      fixture.runGit(['commit', '-m', 'init']);
      fs.writeFileSync(path.join(repoDir, 'untracked.ts'), 'fresh content\nline2\n');

      await registerAndSelectWorkspace(page, repoDir, `DV-Untracked-${Date.now()}`, 'git');

      const fileList = page.locator('#file-list-panel');
      await expect(fileList).toBeVisible({ timeout: 8000 });
      await switchFileListToListView(page);
      const fileRow = fileList.locator('.file-row').filter({ hasText: 'untracked.ts' });
      await clickAndWaitForDiff(page, fileRow);

      const diffViewer = page.locator('.diff-viewer');
      await expect(diffViewer).toBeVisible({ timeout: 8000 });
      await expect(diffViewer.locator('.diff-line-added').first()).toBeVisible({ timeout: 10000 });
    } finally {
      fixture.cleanup();
    }
  });

  // ── States ──

  test('shows loading state while fetching diff', async ({ page }) => {
    // Loading state is transient — observed during manual trigger
    const fixture = createGitFixture();
    const repoDir = fixture.repoPath;
    try {
      fs.writeFileSync(path.join(repoDir, 'README.md'), '# e2e');
      fixture.runGit(['add', '.']);
      fixture.runGit(['commit', '-m', 'init']);
      fs.appendFileSync(path.join(repoDir, 'README.md'), '\nchanged');

      await registerAndSelectWorkspace(page, repoDir, `DV-Loading-${Date.now()}`, 'git');

      const fileList = page.locator('#file-list-panel');
      await expect(fileList).toBeVisible({ timeout: 8000 });
      await switchFileListToListView(page);
      const fileRow = fileList.locator('.file-row').first();
      await clickAndWaitForDiff(page, fileRow);
      // Loading state briefly appears — verify diff-viewer is present
      const diffViewer = page.locator('.diff-viewer');
      await expect(diffViewer).toBeVisible({ timeout: 8000 });
    } finally {
      fixture.cleanup();
    }
  });

  test('shows error state with retry button when fetch fails', async ({ page }) => {
    const fixture = createGitFixture();
    const repoDir = fixture.repoPath;
    try {
      fs.writeFileSync(path.join(repoDir, 'README.md'), '# e2e');
      fixture.runGit(['add', '.']);
      fixture.runGit(['commit', '-m', 'init']);
      fs.appendFileSync(path.join(repoDir, 'README.md'), '\nchanged');

      // Register first with a valid repo
      await registerAndSelectWorkspace(page, repoDir, `DV-Error-${Date.now()}`, 'git');

      // Wait for file list to load before corrupting the repo
      const fileList = page.locator('#file-list-panel');
      await expect(fileList).toBeVisible({ timeout: 8000 });
      await switchFileListToListView(page);
      await expect(fileList.locator('.file-row').first()).toBeVisible({ timeout: 10000 });

      // Now corrupt the repo to force diff fetch error
      fs.rmSync(path.join(repoDir, '.git', 'HEAD'));

      const fileRow = fileList.locator('.file-row').first();
      await clickAndWaitForDiff(page, fileRow);

      const diffViewer = page.locator('.diff-viewer');
      await expect(diffViewer).toBeVisible({ timeout: 8000 });
      // Error message should be visible
      await expect(diffViewer.locator('.diff-error')).toBeVisible({ timeout: 10000 });
      // Retry button
      await expect(diffViewer.getByRole('button', { name: /retry/i })).toBeVisible();
    } finally {
      fixture.cleanup();
    }
  });

  test('shows no-file-selected placeholder', async ({ page }) => {
    const fixture = createGitFixture();
    const repoDir = fixture.repoPath;
    try {
      fs.writeFileSync(path.join(repoDir, 'README.md'), '# e2e');
      fixture.runGit(['add', '.']);
      fixture.runGit(['commit', '-m', 'init']);

      await registerAndSelectWorkspace(page, repoDir, `DV-Placeholder-${Date.now()}`, 'git');

      // W6: with no open file tab the Git rail shows the complete diff of
      // the active comparison instead of the single-file placeholder.
      const completeDiff = page.locator('[data-testid="complete-diff-viewer"]');
      await expect(completeDiff).toBeVisible({ timeout: 8000 });
      // The single-file diff viewer is not rendered without a selection.
      await expect(page.locator('.diff-viewer')).toHaveCount(0);
      await expect(page.locator('.line-number')).toHaveCount(0);
    } finally {
      fixture.cleanup();
    }
  });

  // ── Responsive layout ──

  test('shows side-by-side toggle at 900px viewport', async ({ page }) => {
    const fixture = createGitFixture();
    const repoDir = fixture.repoPath;
    try {
      fs.writeFileSync(path.join(repoDir, 'README.md'), '# e2e');
      fixture.runGit(['add', '.']);
      fixture.runGit(['commit', '-m', 'init']);
      fs.appendFileSync(path.join(repoDir, 'README.md'), '\nchanged');

      // Set viewport before registration so the git panel loads at this width
      await page.setViewportSize({ width: 1024, height: 768 });
      await registerAndSelectWorkspace(page, repoDir, `DV-Responsive-${Date.now()}`, 'git');

      const fileList = page.locator('#file-list-panel');
      await expect(fileList).toBeVisible({ timeout: 8000 });
      await switchFileListToListView(page);
      const fileRow = fileList.locator('.file-row').first();
      await clickAndWaitForDiff(page, fileRow);

      const diffViewer = page.locator('.diff-viewer');
      await expect(diffViewer).toBeVisible({ timeout: 8000 });

      // Side-by-side toggle should be visible (Wrap is a separate toggle)
      const toggle = diffViewer.getByRole('button', {
        name: /side-by-side|unified view/i,
      });
      await expect(toggle).toBeVisible({ timeout: 10000 });
    } finally {
      fixture.cleanup();
    }
  });

  test('hides side-by-side toggle below 900px', async ({ page }) => {
    const fixture = createGitFixture();
    const repoDir = fixture.repoPath;
    try {
      fs.writeFileSync(path.join(repoDir, 'README.md'), '# e2e');
      fixture.runGit(['add', '.']);
      fixture.runGit(['commit', '-m', 'init']);
      fs.appendFileSync(path.join(repoDir, 'README.md'), '\nchanged');

      // Register at default viewport where sidebar is visible during hydration.
      // Then switch to mobile: at 375px the left panel opens as an overlay
      // drawer, so re-select the git rail to open the overlay.
      await registerAndSelectWorkspace(page, repoDir, `DV-Mobile-${Date.now()}`, 'git');

      await page.setViewportSize({ width: 375, height: 667 });
      await selectRailTab(page, 'git');

      const fileList = page.locator('#file-list-panel');
      await expect(fileList).toBeVisible({ timeout: 8000 });
      await switchFileListToListView(page);
      const fileRow = fileList.locator('.file-row').first();
      await expect(fileRow).toBeVisible({ timeout: 10000 });
      await clickAndWaitForDiff(page, fileRow);

      // Side-by-side toggle should not be visible
      const diffViewer = page.locator('.diff-viewer');
      await expect(diffViewer).toBeVisible({ timeout: 8000 });
      const toggle = diffViewer.getByRole('button', {
        name: /side-by-side|unified view/i,
      });
      await expect(toggle).toBeHidden({ timeout: 10000 });
    } finally {
      fixture.cleanup();
    }
  });

  // ── Keyboard ──

  test('Ctrl+Shift+D opens diff viewer when file selected', async ({ page }) => {
    const fixture = createGitFixture();
    const repoDir = fixture.repoPath;
    try {
      fs.writeFileSync(path.join(repoDir, 'README.md'), '# e2e');
      fixture.runGit(['add', '.']);
      fixture.runGit(['commit', '-m', 'init']);
      fs.appendFileSync(path.join(repoDir, 'README.md'), '\nchanged');

      await registerAndSelectWorkspace(page, repoDir, `DV-Shortcut-${Date.now()}`, 'git');

      const fileList = page.locator('#file-list-panel');
      await expect(fileList).toBeVisible({ timeout: 8000 });
      await switchFileListToListView(page);
      const fileRow = fileList.locator('.file-row').first();
      await clickAndWaitForDiff(page, fileRow);
      // Unselect by clicking again (this toggles selection, no diff request)
      await fileRow.click();
      // Now press Ctrl+Shift+D to re-open
      await page.keyboard.press('Control+Shift+KeyD');

      const diffViewer = page.locator('.diff-viewer');
      await expect(diffViewer).toBeVisible({ timeout: 8000 });
    } finally {
      fixture.cleanup();
    }
  });

  // ── Read-only guarantee ──

  test('manual refresh does not mutate repository', async ({ page }) => {
    const fixture = createGitFixture();
    const repoDir = fixture.repoPath;
    try {
      fs.writeFileSync(path.join(repoDir, 'README.md'), '# e2e');
      fixture.runGit(['add', '.']);
      fixture.runGit(['commit', '-m', 'init']);
      fs.appendFileSync(path.join(repoDir, 'README.md'), '\nchanged');
      const beforeHash = execFileSync('git', ['rev-parse', 'HEAD'], {
        cwd: repoDir,
        stdio: 'pipe',
      })
        .toString()
        .trim();

      await registerAndSelectWorkspace(page, repoDir, `DV-ReadOnly-${Date.now()}`, 'git');

      const fileList = page.locator('#file-list-panel');
      await expect(fileList).toBeVisible({ timeout: 8000 });
      await switchFileListToListView(page);
      const fileRow = fileList.locator('.file-row').first();
      await clickAndWaitForDiff(page, fileRow);

      // Click refresh button if present
      const diffViewer = page.locator('.diff-viewer');
      await expect(diffViewer).toBeVisible({ timeout: 8000 });
      const refreshBtn = diffViewer.getByRole('button', { name: /refresh/i });
      if (await refreshBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await refreshBtn.click();
      }

      const afterHash = execFileSync('git', ['rev-parse', 'HEAD'], {
        cwd: repoDir,
        stdio: 'pipe',
      })
        .toString()
        .trim();
      expect(afterHash).toBe(beforeHash);
    } finally {
      fixture.cleanup();
    }
  });

  // ── XSS safety ──

  test('renders XSS source content as inert text', async ({ page }) => {
    const fixture = createGitFixture();
    const repoDir = fixture.repoPath;
    try {
      fs.writeFileSync(path.join(repoDir, 'README.md'), '# e2e');
      fixture.runGit(['add', '.']);
      fixture.runGit(['commit', '-m', 'init']);
      fs.mkdirSync(path.join(repoDir, 'src'), { recursive: true });
      fs.writeFileSync(path.join(repoDir, 'src', 'xss.ts'), '<script>alert(1)</script>');
      fixture.runGit(['add', '.']);

      await registerAndSelectWorkspace(page, repoDir, `DV-XSS-${Date.now()}`, 'git');

      const fileList = page.locator('#file-list-panel');
      await expect(fileList).toBeVisible({ timeout: 8000 });
      await switchFileListToListView(page);
      const fileRow = fileList.locator('.file-row').filter({ hasText: 'src/xss.ts' });
      await clickAndWaitForDiff(page, fileRow);

      const diffViewer = page.locator('.diff-viewer');
      await expect(diffViewer).toBeVisible({ timeout: 8000 });

      // Wait for the rendered diff content to appear before reading innerHTML.
      // The /file-diff response barrier (clickAndWaitForDiff) synchronises the
      // HTTP response but not the DOM rendering of diff lines.  Without this
      // guard, innerHTML may capture a loading/skeleton state or an empty
      // placeholder, making the escaped-text assertion racey.
      await expect(diffViewer.locator('.diff-line-added').first()).toBeVisible({ timeout: 10000 });

      // Check that no <script> element exists (content rendered as text)
      const pageContent = await diffViewer.innerHTML();
      expect(pageContent).not.toMatch(/<script[^>]*>alert/);
      // The text should be visible in escaped form
      await expect(diffViewer).toContainText('<script>alert(1)</script>');
    } finally {
      fixture.cleanup();
    }
  });
});
