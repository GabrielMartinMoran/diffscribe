import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect, test } from '@playwright/test';

import { createGitFixture } from './helpers/git-fixture';
import {
  createInteractionRecorder,
  type InteractionMeasurements,
  type InteractionRecorder,
  type InteractionSamples,
} from './helpers/performance-timing';
import { registerAndActivate, selectRailTab } from './helpers/register-workspace';
import { resetDb } from './helpers/reset-db';
import { startWorkerServer, stopWorkerServer, type WorkerServer } from './helpers/worker-server';

/**
 * Fast-menu interactions baseline (measurement only).
 *
 * Records shell / focus / first-content / settled times, request counts,
 * long tasks and page errors for: initial page load, overflow menu, Quick
 * Open, rail switch, right panel and review list. Writes
 * `tests/fast-menu-baseline.md`. No budgets are asserted — budgets are
 * explicit user decisions after this baseline exists.
 *
 * Environments: dev by default; production when
 * `DIFFSCRIBE_E2E_BASELINE_ENV=production` (requires `npm run build` first,
 * served through `vite preview` via the worker-server production mode).
 * Dev cold = first page load on a fresh server; interactions are warm.
 */

interface RecordedInteraction {
  name: string;
  measurements: InteractionMeasurements;
}

const SPEC_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPORT_PATH = path.resolve(SPEC_DIR, '../fast-menu-baseline.md');
const BASELINE_PORT_OFFSET = 100;

const mode = process.env.DIFFSCRIBE_E2E_BASELINE_ENV === 'production' ? 'production' : 'dev';
const environmentLabel = mode === 'production' ? 'production' : 'dev-warm/cold';

let server: WorkerServer | null = null;
let baseURL = '';
let prodDbDir: string | null = null;
const interactions: RecordedInteraction[] = [];
test.beforeAll(async ({ playwright }) => {
  // Production preview startup (vite preview over the build) can exceed the
  // default 60 s hook timeout: raise it for this hook only.
  test.setTimeout(180_000);
  const basePort = Number(process.env.DIFFSCRIBE_E2E_BASE_PORT ?? 5_173) + BASELINE_PORT_OFFSET;
  // Production uses a real SQLite file: point it at a temp dir so the
  // baseline never touches ~/.diffscribe (the reset endpoint cleans it).
  const overrideEnv =
    mode === 'production'
      ? { DIFFSCRIBE_DB_DIR: mkdtempSync(path.join(os.tmpdir(), 'diffscribe-prod-base-')) }
      : undefined;
  if (overrideEnv) prodDbDir = overrideEnv.DIFFSCRIBE_DB_DIR;
  server = await startWorkerServer({
    workerIndex: 0,
    parallelIndex: 0,
    basePort,
    mode,
    startupTimeoutMs: 120_000,
    overrideEnv,
  });
  baseURL = server.baseURL;

  const request = await playwright.request.newContext({ baseURL });
  await resetDb(request);
  await request.dispose();
});

test.afterAll(async () => {
  if (server) {
    await stopWorkerServer(server);
    server = null;
  }
  if (prodDbDir) {
    rmSync(prodDbDir, { recursive: true, force: true });
    prodDbDir = null;
  }
  writeBaselineReport();
});

test('records the fast-menu interaction baseline', async ({ browser }) => {
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
  const fixture = createGitFixture('diffscribe-e2e-base-');

  try {
    // ── Cold page load ──
    const recorder = await createInteractionRecorder(page);
    await recorder.start();
    await page.goto('/');
    const shell = page.getByTestId('shell-layout');
    await expect(shell).toBeVisible({ timeout: 30_000 });
    const shellVisibleMs = await recorder.since();
    const sidebar = page.locator('#workspace-sidebar');
    await expect(sidebar).toBeVisible({ timeout: 30_000 });
    const firstContentMs = await recorder.since();
    const coldLoad: InteractionMeasurements = await recorder.read({
      shellVisibleMs,
      focusMs: shellVisibleMs,
      firstContentMs,
    });
    coldLoad.settledMs = await recorder.settled();
    interactions.push({ name: 'initial page load (dev cold / prod cold)', measurements: coldLoad });

    // ── Warm up: register and activate a workspace ──
    writeFileSync(path.join(fixture.repoPath, 'README.md'), '# baseline\n');
    fixture.runGit(['add', '.']);
    fixture.runGit(['commit', '-m', 'init']);
    await registerAndActivate(page, fixture.repoPath, `E2E-Base-${Date.now()}`);

    // ── Overflow menu ──
    interactions.push(
      await measureInteraction(page, 'overflow menu open', async (rec) => {
        const item = page.locator('#workspace-sidebar li').first();
        await expect(item).toBeVisible({ timeout: 10_000 });
        await rec.start();
        await item.getByTestId('workspace-actions').click();
        const menu = page.getByRole('menu');
        await expect(menu).toBeVisible({ timeout: 10_000 });
        await expect(menu.getByRole('menuitem').first()).toBeFocused({ timeout: 10_000 });
        return {
          shellVisibleMs: await rec.since(),
          focusMs: await rec.since(),
          firstContentMs: await rec.since(),
        };
      }),
    );
    // The overflow menu is pure local UI: opening it must not issue requests.
    const overflow = interactions[interactions.length - 1].measurements;
    expect(overflow.requestCount).toBe(0);

    // ── Quick Open ──
    interactions.push(
      await measureInteraction(page, 'quick open', async (rec) => {
        await rec.start();
        await page.keyboard.press('Control+p');
        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible({ timeout: 10_000 });
        await expect(page.getByRole('combobox')).toBeFocused({ timeout: 10_000 });
        await expect(page.getByTestId('quick-open-result').first()).toBeVisible({
          timeout: 10_000,
        });
        return {
          shellVisibleMs: await rec.since(),
          focusMs: await rec.since(),
          firstContentMs: await rec.since(),
        };
      }),
    );
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // ── Rail switch (project → git) ──
    interactions.push(
      await measureInteraction(page, 'rail switch project→git', async (rec) => {
        await selectRailTab(page, 'project');
        await expect(page.getByTestId('project-tree')).toBeVisible({ timeout: 10_000 });
        await rec.start();
        await page.getByTestId('rail-tab-git').click();
        const panel = page.locator('#git-context-panel');
        await expect(panel).toBeVisible({ timeout: 10_000 });
        await expect(panel.locator('.status-indicator')).toBeVisible({ timeout: 10_000 });
        return {
          shellVisibleMs: await rec.since(),
          focusMs: await rec.since(),
          firstContentMs: await rec.since(),
        };
      }),
    );

    // ── Right panel (comments → review) ──
    interactions.push(
      await measureInteraction(page, 'right panel comments→review', async (rec) => {
        await rec.start();
        await page.getByTestId('right-tab-review').click();
        const reviewPanel = page.locator('#review-panel');
        await expect(reviewPanel).toBeVisible({ timeout: 10_000 });
        await expect(reviewPanel.locator('.review-placeholder')).toBeVisible({ timeout: 10_000 });
        return {
          shellVisibleMs: await rec.since(),
          focusMs: await rec.since(),
          firstContentMs: await rec.since(),
        };
      }),
    );

    // ── Review list ──
    interactions.push(
      await measureInteraction(page, 'review list open', async (rec) => {
        await rec.start();
        await page.locator('#review-panel button:has-text("View Reviews")').click();
        const list = page.locator('#review-panel .review-list-container');
        await expect(list).toBeVisible({ timeout: 10_000 });
        await expect(list.locator('.list-state')).toBeVisible({ timeout: 10_000 });
        return {
          shellVisibleMs: await rec.since(),
          focusMs: await rec.since(),
          firstContentMs: await rec.since(),
        };
      }),
    );

    // Harness smoke: every interaction recorded all four latency metrics.
    for (const recorded of interactions) {
      expect(recorded.measurements.shellVisibleMs).toBeGreaterThanOrEqual(0);
      expect(recorded.measurements.focusMs).toBeGreaterThanOrEqual(0);
      expect(recorded.measurements.firstContentMs).toBeGreaterThanOrEqual(0);
      expect(recorded.measurements.settledMs).toBeGreaterThanOrEqual(0);
    }
  } finally {
    fixture.cleanup();
    await context.close();
  }
});

async function measureInteraction(
  page: import('@playwright/test').Page,
  name: string,
  run: (rec: InteractionRecorder) => Promise<InteractionSamples>,
): Promise<RecordedInteraction> {
  const recorder = await createInteractionRecorder(page);
  const samples = await run(recorder);
  const settledMs = await recorder.settled();
  const measurements = await recorder.read(samples);
  measurements.settledMs = settledMs;
  return { name, measurements };
}

function writeBaselineReport(): void {
  const header = [
    'Interaction',
    'shell visible',
    'focus',
    'first content',
    'settled',
    'requests',
    'long tasks',
    'page errors',
  ];
  const rows = interactions.map(({ name, measurements: m }) => [
    name,
    fmt(m.shellVisibleMs),
    fmt(m.focusMs),
    fmt(m.firstContentMs),
    fmt(m.settledMs),
    String(m.requestCount),
    String(m.longTasks),
    String(m.pageErrors),
  ]);
  // Numeric columns are right-aligned; Prettier requires aligned markdown
  // tables, so the generator pads every cell to the column width.
  const alignRight = (index: number): boolean => index > 0;
  const widths = header.map((h, i) =>
    Math.max(h.length, ...rows.map((row) => (row[i] ?? '').length)),
  );
  const formatRow = (cells: string[]): string =>
    `| ${cells
      .map((cell, i) => {
        const value = cell ?? '';
        return alignRight(i) ? value.padStart(widths[i]) : value.padEnd(widths[i]);
      })
      .join(' | ')} |`;
  const formatSeparator = (): string =>
    `| ${widths
      .map((w, i) => {
        const dashes = alignRight(i) ? Math.max(3, w - 1) : Math.max(3, w);
        return alignRight(i) ? `${'-'.repeat(dashes)}:` : '-'.repeat(dashes);
      })
      .join(' | ')} |`;
  const metricsTable = [formatRow(header), formatSeparator(), ...rows.map(formatRow)].join('\n');

  const report = [
    '# Fast Menu Interactions — Baseline',
    '',
    '> Generated artifact — measurement only. Budgets are explicit user decisions after this baseline.',
    '',
    `- Environment: ${environmentLabel} (worker-server mode: \`${mode}\`, command: \`npm run ${mode === 'production' ? 'build && npm run preview' : 'dev'}\`)`,
    `- Date: ${new Date().toISOString()}`,
    `- Node: ${process.version}`,
    `- Platform: ${process.platform} ${process.arch}`,
    '',
    '## Metrics (ms)',
    '',
    metricsTable,
    '',
    '## How to re-run',
    '',
    '- Dev: `npm run test:e2e -- fast-menu-baseline`',
    '- Production: `npm run build && DIFFSCRIBE_E2E_BASELINE_ENV=production npx playwright test fast-menu-baseline`',
    '',
    'Budgets (e.g. shell ≤ 100 ms, focus ≤ 150 ms, first content ≤ 500 ms, settled ≤ 1000 ms) are proposed as an explicit user decision and recorded in `docs/PRD.md` only if approved.',
    '',
  ].join('\n');

  mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  writeFileSync(REPORT_PATH, report, 'utf-8');
}

function fmt(ms: number): string {
  return `${Math.round(ms)} ms`;
}
