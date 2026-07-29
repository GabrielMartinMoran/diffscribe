@technical @post-setup
Feature: Post-setup discrepancies — D1, D2, and D3 fix verification

  Verifies that the discrepancies detected after the initial scaffold
  have been fixed: design token parity, separation of unit and integration
  tests, and secure dependencies with no high or moderate vulnerabilities.

  Scenario: The --shadow-none token is present in both themes in tokens.css
    Given the CSS tokens file exists
    When I read the :root block
    Then it contains --shadow-none: none before --shadow-sm
    When I read the [data-theme="dark"] block
    Then it contains --shadow-none: none before --shadow-sm

  Scenario: The reference table and CSS blocks in design.md include --shadow-none
    Given the design file exists
    Then the shadows table includes the row --shadow-none with value none
    And the :root CSS block contains --shadow-none: none before --shadow-sm
    And the [data-theme="dark"] CSS block contains --shadow-none: none before --shadow-sm

  Scenario: Unit and integration tests do not overlap
    Given the Vitest configuration file exists
    When I read the Vitest configuration
    Then the unit and integration projects have disjoint includes
    And the unit project only includes tests-unit
    And the integration project only includes tests-integration

  Scenario: npm audit has no high or moderate vulnerabilities
    Given the project has dependencies installed
    When I run npm audit with JSON output
    Then the result has 0 critical vulnerabilities
    And the result has 0 high vulnerabilities
    And the result has 0 moderate vulnerabilities

  Scenario: The test:unit and test:integration scripts use --project
    Given the package json file exists
    Then the test-unit script runs vitest run with project unit
    And the test-integration script runs vitest run with project integration
