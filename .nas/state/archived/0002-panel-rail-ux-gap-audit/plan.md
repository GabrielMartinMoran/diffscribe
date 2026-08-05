# 0002 Panel Rail UX Gap Audit — Corrective Implementation Plan

> **For the Developer agent:** Execute this plan phase by phase using the
> `IADEV-test-driven-development` skill (strict Red → Green → Refactor). Track
> every `- [ ]` checkbox; only check it when the verification command in that
> step passes. All future Playwright commands MUST use exactly 8 workers:
> `npm run test:e2e -- --workers=8`. Do not persist repository `.feature`
> files until the Orchestrator authorizes the `on_done` write.

## Goal

Correct the desktop panel/rail UX so the right-side navigation is vertical
icon navigation in both expanded and collapsed states, collapsed-menu option
selection expands the panel consistently on both sides, bottom controls are
truly bottom-aligned with a working right collapse/reopen pair, and the
accessibility relationships (tabpanels, `aria-controls`/`aria-labelledby`,
hidden collapsed subtrees, focus transfer) are valid — without regressing any
fulfilled mobile or desktop behavior.

## Controlling contract

The **current user clarification** (desktop vertical icons in both right-panel
states; bottom collapse controls on both panels; collapsed option selection
expands on the left exactly like the right; right collapsed panel keeps a
bottom expand control; mobile behavior preserved) supersedes stale
`docs/*` wording and older Mind memories that describe horizontal expanded
Comments/Review tabs. Research `R1`/`R2`/`R3` are confirmed by the parallel
confirmation synthesis in `research.md`.

## Architecture summary

Pure web-layer correction. All changes live in Svelte 5 components
(`src/lib/web/components/`, `src/routes/+page.svelte`), the web E2E/BDD test
suites, `specs/features/`, and the living docs. No backend, domain,
infrastructure, persistence, store, or dependency changes. The shared
`ui/Tabs.svelte` kit primitive is **not modified**: it already supports
`orientation="vertical"`; real tabpanels are rendered by the consumer
(`right-panel-tabs.svelte`) using the existing `tabPanelId()` helper, which
makes the kit's `aria-controls` references valid without a kit API change.

## Tech stack

- Language/runtime: TypeScript on Node ≥ 22, Svelte 5 runes (`$props`,
  `$state`, `$derived`, `$effect`), SvelteKit.
- UI: `svelte-lucide` icons, design tokens (`tokens.css`), no new packages.
- Testing: Vitest (unit, quickpickle BDD), Playwright (E2E, chromium,
  base URL `http://127.0.0.1:56823`).
- QA gate: `npm run qa` (format, lint, check, unit, integration,
  check:bdd-language, bdd, e2e, build) — E2E step must run with 8 workers.

## Scope

**In scope (this plan delivers):**

1. Desktop expanded right panel renders a **vertical icon tablist**
   (`orientation="vertical"`) instead of the current horizontal Comments/Review
   header; collapsed strip stays vertical. Visual contract of both states is
   the existing 48 px vertical strip (icon + `--text-2xs` caption).
2. Right panel tab semantics retained with **real tabpanels**: each tab's
   `aria-controls` resolves to an existing `role="tabpanel"` element with the
   `tabPanelId()` id and a reciprocal `aria-labelledby` pointing at its tab
   button; the active panel is visible, the inactive panel is `hidden`; the
   expanded panel no longer exposes a stray outer `role="tabpanel"`.
3. Exactly **one tablist** in every desktop right state — the nested
   `role="tablist"` wrapper in the collapsed strip is removed; the strip keeps
   `aria-orientation="vertical"` on the single inner tablist.
4. **Idempotent left rail expansion**: clicking a left rail option while the
   left panel is collapsed selects the option AND opens the panel (mirroring
   the right strip); while expanded it only changes selection (no toggle).
5. **Left collapse accessibility**: collapsing transfers focus to a visible
   rail control before the panel hides; the collapsed desktop panel subtree is
   `inert` + `aria-hidden="true"` (kept mounted to preserve component state,
   e.g. tree expansion/scroll).
6. **Bottom controls**: left rail bottom group (`left-panel-reopen-btn` above
   `help-btn`) pinned to the rail bottom as a single group (one
   `margin-top: auto` on the container, Help below reopen); right strip
   `right-panel-reopen-btn` stays bottom-pinned; expanded panels keep their
   bottom footers with `left-panel-collapse-btn` / `right-panel-collapse-btn`.
7. **Focus continuity**: expanding the left panel via its reopen button and
   expanding the right panel via strip tab/reopen returns focus to the active
   tab button (both branches reuse the same `tabButtonId()` ids).
8. **1 px geometry fix**: `box-sizing: border-box` on the expanded
   `.right-panel` so it fits its grid column exactly (right edge flush with
   the viewport, no horizontal overflow).
9. **Icon-only discoverability**: every icon-only rail/panel control exposes
   an `aria-label` (existing) plus a native `title` fallback (reopen buttons,
   collapse buttons; Help already has `title="Keyboard shortcuts"`).
10. **Test correction**: remove the horizontal false positives
    (`tests/e2e/base-ui-kit.spec.ts`, BDD arrow-key step), strengthen
    marker-only BDD steps to semantic markers, and add browser-observable
    E2E assertions for expanded-right orientation, valid ARIA relationships,
    left-menu expansion, true-bottom geometry, and hidden/inert/focus state.
11. **Docs**: update `docs/design.md` (right panel, rail layout, panel
    controls W9, keyboard contract, tooltip strategy), `docs/changelog.md`
    (Unreleased entry), minimal `docs/PRD.md` note (assumption-gated),
    audit-only pass over `docs/architecture.md`.
12. **Canonical merged English Gherkin** in
    `specs/features/product/panel-rail-ux-corrections.feature` (created at
    `on_done` persistence) plus `@delta-modified` updates to
    `workspace-git-review-ux.feature`, `panel-resize.feature`,
    `rail-tabs.feature`, and `base-ui-kit.feature`.

**Out of scope (do NOT touch):**

- `src/lib/web/stores/panel-layout-store.ts` — width persistence and
  collapsed booleans are correct; the rail-expansion policy lives in
  `+page.svelte`.
- `src/lib/web/components/ui/Tabs.svelte`, `ui/ids.ts`, `ui/variants.ts`,
  and every other kit primitive — no kit API change.
- `src/lib/web/components/observation-panel.svelte`,
  `review-panel.svelte`, `project-tree.svelte`, `git-context-panel.svelte`,
  `workspace-sidebar.svelte`, `settings-panel.svelte` — no content changes.
- Mobile branch behavior: `mobile-right-panel-toggle`, mobile bottom sheet
  with its horizontal header and close button, left mobile drawer, backdrop,
  Escape/focus-return flows, `mobile-hardening.spec.ts`,
  `responsive-mobile.spec.ts`. The only mobile-surface change is the same
  `tabPanelId()`/`aria-labelledby` attributes on the sheet wrapper (validity,
  zero visual change).
- Backend/server/domain/infrastructure layers, DB schema, REST endpoints.
- `package.json` / dependencies — **no dependency changes**; `playwright.config.ts`
  default worker count stays (override via CLI/env, see Playwright contract).
- Programmatic rail switches that are not direct rail clicks (Quick Open
  acceptance, workspace landing effect, Git file Ctrl/Cmd-click): they keep
  their current behavior and do NOT reopen a collapsed panel (assumption A6).
- Icon-button navigation conversion, tooltip component rewiring, global
  box-sizing reset, theme/design-token changes, mobile vertical-only.

**Fulfilled behaviors that must NOT regress (regression-protected):**

- Collapsed right strip: activating a strip tab expands the panel and selects
  it (`handleStripTabChange`), bottom `right-panel-reopen-btn` reopens without
  changing the tab, collapsing returns focus to the active strip tab.
- Desktop bottom footers with collapse controls on both expanded panels.
- Help placement (bottom of rail, below reopen), Help dialog focus return.
- Mobile drawer/sheet behavior and horizontal mobile sheet header.
- Panel layout persistence (localStorage), resize handles, reset layout.
- Rail/panel keyboard navigation (roving tabindex, Home/End, arrows).

## Semantic model decision — desktop right navigation

**Decision: retain the tab widget semantics and make it vertical with real
tabpanels.** Comments/Review remain a two-tab tablist; the expanded desktop
panel renders the tablist vertically (48 px column, icon + caption, identical
visual language to the collapsed strip) beside a content region that hosts two
`role="tabpanel"` elements (active visible, inactive `hidden`).

Rationale and tradeoffs against **icon-button navigation** (rejected):

- Comments/Review are **content views of one panel**, not destinations; the
  ARIA tabs pattern with roving tabindex, `aria-selected`, and arrow-key
  navigation is the correct semantic, and the shared kit already implements it
  for the collapsed strip. Converting to `role="button"` icons would require a
  parallel keyboard model (arrow buttons are not navigable with arrows), lose
  `aria-selected` state semantics, and rework the strip keyboard contract —
  a wider change with no user-visible benefit.
- A CSS-only fix (rotating the header) was rejected by R1: it cannot repair
  orphaned `aria-controls`, the missing `aria-labelledby`, or the nested
  tablist; and rotated labels are unreadable.
- Consumer-rendered tabpanels (no `Tabs.svelte` API change) keep the shared
  kit stable for all other consumers (left rail, mobile) while making every
  right-panel `aria-controls` target real.
- Both tabpanels stay mounted (`hidden` on the inactive one): tab switching no
  longer unmounts `ObservationPanel`/`ReviewPanel`, which preserves each
  panel's scroll position and avoids re-fetch churn. Tradeoff: the inactive
  panel is instantiated at mount; acceptable (single lightweight load), and if
  QA observes a real cost, the fallback is lazy-mount with a "visited" flag
  (recorded in risks).

## Left panel state transitions (desktop)

| Trigger                            | New behavior                                                                                                                                                                   |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Click rail option, panel collapsed | Select the option AND open the panel (idempotent open: `if (leftCollapsed) toggleLeft()`), exactly like the right strip.                                                       |
| Click rail option, panel expanded  | Select only; panel stays open (no toggle).                                                                                                                                     |
| Collapse via footer button         | `leftCollapsed=true`; focus moves (rAF) to the active rail tab button `tabButtonId(activeRailTab)` (visible control) BEFORE the panel subtree is hidden.                       |
| Reopen via `left-panel-reopen-btn` | `toggleLeft()`; focus moves (rAF) to the active rail tab button (the reopen button unmounts).                                                                                  |
| Collapsed panel subtree            | `inert` + `aria-hidden="true"` on the `<aside>` (desktop only): out of tab order, out of the accessibility tree, pointer-blocked; still mounted so tree/scroll state survives. |
| Rail tab switch while collapsed    | Selection changes; panel stays collapsed (regression: PANELS-UI-01).                                                                                                           |
| Mobile                             | `handleMobileTabChange` drawer flow unchanged; desktop collapsed/inert state does not affect mobile (states are viewport-separated).                                           |

Desktop-only `aria` on the aside: `id={tabPanelId(activeRailTab)}`,
`role="tabpanel"`, `aria-labelledby={tabButtonId(activeRailTab)}` so the
active rail tab's `aria-controls` resolves to the panel (dynamic-single-panel
pattern; inactive rail tab references resolve on activation — accepted, noted
in risks). Mobile keeps its `role="dialog"` drawer semantics.

## Panel footer/control order and geometry

- **Left rail bottom group** (`rail-tabs.svelte`): wrap reopen (shown only
  when collapsed) and Help in one `.rail-bottom-controls` container with
  `margin-top: auto` on the container ONLY; remove `margin-top: auto` from the
  individual buttons. Visual order top→bottom: `left-panel-reopen-btn`, then
  `help-btn` (Help at the very bottom, per W11). Both controls 40×40 px,
  centered, existing tokens/classes preserved.
- **Right collapsed strip**: `right-panel-reopen-btn` keeps `margin-top: auto`
  (single bottom control); strip wrapper loses `role="tablist"`/
  `aria-orientation` (single inner tablist keeps them).
- **Expanded panels**: footers unchanged in position (bottom, `flex-shrink:0`);
  control sizes stay 28×28 px (right) / 24×24 px (left) — normalization of
  sizes is deliberately NOT in scope (visual approval not requested).
- **1 px fix**: `.right-panel { box-sizing: border-box; }` — border-left moves
  inside the grid column; geometry assertion: panel right edge == viewport
  right edge (tolerance ≤ 1 px), panel width == grid column width (tolerance
  ≤ 2 px, reusing the existing `measureLayout` helpers).
- **Tooltip/title**: add native `title` fallbacks — `title="Open left panel"`
  (left reopen), `title="Open right panel"` (right strip reopen),
  `title="Collapse left panel"` / `title="Collapse right panel"` (footer
  collapse buttons). Accessible names stay on `aria-label`; no `title` on
  elements that already expose visible labels.
- **Icon-only accessible names**: unchanged `aria-label`s on all rail/panel
  icon buttons (already correct per audit).
- **Keyboard**: vertical tablists already map ArrowUp/ArrowDown via
  `resolvedOrientation` in `Tabs.svelte`; expanded-right keyboard tests switch
  from ArrowLeft/ArrowRight to ArrowUp/ArrowDown. Escape/dialog behavior
  unchanged.

## Exact files

**Modify (web):**

- `src/lib/web/components/right-panel-tabs.svelte` — expanded desktop branch:
  vertical tablist column + two real tabpanels + border-box + focus-on-expand
  effect; collapsed strip: remove nested wrapper tablist, keep single vertical
  tablist, keep reopen button (+ `title`); mobile branch: add `tabPanelId()`/
  `aria-labelledby` to the sheet wrapper (no visual change); footer collapse
  buttons get `title`.
- `src/lib/web/components/rail-tabs.svelte` — `.rail-bottom-controls` group
  (reopen + Help), remove per-button auto margins, `title` on reopen.
- `src/routes/+page.svelte` — desktop rail `onTabChange` handler with
  idempotent open-if-collapsed; left collapse focus-transfer `$effect`;
  aside `inert`/`aria-hidden` for desktop collapsed; aside desktop-only
  `id`/`role="tabpanel"`/`aria-labelledby`; left reopen focus-on-expand.

**Modify (tests):**

- `tests/e2e/base-ui-kit.spec.ts` — replace the "Tabs (right panel,
  horizontal)" describe with vertical assertions (ArrowUp/ArrowDown,
  `aria-orientation="vertical"`); fix the header comment.
- `tests/e2e/panel-resize.spec.ts` — update strip role assertions to the
  single inner tablist; update expanded-state assertions to the inner
  `role="tabpanel"` elements; keep all collapse/expand/resize/persistence
  regressions.
- `tests/e2e/ui-shell.spec.ts` — minor: assert expanded right tablist
  `aria-orientation="vertical"` and one tabpanel visible (existing tab/content
  assertions remain).
- `tests/steps/workspace-git-review-ux.steps.ts` — strengthen marker-only
  steps with semantic markers (see Phase 3).
- `tests/steps/ui-redesign.steps.ts` — change the right-panel arrow step from
  ArrowLeft/ArrowRight to ArrowUp/ArrowDown semantics.

**Create (tests):**

- `tests/e2e/panel-rail-corrections.spec.ts` — new browser-observable suite:
  expanded-right vertical orientation, single tablist, valid
  `aria-controls`/`aria-labelledby` relationships, left-menu idempotent
  expansion, left collapse focus/inert/hidden, bottom geometry + Help order,
  right border-box fit, icon-only `title` fallbacks, mobile preservation.

**Create/modify at `on_done` (Gherkin persistence):**

- `specs/features/product/panel-rail-ux-corrections.feature` — NEW (canonical
  merged content below).
- `specs/features/product/workspace-git-review-ux.feature` — @delta-modified
  scenarios "Collapsed right panel tabs expand the panel" and "Bottom controls
  collapse and expand both panels"; add left-expansion scenario.
- `specs/features/product/panel-resize.feature` — @delta-modified
  PANEL-STRIP-01/02/03; add left expansion/focus/geometry scenarios.
- `specs/features/product/rail-tabs.feature` — @delta-modified "Keyboard
  navigation moves focus across right panel tabs" (ArrowUp/ArrowDown).
- `specs/features/product/base-ui-kit.feature` — @delta-modified Tabs scenario
  with a vertical-orientation assertion.

**Modify (docs):**

- `docs/design.md` — Right panel section (incl. layout ASCII), collapsed
  strip, Panel controls (W9), keyboard contract, tooltip/title strategy.
- `docs/changelog.md` — Unreleased entry (Keep a Changelog format).
- `docs/PRD.md` — minimal note that desktop right navigation uses vertical
  icons in both states (assumption A8).
- `docs/architecture.md` — audit-only; update only if it describes right-panel
  tab orientation (no change expected).

**Do NOT touch:** `src/lib/server/**`, `src/lib/web/stores/panel-layout-store.ts`,
`src/lib/web/components/ui/**`, `package.json`, `package-lock.json`,
`playwright.config.ts`, `scripts/check-bdd-language.mjs`,
`tests/e2e/mobile-hardening.spec.ts`, `tests/e2e/responsive-mobile.spec.ts`,
`tests/e2e/helpers/**` (unless a helper must support a new assertion; prefer
inline code), `.nas/**` (except this plan), `docs/domain.md`,
`docs/versioning.md`, `AGENTS.md`.

## Canonical merged Gherkin (English; persisted at `on_done`)

File: `specs/features/product/panel-rail-ux-corrections.feature`

```gherkin
@product/panel-rail-ux-corrections @product @navigation @a11y @layout @etapa-1
Feature: Panel rail UX corrections — desktop vertical right navigation, consistent collapsed expansion, and bottom controls

  Desktop panel/rail corrections: the right panel navigates with vertical
  icons in both expanded and collapsed states, selecting an option in a
  collapsed panel expands it on both sides, bottom collapse/reopen controls
  are bottom-aligned, and collapsed content stays out of the accessibility
  tree. Mobile drawer/sheet behavior is preserved.

  Background:
    Given the workbench shell is loaded

  @product @navigation @a11y @e2e @delta-added
  Scenario: Expanded desktop right navigation is vertical with one tablist
    Given the right panel is expanded on desktop
    When the user views the right panel navigation
    Then the expanded panel exposes exactly one vertical tablist with Comments and Review tabs
    And activating Review selects it without collapsing the panel

  @product @navigation @a11y @e2e @delta-added
  Scenario: Right panel tabs link to real tabpanels
    Given the right panel is expanded on desktop
    When the user inspects the Comments tab
    Then the tab aria-controls target exists as a tabpanel linked to the tab by aria-labelledby
    And the inactive Review tabpanel is hidden while the Comments tabpanel is visible

  @product @navigation @e2e @delta-added
  Scenario: Collapsed right option expands the panel and selects the option
    Given the right panel is collapsed
    When the user activates a tab in the collapsed strip
    Then the panel expands and shows that tab

  @product @layout @e2e @delta-added
  Scenario: Collapsed right strip exposes a bottom expand control
    Given the right panel is collapsed
    When the user views the collapsed right strip
    Then a bottom expand control is visible at the bottom of the strip
    When the user activates the expand control
    Then the panel expands without changing the selected tab

  @product @navigation @e2e @delta-added
  Scenario: Selecting a collapsed left rail option expands the panel
    Given the left panel is collapsed
    When the user selects the Project rail option
    Then the Project option is selected and the left panel expands
    When the user selects the Git rail option with the panel open
    Then the Git option is selected and the panel stays open

  @product @a11y @e2e @delta-added
  Scenario: Collapsing the left panel moves focus to a visible control
    Given the left panel is expanded
    When the user collapses the left panel
    Then focus moves to a visible rail control
    And the collapsed panel content is inert and hidden from the accessibility tree

  @product @layout @e2e @delta-added
  Scenario: Left rail bottom controls are bottom-aligned with Help below reopen
    Given the left panel is collapsed
    When the user views the left rail
    Then the reopen control is at the bottom of the rail with the Help control below it

  @product @layout @e2e @delta-added
  Scenario: Right panel fits its grid column
    Given the right panel is expanded on desktop
    When the panel geometry is measured
    Then the panel width equals its grid column and its right edge reaches the viewport edge

  @product @a11y @e2e @delta-added
  Scenario: Icon-only controls expose accessible names and a visible title fallback
    Given the left panel is collapsed
    When the user inspects the rail controls
    Then every icon-only control has an accessible label and a title attribute

  @product @responsive @e2e @delta-added
  Scenario: Mobile sheet keeps horizontal navigation and drawer behavior
    Given the viewport width is 375 px
    When the user opens the right panel sheet
    Then the sheet header keeps horizontal Comments and Review tabs
    And the left drawer opens from a rail tap without a desktop expansion
```

Delta modifications to existing features (persisted at `on_done`, same
session): update the right-panel keyboard scenario in `rail-tabs.feature` to
ArrowUp/ArrowDown; update PANEL-STRIP-01/02/03 in `panel-resize.feature` to
assert the single vertical tablist and inner tabpanels; extend
"Collapsed right panel tabs expand the panel" and "Bottom controls collapse
and expand both panels" in `workspace-git-review-ux.feature` with the left
expansion and left bottom-order steps; add a vertical-orientation assertion to
the Tabs scenario in `base-ui-kit.feature`. All updated text in English.

## Phased implementation tasks (strict Red → Green → Refactor)

Playwright contract: every E2E command is `npm run test:e2e -- --workers=8`.
For `npm run qa`, set `DIFFSCRIBE_E2E_WORKERS=8 npm run qa` (config default
stays untouched). BDD language gate: `npm run check:bdd-language`.

### Phase 1 — Right navigation semantics (desktop)

Objective: vertical expanded right tablist, real tabpanels, single tablist in
both states, border-box geometry, focus continuity on expand.

Tasks:

- [ ] 1.1 RED — Extend `tests/e2e/panel-rail-corrections.spec.ts` with the
      expanded-right suite: `aria-orientation="vertical"` on the expanded tablist,
      exactly one `[role="tablist"]` inside `[data-testid="right-panel"]`,
      ArrowUp/ArrowDown navigation, both `role="tabpanel"` elements present with
      ids `ui-tab-panel-comments`/`ui-tab-panel-review`, active visible/inactive
      `hidden`, `aria-controls` of each tab resolves, `aria-labelledby` points at
      the tab button, panel width fits the grid column (reuse `measureLayout`
      pattern from `panel-resize.spec.ts`), focus returns to the active tab after
      expanding via strip tab and via reopen button.
      Run: `npm run test:e2e -- --workers=8 tests/e2e/panel-rail-corrections.spec.ts`
      Expected: new tests FAIL for the right reasons (horizontal tablist, missing
      panels, nested roles, overflow, focus loss).
- [ ] 1.2 RED — Update `tests/e2e/base-ui-kit.spec.ts` "Tabs (right panel,
      horizontal)" describe to "Tabs (right panel, vertical, desktop)": assert
      `aria-orientation="vertical"` and ArrowUp/ArrowDown selection. Update
      `tests/e2e/ui-shell.spec.ts` right-panel tests to assert the vertical
      orientation and inner tabpanel visibility.
      Run: `npm run test:e2e -- --workers=8 tests/e2e/base-ui-kit.spec.ts tests/e2e/ui-shell.spec.ts`
      Expected: FAIL (current expanded branch is horizontal; wrapper role
      assertions break).
- [ ] 1.3 GREEN — `src/lib/web/components/right-panel-tabs.svelte`: expanded
      desktop branch renders a 48 px vertical tablist column
      (`<Tabs orientation="vertical" ariaLabel="Right panel tabs">`) plus two
      content regions as `role="tabpanel"` with `id={tabPanelId('comments')}` /
      `id={tabPanelId('review')}`, `aria-labelledby={tabButtonId(...)}`,
      `tabindex` 0/-1, inactive `hidden`; remove the outer `role="tabpanel"` from
      the panel wrapper. Collapsed branch: drop `role="tablist"`/
      `aria-orientation` from `.right-panel-strip-wrap` (single inner tablist
      keeps them). Mobile branch: add `id={tabPanelId(activeRightTab)}` +
      `aria-labelledby={tabButtonId(activeRightTab)}` to the sheet wrapper.
      Extend the collapse `$effect`: on the expanded transition, rAF-focus
      `tabButtonId(activeRightTab)`. Add `box-sizing: border-box` to `.right-panel`
      and `title` attributes on reopen/collapse buttons. Keep
      `handleStripTabChange` and all testids (`right-tab-comments`,
      `right-tab-review`, `right-panel-reopen-btn`, `right-panel-collapse-btn`).
      Run: `npm run test:e2e -- --workers=8 tests/e2e/panel-rail-corrections.spec.ts tests/e2e/base-ui-kit.spec.ts tests/e2e/ui-shell.spec.ts tests/e2e/panel-resize.spec.ts`
      Expected: 0 failures (adjust `panel-resize.spec.ts` role assertions to the
      inner tablist/tabpanels as part of GREEN only if a pre-existing assertion
      contradicts the new structure — see 1.4).
- [ ] 1.4 REFACTOR + regression — Update `tests/e2e/panel-resize.spec.ts`
      collapsed-strip and expand assertions to the single inner
      `[role="tablist"][aria-orientation="vertical"]` and the inner
      `role="tabpanel"` elements; keep every collapse/expand/persistence/resize
      regression intact.
      Run: `npm run test:e2e -- --workers=8 tests/e2e/panel-resize.spec.ts`
      Expected: 0 failures.

Phase 1 exit criteria: expanded desktop right tablist is vertical with one
tablist and valid tabpanel relationships; mobile sheet horizontal header
unchanged; all Phase 1 E2E suites green.

### Phase 2 — Left rail: expansion, focus, hidden state, bottom group

Objective: idempotent open-if-collapsed, focus transfer, inert/hidden
collapsed subtree, bottom-aligned reopen+Help group.

Tasks:

- [ ] 2.1 RED — Extend `tests/e2e/panel-rail-corrections.spec.ts` with the
      left suite: collapse left → click `rail-tab-project` → panel visible AND
      `aria-selected=true`; with panel open, click `rail-tab-git` → selected and
      panel stays open; collapse via footer → focus lands on a visible rail
      control (`rail-tab-*` or reopen), aside has `aria-hidden="true"` + `inert`,
      no focusable element inside the aside (Tab-walk assertion); reopen via
      `left-panel-reopen-btn` → panel visible and focus returns to the active rail
      tab; collapsed rail switch keeps panel collapsed; reopen button is
      bottom-aligned with Help below (bounding-box: reopen bottom ≈ rail bottom −
      padding; helpBtn.y > reopenBtn.y); both reopen and Help have `title`.
      Run: `npm run test:e2e -- --workers=8 tests/e2e/panel-rail-corrections.spec.ts`
      Expected: new tests FAIL (panel stays collapsed, focus stuck on clipped
      button, no inert, auto margins split).
- [ ] 2.2 RED — Add a unit marker contract test following the
      `tests/unit/web/ui/text-2xs.test.ts` pattern (e.g.
      `tests/unit/web/components/panel-rail-contracts.test.ts`): `rail-tabs.svelte`
      contains a bottom-controls group wrapper; `+page.svelte` contains the
      open-if-collapsed guard and `inert`/`aria-hidden` wiring.
      Run: `npm run test:unit`
      Expected: FAIL (markers missing).
- [ ] 2.3 GREEN — `src/routes/+page.svelte`: desktop `onTabChange` handler =
      `(t) => { activeRailTab = t; if (!isMobileViewport && $panelLayout.leftCollapsed) toggleLeft(); }`;
      add a `$effect` on `$panelLayout.leftCollapsed` (desktop only) that
      rAF-focuses `tabButtonId(activeRailTab)` on the collapse transition and on
      expand-via-reopen; aside gets desktop `inert` + `aria-hidden`
      (`aria-hidden={isMobileViewport ? !mobileLeftOpen : $panelLayout.leftCollapsed}`),
      desktop-only `id={tabPanelId(activeRailTab)}`, `role="tabpanel"`,
      `aria-labelledby={tabButtonId(activeRailTab)}`. Mobile handlers unchanged.
      `src/lib/web/components/rail-tabs.svelte`: wrap reopen + Help in
      `.rail-bottom-controls` (`margin-top: auto` on the container only; remove it
      from the buttons), add `title="Open left panel"` to reopen.
      Run: `npm run test:e2e -- --workers=8 tests/e2e/panel-rail-corrections.spec.ts`
      Expected: 0 failures.
- [ ] 2.4 GREEN — Unit markers pass.
      Run: `npm run test:unit`
      Expected: 0 failures.

Phase 2 exit criteria: left rail behaves like the right strip when collapsed;
collapsed left subtree is inert/aria-hidden; focus transfers; bottom group
geometry verified; mobile drawer untouched.

### Phase 3 — False positives, BDD, docs, changelog, full QA

Objective: remove stale horizontal assumptions, strengthen BDD steps, update
docs, run the complete gate.

Tasks:

- [ ] 3.1 RED (contract) — Update BDD steps:
      `tests/steps/workspace-git-review-ux.steps.ts` — the steps "the panel
      expands and shows that tab" and "the right strip exposes an expand control
      at the bottom" must additionally require semantic markers
      (`orientation="vertical"` in the expanded branch, `right-panel-reopen-btn`
      still present) so the BDD layer guards the correction, not just old wiring;
      add a step for the left rail expansion (e.g. "Then the left panel expands
      and selects the option") pinned to the open-if-collapsed guard marker.
      `tests/steps/ui-redesign.steps.ts` — "the user presses ArrowLeft or
      ArrowRight" becomes ArrowUp/ArrowDown for the right panel; update
      `rail-tabs.feature` scenario accordingly at `on_done`.
      Run: `npm run test:bdd`
      Expected: FAIL on the updated steps until markers land (GREEN in 3.2).
- [ ] 3.2 GREEN — Add the required markers to `right-panel-tabs.svelte`
      (expanded `orientation="vertical"` — already in 1.3) and `+page.svelte`
      (open-if-collapsed guard — already in 2.3); if any marker is already
      present, fix the step wording instead of the source.
      Run: `npm run test:bdd`
      Expected: 0 failures.
- [ ] 3.3 Docs — `docs/design.md`: rewrite the "Right panel (Comments /
      Review)" and "Collapsed right strip (desktop)" sections to the vertical
      icon contract in both states, update the layout ASCII diagram, update
      "Panel controls (W9)" with the left bottom group and Help-below-reopen
      order, document the tooltip/title strategy, and adjust the keyboard
      contract note (ArrowUp/ArrowDown for the desktop right panel). Minimal
      `docs/PRD.md` note per assumption A8. Audit `docs/architecture.md`; update
      only if it states horizontal right tabs. `docs/changelog.md`: add an
      Unreleased entry (Keep a Changelog) summarizing the corrections.
      Run: `npm run format`
      Expected: exit 0 (autofix with `npm run format:fix` first if needed, review
      the diff, re-run, re-stage).
- [ ] 3.4 Verification (Developer) — Format, lint, type check, unit,
      integration, BDD language, BDD.
      Run: `npm run format && npm run lint && npm run check && npm run test:unit && npm run test:integration && npm run check:bdd-language && npm run test:bdd`
      Expected: exit 0 / 0 failures each.
- [ ] 3.5 Verification (Developer) — E2E with exactly 8 workers + build.
      Run: `npm run test:e2e -- --workers=8 && npm run build`
      Expected: 0 failures; build succeeds.

Phase 3 exit criteria: full QA green with 8-worker E2E; docs/changelog
updated; no horizontal false positives left.

### Phase 4 — Tester handoff (run by QA, not the Developer)

The Tester re-runs the full gate (`DIFFSCRIBE_E2E_WORKERS=8 npm run qa`),
exercises every scenario of the canonical feature through
`IADEV-validating-implementation` + `IADEV-bdd-implementation`, verifies the
mobile preservation specs (`mobile-hardening.spec.ts`,
`responsive-mobile.spec.ts`) still pass, and emits `validation-results.md`.
After QA approval, the Orchestrator authorizes the `on_done` Gherkin write of
the canonical feature + delta-modified features and the developer executes the
persistence.

## Test plan

- RED: the new/updated assertions in Phase 1.1/1.2, Phase 2.1/2.2, and Phase
  3.1 must fail before their GREEN steps — run each and record the failure
  reason (horizontal orientation, missing tabpanels, nested roles, missing
  inert, split auto margins, missing markers).
- GREEN: the source changes in 1.3, 2.3, 3.2 flip the same tests; every E2E
  command uses exactly `-- --workers=8`.
- REFACTOR: 1.4 (panel-resize role assertions), formatter/linter cleanups;
  `npm run format:fix` protocol from AGENTS.md if format fails.
- Full gate: `DIFFSCRIBE_E2E_WORKERS=8 npm run qa` (or the equivalent staged
  commands in 3.4/3.5).

## Definition of done

1. Desktop expanded right navigation is a vertical tablist with real,
   reciprocal tabpanels; exactly one tablist in every desktop right state.
2. Left rail option selection opens a collapsed panel idempotently; collapsed
   left subtree is inert + aria-hidden; focus transfers on collapse and returns
   on reopen.
3. Left reopen + Help are bottom-aligned (Help below reopen); right strip
   reopen is at the bottom; both expanded panels keep bottom collapse footers.
4. Right panel fits its grid column (border-box); no horizontal overflow.
5. Icon-only controls have aria-label + title fallbacks.
6. Mobile drawer/sheet behavior and horizontal sheet header are unchanged
   (mobile suites green).
7. All false positives removed: `base-ui-kit.spec.ts` vertical, BDD steps
   semantic, no stale horizontal assumptions in docs/tests.
8. `docs/design.md`, `docs/changelog.md` updated; `docs/PRD.md` note (A8);
   `docs/architecture.md` audited.
9. `DIFFSCRIBE_E2E_WORKERS=8 npm run qa` green.
10. Gherkin persisted at `on_done` (canonical + delta-modified) in English and
    passing `check:bdd-language`.

## Delegation order, skills, routing

1. **Developer — `nas_developer` FULL** (routing rationale: complex — shared
   UI semantic contract, multi-file behavior, Gherkin required; magnitude
   medium/high — multiple Svelte components, tests, docs; the matrix routes
   complex+medium/high to FULL; shared accessibility/navigation semantics and
   user-visible layout correction justify the safe full path, NOT mini).
   Skills: `mind-management`, `clean-svelte-architecture`, `clean-code`,
   `frontend-design`, `svelte-code-writer`, `IADEV-test-driven-development`,
   `IADEV-bdd-implementation`, `IADEV-writing-gherkin`,
   `IADEV-applying-feedback`. `clean-backend-architecture` is NOT assigned
   (research found no backend boundary).
2. **QA (Tester)** — Skills: `mind-management`, `clean-svelte-architecture`,
   `clean-code`, `frontend-design`, `svelte-code-writer`,
   `IADEV-validating-implementation`, `IADEV-bdd-implementation`;
   `documentation-lookup` only if current external API semantics are needed
   (not expected).
3. **Orchestrator** — gates the `on_done` Gherkin persistence after QA
   approval; relays the user-approved assumptions below.
4. Docs tasks in Phase 3 are executed by the Developer under the delegated
   contract (AGENTS.md living-documentation table); `docs-writer` remains a
   planner-side skill per the delegation.

## Risks

- **Shared kit blast radius**: no `Tabs.svelte` change is planned, but if the
  Developer discovers a kit-level need, STOP and escalate — do not modify the
  kit without approval (mitigation: consumer-side panels only).
- **Both-panels-mounted cost**: ReviewPanel instantiates on mount even while
  Comments is active. Mitigation: acceptable single lightweight load; fallback
  is lazy-mount with a visited-tab flag (documented in design.md) if QA flags
  a real cost.
- **Inactive rail tab `aria-controls`**: with the dynamic single-panel aside
  id, only the active rail tab's reference resolves; inactive references
  resolve on activation. Accepted dynamic-panel pattern; scope the "all
  references resolve" assertion to the right panel.
- **Focus-timing flakiness**: rAF-based focus transfers can race hydration;
  use `waitForHydration` and Playwright `toBeFocused` polling; keep the
  existing right-panel pattern.
- **Mobile regression**: mitigated by untouched mobile branch + existing
  `mobile-hardening`/`responsive-mobile` suites as the guard.
- **Stale docs/memories**: user clarification is controlling; docs updated in
  Phase 3; Mind memory updates listed below.
- **E2E worker count drift**: any run without `--workers=8` (or
  `DIFFSCRIBE_E2E_WORKERS=8`) is a contract violation; QA verifies.

## Assumptions (require user approval)

- A1 **Desktop-only vertical scope**: vertical icon navigation applies to
  desktop only; the mobile sheet keeps horizontal header tabs.
- A2 **Tabs semantic retained**: Comments/Review remain tabs (icon-button
  navigation rejected); real tabpanels added.
- A3 **Tooltip strategy**: native `title` fallbacks on icon-only controls
  (aria-label remains the accessible name); the kit Tooltip component is not
  introduced here.
- A4 **Left Help/reopen order**: reopen above Help, both pinned to the rail
  bottom (W11 order preserved).
- A5 **Expanded right panel layout**: 48 px vertical icon tablist on the left
  edge of the panel, content to its right, footer at bottom — mirroring the
  collapsed strip's visual language.
- A6 **Programmatic rail switches** (Quick Open, workspace landing, Git
  Ctrl/Cmd-click) do not reopen a collapsed left panel; only direct rail
  clicks do.
- A7 **Both right tabpanels stay mounted** (inactive hidden) for state and
  scroll preservation.
- A8 **PRD note**: a minimal PRD sentence documents the desktop vertical-icon
  contract; if the user prefers product docs untouched, skip it.
- A9 **Control sizes** (28/24 px collapse buttons) are not normalized in this
  correction.

## Rejected alternatives

- Icon-button navigation for Comments/Review (rejected: wrong semantics for
  content views, keyboard-model rework, no user benefit).
- CSS-only vertical fix (rejected by R1: cannot fix aria relationships or
  nested tablists).
- Modifying shared `Tabs.svelte` to render panels for all consumers (rejected:
  kit-wide blast radius; consumer-side panels suffice).
- Unmounting the collapsed left subtree (rejected: loses tree/scroll/state;
  inert + aria-hidden preserves it).
- Global `box-sizing` reset (rejected: repo convention is no global reset;
  scoped `.right-panel` fix).
- Kit `Tooltip` wrapping of rail buttons (rejected: it renders its own trigger
  button, incompatible with the 40×40 rail chrome; native `title` matches the
  existing Help/branch-selector pattern).

## Memory writes (orchestrator persists)

- space: projects/diffscribe — checkpoint save (goal, pending phases, next
  action) on this plan.
- space: projects/diffscribe — durable memory `panel-rail-ux-corrections-plan`
  (cat:decision, status:proposed): plan decisions, file set, 8-worker
  contract; link to `panel-rail-ux-audit-findings`.
- space: projects/diffscribe — update `vertical-right-navigation-current-contract`
  to status:validated once the user approves A1–A9.
