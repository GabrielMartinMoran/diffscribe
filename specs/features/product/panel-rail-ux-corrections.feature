@product/panel-rail-ux-corrections @product @navigation @a11y @layout @etapa-1
Feature: Panel rail UX corrections — desktop vertical right navigation, consistent collapsed expansion, and bottom controls

  Desktop panel/rail corrections: the right panel navigates with vertical
  icons in both expanded and collapsed states, selecting an option in a
  collapsed panel expands it on both sides, bottom collapse/reopen controls
  are bottom-aligned, and collapsed content stays out of the accessibility
  tree. On desktop the right-panel tab icons sit on the panel's right edge.
  The left collapse/expand control is the bottom-most control of the left
  region with Help directly above it. Mobile drawer/sheet behavior is
  preserved.

  Background:
    Given the workbench shell is loaded

  @product @navigation @a11y @e2e @delta-added
  Scenario: Expanded desktop right navigation is vertical with one tablist
    Given the right panel is expanded on desktop
    When the user views the right panel navigation
    Then the expanded panel exposes exactly one vertical tablist with Comments and Review tabs
    And activating Review selects it without collapsing the panel

  @product @navigation @a11y @e2e @delta-added
  Scenario: Right panel tabs link to real tabpanels
    Given the right panel is expanded on desktop
    When the user inspects the Comments tab
    Then the tab aria-controls target exists as a tabpanel linked to the tab by aria-labelledby
    And the inactive Review tabpanel is hidden while the Comments tabpanel is visible

  @product @navigation @e2e @delta-added
  Scenario: Collapsed right option expands the panel and selects the option
    Given the right panel is collapsed
    When the user activates a tab in the collapsed strip
    Then the panel expands and shows that tab

  @product @layout @e2e @delta-added
  Scenario: Collapsed right strip exposes a bottom expand control
    Given the right panel is collapsed
    When the user views the collapsed right strip
    Then a bottom expand control is visible at the bottom of the strip
    When the user activates the expand control
    Then the panel expands without changing the selected tab

  @product @navigation @e2e @delta-added
  Scenario: Selecting a collapsed left rail option expands the panel
    Given the left panel is collapsed
    When the user selects the Project rail option
    Then the Project option is selected and the left panel expands
    When the user selects the Git rail option with the panel open
    Then the Git option is selected and the panel stays open

  @product @a11y @e2e @delta-added
  Scenario: Collapsing the left panel moves focus to a visible control
    Given the left panel is expanded
    When the user collapses the left panel
    Then focus moves to a visible rail control
    And the collapsed panel content is inert and hidden from the accessibility tree

  @product @layout @e2e @delta-modified
  Scenario: Left rail bottom controls are bottom-aligned with Help above the control
    # CHANGED: the collapse/reopen control is the bottom-most control with Help directly above it (was: Help below reopen)
    Given the left panel is collapsed
    When the user views the left rail
    Then the reopen control is the bottom-most control of the left region
    And the Help control is directly above the reopen control

  @product @layout @e2e @delta-added
  Scenario: Right panel fits its grid column
    Given the right panel is expanded on desktop
    When the panel geometry is measured
    Then the panel width equals its grid column and its right edge reaches the viewport edge

  @product @layout @e2e @delta-added
  Scenario: Desktop right-panel tab icons sit on the panel right edge
    Given the right panel is expanded on desktop
    When the navigation geometry is measured
    Then the vertical tablist right edge aligns with the panel right edge
    And the tablist sits to the right of the panel content
    And the tablist remains a single vertical tablist with Comments and Review

  @product @a11y @e2e @delta-added
  Scenario: Icon-only controls expose accessible names and a visible title fallback
    Given the left panel is collapsed
    When the user inspects the rail controls
    Then every icon-only control has an accessible label and a title attribute

  @product @responsive @e2e @delta-added
  Scenario: Mobile sheet keeps horizontal navigation and drawer behavior
    Given the viewport width is 375 px
    When the user opens the right panel sheet
    Then the sheet header keeps horizontal Comments and Review tabs
    And the left drawer opens from a rail tap without a desktop expansion