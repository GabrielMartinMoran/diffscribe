import { existsSync } from 'node:fs';

import { simpleGit } from 'simple-git';

import type {
  BranchDto,
  CommitDto,
  GitContextResult,
  StatusDto,
} from '$lib/server/application/dto/results/git-context-results';
import type { GitContextReader } from '$lib/server/application/git-context-reader';

import { sortBranches } from './branch-sort';

/**
 * Normalizes a Git `%(committerdate:iso8601)` value (e.g.
 * "2026-08-02 10:00:00 +0000") to ISO-8601 UTC. Returns `{}` when the value
 * is empty or unparsable so the property is omitted from the DTO.
 */
function committerDateOf(raw: string): { committerDate: string } | Record<string, never> {
  if (raw.trim().length === 0) return {};
  const parsed = Date.parse(raw.trim());
  if (Number.isNaN(parsed)) return {};
  return { committerDate: new Date(parsed).toISOString() };
}

export class SimpleGitContextReader implements GitContextReader {
  async read(repositoryPath: string): Promise<GitContextResult> {
    const now = new Date().toISOString();

    if (!existsSync(repositoryPath)) {
      return {
        status: null,
        branches: [],
        commits: [],
        headState: 'error',
        error: {
          message: 'The workspace path does not exist',
          errorCode: 'PATH_NOT_FOUND',
        },
        readAt: now,
      };
    }

    const git = simpleGit({ baseDir: repositoryPath });

    try {
      const isRepo = await git.checkIsRepo();
      if (!isRepo) {
        return {
          status: null,
          branches: [],
          commits: [],
          headState: 'error',
          error: {
            message: 'The workspace is not a valid Git repository',
            errorCode: 'NOT_A_GIT_REPOSITORY',
          },
          readAt: now,
        };
      }
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : 'Unknown Git error';
      return {
        status: null,
        branches: [],
        commits: [],
        headState: 'error',
        error: {
          message: errMsg,
          errorCode: 'NOT_A_GIT_REPOSITORY',
        },
        readAt: now,
      };
    }

    try {
      return await this.readFromRepo(git, now);
    } catch {
      return {
        status: null,
        branches: [],
        commits: [],
        headState: 'error',
        error: {
          message: `The workspace is not a valid Git repository`,
          errorCode: 'READ_ERROR',
        },
        readAt: now,
      };
    }
  }

  private async readFromRepo(
    git: ReturnType<typeof simpleGit>,
    readAt: string,
  ): Promise<GitContextResult> {
    const status = await git.status();
    let commits: CommitDto[] = [];

    // Determine head state
    let headState: StatusDto['headState'];
    let currentBranch: string | null;
    let detachedCommitHash: string | undefined;

    if (status.detached) {
      headState = 'detached';
      currentBranch = null;
      // Get the short commit hash for detached HEAD
      try {
        detachedCommitHash = (await git.revparse(['--short', 'HEAD'])).trim();
      } catch {
        detachedCommitHash = undefined;
      }
    } else {
      // Detect unborn HEAD: repo with no commits. Even though a default branch
      // name may be set, git rev-parse HEAD will fail if there are no commits.
      let hasCommits = true;
      try {
        await git.revparse(['HEAD']);
      } catch {
        hasCommits = false;
      }

      if (!hasCommits) {
        headState = 'unborn';
        currentBranch = null;
      } else {
        currentBranch = status.current ?? null;
        headState = status.isClean() ? 'clean' : 'dirty';
      }
    }

    // Determine conflict state
    if (status.conflicted.length > 0) {
      headState = 'conflict';
    }

    const isDirty =
      status.modified.length > 0 ||
      status.created.length > 0 ||
      status.deleted.length > 0 ||
      status.renamed.length > 0 ||
      status.staged.length > 0 ||
      status.not_added.length > 0 ||
      status.conflicted.length > 0;

    const statusDto: StatusDto = {
      stagedCount: status.staged.length,
      unstagedCount: status.modified.length,
      untrackedCount: status.not_added.length,
      conflictedCount: status.conflicted.length,
      isDirty,
      currentBranch,
      headState,
      ...(detachedCommitHash !== undefined ? { detachedCommitHash } : {}),
    };

    // Branches: local heads and locally cached remote refs are read with ONE
    // combined read-only `git for-each-ref` invocation. `%(HEAD)` marks the
    // current branch ('*' when HEAD points at the ref); in detached/unborn
    // HEAD no ref is marked. `%(committerdate:iso8601)` is normalized to
    // ISO-8601 UTC; refs without a committer date omit the property. Remote
    // HEAD pseudo-refs (e.g. "origin/HEAD") are excluded. The ordering is
    // applied in pure TypeScript (see branch-sort.ts), never via Git --sort.
    // No fetch, pull, push, or ls-remote is ever executed.
    const branchRecords: BranchDto[] = [];
    try {
      const rawRefs = await git.raw([
        'for-each-ref',
        '--format=%(refname)%00%(HEAD)%00%(committerdate:iso8601)%00',
        'refs/heads',
        'refs/remotes',
      ]);
      for (const line of rawRefs.split('\n')) {
        if (line.trim().length === 0) continue;
        const [refname, headMarker = '', committerRaw = ''] = line.split('\0');
        if (refname.startsWith('refs/remotes/')) {
          const name = refname.slice('refs/remotes/'.length);
          // Skip the remote HEAD pseudo-ref (e.g. "origin/HEAD").
          if (name.endsWith('/HEAD')) continue;
          const remoteName = name.includes('/') ? name.split('/')[0] : undefined;
          branchRecords.push({
            name,
            canonicalRef: refname,
            isCurrent: headMarker === '*',
            isRemote: true,
            ...(remoteName !== undefined ? { remoteName } : {}),
            ...committerDateOf(committerRaw),
          });
        } else if (refname.startsWith('refs/heads/')) {
          const name = refname.slice('refs/heads/'.length);
          branchRecords.push({
            name,
            canonicalRef: refname,
            isCurrent: headMarker === '*',
            ...committerDateOf(committerRaw),
          });
        }
      }
    } catch {
      // Refs unreadable — branch list stays empty.
    }
    const branches = sortBranches(branchRecords);

    // Map commits (only if we have a HEAD to log from)
    if (headState !== 'unborn') {
      try {
        const log = await git.log({ maxCount: 20 });
        commits = log.all.map((entry) => ({
          shortHash: entry.hash.substring(0, 7),
          fullHash: entry.hash,
          message: entry.message,
          authorName: entry.author_name,
          date: entry.date,
        }));
      } catch {
        commits = [];
      }
    }

    return {
      status: statusDto,
      branches,
      commits,
      headState,
      error: null,
      readAt,
    };
  }
}
