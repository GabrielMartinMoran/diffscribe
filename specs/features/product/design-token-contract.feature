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
