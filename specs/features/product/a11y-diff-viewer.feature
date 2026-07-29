@product @a11y @delta-added @etapa-1 @diff-viewer
Feature: Accessibility of diff viewer — checkbox semantics and keyboard navigation

  The diff viewer exposes each selectable diff line as a `<div role="checkbox">`
  with `aria-checked` reflecting selection state. Clicking a line checks it,
  clicking again on the same line does not uncheck it (single-selection click
  replaces the current selection), and Shift-click selects a range. This
  replaces the previous `role="button"` + `aria-selected` pattern, which was
  semantically incorrect for a selectable list.

  Background:
    Given DiffScribe is started
    And a workspace is registered and active
    And the active Comparison is HEAD vs working tree
    And the active Comparison includes a modified file "src/app.ts" with 15 lines
    And the file "src/app.ts" is the active selected file
    And the file list is rendered
    And the diff viewer shows the unified diff for "src/app.ts"

  @p1 @ui @a11y @delta-added
  Scenario: Selectable diff lines have checkbox semantics
    When the diff viewer is rendered
    Then all selectable diff lines have role "checkbox"
    And every selectable line exposes an aria-checked attribute

  @p1 @ui @a11y @delta-added
  Scenario: Clicking a line sets its aria-checked to true
    When the user clicks on line 7 in the diff viewer
    Then line 7 has aria-checked "true"
    And all other lines have aria-checked "false"

  @p1 @ui @a11y @delta-added
  Scenario: Shift-click extends selection and sets aria-checked on the range
    Given the user has clicked on line 5
    When the user Shift-clicks on line 8
    Then lines 5, 6, 7, and 8 have aria-checked "true"
    And all other lines have aria-checked "false"
