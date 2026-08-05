# Delegation: 0002-panel-rail-ux-gap-audit

## Contract

- **Feature**: `0002-panel-rail-ux-gap-audit`
- **Plan**: `.nas/state/active/0002-panel-rail-ux-gap-audit/plan.md`
- **Research**: `.nas/state/active/0002-panel-rail-ux-gap-audit/research.md`
- **Gherkin**: `specs/features/product/panel-rail-ux-corrections.feature`
- **Delta features**: `specs/features/product/workspace-git-review-ux.feature`, `panel-resize.feature`, `rail-tabs.feature`, `base-ui-kit.feature`
- **Scenarios/tags**: `@product/panel-rail-ux-corrections`, `@product`, `@navigation`, `@a11y`, `@layout`, `@responsive`, `@etapa-1`, plus the approved `@delta-modified` scenarios in the four existing features.
- **Approved scope**: User explicitly approved implementation and confirmed that vertical right tabs apply on desktop only; mobile keeps its horizontal sheet navigation for now.

## Approved decisions and invariants

- Expanded and collapsed desktop right navigation is vertical icon Tabs; mobile remains horizontal.
- Keep Comments/Review as true tabs, but render consumer-owned real tabpanels with valid `aria-controls`/`aria-labelledby`; do not modify the shared `Tabs.svelte` primitive.
- Exactly one desktop right tablist; remove the collapsed-right wrapper tablist.
- Selecting a left rail item while the left panel is collapsed selects it and opens the panel idempotently; selecting while open does not toggle it closed.
- On left collapse, transfer focus to a visible rail control before hiding the panel. Collapsed desktop content is mounted but `inert` and `aria-hidden="true"`; mobile drawer semantics remain unchanged.
- Left bottom group is one auto-margin container: reopen above Help, Help at the bottom. Right reopen remains bottom-pinned. Expanded panel collapse controls remain in bottom footers.
- Add native `title` fallbacks to icon-only reopen/collapse controls while retaining `aria-label`.
- Add `box-sizing: border-box` to the expanded right panel; no global reset.
- No backend, domain, infrastructure, persistence, dependency, package, shared kit, or mobile behavior changes.
- No changes to `scripts/check-bdd-language.mjs`, `playwright.config.ts`, `panel-layout-store.ts`, `ui/Tabs.svelte`, or the mobile-hardening/responsive contracts.

## Files

### To modify

#### Web shell and panels

| Path                                             | What                                                                                                                                                                                                               |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/lib/web/components/right-panel-tabs.svelte` | Desktop vertical tablist in expanded/collapsed states, real tabpanels and ARIA relationships, remove nested tablist, focus-on-expand, mobile wrapper semantics without visual change, border-box, title fallbacks. |
| `src/lib/web/components/rail-tabs.svelte`        | Group left reopen + Help at the bottom, remove competing auto margins, add reopen title.                                                                                                                           |
| `src/routes/+page.svelte`                        | Idempotent desktop open-if-collapsed rail selection, collapse/reopen focus transfer, desktop panel `inert`/`aria-hidden`/tabpanel attributes, preserve mobile handlers.                                            |

#### Tests and steps

| Path                                                     | What                                                                                                                                                               |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `tests/e2e/panel-rail-corrections.spec.ts`               | New browser-observable coverage: orientation, one tablist, real ARIA panels, left expansion/focus/inert, bottom geometry, titles, border-box, mobile preservation. |
| `tests/e2e/base-ui-kit.spec.ts`                          | Replace stale expanded-right horizontal assumptions with vertical orientation and ArrowUp/ArrowDown assertions.                                                    |
| `tests/e2e/panel-resize.spec.ts`                         | Assert single inner tablist/panels and retain resize, collapse, reopen, persistence regressions.                                                                   |
| `tests/e2e/ui-shell.spec.ts`                             | Assert expanded-right vertical orientation and visible tabpanel.                                                                                                   |
| `tests/steps/workspace-git-review-ux.steps.ts`           | Replace marker-only panel steps with semantic markers for the corrected contract.                                                                                  |
| `tests/steps/ui-redesign.steps.ts`                       | Update right-panel keyboard semantics from horizontal arrows to vertical arrows.                                                                                   |
| `tests/unit/web/components/panel-rail-contracts.test.ts` | New marker contract for bottom group and open-if-collapsed/inert wiring, if the planned unit marker approach is retained.                                          |

#### Documentation

| Path                   | What                                                                                                                                 |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `docs/design.md`       | Document desktop vertical right navigation, mobile exception, panel layout, bottom controls, keyboard contract, and title fallbacks. |
| `docs/changelog.md`    | Add Unreleased correction entry.                                                                                                     |
| `docs/PRD.md`          | Add minimal product note for the desktop vertical-icon contract, preserving existing document language.                              |
| `docs/architecture.md` | Audit/update only if it explicitly states horizontal right tabs; no architectural layer change.                                      |

### To create

- `tests/e2e/panel-rail-corrections.spec.ts`
- `tests/unit/web/components/panel-rail-contracts.test.ts` if required by the approved plan

The canonical Gherkin feature and four delta features were already persisted at the approval gate. Do not recreate or semantically rewrite them.

### Do NOT touch

- `src/lib/server/**`, domain, infrastructure, database schema, migrations, APIs, or persistence.
- `src/lib/web/stores/panel-layout-store.ts`.
- `src/lib/web/components/ui/Tabs.svelte`, `ui/ids.ts`, `ui/variants.ts`, or any shared kit primitive.
- `src/lib/web/components/observation-panel.svelte`, `review-panel.svelte`, `project-tree.svelte`, `git-context-panel.svelte`, `workspace-sidebar.svelte`, `settings-panel.svelte`.
- Mobile branch behavior, `mobile-hardening.spec.ts`, `responsive-mobile.spec.ts`, and their helpers. Only add approved no-visual-change ARIA attributes in the right-panel sheet wrapper if needed.
- `package.json`, `package-lock.json`, `playwright.config.ts`, `scripts/check-bdd-language.mjs`, `.agents/nas.config.yaml`, `AGENTS.md`.
- `tests/e2e/helpers/**` unless an unavoidable helper change is escalated first.
- `.nas/**` except the Orchestrator-owned state/report files.
- Programmatic rail switches (Quick Open, workspace landing, Git Ctrl/Cmd-click): they must retain current behavior and must not reopen the left panel; only direct rail clicks reopen it.
- Icon-button navigation conversion, global box-sizing reset, new tooltip package/component, theme token changes, and mobile vertical navigation.
- Any unlisted file without Orchestrator escalation.

## Existing tests and conventions

- Vitest for unit/integration/BDD; quickpickle consumes English Gherkin; Playwright for E2E.
- Existing panel width/resize persistence tests are the baseline.
- Reuse `tabButtonId()`/`tabPanelId()` helpers and the existing right-panel focus-return pattern.
- Preserve Svelte 5 SSR/hydration safety, native buttons, roving tabindex, ArrowUp/ArrowDown vertical keyboard behavior, focus-visible styling, reduced motion, and mobile drawer focus return.
- Real tabpanels must be mounted/hidden as approved so inactive Comments/Review state and scroll are preserved.
- Marker tests are allowed only as supplemental checks; every new correction needs browser-observable E2E assertions.
- Documentation changes must use `docs-writer` conventions and preserve each document’s existing language.

## Commands and quality gates

- Format: `npm run format`
- If format fails: `npm run format:fix`, review formatting-only diff, then rerun `npm run format`
- Lint: `npm run lint`
- Types: `npm run check`
- Unit: `npm run test:unit`
- Integration: `npm run test:integration`
- BDD language: `npm run check:bdd-language`
- BDD: `npm run test:bdd`
- E2E/Playwright: `npm run test:e2e -- --workers=8`
- Build: `npm run build`
- Full QA: `DIFFSCRIBE_E2E_WORKERS=8 npm run qa` only if that script forwards the worker setting; otherwise run all stages individually and run E2E with the explicit 8-worker command.

**Mandatory user constraint:** every Playwright execution uses exactly 8 workers. Never run with the default count, `--workers=1`, or any other value. Do not run BDD and E2E concurrently if the host becomes unstable.

## Authorization

- **Task**: Implement the approved panel/rail corrections in plan phases 1–3, persist/consume the already-approved Gherkin, update required docs, and pass the full QA gate.
- **Scope**: Only files and contracts listed above.
- **Developer**: `nas_developer` FULL. Complexity is complex and magnitude medium/high; shared navigation/accessibility semantics route to FULL, never mini.
- **Required developer skills**: `mind-management`, `clean-svelte-architecture`, `clean-code`, `frontend-design`, `svelte-code-writer`, `IADEV-test-driven-development`, `IADEV-bdd-implementation`, `IADEV-writing-gherkin`, `IADEV-applying-feedback`, and `docs-writer` when modifying docs.
- **Required QA skills**: `mind-management`, `clean-svelte-architecture`, `clean-code`, `frontend-design`, `svelte-code-writer`, `IADEV-validating-implementation`, `IADEV-bdd-implementation`; `documentation-lookup` only if current external semantics need verification.
- **Handoff rule**: Read this file and `plan.md` before touching code. If a shared kit, package, helper, mobile branch, or unlisted file is required, stop and report scope expansion; do not self-authorize.
- **Completion evidence**: Return Red/Green/Refactor evidence, changed-file list, commands/results with explicit 8-worker Playwright command, accessibility/ARIA audit, docs summary, and requested memory writes. Do not claim done until fresh QA passes.
