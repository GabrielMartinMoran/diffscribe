import { existsSync } from 'node:fs';

import { simpleGit } from 'simple-git';

import type {
  BranchDto,
  CommitDto,
  GitContextResult,
  StatusDto,
} from '$lib/server/application/dto/results/git-context-results';
import type { GitContextReader } from '$lib/server/application/git-context-reader';

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
    const branchSummary = await git.branchLocal();
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

    // Map branches — in detached/unborn HEAD, no branch is current
    const isDetached = status.detached || headState === 'detached' || headState === 'unborn';
    const branches: BranchDto[] = branchSummary.all.map((name) => ({
      name,
      isCurrent: !isDetached && name === branchSummary.current,
    }));

    // Remote branches: read the locally cached `refs/remotes/*` only. No
    // `git fetch` is ever executed; remote refs are whatever the local clone
    // already has on disk.
    try {
      const remoteRefs = await git.raw([
        'for-each-ref',
        '--format=%(refname:short)',
        'refs/remotes',
      ]);
      for (const ref of remoteRefs.split('\n')) {
        const name = ref.trim();
        if (name.length === 0) continue;
        // Skip the remote HEAD pseudo-ref (e.g. "origin/HEAD").
        if (name.endsWith('/HEAD')) continue;
        const remoteName = name.includes('/') ? name.split('/')[0] : undefined;
        branches.push({
          name,
          isCurrent: false,
          isRemote: true,
          ...(remoteName !== undefined ? { remoteName } : {}),
        });
      }
    } catch {
      // No remotes configured or refs unreadable — remote list stays empty.
    }

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
