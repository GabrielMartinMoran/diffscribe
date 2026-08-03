@quality @tokens @theme @etapa-1
Feature: Design token contract — every UI token is declared and applied correctly across themes

  Every CSS custom property (design token) referenced by the redesigned
  components must be declared in the global token contract for both Dark Deep
  and Synthwave '84 themes. A static check verifies that no component
  references a token that is not declared. Missing tokens cause the check to
  fail with the token name. Shiki token colors in the diff viewer and source
  view are applied as computed CSS color values, not as raw inline attributes
  that bypass the theme system.

  Background:
    Given DiffScribe is started

  # ────── Token declaration ──────

  @quality @tokens @p1 @ui @bdd
  Scenario: Every UI token in the redesigned components is declared in the Dark Deep theme
    Given the Dark Deep theme is the active theme
    When a static audit checks all used CSS custom properties against the Dark Deep contract
    Then every referenced token has a declaration in the Dark Deep token set

  @quality @tokens @p1 @ui @bdd
  Scenario: Every UI token in the redesigned components is declared in the Synthwave '84 theme
    Given the Synthwave '84 theme is active
    When a static audit checks all used CSS custom properties against the Synthwave '84 contract
    Then every referenced token has a declaration in the Synthwave '84 token set

  @quality @tokens @p1 @ui @bdd
  Scenario: Token declarations cover background, text, accent, border, diff, and focus categories
    Given the global token contract for the Dark Deep theme
    When the token categories are enumerated
    Then the contract includes background tokens
    And the contract includes text tokens
    And the contract includes accent tokens
    And the contract includes border tokens
    And the contract includes diff change tokens
    And the contract includes focus indicator tokens

  # ────── Missing token detection ──────

  @quality @tokens @p1 @ui @bdd
  Scenario: Missing token check fails and reports the token name
    Given a component references the undeclared token "--color-nonexistent"
    When the static token audit runs
    Then the audit fails
    And the audit output includes "--color-nonexistent"

  @quality @tokens @p1 @ui @bdd
  Scenario: All declared tokens are present in both themes
    Given the set of tokens declared in the Dark Deep theme
    When compared to the Synthwave '84 theme
    Then every token in the Dark Deep set also exists in the Synthwave '84 set
    And every token in the Synthwave '84 set also exists in the Dark Deep set

  # ────── Shiki token colors ──────

  @quality @tokens @p1 @ui @bdd
  Scenario: Shiki token colors are applied as computed CSS values, not as raw inline attributes
    Given the source view displays syntax-highlighted TypeScript code
    When the user inspects the highlighted tokens in the DOM
    Then each token's color is applied via a CSS custom property or computed style
    And no token uses a raw inline color attribute

  @quality @tokens @p1 @ui @bdd
  Scenario: Shiki token colors respect the active theme
    Given the source view displays highlighted TypeScript code
    And the active theme is "Dark Deep"
    When the user switches to "Synthwave '84"
    Then Shiki token colors update to match the Synthwave '84 palette
    And no hard-coded Dark Deep colors remain visible

  # ────── Auxiliary / semantic tokens ──────

  @quality @tokens @p1 @ui @bdd
  Scenario: Error and warning semantic tokens are declared in both themes
    Given the Dark Deep theme token contract
    When the error and warning token families are enumerated
    Then all error and warning tokens are declared in the Dark Deep theme
    And all error and warning tokens exist in the Synthwave '84 theme

  @quality @tokens @p1 @ui @bdd
  Scenario: Color semantic tokens for status badges are declared in both themes
    Given the Dark Deep theme token contract
    When the color semantic tokens are enumerated
    Then all color semantic tokens are declared in the Dark Deep theme
    And all color semantic tokens exist in the Synthwave '84 theme

  @quality @tokens @p1 @ui @bdd
  Scenario: Diff foreground tokens are declared in both themes
    Given the Dark Deep theme token contract
    When the diff token families are enumerated
    Then all diff foreground tokens are declared in the Dark Deep theme
    And all diff foreground tokens exist in the Synthwave '84 theme

  @quality @tokens @p1 @ui @bdd
  Scenario: Surface hover token is declared in both themes
    Given the Dark Deep theme token contract
    When the surface-hover token is checked
    Then --surface-hover is declared in the Dark Deep theme
    And --surface-hover exists in the Synthwave '84 theme

  @quality @tokens @p1 @ui @bdd
  Scenario: Selection and font-family tokens are declared in both themes
    Given the Dark Deep theme token contract
    When the auxiliary tokens are enumerated
    Then all auxiliary tokens are declared in the Dark Deep theme
    And all auxiliary tokens exist in the Synthwave '84 theme

  @quality @tokens @p1 @ui @bdd
  Scenario: Observation type badge tokens are declared for light base and both themes
    Given the global :root token contract
    When observation badge tokens are enumerated
    Then all observation badge tokens are declared in the :root theme
    And all observation badge tokens exist in the Dark Deep theme
    And all observation badge tokens exist in the Synthwave '84 theme

  @quality @tokens @p1 @ui @bdd
  Scenario: Observation severity badge tokens are declared for light base and both themes
    Given the global :root token contract
    When observation severity badge tokens are enumerated
    Then all observation severity badge tokens are declared in the :root theme
    And all observation severity badge tokens exist in the Dark Deep theme
    And all observation severity badge tokens exist in the Synthwave '84 theme

  @quality @tokens @p1 @ui @bdd
  Scenario: Observation status dot tokens are declared for light base and both themes
    Given the global :root token contract
    When observation status dot tokens are enumerated
    Then all observation status dot tokens are declared in the :root theme
    And all observation status dot tokens exist in the Dark Deep theme
    And all observation status dot tokens exist in the Synthwave '84 theme

  @quality @tokens @p1 @ui @bdd
  Scenario: Source viewer marker tokens are declared for light base and both themes
    Given the global :root token contract
    When source viewer marker tokens are enumerated
    Then all source viewer marker tokens are declared in the :root theme
    And all source viewer marker tokens exist in the Dark Deep theme
    And all source viewer marker tokens exist in the Synthwave '84 theme

  @quality @tokens @p1 @ui @bdd
  Scenario: Project tree status dot tokens are declared for light base and both themes
    Given the global :root token contract
    When project tree status dot tokens are enumerated
    Then all project tree status dot tokens are declared in the :root theme
    And all project tree status dot tokens exist in the Dark Deep theme
    And all project tree status dot tokens exist in the Synthwave '84 theme

  # ────── Hardcoded hex prohibition ──────

  @quality @tokens @p1 @ui @bdd
  Scenario: Observation badges do not use hardcoded hex colors
    Given the observation card component styles
    When the type badge CSS rules are inspected
    Then no hardcoded hex color values are used for badge backgrounds or foregrounds
    And all badge colors reference CSS custom properties

  @quality @tokens @p1 @ui @bdd
  Scenario: Observation severity badges do not use hardcoded hex colors
    Given the observation card component styles
    When the severity badge CSS rules are inspected
    Then no hardcoded hex color values are used for severity badge backgrounds or foregrounds
    And all severity colors reference CSS custom properties

  @quality @tokens @p1 @ui @bdd
  Scenario: Observation status dots do not use hardcoded hex colors
    Given the observation card component styles
    When the status dot CSS rules are inspected
    Then no hardcoded hex color values are used for status dot backgrounds
    And all status dot colors reference CSS custom properties

  @quality @tokens @p1 @ui @bdd
  Scenario: Source viewer markers do not use hardcoded hex colors
    Given the source viewer component styles
    When the change marker CSS rules are inspected
    Then no hardcoded hex color values are used for marker backgrounds
    And all marker colors reference CSS custom properties

  @quality @tokens @theme @etapa-1
  Scenario: TOKEN-02 — the --text-2xs token is declared in every theme block and used with an ellipsis
    Given the global token contract
    When the text token family is enumerated
    Then --text-2xs is declared in the :root token block
    And --text-2xs is declared in the Dark Deep token block
    And --text-2xs is declared in the Synthwave '84 token block
    And the rail label styles use --text-2xs with nowrap and ellipsis truncation
