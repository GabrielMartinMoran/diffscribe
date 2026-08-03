@application @git @comparison @etapa-1
Feature: Git context adapter — typed DTOs with no raw simple-git leakage

  The Git context adapter translates raw simple-git output into typed domain
  DTOs. No raw simple-git data structures leak past the adapter boundary.
  Each adapter method returns either a typed result or a typed error. Edge
  cases include detached HEAD, unborn HEAD, and Git command failures.
  Workspace validation is expressed as a typed result, never as a thrown
  exception from simple-git.

  # ────── Typed status DTO ──────

  @p1 @api @bdd
  Scenario: Map simple-git status output to a typed StatusDto
    Given simple-git returns a raw StatusResult with 2 staged, 3 modified, and 1 untracked file
    When the adapter maps the raw result to a StatusDto
    Then the StatusDto has stagedCount 2
    And the StatusDto has unstagedCount 3
    And the StatusDto has untrackedCount 1
    And the StatusDto has conflictedCount 0
    And the StatusDto has the "dirty" flag set to true
    And the caller receives no raw simple-git StatusResult reference

  @p1 @api @bdd
  Scenario: StatusDto reflects a clean working tree
    Given simple-git returns a raw StatusResult with zero changes across all categories
    When the adapter maps the raw result to a StatusDto
    Then the StatusDto has stagedCount 0
    And the StatusDto has unstagedCount 0
    And the StatusDto has untrackedCount 0
    And the StatusDto has conflictedCount 0
    And the StatusDto has the "dirty" flag set to false

  @p2 @api @bdd
  Scenario: StatusDto reflects conflicted files
    Given simple-git returns a raw StatusResult with 2 conflicted files
    When the adapter maps the raw result to a StatusDto
    Then the StatusDto has conflictedCount 2
    And the StatusDto has the "dirty" flag set to true

  # ────── Typed branch DTO ──────

  @p1 @api @bdd
  Scenario: Map simple-git branch summary to a list of typed BranchDto
    Given simple-git returns a raw BranchSummary with branches "main" (current), "feat/a", and "fix/b"
    When the adapter maps the raw summary to a BranchDto list
    Then the list contains exactly 3 entries
    And the entry for "main" has isCurrent set to true
    And the entry for "feat/a" has isCurrent set to false
    And the entry for "fix/b" has isCurrent set to false
    And no raw simple-git BranchSummary reference is exposed to the caller

  # ────── Typed commit DTO ──────

  @p1 @api @bdd
  Scenario: Map simple-git log output to a list of typed CommitDto
    Given simple-git returns a raw LogResult with 3 commits
    When the adapter maps the raw log to a CommitDto list
    Then the list contains exactly 3 entries
    And each entry has a shortHash, fullHash, message, authorName, and date
    And no raw simple-git DefaultLogFields reference is exposed to the caller

  @p2 @api @bdd
  Scenario: CommitDto list is ordered newest-first
    Given simple-git returns a raw LogResult with commits C1, C2, and C3 in chronological order
    When the adapter maps the raw log to a CommitDto list
    Then the first entry in the list corresponds to the newest commit C3
    And the last entry corresponds to the oldest commit C1

  # ────── Detached HEAD ──────

  @p3 @api @bdd
  Scenario: Detached HEAD produces a typed detached state
    Given simple-git status indicates a detached HEAD at commit "abc1234"
    When the adapter processes the status
    Then the resulting context DTO has headState set to "detached"
    And the resulting context DTO has detachedCommitHash "abc1234"
    And the resulting context DTO has currentBranch set to null

  @p3 @api @bdd
  Scenario: Branch list is still available during detached HEAD
    Given the workspace is in detached HEAD
    And simple-git returns branches "main", "feat/a"
    When the adapter maps the branch summary
    Then the BranchDto list contains "main" and "feat/a"
    And no branch is marked as current

  # ────── Unborn HEAD ──────

  @p3 @api @bdd
  Scenario: Unborn HEAD produces a typed unborn state
    Given simple-git status indicates that the repository has no commits yet
    When the adapter processes the status
    Then the resulting context DTO has headState set to "unborn"
    And the resulting context DTO has currentBranch set to null
    And the resulting context DTO has commitCount set to 0

  @p3 @api @bdd
  Scenario: Commit list is empty for unborn HEAD
    Given the workspace has no commits yet
    And simple-git log returns an empty result
    When the adapter maps the log output
    Then the CommitDto list is empty

  # ────── Typed error results ──────

  @p2 @api @bdd
  Scenario: Git command failure returns a typed error result, not a thrown exception
    Given simple-git status throws a GitError with message "not a git repository"
    When the adapter catches the error
    Then the adapter returns a GitContextError result
    And the GitContextError has a userFacingMessage "The workspace is not a valid Git repository"
    And the GitContextError has an errorCode
    And the GitContextError does not expose the raw simple-git error stack trace

  @p4 @api @bdd
  Scenario: Workspace validation failure returns a typed error result
    Given the active workspace path points to a directory that is not a Git repository
    When the adapter validates the workspace
    Then the adapter returns a typed error result with errorCode "NOT_A_GIT_REPOSITORY"
    And no exception propagates to the caller

  @p4 @api @bdd
  Scenario: Workspace path does not exist returns a typed error result
    Given the active workspace path does not exist on the file system
    When the adapter attempts to access the repository
    Then the adapter returns a typed error result with errorCode "PATH_NOT_FOUND"
    And no exception propagates to the caller

  # ────── Canonical branch refs (tranche C) ──────
  #
  # The adapter reads local heads and cached remote refs with one combined
  # read-only `git for-each-ref` invocation and sorts the result in pure
  # TypeScript. Full refs are never shown to the user; the visible name stays
  # short while the canonical ref is used as the selection value.

  @p2 @api @bdd
  Scenario: Map for-each-ref output to BranchDto canonical refs and ISO UTC committer dates
    Given a workspace with local branch "dev" and cached remote branch "origin/dev"
    When the adapter maps the combined for-each-ref output
    Then the branch entry for "dev" has canonicalRef "refs/heads/dev"
    And the branch entry for "origin/dev" has canonicalRef "refs/remotes/origin/dev"
    And every branch entry has a committerDate serialized as ISO-8601 UTC
    And the visible branch names remain short without the full ref prefix

  @p2 @api @bdd
  Scenario: Branch list is ordered by group and committer date with canonical tie-break
    Given a workspace with local branches "dev", "old", and "alpha" with known committer dates
    And a cached remote branch "origin/main" with a known committer date
    When the adapter maps the combined for-each-ref output
    Then local branches appear before cached remote branches
    And within a group branches are ordered by committerDate descending
    And branches with equal committerDate tie-break by canonicalRef ascending

  @p3 @api @bdd
  Scenario: Missing committer date is omitted and sorts last
    Given a workspace with a branch that has no committer date
    And a branch with a known committer date
    When the adapter maps the combined for-each-ref output
    Then the branch entry without a date has no committerDate property
    And the dated branch is sorted before the undated branch

  @p3 @api @bdd
  Scenario: Unborn HEAD produces an empty branch list
    Given simple-git status indicates that the repository has no commits yet
    When the adapter maps the combined for-each-ref output
    Then the BranchDto list is empty

  @p2 @api @bdd
  Scenario: Remote HEAD pseudo-refs are excluded from the branch list
    Given a workspace with a cached remote branch and a remote HEAD pseudo-ref
    When the adapter maps the combined for-each-ref output
    Then the BranchDto list contains "origin/main"
    And the BranchDto list does not contain "origin/HEAD"

  @p2 @api @bdd
  Scenario: Branch reading never fetches, pulls, pushes, or runs ls-remote
    Given the git context adapter is loaded
    When the adapter reads branches from a workspace with a cached remote branch
    Then no git fetch, pull, push, or ls-remote operation is available in the reader
