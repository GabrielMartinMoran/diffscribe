import fs from 'node:fs';
import path from 'node:path';

import type { APIRequestContext, Page } from '@playwright/test';

import { expect, test } from './fixtures';
import { createGitFixture } from './helpers/git-fixture';
import { waitForHydration } from './helpers/hydration';
import { registerAndSelectWorkspace, selectRailTab } from './helpers/register-workspace';
import { resetDb } from './helpers/reset-db';

/**
 * Seeded observation card visuals (0003): populated cards render type and
 * severity badges, status dots, body text, and hover/focus actions; the
 * panel stays inside its column; badges keep readable contrast in both
 * Dark Deep and Synthwave '84 themes.
 */

interface Fixture {
  repoPath: string;
  runGit(args: readonly string[]): void;
  cleanup(): void;
}

function createRepo(): Fixture {
  const fixture = createGitFixture('diffscribe-e2e-obsvis-');
  fs.writeFileSync(path.join(fixture.repoPath, 'README.md'), '# e2e\n');
  fs.mkdirSync(path.join(fixture.repoPath, 'src'), { recursive: true });
  fs.writeFileSync(path.join(fixture.repoPath, 'src', 'app.ts'), 'export const app = 1;\n');
  fixture.runGit(['add', '.']);
  fixture.runGit(['commit', '-m', 'init']);
  fs.writeFileSync(path.join(fixture.repoPath, 'src', 'app.ts'), 'export const app = 2;\n');
  return fixture;
}

async function seedReviewAndObservations(
  request: APIRequestContext,
  workspaceId: string,
): Promise<{ reviewId: string }> {
  const comparison = {
    base: { type: 'head', value: 'HEAD', label: 'HEAD' },
    target: { type: 'working-tree', value: 'working-tree', label: 'working tree' },
    comparisonType: 'working-tree-vs-head',
    createdAt: new Date().toISOString(),
  };
  const reviewRes = await request.post(`/api/workspaces/${workspaceId}/reviews`, {
    data: { comparison, title: 'Seeded visual review' },
  });
  expect(reviewRes.ok()).toBeTruthy();
  const review = (await reviewRes.json()) as { id: string };
  expect(review.id).toBeTruthy();

  const longBody =
    'This observation carries a deliberately long body that keeps wrapping inside the card without overflowing the panel. '.repeat(
      4,
    );
  const snapshot = JSON.stringify(comparison);
  const observations = [
    {
      type: 'issue',
      severity: 'critical',
      body: 'Critical issue with the diff rendering.',
      comparisonSnapshotJson: snapshot,
    },
    {
      type: 'risk',
      severity: 'major',
      body: 'Major risk: merge conflicts expected.',
      comparisonSnapshotJson: snapshot,
    },
    { type: 'suggestion', severity: null, body: longBody, comparisonSnapshotJson: snapshot },
  ];
  for (const obs of observations) {
    const res = await request.post(
      `/api/workspaces/${workspaceId}/reviews/${review.id}/observations`,
      { data: obs },
    );
    expect(res.ok()).toBeTruthy();
  }
  return { reviewId: review.id };
}

async function badgeContrasts(page: Page): Promise<number[]> {
  return page.evaluate(() => {
    const cards = document.querySelectorAll('.obs-card');
    const ratios: number[] = [];
    const parse = (color: string): [number, number, number, number] => {
      const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
      return m
        ? [Number(m[1]), Number(m[2]), Number(m[3]), m[4] === undefined ? 1 : Number(m[4])]
        : [0, 0, 0, 1];
    };
    // Alpha-composite the badge background over the card background so tinted
    // token backgrounds are measured against what the eye actually sees.
    const composite = (
      over: [number, number, number, number],
      under: [number, number, number, number],
    ): [number, number, number] => {
      const a = over[3] + under[3] * (1 - over[3]);
      if (a === 0) return [0, 0, 0];
      return [
        (over[0] * over[3] + under[0] * under[3] * (1 - over[3])) / a,
        (over[1] * over[3] + under[1] * under[3] * (1 - over[3])) / a,
        (over[2] * over[3] + under[2] * under[3] * (1 - over[3])) / a,
      ];
    };
    const lum = (rgb: [number, number, number]) => {
      const ch = (c: number) => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * ch(rgb[0]) + 0.7152 * ch(rgb[1]) + 0.0722 * ch(rgb[2]);
    };
    for (const card of cards) {
      const cardBg = parse(getComputedStyle(card).backgroundColor);
      const badges = card.querySelectorAll('.badge');
      for (const badge of badges) {
        const fg = parse(getComputedStyle(badge).color);
        const bg = composite(parse(getComputedStyle(badge).backgroundColor), cardBg);
        const l1 = lum(bg);
        const l2 = lum([fg[0], fg[1], fg[2]]);
        const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
        ratios.push((hi + 0.05) / (lo + 0.05));
      }
    }
    return ratios;
  });
}

test.describe('Observation card visuals (0003)', () => {
  test.beforeEach(async ({ page, request }) => {
    await resetDb(request);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await waitForHydration(page);
  });

  test('seeded cards render badges, status dots, body text, and hover actions', async ({
    page,
    request,
  }) => {
    const fixture = createRepo();
    try {
      await registerAndSelectWorkspace(page, fixture.repoPath, `E2E-ObsVis-${Date.now()}`, 'git');

      // The sidebar lives on the Workspaces rail; read the active workspace
      // id there before seeding.
      await selectRailTab(page, 'workspaces');
      const workspaceId = await page.evaluate(() => {
        const item = document.querySelector('#workspace-sidebar li.active');
        const input = item?.querySelector('input[name="id"]') as HTMLInputElement | null;
        return input?.value ?? null;
      });
      expect(workspaceId).toBeTruthy();
      await seedReviewAndObservations(request, workspaceId!);

      // Reload so the shell picks up the active review from page data.
      await page.reload();
      await page.waitForLoadState('networkidle');
      await waitForHydration(page);
      await selectRailTab(page, 'git');

      // The Comments panel is the default right tab: populated cards render.
      const cards = page.locator('.obs-card');
      await expect(cards).toHaveCount(3, { timeout: 15000 });

      const firstCard = cards.first();
      await expect(firstCard.locator('.badge.badge-issue')).toContainText('issue');
      await expect(firstCard.locator('.badge.severity.sev-critical')).toContainText('critical');
      await expect(firstCard.locator('.status-dot')).toBeVisible();
      await expect(firstCard.locator('.card-body')).toContainText('Critical issue');

      const riskCard = cards.nth(1);
      await expect(riskCard.locator('.badge.badge-risk')).toContainText('risk');
      await expect(riskCard.locator('.badge.severity.sev-major')).toContainText('major');

      const suggestionCard = cards.nth(2);
      await expect(suggestionCard.locator('.badge.badge-suggestion')).toContainText('suggestion');
      await expect(suggestionCard.locator('.card-body')).toContainText('deliberately long body');

      // Hover reveals the card actions.
      await expect(firstCard.locator('.card-actions')).toBeHidden();
      await firstCard.hover();
      await expect(firstCard.locator('.card-actions')).toBeVisible();

      // Keyboard focus also reveals the actions.
      await firstCard.locator('.card-actions button').first().focus();
      await expect(firstCard.locator('.card-actions')).toBeVisible();

      // The panel never overflows its column, even with long bodies.
      const fits = await page.evaluate(() => {
        const panel = document.querySelector('#observation-panel');
        if (!panel) return false;
        return panel.scrollWidth <= panel.clientWidth + 1;
      });
      expect(fits).toBe(true);
    } finally {
      fixture.cleanup();
    }
  });

  test('cards keep readable badge contrast in Dark Deep and Synthwave', async ({
    page,
    request,
  }) => {
    const fixture = createRepo();
    try {
      await registerAndSelectWorkspace(page, fixture.repoPath, `E2E-ObsTheme-${Date.now()}`, 'git');
      await selectRailTab(page, 'workspaces');
      const workspaceId = await page.evaluate(() => {
        const item = document.querySelector('#workspace-sidebar li.active');
        const input = item?.querySelector('input[name="id"]') as HTMLInputElement | null;
        return input?.value ?? null;
      });
      expect(workspaceId).toBeTruthy();
      await seedReviewAndObservations(request, workspaceId!);

      await page.reload();
      await page.waitForLoadState('networkidle');
      await waitForHydration(page);
      await selectRailTab(page, 'git');
      await expect(page.locator('.obs-card')).toHaveCount(3, { timeout: 15000 });

      // Dark Deep (default): every badge keeps at least 3:1 contrast.
      const darkRatios = await badgeContrasts(page);
      expect(darkRatios.length).toBeGreaterThanOrEqual(5);
      for (const ratio of darkRatios) {
        expect(ratio).toBeGreaterThanOrEqual(3);
      }

      // Switch to Synthwave '84 and re-check.
      await selectRailTab(page, 'settings');
      await page.getByTestId('theme-synthwave').click();
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'synthwave-84', {
        timeout: 5000,
      });
      await selectRailTab(page, 'git');
      const synthRatios = await badgeContrasts(page);
      expect(synthRatios.length).toBeGreaterThanOrEqual(5);
      for (const ratio of synthRatios) {
        expect(ratio).toBeGreaterThanOrEqual(3);
      }
    } finally {
      fixture.cleanup();
    }
  });
});
