@technical @post-setup
Feature: Post-setup discrepancies — verificacion de correcciones D1, D2 y D3

  Verifica que las discrepancias detectadas despues del scaffold inicial
  fueron corregidas: parity de tokens de diseno, separacion de tests
  unitarios e integracion, y dependencias seguras sin vulnerabilidades
  high ni moderate.

  Scenario: El token --shadow-none esta presente en ambos temas de tokens.css
    Given el archivo de tokens CSS existe
    When leo el bloque :root
    Then contiene --shadow-none: none antes de --shadow-sm
    When leo el bloque [data-theme="dark"]
    Then contiene --shadow-none: none antes de --shadow-sm

  Scenario: La tabla y los bloques CSS de referencia en design.md tienen --shadow-none
    Given que existe el archivo de diseno
    Then la tabla de sombras incluye la fila --shadow-none con valor none
    And el bloque CSS :root contiene --shadow-none: none antes de --shadow-sm
    And el bloque CSS [data-theme="dark"] contiene --shadow-none: none antes de --shadow-sm

  Scenario: Tests unitarios e integracion no se solapan
    Given existe el archivo de configuracion de Vitest
    When leo la configuracion de Vitest
    Then los proyectos unit e integration tienen includes disjuntos
    And el proyecto unit solo incluye tests-unit
    And el proyecto integration solo incluye tests-integration

  Scenario: npm audit no tiene vulnerabilidades high ni moderate
    Given el proyecto tiene dependencias instaladas
    When ejecuto npm audit con salida JSON
    Then el resultado tiene 0 vulnerabilidades critical
    And el resultado tiene 0 vulnerabilidades high
    And el resultado tiene 0 vulnerabilidades moderate

  Scenario: Los scripts test:unit y test:integration usan --project
    Given existe el archivo package json
    Then el script test-unit ejecuta vitest run con project unit
    And el script test-integration ejecuta vitest run con project integration
