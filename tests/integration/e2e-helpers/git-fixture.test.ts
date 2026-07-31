import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import type { GitFixture } from '../../e2e/helpers/git-fixture';
import { createGitFixture } from '../../e2e/helpers/git-fixture';

// ── Test infrastructure ──────────────────────────────────

const activeFixtures: GitFixture[] = [];

afterEach(() => {
  for (const f of activeFixtures) {
    try {
      f.cleanup();
    } catch {
      // Idempotent cleanup — swallow errors on already-cleaned fixtures
    }
  }
  activeFixtures.length = 0;
});

function track(f: GitFixture): GitFixture {
  activeFixtures.push(f);
  return f;
}

// ── Tests ────────────────────────────────────────────────

describe('GitFixture', () => {
  it('creates fixture with default prefix and initializes Git repo', () => {
    const f = track(createGitFixture());

    // rootDir and repoPath are defined and exist on disk
    expect(f.rootDir).toBeDefined();
    expect(f.rootDir).toMatch(/diffscribe-e2e-git-/);
    expect(f.repoPath).toBe(join(f.rootDir, 'repo'));
    expect(existsSync(f.rootDir)).toBe(true);
    expect(existsSync(f.repoPath)).toBe(true);

    // Git is initialized — .git directory exists
    expect(existsSync(join(f.repoPath, '.git'))).toBe(true);

    // Git test user is configured
    const gitConfig = readFileSync(join(f.repoPath, '.git', 'config'), 'utf-8');
    expect(gitConfig).toContain('email = test@test.com');
    expect(gitConfig).toContain('name = Test User');

    // runGit executes without error
    expect(() => f.runGit(['status'])).not.toThrow();

    // No automatic commit — rev-parse HEAD fails before any commit
    expect(() => f.runGit(['rev-parse', 'HEAD'])).toThrow();
  });

  it('accepts custom prefix', () => {
    const prefix = 'my-custom-prefix-';
    const f = track(createGitFixture(prefix));

    expect(f.rootDir).toMatch(new RegExp(prefix.replace(/-/g, '\\-')));
    expect(existsSync(f.rootDir)).toBe(true);
  });

  it('two fixtures have distinct roots and independent Git state', () => {
    const f1 = track(createGitFixture());
    const f2 = track(createGitFixture());

    // Distinct paths
    expect(f1.rootDir).not.toBe(f2.rootDir);
    expect(f1.repoPath).not.toBe(f2.repoPath);

    // Independent Git identity — configure different user names
    f1.runGit(['config', 'user.name', 'User A']);
    f2.runGit(['config', 'user.name', 'User B']);

    const config1 = readFileSync(join(f1.repoPath, '.git', 'config'), 'utf-8');
    const config2 = readFileSync(join(f2.repoPath, '.git', 'config'), 'utf-8');
    expect(config1).toContain('name = User A');
    expect(config2).toContain('name = User B');

    // Independent commits
    writeFileSync(join(f1.repoPath, 'a.txt'), 'file-a');
    f1.runGit(['add', 'a.txt']);
    f1.runGit(['commit', '-m', 'commit in f1']);

    // f2 has no commits yet
    expect(() => f2.runGit(['rev-parse', 'HEAD'])).toThrow();

    // f1 has the commit
    expect(() => f1.runGit(['rev-parse', 'HEAD'])).not.toThrow();
  });

  it('handles arguments with spaces and special characters without shell interpolation', () => {
    const f = track(createGitFixture());

    // File with spaces in name
    const fileName = 'my document (v1).txt';
    writeFileSync(join(f.repoPath, fileName), 'content');

    // These must use argument arrays, never shell interpolation
    f.runGit(['add', fileName]);
    f.runGit(['commit', '-m', 'commit with spaces and $pecial chars!']);

    // Verify commit was created
    expect(() => f.runGit(['rev-parse', 'HEAD'])).not.toThrow();
  });

  it('handles repository root path containing spaces', () => {
    // Prefix with spaces ensures the temp root contains spaces
    const prefix = 'prefix with spaces ';
    const f = track(createGitFixture(prefix));

    expect(f.rootDir).toContain(' ');

    // Must still be a valid Git repo
    expect(existsSync(join(f.repoPath, '.git'))).toBe(true);
    expect(() => f.runGit(['status'])).not.toThrow();

    // Normal Git operations work inside a path with spaces
    writeFileSync(join(f.repoPath, 'test.txt'), 'data');
    f.runGit(['add', 'test.txt']);
    f.runGit(['commit', '-m', 'init']);
    expect(() => f.runGit(['rev-parse', 'HEAD'])).not.toThrow();
  });

  it('cleanup removes its own root and is idempotent, does not affect other fixtures', () => {
    const f1 = track(createGitFixture());
    const f2 = track(createGitFixture());

    const root1 = f1.rootDir;
    const root2 = f2.rootDir;

    // Both exist before cleanup
    expect(existsSync(root1)).toBe(true);
    expect(existsSync(root2)).toBe(true);

    // Cleanup f1
    f1.cleanup();
    expect(existsSync(root1)).toBe(false);

    // f2 still exists
    expect(existsSync(root2)).toBe(true);
    expect(() => f2.runGit(['status'])).not.toThrow();

    // Idempotent: second cleanup does not throw
    expect(() => f1.cleanup()).not.toThrow();
  });
});
