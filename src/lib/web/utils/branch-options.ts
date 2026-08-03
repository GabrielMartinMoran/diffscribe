import type { BranchDto } from '$lib/server/application/dto/results/git-context-results';

/**
 * Pure branch grouping and fuzzy filtering for the Git ref popup (tranche C).
 *
 * The server delivers branches already ordered (Local group first, Cached
 * remote second, committer date descending within a group, canonical ref
 * tie-break). These helpers split that ordered list into the two visible
 * groups and filter both groups with a single fuzzy pass without disturbing
 * the server-side order. The canonical ref is the stable selection key so a
 * local branch and a cached remote branch with the same visible name never
 * collide; the visible label stays short (full refs are never shown).
 */

export interface BranchOption {
  /** Canonical ref used as the selection value/key (e.g. "refs/heads/dev"). */
  canonicalRef: string;
  /** Visible short label (e.g. "dev" or "origin/dev"). */
  label: string;
  /** Current branch marker — separate from the aria-selected slot value. */
  isCurrent: boolean;
  isRemote: boolean;
  remoteName?: string;
  committerDate?: string;
}

export interface BranchGroup {
  key: 'local' | 'remote';
  title: string;
  options: BranchOption[];
}

export function groupBranches(branches: readonly BranchDto[]): BranchGroup[] {
  const local: BranchOption[] = [];
  const remote: BranchOption[] = [];
  for (const b of branches) {
    const option: BranchOption = {
      canonicalRef: b.canonicalRef,
      label: b.name,
      isCurrent: b.isCurrent,
      isRemote: b.isRemote ?? false,
      ...(b.remoteName !== undefined ? { remoteName: b.remoteName } : {}),
      ...(b.committerDate !== undefined ? { committerDate: b.committerDate } : {}),
    };
    (option.isRemote ? remote : local).push(option);
  }
  const groups: BranchGroup[] = [];
  if (local.length > 0) {
    groups.push({ key: 'local', title: 'Local', options: local });
  }
  if (remote.length > 0) {
    groups.push({ key: 'remote', title: 'Cached remote', options: remote });
  }
  return groups;
}

export interface FuzzyMatch {
  score: number;
  ranges: [number, number][];
}

/**
 * Case-insensitive fuzzy subsequence match against a visible label. Exact
 * matches rank above prefixes, which rank above bare subsequences; shorter
 * spans score higher. Returns null when the query does not match. An empty
 * query matches everything.
 */
export function fuzzyMatchBranch(query: string, label: string): FuzzyMatch | null {
  const normQuery = query.toLowerCase();
  const normLabel = label.toLowerCase();
  if (normQuery.length === 0) return { score: 0, ranges: [] };

  if (normLabel === normQuery) {
    return { score: 100, ranges: [[0, label.length]] };
  }
  if (normLabel.startsWith(normQuery)) {
    return { score: 90, ranges: [[0, normQuery.length]] };
  }

  const ranges: [number, number][] = [];
  let searchFrom = 0;
  for (const ch of normQuery) {
    const idx = normLabel.indexOf(ch, searchFrom);
    if (idx < 0) return null;
    const last = ranges[ranges.length - 1];
    if (last && idx === last[1]) {
      last[1] = idx + 1;
    } else {
      ranges.push([idx, idx + 1]);
    }
    searchFrom = idx + 1;
  }
  const span = ranges[ranges.length - 1][1] - ranges[0][0];
  return { score: 80 - span * 0.5, ranges };
}

/**
 * Filters every group with the same fuzzy query. Groups without matches are
 * dropped; the remaining options keep their server-side order. An empty or
 * whitespace-only query returns the groups untouched.
 */
export function filterBranchGroups(groups: readonly BranchGroup[], query: string): BranchGroup[] {
  const trimmed = query.trim();
  if (trimmed.length === 0) return [...groups];
  const result: BranchGroup[] = [];
  for (const group of groups) {
    const filtered: BranchOption[] = [];
    for (const option of group.options) {
      if (fuzzyMatchBranch(trimmed, option.label)) {
        filtered.push(option);
      }
    }
    if (filtered.length > 0) {
      result.push({ ...group, options: filtered });
    }
  }
  return result;
}

/**
 * Finds the option whose canonical ref matches the given selection value.
 * The canonical ref disambiguates local vs cached remote branches that
 * share a visible name (e.g. "origin/main" in both groups).
 */
export function findBranchByCanonicalRef(
  groups: readonly BranchGroup[],
  canonicalRef: string,
): BranchOption | null {
  for (const group of groups) {
    for (const option of group.options) {
      if (option.canonicalRef === canonicalRef) return option;
    }
  }
  return null;
}
