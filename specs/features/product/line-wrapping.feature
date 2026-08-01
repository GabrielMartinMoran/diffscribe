@product @ui @a11y @etapa-1
Feature: Line wrapping — global default and per-file override

  Diff lines stay no-wrap by default: long lines extend the file's single
  horizontal scrollbar instead of wrapping. Each file's diff header exposes a
  contextual Wrap toggle that overrides the default for that file. The
  global default lives in Settings (Editor section) and persists in
  localStorage.

  Background:
    Given the DiffScribe application is available
    And a workspace with a diff is active

  @product @ui @p1 @e2e
  Scenario: Diff lines do not wrap by default
    Given a diff with a long line is open
    Then diff lines render with no-wrap
    And the diff exposes a single horizontal scroll container for the file

  @product @ui @p1 @e2e
  Scenario: No per-line horizontal scrollbars exist
    Given a diff with a long line is open
    When the user inspects the line content boxes
    Then no line content box scrolls horizontally on its own

  @product @ui @p1 @e2e
  Scenario: The contextual Wrap toggle overrides wrapping for the file
    Given a diff with a long line is open
    When the user activates the Wrap toggle in the diff header
    Then the toggle reports pressed state
    And diff lines wrap in the viewer

  @product @ui @p1 @e2e
  Scenario: The Settings wrapping default applies to newly opened diffs
    Given line wrapping is enabled in Settings
    When the user opens a diff for another file
    Then the diff lines wrap without a manual toggle
