@application @git @comparison @file-list @etapa-1
Feature: File list adapter — typed DTOs with status mapping, binary detection, and no mutation

  The file list adapter translates raw simple-git diff and status output into
  typed FileListEntry DTOs. Each entry carries a file path, change status, a
  binary flag, and — when applicable — an old path for renamed or copied files.
  The adapter supports all eight ComparisonTypes and enforces the exact
  untracked inclusion and exclusion contract: only comparisons whose target is
  the working tree include untracked files. Untracked binary files are detected
  by a read-only content inspection; unreadable files produce a typed error on
  the entry without mutating the file, the index, or the repository. Every
  adapter method returns either a typed result or a typed error; raw simple-git
  data structures and stack traces never leak past the adapter boundary.
  The adapter never runs git add, git checkout, git commit, or any mutating
  operation.

  # ────── Status mapping ──────

  @p1 @api @bdd
  Scenario: Map an added file to a FileListEntry with status "added"
    Given the active Comparison has one added file "src/new.ts"
    When the adapter builds the file list for that Comparison
    Then the entry for "src/new.ts" has status "added"
    And the entry has the binary flag set to false
    And no raw simple-git data structure is exposed to the caller

  @p1 @api @bdd
  Scenario: Map a modified file to a FileListEntry with status "modified"
    Given the active Comparison has one modified file "src/changed.ts"
    When the adapter builds the file list for that Comparison
    Then the entry for "src/changed.ts" has status "modified"
    And the entry has the binary flag set to false

  @p1 @api @bdd
  Scenario: Map a deleted file to a FileListEntry with status "deleted"
    Given the active Comparison has one deleted file "src/removed.ts"
    When the adapter builds the file list for that Comparison
    Then the entry for "src/removed.ts" has status "deleted"
    And the entry has the binary flag set to false

  @p1 @api @bdd
  Scenario: Map a renamed file with oldPath and newPath in the DTO
    Given the active Comparison has a file renamed from "old.ts" to "new.ts"
    When the adapter builds the file list for that Comparison
    Then the entry for "new.ts" has status "renamed"
    And the entry has oldPath set to "old.ts"
    And the entry has newPath set to "new.ts"
    And the entry has the binary flag set to false

  @p2 @api @bdd
  Scenario: Map a copied file to a FileListEntry with status "copied"
    Given the active Comparison has a file copied from "src/original.ts" to "src/duplicate.ts"
    When the adapter builds the file list for that Comparison
    Then the entry for "src/duplicate.ts" has status "copied"
    And the entry has oldPath set to "src/original.ts"

  @p2 @api @bdd
  Scenario: Map a type-changed file to a FileListEntry with status "type-changed"
    Given the active Comparison has a file whose type changed
    When the adapter builds the file list for that Comparison
    Then the entry for that file has status "type-changed"

  @p2 @api @bdd
  Scenario: Map an unmerged file to a FileListEntry with status "unmerged"
    Given the active Comparison has an unmerged file "src/conflict.ts"
    When the adapter builds the file list for that Comparison
    Then the entry for "src/conflict.ts" has status "unmerged"

  @p1 @api @bdd
  Scenario: Map an untracked file to a FileListEntry with status "untracked"
    Given the active Comparison target is the working tree
    And the working tree has an untracked file "src/untracked.ts"
    When the adapter builds the file list for that Comparison
    Then the entry for "src/untracked.ts" has status "untracked"
    And the entry has the binary flag set to false

  @p3 @api @bdd
  Scenario: Map an unrecognized Git status to status "unknown"
    Given simple-git returns a status code that is not in the known mapping set
    When the adapter maps the raw status to a FileListEntry
    Then the entry has status "unknown"

  # ────── Binary detection ──────

  @p1 @api @bdd
  Scenario: A binary file is marked with the binary flag set to true
    Given the active Comparison includes a binary file "assets/logo.png"
    And simple-git identifies "assets/logo.png" as binary
    When the adapter builds the file list for that Comparison
    Then the entry for "assets/logo.png" has the binary flag set to true

  @p1 @api @bdd
  Scenario: A text file is marked with the binary flag set to false
    Given the active Comparison includes a text file "README.md"
    And simple-git does not identify "README.md" as binary
    When the adapter builds the file list for that Comparison
    Then the entry for "README.md" has the binary flag set to false

  @p1 @api @bdd
  Scenario: Binary untracked file is detected by reading content read-only
    Given the active Comparison target is the working tree
    And the working tree has an untracked file "data/untracked.bin"
    And a read-only inspection of "data/untracked.bin" detects binary content
    When the adapter builds the file list for that Comparison
    Then the entry for "data/untracked.bin" has the binary flag set to true
    And no git add or git add -N was executed on the repository

  # ────── Special paths ──────

  @p3 @api @bdd
  Scenario: Files with special characters in the path are handled correctly
    Given the active Comparison includes a file "src/data with spaces.ts"
    And the active Comparison includes a file "src/emoji-🌟.ts"
    When the adapter builds the file list for that Comparison
    Then the entry for "src/data with spaces.ts" is present
    And the entry for "src/emoji-🌟.ts" is present
    And both entries carry the correct file path

  @p3 @api @bdd
  Scenario: An unreadable file produces an error entry without mutating the repository
    Given the active Comparison target is the working tree
    And the working tree has an untracked file "restricted/secrets.env" that is not readable
    When the adapter attempts to read "restricted/secrets.env" for binary detection
    Then the entry for "restricted/secrets.env" has an error indicator
    And the entry status is still "untracked"
    And no exception is thrown to the caller
    And the repository index is unchanged

  # ────── Untracked inclusion — working-tree target ──────

  @p1 @api @bdd
  Scenario: Comparison working-tree-vs-head includes untracked files
    Given the active Comparison type is "working-tree-vs-head"
    And the working tree has 3 untracked files
    When the adapter builds the file list
    Then the file list includes all 3 untracked files
    And each untracked entry has status "untracked"

  @p2 @api @bdd
  Scenario: Comparison commit-vs-working-tree includes untracked files
    Given the active Comparison type is "commit-vs-working-tree"
    And the working tree has 2 untracked files
    When the adapter builds the file list
    Then the file list includes both untracked files
    And each untracked entry has status "untracked"

  @p2 @api @bdd
  Scenario: Comparison branch-vs-working-tree includes untracked files
    Given the active Comparison type is "branch-vs-working-tree"
    And the working tree has 1 untracked file
    When the adapter builds the file list
    Then the file list includes the untracked file
    And the untracked entry has status "untracked"

  # ────── Untracked exclusion — committed or index target ──────

  @p1 @api @bdd
  Scenario: Comparison unstaged excludes untracked files
    Given the active Comparison type is "unstaged"
    And the working tree has untracked files
    When the adapter builds the file list
    Then the file list does not include any file with status "untracked"
    And only staged and modified files with unstaged changes are included

  @p2 @api @bdd
  Scenario: Comparison staged-vs-head excludes untracked files
    Given the active Comparison type is "staged-vs-head"
    And the working tree has untracked files
    When the adapter builds the file list
    Then the file list does not include any file with status "untracked"
    And only staged files are included

  @p2 @api @bdd
  Scenario: Committed-target comparisons exclude untracked files
    Given the active Comparison type is "branch-vs-branch"
    And the working tree has untracked files
    When the adapter builds the file list
    Then the file list does not include any file with status "untracked"

  # ────── Typed error results ──────

  @p2 @api @bdd
  Scenario: Git command failure returns a typed error result, not a thrown exception
    Given simple-git diff throws a GitError during file list construction
    When the adapter catches the error
    Then the adapter returns a FileListError result
    And the FileListError has a userFacingMessage
    And the FileListError has an errorCode
    And the FileListError does not expose the raw simple-git error stack trace
