import { existsSync } from 'node:fs';
import path from 'node:path';

import { simpleGit } from 'simple-git';

import type {
  CompleteDiffFile,
  CompleteDiffResult,
} from '$lib/server/application/dto/results/complete-diff-results';
import type {
  GitCompleteDiffReader,
  GitCompleteDiffReaderReadParams,
} from '$lib/server/application/git-complete-diff-reader';
import { FileChangeStatus } from '$lib/server/domain/value-objects/file-change-status';

import {
  applySizeCap,
  buildDiffArgs,
  isBinaryContent,
  shouldReadUntrackedFromDisk,
  synthesizeUntrackedDiff,
} from './simple-git-file-diff-reader';
import { parseUnifiedDiff, splitUnifiedDiffByFile } from './unified-diff-parser';

const DEFAULT_FILE_LIMIT = 500;
const HARD_FILE_LIMIT = 1000;
const TOTAL_SIZE_BYTES = 4096 * 1024; // 4096 KB
const TOTAL_DIFF_LINES = 40_000;

interface NameStatusEntry {
  path: string;
  oldPath?: string;
  status: FileChangeStatus;
}

/**
 * Parse `git diff --name-status -z` output into per-file entries.
 * Format per entry: `<status>[\t<similarity>]?\0<old-path>\0<new-path>\0`.
 */
function parseNameStatus(raw: string): NameStatusEntry[] {
  const entries: NameStatusEntry[] = [];
  if (!raw) return entries;

  const parts = raw.split('\0');
  let index = 0;
  while (index < parts.length) {
    const token = parts[index];
    if (!token) {
      index++;
      continue;
    }
    const statusLetter = token.charAt(0);
    const similarity = token.slice(1);
    const isRenameOrCopy = similarity !== '';

    if (isRenameOrCopy) {
      const oldPath = parts[index + 1];
      const newPath = parts[index + 2];
      if (oldPath !== undefined && newPath !== undefined) {
        entries.push({
          path: newPath,
          oldPath,
          status: statusLetter === 'R' ? FileChangeStatus.RENAMED : FileChangeStatus.COPIED,
        });
        index += 3;
        continue;
      }
    }

    const filePath = parts[index + 1];
    if (filePath !== undefined) {
      entries.push({ path: filePath, status: mapStatusLetter(statusLetter) });
      index += 2;
      continue;
    }
    index++;
  }
  return entries;
}

function mapStatusLetter(letter: string): FileChangeStatus {
  switch (letter) {
    case 'M':
      return FileChangeStatus.MODIFIED;
    case 'A':
      return FileChangeStatus.ADDED;
    case 'D':
      return FileChangeStatus.DELETED;
    case 'T':
      return FileChangeStatus.TYPE_CHANGED;
    case 'U':
      return FileChangeStatus.UNMERGED;
    case 'X':
      return FileChangeStatus.UNKNOWN;
    default:
      return FileChangeStatus.UNKNOWN;
  }
}

export class SimpleGitCompleteDiffReader implements GitCompleteDiffReader {
  async read(params: GitCompleteDiffReaderReadParams): Promise<CompleteDiffResult> {
    const readAt = new Date().toISOString();
    const { repositoryPath, comparisonType, baseRef, targetRef } = params;
    const fileLimit = Math.min(params.fileLimit ?? DEFAULT_FILE_LIMIT, HARD_FILE_LIMIT);

    if (!existsSync(repositoryPath)) {
      return {
        comparisonType,
        files: [],
        isTruncated: false,
        partialErrors: [],
        readAt,
        error: { message: 'Repository path does not exist', errorCode: 'PATH_NOT_FOUND' },
      };
    }

    const git = simpleGit({ baseDir: repositoryPath });

    try {
      const isRepo = await git.checkIsRepo();
      if (!isRepo) {
        return {
          comparisonType,
          files: [],
          isTruncated: false,
          partialErrors: [],
          readAt,
          error: { message: 'Not a Git repository', errorCode: 'NOT_A_GIT_REPOSITORY' },
        };
      }
    } catch {
      return {
        comparisonType,
        files: [],
        isTruncated: false,
        partialErrors: [],
        readAt,
        error: { message: 'Git error checking repository', errorCode: 'NOT_A_GIT_REPOSITORY' },
      };
    }

    // Single git diff invocation → snapshot consistency for the comparison.
    let rawDiff: string;
    try {
      const args = buildDiffArgs(comparisonType, baseRef, targetRef);
      rawDiff = await git.raw('diff', '--unified=3', '-M', '-C', '-C', ...args, '--');
    } catch {
      return {
        comparisonType,
        files: [],
        isTruncated: false,
        partialErrors: [],
        readAt,
        error: { message: 'Git diff command failed', errorCode: 'GIT_ERROR' },
      };
    }

    let nameStatus: NameStatusEntry[] = [];
    try {
      const args = buildDiffArgs(comparisonType, baseRef, targetRef);
      const raw = await git.raw('diff', '--name-status', '-z', '-M', '-C', '-C', ...args, '--');
      nameStatus = parseNameStatus(raw);
    } catch {
      // Best-effort: sections are still parsed from the unified diff.
    }

    const statusByPath = new Map<string, NameStatusEntry>();
    for (const entry of nameStatus) {
      statusByPath.set(entry.path, entry);
    }

    // Untracked files only for comparisons whose target is the working tree.
    if (shouldReadUntrackedFromDisk(comparisonType)) {
      try {
        const raw = await git.raw('ls-files', '--others', '--exclude-standard', '-z');
        for (const untrackedPath of raw.split('\0')) {
          if (!untrackedPath) continue;
          if (!statusByPath.has(untrackedPath)) {
            statusByPath.set(untrackedPath, {
              path: untrackedPath,
              status: FileChangeStatus.UNTRACKED,
            });
          }
        }
      } catch {
        // Best-effort untracked collection.
      }
    }

    // Split and parse per-file sections.
    const files: CompleteDiffFile[] = [];
    const partialErrors: CompleteDiffResult['partialErrors'] = [];
    const coveredPaths = new Set<string>();

    for (const section of splitUnifiedDiffByFile(rawDiff)) {
      const filePath = extractPathFromSection(section);
      if (!filePath) continue;
      coveredPaths.add(filePath);

      const parsed = parseUnifiedDiff(section, filePath);

      const meta = statusByPath.get(filePath);
      const status = meta?.status ?? FileChangeStatus.UNKNOWN;

      const { hunks, isTruncated, truncationReason } = applySizeCap(parsed.hunks);
      files.push({
        path: filePath,
        oldPath: parsed.oldPath ?? meta?.oldPath,
        status,
        binary: parsed.isBinary,
        isTruncated,
        truncationReason,
        hunks,
        readAt,
      });
    }

    // Untracked files produce no git diff section; synthesize them from disk
    // when the comparison includes the working tree.
    for (const [filePath, meta] of statusByPath) {
      if (coveredPaths.has(filePath) || meta.status !== FileChangeStatus.UNTRACKED) continue;
      const fullPath = path.join(repositoryPath, filePath);
      if (!existsSync(fullPath)) continue;

      if (isBinaryContent(fullPath)) {
        files.push({
          path: filePath,
          status: meta.status,
          binary: true,
          isTruncated: false,
          hunks: [],
          readAt,
        });
        continue;
      }

      const synthesized = parseUnifiedDiff(synthesizeUntrackedDiff(fullPath), filePath);
      files.push({
        path: filePath,
        status: meta.status,
        binary: false,
        isTruncated: false,
        hunks: synthesized.hunks,
        readAt,
      });
    }

    // Deterministic ordering: ascending by path.
    files.sort((a, b) => a.path.localeCompare(b.path));

    // Aggregate caps: file limit, total size, total diff lines.
    let isTruncated = false;
    let truncationReason: string | undefined;

    if (files.length > fileLimit) {
      files.splice(fileLimit);
      isTruncated = true;
      truncationReason = `File limit exceeded (${fileLimit})`;
    } else {
      let totalBytes = 0;
      let totalLines = 0;
      for (const file of files) {
        for (const hunk of file.hunks) {
          totalLines += hunk.lines.length;
          for (const line of hunk.lines) {
            totalBytes += Buffer.byteLength(line.content, 'utf-8');
          }
        }
      }
      if (totalBytes > TOTAL_SIZE_BYTES) {
        isTruncated = true;
        truncationReason = 'Total diff content exceeds 4096 KB';
      } else if (totalLines > TOTAL_DIFF_LINES) {
        isTruncated = true;
        truncationReason = 'Total diff lines exceed 40000';
      }
    }

    return {
      comparisonType,
      files,
      isTruncated,
      truncationReason,
      partialErrors,
      readAt,
    };
  }
}

/** Path extraction from a `diff --git a/x b/y` header. */
function extractPathFromSection(section: string): string | null {
  const header = section.split('\n').find((line) => line.startsWith('diff --git '));
  if (!header) return null;
  // The last path after `diff --git ` is the new path (rename target).
  const paths = header.slice('diff --git '.length).split(' ');
  const newPath = paths[paths.length - 1];
  return newPath && newPath.startsWith('b/') ? newPath.slice(2) : null;
}
