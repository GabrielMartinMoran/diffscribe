# Research: 0004-panel-viewport-height-fix

## Executive summary

The defect is confirmed and isolated to desktop CSS Grid placement. The shell reserves a second row for the left bottom footer, but the central and right direct grid items remain confined to row 1. At 1280×720 and 1440×800, both center and right regions end 29px above the viewport while the left footer reaches the viewport bottom.

The safe fix is to make desktop center and right items explicitly span rows 1 through the final row while keeping explicit columns 3 and 4. Row spanning without explicit columns reorders the regions. Internal panel flex/overflow rules are not the root cause. Mobile currently reaches the viewport correctly and must remain unchanged.

## Evidence and root-cause hypotheses

### H1 — confirmed

`src/routes/+page.svelte` defines `grid-template-rows: 1fr auto`; the left footer occupies row 2. Center and right direct grid items occupy only row 1. Runtime at 1280×720 reports rows `691px 29px`; center/right bottom is `691`, left footer bottom is `720`. At 1440×800 the same relationship appears: center/right end at `771`, left footer at `800`.

**Minimal boundary:** `src/routes/+page.svelte` desktop grid placement, explicit columns 3/4 and row span 1/-1; retain the left footer row.

### H2 — rejected

Internal flex, `min-height`, or overflow rules are not causing the gap. `right-panel-tabs.svelte` already uses `min-height: 0`, flexible body/footer sizing, and internal scroll ownership. Extending the outer grid item makes the internals reach the bottom correctly.

### H3 — rejected

The issue is not caused by mobile viewport units or breakpoints. At 375×667 the shell, center, rail, toggle, and open sheet reach the viewport bottom with no document overflow. Mobile behavior must be preserved.

### H4 — confirmed

Row spanning must include explicit columns. Runtime injection of only `grid-row: 1 / -1` moved center/right into earlier columns through Grid auto-placement. Pairing `grid-row: 1 / -1` with `grid-column: 3` and `grid-column: 4` preserves x positions and fills the height.

### H5 — confirmed

Existing tests do not assert shared bottom boundaries. Scroll, resize, overflow, and mobile tests can pass while center/right stop at row 1. Add browser-observable bottom-edge geometry tests.

## Current code findings

- `src/routes/+page.svelte:730-738`: fixed `100dvh` shell with `grid-template-rows: 1fr auto` and hidden overflow.
- `src/routes/+page.svelte:665-695, 843-850`: left footer is authored after the main regions and occupies the second row, spanning columns 1/3.
- `src/routes/+page.svelte:538-584, 942-958`: center content has correct internal `auto 1fr`, `min-height: 0`, and overflow ownership but only occupies row 1.
- `src/lib/web/components/right-panel-tabs.svelte`: expanded panel and collapsed strip have correct internal flex/scroll behavior but no outer grid-row placement.
- At 375×667, mobile computed rows are `667px 0px`; visual bottom containment is correct, but the existing comments/tests describe a single `1fr` row and should be checked independently.
- Git context, Project tree, Observations, diff viewer, and right-panel internals do not explain the outer gap.

## Correct bottom contract

- Desktop center work area and right panel/strip: bottom equals viewport bottom and x positions remain unchanged.
- Desktop left contextual content remains in row 1; the left region reaches the bottom through the row-2 footer.
- Left footer remains bottom-most and retains expanded full-left-region width/collapsed rail width.
- Right panel footer/reopen/collapse behavior remains intact.
- Reset Layout remains in the central shell without becoming a height-defining row.
- Mobile shell, drawer/sheet, rail, toggle, and document overflow remain unchanged.

## Test gaps and recommendations

- Add desktop E2E geometry at 1280×720 and 1440×800: center/right bottom equals viewport height within 1–2px, x boundaries unchanged, no document overflow.
- Test desktop with the right panel collapsed: 48px strip still reaches the bottom.
- Assert left footer bottom and expanded/collapsed widths remain correct.
- Add mobile checks at 320×568, 375×667, and 768×800: shell/center/rail/toggle bottom containment, sheet bottom anchoring, no page scroll.
- Replace weak/static grid markers with independent desktop row-span and mobile single-row assertions; avoid substring checks that accept `1fr auto` as a mobile `1fr` contract.

## Risks and gaps

- Applying row span without explicit columns will reorder center/right regions.
- Mobile row changes must be validated at several widths.
- `100dvh` and browser viewport rounding require a small geometry tolerance.
- The working tree contains extensive prior changes and untracked NAS artifacts; only the approved shell/test/docs scope may change.
- Exact screenshot pixel comparison is unavailable because the supplied media was removed after exceeding the provider size limit.

## Source exhaustion matrix

| Source                                    | Status | Use                                                               |
| ----------------------------------------- | ------ | ----------------------------------------------------------------- |
| `AGENTS.md`, `.agents/nas.config.yaml`    | Used   | Repository constraints, skills, QA/Gherkin policy                 |
| Canonical `docs/*`                        | Used   | Shell, design, responsive, and architecture contracts             |
| Archived 0001–0003 state                  | Used   | Previous panel/footer/grid decisions and regressions              |
| Current shell/panel/CSS/components        | Used   | Exact grid placement, flex, overflow, and footer evidence         |
| Current unit/BDD/E2E tests                | Used   | Missing bottom-boundary assertions and mobile protections         |
| Mind project memories                     | Used   | SvelteKit body wrapper, grid, panel, resize, and mobile decisions |
| Live runtime at `http://127.0.0.1:56823/` | Used   | Desktop/mobile bounding-box measurements and CSS experiments      |
| Context7 Svelte docs                      | Used   | Scoped styles and parent/child grid targeting context             |
| MDN CSS Grid docs                         | Used   | Explicit row/column placement and auto-placement behavior         |
| Web search                                | Used   | Supplementary Grid row-span confirmation                          |

## Skills applied/skipped

Applied: `mind-management`, `clean-svelte-architecture`, `clean-code`, `frontend-design`, and `svelte-code-writer`.

Skipped as not applicable to this read-only CSS/layout audit: backend architecture, implementation/TDD, validation, feedback, OpenSpec, and spec-creation skills.

## Recommendation

CONTINUE to planning. The minimal correction is a web-shell grid placement change plus browser-observable desktop/mobile geometry tests and a small design-document update. No backend, API, domain, persistence, or dependency work is indicated.
