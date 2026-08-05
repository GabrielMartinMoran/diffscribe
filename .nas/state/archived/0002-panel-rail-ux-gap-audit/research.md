# Research: 0002-panel-rail-ux-gap-audit

## Executive summary

The screenshots match the current implementation in several places, but they also expose real gaps against the clarified request. The most important gap is that the expanded desktop right panel still uses horizontal Comments/Review tabs. The requested design is vertical icons in both expanded and collapsed desktop states.

The collapsed right strip behaves correctly: selecting an option expands the panel, preserves selection, and the bottom reopen control works. The left panel is inconsistent: selecting a left rail option while collapsed changes the selected rail item but does not reopen the panel; only the separate reopen button does that.

Desktop footers exist and reach the viewport bottom. The left reopen control is not truly bottom-aligned because it and Help both use `margin-top: auto`. There are also accessibility issues around tabpanel relationships, nested tablists, collapsed-left focus, and `aria-hidden`.

## Screenshot evidence and limitations

The supplied screenshots show:

1. A collapsed layout with vertical Workspaces/Project/Git/Settings on the left, lower panel controls, and Comments/Review controls on the right.
2. An expanded layout with the Workspace contextual panel on the left and a horizontal Comments/Review bar above Observations on the right.

The second detail is precisely the mismatch against the clarified requirement to remove right-side tabs and use vertical icons consistently. Exact pixel/color/typography comparison is not possible because the image files were not available locally. Runtime inspection was performed at the running desktop/mobile app.

## Gap matrix

| Requirement                                            | Evidence/current behavior                                                                                                        | Status                               | Severity | Correction boundary                                                                      |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | -------- | ---------------------------------------------------------------------------------------- |
| Left Workspaces/Project/Git/Settings rail is vertical  | `rail-tabs.svelte:32-64` defines four entries and vertical orientation                                                           | Fulfilled structurally               | Low      | Only adjust label visibility if the final visual target requires icon-only desktop rails |
| Expanded left Workspace panel occupies the left column | `+page.svelte:412-483`; runtime shows the contextual panel                                                                       | Fulfilled                            | None     | None                                                                                     |
| Expanded right navigation uses vertical icons          | `right-panel-tabs.svelte:149-157` renders `Tabs` without orientation; runtime reports horizontal orientation                     | Not fulfilled                        | High     | `right-panel-tabs.svelte`, navigation semantics/styles, tests                            |
| Right navigation is vertical in both desktop states    | Collapsed branch passes vertical orientation; expanded branch does not                                                           | Partially fulfilled                  | High     | Desktop right navigation and tests; preserve mobile branch                               |
| Collapsed right option expands and selects             | `handleStripTabChange` calls `onTabChange` and `onToggleRight`; runtime confirms it                                              | Fulfilled                            | None     | Add stronger regression assertions                                                       |
| Collapsed right bottom reopen exists                   | `right-panel-reopen-btn` at `right-panel-tabs.svelte:139-147`; runtime bottom aligned                                            | Fulfilled                            | None     | Preserve selected-content behavior                                                       |
| Expanded panel collapse controls are at the bottom     | Left footer `+page.svelte:470-482`, right footer `right-panel-tabs.svelte:175-186`; runtime bottoms align                        | Fulfilled with minor size difference | Low      | Normalize size only if visual approval requires it                                       |
| Collapsed-left reopen is at the bottom                 | `rail-tabs.svelte:141-176` gives both reopen and Help `margin-top:auto`; runtime puts reopen well above Help                     | Partially fulfilled                  | Medium   | Group bottom controls explicitly in `rail-tabs.svelte`                                   |
| Left rail option expands a collapsed left panel        | `+page.svelte:404-406` changes rail selection separately from `toggleLeft`; runtime panel remains zero width after Project click | Not fulfilled                        | High     | `+page.svelte` rail callback contract and left E2E tests; preserve mobile behavior       |
| Left collapse is keyboard/accessibility coherent       | Focus remains on hidden `left-panel-collapse-btn`; collapsed aside remains `aria-hidden=false`                                   | Not fulfilled                        | Medium   | `+page.svelte` focus and hidden-state semantics                                          |
| Icon-only controls remain discoverable                 | Accessible labels exist, but no confirmed visible tooltip/title fallback                                                         | Partial/unverifiable visually        | Medium   | Add approved tooltip/title strategy when labels are hidden                               |
| Right tabs have valid ARIA relationships               | `Tabs.svelte` emits `aria-controls`, but referenced tabpanel IDs do not exist; expanded panel lacks `aria-labelledby`            | Not fulfilled                        | Medium   | `Tabs.svelte` API and right-panel consumer semantics                                     |
| Collapsed right has one tablist                        | Right wrapper adds an outer `role="tablist"` around the shared inner tablist                                                     | Not fulfilled                        | Medium   | Remove nested role or change navigation semantics                                        |
| Mobile drawer remains stable                           | Runtime 375px layout, backdrop, sheet, toggle and focus behavior remain coherent; mobile keeps horizontal sheet header           | Fulfilled                            | None     | Preserve mobile branch unless explicitly expanded                                        |
| Right panel fits its grid column                       | Expanded panel measures 321px for a 320px grid column because border is outside content-box                                      | Partial                              | Low      | Add `box-sizing:border-box` and geometry assertion                                       |

## Exact code findings

### Right panel

- `src/lib/web/components/right-panel-tabs.svelte`
  - Collapsed desktop branch at lines 121–147 is vertical and has the bottom reopen button.
  - Expanded desktop branch at lines 148–186 renders `Tabs` without `orientation`, so the shared default is horizontal.
  - Mobile branch intentionally retains horizontal header tabs and a close button.
  - Expanded panel lacks border-box sizing and is one pixel wider than its grid column.
- `src/lib/web/components/ui/Tabs.svelte`
  - Defaults to horizontal orientation.
  - Emits tablist/tab roles, `aria-selected`, `aria-controls`, and roving tabindex, but does not render tabpanels.
- `src/lib/web/components/observation-panel.svelte`
  - Owns the Observations content and its own scrolling.

### Left rail and shell

- `src/lib/web/components/rail-tabs.svelte`
  - Defines the four vertical rail entries.
  - Renders a separate reopen control and Help control.
  - Assigns `margin-top:auto` to both, splitting the free space.
- `src/routes/+page.svelte`
  - Desktop rail selection only updates `activeRailTab`.
  - `onToggleLeft` is separately wired to `toggleLeft`.
  - Collapsed left content remains mounted and is not hidden from assistive technology.
  - Left and right desktop footers are present.
- `src/lib/web/stores/panel-layout-store.ts`
  - Correctly persists widths and collapsed booleans; it does not own the rail-expansion policy.

## Fulfilled, partial, not fulfilled, unverifiable

### Fulfilled

- Four-entry vertical left rail.
- Expanded left contextual panel.
- Collapsed right vertical strip.
- Collapsed right option expansion and selection.
- Bottom right reopen control.
- Desktop bottom collapse footers.
- Help placement, focus return, and mobile drawer behavior.

### Partially fulfilled

- Right navigation is vertical only when collapsed.
- Left reopen exists but is not truly bottom-aligned.
- Selected state/accessibility names exist, but icon-only visual discoverability is not complete.
- Right panel is functionally aligned but has a one-pixel border-box overflow.

### Not fulfilled

- Expanded desktop right navigation as vertical icons instead of horizontal tabs.
- Consistent left/right collapsed-menu expansion behavior.
- Complete `aria-controls`/tabpanel relationships and non-nested tablists.
- Collapsed-left accessibility state and focus handling.

### Unverifiable from screenshots

- Exact pixel styling.
- Whether desktop labels are intentionally visible or should be icon-only.
- Whether the vertical-only requirement should also apply to the mobile sheet.

## Test false positives and missing assertions

- `tests/e2e/base-ui-kit.spec.ts` currently codifies horizontal right tabs and left/right arrow navigation.
- `tests/e2e/ui-shell.spec.ts` asserts that right tabs exist but not orientation, icon-only presentation, geometry, or valid panel relationships.
- `tests/e2e/panel-resize.spec.ts` covers right strip reopening but not expanded vertical orientation, true-bottom geometry, left menu expansion, or left focus/hidden state.
- `tests/e2e/rail-tabs.spec.ts` does not assert Help/reopen ordering or left option expansion.
- `tests/steps/workspace-git-review-ux.steps.ts` and `tests/steps/ui-redesign.steps.ts` use source-marker checks for several behaviors rather than browser-observable assertions.

Recommended tests:

1. Expanded desktop right navigation is vertical and icon-only, while mobile remains horizontal.
2. Exactly one right tablist exists in collapsed mode; all `aria-controls` targets and tabpanel relationships are valid.
3. Every left rail option expands a collapsed left panel and selects the option.
4. Left collapse moves focus to a visible control and removes collapsed content from the accessibility tree.
5. Both reopen controls reach the viewport bottom and Help has intentional ordering/spacing.
6. Right panel stays within its grid column.

## Accessibility and responsive findings

Positive: native buttons, accessible names, `aria-selected`, roving tabindex, orientation-aware keyboard navigation, Help dialog focus restoration, and mobile sheet handling exist.

Gaps: nonexistent `aria-controls` targets, missing expanded `aria-labelledby`, nested collapsed-right tablists, collapsed-left `aria-hidden=false`, focus left on a hidden collapse button, and no confirmed visible tooltip strategy for icon-only controls.

At 375px the mobile grid, backdrop z-index, bottom sheet, toggle column, and close behavior are coherent. The audit recommends preserving this branch during desktop-only corrections.

## Risks and open decisions

- The current docs and older Mind memories still describe horizontal Comments/Review tabs; the current user clarification must supersede them.
- Changing shared `Tabs.svelte` can affect multiple consumers; prefer a scoped right-navigation correction unless a shared semantic fix is necessary.
- Decide whether the final right navigation remains a true tab widget or becomes icon-button navigation with explicit panels.
- Decide whether “vertical icons only” applies to mobile; the recommended default is desktop-only.
- Icon-only controls need tooltips/titles without losing accessible names.

## Source exhaustion matrix

| Source                                              | Status | Use                                                                                    |
| --------------------------------------------------- | ------ | -------------------------------------------------------------------------------------- |
| `AGENTS.md`, `.agents/nas.config.yaml`              | Used   | Repository rules and runtime configuration                                             |
| Canonical `docs/*`                                  | Used   | Existing product/design/navigation contracts                                           |
| Archived `0001` plan/delegation/research/validation | Used   | Approved baseline and prior false-positive coverage                                    |
| Current Svelte shell/panel/rail/store/components    | Used   | Exact implementation and runtime behavior                                              |
| Current unit/BDD/E2E tests and steps                | Used   | Coverage gaps and stale assumptions                                                    |
| Mind project memories                               | Used   | Prior panel, rail, mobile, and redesign decisions; stale horizontal-tab memories noted |
| Live runtime at `http://localhost:56823/`           | Used   | DOM roles, geometry, focus, and responsive behavior                                    |
| Context7 Svelte/SvelteKit/icon docs                 | Used   | Svelte accessibility, SSR, and icon behavior                                           |
| W3C/MDN ARIA and CSS docs                           | Used   | Tabpanel relationships, vertical navigation, box-sizing                                |
| Web search                                          | Used   | Supplementary ARIA semantics; no implementation decision depended on it                |

## Skills applied/skipped

Applied: `mind-management`, `clean-svelte-architecture`, `clean-code`, `frontend-design`, `svelte-code-writer`, `IADEV-bdd-implementation`, and `IADEV-writing-gherkin`.

Skipped as not applicable to this read-only web audit: `clean-backend-architecture`, TDD, implementation, validation, feedback, OpenSpec, and spec-creation skills.

## Parallel confirmation

Recommended before planning because three concerns can fail independently:

1. Expanded right-navigation orientation and semantic model.
2. Left collapsed-menu expansion, focus, and accessibility behavior.
3. Bottom-control geometry, Help ordering, and mobile preservation.

## Recommendation

CONTINUE to independent confirmation and then planning. No application files were modified. The current user clarification, not stale docs or memories, is the controlling contract for the desktop right navigation.

## Parallel confirmation synthesis

### R1 — expanded right navigation

Confirmed. `right-panel-tabs.svelte` omits orientation in the expanded desktop branch, while `Tabs.svelte` defaults to horizontal. Runtime reports horizontal orientation and 160px-wide label tabs. A CSS-only change is insufficient because `aria-controls` references have no matching tabpanels, the expanded panel lacks reciprocal `aria-labelledby`, and the collapsed branch nests two tablists. The recommended correction is scoped vertical Tabs with real tabpanels; converting to icon-button navigation should happen only if Comments/Review are intentionally reclassified as destinations. Mobile horizontal sheet navigation remains unchanged.

### R2 — collapsed left panel

Confirmed. Desktop rail activation only changes `activeRailTab`; it does not reopen a collapsed left panel. Runtime reproduces a selected Project rail item with a zero-width panel. The correct action must be idempotent: select the requested item and reopen only when collapsed, without toggling an already-expanded panel. Collapse must transfer focus to a visible rail control before hiding the panel subtree, using unmount/hidden/inert semantics so Project tree items cannot receive focus while the panel is collapsed. Mobile drawer behavior is separate and remains valid.

### R3 — geometry, semantics, and mobile

Confirmed by the primary audit and independent runtime summary. The left reopen and Help controls compete through independent auto margins, the expanded right panel has a one-pixel border-box overflow, the right navigation has nested tablists/orphaned ARIA references, icon-only states lack a confirmed visual tooltip strategy, and mobile behavior remains unchanged. These are correction/test concerns, not evidence of a backend or persistence issue.
