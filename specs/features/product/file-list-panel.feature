@product @git @comparison @file-list @etapa-1
Feature: File list panel — browsing changed files with filtering, sorting, and selection

  The file list panel shows every file changed by the active Comparison. Each
  entry displays the file path, change status, and a binary indicator when
  applicable. The user can filter by path substring or change status, sort by
  path or status, and paginate through results. Clicking a row selects it as the
  active file; keyboard navigation is also supported. The panel handles empty
  results, adapter errors, and the absence of an active workspace gracefully.
  No interaction with the file list — filtering, sorting, paginating, or
  selecting — ever mutates the repository.

  Background:
    Given DiffScribe is started
    And a workspace is registered and active
    And the active Comparison is HEAD vs working tree
    And the working tree has changed files

  # ────── Default rendering ──────

  @p1 @api @bdd @e2e
  Scenario: Default comparison renders the file list
    Given the active workspace has 5 modified files
    When the user views the file list panel
    Then the panel shows exactly 5 file entries
    And each entry displays the file path

  @p1 @api @bdd @e2e
  Scenario: Each file entry shows its change status
    Given the active Comparison has one file of each status: modified, added, deleted, and renamed
    When the user views the file list panel
    Then the modified file shows the status "modified"
    And the added file shows the status "added"
    And the deleted file shows the status "deleted"
    And the renamed file shows the status "renamed"

  @p1 @api @bdd @e2e
  Scenario: Status badges are semantic, theme-aware, and never color-only
    Given the file list panel shows changed files
    When the user inspects the status badges
    Then every status badge shows visible text
    And every status badge carries a status dot
    And every badge color references a declared theme token

  @p1 @api @bdd @e2e
  Scenario: Untracked files appear when the target is the working tree
    Given the active workspace has 2 untracked files
    And the active Comparison target is the working tree
    When the user views the file list panel
    Then the panel includes 2 files with status "untracked"

  @p1 @api @bdd @e2e
  Scenario: Binary files show a binary indicator
    Given the active Comparison includes a binary file "logo.png"
    And the active Comparison includes a text file "README.md"
    When the user views the file list panel
    Then the entry for "logo.png" shows a binary indicator
    And the entry for "README.md" does not show a binary indicator

  @p2 @api @bdd @e2e
  Scenario: Renamed files display the old and new path
    Given the active Comparison includes a renamed file from "old-name.ts" to "new-name.ts"
    When the user views the file list panel
    Then the entry for "new-name.ts" shows the old path "old-name.ts"
    And the entry shows the status "renamed"

  # ────── Filtering ──────

  @p2 @api @bdd @e2e
  Scenario: Filter files by path substring
    Given the active Comparison includes files "src/auth/login.ts", "src/auth/logout.ts", and "docs/readme.md"
    When the user types "auth" in the file filter input
    Then the panel shows only "src/auth/login.ts" and "src/auth/logout.ts"
    And the file "docs/readme.md" is hidden

  @p2 @api @bdd @e2e
  Scenario: Filter files by change status
    Given the active Comparison has 3 modified files and 2 added files
    When the user selects the status filter "added"
    Then the panel shows only the 2 added files
    And the modified files are hidden

  # ────── Sorting ──────

  @p2 @api @bdd @e2e
  Scenario: Sort files by path
    Given the active Comparison includes files "c.ts", "a.ts", and "b.ts"
    When the user sorts the file list by path ascending
    Then the files appear in order "a.ts", "b.ts", "c.ts"

  @p3 @api @bdd @e2e
  Scenario: Sort files by change status
    Given the active Comparison has files with statuses "modified", "added", and "deleted"
    When the user sorts the file list by status descending
    Then the files are grouped by status

  # ────── Pagination ──────

  @p2 @api @bdd @e2e
  Scenario: Paginate when files exceed the page size
    Given the active Comparison includes 51 files
    And the page size is 25
    When the user views the file list panel
    Then the panel shows 25 file entries
    And pagination controls are visible
    And the controls indicate page 1 of 3

  # ────── Active row selection ──────

  @p1 @ui @e2e
  Scenario: Select a file by clicking the row
    Given the file list panel shows multiple file entries
    And no file is currently active
    When the user clicks the row for "src/main.ts"
    Then the row for "src/main.ts" is visually highlighted as active
    And the other rows are not highlighted

  @p2 @ui @e2e
  Scenario: Select a file using the keyboard
    Given the file list panel is visible and focused
    And the first file row has focus
    When the user presses ArrowDown twice
    And the user presses Enter
    Then the third file row is visually highlighted as active

  # ────── Edge cases ──────

  @p3 @api @bdd @e2e
  Scenario: Empty file list when the working tree is clean
    Given the active workspace has a clean working tree with no changes
    When the user views the file list panel
    Then the panel shows an empty state message indicating no changes

  @p3 @api @bdd @e2e @delta-modified
  Scenario: Error state when the adapter fails
    Given the active workspace is valid
    And the file list adapter returns an error
    When the user views the file list panel
    Then the panel shows a user-facing error message
    And the panel does not expose raw error stack traces
    And the panel shows a Retry action to reload the file list

  @p3 @api @bdd @e2e @delta-modified
  Scenario: Retry action attempts to re-fetch file list after error
    Given the file list panel shows an error state
    When the user clicks the Retry action in the file list panel
    Then the file list panel attempts to reload the file list
    And the Retry button becomes disabled during the attempt
    And the panel transitions to either a success state with file entries or remains in the error state

  @p4 @api @bdd @e2e
  Scenario: No active workspace shows an inactive panel
    Given no workspace is active
    When the user views the file list panel
    Then the panel shows an empty state indicating no active workspace
    And no file entries are displayed

  # ────── Read-only guarantee ──────

  @p1 @api @bdd
  Scenario: No interaction mutates the repository
    Given the file list panel shows changed files
    When the user filters the file list
    And the user sorts the file list
    And the user paginates through the file list
    And the user selects an active file
    Then the repository index is unchanged
    And no git add, checkout, or commit has been executed
    And no new branch has been created

  # ────── Mobile and narrow-panel controls (hardening H1) ──────

  @delta-added @p1 @ui @e2e
  Scenario Outline: File list controls fit and stay interactive at narrow widths
    Given the user views the file list panel at <width> px
    Then the file list controls fit within the panel without horizontal overflow
    And the List and Tree controls are inside the panel
    When the user clicks the Tree control and then the List control
    Then the file list switches between Tree and List views
    And the chosen view persists across reloads

    Examples:
      | width |
      | 320   |
      | 375   |
      | 768   |
      | 1280  |
