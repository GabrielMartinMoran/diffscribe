import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createFileListStatusLoader,
  type FileListKey,
} from '$lib/web/services/file-list-status-loader';
import type { ResourceLoader } from '$lib/web/services/resource-loader';
import type { ComparisonDraft } from '$lib/web/types/comparison-draft';

function draft(overrides: Partial<ComparisonDraft> = {}): ComparisonDraft {
  return {
    base: { type: 'branch', value: 'HEAD', label: 'HEAD' },
    target: { type: 'worktree', value: 'worktree', label: 'Working tree' },
    comparisonType: 'working-tree-vs-head',
    createdAt: '2026-08-05T00:00:00.000Z',
    ...overrides,
  };
}

function key(workspaceId: string, comparison: ComparisonDraft): FileListKey {
  return { workspaceId, comparison };
}

function okResponse(entries: { path: string; status: string; binary?: boolean }[]): Response {
  return {
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue({ entries, readAt: 'now' }),
  } as unknown as Response;
}

function errorResponse(): Response {
  return {
    ok: false,
    status: 500,
    json: vi.fn().mockResolvedValue({ error: { message: 'boom', errorCode: 'E' } }),
  } as unknown as Response;
}

describe('file-list-status-loader (feat-fast-menu-interactions)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('conforms to the shared ResourceLoader interface', () => {
    const loader: ResourceLoader<FileListKey, Map<string, string>> = createFileListStatusLoader(
      vi.fn() as unknown as typeof fetch,
    );
    expect(typeof loader.load).toBe('function');
    expect(typeof loader.invalidate).toBe('function');
    expect(typeof loader.clear).toBe('function');
  });

  it('builds a path-to-status map from the comparison file list', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      okResponse([
        { path: 'src/app.ts', status: 'modified' },
        { path: 'src/scratch.ts', status: 'untracked' },
      ]),
    );
    const loader = createFileListStatusLoader(fetchMock as unknown as typeof fetch);

    const map = await loader.load(key('ws-1', draft()));
    expect(map).not.toBeNull();
    expect(map!.get('src/app.ts')).toBe('modified');
    expect(map!.get('src/scratch.ts')).toBe('untracked');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      '/api/workspaces/ws-1/file-list?comparison=',
    );
  });

  it('caches per workspace+comparison signature without a second fetch', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(okResponse([{ path: 'src/app.ts', status: 'modified' }]));
    const loader = createFileListStatusLoader(fetchMock as unknown as typeof fetch);

    const first = await loader.load(key('ws-1', draft()));
    const second = await loader.load(key('ws-1', draft()));
    expect(first).toBe(second);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('uses a canonical key WITHOUT createdAt: drafts that differ only by createdAt share one cache entry', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(okResponse([{ path: 'src/app.ts', status: 'modified' }]));
    const loader = createFileListStatusLoader(fetchMock as unknown as typeof fetch);

    const older = await loader.load(key('ws-1', draft({ createdAt: '2026-08-05T00:00:00.000Z' })));
    const newer = await loader.load(key('ws-1', draft({ createdAt: '2026-08-06T00:00:00.000Z' })));

    expect(older).toBe(newer);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('refetches when the comparison signature changes', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(okResponse([{ path: 'src/app.ts', status: 'modified' }]));
    const loader = createFileListStatusLoader(fetchMock as unknown as typeof fetch);

    await loader.load(key('ws-1', draft()));
    await loader.load(
      key('ws-1', draft({ target: { type: 'branch', value: 'dev', label: 'dev' } })),
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('keeps separate caches per workspace', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(okResponse([{ path: 'src/app.ts', status: 'modified' }]));
    const loader = createFileListStatusLoader(fetchMock as unknown as typeof fetch);

    await loader.load(key('ws-1', draft()));
    await loader.load(key('ws-2', draft()));

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1][0])).toContain('/api/workspaces/ws-2/file-list');
  });

  it('concurrent loads for the same key share a single in-flight request', async () => {
    let resolveFirst!: (r: Response) => void;
    const firstFetch = new Promise<Response>((resolve) => {
      resolveFirst = resolve;
    });
    const fetchMock = vi
      .fn()
      .mockReturnValueOnce(firstFetch)
      .mockResolvedValue(okResponse([{ path: 'src/app.ts', status: 'modified' }]));
    const loader = createFileListStatusLoader(fetchMock as unknown as typeof fetch);

    const first = loader.load(key('ws-1', draft()));
    const second = loader.load(key('ws-1', draft()));
    resolveFirst(okResponse([{ path: 'src/app.ts', status: 'modified' }]));
    const [firstResult, secondResult] = await Promise.all([first, second]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(firstResult).toEqual(secondResult);
  });

  it('keeps per-key guards: a load for one workspace never discards another workspace request', async () => {
    let resolveWs1!: (r: Response) => void;
    const ws1Fetch = new Promise<Response>((resolve) => {
      resolveWs1 = resolve;
    });
    const fetchMock = vi
      .fn()
      .mockReturnValueOnce(ws1Fetch)
      .mockResolvedValueOnce(okResponse([{ path: 'b.txt', status: 'modified' }]));
    const loader = createFileListStatusLoader(fetchMock as unknown as typeof fetch);

    const ws1Load = loader.load(key('ws-1', draft()));
    const ws2Load = loader.load(key('ws-2', draft()));

    // ws-2 settles first; ws-1 must still resolve with its own data.
    const ws2 = await ws2Load;
    expect(ws2?.get('b.txt')).toBe('modified');
    resolveWs1(okResponse([{ path: 'a.txt', status: 'untracked' }]));
    const ws1 = await ws1Load;
    expect(ws1?.get('a.txt')).toBe('untracked');
  });

  it('invalidate() drops only the targeted workspace cache entries', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(okResponse([{ path: 'src/app.ts', status: 'modified' }]));
    const loader = createFileListStatusLoader(fetchMock as unknown as typeof fetch);

    await loader.load(key('ws-1', draft()));
    await loader.load(
      key('ws-1', draft({ target: { type: 'branch', value: 'dev', label: 'dev' } })),
    );
    await loader.load(key('ws-2', draft()));

    // Invalidate workspace ws-1 with either of its comparison keys: every
    // ws-1 entry is dropped, ws-2 stays cached.
    loader.invalidate(key('ws-1', draft()));
    await loader.load(key('ws-1', draft()));
    await loader.load(
      key('ws-1', draft({ target: { type: 'branch', value: 'dev', label: 'dev' } })),
    );
    await loader.load(key('ws-2', draft()));

    expect(fetchMock).toHaveBeenCalledTimes(5);
    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls.filter((u) => u.includes('/ws-1/file-list'))).toHaveLength(4);
    expect(urls.filter((u) => u.includes('/ws-2/file-list'))).toHaveLength(1);
  });

  it('invalidate() for an unknown workspace is a no-op', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse([{ path: 'a.txt', status: 'M' }]));
    const loader = createFileListStatusLoader(fetchMock as unknown as typeof fetch);

    loader.invalidate(key('ws-nope', draft()));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('clear() drops every cached snapshot', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(okResponse([{ path: 'src/app.ts', status: 'modified' }]));
    const loader = createFileListStatusLoader(fetchMock as unknown as typeof fetch);

    await loader.load(key('ws-1', draft()));
    await loader.load(key('ws-2', draft()));
    loader.clear();
    await loader.load(key('ws-1', draft()));
    await loader.load(key('ws-2', draft()));

    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('loadEntries shares the same cache entry as load(): one fetch serves the map and the raw entries', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      okResponse([
        { path: 'src/app.ts', status: 'modified', binary: false },
        { path: 'logo.png', status: 'added', binary: true },
      ]),
    );
    const loader = createFileListStatusLoader(fetchMock as unknown as typeof fetch);

    const map = await loader.load(key('ws-1', draft()));
    const entries = await loader.loadEntries(key('ws-1', draft()));

    expect(map?.get('logo.png')).toBe('added');
    expect(entries?.find((e) => e.path === 'logo.png')?.binary).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns null and does not cache a failed fetch, so a retry can succeed', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(errorResponse())
      .mockResolvedValueOnce(okResponse([{ path: 'src/app.ts', status: 'modified' }]));
    const loader = createFileListStatusLoader(fetchMock as unknown as typeof fetch);

    expect(await loader.load(key('ws-1', draft()))).toBeNull();
    const retry = await loader.load(key('ws-1', draft()));
    expect(retry?.get('src/app.ts')).toBe('modified');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('returns null when the file list reports an error payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        entries: [],
        readAt: 'now',
        error: { message: 'invalid workspace', errorCode: 'INVALID' },
      }),
    } as unknown as Response);
    const loader = createFileListStatusLoader(fetchMock as unknown as typeof fetch);

    expect(await loader.load(key('ws-1', draft()))).toBeNull();
    // The failed snapshot is not cached: the next load starts a fresh request.
    await loader.load(key('ws-1', draft()));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('drops a stale response: a snapshot invalidated while pending is never cached', async () => {
    let resolveFirst!: (r: Response) => void;
    const firstFetch = new Promise<Response>((resolve) => {
      resolveFirst = resolve;
    });
    const fetchMock = vi
      .fn()
      .mockReturnValueOnce(firstFetch)
      .mockResolvedValueOnce(okResponse([{ path: 'fresh.txt', status: 'modified' }]));
    const loader = createFileListStatusLoader(fetchMock as unknown as typeof fetch);

    const pendingLoad = loader.load(key('ws-1', draft()));
    loader.invalidate(key('ws-1', draft()));
    // While the original request is pending, loads keep sharing it.
    const sharedLoad = loader.load(key('ws-1', draft()));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // The stale response settles: it may be returned to in-flight callers but
    // it is never cached, so the next load starts exactly one fresh request.
    resolveFirst(okResponse([{ path: 'stale.txt', status: 'deleted' }]));
    await Promise.all([pendingLoad, sharedLoad]);

    const fresh = await loader.load(key('ws-1', draft()));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fresh?.get('fresh.txt')).toBe('modified');
    expect(fresh?.has('stale.txt')).toBe(false);
  });
});
