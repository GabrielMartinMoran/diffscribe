import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { expect, test } from '@playwright/test';

import { waitForHydration } from './helpers/hydration';
import { resetDb } from './helpers/reset-db';

function mkTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'diffscribe-e2e-pv-'));
}

function createGitRepo(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
  execSync('git init', { cwd: dir, stdio: 'pipe' });
  execSync('git config user.email "e2e@test.com"', { cwd: dir, stdio: 'pipe' });
  execSync('git config user.name "E2E Test"', { cwd: dir, stdio: 'pipe' });

  // Root files
  fs.writeFileSync(path.join(dir, 'README.md'), '# Project\n\nRoot readme content.');
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'test' }, null, 2));

  // Nested directory
  const srcDir = path.join(dir, 'src');
  fs.mkdirSync(srcDir, { recursive: true });
  fs.writeFileSync(path.join(srcDir, 'index.ts'), 'export const greeting = "hello";\n');
  fs.writeFileSync(
    path.join(srcDir, 'utils.ts'),
    'export function add(a: number, b: number): number {\n  return a + b;\n}\n',
  );

  // Deeper nesting
  const componentsDir = path.join(srcDir, 'components');
  fs.mkdirSync(componentsDir, { recursive: true });
  fs.writeFileSync(
    path.join(componentsDir, 'Button.tsx'),
    'export function Button() {\n  return <button>Click</button>;\n}\n',
  );

  execSync('git add .', { cwd: dir, stdio: 'pipe' });
  execSync('git commit -m "initial"', { cwd: dir, stdio: 'pipe' });

  // Create modified and untracked files for change indicators
  fs.appendFileSync(path.join(dir, 'README.md'), '\n// modified content\n');
  fs.writeFileSync(path.join(dir, 'scratch.ts'), '// untracked file\n');
  fs.writeFileSync(path.join(srcDir, 'new-file.ts'), '// new tracked file\n');
}

function rmDir(dir: string): void {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Register a workspace, select it, and wait for activation.
 * Does NOT click the Git tab (avoids registerAndSelectWorkspace's assumption).
 */
async function registerAndActivate(
  page: import('@playwright/test').Page,
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

  await page.waitForLoadState('networkidle');
}

test.describe('Project view — tree and source viewer (PROJECT-VIEW-UI-01)', () => {
  test.beforeEach(async ({ page, request }) => {
    await resetDb(request);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('PROJECT-VIEW-UI-01: Project tab shows tree with files and directories', async ({
    page,
  }) => {
    const fixtureDir = mkTempDir();
    const repoDir = path.join(fixtureDir, 'repo');
    try {
      createGitRepo(repoDir);
      await registerAndActivate(page, repoDir, `PV-Tree-${Date.now()}`);
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Open Project tab
      const rail = page.locator('[data-testid="rail-tabs"]');
      const projectTab = rail.locator('[role="tab"]').nth(1);
      await projectTab.click();
      await expect(projectTab).toHaveAttribute('aria-selected', 'true');

      // Project tree should be visible
      const projectTree = page.locator('[data-testid="project-tree"]');
      await expect(projectTree).toBeVisible({ timeout: 8000 });

      // Root entries should be visible
      await expect(projectTree.locator('text=README.md')).toBeVisible({ timeout: 5000 });
      await expect(projectTree.locator('text=src')).toBeVisible();
    } finally {
      rmDir(fixtureDir);
    }
  });

  test('PROJECT-VIEW-UI-01: Nested directories are expandable', async ({ page }) => {
    const fixtureDir = mkTempDir();
    const repoDir = path.join(fixtureDir, 'repo');
    try {
      createGitRepo(repoDir);
      await registerAndActivate(page, repoDir, `PV-Nest-${Date.now()}`);
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Open Project tab
      const projectTab = page.locator('[data-testid="rail-tabs"] [role="tab"]').nth(1);
      await projectTab.click();
      const projectTree = page.locator('[data-testid="project-tree"]');
      await expect(projectTree).toBeVisible({ timeout: 8000 });

      // Wait for actual tree nodes to appear (data must load)
      const firstTreeNode = projectTree.locator('[data-testid="tree-node"]').first();
      await expect(firstTreeNode).toBeVisible({ timeout: 10000 });

      // Expand src directory
      const srcDir = projectTree.locator('[data-testid="tree-node"]', { hasText: 'src' }).first();
      await srcDir.locator('[data-testid="expand-toggle"]').click();

      // Children should appear
      await expect(projectTree.locator('text=index.ts')).toBeVisible({ timeout: 5000 });
      await expect(projectTree.locator('text=utils.ts')).toBeVisible();
      await expect(projectTree.locator('text=components')).toBeVisible();

      // Expand components subdirectory
      const componentsDir = projectTree
        .locator('[data-testid="tree-node"]', { hasText: 'components' })
        .first();
      await componentsDir.locator('[data-testid="expand-toggle"]').click();
      await expect(projectTree.locator('text=Button.tsx')).toBeVisible({ timeout: 5000 });

      // Collapse src
      await srcDir.locator('[data-testid="expand-toggle"]').click();
      // Children should be hidden
      await expect(projectTree.locator('text=index.ts')).not.toBeVisible();
    } finally {
      rmDir(fixtureDir);
    }
  });

  test('PROJECT-VIEW-UI-01: Changed files show change status indicators', async ({ page }) => {
    const fixtureDir = mkTempDir();
    const repoDir = path.join(fixtureDir, 'repo');
    try {
      createGitRepo(repoDir);
      await registerAndActivate(page, repoDir, `PV-Change-${Date.now()}`);
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Open Project tab
      const projectTab = page.locator('[data-testid="rail-tabs"] [role="tab"]').nth(1);
      await projectTab.click();
      const projectTree = page.locator('[data-testid="project-tree"]');
      await expect(projectTree).toBeVisible({ timeout: 8000 });

      // README.md should show a modified indicator
      const readmeNode = projectTree
        .locator('[data-testid="tree-node"]', { hasText: 'README.md' })
        .first();
      await expect(readmeNode.locator('[data-testid="change-indicator"]')).toBeVisible();

      // scratch.ts should show an untracked indicator
      const scratchNode = projectTree
        .locator('[data-testid="tree-node"]', { hasText: 'scratch.ts' })
        .first();
      await expect(scratchNode.locator('[data-testid="change-indicator"]')).toBeVisible();

      // package.json is unchanged — no indicator
      const pkgNode = projectTree
        .locator('[data-testid="tree-node"]', { hasText: 'package.json' })
        .first();
      // Unchanged files should not have a change indicator
      // Check the ancestor tree-node scope
      await expect(pkgNode.locator('[data-testid="change-indicator"]')).not.toBeVisible();
    } finally {
      rmDir(fixtureDir);
    }
  });

  test('PROJECT-VIEW-UI-01: Opening a file from Project tree shows SourceViewer', async ({
    page,
  }) => {
    const fixtureDir = mkTempDir();
    const repoDir = path.join(fixtureDir, 'repo');
    try {
      createGitRepo(repoDir);
      await registerAndActivate(page, repoDir, `PV-Source-${Date.now()}`);
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Open Project tab
      const projectTab = page.locator('[data-testid="rail-tabs"] [role="tab"]').nth(1);
      await projectTab.click();
      const projectTree = page.locator('[data-testid="project-tree"]');
      await expect(projectTree).toBeVisible({ timeout: 8000 });

      // Click README.md (a modified file) — opens source viewer
      const readmeNode = projectTree
        .locator('[data-testid="tree-node"]', { hasText: 'README.md' })
        .first();
      await readmeNode.locator('[data-testid="file-entry"]').click();

      // SourceViewer should be visible in the center
      const sourceViewer = page.locator('[data-testid="source-viewer"]');
      await expect(sourceViewer).toBeVisible({ timeout: 8000 });

      // File path should be shown
      await expect(sourceViewer.locator('[data-testid="source-file-path"]')).toContainText(
        'README.md',
      );

      // Content should be displayed
      const sourceContent = sourceViewer.locator('[data-testid="source-content"]');
      await expect(sourceContent).toBeVisible();

      // The content should contain modified text
      await expect(sourceContent).toContainText('modified content');

      // Source viewer is read-only — no textarea or contenteditable
      await expect(sourceViewer.locator('textarea')).not.toBeVisible();
      await expect(sourceViewer.locator('[contenteditable]')).not.toBeVisible();
    } finally {
      rmDir(fixtureDir);
    }
  });

  test('PROJECT-VIEW-UI-01: Source viewer shows line numbers and change markers', async ({
    page,
  }) => {
    const fixtureDir = mkTempDir();
    const repoDir = path.join(fixtureDir, 'repo');
    try {
      createGitRepo(repoDir);
      await registerAndActivate(page, repoDir, `PV-Lines-${Date.now()}`);
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Open Project tab
      const projectTab = page.locator('[data-testid="rail-tabs"] [role="tab"]').nth(1);
      await projectTab.click();
      const projectTree = page.locator('[data-testid="project-tree"]');
      await expect(projectTree).toBeVisible({ timeout: 8000 });

      // Click README.md
      const readmeNode = projectTree
        .locator('[data-testid="tree-node"]', { hasText: 'README.md' })
        .first();
      await readmeNode.locator('[data-testid="file-entry"]').click();

      const sourceViewer = page.locator('[data-testid="source-viewer"]');
      await expect(sourceViewer).toBeVisible({ timeout: 8000 });

      // Wait for content to finish loading
      const sourceContent = sourceViewer.locator('[data-testid="source-content"]');
      await expect(sourceContent).toBeVisible({ timeout: 8000 });

      // Line numbers should be present
      const lineNumbers = sourceContent.locator('[data-testid="line-number"]');
      const count = await lineNumbers.count();
      expect(count).toBeGreaterThanOrEqual(3);

      // Change markers should be visible for modified lines
      const changeMarkers = sourceViewer.locator('[data-testid="change-marker"]');
      const markerCount = await changeMarkers.count();
      expect(markerCount).toBeGreaterThanOrEqual(1);
    } finally {
      rmDir(fixtureDir);
    }
  });

  test('PROJECT-VIEW-UI-01: Switching to Git tab shows DiffViewer', async ({ page }) => {
    const fixtureDir = mkTempDir();
    const repoDir = path.join(fixtureDir, 'repo');
    try {
      createGitRepo(repoDir);
      await registerAndActivate(page, repoDir, `PV-Git-${Date.now()}`);
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Open Project tab and select a file
      const rail = page.locator('[data-testid="rail-tabs"]');
      const projectTab = rail.locator('[role="tab"]').nth(1);
      await projectTab.click();
      const projectTree = page.locator('[data-testid="project-tree"]');
      await expect(projectTree).toBeVisible({ timeout: 8000 });

      const readmeNode = projectTree
        .locator('[data-testid="tree-node"]', { hasText: 'README.md' })
        .first();
      await readmeNode.locator('[data-testid="file-entry"]').click();

      // Source viewer is visible
      await expect(page.locator('[data-testid="source-viewer"]')).toBeVisible({ timeout: 8000 });

      // Switch to Git tab
      const gitTab = rail.locator('[role="tab"]').nth(2);
      await gitTab.click();

      // Git context panel should be visible
      await expect(page.locator('#git-context-panel')).toBeVisible({ timeout: 8000 });

      // The center should show DiffViewer (not SourceViewer)
      const diffViewer = page.locator('[aria-label="Diff viewer"]');
      await expect(diffViewer).toBeVisible({ timeout: 8000 });
    } finally {
      rmDir(fixtureDir);
    }
  });
});
