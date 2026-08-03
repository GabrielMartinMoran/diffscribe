import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test } from './fixtures';
import { createGitFixture } from './helpers/git-fixture';
import { waitForHydration } from './helpers/hydration';
import { registerAndActivate, selectRailTab } from './helpers/register-workspace';
import { resetDb } from './helpers/reset-db';

/**
 * Quick Open (Tranche B): Ctrl/Cmd+P modal, fuzzy scoring with highlights,
 * keyboard contract (arrows/Home/End/Enter/Ctrl+Enter/Escape), tracked-only
 * default, include-untracked setting, Project rail routing, Ctrl+Shift+P
 * unclaimed, IME composing guard.
 */

function makeRepoWithUntracked(fixture: ReturnType<typeof createGitFixture>): void {
  mkdirSync(join(fixture.repoPath, 'src', 'lib'), { recursive: true });
  writeFileSync(join(fixture.repoPath, 'README.md'), '# Test repo\n');
  writeFileSync(join(fixture.repoPath, 'src', 'app.ts'), 'export const app = 1;\n');
  writeFileSync(join(fixture.repoPath, 'src', 'lib', 'util.ts'), 'export const util = 2;\n');
  writeFileSync(join(fixture.repoPath, 'src', 'lib', 'more.ts'), 'export const more = 3;\n');
  writeFileSync(join(fixture.repoPath, 'src', 'scratch.ts'), 'export const scratch = 0;\n');
  fixture.runGit(['add', '.']);
  fixture.runGit(['commit', '-m', 'init']);
  // scratch.ts stays untracked.
  fixture.runGit(['rm', '--cached', 'src/scratch.ts']);
}

async function openQuickOpen(
  page: Parameters<typeof selectRailTab>[0],
  key: 'Control+p' | 'Meta+p',
): Promise<void> {
  await page.keyboard.press(key);
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 10000 });
}

async function expectResult(
  page: Parameters<typeof selectRailTab>[0],
  path: string,
): Promise<void> {
  const result = page.getByTestId('quick-open-result').filter({ hasText: path });
  await expect(result.first()).toBeVisible({ timeout: 10000 });
}

/** Expand `src` (and `src/lib`) in the Project tree and click a file. */
async function clickTreeFileByName(
  page: Parameters<typeof selectRailTab>[0],
  name: string,
): Promise<void> {
  const projectTree = page.locator('[data-testid="project-tree"]');
  await expect(projectTree).toBeVisible({ timeout: 10000 });
  for (const dir of ['src', 'lib']) {
    const dirNode = projectTree.locator('[data-testid="tree-node"]', { hasText: dir }).first();
    await dirNode.locator('[data-testid="expand-toggle"]').click();
  }
  const node = projectTree.locator('[data-testid="tree-node"]', { hasText: name }).first();
  await expect(node.locator('[data-testid="file-entry"]')).toBeVisible({ timeout: 10000 });
  await node.locator('[data-testid="file-entry"]').click();
}

test.describe('Quick Open', () => {
  test.beforeEach(async ({ page, request }) => {
    await resetDb(request);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await waitForHydration(page);
  });

  test('Ctrl+P and Cmd+P open the dialog with the filter focused', async ({ page }) => {
    const fixture = createGitFixture('diffscribe-e2e-qo-');
    try {
      makeRepoWithUntracked(fixture);
      await registerAndActivate(page, fixture.repoPath, `QO-Open-${Date.now()}`);
      await page.reload();
      await waitForHydration(page);

      await openQuickOpen(page, 'Control+p');
      await expect(page.getByRole('combobox')).toBeFocused();

      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).not.toBeVisible();
      await openQuickOpen(page, 'Meta+p');
      await expect(page.getByRole('combobox')).toBeFocused();
    } finally {
      fixture.cleanup();
    }
  });

  test('fuzzy search ranks basename matches first and highlights ranges', async ({ page }) => {
    const fixture = createGitFixture('diffscribe-e2e-qo-');
    try {
      makeRepoWithUntracked(fixture);
      await registerAndActivate(page, fixture.repoPath, `QO-Fuzzy-${Date.now()}`);
      await page.reload();
      await waitForHydration(page);

      await openQuickOpen(page, 'Control+p');
      await page.getByRole('combobox').fill('util');
      await expectResult(page, 'src/lib/util.ts');
      const result = page.getByTestId('quick-open-result').first();
      // The contiguous match renders as one highlighted mark.
      await expect(result.locator('mark')).toHaveCount(1);
      await expect(result.locator('mark')).toHaveText('util');
    } finally {
      fixture.cleanup();
    }
  });

  test('whitespace-separated terms must all match', async ({ page }) => {
    const fixture = createGitFixture('diffscribe-e2e-qo-');
    try {
      makeRepoWithUntracked(fixture);
      await registerAndActivate(page, fixture.repoPath, `QO-Terms-${Date.now()}`);
      await page.reload();
      await waitForHydration(page);

      await openQuickOpen(page, 'Control+p');
      const combobox = page.getByRole('combobox');
      await combobox.fill('lib util');
      await expectResult(page, 'src/lib/util.ts');
      await combobox.fill('lib nope');
      await expect(page.getByText('No matching files')).toBeVisible();
    } finally {
      fixture.cleanup();
    }
  });

  test('ArrowDown + Enter opens the current tab and routes to Project', async ({ page }) => {
    const fixture = createGitFixture('diffscribe-e2e-qo-');
    try {
      makeRepoWithUntracked(fixture);
      await registerAndActivate(page, fixture.repoPath, `QO-Enter-${Date.now()}`);
      await page.reload();
      await waitForHydration(page);

      // Start from the Git rail: acceptance must route to Project.
      await selectRailTab(page, 'git');
      await openQuickOpen(page, 'Control+p');
      await page.getByRole('combobox').fill('util');
      await expectResult(page, 'src/lib/util.ts');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');

      await expect(page.getByRole('dialog')).not.toBeVisible();
      await expect(page.getByTestId('rail-tab-project')).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByTestId('source-file-path')).toContainText('src/lib/util.ts', {
        timeout: 15000,
      });
      await expect(page.getByTestId('open-file-tab')).toHaveCount(1);
    } finally {
      fixture.cleanup();
    }
  });

  test('Ctrl+Enter opens a new tab', async ({ page }) => {
    const fixture = createGitFixture('diffscribe-e2e-qo-');
    try {
      makeRepoWithUntracked(fixture);
      await registerAndActivate(page, fixture.repoPath, `QO-CtrlEnter-${Date.now()}`);
      await page.reload();
      await waitForHydration(page);

      await selectRailTab(page, 'project');
      // Open one file through the tree first.
      await clickTreeFileByName(page, 'app.ts');

      await openQuickOpen(page, 'Control+p');
      await page.getByRole('combobox').fill('util');
      await expectResult(page, 'src/lib/util.ts');
      await page.keyboard.press('Control+Enter');
      await expect(page.getByRole('dialog')).not.toBeVisible();
      await expect(page.getByTestId('open-file-tab')).toHaveCount(2);
    } finally {
      fixture.cleanup();
    }
  });

  test('mouse click on a result opens the current tab', async ({ page }) => {
    const fixture = createGitFixture('diffscribe-e2e-qo-');
    try {
      makeRepoWithUntracked(fixture);
      await registerAndActivate(page, fixture.repoPath, `QO-Mouse-${Date.now()}`);
      await page.reload();
      await waitForHydration(page);

      await openQuickOpen(page, 'Control+p');
      await page.getByRole('combobox').fill('more');
      await expectResult(page, 'src/lib/more.ts');
      await page.getByTestId('quick-open-result').first().click();
      await expect(page.getByRole('dialog')).not.toBeVisible();
      await expect(page.getByTestId('source-file-path')).toContainText('src/lib/more.ts', {
        timeout: 15000,
      });
      await expect(page.getByTestId('open-file-tab')).toHaveCount(1);
    } finally {
      fixture.cleanup();
    }
  });

  test('Home and End jump to the first and last results', async ({ page }) => {
    const fixture = createGitFixture('diffscribe-e2e-qo-');
    try {
      makeRepoWithUntracked(fixture);
      await registerAndActivate(page, fixture.repoPath, `QO-HomeEnd-${Date.now()}`);
      await page.reload();
      await waitForHydration(page);

      await openQuickOpen(page, 'Control+p');
      const combobox = page.getByRole('combobox');
      await combobox.fill('ts');
      await expect(page.getByTestId('quick-open-result').first()).toBeVisible({ timeout: 10000 });
      await page.keyboard.press('End');
      await expect(page.getByTestId('quick-open-result').last()).toHaveAttribute(
        'aria-selected',
        'true',
      );
      await page.keyboard.press('Home');
      await expect(page.getByTestId('quick-open-result').first()).toHaveAttribute(
        'aria-selected',
        'true',
      );
    } finally {
      fixture.cleanup();
    }
  });

  test('Escape closes without changing the active file', async ({ page }) => {
    const fixture = createGitFixture('diffscribe-e2e-qo-');
    try {
      makeRepoWithUntracked(fixture);
      await registerAndActivate(page, fixture.repoPath, `QO-Escape-${Date.now()}`);
      await page.reload();
      await waitForHydration(page);

      await selectRailTab(page, 'project');
      await clickTreeFileByName(page, 'app.ts');
      await expect(page.getByTestId('source-file-path')).toContainText('src/app.ts', {
        timeout: 15000,
      });

      await openQuickOpen(page, 'Control+p');
      await page.getByRole('combobox').fill('util');
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).not.toBeVisible();
      await expect(page.getByTestId('source-file-path')).toContainText('src/app.ts');
      await expect(page.getByTestId('open-file-tab')).toHaveCount(1);
    } finally {
      fixture.cleanup();
    }
  });

  test('tracked files only by default; include-untracked setting exposes untracked', async ({
    page,
  }) => {
    const fixture = createGitFixture('diffscribe-e2e-qo-');
    try {
      makeRepoWithUntracked(fixture);
      await registerAndActivate(page, fixture.repoPath, `QO-Untracked-${Date.now()}`);
      await page.reload();
      await waitForHydration(page);

      // Default: untracked file is hidden.
      await openQuickOpen(page, 'Control+p');
      const combobox = page.getByRole('combobox');
      await combobox.fill('scratch');
      await expect(page.getByText('No matching files')).toBeVisible();
      await page.keyboard.press('Escape');

      // Enable the setting in Settings.
      await selectRailTab(page, 'settings');
      const untrackedSwitch = page.getByTestId('settings-quick-open-untracked-switch');
      await expect(untrackedSwitch).toBeVisible({ timeout: 10000 });
      await untrackedSwitch.locator('..').click();
      await expect(untrackedSwitch).toBeChecked();
      const stored = await page.evaluate(() =>
        localStorage.getItem('diffscribe-quick-open-include-untracked'),
      );
      expect(stored).toBe('true');

      // Reload: the switch survives and Quick Open now shows untracked files.
      await page.reload();
      await waitForHydration(page);
      await selectRailTab(page, 'settings');
      await expect(page.getByTestId('settings-quick-open-untracked-switch')).toBeChecked();

      await openQuickOpen(page, 'Control+p');
      await page.getByRole('combobox').fill('scratch');
      await expectResult(page, 'src/scratch.ts');
    } finally {
      fixture.cleanup();
    }
  });

  test('Ctrl+Shift+P does not open Quick Open', async ({ page }) => {
    const fixture = createGitFixture('diffscribe-e2e-qo-');
    try {
      makeRepoWithUntracked(fixture);
      await registerAndActivate(page, fixture.repoPath, `QO-ShiftP-${Date.now()}`);
      await page.reload();
      await waitForHydration(page);

      await page.keyboard.press('Control+Shift+p');
      await expect(page.getByRole('dialog')).not.toBeVisible();
    } finally {
      fixture.cleanup();
    }
  });

  test('composing IME input does not commit or navigate', async ({ page }) => {
    const fixture = createGitFixture('diffscribe-e2e-qo-');
    try {
      makeRepoWithUntracked(fixture);
      await registerAndActivate(page, fixture.repoPath, `QO-IME-${Date.now()}`);
      await page.reload();
      await waitForHydration(page);

      await openQuickOpen(page, 'Control+p');
      const combobox = page.getByRole('combobox');
      await combobox.fill('util');
      await expectResult(page, 'src/lib/util.ts');

      // Simulate a composing Enter keydown: must be ignored.
      const stayedOpen = await page.evaluate(() => {
        const input = document.querySelector('[role="combobox"]');
        if (!(input instanceof HTMLElement)) return false;
        const event = new KeyboardEvent('keydown', {
          key: 'Enter',
          isComposing: true,
          bubbles: true,
        });
        const dialog = input.closest('dialog');
        input.dispatchEvent(event);
        return dialog !== null && dialog.open;
      });
      expect(stayedOpen).toBe(true);
      await expect(page.getByRole('dialog')).toBeVisible();
    } finally {
      fixture.cleanup();
    }
  });

  test('empty query lists every tracked file', async ({ page }) => {
    const fixture = createGitFixture('diffscribe-e2e-qo-');
    try {
      makeRepoWithUntracked(fixture);
      await registerAndActivate(page, fixture.repoPath, `QO-Empty-${Date.now()}`);
      await page.reload();
      await waitForHydration(page);

      await openQuickOpen(page, 'Control+p');
      await expect(page.getByTestId('quick-open-result').first()).toBeVisible({ timeout: 10000 });
      await expect(page.getByTestId('quick-open-result')).toHaveCount(4);
      // The untracked scratch.ts is not listed.
      await expect(
        page.getByTestId('quick-open-result').filter({ hasText: 'scratch' }),
      ).toHaveCount(0);
    } finally {
      fixture.cleanup();
    }
  });
});
