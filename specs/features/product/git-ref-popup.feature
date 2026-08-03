@product @git @comparison @tranche-c
Feature: Git ref popup — Base/Target branch selector

  Base and Target are two independent triggers. Each opens a
  product-specific inline non-modal popup inside the Git context panel, with
  internal scroll and no portal; opening one closes the other. The popup
  shows Local and Cached remote branch groups ordered by recency, filters
  both groups with fuzzy matching, and follows the ARIA combobox pattern
  (role=combobox, listbox/options, aria-expanded/controls/activedescendant,
  aria-selected). Selecting a branch updates exactly one comparison slot
  through the existing notification path, without checkout or any repository
  mutation. The canonical ref is the selection value so local and cached
  remote branches with the same visible name never collide; full refs are
  never shown. The current branch has a separate marker that is distinct
  from aria-selected.

  Background:
    Given DiffScribe is started
    And a workspace is registered and active

  # ────── Popup behavior ──────

  @p1 @ui @e2e
  Scenario: Base popup opens non-modal with autofocused search
    Given the Git context panel is visible
    When the user activates the Base trigger
    Then a non-modal popup opens inside the panel
    And the search input is focused

  @p1 @ui @e2e
  Scenario: Opening one trigger closes the other
    Given the Base popup is open
    When the user activates the Target trigger
    Then the Base popup closes
    And the Target popup opens

  @p2 @ui @e2e
  Scenario: Branch groups are ordered by recency with visible remote labels
    Given the workspace has local branches "dev" and "old"
    And the workspace has cached remote branches "origin/main" and "origin/old"
    When the user opens the Base popup
    Then the Local group appears before the Cached remote group
    And within each group branches are ordered by committer date descending
    And the cached remote branch is visible as "origin/main" without full refs

  @p2 @ui @e2e
  Scenario: Local and cached remote branches with the same visible name do not collide
    Given the workspace has a local branch "origin/main"
    And the workspace has a cached remote branch "origin/main"
    When the user selects the cached remote branch "origin/main"
    Then the draft stores the canonical ref "refs/remotes/origin/main"
    When the user selects the local branch "origin/main"
    Then the draft stores the canonical ref "refs/heads/origin/main"

  # ────── Draft updates ──────

  @p2 @api @e2e
  Scenario: Selection updates one draft and infers the comparison without checkout
    Given the Base popup is open
    When the user selects branch "dev"
    Then the Base slot displays "dev"
    And the ephemeral Comparison draft has base canonical ref "refs/heads/dev"
    And the repository does not check out "dev"

  @p3 @ui @e2e
  Scenario: Current branch marker is separate from aria-selected
    Given the workspace current branch is "dev"
    And the Base popup is open with "dev" selected in the Base slot
    Then the option "dev" has aria-selected true
    And the current branch has a separate visual and accessibility marker
    And no other option has aria-selected true

  # ────── Keyboard, focus, and IME ──────

  @p3 @ui @e2e
  Scenario: Arrow keys navigate with wrap, Home and End jump, Enter accepts
    Given the Base popup is open with multiple branches
    When the user presses ArrowDown past the last option
    Then the active option wraps to the first option
    When the user presses End
    Then the last option is active
    When the user presses Home
    Then the first option is active
    When the user presses Enter
    Then the popup closes and the branch is selected

  @p3 @ui @e2e
  Scenario: Escape closes without changing the draft and restores focus to the trigger
    Given the Base popup is open
    And the Base slot shows "master"
    When the user presses Escape
    Then the popup closes
    And the Base slot still shows "master"
    And focus returns to the Base trigger

  @p3 @ui @e2e
  Scenario: Composing IME input never accepts or closes
    Given the Base popup is open
    When the user types with an active IME composition
    Then no branch is selected
    And the popup stays open

  # ────── Async refresh states (post-tranche C hardening) ──────
  #
  # The popup reflects the panel refresh lifecycle: a real loading state
  # only while a refresh is in flight and no branches are known, an inline
  # error with Retry when the refresh fails while the popup is open, and
  # recovery through Retry. The global banner yields to the popup alert so
  # exactly one alert owner exists while the popup is open.

  @p2 @ui @e2e
  Scenario: Popup shows a real loading state during a slow refresh without branches
    Given the Base popup is open in a workspace with no branches
    When the Git context refresh is slow to respond
    Then the popup shows a loading state
    When the refresh completes
    Then the popup shows the empty state again

  @p2 @ui @e2e
  Scenario: Existing branch options stay visible during a background refresh
    Given the Base popup is open with multiple branches
    When the Git context refresh is slow to respond
    Then the popup keeps the existing branch options visible
    And the popup does not show a loading state

  @p2 @ui @e2e
  Scenario: A failed refresh inside an open popup shows one inline error with Retry
    Given the Base popup is open with multiple branches
    When the Git context refresh fails
    Then the popup shows an inline error with a Retry action
    And the panel shows exactly one alert
    And the popup stays open

  @p2 @ui @e2e
  Scenario: Retry from the popup recovers and restores the branch options
    Given the Base popup shows a refresh error with a Retry action
    When the user clicks Retry in the popup
    And the refresh succeeds
    Then the popup error disappears
    And the popup shows the branch options again

  # ────── Filtering and states ──────

  @p2 @ui @e2e
  Scenario: Fuzzy filter matches across both groups with a no-match state
    Given the Base popup is open with local branches "dev" and "docs"
    And cached remote branches "origin/dev" and "origin/ops"
    When the user types "dv" in the search input
    Then the options "dev" and "origin/dev" are visible
    And branches "docs" and "origin/ops" are hidden
    When the user types "zzz" in the search input
    Then the popup shows a no-match state

  @p3 @ui @e2e
  Scenario: Empty popup and error/retry states are accessible
    Given the workspace has no branches
    When the user opens the Base popup
    Then the popup shows an empty state
    And the popup shows loading and error/retry states when branches fail to load

  # ────── Responsive ──────

  @p3 @ui @e2e
  Scenario Outline: Popup fits the panel at compact viewports without horizontal overflow
    Given the viewport width is <width> pixels
    And the Base popup is open with many branches
    Then the popup fits inside the Git context panel
    And the popup scrolls internally without horizontal overflow

    Examples:
      | width |
      | 320   |
      | 375   |
      | 768   |
