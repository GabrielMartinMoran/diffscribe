@product @ui @a11y @etapa-1
Feature: Base UI kit — generic stateless primitives

  The base UI kit in `src/lib/web/components/ui/` provides generic,
  stateless, token-driven primitives shared by every product surface. The kit
  uses native HTML where the platform provides it, exposes props down and
  events up, and never imports stores, server modules, application, or domain
  modules. Product composites stay outside `ui/`.

  Background:
    Given the UI kit directory exists at "src/lib/web/components/ui"
    And the UI kit is documented in "docs/design.md"

  # ────── Boundaries ──────

  @product @ui @p1 @e2e
  Scenario: The kit lives in a flat directory with no atom/molecule grouping
    Given the UI kit directory exists at "src/lib/web/components/ui"
    When the kit catalog is inspected
    Then the catalog lists Button, IconButton, TextInput, Select, Checkbox, Switch, Menu, Popover, Dialog, Tabs, Tooltip, Badge, and StatusBadge
    And no atom, molecule, or organism subdirectory exists

  @product @ui @p1 @unit
  Scenario: Kit primitives are stateless and isolated from application layers
    Given the UI kit sources are scanned
    When the import graph of every kit file is inspected
    Then no kit file imports stores, server, application, or domain modules
    And no kit file references product vocabulary

  # ────── Native HTML and semantics ──────

  @product @ui @p1 @e2e
  Scenario: Button and IconButton render a native button element
    Given a Button primitive is rendered
    Then it renders a native "button" element
    When an IconButton with label "Refresh" is rendered
    Then it renders a native "button" element with accessible name "Refresh"

  @product @ui @p1 @e2e
  Scenario: TextInput and Select associate labels, errors, and focus
    Given a TextInput with label "Repository Path" and an error message is rendered
    Then the label points to the input id
    And the input exposes aria-invalid and aria-describedby pointing at the error
    When a Select with label "Comparison" is rendered
    Then it renders a native "select" element associated with the label

  @product @ui @p1 @e2e
  Scenario: Checkbox and Switch are distinct native semantics
    Given a Checkbox with label "Remember selection" is rendered
    Then it renders a native "checkbox" input
    When a Switch with label "Line wrapping" is rendered
    Then it renders a native "checkbox" input with role "switch" and aria-checked

  @product @ui @p1 @e2e
  Scenario: Badge and StatusBadge render visible non-color-only text
    Given a Badge with text "beta" is rendered
    Then it renders a span with the visible text "beta"
    When a StatusBadge with text "Modified" and a neutral fallback is rendered
    Then it renders a span with the visible text "Modified" and a status dot
    And the state is not communicated by color alone

  # ────── Overlays and keyboard contracts ──────

  @product @ui @p1 @e2e
  Scenario: Dialog uses the native dialog element and returns focus on close
    Given a Dialog with title "Delete workspace" is open
    Then it renders a native "dialog" element opened with showModal
    And the title is linked to the dialog
    When the user presses the Escape key
    Then the dialog closes and focus returns to the invoker

  @product @ui @p1 @e2e
  Scenario: Tabs expose roving tabindex and arrow navigation
    Given a Tabs primitive with three tabs is rendered
    Then the tablist exposes one tab stop and aria-controls links each tab to its panel
    When the user presses ArrowRight on a focused tab
    Then focus moves to the next tab
    When the user presses Home
    Then focus moves to the first tab
    When the user presses End
    Then focus moves to the last tab

  @product @ui @p1 @e2e
  Scenario: Menu opens with aria-expanded and closes with Escape returning focus
    Given a Menu with two actions is rendered
    When the user activates the trigger
    Then the trigger exposes aria-haspopup and aria-expanded
    And the menu exposes role "menu" with two role "menuitem" actions
    When the user presses the Escape key
    Then the menu closes and focus returns to the trigger

  @product @ui @p1 @e2e
  Scenario: Popover is non-modal and supports Escape and light dismiss
    Given a Popover with content is rendered
    When the user activates the trigger
    Then the content is visible without a modal role
    When the user presses Escape or clicks outside
    Then the popover closes

  @product @ui @p1 @e2e
  Scenario: Tooltip opens on hover and focus and dismisses with Escape
    Given a Tooltip with text "Copy" wraps a trigger
    When the trigger receives keyboard focus
    Then the tooltip is visible and linked via aria-describedby
    When the user presses the Escape key
    Then the tooltip is dismissed

  # ────── Tokens, sizes, and motion ──────

  @product @ui @p1 @unit
  Scenario: Kit styles reference only declared design tokens
    Given the kit component styles are scanned
    When every CSS variable reference is checked against the token contract
    Then every referenced token is declared in the token contract

  @product @ui @p1 @e2e
  Scenario: Control sizes meet the minimum target size
    Given a Button in size "sm" is rendered
    When the button bounding box is measured
    Then the height is at least 24 pixels
    When a Button in size "md" and a Button in size "lg" are rendered
    Then the md height is at least 32 pixels and the lg height is at least 40 pixels
  @product @ui @p2 @e2e
  Scenario: Kit motion respects reduced motion preferences
    Given the user prefers reduced motion
    When a kit transition is inspected
    Then the effective duration is zero
