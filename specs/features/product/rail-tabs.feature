@product @navigation @layout @etapa-1
Feature: Rail tabs — compact icon rail, left contextual panel, and right panel with tab switching

  The left side of the application consists of a compact 48 px icon rail and
  an expandable contextual panel. The rail exposes Workspaces, Project, and
  Git tabs with accessible selected-state indicators. Activating Project
  opens the source view in the center region. Activating Git opens the
  existing diff view. Tab switching preserves the active file selection when
  the destination tab supports it. The right panel exposes Comments and
  Review tabs. All tabs and panels support keyboard navigation.

  Background:
    Given DiffScribe is started
    And a workspace is registered and active
    And the active Comparison is HEAD vs working tree
    And the working tree has changed files

  # ────── Rail tab rendering ──────

  @product @navigation @p1 @ui @e2e
  Scenario: Rail displays Workspaces, Project, and Git tab icons
    Given the application is loaded
    When the user views the left rail
    Then the rail shows three icons: Workspaces, Project, and Git
    And each icon has an accessible label

  @product @navigation @p1 @ui @e2e
  Scenario: Active tab is visually indicated with a selected state
    Given the rail tabs are visible
    When the user selects the Project tab
    Then the Project icon is visually highlighted as active
    And the Workspaces and Git icons are not highlighted

  # ────── Context switching ──────

  @product @navigation @p1 @ui @e2e
  Scenario: Project tab opens the source view in the center region
    Given the Project tab is active
    And a file is selected in the contextual panel
    When the user views the center region
    Then the source view is displayed

  @product @navigation @p1 @ui @e2e
  Scenario: Git tab opens the diff view
    Given a file is selected
    When the user selects the Git tab
    Then the center region displays the diff view for the selected file

  @product @navigation @p1 @p2 @ui @e2e
  Scenario: Tab switching preserves the active file when switching between Project and Git
    Given a file "src/app.ts" is the active file in the Project tab
    When the user switches to the Git tab
    And switches back to the Project tab
    Then "src/app.ts" remains the active file

  @product @navigation @p1 @ui @e2e
  Scenario: Workspaces tab shows the workspace list
    Given the Workspaces tab is selected
    When the user views the left contextual panel
    Then the panel displays the workspace list

  # ────── Right panel ──────

  @product @navigation @p1 @ui @e2e
  Scenario: Right panel exposes Comments and Review tabs
    Given the application is loaded
    When the user views the right panel
    Then the right panel header shows "Comments" and "Review" tabs
    And each tab has an accessible label

  @product @navigation @p1 @ui @e2e
  Scenario: Comments tab displays observations for the current review
    Given the active review has observations
    When the user selects the Comments tab
    Then the right panel shows the observation list

  @product @navigation @p1 @ui @e2e
  Scenario: Review tab displays review metadata and progress
    Given an active review exists
    When the user selects the Review tab
    Then the right panel shows the review summary and progress indicators

  # ────── Keyboard navigation ──────

  @product @navigation @p1 @ui @e2e
  Scenario: Keyboard navigation moves focus across rail tabs
    Given the left rail is focused
    When the user presses ArrowDown
    Then focus moves to the next rail tab icon
    When the user presses ArrowUp
    Then focus moves to the previous rail tab icon

  @product @navigation @p1 @ui @e2e
  Scenario: Pressing Enter on a focused rail tab activates it
    Given the left rail is focused
    And the Git tab icon has focus
    When the user presses Enter
    Then the Git tab becomes active
    And the center region shows the Git content

  @product @navigation @p1 @p2 @ui @e2e
  Scenario: Keyboard navigation moves focus across right panel tabs
    Given the right panel is focused
    When the user presses ArrowLeft or ArrowRight
    Then focus moves between the Comments and Review tabs

  # ────── Edge cases ──────

  @product @navigation @p1 @p2 @ui @e2e
  Scenario: No active workspace shows disabled tabs or empty panels
    Given no workspace is active
    When the user views the left rail
    Then the Project and Git tabs show an empty state
    And the workspace list is displayed instead
