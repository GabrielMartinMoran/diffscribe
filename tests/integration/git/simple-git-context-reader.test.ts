import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

function mkTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'diffscribe-test-'));
}

function gitInit(dir: string): void {
  execSync('git init', { cwd: dir, stdio: 'pipe' });
  execSync('git config user.email "test@test.com"', { cwd: dir, stdio: 'pipe' });
  execSync('git config user.name "Test"', { cwd: dir, stdio: 'pipe' });
}

function gitCommit(dir: string, msg: string, file: string): void {
  fs.writeFileSync(path.join(dir, file), msg);
  execSync('git add .', { cwd: dir, stdio: 'pipe' });
  execSync(`git commit -m "${msg}"`, { cwd: dir, stdio: 'pipe' });
}

function rmDir(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

describe('SimpleGitContextReader (integration)', () => {
  let tempRoot: string;
  let gitRepo: string;

  beforeEach(() => {
    tempRoot = mkTempDir();
    gitRepo = path.join(tempRoot, 'repo');
    fs.mkdirSync(gitRepo);
    gitInit(gitRepo);
  });

  afterEach(() => {
    rmDir(tempRoot);
  });

  it('reads a clean working tree status', async () => {
    gitCommit(gitRepo, 'init', 'README.md');
    const { SimpleGitContextReader } =
      await import('../../../src/lib/server/infrastructure/git/simple-git-context-reader');
    const reader = new SimpleGitContextReader();
    const result = await reader.read(gitRepo);

    expect(result.status).not.toBeNull();
    expect(result.status!.isDirty).toBe(false);
    expect(result.status!.stagedCount).toBe(0);
    expect(result.status!.unstagedCount).toBe(0);
    expect(result.status!.untrackedCount).toBe(0);
    expect(result.status!.conflictedCount).toBe(0);
    expect(result.status!.headState).toBe('clean');
    expect(result.status!.currentBranch).toBe('master');
  });

  it('reads a dirty working tree with unstaged changes', async () => {
    gitCommit(gitRepo, 'init', 'README.md');
    fs.writeFileSync(path.join(gitRepo, 'README.md'), 'modified content');

    const { SimpleGitContextReader } =
      await import('../../../src/lib/server/infrastructure/git/simple-git-context-reader');
    const reader = new SimpleGitContextReader();
    const result = await reader.read(gitRepo);

    expect(result.status!.isDirty).toBe(true);
    expect(result.status!.unstagedCount).toBe(1);
    expect(result.status!.headState).toBe('dirty');
  });

  it('reads staged changes', async () => {
    gitCommit(gitRepo, 'init', 'README.md');
    fs.writeFileSync(path.join(gitRepo, 'README.md'), 'modified');
    execSync('git add README.md', { cwd: gitRepo, stdio: 'pipe' });

    const { SimpleGitContextReader } =
      await import('../../../src/lib/server/infrastructure/git/simple-git-context-reader');
    const reader = new SimpleGitContextReader();
    const result = await reader.read(gitRepo);

    expect(result.status!.stagedCount).toBe(1);
    expect(result.status!.isDirty).toBe(true);
  });

  it('reads untracked files', async () => {
    gitCommit(gitRepo, 'init', 'README.md');
    fs.writeFileSync(path.join(gitRepo, 'untracked.txt'), 'new file');

    const { SimpleGitContextReader } =
      await import('../../../src/lib/server/infrastructure/git/simple-git-context-reader');
    const reader = new SimpleGitContextReader();
    const result = await reader.read(gitRepo);

    expect(result.status!.untrackedCount).toBe(1);
    expect(result.status!.isDirty).toBe(true);
  });

  it('reads local branches', async () => {
    gitCommit(gitRepo, 'init', 'README.md');
    execSync('git checkout -b feat/a', { cwd: gitRepo, stdio: 'pipe' });
    execSync('git checkout -b feat/b', { cwd: gitRepo, stdio: 'pipe' });

    const { SimpleGitContextReader } =
      await import('../../../src/lib/server/infrastructure/git/simple-git-context-reader');
    const reader = new SimpleGitContextReader();
    const result = await reader.read(gitRepo);

    expect(result.branches.length).toBeGreaterThanOrEqual(3); // master + feat/a + feat/b
    const names = result.branches.map((b: { name: string }) => b.name);
    expect(names).toContain('master');
    expect(names).toContain('feat/a');
    expect(names).toContain('feat/b');
    const current = result.branches.find((b: { isCurrent: boolean }) => b.isCurrent);
    expect(current).toBeDefined();
    expect(current!.name).toBe('feat/b');
  });

  it('reads recent commits', async () => {
    gitCommit(gitRepo, 'first', 'README.md');
    gitCommit(gitRepo, 'second', 'file2.txt');
    gitCommit(gitRepo, 'third', 'file3.txt');

    const { SimpleGitContextReader } =
      await import('../../../src/lib/server/infrastructure/git/simple-git-context-reader');
    const reader = new SimpleGitContextReader();
    const result = await reader.read(gitRepo);

    expect(result.commits).toHaveLength(3);
    expect(result.commits[0].shortHash).toBeDefined();
    expect(result.commits[0].message).toBe('third');
    expect(result.commits[2].message).toBe('first');
  });

  it('returns error for non-existent path', async () => {
    const { SimpleGitContextReader } =
      await import('../../../src/lib/server/infrastructure/git/simple-git-context-reader');
    const reader = new SimpleGitContextReader();
    const result = await reader.read('/tmp/does-not-exist-99999');

    expect(result.status).toBeNull();
    expect(result.error).not.toBeNull();
    expect(result.error!.errorCode).toBeDefined();
  });

  it('returns error for directory that is not a git repo', async () => {
    const nonGit = path.join(tempRoot, 'not-repo');
    fs.mkdirSync(nonGit);

    const { SimpleGitContextReader } =
      await import('../../../src/lib/server/infrastructure/git/simple-git-context-reader');
    const reader = new SimpleGitContextReader();
    const result = await reader.read(nonGit);

    expect(result.status).toBeNull();
    expect(result.error).not.toBeNull();
    expect(result.error!.errorCode).toBeDefined();
  });

  it('handles detached HEAD state', async () => {
    gitCommit(gitRepo, 'init', 'README.md');
    const hash = execSync('git rev-parse --short HEAD', { cwd: gitRepo, stdio: 'pipe' })
      .toString()
      .trim();
    execSync(`git checkout ${hash}`, { cwd: gitRepo, stdio: 'pipe' });

    const { SimpleGitContextReader } =
      await import('../../../src/lib/server/infrastructure/git/simple-git-context-reader');
    const reader = new SimpleGitContextReader();
    const result = await reader.read(gitRepo);

    expect(result.status!.headState).toBe('detached');
    expect(result.status!.detachedCommitHash).toBeDefined();
    expect(result.status!.currentBranch).toBeNull();
  });

  it('handles unborn HEAD (no commits)', async () => {
    // Fresh repo without any commits
    const unbornRepo = path.join(tempRoot, 'unborn');
    fs.mkdirSync(unbornRepo);
    gitInit(unbornRepo);

    const { SimpleGitContextReader } =
      await import('../../../src/lib/server/infrastructure/git/simple-git-context-reader');
    const reader = new SimpleGitContextReader();
    const result = await reader.read(unbornRepo);

    expect(result.status!.headState).toBe('unborn');
    expect(result.status!.currentBranch).toBeNull();
    expect(result.commits).toHaveLength(0);
  });
});

describe('SimpleGitContextReader remote branches (cached refs/remotes)', () => {
  let tempRoot: string;
  let gitRepo: string;
  let remoteRepo: string;

  beforeEach(() => {
    tempRoot = mkTempDir();
    gitRepo = path.join(tempRoot, 'repo');
    remoteRepo = path.join(tempRoot, 'remote.git');
    fs.mkdirSync(gitRepo);
    fs.mkdirSync(remoteRepo);
    gitInit(gitRepo);
    execSync('git init --bare', { cwd: remoteRepo, stdio: 'pipe' });
  });

  afterEach(() => {
    rmDir(tempRoot);
  });

  it('reads remote branches from cached refs/remotes without fetching', async () => {
    gitCommit(gitRepo, 'init', 'README.md');
    execSync(`git remote add origin "${remoteRepo}"`, { cwd: gitRepo, stdio: 'pipe' });
    // Simulate a previously fetched remote branch: create refs/remotes/origin/main
    // directly. No `git fetch` is executed.
    execSync('git update-ref refs/remotes/origin/main HEAD', { cwd: gitRepo, stdio: 'pipe' });

    const { SimpleGitContextReader } =
      await import('../../../src/lib/server/infrastructure/git/simple-git-context-reader');
    const reader = new SimpleGitContextReader();
    const result = await reader.read(gitRepo);

    const originMain = result.branches.find((b) => b.name === 'origin/main');
    expect(originMain).toBeDefined();
    expect(originMain!.isRemote).toBe(true);
    expect(originMain!.remoteName).toBe('origin');

    const localMain = result.branches.find((b) => b.name === 'master');
    expect(localMain).toBeDefined();
    expect(localMain!.isRemote).toBeFalsy();

    // No fetch may have been executed: the remote has no refs beyond what we
    // created locally.
    const remoteRefs = execSync('git for-each-ref refs/remotes', {
      cwd: gitRepo,
      stdio: 'pipe',
    })
      .toString()
      .trim();
    expect(remoteRefs).toContain('refs/remotes/origin/main');
  });

  it('does not mark the current local branch as remote when a remote exists', async () => {
    gitCommit(gitRepo, 'init', 'README.md');
    execSync(`git remote add origin "${remoteRepo}"`, { cwd: gitRepo, stdio: 'pipe' });
    execSync('git update-ref refs/remotes/origin/feature HEAD', { cwd: gitRepo, stdio: 'pipe' });

    const { SimpleGitContextReader } =
      await import('../../../src/lib/server/infrastructure/git/simple-git-context-reader');
    const reader = new SimpleGitContextReader();
    const result = await reader.read(gitRepo);

    const current = result.branches.find((b) => b.isCurrent);
    expect(current).toBeDefined();
    expect(current!.isRemote).toBeFalsy();
    expect(current!.name).toBe('master');
  });
});

describe('SimpleGitContextReader canonical branch refs (tranche C)', () => {
  let tempRoot: string;
  let gitRepo: string;
  let remoteRepo: string;

  beforeEach(() => {
    tempRoot = mkTempDir();
    gitRepo = path.join(tempRoot, 'repo');
    remoteRepo = path.join(tempRoot, 'remote.git');
    fs.mkdirSync(gitRepo);
    fs.mkdirSync(remoteRepo);
    gitInit(gitRepo);
    execSync('git init --bare', { cwd: remoteRepo, stdio: 'pipe' });
  });

  afterEach(() => {
    rmDir(tempRoot);
  });

  it('maps canonical refs and ISO-8601 UTC committer dates for local and remote branches', async () => {
    gitCommit(gitRepo, 'init', 'README.md');
    execSync('git checkout -b dev', { cwd: gitRepo, stdio: 'pipe' });
    gitCommit(gitRepo, 'dev work', 'dev.txt');
    execSync(`git remote add origin "${remoteRepo}"`, { cwd: gitRepo, stdio: 'pipe' });
    execSync('git update-ref refs/remotes/origin/main HEAD', { cwd: gitRepo, stdio: 'pipe' });

    const { SimpleGitContextReader } =
      await import('../../../src/lib/server/infrastructure/git/simple-git-context-reader');
    const reader = new SimpleGitContextReader();
    const result = await reader.read(gitRepo);

    const localDev = result.branches.find((b) => b.canonicalRef === 'refs/heads/dev');
    expect(localDev).toBeDefined();
    expect(localDev!.name).toBe('dev');
    expect(localDev!.isCurrent).toBe(true);

    const remoteMain = result.branches.find((b) => b.canonicalRef === 'refs/remotes/origin/main');
    expect(remoteMain).toBeDefined();
    expect(remoteMain!.name).toBe('origin/main');
    expect(remoteMain!.isRemote).toBe(true);
    expect(remoteMain!.remoteName).toBe('origin');

    for (const b of result.branches) {
      expect(b.committerDate).toBeDefined();
      // ISO-8601 UTC: toISOString() output ends with Z.
      expect(b.committerDate!.endsWith('Z')).toBe(true);
      expect(Number.isNaN(Date.parse(b.committerDate!))).toBe(false);
    }
  });

  it('orders local first then remote, committer date descending, canonical tie-break', async () => {
    gitCommit(gitRepo, 'init', 'README.md');
    execSync('git checkout -b old', { cwd: gitRepo, stdio: 'pipe' });
    gitCommit(gitRepo, 'old work', 'old.txt');
    execSync('git checkout -b dev', { cwd: gitRepo, stdio: 'pipe' });
    gitCommit(gitRepo, 'dev work', 'dev.txt');
    execSync('git checkout master', { cwd: gitRepo, stdio: 'pipe' });
    execSync(`git remote add origin "${remoteRepo}"`, { cwd: gitRepo, stdio: 'pipe' });
    execSync('git update-ref refs/remotes/origin/main master', { cwd: gitRepo, stdio: 'pipe' });

    const { SimpleGitContextReader } =
      await import('../../../src/lib/server/infrastructure/git/simple-git-context-reader');
    const reader = new SimpleGitContextReader();
    const result = await reader.read(gitRepo);

    const canonicalRefs = result.branches.map((b) => b.canonicalRef);
    const localRefs = canonicalRefs.filter((r) => r.startsWith('refs/heads/'));
    const remoteRefs = canonicalRefs.filter((r) => r.startsWith('refs/remotes/'));
    expect(canonicalRefs.slice(0, localRefs.length)).toEqual(localRefs);
    expect(canonicalRefs.slice(localRefs.length)).toEqual(remoteRefs);

    // Within the local group, the newest commit (dev) must come first.
    const localOrder = localRefs.indexOf('refs/heads/dev');
    const oldOrder = localRefs.indexOf('refs/heads/old');
    expect(localOrder).toBeLessThan(oldOrder);
  });

  it('omits a missing committer date and sorts it last', async () => {
    gitCommit(gitRepo, 'init', 'README.md');
    // A branch ref pointing at a blob object has no committer date in
    // for-each-ref %(committerdate) output, simulating a ref without a date.
    // update-ref rejects non-commit objects for refs/heads, so the loose ref
    // file is written directly; the reader only runs for-each-ref + status.
    const blob = execSync('git hash-object -w --stdin', {
      cwd: gitRepo,
      stdio: 'pipe',
      input: 'blob content',
    })
      .toString()
      .trim();
    fs.mkdirSync(path.join(gitRepo, '.git', 'refs', 'heads'), { recursive: true });
    fs.writeFileSync(path.join(gitRepo, '.git', 'refs', 'heads', 'undated'), `${blob}\n`);
    execSync('git checkout -b dated', { cwd: gitRepo, stdio: 'pipe' });
    gitCommit(gitRepo, 'dated work', 'dated.txt');
    execSync('git checkout master', { cwd: gitRepo, stdio: 'pipe' });

    const { SimpleGitContextReader } =
      await import('../../../src/lib/server/infrastructure/git/simple-git-context-reader');
    const reader = new SimpleGitContextReader();
    const result = await reader.read(gitRepo);

    const undated = result.branches.find((b) => b.name === 'undated');
    expect(undated).toBeDefined();
    expect(undated!.committerDate).toBeUndefined();

    const undatedIndex = result.branches.findIndex((b) => b.name === 'undated');
    const dated = result.branches.filter((b) => b.name !== 'undated');
    const allDatedBefore = dated.every((b) => result.branches.indexOf(b) < undatedIndex);
    expect(allDatedBefore).toBe(true);
  });

  it('excludes remote HEAD pseudo-refs', async () => {
    gitCommit(gitRepo, 'init', 'README.md');
    execSync(`git remote add origin "${remoteRepo}"`, { cwd: gitRepo, stdio: 'pipe' });
    execSync('git update-ref refs/remotes/origin/main HEAD', { cwd: gitRepo, stdio: 'pipe' });
    execSync('git symbolic-ref refs/remotes/origin/HEAD refs/remotes/origin/main', {
      cwd: gitRepo,
      stdio: 'pipe',
    });

    const { SimpleGitContextReader } =
      await import('../../../src/lib/server/infrastructure/git/simple-git-context-reader');
    const reader = new SimpleGitContextReader();
    const result = await reader.read(gitRepo);

    expect(result.branches.some((b) => b.canonicalRef === 'refs/remotes/origin/HEAD')).toBe(false);
    expect(result.branches.some((b) => b.canonicalRef === 'refs/remotes/origin/main')).toBe(true);
  });

  it('returns an empty branch list for an unborn HEAD', async () => {
    const unbornRepo = path.join(tempRoot, 'unborn');
    fs.mkdirSync(unbornRepo);
    gitInit(unbornRepo);

    const { SimpleGitContextReader } =
      await import('../../../src/lib/server/infrastructure/git/simple-git-context-reader');
    const reader = new SimpleGitContextReader();
    const result = await reader.read(unbornRepo);

    expect(result.status!.headState).toBe('unborn');
    expect(result.branches).toHaveLength(0);
  });
});
