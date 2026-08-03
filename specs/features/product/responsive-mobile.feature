@product @responsive @layout @etapa-1
Feature: Responsive layout — desktop four-region layout and mobile-optimized drawers

  On desktop viewports the application displays four visible regions: the
  left rail, the left contextual panel, the center content region, and the
  right panel. On mobile viewports the center region remains the primary
  focus; the left and right panels become dismissible drawers or sheets that
  overlay the center when opened. Focus returns to the trigger element when a
  drawer closes. No page-level horizontal overflow occurs at any viewport.
  The diff view falls back to unified layout when side-by-side cannot fit.

  Background:
    Given DiffScribe is started
    And a workspace is registered and active
    And the active Comparison is HEAD vs working tree
    And the working tree has changed files

  # ────── Desktop layout ──────

  @product @responsive @p1 @ui @e2e
  Scenario: Desktop viewport shows all four layout regions
    Given the viewport width is 1440 px
    When the user views the application
    Then the left rail is visible
    And the left contextual panel is visible
    And the center content region is visible
    And the right panel is visible
    And all four regions fit within the viewport without horizontal scrolling

  @product @responsive @p1 @ui @e2e
  Scenario: Desktop layout preserves regions across tab switches
    Given the viewport width is 1440 px
    And the Project tab is active
    When the user switches to the Git tab
    Then the left rail, left contextual panel, center region, and right panel remain visible

  # ────── Mobile layout ──────

  @product @responsive @p1 @ui @e2e
  Scenario: Mobile viewport keeps the center region usable
    Given the viewport width is 375 px
    When the user views the application
    Then the center content region fills most of the viewport width
    And the left contextual panel is hidden
    And the right panel is hidden

  @product @responsive @p1 @ui @e2e
  Scenario: Left panel opens as a dismissible drawer on mobile
    Given the viewport width is 375 px
    When the user taps the rail icon for the Project tab
    Then the left panel opens as an overlay drawer
    And the center region is partially obscured behind the drawer
    When the user taps the close action or the backdrop
    Then the drawer closes
    And the center region is fully visible again

  @product @responsive @p1 @ui @e2e
  Scenario: Right panel opens as a dismissible sheet on mobile
    Given the viewport width is 375 px
    When the user taps the right panel toggle
    Then the right panel opens as an overlay sheet
    And the center region is partially obscured behind the sheet
    When the user taps the close action or the backdrop
    Then the sheet closes
    And the center region is fully visible again

  @delta-added @product @responsive @p1 @ui @e2e
  Scenario: Mobile viewport 375px confirms rail and center visible after wrapper
    Given the viewport width is 375 px
    When the user views the application
    Then the left rail is visible
    And the center content region is visible
    And the left contextual panel is hidden
    And the right panel is hidden

  @product @responsive @p1 @ui @e2e
  Scenario: Focus returns to the trigger element when a drawer closes
    Given the left panel drawer is open on mobile
    And it was opened by tapping the Project tab icon
    When the user closes the drawer
    Then keyboard focus returns to the Project tab icon

  # ────── Overflow prevention ──────

  @product @responsive @p1 @ui @e2e
  Scenario Outline: No page-level horizontal overflow at any viewport width
    Given the viewport width is <width>
    When the user views the application
    Then no horizontal scrollbar is present on the page
    And the html element does not overflow horizontally

    Examples:
      | width |
      | 1440  |
      | 900   |
      | 375   |
      | 320   |

  # ────── Diff layout fallback ──────

  @product @responsive @p1 @ui @e2e
  Scenario: Diff viewer falls back to unified layout when side-by-side cannot fit
    Given the viewport width is 375 px
    And a diff is being viewed
    When the user opens the diff viewer
    Then the diff is displayed in unified layout
    And no side-by-side toggle is available

  # ────── Mobile overlay stacking (hardening H2) ──────

  @delta-added @product @responsive @p1 @ui @e2e
  Scenario: Right sheet controls stay clickable above the backdrop on mobile
    Given the viewport width is 375 px
    And the right panel sheet is open
    When the user inspects the sheet controls
    Then the sheet controls are clickable above the backdrop
    And the backdrop does not intercept sheet clicks

  @delta-added @product @responsive @p1 @ui @e2e
  Scenario: Left drawer controls stay clickable above the backdrop on mobile
    Given the viewport width is 375 px
    And the left panel drawer is open
    When the user inspects the drawer controls
    Then the drawer controls are clickable above the backdrop

  # ────── Mobile right panel toggle (hardening H3) ──────

  @delta-added @product @responsive @p1 @ui @e2e
  Scenario: Collapsed right panel toggle is at least 24x24 and spans the center height at 320 px
    Given the viewport width is 320 px
    When the user inspects the right panel toggle
    Then the right panel toggle is at least 24 by 24 pixels
    And the right panel toggle spans the full center content height
    And the mobile shell has no extra grid row

  @delta-added @product @responsive @p1 @ui @e2e
  Scenario: Right panel toggle opens and closes the sheet at 375 px
    Given the viewport width is 375 px
    And the right panel is hidden
    When the user taps the right panel toggle
    Then the right panel opens as an overlay sheet
    When the user taps the right panel toggle again
    Then the right panel is hidden again
