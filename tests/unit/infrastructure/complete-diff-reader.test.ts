import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ComparisonType } from '../../../src/lib/server/domain/value-objects/comparison';
import { SimpleGitCompleteDiffReader } from '../../../src/lib/server/infrastructure/git/simple-git-complete-diff-reader';

function mkTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'diffscribe-test-cdr-'));
}

function gitInit(dir: string): void {
  execSync('git init', { cwd: dir, stdio: 'pipe' });
  execSync('git config user.email "test@test.com"', { cwd: dir, stdio: 'pipe' });
  execSync('git config user.name "Test"', { cwd: dir, stdio: 'pipe' });
}

function gitCommit(dir: string, msg: string): void {
  execSync('git add .', { cwd: dir, stdio: 'pipe' });
  execSync(`git commit -m "${msg}"`, { cwd: dir, stdio: 'pipe' });
}

function rmDir(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

function writeFile(dir: string, relPath: string, content: string | Buffer): void {
  const fullPath = path.join(dir, relPath);
  const parent = path.dirname(fullPath);
  if (!fs.existsSync(parent)) {
    fs.mkdirSync(parent, { recursive: true });
  }
  fs.writeFileSync(fullPath, content);
}

describe('SimpleGitCompleteDiffReader (aggregate)', () => {
  let tempRoot: string;
  let repoDir: string;

  beforeEach(() => {
    tempRoot = mkTempDir();
    repoDir = path.join(tempRoot, 'repo');
    fs.mkdirSync(repoDir);
    gitInit(repoDir);
    writeFile(repoDir, 'README.md', '# test');
    writeFile(repoDir, 'src/app.ts', 'line1\nline2\n');
    gitCommit(repoDir, 'init');
  });

  afterEach(() => {
    rmDir(tempRoot);
  });

  const readWorkingTree = () => {
    const reader = new SimpleGitCompleteDiffReader();
    return reader.read({
      repositoryPath: repoDir,
      comparisonType: ComparisonType.WORKING_TREE_VS_HEAD,
      baseRef: 'HEAD',
      targetRef: '',
    });
  };

  it('reads multiple modified files with deterministic path order', async () => {
    writeFile(repoDir, 'src/app.ts', 'line1\nline2\nmodified\n');
    writeFile(repoDir, 'README.md', '# test\nmore\n');

    const result = await readWorkingTree();
    expect(result.error).toBeUndefined();
    const paths = result.files.map((f) => f.path);
    expect(paths).toEqual(['README.md', 'src/app.ts']);
    expect(result.files[1].hunks.length).toBeGreaterThan(0);
  });

  it('marks binary files with binary flag and no hunks', async () => {
    writeFile(repoDir, 'src/logo.png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01]));
    const result = await readWorkingTree();
    const binary = result.files.find((f) => f.path === 'src/logo.png');
    expect(binary).toBeDefined();
    expect(binary!.binary).toBe(true);
    expect(binary!.hunks).toHaveLength(0);
  });

  it('resolves rename oldPath for renamed files', async () => {
    writeFile(repoDir, 'old-name.ts', 'content\n');
    gitCommit(repoDir, 'add old');
    execSync('git mv old-name.ts new-name.ts', { cwd: repoDir, stdio: 'pipe' });

    const result = await readWorkingTree();
    const renamed = result.files.find((f) => f.path === 'new-name.ts');
    expect(renamed).toBeDefined();
    expect(renamed!.oldPath).toBe('old-name.ts');
  });

  it('includes untracked files only for working-tree comparisons', async () => {
    writeFile(repoDir, 'fresh.txt', 'untracked content\n');
    const result = await readWorkingTree();
    const untracked = result.files.find((f) => f.path === 'fresh.txt');
    expect(untracked).toBeDefined();
    expect(untracked!.status).toBe('untracked');
    expect(untracked!.hunks.length).toBeGreaterThan(0);

    // Staged comparison must NOT include the untracked file.
    const reader = new SimpleGitCompleteDiffReader();
    const staged = await reader.read({
      repositoryPath: repoDir,
      comparisonType: ComparisonType.STAGED_VS_HEAD,
      baseRef: 'HEAD',
      targetRef: '',
    });
    expect(staged.files.find((f) => f.path === 'fresh.txt')).toBeUndefined();
  });

  it('applies the aggregate file limit and marks the result truncated', async () => {
    for (let i = 0; i < 5; i++) {
      writeFile(repoDir, `file-${i}.txt`, `content ${i}\n`);
    }
    const reader = new SimpleGitCompleteDiffReader();
    const result = await reader.read({
      repositoryPath: repoDir,
      comparisonType: ComparisonType.WORKING_TREE_VS_HEAD,
      baseRef: 'HEAD',
      targetRef: '',
      fileLimit: 2,
    });
    expect(result.isTruncated).toBe(true);
    expect(result.truncationReason).toBeDefined();
    expect(result.files.length).toBeLessThanOrEqual(2);
  });

  it('shares a single readAt snapshot across all file sections', async () => {
    writeFile(repoDir, 'src/app.ts', 'line1\nline2\nmodified\n');
    writeFile(repoDir, 'README.md', '# test\nmore\n');
    const result = await readWorkingTree();
    expect(result.files.length).toBeGreaterThan(0);
    expect(result.files.every((f) => f.readAt === result.readAt)).toBe(true);
  });

  it('returns a fatal error for a missing repository path', async () => {
    const reader = new SimpleGitCompleteDiffReader();
    const result = await reader.read({
      repositoryPath: path.join(tempRoot, 'missing'),
      comparisonType: ComparisonType.WORKING_TREE_VS_HEAD,
      baseRef: 'HEAD',
      targetRef: '',
    });
    expect(result.error).toBeDefined();
    expect(result.error!.errorCode).toBe('PATH_NOT_FOUND');
  });

  it('reports partial per-file errors without failing the result', async () => {
    writeFile(repoDir, 'src/app.ts', 'line1\nline2\nmodified\n');
    writeFile(repoDir, 'README.md', '# test\nmore\n');
    const result = await readWorkingTree();
    expect(result.files.length).toBeGreaterThan(0);
    expect(Array.isArray(result.partialErrors)).toBe(true);
  });
});
