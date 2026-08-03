@product @ui @etapa-1
Feature: File list — list and tree views

  The file list panel shows the files changed by the active Comparison. The
  user can switch between the flat list view and a directory tree view. The
  chosen view persists in localStorage; the tree groups files by directory
  with expandable directories.

  Background:
    Given the file list shell is loaded

  @product @ui @p1 @e2e
  Scenario: The file list offers list and tree view toggles
    Given the changed file list is available
    When the user inspects the view switcher
    Then the panel exposes List and Tree toggles with pressed state

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

  @product @ui @p1 @e2e
  Scenario: The chosen view persists across reloads
    Given the changed file list is available
    When the user switches to the tree view
    And the application reloads
    Then the tree view remains active

  @product @ui @p1 @e2e
  Scenario: Selecting a file works in both views
    Given the changed file list is available
    When the user switches to the tree view
    And selects a file inside a directory
    Then the file opens in the diff viewer
