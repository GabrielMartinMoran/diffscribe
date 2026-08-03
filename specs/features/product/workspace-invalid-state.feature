@product @ui @a11y @etapa-1
Feature: Invalid workspace state — warning affordance, dialog, and repair flow

  An invalid workspace (its repository path is missing or not a Git
  repository) must be recognizable without the old text badges. The sidebar
  shows a warning icon with an accessible name instead of the ACTIVE and
  INVALID badges. Activating the warning icon opens a generic dialog with
  Close and Repair actions; Repair reuses the existing repair form.

  Background:
    Given the app shell is present

  @product @ui @a11y @etapa-1
  Scenario: WS-INVALID-01 — invalid workspace hides status badges and shows a warning icon
    Given a workspace is listed in the sidebar with status "invalid"
    Then the workspace item does not show an "invalid" text badge
    And the workspace item does not show an "active" text badge
    And the workspace item shows a warning icon with an accessible name

  @product @ui @a11y @etapa-1
  Scenario: WS-INVALID-02 — warning icon opens a dialog with Repair and Close
    Given a workspace is listed in the sidebar with status "invalid"
    When the user activates the warning icon of the invalid workspace
    Then a dialog opens with a Repair action and a Close action
    When the user closes the dialog
    Then the dialog closes and the workspace list remains visible

  @product @ui @a11y @etapa-1
  Scenario: WS-INVALID-03 — Repair in the dialog opens the existing repair form
    Given a workspace is listed in the sidebar with status "invalid"
    When the user activates the warning icon of the invalid workspace
    And the user activates the Repair action in the dialog
    Then the existing repair form appears for the workspace
