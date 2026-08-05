@product @observation @etapa-1 @status
Feature: Observation status — state transitions between open, resolved, dismissed, and pending

  Observations track their resolution state independently. An open observation
  can be resolved, dismissed, or marked as pending. Any non-open observation
  can be reopened back to open. These transitions are explicit user actions.

  Background:
    Given DiffScribe is started
    And a workspace is registered and active
    And the active Comparison is HEAD vs working tree
    And an active review draft exists for the workspace

  # ────── Forward transitions from open ──────

  @p1 @api @bdd @e2e
  Scenario: Resolve an open observation
    Given an observation with status "open" exists on the active review
    When the user marks the observation as resolved
    Then the observation status is "resolved"
    And the observation updatedAt timestamp is refreshed

  @p1 @api @bdd @e2e
  Scenario: Dismiss an open observation
    Given an observation with status "open" exists on the active review
    When the user dismisses the observation
    Then the observation status is "dismissed"
    And the observation updatedAt timestamp is refreshed

  @p2 @api @bdd
  Scenario: Mark an open observation as pending
    Given an observation with status "open" exists on the active review
    When the user marks the observation as pending
    Then the observation status is "pending"
    And the observation updatedAt timestamp is refreshed

  # ────── Reopen transitions ──────

  @p2 @api @bdd
  Scenario: Reopen a resolved observation
    Given an observation with status "resolved" exists on the active review
    When the user reopens the observation
    Then the observation status is "open"

  @p2 @api @bdd
  Scenario: Reopen a dismissed observation
    Given an observation with status "dismissed" exists on the active review
    When the user reopens the observation
    Then the observation status is "open"

  # ────── Seeded card rendering (0003 refinements) ──────

  @product @observation @e2e @delta-added
  Scenario: Seeded observation cards render with badges, status, and actions
    Given the active review has observations of types "issue", "risk", and "suggestion"
    When the user opens the Comments panel
    Then each observation card shows its type badge and severity badge
    And each card shows a status dot and body text
    When the user hovers a card
    Then the card actions appear

  @product @observation @e2e @delta-added
  Scenario: Observation cards render correctly in dark and synthwave themes
    Given the active review has observations
    When the user selects the Synthwave theme
    Then the observation cards remain readable with contrast on their badges
