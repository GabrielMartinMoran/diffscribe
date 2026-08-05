import type {
  DiffChangeType,
  DiffHunk,
  DiffLine,
} from '$lib/server/application/dto/results/file-diff-results';

export interface ParsedDiff {
  path: string;
  oldPath?: string;
  hunks: DiffHunk[];
  isBinary: boolean;
}

interface HunkHeaderInfo {
  oldStart: number;
  newStart: number;
  context: string;
}

function parseHunkHeader(line: string): HunkHeaderInfo | null {
  const match = line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/);
  if (!match) return null;

  return {
    oldStart: parseInt(match[1], 10),
    newStart: parseInt(match[3], 10),
    context: match[5].trim(),
  };
}

function getChangeType(prefix: string): DiffChangeType | null {
  if (prefix === ' ') return 'context';
  if (prefix === '+') return 'added';
  if (prefix === '-') return 'deleted';
  return null;
}

export function parseUnifiedDiff(raw: string, filePath: string): ParsedDiff {
  if (!raw) {
    return { path: filePath, hunks: [], isBinary: false };
  }

  const lines = raw.replace(/\r/g, '').split('\n');
  const hunks: DiffHunk[] = [];
  let oldPath: string | undefined;
  let isBinary = false;

  let currentHunk: DiffHunk | null = null;
  let oldLineNum = 0;
  let newLineNum = 0;
  let inHunk = false;

  for (const rawLine of lines) {
    // Detect rename
    if (rawLine.startsWith('rename from ')) {
      oldPath = rawLine.slice('rename from '.length).trim();
      continue;
    }

    // Detect binary
    if (/^Binary files /.test(rawLine)) {
      isBinary = true;
      continue;
    }

    // Skip diff/mode/index/---/+++ header lines unless they're new file markers
    if (
      rawLine.startsWith('diff --git ') ||
      rawLine.startsWith('index ') ||
      rawLine.startsWith('new file ') ||
      rawLine.startsWith('deleted file ') ||
      rawLine.startsWith('similarity index ')
    ) {
      continue;
    }

    if (rawLine === '--- /dev/null' || rawLine === '+++ /dev/null') {
      continue;
    }

    if (
      rawLine.startsWith('--- a/') &&
      !rawLine.includes('/dev/null') &&
      !rawLine.startsWith('--- a/v4-')
    ) {
      const oldPathFromHeader = rawLine.slice('--- a/'.length).trim();
      if (oldPathFromHeader && oldPathFromHeader !== filePath) {
        oldPath = oldPathFromHeader;
      }
      continue;
    }

    if (rawLine.startsWith('+++ b/') || rawLine.startsWith('+++ a/')) {
      continue;
    }

    // No newline marker
    if (rawLine === '\\ No newline at end of file') {
      if (inHunk && currentHunk) {
        currentHunk.noNewlineAtEnd = true;

        // Mark the last line that has content as having no newline
        const lastAddition = findLast(currentHunk.lines, 'added');
        const lastDeletion = findLast(currentHunk.lines, 'deleted');

        if (lastAddition || lastDeletion) {
          const target = lastAddition ?? lastDeletion;
          if (target) {
            target.noNewlineAtEnd = true;
          }
        } else {
          const lastLine = currentHunk.lines[currentHunk.lines.length - 1];
          if (lastLine) {
            lastLine.noNewlineAtEnd = true;
          }
        }
      }
      continue;
    }

    // Hunk header
    const hunkInfo = parseHunkHeader(rawLine);
    if (hunkInfo) {
      if (currentHunk) {
        hunks.push(currentHunk);
      }

      oldLineNum = hunkInfo.oldStart;
      newLineNum = hunkInfo.newStart;
      currentHunk = {
        header: rawLine,
        lines: [],
      };
      inHunk = true;
      continue;
    }

    // Hunk content lines
    if (inHunk && currentHunk) {
      const prefix = rawLine.charAt(0);
      const changeType = getChangeType(prefix);

      if (changeType) {
        const content = rawLine.slice(1);
        const line: DiffLine = {
          changeType,
          content,
          oldLineNumber: 0,
          newLineNumber: 0,
        };

        if (changeType === 'context') {
          line.oldLineNumber = oldLineNum;
          line.newLineNumber = newLineNum;
          oldLineNum++;
          newLineNum++;
        } else if (changeType === 'deleted') {
          line.oldLineNumber = oldLineNum;
          line.newLineNumber = 0;
          oldLineNum++;
        } else if (changeType === 'added') {
          line.oldLineNumber = 0;
          line.newLineNumber = newLineNum;
          newLineNum++;
        }

        currentHunk.lines.push(line);
      }
    }
  }

  // Push final hunk
  if (currentHunk && currentHunk.lines.length > 0) {
    hunks.push(currentHunk);
  }

  return {
    path: filePath,
    oldPath,
    hunks,
    isBinary,
  };
}

function findLast(lines: DiffLine[], changeType: DiffChangeType): DiffLine | undefined {
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].changeType === changeType) {
      return lines[i];
    }
  }
  return undefined;
}

/**
 * Split a combined multi-file `git diff` output into per-file sections on
 * `diff --git ` block boundaries. Pure helper used by the aggregate complete
 * diff reader; each section is parsed independently with `parseUnifiedDiff`.
 * Empty input yields an empty array.
 */
export function splitUnifiedDiffByFile(raw: string): string[] {
  if (!raw) return [];

  const sections: string[] = [];
  let current: string[] | null = null;

  for (const line of raw.replace(/\r/g, '').split('\n')) {
    if (line.startsWith('diff --git ')) {
      if (current) {
        sections.push(current.join('\n'));
      }
      current = [line];
    } else if (current) {
      current.push(line);
    }
  }

  if (current) {
    sections.push(current.join('\n'));
  }

  return sections;
}
