@product @observation @etapa-1 @line-selection
Feature: Line selection — mouse and keyboard selection of lines within the diff viewer

  The user can select lines in the diff viewer to anchor an observation to a
  specific range. Selection is visible through a highlight on the selected
  lines. Single clicks, Shift-click ranges, Ctrl/Cmd-click toggles, Shift+Arrow
  keyboard extensions, L-key anchoring, and Escape clearing are all supported.
  A normal click on a line opens the Comments panel in creation mode and
  focuses the observation body, so the reviewer can type the comment
  immediately. Cancelling the draft clears the selection.

  Background:
    Given DiffScribe is started
    And a workspace is registered and active
    And the active Comparison is HEAD vs working tree
    And the active Comparison includes a modified file "src/app.ts" with 30 lines
    And the file "src/app.ts" is the active selected file
    And the diff viewer shows the unified diff for "src/app.ts"

  # ────── Mouse selection ──────

  @p1 @ui @e2e
  Scenario: Select a single line with a mouse click
    When the user clicks on line 10 in the diff viewer
    Then line 10 is highlighted as selected
    And no other lines are highlighted

  @p1 @ui @e2e
  Scenario: Select a line range with Shift-click
    Given the user has clicked on line 10
    When the user Shift-clicks on line 15
    Then lines 10 through 15 are highlighted as a selected range
    And the selection spans the full range inclusively

  @p1 @ui @e2e
  Scenario: Toggle an individual line with Ctrl-click
    Given the user has clicked on line 10
    When the user Ctrl-clicks on line 15
    Then lines 10 and 15 are highlighted as selected
    When the user Ctrl-clicks on line 15 again
    Then line 15 is no longer highlighted
    And line 10 remains highlighted

  @p1 @ui @e2e
  Scenario: Toggle an individual line with Command-click
    Given the user has clicked on line 10
    When the user Command-clicks on line 15
    Then lines 10 and 15 are highlighted as selected

  # ────── Keyboard selection ──────

  @p1 @ui @e2e
  Scenario: Extend a selection with Shift+Arrow keys
    Given the user has selected line 10
    When the user presses Shift+ArrowDown 5 times
    Then lines 10 through 15 are highlighted as a selected range

  @p2 @ui @e2e
  Scenario: Anchor a selection start with the L key and complete with a click
    Given the diff viewer is focused
    When the user presses the L key on line 10
    And then clicks on line 15
    Then lines 10 through 15 are highlighted as a selected range

  @p2 @ui @e2e
  Scenario: Clear the selection with Escape
    Given lines 10 through 15 are selected in the diff viewer
    When the user presses Escape
    Then no lines are highlighted as selected

  @p2 @ui @e2e
  Scenario: Select a line range using only the keyboard
    Given the diff viewer is focused
    When the user navigates to line 10 with ArrowDown
    And presses the L key to anchor the selection
    And navigates to line 15 with ArrowDown
    And presses Enter to confirm
    Then lines 10 through 15 are highlighted as a selected range

  # ────── Draft auto-open and cancel ──────

  @p1 @ui @e2e
  Scenario: Clicking a line opens the Comments panel in creation mode
    When the user clicks on line 10 in the diff viewer
    Then the Comments panel is visible
    And the Comments panel shows the observation form
    And the observation body field is focused

  @p1 @ui @e2e
  Scenario: Cancelling the draft closes the form and clears the selection
    Given lines 10 through 15 are selected in the diff viewer
    And the Comments panel shows the observation form for the selection
    When the user cancels the observation draft
    Then the observation form is closed
    And no lines are highlighted as selected

  # ────── Selection kinds and draft behavior ──────

  @product @observation @etapa-1 @line-selection
  Scenario: LINE-SEL-10 — a default click switches to Comments and starts a draft
    When the user clicks on line 10 in the diff viewer
    Then the Comments panel is visible
    And a new observation draft starts for line 10

  @product @observation @etapa-1 @line-selection
  Scenario: LINE-SEL-11 — modifier selections do not force the Comments tab
    Given the user has selected line 10
    When the user Ctrl-clicks on line 15
    Then the right panel stays on its current tab
    And no new draft replaces the current one
