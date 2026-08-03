@product @observation @etapa-1 @crud
Feature: Observation CRUD — create, edit, and delete observations with body, type and severity validation

  An observation is a conclusion registered by the reviewer. It can be linked to
  a line range, a file, or the review as a whole. Each observation captures a
  diff snapshot and a SHA-256 hash at creation time to support later staleness
  detection. The observation body is the single mandatory description field
  (1 to 5000 characters); there is no title. Type and severity rules are
  enforced: Issue and Risk require severity; Praise must accept null severity.

  Background:
    Given DiffScribe is started
    And a workspace is registered and active
    And the active Comparison is HEAD vs working tree
    And an active review draft exists for the workspace
    And the active Comparison includes a modified file "src/app.ts" with 5 added and 3 deleted lines

  # ────── Range observation ──────

  @p1 @api @bdd @e2e
  Scenario: Create an observation linked to a line range
    Given the user selects lines 10 through 15 in "src/app.ts" on the new side
    When the user creates an observation with type "issue", severity "major", and body "Missing validation"
    Then the observation is created with status "open"
    And the observation preserves the selected line range (start 10, end 15)
    And the observation stores a diff snapshot containing the selected fragment
    And the snapshot preserves the "+", "-", and " " line prefixes from the unified diff
    And the observation stores a SHA-256 hash computed from path, side, start line, and normalized content

  # ────── File-level observation ──────

  @p1 @api @bdd @e2e
  Scenario: Create a file-level observation without a line range
    Given the file "src/app.ts" is the active selected file
    And no line range is selected
    When the user creates an observation with type "note" and body "File-level comment"
    Then the observation is created with no line range
    And the observation stores a full-file diff snapshot for "src/app.ts"
    And the observation stores a SHA-256 hash computed from the full-file content

  # ────── Review-level observation ──────

  @p1 @api @bdd @e2e
  Scenario: Create a review-level observation with no file or line range
    Given no file is selected
    When the user creates an observation with type "question" and body "Are we targeting the right branch?"
    Then the observation is created with no file path
    And the observation has no line range
    And the observation stores no diff snapshot
    And the observation stores no SHA-256 hash
    And the observation captures the current Comparison as its creation comparison

  # ────── Edit and delete ──────

  @p1 @api @bdd @e2e
  Scenario: Edit an existing observation
    Given an observation with body "Missing validation" exists on the active review
    When the user edits the observation body to "Missing input validation on form"
    Then the observation body is updated to "Missing input validation on form"
    And the observation updatedAt timestamp is refreshed
    And other observation fields remain unchanged

  @p2 @api @bdd @e2e
  Scenario: Delete an observation
    Given an observation with body "Obsolete comment" exists on the active review
    When the user deletes the observation
    Then the observation is removed from the review
    And the observation no longer appears in the observation list

  # ────── Body validation ──────

  @p1 @api @bdd
  Scenario: Reject an observation with an empty body
    When the user attempts to create an observation with an empty body
    Then the operation is rejected
    And the error indicates that the body must not be empty

  @p2 @api @bdd
  Scenario: Reject an observation with a body exceeding 5000 characters
    When the user attempts to create an observation with a body of 5001 characters
    Then the operation is rejected
    And the error indicates that the body exceeds the maximum length

  # ────── Severity validation ──────

  @p1 @api @bdd
  Scenario: Reject an issue observation without severity
    When the user attempts to create an observation with type "issue" and no severity
    Then the operation is rejected
    And the error indicates that an issue requires a severity

  @p1 @api @bdd
  Scenario: Reject a risk observation without severity
    When the user attempts to create an observation with type "risk" and no severity
    Then the operation is rejected
    And the error indicates that a risk requires a severity

  @p2 @api @bdd
  Scenario: Accept a praise observation with null severity
    When the user creates an observation with type "praise" and no severity
    Then the observation is created with severity set to null
    And the operation succeeds without error
