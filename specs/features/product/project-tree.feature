@product @project @navigation @etapa-1
Feature: Project tree — read-only repository tree with change indicators and source navigation

  The Project tab displays the full repository file tree with expandable
  directories. Each file entry shows its change status relative to the active
  Comparison (modified, added, deleted, untracked, or unchanged). Opening a
  modified file navigates to the source view with syntax highlighting and
  changed-line markers. Opening an unchanged file shows the source without
  markers. Path traversal attempts are rejected. No interaction — browsing,
  expanding, collapsing, or opening a file — ever mutates the repository or
  the file system.

  Background:
    Given DiffScribe is started
    And a workspace is registered and active
    And the active Comparison is HEAD vs working tree
    And the working tree has changed files

  # ────── Default rendering ──────

  @product @project @p1 @ui @e2e
  Scenario: Project tab displays the full repository file tree
    Given the workspace repository has files at the root and in nested directories
    When the user opens the Project tab
    Then the tree shows all files and directories from the repository root
    And every entry is displayed as read-only

  @product @project @p1 @ui @e2e
  Scenario: Nested directories are expandable and collapsible
    Given the repository has a directory "src/components/" containing "Button.tsx" and "Input.tsx"
    When the user opens the Project tab
    And the user expands "src/"
    Then "components/" is visible under "src/"
    When the user expands "components/"
    Then "Button.tsx" and "Input.tsx" are visible under "components/"
    When the user collapses "src/"
    Then "components/" and its children are hidden

  # ────── Change indicators ──────

  @product @project @p1 @ui @e2e
  Scenario: Changed files display a change status indicator
    Given the active Comparison includes a modified file "src/app.ts"
    And the active Comparison includes an added file "src/new.ts"
    And the active Comparison includes a deleted file "src/removed.ts"
    And the active Comparison includes an untracked file "src/scratch.ts"
    When the user opens the Project tab
    Then "src/app.ts" shows a modified indicator
    And "src/new.ts" shows an added indicator
    And "src/removed.ts" shows a deleted indicator
    And "src/scratch.ts" shows an untracked indicator

  @product @project @p1 @ui @e2e
  Scenario: Unchanged files have no change status indicator
    Given the active Comparison does not include "src/utils.ts"
    When the user opens the Project tab
    Then "src/utils.ts" is visible without any change indicator

  # ────── Source navigation ──────

  @product @project @p1 @ui @e2e
  Scenario: Opening a modified file from the Project tree shows source with changed-line markers
    Given the active Comparison includes a modified file "src/app.ts" with 3 added and 2 deleted lines
    When the user clicks "src/app.ts" in the Project tree
    Then the source view is displayed for "src/app.ts"
    And changed lines are marked with indicators matching their change type
    And unchanged lines have no marker
    And the source is syntax-highlighted

  @product @project @p1 @ui @e2e
  Scenario: Opening an unchanged file shows source without change markers
    Given the active Comparison has no changes to "src/utils.ts"
    When the user clicks "src/utils.ts" in the Project tree
    Then the source view is displayed for "src/utils.ts"
    And no change markers appear on any line

  @product @project @p1 @ui @e2e
  Scenario: Source view opened from the Project tree is read-only
    Given the source view is displayed for "src/app.ts"
    When the user attempts to modify any text in the source view
    Then the source content cannot be edited
    And no edit controls are available

  # ────── Security and edge cases ──────

  @product @project @p1 @api @bdd @e2e
  Scenario: Path traversal outside the repository root is rejected
    Given the workspace repository root is "/home/user/repo"
    When the user requests the file "../../etc/passwd"
    Then the request is rejected with a security error
    And no file content is displayed

  @product @project @p1 @p2 @ui @e2e
  Scenario: Empty repository shows an empty tree placeholder
    Given the workspace repository has zero files and directories
    When the user opens the Project tab
    Then the tree shows an empty state indicating the repository is empty

  @product @project @p1 @p2 @api @bdd @e2e
  Scenario: Large directory with many files loads progressively or with pagination
    Given the repository has a directory with more than 500 files
    When the user opens the Project tab
    Then the tree loads without blocking the UI
    And the directory content is readable

  @product @project @p1 @api @bdd @e2e
  Scenario: No Project interaction mutates the repository
    Given the Project tree is visible
    When the user expands and collapses directories
    And the user clicks on a file entry
    Then the repository index is unchanged
    And no git add, checkout, commit, or branch operation has been executed
