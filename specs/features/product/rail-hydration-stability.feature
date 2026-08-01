@product @hydration @stability @etapa-1
Feature: Rail hydration stability — no TypeError, reliable SVG icons, readiness, and keyboard navigation

  The left rail and its icon tabs must survive Svelte 5 client-side hydration
  without producing TypeError, pageerror, undefined.call, or "Failed to
  hydrate" console errors. The dev server must serve readiness HTTP 200 before
  any browser interaction. Keyboard navigation must work without console
  errors. A cold-start workflow — clean caches, stale process guard, readiness
  wait, hard browser reload — must produce a stable page.

  Background:
    Given the dev server is not running
    And any stale vite dev processes for this project are guarded
    And browser caches and site data are cleared

  # ────── Hydration stability ──────

  @product @hydration @stability @e2e
  Scenario: Rail hydration completes without TypeError or pageerror
    Given the dev server is started and responds with HTTP 200
    When the browser navigates to the application
    And the page completes Svelte 5 client-side hydration
    Then no pageerror was emitted
    And no console.error contains "TypeError"
    And no console.error contains "undefined.call"
    And no console.error contains "Failed to hydrate"

  @product @hydration @stability @e2e
  Scenario: Four SVG icons are rendered after hydration
    Given the application is loaded and hydrated
    When the user views the left rail
    Then the rail shows four SVG icon elements
    And each SVG icon is a child of its tab button
    And each SVG icon has an accessible label

  @product @hydration @stability @e2e
  Scenario: Keyboard navigation after hydration produces no console errors
    Given the application is loaded and hydrated
    When the user presses ArrowDown on the left rail
    Then focus moves to the next rail tab icon
    When the user presses ArrowUp on the left rail
    Then focus moves to the previous rail tab icon
    And no console.error was emitted during keyboard navigation

  @product @hydration @stability @e2e
  Scenario: Cold-start with readiness produces no errors
    Given the dev server is not running
    And stale vite dev processes for this project are cleaned up
    And vite caches and SvelteKit output are removed
    When the dev server is started
    And the readiness probe confirms HTTP 200
    And the browser performs a hard reload with cleared site data
    Then the page renders without hydration errors
    And all four rail tab icons are visible

  # ────── Readiness probe ──────

  @product @readiness @devops
  Scenario: Readiness probe returns zero when server responds 200
    Given the dev server is running on the configured port
    When the readiness probe script is executed
    Then the script exits with status 0

  @product @readiness @devops
  Scenario: Readiness probe returns non-zero when server is unreachable
    Given no server is running on the configured port
    When the readiness probe script is executed
    Then the script exits with a non-zero status

  @product @readiness @devops
  Scenario: Readiness probe times out with non-zero exit
    Given a server is running on the configured port but is not healthy
    When the readiness probe script is executed with a timeout
    Then the script exits with a non-zero status

  # ────── Stale process guard ──────

  @product @safety @devops
  Scenario: Stale process guard detects vite dev processes for this project
    Given this project directory is known
    And vite dev processes exist on common ports for this project
    When the stale process guard runs
    Then it reports the detected processes
    And it does not kill them by default

  @product @safety @devops
  Scenario: Stale process guard kills only when explicitly permitted
    Given this project directory is known
    And vite dev processes exist on common ports for this project
    And DIFFSCRIBE_E2E_KILL_ZOMBIES is set to true
    When the stale process guard runs
    Then it kills the detected processes

  @product @safety @devops
  Scenario: Stale process guard never kills processes from a different working directory
    Given vite dev processes exist from a different project directory
    When the stale process guard runs
    Then it does not kill those processes
    And it reports them as foreign processes
