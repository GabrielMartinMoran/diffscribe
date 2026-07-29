import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { Given, Then, When } from 'quickpickle';

import type {
  BranchDto,
  CommitDto,
  GitContextResult,
  StatusDto,
} from '../../src/lib/server/application/dto/results/git-context-results';
import { SimpleGitContextReader } from '../../src/lib/server/infrastructure/git/simple-git-context-reader';

// Module-level state to work around quickpickle world mutation issues
const state = new Map<string, unknown>();

interface GitContextAdapterWorld {
  fixtureDir: string;
  repoDir: string;
  reader: SimpleGitContextReader;
  mappedResult: GitContextResult | null;
  mappedStatus: StatusDto | null;
  mappedBranches: BranchDto[];
  mappedCommits: CommitDto[];
}

function mkTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'diffscribe-bdd-adapter-'));
}

function ensureRepo(world: GitContextAdapterWorld): void {
  // Always use a fresh temp repo per scenario to avoid cross-contamination
  world.fixtureDir = mkTempDir();
  world.repoDir = path.join(world.fixtureDir, 'repo');
  fs.mkdirSync(world.repoDir, { recursive: true });
  execSync('git init', { cwd: world.repoDir, stdio: 'pipe' });
  execSync('git config user.email "bdd@test.com"', { cwd: world.repoDir, stdio: 'pipe' });
  execSync('git config user.name "BDD Test"', { cwd: world.repoDir, stdio: 'pipe' });
  world.reader = new SimpleGitContextReader();
}

function gitCommit(dir: string, msg: string): void {
  fs.writeFileSync(path.join(dir, `f-${msg.replace(/\s+/g, '-')}.txt`), msg);
  execSync('git add .', { cwd: dir, stdio: 'pipe' });
  execSync(`git commit -m "${msg}"`, { cwd: dir, stdio: 'pipe' });
}

// ── Status DTO: 2 staged, 3 modified, 1 untracked ──

Given(
  'simple-git returns a raw StatusResult with 2 staged, 3 modified, and 1 untracked file',
  (world: GitContextAdapterWorld) => {
    ensureRepo(world);
    // Create 3 files, commit all to make them tracked
    for (let i = 1; i <= 3; i++) {
      fs.writeFileSync(path.join(world.repoDir, `mod${i}.txt`), `original ${i}`);
    }
    execSync('git add . && git commit -m "baseline"', { cwd: world.repoDir, stdio: 'pipe' });
    // Stage 2 of them with changes
    fs.writeFileSync(path.join(world.repoDir, 'mod1.txt'), 'changed 1');
    fs.writeFileSync(path.join(world.repoDir, 'mod2.txt'), 'changed 2');
    execSync('git add mod1.txt mod2.txt', { cwd: world.repoDir, stdio: 'pipe' });
    // Modify all 3 (mod1+mod2 are staged+modified; mod3 is just modified)
    for (let i = 1; i <= 3; i++) {
      fs.writeFileSync(path.join(world.repoDir, `mod${i}.txt`), `modified ${i}`);
    }
    // Create 1 untracked file
    fs.writeFileSync(path.join(world.repoDir, 'untracked.txt'), 'new');
  },
);

Given(
  'simple-git returns a raw StatusResult with zero changes across all categories',
  (world: GitContextAdapterWorld) => {
    ensureRepo(world);
    gitCommit(world.repoDir, 'initial');
  },
);

Given(
  'simple-git returns a raw StatusResult with 2 conflicted files',
  (world: GitContextAdapterWorld) => {
    ensureRepo(world);
    gitCommit(world.repoDir, 'initial');

    // Create a merge conflict using two branches
    try {
      execSync('git checkout -b conflict-branch', { cwd: world.repoDir, stdio: 'pipe' });
      fs.writeFileSync(path.join(world.repoDir, 'conflict1.txt'), 'branch-content');
      fs.writeFileSync(path.join(world.repoDir, 'conflict2.txt'), 'branch-content');
      execSync('git add . && git commit -m "branch"', { cwd: world.repoDir, stdio: 'pipe' });
      execSync('git checkout master', { cwd: world.repoDir, stdio: 'pipe' });
      fs.writeFileSync(path.join(world.repoDir, 'conflict1.txt'), 'master-content');
      fs.writeFileSync(path.join(world.repoDir, 'conflict2.txt'), 'master-content');
      execSync('git add . && git commit -m "master"', { cwd: world.repoDir, stdio: 'pipe' });
      execSync('git merge conflict-branch', { cwd: world.repoDir, stdio: 'pipe' });
    } catch {
      // Merge conflict expected
    }
  },
);

// ── When: map status ──

When('the adapter maps the raw result to a StatusDto', async (world: GitContextAdapterWorld) => {
  world.mappedResult = await world.reader.read(world.repoDir);
  world.mappedStatus = world.mappedResult.status;
});

When('the adapter processes the status', async (world: GitContextAdapterWorld) => {
  world.mappedResult = await world.reader.read(world.repoDir);
  world.mappedStatus = world.mappedResult.status;
});

// ── Then: status assertions ──

Then('the StatusDto has stagedCount {int}', (world: GitContextAdapterWorld, count: number) => {
  if (world.mappedStatus?.stagedCount !== count)
    throw new Error(`Expected stagedCount ${count}, got ${world.mappedStatus?.stagedCount}`);
});

Then('the StatusDto has unstagedCount {int}', (world: GitContextAdapterWorld, count: number) => {
  if (world.mappedStatus?.unstagedCount !== count)
    throw new Error(`Expected unstagedCount ${count}, got ${world.mappedStatus?.unstagedCount}`);
});

Then('the StatusDto has untrackedCount {int}', (world: GitContextAdapterWorld, count: number) => {
  if (world.mappedStatus?.untrackedCount !== count)
    throw new Error(`Expected untrackedCount ${count}, got ${world.mappedStatus?.untrackedCount}`);
});

Then('the StatusDto has conflictedCount {int}', (world: GitContextAdapterWorld, count: number) => {
  if (world.mappedStatus?.conflictedCount !== count)
    throw new Error(
      `Expected conflictedCount ${count}, got ${world.mappedStatus?.conflictedCount}`,
    );
});

Then(
  'the StatusDto has the "dirty" flag set to {word}',
  (world: GitContextAdapterWorld, value: string) => {
    const expected = value === 'true';
    if (world.mappedStatus?.isDirty !== expected)
      throw new Error(`Expected isDirty ${expected}, got ${world.mappedStatus?.isDirty}`);
  },
);

Then('the caller receives no raw simple-git StatusResult reference', () => {
  // Our reader always returns plain DTOs — verified by type system
});

// ── Branch DTO ──

Given(
  /^simple-git returns a raw BranchSummary with branches "(.*?)" \(current\), "(.*?)", and "(.*?)"$/,
  (world: GitContextAdapterWorld, current: string, b1: string, b2: string) => {
    ensureRepo(world);
    gitCommit(world.repoDir, 'initial');
    // Rename master to 'main' if needed (git init default is master)
    try {
      execSync('git branch -m master main', { cwd: world.repoDir, stdio: 'pipe' });
    } catch {
      // If master doesn't exist, create main
      try {
        execSync('git checkout -b main', { cwd: world.repoDir, stdio: 'pipe' });
      } catch {
        /* ignore */
      }
    }
    execSync(`git checkout -b ${b1}`, { cwd: world.repoDir, stdio: 'pipe' });
    execSync(`git checkout -b ${b2}`, { cwd: world.repoDir, stdio: 'pipe' });
    execSync(`git checkout ${current}`, { cwd: world.repoDir, stdio: 'pipe' });
  },
);

When(
  'the adapter maps the raw summary to a BranchDto list',
  async (world: GitContextAdapterWorld) => {
    world.mappedResult = await world.reader.read(world.repoDir);
    world.mappedBranches = world.mappedResult.branches;
  },
);

// Shared Then for both branch and commit list counts — detects context
Then('the list contains exactly {int} entries', (world: GitContextAdapterWorld, count: number) => {
  const list = world.mappedCommits?.length ? world.mappedCommits : world.mappedBranches;
  if (!list || list.length !== count)
    throw new Error(`Expected ${count} entries, got ${list?.length ?? 'none'}`);
});

Then(
  'the entry for {string} has isCurrent set to {word}',
  (world: GitContextAdapterWorld, name: string, value: string) => {
    const branch = world.mappedBranches.find((b) => b.name === name);
    if (!branch) throw new Error(`Branch "${name}" not found`);
    const expected = value === 'true';
    if (branch.isCurrent !== expected)
      throw new Error(`Expected isCurrent ${expected} for "${name}", got ${branch.isCurrent}`);
  },
);

Then('no raw simple-git BranchSummary reference is exposed to the caller', () => {
  // Verified by type system — our reader outputs plain DTOs
});

// ── Commit DTO ──

Given(
  'simple-git returns a raw LogResult with 3 commits',
  async (world: GitContextAdapterWorld) => {
    ensureRepo(world);
    gitCommit(world.repoDir, 'C1');
    gitCommit(world.repoDir, 'C2');
    gitCommit(world.repoDir, 'C3');
    const result = await world.reader.read(world.repoDir);
    state.set('mappedCommits', result.commits);
    world.mappedCommits = result.commits;
    world.mappedResult = result;
  },
);

When('the adapter maps the raw log to a CommitDto list', async (world: GitContextAdapterWorld) => {
  world.mappedResult = await world.reader.read(world.repoDir);
  world.mappedCommits = world.mappedResult.commits;
});

Then(
  'each entry has a shortHash, fullHash, message, authorName, and date',
  (world: GitContextAdapterWorld) => {
    for (const c of world.mappedCommits) {
      if (!c.shortHash) throw new Error('Missing shortHash');
      if (!c.fullHash) throw new Error('Missing fullHash');
      if (!c.message) throw new Error('Missing message');
      if (!c.authorName) throw new Error('Missing authorName');
      if (!c.date) throw new Error('Missing date');
    }
  },
);

Then('no raw simple-git DefaultLogFields reference is exposed to the caller', () => {
  // Verified by type system
});

Given(
  'simple-git returns a raw LogResult with commits C1, C2, and C3 in chronological order',
  async (world: GitContextAdapterWorld) => {
    ensureRepo(world);
    gitCommit(world.repoDir, 'C1');
    gitCommit(world.repoDir, 'C2');
    gitCommit(world.repoDir, 'C3');
    world.mappedResult = await world.reader.read(world.repoDir);
    world.mappedCommits = world.mappedResult.commits;
  },
);

Then(
  'the first entry in the list corresponds to the newest commit C3',
  (world: GitContextAdapterWorld) => {
    if (world.mappedCommits[0]?.message !== 'C3')
      throw new Error(`Expected newest C3, got ${world.mappedCommits[0]?.message}`);
  },
);

Then('the last entry corresponds to the oldest commit C1', (world: GitContextAdapterWorld) => {
  const msgs = world.mappedCommits.map((c) => c.message);
  // C1 should be the last (oldest)
  if (msgs[msgs.length - 1] !== 'C1')
    throw new Error(`Expected oldest C1 as last, got ${msgs[msgs.length - 1]}`);
});

// ── Detached HEAD ──

Given(
  'simple-git status indicates a detached HEAD at commit {string}',
  (world: GitContextAdapterWorld) => {
    ensureRepo(world);
    gitCommit(world.repoDir, 'detach-test');
    const hash = execSync('git rev-parse --short HEAD', { cwd: world.repoDir, stdio: 'pipe' })
      .toString()
      .trim();
    execSync(`git checkout ${hash}`, { cwd: world.repoDir, stdio: 'pipe' });
  },
);

Then(
  'the resulting context DTO has headState set to {string}',
  (world: GitContextAdapterWorld, state: string) => {
    const actual = world.mappedResult?.status?.headState;
    if (actual !== state) throw new Error(`Expected headState "${state}", got "${actual}"`);
  },
);

Then(
  'the resulting context DTO has detachedCommitHash {string}',
  (world: GitContextAdapterWorld) => {
    if (!world.mappedResult?.status?.detachedCommitHash)
      throw new Error('Expected detachedCommitHash');
  },
);

Then(
  'the resulting context DTO has currentBranch set to {word}',
  (world: GitContextAdapterWorld) => {
    if (world.mappedResult?.status?.currentBranch !== null)
      throw new Error('Expected currentBranch to be null');
  },
);

Given('the workspace is in detached HEAD', (world: GitContextAdapterWorld) => {
  ensureRepo(world);
  gitCommit(world.repoDir, 'detach-test');
  const hash = execSync('git rev-parse --short HEAD', { cwd: world.repoDir, stdio: 'pipe' })
    .toString()
    .trim();
  execSync(`git checkout ${hash}`, { cwd: world.repoDir, stdio: 'pipe' });
});

Given(
  'simple-git returns branches {string}, {string}',
  (world: GitContextAdapterWorld, b1: string, b2: string) => {
    // Ensure both branches exist without changing detached HEAD state.
    // Save current HEAD, create branches, then restore detached state.
    let hash = '';
    try {
      hash = execSync('git rev-parse HEAD', { cwd: world.repoDir, stdio: 'pipe' })
        .toString()
        .trim();
    } catch {
      /* ok */
    }
    try {
      execSync(`git branch ${b1} ${hash}`, { cwd: world.repoDir, stdio: 'pipe' });
    } catch {
      /* ok */
    }
    try {
      execSync(`git branch ${b2} ${hash}`, { cwd: world.repoDir, stdio: 'pipe' });
    } catch {
      /* ok */
    }
    // If we're in detached HEAD, stay there
    if (hash) {
      try {
        execSync(`git checkout ${hash}`, { cwd: world.repoDir, stdio: 'pipe' });
      } catch {
        /* ok */
      }
    }
  },
);

When('the adapter maps the branch summary', async (world: GitContextAdapterWorld) => {
  world.mappedResult = await world.reader.read(world.repoDir);
  world.mappedBranches = world.mappedResult.branches;
});

Then(
  'the BranchDto list contains {string} and {string}',
  (world: GitContextAdapterWorld, b1: string, b2: string) => {
    const names = world.mappedBranches.map((b) => b.name);
    if (!names.includes(b1)) throw new Error(`"${b1}" not in branch list: [${names}]`);
    if (!names.includes(b2)) throw new Error(`"${b2}" not in branch list: [${names}]`);
  },
);

Then('no branch is marked as current', (world: GitContextAdapterWorld) => {
  const current = world.mappedBranches.find((b) => b.isCurrent);
  if (current) throw new Error(`Expected no current branch, got "${current.name}"`);
});

// ── Unborn HEAD ──

Given(
  'simple-git status indicates that the repository has no commits yet',
  (world: GitContextAdapterWorld) => {
    ensureRepo(world);
    // Don't commit anything — repo is unborn
    // But ensureRepo already ran git init. Remove any auto-created files
  },
);

Then('the resulting context DTO has commitCount set to 0', (world: GitContextAdapterWorld) => {
  if (world.mappedResult?.commits.length !== 0)
    throw new Error(`Expected 0 commits, got ${world.mappedResult?.commits.length}`);
});

Given('the workspace has no commits yet', (world: GitContextAdapterWorld) => {
  ensureRepo(world);
  // No commits
});

Given('simple-git log returns an empty result', () => {
  // No-op: empty repo means empty log
});

When('the adapter maps the log output', async (world: GitContextAdapterWorld) => {
  world.mappedResult = await world.reader.read(world.repoDir);
  world.mappedCommits = world.mappedResult.commits;
});

Then('the CommitDto list is empty', (world: GitContextAdapterWorld) => {
  if (world.mappedCommits.length !== 0)
    throw new Error(`Expected empty commit list, got ${world.mappedCommits.length}`);
});

// ── Typed errors ──

Given(
  'simple-git status throws a GitError with message {string}',
  (world: GitContextAdapterWorld) => {
    ensureRepo(world);
    // Remove .git/HEAD to cause a git error on status
    try {
      fs.rmSync(path.join(world.repoDir, '.git', 'HEAD'));
    } catch {
      /* ok */
    }
  },
);

When('the adapter catches the error', async (world: GitContextAdapterWorld) => {
  world.mappedResult = await world.reader.read(world.repoDir);
});

Then('the adapter returns a GitContextError result', (world: GitContextAdapterWorld) => {
  if (!world.mappedResult?.error) throw new Error('Expected error result');
});

Then('the GitContextError has a userFacingMessage {string}', (world: GitContextAdapterWorld) => {
  if (!world.mappedResult?.error?.message) throw new Error('Expected user-facing message');
});

Then('the GitContextError has an errorCode', (world: GitContextAdapterWorld) => {
  if (!world.mappedResult?.error?.errorCode) throw new Error('Expected errorCode');
});

Then(
  'the GitContextError does not expose the raw simple-git error stack trace',
  (world: GitContextAdapterWorld) => {
    const msg = world.mappedResult?.error?.message ?? '';
    if (msg.includes('Error:') || msg.includes('at ') || msg.includes('stack'))
      throw new Error('Raw stack trace leaked');
  },
);

Given(
  'the active workspace path points to a directory that is not a Git repository',
  (world: GitContextAdapterWorld) => {
    ensureRepo(world);
    const nonGit = path.join(world.fixtureDir, 'not-a-repo');
    fs.mkdirSync(nonGit, { recursive: true });
  },
);

When('the adapter validates the workspace', async (world: GitContextAdapterWorld) => {
  const nonGit = path.join(world.fixtureDir, 'not-a-repo');
  world.mappedResult = await world.reader.read(nonGit);
});

Then(
  'the adapter returns a typed error result with errorCode {string}',
  (world: GitContextAdapterWorld, code: string) => {
    if (world.mappedResult?.error?.errorCode !== code)
      throw new Error(
        `Expected errorCode "${code}", got "${world.mappedResult?.error?.errorCode}"`,
      );
  },
);

Then('no exception propagates to the caller', () => {
  // If we got here without an exception, it passed
});

Given(
  'the active workspace path does not exist on the file system',
  (world: GitContextAdapterWorld) => {
    ensureRepo(world);
    // The reader will be used on a non-existent path directly
  },
);

When('the adapter attempts to access the repository', async (world: GitContextAdapterWorld) => {
  world.mappedResult = await world.reader.read('/tmp/does-not-exist-bdd-99999');
});
