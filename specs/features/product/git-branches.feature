@product @git @comparison @etapa-1
Feature: Git branches — cached remotes and inferred comparisons

  The Git context panel lists local branches and cached remote branches from
  the local `refs/remotes/*` only. No fetch, tags, or network operation is
  executed. Selecting a target slot auto-activates the Base slot, and the
  ComparisonType is inferred from the real base/target pair instead of being
  hardcoded.

  Background:
    Given the git workspace shell is loaded

  @product @git @p1 @e2e
  Scenario: Cached remote branches appear in the branch list
    Given a workspace with a cached remote branch
    When the user views the Git branch list
    Then the branch list shows the local branches
    And the branch list shows the cached remote branch with a remote marker

  @product @git @p1 @e2e
  Scenario: Selecting a target auto-activates the Base slot
    Given the Git comparison selector is open
    When the user selects the target branch "feature"
    Then the Base slot is filled with the current branch
    And the comparison type is inferred as branch-vs-branch

  @product @git @p1 @e2e
  Scenario: Selecting a commit target infers commit-vs-commit
    Given the Git comparison selector is open
    When the user selects the target commit "abc1234"
    Then the comparison type is inferred as commit-vs-commit

  @product @git @p1 @e2e
  Scenario: Remote branches never trigger a fetch
    Given a workspace with a cached remote branch
    When the user selects the cached remote branch as target
    Then no git fetch or network operation is executed
