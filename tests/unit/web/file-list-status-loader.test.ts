import { beforeEach, describe, expect, it, vi } from 'vitest';

import { clearStatusCache, loadStatusMap } from '$lib/web/services/file-list-status-loader';
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

function okResponse(entries: { path: string; status: string }[]): Response {
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

describe('file-list-status-loader', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    clearStatusCache();
  });

  it('returns null without an active workspace or comparison', async () => {
    expect(await loadStatusMap(null, draft())).toBeNull();
    expect(await loadStatusMap('ws-1', null)).toBeNull();
  });

  it('builds a path-to-status map from the comparison file list', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      okResponse([
        { path: 'src/app.ts', status: 'modified' },
        { path: 'src/scratch.ts', status: 'untracked' },
      ]),
    );
    vi.stubGlobal('fetch', fetchMock);

    const map = await loadStatusMap('ws-1', draft());
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
    vi.stubGlobal('fetch', fetchMock);

    const first = await loadStatusMap('ws-1', draft());
    const second = await loadStatusMap('ws-1', draft());
    expect(first).toBe(second);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('refetches when the comparison signature changes', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(okResponse([{ path: 'src/app.ts', status: 'modified' }]));
    vi.stubGlobal('fetch', fetchMock);

    await loadStatusMap('ws-1', draft());
    await loadStatusMap('ws-1', draft({ target: { type: 'branch', value: 'dev', label: 'dev' } }));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('returns null and does not cache a failed fetch, so a retry can succeed', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(errorResponse())
      .mockResolvedValueOnce(okResponse([{ path: 'src/app.ts', status: 'modified' }]));
    vi.stubGlobal('fetch', fetchMock);

    expect(await loadStatusMap('ws-1', draft())).toBeNull();
    const retry = await loadStatusMap('ws-1', draft());
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
    vi.stubGlobal('fetch', fetchMock);

    expect(await loadStatusMap('ws-1', draft())).toBeNull();
  });

  it('drops stale responses via the request guard when a newer request started', async () => {
    let resolveFirst: (r: Response) => void = () => {};
    const first = new Promise<Response>((resolve) => {
      resolveFirst = resolve;
    });
    const fetchMock = vi
      .fn()
      .mockReturnValueOnce(first)
      .mockResolvedValueOnce(okResponse([{ path: 'src/app.ts', status: 'modified' }]));
    vi.stubGlobal('fetch', fetchMock);

    const stale = loadStatusMap('ws-1', draft({ createdAt: 'older' }));
    const fresh = loadStatusMap('ws-1', draft({ createdAt: 'newer' }));
    resolveFirst(okResponse([{ path: 'src/stale.ts', status: 'deleted' }]));

    expect(await stale).toBeNull();
    const map = await fresh;
    expect(map?.has('src/stale.ts')).toBe(false);
    expect(map?.get('src/app.ts')).toBe('modified');
  });
});
