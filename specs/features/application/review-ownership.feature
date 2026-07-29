@application @review @etapa-1 @ownership
Feature: Review ownership — workspace-scoped isolation and cascade deletion

  Each workspace owns its reviews independently. Reviews from one workspace are
  never visible through another workspace. Deleting a workspace deletes all its
  reviews and clears the namespaced active review reference.

  Background:
    Given DiffScribe is started
    And workspace "Alpha" is registered with path "/tmp/diffscribe-fixture/alpha"
    And workspace "Beta" is registered with path "/tmp/diffscribe-fixture/beta"

  # ────── Scope isolation ──────

  @p1 @api @bdd @e2e
  Scenario: Review list is scoped to the active workspace
    Given an active review draft exists for workspace "Alpha"
    And a completed review exists for workspace "Beta"
    When the user queries the review list for workspace "Alpha"
    Then the list contains the review for workspace "Alpha"
    And the list does not contain the review for workspace "Beta"

  # ────── Cascade deletion ──────

  @p1 @api @bdd
  Scenario: Deleting a workspace cascades to its reviews
    Given workspace "Alpha" has 2 reviews
    And workspace "Alpha" has an active review
    When the user deletes workspace "Alpha"
    Then all reviews belonging to workspace "Alpha" are deleted
    And the active review key for workspace "Alpha" is cleared
    And workspace "Beta" and its reviews are unaffected
