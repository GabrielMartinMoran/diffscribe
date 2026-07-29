@product @theme @ui @etapa-1
Feature: Theme switching — default dark theme, Synthwave '84 alternative, and persistent local preference

  The application renders in the "Dark Deep" theme before the first paint.
  The user can switch to the "Synthwave '84" theme, whose palette contains
  the approved five source colors. The chosen theme preference persists in
  browser localStorage and restores on reload. An invalid or missing stored
  key safely falls back to the default. Focus indicators, text contrast, and
  diff change colors remain distinguishable in both themes.

  Background:
    Given DiffScribe is started

  # ────── Default theme ──────

  @product @theme @p1 @ui @e2e
  Scenario: Dark Deep is the default theme before the first user interaction
    Given no theme preference has been stored
    When the application loads
    Then the applied theme is "Dark Deep"
    And the UI background, text, and accent colors match the Dark Deep token set

  @product @theme @p1 @ui @e2e
  Scenario: Dark Deep is applied before the first paint
    Given the application is loading
    When the initial HTML is rendered
    Then the document has `data-theme="dark"` before any JavaScript executes

  # ────── Theme switch ──────

  @product @theme @p1 @ui @e2e
  Scenario: User can switch to Synthwave '84
    Given the application is in the "Dark Deep" theme
    When the user selects "Synthwave '84" from the theme selector
    Then the applied theme changes to "Synthwave '84"
    And the UI background, text, and accent colors match the Synthwave '84 token set

  @product @theme @p1 @ui @e2e
  Scenario: Switching back to Dark Deep from Synthwave '84
    Given the application is in the "Synthwave '84" theme
    When the user selects "Dark Deep" from the theme selector
    Then the applied theme reverts to "Dark Deep"

  # ────── Synthwave palette ──────

  @product @theme @p1 @ui @bdd
  Scenario: Synthwave '84 palette contains the five approved source colors
    Given the Synthwave '84 theme is active
    When the user inspects the CSS custom properties for Synthwave '84
    Then the palette includes the color "#920075"
    And the palette includes the color "#2e2157"
    And the palette includes the color "#2de2e6"
    And the palette includes the color "#540d6e"
    And the palette includes the color "#0d0221"

  # ────── Persistence ──────

  @product @theme @p1 @ui @e2e
  Scenario: Theme preference persists across page reloads via localStorage
    Given the user has selected "Synthwave '84"
    When the user reloads the application
    Then the applied theme is "Synthwave '84"

  @product @theme @p1 @ui @e2e
  Scenario: Invalid stored theme key falls back to Dark Deep
    Given localStorage contains an invalid theme key "nonexistent-theme"
    When the application loads
    Then the applied theme is "Dark Deep"
    And no error is shown to the user

  # ────── Accessibility and contrast ──────

  @product @theme @p1 @ui @e2e
  Scenario: Focus indicators remain distinguishable in both themes
    Given the application is in the "Dark Deep" theme
    When the user tabs to a focusable element
    Then the focus ring or outline is visible and distinguishable from the background
    When the user switches to "Synthwave '84"
    And tabs to the same element
    Then the focus ring or outline is visible and distinguishable from the background

  @product @theme @p1 @ui @e2e
  Scenario: Text contrast meets readability in both themes
    Given the application is in the "Dark Deep" theme
    Then body text has sufficient contrast against the background
    When the user switches to "Synthwave '84"
    Then body text has sufficient contrast against the background

  @product @theme @p1 @ui @e2e
  Scenario: Diff change colors remain distinguishable in both themes
    Given the application is in the "Dark Deep" theme
    When the user views diff content
    Then added lines and deleted lines are visually distinct from each other and from unchanged lines
    When the user switches to "Synthwave '84"
    Then added lines and deleted lines remain visually distinct from each other and from unchanged lines
