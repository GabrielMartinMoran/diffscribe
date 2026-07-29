@product @review @etapa-1 @progress @file-marking
Feature: Review progress — tracking reviewed files within an active review

  The user marks individual files as reviewed during an active review session.
  Progress is expressed as a fraction of marked files over the current file list
  total. Marking a file records a timestamp. Unmarking removes it and
  recalculates progress. Only files present in the current file list
  intersection contribute to progress; a mark on a file that is no longer in the
  file list does not count. Progress and file-marking actions are hidden when no
  review is active.

  Background:
    Given DiffScribe is started
    And a workspace is registered and active
    And the active Comparison has 3 changed files: "a.ts", "b.ts", "c.ts"
    And an active review draft exists for the workspace

  # ────── Mark and unmark ──────

  @p1 @api @bdd @e2e
  Scenario: Marking a file records a timestamp and updates progress
    When the user marks "a.ts" as reviewed
    Then the reviewed file "a.ts" has a reviewedAt timestamp
    And the review progress is 1/3

  @p1 @api @bdd @e2e
  Scenario: Unmarking a file resets progress to zero
    Given the file "a.ts" has been marked as reviewed
    When the user unmarks "a.ts"
    Then "a.ts" is no longer in the reviewed files
    And the review progress is 0/3

  # ────── Dynamic file list intersection ──────

  @p2 @api @bdd
  Scenario: Progress reflects the current file list intersection
    Given the file "a.ts" has been marked as reviewed
    And the active Comparison now has 2 changed files: "a.ts" and "c.ts"
    When the user queries the review progress
    Then the review progress is 1/2
    And "b.ts" does not count toward progress because it is no longer in the file list

  # ────── No active review ──────

  @p2 @api @bdd
  Scenario: No active review hides progress and prevents file marking
    Given the workspace has no active review
    When the user queries review state
    Then no progress is displayed
    And no file can be marked or unmarked

  # ────── Mark toggle regression ──────

  @p1 @ui @regression @delta-added
  Scenario: Mark button changes to Unmark after marking a file and updates progress
    Given the file "a.ts" is not marked as reviewed
    When the user selects "a.ts" in the file list
    Then the review panel shows a "Mark as Reviewed" button
    When the user marks "a.ts" as reviewed
    Then the review progress is 1/3
    And the review panel shows an "Unmark" button
    When the user unmarks "a.ts"
    Then the review progress is 0/3
    And the review panel shows a "Mark as Reviewed" button
