import fs from 'node:fs';
import path from 'node:path';

import type { Page } from '@playwright/test';

import { expect, test } from './fixtures';
import type { GitFixture } from './helpers/git-fixture';
import { createGitFixture } from './helpers/git-fixture';
import {
  registerAndSelectWorkspace,
  selectRightPanelTab,
  switchFileListToListView,
} from './helpers/register-workspace';
import { resetDb } from './helpers/reset-db';

async function createReviewAndSelectFile(page: Page, fileName = 'src/app.ts'): Promise<void> {
  await selectRightPanelTab(page, 'review');

  const newReviewBtn = page.getByRole('button', { name: /New Review|Start a new review/ });
  await expect(newReviewBtn).toBeVisible({ timeout: 15000 });
  await expect(newReviewBtn).toBeEnabled({ timeout: 15000 });

  const reviewPostPromise = page.waitForResponse(
    (resp) =>
      resp.url().includes('/api/workspaces/') &&
      resp.url().includes('/reviews') &&
      resp.request().method() === 'POST' &&
      resp.status() === 201,
  );

  await newReviewBtn.click();
  await reviewPostPromise;
  await page.waitForLoadState('networkidle');

  await selectRightPanelTab(page, 'comments');

  // W4: fresh contexts default to the tree view; this contract drives the
  // flat list rows.
  await switchFileListToListView(page);

  const fileRow = page
    .locator('[role="listbox"] [role="option"]')
    .filter({ hasText: fileName })
    .first();
  await expect(fileRow).toBeVisible({ timeout: 15000 });

  const fileDiffPromise = page.waitForResponse(
    (resp) =>
      resp.url().includes('/api/workspaces/') &&
      resp.url().includes('/file-diff') &&
      resp.request().method() === 'GET' &&
      resp.status() === 200,
  );

  await fileRow.click();
  await fileDiffPromise;
  await expect(page.locator('[data-line-num]').first()).toBeVisible({ timeout: 10000 });
}

async function setupDraftTest(
  page: Page,
  fixture: GitFixture,
  workspaceName: string,
  fileName = 'src/app.ts',
): Promise<void> {
  const repoDir = fixture.repoPath;
  fs.mkdirSync(path.dirname(path.join(repoDir, fileName)), { recursive: true });
  const lines: string[] = [];
  for (let i = 1; i <= 15; i++) lines.push(`line${i}`);
  fs.writeFileSync(path.join(repoDir, fileName), lines.join('\n') + '\n');
  fixture.runGit(['add', '.']);
  fixture.runGit(['commit', '-m', 'init']);
  const modified = [
    'line1',
    'line2',
    'lineX',
    'line4',
    'line5',
    'lineY',
    'line7',
    'line8',
    'line9',
    'lineZ',
  ];
  for (let i = 11; i <= 15; i++) modified.push(`line${i}`);
  fs.writeFileSync(path.join(repoDir, fileName), modified.join('\n') + '\n');
  await resetDb(page.request);
  await page.goto('/', { waitUntil: 'networkidle' });
  await registerAndSelectWorkspace(page, repoDir, workspaceName, 'git');
  await createReviewAndSelectFile(page, fileName);
}

async function startDraft(page: Page, line: number, body = 'Draft body'): Promise<void> {
  const target = page.locator(`[data-line-num="${line}"][data-side="new"]`).first();
  await target.click();
  const form = page.locator('#observation-panel .obs-form');
  await expect(form).toBeVisible({ timeout: 10000 });
  await page.fill('#obs-body', body);
  await expect(page.locator('#obs-body')).toHaveValue(body);
}

/**
 * Strip `defaultComparison` from the real page-data envelope delivered in the
 * SSR document. SvelteKit embeds the serialized page data (devalue `uneval`
 * output) inside the `kit.start(app, element, { data: [...] })` script; the
 * `gitContext.defaultComparison` field appears as `defaultComparison:{...}`.
 * Each occurrence is structurally located (string-aware brace scan) and
 * replaced with `defaultComparison:null`. Returns the rewritten HTML and the
 * number of fields nulled, so the test can reject a vacuous pass.
 */
function nullifyDefaultComparisonInSsrDocument(html: string): {
  html: string;
  rewritten: number;
} {
  const marker = 'kit.start(app, element, {';
  const scriptStart = html.indexOf(marker);
  if (scriptStart === -1) return { html, rewritten: 0 };
  const scriptEnd = html.indexOf('</script>', scriptStart);
  if (scriptEnd === -1) return { html, rewritten: 0 };
  const script = html.slice(scriptStart, scriptEnd);

  const key = 'defaultComparison:';
  let rewritten = 0;
  let cursor = 0;
  let searchFrom = 0;
  let rewrittenScript = '';
  while (true) {
    const keyIndex = script.indexOf(key, searchFrom);
    if (keyIndex === -1) break;
    const openBrace = script.indexOf('{', keyIndex + key.length);
    if (openBrace === -1) break;
    // String-aware brace scan to the matching close brace.
    let depth = 0;
    let inString = false;
    let endIndex = -1;
    for (let i = openBrace; i < script.length; i++) {
      const ch = script[i];
      if (inString) {
        if (ch === '\\') {
          i += 1;
          continue;
        }
        if (ch === '"') inString = false;
        continue;
      }
      if (ch === '"') {
        inString = true;
        continue;
      }
      if (ch === '{') {
        depth += 1;
      } else if (ch === '}') {
        depth -= 1;
        if (depth === 0) {
          endIndex = i;
          break;
        }
      }
    }
    if (endIndex === -1) break;
    rewritten += 1;
    rewrittenScript += script.slice(cursor, keyIndex) + key + 'null';
    cursor = endIndex + 1;
    searchFrom = endIndex + 1;
  }
  if (rewritten === 0) return { html, rewritten: 0 };
  rewrittenScript += script.slice(cursor);
  return {
    html: html.slice(0, scriptStart) + rewrittenScript + html.slice(scriptEnd),
    rewritten,
  };
}

/**
 * Strip `defaultComparison` from the real page-data envelope delivered by the
 * `__data.json` endpoint (SvelteKit devalue flat-array format: object
 * encodings map keys to indices into the payload array). Nulling the value
 * matches how SvelteKit already serializes a null `defaultComparison`.
 */
function stripDefaultComparisonFromDataJson(envelope: unknown): number {
  let rewritten = 0;
  if (!envelope || typeof envelope !== 'object') return rewritten;
  const nodes = Array.isArray((envelope as { nodes?: unknown[] }).nodes)
    ? (envelope as { nodes: unknown[] }).nodes
    : [];
  for (const node of nodes) {
    if (!node || typeof node !== 'object') continue;
    const data = (node as { type?: string; data?: unknown }).data;
    if ((node as { type?: string }).type !== 'data' || !Array.isArray(data)) continue;
    for (const entry of data as unknown[]) {
      if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
        const record = entry as Record<string, unknown>;
        if (Object.prototype.hasOwnProperty.call(record, 'defaultComparison')) {
          record.defaultComparison = null;
          rewritten += 1;
        }
      }
    }
  }
  return rewritten;
}

test.describe.configure({ mode: 'serial' });

test.describe('Observation draft persistence (OBS-DRAFT-01)', () => {
  test('draft body, type, and severity survive Comments to Review switching', async ({ page }) => {
    const fixture = createGitFixture();
    try {
      await setupDraftTest(page, fixture, 'draft-persist');
      await startDraft(page, 2, 'Persisted draft body');
      await page.selectOption('#obs-type', 'issue');
      await page.selectOption('#obs-severity', 'major');

      await selectRightPanelTab(page, 'review');
      await expect(page.locator('#review-panel')).toBeVisible({ timeout: 8000 });
      await selectRightPanelTab(page, 'comments');

      const form = page.locator('#observation-panel .obs-form');
      await expect(form).toBeVisible({ timeout: 10000 });
      await expect(page.locator('#obs-body')).toHaveValue('Persisted draft body');
      await expect(page.locator('#obs-type')).toHaveValue('issue');
      await expect(page.locator('#obs-severity')).toHaveValue('major');
    } finally {
      fixture.cleanup();
    }
  });
});

test.describe('Dirty draft confirmation (OBS-DRAFT-02 / 03 / 04 / 05)', () => {
  test('OBS-DRAFT-02: dirty replace click asks confirmation; Keep restores draft and selection', async ({
    page,
  }) => {
    const fixture = createGitFixture();
    try {
      await setupDraftTest(page, fixture, 'draft-confirm');
      await startDraft(page, 3, 'Keep me');

      // A normal click on another line is a replace: ask confirmation.
      await page.locator('[data-line-num="7"][data-side="new"]').first().click();
      const dialog = page.getByRole('dialog', { name: /discard draft/i });
      await expect(dialog).toBeVisible({ timeout: 5000 });

      await dialog.getByRole('button', { name: 'Keep draft' }).click();
      await expect(dialog).not.toBeVisible({ timeout: 5000 });

      // Draft body survives and the previous selection is restored.
      await expect(page.locator('#obs-body')).toHaveValue('Keep me');
      await expect(page.locator('[data-line-num="3"][data-side="new"]').first()).toHaveAttribute(
        'data-selected',
        'true',
      );
      await expect(page.locator('[data-line-num="7"][data-side="new"]').first()).toHaveAttribute(
        'data-selected',
        'false',
      );
    } finally {
      fixture.cleanup();
    }
  });

  test('OBS-DRAFT-02b: Discard adopts the new selection and clears the draft', async ({ page }) => {
    const fixture = createGitFixture();
    try {
      await setupDraftTest(page, fixture, 'draft-discard');
      await startDraft(page, 3, 'Discard me');

      await page.locator('[data-line-num="9"][data-side="new"]').first().click();
      const dialog = page.getByRole('dialog', { name: /discard draft/i });
      await expect(dialog).toBeVisible({ timeout: 5000 });
      await dialog.getByRole('button', { name: 'Discard' }).click();

      await expect(page.locator('#obs-body')).toHaveValue('');
      await expect(page.locator('[data-line-num="9"][data-side="new"]').first()).toHaveAttribute(
        'data-selected',
        'true',
      );
    } finally {
      fixture.cleanup();
    }
  });

  test('OBS-DRAFT-03: Ctrl-click toggle preserves the draft without confirmation', async ({
    page,
  }) => {
    const fixture = createGitFixture();
    try {
      await setupDraftTest(page, fixture, 'draft-ctrl');
      await startDraft(page, 3, 'Ctrl body');

      await page
        .locator('[data-line-num="6"][data-side="new"]')
        .first()
        .click({
          modifiers: ['Control'],
        });

      await expect(page.getByRole('dialog', { name: /discard draft/i })).toHaveCount(0);
      await expect(page.locator('#obs-body')).toHaveValue('Ctrl body');
      await expect(page.locator('#observation-panel .obs-form')).toBeVisible();
    } finally {
      fixture.cleanup();
    }
  });

  test('OBS-DRAFT-04: Shift-click extend preserves the draft without confirmation', async ({
    page,
  }) => {
    const fixture = createGitFixture();
    try {
      await setupDraftTest(page, fixture, 'draft-shift');
      await startDraft(page, 3, 'Shift body');

      await page
        .locator('[data-line-num="6"][data-side="new"]')
        .first()
        .click({
          modifiers: ['Shift'],
        });

      await expect(page.getByRole('dialog', { name: /discard draft/i })).toHaveCount(0);
      await expect(page.locator('#obs-body')).toHaveValue('Shift body');
      await expect(page.locator('#observation-panel .obs-form')).toBeVisible();
    } finally {
      fixture.cleanup();
    }
  });

  test('OBS-DRAFT-05: cancelling a dirty draft asks confirmation; Keep keeps draft and selection', async ({
    page,
  }) => {
    const fixture = createGitFixture();
    try {
      await setupDraftTest(page, fixture, 'draft-cancel');
      await startDraft(page, 4, 'Cancel body');

      await page
        .locator('#observation-panel .obs-form')
        .getByRole('button', { name: 'Cancel' })
        .click();
      const dialog = page.getByRole('dialog', { name: /discard draft/i });
      await expect(dialog).toBeVisible({ timeout: 5000 });

      await dialog.getByRole('button', { name: 'Keep draft' }).click();
      await expect(page.locator('#obs-body')).toHaveValue('Cancel body');
      await expect(page.locator('[data-line-num="4"][data-side="new"]').first()).toHaveAttribute(
        'data-selected',
        'true',
      );

      // Second cancel: Discard closes the form and clears the selection.
      await page
        .locator('#observation-panel .obs-form')
        .getByRole('button', { name: 'Cancel' })
        .click();
      await expect(dialog).toBeVisible({ timeout: 5000 });
      await dialog.getByRole('button', { name: 'Discard' }).click();
      await expect(page.locator('#observation-panel .obs-form')).toHaveCount(0);
      await expect(page.locator('[data-line-num="4"][data-side="new"]').first()).toHaveAttribute(
        'data-selected',
        'false',
      );
    } finally {
      fixture.cleanup();
    }
  });
});

test.describe('Missing context inline errors (OBS-ERR)', () => {
  test('OBS-ERR-01: creating without an active review shows an inline error', async ({ page }) => {
    const fixture = createGitFixture();
    try {
      // Register + select a file WITHOUT creating a review.
      const repoDir = fixture.repoPath;
      fs.mkdirSync(path.join(repoDir, 'src'), { recursive: true });
      fs.writeFileSync(path.join(repoDir, 'src/app.ts'), 'line1\nline2\nline3\n');
      fixture.runGit(['add', '.']);
      fixture.runGit(['commit', '-m', 'init']);
      fs.writeFileSync(path.join(repoDir, 'src/app.ts'), 'line1\nlineX\nline3\n');
      await resetDb(page.request);
      await page.goto('/', { waitUntil: 'networkidle' });
      await registerAndSelectWorkspace(page, repoDir, 'draft-no-review', 'git');
      // W4: fresh contexts default to the tree view; opt into the flat list.
      await switchFileListToListView(page);

      const fileRow = page
        .locator('[role="listbox"] [role="option"]')
        .filter({ hasText: 'src/app.ts' })
        .first();
      await expect(fileRow).toBeVisible({ timeout: 15000 });
      await fileRow.click();
      const line = page.locator('[data-line-num="2"][data-side="new"]').first();
      await expect(line).toBeVisible({ timeout: 10000 });
      await line.click();

      const form = page.locator('#observation-panel .obs-form');
      await expect(form).toBeVisible({ timeout: 10000 });
      await page.fill('#obs-body', 'No review body');
      await page.click('button:has-text("Create")');

      const alert = form.locator('[role="alert"]');
      await expect(alert).toBeVisible({ timeout: 5000 });
      await expect(alert).toContainText(/review/i);
    } finally {
      fixture.cleanup();
    }
  });

  test('OBS-ERR-02: creating without a comparison draft shows an inline error', async ({
    page,
  }) => {
    const fixture = createGitFixture();
    try {
      // Normal workspace + review setup on the Workspaces rail (the git rail
      // panel is never mounted, so the only comparison seed is the page data).
      const repoDir = fixture.repoPath;
      fs.mkdirSync(path.join(repoDir, 'src'), { recursive: true });
      fs.writeFileSync(path.join(repoDir, 'src/app.ts'), 'line1\nline2\nline3\n');
      fixture.runGit(['add', '.']);
      fixture.runGit(['commit', '-m', 'init']);
      fs.writeFileSync(path.join(repoDir, 'src/app.ts'), 'line1\nlineX\nline3\n');
      await resetDb(page.request);
      await page.goto('/', { waitUntil: 'networkidle' });
      await registerAndSelectWorkspace(page, repoDir, 'draft-no-comparison');

      await selectRightPanelTab(page, 'review');
      const newReviewBtn = page.getByRole('button', { name: /New Review|Start a new review/ });
      await expect(newReviewBtn).toBeVisible({ timeout: 15000 });
      const reviewPostPromise = page.waitForResponse(
        (resp) =>
          resp.url().includes('/reviews') &&
          resp.request().method() === 'POST' &&
          resp.status() === 201,
      );
      await newReviewBtn.click();
      await reviewPostPromise;
      await page.waitForLoadState('networkidle');
      await selectRightPanelTab(page, 'comments');

      // Intercept the page data BEFORE the reload so a fresh page hydrates
      // from an envelope where gitContext.defaultComparison is null. The
      // reloaded document carries the page data embedded in the SSR script
      // (devalue uneval); the __data.json route covers any invalidation fetch
      // (devalue flat array). Each nulled field is counted so a rewrite that
      // never fires fails loudly instead of passing vacuously.
      let rewritten = 0;
      await page.route('**/', async (route) => {
        const response = await route.fetch();
        const result = nullifyDefaultComparisonInSsrDocument(await response.text());
        rewritten += result.rewritten;
        await route.fulfill({ response, body: result.html });
      });
      await page.route(/__data\.json/, async (route) => {
        const response = await route.fetch();
        const body = await response.json();
        rewritten += stripDefaultComparisonFromDataJson(body);
        await route.fulfill({ response, json: body });
      });

      await page.reload();
      await page.waitForLoadState('networkidle');

      // The real envelope must have contained a defaultComparison that we
      // nulled — otherwise this test is vacuous.
      await expect.poll(() => rewritten, { timeout: 10000 }).toBeGreaterThan(0);

      // Open the same ObservationForm via Add observation with no comparison.
      await page.getByRole('button', { name: 'Add observation' }).click();
      const form = page.locator('#observation-panel .obs-form');
      await expect(form).toBeVisible({ timeout: 10000 });
      await page.fill('#obs-body', 'No comparison body');
      await expect(page.locator('#obs-body')).toHaveValue('No comparison body');

      // No observation may leave the client: the guard must short-circuit.
      let observationPosts = 0;
      page.on('request', (req) => {
        if (
          req.method() === 'POST' &&
          req.url().includes('/api/workspaces/') &&
          req.url().includes('/reviews/') &&
          req.url().includes('/observations')
        ) {
          observationPosts += 1;
        }
      });

      await page.click('button:has-text("Create")');

      const alert = form.locator('[role="alert"]');
      await expect(alert).toBeVisible({ timeout: 5000 });
      await expect(alert).toContainText(/comparison/i);
      await expect(page.locator('#obs-body')).toHaveValue('No comparison body');
      expect(observationPosts).toBe(0);
    } finally {
      fixture.cleanup();
    }
  });
});
