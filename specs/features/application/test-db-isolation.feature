Feature: Test database isolation

  Vitest and BDD test workers must never touch the production database at
  ~/.diffscribe. The connection module must fail-closed when running under
  Vitest without an explicit DIFFSCRIBE_DB_DIR.

  Background:
    Given the Vitest test environment is active

  Scenario: Tests throw when DIFFSCRIBE_DB_DIR is not set under Vitest
    When DIFFSCRIBE_DB_DIR is absent
    And getDb is called
    Then an error is thrown with message containing "DIFFSCRIBE_DB_DIR must be set"

  Scenario: Tests permit connection when VITEST is not set
    When VITEST is not set
    And a safe temp DIFFSCRIBE_DB_DIR is provided
    And getDb is called
    Then the database connection succeeds without error

  Scenario: Tests permit connection under Vitest with a safe temp directory
    When VITEST is set
    And a safe temp DIFFSCRIBE_DB_DIR is provided
    And getDb is called
    Then the database connection succeeds without error
    And the database path is under the configured temp directory
