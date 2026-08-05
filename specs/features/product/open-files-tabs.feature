@product @navigation @viewer @etapa-1
Feature: Open files tabs — multi-tab central viewer with keyboard and ARIA support

  The central viewer keeps a collection of open files as tabs. A normal click
  on a Project tree file or a Git/file-list row reuses the active tab.
  Ctrl-click (Windows/Linux) or Cmd-click (macOS) opens the file in an
  additional tab, or activates the existing tab when the path is already
  open. Tabs are unique by repo-relative path within the active workspace,
  live only for the session, and are cleared when the workspace changes.
  The complete diff is the first synthetic non-closable workspace-scoped tab:
  it is always present when a workspace is active, cannot be closed, and
  closing the last file tab returns to it. Modifier clicks on diff lines keep
  line selection and never create tabs.

  Background:
    Given DiffScribe is started
    And a workspace is registered and active
    And the Project tree shows files "src/app.ts" and "src/lib/util.ts"

  @product @navigation @viewer @p1 @e2e
  Scenario: Normal click reuses the active tab
    Given the central viewer shows the tab "src/app.ts"
    When the user clicks "src/lib/util.ts" in the Project tree
    Then the central viewer shows exactly one tab
    And the active tab is "src/lib/util.ts"

  @product @navigation @viewer @p1 @e2e
  Scenario: Ctrl-click on a Project file opens an additional tab
    Given the central viewer shows the tab "src/app.ts"
    When the user Ctrl-clicks "src/lib/util.ts" in the Project tree
    Then the central viewer shows two tabs
    And the active tab is "src/lib/util.ts"

  @product @navigation @viewer @p1 @e2e
  Scenario: Cmd-click on a Project file opens an additional tab
    Given the central viewer shows the tab "src/app.ts"
    When the user Cmd-clicks "src/lib/util.ts" in the Project tree
    Then the central viewer shows two tabs
    And the active tab is "src/lib/util.ts"

  @product @navigation @viewer @p1 @e2e
  Scenario: Modifier click on a Git file row opens an additional tab
    Given the central viewer shows the tab "src/app.ts"
    And the Git file list shows "src/lib/util.ts"
    When the user Ctrl-clicks "src/lib/util.ts" in the Git file list
    Then the central viewer shows two tabs
    And the active tab is "src/lib/util.ts"

  @product @navigation @viewer @p1 @e2e
  Scenario: Already open path activates without creating a duplicate
    Given the central viewer shows the tabs "src/app.ts" and "src/lib/util.ts"
    When the user Ctrl-clicks "src/lib/util.ts" in the Project tree
    Then the central viewer still shows two tabs
    And the active tab is "src/lib/util.ts"

  @product @navigation @viewer @p1 @e2e
  Scenario: The active tab is highlighted and inactive tabs are dimmed but readable
    Given the central viewer shows the tabs "src/app.ts" and "src/lib/util.ts"
    And the active tab is "src/app.ts"
    Then the active tab has the highlighted state
    And the inactive tab has the dimmed state and remains readable

  @product @navigation @viewer @p1 @e2e
  Scenario: Activating an inactive tab changes the central viewer content
    Given the central viewer shows the tabs "src/app.ts" and "src/lib/util.ts"
    And the active tab is "src/app.ts"
    When the user clicks the tab "src/lib/util.ts"
    Then the active tab is "src/lib/util.ts"
    And the central viewer shows the content of "src/lib/util.ts"

  @product @navigation @viewer @p1 @e2e
  Scenario: Closing the active tab selects the next tab
    Given the central viewer shows the tabs "src/app.ts", "src/lib/util.ts", and "src/lib/more.ts"
    And the active tab is "src/app.ts"
    When the user closes the tab "src/app.ts"
    Then the active tab is "src/lib/util.ts"
    And the central viewer shows the content of "src/lib/util.ts"

  @product @navigation @viewer @p1 @e2e
  Scenario: Closing the last active tab selects the previous tab
    Given the central viewer shows the tabs "src/app.ts" and "src/lib/util.ts"
    And the active tab is "src/lib/util.ts"
    When the user closes the tab "src/lib/util.ts"
    Then the active tab is "src/app.ts"
    And the central viewer shows the content of "src/app.ts"

  @product @navigation @viewer @p1 @e2e @delta-modified
  Scenario: Closing the last file tab returns to the complete diff tab
    # CHANGED: the pinned complete-diff tab is always present; closing the last file tab returns to it (was: empty viewer)
    Given the central viewer shows the complete diff tab and "src/app.ts"
    When the user closes the tab "src/app.ts"
    Then the complete diff viewer is shown
    And the complete diff tab is the only tab

  @product @navigation @viewer @p1 @e2e
  Scenario: Closing an inactive tab preserves the active tab
    Given the central viewer shows the tabs "src/app.ts" and "src/lib/util.ts"
    And the active tab is "src/app.ts"
    When the user closes the tab "src/lib/util.ts"
    Then the central viewer shows one tab
    And the active tab is "src/app.ts"

  @product @navigation @viewer @p1 @e2e @delta-modified
  Scenario: Switching workspace replaces the pin and clears file tabs
    # CHANGED: the new workspace shows its own pinned complete-diff tab (was: no tabs)
    Given the central viewer shows the complete diff tab and "src/app.ts"
    When the user activates another workspace
    Then the central viewer shows only the new workspace complete diff tab
    And no stale path from the previous workspace appears

  @product @navigation @viewer @p1 @e2e @delta-added
  Scenario: Complete diff is the first synthetic non-closable tab
    Given the active workspace has changes
    When the user views the central tab strip
    Then the first tab is the complete diff tab
    And the complete diff tab has no close button
    When the user middle-clicks the complete diff tab
    Then the complete diff tab remains open

  @product @navigation @viewer @p1 @e2e @delta-added
  Scenario: Opening a file preserves the pinned tab and activates the file tab
    Given the complete diff tab is the first tab
    When the user opens "src/app.ts" from the Project tree
    Then the central viewer shows the complete diff tab followed by "src/app.ts"
    And the active tab is "src/app.ts"

  @product @navigation @viewer @p1 @e2e @delta-added
  Scenario: The complete diff tab is revisitable and shows no "No file selected"
    Given the complete diff tab is the first tab
    When the user clicks the complete diff tab
    Then the complete diff viewer is shown
    And "No file selected" is not shown

  @product @navigation @viewer @p1 @e2e @delta-added
  Scenario: Changing the comparison refreshes the pinned tab in place
    Given the complete diff tab is active
    When the user changes the comparison target
    Then the complete diff tab remains the first tab
    And the complete diff viewer reloads for the new comparison

  @product @navigation @viewer @p1 @e2e @delta-added
  Scenario: No active workspace shows no pinned complete diff tab
    Given no workspace is active
    Then the central viewer shows no complete diff tab
    And the central viewer shows "No file selected"

  @product @navigation @viewer @p1 @e2e @delta-added
  Scenario: Active central tab has no bottom border and inactive tabs do
    Given the central viewer shows the tabs "src/app.ts" and "src/lib/util.ts"
    And the active tab is "src/app.ts"
    Then the active tab has no bottom border
    And the inactive tab has a visible bottom border

  @product @navigation @viewer @p1 @e2e
  Scenario: Ctrl/Cmd-click on a diff line preserves line selection and opens no tab
    Given the central viewer shows the tab "src/app.ts"
    And the diff viewer shows the file "src/app.ts"
    When the user Ctrl-clicks a diff line
    Then the line selection is updated
    And the number of open tabs does not change

  @product @navigation @viewer @p1 @e2e
  Scenario: Tabs support roving keyboard navigation
    Given the central viewer shows the tabs "src/app.ts" and "src/lib/util.ts"
    And the active tab is "src/app.ts"
    When the user focuses the tab list and presses ArrowRight
    Then the next tab receives focus
    When the user presses Home
    Then the first tab receives focus
    When the user presses End
    Then the last tab receives focus

  @product @navigation @viewer @p1 @e2e
  Scenario: Tabs expose tab semantics and accessible close buttons
    Given the central viewer shows the tab "src/app.ts"
    Then the tab list has role tablist and the tabs have role tab
    And the active tab has aria-selected true
    And each tab has an aria-controls reference to its panel
    And each close button has an accessible name
