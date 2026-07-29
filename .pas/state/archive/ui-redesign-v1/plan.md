# DiffScribe UI redesign v1

## Status

Approved by the user on 2026-07-29. This plan is single-use; scope expansion
requires a new approval.

## Goal

Turn the DiffScribe review screen into a compact, dark, responsive engineering
workbench without enabling editing, auto-fix, remote Git, AI, collaboration, or
repository mutation.

## Approved behavior

- `Dark Deep` is the default theme.
- `Synthwave '84'` is an alternative global browser-local theme.
- The Synthwave palette source is
  https://www.color-hex.com/color-palette/114197:
  `#920075`, `#2e2157`, `#2de2e6`, `#540d6e`, `#0d0221`.
- The left side has a compact icon rail and a contextual panel.
- `Project` shows a read-only full repository tree. Opening a file shows its
  normal source with syntax highlighting and Git-changed line markers.
- `Git` shows the existing comparison and opens the existing diff viewer.
- The right side has `Comments` and `Review` tabs.
- Panels can collapse and resize within explicit min/max bounds.
- Desktop and mobile are supported from the first implementation.
- Lucide provides the icon set.

## Out of scope

Code editing, auto-fix, commit/branch mutation, remote Git providers, AI,
collaboration, cross-device theme synchronization, and full-text repository
indexing.

## Contracts

- `ThemeKey`: `dark | synthwave-84`; local preference key is client-only.
- `WorkspaceTreeNode`: read-only hierarchical repository entry with path,
  kind, children, and change metadata where available.
- `FileSource`: source lines plus `changeType`/line marker metadata for the
  selected comparison.
- `GET /api/workspaces/[id]/tree` lists the project tree.
- `GET /api/workspaces/[id]/source` returns source content and change markers.
- Rail tabs, right-panel tabs, resize handles, and empty states expose stable
  accessible labels and keyboard behavior.

## Ordered tasks

1. Update canonical design, product, domain, and architecture contracts.
2. Add English Gherkin acceptance scenarios and step contracts.
3. Implement theme tokens, theme resolver, and local preference.
4. Implement project-tree domain/application/infrastructure endpoint.
5. Implement source-view domain/application/infrastructure endpoint.
6. Implement rail, tabs, active-file state, Project tree, and source viewer.
7. Integrate Git tab, existing diff viewer, Comments and Review tabs.
8. Implement panel collapse/resize and desktop/mobile breakpoints.
9. Correct Shiki token application and remove undeclared-token fallbacks.
10. Run the full QA chain and visual checks at desktop and mobile sizes.

## QA gate

Run, without autofix in QA:

```text
npm run format
npm run lint
npm run check
npm run test:unit
npm run test:integration
npm run check:bdd-language
npm run test:bdd
npm run test:e2e
npm run build
```

The QA worker must return exactly one objective verdict: `PASS`, `FAIL`, or
`BLOCKED`, with raw command evidence and scenario coverage.
