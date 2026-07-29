@application @pre-commit
Feature: Pre-commit quality gate

  The pre-commit hook runs format and lint checks without modifying
  files. It blocks the commit if any check fails.

  Background:
    Given the pre-commit hook is configured
      And files are staged for commit

  Scenario: Hook passes when format and lint are clean
    When I run the pre-commit hook
    Then the hook exits with code 0
      And there are no modified files in the working tree

  Scenario: Prettier failure blocks the commit
    Given there is a file with incorrect formatting staged
    When I run the pre-commit hook
    Then the hook exits with a non-zero code
      And the error message contains "prettier"

  Scenario: ESLint failure blocks the commit
    Given there is a file with a lint error staged
    When I run the pre-commit hook
    Then the hook exits with a non-zero code
      And the error message contains "eslint" or "error"

  Scenario: The hook does not modify files even on failure
    Given there is a file with incorrect formatting staged
    When I run the pre-commit hook
    Then the incorrectly formatted file retains its original content
