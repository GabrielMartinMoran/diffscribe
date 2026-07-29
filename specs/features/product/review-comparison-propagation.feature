@product @review @etapa-1 @comparison @propagation
Feature: Comparison propagation — unified comparison state between file list, diff viewer, and reviews

  The file list panel and diff viewer must reflect the same Comparison at all
  times. Changing the base or target reference updates both panels atomically so
  the file list and diff never diverge. Creating a review captures the current
  active Comparison, ensuring the review file list is consistent with what the
  user saw in the diff viewer.

  Background:
    Given DiffScribe is started
    And a workspace is registered and active
    And the active Comparison is HEAD vs working tree
    And the working tree has changed files

  # ────── Default consistency ──────

  @p1 @api @bdd @e2e
  Scenario: File list and diff viewer share the same default comparison
    Given the active Comparison is HEAD vs working tree
    When the user views the file list panel and the diff viewer
    Then both panels reflect the same base reference
    And both panels reflect the same target reference

  # ────── Unified update ──────

  @p1 @api @bdd @e2e
  Scenario: Changing base or target updates both panels
    Given the user changes the base reference to "main"
    And the user changes the target reference to the working tree
    When the user views the file list panel and the diff viewer
    Then the file list panel shows files changed between "main" and the working tree
    And the diff viewer shows diffs between "main" and the working tree

  # ────── Review capture ──────

  @p1 @api @bdd @e2e
  Scenario: Creating a review captures the current active comparison draft
    Given the user has changed the base reference to "feature-branch"
    And the user has changed the target reference to the working tree
    And the file list panel shows files changed between "feature-branch" and the working tree
    When the user creates a review draft
    Then the review captures the Comparison with base "feature-branch" and target "working tree"
    And the review file list matches the files shown in the file list panel
