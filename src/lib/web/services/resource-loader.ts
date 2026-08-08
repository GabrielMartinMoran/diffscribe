/**
 * Shared resource-loader contract for the web layer.
 *
 * The cache boundary for remote workspace data lives in `src/lib/web/services/`
 * as per-resource loaders — NOT in Svelte stores (UI state) and NOT in a
 * global fetch wrapper. Each resource implements this interface with its own
 * key shape, volatility and invalidation triggers; there is no universal
 * mega-cache (Rule of Three: a shared generic implementation is extracted
 * only when a third resource joins).
 *
 * Shared semantics every implementation MUST honor:
 *
 * - **Canonical key per resource.** The key identifies the resource snapshot
 *   semantically (e.g. workspace + comparison) and excludes informative
 *   metadata that would cause avoidable cache misses.
 * - **In-flight promise dedupe.** Concurrent `load(key)` calls for the same
 *   key share one request; overlapping fetches never start.
 * - **Failures never cached.** A failed load resolves to `null` and is not
 *   stored, so a later retry starts a fresh request.
 * - **Stale responses dropped.** A snapshot that was invalidated while its
 *   request was pending is never cached; the next load starts exactly one
 *   fresh request. Guards are per key: a load for one workspace never
 *   discards another workspace's request.
 * - **Pending-safe invalidation.** `invalidate(key)` keeps the in-flight
 *   promise so concurrent loads keep sharing it; once it settles, the next
 *   load refetches.
 * - **Session-memory only.** No localStorage, no IndexedDB, no TTL/SWR.
 *   Prefetching data for inactive workspaces is forbidden: the loader only
 *   caches what `load()` was explicitly asked for.
 *
 * Optional abort support is reserved in the contract but not required: an
 * implementation may accept an AbortSignal through its resource-specific
 * entry points without changing this interface.
 */
export interface ResourceLoader<TKey, TValue> {
  /** Load (or reuse the cached) value for the resource key; null on error. */
  load(key: TKey): Promise<TValue | null>;
  /**
   * Drop this resource's snapshot(s) for the key. Pending-safe (see above);
   * per-resource semantics may scope the drop wider than the exact key
   * (e.g. a file-list loader drops every comparison of a workspace).
   */
  invalidate(key: TKey): void;
  /** Drop all snapshots (workspace switch / explicit refresh). */
  clear(): void;
}
