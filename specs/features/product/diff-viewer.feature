@product @git @diff-viewer @etapa-1
Feature: Diff viewer — unified and side-by-side diff with syntax highlighting, keyboard navigation, and truncation

  The diff viewer renders the selected file as a unified diff with old and new
  line numbers, colored line prefixes for additions and deletions, hunk headers,
  and syntax highlighting via Shiki. The viewer handles every file change status
  (added, deleted, renamed, untracked, binary, empty) and enforces a hard 256 KB
  and 5000-line cap with a partial-view notice. It shows loading, error, retry,
  and no-selection states. A side-by-side toggle appears at viewports 900 px and
  wider. It supports keyboard-based hunk navigation and a logical tab order.
  Syntax highlighting uses a dual TypeScript Shiki theme for light and dark; files
  with unknown languages fall back to plain text. A manual refresh button
  re-fetches the diff without mutating the repository. No interaction — viewing,
  refreshing, toggling layout, or navigating — ever mutates the repository.

  Background:
    Given DiffScribe is started
    And a workspace is registered and active
    And the active Comparison is HEAD vs working tree
    And the working tree has changed files

  # ────── Core unified diff rendering ──────

  @p1 @ui @e2e
  Scenario: Default unified diff view for a selected file
    Given the active Comparison includes a modified file "src/app.ts" with 3 added and 2 deleted lines
    And the file "src/app.ts" is the active selected file
    When the user views the diff viewer
    Then the diff viewer shows a unified diff for "src/app.ts"
    And the diff includes 3 added lines and 2 deleted lines

  @p1 @ui @e2e
  Scenario: Old and new line numbers for each line
    Given the active Comparison includes a modified file "src/utils.ts"
    And the file "src/utils.ts" is the active selected file
    When the user views the diff viewer
    Then each line in the unified diff displays an old line number and a new line number

  @p1 @ui @e2e
  Scenario: Added lines are prefixed with + and rendered with added color
    Given the active Comparison includes a modified file "src/app.ts" with at least one added line
    And the file "src/app.ts" is the active selected file
    When the user views the diff viewer
    Then every added line is prefixed with "+"
    And every added line is rendered with a color that communicates addition

  @p1 @ui @e2e
  Scenario: Deleted lines are prefixed with - and rendered with deleted color
    Given the active Comparison includes a modified file "src/app.ts" with at least one deleted line
    And the file "src/app.ts" is the active selected file
    When the user views the diff viewer
    Then every deleted line is prefixed with "-"
    And every deleted line is rendered with a color that communicates deletion

  @p1 @ui @e2e
  Scenario: Context lines have no prefix and neutral rendering
    Given the active Comparison includes a modified file "src/app.ts" with context lines around hunks
    And the file "src/app.ts" is the active selected file
    When the user views the diff viewer
    Then context lines are not prefixed with "+" or "-"
    And context lines are rendered in a neutral color distinct from added and deleted colors

  @p1 @ui @e2e
  Scenario: Hunk header shows function or method context
    Given the active Comparison includes a modified file "src/app.ts" where a hunk falls inside a function
    And the file "src/app.ts" is the active selected file
    When the user views the diff viewer
    Then each hunk is preceded by a hunk header
    And the hunk header includes the function name from the diff metadata

  # ────── File change status variants ──────

  @p2 @ui @e2e
  Scenario: Renamed file diff shows old and new path
    Given the active Comparison includes a file renamed from "old-name.ts" to "new-name.ts"
    And the file "new-name.ts" is the active selected file
    When the user views the diff viewer
    Then the diff viewer shows the old path "old-name.ts" and the new path "new-name.ts"
    And the diff content is rendered as a unified diff

  @p2 @ui @e2e
  Scenario: Deleted file shows all lines as deleted
    Given the active Comparison includes a deleted file "src/removed.ts"
    And the file "src/removed.ts" is the active selected file
    When the user views the diff viewer
    Then every line of "src/removed.ts" is prefixed with "-"

  @p2 @ui @e2e
  Scenario: Added file shows all lines as added
    Given the active Comparison includes a newly added file "src/new.ts" with content
    And the file "src/new.ts" is the active selected file
    When the user views the diff viewer
    Then every line of "src/new.ts" is prefixed with "+"

  @p2 @ui @e2e
  Scenario: Untracked file shows all lines as added
    Given the active Comparison target is the working tree
    And the working tree has an untracked file "src/untracked.ts" with content
    And the file "src/untracked.ts" is the active selected file
    When the user views the diff viewer
    Then every line of "src/untracked.ts" is prefixed with "+"

  @p2 @ui @e2e
  Scenario: Binary file shows a notification instead of a diff
    Given the active Comparison includes a binary file "assets/logo.png"
    And the file "assets/logo.png" is the active selected file
    When the user views the diff viewer
    Then the diff viewer shows a message indicating the file is binary
    And no line content or line numbers are displayed

  @p3 @ui @e2e
  Scenario: Empty file shows no content with an appropriate message
    Given the active Comparison includes an empty file "src/empty.ts"
    And the file "src/empty.ts" is the active selected file
    When the user views the diff viewer
    Then the diff viewer indicates the file is empty
    And no line content is displayed

  # ────── Content limits ──────

  @p2 @ui @e2e
  Scenario: Diff truncated at 256 KB or 5000 lines shows a partial-content notice
    Given the active Comparison includes a modified file "src/large.ts" with 6000 lines
    And the file "src/large.ts" is the active selected file
    When the user views the diff viewer
    Then only the first 5000 lines of the diff are displayed
    And the diff viewer shows a notice that the content is truncated

  # ────── Loading, error, and empty states ──────

  @p1 @ui @e2e
  Scenario: Loading state while the diff is being fetched
    Given the active Comparison includes a modified file "src/app.ts"
    And the file "src/app.ts" has been selected
    And the diff data has not yet been returned
    When the user views the diff viewer
    Then the diff viewer shows a loading indicator
    And no partial or stale diff content is displayed

  @p1 @ui @e2e
  Scenario: Error state when diff fetch fails
    Given the active Comparison includes a modified file "src/app.ts"
    And the file "src/app.ts" is the active selected file
    And the diff adapter returns a typed error
    When the user views the diff viewer
    Then the diff viewer shows a user-facing error message
    And the error message does not expose raw stack traces

  @p2 @ui @e2e
  Scenario: Retry button recovers from an error state
    Given the diff viewer is showing an error state for "src/app.ts"
    When the user clicks the retry button
    Then the diff viewer re-fetches the diff for "src/app.ts"
    And the diff content is displayed on success

  @p1 @ui @e2e
  Scenario: No file selected shows a placeholder state
    Given the file list panel is visible
    And no file is selected
    When the user views the diff viewer
    Then the diff viewer shows a message indicating no file is selected
    And no diff, line numbers, or hunk headers are displayed

  # ────── Responsive layout ──────

  @p2 @ui @e2e
  Scenario Outline: Side-by-side toggle visibility depends on viewport width
    Given the active Comparison includes a modified file "src/app.ts"
    And the file "src/app.ts" is the active selected file
    And the viewport width is <width> px
    When the user views the diff viewer
    Then the side-by-side toggle control is <visibility>

    Examples:
      | width | visibility |
      | 1920  | visible    |
      | 900   | visible    |
      | 899   | hidden     |
      | 375   | hidden     |

  # ────── Keyboard interaction ──────

  @p1 @ui @e2e
  Scenario: Ctrl+Shift+D keyboard shortcut opens the diff viewer
    Given the file list panel is visible and focused
    And the active Comparison includes a modified file "src/app.ts"
    And a file is selected in the file list
    When the user presses Ctrl+Shift+D
    Then the diff viewer becomes visible and shows the diff for the selected file

  @p2 @ui @e2e
  Scenario Outline: Keyboard hunk navigation moves focus between hunks
    Given the diff viewer shows a unified diff with 3 hunks
    And the diff viewer is focused
    And focus is on the <initial> hunk
    When the user presses the key to go to the <direction> hunk
    Then focus moves to the <target> hunk

    Examples:
      | initial | direction | target |
      | first   | next      | second |
      | second  | previous  | first  |

  @p3 @ui @e2e
  Scenario: Tab order within the diff viewer follows a logical sequence
    Given the diff viewer is visible and contains diff content
    And the diff viewer includes interactive controls
    When the user presses Tab repeatedly
    Then focus moves through controls in a logical left-to-right, top-to-bottom order
    And focus does not escape the diff viewer before reaching its last focusable element
    And pressing Tab from the last element wraps to the first element

  # ────── Syntax highlighting ──────

  @p2 @ui @bdd
  Scenario: TypeScript files receive Shiki syntax highlighting with dual theme
    Given the active Comparison includes a modified file "src/app.ts"
    And the file "src/app.ts" is the active selected file
    When the user views the diff viewer
    Then the diff content for "src/app.ts" is syntax-highlighted
    And the highlighting is applied by Shiki using a light or dark theme matching the application theme

  @p3 @ui @e2e
  Scenario: Files with unknown language fall back to plain text
    Given the active Comparison includes a modified file "data/unknown.xyz"
    And the language of "data/unknown.xyz" cannot be determined
    And the file "data/unknown.xyz" is the active selected file
    When the user views the diff viewer
    Then the diff content is displayed as plain text
    And no syntax highlighting is applied

  # ────── Read-only guarantee ──────

  @p2 @ui @e2e
  Scenario: Manual refresh re-fetches the diff without mutating the repository
    Given the active Comparison includes a modified file "src/app.ts"
    And the file "src/app.ts" is the active selected file
    And the diff viewer shows the diff for "src/app.ts"
    When the user clicks the manual refresh button
    Then the diff viewer re-fetches the diff for "src/app.ts"
    And the repository index is unchanged
    And no git add, checkout, or commit has been executed

  # ────── Line-number gutter geometry ──────

  @p2 @ui @e2e
  Scenario: Unified diff line-number cells are 48 px wide including padding
    Given the active Comparison includes a modified file "src/app.ts"
    And the file "src/app.ts" is the active selected file
    When the user views the diff viewer
    Then each line-number cell in the unified diff is 48 px wide including its internal padding
    And the old and new line-number cells together span exactly 96 px

  @p2 @ui @e2e
  Scenario: Line numbers with up to five digits stay inside their cell
    Given the active Comparison includes a modified file "src/app.ts"
    And the file "src/app.ts" is the active selected file
    When the user views the diff viewer
    Then every rendered line number stays inside its 48 px line-number cell
