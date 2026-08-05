# Plan: 0001-workspace-git-review-ux

**Status**: PENDING APPROVAL (planning complete; not yet approved for implementation)
**Mode**: full planning
**Complexity**: complex (multi-file, cross-layer, new Git aggregate contract, Gherkin required)
**Magnitude**: high (5+ files, 100+ lines, new/changed modules and tests)
**Routing**: `nas_developer` FULL (rationale in §14)
**Gherkin persistence**: `when=on_done` — this pass does NOT write repository `.feature` files. Canonical merged Gherkin lives in §8 of this file for approval; it will be persisted to `specs/features/product/workspace-git-review-ux.feature` after approval, before developer execution.
**Playwright execution**: Every Playwright/E2E run must use exactly 8 workers (for example, `npm run test:e2e -- --workers=8` or the repository-equivalent command).

---

## 1. Feature summary and confirmed decisions

Improve the workspace lifecycle and Git review workbench UX in one approved change with internal phases. Confirmed user decisions:

1. One change with internal phases (single approved feature, sequential phases).
2. Opening/clicking a workspace lands in **Git/diff**; Project remains secondary.
3. Technical Git `untracked` is shown in the UI as **New** in green; the domain/API state `untracked` is NOT renamed. DiffScribe currently has English-only UI labels and no localization scope.
4. Git shows the **complete diff by default**; file click scrolls to that file; Ctrl/Cmd-click opens a new tab with full-file detail (as in Project view) and switches focus to Project.
5. Config controls Git diff file presentation (tree/list), default **tree**.
6. Markdown files get a top-right **Raw/Preview** toggle; default from config; settings grouped under a file/visualization display section.

Requested behaviors (all in scope):

- W1. Deleted workspace disappears immediately from the sidebar.
- W2. Open-workspace form keeps an editable path entry and adds a directory browser/selector.
- W3. Git/diff is the landing view for a workspace; Project stays reachable.
- W4. Config-driven Git diff file presentation (tree/list), default tree.
- W5. `untracked` presented as `New` in green (UI only).
- W6. Complete diff by default; click scrolls to file; Ctrl/Cmd-click opens full-file tab in Project mode.
- W7. Markdown Raw/Preview toggle (top-right), config default, grouped settings section.
- W8. Branch selector widened, title tooltips for long names, "working tree vs HEAD" text removed, working tree reselectable.
- W9. Collapsed right-panel menu options expand the panel; bottom expand button; consistent vertical icon rails; collapse controls at the bottom for both panels.
- W10. Middle-click closes any open tab.
- W11. Help for keyboard/mouse shortcuts.
- W12. Project directories show descendant-derived status dots with deterministic mixed-operation precedence.
- W13. New/untracked status dots are green.

---

## 2. Scope and Stage 1 boundaries

### In scope

- Workspace deletion UI refresh, open-workspace form directory browse, Git-first landing.
- Client-only visualization settings aggregate (tree/list default + Markdown default), read-through migration from the legacy key.
- UI label/tone changes for `untracked` (New, green) and status-dot token changes.
- New application/infrastructure aggregate contract for the complete diff (port, use case, DTO, adapter, route, viewer, navigation).
- Markdown Raw/Preview toggle with a dependency-free, strictly escaping client renderer.
- Branch selector ergonomics, panel collapse/expand controls, middle-click tab close, help surface.
- Project tree directory status dots with deterministic precedence.
- Tests (unit, integration, BDD, E2E) and source-of-truth docs updates.

### Out of scope (Stage 1 boundaries, per docs/PRD.md §18 and AGENTS.md)

- NO AI providers, assisted drafting, or model integration (Stage 2).
- NO search/grouping/similarity (Stage 3), NO operational refinement (Stage 4).
- NO collaboration, multi-user, or network capabilities.
- NO auto-fix, code modification, commit creation, or any Git mutation (tool stays read-only with respect to Git).
- NO git fetch / remote network operations; cached remotes only (existing behavior preserved).
- NO rename of the domain/API state `untracked`; the DB schema is untouched (no SQLite migration in this change). No localization is introduced; the visible label is English `New`.
- NO new runtime dependencies unless explicitly approved (§4.4). The Markdown renderer is dependency-free by default.
- NO change to comparison state propagation architecture (verified correct; only E2E assertions are strengthened).

### Scope creep protocol

Any discovery outside this scope must be logged, reported to the Orchestrator, and not implemented.

---

## 3. Confirmed root cause and bug contract (W1)

### Confirmed root cause

`src/lib/web/components/delete-confirm-dialog.svelte` closes the dialog on successful form submission but never invalidates or updates the page data consumed by the sidebar (`data.workspaces`).

**Causal chain**: Delete action succeeds server-side (`?/delete` → `DeleteWorkspaceUseCase` → repository delete) → `use:enhance` callback receives `result.type === 'success'` → dialog closes via `onClose()` → page data remains cached → sidebar renders the stale workspace list.

**Working pattern reference**: `src/lib/web/components/open-workspace-form.svelte` awaits `invalidateAll()` from `$app/navigation` on success before invoking `onRegistered`.

### Rejected alternatives

- Backend changes to the delete action/use case — rejected: backend deletion is correct and already covered by unit/BDD tests; the defect is purely the client refresh boundary.
- Optimistic local list mutation (removing the item from a local array) — rejected: it diverges from the SvelteKit server-data flow, risks drift with `+page.server.ts` (which also clears orphaned `active_workspace_id`), and duplicates the framework invalidation mechanism.

### Minimal fix boundary

- `src/lib/web/components/delete-confirm-dialog.svelte` — only: on success, `await invalidateAll()` then `onClose()` (and `projectTreeLoader.invalidate(id)` is NOT needed here; the tree loader is invalidated on next load and deletion targets the workspace list).
- New E2E regression: `tests/e2e/workspace-management.spec.ts` (or a dedicated `tests/e2e/workspace-delete-refresh.spec.ts`) asserts the deleted workspace is gone from the sidebar without reload.
- Out of scope: delete use case, actions, repositories, dialogs for other entities.

---

## 4. Critical assumptions requiring user approval

These are flagged for explicit approval before implementation. Each has a recommended default.

| #   | Assumption                                                                                                                                                                                                                                                                                                                                                                                                          | Recommended default                                                                    | Impact if rejected                                                                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| A1  | **Complete-diff strategy**: new aggregate query (application port + use case + adapter + DTO + route + viewer) with a single `git diff` invocation for snapshot consistency.                                                                                                                                                                                                                                        | Aggregate contract (§5.3).                                                             | Bounded lazy fan-out would need a re-plan: atomic snapshot, total budget, ordering, and partial-error policy all change.             |
| A2  | **Preference migration**: new versioned client aggregate `diffscribe-visual-settings` `{version:1, fileListView, markdownView}` with read-through from legacy `diffscribe-file-list-view`; explicit stored `list` preserved; absent → `tree`; legacy key removed on first write.                                                                                                                                    | Read-through migration (§5.2).                                                         | Keeping only the legacy key would still default new users to tree but cannot carry `markdownView`; a full schema would be lost.      |
| A3  | **Directory picker fallback**: browsers never expose the absolute path of a picked directory. The Browse button (native `<input type="file" webkitdirectory>`) pre-fills the path field with the directory _name_ plus an inline hint; manual path entry stays authoritative; button hidden when `webkitdirectory` is unsupported.                                                                                  | Pre-fill + hint + manual entry.                                                        | A picker that "resolves" absolute paths is impossible in browsers; no alternative exists.                                            |
| A4  | **Markdown renderer/security boundary**: dependency-free minimal client renderer (headings, paragraphs, bold/italic, inline code, fenced code, links, lists, blockquotes, thematic breaks). All input HTML-escaped before interpolation; raw HTML never emitted; link URLs allowlisted to `http:`, `https:`, `mailto:`; output rendered via `{@html}` only after escaping. Default view = `preview` (configurable). | Minimal renderer, default `preview`.                                                   | Full CommonMark would require adding `marked` + `dompurify` dependencies (needs separate approval) and expands the security surface. |
| A5  | **Binary/large-file/rename/partial-error behavior** in complete diff: binary files listed with a `B` marker and no hunks; per-file caps reused (256 KB / 5000 lines) plus aggregate caps (500 files / 4096 KB / 40 000 diff lines); per-file read errors do not fail the aggregate (listed with ⚠ marker + `partialErrors` array); renames/copies resolved via `--name-status -M -C -C` and shown with `oldPath`.   | Aggregate tolerates partial errors; truncation is explicit per file and per aggregate. | Stricter fail-fast would hide reviewable content; unbounded output would break performance limits.                                   |
| A6  | **Directory status precedence** (deterministic, highest wins): `unmerged` > `deleted` > `modified` > `type-changed` > `added` > `renamed` > `copied` > `untracked` > `unknown`. Both `added` and `untracked` render green ("new").                                                                                                                                                                                  | Precedence list above, single dot per directory.                                       | A different precedence changes only which color wins in mixed dirs; rule is unit-tested so it is easily adjusted.                    |
| A7  | **Per-tab vs global viewer mode**: viewer mode stays rail-global (existing model): Git rail → diff viewers, Project rail → Source viewer. Ctrl/Cmd-click from the Git list opens the tab AND switches the rail to Project (same behavior as Quick Open acceptance). Mode is not stored per tab.                                                                                                                     | Global rail mode + auto-switch on modifier click.                                      | Per-tab mode would require storing a viewer-mode flag per tab and a different tab store schema.                                      |
| A8  | **Branch/working-tree semantics**: "Working tree" becomes a fixed pseudo-option at the top of the Target popup. Selecting it with untouched base `HEAD` yields `working-tree-vs-head`; with a branch/commit base yields `branch-vs-working-tree` / `commit-vs-working-tree` (existing `inferComparisonType` already handles both). The redundant `comparison-type` caption is removed entirely.                     | Pseudo-option + caption removal.                                                       | Keeping the caption contradicts W8; a different placement needs approval.                                                            |
| A9  | **Help surface**: a Help button (icon) at the bottom of the left rail opens a dialog listing keyboard/mouse shortcuts; dialog is keyboard accessible (Escape closes, focus returns to trigger).                                                                                                                                                                                                                     | Rail-bottom button + dialog.                                                           | A Settings section would also work but is less discoverable; a separate rail tab changes navigation scope.                           |

---

## 5. Technical design and contracts

### 5.1 Layering rules (Clean Architecture, strict)

- `domain`: untouched in this change. `FileChangeStatus.UNTRACKED` and `Comparison` remain the canonical vocabulary.
- `application`: new `GitCompleteDiffReader` port (§5.3), `GetCompleteDiffUseCase`, new DTO module. No transport/persistence imports.
- `infrastructure`: new `SimpleGitCompleteDiffReader` adapter (simple-git), unified-diff splitter. No business rules; caps/limits are configuration constants owned by the adapter (mirroring `SimpleGitFileDiffReader`).
- `web`: viewers, stores, settings, labels, panel/tab/help components. The "New/Nuevo" label and green tone mapping live ONLY here (`file-status.ts` tone map, `file-list.svelte` label map, `project-tree-node.svelte` classes, tokens).
- `routes`: new `complete-diff/+server.ts` endpoint + `+page.svelte` shell wiring.

### 5.2 Visualization settings aggregate (W4, W7 — client-only)

New store `src/lib/web/stores/visual-settings-store.ts` (replaces `file-list-view-store.ts`; see §10 migration):

```ts
export interface VisualSettings {
  version: 1;
  fileListView: 'tree' | 'list'; // default 'tree'
  markdownView: 'raw' | 'preview'; // default 'preview'
}
export const VISUAL_SETTINGS_STORAGE_KEY = 'diffscribe-visual-settings';
export const LEGACY_FILE_LIST_VIEW_STORAGE_KEY = 'diffscribe-file-list-view';
```

- `readVisualSettings(storage)`: reads the new key; parses and validates `version === 1`; unknown/malformed values fall back to defaults per field. If the new key is absent, performs read-through: legacy key present and `'list'` → `fileListView: 'list'` (explicit prior choice preserved); anything else → default `'tree'`.
- `writeVisualSettings(settings, storage)`: writes the new key; if a legacy key exists, removes it (one-time cleanup after first write).
- Consumers: `file-list.svelte` (initial `view`), `source-viewer.svelte` (initial Markdown mode), `settings-panel.svelte` (controls).
- The in-component toggle still overrides per session (existing behavior); only the default-on-open comes from the aggregate.

### 5.3 Complete-diff aggregate contract (W6 — application/infrastructure)

**Why a new aggregate** (research H3 confirmed): the current code has separate manifest (`GitFileListReader`) and single-file (`GitFileDiffReader`) contracts; a viewer-only change cannot render one consistent review. A separate comparison DTO is preferred over embedding full highlighted content in the file manifest.

**Port** — `src/lib/server/application/git-complete-diff-reader.ts` (new):

```ts
export interface GitCompleteDiffReaderReadParams {
  repositoryPath: string;
  comparisonType: ComparisonType;
  baseRef: string;
  targetRef: string;
  /** Max files to include. Default 500, hard cap 1000. */
  fileLimit?: number;
}
export interface GitCompleteDiffReader {
  read(params: GitCompleteDiffReaderReadParams): Promise<CompleteDiffResult>;
}
```

**DTO** — `src/lib/server/application/dto/results/complete-diff-results.ts` (new):

```ts
export interface CompleteDiffFile {
  path: string; // new-path (rename target)
  oldPath?: string; // rename/copy source when known
  status: FileChangeStatus;
  binary: boolean;
  isTruncated: boolean;
  truncationReason?: string;
  error?: { message: string; errorCode: string }; // per-file failure
  hunks: DiffHunk[]; // reused from file-diff-results
}
export interface CompleteDiffResult {
  comparisonType: ComparisonType;
  files: CompleteDiffFile[]; // deterministic order (§5.4)
  isTruncated: boolean; // aggregate truncation (file limit / total budget)
  truncationReason?: string;
  partialErrors: Array<{ path: string; message: string; errorCode: string }>;
  readAt: string;
  error?: { message: string; errorCode: string }; // fatal (not a repo, path missing)
}
```

**Adapter** — `src/lib/server/infrastructure/git/simple-git-complete-diff-reader.ts` (new):

1. Validate repository path/`checkIsRepo` (mirror `SimpleGitFileDiffReader`).
2. Run ONE `git diff --unified=3 -M -C -C <args> --` (single invocation → snapshot consistency for the requested comparison) plus `--name-status -z -C -C` for status/rename metadata (same comparison args), plus untracked via `git ls-files --others --exclude-standard -z` ONLY when the comparison includes the working tree (same `WORKING_TREE_TARGETS` set as the file-list reader).
3. Split the combined unified diff into per-file sections by `diff --git ` block boundaries — new helper `splitUnifiedDiffByFile(raw)` added to `src/lib/server/infrastructure/git/unified-diff-parser.ts` (exported; pure; unit-tested). Reuse `parseUnifiedDiff` per section (keeps rename/binary parsing identical to the single-file path).
4. Merge with name-status metadata (rename/copy oldPath; binary flag; untracked status). For untracked files reuse the existing synthesize/`isBinaryContent` approach from `SimpleGitFileDiffReader` (extract into shared helpers if needed — allowed, same module family).
5. Apply per-file caps (reuse `applySizeCap` logic, 256 KB / 5000 lines) and aggregate caps: `fileLimit` (default 500, cap 1000), total 4096 KB, total 40 000 diff lines → `isTruncated` + `truncationReason` at the aggregate level; per-file failures collected into `partialErrors` and the file listed with `error` (⚠ in UI) — do not fail the whole response.
6. Deterministic ordering (§5.4).

**Use case** — `src/lib/server/application/services/get-complete-diff-use-case.ts` (new): constructor takes `GitCompleteDiffReader`; `execute(repositoryPath, comparison, fileLimit?)` resolves refs (mirror `GetFileListUseCase`) and calls the reader. No highlighting at aggregate level (full-file detail keeps existing per-file highlighting via `file-diff`/`source` routes).

**Route** — `src/routes/api/workspaces/[id]/complete-diff/+server.ts` (new): GET with `comparison` (same `parseComparison` guard as file-diff/source) and optional `limit` (int 1..1000). 404 unknown workspace; 400 invalid comparison/limit. Returns `CompleteDiffResult`.

**Composition** — `src/lib/server/composition/workspace-services.ts`: add `getCompleteDiffUseCase` to the `WorkspaceServices` interface and wire `SimpleGitCompleteDiffReader`.

**Web** — `src/lib/web/components/complete-diff-viewer.svelte` (new):

- Props: `activeWorkspaceId`, `comparisonDraft`, `scrollTarget` (path), `onScrollHandled`, `onFileClick(path, newTab)`.
- Fetches `/api/workspaces/[id]/complete-diff?comparison=...` with a request guard (comparison changes race → stale responses dropped, same pattern as `diff-viewer.svelte`).
- Renders a file index (list of paths with status badge + stats) and file sections, each with `id="file-diff-<encodeURIComponent(path)>"`, path header, rename/binary/truncation markers, and hunks reusing the unified diff line markup (no selection behavior in the aggregate view — selection stays a per-file DiffViewer feature; the per-file view is reached via Ctrl/Cmd-click).
- Anchor navigation: when `scrollTarget` changes to a known path, `scrollIntoView({ block: 'start' })` the section (with sticky file header offset) and call `onScrollHandled`.
- Empty state: "No changes in this comparison" when `files.length === 0`.
- Error state with Retry; loading state; aggregate truncation notice (role=alert).
- A11y: sections are `role="region"` with `aria-label` = path; file index is a `role="list"` with buttons; keyboard focusability follows existing viewer patterns; `prefers-reduced-motion` respected.

**Shell wiring** — `src/routes/+page.svelte`:

- Git rail active + no open tab → render `CompleteDiffViewer` in the work area.
- Git rail active + open tab → existing `DiffViewer` (per-file, selection enabled) — unchanged behavior.
- Project rail active → existing `SourceViewer`.
- New `handleGitFileSelect(path, newTab)`: `newTab` → `openFileTab(path, undefined, true)` + `activeRailTab = 'project'` (matches Quick Open acceptance semantics); plain click → `completeDiffScrollTarget = path` (scrolls the complete diff; no tab).
- `git-context-panel.svelte`: `onFileSelect` now receives a `'scroll' | 'tab'` semantic — implemented by passing `newTab` from the existing `FileList.onSelect(path, newTab)` signature; the panel forwards as-is to the shell (no panel-side change beyond documentation; the shell decides). The complete-diff viewer's internal file index uses the same `onFileClick`.

### 5.4 Deterministic ordering and limits (A5)

- Files ordered ascending by path (`localeCompare`, byte-order semantics); directories not involved (flat list).
- Untracked included only for comparisons whose target is the working tree (same set as file-list reader).
- Aggregate file cap default 500 / max 1000 (`limit` query param); total 4096 KB and 40 000 diff lines; per-file 256 KB / 5000 lines (existing constants reused).
- Snapshot consistency: one `git diff` invocation per request; `readAt` single timestamp.

### 5.5 Project tree directory status dots (W12, W13)

- New pure helper `src/lib/web/utils/status-aggregation.ts`:
  - `aggregateStatus(statuses: Iterable<string>): string | null` — applies precedence from §4 A6; returns `null` for empty input.
  - `descendantStatuses(nodePath: string, statusMap: Map<string,string>): string[]` — all map entries whose path starts with `nodePath + '/'`.
- `project-tree-node.svelte`: for directories, derive the aggregate dot from `descendantStatuses(node.path, statusMap)`; render the existing `.change-indicator` with the aggregated class; `title`/`aria-label` = aggregated status (e.g. "modified" when mixed). Files keep their direct status dot.
- `project-tree.svelte`: no change beyond passing `statusMap` down (already done).
- Tokens: `--tree-status-untracked` must become green in all three theme blocks of `src/lib/web/styles/tokens.css` (currently purple #8b5cf6/#a78bfa; use the same green as `--tree-status-added`, e.g. #22c55e, so "new" reads green; distinct hue not required).
- W5 label map: `file-list.svelte` `statusLabel('untracked')` → `'New'`; `file-tree-branch.svelte` and other visible status maps stay consistent; `file-status.ts` `untracked` tone → `'success'` (green). Domain/API value stays `untracked`.

### 5.6 Markdown Raw/Preview (W7)

- New `src/lib/web/utils/markdown-renderer.ts` (pure, dependency-free): `renderMarkdown(source: string): string` returns escaped HTML for the supported subset; `sanitizeLink(url: string): string | null` allowlists `http:`, `https:`, `mailto:`; fenced/inline code escaped; raw HTML in source is escaped and shown as text; no external resource loading.
- `source-viewer.svelte`: when `resolveLanguage(filePath) === 'markdown'` (reuse `src/lib/server/infrastructure/shiki/language-map.ts` `resolveLanguage` via its existing client-safe usage — if importing from `$lib/server` is not allowed in the component, add a tiny client mirror `src/lib/web/utils/language-map.ts` with the same mapping, unit-tested against the server map), show a top-right segmented control Raw | Preview in the header; initial mode from `visual-settings-store.markdownView`; Preview renders `{@html renderMarkdown(sourceResult.lines.map(l => l.text ?? l.content).join('\n'))}`; Raw keeps the current highlighted line view. Toggle is per-file-session (not persisted) — only the default is config.
- `settings-panel.svelte`: new section "Files" (data-testid `settings-section-files`) with: "File list view" (Tree/List segmented control) and "Markdown default view" (Raw/Preview). Existing "Appearance" and "Editor" sections remain.
- Security boundary: unit tests cover escaping (script tags, event handlers, `javascript:` links, raw HTML passthrough, nested fences).

### 5.7 Workspace open path + directory browser (W2)

- `open-workspace-form.svelte`: keep `TextInput` (editable, `bind:value=path`); add "Browse…" button (`data-testid="ws-path-browse"`) next to the input; hidden when `!('webkitdirectory' in HTMLInputElement.prototype)` (feature detection, `$app/environment` browser guard).
- Behavior: clicking opens `<input type="file" webkitdirectory hidden>`; on `change`, read `file.webkitRelativePath` first segment (directory name) → set `path` to that name and focus the path input; inline hint "Browsers cannot return the absolute path — complete it after browsing." (per A3). Existing server-side validation remains authoritative.

### 5.8 Git/diff landing view (W3)

- `src/routes/+page.svelte`: `activeRailTab` initial state `$state<RailTabKey>(data.activeWorkspaceId ? 'git' : 'workspaces')`.
- In the workspace-switch effect (where tabs reset on `activeWorkspaceId` change): also set `activeRailTab = 'git'` when a workspace becomes active (covers sidebar selection). Rail order unchanged (Workspaces, Project, Git, Settings); only the landing tab changes.

### 5.9 Branch selector (W8)

- `git-context-panel.svelte`:
  - `.slot-btn` min-width 100px → 160px; `.slot-value` max-width 120px → 200px; add `title={internalDraft?.base.label ?? ''}` / target equivalent (tooltip for long names).
  - Remove the `.comparison-type` caption element (and `comparisonLabel` usage) — "working tree vs HEAD" text disappears with it (A8).
- `branch-select-popup.svelte`:
  - Add fixed "Working tree" pseudo-option at the top of the listbox (`data-branch-option="working-tree"`, icon ●/○ consistent), selected state when `selectedCanonicalRef`/slot value is a working-tree ref; `title` attribute on each option label (long names).
  - New prop/behavior: `onSelectWorkingTree` (or extend `onSelect` with a sentinel) → `git-context-panel` sets `target = { type: 'working-tree', value: 'WORKING_TREE', label: 'Working tree' }` (GitRef accepts any non-empty value; label serialization is `'working tree'`), then `inferComparisonType(base, target)`; base auto-fill logic unchanged (`isDefaultBase` → current branch).
- `branch-options.ts`: unchanged (grouping/fuzzy stay); the pseudo-option is a popup-level concern. `comparison-inference.ts`: unchanged (already supports working-tree target; its parity test stays).

### 5.10 Panels, tabs, help (W9–W11)

- `right-panel-tabs.svelte`:
  - Move the collapse button from the header row to a new bottom footer bar (`.right-panel-footer`), keep `data-testid="right-panel-collapse-btn"` and `aria-label` "Collapse right panel".
  - Collapsed strip: keep vertical icon tabs (click expands + selects — existing `handleStripTabChange`) and add a bottom expand button (`data-testid="right-panel-reopen-btn"`, `PanelRightOpen` icon, "Open right panel") below the tabs, mirroring the left rail's reopen button.
- `+page.svelte` (left panel): move `left-panel-collapse-btn` from the header into a bottom footer bar of the left contextual panel (`data-testid` and aria-label preserved). Mobile drawer keeps its header close button (mobile sheet pattern) — desktop-only move.
- `rail-tabs.svelte`: add a Help button at the bottom (below the reopen button; `data-testid="help-btn"`, `HelpCircle` icon, aria-label "Help"); add `onHelp` prop. Also ensure vertical icon rails are consistent (left rail already vertical icons; right strip already vertical icons; no label-only tabs remain).
- New `src/lib/web/components/help-dialog.svelte`: `Dialog` listing keyboard/mouse shortcuts (Quick Open Ctrl/Cmd+P; Refresh diff Ctrl+Shift+D; open in new tab Ctrl/Cmd+click; close tab middle-click; diff line selection Shift+Arrow; hunk navigation j/k; arrow keys in lists; Escape closes dialogs/drawers; `?` opens help when not composing). Keyboard accessible: Escape closes, focus returns to the trigger (existing Dialog patterns).
- `open-files-tabs.svelte`: add `onauxclick` on each tab — `e.button === 1` → `e.preventDefault(); closeTab(tab.path)` (middle-click close for any tab, active or not; close semantics from `closeTab`). Keyboard path unchanged.

### 5.11 State transitions

- **Workspace select**: idle → (server action `?/select`) → page data refresh → Git rail + complete diff loading → loaded. Deletion of active workspace: page data refresh clears `active_workspace_id` (existing `+page.server.ts` orphan cleanup) → shell returns to workspaces rail with empty viewer.
- **Tab lifecycle**: plain Git-list click (no tab change, scroll only); modifier click → new tab + Project rail (Source viewer). Tab close via X or middle-click → `closeTab` selection rule (existing). Last tab closed in Git rail → complete diff returns.
- **Comparison change**: any draft change refetches file list, complete diff, project statuses; request guards prevent stale overwrites.
- **Markdown mode**: per-file session state; defaults reset from settings on file change (existing wrap pattern).
- **Panel collapse/expand**: bottom controls toggle `panelLayout.leftCollapsed/rightCollapsed` (persisted, existing store).

### 5.12 Accessibility and responsive behavior

- All new controls are real buttons with `aria-label`/`aria-pressed`/`aria-expanded` as applicable; focus-visible rings per design tokens; keyboard paths for every mouse behavior (tab close via X button exists; middle-click is an addition, X remains).
- Complete diff sections: `role="region"` + `aria-label`; truncation notices `role="alert"`; loading `role="status"`.
- Help dialog: `role="dialog"`, labelled, Escape/backdrop close, focus return.
- Mobile (≤768px): complete diff renders in the center work area (scroll owner = viewer); the left rail Help button still opens the dialog; right panel bottom sheet keeps its header close (unchanged); the new bottom expand/collapse bars apply to desktop panels; mobile drawers unchanged.
- `prefers-reduced-motion`: no new animations beyond existing patterns; any added transitions gated.
- Status dots are decorative (`aria-hidden`) with `title` + `aria-label` on the node providing the state (existing pattern).

### 5.13 Performance limits

- Complete diff: default 500 files / max 1000 (`limit` param); aggregate 4096 KB / 40 000 lines; per-file 256 KB / 5000 lines (reused constants). All limits documented on the route.
- Request guards on every fetch (complete diff, file list, source, tree) — stale response rejection.
- No unbounded rendering: file sections render only the capped hunks; the file index is capped by `fileLimit`.
- Client renderer: `renderMarkdown` is pure and linear; no regex backtracking bombs (simple line-based parser); unit tests include adversarial input.

---

## 6. Phased implementation (Red → Green → Refactor), single developer contract

Phases execute sequentially within ONE `nas_developer` full delegation (independent non-overlapping tasks are NOT separable safely — Phase 3 cross-layer contract and Phase 4 security work preclude parallel sub-delegation).

**Phase 1 — Workspace lifecycle (W1, W2, W3)**
Objective: deletion refresh, editable path + browse, Git-first landing.
Tasks:
1.1 RED — E2E `tests/e2e/workspace-delete-refresh.spec.ts`: delete an open workspace; assert the sidebar loses the item immediately (no reload) and the shell falls back cleanly. Files: new spec. Criterion: fails on current code (stale list).
1.2 GREEN — `src/lib/web/components/delete-confirm-dialog.svelte`: on success `await invalidateAll()` then `onClose()` (pattern of `open-workspace-form.svelte`). Criterion: 1.1 passes.
1.3 RED — E2E (extend `tests/e2e/workspace-registration.spec.ts` or new `tests/e2e/workspace-open-flow.spec.ts`): path input remains editable; Browse button visible when supported and pre-fills path with directory name + hint; manual entry still registers. Criterion: fails today (no browse).
1.4 GREEN — `src/lib/web/components/open-workspace-form.svelte`: Browse button + hidden `input[type=file][webkitdirectory]` + feature detection + pre-fill + hint. Criterion: 1.3 passes.
1.5 RED — E2E (extend `tests/e2e/ui-shell.spec.ts` or new): selecting a workspace lands on the Git rail (rail-tab-git active) with a workspace active; Project still reachable. Criterion: fails (default is workspaces).
1.6 GREEN — `src/routes/+page.svelte`: initial rail state + workspace-switch effect set `'git'`. Criterion: 1.5 passes.
1.7 REFACTOR — `npm run format:fix` (review diff), `npm run lint`, `npm run check`; verify existing workspace E2E/BDD suites still pass.
Exit criteria: 1.1/1.3/1.5 green; unit+BDD+E2E for workspaces green. Scenarios: S1–S4.

**Phase 2 — Visualization settings, New/Nuevo, status dots (W4, W5, W12, W13)**
Objective: settings aggregate + migration, tree default, green New dots, directory aggregation.
Tasks:
2.1 RED — unit `tests/unit/web/visual-settings-store.test.ts`: fresh context → `tree`; explicit legacy `'list'` preserved; new key wins over legacy; malformed new key falls back; first write removes legacy key. Criterion: fails (no store).
2.2 GREEN — `src/lib/web/stores/visual-settings-store.ts` (new; delete `file-list-view-store.ts` and update importers — grep `file-list-view-store` across `src/` and `tests/`). Criterion: 2.1 passes.
2.3 RED — BDD + E2E (update `specs/features/product/file-list-tree.feature` default scenarios + `tests/steps/file-list-tree.steps.ts` + `tests/e2e/file-list-tree.spec.ts`): fresh context shows tree by default; explicit list choice persists across reload; settings control changes default. Criterion: fails (default list).
2.4 GREEN — `src/lib/web/components/file-list.svelte` (read initial view from the aggregate; keep in-session toggle) + `src/lib/web/components/settings-panel.svelte` ("Files" section: file list view + Markdown default view controls). Criterion: 2.3 passes.
2.5 RED — unit `tests/unit/web/status-aggregation.test.ts` (precedence A6, descendant collection, empty/null) + BDD/E2E directory dots (project-tree feature): mixed dir shows the highest-precedence dot; untracked-only dir green; `untracked` label shows New/Nuevo in Git file list. Criterion: fails (no aggregation; untracked purple; label "untracked").
2.6 GREEN — `src/lib/web/utils/status-aggregation.ts` (new), `project-tree-node.svelte` (aggregate dot), `file-list.svelte` label map (`New/Nuevo`), `file-status.ts` tone (`success`), `src/lib/web/styles/tokens.css` (3 theme blocks: `--tree-status-untracked` green). Criterion: 2.5 passes.
2.7 RED — application/BDD: `@application` scenario asserting the API still returns `untracked` (no rename) — extend `file-list-adapter.feature`/steps or add to the feature file §8. Criterion: trivial but contract-locking.
2.8 REFACTOR — format/lint/check; remove dead legacy-key exports; ensure `check:bdd-language` passes (English only).
Exit criteria: 2.1–2.7 green; no Spanish in BDD. Scenarios: S5–S9, S10–S13.

**Phase 3 — Complete-diff aggregate (W6)**
Objective: aggregate contract, viewer, navigation.
Tasks:
3.1 RED — unit `tests/unit/infrastructure/unified-diff-parser.test.ts` (extend): `splitUnifiedDiffByFile` splits multi-file raw output on `diff --git` boundaries; empty input → []. Criterion: fails (no splitter).
3.2 GREEN — `src/lib/server/infrastructure/git/unified-diff-parser.ts`: export `splitUnifiedDiffByFile`. Criterion: 3.1 passes.
3.3 RED — integration/unit `tests/unit/infrastructure/complete-diff-reader.test.ts` (fixture repos, `tests/e2e/helpers/git-fixture.ts` patterns): deterministic ordering; binary marker; rename oldPath; untracked only for working-tree comparisons; per-file caps; aggregate caps + `isTruncated`; partial-error collection; snapshot `readAt`. Criterion: fails (no adapter).
3.4 GREEN — `git-complete-diff-reader.ts` (port), `complete-diff-results.ts` (DTO), `simple-git-complete-diff-reader.ts` (adapter). Criterion: 3.3 passes.
3.5 RED — unit `get-complete-diff-use-case` (fake reader): ref resolution + passthrough. Criterion: fails.
3.6 GREEN — `get-complete-diff-use-case.ts`; wire `workspace-services.ts`; route `src/routes/api/workspaces/[id]/complete-diff/+server.ts` (validation: comparison parse, limit 1..1000, 404/400). Criterion: 3.5 + route smoke passes.
3.7 RED — BDD + E2E `tests/e2e/complete-diff.spec.ts` (+ `tests/steps/complete-diff.steps.ts`): Git rail shows complete diff by default (no tab open); deterministic file order; plain click scrolls to the file section (assert scroll position/anchor); Ctrl/Cmd-click opens a new tab and switches to Project rail showing full-file source; binary/truncated markers render; empty state; aggregate notice. Criterion: fails (no viewer).
3.8 GREEN — `src/lib/web/components/complete-diff-viewer.svelte` (new) + `src/routes/+page.svelte` (mode selection, `handleGitFileSelect`, scroll target state) + `git-context-panel.svelte` (forward semantics unchanged; shell decides). Criterion: 3.7 passes.
3.9 RED — E2E `tests/e2e/comparison-propagation.spec.ts` (strengthen): after changing comparison, the complete diff and per-file diff show actual changed content (assert diff text, not selector labels). Criterion: current assertions too weak (per research: propagation code is correct; assertions must verify content).
3.10 REFACTOR — format/lint/check; confirm no changes to `diff-viewer.svelte` selection behavior; performance smoke on a large fixture (≤500 files default).
Exit criteria: 3.1–3.9 green. Scenarios: S14–S20.

**Phase 4 — Markdown Raw/Preview (W7)**
Objective: renderer, toggle, settings section completion, security.
Tasks:
4.1 RED — unit `tests/unit/web/markdown-renderer.test.ts`: supported subset renders; raw HTML escaped (script/onerror/style); `javascript:`/`vbscript:`/`data:` links rejected (`sanitizeLink` null); `http/https/mailto` allowed; adversarial input (deep nesting, long fences) bounded. Criterion: fails (no renderer).
4.2 GREEN — `src/lib/web/utils/markdown-renderer.ts`. Criterion: 4.1 passes.
4.3 RED — BDD + E2E `tests/e2e/markdown-preview.spec.ts` (+ steps): `.md` file shows Raw/Preview toggle top-right; default from settings (preview default; raw when configured); toggle switches views per file; non-Markdown files show no toggle. Criterion: fails.
4.4 GREEN — `source-viewer.svelte` (toggle, mode state, preview rendering; initial mode from `visual-settings-store`), client language mirror if needed (`src/lib/web/utils/language-map.ts`, unit-tested in parity with server map). Criterion: 4.3 passes.
4.5 RED — BDD/E2E: settings "Files" section controls both file-list view and Markdown default; persisted across reload. Criterion: fails (no Markdown control).
4.6 GREEN — `settings-panel.svelte` (complete "Files" section). Criterion: 4.5 passes.
4.7 REFACTOR — format/lint/check; security review of `{@html}` usage (only post-escape output).
Exit criteria: 4.1–4.6 green. Scenarios: S21–S24.

**Phase 5 — Branch selector, panels, tabs, help (W8–W11)**
Objective: selector ergonomics, bottom collapse/expand, middle-click close, help.
Tasks:
5.1 RED — BDD/E2E `git-branches`/`git-ref-popup` + new `tests/e2e/git-context-panel.spec.ts` additions: slot wider + `title` tooltip on long names; "working tree vs HEAD" caption absent; selecting "Working tree" with HEAD base → comparison `working-tree-vs-head` and file list refetches; with branch base → `branch-vs-working-tree`. Criterion: fails (caption present; no working-tree option).
5.2 GREEN — `git-context-panel.svelte` + `branch-select-popup.svelte` (+ `branch-options.ts` untouched; working-tree sentinel handled in popup). Criterion: 5.1 passes.
5.3 RED — E2E `tests/e2e/panel-resize.spec.ts` + `rail-tabs.spec.ts` extensions: collapse controls at the BOTTOM of both desktop panels; collapsed right strip has a bottom expand button; clicking a collapsed strip tab expands + selects; left rail keeps bottom reopen button + new help button. Criterion: fails (top controls; no right expand button).
5.4 GREEN — `right-panel-tabs.svelte`, `+page.svelte` (left panel footer), `rail-tabs.svelte` (help button + prop). Criterion: 5.3 passes.
5.5 RED — E2E `tests/e2e/open-files-tabs.spec.ts` extension: middle-click (auxclick button 1) closes active and inactive tabs; no autoscroll side effect. Criterion: fails (no auxclick handler).
5.6 GREEN — `open-files-tabs.svelte`. Criterion: 5.5 passes.
5.7 RED — E2E `tests/e2e/help-dialog.spec.ts` (+ steps): Help button opens dialog listing keyboard/mouse shortcuts; Escape closes; focus returns; content mentions Ctrl/Cmd+click, middle-click, Quick Open, refresh diff. Criterion: fails (no help surface).
5.8 GREEN — `src/lib/web/components/help-dialog.svelte` (new) + `rail-tabs.svelte`/`+page.svelte` wiring. Criterion: 5.7 passes.
5.9 REFACTOR — format/lint/check; responsive pass (mobile drawers unchanged; bottom controls desktop-only).
Exit criteria: 5.1–5.8 green. Scenarios: S25–S31.

**Phase 6 — Docs, Gherkin persistence, full QA**
Objective: source-of-truth updates, feature file persistence (on_done), regression hardening.
Tasks:
6.1 Persist canonical Gherkin to `specs/features/product/workspace-git-review-ux.feature` (approved text from §8) + update `specs/features/product/file-list-tree.feature` where it asserts the old default; keep `check:bdd-language` green (English only).
6.2 Docs source-of-truth (§11): `docs/PRD.md` §18 (preserve its Spanish), `docs/architecture.md`, `docs/design.md`, `docs/domain.md`, `docs/changelog.md` (Unreleased: Added/Fixed), `docs/versioning.md` (0.x MINOR note for the new API route; no SQLite migration).
6.3 REFACTOR + full gate: `npm run qa` (format, lint, check, unit, integration, check:bdd-language, bdd, e2e, build) — all green.
Exit criteria: 6.1–6.3 green; plan approval artifacts complete.

---

## 7. Test plan by layer (commands from repository conventions)

| Layer        | Command                      | New/changed tests                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------ | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit         | `npm run test:unit`          | `tests/unit/web/visual-settings-store.test.ts` (C), `tests/unit/web/status-aggregation.test.ts` (C), `tests/unit/web/markdown-renderer.test.ts` (C), `tests/unit/web/language-map.test.ts` (C, if mirror added), `tests/unit/infrastructure/unified-diff-parser.test.ts` (M — splitter), `tests/unit/infrastructure/complete-diff-reader.test.ts` (C), `tests/unit/application/get-complete-diff-use-case.test.ts` (C), `tests/unit/web/comparison-inference.test.ts` (M — working-tree target parity), existing affected suites (file-list-tree, branch-options, panel-layout) |
| Integration  | `npm run test:integration`   | complete-diff adapter against fixture repos (or unit with simple-git fixtures if the project convention places git adapters there — follow the file-list/diff adapter placement; `tests/unit/infrastructure/` already hosts git adapter tests)                                                                                                                                                                                                                                                                                                                                  |
| BDD language | `npm run check:bdd-language` | no Spanish in feature/steps (gate on new files)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| BDD          | `npm run test:bdd`           | steps: `tests/steps/workspace-git-review-ux.steps.ts` (C), `tests/steps/complete-diff.steps.ts` (C), `tests/steps/markdown-preview.steps.ts` (C), updates to `file-list-tree.steps.ts`, `git-branches.steps.ts`, `git-ref-popup.steps.ts`, `open-files-tabs.steps.ts`, `panel-resize.steps.ts`, `rail-tabs.steps.ts`, `project-tree.steps.ts`, `settings-panel.steps.ts`, `workspace-management.steps.ts`, `file-list-adapter.steps.ts` (untracked contract)                                                                                                                    |
| E2E          | `npm run test:e2e`           | new: `workspace-delete-refresh.spec.ts`, `complete-diff.spec.ts`, `markdown-preview.spec.ts`, `help-dialog.spec.ts`, `workspace-open-flow.spec.ts`; updated: `workspace-management.spec.ts`, `file-list-tree.spec.ts`, `git-context-panel.spec.ts`, `git-branches.spec.ts`, `git-ref-popup.spec.ts`, `panel-resize.spec.ts`, `rail-tabs.spec.ts`, `open-files-tabs.spec.ts`, `project-tree`/`project-view.spec.ts` (status dots), `settings-panel.spec.ts`, `comparison-propagation.spec.ts` (strengthened content assertions), `ui-shell.spec.ts` (Git landing)                |
| Build        | `npm run build`              | full gate                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

Red/Green/Refactor discipline per IADEV-test-driven-development: every production change is preceded by a failing test (see phase tasks). Every phase ends with `npm run format:fix` (diff review), `npm run lint`, `npm run check`; final `npm run qa`.

---

## 8. Canonical merged Gherkin (for approval; persisted at `on_done`)

Target path after approval: `specs/features/product/workspace-git-review-ux.feature` (matches include `product/*`). Scenarios use repo-convention tags plus feature-level `@product/workspace-git-review-ux`; contract scenarios also carry `@application`.

```gherkin
@product/workspace-git-review-ux @product @ui @etapa-1
Feature: Workspace and Git review UX

  Workspace lifecycle, Git-first navigation, configurable file presentation,
  complete-diff review, Markdown preview, branch selector ergonomics, panel
  controls, tab behavior, interaction help, and directory status aggregation
  for the Stage 1 review workbench.

  Background:
    Given the workbench shell is loaded

  # ── Phase 1: workspace lifecycle ──

  @product @workspace @p1 @e2e @delta-added
  Scenario: Deleted workspace disappears immediately from the sidebar
    Given a workspace is registered and selected
    When the user deletes the workspace and confirms
    Then the workspace disappears from the sidebar without a reload

  @product @workspace @p1 @e2e @delta-added
  Scenario: Open workspace form keeps an editable repository path
    Given the user opens the Open Workspace form
    Then the repository path field remains editable
    When the user types a repository path and opens it
    Then the workspace is registered

  @product @workspace @p2 @e2e @delta-added
  Scenario: Directory browser pre-fills the repository path
    Given the browser supports directory selection
    When the user browses for a directory
    Then the repository path field is pre-filled with the directory name
    And the user can complete the absolute path manually

  @product @navigation @p1 @e2e @delta-added
  Scenario: Selecting a workspace lands in Git
    Given a workspace is registered
    When the user selects the workspace
    Then the Git rail is active
    And the complete diff for the default comparison is shown

  @product @navigation @p2 @e2e @delta-added
  Scenario: Project remains reachable after landing in Git
    Given the user landed in Git after selecting a workspace
    When the user activates the Project rail
    Then the project tree is shown for the active workspace

  # ── Phase 2: presentation settings, New/Nuevo, status dots ──

  @product @settings @p1 @e2e @delta-added
  Scenario: Fresh contexts default the file list to tree
    Given no file list view preference is stored
    When the user opens a workspace in Git
    Then the changed files are presented as a tree

  @product @settings @p1 @e2e @delta-added
  Scenario: An explicit stored list preference is preserved
    Given the legacy file list preference is stored as list
    When the user opens a workspace in Git
    Then the changed files are presented as a list

  @product @settings @p1 @e2e @delta-added
  Scenario: Settings control the Git file presentation
    Given the Settings panel is open
    When the user changes the file list view setting to list
    Then the Git file list presents files as a list after reload

  @product @settings @p2 @unit @delta-added
  Scenario: Legacy preference migrates to the settings aggregate
    Given only the legacy file list preference is stored
    When the settings aggregate is read for the first time
    Then the legacy value is honored once
    And the first write removes the legacy key

  @product @git @p1 @e2e @delta-added
   Scenario: Untracked files are labelled New in green
    Given a workspace with an untracked file
    When the user views the Git file list
     Then the untracked file shows the label New
    And the label renders with the green tone

  @product @application @p1 @e2e @delta-added
  Scenario: The API keeps the technical untracked status
    Given a workspace with an untracked file
    When the file list endpoint is queried
    Then the entry status remains untracked

  @product @project @p1 @e2e @delta-added
  Scenario: Directories show descendant-derived status dots
    Given a workspace with changed files under a directory
    When the user views the Project tree
    Then the directory shows a status dot derived from its descendants

  @product @project @p1 @e2e @delta-added
  Scenario: Mixed directory operations use deterministic precedence
    Given a directory contains a modified file and an untracked file
    When the user views the Project tree
    Then the directory dot reflects the modified status
    And a directory with only untracked descendants shows a green dot

  @product @project @p1 @e2e @delta-added
  Scenario: New status dots are green
    Given a workspace with an added file and an untracked file
    When the user views the Project tree
    Then both file dots render in green

  # ── Phase 3: complete diff ──

  @product @git @p1 @e2e @delta-added
  Scenario: Git shows the complete diff by default
    Given a workspace with changes and no open file tab
    When the user lands in Git
    Then the complete diff of the active comparison is shown

  @product @git @p1 @e2e @delta-added
  Scenario: Complete diff lists files in deterministic order
    Given a workspace with several changed files
    When the complete diff is loaded
    Then the file sections appear ordered by path

  @product @git @p1 @e2e @delta-added
  Scenario: Clicking a file scrolls to its diff section
    Given the complete diff is shown
    When the user clicks a file in the complete diff index
    Then the view scrolls to that file's diff section

  @product @git @p1 @e2e @delta-added
  Scenario: Modifier-click opens full-file detail in Project
    Given the complete diff is shown
    When the user Ctrl-clicks or Cmd-clicks a file
    Then a new tab opens with the full file
    And the Project rail becomes active

  @product @git @p2 @e2e @delta-added
  Scenario: Binary and truncated files render markers in the complete diff
    Given a workspace with a binary file and an oversized file
    When the complete diff is loaded
    Then the binary file shows a binary marker without content
    And the oversized file shows a truncation notice

  @product @application @p1 @unit @delta-added
  Scenario: Aggregate reader enforces caps and partial errors
    Given a comparison with more files than the limit
    When the aggregate reader runs
    Then the result is marked truncated
    And per-file failures are collected without failing the result

  @product @application @p1 @unit @delta-added
  Scenario: Complete diff honors snapshot consistency
    Given a repository at a known revision
    When the aggregate reader runs once
    Then all file sections share a single readAt snapshot

  # ── Phase 4: Markdown preview ──

  @product @viewer @p1 @e2e @delta-added
  Scenario: Markdown files expose a Raw/Preview toggle
    Given a workspace with a Markdown file open in Project
    Then the viewer header shows a Raw/Preview toggle at the top right

  @product @viewer @p1 @e2e @delta-added
  Scenario: Markdown default view comes from settings
    Given the Markdown default view is set to preview
    When a Markdown file opens
    Then the preview is shown initially
    When the default is set to raw
    And a Markdown file opens
    Then the raw view is shown initially

  @product @viewer @p1 @e2e @delta-added
  Scenario: Markdown preview escapes HTML and unsafe links
    Given a Markdown file containing raw HTML and a javascript link
    When the user switches to preview
    Then the raw HTML renders as escaped text
    And the javascript link is not rendered as a link

  @product @settings @p1 @e2e @delta-added
  Scenario: Visualization settings are grouped in the Files section
    Given the Settings panel is open
    Then a Files section exposes the file list view and the Markdown default view

  # ── Phase 5: branch selector, panels, tabs, help ──

  @product @git @p1 @e2e @delta-added
  Scenario: Branch selector widens and shows tooltips for long names
    Given a workspace with a branch whose name is long
    When the user opens the branch selector
    Then the selector exposes the full name as a tooltip

  @product @git @p1 @e2e @delta-added
  Scenario: The redundant comparison caption is removed
    Given the Git comparison selector is shown
    Then no working tree vs HEAD caption is displayed

  @product @git @p1 @e2e @delta-added
  Scenario: The working tree can be reselected as target
    Given the user changed the target away from the working tree
    When the user selects Working tree as the target again
    Then the comparison type is inferred as working-tree-vs-head
    And the file list and complete diff refetch

  @product @navigation @p1 @e2e @delta-added
  Scenario: Collapsed right panel tabs expand the panel
    Given the right panel is collapsed
    When the user activates a tab in the collapsed strip
    Then the panel expands and shows that tab

  @product @navigation @p1 @e2e @delta-added
  Scenario: Bottom controls collapse and expand both panels
    Given both panels are expanded
    Then the left and right panels expose collapse controls at the bottom
    When the user collapses the right panel
    Then the right strip exposes an expand control at the bottom

  @product @tabs @p1 @e2e @delta-added
  Scenario: Middle-click closes any open tab
    Given two file tabs are open
    When the user middle-clicks an inactive tab
    Then that tab closes and the active tab is preserved
    When the user middle-clicks the active tab
    Then the active tab closes and a neighbor becomes active

  @product @help @p1 @e2e @delta-added
  Scenario: Help lists keyboard and mouse shortcuts
    Given the user opens Help
    Then the dialog lists the keyboard and mouse shortcuts
    And Escape closes the dialog and returns focus to its trigger

  # ── Regression ──

  @product @regression @p1 @e2e @delta-added
  Scenario: Comparison changes update diff content
    Given a workspace with a comparison selected
    When the user changes the target comparison
    Then the complete diff and file diff show content for the new comparison
```

Note: `@delta-added` tags mark all scenarios as new for this feature. Existing feature files that change behavior (file-list-tree default) get `@delta-modified` annotations during Phase 2 at persistence time, per the delta policy.

---

## 9. Gherkin scenarios vs behaviors and risk-based splits

All 14 approved behaviors map to at least one scenario: W1→S1; W2→S2–S3; W3→S4–S5; W4→S6–S9; W5→S10–S11; W6→S14–S20; W7→S21–S24; W8→S25–S27; W9→S28–S29; W10→S30; W11→S31; W12→S12–S13; W13→S11–S13.

Risk-based splits (agreed): contract-level scenarios (S9, S11, S16–S17, S19) carry `@application`/`@unit` tags and run in unit/integration layers instead of E2E because they exercise adapter/store boundaries that are slower or flakier in the browser; E2E coverage focuses on observable UI behavior. No scenario is left uncovered — each behavior has at least one executable test at the most reliable layer.

---

## 10. Migration and backward compatibility

- **Browser preference**: legacy `diffscribe-file-list-view` is read once (read-through) and honored if it holds an explicit `'list'`; otherwise tree default. First write migrates to `diffscribe-visual-settings` (v1) and removes the legacy key. No silent overwrite of explicit stored values. Malformed/unknown new-key values fall back per field.
- **Route/tab state**: tabs are session-only and reset on workspace change (existing). New default rail = Git does not persist; reload with an active workspace lands in Git. No persisted route state is introduced.
- **API**: new `GET /api/workspaces/[id]/complete-diff` is additive; existing routes untouched; domain enums untouched; no SQLite migration. Versioning doc: additive API → 0.x MINOR per `docs/versioning.md`.
- **Theme tokens**: `--tree-status-untracked` color changes (purple → green) in all theme blocks — a visual, not structural, change; design docs updated (§11).

---

## 11. Source-of-truth documentation updates (docs-writer applies)

| Doc                    | Update                                                                                                                                                                                                                                                                                                                  |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/PRD.md`          | §18 Stage 1 bullet list: complete-diff default + modifier-click to Project, Git landing on workspace select, New/Nuevo label, tree default + visualization settings, Markdown Raw/Preview, help, middle-click close, bottom panel controls, directory status dots (preserve the document's existing language — Spanish) |
| `docs/architecture.md` | New aggregate contract: `GitCompleteDiffReader` port, `GetCompleteDiffUseCase`, DTO, adapter, route; client visualization-settings aggregate; layer boundaries reaffirmed (no domain changes)                                                                                                                           |
| `docs/design.md`       | Panel collapse/expand placement (bottom controls), status dot colors (untracked green; directory aggregation), branch selector width/tooltips, Markdown toggle, help dialog, complete-diff file index                                                                                                                   |
| `docs/domain.md`       | Presentation mapping note: `FileChangeStatus.UNTRACKED` → UI New/Nuevo (consumer vocabulary, domain value unchanged); directory status aggregation precedence rule                                                                                                                                                      |
| `docs/versioning.md`   | Note additive API route (0.x MINOR); explicit statement: no SQLite migration in this change                                                                                                                                                                                                                             |
| `docs/changelog.md`    | Unreleased: Added (complete diff, Markdown preview, settings, help, status dots, middle-click), Fixed (workspace deletion refresh), Changed (tree default, panel controls, branch selector)                                                                                                                             |

---

## 12. Risks and mitigations

| Risk                                                | Impact | Mitigation                                                                                                                                                              |
| --------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Complete-diff performance on large repos            | High   | Aggregate caps (500 files / 4096 KB / 40k lines), per-file caps reused, single git invocation, request guards; E2E uses small fixtures; unit tests cover cap boundaries |
| Markdown rendering security (XSS via `{@html}`)     | High   | Dependency-free renderer escapes ALL source input; link allowlist; no raw HTML passthrough; adversarial unit tests; code review gate on `{@html}` usage                 |
| Preference migration divergence (legacy vs new key) | Medium | Read-through honored once; first-write cleanup; unit tests for every branch; no silent overwrite of explicit values                                                     |
| Directory picker expectations vs browser limits     | Medium | Honest pre-fill + hint fallback (A3); feature detection; manual path stays authoritative                                                                                |
| Existing tests encode list default                  | Medium | Phase 2 explicitly updates file-list-tree feature/steps/E2E; full QA gate catches stragglers                                                                            |
| E2E flakiness in scroll/anchor assertions           | Medium | `scrollIntoView` assertions with polling helper (existing `tests/e2e/helpers/` timing contract); anchor IDs deterministic (encoded path)                                |
| Stage 1 scope creep (AI/collab/auto-fix)            | High   | §2 out-of-scope list enforced; scope-creep protocol; no new deps unless A4 approved                                                                                     |
| Comparison-change races (stale diffs)               | Medium | Existing request-guard pattern applied to the new viewer; E2E content assertions (S19)                                                                                  |
| Status-dot precedence disagreement                  | Low    | Rule is a pure, unit-tested function; precedence list is an approved assumption (A6), trivially adjustable                                                              |
| New API surface                                     | Low    | Route validation mirrors existing file-diff/source guards; additive only; versioning doc note                                                                           |

---

## 13. Definition of done

1. All scenarios in §8 pass at their assigned layer; `npm run qa` green (format, lint, check, unit, integration, check:bdd-language, bdd, e2e, build).
2. Gherkin persisted at `specs/features/product/workspace-git-review-ux.feature` (approved text) with English-only content; file-list-tree feature updated for the tree default.
3. Docs §11 updated; changelog Unreleased updated.
4. No domain, DB-schema, or API-state rename; `untracked` remains the wire value.
5. No Stage 2–4 features implemented; no new dependencies beyond A4 approval (none by default).
6. QA validation-results.md emitted with PASS; developer applied feedback per IADEV-applying-feedback if FAIL.
7. Durable memory writes (see memory_writes) recorded for root cause, decisions, and completion.

---

## 14. Delegation order and routing rationale

### Routing rationale

Complexity = complex, magnitude = high (classification after research). Two active risk flags force the full path regardless of the matrix: (1) **architectural change** — new application/infrastructure aggregate contract (complete diff); (2) **security/policy** — Markdown rendering/sanitization. Therefore the feature routes to `nas_developer` FULL (no mini routing).

### Delegation order and exact approved skills

1. `nas_researcher` (COMPLETED): `mind-management`, `clean-svelte-architecture`, `clean-backend-architecture`, `clean-code`, `frontend-design`, `svelte-code-writer`, `IADEV-bdd-implementation`, `IADEV-writing-gherkin`, `documentation-lookup` (where library/API docs were needed).
2. `nas_planner` (THIS PASS — completed): `mind-management`, `clean-backend-architecture`, `clean-svelte-architecture`, `clean-code`, `frontend-design`, `svelte-code-writer`, `documentation-lookup`, `IADEV-bdd-implementation`, `IADEV-writing-gherkin`, `IADEV-writing-implementation`, `docs-writer` (only for documenting source-of-truth updates).
3. `nas_developer` (FULL, after plan approval — planned, NOT started): `mind-management`, `clean-backend-architecture`, `clean-svelte-architecture`, `clean-code`, `frontend-design`, `svelte-code-writer`, `documentation-lookup` (selected dependency/API if A4 changes), `IADEV-test-driven-development`, `IADEV-bdd-implementation`, `IADEV-writing-gherkin`, `IADEV-applying-feedback` (QA retry feedback).
4. `nas_qa` (after implementation — planned, NOT started): `mind-management`, `clean-backend-architecture`, `clean-svelte-architecture`, `clean-code`, `frontend-design`, `svelte-code-writer`, `IADEV-validating-implementation`, `IADEV-bdd-implementation`, `documentation-lookup` (only if verification needs current library/API behavior).

---

## 15. Rejected alternatives (summary)

- Viewer-only complete diff — rejected (H3 confirmed: no aggregate contract exists; per-file fetches cannot provide snapshot/ordering/limits).
- Embedding full highlighted diffs in the file manifest DTO — rejected (couples metadata to large payloads; separate comparison DTO chosen).
- Bounded lazy client fan-out — rejected (no atomic snapshot, total budget, stable ordering, or partial-error policy; aggregate query chosen — A1).
- Optimistic local workspace list mutation — rejected (see §3).
- Full CommonMark renderer (`marked` + `dompurify`) — deferred (A4 default: dependency-free minimal renderer; re-evaluate on approval).
- Bilingual `New/Nuevo` label — rejected: current UI labels are English-only, no localization exists, and `Nuevo` violates the repository BDD language guard. Use UI-only `New`; keep API/domain `untracked`.
- Keeping the legacy preference key only — rejected (cannot carry `markdownView`; read-through migration chosen — A2).
- Per-tab viewer mode — rejected (rail-global mode retained; A7).
- Moving rail order to put Git first — rejected (landing behavior changes, navigation order stays; W3 satisfied by default tab).

---

## 16. Persistence notes

- `plan.md`: `.nas/state/active/0001-workspace-git-review-ux/plan.md` — CREATED (this file).
- Gherkin: NOT persisted this pass (`gherkin.persist_to_repo.when=on_done`). After approval: `specs/features/product/workspace-git-review-ux.feature` (matches include `product/*`; state.md's `specs/features/workspace-git-review-ux.feature` path is superseded by the configured include patterns).
- Memory writes proposed: see `memory_writes` in the planning output (durable decisions + gaps resolution).
