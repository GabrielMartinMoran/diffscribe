@product @ui @p1
Feature: UI root foundation — no white margin, themed background, sans-serif font, central area background, and favicon

  The application shell must render without white margins around the viewport.
  The html and body elements must have zero margin and inherit the active theme
  background. Text must use a sans-serif system-ui font stack. The central area
  (shell-layout, center-content, work-area, diff-area) must have a themed
  background that matches the active theme, even when no file is loaded.

  Background:
    Given DiffScribe is started

  # ────── Root element foundation ──────

  @product @ui @p1
  Scenario: No white margin around the viewport
    When the user views the application
    Then the html element has zero margin
    And the body element has zero margin

  @product @ui @p1
  Scenario: Body background matches the active theme in Dark Deep
    Given the active theme is "Dark Deep"
    When the user views the application
    Then the body background color matches the Dark Deep surface color

  @product @ui @p1
  Scenario: Body background matches the active theme in Synthwave '84
    Given the active theme is "Synthwave '84"
    When the user views the application
    Then the body background color matches the Synthwave '84 surface color

  @product @ui @p1
  Scenario: Text is readable in Dark Deep
    Given the active theme is "Dark Deep"
    When the user views the application
    Then body text is readable against the body background

  @product @ui @p1
  Scenario: Text is readable in Synthwave '84
    Given the active theme is "Synthwave '84"
    When the user views the application
    Then body text is readable against the body background

  @product @ui @p1
  Scenario: Page uses a sans-serif system-ui font family
    When the user views the application
    Then the body element uses a sans-serif system-ui font stack

  # ────── Central area background ──────

  @product @ui @p1
  Scenario: Central area has themed background with no file loaded
    Given no file is selected
    When the user views the application
    Then the shell-layout element has a themed background
    And the center-content element has a themed background
    And the work-area element has a themed background
    And the diff-area element has a themed background

  @product @ui @p1
  Scenario: Theme switching does not produce a white rectangle
    Given the active theme is "Dark Deep"
    When the user switches to "Synthwave '84"
    Then the central area background transitions without showing a white rectangle
    And the shell-layout background matches the Synthwave '84 theme

  @product @ui @p1
  Scenario: Desktop viewport preserves themed background across all regions
    Given the viewport width is 1440 px
    When the user views the application
    Then the html element background matches the active theme
    And the shell-layout element has no transparent gap

  @product @ui @p1
  Scenario: Mobile viewport preserves themed background
    Given the viewport width is 375 px
    When the user views the application
    Then the html element background matches the active theme
    And no white gap is visible between the left rail and the center area

  # ────── Favicon ──────

  @product @ui @favicon @p3
  Scenario: Favicon loads without a 404 error
    When the user views the application
    Then a favicon is served with HTTP 200 status
    And no 404 error appears in the browser console for the favicon

  @product @ui @favicon @p3
  Scenario: Favicon is referenced in the document head
    Given the application is running
    When the user inspects the document head
    Then a link element with rel "icon" references a valid favicon resource

  # ────── SvelteKit body wrapper (hardening) ──────

  @delta-added @product @ui @p1
  Scenario: No SvelteKit warning about %sveltekit.body% directly in body element
    When the application is built
    Then %sveltekit.body% is wrapped in a div with display contents
    And no SvelteKit warning about body is emitted

  @delta-added @product @ui @p1
  Scenario: Shell layout is visible and interactive after hydration
    Given DiffScribe is started
    When the user views the application
    Then the shell layout element is visible
    And the rail tabs are interactive

  @product @ui @p1 @e2e
  Scenario: The application is viewport-bound without a page-level scrollbar
    Given the application is loaded
    When the user inspects the document scrolling element
    Then the document does not scroll vertically or horizontally

  @product @ui @p1 @e2e
  Scenario: The rail fits its entries without clipping
    Given the rail entries are rendered
    When the user inspects the rail dimensions
    Then the rail shows all entries without clipping
    And the rail does not scroll vertically

  @product @ui @p1 @e2e
  Scenario: Each zone scrolls its own content independently
    Given a workspace with changed files is active
    When the user views the Project tree with many entries
    Then the Project tree scrolls inside the contextual panel
    When the user opens a diff with many lines
    Then the diff viewer scrolls vertically inside the central area
