# Delegation: 0005-workspace-management-e2e-flake

## Contract

- **Feature**: 0005-workspace-management-e2e-flake
- **Gherkin**: `specs/features/application/workspace-management-e2e-flake.feature`
- **Plan**: revision 3, Phase 14 finalization
- **Status**: Gate A approved; Phase 9/10 QA PASS; Phase 11 target stability PASS; three scenarios persisted at `on_done`
- **Mode**: full developer, TDD/BDD contract pins and final quality verification
- **Goal**: add static BDD pins for the three persisted `@enhance-diagnostics` scenarios and verify final quality gates without changing behavior.

## Scenarios

The canonical feature contains 18 scenarios: the original 15 plus exactly 3 `@enhance-diagnostics` scenarios. Preserve all feature text; do not edit the `.feature` file in this delegation.

## Files

### To create

None.

### To modify

| Path | What |
|------|------|
| `tests/steps/workspace-management-e2e-flake.steps.ts` | Add static quickpickle pins for the three persisted `@enhance-diagnostics` scenarios, referencing the existing observer, diagnostics, fake lifecycle, and E2E wiring markers. Keep all 15 existing pins unchanged. |

### Read-only

- All production files and all Phase 9/10 implementation files.
- `specs/features/application/workspace-management-e2e-flake.feature` — planner-owned and already persisted.
- `.nas/**`, configuration, workers, fixtures, hydration helper, and unrelated specs.

## Do NOT touch

- Production, hydration, worker/config, or unrelated test files.
- The persisted `.feature` file.
- Retries, sleeps, reloads, timeout values, worker count, or `preventDefault` behavior.
- `npm audit` dependencies.

## Existing tests and baselines

- Feature scenarios: 18 total after planner persistence.
- Existing BDD pins: 15/15 before this delegation.
- Unit 678/678, integration 225/225, Phase 11 target 175/175 isolated, target 175 passed in five full-suite runs.
- One unrelated full-suite flake at `workspace-registration.spec.ts:113` remains separated per D12.
- Global BDD has the pre-existing `npm audit` exception.

## Patterns and contracts

- BDD files and steps are English.
- Use existing `requireMarker`/quickpickle static-pin conventions; no runtime behavior changes.
- Pins must map the three new scenarios to markers already present in:
  - `tests/e2e/helpers/enhance-diagnostics.ts`
  - `tests/e2e/helpers/register-workspace.ts`
  - `tests/e2e/workspace-registration.spec.ts`
  - `tests/integration/e2e-helpers/workspace-management-flake.test.ts`
- Do not weaken assertions or turn the pins into grep-only claims beyond the established BDD convention.

## Commands

- `npm run test:bdd-language`
- `npm run test:bdd`
- `npm run format`
- `npm run lint`
- `npm run check`
- `npm run test:unit`
- `npm run test:integration`
- `npm run build`
- `npm run qa` (report the pre-existing npm audit exception and unrelated D12 flake separately)

## Authorization

- **Task**: Phase 14.2 BDD pins and final verification only.
- **Scope**: Only `tests/steps/workspace-management-e2e-flake.steps.ts` may be modified.
- **Developer**: `nas_developer` FULL; never mini.
- **Exact approved skills**: `mind-management`, `clean-svelte-architecture`, `clean-code`, `IADEV-test-driven-development`, `IADEV-bdd-implementation`, `IADEV-applying-feedback`.
- **No feature edits**: Gherkin persistence is complete and planner-owned.
- **No Phase 12 fix**: target stability is already green; do not alter the guard or production.
- **Escalation**: report unrelated suite flakes separately; do not expand scope.
