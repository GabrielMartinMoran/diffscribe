import { describe, expect, it, vi } from 'vitest';

import {
  createProjectTreeLoader,
  flattenFiles,
  type ProjectTreeNode,
} from '$lib/web/services/project-tree-loader';

function node(
  name: string,
  path: string,
  kind: 'file' | 'directory',
  children?: ProjectTreeNode[],
): ProjectTreeNode {
  const n: ProjectTreeNode = { name, path, kind };
  if (children) n.children = children;
  return n;
}

function okResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

const treeBody = {
  tree: [
    node('src', 'src', 'directory', [
      node('app.ts', 'src/app.ts', 'file'),
      node('lib', 'src/lib', 'directory', [node('util.ts', 'src/lib/util.ts', 'file')]),
    ]),
    node('README.md', 'README.md', 'file'),
  ],
  readAt: '2026-08-02T00:00:00.000Z',
};

describe('flattenFiles', () => {
  it('returns file nodes only with their repo-relative paths', () => {
    const files = flattenFiles(treeBody.tree);
    expect(files.map((f) => f.path)).toEqual(['src/app.ts', 'src/lib/util.ts', 'README.md']);
  });

  it('returns an empty list for an empty tree', () => {
    expect(flattenFiles([])).toEqual([]);
  });
});

describe('createProjectTreeLoader', () => {
  it('fetches once per workspace and caches the result', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse(treeBody));
    const loader = createProjectTreeLoader(fetchImpl as unknown as typeof fetch);

    const first = await loader.load('ws-1');
    const second = await loader.load('ws-1');

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(first).not.toBeNull();
    expect(second).toEqual(first);
    expect(fetchImpl.mock.calls[0][0]).toContain('/api/workspaces/ws-1/tree');
  });

  it('keeps separate caches per workspace', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse(treeBody));
    const loader = createProjectTreeLoader(fetchImpl as unknown as typeof fetch);

    await loader.load('ws-1');
    await loader.load('ws-2');

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[1][0]).toContain('/api/workspaces/ws-2/tree');
  });

  it('exposes tracked and untracked file information when present', async () => {
    const withTracking = {
      tree: [
        node('src', 'src', 'directory', [
          node('app.ts', 'src/app.ts', 'file', undefined),
          { name: 'scratch.ts', path: 'src/scratch.ts', kind: 'file', tracked: false },
        ]),
      ],
      readAt: '2026-08-02T00:00:00.000Z',
    };
    const fetchImpl = vi.fn().mockResolvedValue(okResponse(withTracking));
    const loader = createProjectTreeLoader(fetchImpl as unknown as typeof fetch);

    const result = await loader.load('ws-1');
    const files = flattenFiles(result!.tree);
    expect(files.find((f) => f.path === 'src/scratch.ts')?.tracked).toBe(false);
    expect(files.find((f) => f.path === 'src/app.ts')?.tracked).toBeUndefined();
  });

  it('returns null and does not cache when the server reports an error', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        okResponse({ tree: [], readAt: '', error: { message: 'boom', errorCode: 'X' } }),
      );
    const loader = createProjectTreeLoader(fetchImpl as unknown as typeof fetch);

    expect(await loader.load('ws-1')).toBeNull();
    // A later retry refetches instead of replaying the failed snapshot.
    await loader.load('ws-1');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('returns null when the fetch rejects', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network down'));
    const loader = createProjectTreeLoader(fetchImpl as unknown as typeof fetch);

    expect(await loader.load('ws-1')).toBeNull();
  });

  it('clear() invalidates the cache for the next load', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse(treeBody));
    const loader = createProjectTreeLoader(fetchImpl as unknown as typeof fetch);

    await loader.load('ws-1');
    loader.clear();
    await loader.load('ws-1');

    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('invalidate() drops only the targeted workspace cache', async () => {
    const fetchImpl = vi.fn().mockImplementation(() => Promise.resolve(okResponse(treeBody)));
    const loader = createProjectTreeLoader(fetchImpl as unknown as typeof fetch);

    await loader.load('ws-1');
    await loader.load('ws-2');
    loader.invalidate('ws-1');
    await loader.load('ws-1');
    await loader.load('ws-2');

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    const urls = fetchImpl.mock.calls.map((c) => String(c[0]));
    expect(urls.filter((u) => u.includes('/ws-1/tree'))).toHaveLength(2);
    expect(urls.filter((u) => u.includes('/ws-2/tree'))).toHaveLength(1);
  });

  it('invalidate() for an unknown workspace is a no-op', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse(treeBody));
    const loader = createProjectTreeLoader(fetchImpl as unknown as typeof fetch);

    loader.invalidate('ws-nope');

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('concurrent loads share a single in-flight request', async () => {
    let resolveFirst!: (r: Response) => void;
    const firstFetch = new Promise<Response>((resolve) => {
      resolveFirst = resolve;
    });
    const fetchImpl = vi
      .fn()
      .mockReturnValueOnce(firstFetch)
      .mockResolvedValue(okResponse(treeBody));
    const loader = createProjectTreeLoader(fetchImpl as unknown as typeof fetch);

    const first = loader.load('ws-1');
    const second = loader.load('ws-1');
    resolveFirst(okResponse(treeBody));
    const [firstResult, secondResult] = await Promise.all([first, second]);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(firstResult).toEqual(secondResult);
  });

  it('invalidate() while a request is pending shares it and refetches once after it settles', async () => {
    let resolveFirst!: (r: Response) => void;
    const firstFetch = new Promise<Response>((resolve) => {
      resolveFirst = resolve;
    });
    const fetchImpl = vi
      .fn()
      .mockReturnValueOnce(firstFetch)
      .mockResolvedValue(okResponse(treeBody));
    const loader = createProjectTreeLoader(fetchImpl as unknown as typeof fetch);

    const pendingLoad = loader.load('ws-1');
    loader.invalidate('ws-1');
    // While the original request is still pending, loads share it: the
    // invalidation must not create overlapping fetches.
    const sharedLoad = loader.load('ws-1');
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    resolveFirst(okResponse(treeBody));
    await Promise.all([pendingLoad, sharedLoad]);

    // After the pending request settles, the next load starts exactly one
    // fresh request, and subsequent loads share it.
    const freshFirst = await loader.load('ws-1');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const freshSecond = await loader.load('ws-1');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(freshFirst).toEqual(freshSecond);
  });

  it('failed loads after invalidation remain uncached', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(okResponse(treeBody))
      .mockResolvedValueOnce(okResponse({ tree: [], readAt: '', error: { message: 'boom' } }))
      .mockResolvedValueOnce(okResponse(treeBody));
    const loader = createProjectTreeLoader(fetchImpl as unknown as typeof fetch);

    await loader.load('ws-1');
    loader.invalidate('ws-1');
    expect(await loader.load('ws-1')).toBeNull();
    await loader.load('ws-1');

    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
});
