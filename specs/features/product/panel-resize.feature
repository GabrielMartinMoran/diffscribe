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

  # ────── Resize alignment measurement ──────

  @delta-added @product @layout @p1 @ui @e2e
  Scenario: Resizing keeps the panel edge, the handle, and the grid column aligned without a gap
    Given the left panel width is 300 px
    When the user drags the left resize handle by 80 px
    Then the left panel edge moves to the same x position as the resize handle
    And the grid template column for the left panel matches the handle x position
    And the center column starts exactly at the handle x position
    When the user drags the right resize handle by -60 px
    Then the right panel edge moves to the same x position as the resize handle
    And the grid template column for the right panel matches the handle x position
    And the center column ends exactly at the handle x position

  # ────── Collapsed right panel strip ──────

  @product @layout @panels @etapa-1
  Scenario: PANELS-UI-05 — collapsed right panel renders a vertical strip
    Given the right panel is collapsed
    When the user views the collapsed right panel
    Then a vertical strip with Comments and Review tabs is visible
    And the strip is 48 px wide

  @product @layout @panels @etapa-1
  Scenario: PANEL-STRIP-01 — collapsed desktop shows a vertical Comments/Review tablist
    Given the right panel is collapsed on desktop
    Then the collapsed panel exposes a vertical tablist with Comments and Review tabs
    And each strip tab has an accessible label

  @product @layout @panels @etapa-1
  Scenario: PANEL-STRIP-02 — clicking a strip tab expands the panel and selects the tab
    Given the right panel is collapsed
    When the user clicks the Review strip tab
    Then the right panel expands
    And the Review tab is selected in the expanded panel

  @product @layout @panels @etapa-1
  Scenario: PANEL-STRIP-03 — collapsing returns focus to the active strip tab
    Given the right panel is expanded with the Comments tab active
    When the user collapses the right panel
    Then focus returns to the active strip tab
