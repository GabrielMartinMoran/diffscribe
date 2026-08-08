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
      await expect(page.getByTestId('quick-open-filter')).toBeFocused();

      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).not.toBeVisible();
      await openQuickOpen(page, 'Meta+p');
      await expect(page.getByTestId('quick-open-filter')).toBeFocused();
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
      await page.getByTestId('quick-open-filter').fill('util');
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
      const combobox = page.getByTestId('quick-open-filter');
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
      await page.getByTestId('quick-open-filter').fill('util');
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
      await page.getByTestId('quick-open-filter').fill('util');
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
      await page.getByTestId('quick-open-filter').fill('more');
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
      const combobox = page.getByTestId('quick-open-filter');
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
      await page.getByTestId('quick-open-filter').fill('util');
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).not.toBeVisible();
      await expect(page.getByTestId('source-file-path')).toContainText('src/app.ts');
      await expect(page.getByTestId('open-file-tab')).toHaveCount(1);
    } finally {
      fixture.cleanup();
    }
  });

  test('untracked files are always included and the legacy setting is inert', async ({ page }) => {
    const fixture = createGitFixture('diffscribe-e2e-qo-');
    try {
      makeRepoWithUntracked(fixture);
      await registerAndActivate(page, fixture.repoPath, `QO-Untracked-${Date.now()}`);
      await page.reload();
      await waitForHydration(page);

      // Seed the obsolete localStorage setting before the first open.
      await page.evaluate(() =>
        localStorage.setItem('diffscribe-quick-open-include-untracked', 'false'),
      );

      // Untracked files are always shown, regardless of the legacy value.
      await openQuickOpen(page, 'Control+p');
      const combobox = page.getByTestId('quick-open-filter');
      await combobox.fill('scratch');
      await expectResult(page, 'src/scratch.ts');

      // Opening Quick Open cleans the obsolete key.
      const stored = await page.evaluate(() =>
        localStorage.getItem('diffscribe-quick-open-include-untracked'),
      );
      expect(stored).toBeNull();

      // The obsolete switch no longer exists in Settings.
      await page.keyboard.press('Escape');
      await selectRailTab(page, 'settings');
      await expect(page.getByTestId('settings-panel')).toBeVisible({ timeout: 10000 });
      await expect(page.getByTestId('settings-quick-open-untracked-switch')).toHaveCount(0);
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
      const combobox = page.getByTestId('quick-open-filter');
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

  test('empty query lists every nonignored file including untracked', async ({ page }) => {
    const fixture = createGitFixture('diffscribe-e2e-qo-');
    try {
      makeRepoWithUntracked(fixture);
      await registerAndActivate(page, fixture.repoPath, `QO-Empty-${Date.now()}`);
      await page.reload();
      await waitForHydration(page);

      await openQuickOpen(page, 'Control+p');
      await expect(page.getByTestId('quick-open-result').first()).toBeVisible({ timeout: 10000 });
      // README.md, app.ts, util.ts, more.ts, and the untracked scratch.ts.
      await expect(page.getByTestId('quick-open-result')).toHaveCount(5);
      await expect(
        page.getByTestId('quick-open-result').filter({ hasText: 'scratch' }),
      ).toHaveCount(1);
    } finally {
      fixture.cleanup();
    }
  });

  test('ignored files stay excluded from results', async ({ page }) => {
    const fixture = createGitFixture('diffscribe-e2e-qo-');
    try {
      mkdirSync(join(fixture.repoPath, 'src'), { recursive: true });
      writeFileSync(join(fixture.repoPath, '.gitignore'), 'src/ignored.ts\n');
      writeFileSync(join(fixture.repoPath, 'src', 'app.ts'), 'export const app = 1;\n');
      writeFileSync(join(fixture.repoPath, 'src', 'ignored.ts'), 'export const ignored = 0;\n');
      fixture.runGit(['add', '.']);
      fixture.runGit(['commit', '-m', 'init']);

      await registerAndActivate(page, fixture.repoPath, `QO-Ignored-${Date.now()}`);
      await page.reload();
      await waitForHydration(page);

      await openQuickOpen(page, 'Control+p');
      await page.getByTestId('quick-open-filter').fill('ignored');
      await expect(page.getByText('No matching files')).toBeVisible();
    } finally {
      fixture.cleanup();
    }
  });

  test('working-tree status badges render through the UI mapping', async ({ page }) => {
    const fixture = createGitFixture('diffscribe-e2e-qo-');
    try {
      mkdirSync(join(fixture.repoPath, 'src'), { recursive: true });
      writeFileSync(join(fixture.repoPath, 'src', 'app.ts'), 'export const app = 1;\n');
      fixture.runGit(['add', '.']);
      fixture.runGit(['commit', '-m', 'init']);
      // Working tree: app.ts modified, scratch.ts untracked.
      writeFileSync(join(fixture.repoPath, 'src', 'app.ts'), 'export const app = 2;\n');
      writeFileSync(join(fixture.repoPath, 'src', 'scratch.ts'), 'export const scratch = 0;\n');

      await registerAndActivate(page, fixture.repoPath, `QO-Badges-${Date.now()}`);
      await page.reload();
      await waitForHydration(page);

      await openQuickOpen(page, 'Control+p');
      const results = page.getByTestId('quick-open-result');
      await expect(results.first()).toBeVisible({ timeout: 10000 });

      const appResult = results.filter({ hasText: 'src/app.ts' });
      await expect(appResult.locator('[data-testid="quick-open-status-badge"]')).toHaveText(
        'modified',
      );

      const scratchResult = results.filter({ hasText: 'src/scratch.ts' });
      const scratchBadge = scratchResult.locator('[data-testid="quick-open-status-badge"]');
      await expect(scratchBadge).toHaveText('New');
      // The untracked → New mapping renders with the green (success) tone.
      await expect(scratchBadge).toHaveClass(/ui-status-badge--success/);
    } finally {
      fixture.cleanup();
    }
  });

  test('results stay capped at 512 with an empty filter', async ({ page }) => {
    const fixture = createGitFixture('diffscribe-e2e-qo-');
    try {
      mkdirSync(join(fixture.repoPath, 'src'), { recursive: true });
      for (let i = 0; i < 600; i++) {
        writeFileSync(join(fixture.repoPath, 'src', `file-${i}.ts`), `export const f${i} = 1;\n`);
      }
      fixture.runGit(['add', '.']);
      fixture.runGit(['commit', '-m', 'many files']);

      await registerAndActivate(page, fixture.repoPath, `QO-Cap-${Date.now()}`);
      await page.reload();
      await waitForHydration(page);

      await openQuickOpen(page, 'Control+p');
      await expect(page.getByTestId('quick-open-result').first()).toBeVisible({ timeout: 15000 });
      await expect(page.getByTestId('quick-open-result')).toHaveCount(512);
    } finally {
      fixture.cleanup();
    }
  });
});
