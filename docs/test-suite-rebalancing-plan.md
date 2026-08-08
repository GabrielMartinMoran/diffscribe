# DiffScribe — Test Suite Rebalancing Plan

**Status:** Approved plan — pending implementation
**Date:** August 7, 2026
**Audience:** the implementing agent (Developer or Commander) that picks up this
plan and executes it under the repository QA gates
**Scope:** test suite configuration, test files under `tests/`, BDD features and
steps under `specs/features/` and `tests/steps/`, CI-readiness scripts, and
testing governance rules in `AGENTS.md` and `docs/architecture.md`. It does not
change production code, domain, application, or infrastructure behavior.

This document is the source of truth for the test suite rebalancing effort. It
contains the measured evidence, the industry references that justify the
strategy, the concrete plan by phases, and the governance rule that must be
codified to prevent the suite from regrowing.

---

## Executive summary

The DiffScribe test suite is slow because its shape is inverted. On
August 7, 2026, 949 of the 1,842 tests (51.5%) live in the two slowest layers:
the BDD suite (608 tests, ~150 seconds) and the Playwright E2E suite
(341 tests, 4-11 minutes). The fast layers are healthy: 678 unit tests in
~5 seconds and 215 integration tests in ~12 seconds.

The root causes are structural, not incidental:

1. There is no component test layer. All 42 Svelte components can only be
   verified through the browser, so every UI behavior becomes an E2E test.
2. Every feature is tested twice: once in BDD at adapter level and once in
   Playwright at browser level.
3. The suite contains tests with no value: empty step bodies, source-file
   grep assertions, a network-dependent `npm audit` scenario, a scenario that
   runs the full pre-commit hook, and E2E specs that test the test harness
   itself (flakiness, races, worker isolation).
4. The suite grows unchecked: BDD grew from 420 to 608 tests and E2E from
   207 to 341 tests in a single week (August 1-7, 2026).

The plan restores the pyramid: delete or downgrade low-value tests, add a
component test layer (Playwright Component Testing) to absorb most UI
coverage, reduce E2E to a critical-journey "golden path" suite under 5
minutes, and codify a one-scenario-one-layer rule so the suite cannot
regrow. Expected result: total QA from ~8-10 minutes to ≤5 minutes, with a
stable trend.

---

## Evidence — measured data

All measurements taken on August 7, 2026, on the developer workstation
(Node 24.18.0, Linux, `npm run qa` executed locally; no CI exists yet — there
is no `.github/` directory).

### Suite composition and wall time

| Layer | Tests | Wall time | Command |
| --- | --- | --- | --- |
| Unit | 678 | ~5 s | `npm run test:unit` |
| Integration | 215 | ~12 s | `npm run test:integration` |
| BDD (quickpickle) | 608 | ~151 s | `npm run test:bdd` |
| E2E (Playwright) | 341 (44 files) | 4-11 min | `npm run test:e2e` |

The E2E estimate comes from the serial baseline captured on July 29, 2026
(134/135 tests in 264.47 seconds for 135 tests, ~2 s per test) scaled to the
current 341 tests, and from 8-worker runs reported in prior sessions. E2E is
CPU-bound (diff highlighting, font loading, multi-viewport geometry), so
adding workers beyond 8 has diminishing returns.

### Growth trend (one week, August 1-7, 2026)

| Layer | August 1 | August 7 | Growth |
| --- | --- | --- | --- |
| Unit | 503 | 678 | +35% |
| Integration | 184 | 215 | +17% |
| BDD | 420 | 608 | +45% |
| E2E | 207 | 341 | +65% |

The two slowest layers grow the fastest. This is the E2E scope explosion
phenomenon documented for AI-augmented teams (see Industry references).

### Failures observed during measurement

| Layer | Failing tests | Root cause |
| --- | --- | --- |
| Integration | `R3: starts, stops, and restarts using real npm run dev` and `R4: respects DIFFSCRIBE_E2E_STOP_TIMEOUT_MS` in `tests/integration/e2e-helpers/worker-server.test.ts` | `EADDRINUSE` — orphaned Vite/Chromium processes from a previous E2E run were still alive and holding ports |
| BDD | `npm audit has no high or moderate vulnerabilities` in `specs/features/application/post-setup-discrepancies.feature` | Network call to the npm registry inside the test suite |
| BDD | `Hook passes when format and lint are clean` in `specs/features/application/pre-commit-quality-gate.feature` | Runs the full pre-commit hook (format + lint over the whole repo), 31 s for one test |

During measurement, a full Playwright run was still alive in the background
(four `vite dev` servers on ports 5173-5176 plus multiple Chromium instances),
consuming CPU and stealing ports. This is direct evidence of the harness
cleanup gap described in the plan (Phase 0).

### Current configuration

- `playwright.config.ts`: `testDir: ./tests/e2e`, `timeout: 60_000`,
  `retries: 0`, `fullyParallel: true`,
  `workers: Number(process.env.DIFFSCRIBE_E2E_WORKERS ?? 4)`, Chromium only,
  headless.
- Each Playwright worker boots its own SvelteKit dev server via
  `tests/e2e/fixtures.ts` and `tests/e2e/helpers/worker-server.ts`
  (worker-scoped fixture with start/stop).
- `vitest.config.ts`: two projects (`unit`, `integration`), SvelteKit plugin,
  temporary DB directory via `tests/setup/global-setup.ts`.
- `vitest.bdd.config.ts`: quickpickle plugin, 37 step files listed as setup
  files, `testTimeout: 30_000`.
- `package.json` scripts: `test:unit`, `test:integration`, `test:bdd`,
  `test:e2e`, and `qa` which runs format, lint, check, unit, integration,
  `check:bdd-language`, bdd, e2e, build in order.
- Pre-commit hook (Husky) is check-only: `npm run format && npm run lint`.

### What exists and what is missing

- Unit tests cover domain entities, value objects, errors, DTOs, and the web
  layer stores/services/utils (for example `tests/unit/web/theme-store.test.ts`,
  `tests/unit/web/project-tree-loader.test.ts`). They do not render components.
- Integration tests cover repositories, endpoints, git adapters, the database,
  and the E2E harness helpers (`tests/integration/e2e-helpers/worker-server.test.ts`,
  `tests/integration/e2e-helpers/git-fixture.test.ts`,
  `tests/integration/e2e-helpers/workspace-management-flake.test.ts`).
- There is no component test layer: `package.json` has no `jsdom`, `happy-dom`,
  or `@testing-library/svelte`, and no Playwright Component Testing setup.
  Every UI behavior is verified only in the browser.
- There is no CI. QA runs locally; a CI pipeline is planned for later, so the
  plan must be CI-ready (separated scripts, sharding-friendly configuration).

---

## Evidence — low-value and misplaced tests

### Duplication between BDD and E2E

The same behavior is specified in Gherkin and executed at adapter level
(quickpickle steps) and mirrored again as a Playwright spec. Examples:

| BDD feature | E2E spec |
| --- | --- |
| `specs/features/product/file-list-panel.feature` | `tests/e2e/file-list-panel.spec.ts` |
| `specs/features/product/git-context-panel.feature` | `tests/e2e/git-context-panel.spec.ts` |
| `specs/features/product/observation-crud.feature` | `tests/e2e/observation-draft.spec.ts` |
| `specs/features/product/observation-status.feature` | `tests/e2e/review-lifecycle.spec.ts` |
| `specs/features/product/quick-open.feature` | `tests/e2e/quick-open.spec.ts` |
| `specs/features/product/workspace-management.feature` | `tests/e2e/workspace-management.spec.ts` |
| `specs/features/product/diff-viewer.feature` | `tests/e2e/diff-viewer.spec.ts` |
| `specs/features/product/line-selection.feature` | `tests/e2e/line-selection.spec.ts` |

Every new feature currently produces two test suites. This is the main cost
multiplier.

### BDD steps with empty or fake assertions

`tests/steps/file-list-panel.steps.ts` contains steps whose body is `() => {}`
or a tautology, for example:

- `Then('pagination controls are visible', () => {})` (line 337).
- `Then('the other rows are not highlighted', () => {})` (line 375).
- `Then('the Retry button becomes disabled during the attempt', () => {})`
  (line 560) — the comment says "UI-level assertion checked by E2E".
- `Then('no file entries are displayed', () => {})` (line 506).

Scenarios that end up with no real assertions must be removed from the
`.feature` file as well; a passing test that asserts nothing is false green.

### BDD steps that grep source files

- `tests/steps/file-list-panel.steps.ts` lines 629-675 read
  `src/lib/web/components/file-list.svelte`, `file-status.ts`, and
  `ui/StatusBadge.svelte` source text and assert on string inclusion
  (`src.includes('ui-status-badge')`).
- `tests/steps/git-context-adapter.steps.ts` lines 707-714 read
  `src/lib/server/infrastructure/git/simple-git-context-reader.ts` and assert
  that no `git.fetch(...)` call appears in the source.

These are brittle (they break on reformatting, not on behavior), slow, and
already duplicated by the source-audit unit tests under `tests/unit/web/ui/`
(`token-audit.test.ts`, `contracts.test.ts`, `import-boundary.test.ts`).

### BDD scenarios that are not product behavior

- `specs/features/application/post-setup-discrepancies.feature`: runs
  `npm audit` (network dependency inside the suite).
- `specs/features/application/pre-commit-quality-gate.feature`: runs the full
  pre-commit hook, 31 seconds for one test.

Both belong in standalone scripts (like `scripts/check-bdd-language.mjs`),
not in the BDD test suite.

### E2E specs that test the harness, not the product

- `tests/e2e/worker-isolation.spec.ts` (4 tests).
- `tests/e2e/workspace-management-e2e-flake.spec.ts`.
- `tests/e2e/git-context-race.spec.ts` (3 tests).
- `tests/e2e/rail-hydration.spec.ts` (4 tests).

These verify worker-server behavior, races, and flakiness in a browser. The
harness coverage already exists in the integration suite under
`tests/integration/e2e-helpers/`. Running harness tests in E2E burns the most
expensive budget without testing product behavior.

### Heavy pixel-geometry E2E specs

These genuinely need a browser (real layout, real fonts) but are the most
expensive tests in the suite:

- `tests/e2e/gutter-geometry.spec.ts` (8 tests): measures line-number cell
  bounding boxes with a 1 px tolerance across 4 viewports (320, 375, 768,
  1280), reloads the page per viewport, loads real fonts, and builds fixture
  files of 1,500 lines.
- `tests/e2e/viewport-height.spec.ts` (5 tests), `tests/e2e/viewport-scroll.spec.ts`
  (4 tests): same multi-viewport pattern.
- `tests/e2e/panel-resize.spec.ts` (23 tests), `tests/e2e/responsive-mobile.spec.ts`
  (20 tests), `tests/e2e/panel-rail-corrections.spec.ts` (16 tests),
  `tests/e2e/mobile-hardening.spec.ts` (7 tests): large viewport-matrix specs.

The industry filter applies here: the 48 px gutter guarantee at 320 px is
low business impact and low change rate, yet it costs four page loads per
test run.

### E2E specs that belong in component tests

Playwright Component Testing renders a single component without booting the
app, without git fixtures, and without full pages. The following specs verify
component behavior that a component test would catch:

- `base-ui-kit.spec.ts` (7), `help-dialog.spec.ts` (2), `markdown-preview.spec.ts`
  (4), `settings-panel.spec.ts` (5), `observation-visual.spec.ts` (2),
  `ui-shell.spec.ts` (18, mostly), `open-files-tabs.spec.ts` (11),
  `git-ref-popup.spec.ts` (14), `rail-tabs.spec.ts`, `fast-menu-interactions.spec.ts`
  (11, mostly), `file-list-tree.spec.ts` (7), `project-tree-invalidation.spec.ts`
  (4).

The component inventory that would absorb this coverage lives in
`src/lib/web/components/`: 42 components, including the UI kit under
`src/lib/web/components/ui/` (`Button`, `Checkbox`, `Tabs`, `Menu`, `Dialog`,
`Tooltip`, `Select`, `Switch`, `Badge`, `StatusBadge`, `IconButton`,
`TextInput`, `Popover`) and the feature components (`file-list`, `diff-viewer`,
`source-viewer`, `quick-open-dialog`, `settings-panel`, `git-context-panel`,
`observation-card`, `observation-form`, `rail-tabs`, `open-files-tabs`,
`project-tree`, and more).

---

## Industry references

The strategy follows guidance from sources that operate at scale with high
software quality standards, including teams that maintain code with AI
assistance:

1. **Google Testing Blog — "Just Say No to More End-to-End Tests"**
   (Mike Wacker, 2015): end-to-end tests are the worst-case term of the test
   suite; their cost (time plus flakiness) grows superlinearly with count.
   A suite dominated by E2E tests inflates runtime and flakes; the suite must
   keep a pyramid shape (small/medium/large test taxonomy).
   https://testing.googleblog.com/2015/04/just-say-no-to-more-end-to-end-tests.html

2. **Kent C. Dodds — Testing Trophy**: for frontend applications the thick
   layer is integration (rendered components with real data, no full browser),
   unit is thin, and E2E is a small cap. "Write tests. Not too many. Mostly
   integration."
   https://kentcdodds.com/blog/write-tests
   https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications

3. **Martin Fowler — Practical Test Pyramid**: push verification as far down
   the pyramid as possible; E2E only for what only E2E can catch (full-stack
   wiring).
   https://martinfowler.com/articles/practical-test-pyramid.html

4. **Playwright official documentation** (the tool vendor): the testing
   philosophy is "test user-visible behavior"; the docs cover component
   testing, API testing, sharding, and CI best practices.
   https://playwright.dev/docs/best-practices
   https://playwright.dev/docs/test-components
   https://playwright.dev/docs/test-parallel

5. **Autonoma — "The E2E Testing Strategy That Scales With AI-Generated
   Code"** (2026): documents the E2E scope explosion in AI-augmented teams
   (the exact pattern visible in this repository's one-week growth). Core
   guidance adopted here:
   - Layer filter: if a test would pass even if the UI rendered incorrectly,
     it does not belong in E2E. Applying the filter typically reveals 30-40%
     of tests in the wrong layer.
   - Risk matrix: prioritize coverage by business impact times change rate.
   - Golden path: 5-10 critical user flows, pre-merge, under 5 minutes.
   - Placement: fast critical tests pre-merge, broad coverage post-merge,
     full regression on schedule.
   - Metrics: suite execution time trend and flake rate by test age.
   https://getautonoma.com/blog/e2e-testing-strategy-ai-teams

6. **BDD/Gherkin convention**: a scenario is a specification; it executes at
   exactly one layer, the cheapest layer that verifies the behavior for real.
   Scenarios bind to steps at adapter/store level through quickpickle; only
   scenarios whose correctness depends on full-stack wiring need a browser.
   Duplicating a scenario in two layers is an anti-pattern.

---

## Decisions already made

| Decision | Value |
| --- | --- |
| QA execution today | Local only (`npm run qa`); CI is planned for later, the plan must be CI-ready |
| Component test stack | Playwright Component Testing (`@playwright/experimental-ct-svelte`), evaluated against `vitest-browser-svelte` in a Phase 2 spike |
| Scope | Full plan by phases (0-4) |

---

## Plan — Phase 0: hygiene and metrics (1-2 days)

Objective: stop the bleeding. No test files change.

1. Kill orphaned Vite/Chromium processes and close the worker-server startup
   and cleanup gap in `tests/e2e/helpers/worker-server.ts` so no process
   survives a run. This removes the `EADDRINUSE` flakes observed in the
   integration suite and the CPU contention between layers during `npm run qa`.
2. Set `retries: 2` for CI runs only (keep `retries: 0` locally). Today any
   flake burns the whole run.
3. Add `scripts/measure-suite-time.mjs`: runs each layer with a JSON reporter
   and appends per-layer durations to `test-results/suite-trend.jsonl`. This
   is the suite-time trend metric that gates future growth.
4. Ensure `test-results/` is gitignored.

Verification: `npm run qa` passes, integration suite is green twice in a row,
and the trend file records baseline durations.

---

## Plan — Phase 1: remove what has no value (1-2 days)

1. **BDD steps and scenarios:**
   - Delete steps with empty bodies (see Evidence) and the scenarios that end
     up without assertions in `specs/features/`.
   - Delete the source-grep steps in `tests/steps/file-list-panel.steps.ts`
     (lines 629-675) and `tests/steps/git-context-adapter.steps.ts`
     (lines 707-714). The source-audit unit tests under `tests/unit/web/ui/`
     already own that coverage.
   - Remove the `npm audit` scenario from
     `specs/features/application/post-setup-discrepancies.feature` and the
     pre-commit hook scenario from
     `specs/features/application/pre-commit-quality-gate.feature`. Convert
     both into standalone scripts modeled on
     `scripts/check-bdd-language.mjs` so the checks still run in QA.
2. **E2E harness specs:** delete or move to integration
   `tests/e2e/worker-isolation.spec.ts`, `tests/e2e/workspace-management-e2e-flake.spec.ts`,
   `tests/e2e/git-context-race.spec.ts`, and `tests/e2e/rail-hydration.spec.ts`.
   The harness coverage already exists in `tests/integration/e2e-helpers/`.
3. **E2E adapter-duplication:** in each remaining spec, apply the layer
   filter: scenarios that verify adapter logic "through the UI" (for example
   file-list-panel and git-context-panel scenarios whose assertion only
   depends on the DTO) are removed; the adapter coverage already lives in BDD
   steps and integration tests.

Verification: `npm run qa` passes; E2E test count drops by ~60-80 tests; BDD
drops by ~50-100 tests; BDD wall time decreases.

---

## Plan — Phase 2: add the component test layer (the structural fix)

Objective: create the layer that is missing today, so UI behavior stops
defaulting to E2E.

1. **Spike (1 day):** set up Playwright Component Testing for Svelte 5
   (`@playwright/experimental-ct-svelte`, `playwright-ct.config.ts`) and mount
   one component, for example `Button` from the UI kit. Evaluate
   `vitest-browser-svelte` (real browser through the Playwright provider,
   integrated with the existing vitest projects) as an alternative; pick the
   one that fits the repository best and document the choice in this plan.
2. **Coverage:** the UI kit (`src/lib/web/components/ui/`) first, then the
   feature components (`file-list`, `diff-viewer`, `source-viewer`,
   `quick-open-dialog`, `settings-panel`, `git-context-panel`,
   `open-files-tabs`, `observation-card`, `observation-form`, `rail-tabs`,
   `project-tree`, and the others listed in the Evidence).
3. **Migrate the E2E specs listed in Evidence** ("E2E specs that belong in
   component tests") to the component layer: `base-ui-kit`, `help-dialog`,
   `markdown-preview`, `settings-panel`, `observation-visual`, `ui-shell`
   (mostly), `open-files-tabs`, `git-ref-popup`, `rail-tabs`,
   `fast-menu-interactions` (mostly), `file-list-tree`,
   `project-tree-invalidation`.
4. Component tests verify behavior (render, click, keyboard, aria state,
   events), not pixel geometry. Real layout measurements stay in E2E (Phase 3).

Verification: the component project runs in under 60 seconds; the migrated
behaviors still fail when the component breaks (spot-check by reverting one
component change); E2E count drops by ~100-140 tests.

---

## Plan — Phase 3: reduce E2E to critical journeys

Objective: E2E becomes the small cap of the pyramid.

1. **Golden path suite** (`test:e2e:smoke`, ~20-30 tests, target ≤5 minutes):
   the journeys whose correctness depends on full-stack wiring:
   smoke, workspace registration, workspace open flow, file list, diff
   viewer, line selection, review lifecycle, observation creation and status,
   and basic workspace management.
2. **Full suite** (`test:e2e:full`): the remaining E2E specs, including
   reduced geometry, for post-merge or scheduled regression, not part of the
   local QA gate.
3. **Reduce the geometry matrix without losing the guarantee:** in
   `gutter-geometry.spec.ts`, `viewport-height.spec.ts`, `viewport-scroll.spec.ts`,
   `panel-resize.spec.ts`, and `responsive-mobile.spec.ts`, test one desktop
   viewport (1280) and one mobile viewport (375) per test instead of four.
   Trim the 1,500-line fixtures to the minimum that still exercises 4-digit
   line numbers.
4. **Risk matrix:** tag remaining specs by business impact and change rate;
   drop or downgrade specs with low impact and low churn (for example the
   48 px gutter guarantee at 320 px).

Verification: `npm run test:e2e:smoke` completes under 5 minutes; `npm run qa`
total under 10 minutes, target 5.

---

## Plan — Phase 4: governance rule and metrics gate

Codify the rule so the suite cannot regrow. This is the answer to the
question "must every generated Gherkin run as E2E": no.

1. **Update `AGENTS.md` (BDD section) and `docs/architecture.md` (QA section)
   with the rule:**

> Every Gherkin scenario executes at exactly one layer, the cheapest layer
> that verifies the behavior for real. The layer choice, in order, is: unit,
> integration, BDD (adapters and stores), component, E2E. E2E is reserved for
> journeys whose correctness depends on full-stack wiring (register, open,
> diff, select, observe, status). Duplicating a scenario in two layers is
> forbidden. Every new Playwright spec must justify in its description why it
> cannot be a component or integration test. Suite budget: E2E smoke ≤ 5
> minutes, BDD ≤ 60 seconds, total QA ≤ 10 minutes; `qa` fails if the budget
> is exceeded (measured by `scripts/measure-suite-time.mjs`).

2. **Tester role:** the QA validator (IADEV-validating-implementation)
   audits the layer justification for every new spec and flags layer
   duplication.
3. **Flake governance:** record flakes in a ledger; a test that flakes twice
   is moved to a lower layer or deleted, never retried into silence.
4. **Update the living documentation:** `docs/architecture.md` (QA section),
   `docs/changelog.md` (Keep a Changelog entry when the first phase ships),
   and `AGENTS.md`.

---

## CI-readiness

CI is planned for later; this plan leaves the repository ready:

- Scripts separated: `test:e2e:smoke` (pre-merge gate) and `test:e2e:full`
  (post-merge or scheduled regression).
- Playwright configuration shard-ready (Chromium only; sharding documented at
  https://playwright.dev/docs/test-parallel).
- `retries: 2` on CI, `0` locally.
- The golden path is the only E2E gate before merge; the full suite and the
  geometry specs run on schedule.
- The trend metric (`suite-trend.jsonl`) alerts when the suite time grows
  beyond budget.

---

## Execution order and verification

Each phase ends with a full `npm run qa` and the time-budget gate. Phase 2
starts with the spike before any mass migration. The pre-commit hook remains
check-only and is never modified to run `--fix`.

Do not start Phase 2 before Phase 0 and Phase 1 land; the deletions change
the migration target list. Do not implement anything outside the Stage 1
boundaries defined in `docs/PRD.md` section 18.

---

## Related prior work

`docs/e2e_performance_imorovements.md` is the prior investigation about E2E
infrastructure performance (worker parallelism, server reuse, storage state).
That work is orthogonal and complementary: it optimizes how E2E runs, this
plan optimizes what runs as E2E. Both can be applied together; this plan
supersedes only the parts that conflict with the golden path structure.

---

## Expected outcome

| Layer | Before | After (target) | Notes |
| --- | --- | --- | --- |
| Unit | 678 | ~678 | untouched |
| Integration | 215 | ~215 | untouched |
| BDD | 608 | ~450-500 | delete no-ops, source-grep, meta scenarios |
| Component (new) | 0 | ~150-250 | fast browser mounts, <60 s |
| E2E | 341 | ~60-80 | golden path plus reduced geometry |
| Total QA wall time | ~8-10 min | ≤5 min | stable trend via budget gate |
