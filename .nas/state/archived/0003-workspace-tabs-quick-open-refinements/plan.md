# Plan: 0003-workspace-tabs-quick-open-refinements

**Status**: planning (approval pending)
**Feature**: 0003-workspace-tabs-quick-open-refinements
**Planner**: nas_planner (full mode)
**Date**: 2026-08-05
**Gherkin persistence**: `when=on_done` — NO `.feature` files are written by this pass.
**Routing**: complex / high magnitude → `nas_developer` FULL. No mini.

---

## 1. Executive summary

Nine user-approved refinements to the review workbench. Three are new web-only
state contracts (pinned synthetic complete-diff tab, Quick Open unconditional
untracked inclusion plus status join, right-edge desktop navigation), the rest
are evidence-backed UI corrections. No backend/API change, no SQLite
migration, no new runtime dependency. All server readers/routes/DTOs stay
untouched: the pinned tab is web-only shell/tab-store state; Quick Open joins
the existing comparison-aware `/file-list` contract by path; ignore semantics
already come from `git ls-files --others --exclude-standard`.

Parallel confirmation synthesis (research.md §Parallel confirmation synthesis)
is accepted for the three independent contracts and mirrored in the phases.

---

## 2. User requirements (controlling) → target contract

| #   | Requirement                                                                                                                                     | Target behavior                                                                                                                                                                                                                                                                                                                                                                                                          |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Left collapse/expand control always at the absolute bottom; Help above it; same location collapsed/expanded; full panel width when expanded     | Desktop left region gets a **stable bottom footer row** that spans the rail+panel columns (grid-column 1/3) at the shell's bottom row. The collapse/expand control lives there in both states: collapsed → rail width (48 px); expanded → full left-region width (≥ panel width, mirrors right footer). Help (`help-btn`) stays in the rail **directly above** the footer. Mobile unchanged.                             |
| 2   | Desktop right-panel tab icons on the panel's right edge; left-panel icons stay left; mobile horizontal sheet preserved                          | `right-panel-tabs.svelte` desktop expanded: nav column moves to the panel's right edge (`flex-direction: row-reverse` on `.right-panel-body` keeps DOM/keyboard order; separator border flips to the nav's inner side; active indicator flips to the outer/right edge). Collapsed strip already right-edge — unchanged. Mobile sheet untouched.                                                                          |
| 3   | Active workspace context at top of left-panel content except Workspaces                                                                         | New `workspace-context-header.svelte` rendered at the top of Project/Git/Settings panel content (fixed, non-scrolling), showing active workspace `displayName` (primary) + `repositoryPath` (secondary, truncated, `title` attr). Hidden on Workspaces (list already identifies it). No backend change.                                                                                                                  |
| 4   | Active central tab has no bottom border; inactive tabs do; visual regression coverage                                                           | `open-files-tabs.svelte`: `.file-tab.active { border-bottom: none }`, `.file-tab.inactive { border-bottom: 1px solid var(--border-subtle) }` (default-token border). E2E computed-style assertions.                                                                                                                                                                                                                      |
| 5   | Complete diff always first synthetic tab, non-closable, revisitable; remove "No file selected" for it                                           | `active-file-store.ts` gets a discriminated tab union: `{kind:'file',path,label}                                                                                                                                                                                                                                                                                                                                         | {kind:'complete-diff', id:'complete-diff'}`. The pinned tab is workspace-scoped, always first, no close button, no middle-click close; selecting it renders `CompleteDiffViewer` (existing API); comparison changes refresh in place; workspace switch recreates the pin and clears file tabs; no active workspace → no pin. "No file selected" remains only for the no-workspace/truly-empty case. |
| 6   | Fix Observations tab/panel styling (screenshot 5); seeded runtime evidence; existing tokens; stale wiring only if the visible contract requires | Add seeded visual/geometry E2E coverage first (populated cards, badges, status dots, hover/focus actions, both themes). Apply only evidence-backed token/layout corrections in `observation-panel.svelte` / `observation-card.svelte`. `staleStatus` stays `null` (Stage 1 has no domain stale detection); stale card rendering is already tokenized and covered by existing staleness features at the API/domain layer. |
| 7   | Remove List/Tree controls from Git; Settings is the sole presentation configuration                                                             | `file-list.svelte`: remove the in-Git view-switcher UI and its local `setView` persistence; keep reading `fileListView` from `visual-settings-store` (Settings owns it). Settings panel unchanged (already exposes the segmented control).                                                                                                                                                                               |
| 8   | Remove Quick Open include-untracked option; always include nonignored untracked; preserve Git ignore semantics                                  | Delete the setting UI (`settings-panel.svelte` switch), the localStorage key contract (replace `quick-open-store.ts` with a legacy-key cleanup helper), and the scorer's `includeUntracked` filter. Tree reader already supplies tracked+nonignored untracked and excludes ignored — no server change.                                                                                                                   |
| 9   | Quick Open results show working-tree/status badges using existing technical statuses + UI mapping                                               | Join the comparison-aware `/file-list` status map by path (new shared loader with per-comparison cache + request guard). Render `StatusBadge` via existing `statusTone`/`statusLabel` (`untracked` → "New", green). 512 cap preserved. Fallback: no comparison or failed fetch → no badges.                                                                                                                              |

---

## 3. Scope

### In scope (web only)

- `src/lib/web/stores/active-file-store.ts` — pinned synthetic tab model.
- `src/lib/web/components/open-files-tabs.svelte` — pinned tab render, borders, empty state.
- `src/routes/+page.svelte` — shell wiring (pin lifecycle, work-area render by active tab, left-region footer, workspace context header), grid rows.
- `src/lib/web/components/rail-tabs.svelte` — Help-above-footer order; remove rail reopen control (moves to footer).
- `src/lib/web/components/right-panel-tabs.svelte` — right-edge desktop nav.
- `src/lib/web/components/workspace-context-header.svelte` — **NEW**.
- `src/lib/web/components/quick-open-dialog.svelte` — untracked always, status badges, legacy-key cleanup.
- `src/lib/web/services/quick-open-scorer.ts` — drop `includeUntracked`; pass `status` through.
- `src/lib/web/services/file-list-status-loader.ts` — **NEW** shared status loader.
- `src/lib/web/stores/quick-open-store.ts` — replaced by legacy-cleanup helper (module stays for testability).
- `src/lib/web/components/settings-panel.svelte` — remove include-untracked switch + import.
- `src/lib/web/components/file-list.svelte` — remove List/Tree controls + local persistence write.
- `src/lib/web/components/observation-panel.svelte`, `observation-card.svelte` — evidence-backed token/layout corrections only.
- Tests (unit, BDD steps, E2E), Gherkin features (persisted at on_done), docs.

### Out of scope (Do NOT touch)

- All server code: readers, use cases, routes, DTOs, domain value objects, SQLite migrations, endpoints (`/tree`, `/file-list`, `/complete-diff`, `/source`, `/file-diff`).
- No new runtime dependencies (package.json unchanged).
- No Stage 2/3/4 features (no AI, no auto-fix, no commit/branch mutation, no collaboration, no server-side Quick Open search).
- No stale-detection domain logic; `staleStatus` wiring stays `null`.
- No changes to playwright.config.ts default workers (invocation passes `--workers=8`), quickpickle, vitest configs, CI.
- No `.feature` files persisted during this pass (`when=on_done`).

### Fulfilled regressions to protect

1. Desktop right vertical nav semantics (one tablist, reciprocal tabpanels, strip activation expands, ArrowUp/Down) — `panel-rail-ux-corrections.feature`.
2. Right panel geometry: width = grid column, right edge flush with viewport — preserved after moving nav to the right edge (row-reverse, border-box kept).
3. Left/right bottom controls present in both states; focus continuity on collapse (focus to visible rail control) — keep, adjust selectors only.
4. Mobile horizontal right sheet + left drawer — untouched; E2E `responsive-mobile`/`mobile-hardening` must stay green.
5. Existing complete-diff API contract: `GET /api/workspaces/[id]/complete-diff`, request-guard fetch, scroll-target plain-click, Ctrl/Cmd-click opens file tab + Project rail (W6) — the pinned tab renders the same viewer.
6. Git ignore semantics: ignored files stay excluded; tracked deleted paths remain index-visible (tree reader unchanged).
7. 512-result Quick Open cap + fuzzy ranking + highlights — scorer logic untouched except filtering removal.
8. Current status vocabulary (`FileChangeStatus`, `statusTone`/`statusLabel`, `untracked`→New/green) — reused as-is.
9. Tab keyboard roving, unique-by-path, session-only, workspace reset clears file tabs.
10. Settings persisted `fileListView` (visual-settings-store v1, legacy migration) — still honored, now the only writer.

---

## 4. Key decisions and rejected alternatives

| Decision                  | Chosen                                                                                                                                                                   | Rejected alternatives                                                                                                                        |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Pinned tab model          | Discriminated union `CentralTab` with `kind:'complete-diff'` + stable id `'complete-diff'`; workspace-scoped, first, non-closable                                        | Path sentinel (fragile, collides with real files); rail-scoped pin (research confirmed workspace scope); backend flag (no API change wanted) |
| Pin lifecycle             | Created when a workspace becomes active; workspace change → `resetTabs()` + re-pin; comparison change → viewer refetches in place (existing `CompleteDiffViewer` effect) | Pinning on Git-rail entry only (would not be revisitable from other rails)                                                                   |
| Complete-diff render rule | Active tab kind `complete-diff` → `CompleteDiffViewer` regardless of rail                                                                                                | Rail-gated render (breaks "revisitable" contract)                                                                                            |
| Left control slot         | New shell bottom footer row spanning rail+panel grid columns (`grid-template-rows: 1fr auto`); control at absolute bottom in both states; Help in rail above it          | Rail-only control (cannot span panel width); keep inside zero-width aside (source of the clipped control)                                    |
| Right-edge nav            | `flex-direction: row-reverse` (DOM order preserved → logical/keyboard order unchanged), inner separator border, outer active indicator                                   | Reordering DOM (changes focus order); CSS-only margin trick (fragile)                                                                        |
| Quick Open untracked      | Always include; scorer filter removed; tree source unchanged                                                                                                             | Keeping default-false toggle; new server DTO for tree status (rejected — no backend change)                                                  |
| Quick Open status         | Join `/file-list` by path via new shared loader (cache per workspace+comparison, request guard); `status` passthrough in scorer; `StatusBadge` reuse                     | New endpoint; server-side enrichment of tree DTO; duplicate fetch in dialog without cache                                                    |
| Legacy setting            | Replace store module with `removeLegacyQuickOpenSetting(storage)` called on dialog open; no version bump (client-only pref, not public API)                              | Keeping the key inert (drift risk); breaking-version bump (overkill for localStorage)                                                        |
| Git view control          | Remove in-Git switcher; Settings remains sole writer/reader path                                                                                                         | Keep both (duplicated configuration, user explicitly rejected)                                                                               |
| Observations              | Seeded E2E visual tests first; corrections only from evidence; stale wiring stays `null`                                                                                 | Speculative CSS rewrite; wiring stale detection without domain support                                                                       |

---

## 5. Critical assumptions (orchestrator must confirm)

1. **Pinned tab scope**: materialized whenever a workspace is active (any rail); no workspace → no pin and "No file selected"/empty states remain for the truly-empty case.
2. **Tab reset & comparison**: workspace switch clears file tabs and re-creates the pin; comparison changes refresh the pinned viewer in place; plain Git file-list click keeps scrolling the complete diff (W6), Ctrl/Cmd-click opens a file tab.
3. **Right-edge order**: DOM/keyboard order unchanged via `row-reverse`; active indicator flips to the outer (right) edge; left-panel icons remain left.
4. **Workspace indicator content**: `displayName` primary + `repositoryPath` secondary (truncated with `title`), fixed at top of Project/Git/Settings, hidden on Workspaces.
5. **Status semantics**: badges reflect the **active comparison** file-list; non-working-tree or failed fetch → no badge (defined fallback); untracked entries badge "New" green only when file-list reports `untracked`; deleted tracked paths keep index visibility and get `deleted` badge from file-list; rename/copy status belongs to the new path (existing semantics).
6. **Obsolete setting migration**: legacy `diffscribe-quick-open-include-untracked` is removed on first Quick Open open; changelog entry only, no SemVer bump (client-only preference).
7. **Observations**: no stale wiring this tranche; only evidence-backed style corrections; seeded coverage added.
8. **Performance/cache**: status map cached per workspace+comparison signature; tree loader cache untouched; 512 cap enforced.

---

## 6. Gherkin scenarios (canonical merged — persisted at on_done approval)

New canonical file: `specs/features/product/workspace-tabs-quick-open-refinements.feature`
(Tags: `@product` for product behavior; `@application` only where a contract with the existing API is asserted.)

```gherkin
@product @workspace-tabs-quick-open-refinements @navigation @layout @a11y @quick-open @etapa-1
Feature: Workspace tabs, panels, and Quick Open refinements

  Corrections to the review workbench: the left collapse/expand control lives
  at the absolute bottom with Help above it and spans the panel when expanded;
  desktop right-panel tab icons sit on the panel's right edge while the mobile
  sheet stays horizontal; the active workspace context shows at the top of
  Project/Git/Settings; the active central tab has no bottom border while
  inactive tabs do; the complete diff is the first synthetic non-closable
  workspace-scoped tab; the Git file list exposes no List/Tree controls;
  Quick Open always includes nonignored untracked files and shows working-tree
  status badges through the existing UI mapping.

  Background:
    Given DiffScribe is started
    And a workspace is registered and active

  @product @layout @e2e @delta-added
  Scenario: Left collapse control sits at the absolute bottom with Help above it
    Given the left panel is expanded on desktop
    When the panel geometry is measured
    Then the left collapse control is the bottom-most control of the left region
    And the Help control is directly above the collapse control
    When the user collapses the left panel
    Then the reopen control is still the bottom-most control of the left region
    And the Help control is directly above the reopen control

  @product @layout @e2e @delta-added
  Scenario: Expanded left collapse control spans the panel width
    Given the left panel is expanded on desktop
    When the panel geometry is measured
    Then the collapse control row spans the full width of the left panel
    When the user collapses the left panel
    Then the reopen control row spans only the rail width

  @product @layout @e2e @delta-added
  Scenario: Desktop right-panel tab icons sit on the panel right edge
    Given the right panel is expanded on desktop
    When the navigation geometry is measured
    Then the vertical tablist right edge aligns with the panel right edge
    And the tablist sits to the right of the panel content
    And the tablist remains a single vertical tablist with Comments and Review

  @product @responsive @e2e @delta-added
  Scenario: Mobile right sheet keeps horizontal navigation
    Given the viewport width is 375 px
    When the user opens the right panel sheet
    Then the sheet header keeps horizontal Comments and Review tabs

  @product @layout @e2e @delta-added
  Scenario: Active workspace context shows at the top of non-Workspaces panels
    Given the active workspace has a display name
    When the user opens the Project rail
    Then the panel shows the active workspace context at the top
    When the user opens the Git rail
    Then the panel shows the active workspace context at the top
    When the user opens the Workspaces rail
    Then no workspace context header is shown

  @product @layout @e2e @delta-added
  Scenario: Active central tab has no bottom border and inactive tabs do
    Given the central viewer shows the tabs "src/app.ts" and "src/lib/util.ts"
    And the active tab is "src/app.ts"
    Then the active tab has no bottom border
    And the inactive tab has a visible bottom border

  @product @navigation @e2e @delta-added
  Scenario: Complete diff is the first synthetic non-closable tab
    Given the active workspace has changes
    When the user views the central tab strip
    Then the first tab is the complete diff tab
    And the complete diff tab has no close button
    When the user middle-clicks the complete diff tab
    Then the complete diff tab remains open

  @product @navigation @e2e @delta-added
  Scenario: Opening a file preserves the pinned tab and activates the file tab
    Given the complete diff tab is the first tab
    When the user opens "src/app.ts" from the Project tree
    Then the central viewer shows the complete diff tab followed by "src/app.ts"
    And the active tab is "src/app.ts"

  @product @navigation @e2e @delta-added
  Scenario: The complete diff tab is revisitable and shows no "No file selected"
    Given the complete diff tab is the first tab
    When the user clicks the complete diff tab
    Then the complete diff viewer is shown
    And "No file selected" is not shown

  @product @navigation @e2e @delta-added
  Scenario: Closing the last file tab returns to the complete diff tab
    Given the central viewer shows the complete diff tab and "src/app.ts"
    When the user closes the tab "src/app.ts"
    Then the complete diff viewer is shown
    And the complete diff tab is the only tab

  @product @navigation @e2e @delta-added
  Scenario: Changing the comparison refreshes the pinned tab in place
    Given the complete diff tab is active
    When the user changes the comparison target
    Then the complete diff tab remains the first tab
    And the complete diff viewer reloads for the new comparison

  @product @navigation @e2e @delta-added
  Scenario: Switching workspace replaces the pin and clears file tabs
    Given the central viewer shows the complete diff tab and "src/app.ts"
    When the user activates another workspace
    Then the central viewer shows only the new workspace complete diff tab
    And no stale path from the previous workspace appears

  @product @navigation @e2e @delta-added
  Scenario: No active workspace shows no pinned complete diff tab
    Given no workspace is active
    Then the central viewer shows no complete diff tab

  @product @navigation @e2e @delta-added
  Scenario: Git file list exposes no List/Tree controls
    Given the Git rail is active with changed files
    When the user inspects the file list controls
    Then no List or Tree toggle is present in the Git panel
    And the file list follows the File list view setting from Settings

  @product @quick-open @e2e @delta-added
  Scenario: Quick Open always includes nonignored untracked files
    Given the working tree has an untracked file "src/scratch.ts"
    When the user opens Quick Open and types "scratch"
    Then "src/scratch.ts" is shown as a result

  @product @quick-open @e2e @delta-added
  Scenario: Quick Open excludes ignored files
    Given the working tree has an ignored file "src/ignored.ts"
    When the user opens Quick Open and types "ignored"
    Then no results are shown

  @product @quick-open @e2e @delta-added
  Scenario: Quick Open shows working-tree status badges
    Given the working tree has a modified file "src/app.ts"
    And the working tree has an untracked file "src/scratch.ts"
    When the user opens Quick Open with an empty filter
    Then the result "src/app.ts" shows the status "modified"
    And the result "src/scratch.ts" shows the status "New" in green

  @product @quick-open @e2e @delta-added
  Scenario: Quick Open still caps results at 512
    Given the workspace repository has more than 512 nonignored files
    When the user opens Quick Open with an empty filter
    Then no more than 512 results are shown

  @product @quick-open @e2e @delta-added
  Scenario: The obsolete include-untracked setting no longer affects Quick Open
    Given localStorage has "diffscribe-quick-open-include-untracked" set to "false"
    When the user opens Quick Open and types "scratch"
    Then "src/scratch.ts" is still shown as a result

  @product @observation @e2e @delta-added
  Scenario: Seeded observation cards render with badges, status, and actions
    Given the active review has observations of types "issue", "risk", and "suggestion"
    When the user opens the Comments panel
    Then each observation card shows its type badge and severity badge
    And each card shows a status dot and body text
    When the user hovers a card
    Then the card actions appear

  @product @observation @e2e @delta-added
  Scenario: Observation cards render correctly in dark and synthwave themes
    Given the active review has observations
    When the user selects the Synthwave theme
    Then the observation cards remain readable with contrast on their badges
```

### Feature-file updates at on_done (merged, English, delta-tagged)

- `specs/features/product/quick-open.feature` — @delta-modified: default tracked-only scenario → always-include untracked; include-untracked setting scenario → obsolete-key scenario; empty-query scenario wording; @delta-removed where obsolete. Add status-badge scenarios.
- `specs/features/product/open-files-tabs.feature` — @delta-added pinned-tab scenarios; @delta-modified "Closing the only tab shows the empty viewer" (file tabs only → returns to pinned tab; "No file selected" only with no workspace); border scenario updated.
- `specs/features/product/panel-rail-ux-corrections.feature` — @delta-modified left rail bottom controls (Help above control, control at absolute bottom), right-edge nav geometry; mobile sheet scenario unchanged.
- `specs/features/product/settings-panel.feature` — @delta-removed Quick Open untracked switch scenario.
- `specs/features/product/file-list-tree.feature` / `file-list-panel.feature` — @delta-modified view-selection scenarios (via Settings only).
- `specs/features/product/workspace-git-review-ux.feature` — @delta-modified complete-diff scenarios (pinned tab), @delta-added context header.
- `specs/features/product/observation-*.feature` — @delta-added seeded card visual scenarios where BDD-steps exist.
- New file above: `workspace-tabs-quick-open-refinements.feature`.

BDD steps (English) must be updated/added in `tests/steps/` for every changed scenario; `check:bdd-language` must stay green.

---

## 7. Phased implementation (Red → Green → Refactor)

QA commands (every phase REFACTOR step, sequential on one host — never concurrent BDD+E2E):
`npm run format && npm run lint && npm run check && npm run test:unit && npm run test:integration && npm run check:bdd-language && npm run test:bdd`
E2E (after BDD completes, alone): `npm run test:e2e -- --workers=8` — exactly 8 workers, never another count, never concurrent with BDD.

### Phase 1 — Pinned complete-diff tab (state contract)

Objective: workspace-scoped synthetic pinned tab with full lifecycle; work-area renders by active tab; empty state only for the no-workspace case.

RED:

- `tests/unit/web/active-file-store.test.ts` — extend: pin created first; `closeTab('complete-diff')` ignored; `openFileTab` never replaces the pin (reuse-active with pin active appends/activates); closing last file tab activates the pin; `resetTabs()` clears files and drops the pin; `activateTab` accepts pin id; unique-by-path preserved.
- `tests/e2e/pinned-complete-diff.spec.ts` — **NEW**: first/non-closable/middle-click; file coexistence; revisit; no "No file selected"; comparison refresh in place; workspace switch replaces pin and clears file tabs; no workspace → no pin.
- Update `tests/e2e/open-files-tabs.spec.ts` and `tests/e2e/complete-diff.spec.ts` — pinned-tab expectations replace "no tab" assumptions; keep W6 plain-click scroll / Ctrl/Cmd-click tab scenarios passing.
- Update `tests/steps/open-files-tabs.steps.ts`, `tests/steps/workspace-git-review-ux.steps.ts` for new steps; update `specs/features/product/open-files-tabs.feature`, `workspace-git-review-ux.feature` (at on_done).

GREEN:

- `src/lib/web/stores/active-file-store.ts` — `CentralTab` union; `COMPLETE_DIFF_TAB_ID = 'complete-diff'`; `openTabs: writable<CentralTab[]>`; `activeTabId`; derived `activeFile`/`activeFilePath`/`activeFileLabel` remain file-only (null when pin active); `pinCompleteDiff()` (idempotent, first, activates); `openFileTab` inserts after the pin and never replaces it; `activateTab` handles both kinds; `closeTab` ignores the pin and, when the last file tab closes, activates the pin; `resetTabs()` clears all.
- `src/lib/web/components/open-files-tabs.svelte` — render pinned tab first (no close button, no middle-click close, label "Complete diff", testid `pinned-complete-diff-tab`, roving nav includes it); tabpanel empty state only when no workspace/no tabs.
- `src/routes/+page.svelte` — work-area render: pin active → `CompleteDiffViewer` (with `scrollTarget`); else file tab + Project rail → `SourceViewer`; else file tab → `DiffViewer`; else empty state. Workspace-change effect: `resetTabs()`; when new workspace active → `pinCompleteDiff()`.

Exit criteria: unit suite green; pinned-tab E2E green; W6 scroll/click E2E green; complete-diff API untouched (integration tests green).
Scenarios: complete-diff lifecycle scenarios (@product @navigation).

### Phase 2 — Quick Open: unconditional untracked + status badges

Objective: remove the include-untracked preference and client filter; always include nonignored untracked; show comparison status badges via existing mapping.

RED:

- `tests/unit/web/quick-open-scorer.test.ts` — remove includeUntracked cases; add: all files eligible; `status` passthrough; ranking/highlights/cap unchanged.
- `tests/unit/web/quick-open-store.test.ts` — rewrite for `removeLegacyQuickOpenSetting`.
- `tests/unit/web/file-list-status-loader.test.ts` — **NEW**: cache per workspace+comparison; invalidation; failure → null (no badge).
- `tests/e2e/quick-open.spec.ts` — update: untracked shown by default; ignored excluded; status badges (modified/New-green); legacy key inert; 512 cap; Settings switch absent.
- `tests/e2e/settings-panel.spec.ts` — remove untracked-switch test.
- Update `tests/steps/quick-open.steps.ts`, `tests/steps/settings-panel.steps.ts`; features at on_done.

GREEN:

- `src/lib/web/services/quick-open-scorer.ts` — delete `ScoreOptions.includeUntracked` and the filter; `ScorableFile`/`ScoredFile` carry `status?: FileChangeStatus` passthrough (no scoring impact).
- `src/lib/web/services/file-list-status-loader.ts` — **NEW**: `loadStatusMap(workspaceId, comparisonDraft)` → `Map<string, FileChangeStatus> | null`, cache keyed by workspace+comparison signature, request guard, non-critical failure.
- `src/lib/web/components/quick-open-dialog.svelte` — accept `comparisonDraft` prop; load status map on open; merge status into results by path; render `StatusBadge` (`statusTone`/`statusLabel`) replacing the "untracked" text marker; call `removeLegacyQuickOpenSetting` on open; keep 512 cap + highlights + keyboard contract.
- `src/lib/web/stores/quick-open-store.ts` — replace module with `removeLegacyQuickOpenSetting(storage)` (removes obsolete key) + doc comment.
- `src/lib/web/components/settings-panel.svelte` — remove switch row + import.

Exit criteria: scorer/loader/dialog unit tests green; Quick Open E2E green; settings E2E green; no server change.
Scenarios: Quick Open inclusion/ignore/badges/cap/legacy (@product @quick-open).

### Phase 3 — Panel/rail layout: left bottom control, right-edge nav, workspace context

Objective: stable bottom left control (full width expanded), Help above; right-edge desktop nav; context header.

RED:

- `tests/e2e/panel-rail-corrections.spec.ts` — update/add: left control bottom-most in both states with Help above (geometry: `help-btn` above footer row); expanded control row spans panel width; collapsed spans rail width; right-edge nav bounding boxes (tablist right edge == panel right edge; nav right of content); one vertical tablist; focus/keyboard order unchanged (ArrowDown/Up).
- `tests/e2e/workspace-context.spec.ts` — **NEW**: header on Project/Git/Settings; absent on Workspaces; content = displayName + path.
- Update `tests/steps/ui-redesign.steps.ts`/`panel-rail` steps; features at on_done.

GREEN:

- `src/routes/+page.svelte` — grid `grid-template-rows: 1fr auto`; new left-region footer grid item (`grid-column: 1 / 3`, testids preserved: `left-panel-collapse-btn` expanded / `left-panel-reopen-btn` collapsed, one button switching icon/label by collapsed state); remove the old footer from the aside; keep collapse focus-continuity effect.
- `src/lib/web/components/rail-tabs.svelte` — remove rail reopen control; keep `help-btn` at the rail bottom (now directly above the footer row).
- `src/lib/web/components/right-panel-tabs.svelte` — `.right-panel-body { flex-direction: row-reverse }`; nav separator border on inner side; active indicator on outer/right edge; mobile branch untouched.
- `src/lib/web/components/workspace-context-header.svelte` — **NEW** (displayName + repositoryPath, `title`, testid `workspace-context-header`); `+page.svelte` renders it when `activeRailTab !== 'workspaces' && activeWorkspace` exists.

Exit criteria: geometry E2E green; responsive-mobile + mobile-hardening green (mobile preserved); a11y keyboard E2E green.
Scenarios: layout/context scenarios (@product @layout @a11y @responsive).

### Phase 4 — Git file-list controls removal (Settings sole source)

Objective: remove in-Git List/Tree toggle; Settings remains the only writer.

RED:

- `tests/e2e/file-list-tree.spec.ts`, `tests/e2e/file-list-panel.spec.ts`, `tests/e2e/comparison-propagation.spec.ts`, `tests/e2e/mobile-hardening.spec.ts` — update view selection to go through Settings (`settings-file-list-tree`/`settings-file-list-list`); assert no `file-list-view-*` testids in the Git panel.
- `tests/e2e/helpers/register-workspace.ts` — `switchFileListToListView` reworked: open Settings rail, set view, return to Git (or set localStorage via `page.evaluate` for setup-only specs; keep user-path assertions in the panel specs).
- Update steps/features at on_done.

GREEN:

- `src/lib/web/components/file-list.svelte` — remove `.view-switcher` block, `setView`, `writeVisualSettings` import; keep `view` read from `readVisualSettings` (Settings-driven); tree/list rendering logic untouched.

Exit criteria: file-list E2E green; Settings-driven persistence E2E green; no Git-local toggle.
Scenarios: no Git List/Tree controls (@product @navigation).

### Phase 5 — Central tab borders + Observations seeded visual tests

Objective: active/inactive tab borders; evidence-backed observation styling with seeded coverage.

RED:

- `tests/e2e/open-files-tabs.spec.ts` — computed-style assertions: active tab `border-bottom-width: 0`; inactive tab `border-bottom-width: 1px`.
- `tests/e2e/observation-visual.spec.ts` — **NEW**: seed workspace + review + observations via the app's API/DB fixtures (reuse observation-ownership seeding pattern); assert populated cards render (type/severity badges, status dot, body, meta), hover/focus reveal actions, panel width/no overflow, both themes (Dark Deep + Synthwave '84), stale card variant renders Stale badge + snapshot when `staleStatus` provided (component-level fixture only if wired; otherwise assert the token classes exist and document).
- Update `tests/steps/observation-*.steps.ts` + features at on_done.

GREEN:

- `src/lib/web/components/open-files-tabs.svelte` — CSS: `.file-tab.active { border-bottom: none }`; `.file-tab.inactive { border-bottom: 1px solid var(--border-subtle) }`.
- `src/lib/web/components/observation-panel.svelte` / `observation-card.svelte` — apply ONLY corrections proven by seeded screenshots (e.g., card width within panel, `min-width: 0` chain, badge contrast in dark themes, status-dot alignment). No stale wiring.

Exit criteria: border E2E green; seeded observation E2E green in both themes; a11y-observation-card scenarios stay green.
Scenarios: border + observation seeded scenarios (@product @layout @observation).

### Phase 6 — Docs, Gherkin persistence, full QA, memory

Objective: source-of-truth docs, persisted Gherkin (after approval), changelog, full QA.

- Docs (English, via `docs-writer`):
  - `docs/design.md` — right-edge nav (lines ~723, ~852-861), left bottom control slot + Help order (W9 section ~1156-1187), central tab borders (~809), Quick Open dialog (untracked always, badges, obsolete setting, ~818-840), complete-diff pinned tab (~1123-1137), workspace context header, Git file-list no toggle, observation card states.
  - `docs/architecture.md` — client tab state (~301-319) pinned tab; Quick Open index (~321-338) unconditional untracked + status join + loader; client preferences (~285-299) remove untracked flag; complete-diff shell wiring (~799-800).
  - `docs/PRD.md` — §18 updates (Quick Open untracked removal, pinned complete-diff tab, right-edge nav, context header, Git view controls); flag nothing outside Stage 1.
  - `docs/domain.md` — note Quick Open consumes `FileChangeStatus`/`FileListEntry` by path (no domain change).
  - `docs/changelog.md` — new "Unreleased" entry (features + corrections, Keep a Changelog).
  - `docs/versioning.md` — only if user confirms a version bump (client-only pref removal → likely no bump).
- Gherkin persistence (ONLY after approval, `when=on_done`): create `specs/features/product/workspace-tabs-quick-open-refinements.feature`; apply delta-modified/removed to the features listed in §6; sync `tests/steps/`.
- Full QA chain (sequential): `npm run qa` then `npm run test:e2e -- --workers=8`.
- Memory writes (see §12).

Exit criteria: docs consistent; `check:bdd-language` green; all QA stages green; changelog updated.

---

## 8. Impacted files (complete inventory)

### Source (web)

| File                                                     | Change                                                                         |
| -------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `src/lib/web/stores/active-file-store.ts`                | Pinned tab union + lifecycle                                                   |
| `src/lib/web/components/open-files-tabs.svelte`          | Pinned tab render, borders, empty state                                        |
| `src/routes/+page.svelte`                                | Pin lifecycle, work-area render, left-region footer, context header, grid rows |
| `src/lib/web/components/rail-tabs.svelte`                | Help-above-footer; remove rail reopen                                          |
| `src/lib/web/components/right-panel-tabs.svelte`         | Right-edge desktop nav                                                         |
| `src/lib/web/components/workspace-context-header.svelte` | **NEW**                                                                        |
| `src/lib/web/components/quick-open-dialog.svelte`        | Untracked always, badges, legacy cleanup, comparison prop                      |
| `src/lib/web/services/quick-open-scorer.ts`              | Drop includeUntracked; status passthrough                                      |
| `src/lib/web/services/file-list-status-loader.ts`        | **NEW**                                                                        |
| `src/lib/web/stores/quick-open-store.ts`                 | Legacy-key cleanup helper                                                      |
| `src/lib/web/components/settings-panel.svelte`           | Remove untracked switch                                                        |
| `src/lib/web/components/file-list.svelte`                | Remove List/Tree controls                                                      |
| `src/lib/web/components/observation-panel.svelte`        | Evidence-backed corrections                                                    |
| `src/lib/web/components/observation-card.svelte`         | Evidence-backed corrections                                                    |

### Tests

| File                                                                                                                                                                                                   | Change                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------- |
| `tests/unit/web/active-file-store.test.ts`                                                                                                                                                             | Pinned-tab unit cases                       |
| `tests/unit/web/quick-open-scorer.test.ts`                                                                                                                                                             | Remove includeUntracked; status passthrough |
| `tests/unit/web/quick-open-store.test.ts`                                                                                                                                                              | Legacy cleanup                              |
| `tests/unit/web/file-list-status-loader.test.ts`                                                                                                                                                       | **NEW**                                     |
| `tests/e2e/pinned-complete-diff.spec.ts`                                                                                                                                                               | **NEW**                                     |
| `tests/e2e/workspace-context.spec.ts`                                                                                                                                                                  | **NEW**                                     |
| `tests/e2e/observation-visual.spec.ts`                                                                                                                                                                 | **NEW** (seeded)                            |
| `tests/e2e/open-files-tabs.spec.ts`                                                                                                                                                                    | Pinned tab + border assertions              |
| `tests/e2e/complete-diff.spec.ts`                                                                                                                                                                      | Pinned-tab expectations (W6 kept)           |
| `tests/e2e/quick-open.spec.ts`                                                                                                                                                                         | Untracked/badges/legacy/cap                 |
| `tests/e2e/settings-panel.spec.ts`                                                                                                                                                                     | Remove untracked switch test                |
| `tests/e2e/panel-rail-corrections.spec.ts`                                                                                                                                                             | Left footer + right-edge geometry           |
| `tests/e2e/file-list-tree.spec.ts`                                                                                                                                                                     | View via Settings                           |
| `tests/e2e/file-list-panel.spec.ts`                                                                                                                                                                    | View via Settings                           |
| `tests/e2e/comparison-propagation.spec.ts`                                                                                                                                                             | View via Settings                           |
| `tests/e2e/mobile-hardening.spec.ts`                                                                                                                                                                   | View via Settings; mobile preserved         |
| `tests/e2e/helpers/register-workspace.ts`                                                                                                                                                              | `switchFileListToListView` rework           |
| `tests/steps/open-files-tabs.steps.ts`, `quick-open.steps.ts`, `settings-panel.steps.ts`, `workspace-git-review-ux.steps.ts`, `ui-redesign.steps.ts`, `file-list-*.steps.ts`, `observation-*.steps.ts` | Step sync for changed scenarios             |

### Gherkin (persisted at on_done)

| File                                                                       | Change                     |
| -------------------------------------------------------------------------- | -------------------------- |
| `specs/features/product/workspace-tabs-quick-open-refinements.feature`     | **NEW**                    |
| `specs/features/product/quick-open.feature`                                | modified/removed scenarios |
| `specs/features/product/open-files-tabs.feature`                           | modified/added scenarios   |
| `specs/features/product/panel-rail-ux-corrections.feature`                 | modified scenarios         |
| `specs/features/product/settings-panel.feature`                            | removed scenario           |
| `specs/features/product/file-list-tree.feature`, `file-list-panel.feature` | modified scenarios         |
| `specs/features/product/workspace-git-review-ux.feature`                   | modified/added scenarios   |
| `specs/features/product/observation-status.feature` (+ staleness)          | added seeded scenarios     |

### Docs

`docs/design.md`, `docs/architecture.md`, `docs/PRD.md`, `docs/domain.md`, `docs/changelog.md`, `docs/versioning.md` (only if bumped).

### State/memory

`.nas/state/active/0003-workspace-tabs-quick-open-refinements/plan.md` (this file), mind memories (§12).

---

## 9. Test plan

- **RED**: per phase, failing tests first (unit + E2E + step updates), executed and shown failing before implementation.
- **GREEN**: smallest behavior change per phase; re-run the phase's tests.
- **REFACTOR** (each phase): `npm run format` (fix with `npm run format:fix` if needed, verify diff formatting-only), `npm run lint` (max-warnings=0), `npm run check`, `npm run test:unit`, `npm run test:integration`, `npm run check:bdd-language`, `npm run test:bdd`; then E2E alone: `npm run test:e2e -- --workers=8`.
- Layers: unit (store/scorer/loader), BDD (steps + quickpickle features), E2E (Playwright, geometry + behavior + seeded observation visuals), integration (unchanged, protects the untouched server contract).
- Every Playwright invocation uses exactly `npm run test:e2e -- --workers=8`; never run BDD and E2E concurrently on the same host.

---

## 10. Risks and mitigations

| Risk                                                                    | Mitigation                                                                                                                |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Pinned tab changes tab identity/lifecycle (close/reuse/reset semantics) | Unit-first contract in `active-file-store.test.ts`; explicit pin scenarios; keep `activeFilePath` semantics for file tabs |
| W6 complete-diff click semantics could regress                          | Preserve plain-click scroll + Ctrl/Cmd-click tab in E2E; pinned viewer reuses the existing component/API                  |
| Right-edge nav breaks existing E2E selectors/geometry                   | row-reverse keeps DOM order; update bounding-box assertions; run full panel-rail + mobile suites                          |
| Left footer grid change affects resize/collapse/focus                   | Geometry E2E both states; keep focus-continuity effect; verify `left-resize-handle` position math                         |
| Quick Open status join cost                                             | Per-comparison cache + request guard; 512 cap unchanged; failure degrades to no badges                                    |
| Obsolete setting residual behavior                                      | Single cleanup call on dialog open; removed from Settings; unit + E2E prove inertness                                     |
| Observations defect not fully isolated                                  | Seeded visual tests before any correction; corrections limited to evidence; stale wiring explicitly out                   |
| Docs stale wording (right-edge, Quick Open, tabs)                       | Phase 6 doc updates; changelog entry; user request controls over older docs                                               |
| E2E flakiness with 8 workers / host contention                          | Sequential BDD→E2E on one host; exact `--workers=8`; no parallel runs                                                     |

---

## 11. Definition of done

1. All nine user requirements demonstrably satisfied with E2E/unit evidence (per-phase exit criteria).
2. Pinned complete-diff tab contract green: first, non-closable, revisitable, workspace-scoped, comparison refresh, reset semantics; no misleading pin without a workspace.
3. Quick Open: nonignored untracked always included, ignored excluded, status badges via existing mapping, 512 cap, legacy key inert.
4. Full QA chain green: format, lint, check, unit, integration, bdd-language, bdd, e2e (8 workers), build — sequential on one host.
5. Docs updated (design/architecture/PRD/domain/changelog) and consistent with implementation.
6. Gherkin persisted only after approval (`on_done`), merged canonical feature + delta-tagged updates, English, `check:bdd-language` green.
7. No server/API/DTO/migration changes; no new runtime dependencies; no Stage 2+ scope.
8. Memory writes recorded (§12); active checkpoint closed by the orchestrator.

---

## 12. Delegation order, skills, routing rationale, memory

### Delegation order

1. User approval of this plan → persist Gherkin (`on_done`).
2. `nas_developer` FULL — phases 1→6 in order, TDD Red→Green→Refactor per phase.
3. `nas_qa` (Tester) — audit vs plan/features, re-run full QA + E2E (8 workers), emit `validation-results.md`.
4. Developer fix loop via `IADEV-applying-feedback` until PASS.
5. Orchestrator: docs-writer review pass, changelog, memory/checkpoint close.

### Skills

- Planner (this pass): `mind-management`, `clean-backend-architecture`, `clean-svelte-architecture`, `clean-code`, `frontend-design`, `svelte-code-writer`, `IADEV-bdd-implementation`, `IADEV-writing-gherkin`, `IADEV-writing-implementation`, `docs-writer` (for doc tasks in plan), `documentation-lookup` not needed (no external API change).
- Developer: `mind-management`, `clean-backend-architecture` (Quick Open status boundary), `clean-svelte-architecture`, `clean-code`, `frontend-design`, `svelte-code-writer`, `IADEV-test-driven-development`, `IADEV-bdd-implementation`, `IADEV-writing-gherkin`, `IADEV-applying-feedback`, `docs-writer` (docs).
- QA: `mind-management`, `clean-backend-architecture` (API/data-flow verification), `clean-svelte-architecture`, `clean-code`, `frontend-design`, `svelte-code-writer`, `IADEV-validating-implementation`, `IADEV-bdd-implementation`.

### Routing rationale

Complexity complex + magnitude high: multi-area UI state (tabs/panels/Quick Open/observations), a new state contract (pinned tab) and a data-flow contract (status join), plus visual/accessibility/performance risk flags → full planner + full developer (no mini), QA hard gate, Gherkin required.

### Memory writes (orchestrator persists)

- space: `projects/diffscribe`
  - key: `0003-workspace-tabs-quick-open-refinements-plan-approved`
    content: plan decisions: web-only pinned synthetic workspace-scoped complete-diff tab (discriminated kind, stable id, first/non-closable, comparison refresh in place, workspace reset recreates pin and clears file tabs, no pin without workspace); Quick Open unconditional nonignored untracked + `/file-list` status join by path with per-comparison cache, 512 cap, fallback no-badge; right-edge desktop nav via row-reverse preserving DOM order; left collapse control in stable shell bottom footer spanning rail+panel, Help above; workspace context header on Project/Git/Settings only; active central tab no bottom border; Git List/Tree controls removed (Settings sole source); obsolete `diffscribe-quick-open-include-untracked` key cleaned on open; observations seeded-visual-first, stale wiring stays null; no server change, no new deps; Gherkin persisted on_done.
  - tags: `cat:decision`, `status:proposed`, `type:plan`
  - links: `0003-current-refinement-gaps`, `0003-pinned-complete-diff-tab-confirmation`, `0003-quick-open-untracked-status-contract`, `0003-r3-runtime-confirmation`

---

## 13. Handoff state

- plan.md: CREATED (this file).
- Gherkin: NOT persisted (authorization `when=on_done`; approval pending).
- Source/tests/docs/config: untouched by the planner.
