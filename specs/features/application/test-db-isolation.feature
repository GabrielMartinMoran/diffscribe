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

  @in-memory
  Scenario: In-memory database is used when E2E in-memory flag is set
    When DIFFSCRIBE_E2E_IN_MEMORY_DB is set to "1"
    And getDb is called
    Then the database connection is in-memory

  @in-memory
  Scenario: Repeated getDb calls return the same in-memory singleton
    When DIFFSCRIBE_E2E_IN_MEMORY_DB is set to "1"
    And getDb is called twice
    Then both calls return the same database instance

  @in-memory
  Scenario: Foreign keys are enabled in in-memory mode
    When DIFFSCRIBE_E2E_IN_MEMORY_DB is set to "1"
    And getDb is called
    Then foreign keys are enabled

  @db-safety
  Scenario: In-memory flag is rejected when NODE_ENV is production
    When NODE_ENV is set to "production"
    And DIFFSCRIBE_E2E_IN_MEMORY_DB is set to "1"
    And getDb is called
    Then an error is thrown with message containing "not allowed in production"

  @reset @in-memory
  Scenario: In-memory database reset clears data and preserves schema
    Given DIFFSCRIBE_E2E_IN_MEMORY_DB is set to "1"
    And the test database singleton is seeded with app_state and workspaces
    When the in-memory singleton is reset
    Then the database has no app_state or workspaces rows
    And the _migrations table is preserved

  @reset @in-memory
  Scenario: In-memory reset without prior getDb lazy-initializes the singleton
    Given DIFFSCRIBE_E2E_IN_MEMORY_DB is set to "1"
    When the in-memory singleton is reset before getDb
    Then the in-memory reset succeeds
    And the database connection is in-memory
    And the database has no app_state or workspaces rows
    And the _migrations table is preserved
