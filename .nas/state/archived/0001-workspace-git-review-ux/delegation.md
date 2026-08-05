# Delegation: 0001-workspace-git-review-ux

## Contract

- **Feature**: `0001-workspace-git-review-ux`
- **Plan**: `.nas/state/active/0001-workspace-git-review-ux/plan.md`
- **Research**: `.nas/state/active/0001-workspace-git-review-ux/research.md`
- **Gherkin**: `specs/features/product/workspace-git-review-ux.feature`
- **Existing Gherkin delta**: `specs/features/product/file-list-tree.feature`
- **Scenarios**: `@product/workspace-git-review-ux`, `@product`, `@application`, `@workspace`, `@navigation`, `@settings`, `@git`, `@project`, `@viewer`, `@tabs`, `@help`, `@regression`
- **Scenario count**: 33 in the new feature; existing file-list tree scenarios retain their prior coverage with the approved tree-default delta.

## Approved decisions and invariants

- One feature, six sequential implementation phases; use one `nas_developer` full contract.
- Workspace selection lands on Git/diff; Project remains reachable.
- UI label for technical `untracked` is **`New`**, always English. The API/domain/DTO value remains `untracked`.
- No localization is introduced. Do not change `check:bdd-language`; all feature files and step definitions remain English.
- New/added status dots use green. Directory status precedence is: `unmerged > deleted > modified > type-changed > added > renamed > copied > untracked > unknown`.
- Fresh file-list preference defaults to Tree. Explicit legacy `diffscribe-file-list-view=list` is preserved through read-through migration into version 1 `diffscribe-visual-settings`; first write removes the legacy key.
- Markdown default is Preview, configurable to Raw. Preview is a dependency-free, allowlisted, HTML-escaping renderer; raw HTML is never emitted and unsafe links are rejected.
- Directory browsing must retain editable manual path entry. Browsers cannot provide the absolute path; prefill the directory name and show the approved limitation hint.
- Complete diff uses the approved aggregate application/infrastructure contract, deterministic path order, working-tree untracked inclusion, per-file caps (256 KB/5000 lines), aggregate caps (500 files/4096 KB/40,000 lines), binary/truncation markers, and partial-error collection.
- Git plain file click scrolls the complete diff; Ctrl/Cmd-click opens a tab and switches to Project/source mode. Existing single-file DiffViewer behavior and selection remain intact.
- Working tree is a fixed target option and can be selected again. Remove the redundant comparison caption. Branch controls must expose long names through `title`.
- Panel rails remain vertical. Desktop collapse controls move to the bottom; collapsed right panel gets a bottom reopen button; activating a collapsed right tab expands and selects it. Mobile drawer header behavior remains unchanged.
- Middle mouse button (`MouseEvent.button === 1`) closes active or inactive tabs without changing the existing close-selection rules.
- Help is a keyboard-accessible dialog opened from the bottom of the left rail.
- No AI, collaboration, network/fetch, auto-fix, code modification, commit creation, SQLite migration, or new runtime dependency.

## Files

### To modify

#### Web and state

| Path                                                  | What                                                                                                                                         |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/routes/+page.svelte`                             | Git-first landing, complete-diff shell, scroll target, modifier-click Project focus, left-panel footer/help wiring.                          |
| `src/lib/web/components/delete-confirm-dialog.svelte` | Await `invalidateAll()` after successful deletion before closing.                                                                            |
| `src/lib/web/components/open-workspace-form.svelte`   | Editable path plus feature-detected directory browse input, name prefill, limitation hint.                                                   |
| `src/lib/web/components/file-list.svelte`             | Visual settings, Tree default, scroll/tab click semantics, English `New` label.                                                              |
| `src/lib/web/components/file-tree-branch.svelte`      | Keep recursive status labels consistent with English `New`.                                                                                  |
| `src/lib/web/components/settings-panel.svelte`        | New Files section with file-list Tree/List and Markdown Raw/Preview defaults.                                                                |
| `src/lib/web/components/file-status.ts`               | Map untracked to success/green tone.                                                                                                         |
| `src/lib/web/components/project-tree-node.svelte`     | Render descendant-derived directory status dots and accessible labels.                                                                       |
| `src/lib/web/styles/tokens.css`                       | Make untracked/new status token green in all theme blocks.                                                                                   |
| `src/lib/web/components/source-viewer.svelte`         | Markdown Raw/Preview toggle, configured initial mode, safe preview rendering.                                                                |
| `src/lib/web/components/git-context-panel.svelte`     | Wider branch slots, tooltips, working-tree target, caption removal, selection forwarding.                                                    |
| `src/lib/web/components/branch-select-popup.svelte`   | Working tree pseudo-option and long-name titles.                                                                                             |
| `src/lib/web/components/right-panel-tabs.svelte`      | Bottom collapse footer, collapsed-strip reopen control, expand-on-selection behavior.                                                        |
| `src/lib/web/components/rail-tabs.svelte`             | Bottom Help control and vertical-rail consistency.                                                                                           |
| `src/lib/web/components/open-files-tabs.svelte`       | Auxiliary/middle-click close for every tab.                                                                                                  |
| `src/lib/web/stores/file-list-view-store.ts`          | Remove or compatibility-forward legacy store according to the approved migration; no explicit stored List may be lost.                       |
| `src/lib/web/stores/active-file-store.ts`             | Only if required to preserve the existing tab lifecycle while adding the approved mode/focus behavior; do not introduce per-tab viewer mode. |
| `src/lib/web/utils/language-map.ts`                   | Only if a client-safe Markdown language mirror is required; add parity tests.                                                                |
| `src/lib/web/components/file-list-tree.ts`            | Only if needed to preserve deterministic directory-first/path ordering; avoid unrelated changes.                                             |
| `src/lib/web/components/comparison-inference.ts`      | Only if required for the approved working-tree target parity; existing inference behavior should be preserved.                               |

#### Server/application/infrastructure

| Path                                                                   | What                                                                                                                     |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `src/lib/server/infrastructure/git/unified-diff-parser.ts`             | Add pure multi-file unified-diff splitting helper and tests; preserve existing parser behavior.                          |
| `src/lib/server/composition/workspace-services.ts`                     | Register the complete-diff reader/use case.                                                                              |
| `src/routes/api/workspaces/[id]/complete-diff/+server.ts`              | Add validated additive aggregate endpoint.                                                                               |
| `src/lib/server/application/git-complete-diff-reader.ts`               | Add application port.                                                                                                    |
| `src/lib/server/application/dto/results/complete-diff-results.ts`      | Add aggregate DTO and partial/truncation metadata.                                                                       |
| `src/lib/server/application/services/get-complete-diff-use-case.ts`    | Resolve refs and execute the aggregate reader.                                                                           |
| `src/lib/server/infrastructure/git/simple-git-complete-diff-reader.ts` | Implement Git aggregate read, untracked synthesis, rename/binary handling, deterministic order, caps and partial errors. |
| `src/lib/web/utils/status-aggregation.ts`                              | Add pure descendant collection and precedence aggregation.                                                               |
| `src/lib/web/utils/markdown-renderer.ts`                               | Add dependency-free escaping renderer and URL allowlist.                                                                 |

#### Documentation

| Path                   | What                                                                                                      |
| ---------------------- | --------------------------------------------------------------------------------------------------------- |
| `docs/PRD.md`          | Update Stage 1 behavior list, preserving its existing Spanish language.                                   |
| `docs/architecture.md` | Document aggregate read contract, route, client visual settings, and unchanged layer boundaries.          |
| `docs/design.md`       | Document controls, colors, directory dots, Markdown toggle, help, branch widths, and complete-diff index. |
| `docs/domain.md`       | Document UI mapping `untracked` → `New` and directory precedence without changing domain vocabulary.      |
| `docs/versioning.md`   | Record additive 0.x API route and absence of SQLite migration.                                            |
| `docs/changelog.md`    | Add Unreleased Added/Fixed/Changed entries.                                                               |

#### Tests and step definitions

| Path                                                                                                                                                                                                                                                                                                                                                                                             | What                                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/unit/web/visual-settings-store.test.ts`                                                                                                                                                                                                                                                                                                                                                   | New preference defaults, validation, legacy read-through and cleanup.                                                                                                                                                           |
| `tests/unit/web/status-aggregation.test.ts`                                                                                                                                                                                                                                                                                                                                                      | Precedence, descendant collection, empty input.                                                                                                                                                                                 |
| `tests/unit/web/markdown-renderer.test.ts`                                                                                                                                                                                                                                                                                                                                                       | Supported Markdown, escaping, unsafe URL rejection, adversarial input.                                                                                                                                                          |
| `tests/unit/infrastructure/unified-diff-parser.test.ts`                                                                                                                                                                                                                                                                                                                                          | Multi-file split behavior.                                                                                                                                                                                                      |
| `tests/unit/infrastructure/complete-diff-reader.test.ts`                                                                                                                                                                                                                                                                                                                                         | Aggregate adapter contract, ordering, caps, binary, rename, untracked, errors.                                                                                                                                                  |
| `tests/unit/application/get-complete-diff-use-case.test.ts`                                                                                                                                                                                                                                                                                                                                      | Ref resolution and reader passthrough.                                                                                                                                                                                          |
| `tests/unit/web/comparison-inference.test.ts`                                                                                                                                                                                                                                                                                                                                                    | Working-tree target parity if changed.                                                                                                                                                                                          |
| `tests/unit/web/file-status.test.ts`                                                                                                                                                                                                                                                                                                                                                             | English `New`/green UI mapping while technical status stays `untracked`.                                                                                                                                                        |
| `tests/integration/git/simple-git-file-list-reader.test.ts`                                                                                                                                                                                                                                                                                                                                      | Any shared parser/rename regression required by aggregate behavior.                                                                                                                                                             |
| `tests/integration/git/simple-git-file-diff-reader.test.ts`                                                                                                                                                                                                                                                                                                                                      | Shared cap/parser regressions only where necessary.                                                                                                                                                                             |
| `tests/e2e/workspace-delete-refresh.spec.ts`                                                                                                                                                                                                                                                                                                                                                     | Sidebar removes deleted workspace without reload.                                                                                                                                                                               |
| `tests/e2e/workspace-open-flow.spec.ts`                                                                                                                                                                                                                                                                                                                                                          | Editable path, browse fallback, and Git landing.                                                                                                                                                                                |
| `tests/e2e/complete-diff.spec.ts`                                                                                                                                                                                                                                                                                                                                                                | Aggregate view, ordering, anchors, modifier-click, markers, limits.                                                                                                                                                             |
| `tests/e2e/markdown-preview.spec.ts`                                                                                                                                                                                                                                                                                                                                                             | Raw/Preview, defaults, settings, safe rendering.                                                                                                                                                                                |
| `tests/e2e/help-dialog.spec.ts`                                                                                                                                                                                                                                                                                                                                                                  | Help content, Escape, focus return.                                                                                                                                                                                             |
| Existing affected E2E: `workspace-management.spec.ts`, `file-list-tree.spec.ts`, `file-list-panel.spec.ts`, `settings-panel.spec.ts`, `git-context-panel.spec.ts`, `git-branches.spec.ts`, `git-ref-popup.spec.ts`, `comparison-propagation.spec.ts`, `panel-resize.spec.ts`, `rail-tabs.spec.ts`, `open-files-tabs.spec.ts`, `project-view.spec.ts`, `project-tree.spec.ts`, `ui-shell.spec.ts` | Update only assertions/contracts required by the approved scenarios.                                                                                                                                                            |
| `tests/steps/workspace-git-review-ux.steps.ts`                                                                                                                                                                                                                                                                                                                                                   | New step definitions for the persisted feature. All patterns/comments must be English.                                                                                                                                          |
| Existing affected step files                                                                                                                                                                                                                                                                                                                                                                     | Update only where the approved existing feature delta requires it: file-list tree, settings, project tree, Git branches/ref popup, panel resize, rail tabs, open tabs, workspace management, and application file-list adapter. |

### To create

- `src/lib/web/stores/visual-settings-store.ts`
- `src/lib/web/components/complete-diff-viewer.svelte`
- `src/lib/web/components/help-dialog.svelte`
- `src/lib/web/utils/status-aggregation.ts`
- `src/lib/web/utils/markdown-renderer.ts`
- `src/lib/server/application/git-complete-diff-reader.ts`
- `src/lib/server/application/dto/results/complete-diff-results.ts`
- `src/lib/server/application/services/get-complete-diff-use-case.ts`
- `src/lib/server/infrastructure/git/simple-git-complete-diff-reader.ts`
- `src/routes/api/workspaces/[id]/complete-diff/+server.ts`
- The new unit, integration, E2E, and step-definition files listed above.

### Do NOT touch

- `src/lib/server/domain/value-objects/file-change-status.ts`: `untracked` and `added` remain canonical technical values.
- SQLite entities, repositories, migrations, and database schema.
- Git mutation/fetch/commit behavior.
- AI, collaboration, network, auto-fix, code modification, or Stage 2–4 functionality.
- `scripts/check-bdd-language.mjs`: do not add a `Nuevo` exception; the approved UI label is English `New`.
- `.agents/nas.config.yaml`: no NAS configuration change is authorized.
- `package.json`/`package-lock.json` for new runtime dependencies; the approved Markdown renderer is dependency-free. Escalate any dependency need.
- `src/lib/web/components/branch-options.ts` unless a test proves the approved working-tree behavior cannot be implemented at popup level.
- Existing comparison propagation architecture; only strengthen its tests.
- Any file not listed in this contract without escalation to the Orchestrator.

## Existing tests and conventions

- Unit/integration/BDD: Vitest; BDD runner: quickpickle.
- Browser: Playwright E2E.
- Clean Architecture: domain has no framework/transport imports; application owns ports/use cases/DTOs; infrastructure owns Git adapters/parsing; web owns Svelte UI/state.
- Existing request-guard patterns must be reused for complete diff and comparison changes.
- Existing per-file diff/source caps and fixture repositories are the baseline.
- Existing tab close-selection and workspace-reset behavior must remain intact.
- BDD language is English only. The visible UI label is `New`; the API assertion remains `untracked`.
- Svelte browser APIs must be guarded for SSR/hydration. Directory picker behavior must degrade to manual path entry.
- `{@html}` is permitted only for output from the escaping Markdown renderer; never interpolate raw source.
- Preserve accessibility attributes, focus-visible behavior, reduced-motion behavior, and responsive mobile drawer patterns.

## Commands and quality gates

- Format check: `npm run format`
- Format autofix only when format fails: `npm run format:fix`, review diff, then rerun `npm run format`
- Lint: `npm run lint`
- Types: `npm run check`
- Unit: `npm run test:unit`
- Integration: `npm run test:integration`
- BDD language: `npm run check:bdd-language`
- BDD: `npm run test:bdd`
- E2E/Playwright: `npm run test:e2e -- --workers=8`
- Build: `npm run build`
- Full QA: `npm run qa`, ensuring its Playwright stage is executed with exactly `8` workers; if the script does not forward the worker flag, run the documented individual E2E command with `--workers=8` and report the discrepancy instead of silently using another worker count.

**Mandatory user constraint:** every direct or indirect Playwright execution for this feature uses exactly 8 workers. Never run Playwright with its default worker count, `--workers=1`, or another value.

## Authorization

- **Task**: Implement all approved W1–W13 behaviors in the six phases of `plan.md`, strictly Red → Green → Refactor, and make the full QA gate pass.
- **Scope**: Only the files and contracts listed in this delegation and the approved Gherkin/step-definition artifacts.
- **Developer**: `nas_developer` FULL. Mini is not authorized because complexity/magnitude are complex/high and architectural/security risk flags are active.
- **Required skills**: `mind-management`, `clean-backend-architecture`, `clean-svelte-architecture`, `clean-code`, `frontend-design`, `svelte-code-writer`, `documentation-lookup` for any selected dependency/API, `IADEV-test-driven-development`, `IADEV-bdd-implementation`, `IADEV-writing-gherkin`, `IADEV-applying-feedback`.
- **Handoff rule**: Read this file and `plan.md` first. Do not perform exploratory scope expansion. If an unlisted file, dependency, API contract, or behavior is required, stop and report it to the Orchestrator.
- **Completion evidence**: Return changed-file list, observed line/file magnitude, Red evidence, Green evidence, Refactor/quality-gate results, Playwright command with `--workers=8`, and any requested memory writes. Do not claim completion until fresh verification is run.
