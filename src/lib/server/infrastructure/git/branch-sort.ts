/**
 * Pure TypeScript branch ordering for the Git context adapter (tranche C).
 *
 * The adapter reads local heads and cached remote refs with one combined
 * `git for-each-ref` invocation and orders them here — deterministically,
 * without relying on multiple Git `--sort` keys:
 *
 * 1. Local group first, Cached remote group second.
 * 2. Within a group, `committerDate` descending (newest first).
 * 3. Branches without a date sort last within their group.
 * 4. Equal dates (or undated ties) break by `canonicalRef` ascending.
 */

export interface BranchSortable {
  canonicalRef: string;
  isRemote?: boolean;
  /** ISO-8601 UTC committer date; omitted when unavailable. */
  committerDate?: string;
}

/**
 * Comparator implementing the ordering contract. Local (non-remote) branches
 * precede cached remote branches regardless of recency; within a group,
 * dated branches are newest-first and undated branches sort last.
 */
export function compareBranches(a: BranchSortable, b: BranchSortable): number {
  const aGroup = a.isRemote ? 1 : 0;
  const bGroup = b.isRemote ? 1 : 0;
  if (aGroup !== bGroup) return aGroup - bGroup;

  const aDate = a.committerDate;
  const bDate = b.committerDate;
  if (aDate !== undefined && bDate !== undefined) {
    const byDate = Date.parse(bDate) - Date.parse(aDate);
    if (byDate !== 0) return byDate;
  } else if (aDate !== undefined) {
    return -1;
  } else if (bDate !== undefined) {
    return 1;
  }

  return a.canonicalRef.localeCompare(b.canonicalRef);
}

/**
 * Returns a new sorted array; the input array is never mutated.
 */
export function sortBranches<T extends BranchSortable>(branches: readonly T[]): T[] {
  return [...branches].sort(compareBranches);
}
