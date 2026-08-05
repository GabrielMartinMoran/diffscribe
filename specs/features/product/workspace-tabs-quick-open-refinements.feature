@product @workspace-tabs-quick-open-refinements @navigation @layout @a11y @quick-open @etapa-1
Feature: Workspace tabs, panels, and Quick Open refinements

  Corrections to the review workbench: the left collapse/expand control lives
  at the absolute bottom with Help above it and spans the panel when expanded;
  desktop right-panel tab icons sit on the panel's right edge while the mobile
  sheet stays horizontal; the active workspace context shows at the top of
  Project/Git/Settings; the active central tab has no bottom border while
  inactive tabs do; the complete diff is the first synthetic non-closable
  workspace-scoped tab; the Git file list exposes no List/Tree controls;
  Quick Open always includes nonignored untracked files and shows working-tree
  status badges through the existing UI mapping.

  Background:
    Given DiffScribe is started
    And a workspace is registered and active

  @product @layout @e2e @delta-added
  Scenario: Left collapse control sits at the absolute bottom with Help above it
    Given the left panel is expanded on desktop
    When the panel geometry is measured
    Then the left collapse control is the bottom-most control of the left region
    And the Help control is directly above the collapse control
    When the user collapses the left panel
    Then the reopen control is still the bottom-most control of the left region
    And the Help control is directly above the reopen control

  @product @layout @e2e @delta-added
  Scenario: Expanded left collapse control spans the panel width
    Given the left panel is expanded on desktop
    When the panel geometry is measured
    Then the collapse control row spans the full width of the left panel
    When the user collapses the left panel
    Then the reopen control row spans only the rail width

  @product @layout @e2e @delta-added
  Scenario: Desktop right-panel tab icons sit on the panel right edge
    Given the right panel is expanded on desktop
    When the navigation geometry is measured
    Then the vertical tablist right edge aligns with the panel right edge
    And the tablist sits to the right of the panel content
    And the tablist remains a single vertical tablist with Comments and Review

  @product @responsive @e2e @delta-added
  Scenario: Mobile right sheet keeps horizontal navigation
    Given the viewport width is 375 px
    When the user opens the right panel sheet
    Then the sheet header keeps horizontal Comments and Review tabs

  @product @layout @e2e @delta-added
  Scenario: Active workspace context shows at the top of non-Workspaces panels
    Given the active workspace has a display name
    When the user opens the Project rail
    Then the panel shows the active workspace context at the top
    When the user opens the Git rail
    Then the panel shows the active workspace context at the top
    When the user opens the Workspaces rail
    Then no workspace context header is shown

  @product @layout @e2e @delta-added
  Scenario: Active central tab has no bottom border and inactive tabs do
    Given the central viewer shows the tabs "src/app.ts" and "src/lib/util.ts"
    And the active tab is "src/app.ts"
    Then the active tab has no bottom border
    And the inactive tab has a visible bottom border

  @product @navigation @e2e @delta-added
  Scenario: Complete diff is the first synthetic non-closable tab
    Given the active workspace has changes
    When the user views the central tab strip
    Then the first tab is the complete diff tab
    And the complete diff tab has no close button
    When the user middle-clicks the complete diff tab
    Then the complete diff tab remains open

  @product @navigation @e2e @delta-added
  Scenario: Opening a file preserves the pinned tab and activates the file tab
    Given the complete diff tab is the first tab
    When the user opens "src/app.ts" from the Project tree
    Then the central viewer shows the complete diff tab followed by "src/app.ts"
    And the active tab is "src/app.ts"

  @product @navigation @e2e @delta-added
  Scenario: The complete diff tab is revisitable and shows no "No file selected"
    Given the complete diff tab is the first tab
    When the user clicks the complete diff tab
    Then the complete diff viewer is shown
    And "No file selected" is not shown

  @product @navigation @e2e @delta-added
  Scenario: Closing the last file tab returns to the complete diff tab
    Given the central viewer shows the complete diff tab and "src/app.ts"
    When the user closes the tab "src/app.ts"
    Then the complete diff viewer is shown
    And the complete diff tab is the only tab

  @product @navigation @e2e @delta-added
  Scenario: Changing the comparison refreshes the pinned tab in place
    Given the complete diff tab is active
    When the user changes the comparison target
    Then the complete diff tab remains the first tab
    And the complete diff viewer reloads for the new comparison

  @product @navigation @e2e @delta-added
  Scenario: Switching workspace replaces the pin and clears file tabs
    Given the central viewer shows the complete diff tab and "src/app.ts"
    When the user activates another workspace
    Then the central viewer shows only the new workspace complete diff tab
    And no stale path from the previous workspace appears

  @product @navigation @e2e @delta-added
  Scenario: No active workspace shows no pinned complete diff tab
    Given no workspace is active
    Then the central viewer shows no complete diff tab

  @product @navigation @e2e @delta-added
  Scenario: Git file list exposes no List/Tree controls
    Given the Git rail is active with changed files
    When the user inspects the file list controls
    Then no List or Tree toggle is present in the Git panel
    And the file list follows the File list view setting from Settings

  @product @quick-open @e2e @delta-added
  Scenario: Quick Open always includes nonignored untracked files
    Given the working tree has an untracked file "src/scratch.ts"
    When the user opens Quick Open and types "scratch"
    Then "src/scratch.ts" is shown as a result

  @product @quick-open @e2e @delta-added
  Scenario: Quick Open excludes ignored files
    Given the working tree has an ignored file "src/ignored.ts"
    When the user opens Quick Open and types "ignored"
    Then no results are shown

  @product @quick-open @e2e @delta-added
  Scenario: Quick Open shows working-tree status badges
    Given the working tree has a modified file "src/app.ts"
    And the working tree has an untracked file "src/scratch.ts"
    When the user opens Quick Open with an empty filter
    Then the result "src/app.ts" shows the status "modified"
    And the result "src/scratch.ts" shows the status "New" in green

  @product @quick-open @e2e @delta-added
  Scenario: Quick Open still caps results at 512
    Given the workspace repository has more than 512 nonignored files
    When the user opens Quick Open with an empty filter
    Then no more than 512 results are shown

  @product @quick-open @e2e @delta-added
  Scenario: The obsolete include-untracked setting no longer affects Quick Open
    Given localStorage has "diffscribe-quick-open-include-untracked" set to "false"
    When the user opens Quick Open and types "scratch"
    Then "src/scratch.ts" is still shown as a result

  @product @observation @e2e @delta-added
  Scenario: Seeded observation cards render with badges, status, and actions
    Given the active review has observations of types "issue", "risk", and "suggestion"
    When the user opens the Comments panel
    Then each observation card shows its type badge and severity badge
    And each card shows a status dot and body text
    When the user hovers a card
    Then the card actions appear

  @product @observation @e2e @delta-added
  Scenario: Observation cards render correctly in dark and synthwave themes
    Given the active review has observations
    When the user selects the Synthwave theme
    Then the observation cards remain readable with contrast on their badges