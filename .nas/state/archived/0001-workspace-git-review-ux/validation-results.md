# Validation Results: 0001-workspace-git-review-ux

**Round:** 4 (final QA pass after user-authorized external `npm audit fix`)
**Verdict:** PASS
**Date:** 2026-08-04
**QA agent:** nas_qa (read-only; only this report file is written)

## Summary

Re-verified W1-W13 against the delegation contract, `plan.md`, `research.md`,
and the 33 persisted scenarios in
`specs/features/product/workspace-git-review-ux.feature`. The user-authorized
external `npm audit fix` upgraded the dev-only `brace-expansion` package in
`package-lock.json` from 5.0.8 to 5.0.9. `npm audit` now reports
0 vulnerabilities and the previously failing BDD audit scenario passes. Every
repository gate was re-run fresh and is green: format, lint, check, unit
645/645, integration 189/189, check:bdd-language, BDD 533/533, E2E 292/292 with
exactly 8 workers, and build. No feature-owned code or documentation changed in
this pass. The previous BLOCKER (environmental npm audit advisory) is resolved;
the verdict is PASS with recommendation CONTINUE so the Orchestrator can mark
the feature state done and archive.

## Package-file status (user-authorized environmental remediation)

- `package.json`: unchanged (no new runtime dependency; the approved Markdown
  renderer remains dependency-free).
- `package-lock.json`: only change is `node_modules/brace-expansion`
  `5.0.8 -> 5.0.9` (dev-only, transitive via `minimatch` used by eslint
  tooling). `git diff --stat` shows `package-lock.json | 6 +++---`.
- `npm audit`: "found 0 vulnerabilities" (exit 0). The advisory range for
  `brace-expansion` (4.0.0-5.0.8) no longer matches the installed 5.0.9.
- `npm ls brace-expansion minimatch`: installed versions are outside the
  advisory range across all consumers (eslint, typescript-eslint,
  eslint-plugin-import-x).
- Treatment: reported separately from the feature diff, per the handoff
  instruction. It is user-authorized environmental remediation, NOT developer
  scope creep, and not part of the feature contract's do-not-touch
  `package.json` boundary (the manifest itself is unchanged).

## Re-run evidence (exact commands, fresh, project root)

- `npm run format` - PASS ("All matched files use Prettier code style!").
- `npm run lint` - PASS (exit 0, `--max-warnings=0`).
- `npm run check` - PASS (0 errors, 1 benign warning
  `state_referenced_locally` in `+page.svelte:51`, intentionally documented in
  the component; unchanged from prior rounds).
- `npm run test:unit` - PASS 645/645 (62 files, 6.28s).
- `npm run test:integration` - PASS 189/189 (19 files, 35.63s).
- `npm run check:bdd-language` - PASS ("OK: No Spanish detected in BDD
  artifacts.").
- `npm run test:bdd` - PASS 533/533 (45 files). The previous sole failure -
  `post-setup-discrepancies.feature` "npm audit has no high or moderate
  vulnerabilities" - now PASSES after the external fix.
- `npm run test:e2e -- --workers=8` - PASS 292/292 (2.5m). Output header:
  "Running 292 tests using 8 workers"; the CLI `--workers=8` overrides the
  config default of 4 (`playwright.config.ts` reads
  `DIFFSCRIBE_E2E_WORKERS ?? 4`). Run twice in this pass; both green.
- `npm run build` - PASS ("✓ built", adapter-node done, 14.52s).
- `npm run qa` - NOT run as one command: `package.json` `qa` runs
  `npm run test:e2e` without the worker flag. Playwright must run with exactly
  8 workers, so each gate was executed individually per the contract; the
  known `qa` worker-flag discrepancy is documented as INFO.

## Concurrency note (environmental, not feature-owned)

- BDD and E2E were NOT run concurrently in this pass (round-3 finding: the
  host OOMs worker-server child processes under concurrent suites). BDD ran
  alone, then E2E ran alone with 8 workers; both green.
- INFO: an isolated evidence-gathering smoke (`npm run test:e2e -- --workers=8
--grep=workspace-delete-refresh`) matched a single test, so Playwright ran
  "1 test using 1 worker" and timed out at the
  `#workspace-sidebar li.active` wait. The same spec passes in the full suite
  (2.4s). This is a test-robustness note for isolated single-spec runs, not a
  gate failure; every full-suite gate run used exactly 8 workers.

## Scenario coverage (33 scenarios in workspace-git-review-ux.feature)

All 33 scenarios have at least one covering test (verified again against the
persisted feature; 33 `Scenario:` blocks, all `@delta-added`, English only).
Covering layers: E2E specs `workspace-delete-refresh`, `workspace-open-flow`,
`ui-shell`, `file-list-tree`, `settings-panel`, `project-view`,
`complete-diff`, `markdown-preview`, `git-branches`, `git-ref-popup`,
`panel-resize`, `open-files-tabs`, `help-dialog`, `comparison-propagation`;
unit specs `visual-settings-store`, `status-aggregation`, `markdown-renderer`,
`language-map`, `file-status`, `complete-diff-reader`, `unified-diff-parser`,
`get-complete-diff-use-case`; BDD `tests/steps/workspace-git-review-ux.steps.ts`
plus application-layer features for the contract scenarios.

Coverage notes (unchanged from round 3):

- INFO - S20 "Aggregate reader enforces caps and partial errors" asserts only
  `Array.isArray(result.partialErrors)`; the adapter never populates
  `partialErrors` in practice (weak/grep-style test).
- INFO - BDD steps are marker/grep-based (existing quickpickle convention).

## Contract / scope audit

- Files in contract (modify/create): all present; `file-list-view-store.ts`
  (+test) deleted and replaced by `visual-settings-store` per plan section 10.
- New runtime dependencies: none. The only package-tree change is the
  user-authorized `brace-expansion` dev bump in `package-lock.json`.
- Do-not-touch respected: `file-change-status.ts` untouched (`UNTRACKED =
'untracked'` intact); no SQLite migration files; no Git mutation; no
  `check-bdd-language.mjs` change; no `.agents/nas.config.yaml` change;
  `branch-options.ts` untouched; comparison-propagation architecture
  untouched (tests strengthened).
- Files changed NOT in the contract list (all pre-existing, none new):
  `simple-git-file-diff-reader.ts` (shared helper extraction, plan-sanctioned,
  INFO), `vitest.bdd.config.ts` (BDD step registration, INFO), and E2E
  helper/spec updates required by the approved W3/W4 behavior delta
  (test-only: `diff-viewer`, `gutter-geometry`, `line-selection`,
  `line-wrapping`, `mobile-hardening`, `observation-draft`, `review-lifecycle`,
  `viewport-scroll`, `helpers/hydration`, `helpers/register-workspace`,
  `steps/mobile-hardening`) - WARNING, historical test-infrastructure
  accumulation, not BLOCKER scope creep.
- Scope creep (BLOCKER): none - no new production file outside the approved
  contract list (all untracked additions match "To create").
- Historical accumulation (INFO): `.nas/` state dir; `runtime-requests.txt`
  stray untracked debug artifact predating this session.

## Security / architecture / a11y review (spot-checked, unchanged)

- Markdown: the only Markdown `{@html}` interpolation is
  `source-viewer.svelte:267` rendering `markdownPreviewHtml`, produced
  exclusively by `markdown-renderer.ts`, which escapes ALL source input and
  allowlists `http:`/`https:`/`mailto:` (`sanitizeLink` returns null for
  `javascript:`/`vbscript:`/`data:`). The other `{@html}` uses in
  `diff-viewer.svelte` are pre-existing and unchanged. PASS.
- Clean Architecture: domain untouched; application owns port/use case/DTO;
  infrastructure owns adapter/parser; web owns UI/state; new route validates
  comparison + limit (1..1000) with 404/400 guards; composition wired. PASS.
- Domain/API invariants: `untracked` remains the wire/domain value; UI label
  `New`; green tokens in all theme blocks; directory precedence
  `unmerged > deleted > modified > type-changed > added > renamed > copied >
untracked > unknown` matches approved A6. PASS.
- A11y: `role="status"`, `role="alert"`, `role="list"`, `aria-label` in the
  complete-diff viewer; `aria-hidden`/`aria-label` markers; help dialog uses
  the shared `Dialog` component (showModal, Escape, focus return); bottom
  footers desktop-only; mobile drawers unchanged. PASS.
- Request guards: `createRequestGuard` used in the complete-diff viewer. PASS.
- Gherkin language: `check:bdd-language` green; feature file and step
  definitions are English only; persisted file matches the include filter
  (`specs/features/product/*`); no feature file under excluded paths changed.

## Issues

- RESOLVED (was BLOCKER in round 3): BDD gate failed 1/533 - npm audit high
  `brace-expansion` via dev-only `minimatch`. The user-authorized external
  `npm audit fix` (5.0.8 -> 5.0.9) resolves it; `npm audit` = 0
  vulnerabilities; BDD 533/533 passes.
- WARNING: E2E helper/spec files updated outside the contract's explicit
  "Existing affected E2E" list (justified by the approved W3/W4 behavior;
  test-only; no new production files).
- INFO: `partialErrors` path declared but not populated/exercised (weak test).
- INFO: BDD steps are marker/grep-based (repo convention).
- INFO: benign svelte-check mount-time warning (`+page.svelte:51`).
- INFO: do not run BDD and E2E concurrently on this host (OOM risk,
  `exit=137`); isolated runs pass.
- INFO: `runtime-requests.txt` stray debug artifact (untracked).
- INFO: `npm run qa` does not forward `--workers=8` to Playwright (contract
  known-item; verified individually with exactly 8 workers).
- INFO: isolated single-spec E2E runs can be flaky (grep runs use 1 worker
  regardless of the flag); full-suite runs with 8 workers are stable and
  passed twice in this pass.

## fail_category

NONE. All repository gates pass fresh. The prior `tests_fail` (environmental,
pre-existing npm audit advisory) is resolved by the user-authorized external
fix and no longer applies. No feature-owned regression was observed.

## Recommendation

APPROVE / CONTINUE. Feature-owned implementation, tests, security,
architecture, a11y, scope, docs, and Gherkin are compliant and verified fresh
on every gate. The environmental BLOCKER is resolved. The Orchestrator may
mark the feature state done and archive. Remaining findings are WARNING/INFO
only and do not block completion.
