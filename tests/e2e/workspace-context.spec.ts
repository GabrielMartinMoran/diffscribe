import fs from 'node:fs';
import path from 'node:path';

import { expect, test } from './fixtures';
import { createGitFixture } from './helpers/git-fixture';
import { waitForHydration } from './helpers/hydration';
import { registerAndActivate, selectRailTab } from './helpers/register-workspace';
import { resetDb } from './helpers/reset-db';

/**
 * Workspace context header (0003): the active workspace display name and
 * repository path show at the top of Project/Git/Settings panel content and
 * never on the Workspaces rail.
 */

test.describe('Workspace context header', () => {
  test.beforeEach(async ({ page, request }) => {
    await resetDb(request);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await waitForHydration(page);
  });

  test('shows the active workspace context on Project, Git, and Settings', async ({ page }) => {
    const fixture = createGitFixture('diffscribe-e2e-wsctx-');
    const displayName = `E2E-WsCtx-${Date.now()}`;
    try {
      fs.writeFileSync(path.join(fixture.repoPath, 'README.md'), '# e2e\n');
      fixture.runGit(['add', '.']);
      fixture.runGit(['commit', '-m', 'init']);
      await registerAndActivate(page, fixture.repoPath, displayName);

      // Project rail: context header at the top with name and path.
      await selectRailTab(page, 'project');
      const header = page.getByTestId('workspace-context-header');
      await expect(header).toBeVisible({ timeout: 10000 });
      await expect(header.getByTestId('workspace-context-name')).toHaveText(displayName);
      await expect(header.getByTestId('workspace-context-path')).toHaveText(fixture.repoPath);
      await expect(header.getByTestId('workspace-context-path')).toHaveAttribute(
        'title',
        fixture.repoPath,
      );

      // Git rail: header still present.
      await selectRailTab(page, 'git');
      await expect(page.getByTestId('workspace-context-header')).toBeVisible({ timeout: 10000 });

      // Settings rail: header still present.
      await selectRailTab(page, 'settings');
      await expect(page.getByTestId('workspace-context-header')).toBeVisible({ timeout: 10000 });

      // Workspaces rail: no context header.
      await selectRailTab(page, 'workspaces');
      await expect(page.getByTestId('workspace-context-header')).toHaveCount(0);
    } finally {
      fixture.cleanup();
    }
  });

  test('shows no context header without an active workspace', async ({ page }) => {
    // Fresh shell, no workspace registered: the Workspaces rail is active and
    // there is nothing to display.
    await expect(page.getByTestId('workspace-context-header')).toHaveCount(0);
  });
});
