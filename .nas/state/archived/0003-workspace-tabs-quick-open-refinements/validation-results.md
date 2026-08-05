# Validation Results: 0003-workspace-tabs-quick-open-refinements

**Round:** 1 (final QA after implementation and cleanup)
**Verdict:** PASS
**Date:** 2026-08-05
**QA agent:** nas_qa (read-only; only this report file is written)

## Summary

The nine approved refinements are implemented as web-only state and layout
contracts: pinned complete-diff tab, Quick Open unconditional untracked
inclusion plus status badges, right-edge desktop navigation, stable left
footer control with Help above, workspace context header, central tab
borders, Git List/Tree removal, seeded observation visuals, and obsolete
setting cleanup. No server/API/DTO/domain/database/dependency/shared-kit/
mobile change was introduced by this feature; every modified or new file in
the 0003 window matches the delegation list except one test-only alignment
(WARNING). All nine gates were re-run fresh and sequentially on one host:
format, lint, check, unit 667/667, integration 189/189, check:bdd-language,
BDD 575/575 with zero skips (the temporary `@delta-removed` skip hook is
gone), E2E 322/322 with exactly 8 workers, and build. All 21 canonical
scenarios have covering E2E/unit tests. Verdict: PASS, no blockers.

## Re-run evidence (exact commands, fresh, sequential, project root)

| Command                           | Reported by Developer | Observed by QA                                       | Status |
| --------------------------------- | --------------------- | ---------------------------------------------------- | ------ |
| `npm run format`                  | pass                  | exit 0, "All matched files use Prettier code style!" | OK     |
| `npm run lint`                    | pass                  | exit 0, `--max-warnings=0`                           | OK     |
| `npm run check`                   | pass (2 warnings)     | exit 0, 0 errors, 2 benign warnings                  | OK     |
| `npm run test:unit`               | 667 passed            | 667 passed (64 files)                                | OK     |
| `npm run test:integration`        | 189 passed            | 189 passed (19 files)                                | OK     |
| `npm run check:bdd-language`      | pass                  | exit 0, "No Spanish detected in BDD artifacts."      | OK     |
| `npm run test:bdd`                | 575 + 1 skip          | 575 passed (47 files), 0 skipped                     | OK     |
| `npm run test:e2e -- --workers=8` | 322 passed            | 322 passed (8 workers); definitive run clean         | OK     |
| `npm run build`                   | build OK              | exit 0, "✓ built", adapter-node done                 | OK     |

`npm run qa` was NOT used: the `qa` script does not forward `--workers=8` to
Playwright (known INFO, consistent with 0001/0002). Every E2E invocation used
the exact CLI `npm run test:e2e -- --workers=8`.

## E2E worker and flakiness evidence

- Run 1 (immediately after the BDD gate): `Running 322 tests using 8 workers`,
  322/322 passed, 2.3m.
- Run 2 (worker-header evidence capture): `Running 322 tests using 8 workers`,
  2 failed, 320 passed. The failure names were not captured (grep-scoped
  output); the failures did not reproduce. Pattern matches the documented
  environmental host flakiness from 0001/0002 (dev-server restart mid-run
  under 8 workers).
- Run 3 (full-log capture): `Running 322 tests using 8 workers`, 322/322
  passed, 2.2m, npm exit 0. This is the definitive green run.
- BDD and E2E were never run concurrently. All runs were sequential.

## Scenario coverage (canonical feature: 21 scenarios)

All 21 `@delta-added` scenarios in
`specs/features/product/workspace-tabs-quick-open-refinements.feature` are
covered by browser-observable E2E tests; state contracts are additionally
pinned by unit tests.

| #   | Scenario                                        | Covering test(s)                                               | Status |
| --- | ----------------------------------------------- | -------------------------------------------------------------- | ------ |
| 1   | Left collapse control bottom with Help above    | `panel-rail-corrections.spec.ts:293` / `:317`                  | PASS   |
| 2   | Expanded control spans panel width              | `panel-rail-corrections.spec.ts:342`                           | PASS   |
| 3   | Desktop right-edge tab icons                    | `panel-rail-corrections.spec.ts:371`                           | PASS   |
| 4   | Mobile right sheet keeps horizontal navigation  | `panel-rail-corrections.spec.ts:430`, responsive/mobile suites | PASS   |
| 5   | Workspace context header (Project/Git/Settings) | `workspace-context.spec.ts` (2 tests)                          | PASS   |
| 6   | Active tab no bottom border; inactive tabs do   | `open-files-tabs.spec.ts:274`                                  | PASS   |
| 7   | Complete diff first synthetic non-closable tab  | `pinned-complete-diff.spec.ts:88`                              | PASS   |
| 8   | Opening a file preserves pin and activates file | `pinned-complete-diff.spec.ts:113`                             | PASS   |
| 9   | Pin revisitable, no "No file selected"          | `pinned-complete-diff.spec.ts:138`                             | PASS   |
| 10  | Closing last file tab returns to the pin        | `pinned-complete-diff.spec.ts:162`                             | PASS   |
| 11  | Comparison change refreshes pin in place        | `pinned-complete-diff.spec.ts:185`                             | PASS   |
| 12  | Workspace switch replaces pin and clears tabs   | `pinned-complete-diff.spec.ts:225`                             | PASS   |
| 13  | No active workspace shows no pinned tab         | `pinned-complete-diff.spec.ts:83`                              | PASS   |
| 14  | Git file list exposes no List/Tree controls     | `file-list-tree.spec.ts:52`, `file-list-panel.spec.ts`         | PASS   |
| 15  | Quick Open always includes nonignored untracked | `quick-open.spec.ts:254`                                       | PASS   |
| 16  | Quick Open excludes ignored files               | `quick-open.spec.ts:357`                                       | PASS   |
| 17  | Quick Open shows working-tree status badges     | `quick-open.spec.ts:379`                                       | PASS   |
| 18  | Quick Open caps results at 512                  | `quick-open.spec.ts:413`                                       | PASS   |
| 19  | Obsolete include-untracked setting inert        | `quick-open.spec.ts:254`                                       | PASS   |
| 20  | Seeded observation cards render with actions    | `observation-visual.spec.ts:138`                               | PASS   |
| 21  | Observation cards readable in dark/synthwave    | `observation-visual.spec.ts:202`                               | PASS   |

Delta features are aligned with the plan: `settings-panel.feature` no longer
contains the include-untracked scenario; `quick-open.feature` and
`open-files-tabs.feature` carry the @delta-modified/@delta-added scenarios;
`panel-rail-ux-corrections.feature`, `file-list-tree.feature`,
`file-list-panel.feature`, `workspace-git-review-ux.feature`, and
`observation-status.feature` match the implemented behavior. No `.feature`
file uses `@delta-removed`; the temporary skip hook was removed from
`tests/steps/settings-panel.steps.ts` (BDD runs with 0 skips).

## Unit test coverage

- `active-file-store.test.ts` — pin create/idempotence/first-position,
  closeTab ignores pin, openFileTab never replaces pin (normal and modifier),
  closing last file tab activates pin, resetTabs drops pin, activateTab
  accepts pin id, setActiveFile/clearActiveFile pin semantics.
- `quick-open-scorer.test.ts` — untracked always eligible, status passthrough
  without ranking impact, empty-query full index, 512 cap, ranking categories,
  deterministic ties, highlights.
- `quick-open-store.test.ts` — legacy key constant, removal, absent-key
  no-op, null storage tolerance.
- `file-list-status-loader.test.ts` — no workspace/comparison returns null,
  map build, per-comparison cache, cache invalidation on signature change,
  failure not cached, error payload returns null, stale-response guard.

## Findings

| ID    | Severity | Title                                                   | Status                                                                                                                                                       |
| ----- | -------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F-001 | WARNING  | `tests/e2e/panel-resize.spec.ts` touched in 0003 window | unlisted file; test-only, aligns tablist-role/geometry assertions with the approved right-edge nav contract (0002/0003); no production change                |
| F-002 | WARNING  | svelte-check `state_referenced_locally`                 | `right-panel-tabs.svelte:57` and `+page.svelte:63`; 0 errors, exit 0; same benign warnings as 0002 F-004; documented intent comments                         |
| F-003 | INFO     | Marker/grep unit contract test                          | `panel-rail-contracts.test.ts` is grep-based (repo convention); user-authorized 0003 migration to the shell-footer contract; primary behavior covered by E2E |
| F-004 | INFO     | E2E run-2 flakiness (host, not product)                 | 2 failures on run 2, absent on runs 1 and 3; consistent with prior documented dev-server restart flakiness under 8 workers                                   |
| F-005 | INFO     | Weak `partialErrors` assertion                          | 0001-era `workspace-git-review-ux.feature` S20 asserts `Array.isArray` only; unchanged, out of 0003 scope                                                    |
| F-006 | INFO     | `docs/PRD.md` remains Spanish-language                  | pre-existing document language preserved per delegation convention "preserve existing document languages"; `check:bdd-language` unaffected                   |

## Scope findings (0003 window, mtime >= 2026-08-05 10:33)

- Files in scope: all delegation-listed web components/stores/services, the
  two new web modules, listed unit/E2E/step files, docs, and Gherkin features
  — all present and matching the authorized list.
- Approved exception: `tests/unit/web/components/panel-rail-contracts.test.ts`
  migrated from the 0002 rail-reopen contract to the stable 0003 shell-footer
  contract (user-authorized, test-only).
- Unlisted test-only touch (WARNING, not BLOCKER): `tests/e2e/panel-resize.spec.ts`.
- Scope creep (BLOCKER): NONE — no new production file outside the contract;
  every untracked production file is an authorized 0003 new module or is
  0001/0002-era (`complete-diff-viewer.svelte`, `help-dialog.svelte`,
  `visual-settings-store.ts`, complete-diff API, markdown/language utils).
- Historical accumulation (INFO, pre-0003): `package-lock.json`
  (user-authorized brace-expansion bump, 0001), `vitest.bdd.config.ts`
  (0001 BDD step registration), `docs/versioning.md` (0001 complete-diff API
  note), `src/lib/web/styles/tokens.css` (0001 untracked→green token),
  server-layer files (`workspace-services.ts`, `simple-git-file-diff-reader.ts`,
  `unified-diff-parser.ts`, complete-diff API), deletions
  `file-list-view-store.ts`/test (0001), and `runtime-requests.txt` stray
  debug artifact.
- Forbidden files verified clean in the 0003 window: `package.json`,
  `playwright.config.ts`, `scripts/check-bdd-language.mjs`, `AGENTS.md`,
  `.agents/nas.config.yaml`, `src/lib/web/components/ui/**`,
  `panel-layout-store.ts`, `observation-panel.svelte`,
  `observation-card.svelte` (unchanged — seeded tests passed with existing
  tokens, so no corrections were justified and no stale wiring was added),
  mobile drawer/sheet helpers.

## Skill audit

QA applied: `mind-management`, `clean-backend-architecture`,
`clean-svelte-architecture`, `clean-code`, `frontend-design`,
`svelte-code-writer`, `IADEV-validating-implementation`,
`IADEV-bdd-implementation`. Developer skill claims match the delegation list;
no hallucinated skills. No violations found.

## Architecture / accessibility audit

- Layer boundaries respected: pinned tab is web-only shell/tab-store state;
  Quick Open joins the existing `/file-list` contract by path with a new
  web-layer loader (type-only `$lib/server` imports, erased at build); no
  server/API/DTO/domain change in this feature.
- Right-edge nav: `flex-direction: row-reverse` preserves DOM/keyboard order;
  exactly one vertical tablist per desktop state; consumer tabpanels keep
  reciprocal `aria-labelledby`; active indicator on the outer/right edge;
  mobile branch untouched.
- Pinned tab: `role="tab"`, `aria-selected`, no close button, no middle-click
  close; roving keyboard navigation includes the pin; "No file selected"
  remains only for the no-workspace/truly-empty case.
- Context header: fixed/non-scrolling, displayName + truncated repositoryPath
  with `title`; hidden on Workspaces and without an active workspace.
- Left footer: single bottom row spanning rail+panel (`grid-column: 1/3`);
  button has `aria-label` + `title` fallbacks; authored last so grid
  auto-placement keeps main/right panel in row 1.
- Quick Open: legacy `diffscribe-quick-open-include-untracked` key removed on
  every open; status badges use existing `statusTone`/`statusLabel`
  (`untracked` → "New" green); fallback no-badge on failure; 512 cap intact.
- Observations: seeded E2E asserts badges, status dots, body, hover/focus
  actions, no panel overflow, and >= 3:1 badge contrast in Dark Deep and
  Synthwave '84 with existing tokens; `staleStatus` stays `null`.

## Notes

- BDD grew to 47 files (new canonical feature) and 575 tests with 0 skips.
- E2E run 2 flake: not reproducible; definitive run 3 green (322/322). BDD and
  E2E never ran concurrently.
- `npm run qa` worker-flag discrepancy remains an INFO (known item); all gates
  were executed individually per contract.

## fail_category

NONE. All repository gates pass fresh. No feature-owned regression observed.

## Recommendation

APPROVE. All nine gates green; all 21 canonical scenarios covered; no scope
creep, no skill violations, no specs drift; delta Gherkin and docs aligned.
Remaining findings are WARNING/INFO only and do not block completion.
