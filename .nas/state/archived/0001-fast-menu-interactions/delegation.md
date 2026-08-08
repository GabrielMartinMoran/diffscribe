<!-- prettier-ignore-start -->

# Delegation: 0001-fast-menu-interactions

## Contract

- **Feature**: 0001-fast-menu-interactions
- **Gherkin**: `specs/features/product/fast-menu-interactions.feature`
- **FEAT-ID**: `feat-fast-menu-interactions`
- **Mode**: full developer, TDD Red → Green → Refactor
- **Approved scope**: implement Phases 1–4 of `plan.md`; complete the Phase 5 documentation task only after implementation work; QA is delegated separately and mandatory.
- **Cache decision**: in-memory session cache only. The user explicitly rejected `localStorage` and `IndexedDB`.

### Scenarios

- `@feat-fast-menu-interactions @product @performance @p1 @e2e` — overflow menu opens without API request
- `@feat-fast-menu-interactions @product @performance @p1 @e2e` — Quick Open shell and focus precede tree data
- `@feat-fast-menu-interactions @product @performance @p1 @e2e` — review list fetched at most once per open
- `@feat-fast-menu-interactions @product @performance @p1 @integration` — file-list status shared once per workspace/comparison
- `@feat-fast-menu-interactions @product @performance @p1 @integration` — cache scoped to active workspace, no inactive prefetch
- `@feat-fast-menu-interactions @product @performance @p1 @integration` — Git mutation invalidates affected workspace cache
- `@feat-fast-menu-interactions @product @performance @p1 @integration` — stale response never overwrites newer state
- `@feat-fast-menu-interactions @product @performance @p1 @unit` — failed load is not cached and can retry
- `@feat-fast-menu-interactions @product @performance @p1 @integration` — SSR-seeded data is not refetched on first render
- `@feat-fast-menu-interactions @product @performance @p1 @e2e` — latency measured in dev and production

## Files

### To create

| Path | What |
|------|------|
| `specs/features/product/fast-menu-interactions.feature` | Persist the approved merged Gherkin contract before production code. English only. |
| `tests/steps/fast-menu-interactions.steps.ts` | Quickpickle/static `requireMarker` pins for every scenario and FEAT-ID. |
| `tests/e2e/helpers/performance-timing.ts` | Performance marks/measures, long-task and resource observers. |
| `tests/e2e/helpers/request-tracking.ts` | Per-interaction API request counting and page-error tracking. |
| `tests/e2e/fast-menu-baseline.spec.ts` | Dev warm/cold and production baseline for shell, focus, first content, settled, requests, long tasks and errors. |
| `tests/e2e/fast-menu-interactions.spec.ts` | User-visible menu, Quick Open, review and shared-load behavior. |
| `tests/integration/web/fast-menu-interactions.test.ts` | Cross-consumer dedupe, workspace scoping, SSR seed, request count and invalidation contracts. |
| `src/lib/web/services/resource-loader.ts` | `ResourceLoader<TKey, TValue>` interface and contract documentation only; no premature universal implementation. |
| `tests/fast-menu-baseline.md` | Generated baseline report; record environment and measurements, do not invent budgets. |

### To modify

| Path | What |
|------|------|
| `vitest.bdd.config.ts` | Register the new BDD step file in `setupFiles`. |
| `tests/e2e/helpers/worker-server.ts` | Add the approved production-mode override for baseline measurement. |
| `tests/integration/e2e-helpers/worker-server.test.ts` | Cover the worker-server production override. |
| `tests/unit/web/file-list-status-loader.test.ts` | RED/GREEN coverage for canonical key, in-flight dedupe, per-key guards, workspace invalidation, clear, stale responses and retry. |
| `tests/unit/web/project-tree-loader.test.ts` | Add `ResourceLoader` interface conformance without changing existing semantics. |
| `src/lib/web/components/review-panel.svelte` | Remove duplicate `/reviews` load; retain loading/error/accessibility behavior; use targeted invalidation only where safe. |
| `src/lib/web/components/quick-open-dialog.svelte` | Keep shell and filter focus responsive before remote data; consume shared status loader; preserve search and keyboard behavior; expose `data-testid="quick-open-filter"` on the filter input. |
| `tests/e2e/quick-open.spec.ts` | Regression fix authorized by the user: replace ambiguous bare combobox lookup with `getByTestId('quick-open-filter')`; add/update only the affected locator assertions. |
| `src/lib/web/components/observation-panel.svelte` | Add monotonic guard/AbortController behavior as covered by tests; use targeted invalidation only where safe. |
| `src/lib/web/services/file-list-status-loader.ts` | Implement the approved resource-loader contract: semantic key without `createdAt`, in-flight dedupe, per-key stale guard, targeted invalidation, clear, failures not cached. |
| `src/lib/web/services/project-tree-loader.ts` | Conform to the shared interface; do not regress existing cache/dedupe/invalidation semantics. |
| `src/lib/web/components/project-tree.svelte` | Use the shared file-list status loader; preserve SSR seed and active-workspace scope. |
| `src/lib/web/components/git-context-panel.svelte` | Use the shared loader and invalidate affected workspace status after Git refresh; avoid broad invalidation where a safe contract exists. |
| `src/lib/web/components/workspace-nav-item.svelte` | Add tested targeted refresh contract for rename/repair. |
| `src/routes/+page.server.ts` | Declare `depends('app:workspaces')`, `depends('app:git-context')`, and `depends('app:active-review')` only as needed by tested targeted invalidation. |
| `src/routes/+page.svelte` | Replace broad invalidation only where the declared contract is safe. |
| `src/lib/web/components/open-workspace-form.svelte` | Targeted invalidation only if the existing action contract supports it. |
| `src/lib/web/components/delete-confirm-dialog.svelte` | Targeted invalidation only if the existing action contract supports it. |
| `docs/architecture.md` | Phase 5 only: document the per-resource loader/cache boundary using `docs-writer`. |
| `docs/changelog.md` | Phase 5 only: record the completed change using `docs-writer`. |
| `docs/PRD.md` | Phase 5 only and only if latency budgets become an approved product decision; use `docs-writer`. |

## Do NOT touch

- `localStorage`, `IndexedDB`, persistent browser cache or a third-party cache library.
- A global `fetch` wrapper, universal mega-cache or data cache inside Svelte UI stores.
- TTL/SWR implementation before the baseline gate and a new explicit user decision.
- Prefetching or caching data for inactive workspaces.
- Server-side response cache, DB/Git cache or `+page.server.ts` load restructuring; these require a new contract if the baseline proves they are dominant.
- `/tree`, `/file-list` or review endpoint semantics; domain treatment of `comparisonDraft.createdAt` remains unchanged.
- Migration of observations, source, file diff or complete diff to new loaders unless a new approved scope is created.
- HMR/dev-server fixes, animation timing or unrelated hydration work.
- Stage 2–4 behavior: AI, collaboration, network capabilities, auto-fix, code modification or commit creation.
- Unrelated existing Gherkin/features or E2E specs; use the dedicated feature/spec files listed above.

## Existing tests and references

- `tests/unit/web/project-tree-loader.test.ts` — cache, dedupe, invalidation and pending behavior.
- `tests/unit/web/file-list-status-loader.test.ts` — existing status-cache behavior to rewrite under the approved contract.
- `tests/unit/web/request-guard.test.ts` — monotonic stale-response guard.
- `tests/e2e/project-tree-invalidation.spec.ts` — tree refresh/invalidation.
- `tests/e2e/git-context-race.spec.ts` — Git races and retry behavior.
- `tests/e2e/quick-open.spec.ts` — Quick Open loading, focus, search and routing.
- `tests/e2e/review-lifecycle.spec.ts` — review lifecycle.
- `tests/e2e/observation-draft.spec.ts` — observation behavior.
- `tests/e2e/workspace-actions-overflow.spec.ts` — overflow menu behavior.
- `tests/e2e/fixtures.ts` and `tests/e2e/helpers/*` — Playwright fixtures and synchronization patterns.
- `specs/features/product/quick-open.feature`, `workspace-actions-overflow.feature` and related feature contracts — references only; do not merge this feature into them.

## Patterns and contracts

- Architecture: `web → infrastructure → application → domain`; data loaders belong in `src/lib/web/services/`, not domain or UI stores.
- Svelte: preserve Svelte 5 runes, lifecycle cleanup and existing accessibility/focus behavior.
- Loader reference: mirror `project-tree-loader.ts` for in-flight dedupe, pending-safe invalidation, per-workspace cache and failures-not-cached.
- Status key: `workspaceId | base.type | base.value | target.type | target.value | comparisonType`; exclude `createdAt` because it is informative metadata.
- SSR seed: workspaces, Git context and active review delivered by `+page.server.ts` are initial values and must not be immediately refetched.
- Cache scope: active workspace plus resource/comparison key; no inactive-workspace prefetch.
- Stale handling: guards are per key/workspace; a response from one workspace must not discard another workspace’s request.
- Errors: do not cache failures; preserve visible loading/error/retry states.
- BDD: English feature/steps, `@feat-fast-menu-interactions` traceability, static `requireMarker` pins, every scenario mapped to a test.
- Documentation: `docs-writer` is mandatory only for Phase 5 `/docs` changes.

## Commands

- `npm run test:unit`
- `npm run test:integration`
- `npm run test:bdd`
- `npm run test:bdd-language`
- `npm run test:e2e -- fast-menu-baseline`
- `npm run test:e2e -- fast-menu-interactions`
- `npm run format`
- `npm run lint`
- `npm run check`
- `npm run build`
- `npm run qa`

If `npm run format` fails, follow the repository protocol: run `npm run format:fix`, inspect the diff to ensure formatting-only changes, re-run `npm run format`, then continue with lint and the remaining QA chain. Do not modify the check-only hook.

## Authorization

- **Task**: Implement `feat-fast-menu-interactions` according to the approved `plan.md`, then prepare the completed work for mandatory QA.
- **Scope**: Only the files listed in **To create** and **To modify**, plus generated QA artifacts explicitly named there.
- **Order**: `nas_planner` persists the merged Gherkin contract first; then the developer writes RED tests before production changes; proceed Phase 1 → Phase 2 → Phase 3 → Phase 4; run the specified checks after each phase.
- **Gherkin persistence owner**: `nas_planner`, using OpenCode `permission.edit` with the `*.feature` allowlist. Do not use `permission.write`.
- **Developer**: `nas_developer` FULL.
- **Exact skills**: `mind-management`, `IADEV-test-driven-development`, `IADEV-bdd-implementation`, `IADEV-applying-feedback`, `clean-svelte-architecture`, `clean-backend-architecture`, `clean-code`, `svelte-code-writer`; `docs-writer` only for the Phase 5 documentation task.
- **No scope expansion**: if a required change is outside this contract, stop and report it to the Orchestrator; do not self-authorize.
- **TTL/SWR**: explicitly not authorized in this implementation.

<!-- prettier-ignore-end -->
