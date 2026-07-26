@application @pre-commit
Feature: Pre-commit quality gate

  El hook pre-commit ejecuta verificaciones de formato y lint sin modificar
  archivos. Bloquea el commit si alguna verificación falla.

  Background:
    Given que el hook pre-commit esta configurado
      And los archivos estan stageados para commit

  Scenario: Hook pasa cuando formato y lint estan limpios
    When ejecuto el hook pre-commit
    Then el hook termina con codigo de salida 0
      And no hay archivos modificados en el working tree

  Scenario: Fallo de Prettier bloquea el commit
    Given que hay un archivo con formato incorrecto stageado
    When ejecuto el hook pre-commit
    Then el hook termina con codigo de salida distinto de 0
      And el mensaje de error contiene "prettier"

  Scenario: Fallo de ESLint bloquea el commit
    Given que hay un archivo con error de lint stageado
    When ejecuto el hook pre-commit
    Then el hook termina con codigo de salida distinto de 0
      And el mensaje de error contiene "eslint" o "error"

  Scenario: El hook no modifica archivos incluso ante fallo
    Given que hay un archivo con formato incorrecto stageado
    When ejecuto el hook pre-commit
    Then el archivo con formato incorrecto conserva su contenido original
