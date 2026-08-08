import type {
  FileListEntry,
  FileListResult,
} from '$lib/server/application/dto/results/file-list-results';
import type { FileChangeStatus } from '$lib/server/domain/value-objects/file-change-status';
import type { ComparisonDraft } from '$lib/web/types/comparison-draft';

import type { ResourceLoader } from './resource-loader';

export type FileStatusMap = Map<string, FileChangeStatus>;

/**
 * Semantic key for a file-list status snapshot: the active workspace plus the
 * comparison refs. `comparisonDraft.createdAt` is deliberately NOT part of
 * the key — it is informative metadata; including it would make every new
 * draft miss the cache and refetch the same working tree.
 */
export interface FileListKey {
  workspaceId: string;
  comparison: ComparisonDraft;
}

/** Full snapshot behind one cache entry: the status map plus raw entries. */
export interface FileListSnapshot {
  map: FileStatusMap;
  entries: FileListEntry[];
}

interface CacheEntry {
  /** In-flight or settled snapshot promise for the key. */
  promise: Promise<FileListSnapshot | null>;
  /** True after `invalidate()` while the request is still pending. */
  invalidated: boolean;
  /** True while the request has not settled yet. */
  pending: boolean;
}

export interface FileListStatusLoader extends ResourceLoader<FileListKey, FileStatusMap> {
  /**
   * Load (or reuse the cached) raw file-list entries for the key. Shares the
   * exact same cache entry as `load()`: the Git context panel reads the full
   * entries (path/status/binary) while the Project tree and Quick Open read
   * the status map, all through one fetch per workspace+comparison.
   */
  loadEntries(key: FileListKey): Promise<FileListEntry[] | null>;
  /**
   * Drop every cached snapshot of the workspace (a Git mutation invalidates
   * the affected workspace's file-list cache; other workspaces are never
   * touched). Pending-safe: pending entries keep their shared promise and
   * are dropped after they settle.
   */
  invalidateWorkspace(workspaceId: string): void;
}

/**
 * Comparison-aware working-tree status loader shared by the Project tree, the
 * Git context panel and Quick Open. Implements the `ResourceLoader` contract:
 * canonical key without `createdAt`, in-flight promise dedupe, per-key stale
 * guards (one workspace never discards another's request), workspace-scoped
 * targeted invalidation, `clear()`, and failures never cached. Session-memory
 * only: the loader never loads data ahead of an explicit `load()` call, so
 * inactive workspaces are never fetched.
 */
export function createFileListStatusLoader(fetchImpl?: typeof fetch): FileListStatusLoader {
  const cache = new Map<string, CacheEntry>();

  function canonicalKey(key: FileListKey): string {
    const { comparison } = key;
    return [
      key.workspaceId,
      comparison.base.type,
      comparison.base.value,
      comparison.target.type,
      comparison.target.value,
      comparison.comparisonType,
    ].join('|');
  }

  async function loadSnapshot(key: FileListKey): Promise<FileListSnapshot | null> {
    // The fetch implementation is resolved lazily per request so the module
    // singleton always uses the current global fetch (test stubs included).
    const doFetch = fetchImpl ?? globalThis.fetch;
    try {
      const comparisonParam = encodeURIComponent(JSON.stringify(key.comparison));
      const res = await doFetch(
        `/api/workspaces/${key.workspaceId}/file-list?comparison=${comparisonParam}`,
      );
      const data: FileListResult = await res.json();
      if (!res.ok || data.error) return null;
      const map: FileStatusMap = new Map();
      for (const entry of data.entries) {
        map.set(entry.path, entry.status);
      }
      return { map, entries: data.entries };
    } catch {
      // Non-critical: consumers degrade to no badges.
      return null;
    }
  }

  function fetchEntry(key: FileListKey): CacheEntry {
    const ck = canonicalKey(key);
    const entry: CacheEntry = {
      promise: null as unknown as Promise<FileListSnapshot | null>,
      invalidated: false,
      pending: true,
    };
    entry.promise = loadSnapshot(key).then((snapshot) => {
      entry.pending = false;
      // Invalidated snapshots and failed loads are never cached: the next
      // load starts a fresh request.
      if (entry.invalidated || snapshot === null) {
        cache.delete(ck);
      }
      return snapshot;
    });
    cache.set(ck, entry);
    return entry;
  }

  return {
    load(key: FileListKey): Promise<FileStatusMap | null> {
      const ck = canonicalKey(key);
      const entry = cache.get(ck);
      if (!entry) return fetchEntry(key).promise.then((s) => s?.map ?? null);
      // A healthy cached entry (settled or in flight) is shared.
      if (!entry.invalidated) return entry.promise.then((s) => s?.map ?? null);
      // Invalidated while pending: keep sharing the in-flight request so no
      // overlapping fetch starts; after it settles, the next load refetches.
      if (entry.pending) return entry.promise.then((s) => s?.map ?? null);
      // Invalidated and settled: start exactly one fresh request.
      return fetchEntry(key).promise.then((s) => s?.map ?? null);
    },
    loadEntries(key: FileListKey): Promise<FileListEntry[] | null> {
      const ck = canonicalKey(key);
      const entry = cache.get(ck);
      if (!entry) return fetchEntry(key).promise.then((s) => s?.entries ?? null);
      if (!entry.invalidated) return entry.promise.then((s) => s?.entries ?? null);
      if (entry.pending) return entry.promise.then((s) => s?.entries ?? null);
      return fetchEntry(key).promise.then((s) => s?.entries ?? null);
    },
    invalidateWorkspace(workspaceId: string): void {
      // Targeted per-workspace invalidation: a Git mutation invalidates every
      // cached comparison of the affected workspace; other workspaces are
      // untouched. Pending-safe: a pending entry keeps its shared promise and
      // is dropped after it settles; settled entries are dropped immediately.
      const prefix = `${workspaceId}|`;
      for (const [ck, entry] of cache) {
        if (!ck.startsWith(prefix)) continue;
        entry.invalidated = true;
        if (!entry.pending) {
          cache.delete(ck);
        }
      }
    },
    invalidate(key: FileListKey): void {
      this.invalidateWorkspace(key.workspaceId);
    },
    clear(): void {
      cache.clear();
    },
  };
}

/** Application-wide loader shared by the Project tree, Git panel and Quick Open. */
export const fileListStatusLoader = createFileListStatusLoader();
