/**
 * Pure status aggregation for the Project tree directory dots.
 *
 * Directories derive their change status from their descendants using a
 * deterministic precedence (highest wins). The rule is consumer vocabulary;
 * the domain statuses themselves are unchanged.
 */

export const STATUS_PRECEDENCE: readonly string[] = [
  'unmerged',
  'deleted',
  'modified',
  'type-changed',
  'added',
  'renamed',
  'copied',
  'untracked',
  'unknown',
];

/**
 * Aggregate a set of change statuses into the single highest-precedence
 * status. Returns null for empty input.
 */
export function aggregateStatus(statuses: Iterable<string>): string | null {
  let bestIndex = STATUS_PRECEDENCE.length;
  for (const status of statuses) {
    const index = STATUS_PRECEDENCE.indexOf(status);
    if (index === -1) continue;
    if (index < bestIndex) bestIndex = index;
  }
  return bestIndex < STATUS_PRECEDENCE.length ? STATUS_PRECEDENCE[bestIndex] : null;
}

/**
 * Collect every status in `statusMap` whose path is a descendant of
 * `nodePath` (strictly under `nodePath + '/'`). The node's own entry is
 * excluded — files keep their direct dot, directories aggregate descendants.
 */
export function descendantStatuses(
  nodePath: string,
  statusMap: ReadonlyMap<string, string>,
): string[] {
  const prefix = `${nodePath}/`;
  const result: string[] = [];
  for (const [path, status] of statusMap) {
    if (path.startsWith(prefix)) {
      result.push(status);
    }
  }
  return result;
}
