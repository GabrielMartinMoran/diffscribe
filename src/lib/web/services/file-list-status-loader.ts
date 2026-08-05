import type { FileListResult } from '$lib/server/application/dto/results/file-list-results';
import type { FileChangeStatus } from '$lib/server/domain/value-objects/file-change-status';
import type { ComparisonDraft } from '$lib/web/types/comparison-draft';
import { createRequestGuard } from '$lib/web/utils/request-guard';

export type FileStatusMap = Map<string, FileChangeStatus>;

/**
 * Comparison-aware working-tree status loader shared by consumers that need
 * the `/file-list` status map by path (Quick Open badges). Caches the map per
 * workspace+comparison signature, uses a monotonic request guard so stale
 * responses never overwrite newer data, and degrades to `null` (no badges)
 * on failure or missing comparison.
 */
const cache = new Map<string, FileStatusMap>();
const requestGuard = createRequestGuard();

function cacheKey(workspaceId: string, comparisonDraft: ComparisonDraft): string {
  return [
    workspaceId,
    comparisonDraft.base.type,
    comparisonDraft.base.value,
    comparisonDraft.target.type,
    comparisonDraft.target.value,
    comparisonDraft.comparisonType,
    comparisonDraft.createdAt,
  ].join('|');
}

/**
 * Load the path→status map for the active comparison, or `null` when the
 * comparison is missing, the request fails, or a newer request superseded
 * this one. Successful maps are cached per workspace+comparison; failures
 * are not cached so a later retry can succeed.
 */
export async function loadStatusMap(
  workspaceId: string | null,
  comparisonDraft: ComparisonDraft | null,
): Promise<FileStatusMap | null> {
  if (!workspaceId || !comparisonDraft) return null;
  const key = cacheKey(workspaceId, comparisonDraft);
  const cached = cache.get(key);
  if (cached) return cached;

  const generation = requestGuard.begin();
  try {
    const comparisonParam = encodeURIComponent(JSON.stringify(comparisonDraft));
    const res = await fetch(
      `/api/workspaces/${workspaceId}/file-list?comparison=${comparisonParam}`,
    );
    if (!requestGuard.isCurrent(generation)) return null;
    const data: FileListResult = await res.json();
    if (!requestGuard.isCurrent(generation)) return null;
    if (!res.ok || data.error) return null;

    const map: FileStatusMap = new Map();
    for (const entry of data.entries) {
      map.set(entry.path, entry.status);
    }
    cache.set(key, map);
    return map;
  } catch {
    // Non-critical: consumers degrade to no badges.
    return null;
  }
}

/** Clear the status map cache (tests and workspace teardown). */
export function clearStatusCache(): void {
  cache.clear();
}
