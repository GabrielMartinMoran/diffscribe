import fs from 'node:fs';
import path from 'node:path';

import { expect, test } from './fixtures';
import { createGitFixture } from './helpers/git-fixture';
import { waitForHydration } from './helpers/hydration';
import {
  registerAndActivate,
  registerAndSelectWorkspace,
  selectRailTab,
} from './helpers/register-workspace';
import { resetDb } from './helpers/reset-db';

/**
 * Pinned complete-diff tab (0003): the complete diff is the first synthetic
 * workspace-scoped tab, non-closable, revisitable from any rail, refreshed in
 * place on comparison change, replaced on workspace switch, and absent
 * without an active workspace.
 */

interface Fixture {
  repoPath: string;
  runGit(args: readonly string[]): void;
  cleanup(): void;
}

function createRepo(prefix = 'diffscribe-e2e-pin-'): Fixture {
  const fixture = createGitFixture(prefix);
  fs.writeFileSync(path.join(fixture.repoPath, 'README.md'), '# e2e\n');
  fixture.runGit(['add', '.']);
  fixture.runGit(['commit', '-m', 'init']);
  return fixture;
}

function addChange(fixture: Fixture, relPath: string, content: string): void {
  const fullPath = path.join(fixture.repoPath, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content);
}

function makeProjectRepo(fixture: Fixture): void {
  fs.mkdirSync(path.join(fixture.repoPath, 'src', 'lib'), { recursive: true });
  fs.writeFileSync(path.join(fixture.repoPath, 'src', 'app.ts'), 'export const app = 1;\n');
  fs.writeFileSync(
    path.join(fixture.repoPath, 'src', 'lib', 'util.ts'),
    'export const util = 2;\n',
  );
  fixture.runGit(['add', '.']);
  fixture.runGit(['commit', '-m', 'init']);
}

async function openProjectTree(page: Parameters<typeof selectRailTab>[0]): Promise<void> {
  await selectRailTab(page, 'project');
  const projectTree = page.locator('[data-testid="project-tree"]');
  await expect(projectTree).toBeVisible({ timeout: 10000 });
  const srcDir = projectTree.locator('[data-testid="tree-node"]', { hasText: 'src' }).first();
  await srcDir.locator('[data-testid="expand-toggle"]').click();
  const libDir = projectTree.locator('[data-testid="tree-node"]', { hasText: 'lib' }).first();
  await libDir.locator('[data-testid="expand-toggle"]').click();
}

async function clickTreeFile(
  page: Parameters<typeof selectRailTab>[0],
  name: string,
): Promise<void> {
  const projectTree = page.locator('[data-testid="project-tree"]');
  const node = projectTree.locator('[data-testid="tree-node"]', { hasText: name }).first();
  await expect(node.locator('[data-testid="file-entry"]')).toBeVisible({ timeout: 10000 });
  await node.locator('[data-testid="file-entry"]').click();
}

const pinnedTab = (page: Parameters<typeof selectRailTab>[0]) =>
  page.getByTestId('pinned-complete-diff-tab');

test.describe('Pinned complete-diff tab', () => {
  test.beforeEach(async ({ page, request }) => {
    await resetDb(request);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await waitForHydration(page);
  });

  test('no active workspace shows no pinned complete diff tab', async ({ page }) => {
    await expect(pinnedTab(page)).toHaveCount(0);
    await expect(page.getByText('No file selected')).toBeVisible();
  });

  test('complete diff tab is first, has no close button, and middle-click keeps it open', async ({
    page,
  }) => {
    const fixture = createRepo();
    try {
      addChange(fixture, 'README.md', '# e2e\nmore content\n');
      await registerAndSelectWorkspace(page, fixture.repoPath, `E2E-PinFirst-${Date.now()}`, 'git');

      // The pinned tab exists, is first, and has no close button.
      await expect(pinnedTab(page)).toHaveCount(1);
      await expect(pinnedTab(page)).toContainText('Complete diff');
      await expect(pinnedTab(page).locator('button')).toHaveCount(0);

      const viewer = page.locator('[data-testid="complete-diff-viewer"]');
      await expect(viewer).toBeVisible({ timeout: 15000 });

      // Middle-click does not close the pinned tab.
      await pinnedTab(page).click({ button: 'middle' });
      await expect(pinnedTab(page)).toHaveCount(1);
      await expect(viewer).toBeVisible();
    } finally {
      fixture.cleanup();
    }
  });

  test('opening a file preserves the pinned tab and activates the file tab', async ({ page }) => {
    const fixture = createRepo();
    try {
      addChange(fixture, 'src/app.ts', '// app\nline2\n');
      makeProjectRepo(fixture);
      await registerAndActivate(page, fixture.repoPath, `E2E-PinFile-${Date.now()}`);
      await openProjectTree(page);

      await clickTreeFile(page, 'app.ts');
      await expect(page.getByTestId('open-file-tab')).toHaveCount(1);
      await expect(page.getByTestId('open-file-tab')).toContainText('src/app.ts');
      // The pinned tab stays first, before the file tab.
      await expect(pinnedTab(page)).toBeVisible();
      const tabOrder = page
        .locator('[data-testid="open-files-tabs"]')
        .locator('[role="tab"]')
        .evaluateAll((els) => els.map((el) => (el.textContent ?? '').trim()));
      expect(await tabOrder).toEqual(['Complete diff', 'src/app.ts']);
      await expect(page.getByTestId('open-file-tab')).toHaveAttribute('aria-selected', 'true');
      await expect(pinnedTab(page)).toHaveAttribute('aria-selected', 'false');
    } finally {
      fixture.cleanup();
    }
  });

  test('pinned tab is revisitable and shows no "No file selected"', async ({ page }) => {
    const fixture = createRepo();
    try {
      addChange(fixture, 'src/app.ts', '// app\nline2\n');
      makeProjectRepo(fixture);
      await registerAndActivate(page, fixture.repoPath, `E2E-PinRevisit-${Date.now()}`);
      await openProjectTree(page);

      await clickTreeFile(page, 'app.ts');
      await expect(page.getByTestId('open-file-tab')).toHaveCount(1);

      // Revisit the pinned tab from the Project rail: the complete diff
      // viewer is shown and the generic empty state never appears.
      await pinnedTab(page).click();
      await expect(pinnedTab(page)).toHaveAttribute('aria-selected', 'true');
      await expect(page.locator('[data-testid="complete-diff-viewer"]')).toBeVisible({
        timeout: 15000,
      });
      await expect(page.getByText('No file selected')).toHaveCount(0);
    } finally {
      fixture.cleanup();
    }
  });

  test('closing the last file tab returns to the complete diff tab', async ({ page }) => {
    const fixture = createRepo();
    try {
      addChange(fixture, 'src/app.ts', '// app\nline2\n');
      makeProjectRepo(fixture);
      await registerAndActivate(page, fixture.repoPath, `E2E-PinLast-${Date.now()}`);
      await openProjectTree(page);

      await clickTreeFile(page, 'app.ts');
      await expect(page.getByTestId('open-file-tab')).toHaveCount(1);

      await page.getByTestId('close-file-tab').click();
      await expect(page.getByTestId('open-file-tab')).toHaveCount(0);
      await expect(pinnedTab(page)).toHaveCount(1);
      await expect(pinnedTab(page)).toHaveAttribute('aria-selected', 'true');
      await expect(page.locator('[data-testid="complete-diff-viewer"]')).toBeVisible({
        timeout: 15000,
      });
    } finally {
      fixture.cleanup();
    }
  });

  test('changing the comparison refreshes the pinned tab in place', async ({ page }) => {
    const fixture = createRepo();
    try {
      // feature-branch adds feature.txt; the default comparison is
      // working tree vs HEAD.
      addChange(fixture, 'feature.txt', 'feature content\n');
      fixture.runGit(['checkout', '-b', 'feature-branch']);
      fixture.runGit(['add', '.']);
      fixture.runGit(['commit', '-m', 'feature']);
      fixture.runGit(['checkout', '-']);
      addChange(fixture, 'README.md', '# e2e\nworking tree change\n');

      await registerAndSelectWorkspace(page, fixture.repoPath, `E2E-PinCmp-${Date.now()}`, 'git');

      const viewer = page.locator('[data-testid="complete-diff-viewer"]');
      await expect(viewer).toBeVisible({ timeout: 15000 });
      await expect(pinnedTab(page)).toHaveCount(1);

      // Switch the base slot to feature-branch; the viewer must refetch in
      // place and the pinned tab must remain the first tab.
      const comparisonSlots = page.locator('.comparison-slots');
      await expect(comparisonSlots).toBeVisible({ timeout: 10000 });
      const responsePromise = page.waitForResponse(
        (resp) => resp.url().includes('/complete-diff') && resp.request().method() === 'GET',
      );
      await comparisonSlots.locator('.slot-btn').first().click();
      const branchList = page.getByRole('listbox', { name: 'Branches' });
      await expect(branchList).toBeVisible({ timeout: 10000 });
      await branchList.getByRole('option', { name: /feature-branch/ }).click();
      await responsePromise;

      // The viewer reloaded for the new comparison in place.
      await expect(viewer).toContainText('feature content', { timeout: 15000 });
      await expect(pinnedTab(page)).toHaveCount(1);
      await expect(pinnedTab(page)).toHaveAttribute('aria-selected', 'true');
    } finally {
      fixture.cleanup();
    }
  });

  test('switching workspace replaces the pin and clears file tabs', async ({ page }) => {
    const fixtureA = createRepo();
    const fixtureB = createRepo();
    try {
      addChange(fixtureA, 'src/app.ts', '// app A\n');
      makeProjectRepo(fixtureA);
      addChange(fixtureB, 'README.md', '# e2e B\nchanged B\n');
      makeProjectRepo(fixtureB);

      await registerAndActivate(page, fixtureA.repoPath, `E2E-PinWsA-${Date.now()}`);
      await openProjectTree(page);
      await clickTreeFile(page, 'app.ts');
      await expect(page.getByTestId('open-file-tab')).toHaveCount(1);

      // Switch to the second workspace: file tabs clear, the new workspace
      // shows only its own pinned complete-diff tab.
      await selectRailTab(page, 'workspaces');
      await registerAndActivate(page, fixtureB.repoPath, `E2E-PinWsB-${Date.now()}`);

      await expect(page.getByTestId('open-file-tab')).toHaveCount(0);
      await expect(pinnedTab(page)).toHaveCount(1);
      await expect(pinnedTab(page)).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByText('No file selected')).toHaveCount(0);
      await expect(page.getByText('src/app.ts')).toHaveCount(0);
      await expect(page.locator('[data-testid="complete-diff-viewer"]')).toBeVisible({
        timeout: 15000,
      });
    } finally {
      fixtureA.cleanup();
      fixtureB.cleanup();
    }
  });
});
