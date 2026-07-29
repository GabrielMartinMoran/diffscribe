@product @review @etapa-1 @lifecycle @state-machine
Feature: Review lifecycle — draft creation, completion, and state transitions

  A review is a persistent analysis session on a Git comparison. Each workspace
  has at most one active review at a time. The review transitions through draft,
  in_progress, completed, and archived states. Completed reviews are read-only.
  A review draft captures the active Comparison at creation time and becomes the
  active review for the workspace. Completing a review clears the active
  reference but keeps the review in the list.

  Background:
    Given DiffScribe is started
    And a workspace is registered and active
    And the active Comparison is HEAD vs working tree
    And the workspace has 3 changed files

  # ────── Draft creation ──────

  @p1 @api @bdd @e2e
  Scenario: Create a review draft from the active comparison
    When the user creates a review draft
    Then the review has status "draft"
    And the review captures the active Comparison
    And the review becomes the active review for the workspace
    And the review appears in the review list

  # ────── Completion ──────

  @p1 @api @bdd @e2e
  Scenario: Complete a review draft
    Given an active review draft exists for the workspace
    And 2 files have been marked as reviewed
    When the user completes the review
    Then the review status is "completed"
    And the review has a completedAt timestamp
    And the workspace has no active review
    And the review remains in the review list

  @p2 @api @bdd
  Scenario: Complete a review with zero marked files
    Given an active review draft exists for the workspace
    And no files have been marked as reviewed
    When the user completes the review
    Then the review status is "completed"
    And the review has a completedAt timestamp

  # ────── Post-completion guard ──────

  @p1 @api @bdd
  Scenario: Reject marking a file on a completed review
    Given a completed review exists for the workspace
    When the user attempts to mark a file as reviewed on the completed review
    Then the operation is rejected with status 409
    And the review status remains "completed"
    And the reviewed files set is unchanged

  # ────── Reopen ──────

  @p2 @api @bdd
  Scenario: Reopen a completed review as the active review
    Given a completed review exists for the workspace
    And the workspace has no active review
    When the user reopens the completed review
    Then the review becomes the active review for the workspace
    And the review status remains "completed"
    And the reviewed files remain read-only

  # ────── Accessibility ──────

  @p2 @ui @a11y @delta-added
  Scenario: Active review option has aria-selected in the review list
    Given a review list is visible with 3 reviews
    And a review is reactivated as the active review
    When the user reopens the review list
    Then the reactivated review option has aria-selected "true"
    And every other review option has aria-selected "false"
