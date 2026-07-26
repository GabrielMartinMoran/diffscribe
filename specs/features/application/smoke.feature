@smoke
Feature: Smoke — verificacion tecnica de tooling

  El proposito de estos escenarios es confirmar que el runner de BDD funciona.
  No describen comportamiento del workbench.

  Scenario: Aritmetica basica
    Given tengo el numero 2
    When le sumo 3
    Then el resultado es 5

  Scenario Outline: Sumas parametrizadas
    Given tengo el numero <a>
    When le sumo <b>
    Then el resultado es <esperado>

    Examples:
      | a | b  | esperado |
      | 1 | 1  | 2        |
      | 0 | 5  | 5        |
      | 7 | -2 | 5        |
