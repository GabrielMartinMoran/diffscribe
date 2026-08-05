# Research: 0001-workspace-git-review-ux

## Executive summary

Feasibility is **partial**. Most requested UX work fits the existing Stage 1 architecture, but complete-diff review, Markdown preview, directory status aggregation, preference migration, and panel/tab interactions need explicit contracts and tests before implementation.

The workspace deletion defect is confirmed: the backend deletion succeeds, but the custom form-enhancement path does not invalidate the page data used by the sidebar. The minimal boundary is the delete dialog plus a focused browser regression test.

Parallel confirmation is recommended for unresolved behavior contracts, especially the tree-default migration and complete-diff aggregation/navigation.

## User requirements mapping

- Refresh the workspace list after deletion.
- Preserve editable workspace paths and add a directory-selection affordance.
- Open a workspace in Git/diff by default; retain Project view as secondary navigation.
- Move Git tree/list preference into configuration with tree as the default.
- Present technical `untracked` as user-facing `New/Nuevo` in green.
- Show the complete Git diff by default, support in-page file navigation, and modifier-click opening in a new tab with full-file detail.
- Add configurable Markdown Raw/Preview display, with a top-right per-file toggle.
- Widen the branch selector, add long-name tooltips, remove redundant comparison text, and support selecting the working tree again.
- Make collapsed-panel menu interactions consistent, add a bottom expand control, use vertical icon rails consistently, and place collapse controls at the bottom.
- Close any open tab with middle-click.
- Add help for keyboard and mouse interactions.
- Aggregate descendant file statuses into directory dots with an explicit mixed-operation precedence rule.
- Render New/added status dots in green.

Confirmed user decisions: one change with internal phases; Git/diff is the initial workspace view; the UI label is New/Nuevo while the technical Git state remains `untracked`.

## Impacted areas

- Workspace deletion dialog and page-data invalidation.
- File-list store, component, settings, and BDD contracts.
- Project tree status aggregation and styling.
- Git diff application and infrastructure layers.
- Source/Markdown viewer and visualization settings.
- Open-file tabs and panel layout controls.
- Directory import/picker flow.
- Unit, integration, BDD, and E2E test suites.

## Codebase findings with evidence

- `src/lib/web/components/delete-confirm-dialog.svelte`: confirmed stale-list refresh defect; the dialog closes but does not call `invalidateAll()` or update the relevant data.
- `src/lib/web/components/open-workspace-form.svelte`: provides the existing working invalidation pattern.
- `src/lib/web/components/file-list.svelte` and `file-list-view-store.ts`: tree/list UI already exists, but list is the current default.
- `src/lib/web/components/project-tree-node.svelte`: file statuses render, but descendant directory status dots are not implemented.
- `src/lib/web/components/diff-viewer.svelte`: displays the selected-file diff only; there is no complete-diff mode.
- `src/lib/web/components/source-viewer.svelte` and `language-map.ts`: source rendering exists; Markdown Raw/Preview behavior is absent.
- `open-files-tabs.svelte`: normal and modifier-click behavior exists; middle-click close is absent.
- `right-panel-tabs.svelte`, `rail-tabs.svelte`, and `panel-resize.spec.ts`: panel collapse/expand exists but does not fully match the requested interaction model.
- `settings-panel.svelte`: current Appearance/Editor settings do not expose all requested visualization defaults.
- `project-tree.svelte`: project status loading exists, but mixed directory status precedence is unspecified.
- User-facing terminology can distinguish `New/Nuevo` from the technical Git `untracked` state.
- `specs/features/workspace-git-review-ux.feature` is referenced by the feature state but is not yet present; this is expected while persistence is approval-gated.

## Deletion triage

### H1 — confirmed

**Claim:** Deleting a workspace leaves stale sidebar state because the custom form-enhancement callback does not invalidate page data.

**Evidence for:** `delete-confirm-dialog.svelte` closes the dialog but does not call invalidation/update; `open-workspace-form.svelte` demonstrates the working invalidation pattern.

**Evidence against:** Backend deletion and server actions are present and tested.

**Verification performed:** The researcher inspected the dialog, page action, use case, repositories, and existing tests.

**Causal chain:** Delete action succeeds → enhanced dialog callback closes UI → page data remains cached → workspace sidebar renders stale list.

**Minimal fix boundary:** `delete-confirm-dialog.svelte` plus a focused E2E regression test proving that the deleted workspace disappears immediately from the sidebar.

### H2 — plausible

**Claim:** Tree-default behavior is blocked by the current file-list store default and existing local-storage preference.

**Evidence for:** `file-list-view-store.ts` currently defaults to list; existing feature tests encode the old behavior.

**Evidence against:** Tree/list rendering already exists.

**Verification performed:** The researcher inspected the store, file-list component, and file-list BDD tests.

**Open verification:** Define migration behavior for an existing stored preference.

**Minimal fix boundary:** Store default, settings contract, and affected BDD/unit tests.

### H3 — unknown

**Claim:** Complete-diff support requires a new aggregation/use-case contract rather than only a viewer change.

**Evidence for:** The current Git reader loads per-file diffs and the UI displays the selected file only.

**Evidence against:** No existing aggregate endpoint or domain contract was found.

**Verification performed:** The researcher inspected the diff viewer, page data flow, and Git infrastructure.

**Open verification:** Define ordering, binary/large-file handling, and navigation semantics.

**Minimal fix boundary:** Application query, Git adapter, DTO, viewer, and tests, subject to planner confirmation.

## Interaction and UX findings

- Directory selection must account for browser support and user-activation constraints; retain manual path input and define a fallback.
- Complete diff needs a defined file order, handling for binary/large files, anchor/scroll behavior, and modifier-click semantics.
- Markdown preview introduces rendering and security concerns; define supported Markdown, sanitization, and fallback behavior.
- Directory status aggregation needs deterministic precedence for mixed operations.
- Existing panel and rail components can be reused, but their expand/collapse and icon/tab model needs a unified contract.
- Existing tab modifier-click behavior provides a starting point for middle-click close and new-tab navigation.

## Test and documentation impact

Existing coverage includes workspace deletion backend/use-case behavior and workspace E2E flows, file-list/project-tree/tabs/settings/panel patterns, quickpickle/Vitest BDD tests, and Playwright E2E tests.

Recommended additions:

- E2E: delete an open workspace and verify it disappears immediately from the sidebar.
- Unit/BDD: tree as the default view and stored-preference/migration behavior.
- Unit/BDD/E2E: directory status aggregation and precedence.
- Unit/integration/E2E: complete-diff ordering, anchors, scrolling, and modifier-click opening.
- Unit/component/E2E: Markdown Raw/Preview rendering, fallback, and security behavior.
- Component/E2E: middle-click tab close and panel collapse/expand interactions.
- Update the applicable product, architecture, design, domain, versioning, and changelog documents only where the approved behavior changes their source-of-truth responsibilities.

The repository QA chain includes format, lint, type, unit, integration, BDD-language, BDD, E2E, and build checks. BDD uses quickpickle with Vitest.

## Source exhaustion matrix

| Source                                                                                                   | Status                     | Findings / reason                                                                               |
| -------------------------------------------------------------------------------------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------- |
| `AGENTS.md`                                                                                              | Used                       | Project boundaries, required skills, BDD/TDD and QA gates.                                      |
| `.agents/nas.config.yaml`                                                                                | Used                       | Runtime memory and Gherkin persistence configuration.                                           |
| `.nas/state/active/0001-workspace-git-review-ux/state.md`                                                | Used                       | Feature identity and pending Gherkin path.                                                      |
| `docs/PRD.md`                                                                                            | Used                       | Stage 1 scope and product boundaries.                                                           |
| `docs/architecture.md`                                                                                   | Used                       | Layering and application boundaries.                                                            |
| `docs/design.md`                                                                                         | Used                       | UI/design constraints.                                                                          |
| `docs/domain.md`                                                                                         | Used                       | Domain vocabulary and invariants.                                                               |
| `docs/versioning.md`                                                                                     | Used                       | Versioning and migration expectations.                                                          |
| `docs/changelog.md`                                                                                      | Used                       | Documentation change conventions.                                                               |
| `package.json`                                                                                           | Used                       | Scripts and QA commands.                                                                        |
| Workspace, tree, file-list, diff, source-viewer, tabs, panel, settings, route, Git, and repository files | Used                       | Impacted symbols and current behavior.                                                          |
| Existing `specs/features/product/*.feature`                                                              | Used                       | Existing BDD conventions and contracts.                                                         |
| Existing unit, integration, and E2E tests                                                                | Used                       | Coverage and regression patterns.                                                               |
| Context7 Svelte/SvelteKit documentation                                                                  | Used                       | Form enhancement/invalidation and Svelte behavior.                                              |
| MDN directory-picker documentation                                                                       | Used                       | Browser directory-picker capabilities and constraints.                                          |
| Tavily external searches                                                                                 | Used                       | Supplementary browser/library behavior research; exact URLs were not retained after compaction. |
| Mind project memories and active checkpoint                                                              | Used                       | Prior workspace, UI tranche, navigation, and E2E decisions.                                     |
| Additional MCP resources                                                                                 | Listed/used where relevant | No additional source was required beyond the documented sources.                                |

## Skills applied and skipped

Applied: `mind-management`, `clean-svelte-architecture`, `clean-backend-architecture`, `clean-code`, `frontend-design`, `svelte-code-writer`, and applicable IADEV BDD/Gherkin guidance.

Discovered but not needed as primary research skills: `IADEV-test-driven-development`, `IADEV-validating-implementation`, `IADEV-applying-feedback`, `IADEV-writing-implementation`, `IADEV-openspec-artifacts`, `IADEV-spec-creation`, prompt/skill customization, and unrelated domain skills. They belong to later implementation, QA, or unrelated configuration workflows.

## Memory and context

Configured Mind memory was queried in `projects/diffscribe`, including workspace, Git diff, panel/navigation, tabs, and prior UI-tranche terms. Relevant prior memories included workspace domain correction/management, tree UI, sidebar keyboard navigation, diff viewer navigation, panel resizing, tab selection, and prior workspace deletion E2E findings. The active checkpoint was recovered.

Requested durable writes:

- `workspace-delete-refresh-root-cause`: backend deletion succeeds, but the custom delete dialog enhancement does not invalidate page data; use invalidation/update and add an E2E regression test.
- `workspace-ux-research-gaps`: tree-default migration, directory-status precedence, complete-diff aggregation, Markdown preview/security, and directory-picker fallback remain unresolved decisions.

## Risks and remaining gaps

- Missing feature Gherkin file: high until planner persists the approved merged feature.
- Existing tests encode list-default behavior: medium; migration semantics must be explicit.
- Directory picker support and activation constraints: medium.
- Markdown preview rendering/security: medium.
- Complete diff performance and large-repository limits: medium.
- Stage 1 scope must exclude AI, collaboration, auto-fix, code modification, network capabilities, and commit creation.
- The exact complete-diff aggregation contract, file ordering, binary/large-file policy, and new-tab route are not yet verified.
- The exact mixed-status directory precedence and preference migration policy are not yet verified.

## Recommendation

CONTINUE to planning after parallel confirmation of the plausible/unknown behavior contracts. Use the confirmed deletion diagnosis as a focused bugfix scenario. Keep all behavior within Stage 1 and present any unresolved migration, rendering, performance, or routing assumptions for explicit user approval before implementation.

## Research handoff

`PARALLEL_CONFIRMATION` is recommended because multiple behavior hypotheses remain plausible or unknown. No application files were modified.

## Parallel confirmation synthesis

### Tree/list preference (H2)

Independent confirmation keeps H2 **plausible** and rules out a database migration under the current Stage 1 architecture. `file-list-view-store.ts` uses the client-only `diffscribe-file-list-view` key, defaults to `list`, and does not write an implicit default during initialization. An explicit stored `list` represents a prior user choice and should not be silently overwritten. The unresolved decision is whether to keep the legacy key or introduce a versioned client-side visualization-settings aggregate with read-through migration. Existing unit, BDD, and E2E tests encode the list default and will need an explicit fresh-context tree-default contract plus preservation coverage for explicit list selections.

### Complete diff (H3)

Independent confirmation **confirmed** that a viewer-only change is insufficient. The current application has separate file-manifest and single-file-diff contracts: `GitFileListReader` returns metadata, while `GitFileDiffReader` requires one path. No aggregate DTO, use case, reader, route, or composition entry exists. A bounded lazy client fan-out remains technically plausible, but it lacks an atomic snapshot, total response budget, stable cross-file ordering, and a policy for partial errors and untracked files. The planner must choose and specify either a new aggregate application/infrastructure query or an explicitly approved bounded lazy strategy. A separate comparison-diff DTO is preferred over embedding full highlighted content in the file manifest.

The current checkout also indicates that comparison state is already parent-owned and propagated through the page shell; an older memory reporting a propagation gap is stale. E2E coverage should verify actual changed diff content rather than relying on selector labels.

### Remaining confirmation decisions passed to planning

- Preserve explicit legacy `list` selections while using tree for absent/new preferences, unless the user explicitly approves a different migration.
- Keep visualization preferences client-only unless scope is explicitly expanded beyond Stage 1.
- Define deterministic file ordering, aggregate and per-file limits, binary/oversized-file behavior, rename/copy parsing, untracked-file inclusion, snapshot consistency, and cross-file anchor identity.
- Define whether modifier-click opens a tab in Project/source mode and whether that mode is stored per tab or is a global focus change.
- Define Markdown parser/sanitizer dependencies and fallback behavior before implementation.
