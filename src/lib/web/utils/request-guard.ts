/**
 * Monotonic request-generation guard for async fetch effects.
 *
 * A fetch effect begins a request by calling `begin()` and stores the
 * returned generation. When the response arrives, `isCurrent(generation)`
 * tells whether a newer request started meanwhile; stale responses must be
 * discarded so they cannot overwrite newer tab/file content.
 */
export interface RequestGuard {
  begin(): number;
  isCurrent(generation: number): boolean;
}

export function createRequestGuard(): RequestGuard {
  let generation = 0;
  return {
    begin(): number {
      generation += 1;
      return generation;
    },
    isCurrent(g: number): boolean {
      // Generation 0 never matches: a response can only be current if a
      // request actually began (generation >= 1).
      return g !== 0 && g === generation;
    },
  };
}
