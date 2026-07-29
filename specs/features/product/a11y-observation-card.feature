@product @a11y @delta-added @etapa-1 @observation
Feature: Accessibility of observation card — actions visibility via CSS hover and focus

  Observation card actions (Edit, Resolve, Dismiss, Pending, Delete) are now
  hidden by default and revealed via CSS when the card is hovered or receives
  keyboard focus (`:hover` / `:focus-within` on `.obs-card`). This replaces
  the previous JavaScript `mouseenter`/`mouseleave`/`focusin`/`focusout`
  handlers that required an ARIA role on the container. When `readOnly` is
  true no action buttons are rendered at all.

  Background:
    Given DiffScribe is started
    And a workspace is registered and active
    And the active Comparison is HEAD vs working tree
    And an active review draft exists for the workspace
    And an observation of type "issue" exists with title "Check A11y"
    And the observation panel is visible

  @p1 @ui @a11y @delta-added
  Scenario: Action buttons appear when the card receives keyboard focus
    When keyboard focus moves onto an observation card
    Then the action buttons become visible

  @p1 @ui @a11y @delta-added
  Scenario: Action buttons disappear when focus leaves the card
    Given an observation card has keyboard focus and its actions are visible
    When focus moves outside the card
    Then the action buttons are hidden

  @p1 @ui @a11y @delta-added
  Scenario: Action buttons appear when the card is hovered with the mouse
    When the mouse hovers over an observation card
    Then the action buttons become visible

  @p1 @ui @a11y @delta-added
  Scenario: Action buttons are never rendered when the review is read-only
    Given the active review is completed
    When the user views an observation card
    Then no action buttons exist in the DOM for that card
