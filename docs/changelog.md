# DiffScribe — Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added

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

- Keyboard navigation in workspaces sidebar: Select buttons now respond to
  ArrowDown, ArrowUp, Home, and End to navigate between workspaces. Rename and
  Delete buttons maintain direct keyboard access as natural Tab stops. Added
  `data-workspace-select` attribute to Select buttons. The E2E test `keyboard
  navigation in sidebar` was refactored to use `locator.focus()` and explicit
  focus assertions, removing the hardcoded Tab count.

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
