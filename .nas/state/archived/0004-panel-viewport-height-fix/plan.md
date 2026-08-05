# Plan: 0004-panel-viewport-height-fix

**Status**: planning (approval pending)
**Feature**: 0004-panel-viewport-height-fix
**Planner**: nas_planner (lightweight mode — simple complexity, approval-ready)
**Date**: 2026-08-05
**Gherkin persistence**: `when=on_done` — NO `.feature` files are written by this pass.
**Routing**: complexity simple / magnitude medium → `nas_developer` FULL.
Matrix: simple+medium → FULL; a visual layout contract with multi-breakpoint
geometry (2 desktop sizes × expanded/collapsed right, 3 mobile sizes) justifies
full routing. No mini.

---

## 1. Executive summary

Desktop CSS Grid placement defect in the web shell: `.shell-layout` defines
`grid-template-rows: 1fr auto` (0003 left footer row), but the center and right
direct grid items are confined to row 1. At 1280×720 and 1440×800 both regions
end 29 px above the viewport bottom while the left region reaches the bottom
through its row-2 footer.

The fix is a minimal, desktop-scoped grid placement change in
`src/routes/+page.svelte`: center spans rows 1/-1 at column 3, right panel
(expanded `.right-panel` and collapsed `.right-panel-strip-wrap`) spans rows
1/-1 at column 4. Row span MUST be paired with explicit columns (research H4:
row span without columns reorders regions via Grid auto-placement). The left
footer row, bottom controls, mobile behavior, and all internal
flex/min-height/overflow rules are untouched — H2/H3 rejected those as causes.

No backend/API/domain/persistence/dependency/shared-kit changes. New
browser-observable geometry tests (E2E) plus marker-based BDD step
strengthening make the bottom-boundary contract testable, and a small
`docs/design.md` update documents the shell row contract.

---

## 2. User requirement (controlling) → target contract

| Requirement                                                                           | Target behavior                                                                                                                                                                                                |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Central and right panel regions reach the bottom of the viewport like the left region | Desktop center work area bottom == viewport bottom; right panel (expanded) and right strip (collapsed) bottom == viewport bottom; x positions unchanged                                                        |
| Do not break bottom controls                                                          | Left footer stays bottom-most with expanded full-left-region width and collapsed rail width; right footer/reopen/collapse controls keep current behavior; Reset Layout stays a fixed overlay, never a grid row |
| Do not break mobile layout                                                            | Mobile shell/center/rail/toggle bottom containment, sheet anchoring, and no-document-scroll remain unchanged at 320×568, 375×667, 768×800                                                                      |

---

## 3. Scope

### In scope (web shell + tests + steps + docs)

- `src/routes/+page.svelte` — desktop grid placement only:
  - `.center-content`: `grid-column: 3; grid-row: 1 / -1;` scoped to desktop (`.shell-layout:not(.is-mobile)`).
  - Right panel roots (child-component root elements of `RightPanelTabs`): `.right-panel-strip-wrap` and `.right-panel:not(.mobile-sheet)` get `grid-column: 4; grid-row: 1 / -1;`, scoped to desktop.
  - `:global()` targeting: use `.shell-layout:not(.is-mobile) :global(.right-panel-strip-wrap)` and `.shell-layout:not(.is-mobile) :global(.right-panel:not(.mobile-sheet))` — guaranteed to reach child-component roots regardless of Svelte scoping; verified against Svelte 5 docs (scoped styles/FAQ: child-created elements require `:global()` for guaranteed matching).
  - Mobile block `.shell-layout.is-mobile`: add explicit `grid-template-rows: 1fr;` (zero visual change — the left footer is `display: none` on mobile; computed rows go from `667px 0px` to `667px`). This makes the weak marker `grid-template-rows: 1fr` truthful and independent from the desktop `1fr auto` rule. See Assumption A1.
- `tests/e2e/viewport-height.spec.ts` — **NEW** browser-observable geometry suite.
- `tests/steps/ui-redesign.steps.ts` — new marker steps for the desktop bottom-boundary scenarios.
- `tests/steps/mobile-hardening.steps.ts` — strengthen the two weak mobile markers (`grid-template-rows: 1fr` → `grid-template-rows: 1fr;`) and add mobile geometry steps.
- `docs/design.md` — small update: viewport-bound shell paragraph (~927-932) and Panel controls W9/0003 section (~1181-1196) document that center/right span the full shell height on desktop and mobile is an explicit single row.
- Canonical Gherkin `specs/features/product/panel-viewport-height-fix.feature` — persisted ONLY at `on_done` approval (see §6).

### Out of scope (do NOT touch)

- Server/API/domain/infrastructure/persistence/routes/DTOs/migrations.
- `package.json` / `package-lock.json` / Playwright / Vitest / quickpickle configs / CI / `.agents/nas.config.yaml`.
- Shared UI kit (`src/lib/web/components/ui/**`), `panel-layout-store.ts`, `right-panel-tabs.svelte`, `rail-tabs.svelte`, `open-files-tabs.svelte` and all other components — internal flex/overflow rules are confirmed correct (H2 rejected).
- `grid-template-rows: 1fr auto` on the desktop shell — stays (0003 footer contract).
- Mobile markup/behavior beyond the zero-visual-change explicit single-row declaration (A1).
- `docs/architecture.md`, `docs/PRD.md`, `docs/domain.md`, `docs/versioning.md` — no architectural/product/domain change. Changelog entry: only if the user requests it (see Assumption A2).
- No `.feature` files persisted during this pass (`when=on_done`).

### Regressions to protect (must stay green)

1. 0003 left-region footer: bottom-most control in both states, `grid-column: 1 / 3`, Help above (ui-redesign markers + panel-rail-ux-corrections feature).
2. Right panel width/right-edge flush, collapse/reopen/focus continuity (panel-resize, panel-rail-corrections, rail-tabs suites).
3. Mobile drawer/sheet/rail/toggle behavior and no-document-scroll (responsive-mobile, mobile-hardening).
4. Scroll ownership (viewport-scroll): page never scrolls; zones own their scroll.
5. Reset Layout fixed overlay (never a height-defining row).

---

## 4. Confirmed root cause and rejected alternatives

### Confirmed root cause (research H1 + H4, validated by live runtime measurements)

`src/routes/+page.svelte:733-734` — `.shell-layout` uses
`grid-template-rows: 1fr auto`; the left footer (authored last, explicit
`grid-column: 1 / 3`) auto-places into row 2. Center (`main.center-content`)
and right (`RightPanelTabs` roots) are auto-placed in row 1 only. Runtime at
1280×720: rows `691px 29px`; center/right bottom = 691, left footer bottom = 720. At 1440×800 the same 29 px gap appears. Causal chain: desktop grid has two
rows → center/right items are single-row items → their bottom edge is the row-1
boundary → 29 px gap above the viewport bottom.

### Rejected alternatives

| Alternative                                      | Why rejected                                                                                                                                                                                    |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fix internal flex/min-height/overflow rules (H2) | Not the cause: `right-panel-tabs.svelte` already has `min-height: 0`, flexible body/footer, internal scroll ownership. Extending the outer grid item makes internals reach the bottom correctly |
| Mobile breakpoint / viewport-unit change (H3)    | Not the cause: mobile 375×667 already reaches the bottom (`667px 0px` rows); mobile must remain unchanged                                                                                       |
| Row span without explicit columns                | Confirmed reorder (H4): runtime injection of only `grid-row: 1 / -1` moved center/right into earlier columns via Grid auto-placement. Explicit `grid-column: 3`/`4` is mandatory                |
| Making the footer `position: fixed` or absolute  | Would change z-order/overlay behavior and break 0003 focus/geometry contracts; the footer row is correct — the row-1 items were wrong                                                           |
| Universal (mobile+desktop) row-span rule         | Mobile grid has 3 columns (`48px 1fr 32px`); `grid-column: 3` would place center in the toggle column. Desktop scoping is required                                                              |
| JS-based height calculation (ResizeObserver)     | Unnecessary: CSS Grid placement is the native mechanism; avoids resize-loop fragility                                                                                                           |

### Minimal fix boundary

Exactly: grid placement rules in `src/routes/+page.svelte` `<style>` (desktop
row-span + explicit columns; explicit mobile single-row declaration), new
viewport-height E2E spec, marker updates in two steps files, canonical Gherkin
(persisted at on_done), small `docs/design.md` update. Nothing else.

---

## 5. Technical approach and design decisions

1. **Desktop row-span with explicit columns (the fix).** Add to
   `+page.svelte` `<style>`:
   ```css
   /* 0004: center and right regions span the full shell height (rows 1/-1)
      so they reach the same bottom boundary as the left footer region.
      Explicit columns keep Grid auto-placement from reordering regions. */
   .shell-layout:not(.is-mobile) .center-content {
     grid-column: 3;
     grid-row: 1 / -1;
   }
   .shell-layout:not(.is-mobile) :global(.right-panel-strip-wrap),
   .shell-layout:not(.is-mobile) :global(.right-panel:not(.mobile-sheet)) {
     grid-column: 4;
     grid-row: 1 / -1;
   }
   ```
   Rationale: center is a direct child (scoped selector works); the right
   panel roots are child-component roots of `RightPanelTabs` — `:global()` is
   the guaranteed mechanism per Svelte 5 docs (FAQ: elements created by child
   components need `:global()` for guaranteed matching; scoped styles doc).
   `:not(.mobile-sheet)` excludes the mobile sheet class defensively; the
   desktop scope `.shell-layout:not(.is-mobile)` guarantees zero mobile
   impact. The 0003 footer (`grid-column: 1 / 3`, auto row 2) and
   `grid-template-rows: 1fr auto` stay untouched.
2. **Mobile single-row contract (zero visual change).** Add
   `grid-template-rows: 1fr;` to the existing `.shell-layout.is-mobile` block
   (currently only columns). The footer is `display: none` on mobile, so the
   only computed change is `667px 0px` → `667px` — identical rendering. This
   converts the weak marker `grid-template-rows: 1fr` (which today
   false-positives against `1fr auto`) into a truthful, mobile-scoped
   contract. Independent geometry E2E proves no visual regression.
3. **Testing strategy — browser-observable geometry first.** Existing tests
   never assert shared bottom boundaries (H5). New `viewport-height.spec.ts`
   asserts bounding-box bottoms against the viewport (tolerance ≤ 2 px for
   `100dvh`/rounding) at 1280×720 and 1440×800 (expanded and collapsed right),
   left footer bottom/widths, and mobile containment at 320×568, 375×667,
   768×800 — reusing the `setViewportSize + reload + .is-mobile barrier`
   pattern from `mobile-hardening.spec.ts`. BDD steps stay marker-based per
   repo convention (quickpickle + `requireMarker`), with the new desktop
   markers (`grid-row: 1 / -1`, `grid-column: 3`, `grid-column: 4`) failing
   before the fix (RED) and passing after (GREEN).
4. **Routing rationale.** simple complexity + medium magnitude → FULL
   developer routing. The change is one CSS surface, but the acceptance
   contract spans five viewports and two right-panel states, and the visual
   layout contract requires full Red→Green→Refactor discipline with
   multi-breakpoint E2E evidence. QA audits geometry claims against the
   persisted feature scenarios.

---

## 6. Canonical Gherkin scenarios (persisted at on_done approval)

New canonical file: `specs/features/product/panel-viewport-height-fix.feature`
(English only; `check:bdd-language` must stay green). Tags: `@product`
(+ `@layout` / `@responsive` / `@e2e`). All scenarios `@delta-added`.

```gherkin
@product @panel-viewport-height-fix @layout @responsive @e2e
Feature: Panel viewport height fix

  The central work area and the right panel reach the same bottom boundary
  as the left region on desktop viewports, while the left footer and the
  mobile layout keep their current geometry.

  Background:
    Given DiffScribe is started
    And a workspace is registered and active

  @product @layout @e2e @delta-added
  Scenario: Central area and right panel reach the viewport bottom on desktop
    Given the viewport is 1280 by 720 pixels on desktop
    When the user measures the region geometry
    Then the central area bottom edge equals the viewport bottom
    And the right panel bottom edge equals the viewport bottom
    And the right panel right edge aligns with the viewport right edge
    And the document does not scroll

  @product @layout @e2e @delta-added
  Scenario Outline: Regions reach the bottom at common desktop sizes
    Given the viewport is <width> by <height> pixels on desktop
    When the user measures the region geometry
    Then the central area bottom edge equals the viewport bottom
    And the right panel bottom edge equals the viewport bottom
    And the document does not scroll

    Examples:
      | width | height |
      | 1280  | 720    |
      | 1440  | 800    |

  @product @layout @e2e @delta-added
  Scenario: Collapsed right strip reaches the viewport bottom
    Given the viewport is 1280 by 720 pixels on desktop
    When the user collapses the right panel
    Then the right strip bottom edge equals the viewport bottom
    And the right strip keeps its rail width

  @product @layout @e2e @delta-added
  Scenario: Left footer stays bottom-most and keeps its widths
    Given the viewport is 1280 by 720 pixels on desktop
    When the user measures the left footer geometry
    Then the left footer bottom edge equals the viewport bottom
    And the left footer spans the left panel width when expanded
    When the user collapses the left panel
    Then the left footer spans only the rail width
    And the left footer stays bottom-most

  @product @responsive @e2e @delta-added
  Scenario Outline: Mobile layout still reaches the viewport bottom
    Given the viewport is <width> by <height> pixels on mobile
    When the user measures the mobile region geometry
    Then the central area reaches the viewport bottom
    And the rail and the right panel toggle reach the viewport bottom
    And the document does not scroll
    When the user opens the right panel sheet
    Then the sheet bottom is anchored to the viewport bottom

    Examples:
      | width | height |
      | 320   | 568    |
      | 375   | 667    |
      | 768   | 800    |
```

The `When … Then … When … Then` flow in two scenarios mirrors the approved
0003 `panel-rail-ux-corrections.feature` state-transition style. Step
definitions must be added in `tests/steps/ui-redesign.steps.ts` (desktop) and
`tests/steps/mobile-hardening.steps.ts` (mobile) for every step above.

No changes to existing features: `panel-rail-ux-corrections.feature` (left
footer scenarios) stays as-is; no scenario describes the center/right bottom
boundary today, so there is nothing to modify or remove.

---

## 7. Phased implementation (Red → Green → Refactor)

QA commands (every REFACTOR step, sequential on one host — never concurrent
BDD+E2E):
`npm run format && npm run lint && npm run check && npm run test:unit && npm run test:integration && npm run check:bdd-language && npm run test:bdd`
E2E (after BDD completes, alone): `npm run test:e2e -- --workers=8` — exactly
8 workers, never another count, never concurrent with BDD.

### Phase 1 — RED: failing geometry tests and step markers

Objective: prove the defect with browser-observable tests and add the marker
steps that fail until the grid placement exists.

Tasks:

1.1. Create `tests/e2e/viewport-height.spec.ts` — **NEW**:

- Desktop expanded (1280×720, 1440×800): `center-content` bottom
  (`boundingBox().y + height`) == viewport height (±2 px); right panel
  (`.right-panel:not(.mobile-sheet)` — expanded branch) bottom == viewport
  height; right edge == viewport width; no document scroll
  (`scrollHeight <= clientHeight + 1`).
- Desktop collapsed right (1280×720): click `right-panel-collapse-btn`, then
  `.right-panel-strip-wrap` bottom == viewport height; strip width == 48 px.
- Left footer (1280×720): `left-region-footer` bottom == viewport height;
  expanded width == 48 + left panel width (default 300 → ≈348); collapse
  (`left-panel-collapse-btn`) → width == 48 px; footer stays bottom-most.
- Mobile (320×568, 375×667, 768×800): apply `setViewportSize + reload` and
  wait for the `.is-mobile` class barrier (reuse `mobile-hardening` pattern);
  shell/center/rail/toggle bottoms == viewport height (±2 px); no document
  scroll; open sheet via `mobile-right-panel-toggle`, sheet bottom == viewport
  bottom (barrier from `waitForSheetSettled`).
- Acceptance: every test FAILS on the current tree with the 29 px gap
  (or missing marker) — run `npm run test:e2e -- --workers=8` and record the
  failing geometry before any source change.

1.2. Update `tests/steps/mobile-hardening.steps.ts`:

- `Then('the right panel toggle spans the full center content height')` and
  `Then('the mobile shell has no extra grid row')`: replace marker
  `'grid-template-rows: 1fr'` with `'grid-template-rows: 1fr;'` (trailing
  semicolon makes it match only the explicit mobile single-row rule, not the
  desktop `1fr auto`).
- Add mobile geometry steps for the new scenarios (center/rail/toggle reach
  bottom; sheet anchored) using the same markers plus
  `'grid-template-columns: 48px 1fr 32px'`.
- Acceptance: `npm run test:bdd` fails on the missing `grid-template-rows: 1fr;`
  marker (RED).

1.3. Update `tests/steps/ui-redesign.steps.ts`:

- Add steps for the desktop scenarios: `Given the viewport is {int} by {int} pixels on desktop`
  (marker `grid-template-rows: 1fr auto`), `When the user measures the region
geometry`, `Then the central area bottom edge equals the viewport bottom`
  (markers `grid-column: 3` + `grid-row: 1 / -1`), `Then the right panel bottom
edge equals the viewport bottom` / `Then the right strip bottom edge equals
the viewport bottom` (markers `grid-column: 4` + `grid-row: 1 / -1`), right
  edge alignment, document no-scroll, and the left-footer geometry steps
  (markers `left-region-footer`, `grid-column: 1 / 3` — already present).
- Acceptance: `npm run test:bdd` fails on the missing `grid-row: 1 / -1` /
  `grid-column: 3` / `grid-column: 4` markers (RED).

Exit criteria: new E2E spec demonstrably red; BDD step suite red on the new
markers; no source file changed yet.
Scenarios covered: all @delta-added scenarios (contract defined in tests).

### Phase 2 — GREEN: minimal grid placement change

Objective: smallest behavior change that satisfies the red tests.

Tasks:

2.1. `src/routes/+page.svelte` `<style>`:

- Add the desktop rules from §5 (`.shell-layout:not(.is-mobile) .center-content`
  → `grid-column: 3; grid-row: 1 / -1;`; `.shell-layout:not(.is-mobile)
:global(.right-panel-strip-wrap)` and `.shell-layout:not(.is-mobile)
:global(.right-panel:not(.mobile-sheet))` → `grid-column: 4;
grid-row: 1 / -1;`) with the 0004 comment.
- Add `grid-template-rows: 1fr;` to the `.shell-layout.is-mobile` block with a
  comment stating the mobile single-row contract (Assumption A1).
- Do NOT touch `grid-template-rows: 1fr auto`, the footer item, resize
  handles, `reset-layout-btn`, or any component file.
- Acceptance: `npm run test:bdd` green (all markers, including the new ones);
  `npm run test:e2e -- --workers=8` — the new `viewport-height.spec.ts` and the
  protected suites (responsive-mobile, mobile-hardening, panel-rail-corrections,
  panel-resize, viewport-scroll, ui-shell) all green.

2.2. If `check:bdd-language` or lint flags the new step text, fix wording in
the steps files only (English only).

Exit criteria: Phase-1 red tests green; protected regression suites green.
Scenarios covered: all @delta-added scenarios.

### Phase 3 — REFACTOR: docs, full QA, persistence prep, memory

Objective: quality gates, design-doc alignment, and everything needed for
`on_done` persistence and handoff.

Tasks:

3.1. `docs/design.md` (via `docs-writer`):

- Viewport-bound shell paragraph (~927-932): add that desktop center/right
  regions span the full shell height (`grid-row: 1 / -1` with explicit
  `grid-column: 3` / `4`) so all three regions share the viewport bottom
  boundary; mobile shell is an explicit single grid row.
- Panel controls W9/0003 section (~1181-1196): one sentence that center/right
  row-span guarantees the bottom boundary shared with the left footer.
- Acceptance: docs consistent with implementation; no other doc file touched.

3.2. Full QA chain (sequential, one host):
`npm run qa` then `npm run test:e2e -- --workers=8`. Every stage must pass
(format, lint, check, unit, integration, bdd-language, bdd, e2e, build).
Acceptance: all green with explicit 8-worker Playwright evidence.

3.3. Gherkin persistence prep (NO writes now): the canonical feature from §6
is staged for the `on_done` write; developer synchronizes step definitions
with scenario wording at approval time (per IADEV-bdd-implementation
coverage rule: every scenario mapped to a test).

3.4. Memory writes (see §10): persist the approved decision and plan summary
on approval.

Exit criteria: docs updated; full QA green; persistence-ready artifacts.
Scenarios covered: all; full-suite regression protection.

---

## 8. Impacted files (complete inventory)

| File                                                       | Change                                                                                                             |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `src/routes/+page.svelte`                                  | Desktop row-span + explicit columns for center/right; explicit mobile single-row declaration (CSS only, no markup) |
| `tests/e2e/viewport-height.spec.ts`                        | **NEW** — desktop/mobile bottom-boundary geometry suite                                                            |
| `tests/steps/ui-redesign.steps.ts`                         | New desktop viewport/footer marker steps                                                                           |
| `tests/steps/mobile-hardening.steps.ts`                    | Strengthened mobile single-row markers + new mobile geometry steps                                                 |
| `docs/design.md`                                           | Shell row contract: center/right row-span; mobile single row                                                       |
| `specs/features/product/panel-viewport-height-fix.feature` | **NEW** — persisted ONLY at `on_done` (this pass writes nothing)                                                   |
| `.nas/state/active/0004-panel-viewport-height-fix/plan.md` | This file — CREATED                                                                                                |

Explicitly NOT touched: any `src/lib/server/**`, domain/infrastructure/API,
`right-panel-tabs.svelte`, `rail-tabs.svelte`, `panel-layout-store.ts`,
`ui/**`, configs, `package*.json`, other docs, `.nas/**` beyond this folder.

---

## 9. Test plan

- **RED** (Phase 1): `tests/e2e/viewport-height.spec.ts` fails showing the
  29 px gap at 1280×720 / 1440×800 and missing collapsed-strip/mobile
  assertions; `npm run test:bdd` fails on new markers (`grid-row: 1 / -1`,
  `grid-column: 3`, `grid-column: 4`, `grid-template-rows: 1fr;`). Proof
  recorded before source changes.
- **GREEN** (Phase 2): the CSS placement lands; new E2E + BDD green; protected
  suites (responsive-mobile, mobile-hardening, panel-rail-corrections,
  panel-resize, viewport-scroll, ui-shell, rail-tabs) stay green.
- **REFACTOR** (Phase 3): `npm run format` (format:fix protocol if needed —
  verify diff is formatting-only), `npm run lint` (max-warnings=0), `npm run
check`, `npm run test:unit`, `npm run test:integration`, `npm run
check:bdd-language`, `npm run test:bdd`, then E2E alone
  `npm run test:e2e -- --workers=8` (exactly 8 workers; never concurrent with
  BDD), then `npm run build`.
- Geometry tolerance: ±2 px for `100dvh`/viewport rounding.
- Layers: E2E is the contract layer (browser-observable geometry); BDD markers
  pin the CSS contract; unit/integration untouched (no behavior change).

---

## 10. Risks and mitigations

| Risk                                                                 | Mitigation                                                                                                                             |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Row span without columns reorders regions (confirmed)                | Explicit `grid-column: 3` / `4` paired with `grid-row: 1 / -1`; E2E asserts x positions (right edge flush, center unchanged)           |
| `:global()` targeting misses or leaks to the mobile sheet            | Desktop scope `.shell-layout:not(.is-mobile)` + `:not(.mobile-sheet)`; verified Svelte 5 scoping docs; E2E mobile suite proves no leak |
| Mobile row declaration changes computed rows (`667px 0px` → `667px`) | Zero visual change (footer `display: none`); E2E bottom containment at 320/375/768 proves equivalence; flagged as Assumption A1        |
| `100dvh` / viewport rounding makes equality assertions flaky         | ±2 px tolerance; barrier waits (`networkidle`, `.is-mobile` class) before measuring                                                    |
| Existing suites assert old row-1 geometry                            | Research H5: no existing test asserts shared bottom boundaries; protected suites cover width/right-edge/footer/mobile — all stay green |
| Working tree contains prior changes/untracked NAS artifacts          | Only the §8 file list may change; QA audits the change window                                                                          |
| BDD marker substring false positives (`1fr` inside `1fr auto`)       | Markers strengthened to `grid-template-rows: 1fr;` (trailing semicolon) and new unique markers (`grid-column: 3`, `grid-column: 4`)    |
| E2E flakiness with 8 workers / host contention                       | Sequential BDD→E2E on one host; exact `--workers=8`; no parallel runs                                                                  |

---

## 11. Assumptions (orchestrator must confirm)

- **A1 — Mobile single-row CSS declaration.** Adding `grid-template-rows: 1fr;`
  to the `.shell-layout.is-mobile` block is accepted as a zero-visual-change
  contract clarification (computed rows `667px 0px` → `667px`; footer already
  `display: none` on mobile). If the user prefers zero mobile CSS edits, the
  alternative is: keep the mobile block untouched and drop the strengthened
  mobile marker, relying on the mobile E2E geometry tests alone.
- **A2 — Changelog.** `docs/changelog.md` is NOT in scope for this corrective
  fix; the orchestrator may request an Unreleased entry at approval.
- **A3 — No version bump.** Pure web-shell layout correction, no public API
  change → no SemVer bump, `docs/versioning.md` untouched.
- **A4 — Selector basis.** E2E disambiguates the right-panel branches by class
  (`.right-panel:not(.mobile-sheet)` expanded, `.right-panel-strip-wrap`
  collapsed) because `data-testid="right-panel"` is shared across branches.
- **A5 — Defaults.** No workspace is required for pure shell geometry tests;
  workspace-backed steps use the existing `registerAndSelectWorkspace`
  helper.

---

## 12. Definition of done

1. Desktop 1280×720 and 1440×800: center and right (expanded) bottoms equal
   the viewport bottom within ±2 px; right edge flush; no document scroll —
   proven by `viewport-height.spec.ts`.
2. Collapsed right strip bottom == viewport bottom, width == 48 px.
3. Left footer: bottom == viewport bottom; expanded width == rail+panel,
   collapsed width == rail — unchanged from 0003.
4. Mobile 320×568, 375×667, 768×800: shell/center/rail/toggle containment,
   sheet anchoring, no document scroll — unchanged, proven by E2E.
5. Full QA chain green, sequential, on one host: format, lint, check, unit,
   integration, bdd-language, bdd, e2e (exactly 8 workers), build.
6. `docs/design.md` updated; no other docs/configs/dependencies touched.
7. Canonical `panel-viewport-height-fix.feature` persisted at `on_done`
   approval, English, `@delta-added`, step-synchronized
   (`check:bdd-language` green).
8. Memory: approved decision + plan summary persisted (§13).

---

## 13. Delegation order, skills, and memory writes

### Delegation order

1. `nas_developer` FULL (simple complexity + medium magnitude; visual layout
   contract + multi-breakpoint geometry justify full routing) — executes
   Phases 1-2 (Red→Green), then Phase 3 refactor/docs with QA evidence.
2. `nas_qa` / tester role — audits implementation against the persisted
   feature scenarios and `viewport-height.spec.ts`, re-runs the full chain,
   emits `validation-results.md` per IADEV-validating-implementation.
3. Orchestrator — approves `on_done` Gherkin persistence, then changelog
   decision (A2) and memory writes.

### Skills

- Planner applied: `mind-management`, `clean-svelte-architecture`,
  `clean-code`, `frontend-design`, `svelte-code-writer`,
  `IADEV-bdd-implementation`, `IADEV-writing-gherkin`,
  `IADEV-writing-implementation`, `docs-writer` (for the doc task).
- Developer (planned): `mind-management`, `clean-svelte-architecture`,
  `clean-code`, `frontend-design`, `svelte-code-writer`,
  `IADEV-test-driven-development`, `IADEV-bdd-implementation`,
  `IADEV-writing-gherkin`, `IADEV-applying-feedback`, `docs-writer`.
- QA (planned): `mind-management`, `clean-svelte-architecture`, `clean-code`,
  `frontend-design`, `svelte-code-writer`, `IADEV-validating-implementation`,
  `IADEV-bdd-implementation`.

### Memory writes (on approval; orchestrator persists)

- space: `projects/diffscribe` — key `0004-panel-viewport-height-plan-approved`
  (cat:decision, status:proposed→validated on approval) — approved approach:
  desktop row-span 1/-1 + explicit columns 3/4 in `+page.svelte`, mobile
  explicit single row, new `viewport-height.spec.ts`; links to
  `0004-panel-viewport-height-root-cause`.
- space: `projects/diffscribe` — checkpoint update after plan approval
  (goal/pending per mind-management).

---

## 14. External docs consulted

- Svelte 5 docs — Scoped styles (`/docs/svelte/scoped-styles`) and FAQ
  (`/docs/svelte/faq`): scoping classes are component-local; elements created
  by child components require `:global()` for guaranteed matching → informed
  the `:global()` targeting of the right-panel component roots.
- Svelte docs (best practices): parent styling of children via custom
  properties or `:global()` → `:global()` chosen (custom properties cannot
  express row/column placement).
- Context7 Svelte reference (compiler warnings on pruned selectors): `:global()`
  preserves selectors against unused-CSS pruning → safe in `+page.svelte`.
- Research.md source exhaustion (MDN CSS Grid, runtime measurements, archived
  0001-0003 state) accepted as-is; no re-investigation performed.
