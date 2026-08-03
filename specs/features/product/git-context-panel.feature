@product @git @comparison @etapa-1
Feature: Git context panel — status, branches, commits, and comparison draft

  The Git context panel shows the working tree status, local branches, and
  recent commits for the active workspace. The user can filter branches and
  commits, activate Base and Target slots, and select a branch or commit for
  each slot to build an ephemeral Comparison draft. The draft updates in
  memory without checkout, commit, branch creation, or any mutation of the
  repository. The default comparison is HEAD vs working tree. The user can
  manually refresh the panel. Edge cases include detached HEAD, unborn HEAD
  (no commits yet), no active workspace, an invalidated workspace, and
  adapter-level errors. The panel supports keyboard navigation.

  Background:
    Given DiffScribe is started
    And a workspace is registered and active

  # ────── Git status ──────

  @p1 @api @bdd @e2e
  Scenario: Show clean working tree status
    Given the active workspace has a clean working tree
    When the user views the Git context panel
    Then the panel shows the status indicator as "clean"
    And the panel shows 0 staged files
    And the panel shows 0 unstaged files
    And the panel shows 0 untracked files

  @p1 @api @bdd @e2e
  Scenario: Show dirty working tree with unstaged changes
    Given the active workspace has 3 unstaged modified files
    When the user views the Git context panel
    Then the panel shows the status indicator as "dirty"
    And the panel shows 0 staged files
    And the panel shows 3 unstaged files

  @p2 @api @bdd @e2e
  Scenario: Show staged changes count
    Given the active workspace has 2 staged files
    And the active workspace has 1 unstaged file
    When the user views the Git context panel
    Then the panel shows 2 staged files
    And the panel shows 1 unstaged file

  @p2 @api @bdd @e2e
  Scenario: Show untracked files count
    Given the active workspace has 4 untracked files
    When the user views the Git context panel
    Then the panel shows 4 untracked files

  @p2 @api @bdd @e2e
  Scenario: Show conflicted files count
    Given the active workspace has 2 conflicted files
    When the user views the Git context panel
    Then the panel shows 2 conflicted files
    And the status indicator shows a conflict state

  # ────── Branch list ──────

  @p1 @api @bdd @e2e
  Scenario: Show local branches with the current branch highlighted
    Given the active workspace has local branches "main", "feat/a", and "fix/b"
    And the current branch is "main"
    When the user views the Git context panel
    Then the branch list shows "main", "feat/a", and "fix/b"
    And "main" is visually highlighted as the current branch

  @p4 @api @bdd
  Scenario: Show current branch when workspace is in detached HEAD state
    Given the active workspace is in detached HEAD at commit "abc1234"
    When the user views the Git context panel
    Then the panel shows an indicator for detached HEAD
    And the panel displays the short commit hash "abc1234"
    And the branch list still shows all local branches

  @p4 @api @bdd
  Scenario: Show empty branch list for an unborn HEAD
    Given the active workspace has no commits yet
    When the user views the Git context panel
    Then the panel shows an indicator for unborn HEAD
    And the branch list is empty

  # ────── Commit list ──────

  @p1 @api @bdd @e2e
  Scenario: Show recent commits on the current branch
    Given the active workspace has 5 recent commits on the current branch
    When the user views the Git context panel
    Then the commit list shows the 5 most recent commits
    And each commit entry shows its short hash and commit message

  @p3 @api @bdd
  Scenario: Show empty commit list for unborn HEAD
    Given the active workspace has no commits yet
    When the user views the Git context panel
    Then the commit list is empty

  # ────── Filtering ──────

  @p3 @api @bdd @e2e
  Scenario: Filter branches by name
    Given the active workspace has local branches "main", "feat/login", "feat/signup", and "fix/typo"
    When the user types "feat" in the branch filter input
    Then the branch list shows only "feat/login" and "feat/signup"
    And branches "main" and "fix/typo" are hidden

  @p3 @api @bdd @e2e
  Scenario: Filter commits by message substring
    Given the active workspace has recent commits with messages "Add login", "Fix typo", and "Refactor auth"
    When the user types "login" in the commit filter input
    Then the commit list shows only the commit with message "Add login"

  @p3 @api @bdd @e2e
  Scenario: Clear filter restores the full list
    Given the user has typed "feat" in the branch filter
    And the branch list is filtered
    When the user clears the branch filter input
    Then the full branch list is restored

  # ────── Comparison slot interaction ──────

  @p1 @ui @e2e
  Scenario: Activate the Base slot
    Given the Git context panel is visible
    And no comparison slot is active
    When the user clicks the Base slot area
    Then the Base slot is visually marked as active
    And the Target slot remains inactive

  @p1 @ui @e2e
  Scenario: Activate the Target slot
    Given the Git context panel is visible
    And the Base slot is active
    When the user clicks the Target slot area
    Then the Target slot is visually marked as active
    And the Base slot becomes inactive

  @p1 @api @bdd @e2e
  Scenario: Select a branch for the Base slot
    Given the Git context panel is visible
    And the Base slot is active
    When the user selects branch "feat/a" for the Base slot
    Then the Base slot displays "feat/a"
    And the ephemeral Comparison draft has base set to branch "feat/a"
    And the repository does not check out "feat/a"

  @p1 @api @bdd @e2e
  Scenario: Select a commit for the Target slot
    Given the Git context panel is visible
    And the Target slot is active
    When the user selects commit "def5678" for the Target slot
    Then the Target slot displays "def5678"
    And the ephemeral Comparison draft has target set to commit "def5678"
    And the repository does not check out commit "def5678"

  @p2 @api @bdd @e2e
  Scenario: The Comparison draft updates when both slots are assigned
    Given the Base slot is set to branch "main"
    And the Target slot is set to branch "feat/a"
    When the user views the Comparison
    Then the Comparison draft reflects base "main" and target "feat/a"
    And the comparison type is "branch vs branch"

  @p2 @api @bdd @e2e
  Scenario: Reassign a slot replaces the previous value
    Given the Base slot is set to branch "main"
    When the user selects branch "develop" for the Base slot
    Then the Base slot displays "develop"
    And the ephemeral Comparison draft has base set to branch "develop"

  # ────── Default comparison ──────

  @p1 @api @bdd @e2e
  Scenario: Default comparison is HEAD vs working tree
    Given the active workspace has a dirty working tree
    And no Base or Target slot has been assigned
    When the user views the Git context panel
    Then the Comparison draft shows base "HEAD"
    And the Comparison draft shows target "working tree"
    And the comparison type is "working tree vs HEAD"

  # ────── Manual refresh ──────

  @p2 @ui @e2e
  Scenario: Manual refresh updates the Git status
    Given the active workspace initially has a clean working tree
    And the Git context panel shows status "clean"
    When a file is modified outside DiffScribe
    And the user clicks the refresh button in the Git context panel
    Then the panel shows status "dirty"
    And the panel reflects the updated staged and unstaged counts

  @p2 @ui @e2e
  Scenario: Manual refresh updates the branch list
    Given the active workspace initially has branch "main"
    And the Git context panel shows only "main"
    When a new branch "feat/z" is created outside DiffScribe
    And the user clicks the refresh button
    Then the branch list includes "feat/z"

  # ────── Edge cases ──────

  @p3 @api @bdd @e2e
  Scenario: No active workspace shows empty panel
    Given no workspace is active
    When the user views the Git context panel
    Then the panel shows an empty state indicating no active workspace
    And no Git status, branch, or commit information is displayed

  @p3 @api @bdd @e2e @delta-modified
  Scenario: Invalidated workspace shows error indicator with retry
    Given the active workspace has been invalidated
    When the user views the Git context panel
    Then the panel shows an error indicator
    And the panel explains that the workspace path is no longer valid
    And the panel shows a Retry action to revalidate the workspace
    When the user clicks the Retry action
    Then the panel attempts to revalidate the workspace

  @p4 @api @bdd @delta-modified
  Scenario: Error state shows retry action when adapter fails
    Given the active workspace is valid
    And the Git adapter returns an error
    When the user views the Git context panel
    Then the panel shows a user-facing error message
    And the panel does not expose raw error stack traces
    And the panel shows a Retry action to reload the Git context

  # ────── Keyboard accessibility ──────

  @p4 @ui @e2e
  Scenario: Tab navigation through the Git context panel
    Given the Git context panel is visible
    When the user presses Tab repeatedly
    Then focus moves through the Base slot, Target slot, branch filter, commit filter, and refresh button in order

  @p4 @ui @e2e
  Scenario: Select a branch with keyboard only
    Given the branch list is visible and focused
    When the user presses ArrowDown to move to the second branch
    And the user presses Enter
    Then the selected branch is assigned to the active slot

  # ────── Async refresh safety (tranche C) ──────
  #
  # The Git context refresh and the file-list fetch run under request guards
  # so stale responses cannot overwrite newer state, and a failed refresh
  # never discards the last good context.

  @p2 @ui @e2e
  Scenario: Refresh failure preserves the last good context with a visible error and retry
    Given the Git context panel shows status "clean"
    When the Git context refresh fails with a network error
    Then the panel keeps showing the last good status
    And the panel shows a visible error with a Retry action

  @p2 @ui @e2e
  Scenario: Stale refresh responses are discarded
    Given the user starts a slow refresh
    And the user starts a second refresh that finishes first
    When the slow refresh finally responds
    Then the panel reflects the second refresh, not the stale one

  @p2 @ui @e2e
  Scenario: Stale file-list responses are discarded when the comparison changes
    Given the file list for the default comparison is slow to respond
    When the user selects a branch for the Target slot
    And the newer file list response arrives before the stale one
    Then the panel shows the file list for the selected branch
    And the stale response does not overwrite it

  @p3 @ui @e2e
  Scenario: Existing Target commit selection is preserved across refresh
    Given the Target slot is set to commit "def5678"
    When the user refreshes the Git context
    Then the Target slot still shows "def5678"

  # ────── Retry recovery and tree invalidation (post-tranche C hardening) ──────
  #
  # Retry after a failed refresh clears the error and restores the refreshed
  # context. A successful refresh invalidates the cached Project tree for the
  # active workspace so external file changes become visible, without
  # clearing other workspaces and without refetching on tab switches.

  @p2 @ui @e2e
  Scenario: Retry success clears the error and restores the refreshed context
    Given the Git context panel shows an error after a failed refresh
    When the user clicks Retry
    And the refresh succeeds
    Then the error disappears
    And the panel shows the refreshed Git context

  @p2 @ui @e2e
  Scenario: Successful refresh invalidates the cached Project tree
    Given the Project tree is loaded and cached
    When a file is added outside DiffScribe
    And the user clicks the refresh button in the Git context panel
    And the user opens the Project tab
    Then the Project tree shows the added file

  # ────── Single scroll owner (hardening H4) ──────

  @delta-added @p2 @ui @e2e
  Scenario Outline: Git panel is the single scroll owner at narrow and wide widths
    Given the user views the Git context panel at <width> px
    Then the Git panel is the only scrollable region for its content
    And the file list panel does not take the full panel height
    When the user scrolls the Git panel to the bottom
    Then the commits, file rows, pagination, and footer are reachable
    And the user can paginate the file list from the scroll position

    Examples:
      | width |
      | 320   |
      | 1280  |
