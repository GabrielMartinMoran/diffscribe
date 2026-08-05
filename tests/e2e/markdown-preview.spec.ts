import fs from 'node:fs';
import path from 'node:path';

import { expect, test } from './fixtures';
import { createGitFixture } from './helpers/git-fixture';
import { registerAndSelectWorkspace } from './helpers/register-workspace';
import { resetDb } from './helpers/reset-db';

/**
 * W7: Markdown files expose a top-right Raw/Preview toggle in the source
 * viewer; the initial mode comes from the visualization settings aggregate
 * (default preview); preview output escapes raw HTML and unsafe links.
 */

function initRepo(fixture: { repoPath: string; runGit(args: readonly string[]): void }): void {
  fs.writeFileSync(path.join(fixture.repoPath, 'README.md'), '# e2e');
  fixture.runGit(['add', '.']);
  fixture.runGit(['commit', '-m', 'init']);
}

async function openMarkdownFile(
  page: Parameters<typeof registerAndSelectWorkspace>[0],
  fixture: { repoPath: string; runGit(args: readonly string[]): void; cleanup(): void },
  markdownContent: string,
): Promise<void> {
  fs.mkdirSync(path.join(fixture.repoPath, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(fixture.repoPath, 'docs', 'guide.md'), markdownContent);
  fixture.runGit(['add', 'docs/guide.md']);
  fixture.runGit(['commit', '-m', 'add guide']);
  fs.appendFileSync(path.join(fixture.repoPath, 'docs', 'guide.md'), '\n# working tree edit');

  await registerAndSelectWorkspace(page, fixture.repoPath, `E2E-MD-${Date.now()}`, 'project');

  // Open the Markdown file in the project tree (expand the docs directory
  // first — guide.md is nested under it).
  const docsDir = page.locator('[data-testid="tree-node"]', { hasText: 'docs' }).first();
  await expect(docsDir).toBeVisible({ timeout: 15000 });
  await docsDir.click();
  const guideNode = page.locator('[data-testid="tree-node"]', { hasText: 'guide.md' }).first();
  await expect(guideNode).toBeVisible({ timeout: 15000 });
  await guideNode.click();
  await expect(page.locator('[data-testid="source-viewer"]')).toBeVisible({ timeout: 15000 });
}

test.describe('Markdown Raw/Preview (W7)', () => {
  test.beforeEach(async ({ page, request }) => {
    await resetDb(request);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('Markdown files expose a Raw/Preview toggle at the top right', async ({ page }) => {
    const fixture = createGitFixture('diffscribe-e2e-md-');
    try {
      initRepo(fixture);
      await openMarkdownFile(page, fixture, '# Guide\n\nHello **world**.\n');

      const toggle = page.locator('[data-testid="markdown-view-toggle"]');
      await expect(toggle).toBeVisible({ timeout: 10000 });
      await expect(toggle.getByRole('button', { name: 'Preview' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      await expect(toggle.getByRole('button', { name: 'Raw' })).toHaveAttribute(
        'aria-pressed',
        'false',
      );
    } finally {
      fixture.cleanup();
    }
  });

  test('default view comes from settings (preview default, raw when configured)', async ({
    page,
  }) => {
    const fixture = createGitFixture('diffscribe-e2e-md-');
    try {
      initRepo(fixture);
      await openMarkdownFile(page, fixture, '# Guide\n\nHello **world**.\n');

      // Default: preview is shown initially.
      await expect(page.locator('[data-testid="markdown-preview-content"]')).toBeVisible({
        timeout: 10000,
      });
      await expect(page.locator('[data-testid="markdown-preview-content"]')).toContainText('Hello');
      // The raw view is not the active one.
      const rawToggle = page.locator('[data-testid="markdown-view-toggle"]').getByRole('button', {
        name: 'Raw',
      });
      await expect(rawToggle).toHaveAttribute('aria-pressed', 'false');

      // Configure raw as the default, reopen the file, and verify raw shows.
      await page.getByTestId('rail-tab-settings').click();
      await page.getByTestId('settings-markdown-raw').click();
      await expect(page.getByTestId('settings-markdown-raw')).toHaveAttribute(
        'aria-pressed',
        'true',
      );

      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.getByTestId('rail-tab-project').click();
      const docsDir = page.locator('[data-testid="tree-node"]', { hasText: 'docs' }).first();
      await expect(docsDir).toBeVisible({ timeout: 15000 });
      await docsDir.click();
      const guideNode = page.locator('[data-testid="tree-node"]', { hasText: 'guide.md' }).first();
      await expect(guideNode).toBeVisible({ timeout: 15000 });
      await guideNode.click();
      await expect(page.locator('[data-testid="source-viewer"]')).toBeVisible({ timeout: 15000 });

      await expect(
        page.locator('[data-testid="markdown-view-toggle"]').getByRole('button', {
          name: 'Raw',
        }),
      ).toHaveAttribute('aria-pressed', 'true');
      // Raw shows the highlighted source lines.
      await expect(page.locator('[data-testid="source-content"]')).toBeVisible({ timeout: 10000 });
    } finally {
      fixture.cleanup();
    }
  });

  test('preview escapes raw HTML and rejects unsafe links', async ({ page }) => {
    const fixture = createGitFixture('diffscribe-e2e-md-');
    try {
      initRepo(fixture);
      await openMarkdownFile(
        page,
        fixture,
        '# Guide\n\n<script>alert(1)</script>\n\n[bad](javascript:alert(1))\n\n[ok](https://example.com)\n',
      );

      const toggle = page.locator('[data-testid="markdown-view-toggle"]');
      await expect(toggle).toBeVisible({ timeout: 10000 });

      const preview = page.locator('[data-testid="markdown-preview-content"]');
      await expect(preview).toBeVisible({ timeout: 10000 });

      // Raw HTML renders as escaped text.
      const previewHtml = (await preview.innerHTML()) ?? '';
      expect(previewHtml).not.toContain('<script>');
      expect(previewHtml).toContain('&lt;script&gt;');

      // The javascript: link is not rendered as a link.
      const badLink = preview.locator('a[href*="javascript"]');
      await expect(badLink).toHaveCount(0);
      // The safe https link is rendered.
      await expect(preview.locator('a[href="https://example.com"]')).toBeVisible();
    } finally {
      fixture.cleanup();
    }
  });

  test('non-Markdown files show no toggle', async ({ page }) => {
    const fixture = createGitFixture('diffscribe-e2e-md-');
    try {
      initRepo(fixture);
      fs.mkdirSync(path.join(fixture.repoPath, 'src'), { recursive: true });
      fs.writeFileSync(path.join(fixture.repoPath, 'src', 'app.ts'), '// app\n');
      fixture.runGit(['add', 'src/app.ts']);
      fixture.runGit(['commit', '-m', 'add app']);

      await registerAndSelectWorkspace(page, fixture.repoPath, `E2E-MDNo-${Date.now()}`, 'project');
      const srcDir = page.locator('[data-testid="tree-node"]', { hasText: 'src' }).first();
      await expect(srcDir).toBeVisible({ timeout: 15000 });
      await srcDir.click();
      const appNode = page.locator('[data-testid="tree-node"]', { hasText: 'app.ts' }).first();
      await expect(appNode).toBeVisible({ timeout: 15000 });
      await appNode.click();
      await expect(page.locator('[data-testid="source-viewer"]')).toBeVisible({ timeout: 15000 });

      await expect(page.locator('[data-testid="markdown-view-toggle"]')).toHaveCount(0);
    } finally {
      fixture.cleanup();
    }
  });
});
