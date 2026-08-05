# Delegation: 0003-workspace-tabs-quick-open-refinements

## Contract

- Feature: `0003-workspace-tabs-quick-open-refinements`
- Plan: `.nas/state/active/0003-workspace-tabs-quick-open-refinements/plan.md`
- Research: `.nas/state/active/0003-workspace-tabs-quick-open-refinements/research.md`
- Canonical Gherkin: `specs/features/product/workspace-tabs-quick-open-refinements.feature`
- Delta Gherkin: `quick-open.feature`, `open-files-tabs.feature`, `settings-panel.feature`, `panel-rail-ux-corrections.feature`, `file-list-tree.feature`, `file-list-panel.feature`, `workspace-git-review-ux.feature`, `observation-status.feature`
- Approval: user approved the plan and all assumptions. Desktop right navigation is right-edge vertical; mobile remains horizontal.

## Invariants

- Left collapse/expand control is a stable shell-bottom control. Help is directly above it. Expanded control spans the left panel region; collapsed control spans the rail.
- Right desktop navigation is a vertical tablist at the panel’s right edge. Preserve DOM/keyboard order and mobile sheet behavior.
- Workspace context shows active `displayName` and truncated `repositoryPath` at the top of Project/Git/Settings, never Workspaces.
- Active central file tabs have no bottom border; inactive file tabs have a subtle bottom border.
- The complete diff is a workspace-scoped synthetic `CentralTab` with stable ID `complete-diff`, always first and non-closable. It is created only with an active workspace, refreshes on comparison change, and is recreated after workspace changes while ordinary file tabs are cleared.
- Quick Open always includes tracked and nonignored untracked files, excludes ignored files, removes the obsolete setting/filter, and joins active-comparison statuses by path. Keep the 512 cap and existing `New`/green mapping.
- Observations receive seeded visual tests first; only evidence-backed style/layout corrections are allowed. No stale-domain wiring.
- No backend/API/DTO/domain/database/persistence/dependency/AI/collaboration/mutation changes.

## Authorized files

### Web/state to modify

- `src/lib/web/stores/active-file-store.ts` — discriminated pinned-tab union and lifecycle.
- `src/lib/web/components/open-files-tabs.svelte` — pinned tab, borders, empty state.
- `src/routes/+page.svelte` — pin lifecycle, routing, workspace reset, left footer, context header.
- `src/lib/web/components/rail-tabs.svelte` — Help above shell footer; remove old reopen owner.
- `src/lib/web/components/right-panel-tabs.svelte` — desktop right-edge navigation.
- `src/lib/web/components/quick-open-dialog.svelte` — all candidates, status badges, cleanup.
- `src/lib/web/services/quick-open-scorer.ts` — remove untracked filter and pass status.
- `src/lib/web/stores/quick-open-store.ts` — legacy-key cleanup helper.
- `src/lib/web/components/settings-panel.svelte` — remove obsolete switch.
- `src/lib/web/components/file-list.svelte` — remove Git-local List/Tree controls.
- `src/lib/web/components/observation-panel.svelte` and `observation-card.svelte` — evidence-backed corrections only.
- `src/lib/web/components/project-tree.svelte`, `project-tree-node.svelte`, workspace sidebar/nav, and `src/routes/+page.server.ts` only if strictly required by the existing client data flow; escalate before widening scope.
- `src/lib/web/styles/tokens.css` only if seeded Observation evidence proves a missing token.

### New web modules

- `src/lib/web/components/workspace-context-header.svelte`
- `src/lib/web/services/file-list-status-loader.ts`

### Tests and steps

- Unit: `tests/unit/web/active-file-store.test.ts`, `quick-open-scorer.test.ts`, `quick-open-store.test.ts`, `file-list-status-loader.test.ts`.
- Approved scope exception: `tests/unit/web/components/panel-rail-contracts.test.ts` migrates the prior panel marker contract to the stable 0003 shell-footer contract. The user explicitly authorized this test-only addition.
- New E2E: `tests/e2e/pinned-complete-diff.spec.ts`, `workspace-context.spec.ts`, `observation-visual.spec.ts`.
- Updated E2E: `open-files-tabs.spec.ts`, `complete-diff.spec.ts`, `quick-open.spec.ts`, `settings-panel.spec.ts`, `panel-rail-corrections.spec.ts`, `file-list-tree.spec.ts`, `file-list-panel.spec.ts`, `comparison-propagation.spec.ts`, `mobile-hardening.spec.ts`, and the listed workspace fixture helper only as required for Settings-driven setup.
- Listed `tests/steps/*.steps.ts` files for English Gherkin synchronization, including removal of the obsolete delta skip hook.

### Documentation

- `docs/design.md`, `docs/architecture.md`, `docs/PRD.md`, `docs/domain.md`, and `docs/changelog.md`.
- `docs/versioning.md` only if a version bump becomes necessary; default is no bump.

### Do not touch

- All `src/lib/server/**`, domain, infrastructure, APIs, DTOs, database/migrations, and Git readers.
- `package.json`, `package-lock.json`, Playwright/Vitest configs, CI, and `.agents/nas.config.yaml`.
- Shared UI kit files (`src/lib/web/components/ui/**`), `panel-layout-store.ts`, and server/tree DTOs.
- Mobile horizontal sheet/drawer behavior and its helpers, except no-visual-change assertions.
- `scripts/check-bdd-language.mjs`, `AGENTS.md`, and `.nas/**` except Orchestrator state/QA reports.
- Speculative stale-domain Observation wiring, new dependencies, or any unlisted file.

## Conventions

- Vitest/unit/integration/BDD uses quickpickle; Playwright is E2E.
- Reuse visual settings, status mapping, `StatusBadge`, request guards, workspace fixtures, Git ignore semantics, fuzzy ranking, and the 512 cap.
- Never leak a synthetic tab sentinel into `DiffViewer` or `SourceViewer` file paths.
- Use `docs-writer` for documentation and preserve existing document languages.
- Seed populated Observation cards before making visual corrections.

## Commands

- `npm run format`
- If format fails: `npm run format:fix`, review formatting-only changes, then rerun format.
- `npm run lint`
- `npm run check`
- `npm run test:unit`
- `npm run test:integration`
- `npm run check:bdd-language`
- `npm run test:bdd`
- `npm run test:e2e -- --workers=8`
- `npm run build`

Run gates sequentially. Every Playwright invocation uses exactly 8 workers; never use another count or run BDD and E2E concurrently when the host is unstable.

## Authorization

- Task: implement all nine approved refinements through the six plan phases using Red → Green → Refactor, synchronize Gherkin/docs/steps, and pass QA.
- Developer: `nas_developer` FULL. Complexity/high magnitude and new tab/Quick Open state contracts require full routing; mini is not authorized.
- Developer skills: `mind-management`, `clean-backend-architecture`, `clean-svelte-architecture`, `clean-code`, `frontend-design`, `svelte-code-writer`, `IADEV-test-driven-development`, `IADEV-bdd-implementation`, `IADEV-writing-gherkin`, `IADEV-applying-feedback`, and `docs-writer` for docs.
- QA skills: `mind-management`, `clean-backend-architecture`, `clean-svelte-architecture`, `clean-code`, `frontend-design`, `svelte-code-writer`, `IADEV-validating-implementation`, and `IADEV-bdd-implementation`.
- Handoff: read this file and `plan.md` first. Stop and report any server/API/dependency/shared-kit/mobile/unlisted scope.
- Completion evidence: Red/Green/Refactor proof, changed files/magnitude, all gate results with explicit 8-worker Playwright evidence, pinned-tab/Quick Open/status/panel/Observations/accessibility/mobile audit, docs/Gherkin status, and memory writes.
