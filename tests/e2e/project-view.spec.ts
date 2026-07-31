import fs from 'node:fs';
import path from 'node:path';

import { expect, test } from './fixtures';
import { createGitFixture } from './helpers/git-fixture';
import { waitForHydration } from './helpers/hydration';
import { registerAndActivate } from './helpers/register-workspace';
import { resetDb } from './helpers/reset-db';

function makeProjectRepo(fixture: {
  repoPath: string;
  runGit(args: readonly string[]): void;
}): void {
  const repoDir = fixture.repoPath;

  // Root files
  fs.writeFileSync(path.join(repoDir, 'README.md'), '# Project\n\nRoot readme content.');
  fs.writeFileSync(path.join(repoDir, 'package.json'), JSON.stringify({ name: 'test' }, null, 2));

  // Nested directory
  const srcDir = path.join(repoDir, 'src');
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

  fixture.runGit(['add', '.']);
  fixture.runGit(['commit', '-m', 'initial']);

  // Create modified and untracked files for change indicators
  fs.appendFileSync(path.join(repoDir, 'README.md'), '\n// modified content\n');
  fs.writeFileSync(path.join(repoDir, 'scratch.ts'), '// untracked file\n');
  fs.writeFileSync(path.join(srcDir, 'new-file.ts'), '// new tracked file\n');
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
    const fixture = createGitFixture('diffscribe-e2e-pv-');
    try {
      makeProjectRepo(fixture);
      await registerAndActivate(page, fixture.repoPath, `PV-Tree-${Date.now()}`);
      await page.reload();
      // Re-verify Svelte 5 hydration after reload before any delegated-handler clicks
      await waitForHydration(page);

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
      fixture.cleanup();
    }
  });

  test('PROJECT-VIEW-UI-01: Nested directories are expandable', async ({ page }) => {
    const fixture = createGitFixture('diffscribe-e2e-pv-');
    try {
      makeProjectRepo(fixture);
      await registerAndActivate(page, fixture.repoPath, `PV-Nest-${Date.now()}`);
      await page.reload();
      // Re-verify Svelte 5 hydration after reload before any delegated-handler clicks
      await waitForHydration(page);

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
      fixture.cleanup();
    }
  });

  test('PROJECT-VIEW-UI-01: Changed files show change status indicators', async ({ page }) => {
    const fixture = createGitFixture('diffscribe-e2e-pv-');
    try {
      makeProjectRepo(fixture);
      await registerAndActivate(page, fixture.repoPath, `PV-Change-${Date.now()}`);
      await page.reload();
      // Re-verify Svelte 5 hydration after reload before any delegated-handler clicks
      await waitForHydration(page);

      // Open Project tab
      const projectTab = page.locator('[data-testid="rail-tabs"] [role="tab"]').nth(1);
      await projectTab.click();
      const projectTree = page.locator('[data-testid="project-tree"]');
      await expect(projectTree).toBeVisible({ timeout: 8000 });

      // Wait for the tree to finish loading before checking change indicators
      const readmeNode = projectTree
        .locator('[data-testid="tree-node"]', { hasText: 'README.md' })
        .first();
      await expect(readmeNode).toBeVisible({ timeout: 15000 });
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
      fixture.cleanup();
    }
  });

  test('PROJECT-VIEW-UI-01: Opening a file from Project tree shows SourceViewer', async ({
    page,
  }) => {
    const fixture = createGitFixture('diffscribe-e2e-pv-');
    try {
      makeProjectRepo(fixture);
      await registerAndActivate(page, fixture.repoPath, `PV-Source-${Date.now()}`);
      await page.reload();
      // Re-verify Svelte 5 hydration after reload before any delegated-handler clicks
      await waitForHydration(page);

      // Open Project tab
      const projectTab = page.locator('[data-testid="rail-tabs"] [role="tab"]').nth(1);
      await projectTab.click();
      const projectTree = page.locator('[data-testid="project-tree"]');
      await expect(projectTree).toBeVisible({ timeout: 8000 });

      // Wait for the tree to finish loading: a loaded tree-node containing README.md
      // and its file-entry must be visible before clicking (avoids the readiness
      // race where [data-testid="project-tree"] exists in loading state before
      // the async /api/workspaces/:id/tree response arrives).
      const readmeNode = projectTree
        .locator('[data-testid="tree-node"]', { hasText: 'README.md' })
        .first();
      await expect(readmeNode).toBeVisible({ timeout: 15000 });
      const fileEntry = readmeNode.locator('[data-testid="file-entry"]');
      await expect(fileEntry).toBeVisible({ timeout: 5000 });
      await fileEntry.click();

      // Wait for the source viewer to load: the file-path element proves that
      // the Svelte reactivity chain (store update → $effect → fetch → re-render)
      // has completed.  The source-viewer container itself is always present
      // even in the "no file selected" state, so we wait for the inner element.
      const filePath = page.locator('[data-testid="source-file-path"]');
      await expect(filePath).toBeVisible({ timeout: 15000 });
      await expect(filePath).toContainText('README.md');

      // Source viewer content should be displayed
      const sourceContent = page.locator('[data-testid="source-content"]');
      await expect(sourceContent).toBeVisible();

      // The content should contain modified text
      await expect(sourceContent).toContainText('modified content');

      // Source viewer is read-only — no textarea or contenteditable
      const sourceViewer = page.locator('[data-testid="source-viewer"]');
      await expect(sourceViewer.locator('textarea')).not.toBeVisible();
      await expect(sourceViewer.locator('[contenteditable]')).not.toBeVisible();
    } finally {
      fixture.cleanup();
    }
  });

  test('PROJECT-VIEW-UI-01: Source viewer shows line numbers and change markers', async ({
    page,
  }) => {
    const fixture = createGitFixture('diffscribe-e2e-pv-');
    try {
      makeProjectRepo(fixture);
      await registerAndActivate(page, fixture.repoPath, `PV-Lines-${Date.now()}`);
      await page.reload();
      // Re-verify Svelte 5 hydration after reload before any delegated-handler clicks
      await waitForHydration(page);

      // Open Project tab
      const projectTab = page.locator('[data-testid="rail-tabs"] [role="tab"]').nth(1);
      await projectTab.click();
      const projectTree = page.locator('[data-testid="project-tree"]');
      await expect(projectTree).toBeVisible({ timeout: 8000 });

      // Wait for the tree to finish loading before clicking the file entry
      const readmeNode = projectTree
        .locator('[data-testid="tree-node"]', { hasText: 'README.md' })
        .first();
      await expect(readmeNode).toBeVisible({ timeout: 15000 });
      const fileEntry = readmeNode.locator('[data-testid="file-entry"]');
      await expect(fileEntry).toBeVisible({ timeout: 5000 });
      await fileEntry.click();

      // Wait for source content to finish loading (observable readiness)
      const sourceViewer = page.locator('[data-testid="source-viewer"]');
      const sourceContent = sourceViewer.locator('[data-testid="source-content"]');
      await expect(sourceContent).toBeVisible({ timeout: 15000 });

      // Line numbers should be present
      const lineNumbers = sourceContent.locator('[data-testid="line-number"]');
      const count = await lineNumbers.count();
      expect(count).toBeGreaterThanOrEqual(3);

      // Change markers should be visible for modified lines
      const changeMarkers = sourceViewer.locator('[data-testid="change-marker"]');
      const markerCount = await changeMarkers.count();
      expect(markerCount).toBeGreaterThanOrEqual(1);
    } finally {
      fixture.cleanup();
    }
  });

  test('PROJECT-VIEW-UI-01: Switching to Git tab shows DiffViewer', async ({ page }) => {
    const fixture = createGitFixture('diffscribe-e2e-pv-');
    try {
      makeProjectRepo(fixture);
      await registerAndActivate(page, fixture.repoPath, `PV-Git-${Date.now()}`);
      await page.reload();
      // Re-verify Svelte 5 hydration after reload before any delegated-handler clicks
      await waitForHydration(page);

      // Open Project tab and select a file
      const rail = page.locator('[data-testid="rail-tabs"]');
      const projectTab = rail.locator('[role="tab"]').nth(1);
      await projectTab.click();
      const projectTree = page.locator('[data-testid="project-tree"]');
      await expect(projectTree).toBeVisible({ timeout: 8000 });

      const readmeNode = projectTree
        .locator('[data-testid="tree-node"]', { hasText: 'README.md' })
        .first();
      await expect(readmeNode).toBeVisible({ timeout: 15000 });
      const fileEntry = readmeNode.locator('[data-testid="file-entry"]');
      await expect(fileEntry).toBeVisible({ timeout: 5000 });
      await fileEntry.click();

      // Wait for source content to load as observable readiness before switching tabs
      await expect(page.locator('[data-testid="source-content"]')).toBeVisible({ timeout: 15000 });

      // Switch to Git tab
      const gitTab = rail.locator('[role="tab"]').nth(2);
      await gitTab.click();

      // Git context panel should be visible
      await expect(page.locator('#git-context-panel')).toBeVisible({ timeout: 8000 });

      // The center should show DiffViewer (not SourceViewer)
      const diffViewer = page.locator('[aria-label="Diff viewer"]');
      await expect(diffViewer).toBeVisible({ timeout: 8000 });
    } finally {
      fixture.cleanup();
    }
  });
});
