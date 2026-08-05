@product/workspace-git-review-ux @product @ui @etapa-1
Feature: Workspace and Git review UX

  Workspace lifecycle, Git-first navigation, configurable file presentation,
  complete-diff review, Markdown preview, branch selector ergonomics, panel
  controls, tab behavior, interaction help, and directory status aggregation
  for the Stage 1 review workbench.

  Background:
    Given the workbench shell is loaded

  # ── Phase 1: workspace lifecycle ──

  @product @workspace @p1 @e2e @delta-added
  Scenario: Deleted workspace disappears immediately from the sidebar
    Given a workspace is registered and selected
    When the user deletes the workspace and confirms
    Then the workspace disappears from the sidebar without a reload

  @product @workspace @p1 @e2e @delta-added
  Scenario: Open workspace form keeps an editable repository path
    Given the user opens the Open Workspace form
    Then the repository path field remains editable
    When the user types a repository path and opens it
    Then the workspace is registered

  @product @workspace @p2 @e2e @delta-added
  Scenario: Directory browser pre-fills the repository path
    Given the browser supports directory selection
    When the user browses for a directory
    Then the repository path field is pre-filled with the directory name
    And the user can complete the absolute path manually

  @product @navigation @p1 @e2e @delta-added
  Scenario: Selecting a workspace lands in Git
    Given a workspace is registered
    When the user selects the workspace
    Then the Git rail is active
    And the complete diff for the default comparison is shown

  @product @navigation @p2 @e2e @delta-added
  Scenario: Project remains reachable after landing in Git
    Given the user landed in Git after selecting a workspace
    When the user activates the Project rail
    Then the project tree is shown for the active workspace

  # ── Phase 2: presentation settings, New label, status dots ──

  @product @settings @p1 @e2e @delta-added
  Scenario: Fresh contexts default the file list to tree
    Given no file list view preference is stored
    When the user opens a workspace in Git
    Then the changed files are presented as a tree

  @product @settings @p1 @e2e @delta-added
  Scenario: An explicit stored list preference is preserved
    Given the legacy file list preference is stored as list
    When the user opens a workspace in Git
    Then the changed files are presented as a list

  @product @settings @p1 @e2e @delta-added
  Scenario: Settings control the Git file presentation
    Given the Settings panel is open
    When the user changes the file list view setting to list
    Then the Git file list presents files as a list after reload

  @product @settings @p2 @unit @delta-added
  Scenario: Legacy preference migrates to the settings aggregate
    Given only the legacy file list preference is stored
    When the settings aggregate is read for the first time
    Then the legacy value is honored once
    And the first write removes the legacy key

  @product @git @p1 @e2e @delta-added
  Scenario: Untracked files are labelled New in green
    Given a workspace with an untracked file
    When the user views the Git file list
    Then the untracked file shows the label New
    And the label renders with the green tone

  @product @application @p1 @e2e @delta-added
  Scenario: The API keeps the technical untracked status
    Given a workspace with an untracked file
    When the file list endpoint is queried
    Then the entry status remains untracked

  @product @project @p1 @e2e @delta-added
  Scenario: Directories show descendant-derived status dots
    Given a workspace with changed files under a directory
    When the user views the Project tree
    Then the directory shows a status dot derived from its descendants

  @product @project @p1 @e2e @delta-added
  Scenario: Mixed directory operations use deterministic precedence
    Given a directory contains a modified file and an untracked file
    When the user views the Project tree
    Then the directory dot reflects the modified status
    And a directory with only untracked descendants shows a green dot

  @product @project @p1 @e2e @delta-added
  Scenario: New status dots are green
    Given a workspace with an added file and an untracked file
    When the user views the Project tree
    Then both file dots render in green

  # ── Phase 3: complete diff ──

  @product @git @p1 @e2e @delta-modified
  Scenario: Git shows the complete diff by default
    # CHANGED: the complete diff is the pinned first tab whenever a workspace is active
    Given a workspace with changes and no open file tab
    When the user lands in Git
    Then the complete diff of the active comparison is shown as the pinned first tab

  @product @git @p1 @e2e @delta-added
  Scenario: Complete diff lists files in deterministic order
    Given a workspace with several changed files
    When the complete diff is loaded
    Then the file sections appear ordered by path

  @product @git @p1 @e2e @delta-added
  Scenario: Clicking a file scrolls to its diff section
    Given the complete diff is shown
    When the user clicks a file in the complete diff index
    Then the view scrolls to that file's diff section

  @product @git @p1 @e2e @delta-added
  Scenario: Modifier-click opens full-file detail in Project
    Given the complete diff is shown
    When the user Ctrl-clicks or Cmd-clicks a file
    Then a new tab opens with the full file
    And the Project rail becomes active

  @product @git @p2 @e2e @delta-added
  Scenario: Binary and truncated files render markers in the complete diff
    Given a workspace with a binary file and an oversized file
    When the complete diff is loaded
    Then the binary file shows a binary marker without content
    And the oversized file shows a truncation notice

  @product @application @p1 @unit @delta-added
  Scenario: Aggregate reader enforces caps and partial errors
    Given a comparison with more files than the limit
    When the aggregate reader runs
    Then the result is marked truncated
    And per-file failures are collected without failing the result

  @product @application @p1 @unit @delta-added
  Scenario: Complete diff honors snapshot consistency
    Given a repository at a known revision
    When the aggregate reader runs once
    Then all file sections share a single readAt snapshot

  # ── Phase 4: Markdown preview ──

  @product @viewer @p1 @e2e @delta-added
  Scenario: Markdown files expose a Raw/Preview toggle
    Given a workspace with a Markdown file open in Project
    Then the viewer header shows a Raw/Preview toggle at the top right

  @product @viewer @p1 @e2e @delta-added
  Scenario: Markdown default view comes from settings
    Given the Markdown default view is set to preview
    When a Markdown file opens
    Then the preview is shown initially
    When the default is set to raw
    And a Markdown file opens
    Then the raw view is shown initially

  @product @viewer @p1 @e2e @delta-added
  Scenario: Markdown preview escapes HTML and unsafe links
    Given a Markdown file containing raw HTML and a javascript link
    When the user switches to preview
    Then the raw HTML renders as escaped text
    And the javascript link is not rendered as a link

  @product @settings @p1 @e2e @delta-added
  Scenario: Visualization settings are grouped in the Files section
    Given the Settings panel is open
    Then a Files section exposes the file list view and the Markdown default view

  # ── Phase 5: branch selector, panels, tabs, help ──

  @product @git @p1 @e2e @delta-added
  Scenario: Branch selector widens and shows tooltips for long names
    Given a workspace with a branch whose name is long
    When the user opens the branch selector
    Then the selector exposes the full name as a tooltip

  @product @git @p1 @e2e @delta-added
  Scenario: The redundant comparison caption is removed
    Given the Git comparison selector is shown
    Then no working tree vs HEAD caption is displayed

  @product @git @p1 @e2e @delta-added
  Scenario: The working tree can be reselected as target
    Given the user changed the target away from the working tree
    When the user selects Working tree as the target again
    Then the comparison type is inferred as working-tree-vs-head
    And the file list and complete diff refetch

  @product @navigation @p1 @e2e @delta-modified
  Scenario: Collapsed panel options expand the panel and select the option
    # CHANGED: extended with the left rail expansion contract (was right-only)
    Given the right panel is collapsed
    When the user activates a tab in the collapsed strip
    Then the panel expands and shows that tab
    Given the left panel is collapsed
    When the user selects the Project rail option
    Then the left panel expands and selects the Project option

  @product @navigation @p1 @e2e @delta-modified
  Scenario: Bottom controls collapse and expand both panels
    Given both panels are expanded
    Then the left and right panels expose collapse controls at the bottom
    When the user collapses the right panel
    Then the right strip exposes an expand control at the bottom
    And the left rail exposes Help and reopen controls at the bottom with Help directly above the reopen control
    # CHANGED: left rail bottom order is Help above the reopen control (0003 contract; was: Help below reopen)

  @product @tabs @p1 @e2e @delta-modified
  Scenario: Middle-click closes file tabs but not the pinned complete-diff tab
    # CHANGED: the pinned complete-diff tab is non-closable (was: any open tab)
    Given two file tabs are open
    When the user middle-clicks an inactive tab
    Then that tab closes and the active tab is preserved
    When the user middle-clicks the active tab
    Then the active tab closes and a neighbor becomes active
    When the user middle-clicks the complete diff tab
    Then the complete diff tab remains open

  @product @help @p1 @e2e @delta-added
  Scenario: Help lists keyboard and mouse shortcuts
    Given the user opens Help
    Then the dialog lists the keyboard and mouse shortcuts
    And Escape closes the dialog and returns focus to its trigger

  # ── Regression ──

  @product @regression @p1 @e2e @delta-modified
  Scenario: Comparison changes update diff content
    # CHANGED: the pinned complete-diff tab refreshes in place for the new comparison
    Given a workspace with a comparison selected
    When the user changes the target comparison
    Then the complete diff and file diff show content for the new comparison
    And the complete diff tab remains the first tab

  @product @layout @p1 @e2e @delta-added
  Scenario: Active workspace context shows at the top of non-Workspaces panels
    Given the active workspace has a display name
    When the user opens the Project rail
    Then the panel shows the active workspace context at the top
    When the user opens the Git rail
    Then the panel shows the active workspace context at the top
    When the user opens the Workspaces rail
    Then no workspace context header is shown
