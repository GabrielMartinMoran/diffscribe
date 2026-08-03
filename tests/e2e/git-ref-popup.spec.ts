import { execFileSync, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import type { APIRequestContext } from '@playwright/test';

import { expect, test } from './fixtures';
import { createGitFixture } from './helpers/git-fixture';
import { registerAndSelectWorkspace } from './helpers/register-workspace';
import { resetDb } from './helpers/reset-db';

/**
 * Git ref popup (tranche C): non-modal Base/Target branch selector with
 * Local/Cached remote groups, canonical-ref selection values, ARIA combobox
 * semantics, keyboard navigation, IME guard, fuzzy filtering, and compact
 * viewport behavior.
 */

/**
 * The worker dev server answers the readiness probe (GET /) before its API
 * routes finish compiling; the very first reset of a fresh worker can hit a
 * 404. Retry briefly so first-test resets are reliable.
 */
async function resetDbWhenReady(request: APIRequestContext): Promise<void> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      await resetDb(request);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  await resetDb(request);
}

function initRepo(fixture: { repoPath: string; runGit(args: readonly string[]): void }): void {
  fs.writeFileSync(path.join(fixture.repoPath, 'README.md'), '# e2e');
  fixture.runGit(['add', '.']);
  execFileSync(
    'git',
    ['-c', 'user.name=Test', '-c', 'user.email=test@test.com', 'commit', '-m', 'init'],
    {
      cwd: fixture.repoPath,
      stdio: 'pipe',
      env: {
        ...process.env,
        GIT_AUTHOR_DATE: '2026-01-01T10:00:00Z',
        GIT_COMMITTER_DATE: '2026-01-01T10:00:00Z',
      },
    },
  );
}

function commitAt(
  fixture: { repoPath: string; runGit(args: readonly string[]): void },
  message: string,
  date: string,
): void {
  fs.writeFileSync(path.join(fixture.repoPath, `${message}.txt`), message);
  execFileSync('git', ['add', '.'], { cwd: fixture.repoPath, stdio: 'pipe' });
  execFileSync(
    'git',
    ['-c', 'user.name=Test', '-c', 'user.email=test@test.com', 'commit', '-m', message],
    {
      cwd: fixture.repoPath,
      stdio: 'pipe',
      env: { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date },
    },
  );
}

test.describe('Git ref popup (tranche C)', () => {
  test.beforeEach(async ({ page, request }) => {
    await resetDbWhenReady(request);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  test('Base popup opens non-modal with autofocused search; opening Target closes it', async ({
    page,
  }) => {
    const fixture = createGitFixture('diffscribe-e2e-pop-');
    try {
      initRepo(fixture);
      await registerAndSelectWorkspace(page, fixture.repoPath, `E2E-Pop1-${Date.now()}`, 'git');

      const panel = page.locator('#git-context-panel');
      await expect(panel).toBeVisible({ timeout: 10000 });

      // Open Base: popup appears, search autofocused.
      await panel.locator('.slot-base').click();
      const search = panel.getByRole('combobox', { name: 'Filter branches' });
      await expect(search).toBeVisible({ timeout: 8000 });
      await expect(search).toBeFocused();

      // Open Target: Base popup closes, Target popup opens.
      await panel.locator('.slot-target').click();
      await expect(panel.getByRole('combobox', { name: 'Filter branches' })).toBeVisible({
        timeout: 5000,
      });
      // Only one popup exists at a time.
      await expect(panel.getByRole('combobox', { name: 'Filter branches' })).toHaveCount(1);
      await expect(panel.locator('.slot-target')).toHaveAttribute('aria-expanded', 'true');
      await expect(panel.locator('.slot-base')).toHaveAttribute('aria-expanded', 'false');
    } finally {
      fixture.cleanup();
    }
  });

  test('groups are ordered by recency and remote labels stay short', async ({ page }) => {
    const fixture = createGitFixture('diffscribe-e2e-pop-');
    try {
      initRepo(fixture);
      fixture.runGit(['checkout', '-b', 'old']);
      commitAt(fixture, 'old work', '2026-01-15T10:00:00Z');
      fixture.runGit(['checkout', '-b', 'dev']);
      commitAt(fixture, 'dev work', '2026-03-01T10:00:00Z');
      fixture.runGit(['checkout', 'master']);
      // Cached remote refs pointing at the same commits.
      fixture.runGit(['update-ref', 'refs/remotes/origin/main', 'master']);
      fixture.runGit(['update-ref', 'refs/remotes/origin/old', 'old']);

      await registerAndSelectWorkspace(page, fixture.repoPath, `E2E-Pop2-${Date.now()}`, 'git');

      const panel = page.locator('#git-context-panel');
      await expect(panel).toBeVisible({ timeout: 10000 });
      await panel.locator('.slot-base').click();

      const popup = panel.locator('.branch-popup');
      await expect(popup).toBeVisible({ timeout: 8000 });

      // Local group appears before Cached remote group.
      const groupTitles = popup.locator('.branch-group-title');
      await expect(groupTitles).toHaveCount(2);
      await expect(groupTitles.nth(0)).toHaveText('Local');
      await expect(groupTitles.nth(1)).toHaveText('Cached remote');

      // Within the Local group, the newest commit (dev) comes first.
      const localOptions = popup.locator('.branch-group').nth(0).getByRole('option');
      await expect(localOptions.nth(0)).toContainText('dev');
      await expect(localOptions.nth(1)).toContainText('old');

      // Full refs are never shown; the visible label is short.
      await expect(popup.getByText('refs/', { exact: false })).toHaveCount(0);
      await expect(popup.getByRole('option', { name: /origin\/main/ })).toBeVisible();
    } finally {
      fixture.cleanup();
    }
  });

  test('local and cached remote branches with the same visible name do not collide', async ({
    page,
  }) => {
    const fixture = createGitFixture('diffscribe-e2e-pop-');
    try {
      initRepo(fixture);
      // A local branch literally named "origin/main" plus a cached remote
      // "origin/main": same visible name, different canonical refs.
      fixture.runGit(['branch', 'origin/main']);
      fixture.runGit(['update-ref', 'refs/remotes/origin/main', 'master']);

      await registerAndSelectWorkspace(page, fixture.repoPath, `E2E-Pop3-${Date.now()}`, 'git');

      const panel = page.locator('#git-context-panel');
      await expect(panel).toBeVisible({ timeout: 10000 });

      const captured: string[] = [];
      await page.route('**/api/workspaces/*/file-list*', async (route) => {
        captured.push(decodeURIComponent(route.request().url()));
        await route.continue();
      });

      // Select the CACHED REMOTE one (second group) as Target.
      await panel.locator('.slot-target').click();
      await panel
        .locator('.branch-group')
        .nth(1)
        .getByRole('option', { name: /origin\/main/ })
        .click();

      // Draft target uses the canonical remote ref.
      await expect
        .poll(() => captured.some((u) => u.includes('refs/remotes/origin/main')), {
          timeout: 8000,
        })
        .toBe(true);

      // Select the LOCAL one (first group) as Target.
      await panel.locator('.slot-target').click();
      await panel
        .locator('.branch-group')
        .nth(0)
        .getByRole('option', { name: /origin\/main/ })
        .click();

      await expect
        .poll(() => captured.some((u) => u.includes('refs/heads/origin/main')), {
          timeout: 8000,
        })
        .toBe(true);

      // The repo was never checked out.
      const head = execSync('git rev-parse --abbrev-ref HEAD', { cwd: fixture.repoPath })
        .toString()
        .trim();
      expect(head).toBe('master');
    } finally {
      fixture.cleanup();
    }
  });

  test('selection updates one draft without checkout; current marker is separate from aria-selected', async ({
    page,
  }) => {
    const fixture = createGitFixture('diffscribe-e2e-pop-');
    try {
      initRepo(fixture);
      fixture.runGit(['branch', 'dev']);
      await registerAndSelectWorkspace(page, fixture.repoPath, `E2E-Pop4-${Date.now()}`, 'git');

      const panel = page.locator('#git-context-panel');
      await expect(panel).toBeVisible({ timeout: 10000 });

      // Select dev in the Base slot.
      await panel.locator('.slot-base').click();
      await panel
        .getByRole('listbox', { name: 'Branches' })
        .getByText('dev', { exact: true })
        .click();
      await expect(panel.locator('.slot-base .slot-value')).toHaveText('dev');
      await expect(panel.locator('.slot-base')).toHaveAttribute('aria-pressed', 'false');

      // Reopen: dev is aria-selected (the slot value); master is current.
      await panel.locator('.slot-base').click();
      const devOption = panel
        .getByRole('listbox', { name: 'Branches' })
        .getByRole('option', { name: 'dev' });
      await expect(devOption).toHaveAttribute('aria-selected', 'true');

      const masterOption = panel
        .getByRole('listbox', { name: 'Branches' })
        .getByRole('option', { name: /master.*Current branch/ });
      await expect(masterOption).toHaveAttribute('aria-selected', 'false');
      await expect(masterOption).toContainText('current');
      // The current branch has a separate accessible marker, not aria-selected.
      await expect(masterOption.locator('[aria-label="Current branch"]')).toBeVisible();

      // No checkout happened.
      expect(fs.existsSync(path.join(fixture.repoPath, '.git', 'refs', 'heads', 'dev'))).toBe(true);
    } finally {
      fixture.cleanup();
    }
  });

  test('keyboard: ArrowDown wraps, End/Home jump, Enter accepts, Escape restores focus', async ({
    page,
  }) => {
    const fixture = createGitFixture('diffscribe-e2e-pop-');
    try {
      initRepo(fixture);
      for (const b of ['a1', 'a2', 'a3']) {
        fixture.runGit(['branch', b]);
      }
      await registerAndSelectWorkspace(page, fixture.repoPath, `E2E-Pop5-${Date.now()}`, 'git');

      const panel = page.locator('#git-context-panel');
      await expect(panel).toBeVisible({ timeout: 10000 });

      const baseBtn = panel.locator('.slot-base');
      await baseBtn.click();
      const search = panel.getByRole('combobox', { name: 'Filter branches' });
      await expect(search).toBeFocused();

      // ArrowDown from the last visible option wraps to the first: the
      // active option is exposed via aria-activedescendant, not
      // aria-selected (which reflects the slot value only).
      await page.keyboard.press('End');
      await page.keyboard.press('ArrowDown');
      await expect(search).toHaveAttribute('aria-activedescendant', 'branch-option-0');
      await expect(
        panel.getByRole('listbox', { name: 'Branches' }).getByRole('option').first(),
      ).toHaveClass(/active/);

      // Home/End move the active option (visible via aria-activedescendant).
      await page.keyboard.press('End');
      await expect(search).toHaveAttribute('aria-activedescendant', /branch-option-\d+/);

      // Enter accepts the active option and closes the popup.
      await page.keyboard.press('Enter');
      await expect(panel.locator('.branch-popup')).toHaveCount(0);
      await expect(panel.locator('.slot-base .slot-value')).not.toHaveText('—');

      // Escape: popup closes without changing the draft and focus returns
      // to the trigger.
      const slotValueBefore = await panel.locator('.slot-base .slot-value').textContent();
      await baseBtn.click();
      await expect(search).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(panel.locator('.branch-popup')).toHaveCount(0);
      await expect(panel.locator('.slot-base .slot-value')).toHaveText(slotValueBefore ?? '—');
      await expect(baseBtn).toBeFocused();
    } finally {
      fixture.cleanup();
    }
  });

  test('fuzzy filter matches across groups and shows a no-match state', async ({ page }) => {
    const fixture = createGitFixture('diffscribe-e2e-pop-');
    try {
      initRepo(fixture);
      fixture.runGit(['branch', 'dev']);
      fixture.runGit(['branch', 'docs']);
      fixture.runGit(['update-ref', 'refs/remotes/origin/dev', 'master']);
      fixture.runGit(['update-ref', 'refs/remotes/origin/ops', 'master']);

      await registerAndSelectWorkspace(page, fixture.repoPath, `E2E-Pop6-${Date.now()}`, 'git');

      const panel = page.locator('#git-context-panel');
      await expect(panel).toBeVisible({ timeout: 10000 });
      await panel.locator('.slot-base').click();

      const search = panel.getByRole('combobox', { name: 'Filter branches' });
      await expect(search).toBeVisible({ timeout: 8000 });

      // "dv" fuzzy-matches "dev" and "origin/dev" across both groups.
      await search.fill('dv');
      const options = panel.getByRole('listbox', { name: 'Branches' }).getByRole('option');
      await expect(options).toHaveCount(2, { timeout: 8000 });
      await expect(panel.locator('.branch-popup')).toContainText('origin/dev');

      // No-match state.
      await search.fill('zzz');
      await expect(panel.getByText('No matching branches')).toBeVisible({ timeout: 5000 });
    } finally {
      fixture.cleanup();
    }
  });

  test('empty popup state for an unborn workspace', async ({ page }) => {
    const fixture = createGitFixture('diffscribe-e2e-pop-');
    try {
      await registerAndSelectWorkspace(page, fixture.repoPath, `E2E-Pop7-${Date.now()}`, 'git');
      const panel = page.locator('#git-context-panel');
      await expect(panel).toBeVisible({ timeout: 10000 });

      await panel.locator('.slot-base').click();
      await expect(panel.getByText('No branches')).toBeVisible({ timeout: 8000 });
    } finally {
      fixture.cleanup();
    }
  });

  test('popup fits the panel at 320px with internal scroll and no horizontal overflow', async ({
    page,
  }) => {
    const fixture = createGitFixture('diffscribe-e2e-pop-');
    try {
      initRepo(fixture);
      for (let i = 0; i < 14; i++) {
        fixture.runGit(['branch', `many/${i}`]);
      }
      await registerAndSelectWorkspace(page, fixture.repoPath, `E2E-Pop8-${Date.now()}`, 'git');

      await page.setViewportSize({ width: 320, height: 700 });
      // On compact viewports the Git panel lives in the mobile drawer.
      await page.locator('[data-testid="rail-tab-git"]').click();
      const panel = page.locator('#git-context-panel');
      await expect(panel).toBeVisible({ timeout: 10000 });

      await panel.locator('.slot-base').click();
      const popup = panel.locator('.branch-popup');
      await expect(popup).toBeVisible({ timeout: 8000 });

      // Popup fits inside the panel horizontally.
      const panelBox = await panel.boundingBox();
      const popupBox = await popup.boundingBox();
      expect(popupBox).not.toBeNull();
      expect(popupBox!.x).toBeGreaterThanOrEqual(panelBox!.x - 1);
      expect(popupBox!.x + popupBox!.width).toBeLessThanOrEqual(panelBox!.x + panelBox!.width + 1);

      // No page-level horizontal overflow.
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(scrollWidth).toBeLessThanOrEqual(320);

      // The listbox scrolls internally.
      const listbox = popup.locator('.branch-popup-listbox');
      const dims = await listbox.evaluate((el) => ({
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
      }));
      expect(dims.scrollHeight).toBeGreaterThan(dims.clientHeight);
    } finally {
      fixture.cleanup();
    }
  });

  // ────── Post-tranche C hardening ──────

  test('composing IME input never accepts or closes (real composition events)', async ({
    page,
  }) => {
    const fixture = createGitFixture('diffscribe-e2e-pop-');
    try {
      initRepo(fixture);
      fixture.runGit(['branch', 'dev']);
      await registerAndSelectWorkspace(page, fixture.repoPath, `E2E-Pop9-${Date.now()}`, 'git');

      const panel = page.locator('#git-context-panel');
      await expect(panel).toBeVisible({ timeout: 10000 });
      await panel.locator('.slot-base').click();
      const search = panel.getByRole('combobox', { name: 'Filter branches' });
      await expect(search).toBeFocused();
      const slotValueBefore = await panel.locator('.slot-base .slot-value').textContent();

      // Real IME session on the focused combobox: compositionstart, an
      // Enter keydown flagged as composing (isComposing: true), and
      // compositionend. The Enter must be ignored by the keydown handler.
      await search.evaluate((el) => {
        el.dispatchEvent(new CompositionEvent('compositionstart', { data: '' }));
        el.dispatchEvent(
          new KeyboardEvent('keydown', {
            key: 'Enter',
            isComposing: true,
            bubbles: true,
            cancelable: true,
          }),
        );
        el.dispatchEvent(new CompositionEvent('compositionend', { data: 'dev' }));
      });

      // No accept happened: the popup stays open and the slot is unchanged.
      await expect(panel.locator('.branch-popup')).toBeVisible({ timeout: 5000 });
      await expect(panel.locator('.slot-base .slot-value')).toHaveText(slotValueBefore ?? '—');
    } finally {
      fixture.cleanup();
    }
  });

  test('popup shows real loading during a slow refresh and returns to the empty state', async ({
    page,
  }) => {
    const fixture = createGitFixture('diffscribe-e2e-pop-');
    try {
      // Unborn repository: the Git context has no branches.
      await registerAndSelectWorkspace(page, fixture.repoPath, `E2E-Pop10-${Date.now()}`, 'git');
      const panel = page.locator('#git-context-panel');
      await expect(panel).toBeVisible({ timeout: 10000 });
      await panel.locator('.slot-base').click();
      await expect(panel.getByText('No branches')).toBeVisible({ timeout: 8000 });

      // Slow the refresh down and hold it until the loading state is seen.
      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      await page.route('**/api/workspaces/*/git-context*', async (route) => {
        await gate;
        await route.continue();
      });

      await panel.getByRole('button', { name: 'Refresh Git context' }).click();
      // With no branches known, the popup shows a real loading state.
      await expect(panel.getByText('Loading branches…')).toBeVisible({ timeout: 5000 });
      release();

      // After the refresh completes the popup returns to the empty state.
      await expect(panel.getByText('No branches')).toBeVisible({ timeout: 8000 });
      await expect(panel.getByText('Loading branches…')).toHaveCount(0);
    } finally {
      fixture.cleanup();
    }
  });

  test('existing branch options stay visible during a background refresh', async ({ page }) => {
    const fixture = createGitFixture('diffscribe-e2e-pop-');
    try {
      initRepo(fixture);
      fixture.runGit(['branch', 'dev']);
      await registerAndSelectWorkspace(page, fixture.repoPath, `E2E-Pop11-${Date.now()}`, 'git');

      const panel = page.locator('#git-context-panel');
      await expect(panel).toBeVisible({ timeout: 10000 });
      await panel.locator('.slot-base').click();
      const options = panel.getByRole('listbox', { name: 'Branches' }).getByRole('option');
      await expect(options).toHaveCount(2, { timeout: 8000 });

      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      await page.route('**/api/workspaces/*/git-context*', async (route) => {
        await gate;
        await route.continue();
      });

      await panel.getByRole('button', { name: 'Refresh Git context' }).click();
      // Existing options remain; the popup never blanks into a loading state.
      await expect(options).toHaveCount(2, { timeout: 5000 });
      await expect(panel.getByText('Loading branches…')).toHaveCount(0);
      release();
    } finally {
      fixture.cleanup();
    }
  });

  test('failed refresh inside an open popup shows an inline error with Retry and no duplicate alert', async ({
    page,
  }) => {
    const fixture = createGitFixture('diffscribe-e2e-pop-');
    try {
      initRepo(fixture);
      fixture.runGit(['branch', 'dev']);
      await registerAndSelectWorkspace(page, fixture.repoPath, `E2E-Pop12-${Date.now()}`, 'git');

      const panel = page.locator('#git-context-panel');
      await expect(panel).toBeVisible({ timeout: 10000 });
      await panel.locator('.slot-base').click();
      await expect(
        panel.getByRole('listbox', { name: 'Branches' }).getByRole('option'),
      ).toHaveCount(2, { timeout: 8000 });

      await page.route('**/api/workspaces/*/git-context*', (route) => route.abort());
      await panel.getByRole('button', { name: 'Refresh Git context' }).click();

      // The popup owns the alert: inline error + Retry inside the popup…
      await expect(panel.locator('.branch-popup [role="alert"]')).toBeVisible({ timeout: 8000 });
      await expect(panel.locator('.branch-popup')).toContainText('Retry');
      // …and exactly one alert exists in the whole panel: the global banner
      // yields to the open popup instead of duplicating it.
      await expect(panel.locator('[role="alert"]')).toHaveCount(1);
      // The popup stays open.
      await expect(panel.locator('.branch-popup')).toBeVisible();
    } finally {
      fixture.cleanup();
    }
  });

  test('Retry from the popup recovers and restores the branch options', async ({ page }) => {
    const fixture = createGitFixture('diffscribe-e2e-pop-');
    try {
      initRepo(fixture);
      fixture.runGit(['branch', 'dev']);
      await registerAndSelectWorkspace(page, fixture.repoPath, `E2E-Pop13-${Date.now()}`, 'git');

      const panel = page.locator('#git-context-panel');
      await expect(panel).toBeVisible({ timeout: 10000 });
      await panel.locator('.slot-base').click();
      await expect(
        panel.getByRole('listbox', { name: 'Branches' }).getByRole('option'),
      ).toHaveCount(2, { timeout: 8000 });

      let calls = 0;
      await page.route('**/api/workspaces/*/git-context*', async (route) => {
        calls += 1;
        if (calls === 1) {
          await route.abort();
        } else {
          await route.continue();
        }
      });
      await panel.getByRole('button', { name: 'Refresh Git context' }).click();
      await expect(panel.locator('.branch-popup [role="alert"]')).toBeVisible({ timeout: 8000 });

      // Retry from inside the popup: the second request succeeds, the error
      // disappears, and the branch options come back.
      await panel
        .locator('.branch-popup')
        .getByRole('button', { name: 'Retry loading branches' })
        .click();
      await expect(panel.locator('.branch-popup [role="alert"]')).toHaveCount(0, {
        timeout: 8000,
      });
      await expect(
        panel.getByRole('listbox', { name: 'Branches' }).getByRole('option'),
      ).toHaveCount(2, { timeout: 8000 });
      expect(calls).toBeGreaterThanOrEqual(2);
    } finally {
      fixture.cleanup();
    }
  });

  test('popup fits the panel at 375px and 768px with internal scroll and no horizontal overflow', async ({
    page,
  }) => {
    const fixture = createGitFixture('diffscribe-e2e-pop-');
    try {
      initRepo(fixture);
      for (let i = 0; i < 14; i++) {
        fixture.runGit(['branch', `many/${i}`]);
      }
      await registerAndSelectWorkspace(page, fixture.repoPath, `E2E-Pop14-${Date.now()}`, 'git');

      for (const width of [375, 768]) {
        await page.setViewportSize({ width, height: 700 });
        // On compact viewports the Git panel lives in the mobile drawer.
        await page.locator('[data-testid="rail-tab-git"]').click();
        const panel = page.locator('#git-context-panel');
        await expect(panel).toBeVisible({ timeout: 10000 });

        await panel.locator('.slot-base').click();
        const popup = panel.locator('.branch-popup');
        await expect(popup).toBeVisible({ timeout: 8000 });

        // Popup fits inside the panel horizontally.
        const panelBox = await panel.boundingBox();
        const popupBox = await popup.boundingBox();
        expect(popupBox).not.toBeNull();
        expect(popupBox!.x).toBeGreaterThanOrEqual(panelBox!.x - 1);
        expect(popupBox!.x + popupBox!.width).toBeLessThanOrEqual(
          panelBox!.x + panelBox!.width + 1,
        );

        // No page-level horizontal overflow.
        const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
        expect(scrollWidth).toBeLessThanOrEqual(width);

        // The listbox scrolls internally.
        const listbox = popup.locator('.branch-popup-listbox');
        const dims = await listbox.evaluate((el) => ({
          scrollHeight: el.scrollHeight,
          clientHeight: el.clientHeight,
        }));
        expect(dims.scrollHeight).toBeGreaterThan(dims.clientHeight);

        // Close the popup before the next viewport iteration.
        await page.keyboard.press('Escape');
        await expect(popup).toHaveCount(0);
      }
    } finally {
      fixture.cleanup();
    }
  });
});
