/**
 * Shared client-side loader for the workspace project tree
 * (`GET /api/workspaces/[id]/tree`).
 *
 * The Project rail and the Quick Open index consume the same tree through
 * this loader so the endpoint is fetched once per workspace. The loader is
 * web-layer only: it caches in memory, exposes a file flattening helper, and
 * never paginates (Quick Open caps consumption at 512 results).
 *
 * Invalidation is targeted and pending-safe: `invalidate(workspaceId)` drops
 * only that workspace's snapshot; while a request is still in flight the
 * promise is kept so concurrent loads keep sharing it (no overlapping
 * fetches), and the first load after it settles starts exactly one fresh
 * request. Failed loads are never cached.
 */

export interface ProjectTreeNode {
  name: string;
  path: string;
  kind: 'file' | 'directory';
  children?: ProjectTreeNode[];
  /** Present on file nodes when the server knows the tracked state. */
  tracked?: boolean;
}

export interface ProjectTreeSnapshot {
  tree: ProjectTreeNode[];
  readAt: string;
}

/** Flatten the tree into file nodes only, in tree (depth-first) order. */
export function flattenFiles(nodes: ProjectTreeNode[]): ProjectTreeNode[] {
  const files: ProjectTreeNode[] = [];
  for (const node of nodes) {
    if (node.kind === 'file') {
      files.push(node);
    } else if (node.children) {
      files.push(...flattenFiles(node.children));
    }
  }
  return files;
}

interface CacheEntry {
  /** In-flight or settled snapshot promise for the workspace. */
  promise: Promise<ProjectTreeSnapshot | null>;
  /** True after `invalidate()` while the request is still pending. */
  invalidated: boolean;
  /** True while the request has not settled yet. */
  pending: boolean;
}

export interface ProjectTreeLoader {
  /** Load (or reuse the cached) tree for a workspace; null on error. */
  load(workspaceId: string): Promise<ProjectTreeSnapshot | null>;
  /**
   * Drop the cached snapshot for one workspace (e.g. after a successful Git
   * context refresh or workspace repair). While the request is pending the
   * promise is kept so loads share it without overlapping fetches; once it
   * settles, the next load starts exactly one fresh request. Other
   * workspaces are never affected.
   */
  invalidate(workspaceId: string): void;
  /** Drop all cached snapshots (e.g. workspace switch / explicit refresh). */
  clear(): void;
}

export function createProjectTreeLoader(fetchImpl: typeof fetch = fetch): ProjectTreeLoader {
  const cache = new Map<string, CacheEntry>();

  async function loadSnapshot(workspaceId: string): Promise<ProjectTreeSnapshot | null> {
    try {
      const res = await fetchImpl(`/api/workspaces/${workspaceId}/tree`);
      const data: { tree: ProjectTreeNode[]; readAt: string; error?: { message: string } } =
        await res.json();
      if (data.error) return null;
      return { tree: data.tree, readAt: data.readAt };
    } catch {
      return null;
    }
  }

  function fetchEntry(workspaceId: string): CacheEntry {
    const entry: CacheEntry = {
      promise: null as unknown as Promise<ProjectTreeSnapshot | null>,
      invalidated: false,
      pending: true,
    };
    entry.promise = loadSnapshot(workspaceId).then((snapshot) => {
      entry.pending = false;
      // Invalidated snapshots and failed loads are never cached: the next
      // load starts a fresh request.
      if (entry.invalidated || snapshot === null) {
        cache.delete(workspaceId);
      }
      return snapshot;
    });
    cache.set(workspaceId, entry);
    return entry;
  }

  return {
    load(workspaceId: string): Promise<ProjectTreeSnapshot | null> {
      const entry = cache.get(workspaceId);
      if (!entry) return fetchEntry(workspaceId).promise;
      // A healthy cached entry (settled or in flight) is shared.
      if (!entry.invalidated) return entry.promise;
      // Invalidated while pending: keep sharing the in-flight request so no
      // overlapping fetch starts; after it settles, the next load refetches.
      if (entry.pending) return entry.promise;
      // Invalidated and settled: start exactly one fresh request.
      return fetchEntry(workspaceId).promise;
    },
    invalidate(workspaceId: string): void {
      const entry = cache.get(workspaceId);
      if (!entry) return;
      entry.invalidated = true;
      if (!entry.pending) {
        cache.delete(workspaceId);
      }
    },
    clear(): void {
      cache.clear();
    },
  };
}

/** Application-wide loader shared by the Project rail and Quick Open. */
export const projectTreeLoader = createProjectTreeLoader();
