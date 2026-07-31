@application @e2e @timing @delta-modified
Feature: E2E helper timing contract — deferred invalidation barrier for SvelteKit workspace switching

  Background:
    Given the E2E helper is initialized with a simulated response barrier

  Scenario: Predicate matches __data.json GET requests
    Given the helper has registered a deferred invalidation barrier
    When a response arrives with URL containing "__data.json" and method "GET"
    Then the barrier predicate matches the response

  Scenario: Predicate rejects non-invalidation URLs
    Given the helper has registered a deferred invalidation barrier
    When a response arrives with URL "/api/workspaces/list" and method "GET"
    Then the barrier predicate does not match the response

  Scenario: Barrier is registered before the workspace selection click
    Given the helper is ready to select a workspace
    When the helper registers the deferred invalidation barrier
    And the helper performs the workspace selection click
    Then the barrier was registered before the click action

  Scenario: Barrier predicate is status-agnostic
    Given the helper has registered a deferred invalidation barrier
    When a response arrives with URL containing "__data.json" and HTTP status 500
    Then the barrier predicate matches the response
    And the barrier resolves without requiring HTTP status 200
