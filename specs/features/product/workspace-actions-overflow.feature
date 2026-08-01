@product @ui @a11y @etapa-1
Feature: Workspace action overflow menu

  Each workspace in the sidebar exposes its actions (Rename, Repair when the
  workspace is invalid, and Delete) through a single overflow menu instead of
  inline buttons. The menu follows the kit Menu contract: trigger with
  aria-haspopup and aria-expanded, role menu/menuitem items, arrow/Home/End
  navigation, Enter/Space activation, Escape closes and returns focus to the
  trigger.

  Background:
    Given the app shell is present

  @product @ui @p1 @e2e
  Scenario: Overflow menu exposes the workspace actions with accessible names
    Given a registered workspace is listed in the sidebar
    When the user activates the workspace overflow menu trigger
    Then the overflow trigger exposes aria-haspopup and aria-expanded
    And the overflow menu shows Rename and Delete actions
    When the workspace is invalid
    Then the overflow menu also shows a Repair action

  @product @ui @p1 @e2e
  Scenario: Keyboard navigation within the overflow menu
    Given the workspace overflow menu is open
    When the user presses ArrowDown in the overflow menu
    Then focus moves to the next action in the overflow menu
    When the user presses Home in the overflow menu
    Then focus moves to the first action in the overflow menu
    When the user presses End in the overflow menu
    Then focus moves to the last action in the overflow menu
    When the user presses Escape in the overflow menu
    Then the overflow menu closes and focus returns to the trigger

  @product @ui @p1 @e2e
  Scenario: Selecting Rename from the overflow menu opens the rename form
    Given the workspace overflow menu is open
    When the user activates the Rename action in the overflow menu
    Then the rename form appears for the workspace

  @product @ui @p1 @e2e
  Scenario: Selecting Delete from the overflow menu opens the confirmation dialog
    Given the workspace overflow menu is open
    When the user activates the Delete action in the overflow menu
    Then the delete confirmation dialog appears
