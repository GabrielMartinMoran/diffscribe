@smoke
Feature: Smoke — technical tooling verification

  The purpose of these scenarios is to confirm that the BDD runner works.
  They do not describe workbench behavior.

  Scenario: Basic arithmetic
    Given I have the number 2
    When I add 3
    Then the result is 5

  Scenario Outline: Parameterized additions
    Given I have the number <a>
    When I add <b>
    Then the result is <expected>

    Examples:
      | a | b  | expected |
      | 1 | 1  | 2        |
      | 0 | 5  | 5        |
      | 7 | -2 | 5        |
