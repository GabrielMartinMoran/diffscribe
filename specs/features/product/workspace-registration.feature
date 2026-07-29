@product @workspace @registration @etapa-1
Feature: Registration of a workspace on an existing local Git root

  A workspace represents the root of an existing local Git repository that the
  user opens and registers in DiffScribe. DiffScribe never creates a repository:
  the repository must exist before registration. The workspace persists with
  identity, displayName, repositoryPath, createdAt, and lastOpenedAt. If the
  path disappears or ceases to be a valid Git root, the workspace is listed as
  `invalid` without being deleted. If the same path reappears and is a valid
  Git root again, the workspace is automatically revalidated as `valid`. The
  user can repair the path of the same workspace, preserving identity and
  history.

  Background:
    Given DiffScribe is started
    And no workspaces are previously registered

  # ────── Open (register) ──────

  @p1 @api @bdd @e2e
  Scenario: Register a workspace with an existing Git root path
    Given a Git repository exists at "/tmp/diffscribe-fixture/repo-a"
    When the user opens the workspace with path "/tmp/diffscribe-fixture/repo-a"
      And displayName "Repo A"
    Then the workspace is persisted with a unique WorkspaceId
    And the workspace has displayName "Repo A"
    And the workspace has repositoryPath "/tmp/diffscribe-fixture/repo-a"
    And the workspace has createdAt equal to the registration date and time
    And the workspace has lastOpenedAt equal to the registration date and time
    And the workspace appears in the list with status "valid"

  @p1 @api @bdd
  Scenario: Reject a path that does not exist
    Given the directory "/tmp/diffscribe-fixture/inexistente" does not exist
    When the user attempts to open a workspace with path "/tmp/diffscribe-fixture/inexistente"
      And displayName "Does Not Exist"
    Then the registration is rejected
    And the error indicates that the path does not exist
    And the workspace list remains empty

  @p1 @api @bdd
  Scenario: Reject a path that exists but is not a Git repository
    Given the directory "/tmp/diffscribe-fixture/no-git" exists
    And "/tmp/diffscribe-fixture/no-git" does not contain a Git repository
    When the user attempts to open a workspace with path "/tmp/diffscribe-fixture/no-git"
      And displayName "No Git"
    Then the registration is rejected
    And the error indicates that the path is not a Git repository
    And the workspace list remains empty

  @p1 @api @bdd
  Scenario: Reject a path inside a Git repository that is not the root
    Given a Git repository exists at "/tmp/diffscribe-fixture/repo-b"
    And the subdirectory "/tmp/diffscribe-fixture/repo-b/src" exists
    When the user attempts to open a workspace with path "/tmp/diffscribe-fixture/repo-b/src"
      And displayName "Subdir"
    Then the registration is rejected
    And the error indicates that the path is not the Git repository root
    And the workspace list remains empty

  @p1 @api @bdd
  Scenario: Reject a duplicate path
    Given a Git repository exists at "/tmp/diffscribe-fixture/repo-c"
    And a workspace with repositoryPath "/tmp/diffscribe-fixture/repo-c" is already registered
    When the user attempts to open another workspace with the same path "/tmp/diffscribe-fixture/repo-c"
      And displayName "Duplicate"
    Then the registration is rejected
    And the error indicates that the workspace is already registered
    And the original workspace is not altered

  # ────── List and query status ──────

  @p2 @api @bdd @e2e
  Scenario: Listing workspaces shows derived status on query
    Given a Git repository exists at "/tmp/diffscribe-fixture/repo-d"
    And a workspace is registered with path "/tmp/diffscribe-fixture/repo-d"
      And displayName "Repo D"
    And a Git repository exists at "/tmp/diffscribe-fixture/repo-e"
    And a workspace is registered with path "/tmp/diffscribe-fixture/repo-e"
      And displayName "Repo E"
    When the user queries the workspace list
    Then the list contains exactly 2 workspaces
    And workspace "Repo D" has status "valid"
    And workspace "Repo E" has status "valid"

  @p2 @api @bdd @e2e
  Scenario: Workspace is shown as invalid when the path disappears
    Given a Git repository exists at "/tmp/diffscribe-fixture/repo-f"
    And a workspace is registered with path "/tmp/diffscribe-fixture/repo-f"
      And displayName "Repo F"
    When the directory "/tmp/diffscribe-fixture/repo-f" is deleted
    And the user queries the workspace list
    Then workspace "Repo F" is still listed with status "invalid"
    And workspace "Repo F" retains its WorkspaceId, displayName, repositoryPath, and createdAt

  @p2 @api @bdd
  Scenario: Workspace is shown as invalid when the path stops being a Git repository
    Given a Git repository exists at "/tmp/diffscribe-fixture/repo-g"
    And a workspace is registered with path "/tmp/diffscribe-fixture/repo-g"
      And displayName "Repo G"
    When the ".git" directory in "/tmp/diffscribe-fixture/repo-g" is deleted
    And the user queries the workspace list
    Then workspace "Repo G" has status "invalid"
    And workspace "Repo G" retains its WorkspaceId, displayName, repositoryPath, and createdAt

  @p2 @api @bdd @e2e
  Scenario: Workspace is automatically revalidated when the path becomes valid again
    Given a Git repository exists at "/tmp/diffscribe-fixture/repo-h"
    And a workspace is registered with path "/tmp/diffscribe-fixture/repo-h"
      And displayName "Repo H"
    And the directory "/tmp/diffscribe-fixture/repo-h" was deleted
    And workspace "Repo H" has status "invalid"
    When the directory "/tmp/diffscribe-fixture/repo-h" is recreated as a Git repository in the same location
    And the user queries the workspace list
    Then workspace "Repo H" has status "valid"
    And workspace "Repo H" retains its original WorkspaceId, displayName, repositoryPath, and createdAt

  # ────── Repair path ──────

  @p3 @api @bdd @e2e
  Scenario: Repair a workspace path to a new valid Git path
    Given a Git repository exists at "/tmp/diffscribe-fixture/repo-i"
    And workspace "ws-i" is registered with path "/tmp/diffscribe-fixture/repo-i"
      And displayName "Repo I"
    And a Git repository exists at "/tmp/diffscribe-fixture/repo-i-moved"
    When the user repairs workspace "ws-i" with the new path "/tmp/diffscribe-fixture/repo-i-moved"
    Then workspace "ws-i" retains its original WorkspaceId
    And workspace "ws-i" retains the displayName "Repo I"
    And workspace "ws-i" retains the original createdAt
    And workspace "ws-i" has repositoryPath "/tmp/diffscribe-fixture/repo-i-moved"
    And workspace "ws-i" has lastOpenedAt updated to the repair date and time
    And workspace "ws-i" has status "valid"

  @p3 @api @bdd
  Scenario: Reject repair to a path that is not a Git repository
    Given workspace "ws-j" is registered with path "/tmp/diffscribe-fixture/repo-j"
    And "/tmp/diffscribe-fixture/not-git" exists but is not a Git repository
    When the user attempts to repair workspace "ws-j" with path "/tmp/diffscribe-fixture/not-git"
    Then the repair is rejected
    And the error indicates that the new path is not a valid Git repository
    And workspace "ws-j" retains repositoryPath "/tmp/diffscribe-fixture/repo-j" unchanged

  @p3 @api @bdd
  Scenario: Reject repair to a path already registered by another workspace
    Given workspace "ws-k" is registered with path "/tmp/diffscribe-fixture/repo-k"
    And another workspace "ws-l" is registered with path "/tmp/diffscribe-fixture/repo-l"
    When the user attempts to repair workspace "ws-k" with path "/tmp/diffscribe-fixture/repo-l"
    Then the repair is rejected
    And the error indicates that the path is already registered by another workspace
    And workspace "ws-k" retains repositoryPath "/tmp/diffscribe-fixture/repo-k" unchanged
    And workspace "ws-l" retains repositoryPath "/tmp/diffscribe-fixture/repo-l" unchanged

  # ────── Form closure after registration ──────

  @delta-added @p2 @ui @e2e
  Scenario: Form closes after successful workspace registration
    Given a Git repository exists at "/tmp/diffscribe-fixture/repo-close"
    And the open workspace form is visible with the toggle set to "Open Workspace"
    When the user opens the workspace with path "/tmp/diffscribe-fixture/repo-close"
      And displayName "Close Test"
      And the registration succeeds
    Then the form closes
    And the toggle shows "Open Workspace"

  @delta-added @p2 @ui @e2e
  Scenario: Sequential workspace registrations open fresh forms
    Given a Git repository exists at "/tmp/diffscribe-fixture/repo-seq-1"
    And the user opens the workspace with path "/tmp/diffscribe-fixture/repo-seq-1"
      And displayName "Seq 1"
    And the registration succeeds
    And the form closes
    And a Git repository exists at "/tmp/diffscribe-fixture/repo-seq-2"
    When the user reopens the open workspace form
    Then the form fields are empty
    When the user opens the workspace with path "/tmp/diffscribe-fixture/repo-seq-2"
      And displayName "Seq 2"
      And the registration succeeds
    Then the form closes
    And workspace "Seq 1" and "Seq 2" appear in the sidebar
