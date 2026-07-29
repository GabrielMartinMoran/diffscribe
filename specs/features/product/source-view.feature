@product @source @viewer @etapa-1
Feature: Source view — working-tree file content with change markers, syntax highlighting, and read-only guarantees

  The source view renders the working-tree content of a file with syntax
  highlighting and line-level change markers that reflect the active
  Comparison. Recognized languages (TypeScript, JSON, Markdown) receive
  Shiki-based syntax highlighting; unsupported languages fall back to readable
  plain text. Deleted files, untracked files, and files exceeding the size
  limit are rendered as explicit read-only states. The source view never
  allows editing, never reveals the original committed content when the file
  differs from the working tree, and rejects reload or navigation attempts
  that would mutate the repository.

  Background:
    Given DiffScribe is started
    And a workspace is registered and active
    And the active Comparison is HEAD vs working tree

  # ────── Content and markers ──────

  @product @source @p1 @ui @e2e
  Scenario: Source view uses the working-tree content of the selected file
    Given the working tree version of "src/app.ts" contains "console.log('hello')"
    When the user opens "src/app.ts" in the source view
    Then the displayed content is "console.log('hello')"
    And the content matches the working tree, not the committed version

  @product @source @p1 @ui @e2e
  Scenario: Changed-line markers reflect the active Comparison
    Given the active Comparison shows "src/app.ts" has 3 added and 2 deleted lines
    When the user opens "src/app.ts" in the source view
    Then the 3 added lines have an added-line marker
    And the 2 deleted lines have a deleted-line marker
    And unchanged lines have no marker

  @product @source @p1 @ui @e2e
  Scenario: No change markers appear when the file is unchanged
    Given the active Comparison has no changes to "src/utils.ts"
    When the user opens "src/utils.ts" in the source view
    Then no line displays a change marker

  # ────── Syntax highlighting ──────

  @product @source @p1 @ui @e2e
  Scenario: TypeScript files receive syntax highlighting
    Given the file "src/app.ts" contains TypeScript code with keywords and types
    When the user opens "src/app.ts" in the source view
    Then TypeScript keywords and types are highlighted with distinct token colors

  @product @source @p1 @ui @e2e
  Scenario: JSON files receive syntax highlighting
    Given the file "config.json" contains valid JSON with keys, strings, and numbers
    When the user opens "config.json" in the source view
    Then JSON keys, strings, and numbers are highlighted with distinct token colors

  @product @source @p1 @ui @e2e
  Scenario: Markdown files receive syntax highlighting
    Given the file "README.md" contains Markdown with headings, lists, and code blocks
    When the user opens "README.md" in the source view
    Then headings, lists, and code blocks are highlighted with distinct token colors

  @product @source @p1 @ui @e2e
  Scenario: Unsupported language displays as readable plain text
    Given the file "data/unknown.xyz" cannot be identified as a recognized language
    When the user opens "data/unknown.xyz" in the source view
    Then the content is displayed as plain text
    And no syntax highlighting tokens are applied

  # ────── File states ──────

  @product @source @p1 @ui @e2e
  Scenario: Deleted file shows a deletion banner and no content
    Given the active Comparison includes a deleted file "src/removed.ts"
    When the user opens "src/removed.ts" in the source view
    Then the source view shows a banner indicating the file was deleted
    And no file content is displayed

  @product @source @p1 @ui @e2e
  Scenario: Untracked file shows content with all lines marked as added
    Given the active Comparison target is the working tree
    And the file "src/scratch.ts" is untracked
    When the user opens "src/scratch.ts" in the source view
    Then the content is displayed
    And every line has an added-line marker

  @product @source @p1 @p2 @ui @e2e
  Scenario: Oversize file shows a truncation notice
    Given the file "src/large.ts" exceeds the maximum source view size
    When the user opens "src/large.ts" in the source view
    Then the source view shows a notice that the file is too large to display
    And no file content is displayed

  @product @source @p1 @p2 @ui @e2e
  Scenario: Binary file shows a non-renderable notice
    Given the file "assets/logo.png" is a binary file
    When the user opens "assets/logo.png" in the source view
    Then the source view shows a notice that the file is binary
    And no file content is displayed

  # ────── Read-only guarantee ──────

  @product @source @p1 @ui @e2e
  Scenario: Source view is read-only and does not expose write controls
    Given the source view is displaying "src/app.ts"
    When the user inspects the source view controls
    Then no edit toolbar, cursor, or input is present
    And no keyboard shortcut triggers text modification

  @product @source @p1 @api @bdd @e2e
  Scenario: Source view never mutates the repository
    Given the source view is displaying "src/app.ts"
    When the user views the source
    Then the repository index is unchanged
    And no git add, checkout, or commit has been executed
