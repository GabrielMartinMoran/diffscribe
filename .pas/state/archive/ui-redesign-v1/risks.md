# Active risks

| ID  | Severity | Risk                                                                                 | Mitigation                                                                                           |
| --- | -------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| R1  | high     | Project tree/source view expands scope beyond visual styling.                        | Keep read-only, bounded to current workspace/comparison, with explicit endpoints and tests.          |
| R2  | high     | Synthwave semantic colors may fail contrast.                                         | Verify computed contrast for text, focus, diff states, and badges in both themes.                    |
| R3  | high     | Existing undeclared tokens override the new visual contract.                         | Close token drift before final visual QA.                                                            |
| R4  | medium   | Source content and changed-line markers can diverge for deleted/untracked files.     | Define explicit empty/error states and test each file status.                                        |
| R5  | medium   | Mobile panel interactions could hide the diff.                                       | Use modal/drawer ownership, focus return, Escape, and viewport tests.                                |
| R6  | medium   | Local theme preference does not synchronize across devices.                          | Document as intentional out-of-scope behavior.                                                       |
| R7  | process  | PAS artifacts were previously absent.                                                | Validate the new config and exactly one active feature before delegation.                            |
| R8  | high     | New UI Gherkin scenarios still lack step definitions, so the global BDD gate is red. | Implement BDD-STEPS-UI-01 after the UI behavior is complete; do not claim final QA before it passes. |
| R9  | high     | Legacy E2E tests still assume pre-redesign panels are always mounted. | Adapt test helpers/specs to select Workspaces or Git rail tabs explicitly, then rerun the full E2E suite. |
| R10 | medium   | Generated PAS/session artifacts make the repository-wide Prettier gate fail. | Add explicit ignore patterns for generated `.pas/` state and root session exports, then rerun BDD quality-gate scenarios. |
