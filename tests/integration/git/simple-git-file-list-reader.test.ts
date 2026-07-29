import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ComparisonType } from '../../../src/lib/server/domain/value-objects/comparison';
import { FileChangeStatus } from '../../../src/lib/server/domain/value-objects/file-change-status';
import { SimpleGitFileListReader } from '../../../src/lib/server/infrastructure/git/simple-git-file-list-reader';

function mkTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'diffscribe-test-flr-'));
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

function writeFile(dir: string, relPath: string, content: string): void {
  const fullPath = path.join(dir, relPath);
  const parent = path.dirname(fullPath);
  if (!fs.existsSync(parent)) {
    fs.mkdirSync(parent, { recursive: true });
  }
  fs.writeFileSync(fullPath, content);
}

describe('SimpleGitFileListReader (integration)', () => {
  let tempRoot: string;
  let repoDir: string;

  beforeEach(() => {
    tempRoot = mkTempDir();
    repoDir = path.join(tempRoot, 'repo');
    fs.mkdirSync(repoDir);
    gitInit(repoDir);
    // Initial commit so we have HEAD
    writeFile(repoDir, 'README.md', '# test');
    gitCommit(repoDir, 'init');
  });

  afterEach(() => {
    rmDir(tempRoot);
  });

  // ── Status mapping ──

  it('maps an added file correctly', async () => {
    writeFile(repoDir, 'src/new.ts', 'new content');
    execSync('git add src/new.ts', { cwd: repoDir, stdio: 'pipe' });

    const reader = new SimpleGitFileListReader();
    const result = await reader.read({
      repositoryPath: repoDir,
      comparisonType: ComparisonType.STAGED_VS_HEAD,
      baseRef: 'HEAD',
      targetRef: '',
    });

    const added = result.entries.find((e) => e.path === 'src/new.ts');
    expect(added).toBeDefined();
    expect(added!.status).toBe(FileChangeStatus.ADDED);
    expect(added!.binary).toBe(false);
  });

  it('maps a modified file correctly', async () => {
    writeFile(repoDir, 'README.md', '# modified');
    execSync('git add README.md', { cwd: repoDir, stdio: 'pipe' });

    const reader = new SimpleGitFileListReader();
    const result = await reader.read({
      repositoryPath: repoDir,
      comparisonType: ComparisonType.STAGED_VS_HEAD,
      baseRef: 'HEAD',
      targetRef: '',
    });

    const modified = result.entries.find((e) => e.path === 'README.md');
    expect(modified).toBeDefined();
    expect(modified!.status).toBe(FileChangeStatus.MODIFIED);
  });

  it('maps a deleted file correctly', async () => {
    writeFile(repoDir, 'to-delete.txt', 'delete me');
    gitCommit(repoDir, 'add file');
    execSync('git rm to-delete.txt', { cwd: repoDir, stdio: 'pipe' });

    const reader = new SimpleGitFileListReader();
    const result = await reader.read({
      repositoryPath: repoDir,
      comparisonType: ComparisonType.STAGED_VS_HEAD,
      baseRef: 'HEAD',
      targetRef: '',
    });

    const deleted = result.entries.find((e) => e.path === 'to-delete.txt');
    expect(deleted).toBeDefined();
    expect(deleted!.status).toBe(FileChangeStatus.DELETED);
  });

  it('maps a renamed file with oldPath', async () => {
    writeFile(repoDir, 'old.ts', 'old content');
    gitCommit(repoDir, 'add old');
    execSync('git mv old.ts new.ts', { cwd: repoDir, stdio: 'pipe' });

    const reader = new SimpleGitFileListReader();
    const result = await reader.read({
      repositoryPath: repoDir,
      comparisonType: ComparisonType.STAGED_VS_HEAD,
      baseRef: 'HEAD',
      targetRef: '',
    });

    const renamed = result.entries.find((e) => e.path === 'new.ts');
    expect(renamed).toBeDefined();
    expect(renamed!.status).toBe(FileChangeStatus.RENAMED);
    expect(renamed!.oldPath).toBe('old.ts');
  });

  it('maps untracked files when target is working-tree', async () => {
    writeFile(repoDir, 'src/untracked.ts', 'untracked content');

    const reader = new SimpleGitFileListReader();
    const result = await reader.read({
      repositoryPath: repoDir,
      comparisonType: ComparisonType.WORKING_TREE_VS_HEAD,
      baseRef: 'HEAD',
      targetRef: 'working-tree',
    });

    const untracked = result.entries.find((e) => e.path === 'src/untracked.ts');
    expect(untracked).toBeDefined();
    expect(untracked!.status).toBe(FileChangeStatus.UNTRACKED);
    expect(untracked!.binary).toBe(false);
  });

  // ── Untracked exclusion ──

  it('excludes untracked files for unstaged comparison', async () => {
    writeFile(repoDir, 'untracked.txt', 'fresh');

    const reader = new SimpleGitFileListReader();
    const result = await reader.read({
      repositoryPath: repoDir,
      comparisonType: ComparisonType.UNSTAGED,
      baseRef: '',
      targetRef: '',
    });

    const untracked = result.entries.find((e) => e.status === FileChangeStatus.UNTRACKED);
    expect(untracked).toBeUndefined();
  });

  it('excludes untracked files for staged-vs-head comparison', async () => {
    writeFile(repoDir, 'untracked.txt', 'fresh');

    const reader = new SimpleGitFileListReader();
    const result = await reader.read({
      repositoryPath: repoDir,
      comparisonType: ComparisonType.STAGED_VS_HEAD,
      baseRef: 'HEAD',
      targetRef: '',
    });

    const untracked = result.entries.find((e) => e.status === FileChangeStatus.UNTRACKED);
    expect(untracked).toBeUndefined();
  });

  it('excludes untracked files for branch-vs-branch comparison', async () => {
    writeFile(repoDir, 'untracked.txt', 'fresh');

    const reader = new SimpleGitFileListReader();
    const result = await reader.read({
      repositoryPath: repoDir,
      comparisonType: ComparisonType.BRANCH_VS_BRANCH,
      baseRef: 'master',
      targetRef: 'master',
    });

    const untracked = result.entries.find((e) => e.status === FileChangeStatus.UNTRACKED);
    expect(untracked).toBeUndefined();
  });

  it('includes untracked for commit-vs-working-tree', async () => {
    writeFile(repoDir, 'untracked.txt', 'fresh');

    const reader = new SimpleGitFileListReader();
    const result = await reader.read({
      repositoryPath: repoDir,
      comparisonType: ComparisonType.COMMIT_VS_WORKING_TREE,
      baseRef: 'HEAD',
      targetRef: 'working-tree',
    });

    const untracked = result.entries.find((e) => e.status === FileChangeStatus.UNTRACKED);
    expect(untracked).toBeDefined();
  });

  it('includes untracked for branch-vs-working-tree', async () => {
    writeFile(repoDir, 'untracked.txt', 'fresh');

    const reader = new SimpleGitFileListReader();
    const result = await reader.read({
      repositoryPath: repoDir,
      comparisonType: ComparisonType.BRANCH_VS_WORKING_TREE,
      baseRef: 'master',
      targetRef: 'working-tree',
    });

    const untracked = result.entries.find((e) => e.status === FileChangeStatus.UNTRACKED);
    expect(untracked).toBeDefined();
  });

  // ── Binary detection ──

  it('marks binary files as binary for tracked files', async () => {
    // Create a file with NUL bytes so git detects it as binary
    const binaryBuf = Buffer.alloc(1024);
    binaryBuf[0] = 0x89;
    binaryBuf[1] = 0x50;
    binaryBuf[2] = 0x4e;
    binaryBuf[3] = 0x47; // PNG-like header
    binaryBuf[512] = 0; // NUL byte
    fs.writeFileSync(path.join(repoDir, 'logo.png'), binaryBuf);
    execSync('git add logo.png', { cwd: repoDir, stdio: 'pipe' });
    gitCommit(repoDir, 'add binary');

    // Modify to create a diff
    binaryBuf[128] = (binaryBuf[128] + 1) % 256;
    binaryBuf[600] = 0; // Another NUL byte to ensure git detects it
    fs.writeFileSync(path.join(repoDir, 'logo.png'), binaryBuf);
    execSync('git add logo.png', { cwd: repoDir, stdio: 'pipe' });

    const reader = new SimpleGitFileListReader();
    const result = await reader.read({
      repositoryPath: repoDir,
      comparisonType: ComparisonType.STAGED_VS_HEAD,
      baseRef: 'HEAD',
      targetRef: '',
    });

    const binary = result.entries.find((e) => e.path === 'logo.png');
    expect(binary).toBeDefined();
    expect(binary!.binary).toBe(true);
  });

  // ── Special paths ──

  it('handles files with spaces in the path', async () => {
    writeFile(repoDir, 'src/data with spaces.ts', 'content');
    execSync('git add "src/data with spaces.ts"', { cwd: repoDir, stdio: 'pipe' });

    const reader = new SimpleGitFileListReader();
    const result = await reader.read({
      repositoryPath: repoDir,
      comparisonType: ComparisonType.STAGED_VS_HEAD,
      baseRef: 'HEAD',
      targetRef: '',
    });

    const entry = result.entries.find((e) => e.path === 'src/data with spaces.ts');
    expect(entry).toBeDefined();
  });

  // ── Additions/Deletions ──

  it('reports additions and deletions from numstat for modified files', async () => {
    writeFile(repoDir, 'README.md', 'line1\nline2\nline3\n');
    execSync('git add README.md', { cwd: repoDir, stdio: 'pipe' });

    const reader = new SimpleGitFileListReader();
    const result = await reader.read({
      repositoryPath: repoDir,
      comparisonType: ComparisonType.STAGED_VS_HEAD,
      baseRef: 'HEAD',
      targetRef: '',
    });

    const modified = result.entries.find((e) => e.path === 'README.md');
    expect(modified).toBeDefined();
    expect(typeof modified!.additions).toBe('number');
    expect(typeof modified!.deletions).toBe('number');
  });

  // ── readAt timestamp ──

  it('returns a readAt timestamp', async () => {
    const reader = new SimpleGitFileListReader();
    const result = await reader.read({
      repositoryPath: repoDir,
      comparisonType: ComparisonType.WORKING_TREE_VS_HEAD,
      baseRef: 'HEAD',
      targetRef: 'working-tree',
    });

    expect(result.readAt).toBeDefined();
    expect(() => new Date(result.readAt)).not.toThrow();
  });

  // ── Error handling ──

  it('returns typed error for non-existent path', async () => {
    const reader = new SimpleGitFileListReader();
    const result = await reader.read({
      repositoryPath: '/tmp/does-not-exist-99999-flr',
      comparisonType: ComparisonType.WORKING_TREE_VS_HEAD,
      baseRef: 'HEAD',
      targetRef: 'working-tree',
    });

    expect(result.error).toBeDefined();
    expect(result.error!.errorCode).toBeDefined();
  });

  // ── Untracked binary detection (read-only) ──

  it('detects binary untracked files via read-only content inspection', async () => {
    const binaryBuf = Buffer.alloc(1024);
    binaryBuf[0] = 0; // NUL byte at start
    fs.writeFileSync(path.join(repoDir, 'untracked.bin'), binaryBuf);

    const reader = new SimpleGitFileListReader();
    const result = await reader.read({
      repositoryPath: repoDir,
      comparisonType: ComparisonType.WORKING_TREE_VS_HEAD,
      baseRef: 'HEAD',
      targetRef: 'working-tree',
    });

    const entry = result.entries.find((e) => e.path === 'untracked.bin');
    expect(entry).toBeDefined();
    expect(entry!.status).toBe(FileChangeStatus.UNTRACKED);
    expect(entry!.binary).toBe(true);
  });

  // ── All ComparisonTypes ──

  it('handles commit-vs-commit comparison', async () => {
    writeFile(repoDir, 'f1.ts', 'v1');
    gitCommit(repoDir, 'c1');
    const c1Hash = execSync('git rev-parse HEAD', { cwd: repoDir, stdio: 'pipe' })
      .toString()
      .trim();
    writeFile(repoDir, 'f1.ts', 'v2');
    gitCommit(repoDir, 'c2');
    const c2Hash = execSync('git rev-parse HEAD', { cwd: repoDir, stdio: 'pipe' })
      .toString()
      .trim();

    const reader = new SimpleGitFileListReader();
    const result = await reader.read({
      repositoryPath: repoDir,
      comparisonType: ComparisonType.COMMIT_VS_COMMIT,
      baseRef: c1Hash,
      targetRef: c2Hash,
    });

    const modified = result.entries.find((e) => e.path === 'f1.ts');
    expect(modified).toBeDefined();
    expect(modified!.status).toBe(FileChangeStatus.MODIFIED);
  });

  it('handles commit-range comparison', async () => {
    writeFile(repoDir, 'f1.ts', 'v1');
    gitCommit(repoDir, 'c1');
    const c1Hash = execSync('git rev-parse HEAD', { cwd: repoDir, stdio: 'pipe' })
      .toString()
      .trim();
    writeFile(repoDir, 'f1.ts', 'v2');
    gitCommit(repoDir, 'c2');
    const c2Hash = execSync('git rev-parse HEAD', { cwd: repoDir, stdio: 'pipe' })
      .toString()
      .trim();

    const reader = new SimpleGitFileListReader();
    const result = await reader.read({
      repositoryPath: repoDir,
      comparisonType: ComparisonType.COMMIT_RANGE,
      baseRef: c1Hash,
      targetRef: c2Hash,
    });

    const modified = result.entries.find((e) => e.path === 'f1.ts');
    expect(modified).toBeDefined();
  });

  // ── No mutation guarantee ──

  it('does not modify the repository (no git add, checkout, commit)', async () => {
    const beforeHash = execSync('git rev-parse HEAD', { cwd: repoDir, stdio: 'pipe' })
      .toString()
      .trim();
    writeFile(repoDir, 'untracked.txt', 'fresh');

    const reader = new SimpleGitFileListReader();
    await reader.read({
      repositoryPath: repoDir,
      comparisonType: ComparisonType.WORKING_TREE_VS_HEAD,
      baseRef: 'HEAD',
      targetRef: 'working-tree',
    });

    const afterHash = execSync('git rev-parse HEAD', { cwd: repoDir, stdio: 'pipe' })
      .toString()
      .trim();
    expect(afterHash).toBe(beforeHash);

    // Verify no new commits, branches, or staged files
    const branches = execSync('git branch', { cwd: repoDir, stdio: 'pipe' }).toString();
    expect(branches).toContain('* master');

    const status = execSync('git status --porcelain', { cwd: repoDir, stdio: 'pipe' }).toString();
    // untracked.txt should appear as untracked (??), NOT staged/changed
    expect(status).toContain('?? untracked.txt');
    expect(status).not.toContain('A');
    expect(status).not.toContain('M');
  });

  // ── Untracked unreadable file ──

  it('handles unreadable untracked file without throwing', async () => {
    // Skip this test on non-Linux (chmod behavior varies)
    if (process.platform !== 'linux') return;

    writeFile(repoDir, 'restricted/secrets.env', 'secret');
    const fullPath = path.join(repoDir, 'restricted/secrets.env');
    fs.chmodSync(fullPath, 0o000);

    const reader = new SimpleGitFileListReader();
    const result = await reader.read({
      repositoryPath: repoDir,
      comparisonType: ComparisonType.WORKING_TREE_VS_HEAD,
      baseRef: 'HEAD',
      targetRef: 'working-tree',
    });

    const entry = result.entries.find((e) => e.path === 'restricted/secrets.env');
    expect(entry).toBeDefined();
    // Clean up: restore permissions so cleanup works
    try {
      fs.chmodSync(fullPath, 0o644);
    } catch {
      /* ok */
    }
  });
});
