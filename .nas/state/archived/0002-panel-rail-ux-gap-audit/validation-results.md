# Validation Results: 0002-panel-rail-ux-gap-audit

**Round:** 2
**Verdict:** PASS
**Date:** 2026-08-05

## Summary

Developer retry 1/2 fixed the round-1 blockers. F-001 is resolved: the
duplicate quickpickle step `Then('the Git option is selected and the panel
stays open')` was removed from `tests/steps/workspace-git-review-ux.steps.ts`;
the retained definition at `tests/steps/ui-redesign.steps.ts:3482` is the
single canonical owner, and the BDD suite passes 543/543. F-002/F-003 are
resolved: the Orchestrator formatted the three `.nas` state Markdown files and
`npm run format` now exits 0. All nine gates pass individually and
sequentially (BDD and E2E never ran concurrently). E2E with exactly 8 workers
is green on the definitive run (305/305). The 0002 contract is verified:
desktop expanded/collapsed right navigation is vertical icon Tabs with one
tablist per state, real reciprocal tabpanels, idempotent left open-if-
collapsed, inert + aria-hidden collapsed left subtree, focus transfer, bottom
control group, border-box geometry, and title fallbacks. Mobile sheet/drawer
behavior is preserved. No scope creep, no skill violations, no specs drift.

## Re-run evidence

| Command                           | Reported by Developer | Observed by Tester                               | Status |
| --------------------------------- | --------------------- | ------------------------------------------------ | ------ |
| `npm run format`                  | pass                  | exit 0                                           | OK     |
| `npm run lint`                    | pass                  | exit 0                                           | OK     |
| `npm run check`                   | pass                  | exit 0, 2 warnings                               | OK     |
| `npm run test:unit`               | 651 passed            | 651 passed (63 files)                            | OK     |
| `npm run test:integration`        | 189 passed            | 189 passed (19 files)                            | OK     |
| `npm run check:bdd-language`      | pass                  | exit 0                                           | OK     |
| `npm run test:bdd`                | 543 passed            | 543 passed (46 files)                            | OK     |
| `npm run test:e2e -- --workers=8` | 305 passed            | 305 passed (8 workers), exit 0 on definitive run | OK     |
| `npm run build`                   | build OK              | exit 0                                           | OK     |

## E2E worker and flakiness evidence

- Both E2E runs used the explicit CLI `npm run test:e2e -- --workers=8`.
  Playwright reported `Running 305 tests using 8 workers` in both runs.
  `npm run qa` was NOT used; no default/other worker count was used.
- First run (immediately after the BDD gate): 283 passed, 11 failed, 11 did
  not run. All 11 failures were in pre-existing suites unrelated to 0002
  scope (`base-ui-kit.spec.ts:95` theme accent, `git-ref-popup`, `gutter-
geometry`, `line-selection`, `line-wrapping`, `markdown-preview`,
  `mobile-hardening.spec.ts:245` backdrop hit-test, `open-files-tabs`). The
  failure log shows a dev-server restart mid-run (`navigated to
http://127.0.0.1:5174/`, element detached during click). Root cause:
  environmental host instability, not the 0002 change set.
- Second run (same command): 305/305 passed, exit 0, 2.0m. Every 0002-
  relevant suite passed: `panel-rail-corrections.spec.ts` (13),
  `panel-resize.spec.ts` (23), `base-ui-kit.spec.ts` (7),
  `ui-shell.spec.ts` (18), `mobile-hardening.spec.ts` (11),
  `responsive-mobile.spec.ts` (20).

## Findings

| ID    | Severity | Title                                        | Reproduction                      | Expected            | Actual                                                                                                     |
| ----- | -------- | -------------------------------------------- | --------------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------- |
| F-001 | RESOLVED | Duplicate BDD step for left rail expansion   | `npm run test:bdd`                | unique step pattern | removed from `workspace-git-review-ux.steps.ts`; single owner at `ui-redesign.steps.ts:3482`; 543/543 pass |
| F-002 | RESOLVED | Format gate on Orchestrator-owned .nas files | `npm run format`                  | exit 0              | Prettier `All matched files use Prettier code style!`; exit 0                                              |
| F-003 | RESOLVED | Pre-commit BDD scenarios fail downstream     | `npm run test:bdd`                | hook exit 0         | 543/543 pass; pre-commit-quality-gate scenarios green                                                      |
| F-004 | WARNING  | Svelte compiler `state_referenced_locally`   | `npm run check`                   | no warnings         | `right-panel-tabs.svelte:57` and `+page.svelte:52`; exit 0, 2 warnings only                                |
| F-005 | INFO     | Marker/grep unit contract test               | `npm run test:unit`               | browser-observable  | `panel-rail-contracts.test.ts` is grep-based; allowed as supplemental; behavior covered by E2E             |
| F-006 | INFO     | E2E run-1 flakiness (host, not product)      | `npm run test:e2e -- --workers=8` | deterministic       | 11 pre-existing-suite failures on run 1, all green on run 2; dev-server restart evidence                   |

## Skill audit

QA applied: `mind-management`, `clean-svelte-architecture`, `clean-code`,
`frontend-design`, `svelte-code-writer`, `IADEV-validating-implementation`,
`IADEV-bdd-implementation`. `documentation-lookup` not needed. Developer
skill claims match the delegation list; no hallucinated skills. No
violations found.

## Scenario coverage

### Canonical `panel-rail-ux-corrections.feature` (10 scenarios)

| #   | Scenario                                                            | Covering test(s)                                                                              | Status |
| --- | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------ |
| 1   | Expanded desktop right navigation is vertical with one tablist      | `panel-rail-corrections.spec.ts:31`, `base-ui-kit.spec.ts:251`, `ui-shell.spec.ts:235`        | PASS   |
| 2   | Right panel tabs link to real tabpanels                             | `panel-rail-corrections.spec.ts:71`                                                           | PASS   |
| 3   | Collapsed right option expands the panel and selects the option     | `panel-rail-corrections.spec.ts:106`, `panel-resize.spec.ts:567`                              | PASS   |
| 4   | Collapsed right strip exposes a bottom expand control               | `panel-rail-corrections.spec.ts:127`, `panel-resize.spec.ts` strip suites                     | PASS   |
| 5   | Selecting a collapsed left rail option expands the panel            | `panel-rail-corrections.spec.ts:184`; BDD step `ui-redesign.steps.ts:3470/3482`               | PASS   |
| 6   | Collapsing the left panel moves focus to a visible control          | `panel-rail-corrections.spec.ts:206`                                                          | PASS   |
| 7   | Left rail bottom controls are bottom-aligned with Help below reopen | `panel-rail-corrections.spec.ts:293`                                                          | PASS   |
| 8   | Right panel fits its grid column                                    | `panel-rail-corrections.spec.ts:148`                                                          | PASS   |
| 9   | Icon-only controls expose accessible names and a title fallback     | `panel-rail-corrections.spec.ts:316`                                                          | PASS   |
| 10  | Mobile sheet keeps horizontal navigation and drawer behavior        | `panel-rail-corrections.spec.ts:338`, `mobile-hardening.spec.ts`, `responsive-mobile.spec.ts` | PASS   |

### Delta features (approved `@delta-modified`/`@delta-added`)

- `workspace-git-review-ux.feature`: "Collapsed panel options expand the
  panel and select the option" and "Bottom controls collapse and expand both
  panels" — BDD steps green (`workspace-git-review-ux.steps.ts:557-588`,
  `ui-redesign.steps.ts`); E2E covered by `panel-rail-corrections.spec.ts`.
- `panel-resize.feature`: PANEL-STRIP-01/02/03 assert the single inner
  vertical tablist and real tabpanels — `panel-resize.spec.ts:544/567/585`
  pass; collapse/expand/persistence/resize regressions intact (23 tests).
- `rail-tabs.feature`: "Keyboard navigation moves focus across desktop right
  panel tabs" uses ArrowUp/ArrowDown — BDD step `ui-redesign.steps.ts:949`,
  E2E `panel-rail-corrections.spec.ts:48`.
- `base-ui-kit.feature`: Tabs scenario with vertical-orientation assertion —
  BDD step `ui-redesign.steps.ts:3602-3613`, E2E `base-ui-kit.spec.ts:251`.

All scenario `Then` outcomes are asserted by browser-observable E2E tests; no
scenario relies on a grep-only assertion for its primary coverage.

## ARIA and accessibility audit

- Exactly one `role="tablist"` in every desktop right state (expanded and
  collapsed); wrapper carries no tablist role; `aria-orientation="vertical"`.
- Each tab's `aria-controls` resolves to a real `role="tabpanel"` element
  (`ui-tab-panel-comments` / `ui-tab-panel-review`); reciprocal
  `aria-labelledby` points at the tab button; both panels stay mounted,
  inactive one `hidden`.
- Collapsed left desktop subtree is `inert` + `aria-hidden="true"`; focus
  transfer on collapse and reopen verified (E2E Tab-walk and inert proof).
- Icon-only controls keep `aria-label` and add native `title` fallbacks.
- Mobile sheet keeps horizontal tablist and `role="dialog"` drawer
  semantics; no visual change beyond ARIA attributes.

## Scope findings

- No scope creep in the 0002 window (files with mtime >= 2026-08-05 00:10):
  `right-panel-tabs.svelte`, `rail-tabs.svelte`, `+page.svelte`,
  `tests/e2e/panel-rail-corrections.spec.ts` (new),
  `tests/e2e/panel-resize.spec.ts`, `tests/e2e/base-ui-kit.spec.ts`,
  `tests/e2e/ui-shell.spec.ts`, `tests/unit/web/components/panel-rail-
contracts.test.ts` (new), `tests/steps/ui-redesign.steps.ts`,
  `tests/steps/workspace-git-review-ux.steps.ts` (untracked; retry removed
  the duplicate step), `docs/design.md`, `docs/changelog.md`, `docs/PRD.md`,
  and the five `specs/features/product/*.feature` files (canonical + deltas).
- Forbidden files verified clean in the 0002 window: `panel-layout-store.ts`,
  `ui/Tabs.svelte`, `ui/ids.ts`, `ui/variants.ts`, `observation-panel.svelte`,
  `review-panel.svelte`, `project-tree.svelte`, `workspace-sidebar.svelte`,
  `playwright.config.ts`, `scripts/check-bdd-language.mjs`, `package.json`,
  `AGENTS.md`, `mobile-hardening.spec.ts` (mtime 2026-08-04, pre-existing).
- Historical accumulation (pre-existing debt, not 0002; INFO):
  `git-context-panel.svelte`, `settings-panel.svelte`, server-layer files,
  `package-lock.json`, `vitest.bdd.config.ts`, and other prior-session test
  files (mtimes 2026-08-04 or earlier).

## Specs/Gherkin and docs alignment

- `docs/design.md` documents the desktop vertical right navigation in both
  states, the single-tablist rule, real tabpanel relationships, the left
  bottom group with Help below reopen, and the title fallback strategy.
- `docs/changelog.md` has the Unreleased 0002 entry.
- `docs/PRD.md` adds the minimal vertical-icon product note preserving the
  document's existing language.
- `docs/architecture.md`: audited; no stale horizontal right-tab claim, so
  the audit-only pass was correctly a no-change.
- No Spanish detected in BDD artifacts (`check:bdd-language` exit 0).

## Notes

- F-004 warnings are non-blocking and pre-existing; exit code 0.
- F-006 is environmental: the 11 run-1 failures were all outside 0002 scope,
  disappeared on the immediate rerun, and the failure log shows a dev-server
  restart. BDD and E2E were never run concurrently; runs were sequential.
- Programmatic rail switches (workspace landing, Git Ctrl/Cmd-click) verified
  not to reopen the collapsed left panel (`panel-rail-corrections.spec.ts:257`).

## Recommendation

APPROVE. All nine gates pass on re-run; F-001/F-002/F-003 resolved; scenario
coverage complete (10 canonical + delta); no scope creep, no skill
violations, no specs drift. Remaining findings are WARNING/INFO only.
