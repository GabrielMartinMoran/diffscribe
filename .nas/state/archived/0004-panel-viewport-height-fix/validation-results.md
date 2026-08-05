# Validation Results: 0004-panel-viewport-height-fix

**Round:** 1
**Verdict:** PASS
**Date:** 2026-08-05

## Summary

The desktop grid placement fix (center `grid-row: 1 / -1` + `grid-column: 3`;
right panel and collapsed strip `grid-row: 1 / -1` + `grid-column: 4` via
desktop-scoped `:global()`; mobile explicit `grid-template-rows: 1fr`) matches
the approved contract exactly. All 9 QA gates pass sequentially on one host.
The 2 BDD failures reported by the Developer (pre-commit-quality-gate scenarios
against unformatted Orchestrator-owned `.nas` files) are resolved after the
whitespace-only Prettier pass: BDD now 583/583. E2E is 332/332 with exactly 8
workers. Scope audit shows only the 5 approved files plus the persisted
canonical feature changed in the session window; all other dirty files predate
the session (historical accumulation).

## Re-run evidence

| Command                           | Reported by Developer | Observed by Tester                               | Status |
| --------------------------------- | --------------------- | ------------------------------------------------ | ------ |
| `npm run format`                  | green                 | Prettier check — all files OK                    | OK     |
| `npm run lint`                    | green                 | exit 0, `--max-warnings=0`                       | OK     |
| `npm run check`                   | green                 | 0 errors, 2 pre-existing warnings                | OK     |
| `npm run test:unit`               | 667 passed            | 667 passed, 64 files                             | OK     |
| `npm run test:integration`        | 189 passed            | 189 passed, 19 files                             | OK     |
| `npm run check:bdd-language`      | green                 | No Spanish detected                              | OK     |
| `npm run test:bdd`                | 581 passed / 2 failed | 583 passed / 0 failed                            | OK     |
| `npm run test:e2e -- --workers=8` | 332 passed            | 332 passed — "Running 332 tests using 8 workers" | OK     |
| `npm run build`                   | green                 | exit 0, adapter-node built                       | OK     |

The 2 previously failing BDD scenarios are the pre-commit-quality-gate
scenarios; they now pass because the Orchestrator Prettier-formatted
`plan.md`/`research.md` in `.nas/` (whitespace only). Confirmed resolved.

## Findings

| ID    | Severity | Title                                         | Detail                                                                                                                                                         |
| ----- | -------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F-001 | INFO     | Pre-existing svelte-check warnings            | `state_referenced_locally` in `+page.svelte:63` and `right-panel-tabs.svelte:57`. Not introduced by this change; contract scope is CSS-only in `+page.svelte`. |
| F-002 | INFO     | Worker evidence is partial in captured output | Head of E2E log truncated; footer states "Running 332 tests using 8 workers" and worker-evidence lines (wi=2, wi=4) confirm multi-worker pool. 332/332 passed. |

## Skill audit

- QA skills applied: `mind-management`, `clean-svelte-architecture`,
  `clean-code`, `frontend-design`, `svelte-code-writer`,
  `IADEV-validating-implementation`, `IADEV-bdd-implementation`. All loaded and
  applied. No hallucinated skill ids; no stack-relevant category skipped.

## Scenario coverage (per `IADEV-bdd-implementation`)

| Scenario                                                          | Instances                             | Covering tests                                                                                                     | Result |
| ----------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------ |
| Central area and right panel reach the viewport bottom on desktop | 1 (1280x720)                          | `viewport-height.spec.ts` "center and right panel bottom equal the viewport bottom at 1280x720" + BDD markers      | PASS   |
| Regions reach the bottom at common desktop sizes (outline)        | 2 (1280x720, 1440x800)                | `viewport-height.spec.ts` parametrized loop covers both rows                                                       | PASS   |
| Collapsed right strip reaches the viewport bottom                 | 1                                     | `viewport-height.spec.ts` "collapsed right strip reaches the viewport bottom and keeps its rail width at 1280x720" | PASS   |
| Left footer stays bottom-most and keeps its widths                | 1                                     | `viewport-height.spec.ts` "left footer stays bottom-most and keeps expanded/collapsed widths at 1280x720"          | PASS   |
| Mobile layout still reaches the viewport bottom (outline)         | 3 (320, 375, 768)                     | `viewport-height.spec.ts` containment + sheet-anchor tests cover all three rows                                    | PASS   |
| **Total**                                                         | **5 scenarios / 7 outline instances** | 10 E2E tests in `viewport-height.spec.ts`                                                                          | PASS   |

Every Gherkin step text has a step definition: desktop steps in
`tests/steps/ui-redesign.steps.ts`, mobile steps in
`tests/steps/mobile-hardening.steps.ts`. Markers match the approved plan
(`grid-column: 3`, `grid-column: 4`, `grid-row: 1 / -1`,
`grid-template-rows: 1fr;`).

## Scope audit

Approved to modify: `src/routes/+page.svelte`, `tests/e2e/viewport-height.spec.ts`
(new), `tests/steps/ui-redesign.steps.ts`, `tests/steps/mobile-hardening.steps.ts`,
`docs/design.md`. Persisted canonical Gherkin:
`specs/features/product/panel-viewport-height-fix.feature` (matches plan §6
verbatim, English, `@delta-added`).

Changed in the 0004 session window (16:04–16:39, per mtimes): the five files
above, the persisted `.feature`, and `.nas` `plan.md`/`research.md`
(Orchestrator Prettier, whitespace only — the Developer did not touch `.nas`).

Scope creep: NONE. No server/API/domain/DB/Git-reader, no `package*.json`, no
Playwright/Vitest/CI configs, no `.agents/nas.config.yaml`, no `ui/**`,
`panel-layout-store.ts`, or shared-kit files changed in the window.

Historical accumulation (pre-session dirty tree): package-lock.json,
`src/lib/server/**`, many `src/lib/web/components/**`, most `tests/**`, several
`specs/features/**` — all mtimes before 16:04, part of the uncommitted Stage 1
tree. WARNING/INFO only, not session scope creep.

## Quality gates

- tests: PASS (unit 667/667, integration 189/189, BDD 583/583, E2E 332/332)
- lint: PASS (0 warnings)
- format: PASS
- check: PASS (0 errors)
- build: PASS
- bdd-language: PASS

## Notes

- Geometry tolerance in the E2E suite is ±2 px per plan §9; assertions use
  bounding-box bottoms, no document scroll, right-edge flush, and the
  `.is-mobile` DOM barrier.
- The feature file was persisted at approval time (runtime config
  `persist_to_repo on_done/merged`); include/exclude filters (`product/*`,
  `application/*`) respected — file lives under `specs/features/product/`.
- Reset Layout fixed-overlay and 0003 footer regressions are covered by the
  passing protected suites (`panel-resize`, `panel-rail-corrections`,
  `responsive-mobile`, `mobile-hardening`, `viewport-scroll`, `ui-shell`,
  `rail-tabs`).
