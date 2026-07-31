import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * A disposable Git repository fixture for E2E tests.
 *
 * - `rootDir`  – the unique temp root directory (not a Git repo itself).
 * - `repoPath` – `<rootDir>/repo`, an initialized bare-minimum Git workspace.
 * - `runGit`   – executes `git` with the given argument array, scoped to
 *   `repoPath`.  Never uses shell interpolation.  Throws on non-zero exit.
 * - `cleanup`  – removes `rootDir` recursively.  Idempotent.
 */
export interface GitFixture {
  readonly rootDir: string;
  readonly repoPath: string;
  runGit(args: readonly string[]): void;
  cleanup(): void;
}

/**
 * Create a disposable Git repository fixture.
 *
 * @param prefix – optional temp directory prefix (default
 *   `'diffscribe-e2e-git-'`).  When the prefix contains spaces the resulting
 *   rootDir also contains spaces, verifying that paths with special characters
 *   work.
 *
 * Initialises a Git repository at `<rootDir>/repo` with a known test user
 * identity.  Does **not** create an initial commit — callers may set up
 * whichever file/commit state their scenario needs.
 */
export function createGitFixture(prefix: string = 'diffscribe-e2e-git-'): GitFixture {
  const rootDir = mkdtempSync(join(tmpdir(), prefix));
  const repoPath = join(rootDir, 'repo');

  mkdirSync(repoPath, { recursive: true });

  // Initialise the bare Git repo — no automatic commit.
  execFileSync('git', ['init'], { cwd: repoPath, stdio: 'pipe' });

  // Configure a deterministic test user identity so commits are
  // reproducible across environments.
  execFileSync('git', ['config', 'user.email', 'test@test.com'], {
    cwd: repoPath,
    stdio: 'pipe',
  });
  execFileSync('git', ['config', 'user.name', 'Test User'], {
    cwd: repoPath,
    stdio: 'pipe',
  });

  return {
    rootDir,
    repoPath,
    runGit(args: readonly string[]): void {
      execFileSync('git', args, { cwd: repoPath, stdio: 'pipe' });
    },
    cleanup(): void {
      rmSync(rootDir, { recursive: true, force: true });
    },
  };
}
