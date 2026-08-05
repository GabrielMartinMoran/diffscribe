@product @navigation @quick-open @etapa-1
Feature: Quick Open — keyboard-driven file search over the Project tree

  Ctrl/Cmd+P opens a Quick Open modal with an autofocused filter. It searches
  the shared Project workspace tree, flattening file nodes only. It always
  includes nonignored untracked files; ignored files stay excluded. The
  obsolete localStorage setting `diffscribe-quick-open-include-untracked` no
  longer affects results. Fuzzy matching is a pure client-side scorer: exact
  path beats basename prefix, basename prefix beats basename subsequence,
  basename subsequence beats path fuzzy; consecutive, case, start-of-word,
  and separator matches are boosted; ties are broken deterministically; all
  whitespace terms are required; matches carry highlight ranges; results are
  capped at 512. Results show working-tree status badges through the existing
  UI mapping. Every acceptance of Quick Open routes to the Project rail so
  the Source Viewer is shown.

  Background:
    Given DiffScribe is started
    And a workspace is registered and active
    And the Project tree shows files "src/app.ts" and "src/lib/util.ts"

  @product @navigation @quick-open @p1 @e2e
  Scenario: Ctrl+P or Cmd+P opens Quick Open with the filter focused
    Given the user is on the main workbench
    When the user presses Ctrl+P
    Then a Quick Open dialog opens
    And the filter input has focus
    When the user closes Quick Open and presses Cmd+P
    Then a Quick Open dialog opens again

  @product @navigation @quick-open @p1 @e2e
  Scenario: Fuzzy path and basename search highlights the matched ranges
    Given Quick Open is open
    When the user types "util" into the filter
    Then "src/lib/util.ts" is the first result
    And the result shows highlight ranges for the matched characters

  @product @navigation @quick-open @p1 @e2e
  Scenario: Whitespace-separated terms must all match
    Given Quick Open is open
    When the user types "lib util" into the filter
    Then "src/lib/util.ts" is the first result
    When the user types "lib util src" into the filter
    Then no results are shown

  @product @navigation @quick-open @p1 @e2e
  Scenario: ArrowDown and Enter open the current tab
    Given Quick Open is open
    And the filter shows at least two results
    When the user presses ArrowDown and then Enter
    Then Quick Open closes
    And the central viewer shows the selected file in the current tab

  @product @navigation @quick-open @p1 @e2e
  Scenario: Ctrl/Cmd+Enter opens the selected file in a new tab
    Given Quick Open is open
    And the central viewer shows the tab "src/app.ts"
    When the user presses ArrowDown and then Ctrl+Enter
    Then Quick Open closes
    And the central viewer shows an additional tab

  @product @navigation @quick-open @p1 @e2e
  Scenario: Mouse click on a result opens the current tab
    Given Quick Open is open
    When the user clicks the result "src/lib/util.ts"
    Then Quick Open closes
    And the central viewer shows "src/lib/util.ts" in the current tab

  @product @navigation @quick-open @p1 @e2e
  Scenario: Home and End move to the first and last results
    Given Quick Open is open
    And the filter shows at least three results
    When the user presses End
    Then the last result is active
    When the user presses Home
    Then the first result is active

  @product @navigation @quick-open @p1 @e2e
  Scenario: Escape closes Quick Open without changing the active file
    Given Quick Open is open
    And the central viewer shows the tab "src/app.ts"
    When the user presses Escape
    Then Quick Open closes
    And the central viewer still shows "src/app.ts"
    And focus returns to the previously focused element

  @product @navigation @quick-open @p1 @e2e @delta-modified
  Scenario: Quick Open always includes nonignored untracked files
    # CHANGED: untracked files are always included (was: tracked files only by default)
    Given the working tree has an untracked file "src/scratch.ts"
    When the user opens Quick Open and types "scratch"
    Then "src/scratch.ts" is shown as a result

  @product @navigation @quick-open @p1 @e2e @delta-modified
  Scenario: The obsolete include-untracked setting no longer affects Quick Open
    # CHANGED: the include-untracked setting was removed; the legacy key is inert
    Given the working tree has an untracked file "src/scratch.ts"
    And localStorage has "diffscribe-quick-open-include-untracked" set to "false"
    When the user opens Quick Open and types "scratch"
    Then "src/scratch.ts" is still shown as a result

  @product @navigation @quick-open @p1 @e2e @delta-modified
  Scenario: An empty query shows the full file index
    # CHANGED: the index includes nonignored untracked files (was: tracked files only)
    Given Quick Open is open
    When the filter is empty
    Then the results show every nonignored file in the workspace

  @product @navigation @quick-open @p1 @e2e @delta-modified
  Scenario: Results are capped at 512
    # CHANGED: the cap applies to the nonignored index (was: tracked files only)
    Given the workspace repository has more than 512 nonignored files
    When the user opens Quick Open with an empty filter
    Then no more than 512 results are shown

  @product @navigation @quick-open @p1 @e2e @delta-added
  Scenario: Quick Open excludes ignored files
    Given the working tree has an ignored file "src/ignored.ts"
    When the user opens Quick Open and types "ignored"
    Then no results are shown

  @product @navigation @quick-open @p1 @e2e @delta-added
  Scenario: Quick Open shows working-tree status badges
    Given the working tree has a modified file "src/app.ts"
    And the working tree has an untracked file "src/scratch.ts"
    When the user opens Quick Open with an empty filter
    Then the result "src/app.ts" shows the status "modified"
    And the result "src/scratch.ts" shows the status "New" in green

  @product @navigation @quick-open @p1 @e2e
  Scenario: Ctrl+Shift+P does not open Quick Open
    Given the user is on the main workbench
    When the user presses Ctrl+Shift+P
    Then no Quick Open dialog opens

  @product @navigation @quick-open @p1 @e2e
  Scenario: Composing IME input does not commit or navigate
    Given Quick Open is open
    When the user is composing IME text in the filter
    Then no result is committed and the dialog stays open

  @product @navigation @quick-open @p1 @e2e
  Scenario: Accepting a result routes to the Project rail
    Given Quick Open is open
    And the Git rail is active
    When the user accepts the first result
    Then the Project rail becomes active
    And the Source Viewer is shown

  @product @navigation @quick-open @p2 @e2e
  Scenario: Quick Open sees files added after a successful Git refresh
    Given Quick Open has been opened once
    When a file is added outside DiffScribe
    And the user refreshes the Git context
    And the user opens Quick Open
    Then the added file appears in the results
