@product @workspace @management @etapa-1
Feature: Workspace management — sidebar, single active, rename, and delete

  Workspace management includes the sidebar list, selection of a single
  active workspace persisted in SQLite across reloads and restarts, inline
  rename via discriminated PATCH, and non-destructive delete that never
  modifies the file system. The active workspace is automatically cleared if
  the selected workspace is deleted. Deletion requires explicit confirmation
  and can be cancelled. The interface respects keyboard navigation and the
  operating system's reduced motion preference.

  Background:
    Given DiffScribe is started

  # ────── Sidebar and list ──────

  @p1 @api @bdd @e2e
  Scenario: Workspace list in the sidebar
    Given a workspace is registered with displayName "Repo A"
    And another workspace is registered with displayName "Repo B"
    When the user opens the workspace sidebar
    Then the sidebar shows exactly 2 workspaces
    And the list includes "Repo A"
    And the list includes "Repo B"

  @p3 @api @bdd @e2e
  Scenario: Visual indicator for an invalid workspace
    Given workspace "ws-invalid" is registered with displayName "Repo X"
    And the path for "Repo X" is no longer a valid Git repository
    When the user opens the workspace sidebar
    Then workspace "Repo X" appears in the list
    And workspace "Repo X" shows a visual status indicator of "invalid"

  @p5 @ui @e2e
  Scenario: Empty state of the sidebar
    Given no workspaces are registered
    When the user opens the workspace sidebar
    Then the sidebar shows an empty state message
    And no workspace is shown in the list

  # ────── Active workspace selection ──────

  @p1 @api @bdd @e2e
  Scenario: Select the active workspace
    Given a workspace is registered with displayName "Repo A"
    When the user selects "Repo A" in the sidebar
    Then workspace "Repo A" is marked as active
    And the active workspace identifier is persisted in SQLite

  @p1 @api @bdd @e2e
  Scenario: Switch the active workspace without restarting
    Given workspace "Repo A" is registered as active
    And another workspace is registered with displayName "Repo B"
    When the user selects "Repo B" in the sidebar
    Then "Repo B" is marked as active
    And "Repo A" is no longer marked as active
    And DiffScribe does not require a restart

  @p1 @api @bdd @e2e
  Scenario: The active workspace persists across page reloads
    Given workspace "Repo A" is registered as active
    When the user reloads the page
    Then "Repo A" remains marked as active in the sidebar

  @p1 @api @bdd @e2e
  Scenario: The active workspace is remembered across DiffScribe runs
    Given workspace "Repo A" is registered and marked as active
    When DiffScribe is closed and started again
    Then "Repo A" appears marked as active in the sidebar

  # ────── Rename ──────

  @p2 @api @bdd @e2e
  Scenario: Rename a workspace with a valid name
    Given a workspace is registered with displayName "Repo A"
    When the user renames workspace "Repo A" to "My Project"
    Then the workspace is persisted with displayName "My Project"
    And the workspace retains its original WorkspaceId
    And the workspace retains its original repositoryPath

  @p3 @api @bdd
  Scenario: Reject rename with an empty displayName
    Given a workspace is registered with displayName "Repo A"
    When the user sends a PATCH with an empty displayName for "Repo A"
    Then the response is 400
    And the error indicates that displayName cannot be empty
    And workspace "Repo A" retains displayName "Repo A"

  @p3 @api @bdd
  Scenario: Reject rename with a displayName longer than 200 characters
    Given a workspace is registered with displayName "Repo A"
    When the user sends a PATCH with a displayName longer than 200 characters for "Repo A"
    Then the response is 400
    And the error indicates that displayName exceeds the 200-character limit
    And workspace "Repo A" retains displayName "Repo A"

  @p3 @api @bdd
  Scenario: Reject rename on a non-existent workspace
    Given no workspace exists with WorkspaceId "ws-inexistente"
    When the user sends a PATCH with displayName "New" for "ws-inexistente"
    Then the response is 404
    And the error indicates that the workspace does not exist

  # ────── Discriminated PATCH ──────

  @p3 @api @bdd
  Scenario: Reject PATCH with both displayName and repositoryPath
    Given a workspace is registered with displayName "Repo A"
    When the user sends a PATCH with displayName "New" and repositoryPath "/other/path" for "Repo A"
    Then the response is 400
    And the error indicates that exactly one of displayName or repositoryPath must be sent
    And workspace "Repo A" is unchanged

  @p3 @api @bdd
  Scenario: Reject PATCH without displayName or repositoryPath
    Given a workspace is registered with displayName "Repo A"
    When the user sends a PATCH without displayName or repositoryPath for "Repo A"
    Then the response is 400
    And the error indicates that exactly one of displayName or repositoryPath must be sent
    And workspace "Repo A" is unchanged

  # ────── Delete ──────

  @p2 @api @bdd @e2e
  Scenario: Deleting a workspace preserves the Git directory on the file system
    Given a workspace is registered with path "/tmp/diffscribe-fixture/repo-z"
    And the directory "/tmp/diffscribe-fixture/repo-z" exists and is a Git repository
    When the user deletes the workspace with path "/tmp/diffscribe-fixture/repo-z"
    Then the workspace disappears from the list
    And the directory "/tmp/diffscribe-fixture/repo-z" still exists on the file system

  @p3 @api @bdd
  Scenario: Reject delete on a non-existent workspace
    Given no workspace exists with WorkspaceId "ws-inexistente"
    When the user sends a DELETE for "ws-inexistente"
    Then the response is 404
    And the error indicates that the workspace does not exist

  @p2 @api @bdd @e2e
  Scenario: Deleting the active workspace clears the active workspace state
    Given workspace "Repo A" is registered as active
    When the user deletes workspace "Repo A"
    Then workspace "Repo A" disappears from the list
    And the activeWorkspaceId field in the app_state table is cleared

  # ────── Delete UI: confirmation and cancellation ──────

  @p2 @ui @e2e
  Scenario: Cancelling delete preserves the workspace
    Given the delete confirmation dialog is visible for workspace "Repo A"
    When the user clicks Cancel
    Then the dialog closes
    And workspace "Repo A" remains in the list unchanged

  @p2 @ui @e2e
  Scenario: Confirming delete removes the workspace
    Given the delete confirmation dialog is visible for workspace "Repo A"
    When the user clicks Delete
    Then the dialog closes
    And workspace "Repo A" disappears from the list

  # ────── Accessibility ──────

  @p4 @ui @e2e
  Scenario: Keyboard navigation in the sidebar
    Given the sidebar shows 3 registered workspaces
    When the user presses Tab to move focus to the sidebar
      And navigates with ArrowDown to the second workspace
      And presses Enter to select it
    Then the second workspace is marked as active
    And focus remains within the sidebar

  @p4 @ui @e2e
  Scenario: Respect the operating system reduced motion preference
    Given the sidebar contains registered workspaces
    And the operating system has the reduced motion preference enabled
    When the user opens the workspace sidebar
    Then sidebar transitions run without animation
    And active workspace visual state changes produce no animated movement
