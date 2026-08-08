import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fileListStatusLoader } from '$lib/web/services/file-list-status-loader';
import type { ComparisonDraft } from '$lib/web/types/comparison-draft';

import { createWorkspaceServices } from '../../../src/lib/server/composition/workspace-services';
import { getDb, runMigrations } from '../../../src/lib/server/infrastructure/database/connection';
import { load as pageLoad } from '../../../src/routes/+page.server';

/**
 * feat-fast-menu-interactions — integration contract.
 *
 * Covers the cross-consumer loader contract (one `/file-list` request per
 * workspace+comparison, workspace-scoped cache, no inactive prefetch, Git
 * mutation invalidation) and the SSR seed + SvelteKit `depends()` contract of
 * `+page.server.ts`. Scenario-to-test mapping:
 *
 * - @integration "fetched once per workspace and comparison" → shared singleton dedupe
 * - @integration "scoped to the active workspace" → per-workspace cache + no prefetch
 * - @integration "Git mutation invalidates the affected workspace cache" → invalidateWorkspace
 * - @integration "Server-seeded data is not refetched" → page load seed shape
 * - @integration "stale response never overwrites a newer one" → pending-safe invalidate
 */

function draft(overrides: Partial<ComparisonDraft> = {}): ComparisonDraft {
  return {
    base: { type: 'branch', value: 'HEAD', label: 'HEAD' },
    target: { type: 'worktree', value: 'worktree', label: 'Working tree' },
    comparisonType: 'working-tree-vs-head',
    createdAt: '2026-08-05T00:00:00.000Z',
    ...overrides,
  };
}

function okResponse(entries: { path: string; status: string; binary?: boolean }[]): Response {
  return {
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue({ entries, readAt: 'now' }),
  } as unknown as Response;
}

function mkTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'diffscribe-fmi-int-'));
}

function createGitRepo(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
  execSync('git init', { cwd: dir, stdio: 'pipe' });
  execSync('git config user.email "test@test.com"', { cwd: dir, stdio: 'pipe' });
  execSync('git config user.name "Test"', { cwd: dir, stdio: 'pipe' });
  fs.writeFileSync(path.join(dir, 'README.md'), '# test');
  execSync('git add .', { cwd: dir, stdio: 'pipe' });
  execSync('git commit -m "init"', { cwd: dir, stdio: 'pipe' });
}

describe('feat-fast-menu-interactions — shared file-list loader contract', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    fileListStatusLoader.clear();
  });

  afterEach(() => {
    fileListStatusLoader.clear();
    vi.unstubAllGlobals();
  });

  it('dedupes concurrent loads across consumers: one request per workspace+comparison', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(okResponse([{ path: 'src/app.ts', status: 'modified' }]));
    vi.stubGlobal('fetch', fetchMock);

    // Simulate the three consumers (Project tree, Git panel, Quick Open)
    // asking for the same resource at the same time.
    const [mapA, mapB, entriesC] = await Promise.all([
      fileListStatusLoader.load({ workspaceId: 'ws-1', comparison: draft() }),
      fileListStatusLoader.load({ workspaceId: 'ws-1', comparison: draft() }),
      fileListStatusLoader.loadEntries({ workspaceId: 'ws-1', comparison: draft() }),
    ]);

    expect(mapA?.get('src/app.ts')).toBe('modified');
    expect(mapB).toBe(mapA);
    expect(entriesC?.[0]?.path).toBe('src/app.ts');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('scopes the cache per workspace: workspace B never reuses workspace A snapshots', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(okResponse([{ path: 'shared.ts', status: 'modified' }]));
    vi.stubGlobal('fetch', fetchMock);

    await fileListStatusLoader.load({ workspaceId: 'ws-a', comparison: draft() });
    await fileListStatusLoader.load({ workspaceId: 'ws-b', comparison: draft() });

    // Loading B issued its own request (A's snapshot was not reused) and A
    // was not refetched (no prefetch of the inactive workspace).
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls.filter((u) => u.includes('/ws-a/file-list'))).toHaveLength(1);
    expect(urls.filter((u) => u.includes('/ws-b/file-list'))).toHaveLength(1);
  });

  it('never prefetches a non-active workspace: only explicitly loaded keys are cached', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse([{ path: 'a.ts', status: 'modified' }]));
    vi.stubGlobal('fetch', fetchMock);

    await fileListStatusLoader.load({ workspaceId: 'ws-active', comparison: draft() });
    fileListStatusLoader.invalidateWorkspace('ws-other');

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('invalidates the affected workspace cache after a Git mutation; the next load refetches once', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(okResponse([{ path: 'src/app.ts', status: 'modified' }]));
    vi.stubGlobal('fetch', fetchMock);

    await fileListStatusLoader.load({ workspaceId: 'ws-1', comparison: draft() });
    await fileListStatusLoader.load({
      workspaceId: 'ws-1',
      comparison: draft({ target: { type: 'branch', value: 'dev', label: 'dev' } }),
    });
    await fileListStatusLoader.load({ workspaceId: 'ws-2', comparison: draft() });

    // Git mutation (refresh): only the affected workspace is invalidated.
    fileListStatusLoader.invalidateWorkspace('ws-1');

    await fileListStatusLoader.load({ workspaceId: 'ws-1', comparison: draft() });
    await fileListStatusLoader.load({
      workspaceId: 'ws-1',
      comparison: draft({ target: { type: 'branch', value: 'dev', label: 'dev' } }),
    });
    await fileListStatusLoader.load({ workspaceId: 'ws-2', comparison: draft() });

    expect(fetchMock).toHaveBeenCalledTimes(5);
    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls.filter((u) => u.includes('/ws-1/file-list'))).toHaveLength(4);
    expect(urls.filter((u) => u.includes('/ws-2/file-list'))).toHaveLength(1);
  });

  it('is pending-safe: invalidating while a request is in flight never starts an overlapping fetch', async () => {
    let resolveFirst!: (r: Response) => void;
    const firstFetch = new Promise<Response>((resolve) => {
      resolveFirst = resolve;
    });
    const fetchMock = vi
      .fn()
      .mockReturnValueOnce(firstFetch)
      .mockResolvedValueOnce(okResponse([{ path: 'fresh.ts', status: 'modified' }]));
    vi.stubGlobal('fetch', fetchMock);

    const pendingLoad = fileListStatusLoader.load({ workspaceId: 'ws-1', comparison: draft() });
    fileListStatusLoader.invalidateWorkspace('ws-1');
    const sharedLoad = fileListStatusLoader.load({ workspaceId: 'ws-1', comparison: draft() });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveFirst(okResponse([{ path: 'stale.ts', status: 'deleted' }]));
    await Promise.all([pendingLoad, sharedLoad]);

    // The stale snapshot is never cached: the next load starts one fresh
    // request whose data wins.
    const fresh = await fileListStatusLoader.load({ workspaceId: 'ws-1', comparison: draft() });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fresh?.get('fresh.ts')).toBe('modified');
    expect(fresh?.has('stale.ts')).toBe(false);
  });
});

describe('feat-fast-menu-interactions — SSR seed and SvelteKit depends contract', () => {
  let tempRoot: string;
  let repoDir: string;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    tempRoot = mkTempDir();
    repoDir = path.join(tempRoot, 'repo');
    createGitRepo(repoDir);
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('page load seeds workspaces, active workspace and git context from the server', async () => {
    const db = getDb();
    runMigrations(db);
    const services = createWorkspaceServices(db);
    const { workspace } = await services.registerUseCase.execute({
      repositoryPath: repoDir,
      displayName: 'Seed Test',
    });
    services.appState.set('active_workspace_id', workspace.id);

    const data = await pageLoad({
      depends: () => {},
    } as never);

    expect(data.workspaces.some((w) => w.id === workspace.id)).toBe(true);
    expect(data.activeWorkspaceId).toBe(workspace.id);
    expect(data.gitContext).not.toBeNull();
    expect(data.activeReview).toBeNull();
  });

  it('declares the SvelteKit invalidation keys for the tested targeted invalidation contract', async () => {
    const db = getDb();
    runMigrations(db);
    const services = createWorkspaceServices(db);
    const { workspace } = await services.registerUseCase.execute({
      repositoryPath: repoDir,
      displayName: 'Depends Test',
    });
    services.appState.set('active_workspace_id', workspace.id);

    const dependsKeys: string[] = [];
    await pageLoad({
      depends: (key: string) => {
        dependsKeys.push(key);
      },
    } as never);

    expect(dependsKeys).toEqual(
      expect.arrayContaining(['app:workspaces', 'app:git-context', 'app:active-review']),
    );
  });
});
