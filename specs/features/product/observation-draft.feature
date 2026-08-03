@product @observation @etapa-1
Feature: Observation draft — per-instance draft state across panel switches and selection kinds

  The observation draft (body, type, and severity) is stored per workspace
  instance so it survives switching between the Comments and Review tabs,
  which unmounts the form. The draft has explicit states: pristine, dirty,
  submitting, and confirm. A normal (replace) selection click or Cancel asks
  for confirmation when the draft is dirty; modifier selections (Ctrl/Cmd
  toggle, Shift extend) preserve the draft. A successful create clears the
  draft; a failed create or a missing context shows an inline accessible
  error.

  Background:
    Given DiffScribe is started
    And a workspace is registered and active
    And the active Comparison is HEAD vs working tree
    And an active review draft exists for the workspace
    And the active Comparison includes a modified file "src/app.ts"

  @product @observation @etapa-1
  Scenario: OBS-DRAFT-01 — the draft survives switching between Comments and Review
    Given the user has started a draft with body "Draft body", type "note", and severity null
    When the user switches to the Review tab and back to the Comments tab
    Then the draft body, type, and severity remain as entered

  @product @observation @etapa-1
  Scenario: OBS-DRAFT-02 — a dirty draft asks for confirmation on normal replacement
    Given the user has started a draft with body "Draft body"
    When the user clicks a different line in the diff viewer
    Then a confirmation dialog asks whether to discard the draft
    When the user keeps the draft
    Then the draft body remains and the previous selection is restored

  @product @observation @etapa-1
  Scenario: OBS-DRAFT-03 — Ctrl/Cmd toggle preserves the draft
    Given the user has started a draft with body "Draft body"
    When the user Ctrl-clicks another line in the diff viewer
    Then no confirmation dialog appears
    And the draft body remains as entered

  @product @observation @etapa-1
  Scenario: OBS-DRAFT-04 — Shift extend preserves the draft
    Given the user has started a draft with body "Draft body"
    When the user Shift-clicks another line in the diff viewer
    Then no confirmation dialog appears
    And the draft body remains as entered

  @product @observation @etapa-1
  Scenario: OBS-DRAFT-05 — cancelling a dirty draft asks for confirmation and keeps draft and selection
    Given the user has started a draft with body "Draft body"
    When the user cancels the draft
    Then a confirmation dialog asks whether to discard the draft
    When the user keeps the draft
    Then the draft body remains as entered
    And the line selection remains in the diff viewer

  @product @observation @etapa-1
  Scenario: OBS-ERR-01 — creating without an active review shows an inline error
    Given no active review exists
    When the user attempts to create the observation
    Then an inline accessible error explains that a review is required

  @product @observation @etapa-1
  Scenario: OBS-ERR-02 — creating without a comparison draft shows an inline error
    Given no comparison draft is available
    When the user attempts to create the observation
    Then an inline accessible error explains that a comparison is required
