@application @git @diff-viewer @adapter
Feature: File diff adapter — typed DTOs for unified diffs with hunk headers, markers, caps, and typed errors

  The file diff adapter translates raw simple-git diff output into typed
  FileDiffResult DTOs. Each DTO carries the file path, a list of hunks with
  header metadata, individual lines with old/new numbers and change type, and a
  truncated flag when content exceeds the 256 KB or 5000-line cap. The adapter
  returns a FileDiffError with a userFacingMessage and errorCode on any failure.
  No raw simple-git data structure, stack trace, or exception leaks past the
  adapter boundary. The adapter never runs git add, git checkout, git commit, or
  any mutating operation.

  # ────── Standard hunk parsing ──────

  @p1 @api @bdd
  Scenario: Parse a single-hunk unified diff into typed lines
    Given the active Comparison has a modified file "src/app.ts" with a diff containing one hunk
    When the adapter fetches the diff for "src/app.ts"
    Then the FileDiffResult has one hunk
    And the hunk has a header with line range metadata
    And each line in the hunk has an old line number, a new line number, and a change type

  @p1 @api @bdd
  Scenario: Parse a multi-hunk unified diff into separate hunks
    Given the active Comparison has a modified file "src/app.ts" with a diff containing 3 hunks
    When the adapter fetches the diff for "src/app.ts"
    Then the FileDiffResult has 3 hunks
    And each hunk has a distinct header
    And every hunk contains its own set of lines with line numbers and change types

  @p2 @api @bdd
  Scenario: File ending without a newline carries a no-newline marker in the DTO
    Given the active Comparison has a modified file "src/app.ts"
    And the last hunk in the diff contains a "\ No newline at end of file" marker
    When the adapter fetches the diff for "src/app.ts"
    Then the DTO for that hunk includes a noNewlineAtEnd flag set to true
    And the flag is present only for the hunk that contains the marker

  # ────── File change status variants ──────

  @p1 @api @bdd
  Scenario: Added file produces a DTO where every line has change type "added"
    Given the active Comparison has a newly added file "src/new.ts" with 5 lines
    When the adapter fetches the diff for "src/new.ts"
    Then the FileDiffResult has at least one hunk
    And every line across all hunks has change type "added"

  @p1 @api @bdd
  Scenario: Deleted file produces a DTO where every line has change type "deleted"
    Given the active Comparison has a deleted file "src/removed.ts" with 3 lines
    When the adapter fetches the diff for "src/removed.ts"
    Then the FileDiffResult has at least one hunk
    And every line across all hunks has change type "deleted"

  @p2 @api @bdd
  Scenario: Binary file produces a DTO with the binary flag and no hunks
    Given the active Comparison includes a binary file "assets/logo.png"
    When the adapter fetches the diff for "assets/logo.png"
    Then the FileDiffResult has the binary flag set to true
    And the FileDiffResult has zero hunks
    And the FileDiffResult has the truncated flag set to false

  # ────── Typed error handling ──────

  @p2 @api @bdd
  Scenario: Filesystem traversal error returns a typed error, not a thrown exception
    Given the active Comparison has a file "src/missing.ts" that cannot be read
    When the adapter attempts to fetch the diff for "src/missing.ts"
    Then the adapter returns a FileDiffError result
    And the FileDiffError has a non-empty userFacingMessage
    And the FileDiffError has an errorCode
    And no raw exception or stack trace is included in the result

  @p2 @api @bdd
  Scenario: Git command failure returns a typed error with user-facing message
    Given the adapter catches a GitError from simple-git during diff fetch
    When the adapter handles the error
    Then the adapter returns a FileDiffError result
    And the FileDiffError has a userFacingMessage
    And the FileDiffError has an errorCode
    And the FileDiffError does not expose the raw simple-git error stack trace

  # ────── Content limits ──────

  @p2 @api @bdd
  Scenario: Diff content exceeding 256 KB is capped and marked truncated
    Given the active Comparison has a modified file "src/large.ts" whose diff output exceeds 256 KB
    When the adapter fetches the diff for "src/large.ts"
    Then the FileDiffResult has the truncated flag set to true
    And the total content across all hunks does not exceed 256 KB

  @p2 @api @bdd
  Scenario: Diff content exceeding 5000 lines is capped and marked truncated
    Given the active Comparison has a modified file "src/large.ts" with 6000 changed lines
    When the adapter fetches the diff for "src/large.ts"
    Then the FileDiffResult has the truncated flag set to true
    And the total number of lines across all hunks does not exceed 5000
