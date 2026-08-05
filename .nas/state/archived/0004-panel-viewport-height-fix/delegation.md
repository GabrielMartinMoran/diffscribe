# Delegation: 0004-panel-viewport-height-fix

## Contract

- **Feature**: `0004-panel-viewport-height-fix`
- **Plan**: `.nas/state/active/0004-panel-viewport-height-fix/plan.md`
- **Research**: `.nas/state/active/0004-panel-viewport-height-fix/research.md`
- **Gherkin**: `specs/features/product/panel-viewport-height-fix.feature`
- **Approval**: User approved the plan and assumptions A1–A3. Desktop central and right regions must reach the viewport bottom like the left; mobile and bottom controls must be preserved.

## Approved invariants

- Root cause: `src/routes/+page.svelte` uses `grid-template-rows: 1fr auto`; center and right direct grid items occupy only row 1 and end ~29px above the viewport.
- Desktop fix: center spans `grid-row: 1 / -1` with `grid-column: 3`; right expanded `.right-panel` and collapsed `.right-panel-strip-wrap` span `grid-row: 1 / -1` with `grid-column: 4`, via desktop-scoped `:global()` selectors. Row span MUST be paired with explicit columns.
- Mobile: explicit `grid-template-rows: 1fr` in the mobile block only; zero visual change, contract made truthful.
- Left footer stays bottom-most with expanded full-left-region width and collapsed rail width; right footer/reopen/collapse behavior unchanged; Reset Layout stays a fixed overlay.
- Internal flex/min-height/overflow rules are not to be changed.
- No backend/API/domain/persistence/dependency/shared-kit/mobile-behavior changes.

## Files

### To modify

- `src/routes/+page.svelte` — desktop grid placement for center/right; explicit mobile single-row declaration.
- `tests/e2e/viewport-height.spec.ts` — NEW browser-observable geometry suite.
- `tests/steps/ui-redesign.steps.ts` — new desktop bottom-boundary marker steps for the persisted feature.
- `tests/steps/mobile-hardening.steps.ts` — strengthen weak mobile grid markers and add geometry steps.
- `docs/design.md` — document desktop center/right spanning the full shell height and mobile single row.

### To create

- `tests/e2e/viewport-height.spec.ts`

### Do NOT touch

- Server/API/domain/DB/Git readers, `package.json`/lock, Playwright/Vitest configs, CI, `.agents/nas.config.yaml`, shared `ui/**`, `panel-layout-store.ts`, mobile behavior/helpers (beyond assertions), `scripts/check-bdd-language.mjs`, `AGENTS.md`, `.nas/**` except Orchestrator reports, or any unlisted file.

## Commands and gates

- `npm run format`
- If format fails: `npm run format:fix`, review formatting-only diff, rerun format.
- `npm run lint`
- `npm run check`
- `npm run test:unit`
- `npm run test:integration`
- `npm run check:bdd-language`
- `npm run test:bdd`
- `npm run test:e2e -- --workers=8`
- `npm run build`

Sequential gates; never BDD and E2E concurrently if the host is unstable; never use a Playwright worker count other than exactly 8.

## Authorization

- **Task**: Implement phases 1–3 (RED geometry/markers → GREEN grid placement → REFACTOR docs/QA/Gherkin sync) with strict Red → Green → Refactor, and pass the full QA chain.
- **Developer**: `nas_developer` FULL (simple + medium routes to FULL; visual layout contract and multi-breakpoint geometry justify full).
- **Developer skills**: `mind-management`, `clean-svelte-architecture`, `clean-code`, `frontend-design`, `svelte-code-writer`, `IADEV-test-driven-development`, `IADEV-bdd-implementation`, `IADEV-writing-gherkin`, `IADEV-applying-feedback`, `docs-writer`.
- **QA skills**: `mind-management`, `clean-svelte-architecture`, `clean-code`, `frontend-design`, `svelte-code-writer`, `IADEV-validating-implementation`, `IADEV-bdd-implementation`.
- **Handoff**: Read this file and `plan.md` first. Stop and report any server/API/dependency/shared-kit/mobile/unlisted scope.
- **Completion evidence**: Red/Green/Refactor proof, changed files, all gate results with explicit 8-worker Playwright evidence, desktop/mobile geometry audit, docs/Gherkin status, memory writes.
