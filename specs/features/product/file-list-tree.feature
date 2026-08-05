# CHANGED: the default file list view is now tree (0001-workspace-git-review-ux)
@product @ui @etapa-1
Feature: File list — list and tree views

  The file list panel shows the files changed by the active Comparison. The
  user configures the flat list view or the directory tree view in Settings;
  the Git panel itself exposes no List/Tree controls. The tree view is the
  default and the chosen view persists in localStorage; the tree groups files
  by directory with expandable directories.

  Background:
    Given the file list shell is loaded

  @product @ui @p1 @e2e @delta-modified
  Scenario: The Git file list exposes no List/Tree controls
    # CHANGED: the in-Git view switcher was removed; Settings is the sole presentation configuration
    Given the changed file list is available
    When the user inspects the view switcher
    Then no List or Tree toggle is present in the Git panel
    And the file list follows the File list view setting from Settings

  @product @ui @p1 @e2e
  Scenario: Tree view groups files by directory
    Given the changed file list is available
    When the user switches to the tree view
    Then files appear grouped under their directories
    And directories expand to reveal their files

  @product @ui @p1 @e2e
  Scenario: Tree view groups files by directory
    Given the changed file list is available
    When the user switches to the tree view
    Then files appear grouped under their directories
    And all directories are expanded by default to reveal their files

  @product @ui @p1 @e2e
  Scenario: Directories can be collapsed and expanded manually
    Given the changed file list is available
    When the user switches to the tree view
    And collapses a directory
    Then the directory files are hidden
    When the user expands the directory again
    Then the directory files are visible again

  @product @ui @p1 @e2e
  Scenario: Directory expansion is not persisted across reloads
    Given the changed file list is available
    When the user switches to the tree view
    And collapses a directory
    And the application reloads
    Then the directories are expanded by default again

  @product @ui @p1 @e2e @delta-modified
  Scenario: The chosen view persists across reloads
    # CHANGED: the view is selected in Settings (was: in the Git panel)
    Given the changed file list is available
    When the user switches to the list view in Settings
    And the application reloads
    Then the list view remains active

  @product @ui @p1 @e2e
  Scenario: Selecting a file works in both views
    Given the changed file list is available
    When the user switches to the tree view
    And selects a file inside a directory
    Then the file opens in the diff viewer
