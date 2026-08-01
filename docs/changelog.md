# DiffScribe — Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added

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
