# Research: 0003-workspace-tabs-quick-open-refinements

## Executive summary

The current architecture supports most requested refinements, but several are new state contracts rather than cosmetic changes. The complete diff is currently a special empty-tab state, not a pinned tab. Quick Open currently lacks Git status metadata and still exposes the obsolete include-untracked preference. The Git file list duplicates the Settings Tree/List preference. The left collapsed panel still leaves part of the old collapse control visible. Workspace context is not shown outside the Workspaces panel.

The requested right-panel icon edge is treated as the controlling user instruction: desktop right-panel icons should move to the panel’s right edge; mobile remains unchanged. This supersedes the older design document wording that places them on the left.

## Requirement audit

| Requirement                                                                           | Current evidence                                                                                                                                                            | Status                        | Severity | Minimal correction                                                                                                                                                                 |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Left collapse/expand control fixed at bottom; Help above; expanded control full width | `+page.svelte` leaves the desktop collapse footer inside the zero-width collapsed aside; runtime exposes a clipped control. `rail-tabs.svelte` owns rail Help/reopen group. | Not fulfilled                 | High     | Move control ownership/placement to the stable bottom slot; hidden state keeps the same position; expanded control stretches to panel width, collapsed control remains rail width. |
| Right-panel tab icons on the right edge                                               | `right-panel-tabs.svelte` places the vertical tablist on the panel’s left edge.                                                                                             | Not fulfilled                 | High     | Reverse desktop panel flex/order; preserve mobile horizontal sheet.                                                                                                                |
| Active workspace indicator outside Workspaces                                         | `+page.svelte` only carries active workspace ID; `WorkspaceListItem` has display name but no shared context header.                                                         | Not fulfilled                 | Medium   | Add a top context indicator to Project/Git/Settings panel headers, hidden on Workspaces.                                                                                           |
| Active central tab has no bottom border; inactive tabs do                             | `open-files-tabs.svelte` current active/inactive visual rules do not match screenshot intent.                                                                               | Partial/unverified            | Medium   | Correct active/inactive border state and add visual/E2E assertion.                                                                                                                 |
| Complete diff is first pinned, non-closable tab                                       | `active-file-store.ts` is path-only; `open-files-tabs.svelte` renders only file tabs; `+page.svelte` renders CompleteDiffViewer separately when no file tab is open.        | Not fulfilled                 | High     | Add workspace/comparison-scoped synthetic pinned tab identity, first position, no close/middle-close, and route/selection reset semantics.                                         |
| Remove “No file selected” for complete diff                                           | Empty-state text is in `open-files-tabs.svelte`/central shell and still appears when the complete diff is the special state.                                                | Not fulfilled                 | Medium   | Hide the generic empty state for the pinned complete-diff tab; retain it only for genuinely empty file-tab states if still needed.                                                 |
| Observations styling                                                                  | `observation-panel.svelte`/`observation-card.svelte` contain the current cards and tokens; screenshot shows the rendered tab/panel styling is broken.                       | Requires runtime confirmation | Medium   | Audit populated/empty card layout, panel width, badges, status dots, focus/hover, and dark-theme tokens; add visual behavior tests.                                                |
| Remove List/Tree controls from Git                                                    | `file-list.svelte` still renders List/Tree controls while Settings persists the same preference.                                                                            | Not fulfilled                 | Medium   | Remove Git-local toggle and keep Settings as the single source of truth.                                                                                                           |
| Quick Open always includes non-ignored untracked files                                | `settings-panel.svelte` and `quick-open-store.ts` persist `diffscribe-quick-open-include-untracked`; `quick-open-dialog.svelte` filters by tracked state.                   | Not fulfilled                 | High     | Remove setting/control, migrate/ignore obsolete value, always use tree source with Git-standard ignore filtering.                                                                  |
| Quick Open shows working-tree status                                                  | `ProjectTreeNode` exposes only `tracked`; scorer/results have no technical status; ProjectTree separately fetches `/file-list` status map.                                  | Not fulfilled                 | High     | Enrich Quick Open results with existing file-list status values and reuse UI status mapping (`untracked` → `New`, green).                                                          |

## Exact findings

### Panel controls and workspace context

- `src/routes/+page.svelte`: owns shell layout, active workspace ID, rail state, complete-diff routing, and tab reset. The left desktop collapse footer remains mounted inside a zero-width collapsed aside, which explains the clipped control visible in the screenshot. No display name is propagated to Project/Git/Settings headers.
- `src/lib/web/components/rail-tabs.svelte`: owns the rail Help/reopen group. The correction must keep the collapse control in a stable bottom location and coordinate the expanded full-width presentation with the panel footer.
- `src/lib/web/components/right-panel-tabs.svelte`: vertical desktop navigation currently sits on the panel’s left edge. The user now explicitly requests right-edge placement; mobile remains a separate horizontal branch.
- `src/lib/web/components/workspace-sidebar.svelte`, `workspace-nav-item.svelte`, and workspace DTOs already contain display-name information that can feed a context indicator without a backend change.

### Central tabs and complete diff

- `src/lib/web/stores/active-file-store.ts`: path-only session tabs; no synthetic/pinned identity.
- `src/lib/web/components/open-files-tabs.svelte`: owns tab title styling, close buttons, middle-click behavior, and generic `No file selected` state.
- `src/lib/web/components/complete-diff-viewer.svelte`: aggregate diff is robust and already has ordering/scrolling/markers, but is mounted separately by `+page.svelte` only when Git is active and no file tab exists.
- `+page.svelte`: changing workspace resets tabs; changing comparison and opening a file must be reconciled with a pinned complete-diff tab.

Required decisions for planning: whether the pinned tab is workspace-scoped or comparison-scoped, whether opening a file activates another tab while preserving the pinned first tab, and how the pinned tab behaves when no active workspace exists.

### Git presentation controls and Quick Open

- `src/lib/web/components/file-list.svelte`: still exposes List/Tree controls in Git even though Settings owns the persisted preference.
- `src/lib/web/components/settings-panel.svelte` and `src/lib/web/stores/quick-open-store.ts`: expose/persist the obsolete `diffscribe-quick-open-include-untracked` option.
- `src/lib/web/components/quick-open-dialog.svelte`: uses the shared tree loader and only displays an untracked marker.
- `src/lib/web/services/quick-open-scorer.ts`: fuzzy scoring is good and capped at 512, but has no status dimension.
- `src/lib/web/services/project-tree-loader.ts`: flattens tree nodes without Git status.
- `src/lib/web/components/project-tree.svelte`: separately fetches `/file-list` and builds a status map; this data is not shared with Quick Open.
- `src/lib/server/infrastructure/git/simple-workspace-tree-reader.ts`: combines tracked/index files and non-ignored untracked files using `git ls-files --cached` and `--others --exclude-standard`. Ignored files are excluded; tracked deleted paths remain index-visible.
- `src/lib/server/infrastructure/git/simple-git-file-list-reader.ts` and `file-list-results.ts`: already expose technical statuses `added`, `modified`, `deleted`, `renamed`, `copied`, `type-changed`, `unmerged`, `untracked`, and `unknown`.
- `src/lib/web/components/file-status.ts`: existing UI mapping can render `untracked` as `New` in green.

### Observations

`observation-panel.svelte` and `observation-card.svelte` contain badges, status dots, stale state, hover/focus actions, and read-only behavior. The screenshot indicates a presentation regression, but exact populated-state failure and responsible CSS need live confirmation before planning a narrow fix. Existing empty-state behavior may be correct while card layout/tokens are not.

## Test gaps and false positives

- No test covers a pinned, non-closable complete-diff tab, its first position, workspace reset, comparison changes, or coexistence with file tabs.
- No test covers the active central tab’s border state.
- No test covers right-edge desktop navigation or the stable/full-width left collapse control.
- Git list tests still assume List/Tree controls are present.
- Quick Open tests encode the old tracked/untracked setting and do not verify ignored files, status metadata, or all change statuses.
- Observation tests do not sufficiently assert populated card layout, badges, status dots, stale state, hover/focus actions, or dark-theme appearance.
- Existing full QA baselines: 0001 had 645 unit/189 integration/533 BDD/292 E2E; 0002 had 651 unit/189 integration/543 BDD/305 E2E.

## Risks and gaps

- High: pinned complete-diff state changes tab identity/lifecycle and comparison/workspace reset behavior.
- High: Quick Open status requires reconciling tree files, deleted tracked paths, renames, untracked files, ignored files, and comparison-specific statuses.
- High: the right-edge requirement supersedes `docs/design.md` and must be reflected in docs/Gherkin.
- Medium: removing the obsolete preference needs migration/cleanup so old localStorage does not keep affecting behavior.
- Medium: full Quick Open inclusion may affect performance; preserve the existing 512-result cap and fuzzy ranking.
- Medium: Observations visual defect is not fully isolated without populated runtime evidence.
- Low: existing Svelte `binding_property_non_reactive` warnings are unrelated.

## Assumptions for planning

- Desktop right-panel icons move to the right edge; mobile horizontal sheet remains unchanged.
- The pinned full-diff tab is synthetic, first, non-closable, and workspace-scoped; opening files activates ordinary tabs after it.
- Complete-diff “No file selected” is removed only for the synthetic pinned view.
- Quick Open always includes non-ignored untracked files and keeps the existing Git ignore semantics.
- Quick Open displays technical statuses through the existing UI mapping; API/domain values remain unchanged.
- The workspace indicator uses the active workspace display name/path at the top of non-Workspaces left-panel content.

## Source-exhaustion matrix

| Source                                          | Status | Findings                                                                                           |
| ----------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------- |
| `AGENTS.md`, `.agents/nas.config.yaml`          | Used   | Stage 1 boundaries, skills, QA and Gherkin policy                                                  |
| Canonical `docs/*`                              | Used   | Current panel, tabs, Quick Open, domain and design contracts; stale right-edge conflict identified |
| Archived 0001/0002 state                        | Used   | Prior complete-diff, visual-settings, panel and mobile contracts                                   |
| Current Svelte shell/components/stores/services | Used   | Exact affected symbols and current behavior                                                        |
| Current server Git readers/routes/DTOs          | Used   | Existing tree/status data and ignore semantics                                                     |
| Current unit/BDD/E2E tests/features/steps       | Used   | False positives and missing assertions                                                             |
| Mind memories                                   | Used   | Prior tabs, Quick Open, complete diff, panel corrections; stale conflicts recorded                 |
| Live runtime at `http://127.0.0.1:56823/`       | Used   | Panel/tabs/Git/Quick Open/observations layout checks where available                               |
| Context7 SvelteKit docs                         | Used   | Focus and component behavior context                                                               |
| W3C ARIA/Git docs/web search                    | Used   | Tabs and `git ls-files` semantics                                                                  |

## Skills and memory

Applied: `mind-management`, `clean-svelte-architecture`, `clean-code`, `frontend-design`, `svelte-code-writer`, and BDD/test guidance. `clean-backend-architecture` was consulted because Quick Open may consume an existing application/API contract. No files were modified.

Relevant memories include `panel-rail-ux-corrections-implemented`, `complete-diff-aggregate-contract`, `tranche-b-tabs-quick-open-scope-20260802`, `tranche-b-tabs-quick-open-implemented-20260802`, and the 0001/0002 implementation records. Older right-edge and Quick Open wording must yield to the current user request.

## Parallel confirmation

Recommended before planning for three independent contracts:

1. Pinned complete-diff tab identity/lifecycle.
2. Quick Open unconditional inclusion plus status data flow.
3. Right-edge panel/workspace context and Observations visual correction.

## Recommendation

CONTINUE to parallel confirmation and planning. No application files were modified. The active feature remains planning-only and the repository Gherkin file is not yet persisted because `when=on_done`.

## Parallel confirmation synthesis

### Pinned complete diff

Confirmed as a web-only state/shell change. The current complete diff is rendered beside an empty file-tab state; it is not represented in `active-file-store.ts`. The recommended model is one stable workspace-scoped synthetic tab with a discriminated kind and stable ID, always first and non-closable, including middle-click. Comparison changes refresh it in place; workspace changes replace the pin and clear ordinary file tabs. No active workspace should materialize a misleading live comparison tab.

### Quick Open

Confirmed that the server tree reader already includes cached/tracked files and nonignored untracked files while excluding ignored files. The direct defect is client-side filtering through `includeUntracked` and the obsolete localStorage setting. Existing comparison-aware `/file-list` data can be joined by path to Quick Open results; keep the 512 result cap. Technical status for the active comparison should be displayed through the existing UI mapping, with a defined fallback for non-working-tree comparisons and untracked tree-only entries.

### Panel, context, tabs, and Observations

Confirmed: the left collapse footer is clipped inside the zero-width aside; the expanded right tablist is left-positioned; active workspace context exists only in Workspaces; active and inactive central tabs both currently have no bottom border. The mobile horizontal sheet remains stable. Populated ObservationCard styling is not directly runtime-verifiable without seeded observations; source supports badges/status/stale/snapshot styles, but `ObservationPanel` currently passes no stale status. Plan should include seeded visual/accessibility coverage and only then narrow any style/wiring correction.
