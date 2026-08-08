@feat-fast-menu-interactions @product @performance @etapa-1
Feature: Fast menu and panel interactions

  Opening and closing menus and side panels must feel fast. The overflow menu
  is pure local UI and must never wait on an API. Panels and dialogs that load
  remote data must show their shell and focus feedback first, then render data
  asynchronously. Data is fetched once per workspace and comparison, shared
  across consumers, invalidated when Git state changes, seeded from the server
  page load, and never prefetched for non-active workspaces.

  Background:
    Given the app shell is present
    And a workspace is registered and active

  @delta-added @product @performance @p1 @e2e
  Scenario: The overflow menu opens without any API request
    Given the workspace overflow menu trigger is visible
    When the user activates the workspace overflow menu trigger
    Then the overflow menu becomes visible
    And no API request is issued while the menu opens

  @delta-added @product @performance @p1 @e2e
  Scenario: Quick Open shows its shell and focus before the tree data arrives
    Given the Project tree data is not yet loaded for the workspace
    When the user presses Ctrl+P
    Then a Quick Open dialog opens
    And the filter input has focus
    When the tree data arrives
    Then the tree results appear in the dialog

  @delta-added @product @performance @p1 @e2e
  Scenario: The review list is fetched at most once per open
    Given the review panel shows the review list
    When the user opens the review list
    Then the review list is fetched exactly once
    And the review list shows the reviews

  @delta-added @product @performance @p1 @integration
  Scenario: The file-list status map is fetched once per workspace and comparison
    Given the Project tree, the Git context panel, and Quick Open are mounted
    When the same workspace and comparison are active
    Then the file-list status endpoint is requested once
    And all three consumers share the same status map

  @delta-added @product @performance @p1 @integration
  Scenario: The file-list cache is scoped to the active workspace
    Given workspace A and workspace B are registered
    When the user switches from workspace A to workspace B
    Then loading workspace B never reuses workspace A cached statuses
    And workspace A data is not prefetched while workspace B is active

  @delta-added @product @performance @p1 @integration
  Scenario: A Git mutation invalidates the affected workspace cache
    Given the file-list status map is cached for the active workspace
    When the user refreshes the Git context
    Then the cached status map for the active workspace is invalidated
    And the next load fetches the fresh status map once

  @delta-added @product @performance @p1 @integration
  Scenario: A stale response never overwrites a newer one
    Given a file-list request is in flight for the active workspace
    When a newer request starts for the same workspace
    Then the stale response is discarded

  @delta-added @product @performance @p1 @unit
  Scenario: A failed load is not cached and can be retried
    Given the file-list endpoint fails
    When the user retries the load
    Then the retry succeeds and the status map is cached

  @delta-added @product @performance @p1 @integration
  Scenario: Server-seeded data is not refetched on first render
    Given the page load delivered workspaces, git context, and the active review
    When the app shell renders with an active workspace
    Then no request re-fetches the workspace list, git context, or active review
    And the shell consumes the server-seeded values

  @delta-added @product @performance @p1 @e2e
  Scenario: Interaction latency is measured in dev and production
    Given the app runs in a measured environment
    When the user opens the overflow menu, Quick Open, and the review list
    Then the report records shell, focus, first content, and settled times
    And the report records request counts, long tasks, and page errors
