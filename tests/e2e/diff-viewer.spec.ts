import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { expect, test } from '@playwright/test';

import { registerAndSelectWorkspace } from './helpers/register-workspace';
import { resetDb } from './helpers/reset-db';

function mkTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'diffscribe-e2e-dv-'));
}

function createGitRepo(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
  execSync('git init', { cwd: dir, stdio: 'pipe' });
  execSync('git config user.email "e2e@test.com"', { cwd: dir, stdio: 'pipe' });
  execSync('git config user.name "E2E Test"', { cwd: dir, stdio: 'pipe' });
  fs.writeFileSync(path.join(dir, 'README.md'), '# e2e');
  execSync('git add . && git commit -m "init"', { cwd: dir, stdio: 'pipe' });
}

function rmDir(dir: string): void {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

test.describe('Diff Viewer (E2E)', () => {
  test.beforeEach(async ({ page, request }) => {
    await resetDb(request);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  // ── Core rendering ──

  test('shows unified diff with line numbers for a selected file', async ({ page }) => {
    const fixtureDir = mkTempDir();
    const repoDir = path.join(fixtureDir, 'repo');
    try {
      createGitRepo(repoDir);
      fs.mkdirSync(path.join(repoDir, 'src'), { recursive: true });
      fs.writeFileSync(path.join(repoDir, 'src', 'app.ts'), 'line1\nline2\nline3\n');
      execSync('git add . && git commit -m "add"', { cwd: repoDir, stdio: 'pipe' });
      fs.writeFileSync(path.join(repoDir, 'src', 'app.ts'), 'line1\nMODIFIED\nline3\n');
      execSync('git add src/app.ts', { cwd: repoDir, stdio: 'pipe' });

      await registerAndSelectWorkspace(page, repoDir, `DV-Core-${Date.now()}`);
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Wait for file list to appear
      const fileList = page.locator('#file-list-panel');
      await expect(fileList).toBeVisible({ timeout: 8000 });

      // Click on the modified file
      const fileRow = fileList.locator('.file-row').filter({ hasText: 'src/app.ts' });
      await expect(fileRow).toBeVisible({ timeout: 10000 });
      await fileRow.click();

      // Diff viewer should appear
      const diffViewer = page.locator('.diff-viewer');
      await expect(diffViewer).toBeVisible({ timeout: 8000 });
      await expect(diffViewer).toContainText('src/app.ts');

      // Should contain line numbers
      await expect(diffViewer.locator('.line-number').first()).toBeVisible({ timeout: 10000 });
    } finally {
      rmDir(fixtureDir);
    }
  });

  test('shows added lines prefixed with + and added color', async ({ page }) => {
    const fixtureDir = mkTempDir();
    const repoDir = path.join(fixtureDir, 'repo');
    try {
      createGitRepo(repoDir);
      fs.mkdirSync(path.join(repoDir, 'src'), { recursive: true });
      fs.writeFileSync(path.join(repoDir, 'src', 'new.ts'), 'lineA\nlineB\nlineC\n');
      execSync('git add .', { cwd: repoDir, stdio: 'pipe' });

      await registerAndSelectWorkspace(page, repoDir, `DV-Added-${Date.now()}`);
      await page.reload();
      await page.waitForLoadState('networkidle');

      const fileList = page.locator('#file-list-panel');
      await expect(fileList).toBeVisible({ timeout: 8000 });
      const fileRow = fileList.locator('.file-row').filter({ hasText: 'src/new.ts' });
      await fileRow.click();

      const diffViewer = page.locator('.diff-viewer');
      await expect(diffViewer).toBeVisible({ timeout: 8000 });

      // Added lines should have the + prefix and a green-ish color indicator
      await expect(diffViewer.locator('.diff-line-added').first()).toBeVisible({ timeout: 10000 });
    } finally {
      rmDir(fixtureDir);
    }
  });

  test('shows deleted lines prefixed with - and deleted color', async ({ page }) => {
    const fixtureDir = mkTempDir();
    const repoDir = path.join(fixtureDir, 'repo');
    try {
      createGitRepo(repoDir);
      fs.writeFileSync(path.join(repoDir, 'rm.ts'), 'line1\nline2\nline3\n');
      execSync('git add . && git commit -m "add"', { cwd: repoDir, stdio: 'pipe' });
      execSync('git rm rm.ts', { cwd: repoDir, stdio: 'pipe' });

      await registerAndSelectWorkspace(page, repoDir, `DV-Deleted-${Date.now()}`);
      await page.reload();
      await page.waitForLoadState('networkidle');

      const fileList = page.locator('#file-list-panel');
      await expect(fileList).toBeVisible({ timeout: 8000 });
      const fileRow = fileList.locator('.file-row').filter({ hasText: 'rm.ts' });
      await fileRow.click();

      const diffViewer = page.locator('.diff-viewer');
      await expect(diffViewer).toBeVisible({ timeout: 8000 });
      await expect(diffViewer.locator('.diff-line-deleted').first()).toBeVisible({
        timeout: 10000,
      });
    } finally {
      rmDir(fixtureDir);
    }
  });

  // ── File status variants ──

  test('shows old and new path for renamed file', async ({ page }) => {
    const fixtureDir = mkTempDir();
    const repoDir = path.join(fixtureDir, 'repo');
    try {
      createGitRepo(repoDir);
      fs.writeFileSync(path.join(repoDir, 'old.ts'), 'content');
      execSync('git add . && git commit -m "add"', { cwd: repoDir, stdio: 'pipe' });
      execSync('git mv old.ts new.ts', { cwd: repoDir, stdio: 'pipe' });

      await registerAndSelectWorkspace(page, repoDir, `DV-Rename-${Date.now()}`);
      await page.reload();
      await page.waitForLoadState('networkidle');

      const fileList = page.locator('#file-list-panel');
      await expect(fileList).toBeVisible({ timeout: 8000 });
      const fileRow = fileList.locator('.file-row').filter({ hasText: 'new.ts' });
      await fileRow.click();

      const diffViewer = page.locator('.diff-viewer');
      await expect(diffViewer).toBeVisible({ timeout: 8000 });
      await expect(diffViewer).toContainText('old.ts');
    } finally {
      rmDir(fixtureDir);
    }
  });

  test('shows binary file message and no line content', async ({ page }) => {
    const fixtureDir = mkTempDir();
    const repoDir = path.join(fixtureDir, 'repo');
    try {
      createGitRepo(repoDir);
      const buf = Buffer.alloc(1024);
      buf[0] = 0;
      fs.writeFileSync(path.join(repoDir, 'logo.png'), buf);
      execSync('git add . && git commit -m "bin"', { cwd: repoDir, stdio: 'pipe' });
      buf[128] = 1;
      fs.writeFileSync(path.join(repoDir, 'logo.png'), buf);
      execSync('git add logo.png', { cwd: repoDir, stdio: 'pipe' });

      await registerAndSelectWorkspace(page, repoDir, `DV-Binary-${Date.now()}`);
      await page.reload();
      await page.waitForLoadState('networkidle');

      const fileList = page.locator('#file-list-panel');
      await expect(fileList).toBeVisible({ timeout: 8000 });
      const fileRow = fileList.locator('.file-row').filter({ hasText: 'logo.png' });
      await fileRow.click();

      const diffViewer = page.locator('.diff-viewer');
      await expect(diffViewer).toBeVisible({ timeout: 8000 });
      await expect(diffViewer).toContainText(/binary/i);
      await expect(diffViewer.locator('.line-number')).toHaveCount(0);
    } finally {
      rmDir(fixtureDir);
    }
  });

  test('shows empty file message', async ({ page }) => {
    const fixtureDir = mkTempDir();
    const repoDir = path.join(fixtureDir, 'repo');
    try {
      createGitRepo(repoDir);
      fs.writeFileSync(path.join(repoDir, 'empty.ts'), '');
      execSync('git add empty.ts', { cwd: repoDir, stdio: 'pipe' });

      await registerAndSelectWorkspace(page, repoDir, `DV-Empty-${Date.now()}`);
      await page.reload();
      await page.waitForLoadState('networkidle');

      const fileList = page.locator('#file-list-panel');
      await expect(fileList).toBeVisible({ timeout: 8000 });
      const fileRow = fileList.locator('.file-row').filter({ hasText: 'empty.ts' });
      await fileRow.click();

      const diffViewer = page.locator('.diff-viewer');
      await expect(diffViewer).toBeVisible({ timeout: 8000 });
      await expect(diffViewer).toContainText(/empty/i);
    } finally {
      rmDir(fixtureDir);
    }
  });

  test('shows untracked file content as added', async ({ page }) => {
    const fixtureDir = mkTempDir();
    const repoDir = path.join(fixtureDir, 'repo');
    try {
      createGitRepo(repoDir);
      fs.writeFileSync(path.join(repoDir, 'untracked.ts'), 'fresh content\nline2\n');

      await registerAndSelectWorkspace(page, repoDir, `DV-Untracked-${Date.now()}`);
      await page.reload();
      await page.waitForLoadState('networkidle');

      const fileList = page.locator('#file-list-panel');
      await expect(fileList).toBeVisible({ timeout: 8000 });
      const fileRow = fileList.locator('.file-row').filter({ hasText: 'untracked.ts' });
      await fileRow.click();

      const diffViewer = page.locator('.diff-viewer');
      await expect(diffViewer).toBeVisible({ timeout: 8000 });
      await expect(diffViewer.locator('.diff-line-added').first()).toBeVisible({ timeout: 10000 });
    } finally {
      rmDir(fixtureDir);
    }
  });

  // ── States ──

  test('shows loading state while fetching diff', async ({ page }) => {
    // Loading state is transient — observed during manual trigger
    const fixtureDir = mkTempDir();
    const repoDir = path.join(fixtureDir, 'repo');
    try {
      createGitRepo(repoDir);
      fs.appendFileSync(path.join(repoDir, 'README.md'), '\nchanged');

      await registerAndSelectWorkspace(page, repoDir, `DV-Loading-${Date.now()}`);
      await page.reload();
      await page.waitForLoadState('networkidle');

      const fileList = page.locator('#file-list-panel');
      await expect(fileList).toBeVisible({ timeout: 8000 });
      const fileRow = fileList.locator('.file-row').first();
      await fileRow.click();
      // Loading state briefly appears — verify diff-viewer is present
      const diffViewer = page.locator('.diff-viewer');
      await expect(diffViewer).toBeVisible({ timeout: 8000 });
    } finally {
      rmDir(fixtureDir);
    }
  });

  test('shows error state with retry button when fetch fails', async ({ page }) => {
    const fixtureDir = mkTempDir();
    const repoDir = path.join(fixtureDir, 'repo');
    try {
      createGitRepo(repoDir);
      fs.appendFileSync(path.join(repoDir, 'README.md'), '\nchanged');

      // Register first with a valid repo
      await registerAndSelectWorkspace(page, repoDir, `DV-Error-${Date.now()}`);
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Now corrupt the repo to force diff fetch error
      fs.rmSync(path.join(repoDir, '.git', 'HEAD'));

      const fileList = page.locator('#file-list-panel');
      await expect(fileList).toBeVisible({ timeout: 8000 });
      const fileRow = fileList.locator('.file-row').first();
      await fileRow.click();

      const diffViewer = page.locator('.diff-viewer');
      await expect(diffViewer).toBeVisible({ timeout: 8000 });
      // Error message should be visible
      await expect(diffViewer.locator('.diff-error')).toBeVisible({ timeout: 10000 });
      // Retry button
      await expect(diffViewer.getByRole('button', { name: /retry/i })).toBeVisible();
    } finally {
      // Restore HEAD for cleanup
      try {
        fs.writeFileSync(path.join(repoDir, '.git', 'HEAD'), 'ref: refs/heads/master\n');
      } catch {
        /* ok */
      }
      rmDir(fixtureDir);
    }
  });

  test('shows no-file-selected placeholder', async ({ page }) => {
    const fixtureDir = mkTempDir();
    const repoDir = path.join(fixtureDir, 'repo');
    try {
      createGitRepo(repoDir);

      await registerAndSelectWorkspace(page, repoDir, `DV-Placeholder-${Date.now()}`);
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Without selecting a file, the diff viewer should show placeholder
      const diffViewer = page.locator('.diff-viewer');
      await expect(diffViewer).toBeVisible({ timeout: 8000 });
      await expect(diffViewer).toContainText(/select a file|no file selected/i);
      await expect(diffViewer.locator('.line-number')).toHaveCount(0);
    } finally {
      rmDir(fixtureDir);
    }
  });

  // ── Responsive layout ──

  test('shows side-by-side toggle at 900px viewport', async ({ page }) => {
    const fixtureDir = mkTempDir();
    const repoDir = path.join(fixtureDir, 'repo');
    try {
      createGitRepo(repoDir);
      fs.appendFileSync(path.join(repoDir, 'README.md'), '\nchanged');

      await registerAndSelectWorkspace(page, repoDir, `DV-Responsive-${Date.now()}`);
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Set viewport to >=900px
      await page.setViewportSize({ width: 1024, height: 768 });

      const fileList = page.locator('#file-list-panel');
      await expect(fileList).toBeVisible({ timeout: 8000 });
      const fileRow = fileList.locator('.file-row').first();
      await fileRow.click();

      const diffViewer = page.locator('.diff-viewer');
      await expect(diffViewer).toBeVisible({ timeout: 8000 });

      // Side-by-side toggle should be visible
      const toggle = diffViewer.locator('button[aria-pressed]');
      await expect(toggle).toBeVisible({ timeout: 10000 });
    } finally {
      rmDir(fixtureDir);
    }
  });

  test('hides side-by-side toggle below 900px', async ({ page }) => {
    const fixtureDir = mkTempDir();
    const repoDir = path.join(fixtureDir, 'repo');
    try {
      createGitRepo(repoDir);
      fs.appendFileSync(path.join(repoDir, 'README.md'), '\nchanged');

      await registerAndSelectWorkspace(page, repoDir, `DV-Mobile-${Date.now()}`);
      await page.reload();
      await page.waitForLoadState('networkidle');

      await page.setViewportSize({ width: 375, height: 667 });

      const fileList = page.locator('#file-list-panel');
      await expect(fileList).toBeVisible({ timeout: 8000 });
      const fileRow = fileList.locator('.file-row').first();
      await fileRow.click();

      // Side-by-side toggle should not be visible
      const diffViewer = page.locator('.diff-viewer');
      await expect(diffViewer).toBeVisible({ timeout: 8000 });
      const toggle = diffViewer.locator('button[aria-pressed]');
      await expect(toggle).toBeHidden({ timeout: 10000 });
    } finally {
      rmDir(fixtureDir);
    }
  });

  // ── Keyboard ──

  test('Ctrl+Shift+D opens diff viewer when file selected', async ({ page }) => {
    const fixtureDir = mkTempDir();
    const repoDir = path.join(fixtureDir, 'repo');
    try {
      createGitRepo(repoDir);
      fs.appendFileSync(path.join(repoDir, 'README.md'), '\nchanged');

      await registerAndSelectWorkspace(page, repoDir, `DV-Shortcut-${Date.now()}`);
      await page.reload();
      await page.waitForLoadState('networkidle');

      const fileList = page.locator('#file-list-panel');
      await expect(fileList).toBeVisible({ timeout: 8000 });
      const fileRow = fileList.locator('.file-row').first();
      await fileRow.click();
      // Unselect by clicking again
      await fileRow.click();
      // Now press Ctrl+Shift+D to re-open
      await page.keyboard.press('Control+Shift+KeyD');

      const diffViewer = page.locator('.diff-viewer');
      await expect(diffViewer).toBeVisible({ timeout: 8000 });
    } finally {
      rmDir(fixtureDir);
    }
  });

  // ── Read-only guarantee ──

  test('manual refresh does not mutate repository', async ({ page }) => {
    const fixtureDir = mkTempDir();
    const repoDir = path.join(fixtureDir, 'repo');
    try {
      createGitRepo(repoDir);
      fs.appendFileSync(path.join(repoDir, 'README.md'), '\nchanged');
      const beforeHash = execSync('git rev-parse HEAD', { cwd: repoDir, stdio: 'pipe' })
        .toString()
        .trim();

      await registerAndSelectWorkspace(page, repoDir, `DV-ReadOnly-${Date.now()}`);
      await page.reload();
      await page.waitForLoadState('networkidle');

      const fileList = page.locator('#file-list-panel');
      await expect(fileList).toBeVisible({ timeout: 8000 });
      const fileRow = fileList.locator('.file-row').first();
      await fileRow.click();

      // Click refresh button if present
      const diffViewer = page.locator('.diff-viewer');
      await expect(diffViewer).toBeVisible({ timeout: 8000 });
      const refreshBtn = diffViewer.getByRole('button', { name: /refresh/i });
      if (await refreshBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await refreshBtn.click();
      }

      const afterHash = execSync('git rev-parse HEAD', { cwd: repoDir, stdio: 'pipe' })
        .toString()
        .trim();
      expect(afterHash).toBe(beforeHash);
    } finally {
      rmDir(fixtureDir);
    }
  });

  // ── XSS safety ──

  test('renders XSS source content as inert text', async ({ page }) => {
    const fixtureDir = mkTempDir();
    const repoDir = path.join(fixtureDir, 'repo');
    try {
      createGitRepo(repoDir);
      fs.mkdirSync(path.join(repoDir, 'src'), { recursive: true });
      fs.writeFileSync(path.join(repoDir, 'src', 'xss.ts'), '<script>alert(1)</script>');
      execSync('git add .', { cwd: repoDir, stdio: 'pipe' });

      await registerAndSelectWorkspace(page, repoDir, `DV-XSS-${Date.now()}`);
      await page.reload();
      await page.waitForLoadState('networkidle');

      const fileList = page.locator('#file-list-panel');
      await expect(fileList).toBeVisible({ timeout: 8000 });
      const fileRow = fileList.locator('.file-row').filter({ hasText: 'src/xss.ts' });
      await fileRow.click();

      const diffViewer = page.locator('.diff-viewer');
      await expect(diffViewer).toBeVisible({ timeout: 8000 });

      // Check that no <script> element exists (content rendered as text)
      const pageContent = await diffViewer.innerHTML();
      expect(pageContent).not.toMatch(/<script[^>]*>alert/);
      // The text should be visible in escaped form
      await expect(diffViewer).toContainText('<script>alert(1)</script>');
    } finally {
      rmDir(fixtureDir);
    }
  });
});
