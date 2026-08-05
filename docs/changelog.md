# DiffScribe — Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Fixed

- The desktop left collapse/expand control moved into a stable bottom footer
  row spanning the rail + panel columns when expanded (rail width when
  collapsed); Help stays in the rail directly above it. The old rail reopen
  control was removed.
- Desktop right-panel tab icons now sit on the panel's right edge via
  `row-reverse` (DOM/keyboard order unchanged, inner separator border, outer
  active indicator); the mobile horizontal sheet is unchanged.
- The active central tab has no bottom border; inactive tabs show a subtle
  bottom border.
- The Git file list no longer exposes List/Tree controls; the Settings
  "File list view" preference is the sole presentation source.
- Panel/rail UX corrections (0002): the desktop right panel now navigates
  with vertical icon tabs in both expanded and collapsed states (the
  expanded branch previously rendered horizontal header tabs). Each desktop
  state exposes exactly one vertical tablist; Comments/Review tabs link to
  real consumer-rendered `tabpanel` elements with reciprocal
  `aria-controls`/`aria-labelledby` (both panels stay mounted, the inactive
  one hidden), and expanding via strip tab or reopen button returns focus to
  the active tab.
- Left rail: selecting a rail option while the left panel is collapsed now
  selects the option AND opens the panel idempotently (mirroring the right
  strip); selecting while open never toggles it closed. Collapsing the left
  panel transfers focus to a visible rail control, and the collapsed desktop
  subtree is `inert` + `aria-hidden` while staying mounted. The left reopen
  button and Help form one bottom-pinned group (reopen above Help); the
  right strip reopen stays bottom-pinned. Programmatic rail switches (Quick
  Open, workspace landing, Git Ctrl/Cmd-click) still do not reopen a
  collapsed panel.
- The expanded right panel uses `box-sizing: border-box` so its 1 px border
  stays inside the grid column (right edge flush with the viewport).
- Icon-only rail/panel controls expose native `title` fallbacks
  (`Open left/right panel`, `Collapse left/right panel`) alongside their
  existing `aria-label`; the mobile sheet keeps its horizontal header tabs
  and drawer behavior unchanged.

### Added

- Workspace tabs, panels, and Quick Open refinements (0003): the complete
  diff is now the first synthetic non-closable workspace-scoped tab of the
  central viewer (stable id `complete-diff`, never a path sentinel). It
  exists whenever a workspace is active, refreshes in place on comparison
  change, survives file-tab coexistence, and is recreated after a workspace
  switch clears file tabs; closing the last file tab returns to it, and the
  generic "No file selected" empty state only remains for the no-workspace
  case.
- Quick Open now always includes nonignored untracked files (ignored files
  stay excluded by Git standard ignore rules), shows working-tree status
  badges joined from the comparison-aware `/file-list` result by path
  through the existing `statusTone`/`statusLabel` mapping (`untracked` →
  **New**, green), keeps the 512-result cap, and cleans the obsolete
  `diffscribe-quick-open-include-untracked` localStorage key on every open.
- Workspace context header: the active workspace display name and truncated
  repository path render at the top of Project/Git/Settings panel content
  (never on Workspaces).
- Post-tranche C hardening: real refresh states wired into the Base/Target
  branch popup — the popup shows a loading state only while a refresh is in
  flight with no branches known, a failed refresh inside an open popup shows
  an inline error with Retry, and the global error banner is gated behind
  `!openSlot` so exactly one alert owner exists at a time. Real IME
  composition events (compositionstart/end + `isComposing` Enter) are
  covered by executable E2E, and the responsive popup contract is verified
  at 320/375/768 px.
- Targeted pending-safe Project tree invalidation
  (`projectTreeLoader.invalidate(workspaceId)`): drops only the given
  workspace's cached snapshot; while a request is pending the in-flight
  promise is shared (no overlapping fetches) and the first load after it
  settles starts one fresh request. Called only after a successful Git
  context refresh and after a successful workspace repair; rail switches,
  comparison changes, and file-list refreshes never invalidate, so switching
  tabs stays request-free.
- BDD/E2E: `project-tree-invalidation.spec.ts` (new) plus hardening
  scenarios in `git-ref-popup.feature`, `git-context-panel.feature`,
  `project-tree.feature`, and `quick-open.feature`; docs:
  `docs/architecture.md` (popup refresh states, loader invalidation call
  sites).
- Tranche C (branch selector): `BranchDto` extended additively with
  `canonicalRef` (full Git ref as selection value/key) and optional
  `committerDate` (ISO-8601 UTC). Local heads and cached remote refs are
  read with ONE read-only `git for-each-ref` invocation (`%(HEAD)` +
  `%(committerdate:iso8601)`); no fetch/pull/push/ls-remote; remote HEAD
  pseudo-refs excluded. Ordering is pure TypeScript (`branch-sort.ts`):
  Local group first, Cached remote second, committer date descending,
  missing dates last, canonical ref ascending tie-break.
- Product-specific non-modal branch popup (`branch-select-popup.svelte`)
  for the Base/Target triggers: inline inside the panel (no portal/dialog),
  mutual exclusion between triggers, autofocused search, Local/Cached
  remote groups ordered by recency, fuzzy filter across both groups,
  combobox ARIA contract (aria-selected = slot value only; separate current
  branch marker), Arrow/Home/End/Enter/Escape keyboard with IME guard and
  focus return, empty/no-match/loading/error/retry states, and compact
  viewport fit with internal scroll. Selection stores the canonical ref and
  shows the short visible label (`dev`, `origin/dev`); no checkout.
- Async/error safety: Git panel refresh and file-list fetch run under
  monotonic request guards (`request-guard.ts`); a failed refresh preserves
  the last good context with a visible error and Retry; project tree
  comparison/status fetch discards stale responses.
- BDD features: `git-ref-popup.feature` (new) plus tranche-C scenarios in
  `git-context-adapter.feature`, `git-context-panel.feature`, and
  `git-branches.feature`; E2E specs `git-ref-popup.spec.ts` and
  `git-context-race.spec.ts` (new), updated `git-branches.spec.ts` and
  `git-context-panel.spec.ts`.
- Docs: `docs/architecture.md` (combined for-each-ref reader, canonical
  refs, product composite vs generic UI), `docs/design.md` (popup triggers,
  groups/order, current vs selected, keyboard/ARIA/IME/focus, states,
  responsive, visible label convention), `docs/domain.md` (canonical ref
  convention for GitRef branch values).
- Workspace/Git review UX (0001-workspace-git-review-ux):
  - **Added:** complete diff of the active comparison in the Git rail when no
    file tab is open — new aggregate contract
    (`GitCompleteDiffReader`, `GetCompleteDiffUseCase`,
    `CompleteDiffResult` DTO, `SimpleGitCompleteDiffReader`,
    `GET /api/workspaces/[id]/complete-diff`, `CompleteDiffViewer`);
    deterministic path order; per-file caps (256 KB / 5 000 lines) and
    aggregate caps (500 files / 4 096 KB / 40 000 lines); binary/truncation
    markers; partial-error collection; plain index click scrolls to the
    section, Ctrl/Cmd-click opens a full-file tab in Project mode.
  - **Added:** visualization settings aggregate
    (`diffscribe-visual-settings` v1) with read-through migration from the
    legacy `diffscribe-file-list-view` key; Tree is the fresh-context
    default; "Files" settings section controls file-list view and Markdown
    default view.
  - **Added:** Markdown Raw/Preview toggle in the source viewer (top right)
    with a dependency-free, strictly escaping renderer
    (`markdown-renderer.ts`) that rejects unsafe URLs; client language-map
    mirror with parity tests.
  - **Added:** Git-first landing (selecting a workspace activates the Git
    rail); project directories show descendant-derived status dots with
    deterministic precedence; technical `untracked` renders as the English
    label **New** in green (API/domain value unchanged).
  - **Added:** branch selector widening with long-name tooltips, reselectable
    fixed Working tree target, removed redundant comparison caption; bottom
    collapse footers for both desktop panels with a bottom reopen button on
    the collapsed right strip; middle-click closes any file tab; keyboard-
    accessible Help dialog from the bottom of the left rail.
  - **Fixed:** deleting a workspace now refreshes the page data before
    closing the dialog, so the sidebar drops the deleted workspace
    immediately without a reload; the Open Workspace form keeps the editable
    path and adds a feature-detected directory browser (name prefill +
    limitation hint).
  - **Changed:** fresh file-list default to Tree; `--tree-status-untracked`
    token is green in all three theme blocks; panel collapse/expand controls
    moved to bottom footers (desktop).
  - Docs: `docs/PRD.md` §18 (Spanish preserved), `docs/architecture.md`
    (aggregate contract, visual settings, Markdown security, Git landing),
    `docs/design.md` (complete diff, status colors, selector, panels, toggle,
    help), `docs/domain.md` (presentation mapping), `docs/versioning.md`
    (additive 0.x route, no SQLite migration).

### Changed

- Removed the obsolete Quick Open "Include untracked files" setting from
  Settings and its localStorage contract (client-only preference; no version
  bump).
- Observations: seeded visual/accessibility coverage added; the populated
  card styling met the existing tokens, so no card/panel corrections were
  required.
- Mobile hardening (H1-H4): the file list controls wrap in narrow panels
  (`flex-wrap: wrap`, `min-width: 0` on the filter input; the status select
  keeps its readability minimum) so List/Tree stay inside the panel and
  hit-testable at 320/375/768/1280 with view persistence intact. The mobile
  backdrop drops to `--z-backdrop: 299` below the right sheet (300) and left
  drawer (301); modal stays 400. The mobile right toggle is a deliberate
  third grid column (`48px 1fr 32px`, full center height, >= 24x24) instead
  of an implicit ~18px second row, sits above the backdrop, and keeps opening
  and closing the sheet. The Git context panel is the single scroll owner
  (`flex: 1 1 auto; min-height: 0`) and the file list panel is content-sized
  (`height: auto`) with its `overflow: hidden` guard, so commits, rows,
  pagination, and footer are reachable by one scroll. Gherkin scenarios
  merged into `responsive-mobile.feature`, `file-list-panel.feature`, and
  `git-context-panel.feature`; real-geometry E2E in
  `tests/e2e/mobile-hardening.spec.ts` (elementFromPoint, bounding boxes,
  scroll ownership, real clicks).

### Fixed

- Line-number gutter geometry: every `.line-number` cell now measures
  exactly 48 px outer width including its `--space-2` (8 px) inline padding
  (`box-sizing: border-box` on the cell rule in `diff-viewer.svelte` and
  `source-viewer.svelte`; previously the content-box padding pushed the cell
  to ~64/65 px). Unified diff rows keep two cells (old + new, 96 px
  combined); the source divider (1 px, inside the 48 px), the change marker
  (4 px), and `.line-content` padding (12 px) are unchanged. Selection,
  hover, hunk focus, wrapping, and scroll behavior are preserved. Gherkin
  scenarios merged into `diff-viewer.feature`, `source-view.feature`, and
  `line-wrapping.feature`; real-geometry E2E in
  `tests/e2e/gutter-geometry.spec.ts` (bounding boxes, tolerance <= 1 px,
  viewports 320/375/768/1280, 1/4/5-digit numbers); docs:
  `docs/design.md` (Line-number gutter contract).

### Added

- UI/UX tranche A: in-mount overlay host (`[data-overlay-host]` in the root
  layout) plus a typed `portal` action (`src/lib/web/actions/portal.ts`)
  applied to the Menu popup, so overflow menus paint above later rows even
  for invalid workspaces (stacking contexts from `opacity < 1`) without
  `document.body` (WS-OVERFLOW-06).
- Invalid workspace affordance: the ACTIVE/INVALID text badges are gone; an
  invalid workspace shows a warning icon button with an accessible name that
  opens the generic Dialog with Close and Repair, reusing the existing repair
  form (WS-INVALID-01/02/03).
- `--text-2xs: 0.625rem` token declared in `:root`, Dark Deep, and
  Synthwave '84 blocks and documented in `docs/design.md`; rail labels use it
  with `nowrap`, `max-width`, and ellipsis (RAIL-02, TOKEN-02).
- Collapsed desktop right panel now renders a 48 px vertical Comments/Review
  strip using the Tabs kit (`orientation="vertical"`); clicking a strip tab
  expands and selects it; collapsing returns focus to the active strip tab
  (PANELS-UI-05, PANEL-STRIP-01/02/03). Mobile branch unchanged.
- Per-instance observation draft store
  (`src/lib/web/stores/observation-draft-store.svelte.ts`) with explicit
  states (pristine/dirty/submitting/confirm); the draft survives Comments to
  Review tab switches; dirty drafts ask for confirmation on replace clicks
  and Cancel (generic Dialog with Keep draft/Discard); Ctrl/Cmd toggle and
  Shift extend preserve the draft; selection payloads carry
  `kind: replace|toggle|extend`; missing context (no review / no comparison)
  and failed creates show inline accessible errors (OBS-DRAFT-*, OBS-ERR-*,
  LINE-SEL-10/11).

- Base UI kit in `src/lib/web/components/ui/`: Button, IconButton, TextInput,
  Select, Checkbox, Switch, Menu, Popover, Dialog, Tabs, Tooltip, Badge, and
  StatusBadge. Generic, stateless, token-driven primitives with native HTML
  (`button`, `input`, `select`, `dialog`), label/error wiring
  (`aria-invalid`/`aria-describedby`), keyboard contracts (roving tabindex,
  arrows, Home/End, Escape with focus return), and a provisional control
  scale sm=24 / md=32 / lg=40 px pending E2E target-size validation.
- `ui/variants.ts` and `ui/ids.ts`: exported variant/size/tone lists and
  deterministic id helpers used by the kit primitives.
- BDD feature `base-ui-kit.feature` with contract scenarios (boundaries,
  native HTML, ARIA, keyboard, tokens, import guard) and matching step
  definitions.
- Unit suite for the kit: variant lists, id invariants, import boundary
  guard, and token audit over `components/ui/`.
- E2E coverage for the kit through migrated consumers (forms, delete dialog,
  rail/right tabs): DOM semantics, ARIA wiring, keyboard/focus,
  target size, themes, and reduced motion.
- Incremental migration of high-value consumers to the kit: workspace
  forms, workspace delete dialog, and tab assemblies (rail, right panel).
  `data-testid` attributes and behavior are preserved.
- `docs/design.md`: Base UI kit contract section (purpose, boundaries,
  location, catalog, control scale, keyboard/focus, ARIA, tokens, reduced
  motion, validation, anti-patterns); WCAG target reference corrected from
  2.5.5 to 2.5.8 (Target Size (Minimum)).
- `docs/architecture.md`: formalized `web/components/ui/` boundary (flat
  directory, stateless, native HTML, token-driven, import guard).

### UI tranche

- Workspace action overflow menu: sidebar workspace actions (Rename, Repair
  for invalid workspaces, Delete) moved into the kit Menu primitive with
  icon trigger (`aria-haspopup`/`aria-expanded`), full keyboard contract
  (arrows, Home/End, Enter/Space, Escape with focus return), and accessible
  names per action.
- Settings panel (`settings-panel.svelte`) reachable from a new Settings
  entry at the bottom of the rail (4-tab rail: Workspaces, Project, Git,
  Settings). Sections: Appearance (theme switcher moved out of the panel
  header) and Editor (line wrapping default).
- `wrap-store.ts`: client-only line wrapping preference
  (`diffscribe-line-wrap`, default `false`) following the theme-store
  pattern, with unit tests.
- Line wrapping (tranche): diff lines stay no-wrap by default
  (`white-space: pre`), the diff viewer owns one horizontal scroll
  container per file, per-line/column scrollbars removed, a contextual Wrap
  toggle (aria-pressed) overrides the default per file, and the Settings
  Editor default applies to newly opened diffs. Wrap mode uses
  `white-space: pre-wrap` (no `overflow-wrap:anywhere`/`word-break:break-all`).
- Semantic status badges: file-list status badges migrated to the kit
  StatusBadge with a status→tone mapping (`file-status.ts`, unit-tested),
  adding a non-color status dot channel while keeping theme tokens.
- Viewport-bound scroll ownership: `html`/`body` `overflow: hidden`, fixed
  `height: 100dvh` shell grid, `min-height: 0` on every grid item
  (rail, contextual panel, center content, right panel), Project tree and
  diff viewer scroll inside their zones instead of being clipped.
- BDD features: `workspace-actions-overflow.feature`,
  `settings-panel.feature`, `line-wrapping.feature`, plus new scenarios in
  `rail-tabs.feature` (Settings entry, four tabs) and
  `ui-root-foundation.feature` (viewport-bound, zone scroll ownership) with
  matching step definitions.
- E2E specs: `workspace-actions-overflow.spec.ts`, `settings-panel.spec.ts`,
  `line-wrapping.spec.ts`, `viewport-scroll.spec.ts`, and the kit spec
  `base-ui-kit.spec.ts` (labels, focus ring, target sizes, theme tokens,
  reduced motion, Dialog focus return, Tabs roving tabindex).
- `tests/e2e/helpers/open-workspace-menu.ts`: shared helper for opening the
  workspace overflow menu.

### Git file list tree view and branches (tranche)

- File list list/tree views: the file list panel exposes List and Tree
  toggles (aria-pressed); the tree groups changed files by directory with
  expandable/collapsible directory nodes and per-node `data-testid`s. The
  chosen view persists in localStorage (`diffscribe-file-list-view`,
  default `list`) via the `file-list-view-store` following the
  theme-store pattern.
- `file-list-tree.ts`: pure `buildFileTree` helper (directories before
  files, alphabetical siblings, recursive nesting) with unit tests.
- `file-tree-branch.svelte`: recursive tree node component (product
  composite, outside `ui/`) with `role="tree"`/`treeitem`, `aria-expanded`,
  and selection wired to the diff viewer.
- Cached remote branches: `BranchDto` extended additively with
  `isRemote`/`remoteName`; `SimpleGitContextReader` reads
  `refs/remotes/*` via `git for-each-ref` (read-only, no fetch, no tags,
  remote HEAD pseudo-ref skipped); the Git panel lists local and cached
  remote branches with a "remote" marker and an accessible label.
- Base/Target inference: the panel no longer hardcodes
  branch-vs-branch/commit-vs-commit. `inferComparisonType` (client-side
  module with a parity test against the domain `ComparisonType` enum)
  derives the type from the real base/target pair, and selecting a target
  auto-activates the Base slot with the current branch when the draft
  default (HEAD) is untouched. The inferred type renders as a readable
  feedback label ("branch vs branch", "commit vs commit", ...).
- BDD feature `git-branches.feature` (cached remotes, Base auto-activation,
  inferred types, no-fetch guarantee) and `file-list-tree.feature`
  (toggles, grouping, persistence, selection), plus rail-fit and
  viewport-bound scenarios in `ui-root-foundation.feature`, with matching
  step definitions.
- E2E specs `file-list-tree.spec.ts` and `git-branches.spec.ts`, plus a
  rail-fit check in `viewport-scroll.spec.ts`.

### Multi-tab viewer and Quick Open (Tranche B)

- Multi-tab central viewer: the open-files tab strip now holds a session-only
  collection of open files. A normal click on a Project tree file or a
  Git/file-list row reuses the active tab; Ctrl-click (Windows/Linux) or
  Cmd-click (macOS) opens an additional tab or activates the existing tab when
  the path is already open. Tabs are unique by repo-relative path within the
  active workspace, are never persisted, and are cleared on workspace switch
  so stale paths cannot leak into the next workspace. Modifier clicks on diff
  lines keep line selection and never open tabs.
- Tab UI/ARIA: roving tabindex, ArrowLeft/ArrowRight/Home/End and
  focus-visible behavior, `role="tablist"`/`tab`/`tabpanel`, `aria-selected`
  and `aria-controls`, accessible close buttons; the active tab is
  highlighted and inactive tabs are dimmed but readable; closing the active
  tab selects next, else previous, else the empty viewer; closing an inactive
  tab preserves the active tab. File-list Enter/Space keeps acting as a
  normal click.
- `active-file-store.ts` extended in place with the tab collection API
  (`openFileTab`, `activateTab`, `closeTab`, `resetTabs`); existing exports
  (`activeFile`, `activeFilePath`, `activeFileLabel`, `setActiveFile`,
  `clearActiveFile`) remain compatible.
- Shared client tree loader (`src/lib/web/services/project-tree-loader.ts`):
  one fetch per workspace for `/api/workspaces/[id]/tree` with caching and a
  file flattening helper; the Project tree component now delegates to it.
- Quick Open (`Ctrl/Cmd+P`): product modal (`quick-open-dialog.svelte`) with
  autofocused combobox filter, listbox results with `aria-activedescendant`
  and active-result scroll, loading/empty/error states, ArrowUp/Down with
  wrap, Home/End, Enter (current tab), Ctrl/Cmd+Enter (new tab), mouse click
  (current tab), Escape (closes, preserves the active file, restores focus).
  Capture rules: plain Ctrl/Cmd+P only (no Alt/Shift), browser print
  prevented only when handled, Ctrl/Cmd+Shift+P unclaimed, repeated-key guard,
  composing IME events never commit/navigate/close. Every acceptance routes
  to the Project rail so the Source Viewer is shown.
- Pure fuzzy scorer (`src/lib/web/services/quick-open-scorer.ts`, unit-tested):
  exact path > basename prefix > basename subsequence > path fuzzy, boosts for
  consecutive/case/start-of-word/separator matches, compactness,
  deterministic lexical tie-break, all whitespace-separated terms required,
  highlight ranges, result cap 512, query normalization (case and path
  separators). Inspired by VS Code fuzzyScorer principles without
  transplanting its internals; no server-side search endpoint in this
  tranche (deferred).
- Quick Open setting: `diffscribe-quick-open-include-untracked` (localStorage,
  default `false`) exposed as "Include untracked files in Quick Open" in the
  Settings Editor section via `quick-open-store.ts`; it affects only Quick
  Open, never the Git/file list.
- Async safety: monotonic request-generation guard in Source Viewer and Diff
  Viewer so stale responses cannot overwrite newer tab/file content
  (`src/lib/web/utils/request-guard.ts`).
- BDD features `open-files-tabs.feature` and `quick-open.feature` (new) and a
  Quick Open scenario added to `settings-panel.feature`, with matching step
  definitions; E2E specs `open-files-tabs.spec.ts` and `quick-open.spec.ts`
  plus Settings coverage for the untracked switch.
- Docs: PRD Stage 1 (multi-tabs, Quick Open, setting), architecture (client
  tab state, shared tree loader, client Quick Open index, server-search
  deferral), design (tab active/inactive, close/focus, Quick Open layout,
  shortcut and combobox/listbox/IME contracts), changelog.

### Changed

- UI Polish Stage 1: global reset for `html`/`body` (zero margin, themed background, system-ui sans-serif font), explicit `background: var(--surface-primary)` on `.shell-layout`, `.center-content`, `.work-area`, `.diff-area` to prevent white rectangles during theme switching.
- Complete CSS token contract: `--font-family-sans`, `--font-sans`/`--font-mono` aliases, `--surface-hover`, `--text-md`, `--radius-xs`, `--text-error`/`--surface-error`/`--border-error`, `--text-warning`/`--surface-warning`/`--border-warning`, `--color-success`/`--color-warning`/`--color-error`/`--color-info`, `--selection-border`/`--selection-bg`, `--diff-added-fg`/`--diff-deleted-fg`, observation type/severity/status tokens (`--obs-type-*`, `--obs-sev-*`, `--obs-status-*`), source viewer marker tokens (`--source-marker-*`, `--source-line-*-bg`), and project tree status dot tokens (`--tree-status-*`). All tokens declared in `:root`, `[data-theme="dark"]`, and `[data-theme="synthwave-84"]`.
- Migration of hardcoded hex colors to CSS custom properties in `observation-card.svelte` (type badges, severity badges, status dots), `source-viewer.svelte` (change markers, line backgrounds, error color), `project-tree-node.svelte` (status dots), `project-tree.svelte`, `delete-confirm-dialog.svelte`, and removal of all fallback values from `var()` references in `git-context-panel.svelte`, `observation-panel.svelte`, `observation-form.svelte`, `diff-viewer.svelte`, `review-panel.svelte`, `file-list.svelte`.
- Provisional "DS" favicon (`static/favicon.svg`) linked in `app.html` to eliminate 404.
- BDD feature `ui-root-foundation.feature` (11 scenarios: root foundation, central area background, theme switching, favicon) and 18 additional token contract scenarios in `design-token-contract.feature` (error/warning, color semantic, diff foreground, surface-hover, auxiliary, observation type/severity/status, source viewer markers, project tree status dots, hardcoded hex prohibition).
- BDD step definitions in `tests/steps/ui-redesign.steps.ts`: batch token assertion helpers, component CSS hex-check parsers, root foundation checks, and favicon verification.

### Changed

- `docs/design.md`: updated typography section with `--font-family-sans`/`--font-family-mono` stacks, added Global Reset, Auxiliary/Semantic Tokens, Observation Component Tokens, Source Viewer Marker Tokens, Project Tree Status Dot Tokens, and Favicon sections.
- All Svelte components now reference CSS custom properties; most hardcoded hex fallbacks replaced with token declarations, though some components retain fallback values for graceful degradation.

- Inc‑6 (Review Foundation): Review aggregate with ReviewId UUID, ReviewStatus (draft/in_progress/completed/archived) and ComparisonSerialized capture.
- SQL migrations 001‑004 with `import.meta.glob` loader, per-migration transaction, and `PRAGMA foreign_keys = ON`.
- `reviews` table (FK CASCADE to workspaces, CHECK status/comparison_type, json_valid) and `review_files` table (composite PK, FK CASCADE to reviews).
- `SqliteReviewRepository` with Comparison↔JSON mapper, dynamic marks without total inventory.
- Use cases: CreateReviewUseCase, ListReviewsUseCase, GetReviewUseCase, SetActiveReviewUseCase, MarkFileUseCase, UnmarkFileUseCase, CompleteReviewUseCase.
- REST endpoints under `/api/workspaces/[id]/reviews/...`: GET list, POST create, GET detail, POST set-active, POST mark-file, POST unmark-file, POST complete.
- Active review in `app_state` with key `active_review:<workspaceId>`. Creating sets it active, completing clears it, deleting workspace cleans it up.

- Inc‑7 (Observations): Observation aggregate with full CRUD. Types issue/risk/suggestion/question/praise/note with severity critical/major/minor/nitpick. States open/resolved/dismissed/pending with transitions and reopen.
- Migration 005 `observations` with FK CASCADE to reviews, CHECKs type/status/origin/severity, json_valid() on comparison_snapshot_json, indexes review_id/type/status.
- Hybrid snapshot: `comparison_snapshot_json` (Comparison JSON, always present) + `diff_snapshot` and SHA-256 `content_hash` (file/range only, null together).
- Canonical SHA-256 hash via `node:crypto`: `filePath:side:startLine:LF-normalized-content`.
- StaleDeriver with 9 derived statuses on demand (no polling): current, stale-content-changed, stale-range-missing, stale-file-deleted, stale-file-renamed, stale-binary, stale-truncated, stale-comparison-changed, stale-unknown.
- REST: `GET/POST /api/workspaces/[id]/reviews/[reviewId]/observations`, `GET/PATCH/DELETE .../[observationId]`, `POST .../[observationId]/status`.
- Responsive ObservationPanel: right rail 320px (>=1100px) / bottom drawer 40vh (<1100px).
- ObservationForm with client-side validation, SHA-256 via Web Crypto API, scope info with rawSnapshot.
- ObservationCard with type/severity badges, colored status dot, hover/focus actions, stale badge, expandable snapshot with `<details>`.
- Line selection in diff-viewer: click, Shift+click, L-key, Escape, Shift+Arrow, keyboard-only. ARIA live region, data-line-num/data-side for E2E. Old-side selectable in side-by-side.
- Guards: completed/archived review → 409 on mutation, range over binary → 422, workspace→review→observation ownership, ordered cascade deletion observations→review_files→reviews→app_state→workspaces.
- DeleteWorkspaceUseCase extended with ObservationRepository for explicit cascade order.
- ReviewPanel UI with New/Complete/Mark/Unmark, reactive N/M progress, confirmation, listing/reopen, keyboard/ARIA/reduced-motion.
- Reviewed visual marker (✓/○) in file-list when active review exists.
- Unified Comparison propagation between GitContextPanel, DiffViewer, and Review.
- `DeleteWorkspaceUseCase` clears active_review key + deletes reviews via FK cascade.
- E2E reset includes `review_files` and `reviews` in atomic transaction.

- Inc‑5: Diff viewer with Shiki highlighting. Unified viewer by default with
  old/new line numbers, +/− indicators, and side‑by‑side toggle >=900 px.
- `GitFileDiffReader` port + `SimpleGitFileDiffReader` supporting the 8
  ComparisonTypes and untracked files.
- Custom unified‑diff parser (`unified-diff-parser.ts`) without third-party
  dependencies.
- `GetFileDiffUseCase` that resolves language, delegates to reader, and applies
  Shiki highlighting with `codeToTokens` per line.
- `GET /api/workspaces/[id]/file-diff` endpoint with path traversal validation.
- Shiki v4.3.1 as server‑only runtime dependency; lazy singleton, dual theme
  (min‑light/min‑dark), ~40-extension language map, token renderer with HTML
  escaping.
- Hard cap of 256 KB or 5 000 lines with truncation notice.
- `diff-viewer.svelte` component with 7 states (placeholder, loading, error
  with retry, binary, empty, truncated, rendered), hunk navigation via keyboard
  (j/k, ↑/↓), Ctrl+Shift+D shortcut, aria‑pressed, focus‑visible, and reduced
  motion.
- BDD step definitions for 34 scenarios (24 product + 10 application) in
  `tests/steps/file-diff.steps.ts`.
- 15 E2E Playwright tests for all file states, responsive, keyboard, XSS
  safety, and read‑only guarantee.

- Inc‑4: File list panel with filtering, sorting, pagination, and active
  selection.
- Inc‑3: Git context panel with repository state, branches, commits, and
  comparison.
- Inc‑2: Workspace registration and management (register, list, get, rename,
  delete, repair).
- Inc‑1: Initial workbench scaffold.
- BDD technical feature `pre-commit-quality-gate.feature` verifying the hook
  blocks commits on format or lint failure.
- Format failure protocol in `AGENTS.md` with mandatory autofix steps, `git
  diff` review, and re-stage.

- Inc-3 — Git context panel for the active workspace:
  - Value objects `GitRef` and `Comparison` with comparison types and
    serializable representation.
  - `GitContextReader` port in the application layer and
    `SimpleGitContextReader` adapter in infrastructure (read-only, no
    mutations).
  - `GetGitContextUseCase` use case with typed DTOs (`StatusDto`, `BranchDto`,
    `CommitDto`, `GitContextResult`).
  - `GitContextPanel.svelte` component with status bar (clean/dirty/
    detached/unborn/conflict), branch list, commit list, local filters,
    Base/Target slots for ephemeral Comparison draft, manual refresh, and
    keyboard navigation.
  - `GET /api/workspaces/[id]/git-context` endpoint for manual refresh.
  - Test coverage: 40 BDD scenarios (quickpickle), 15 E2E tests (Playwright
    with real repositories), 92 unit tests, 38 integration tests.
  - No polling, watcher, auto-reload, or Git mutations.

- Inc-4 — File list panel for the active Comparison:
  - `FileChangeStatus` value object with 9 values (added, modified, deleted,
    renamed, copied, type-changed, unmerged, untracked, unknown). Binary is a
    separate boolean, never a status.
  - `FileListEntry` and `FileListResult` DTOs with path, status, binary flag,
    additions/deletions (when applicable), oldPath for rename/copy, and
    optional error for unreadable files.
  - `GitFileListReader` port in the application layer and
    `SimpleGitFileListReader` adapter in infrastructure (read-only, no
    mutations).
  - NUL parsing of `git diff --name-status -z -C -C` and
    `git diff --numstat -z`, plus
    `git ls-files --others --exclude-standard -z` for untracked. The 8
    ComparisonTypes map to concrete Git commands.
  - Binary detection: tracked via `--numstat` (`-` for binaries); untracked
    via read-only byte inspection without `git add`.
  - `GetFileListUseCase` use case with adapter delegation.
  - `GET /api/workspaces/[id]/file-list?comparison=<encoded>` endpoint with
    workspace, JSON, enum, and ref type validation. Typed 400/404.
  - `file-list.svelte` component with path and status filtering, sorting by
    path/status/additions/deletions, pagination (50 per page), active row,
    keyboard navigation, status badges, binary indicator, and oldPath.
    Integrated in `git-context-panel.svelte`.
  - Untracked inclusion only when target is the working tree; exclusion in
    committed-target comparisons.
  - Test coverage: 37 BDD scenarios (quickpickle), 114 unit tests (+22), 65
    integration tests (+27), 12 E2E tests (Playwright, new file
    `file-list-panel.spec.ts`).
  - Design tokens for file states in `docs/design.md` (untracked, binary
    badge, status badges).
- No Git mutations, no `git add -N`, no polling, no Shiki, no virtualization,
  no `tooLarge`.

- Database isolation in E2E tests:
  - `global-setup.ts` creates a unique per-run directory under `os.tmpdir()`
    and assigns it to `DIFFSCRIBE_DB_DIR`.
  - `globalTeardown` guarantees cleanup of the temporary directory.
  - `DELETE /api/test/state` reset endpoint with fail-closed validation:
    secret via `DIFFSCRIBE_E2E_RESET_SECRET` + `x-reset-secret` header, path
    canonicalization, symlink guard, rejection of paths outside `os.tmpdir()`
    or inside `~/.diffscribe`, transactional delete of `app_state` and
    `workspaces` preserving migrations and schema.
  - `tests/e2e/helpers/reset-db.ts` helper invoked from `beforeEach` in the 5
    E2E specs.
  - Integration tests with guard matrix in
    `tests/integration/endpoints/test-reset-endpoint.test.ts`.
  - Isolation architecture documentation in `docs/architecture.md`.

### Fixed

- Rail hydration stability hardening: Svelte 5 `rail-tabs.svelte` icon pattern changed from destructuring (`{ key, label, icon: Icon }`) to explicit access (`tab.icon`) as defense-in-depth against cold-start hydration failures (`TypeError: undefined.call`, `Failed to hydrate`). Playwright `baseURL` aligned to port 56823 (Option A). Added readiness probe script (`scripts/wait-for-dev-server.sh`), stale process guard (`tests/e2e/helpers/stale-process-guard.ts`), and E2E hydration stability tests (`tests/e2e/rail-hydration.spec.ts`). Gherkin feature `rail-hydration-stability.feature` with 11 scenarios for readiness, guard, and hydration stability. New `rail-tabs.feature` hydration scenario. Documentation in `docs/e2e_performance_imorovements.md` with cold-start/readiness protocol, stale process cleanup, and browser hard reload guidance.
  - Limitations: root cause is likely a cold-start/process/chunk race, not the dynamic icon pattern alone. The icon change is defense-in-depth. Stale process guard is Linux/macOS only. Kill flag is opt-in (`DIFFSCRIBE_E2E_KILL_ZOMBIES=true`). Foreign processes (different cwd) are never killed.
  - No dependency or `package.json` changes. No changes to `vite.config.ts`, `optimizeDeps`, `allowedHosts`, wrappers, responsive breakpoints, `panel-layout-store`, or components outside `rail-tabs`. Stage 2+ features not implemented.

- Keyboard navigation in workspaces sidebar: Select buttons now respond to
  ArrowDown, ArrowUp, Home, and End to navigate between workspaces. Rename and
  Delete buttons maintain direct keyboard access as natural Tab stops. Added
  `data-workspace-select` attribute to Select buttons. The E2E test `keyboard
  navigation in sidebar` was refactored to use `locator.focus()` and explicit
  focus assertions, removing the hardcoded Tab count.

### Changed

- SvelteKit body wrapper hardening: `%sveltekit.body%` is now wrapped in
  `<div style="display: contents">…</div>` in `src/app.html` following the
  official SvelteKit recommendation. This eliminates the `%sveltekit.body%`
  console warning and protects against CSS selectors from browser extensions
  or user stylesheets that target `<body>` direct children. The wrapper uses
  `display: contents` so it has no visual or layout effect.
- Added BDD regression scenarios (`@delta-added`): no SvelteKit warning about
  `%sveltekit.body%` in body, shell layout post-hydration, both panels
  collapsed after hydration, mobile 375 px rail/center contract. Scenarios in
  `ui-root-foundation.feature`, `panel-resize.feature`, and
  `responsive-mobile.feature`.
- Added E2E regression tests: warning absence confirmation, shell
  post-hydration stability, dual-collapse rail+center visibility, mobile
  375 px contract, and localStorage NaN/Infinity corruption resilience.
- Added diagnostic guide for blank/white screen troubleshooting in
  `docs/design.md` (Visual Debugging section).

### Removed

- Observation `title` field removed entirely (destructive, approved
  2026-08-01):
  - Migration `006_drop_observation_title_require_body`: deletes rows with
    empty/whitespace-only bodies, drops the `observations.title` column,
    rebuilds the table so `body` is `NOT NULL` with
    `CHECK (length(trim(body)) > 0)`, and recreates the exact indexes and the
    review FK. Atomic per the migration runner; `reviews.title` untouched.
    **Backup `~/.diffscribe/diffscribe.db` before upgrading.**
  - `Observation` entity, command/result DTOs, use cases, mapper, repository,
    POST/PATCH endpoints, web store type, form, card, tests, and Gherkin
    features no longer reference a title. The body (1..5000, mandatory) is the
    single description field.

### Changed

- Observation creation flow (click-to-comment):
  - A normal click on a diff line selects it, switches to the Comments panel,
    opens the observation form in creation mode, and focuses the body field.
  - Ctrl/Cmd-click toggles individual lines on/off without moving the anchor;
    Shift-click still selects a contiguous range.
  - Cancelling the draft closes the form and clears the selection in the diff
    viewer.
  - The observation form now propagates the real active Comparison (from the
    Git context panel) into `comparisonSnapshotJson` instead of hardcoding
    `working-tree-vs-head`.
  - Observation card shows the type with a Lucide icon, text, and color;
    severity badges unchanged; the body is always displayed.
- Overflow menu (workspace actions) popup now uses fixed positioning clamped
  to the viewport, so it stays fully visible when the workspace sits near the
  bottom edge of the sidebar. ARIA, keyboard navigation, Escape, focus
  return, and light dismiss are preserved.
- Git file list tree view: all directories are expanded by default when the
  tree opens; directories can be collapsed manually; expansion is not
  persisted.
- Source viewer: honors the Settings wrapping default and exposes a contextual
  Wrap toggle; one horizontal scroll container per file, no per-line
  scrollbars.
- Annotation form fit: inputs use `box-sizing: border-box`, long paths and
  long body text no longer create horizontal overflow in the panel.
- Resize alignment measurement E2E (`PANELS-UI-01`): measures
  `gridTemplateColumns`, CSS vars, and bounding boxes of handle/panel/center
  after drags, sampling the layout mid-drag and after release. The right panel
  was confirmed not to follow its grid column (fixed `width: 320px` inside a
  resized column left a gap at the viewport edge and overflow when shrinking).
  Fixed `right-panel-tabs.svelte` so the desktop panel fills its grid column
  (`width: 100%`, `min-width: 240px`); the mobile bottom sheet keeps its own
  `width: 100%` fixed layout. Left panel untouched.

### Security

- D3 — Dependencies: updated `eslint` to `^10.8.0`, `@eslint/js` to
  `^10.0.1`, `typescript-eslint` to `^8.65.0`. Added `uuid >=11.1.1` and
  `cookie >=0.7.0` overrides. `npm audit` reports 0 vulnerabilities (0
  critical, 0 high, 0 moderate, 0 low).

---

<!-- Template for future versions:

## [0.1.0] — YYYY-MM-DD

### Added

- First functional release.

### Changed

### Deprecated

### Removed

### Fixed

### Security

-->

---

[Unreleased]: <REPO_URL>/compare/v0.1.0...HEAD
