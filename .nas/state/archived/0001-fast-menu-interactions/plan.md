<!-- prettier-ignore-start -->

# 0001-fast-menu-interactions — Implementation Plan

> **Status**: APPROVED — implementation authorized
> **Date**: 2026-08-05 (rev. 2 — frontend API flow research integrated)
> **Mode**: full
> **Complexity**: complex | **Magnitude**: high
> **Risk flags**: `Architectural change` (cache/refresh/invalidation), `Ambiguous classification` (no reproducible runtime measurements yet)
> **Gherkin persistence**: `gherkin.persist_to_repo.when = on_done` — the `.feature` file is NOT written during planning. The canonical Gherkin lives in this plan. After explicit user approval, the `nas_planner` persists `specs/features/product/fast-menu-interactions.feature` using its `permission.edit` `*.feature` allowlist before `nas_developer` starts (the Orchestrator coordinates but never writes files outside `.nas`).

---

## 1. Goal

Make opening and closing menus and side panels feel fast by (a) measuring the
real baseline first, (b) removing confirmed duplicate work, (c) sharing and
scoping data loads per active workspace through a per-resource loader layer in
`web/services` with targeted invalidation, and (d) replacing broad
`invalidateAll()` calls only where a safe SvelteKit invalidation contract
exists. No product behavior is changed before a baseline exists.

## 2. Research summary (validated against source)

Three independent research passes exhausted internal sources, memory, Context7
docs, and skills. A fourth pass (rev. 2) mapped the full frontend API flow. The
planner re-validated every claim against the code:

| Finding | Evidence (validated) | Status |
|---|---|---|
| Overflow menu is pure local UI, no API | `src/lib/web/components/ui/Menu.svelte` — local state, portal, rAF positioning, focus; zero `fetch` | CONFIRMED |
| `/reviews` double load | `src/lib/web/components/review-panel.svelte` — `loadReviewList()` called in click handler (line 340) AND in `$effect` (lines 217–221) | CONFIRMED |
| `/file-list` has 3 independent consumers, no in-flight dedupe, no targeted invalidation | `project-tree.svelte` (own fetch, lines 78–98), `git-context-panel.svelte` (own fetch, lines 93–121), `quick-open-dialog.svelte` (via `loadStatusMap`); loader caches per workspace+comparison incl. `createdAt` (line 26), no promise dedupe, module-global guard | CONFIRMED |
| `project-tree-loader.ts` is the reference pattern (in-flight dedupe + targeted invalidate) | `src/lib/web/services/project-tree-loader.ts` — per-workspace cache, shared promise, pending-safe invalidate, failures never cached | CONFIRMED |
| SSR load uses use cases; no HTTP fetch/cache/ETag/`depends()` | `src/routes/+page.server.ts` — `listUseCase`, `getUseCase`, `getGitContextUseCase`, `getReviewUseCase`; zero `fetch`, zero `depends('app:…')` | CONFIRMED |
| Subsequent loads are direct component fetches | 8 components fetch `/api/workspaces/...` directly: `project-tree.svelte`, `quick-open-dialog.svelte`, `git-context-panel.svelte`, `review-panel.svelte`, `observation-panel.svelte`, `source-viewer.svelte`, `diff-viewer.svelte`, `complete-diff-viewer.svelte` | CONFIRMED |
| `observation-store.ts` holds state, does not centralize fetches | `src/lib/web/stores/observation-store.ts` — writable stores only | CONFIRMED |
| `request-guard.ts` prevents stale overwrites, does not cancel | `src/lib/web/utils/request-guard.ts` — monotonic generation guard; no AbortController anywhere in load paths | CONFIRMED |
| `invalidateAll()` used in 5+ places; no resource contract | `+page.svelte` (195), `observation-panel.svelte` (98, 130), `git-context-panel.svelte` (257), `open-workspace-form.svelte` (58), `delete-confirm-dialog.svelte` (34); register/delete invalidate explicitly; rename/repair use custom callbacks (`workspace-nav-item.svelte` line 44 → `projectTreeLoader.invalidate`) | CONFIRMED |
| No persistent cache (localStorage/IndexedDB) nor central cache library | `src/lib/web/services/` contains only `project-tree-loader.ts`, `quick-open-scorer.ts`, `file-list-status-loader.ts` | CONFIRMED |
| No reproducible runtime measurements | Browser MCP disconnected; prior traces mix Playwright/dev-server overhead | GAP → Phase 1 baseline |

**Gate**: research sufficiency PASS with one explicit gap — no quantitative
cold/warm/production measurements. Per the gate, this gap is NOT treated as a
confirmed cause; it becomes Phase 1 (instrumentation + baseline).

## 3. Current frontend API flow and cache boundary

Validated research pass (rev. 2): how the frontend talks to the API today,
where caching already exists, and where the cache boundary must live.

### 3.1 Flow today

1. **Initial data — SSR via use cases.** `src/routes/+page.server.ts` resolves
   `workspaces`, `activeWorkspaceId`, `gitContext`, and `activeReview` through
   server-side use cases. There is no HTTP `fetch` in the load, no HTTP cache,
   no ETag/Cache-Control, and no `depends('app:…')` declaration. Values arrive
   as page `data` props consumed by the shell components (seed data).
2. **Subsequent data — direct `fetch` from web components.** Every later load
   is a client-side `fetch` to a `/api/workspaces/...` endpoint issued by the
   component that needs it (see table below). No shared fetch layer exists.
3. **Two existing partial loaders in `web/services`.** `project-tree-loader.ts`
   is the reference pattern (per-workspace cache, in-flight promise dedupe,
   targeted `invalidate(workspaceId)`, pending-safe, failures never cached).
   `file-list-status-loader.ts` is a partial pattern: caches per
   workspace+comparison but includes `createdAt` in the key, does NOT share
   in-flight promises, its monotonic guard is module-global (a load for
   workspace A discards an in-flight load for workspace B), and its only
   invalidation is a global `clearStatusCache()`.
4. **Stores hold UI state, not data fetching.** `observation-store.ts` and the
   other `web/stores/*` modules keep component state; they do not centralize
   fetches.
5. **`request-guard.ts` protects against stale overwrites only.** Monotonic
   generation guard; no request cancellation, no AbortController wiring.
6. **`invalidateAll()` is the only broad refresh** and re-runs the full page
   load. `depends()`/`invalidate()` are not wired as a resource contract in
   `+page.server.ts`. Form actions `register`/`delete` invalidate explicitly;
   `rename`/`repair` use custom callbacks (e.g. `projectTreeLoader.invalidate`)
   and need a refresh contract + test.
7. **No persistent cache.** No localStorage/IndexedDB cache, no central cache
   library.

### 3.2 Resource ownership table (today)

| Resource | Origin (today) | Consumers | Cache owner (today) | Invalidation owner (today) |
|---|---|---|---|---|
| Workspace list + active id | `+page.server.ts` SSR (use cases) | shell, rail, forms | SSR `data` props | `invalidateAll()` after register/delete/select |
| Git context (`git-context`) | SSR seed; `git-context-panel.svelte` retry fetch (line 224) | `git-context-panel.svelte` | SSR `data` props (no client cache) | `invalidateAll()` after mutations; retry refetch |
| Active review | `+page.server.ts` SSR | `review-panel.svelte`, `observation-panel.svelte` | SSR `data` props | `invalidateAll()` via `handleReviewChange` |
| Reviews list (`/reviews`) | `review-panel.svelte` (click line 340 + `$effect` 217–221 → double load) | `review-panel.svelte` | none (component state) | `invalidateAll()` via `handleReviewChange` |
| Project tree (`/tree`) | `project-tree-loader.ts` (from `project-tree.svelte`, `quick-open-dialog.svelte`) | Project rail, Quick Open index | `project-tree-loader.ts` — per workspace, dedupe, stale-safe | `projectTreeLoader.invalidate(ws)` in rename/repair/refresh callbacks; `clear()` |
| File-list status map (`/file-list?comparison=…`) | `project-tree.svelte` (own fetch), `git-context-panel.svelte` (own fetch), `quick-open-dialog.svelte` (via `loadStatusMap`) | Project rail badges, Git context entries, Quick Open badges | `file-list-status-loader.ts` — per ws+comparison incl. `createdAt`; no dedupe; guard not per-key | `clearStatusCache()` only (global); mutations rely on `invalidateAll()` |
| Observations (`/reviews/[id]/observations`) | `observation-panel.svelte` | `observation-panel.svelte` | none (component state) | optimistic updates + `invalidateAll()` after create/delete |
| Review mutations (`POST /reviews`, `complete`, `set-active`, `mark-file`, `unmark-file`) | `review-panel.svelte` | — | never cached | `onReviewChange` → `invalidateAll()` |
| Observation mutations (`POST/DELETE`, `status`) | `observation-panel.svelte`, `observation-form.svelte` | — | never cached | optimistic updates + `invalidateAll()` |
| Source (`/source?comparison=…&path=…`) | `source-viewer.svelte` | `source-viewer.svelte` | none; per-component guard | navigation refetch (guard) |
| File diff (`/file-diff?comparison=…&path=…`) | `diff-viewer.svelte` | `diff-viewer.svelte` | none; per-component guard | navigation refetch (guard) |
| Complete diff (`/complete-diff?comparison=…`) | `complete-diff-viewer.svelte` | `complete-diff-viewer.svelte` | none; per-component guard | comparison change refetch (guard) |

### 3.3 Cache boundary decision (explicit)

- **There is no single API service today.** The correct home for the first
  iteration is a **`web/services` layer of resource loaders** — NOT a global
  `fetch` wrapper and NOT the Svelte stores. Stores keep UI state (rail, panel,
  layout, selection); loaders own data freshness.
- **Centralize per resource** behind a common interface (load/get, invalidate
  by workspace/resource, clear, in-flight dedupe, stale guard, optional abort),
  implemented by each resource separately. **No universal mega-cache**: resources
  differ in key shape, volatility, and invalidation triggers.
- **Seed from SSR data.** Data already delivered by `+page.server.ts`
  (workspaces, git context, active review) is the initial source of truth;
  loaders and components must not immediately refetch what the server provided.
- **Scope of the cache: active workspace + comparison/resource.** Never
  prefetch data for inactive workspaces.
- **TTL/SWR is NOT adopted yet.** First phase = in-memory session cache +
  targeted invalidation. TTL/SWR only after the runtime baseline and an
  explicit user decision, per the gate in §4.
- **Never cache blindly:** mutations, errors, highly volatile data, and
  resources that must reflect Git immediately stay out of the cache.
- **Data cache ≠ UI state.** Do not move rail/panel/layout state into the data
  cache, and do not push all data into Svelte stores.
- **Server-side cache** (DB/Git/SSR level) remains a future option only if the
  baseline proves server-side work dominates; it requires a new contract.

### 3.4 Target ownership after this feature (Stage 1)

- **File-list status map** → `fileListStatusLoader` implementing the common
  `ResourceLoader` interface (cache owner). Invalidation owner: git-context
  refresh, workspace rename/repair, and any mutation that touches the working
  tree → callers invoke `invalidate(workspaceId)`.
- **Project tree** → `projectTreeLoader` conforming to the same interface;
  semantics unchanged.
- **Reviews list** → no cache in Stage 1 (single consumer, per-open load);
  the double load is removed in Phase 2; invalidation via `handleReviewChange`
  (targeted `invalidate('app:active-review')` where the contract exists, else
  `invalidateAll`).
- **Workspaces / git context / active review** → SSR seed; no client cache;
  invalidation via `invalidate('app:…')` only where `depends()` is declared
  (Phase 4), else `invalidateAll`.
- **Observations / source / diff / complete-diff** → unchanged (guarded direct
  fetches); NOT migrated unless the baseline justifies it (out of scope).

## 4. TTL/SWR decision gate

Session cache + targeted invalidation is the default. TTL/SWR
(time-to-live / stale-while-revalidate with background refresh) is a **gated**
upgrade:

**Approval criteria (ALL required):**
1. Phase 1 baseline shows a measurable, user-visible stale-data cost: the same
   resource is re-fetched repeatedly by the user within a short window, and
   that repeat fetch dominates interaction latency (e.g. p95 settled time).
2. The user explicitly approves adopting TTL/SWR for specific resources.
3. A written stale-data policy exists per resource: max age, what "stale" means
   for Git data, background refresh behavior, in-flight dedupe, and
   backoff/error handling on refresh failure.
4. TTL is configured per resource (never a global TTL).
5. Mutations always invalidate immediately — TTL never delays showing fresh
   Git data after a mutation.
6. New Gherkin scenarios + tests are added for: stale-window behavior, refresh
   failure handling, and mutation-vs-TTL interplay.

**Rejection criteria (any suffices):**
- Baseline shows the dominant cost is elsewhere (SSR/Git server time, DB, first
  paint, animation) — TTL/SWR would not move the metric that matters.
- Session cache + targeted invalidation already meets the approved budgets.
- The stale-data risk for Git state outweighs the latency gain (e.g. file
  statuses must reflect the working tree immediately).
- The user declines the policy or the additional complexity.

**Process:** baseline (Phase 1) → if the criteria look satisfiable, propose a
concrete policy for user decision (§14) → only then implement in a new phase
with its own contract. Without the gate, this plan ships session cache only.

## 5. Scope

### In scope

1. **Phase 1 — Instrumentation, contract, baseline** (no product behavior change):
   - Canonical Gherkin contract (in this document; persisted on approval).
   - BDD step definitions (static contract pins, repo convention).
   - E2E timing/request harness (marks, long tasks, resource timing, request
     counting, page errors).
   - Baseline measurement: dev warm, dev cold, production (adapter-node).
2. **Phase 2 — Quick wins** (minimal behavior change):
   - Eliminate the double `/reviews` load.
   - Guarantee shell + focus feedback before remote data for Quick Open and
     panels; never block a local open on a fetch.
   - Add guard/abort to `observation-panel` loads.
3. **Phase 3 — Shared loader contract + workspace-scoped cache for `/file-list`**:
   - Common `ResourceLoader` interface in `web/services` (contract only).
   - Canonical semantic cache key (workspace + comparison, WITHOUT `createdAt`).
   - In-flight promise dedupe; per-key stale guard; targeted per-workspace
     invalidation; `clear()`.
   - Session cache + targeted invalidation first; TTL/SWR only if the gate (§4)
     is passed (explicit user decision).
   - Abort/cancellation where it adds value; stale responses dropped.
   - All three `/file-list` consumers share one loader.
   - SSR seed preserved: server-delivered props are not refetched on first
     render (regression pin).
   - **Prohibited**: prefetch of non-active workspaces.
4. **Phase 4 — Targeted invalidation**:
   - Replace `invalidateAll()` with `invalidate('app:…')` only where a safe
     `depends()` contract exists in `+page.server.ts`.
   - Refresh contract + test for rename/repair (loader-level targeted
     invalidation of the affected workspace).
   - No server-side load restructuring without new scenarios.
5. **Phase 5 — Full QA validation** and post-change re-measurement.

### Out of scope (explicit)

- HMR tooling / dev-server cold-start fixes (historical amplification, not a
  production cause; measured separately in baseline).
- Server-side load waterfall restructuring (`+page.server.ts` sequential Git
  work) unless baseline proves it dominant — then a new contract is required.
- Animation timing changes (mobile 150/250 ms, Menu rAF) unless measured as
  dominant.
- TTL/SWR adoption before the §4 gate is passed.
- A global `fetch` wrapper or HTTP-level cache layer (no interception of every
  request).
- A universal mega-cache across resources; only per-resource loaders.
- Persistent cache (localStorage/IndexedDB); session-memory only.
- Server-side response cache (DB/Git/SSR level) — future option only if
  baseline proves it dominant; requires a new contract.
- Migrating observations/source/diff/complete-diff to loaders unless baseline
  justifies it; they keep guarded direct fetches.
- Any Stage 2–4 feature (AI, collaboration, network, auto-fix, code
  modification, commits).
- Changing `/file-list` server endpoint semantics or the domain treatment of
  `comparisonDraft.createdAt` (the key fix is loader-side).
- Prefetching data for non-active workspaces.

## 6. Key decisions

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | Measure first, change later. Phase 1 ships no product behavior change. | The research gate explicitly lacks reproducible measurements; changing behavior before a baseline makes impact unprovable. |
| D2 | Start with session cache + targeted invalidation; adopt TTL/SWR only via the §4 gate (baseline + explicit user policy). | TTL/SWR can show stale Git data and requires an explicit invalidation policy; session cache + targeted invalidation is the minimal correct step. |
| D3 | `/file-list` cache key drops `createdAt` (semantic comparison key). | `createdAt` is informative per the domain; including it makes every new draft miss the cache and refetch. |
| D4 | Follow the `project-tree-loader.ts` pattern for the new file-list loader (promise dedupe + per-workspace invalidation + `clear()`). | Already proven in-repo, pending-safe, and testable. |
| D5 | Replace `invalidateAll()` only where a `depends()` contract exists; keep it elsewhere. | SvelteKit contract: `invalidate('app:x')` re-runs only loads that declared `depends('app:x')`. Replacing without the contract would drop data. |
| D6 | Budgets are set AFTER baseline as explicit user decisions, not arbitrary thresholds. | No arbitrary thresholds per research gate. |
| D7 | BDD steps follow the repo convention: static contract pins (`requireMarker`) + behavior verified at unit/integration/E2E layers. | Matches `workspace-actions-overflow.steps.ts` / `quick-open.steps.ts` pattern. |
| D8 | The cache boundary is the `web/services` loader layer, per resource. No global fetch wrapper, no mega-cache; stores stay UI state. | Rev. 2 research confirmed loads are direct component fetches with only two partial loaders; a per-resource contract is testable and matches the proven project-tree pattern. |
| D9 | Server-seeded SSR props (workspaces, git context, active review) are the initial source of truth; no immediate refetch of what `+page.server.ts` delivered. | Avoids duplicate network work on first render; keeps the SSR contract intact. |
| D10 | A common `ResourceLoader` interface (load / invalidate / clear / dedupe / stale guard / optional abort) is defined once; each resource implements it. A shared generic implementation is extracted only when a third resource joins (Rule of Three). | Interface = contract; implementation = per-resource semantics; avoids premature abstraction (YAGNI). |
| D11 | TTL/SWR is gated behind §4: baseline evidence + explicit user policy + per-resource TTL + mutation priority. | Prevents stale Git data and unmeasurable complexity before evidence exists. |

## 7. Impacted files / contracts

### New files
- `specs/features/product/fast-menu-interactions.feature` — CREATED by `nas_planner` after approval (`on_done`), as the first contract artifact before developer execution.
- `tests/steps/fast-menu-interactions.steps.ts` — BDD static contract pins.
- `tests/e2e/helpers/performance-timing.ts` — marks/measures, long-task + resource observers.
- `tests/e2e/helpers/request-tracking.ts` — per-interaction request counting + page errors.
- `tests/e2e/fast-menu-baseline.spec.ts` — baseline measurement (dev warm/cold + production).
- `tests/e2e/fast-menu-interactions.spec.ts` — behavioral E2E (menu no-API, shell-before-data, single fetch).
- `tests/integration/web/fast-menu-interactions.test.ts` — cross-consumer dedupe, workspace scoping, SSR seed, and invalidation contract.
- `src/lib/web/services/resource-loader.ts` — common `ResourceLoader<TKey, TValue>` interface + contract documentation (Phase 3).
- `tests/unit/web/file-list-status-loader.test.ts` — REWRITTEN (new semantics) or split into `file-list-status-loader-cache.test.ts`.

### Modified files
| File | Phase | Change |
|---|---|---|
| `vitest.bdd.config.ts` | 1 | register `tests/steps/fast-menu-interactions.steps.ts` in `setupFiles` |
| `tests/e2e/helpers/worker-server.ts` | 1 | support production override (`vite preview` / node build) for baseline |
| `tests/integration/e2e-helpers/worker-server.test.ts` | 1 | verify production worker-server override |
| `src/lib/web/components/review-panel.svelte` | 2, 4 | single `/reviews` load; targeted invalidation |
| `src/lib/web/components/quick-open-dialog.svelte` | 2, 3 | shell/focus before data; use shared loader; expose stable `data-testid="quick-open-filter"` on the filter input for E2E targeting |
| `tests/e2e/quick-open.spec.ts` | 2 / regression fix | use a stable `data-testid="quick-open-filter"` locator for the Quick Open filter input; do not use an ambiguous bare `getByRole('combobox')` |
| `src/lib/web/components/observation-panel.svelte` | 2, 4 | guard/abort on load; targeted invalidation |
| `src/lib/web/services/file-list-status-loader.ts` | 3 | REWRITE: implement `ResourceLoader`; canonical key without `createdAt`; in-flight dedupe; per-key guard; targeted invalidation; `clear()` |
| `src/lib/web/services/project-tree-loader.ts` | 3 | conform to the `ResourceLoader` interface (type-level; semantics unchanged) |
| `src/lib/web/components/project-tree.svelte` | 3 | use shared loader for status map |
| `src/lib/web/components/git-context-panel.svelte` | 3, 4 | use shared loader; targeted invalidation |
| `src/lib/web/components/workspace-nav-item.svelte` | 4 | rename/repair refresh contract (targeted loader invalidation) |
| `src/routes/+page.server.ts` | 4 | declare `depends('app:…')` keys |
| `src/routes/+page.svelte` | 4 | targeted invalidation in `handleReviewChange` |
| `src/lib/web/components/open-workspace-form.svelte` | 4 | targeted invalidation (if safe) |
| `src/lib/web/components/delete-confirm-dialog.svelte` | 4 | targeted invalidation (if safe) |
| `docs/architecture.md` | 5 | web-layer loader/cache boundary |
| `docs/changelog.md` | 5 | release note |
| `docs/PRD.md` | 5 | only if budgets become product decisions |

### Loader contract (Phase 3)

```ts
// src/lib/web/services/resource-loader.ts
export interface ResourceLoader<TKey, TValue> {
  /** Load (or reuse the cached) value for the resource key; null on error. */
  load(key: TKey): Promise<TValue | null>;
  /** Drop only this resource's snapshot; pending-safe (mirror project-tree-loader). */
  invalidate(key: TKey): void;
  /** Drop all snapshots. */
  clear(): void;
}
```

Shared semantics (contract): canonical key per resource; in-flight promises
shared per key; failures never cached; stale responses dropped via a per-key
monotonic guard; `invalidate()` pending-safe; optional abort support reserved
in the contract but NOT wired in Phase 3 (no AbortController exists today).

File-list specifics:
- Key = `workspaceId | base.type | base.value | target.type | target.value | comparisonType` (NO `createdAt`).
- `load(workspaceId, comparison)` returns `Promise<FileStatusMap | null>`.
- Exposed as a module-level singleton `fileListStatusLoader` implementing
  `ResourceLoader<FileListKey, FileStatusMap>`.

Seed rule: consumers keep SSR `data` props (gitContext, activeReview,
workspaces) as initial values; loaders fetch only what the server did not
deliver; a regression pin (integration/E2E) asserts no immediate refetch.

### SvelteKit invalidation keys (Phase 4)
- `app:workspaces` — workspace list + active id (declared in `+page.server.ts`).
- `app:git-context` — git context for the active workspace.
- `app:active-review` — active review + review list.
Callers use `invalidate('app:…')` from `$app/navigation`; `invalidateAll()` remains only where no safe contract exists.

## 8. Canonical Gherkin (persisted only after approval)

```gherkin
  @feat-fast-menu-interactions @product @performance @etapa-1
Feature: Fast menu and panel interactions

  Opening and closing menus and side panels must feel fast. The overflow menu
  is pure local UI and must never wait on an API. Panels and dialogs that load
  remote data must show their shell and focus feedback first, then render data
  asynchronously. Data is fetched once per workspace and comparison, shared
  across consumers, invalidated when Git state changes, seeded from the server
  page load, and never prefetched for non-active workspaces.

  Background:
    Given the app shell is present
    And a workspace is registered and active

  @delta-added @product @performance @p1 @e2e
  Scenario: The overflow menu opens without any API request
    Given the workspace overflow menu trigger is visible
    When the user activates the workspace overflow menu trigger
    Then the overflow menu becomes visible
    And no API request is issued while the menu opens

  @delta-added @product @performance @p1 @e2e
  Scenario: Quick Open shows its shell and focus before the tree data arrives
    Given the Project tree data is not yet loaded for the workspace
    When the user presses Ctrl+P
    Then a Quick Open dialog opens
    And the filter input has focus
    When the tree data arrives
    Then the tree results appear in the dialog

  @delta-added @product @performance @p1 @e2e
  Scenario: The review list is fetched at most once per open
    Given the review panel shows the review list
    When the user opens the review list
    Then the review list is fetched exactly once
    And the review list shows the reviews

  @delta-added @product @performance @p1 @integration
  Scenario: The file-list status map is fetched once per workspace and comparison
    Given the Project tree, the Git context panel, and Quick Open are mounted
    When the same workspace and comparison are active
    Then the file-list status endpoint is requested once
    And all three consumers share the same status map

  @delta-added @product @performance @p1 @integration
  Scenario: The file-list cache is scoped to the active workspace
    Given workspace A and workspace B are registered
    When the user switches from workspace A to workspace B
    Then loading workspace B never reuses workspace A cached statuses
    And workspace A data is not prefetched while workspace B is active

  @delta-added @product @performance @p1 @integration
  Scenario: A Git mutation invalidates the affected workspace cache
    Given the file-list status map is cached for the active workspace
    When the user refreshes the Git context
    Then the cached status map for the active workspace is invalidated
    And the next load fetches the fresh status map once

  @delta-added @product @performance @p1 @integration
  Scenario: A stale response never overwrites a newer one
    Given a file-list request is in flight for the active workspace
    When a newer request starts for the same workspace
    Then the stale response is discarded

  @delta-added @product @performance @p1 @unit
  Scenario: A failed load is not cached and can be retried
    Given the file-list endpoint fails
    When the user retries the load
    Then the retry succeeds and the status map is cached

  @delta-added @product @performance @p1 @integration
  Scenario: Server-seeded data is not refetched on first render
    Given the page load delivered workspaces, git context, and the active review
    When the app shell renders with an active workspace
    Then no request re-fetches the workspace list, git context, or active review
    And the shell consumes the server-seeded values

  @delta-added @product @performance @p1 @e2e
  Scenario: Interaction latency is measured in dev and production
    Given the app runs in a measured environment
    When the user opens the overflow menu, Quick Open, and the review list
    Then the report records shell, focus, first content, and settled times
    And the report records request counts, long tasks, and page errors
```

## 9. Measurement plan

### Metrics (per interaction)
| Metric | Definition |
|--------|-----------|
| `trigger→shell visible` | ms from activation to the panel/menu element visible in the DOM |
| `trigger→interactive/focus` | ms from activation to focus landing (menu first item, dialog input) |
| `trigger→first useful content` | ms from activation to first data-driven content rendered |
| `trigger→settled` | ms from activation until no pending API requests and no long tasks |
| request count | number of `/api/…` requests issued by the interaction |
| long tasks | count of `longtask` entries during the interaction |
| stale responses | count of responses discarded by guards (instrumented in Phase 3) |
| page errors | count of `pageerror` events during the interaction |

### Environments
- **Dev warm**: `npm run dev` after the initial page load (worker-server).
- **Dev cold**: fresh dev server + first load.
- **Production**: `npm run build` + adapter-node server (or `vite preview`), via `worker-server.ts` override.

### Budgets
No arbitrary thresholds. Phase 1 records the baseline. After the baseline,
budgets (e.g., shell ≤ 100 ms, focus ≤ 150 ms, first content ≤ 500 ms,
settled ≤ 1000 ms) are proposed as an explicit user decision and recorded in
`docs/PRD.md` only if approved.

### Report
`tests/fast-menu-baseline.md` (generated artifact) — table of metrics per
interaction per environment, plus request counts. Re-run after Phase 4 to
prove the delta.

## 10. Phased implementation (TDD)

### Phase 1 — Instrumentation, contracts, baseline (no product behavior change)
**Objective**: reproducible measurements + contract before any behavior change.
**Tasks**:
1.1. Create `tests/e2e/helpers/performance-timing.ts` (marks/measures, longtask + resource observers). Verify: smoke spec runs, metrics recorded.
1.2. Create `tests/e2e/helpers/request-tracking.ts` (request counting, page errors). Verify: smoke spec counts requests.
1.3. Create `tests/e2e/fast-menu-baseline.spec.ts` — measures the 4 metrics + counts for: overflow menu, Quick Open, rail switch, right panel, review list. Run: `npm run test:e2e -- fast-menu-baseline`.
1.4. Extend `tests/e2e/helpers/worker-server.ts` with a production override (`vite preview` / node build) for the production baseline.
1.5. Capture baseline (dev warm, dev cold, production) → `tests/fast-menu-baseline.md`.
1.6. Create `tests/steps/fast-menu-interactions.steps.ts` (static contract pins per repo convention) and register it in `vitest.bdd.config.ts` `setupFiles`.
1.7. Draft the canonical Gherkin (above) — persisted only after approval.
**Exit criteria**: baseline report exists; no product code changed; `npm run qa` passes.

### Phase 2 — Quick wins (minimal behavior)
**Objective**: remove confirmed duplicate work; guarantee shell/focus feedback.
**Tasks**:
2.1. RED: E2E — opening the review list issues exactly one `/reviews` request (fails: 2). GREEN: `review-panel.svelte` — single load path (keep `$effect`, drop the click-handler call; keep `loading` state). REF: keep guards.
2.2. RED: E2E — Quick Open dialog visible + input focused before tree data resolves (delay `/tree`; assert shell first). GREEN: verify/ensure shell+focus are not blocked by data load in `quick-open-dialog.svelte`.
2.3. RED: unit/integration — `observation-panel.svelte` load has a guard/AbortController (currently missing). GREEN: add monotonic guard + abort on unmount.
2.4. Run `npm run qa`.
**Exit criteria**: double `/reviews` gone; shell/focus verified; guards in place.

### Phase 3 — Shared loader contract + workspace-scoped cache for `/file-list`
**Objective**: common `ResourceLoader` interface in `web/services`; `/file-list`
rewritten per contract (canonical key, in-flight dedupe, per-key guard, targeted
invalidation); three consumers share one loader; SSR seeding preserved; no TTL
unless the §4 gate passes.
**Tasks**:
3.1. RED: rewrite `tests/unit/web/file-list-status-loader.test.ts` for new semantics — canonical key without `createdAt`; in-flight dedupe (2 concurrent loads → 1 fetch); per-key guard isolation (loads for different workspaces do not discard each other); targeted `invalidate(workspaceId)`; `clear()`; failures not cached; stale dropped.
3.2. GREEN: create `src/lib/web/services/resource-loader.ts` (interface + contract doc, D10) and rewrite `src/lib/web/services/file-list-status-loader.ts` per the contract (D3, D4) with a module-level `fileListStatusLoader` singleton.
3.3. GREEN: align `src/lib/web/services/project-tree-loader.ts` to conform to `ResourceLoader` (type-level conformance; semantics unchanged) + interface conformance tests.
3.4. RED: integration — the three consumers (`project-tree.svelte`, `git-context-panel.svelte`, `quick-open-dialog.svelte`) mounted with the same workspace+comparison issue exactly one `/file-list` request.
3.5. GREEN: migrate the three consumers to `fileListStatusLoader`.
3.6. RED: integration — workspace scoping: switching to workspace B never reuses A's cache; no prefetch of A while B active.
3.7. GREEN: verify scoping (loader already per-workspace; add regression test).
3.8. RED: regression pin — server-seeded data (workspaces, git context, active review) is not refetched on first render (integration/E2E, D9).
3.9. Run `npm run qa`.
**Exit criteria:** single `/file-list` per workspace+comparison; scoping and seed-regression tests green; no TTL introduced; `ResourceLoader` contract in place.

### Phase 4 — Targeted invalidation
**Files**: `+page.server.ts`, `+page.svelte`, `review-panel.svelte`, `observation-panel.svelte`, `git-context-panel.svelte`, `workspace-nav-item.svelte`, `open-workspace-form.svelte`, `delete-confirm-dialog.svelte`.
**Tasks**:
4.1. RED: integration — `invalidate('app:git-context')` re-runs only the git-context load, not the whole page (SvelteKit contract test).
4.2. GREEN: `+page.server.ts` declares `depends('app:workspaces')`, `depends('app:git-context')`, `depends('app:active-review')`.
4.3. RED: review change invalidates only `app:active-review` (+ `app:git-context` if needed) — no full reload.
4.4. GREEN: `review-panel.svelte` `handleReviewChange` → `invalidate('app:active-review')`.
4.5. RED: observation create/delete invalidates only `app:active-review`.
4.6. GREEN: `observation-panel.svelte` → targeted.
4.7. RED: git-context retry invalidates only `app:git-context` + `app:workspaces`.
4.8. GREEN: `git-context-panel.svelte` `retryContext` → targeted.
4.9. RED: rename/repair refresh contract — after rename/repair, only the affected workspace's resources are invalidated (tree + file-list loaders), no full reload.
4.10. GREEN: `workspace-nav-item.svelte` / repair flow → targeted loader invalidation (+ `invalidate('app:…')` where the contract exists).
4.11. Keep `invalidateAll()` where no safe contract exists (documented in code comment).
4.12. Run `npm run qa`.
**Exit criteria:** targeted invalidation tests green; rename/repair refresh contract green; no regression in review/observation flows; no server-side load restructuring.

### Phase 5 — Full QA validation
5.1. Full `npm run qa` (format → lint → check → unit → integration → bdd-language → bdd → e2e → build).
5.2. Tester validation per `IADEV-validating-implementation` (coverage matrix, scenario walk-through, `validation-results.md`).
5.3. Re-measure baseline vs post-change; update `tests/fast-menu-baseline.md`.
5.4. Update living docs using the `docs-writer` skill (mandatory per AGENTS.md
   for any `.md` under `/docs`): `docs/architecture.md` (loader boundary),
   `docs/changelog.md`; `docs/PRD.md` only if budgets approved.
**Exit criteria:** QA PASS; coverage complete; delta report exists.

## 11. Test strategy

| Layer | What | Where |
|-------|------|-------|
| Unit | loader cache semantics (key, dedupe, per-key guard, invalidation, stale, errors) + `ResourceLoader` interface conformance | `tests/unit/web/file-list-status-loader.test.ts`, `tests/unit/web/project-tree-loader.test.ts` |
| Integration | cross-consumer dedupe, workspace scoping, SSR-seed regression pin, invalidation contract, request counting | `tests/integration/web/fast-menu-interactions.test.ts` |
| BDD | static contract pins for every scenario | `tests/steps/fast-menu-interactions.steps.ts` |
| E2E | user-visible flows + timing/request measurement + baseline | `tests/e2e/fast-menu-interactions.spec.ts`, `fast-menu-baseline.spec.ts` |

Coverage rule (per `IADEV-bdd-implementation`): every scenario maps to ≥1 test
carrying the FEAT-ID + scenario slug; the coverage matrix is recorded in the
implementation report and audited by the Tester.

## 12. Risks

| Risk | Mitigation |
|------|-----------|
| No baseline → wrong target | Phase 1 is measurement-only; budgets are user decisions after baseline |
| TTL/SWR shows stale Git data | Default to session cache + targeted invalidation; TTL only via the §4 gate with explicit policy |
| Partial invalidation leaves sidebar/Git/file-list/tree/Quick Open inconsistent | Conservative Phase 4: only replace where `depends()` contract exists; keep `invalidateAll` elsewhere |
| Large repos: full tree/file-list per workspace | No prefetch of non-active workspaces; cache per workspace only |
| Loader migration drops badges/entries (three consumers) | Integration request-count + shared-map tests; existing unit tests stay green |
| Seed refetch regression after loader migration | Regression-pin scenario + integration test (D9) |
| Mega-cache / global wrapper temptation during Phase 3 | Contract explicitly per-resource (D8/D10); review gate; only two loaders in scope |
| E2E timing flakiness | Timing assertions tolerant (percentile-based), request-count assertions strict; baseline in dedicated spec |
| BDD step drift | Static pins + coverage audit in Phase 5 |
| Scope creep (Stage 2–4) | Explicit out-of-scope list; escalate findings to Orchestrator |

## 13. Assumptions

- `comparisonDraft.createdAt` remains in the domain as informative; the cache
  key fix is loader-side only.
- SvelteKit `invalidate`/`depends` contract (v2) is available and safe to use.
- The production baseline can run via `vite preview` or adapter-node build in
  the E2E worker harness.
- No new dependencies are required (KISS/YAGNI); if a dependency becomes
  necessary, it requires user confirmation.
- SSR `data` props remain the seed source; this feature does not restructure
  `+page.server.ts` loads.
- No AbortController wiring is needed in Phase 3; the guard semantics are
  preserved and abort stays an optional reserved capability of the contract.
- The shared generic loader implementation is NOT extracted until a third
  resource migrates (Rule of Three); only the interface is shared now.

## 14. User decisions required

1. **Budgets**: after Phase 1 baseline, approve target budgets (or keep
   informational only).
2. **TTL/SWR**: gated per §4 — baseline evidence + explicit policy + per-resource
   TTL + mutation priority; default is session cache + targeted invalidation.
   User explicitly confirmed that localStorage/IndexedDB are not wanted; the
   approved implementation uses in-memory session cache only.
3. **Production baseline**: approve running the adapter-node build + server for
   the baseline measurement.
4. **Server-side load restructuring**: only if Phase 1 shows the SSR Git
   waterfall is dominant; requires a new contract.
5. **Cache boundary**: approved — use the `web/services` per-resource loader
   layer as the cache home (no global fetch wrapper, no store-based data cache,
   no mega-cache, no localStorage/IndexedDB, session-memory only).

## 15. Delegation order and skills

1. **`nas_planner` — persistence handoff only** — after approval, writes the merged canonical `.feature` file and does not redesign the approved plan.
   Skills (exact): `mind-management`, `IADEV-writing-gherkin`,
   `IADEV-bdd-implementation`. It requires OpenCode `permission.edit` with a
   `*.feature` allowlist; never use `permission.write`.
2. **`nas_developer` — FULL (never mini)** — implements Phases 1–4 under TDD.
   Rationale: risk flags `Architectural change` + `Ambiguous classification`
   force full mode; multi-file loader/store/invalidation changes.
    Skills (exact, per the approved Skill Assignment Contract):
    `mind-management`, `IADEV-test-driven-development`, `IADEV-bdd-implementation`,
    `IADEV-applying-feedback`, `clean-svelte-architecture`,
   `clean-backend-architecture`, `clean-code`, `svelte-code-writer`.
   No other skills are added by default.
   Phase 5 documentation task (5.4): `docs-writer` is an exact, approved skill
   for `nas_developer`, scoped ONLY to the documentation update
   (`docs/architecture.md`, `docs/changelog.md`, and `docs/PRD.md` if budgets
   are approved). It is mandatory because AGENTS.md requires `docs-writer` for
   any `.md` under `/docs`. If the documentation update is excluded from scope,
   `docs-writer` is not listed.
3. **`nas_qa`** — full validation after implementation (Phase 5).
    Skills (exact): `mind-management`, `IADEV-validating-implementation`,
    `IADEV-bdd-implementation`. No additional skills by default.
4. **Orchestrator (coordination only)** — coordinates the `on_done` handoff and
   never writes product files outside `.nas`; it only coordinates and approves.

## 16. Rollback

Each phase is an independent commit. Rollback = revert the phase commit(s);
Phases 1 and 2 are behavior-neutral or minimal; Phase 3/4 changes are isolated
to loaders/invalidation and covered by tests. No feature flag required.

## 17. Memory writes (requested)

- `sdd-feature-fast-menu-interactions-20260805` — change memory (feature),
  UPDATED with rev. 2: `web/services` loader boundary, resource ownership
  table, TTL/SWR decision gate.
- `fast-menu-frontend-api-flow-20260805` — NEW discovery memory
  (cat:discovery): current frontend API flow + cache boundary findings
  (validated).
- `fast-menu-plan-approved-20260805` — decision memory (cat:decision), created
  on approval.
- Checkpoint update in `projects/diffscribe`.

<!-- prettier-ignore-end -->
