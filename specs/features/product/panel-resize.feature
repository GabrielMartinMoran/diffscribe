@product @layout @panels @etapa-1
Feature: Panel resize and collapse — collapsible panels with bounded resize and persistent preference

  The left contextual panel and the right panel can be collapsed and expanded
  independently. Resize handles between adjacent regions respect explicit
  minimum and maximum width constraints. A keyboard-accessible action resets
  the panel layout to its default widths. The panel layout preference is
  stored locally and restored on application reload. Resizing one panel does
  not push the other off-screen or create page-level overflow.

  Background:
    Given DiffScribe is started
    And a workspace is registered and active

  # ────── Collapse and expand ──────

  @product @layout @p2 @ui @e2e
  Scenario: Left panel can be collapsed and expanded
    Given the left contextual panel is visible
    When the user clicks the collapse button on the left panel
    Then the left panel collapses to zero width or hides completely
    And the center region expands to fill the available space
    When the user clicks the expand button or rail icon
    Then the left panel reappears at its previous width

  @product @layout @p2 @ui @e2e
  Scenario: Right panel can be collapsed and expanded
    Given the right panel is visible
    When the user clicks the collapse button on the right panel
    Then the right panel collapses to zero width or hides completely
    And the center region expands to fill the available space
    When the user clicks the expand button
    Then the right panel reappears at its previous width

  @product @layout @p2 @ui @e2e
  Scenario: Collapse state is preserved across tab switches
    Given the left panel is collapsed
    When the user switches from the Project tab to the Git tab
    Then the left panel remains collapsed

  # ────── Resize constraints ──────

  @product @layout @p2 @ui @e2e
  Scenario: Resize handle respects the panel minimum width
    Given the left panel width is 300 px
    And the minimum width is 200 px
    When the user drags the resize handle to reduce the panel width below 200 px
    Then the panel width stops at 200 px
    And the resize handle cannot be dragged further

  @product @layout @p2 @ui @e2e
  Scenario: Resize handle respects the panel maximum width
    Given the left panel width is 300 px
     And the maximum width is 480 px
     When the user drags the resize handle to increase the panel width beyond 480 px
     Then the panel width stops at 480 px
    And the resize handle cannot be dragged further

  @product @layout @p2 @ui @e2e
  Scenario: Resize handle is visually distinct and accessible
    Given the left panel is visible
    When the user views the boundary between the left panel and the center region
    Then a resize handle is visible
    And the resize handle has an accessible role and label

  # ────── Keyboard reset ──────

  @product @layout @p2 @ui @e2e
  Scenario: Keyboard-accessible action resets the panel layout to defaults
    Given the left panel width has been resized to 400 px
    And the right panel width has been resized to 350 px
    When the user triggers the reset layout action
    Then the left panel returns to its default width
    And the right panel returns to its default width

  # ────── Persistence ──────

  @product @layout @p2 @ui @e2e
  Scenario: Panel layout preference is restored on reload
    Given the left panel is collapsed
    And the right panel width is 400 px
    When the user reloads the application
    Then the left panel remains collapsed
    And the right panel width is 400 px

  @product @layout @p2 @ui @e2e
  Scenario: Invalid stored layout preference safely falls back
    Given localStorage contains an invalid layout value for the left panel
    When the application loads
    Then the left panel uses its default width
    And no error is shown to the user

  # ────── Overflow prevention ──────

  @product @layout @p2 @ui @e2e
  Scenario: Resizing panels does not create page overflow
    Given the left panel is at its maximum width
    When the user views the application
    Then no horizontal scrollbar appears
    And all visible content fits within the viewport

  @product @layout @p2 @ui @e2e
  Scenario: Both panels collapsed leaves only the center and rail visible
    Given the left panel is collapsed
    And the right panel is collapsed
    When the user views the application
    Then the left rail is visible
    And the center region fills the remaining width
    And no empty panel frames are displayed

  @delta-added @product @layout @p2 @ui @e2e
  Scenario: Both panels collapsed after hydration maintains rail and center visible
    Given DiffScribe is started
    And a workspace is registered and active
    And the left panel is collapsed
    And the right panel is collapsed
    When the application hydrates
    Then the left rail is visible
    And the center region fills the remaining width
    And no empty panel frames are displayed
