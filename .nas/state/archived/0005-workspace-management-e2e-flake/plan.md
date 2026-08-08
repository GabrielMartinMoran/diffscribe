# Plan — 0005-workspace-management-e2e-flake

**Status**: DONE — final QA PASS 2026-08-08. Gate A approved; Phases 9–11 PASS; Phase 12 skipped because target stability evidence was green; Phase 14 finalized.
**Created**: 2026-08-06 — **Updated**: 2026-08-07 (revision 3: D21–D27, Phases 9–14, evidence-gated minimal fix)
**Classification**: complex — HIGH risk (test-infrastructure lifecycle, conditional production escalation gate)
**Mode**: full. Canonical Gherkin was persisted at `on_done` in merged format; the final feature contains 18 scenarios (15 original + 3 approved `@enhance-diagnostics`).
**Developer routing**: Developer FULL (never mini).

---

## 0. Revision summary (what changed in this revision)

The previous revision (Phases 5–8, D20) is implemented and QA-validated: D20 guard passes isolated 9/9×5 but the full suite still fails 175 with native navigation (`framenavigated` in 3/3 full-suite runs). This revision converts the remaining uncertainty into **test-only, failure-time diagnostics** with **deterministic fake contracts**, then gates any minimal test-only fix behind the evidence. It adds:

- D21–D27 (decisions), Phases 9–14 (tasks), §11 (stability protocol), §14 (rollback/stop), §15 (quality gates), §16 (approval gates).
- The 15 persisted BDD scenarios were preserved; 3 planner-owned `@enhance-diagnostics` scenarios were persisted at `on_done`.
- Production code and `tests/e2e/helpers/hydration.ts` remain READ-ONLY. The only conditional escalation is §12.5 (production Svelte lifecycle defect → STOP and request new authorization).

---

## 1. Scope / Out-of-scope

### In scope (test-infrastructure only)

- **Diagnostics instrumentation (Phase 9)**: extend the test-side observer to record, at failure time: exact form identity (monotonic id), attach/detach history, submit ordinal (1st/2nd), submit target, `defaultPrevented`, submitter, request/navigation events, page errors, failed JS resources, and worker context (workerIndex/parallelIndex/port/stderr). Distinguish first/second submit and old/replaced form. Wire worker telemetry + stability ledger into `workspace-registration.spec.ts`.
- **Deterministic fake contracts (Phase 10)**: listener attach/detach, form replacement, stale observer, native fallback, `defaultPrevented` — RED contracts in the integration suite.
- **Evidence gate (Phase 11)**: isolated 175 repetitions of the 175 test + full-suite runs with default 4 workers; ledger comparison; decision record.
- **Minimal test-only fix (Phase 12, CONDITIONAL)**: only after evidence + user approval — lifecycle-aware/atomic readiness guard or diagnostic fail-fast. Never a worker-count/retry/timeout/sleep/reload change; never `preventDefault` in a probe.
- **Stability protocol (Phase 13)**: 3–5 consecutive full-suite passes after any fix; ledger comparison.
- **Final QA + BDD pins (Phase 14)**: full `npm run qa`; BDD static pins for approved new scenarios at `on_done`; final verdict with per-spec separation.

### Out of scope (do NOT touch)

- **Production code**: `src/lib/server/**`, `src/routes/+page.server.ts`, `src/lib/web/components/open-workspace-form.svelte`, `observation-panel.svelte`, `observation-form.svelte`, `observation-card.svelte`, `src/routes/+page.svelte` — READ-ONLY. No production change in this plan, even if the lifecycle hypothesis is confirmed (see §12.3 escalation).
- `tests/e2e/helpers/hydration.ts` — READ-ONLY (H1 stabilized).
- `tests/e2e/helpers/worker-telemetry.ts`, `worker-server.ts`, `stale-process-guard.ts`, `tests/e2e/fixtures.ts`, `playwright.config.ts` — READ-ONLY (H3/H4 contracts frozen; no worker/timeout/retry changes).
- `tests/e2e/line-selection.spec.ts` (276/307/338) and `worker-server.test.ts` — READ-ONLY in this revision (their contracts are frozen; diagnostics already wired).
- Product feature files (`specs/features/product/*`) — unchanged; a production fix would require a planner-only amendment.
- **Non-fixes**: lowering Playwright workers, adding retries, inflating timeouts, `waitForTimeout`, reloads as a fix, calling `preventDefault` from a probe, or any Stage 2/3/4 feature, DB change, or collaborative/network capability (AGENTS.md Stage 1 boundaries).
- **npm audit (post-setup-discrepancies.feature)**: pre-existing global failure, NOT fixed inside 0005; handled per D11 (evidence separation, no false green).

---

## 2. Hypotheses and evidence (research synthesis 2026-08-07)

| # | Hypothesis | Status | Evidence / consequence |
|---|-----------|--------|------------------------|
| H1 | Historical networkidle/invalidation race | **CONFIRMED (historical), NOT the current native-navigation cause** | H2 barriers already cover it; contract frozen. |
| H2 | D20 lifecycle false-positive: guard tracks attach only, never detach; guard and click are non-atomic; form can be replaced/destroyed by Svelte conditional lifecycle | **PLAUSIBLE — needs failure-time evidence** | Need form identity at failure time, attach/detach history, and `defaultPrevented` capture to confirm or reject. |
| H3 | Proximate mode: under full load the form can lack the observed SvelteKit enhanced-submit listener → native POST `?/register` + `framenavigated /` | **CONFIRMED** | Isolated 9/9×5 with D20 guard; full suite still fails. Native navigation observed in 3/3 full-suite runs. |
| H4 | Resource/worker scheduling as trigger: full suite with 4 workers; target spec lacks worker/page/resource telemetry; static chunk readiness does not prove browser execution | **PLAUSIBLE** | No worker-count/retry/timeout fix allowed; diagnostics must capture worker context. |
| H5 | Process contamination as primary cause | **REJECTED as primary** | Diagnostics remain useful (stderr/port capture). |
| H6 | Framework intrinsic defect | **REJECTED** | Official/local SvelteKit 2.70.1 source attaches a direct submit listener and synchronously `preventDefault`; do not change framework dependency or production. |

**Consequence**: the plan is diagnostics-first. No test-only fix is applied before Phases 9–11 produce failure-time evidence (D21, D25).

---

## 3. Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | **Measurement-first, fix-minimal.** RED contracts precede every fix; no unconfirmed hypothesis touches behavior. | Original 0005 principle; preserved. |
| D2 | **H2 primary fix (done, frozen)** — canonical register-only helper with bounded `__data.json` barrier + settling precondition. | Verified 384 stable 5/5. Do not rewrite. |
| D3 | **H3/H4 (done, frozen)** — chunk-aware readiness, process-group startup cleanup, dynamic-port stale guard. | Passing; contract frozen. |
| D4 | **Telemetry is additive and non-functional.** | Original diagnostics contract; frozen. |
| D5 | **No production changes, no new sleeps/reloads/timeouts as fixes.** Barriers are event-driven (`waitForResponse` + DOM assertion). | Established `e2e-helper-timing-contract` pattern. |
| D6 | **Gherkin file**: `specs/features/application/workspace-management-e2e-flake.feature` — the 15 existing scenarios are preserved; proposed new scenarios (§7.3) are added only at `on_done` with Orchestrator approval. | Avoids fragmenting one stability contract across files. |
| D7 | **175 is a structural fix, not a selector fix.** The canonical-helper migration did not change flake frequency (3/5 before and after). | `0005-phase5-175-migration-evidence-20260807`. |
| D8 | **276 barrier-first (done, frozen)** — POST 201 / GET 200 / DELETE 204 barriers + deterministic fake RED. | Implemented; contract frozen. |
| D9 | **worker-server.test flake: diagnostics only** — repeated runs, exact failing name + error capture; no lifecycle change without repeated evidence + authorization. | Exact test name not persisted; 2/6 under load is not enough evidence. |
| D10 | **RED documental legacy tests converted to GREEN documentation tests** (done). | Keeps the integration suite fully green without hiding documented races. |
| D11 | **npm audit global failure** is a pre-existing blocker; 0005 records it with evidence and does not count it as 0005 pass/fail. | No masking, no scope expansion. |
| D12 | **Separation of flakes**: stability evidence records per-spec results; flakes in OTHER specs are recorded separately and never counted as 0005 pass/fail. | QA verdict must not declare false full-suite PASS. |
| D13 | **307 is diagnostics-only.** | No confirmed root cause; no fix without evidence. |
| D14 | **Fine-grained helper objects, not monolithic POM.** | Per-flow helpers keep the contract visible. |
| D15 | **Locator policy**: roles/names/labels/domain attributes first; `data-testid` only for uncovered UI contracts. Test IDs do NOT fix timing. | Validated research. |
| D16 | **No workers/sharding/retries/timeouts changes as a fix.** | Masks contention; does not fix root cause. |
| D17 | **Per-spec/per-worker telemetry and stability ledger** (additive). | Operationalizes D12. |
| D18 | **384 frozen.** | QA verified 5/5. |
| D19 | **276 gate**: if the stale-overwrite probe proves a real race, STOP and request user authorization for a minimal `observation-panel.svelte` fix. | No self-authorized production change. (Phase 6 executed; probe GREEN — production untouched.) |
| D20 | **Test-side enhance readiness guard (implemented)** — verifies the enhanced submit path is attached before submit; fails with diagnostics instead of allowing native navigation. | Isolated 9/9×5; full-load still fails. Production and `hydration.ts` remain read-only. |
| D21 | **Failure-time diagnostics contract.** The observer must capture, at failure time: form identity (monotonic id), attach/detach history, submit ordinal (1st/2nd), submit target, `defaultPrevented`, submitter, navigation events, page errors, failed JS resources, and worker context (workerIndex/parallelIndex/port/stderr). Distinguish first/second submit and old/replaced form. | H2/H4 cannot be confirmed or rejected without failure-time evidence. |
| D22 | **Observer is observation-only.** The hook records attach/detach/submit; it NEVER calls `preventDefault`, never dispatches events, never mutates production behavior. | A probe that calls `preventDefault` would mask native navigation (false green). |
| D23 | **Deterministic lifecycle fakes.** The integration fake gains attach/detach, form replacement, stale observer, native fallback, and `defaultPrevented` simulation; RED contracts pin the lifecycle semantics before any E2E change. | Deterministic fakes prove ordering before browser runs (established pattern). |
| D24 | **Evidence gate before any fix.** Phases 9–11 (diagnostics + isolated 175 repetitions + full-suite runs) must produce a decision record; Phase 12 starts only after evidence + user approval. | No fix without confirmed evidence (D1). |
| D25 | **Minimal test-only fix candidates (conditional, Phase 12)**: (a) lifecycle-aware/atomic readiness guard — the guard returns the observed form identity and the submit re-verifies the same node is still connected with the listener immediately before the click, failing fast with diagnostics otherwise; or (b) diagnostic fail-fast — the guard failure includes the full lifecycle snapshot. Choose by evidence; never both; never a worker/timeout/retry/sleep/reload change. | The guard+click non-atomicity is the H2 mechanism; the fix must close it without masking native navigation. |
| D26 | **Production escalation gate.** If the evidence indicates a production Svelte lifecycle defect (form destroyed/replaced by Svelte conditional lifecycle, or the enhanced listener removed by production), STOP and request new user authorization. No production or `hydration.ts` change in this plan. | User authorized investigation, not implementation. |
| D27 | **Stability gate.** After any fix: isolated 175 repetitions (25×7) + 3–5 consecutive full-suite passes (default 4 workers); ledger comparison before/after; verdict counts only the target spec. | Stability requires repeated full-suite passes; no false green. |

---

## 4. Impacted files / contracts

| File | Status | Change |
|------|--------|--------|
| `tests/e2e/helpers/register-workspace.ts` | MODIFY (additive) | Extend the observer hook (D21/D22): attach+detach tracking, per-form monotonic identity, submit capture (ordinal, target, `defaultPrevented`, submitter), snapshot API. Keep `openWorkspaceForm`/`submitRegistration`/`registerWorkspace` contracts intact. Phase 12: lifecycle-aware guard (D25) only after evidence. |
| `tests/e2e/workspace-registration.spec.ts` | MODIFY (additive) | Extend the 175 probe to full diagnostics: worker telemetry (`createWorkerTelemetry`), stability ledger wiring, submit/navigation evidence capture, failure-time snapshot. No behavior change to the test flow. |
| `tests/e2e/helpers/enhance-diagnostics.ts` | ADD (new) | Test-only diagnostics module: observer lifecycle snapshot, submit evidence, worker context capture, ledger formatting. Owned by 0005; never production. |
| `tests/integration/e2e-helpers/workspace-management-flake.test.ts` | MODIFY | Extend `FakeRegistrationPage` (or add `FakeLifecyclePage`) with attach/detach, form replacement, stale observer, native fallback, `defaultPrevented`, submit ordinal. New RED/GREEN describes (Phase 10). |
| `tests/steps/workspace-management-e2e-flake.steps.ts` | MODIFY (at `on_done` only) | Static pins for the approved new scenarios (§7.3). Registered already in `vitest.bdd.config.ts`. |
| `specs/features/application/workspace-management-e2e-flake.feature` | MODIFY (at `on_done` only) | 15 existing scenarios preserved; proposed new scenarios (§7.3) added only with Orchestrator approval. NOT written in this pass. |
| `tests/e2e/helpers/worker-telemetry.ts`, `worker-server.ts`, `stale-process-guard.ts`, `tests/e2e/fixtures.ts`, `playwright.config.ts` | READ-ONLY | H3/H4 contracts frozen. |
| `tests/e2e/helpers/hydration.ts` | READ-ONLY | H1 stabilized. |
| `src/lib/web/components/open-workspace-form.svelte`, `src/routes/+page.server.ts`, `src/lib/server/**` | READ-ONLY | Pinned by `workspace-git-review-ux`. |
| `src/lib/web/components/observation-panel.svelte` (+ `observation-form.svelte`, `observation-card.svelte`, `src/routes/+page.svelte`) | READ-ONLY (conditional) | Only if §12.3 RED fires AND the user authorizes a production fix; requires a planner-only amendment to the product contract. |
| `docs/architecture.md`, `docs/changelog.md` | CONDITIONAL | Only if worker lifecycle/readiness behavior changes (not expected) or a release is made. |

---

## 5. Gherkin / test strategy

### 5.1 Test strategy matrix

| Layer | What it covers | Anti-flake mechanism | Locator strategy |
|-------|----------------|----------------------|------------------|
| Unit (Vitest) | Pure logic: observer snapshot formatting, barrier predicates | Deterministic, no browser | N/A |
| Integration (Vitest) | Helper ordering with fake pages (registration, lifecycle, observation CRUD) | Deterministic fakes, no browser, no network | N/A |
| BDD (quickpickle) | Contract pins: static markers in specs/tests | Static markers, no runtime | N/A |
| E2E (Playwright) | Real browser flows | Event-driven barriers (`waitForResponse` with specific predicates) + bounded timeouts + DOM assertions; no `waitForTimeout`, no reloads | Roles/names/labels first; `data-testid` only for uncovered UI contracts; existing domain attributes |

### 5.2 Locator / test-ID policy

- **Prefer**: `getByRole`, `getByLabel`, `getByText`, and existing domain attributes (`data-line-num`, `data-side`, `data-obs-id`).
- **Add `data-testid` only** when a UI contract has no semantic locator (e.g. the open-workspace toggle/form, which already uses it).
- **Do NOT** add test IDs as a flake fix (175 evidence).

### 5.3 Canonical Gherkin (15 scenarios, preserved — persist at `on_done`)

The 15 scenarios in `specs/features/application/workspace-management-e2e-flake.feature` are preserved verbatim: 2× `@h2`, 1× `@h3`, 2× `@h4`, 2× `@diagnostics`, 3× `@sequential-registration`, 3× `@observation-crud`, 2× `@worker-test-diagnostics`. **Do not rewrite them.**

### 5.4 Proposed new scenarios (planner-owned amendments — NOT persisted in this pass)

These pin the new diagnostic contracts. They are described here only; the `.feature` file is NOT written in this pass. They are added at `on_done` only with Orchestrator approval.

```gherkin
@enhance-diagnostics @e2e @delta-added
Scenario: Failure diagnostics capture form identity, submit evidence, and worker context
  Given a workspace registration fails under full-suite load
  When the failure is captured
  Then the diagnostics record the form identity and attach/detach history
  And the diagnostics record the submit ordinal, target, and defaultPrevented
  And the diagnostics record navigation, page errors, failed resources, and worker context
  And the diagnostics distinguish the first and second submit and old vs replaced forms

@enhance-diagnostics @integration @delta-added
Scenario: The observer records attach, detach, and submit without calling preventDefault
  Given a simulated page attaches and detaches the enhanced submit listener
  When the observer records the lifecycle
  Then attach and detach events are recorded with form identity and timestamps
  And submit events are recorded with ordinal, target, and defaultPrevented
  And the observer never calls preventDefault

@enhance-diagnostics @integration @delta-added
Scenario: The lifecycle-aware guard fails fast when the observed form is replaced
  Given a simulated page replaces the observed form after the listener attaches
  When the guard verifies the form before the submit
  Then the guard fails fast with form-identity diagnostics
  And no native submit occurs
```

---

## 6. Test plan

- **RED**: Phase 9.1–9.3 (observer attach/detach, submit capture, identity); Phase 10.1–10.3 (lifecycle fake contracts); Phase 12.1 (lifecycle-aware guard, conditional).
- **GREEN**: Phase 9.4–9.5 (observer + diagnostics wiring); Phase 10.4 (fake lifecycle support); Phase 12.2 (minimal fix, conditional); all existing unit/integration/BDD/E2E suites pass (npm audit exception per D11).
- **REFACTOR**: `npm run format` (zero diffs; autofix protocol per AGENTS.md if needed), `npm run lint` (`--max-warnings=0`), `npm run check`, `npm run build`; QA hard gate order per AGENTS.md.
- **Stability**: Phase 11 (isolated 175 repetitions + full-suite runs with diagnostics) and Phase 13 (3–5 consecutive full-suite passes, default 4 workers; per-spec ledger; flake separation).

---

## 7. TDD phases / tasks

### Phases 1–8 — original + extended contract (DONE, frozen)

Phases 1–4 (H2/H3/H4 + telemetry), Phase 5 (175 structural split), Phase 6 (276 barriers + probe), Phase 7 (307/worker-server ledgers), Phase 8 (stability ledger + BDD pins + RED-documental conversion + QA) are implemented and QA-verified: unit 678/678, integration 215/215, BDD 607/608 (sole failure: pre-existing npm audit — D11), e2e spec 12/12, format/lint/check/bdd-language clean, build OK. D20 guard passes isolated 9/9×5 but full-suite still fails (native navigation 3/3). **Do not rewrite these contracts.**

### Phase 9 — Failure-time diagnostics instrumentation (RED → GREEN, test-only)

**Objective**: make the 175 failure carry the evidence needed to confirm/reject H2 and H4: form identity, attach/detach, submit ordinal/`defaultPrevented`, navigation, worker context. No behavior change to the test flow.

- [ ] 9.1 **RED (integration)**: "the observer records attach and detach with form identity" — extend the fake contract: `attachListener(formId)` / `detachListener(formId)`; assert the observer snapshot records both events with timestamps and per-form identity. Fails against the current attach-only observer.
- [ ] 9.2 **RED (integration)**: "the observer records submit ordinal, target, and defaultPrevented without calling preventDefault" — fake submit dispatch; assert the snapshot records ordinal (1st/2nd), target form id, `defaultPrevented` flag, and that the observer never invoked `preventDefault`.
- [ ] 9.3 **RED (integration)**: "the diagnostics distinguish old and replaced forms" — fake form replacement; assert the snapshot identifies the old form (detached) vs the current form (connected) and which form each submit hit.
- [ ] 9.4 **GREEN**: implement the observer extension in `tests/e2e/helpers/register-workspace.ts` (or the new `tests/e2e/helpers/enhance-diagnostics.ts`): patch `addEventListener`/`removeEventListener` for `submit`; assign each form a monotonic identity; register an observation-only bubble-phase submit listener (registered after the app listener so `defaultPrevented` is final) that records ordinal/target/`defaultPrevented`/submitter; expose `window.__enhanceObserver.snapshot()`. Never call `preventDefault` (D22). Keep `openWorkspaceForm`/`submitRegistration`/`registerWorkspace` contracts intact.
- [ ] 9.5 **GREEN (E2E)**: wire diagnostics into `tests/e2e/workspace-registration.spec.ts:175` — attach `createWorkerTelemetry` (workerIndex/parallelIndex/port/stderr/pageerror/failed JS resources), the stability ledger (per-spec entries), and the observer snapshot; on failure, attach the full diagnostics to `testInfo` and log the snapshot. No change to the test flow or assertions.
- [ ] 9.6 **REFACTOR**: `npm run format` / `npm run lint` / `npm run check` clean; integration suite green (215/215 + new REDs converted to GREEN docs where applicable).

**Exit criteria**: 9.1–9.3 RED documented; 9.4–9.5 GREEN; no production code touched; no contract rewrite.
**Scenarios covered**: proposed `@enhance-diagnostics` scenarios (§5.4).

### Phase 10 — Deterministic lifecycle fake contracts (RED)

**Goal**: pin the lifecycle semantics deterministically before any E2E change (D23).

- [ ] 10.1 **RED (integration)**: "the current guard can pass while the observed form is replaced before the click (lifecycle false-positive)" — fake: listener attaches to form A; form A is replaced by form B (no listener); the current guard resolves (it only checks the current DOM form has a listener — wait, it must fail against the CURRENT semantics: the guard's predicate queries the current form; if B has no listener the guard would keep waiting → the RED documents that the guard cannot distinguish "listener never attached" from "form replaced after attach" and that the guard+click are non-atomic). Assert the fake records the replacement and the guard outcome is ambiguous (no identity check).
- [ ] 10.2 **RED (integration)**: "the current guard cannot distinguish first from second submit" — two submits; assert the fake records no ordinal and no per-submit `defaultPrevented` (fails against current observer).
- [ ] 10.3 **RED (integration)**: "a stale observer record must not satisfy the guard" — observer records form A's listener; form A is detached; assert the guard must not be satisfied by the stale record (fails against current predicate which queries the current DOM — documents the contract).
- [ ] 10.4 **GREEN**: implement the fake lifecycle support (`FakeLifecyclePage` or extend `FakeRegistrationPage`): attach/detach, replacement, stale observer, native fallback (no listener → submit navigates), `defaultPrevented` capture, submit ordinal. All 10.1–10.3 REDs become GREEN with the new fake semantics.

**Acceptance**: 10.1–10.3 RED documented; 10.4 GREEN; no E2E change yet.
**Scenarios covered**: proposed `@enhance-diagnostics` integration scenarios (§5.4).

### Phase 11 — Evidence gate: isolated 175 repetitions + full-suite runs (diagnostics)

**Goal**: collect the failure-time evidence that decides the fix direction (D24). No fix is applied in this phase.

- [x] 11.1 **Isolated 175 repetitions**: 175/175 target runs passed across 7 batches of 25 with diagnostics and ledger records.
- [x] 11.2 **Full-suite runs**: five default-worker runs completed; target 175 passed in all five. One unrelated line-113 failure is separated per D12.
- [x] 11.3 **Evidence synthesis**: target diagnostics showed connected enhanced forms, `defaultPrevented=true`, no page/resource errors; H2/H4 were not reproduced and no Phase 12 fix is justified.
- [x] 11.4 **Decision gate**: no fix direction authorized because the target is stable; preserve the evidence and proceed to finalization without Phase 12.

**Acceptance**: an evidence record exists; the fix direction is decided by evidence; no change applied without it.
**Scenarios covered**: proposed `@enhance-diagnostics` scenarios (§5.4).

### Phase 12 — Conditional minimal test-only fix (RED → GREEN, only after evidence + user approval)

**Goal**: the smallest test-only change that eliminates the confirmed failure mode without masking native navigation (D25).

- [x] 12.1–12.4 **SKIPPED BY EVIDENCE**: no Phase 12 fix was applied because Phase 11 target evidence was green and H2/H4 were not reproduced. Gate B is not needed unless a future target failure recurs.

**Acceptance**: the RED is documented; the fix is minimal and test-only; no production change; no false green.
**Scenarios covered**: proposed `@enhance-diagnostics` lifecycle-aware guard scenario (§5.4).

### Phase 13 — Stability protocol (after any fix)

**Goal**: prove stability with repeated full-suite passes (D27).

- [x] 13.1–13.3 **Baseline stability satisfied without a new fix**: 175/175 isolated repetitions and five full-suite runs passed for target 175; no native navigation was recorded. Unrelated full-suite flakes remain separately documented.

**Acceptance**: 3–5 consecutive full-suite passes for the target spec; ledger evidence; no false green.
**Scenarios covered**: `@diagnostics` (stability ledger) + proposed `@enhance-diagnostics` scenarios.

### Phase 14 — Final QA + BDD pins + verdict

- [x] 14.1 Final quality gates: format/lint/check/unit/integration/bdd-language/build pass; target BDD 18/18 and E2E target 9/9 pass. Global BDD has only the pre-existing D11 npm audit exception; full QA stops there by design.
- [x] 14.2 **BDD pins persisted**: three new scenarios added to the canonical feature at `on_done`; 18/18 static pins pass in `tests/steps/workspace-management-e2e-flake.steps.ts`.
- [x] 14.3 Docs unchanged because no product/architecture behavior changed.
- [x] 14.4 Final verdict recorded with D12 separation, QA PASS, and memory writes.

**Acceptance**: full QA with documented pre-existing exceptions; 3–5 clean full-suite runs for the target spec; no false full-suite PASS claim.

---

## 8. Test matrix (summary)

| Layer | Files | What it covers | Anti-flake mechanism |
|-------|-------|----------------|----------------------|
| Unit (Vitest) | `tests/unit/` (existing) | Pure logic: observer snapshot, barrier predicates | Deterministic, no browser |
| Integration (Vitest) | `tests/integration/e2e-helpers/workspace-management-flake.test.ts` | Fake lifecycle contracts (attach/detach, replacement, stale, native, `defaultPrevented`, ordinal) | Deterministic fakes, no browser, no network |
| BDD (quickpickle) | `tests/steps/workspace-management-e2e-flake.steps.ts` | Contract pins: static markers | Static markers, no runtime |
| E2E (Playwright) | `tests/e2e/workspace-registration.spec.ts` | Real browser flow with diagnostics | Event-driven barriers + bounded timeouts + DOM assertions; no `waitForTimeout`, no reloads |

---

## 9. Risks

| Risk | Mitigation |
|------|------------|
| 175 residual flake is worker/browser degradation, not helper logic (H4). | Phase 9/11 diagnostics capture worker context; do NOT change workers/timeouts/retries (D16). If the ledger shows a specific worker, report to Orchestrator — no self-authorized change. |
| The observer extension changes test behavior. | D22: observation-only; never `preventDefault`, never dispatch; additive; integration REDs pin the contract. |
| The lifecycle-aware guard (12.2) could mask native navigation. | The guard fails fast with diagnostics; it never calls `preventDefault`; the E2E flow still asserts the DOM contract. |
| Evidence is inconclusive (H2 vs H4). | Phase 11.4 decision gate: no fix without evidence; report to Orchestrator. |
| Production Svelte lifecycle defect is confirmed. | Hard gate (D26, §12.3): STOP and request new authorization; no production/hydration change in this plan. |
| The isolated 175 repetitions are slow. | 25 runs × ~15s ≈ 6–10 min per batch; the protocol is explicit and bounded; no timeout inflation. |
| Other-spec flakes contaminate the stability verdict. | D12 per-spec ledger; only the 175 test counts for 0005. |
| BDD pins drift from the implementation. | Pins are static markers; added at `on_done` only with Orchestrator approval; `check:bdd-language` clean. |
| npm audit pre-existing failure blocks the BDD gate. | D11: evidence separation; 0005 scenarios pass; audit recorded as pre-existing blocker. |
| Test-ID additions creep in as a "fix". | D15 locator policy. |

---

## 9. Assumptions

- QA evidence stands: 384 stable 5/5; H3/H4 pass; 175 failed 3/5 before and after the canonical-helper migration; D20 guard passes isolated 9/9×5 but full-suite still fails (native navigation 2/3); 276/307/338 and worker-server contracts frozen.
- 175 is a test-infrastructure timing/lifecycle sensitivity, not a product regression, until the Phase 11 evidence says otherwise.
- The event-driven bounded-barrier pattern is the accepted stabilization idiom; no new external docs needed beyond the SvelteKit/Playwright references consulted (see §10).
- `gherkin.persist_to_repo.when: on_done` — no `.feature` files are written in this planning pass; the 15 existing scenarios are preserved; proposed new scenarios (§5.4) are described in this plan only until approval.
- The user must approve this plan (Gate A) before any implementation; the conditional fix (Phase 12) requires a second approval (Gate B) after the evidence.
- No production behavior change is required unless §12.3 demonstrates a real production defect and the user authorizes it.
- `delegation.md`/`state.md` are owned by the Orchestrator; this pass updates only `plan.md`.

---

## 10. External documentation consulted

- **SvelteKit form actions (`use:enhance`)** — official docs (Context7 `/sveltejs/kit`): `use:enhance` attaches a submit listener to the form element and, on success, calls `refreshAll()` (invalidateAll); the fallback callback resets the form and invalidates only on `result.type === 'success'`. Confirms the enhanced listener is a direct `submit` listener that synchronously calls `preventDefault` (verified against local SvelteKit 2.70.1 source) — so `defaultPrevented` at submit time is a valid discriminator between enhanced and native submission. No framework change.
- **Playwright docs (context7 `/microsoft/playwright`)**: `page.on('framenavigated')`, `page.on('pageerror')`, `page.on('requestfailed')` (note: HTTP error statuses are NOT `requestfailed`), `workerInfo.workerIndex` (unique per worker process; new index after restart) and `parallelIndex`. Informs the diagnostics design: worker context must come from `workerInfo`/fixtures; `requestfailed` complements `response`-based resource capture.

---

## 11. Stability protocol

1. **Baseline (Phase 11)**: isolated 175 repetitions (25 runs) + 3–5 full-suite runs with diagnostics; ledger record.
2. **After fix (Phase 13)**: isolated 175 repetitions (25 runs) + 3–5 consecutive full-suite runs (default 4 workers); ledger comparison vs baseline.
3. **Verdict**: stability PASS only if zero flakes in the 175 test across all runs AND the evidence shows no native navigation. Other-spec flakes are recorded separately and never counted (D12).

---

## 12. Rollback / stop conditions

- **STOP (no fix)**: evidence inconclusive (Phase 11.4); no change applied.
- **STOP (production defect)**: evidence indicates a production Svelte lifecycle defect → STOP, request new authorization (Gate C), no production/hydration change in this plan.
- **STOP (constraint violation)**: any attempt to fix via retries/sleeps/reloads/timeout inflation/worker changes/`preventDefault` in a probe → STOP, report to Orchestrator.
- **STOP (regression)**: if the 175 test fails after the fix in a way the diagnostics show a NEW failure mode → STOP, report, no further change without evidence.
- **Rollback**: all changes in this plan are test-infrastructure-only and additive; rollback = `git revert` of the test files (no production impact). The ledger and diagnostics are additive and can be removed without behavior change.

---

## 13. Quality gates

Per AGENTS.md, `npm run qa` runs in order; any failure means FAIL:

| Stage | Command | Criterion |
|-------|---------|-----------|
| Format | `npm run format` | No differences |
| Lint | `npm run lint` | `--max-warnings=0` |
| Types | `npm run check` | No type errors |
| Unit | `npm run test:unit` | 100% passing |
| Integ. | `npm run test:integration` | 100% passing |
| BDD language | `npm run check:bdd-language` | No Spanish in BDD |
| BDD | `npm run test:bdd` | 100% passing |
| E2E | `npm run test:e2e` | 100% passing |
| Build | `npm run build` | Successful build |

Pre-existing exception: npm audit scenario (D11) — recorded with evidence, never counted as 0005 pass/fail.

---

## 14. Approval gates (explicit user approval)

- **Gate A — this plan**: the user must approve this plan before any implementation. The Orchestrator confirms approval; the Developer does not start before that.
- **Gate B — conditional fix (Phase 12)**: after Phase 11 evidence, the user must approve the minimal test-only fix direction (lifecycle-aware atomic guard vs diagnostic fail-fast) before implementation.
- **Gate C — production escalation (Phase 12.3)**: if the evidence indicates a production Svelte lifecycle defect, the user must grant NEW authorization for any production change; otherwise the plan ends with the evidence record.

---

## 15. Skills / delegation order

**Planner (this pass)**: `mind-management`, `clean-svelte-architecture`, `clean-code`, `svelte-code-writer`, `documentation-lookup`, `IADEV-writing-gherkin`, `IADEV-bdd-implementation`, `IADEV-writing-implementation`. External docs consulted via Context7 (SvelteKit, Playwright).

**Developer (FULL, never mini)**: `mind-management`, `clean-svelte-architecture`, `clean-code`, `IADEV-test-driven-development`, `IADEV-bdd-implementation`, `IADEV-applying-feedback`. `svelte-code-writer` NOT required unless Gate C authorizes a `.svelte` change (then it becomes mandatory).

**QA/Tester**: `mind-management`, `IADEV-validating-implementation`, `IADEV-bdd-implementation`.

**Order**: Phase 9 (RED + diagnostics) → QA gate → Phase 10 (RED fakes) → QA gate → Phase 11 (evidence) → Gate B → Phase 12 (conditional fix) → QA gate → Phase 13 (stability) → Phase 14 (final QA + BDD pins + verdict).

---

## 16. Memory writes (this pass)

- `0005-revision3-diagnostics-plan-20260807` — decision memory: revision 3 plan (D21–D27, Phases 9–14, evidence gates) approved for review; user approval pending.
- `0005-diagnostics-contract-20260807` — discovery memory: observer contract (attach/detach, identity, ordinal, `defaultPrevented`, snapshot API) and fake lifecycle contracts.
- Update checkpoint `checkpoint-2026-08-06T19-06-01-583Z` with the plan state.

## 17. Final observed magnitude

- Phase 9: one new diagnostics helper plus three modified test files.
- Phase 10: one modified integration file, approximately 238 added lines.
- Gherkin on_done: three scenarios, 26 added lines.
- Phase 14: one modified step file, 14 static pin definitions.
- Active duration: not instrumented.
