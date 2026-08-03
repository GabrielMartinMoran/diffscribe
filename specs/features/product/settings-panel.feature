@product @ui @a11y @etapa-1
Feature: Settings panel — Appearance and Editor preferences

  The rail exposes a Settings entry at its bottom. Activating it opens the
  Settings panel in the contextual area with two sections: Appearance
  (theme selection, moved out of the panel header) and Editor (line wrapping
  default). Preferences persist in localStorage.

  Background:
    Given the DiffScribe shell is loaded

  @product @ui @p1 @e2e
  Scenario: The rail exposes Settings at the bottom
    Given the rail entries are visible
    When the user views the bottom of the left rail
    Then the rail shows Workspaces, Project, Git, and Settings entries
    And the Settings entry has an accessible label

  @product @ui @p1 @e2e
  Scenario: Activating Settings shows Appearance and Editor sections
    Given the rail entries are visible
    When the user activates the Settings entry
    Then the Settings panel appears in the contextual area
    And the Settings panel shows an Appearance section
    And the Settings panel shows an Editor section

  @product @ui @p1 @e2e
  Scenario: Theme selection happens inside Settings
    Given the Settings panel is open
    When the user selects the Synthwave theme inside Settings
    Then the active theme becomes Synthwave '84

  @product @ui @p1 @e2e
  Scenario: Editor wrapping default is a switch persisted in localStorage
    Given the Settings panel is open
    When the user enables line wrapping inside Settings
    Then the wrapping preference is stored in localStorage
    When the application reloads with the stored preference
    Then the wrapping switch is enabled after reload

  @product @ui @p1 @e2e
  Scenario: Theme switcher is not rendered in the panel header
    Given the left contextual panel is open
    When the user inspects the panel header
    Then no theme switcher is present in the header

  @product @navigation @quick-open @p1 @e2e
  Scenario: Quick Open untracked inclusion is a switch persisted in localStorage
    Given the Settings panel is open
    When the user enables "Include untracked files in Quick Open" inside Settings
    Then the Quick Open setting "diffscribe-quick-open-include-untracked" is stored in localStorage
    When the application reloads with the stored preference
    Then the Quick Open untracked switch is enabled after reload
    And the setting affects Quick Open only, not the Git file list
