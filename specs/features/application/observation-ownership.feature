@application @observation @etapa-1 @ownership
Feature: Observation ownership — workspace-scoped isolation, completed-review guards, and cascade deletion

  Observations belong to reviews, and reviews belong to workspaces. Observations
  from one workspace are never visible through another workspace. A completed
  review is read-only: creating, updating, deleting, or changing the status of
  observations on a completed review is rejected with 409. Deleting a workspace
  cascades to its observations while leaving other workspaces unaffected.

  Background:
    Given DiffScribe is started
    And workspace "Alpha" is registered with path "/tmp/diffscribe-fixture/alpha"
    And workspace "Beta" is registered with path "/tmp/diffscribe-fixture/beta"
    And an active review draft exists for workspace "Alpha"
    And an active review draft exists for workspace "Beta"

  # ────── Scope isolation ──────

  @p1 @api @bdd @e2e
  Scenario: Observation list is scoped to the active workspace
    Given an observation with body "Alpha observation" exists on the active review for workspace "Alpha"
    And an observation with body "Beta observation" exists on the active review for workspace "Beta"
    When the user queries the observation list for workspace "Alpha"
    Then the list contains "Alpha observation"
    And the list does not contain "Beta observation"

  # ────── Completed review guards ──────

  @p1 @api @bdd
  Scenario: Reject creating an observation on a completed review
    Given a completed review exists for workspace "Alpha"
    When the user attempts to create an observation on the completed review
    Then the operation is rejected with status 409
    And the error indicates the review is completed and read-only

  @p2 @api @bdd
  Scenario: Reject updating an observation on a completed review
    Given a completed review exists for workspace "Alpha"
    And an observation exists on the completed review
    When the user attempts to edit the observation body
    Then the operation is rejected with status 409
    And the error indicates the review is completed and read-only

  @p2 @api @bdd
  Scenario: Reject deleting an observation on a completed review
    Given a completed review exists for workspace "Alpha"
    And an observation exists on the completed review
    When the user attempts to delete the observation
    Then the operation is rejected with status 409
    And the error indicates the review is completed and read-only

  @p2 @api @bdd
  Scenario: Reject changing observation status on a completed review
    Given a completed review exists for workspace "Alpha"
    And an observation with status "open" exists on the completed review
    When the user attempts to mark the observation as resolved
    Then the operation is rejected with status 409
    And the error indicates the review is completed and read-only

  # ────── Cascade deletion ──────

  @p1 @api @bdd @e2e
  Scenario: Deleting a workspace cascades to its observations while the other workspace is unaffected
    Given workspace "Alpha" has 2 observations across its reviews
    And workspace "Beta" has 1 observation across its reviews
    When the user deletes workspace "Alpha"
    Then all observations belonging to workspace "Alpha" are deleted
    And the observation belonging to workspace "Beta" is unaffected
