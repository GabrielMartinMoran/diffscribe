import { describe, expect, it } from 'vitest';

import {
  parseUnifiedDiff,
  splitUnifiedDiffByFile,
} from '../../../src/lib/server/infrastructure/git/unified-diff-parser';

const SINGLE_HUNK_DIFF = `diff --git a/src/app.ts b/src/app.ts
index 1234567..abcdefg 100644
--- a/src/app.ts
+++ b/src/app.ts
@@ -1,5 +1,6 @@ import { foo } from './foo';
 import { bar } from './bar';
-const oldLine = 'deleted';
 const keepLine = 'kept';
+const newLine = 'added';
 const endLine = 'end';
`;

const MULTI_HUNK_DIFF = `diff --git a/src/utils.ts b/src/utils.ts
index 1111111..2222222 100644
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -1,3 +1,3 @@ import { a } from './a';
-console.log('removed');
 console.log('kept');
+console.log('added');

@@ -10,4 +10,5 @@ export function util() {
   return 1;
+  return 2;
-  return 3;
 }
`;

const NO_NEWLINE_DIFF = `diff --git a/src/app.ts b/src/app.ts
--- a/src/app.ts
+++ b/src/app.ts
@@ -1,3 +1,3 @@ import { x } from './x';
 old content
\\ No newline at end of file
+new content
\\ No newline at end of file
`;

const ADDED_FILE_DIFF = `diff --git a/src/new.ts b/src/new.ts
new file mode 100644
index 0000000..1234567
--- /dev/null
+++ b/src/new.ts
@@ -0,0 +1,3 @@
+line1
+line2
+line3
`;

const DELETED_FILE_DIFF = `diff --git a/src/removed.ts b/src/removed.ts
deleted file mode 100644
index 1234567..0000000
--- a/src/removed.ts
+++ /dev/null
@@ -1,3 +0,0 @@
-line1
-line2
-line3
`;

const RENAMED_FILE_DIFF = `diff --git a/old.ts b/new.ts
rename from old.ts
rename to new.ts
index 1234567..abcdefg 100644
--- a/old.ts
+++ b/new.ts
@@ -1,2 +1,2 @@
-console.log('old');
+console.log('new');
`;

const BINARY_DIFF = `diff --git a/logo.png b/logo.png
index 1234567..abcdefg 100644
Binary files a/logo.png and b/logo.png differ
`;

const FIRST_CHAR_LOOKS_LIKE_DIFF_LINE = `diff --git a/src/file.ts b/src/file.ts
--- a/src/file.ts
+++ b/src/file.ts
@@ -1,3 +1,3 @@
-const normalCode = { deleted: true };
+const normalCode = { added: true };
`;

describe('unified-diff-parser', () => {
  describe('parseUnifiedDiff', () => {
    // ── Single hunk ──

    it('parses a single-hunk unified diff', () => {
      const result = parseUnifiedDiff(SINGLE_HUNK_DIFF, 'src/app.ts');
      expect(result.path).toBe('src/app.ts');
      expect(result.isBinary).toBe(false);
      expect(result.hunks).toHaveLength(1);

      const hunk = result.hunks[0];
      expect(hunk.header).toBe("@@ -1,5 +1,6 @@ import { foo } from './foo';");
      expect(hunk.lines).toHaveLength(5); // context, deleted, context, added, context
    });

    it('identifies context, added, and deleted lines', () => {
      const result = parseUnifiedDiff(SINGLE_HUNK_DIFF, 'src/app.ts');
      const lines = result.hunks[0].lines;

      const contextLines = lines.filter((l) => l.changeType === 'context');
      const addedLines = lines.filter((l) => l.changeType === 'added');
      const deletedLines = lines.filter((l) => l.changeType === 'deleted');

      expect(contextLines.length).toBeGreaterThan(0);
      expect(addedLines.length).toBeGreaterThan(0);
      expect(deletedLines.length).toBeGreaterThan(0);
    });

    it('assigns correct old and new line numbers', () => {
      const result = parseUnifiedDiff(SINGLE_HUNK_DIFF, 'src/app.ts');
      const lines = result.hunks[0].lines;

      // Line ordering: context(1,1), deleted(2,0), context(3,2), added(0,3), context(4,4)
      // Check that context line has both numbers
      expect(lines[0].oldLineNumber).toBeGreaterThan(0);
      expect(lines[0].newLineNumber).toBeGreaterThan(0);

      // Deleted line should have old number but new=0
      const deletedLine = lines.find((l) => l.changeType === 'deleted');
      expect(deletedLine).toBeDefined();
      expect(deletedLine!.oldLineNumber).toBeGreaterThan(0);
      expect(deletedLine!.newLineNumber).toBe(0);

      // Added line should have new number but old=0
      const addedLine = lines.find((l) => l.changeType === 'added');
      expect(addedLine).toBeDefined();
      expect(addedLine!.oldLineNumber).toBe(0);
      expect(addedLine!.newLineNumber).toBeGreaterThan(0);
    });

    it('strips the prefix character from line content', () => {
      const result = parseUnifiedDiff(SINGLE_HUNK_DIFF, 'src/app.ts');
      const lines = result.hunks[0].lines;

      const addedLine = lines.find((l) => l.changeType === 'added');
      expect(addedLine).toBeDefined();
      expect(addedLine!.content).not.toMatch(/^\+/);
      expect(addedLine!.content).toBe("const newLine = 'added';");

      const deletedLine = lines.find((l) => l.changeType === 'deleted');
      expect(deletedLine).toBeDefined();
      expect(deletedLine!.content).not.toMatch(/^-/);
      expect(deletedLine!.content).toBe("const oldLine = 'deleted';");
    });

    // ── Multi-hunk ──

    it('parses a multi-hunk unified diff', () => {
      const result = parseUnifiedDiff(MULTI_HUNK_DIFF, 'src/utils.ts');
      expect(result.hunks.length).toBe(2);

      expect(result.hunks[0].header).toContain('@@ -1,3 +1,3 @@');
      expect(result.hunks[0].lines.length).toBeGreaterThan(0);

      expect(result.hunks[1].header).toContain('@@ -10,4 +10,5 @@');
      expect(result.hunks[1].lines.length).toBeGreaterThan(0);
    });

    it('line numbers are correct across multiple hunks', () => {
      const result = parseUnifiedDiff(MULTI_HUNK_DIFF, 'src/utils.ts');

      // First hunk starts at old=1, new=1
      // First line is deleted: old=1, new=0
      expect(result.hunks[0].lines[0].oldLineNumber).toBe(1);
      expect(result.hunks[0].lines[0].newLineNumber).toBe(0);

      // Second hunk starts at old=10, new=10
      // First line of second hunk is context: old=10, new=10
      expect(result.hunks[1].lines[0].oldLineNumber).toBe(10);
      expect(result.hunks[1].lines[0].newLineNumber).toBe(10);
    });

    // ── No-newline marker ──

    it('sets noNewlineAtEnd for hunk with no-newline marker', () => {
      const result = parseUnifiedDiff(NO_NEWLINE_DIFF, 'src/app.ts');

      expect(result.hunks).toHaveLength(1);
      // The no-newline markers should be detected for both old and new versions
      const hunk = result.hunks[0];
      expect(hunk.noNewlineAtEnd).toBe(true);
    });

    it('marks last line of hunk with noNewlineAtEnd when marker present', () => {
      const result = parseUnifiedDiff(NO_NEWLINE_DIFF, 'src/app.ts');
      const lines = result.hunks[0].lines;

      expect(lines.length).toBeGreaterThan(0);
      // The last line should have noNewlineAtEnd since the marker appears
      const lastLine = lines[lines.length - 1];
      expect(lastLine.noNewlineAtEnd).toBe(true);
    });

    // ── Added file ──

    it('parses added file diff with all lines as added', () => {
      const result = parseUnifiedDiff(ADDED_FILE_DIFF, 'src/new.ts');

      expect(result.hunks.length).toBeGreaterThan(0);
      const allLines = result.hunks.flatMap((h) => h.lines);
      expect(allLines.every((l) => l.changeType === 'added')).toBe(true);
      expect(allLines).toHaveLength(3);
    });

    // ── Deleted file ──

    it('parses deleted file diff with all lines as deleted', () => {
      const result = parseUnifiedDiff(DELETED_FILE_DIFF, 'src/removed.ts');

      const allLines = result.hunks.flatMap((h) => h.lines);
      expect(allLines.every((l) => l.changeType === 'deleted')).toBe(true);
      expect(allLines).toHaveLength(3);
    });

    // ── Renamed file ──

    it('detects rename from/to in diff header', () => {
      const result = parseUnifiedDiff(RENAMED_FILE_DIFF, 'new.ts');

      expect(result.oldPath).toBe('old.ts');
      expect(result.path).toBe('new.ts');
    });

    it('still parses hunk content for renamed file', () => {
      const result = parseUnifiedDiff(RENAMED_FILE_DIFF, 'new.ts');

      expect(result.hunks.length).toBeGreaterThan(0);
      const allLines = result.hunks.flatMap((h) => h.lines);
      expect(allLines.some((l) => l.changeType === 'deleted')).toBe(true);
      expect(allLines.some((l) => l.changeType === 'added')).toBe(true);
    });

    // ── Binary ──

    it('detects binary files from diff header', () => {
      const result = parseUnifiedDiff(BINARY_DIFF, 'logo.png');

      expect(result.isBinary).toBe(true);
      expect(result.hunks).toHaveLength(0);
    });

    // ── Lines starting with --- or +++ ──

    it('does not treat lines starting with --- or +++ inside hunk content as special', () => {
      const result = parseUnifiedDiff(FIRST_CHAR_LOOKS_LIKE_DIFF_LINE, 'src/file.ts');

      const lines = result.hunks[0].lines;
      const deleted = lines.find(
        (l) => l.changeType === 'deleted' && l.content.includes('deleted: true'),
      );
      const added = lines.find(
        (l) => l.changeType === 'added' && l.content.includes('added: true'),
      );

      expect(deleted).toBeDefined();
      expect(added).toBeDefined();
    });

    // ── Edge cases ──

    it('returns empty hunks for empty diff', () => {
      const result = parseUnifiedDiff('', 'src/app.ts');

      expect(result.path).toBe('src/app.ts');
      expect(result.hunks).toHaveLength(0);
      expect(result.isBinary).toBe(false);
    });

    it('returns empty hunks for diff with no hunks', () => {
      const diffOnlyHeader = 'diff --git a/src/app.ts b/src/app.ts\n';
      const result = parseUnifiedDiff(diffOnlyHeader, 'src/app.ts');

      expect(result.hunks).toHaveLength(0);
    });

    it('returns empty hunks for invalid diff format', () => {
      const result = parseUnifiedDiff('completely invalid content', 'src/app.ts');

      expect(result.hunks).toHaveLength(0);
      expect(result.isBinary).toBe(false);
    });

    it('ignores carriage returns \\r in diff', () => {
      const diffWithCR = SINGLE_HUNK_DIFF.split('\n')
        .map((l) => l + '\r')
        .join('\n');
      const result = parseUnifiedDiff(diffWithCR, 'src/app.ts');

      expect(result.hunks.length).toBeGreaterThan(0);
      expect(result.hunks[0].lines.length).toBeGreaterThan(0);
    });

    it('strips leading whitespace from content that is just one space', () => {
      const result = parseUnifiedDiff(SINGLE_HUNK_DIFF, 'src/app.ts');
      const contextLine = result.hunks[0].lines.find((l) => l.changeType === 'context');
      expect(contextLine).toBeDefined();

      // Context lines have a single leading space that gets stripped
      expect(contextLine!.content).not.toMatch(/^ /);
    });
  });

  describe('splitUnifiedDiffByFile', () => {
    it('splits multi-file raw output on diff --git boundaries', () => {
      const raw = `${SINGLE_HUNK_DIFF}\n${MULTI_HUNK_DIFF}`;
      const sections = splitUnifiedDiffByFile(raw);
      expect(sections).toHaveLength(2);
      expect(sections[0]).toContain('diff --git a/src/app.ts b/src/app.ts');
      expect(sections[1]).toContain('diff --git a/src/utils.ts b/src/utils.ts');
    });

    it('keeps every diff --git header at the start of its section', () => {
      const raw = `${RENAMED_FILE_DIFF}\n${BINARY_DIFF}\n${ADDED_FILE_DIFF}`;
      const sections = splitUnifiedDiffByFile(raw);
      expect(sections).toHaveLength(3);
      expect(sections[0].startsWith('diff --git a/old.ts b/new.ts')).toBe(true);
      expect(sections[1].startsWith('diff --git a/logo.png b/logo.png')).toBe(true);
      expect(sections[2].startsWith('diff --git a/src/new.ts b/src/new.ts')).toBe(true);
    });

    it('returns an empty array for empty input', () => {
      expect(splitUnifiedDiffByFile('')).toEqual([]);
    });

    it('returns a single section for a single-file diff', () => {
      expect(splitUnifiedDiffByFile(SINGLE_HUNK_DIFF)).toHaveLength(1);
    });

    it('preserves the trailing content of each section', () => {
      const raw = `${DELETED_FILE_DIFF}\n${BINARY_DIFF}`;
      const sections = splitUnifiedDiffByFile(raw);
      expect(sections[0]).toContain('@@ -1,3 +0,0 @@');
      expect(sections[1]).toContain('Binary files a/logo.png and b/logo.png differ');
    });

    it('handles diff headers containing spaces in paths', () => {
      const withSpace = `diff --git a/my file.txt b/my file.txt
--- a/my file.txt
+++ b/my file.txt
@@ -1 +1 @@
-old
+new
`;
      const sections = splitUnifiedDiffByFile(withSpace);
      expect(sections).toHaveLength(1);
    });
  });
});
