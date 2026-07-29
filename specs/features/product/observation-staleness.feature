@product @observation @etapa-1 @staleness
Feature: Observation staleness — detect when an observation references stale content

  An observation stores a diff snapshot and a SHA-256 hash at creation time.
  Staleness is recomputed when the observation panel opens, when the Comparison
  changes, or when the user manually refreshes the diff. No automatic polling
  or background content remapping is performed. A stale observation shows a
  badge with a reason while preserving its original snapshot.

  Background:
    Given DiffScribe is started
    And a workspace is registered and active
    And the active Comparison is HEAD vs working tree
    And an active review draft exists for the workspace
    And the active Comparison includes a modified file "src/app.ts"

  # ────── Current (not stale) ──────

  @p1 @api @bdd @e2e
  Scenario: Observation stays current when content has not changed
    Given an observation exists on line 10 of "src/app.ts" with a stored snapshot and hash
    And the working tree content of "src/app.ts" at the observed location has not changed
    When the observation panel opens
    Then the observation is marked as current
    And no stale badge is displayed

  # ────── Content changed ──────

  @p1 @api @bdd @e2e
  Scenario: Observation becomes stale when observed content has changed
    Given an observation exists on lines 10 through 15 of "src/app.ts" with a stored snapshot and hash
    And the working tree content at lines 10 through 15 has changed since the observation was created
    When the observation panel opens
    Then the observation is marked as stale with reason "stale-content-changed"
    And a stale badge is displayed on the observation card
    And the original snapshot content is preserved and visible

  # ────── Range missing ──────

  @p2 @api @bdd
  Scenario: Observation becomes stale when the selected line range no longer exists
    Given an observation exists on lines 50 through 55 of "src/app.ts"
    And the working tree version of "src/app.ts" has fewer than 50 lines
    When the observation panel opens
    Then the observation is marked as stale with a reason indicating the range is missing
    And the original snapshot content is preserved and visible

  # ────── File deleted ──────

  @p2 @api @bdd
  Scenario: Observation becomes stale when the referenced file has been deleted
    Given an observation exists on "src/removed.ts"
    And the file "src/removed.ts" no longer exists in the working tree
    When the observation panel opens
    Then the observation is marked as stale with a reason indicating the file was deleted
    And the original snapshot content is preserved and visible

  # ────── Binary file ──────

  @p3 @api @bdd
  Scenario: Observation on a binary file is marked current when the file is unchanged
    Given an observation exists on a binary file "assets/logo.png"
    And the binary file content has not changed
    When the observation panel opens
    Then the observation is marked as current
    And no stale badge is displayed

  # ────── Comparison changed for review-level ──────

  @p2 @api @bdd
  Scenario: Review-level observation becomes stale when the comparison changes
    Given a review-level observation was created under Comparison "HEAD vs working tree"
    And the user changes the active Comparison to "main vs working tree"
    When the observation panel opens
    Then the review-level observation is marked as stale with a reason indicating the comparison has changed

  # ────── Commit-vs-commit stays current ──────

  @p2 @api @bdd
  Scenario: Observation on a commit-vs-commit comparison stays current
    Given the active Comparison is commit "abc1234" vs commit "def5678"
    And an observation exists on line 10 of "src/app.ts" under this comparison
    When the observation panel opens
    Then the observation is marked as current
    And no stale badge is displayed

  # ────── File renamed ──────

  @p2 @api @bdd
  Scenario: Observation becomes stale when the referenced file has been renamed
    Given an observation exists on "src/old-name.ts"
    And the file "src/old-name.ts" has been renamed to "src/new-name.ts" in the working tree
    When the observation panel opens
    Then the observation is marked as stale with reason "stale-file-renamed"
    And the original snapshot content is preserved and visible


