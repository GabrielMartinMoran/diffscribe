import { existsSync, readFileSync } from 'node:fs';

import { simpleGit } from 'simple-git';

import type {
  FileListEntry,
  FileListResult,
} from '$lib/server/application/dto/results/file-list-results';
import type {
  GitFileListReader,
  GitFileListReaderReadParams,
} from '$lib/server/application/git-file-list-reader';
import { ComparisonType } from '$lib/server/domain/value-objects/comparison';
import { FileChangeStatus } from '$lib/server/domain/value-objects/file-change-status';

const STATUS_MAP: Record<string, FileChangeStatus> = {
  A: FileChangeStatus.ADDED,
  M: FileChangeStatus.MODIFIED,
  D: FileChangeStatus.DELETED,
  R: FileChangeStatus.RENAMED,
  C: FileChangeStatus.COPIED,
  T: FileChangeStatus.TYPE_CHANGED,
  U: FileChangeStatus.UNMERGED,
};

const WORKING_TREE_TARGETS: Set<ComparisonType> = new Set([
  ComparisonType.WORKING_TREE_VS_HEAD,
  ComparisonType.COMMIT_VS_WORKING_TREE,
  ComparisonType.BRANCH_VS_WORKING_TREE,
]);

function shouldIncludeUntracked(comparisonType: ComparisonType): boolean {
  return WORKING_TREE_TARGETS.has(comparisonType);
}

export class SimpleGitFileListReader implements GitFileListReader {
  async read(params: GitFileListReaderReadParams): Promise<FileListResult> {
    const now = new Date().toISOString();
    const { repositoryPath, comparisonType, baseRef, targetRef } = params;

    if (!existsSync(repositoryPath)) {
      return {
        entries: [],
        readAt: now,
        error: { message: 'Repository path does not exist', errorCode: 'PATH_NOT_FOUND' },
      };
    }

    const git = simpleGit({ baseDir: repositoryPath });

    try {
      const isRepo = await git.checkIsRepo();
      if (!isRepo) {
        return {
          entries: [],
          readAt: now,
          error: { message: 'Not a Git repository', errorCode: 'NOT_A_GIT_REPOSITORY' },
        };
      }
    } catch {
      return {
        entries: [],
        readAt: now,
        error: { message: 'Git error checking repository', errorCode: 'NOT_A_GIT_REPOSITORY' },
      };
    }

    return this.readFromRepo(repositoryPath, comparisonType, baseRef, targetRef, now);
  }

  private async readFromRepo(
    repositoryPath: string,
    comparisonType: ComparisonType,
    baseRef: string,
    targetRef: string,
    readAt: string,
  ): Promise<FileListResult> {
    const git = simpleGit({ baseDir: repositoryPath });

    try {
      const nameStatusRaw = await this.runNameStatus(git, comparisonType, baseRef, targetRef);
      const numstatRaw = await this.runNumstat(git, comparisonType, baseRef, targetRef);

      const nameStatusEntries = this.parseNameStatus(nameStatusRaw);
      const numstatByPath = this.parseNumstat(numstatRaw);

      const entries: FileListEntry[] = [];

      for (const [filePath, { status, oldPath }] of nameStatusEntries) {
        const stat = numstatByPath.get(filePath);
        const isBin = stat ? stat.isBinary : false;

        entries.push({
          path: filePath,
          status,
          binary: isBin,
          additions: stat?.additions,
          deletions: stat?.deletions,
          ...(oldPath !== undefined ? { oldPath } : {}),
        });
      }

      // Include untracked files when applicable
      if (shouldIncludeUntracked(comparisonType)) {
        const untrackedRaw = await this.runUntracked(git);
        const untrackedPaths = this.parseUntracked(untrackedRaw);

        for (const untrackedPath of untrackedPaths) {
          const fullPath = `${repositoryPath}/${untrackedPath}`;
          let binary = false;
          let error: string | undefined;

          try {
            binary = this.isBinaryContent(fullPath);
          } catch (e: unknown) {
            error = e instanceof Error ? e.message : 'Cannot read file';
          }

          entries.push({
            path: untrackedPath,
            status: FileChangeStatus.UNTRACKED,
            binary,
            ...(error ? { error } : {}),
          });
        }
      }

      return { entries, readAt };
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unknown Git error';
      return {
        entries: [],
        readAt,
        error: { message, errorCode: 'GIT_ERROR' },
      };
    }
  }

  private async runNameStatus(
    git: ReturnType<typeof simpleGit>,
    comparisonType: ComparisonType,
    baseRef: string,
    targetRef: string,
  ): Promise<string> {
    const args = this.buildDiffArgs(comparisonType, baseRef, targetRef);
    return git.raw('diff', '--name-status', '-z', '-C', '-C', ...args);
  }

  private async runNumstat(
    git: ReturnType<typeof simpleGit>,
    comparisonType: ComparisonType,
    baseRef: string,
    targetRef: string,
  ): Promise<string> {
    const args = this.buildDiffArgs(comparisonType, baseRef, targetRef);
    return git.raw('diff', '--numstat', '-z', ...args);
  }

  private async runUntracked(git: ReturnType<typeof simpleGit>): Promise<string> {
    return git.raw('ls-files', '--others', '--exclude-standard', '-z');
  }

  private buildDiffArgs(
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
        // diff between index and working tree
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

  private parseNameStatus(
    raw: string,
  ): Map<string, { status: FileChangeStatus; oldPath?: string }> {
    const result = new Map<string, { status: FileChangeStatus; oldPath?: string }>();
    if (!raw) return result;

    const parts = raw.split('\0').filter(Boolean);

    // Format: <status><tab><path> for standard entries
    // Format: <status><tab><oldPath><tab><newPath> for renames/copies
    let i = 0;
    while (i < parts.length) {
      const header = parts[i];

      // The status code is the first character, possibly followed by a similarity score
      // e.g., "R100" for rename with 100% similarity
      const statusCode = header.charAt(0);
      const mappedStatus = STATUS_MAP[statusCode] ?? FileChangeStatus.UNKNOWN;

      if (statusCode === 'R' || statusCode === 'C') {
        // Rename/Copy: next two parts are oldPath and newPath
        const oldPath = parts[i + 1];
        const newPath = parts[i + 2];
        // Don't overwrite unmerged with rename/copy for same path
        const existingRenamed = result.get(newPath);
        if (!existingRenamed || existingRenamed.status !== FileChangeStatus.UNMERGED) {
          result.set(newPath, { status: mappedStatus, oldPath });
        }
        i += 3;
      } else {
        // Standard: next part is the path
        const filePath = parts[i + 1];
        // Don't overwrite unmerged with modified/other for same path
        const existing = result.get(filePath);
        if (!existing || existing.status !== FileChangeStatus.UNMERGED) {
          result.set(filePath, { status: mappedStatus });
        }
        i += 2;
      }
    }

    return result;
  }

  private parseNumstat(
    raw: string,
  ): Map<string, { additions: number; deletions: number; isBinary: boolean }> {
    const result = new Map<string, { additions: number; deletions: number; isBinary: boolean }>();
    if (!raw) return result;

    // NUL separates records; tabs separate fields within each record
    const records = raw.split('\0').filter(Boolean);

    for (const record of records) {
      const fields = record.split('\t');
      if (fields.length < 3) continue;

      const additionsStr = fields[0];
      const deletionsStr = fields[1];
      const filePath = fields[2];

      const isBinary = additionsStr === '-' && deletionsStr === '-';

      if (isBinary) {
        result.set(filePath, { additions: 0, deletions: 0, isBinary: true });
      } else {
        const additions = parseInt(additionsStr, 10);
        const deletions = parseInt(deletionsStr, 10);
        if (!isNaN(additions) && !isNaN(deletions)) {
          result.set(filePath, { additions, deletions, isBinary: false });
        }
      }
    }

    return result;
  }

  private parseUntracked(raw: string): string[] {
    if (!raw) return [];
    return raw.split('\0').filter(Boolean);
  }

  private isBinaryContent(filePath: string): boolean {
    try {
      const buf = readFileSync(filePath, { flag: 'r' });
      // Check first 8000 bytes for NUL character (standard git heuristic)
      const maxCheck = Math.min(buf.length, 8000);
      for (let i = 0; i < maxCheck; i++) {
        if (buf[i] === 0) return true;
      }
      return false;
    } catch {
      throw new Error(`Cannot read file: ${filePath}`);
    }
  }
}
