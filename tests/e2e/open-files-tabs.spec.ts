import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test } from './fixtures';
import { createGitFixture } from './helpers/git-fixture';
import { waitForHydration } from './helpers/hydration';
import { registerAndActivate, selectRailTab } from './helpers/register-workspace';
import { resetDb } from './helpers/reset-db';

/**
 * Multi-tab central viewer (Tranche B): normal click reuses the active tab,
 * Ctrl/Cmd-click opens additional tabs, dedup by path, close fallback
 * (next → previous → empty), workspace switch clears tabs, roving keyboard
 * navigation and tab/close ARIA semantics.
 */

function makeProjectRepo(fixture: ReturnType<typeof createGitFixture>): void {
  mkdirSync(join(fixture.repoPath, 'src', 'lib'), { recursive: true });
  writeFileSync(join(fixture.repoPath, 'README.md'), '# Test repo\n');
  writeFileSync(join(fixture.repoPath, 'src', 'app.ts'), 'export const app = 1;\n');
  writeFileSync(join(fixture.repoPath, 'src', 'lib', 'util.ts'), 'export const util = 2;\n');
  writeFileSync(join(fixture.repoPath, 'src', 'lib', 'more.ts'), 'export const more = 3;\n');
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
  modifier?: 'Control' | 'Meta',
): Promise<void> {
  const projectTree = page.locator('[data-testid="project-tree"]');
  const node = projectTree.locator('[data-testid="tree-node"]', { hasText: name }).first();
  await expect(node.locator('[data-testid="file-entry"]')).toBeVisible({ timeout: 10000 });
  if (modifier) {
    await page.keyboard.down(modifier);
  }
  await node.locator('[data-testid="file-entry"]').click();
  if (modifier) {
    await page.keyboard.up(modifier);
  }
}

test.describe('Open files tabs', () => {
  test.beforeEach(async ({ page, request }) => {
    await resetDb(request);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await waitForHydration(page);
  });

  test('normal click reuses the active tab', async ({ page }) => {
    const fixture = createGitFixture('diffscribe-e2e-tabs-');
    try {
      makeProjectRepo(fixture);
      await registerAndActivate(page, fixture.repoPath, `Tabs-Normal-${Date.now()}`);
      await page.reload();
      await waitForHydration(page);
      await openProjectTree(page);

      await clickTreeFile(page, 'app.ts');
      await expect(page.getByTestId('open-file-tab')).toHaveCount(1);
      await expect(page.getByTestId('open-file-tab')).toContainText('src/app.ts');

      await clickTreeFile(page, 'util.ts');
      await expect(page.getByTestId('open-file-tab')).toHaveCount(1);
      await expect(page.getByTestId('open-file-tab')).toContainText('src/lib/util.ts');
    } finally {
      fixture.cleanup();
    }
  });

  test('Ctrl-click opens an additional tab; already-open path does not duplicate', async ({
    page,
  }) => {
    const fixture = createGitFixture('diffscribe-e2e-tabs-');
    try {
      makeProjectRepo(fixture);
      await registerAndActivate(page, fixture.repoPath, `Tabs-Ctrl-${Date.now()}`);
      await page.reload();
      await waitForHydration(page);
      await openProjectTree(page);

      await clickTreeFile(page, 'app.ts');
      await clickTreeFile(page, 'util.ts', 'Control');
      await expect(page.getByTestId('open-file-tab')).toHaveCount(2);
      await expect(page.getByTestId('open-file-tab').first()).toContainText('src/app.ts');
      await expect(page.getByTestId('open-file-tab').last()).toContainText('src/lib/util.ts');

      // Already-open path activates the existing tab without duplicating.
      await clickTreeFile(page, 'util.ts', 'Control');
      await expect(page.getByTestId('open-file-tab')).toHaveCount(2);
    } finally {
      fixture.cleanup();
    }
  });

  test('Cmd-click opens an additional tab', async ({ page }) => {
    const fixture = createGitFixture('diffscribe-e2e-tabs-');
    try {
      makeProjectRepo(fixture);
      await registerAndActivate(page, fixture.repoPath, `Tabs-Cmd-${Date.now()}`);
      await page.reload();
      await waitForHydration(page);
      await openProjectTree(page);

      await clickTreeFile(page, 'app.ts');
      await clickTreeFile(page, 'more.ts', 'Meta');
      await expect(page.getByTestId('open-file-tab')).toHaveCount(2);
    } finally {
      fixture.cleanup();
    }
  });

  test('active tab is highlighted; activating an inactive tab changes the viewer', async ({
    page,
  }) => {
    const fixture = createGitFixture('diffscribe-e2e-tabs-');
    try {
      makeProjectRepo(fixture);
      await registerAndActivate(page, fixture.repoPath, `Tabs-Active-${Date.now()}`);
      await page.reload();
      await waitForHydration(page);
      await openProjectTree(page);

      await clickTreeFile(page, 'app.ts');
      await clickTreeFile(page, 'util.ts', 'Control');

      const tabs = page.getByTestId('open-file-tab');
      await expect(tabs).toHaveCount(2);
      await expect(tabs.first()).toHaveAttribute('aria-selected', 'false');
      await expect(tabs.last()).toHaveAttribute('aria-selected', 'true');
      // Active tab is highlighted; the inactive tab is dimmed.
      await expect(tabs.last()).toHaveClass(/file-tab/);
      await expect(tabs.last()).toHaveClass(/active/);
      await expect(tabs.first()).toHaveClass(/inactive/);
      await expect(page.getByTestId('source-file-path')).toContainText('src/lib/util.ts', {
        timeout: 15000,
      });

      // Click the inactive tab: content changes to the first file.
      await tabs.first().click();
      await expect(tabs.first()).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByTestId('source-file-path')).toContainText('src/app.ts', {
        timeout: 15000,
      });
    } finally {
      fixture.cleanup();
    }
  });

  test('closing the active tab selects next; closing the last selects previous', async ({
    page,
  }) => {
    const fixture = createGitFixture('diffscribe-e2e-tabs-');
    try {
      makeProjectRepo(fixture);
      await registerAndActivate(page, fixture.repoPath, `Tabs-Close-${Date.now()}`);
      await page.reload();
      await waitForHydration(page);
      await openProjectTree(page);

      await clickTreeFile(page, 'app.ts');
      await clickTreeFile(page, 'util.ts', 'Control');
      await clickTreeFile(page, 'more.ts', 'Control');
      await expect(page.getByTestId('open-file-tab')).toHaveCount(3);

      // Activate the first tab, then close it: the next tab becomes active.
      await page.getByTestId('open-file-tab').first().click();
      await page.getByTestId('close-file-tab').first().click();
      await expect(page.getByTestId('open-file-tab')).toHaveCount(2);
      await expect(page.getByTestId('open-file-tab').first()).toContainText('src/lib/util.ts');
      await expect(page.getByTestId('source-file-path')).toContainText('src/lib/util.ts', {
        timeout: 15000,
      });

      // Activate the last tab, then close it: the previous tab becomes active.
      await page.getByTestId('open-file-tab').last().click();
      await page.getByTestId('close-file-tab').last().click();
      await expect(page.getByTestId('open-file-tab')).toHaveCount(1);
      await expect(page.getByTestId('open-file-tab')).toContainText('src/lib/util.ts');
      await expect(page.getByTestId('source-file-path')).toContainText('src/lib/util.ts', {
        timeout: 15000,
      });

      // Closing the only tab shows the empty viewer.
      await page.getByTestId('close-file-tab').click();
      await expect(page.getByTestId('open-file-tab')).toHaveCount(0);
      await expect(page.getByText('No file selected')).toBeVisible();
    } finally {
      fixture.cleanup();
    }
  });

  test('closing an inactive tab preserves the active tab', async ({ page }) => {
    const fixture = createGitFixture('diffscribe-e2e-tabs-');
    try {
      makeProjectRepo(fixture);
      await registerAndActivate(page, fixture.repoPath, `Tabs-Inactive-${Date.now()}`);
      await page.reload();
      await waitForHydration(page);
      await openProjectTree(page);

      await clickTreeFile(page, 'app.ts');
      await clickTreeFile(page, 'util.ts', 'Control');
      await clickTreeFile(page, 'more.ts', 'Control');

      // Activate the middle tab, then close the first (inactive).
      await page.getByTestId('open-file-tab').nth(1).click();
      await page.getByTestId('close-file-tab').first().click();
      await expect(page.getByTestId('open-file-tab')).toHaveCount(2);
      await expect(page.getByTestId('open-file-tab').first()).toContainText('src/lib/util.ts');
      await expect(page.getByTestId('open-file-tab').first()).toHaveAttribute(
        'aria-selected',
        'true',
      );
    } finally {
      fixture.cleanup();
    }
  });

  test('switching workspace clears all tabs', async ({ page }) => {
    const fixtureA = createGitFixture('diffscribe-e2e-tabs-');
    const fixtureB = createGitFixture('diffscribe-e2e-tabs-');
    try {
      makeProjectRepo(fixtureA);
      makeProjectRepo(fixtureB);
      await registerAndActivate(page, fixtureA.repoPath, `Tabs-WsA-${Date.now()}`);
      await page.reload();
      await waitForHydration(page);
      await openProjectTree(page);

      await clickTreeFile(page, 'app.ts');
      await clickTreeFile(page, 'util.ts', 'Control');
      await expect(page.getByTestId('open-file-tab')).toHaveCount(2);

      // registerAndActivate expects the Workspaces rail (sidebar visible).
      await selectRailTab(page, 'workspaces');
      await registerAndActivate(page, fixtureB.repoPath, `Tabs-WsB-${Date.now()}`);
      await expect(page.getByTestId('open-file-tab')).toHaveCount(0);
      await expect(page.getByText('No file selected')).toBeVisible();
    } finally {
      fixtureA.cleanup();
      fixtureB.cleanup();
    }
  });

  test('roving keyboard navigation across tabs', async ({ page }) => {
    const fixture = createGitFixture('diffscribe-e2e-tabs-');
    try {
      makeProjectRepo(fixture);
      await registerAndActivate(page, fixture.repoPath, `Tabs-Kbd-${Date.now()}`);
      await page.reload();
      await waitForHydration(page);
      await openProjectTree(page);

      await clickTreeFile(page, 'app.ts');
      await clickTreeFile(page, 'util.ts', 'Control');

      const tabs = page.getByTestId('open-file-tab');
      await tabs.first().click();
      await tabs.first().press('ArrowRight');
      await expect(tabs.last()).toBeFocused();
      await tabs.last().press('Home');
      await expect(tabs.first()).toBeFocused();
      await tabs.first().press('End');
      await expect(tabs.last()).toBeFocused();
    } finally {
      fixture.cleanup();
    }
  });

  test('tabs expose tab semantics and accessible close buttons', async ({ page }) => {
    const fixture = createGitFixture('diffscribe-e2e-tabs-');
    try {
      makeProjectRepo(fixture);
      await registerAndActivate(page, fixture.repoPath, `Tabs-Aria-${Date.now()}`);
      await page.reload();
      await waitForHydration(page);
      await openProjectTree(page);

      await clickTreeFile(page, 'app.ts');
      await clickTreeFile(page, 'util.ts', 'Control');

      const tablist = page.getByTestId('open-files-tabs');
      await expect(tablist).toHaveAttribute('role', 'tablist');
      const tabs = page.getByTestId('open-file-tab');
      await expect(tabs.first()).toHaveAttribute('role', 'tab');
      await expect(tabs.first()).toHaveAttribute('aria-selected', 'false');
      await expect(tabs.last()).toHaveAttribute('aria-selected', 'true');
      await expect(tabs.first()).toHaveAttribute('aria-controls', /panel/);
      await expect(page.getByTestId('close-file-tab').first()).toHaveAccessibleName(/Close/);
    } finally {
      fixture.cleanup();
    }
  });
});
