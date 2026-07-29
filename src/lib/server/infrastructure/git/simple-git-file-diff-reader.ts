import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { simpleGit } from 'simple-git';

import type { FileDiffResult } from '$lib/server/application/dto/results/file-diff-results';
import type {
  GitFileDiffReader,
  GitFileDiffReaderReadParams,
} from '$lib/server/application/git-file-diff-reader';
import { ComparisonType } from '$lib/server/domain/value-objects/comparison';

import { parseUnifiedDiff } from './unified-diff-parser';

const MAX_SIZE_BYTES = 256 * 1024; // 256 KB
const MAX_LINES = 5000;

function buildDiffArgs(
  comparisonType: ComparisonType,
  baseRef: string,
  targetRef: string,
): string[] {
  const args: string[] = [];

  switch (comparisonType) {
    case ComparisonType.WORKING_TREE_VS_HEAD:
      args.push('HEAD');
      break;
    case ComparisonType.STAGED_VS_HEAD:
      args.push('--cached', 'HEAD');
      break;
    case ComparisonType.UNSTAGED:
      break;
    case ComparisonType.BRANCH_VS_BRANCH:
      args.push(baseRef, targetRef);
      break;
    case ComparisonType.COMMIT_VS_COMMIT:
      args.push(baseRef, targetRef);
      break;
    case ComparisonType.COMMIT_VS_WORKING_TREE:
      args.push(baseRef);
      break;
    case ComparisonType.BRANCH_VS_WORKING_TREE:
      args.push(baseRef);
      break;
    case ComparisonType.COMMIT_RANGE:
      args.push(`${baseRef}..${targetRef}`);
      break;
  }

  return args;
}

function shouldReadUntrackedFromDisk(comparisonType: ComparisonType): boolean {
  return (
    comparisonType === ComparisonType.WORKING_TREE_VS_HEAD ||
    comparisonType === ComparisonType.COMMIT_VS_WORKING_TREE ||
    comparisonType === ComparisonType.BRANCH_VS_WORKING_TREE
  );
}

function isBinaryContent(filePath: string): boolean {
  try {
    const buf = readFileSync(filePath, { flag: 'r' });
    const maxCheck = Math.min(buf.length, 8000);
    for (let i = 0; i < maxCheck; i++) {
      if (buf[i] === 0) return true;
    }
    return false;
  } catch {
    return false;
  }
}

function synthesizeUntrackedDiff(filePath: string): string {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    // Last element may be empty string from trailing newline
    const hasTrailingNewline = lines.length > 1 && lines[lines.length - 1] === '';
    const actualLines = hasTrailingNewline ? lines.slice(0, -1) : lines;
    const lineCount = actualLines.length;

    let diff = `--- /dev/null\n+++ b/${path.basename(filePath)}\n`;
    diff += `@@ -0,0 +1,${lineCount} @@\n`;

    for (const line of actualLines) {
      diff += `+${line}\n`;
    }

    if (!hasTrailingNewline) {
      diff += '\\ No newline at end of file\n';
    }

    return diff;
  } catch {
    return '';
  }
}

function applySizeCap<T extends { lines: Array<{ content: string }> }>(
  hunks: T[],
): {
  hunks: T[];
  isTruncated: boolean;
  truncationReason?: string;
} {
  const { totalLines, totalBytes } = countHunkLinesAndBytes(hunks);

  if (totalBytes > MAX_SIZE_BYTES) {
    const capped = capHunksByBytes(hunks, MAX_SIZE_BYTES);
    return { hunks: capped, isTruncated: true, truncationReason: 'Content exceeds 256 KB' };
  }

  if (totalLines > MAX_LINES) {
    const capped = capHunksByLines(hunks, MAX_LINES);
    return { hunks: capped, isTruncated: true, truncationReason: 'Content exceeds 5000 lines' };
  }

  return { hunks, isTruncated: false };
}

function countHunkLinesAndBytes<T extends { lines: Array<{ content: string }> }>(
  hunks: T[],
): {
  totalLines: number;
  totalBytes: number;
} {
  let totalLines = 0;
  let totalBytes = 0;

  for (const hunk of hunks) {
    totalLines += hunk.lines.length;
    for (const line of hunk.lines) {
      totalBytes += Buffer.byteLength(line.content, 'utf-8');
    }
  }

  return { totalLines, totalBytes };
}

function capHunksByBytes<T extends { lines: Array<{ content: string }> }>(
  hunks: T[],
  maxBytes: number,
): T[] {
  const result: T[] = [];
  let currentBytes = 0;

  for (const hunk of hunks) {
    const cappedLines: Array<{ content: string }> = [];
    for (const line of hunk.lines) {
      const lineBytes = Buffer.byteLength(line.content, 'utf-8');
      if (currentBytes + lineBytes > maxBytes) {
        return result;
      }
      cappedLines.push(line);
      currentBytes += lineBytes;
    }
    if (cappedLines.length > 0) {
      result.push({ ...hunk, lines: cappedLines });
    }
  }

  return result;
}

function capHunksByLines<T extends { lines: Array<{ content: string }> }>(
  hunks: T[],
  maxLines: number,
): T[] {
  const result: T[] = [];
  let currentLines = 0;

  for (const hunk of hunks) {
    const cappedLines: Array<{ content: string }> = [];
    for (const line of hunk.lines) {
      if (currentLines >= maxLines) {
        return result;
      }
      cappedLines.push(line);
      currentLines++;
    }
    if (cappedLines.length > 0) {
      result.push({ ...hunk, lines: cappedLines });
    }
  }

  return result;
}

export class SimpleGitFileDiffReader implements GitFileDiffReader {
  async read(params: GitFileDiffReaderReadParams): Promise<FileDiffResult> {
    const now = new Date().toISOString();
    const { repositoryPath, comparisonType, baseRef, targetRef, relativePath } = params;

    if (!existsSync(repositoryPath)) {
      return {
        path: relativePath,
        hunks: [],
        isBinary: false,
        isTruncated: false,
        readAt: now,
        error: { message: 'Repository path does not exist', errorCode: 'PATH_NOT_FOUND' },
      };
    }

    const git = simpleGit({ baseDir: repositoryPath });

    try {
      const isRepo = await git.checkIsRepo();
      if (!isRepo) {
        return {
          path: relativePath,
          hunks: [],
          isBinary: false,
          isTruncated: false,
          readAt: now,
          error: { message: 'Not a Git repository', errorCode: 'NOT_A_GIT_REPOSITORY' },
        };
      }
    } catch {
      return {
        path: relativePath,
        hunks: [],
        isBinary: false,
        isTruncated: false,
        readAt: now,
        error: { message: 'Git error checking repository', errorCode: 'NOT_A_GIT_REPOSITORY' },
      };
    }

    // Check if file exists on disk for untracked detection
    const fullPath = path.join(repositoryPath, relativePath);
    const fileExistsOnDisk = existsSync(fullPath);

    // Try git diff first
    let rawDiff: string;

    try {
      const args = buildDiffArgs(comparisonType, baseRef, targetRef);
      // Also add rename detection
      rawDiff = await git.raw('diff', '--unified=3', '-M', '-C', '-C', ...args, '--', relativePath);
    } catch {
      return {
        path: relativePath,
        hunks: [],
        isBinary: false,
        isTruncated: false,
        readAt: now,
        error: { message: 'Git diff command failed', errorCode: 'GIT_ERROR' },
      };
    }

    // Parse the diff
    let parsed = parseUnifiedDiff(rawDiff, relativePath);

    // Fallback: detect rename via name-status when path-filtered diff loses rename info
    if (!parsed.oldPath && parsed.hunks.length > 0) {
      try {
        const args = buildDiffArgs(comparisonType, baseRef, targetRef);
        const nameStatusRaw = await git.raw('diff', '--name-status', '-M', ...args);
        const renameMatch = nameStatusRaw
          .split('\n')
          .find((line: string) => line.startsWith('R') && line.endsWith(`\t${relativePath}`));

        if (renameMatch) {
          // Format: R100\toldPath\tnewPath
          const parts = renameMatch.split('\t');
          if (parts.length >= 2) {
            parsed.oldPath = parts[1];
          }
        }
      } catch {
        // Ignore — rename detection is best-effort
      }
    }

    // If no diff output and file exists on disk, try untracked
    if (
      parsed.hunks.length === 0 &&
      fileExistsOnDisk &&
      shouldReadUntrackedFromDisk(comparisonType)
    ) {
      // Check if the file is tracked in git
      let isTracked: boolean;
      try {
        await git.raw('ls-files', '--error-unmatch', relativePath);
        isTracked = true;
      } catch {
        isTracked = false;
      }

      if (!isTracked) {
        // Check binary
        if (isBinaryContent(fullPath)) {
          return {
            path: relativePath,
            hunks: [],
            isBinary: true,
            isTruncated: false,
            readAt: now,
          };
        }

        const synthDiff = synthesizeUntrackedDiff(fullPath);
        parsed = parseUnifiedDiff(synthDiff, relativePath);
      }
    }

    // Apply size cap
    const { hunks, isTruncated, truncationReason } = applySizeCap(parsed.hunks);

    return {
      path: parsed.path,
      oldPath: parsed.oldPath,
      hunks,
      isBinary: parsed.isBinary,
      isTruncated,
      truncationReason,
      readAt: now,
    };
  }
}
