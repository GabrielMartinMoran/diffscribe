@application @e2e @stability @delta-added
Feature: E2E stability contracts — event-driven registration, observation CRUD ordering, and worker lifecycle

  Background:
    Given the E2E test harness is initialized

  # ── H2: post-submit registration barrier (implemented, frozen) ──

  @h2 @e2e @delta-added
  Scenario: Registration helper waits for the deferred invalidation response
    Given a workspace is registered via the open-workspace form
    When the helper registers a __data.json response barrier before the submit
    And the form action succeeds and triggers invalidateAll
    Then the helper resolves only after the __data.json response arrives
    And the registered workspace is visible in the sidebar before the helper returns

  @h2 @e2e @delta-added
  Scenario: Registration helper does not rely on networkidle alone
    Given the page has reached networkidle after the submit
    When the deferred __data.json response has not yet completed
    Then the helper must not consider the registration complete
    And the helper must wait for the deferred invalidation response

  # ── H3: readiness semantics (implemented, frozen) ──

  @h3 @integration @delta-added
  Scenario: Worker readiness requires JavaScript chunk availability
    Given a worker server responds with HTML 200 for "/"
    When a required JavaScript chunk responds with 503 or 404
    Then the worker must not be considered ready
    And the readiness failure must report the failing chunk

  # ── H4: startup cleanup and stale guard (implemented, frozen) ──

  @h4 @integration @delta-added
  Scenario: Startup failure kills descendant processes
    Given a worker child spawns a grandchild process
    When the child exits before readiness
    Then the grandchild process is terminated
    And no orphan process remains on the worker port

  @h4 @unit @delta-added
  Scenario: Stale process guard covers dynamic worker ports
    Given a stale vite dev process listens on a dynamic worker port
    When the stale process guard runs
    Then the process is detected on the dynamic port
    And the process is reported for the project working directory

  # ── Diagnostics ──

  @diagnostics @e2e @delta-added
  Scenario: Failure telemetry records worker context
    Given an E2E test fails in a worker
    When the failure is captured
    Then the telemetry records the worker index, port, stderr, and first error
    And the telemetry records the status of JavaScript resources

  @diagnostics @e2e @delta-added
  Scenario: Stability runs record per-spec results with worker context
    Given the full E2E suite runs repeatedly
    When a stability run completes
    Then the ledger records each spec's pass/fail with worker index and run index
    And the 0005 verdict counts only the three target specs

  # ── Sequential registrations (workspace-registration.spec.ts:175) ──

  @sequential-registration @e2e @delta-added
  Scenario: Sequential workspace registrations open fresh forms only after the previous registration settles
    Given a workspace is registered through the open-workspace form
    When a second workspace registration starts immediately after the first
    Then the second form opens only after the first registration has settled
    And the second form is empty and ready for input

  @sequential-registration @integration @delta-added
  Scenario: The canonical registration helper settles before the next registration starts
    Given a simulated page models the deferred invalidation of a registration
    When the canonical helper completes the first registration
    Then the helper does not return before the deferred invalidation settles
    And a second registration never opens while the first is still settling

  @sequential-registration @e2e @delta-added
  Scenario: The second registration form is asserted empty before the second submit
    Given the first workspace registration is completed
    When the second registration form opens
    Then the test asserts the path and name inputs are empty before the second submit
    And the second submit uses the event-driven registration barrier

  # ── Observation CRUD readiness/response ordering (line-selection.spec.ts:276) ──

  @observation-crud @e2e @delta-added
  Scenario: Observation creation waits for the reload before the card assertion
    Given an observation form is filled for a selected line range
    When the user creates the observation
    Then the test waits for the create POST response and the observations reload GET
    And the observation card assertion runs only after the reload completes

  @observation-crud @e2e @delta-added
  Scenario: Observation deletion waits for the delete response before the removal assertion
    Given an observation card is visible in the observation panel
    When the user deletes the observation
    Then the test waits for the delete response before asserting the card list
    And the card removal assertion does not rely on networkidle alone

  @observation-crud @integration @delta-added
  Scenario: Observation list refresh ordering is deterministic under response barriers
    Given a simulated page models the observation list reload after create
    When the harness asserts card visibility with response barriers
    Then the assertion observes the refreshed list
    And the assertion does not depend on generic networkidle timing

  # ── Worker-test diagnostics (transient flake) ──

  @worker-test-diagnostics @integration @delta-added
  Scenario: Worker server test flakes are recorded with exact name and run context
    Given the integration worker-server suite runs repeatedly under load
    When a test fails transiently
    Then the failure is recorded with its exact test name, run index, and error output
    And no lifecycle change is applied without repeated evidence

  @worker-test-diagnostics @e2e @delta-added
  Scenario: Line-selection resolve test flakes are recorded with exact name and run context
    Given the line-selection resolve test runs repeatedly under load
    When a test fails transiently
    Then the failure is recorded with its exact test name, run index, worker context, and error output
    And no change is applied without repeated evidence

  # ── Enhanced failure diagnostics (approved at on_done, plan §5.4) ──

  @enhance-diagnostics @e2e @delta-added
  Scenario: Failure diagnostics capture form identity, submit evidence, and worker context
    Given a workspace registration fails under full-suite load
    When the failure is captured
    Then the diagnostics record the form identity and attach/detach history
    And the diagnostics record the submit ordinal, target, and defaultPrevented
    And the diagnostics record navigation, page errors, failed resources, and worker context
    And the diagnostics distinguish the first and second submit and old vs replaced forms

  @enhance-diagnostics @integration @delta-added
  Scenario: The observer records attach, detach, and submit without calling preventDefault
    Given a simulated page attaches and detaches the enhanced submit listener
    When the observer records the lifecycle
    Then attach and detach events are recorded with form identity and timestamps
    And submit events are recorded with ordinal, target, and defaultPrevented
    And the observer never calls preventDefault

  @enhance-diagnostics @integration @delta-added
  Scenario: The lifecycle-aware guard fails fast when the observed form is replaced
    Given a simulated page replaces the observed form after the listener attaches
    When the guard verifies the form before the submit
    Then the guard fails fast with form-identity diagnostics
    And no native submit occurs