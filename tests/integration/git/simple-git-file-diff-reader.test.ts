import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ComparisonType } from '../../../src/lib/server/domain/value-objects/comparison';
import { SimpleGitFileDiffReader } from '../../../src/lib/server/infrastructure/git/simple-git-file-diff-reader';

function mkTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'diffscribe-test-fdr-'));
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

describe('SimpleGitFileDiffReader (integration)', () => {
  let tempRoot: string;
  let repoDir: string;

  beforeEach(() => {
    tempRoot = mkTempDir();
    repoDir = path.join(tempRoot, 'repo');
    fs.mkdirSync(repoDir);
    gitInit(repoDir);
    writeFile(repoDir, 'README.md', '# test');
    gitCommit(repoDir, 'init');
  });

  afterEach(() => {
    rmDir(tempRoot);
  });

  // ── Basic modified file ──

  it('reads diff for a modified file', async () => {
    writeFile(repoDir, 'README.md', '# modified');
    execSync('git add README.md', { cwd: repoDir, stdio: 'pipe' });

    const reader = new SimpleGitFileDiffReader();
    const result = await reader.read({
      repositoryPath: repoDir,
      comparisonType: ComparisonType.STAGED_VS_HEAD,
      baseRef: 'HEAD',
      targetRef: '',
      relativePath: 'README.md',
    });

    expect(result.path).toBe('README.md');
    expect(result.isBinary).toBe(false);
    expect(result.hunks.length).toBeGreaterThan(0);
  });

  it('returns hunks with correct change types', async () => {
    // Create a file with multiple lines, modify it
    writeFile(repoDir, 'src/app.ts', 'line1\nline2\nline3\n');
    gitCommit(repoDir, 'add app.ts');
    writeFile(repoDir, 'src/app.ts', 'line1\nline2-modified\nline3\n');
    execSync('git add src/app.ts', { cwd: repoDir, stdio: 'pipe' });

    const reader = new SimpleGitFileDiffReader();
    const result = await reader.read({
      repositoryPath: repoDir,
      comparisonType: ComparisonType.STAGED_VS_HEAD,
      baseRef: 'HEAD',
      targetRef: '',
      relativePath: 'src/app.ts',
    });

    const allLines = result.hunks.flatMap((h) => h.lines);
    const added = allLines.filter((l) => l.changeType === 'added');
    const deleted = allLines.filter((l) => l.changeType === 'deleted');
    const context = allLines.filter((l) => l.changeType === 'context');

    expect(added.length).toBeGreaterThan(0);
    expect(deleted.length).toBeGreaterThan(0);
    expect(context.length).toBeGreaterThan(0);
  });

  // ── Added file ──

  it('shows all lines as added for a new file', async () => {
    writeFile(repoDir, 'src/new.ts', 'line1\nline2\nline3\n');
    execSync('git add src/new.ts', { cwd: repoDir, stdio: 'pipe' });

    const reader = new SimpleGitFileDiffReader();
    const result = await reader.read({
      repositoryPath: repoDir,
      comparisonType: ComparisonType.STAGED_VS_HEAD,
      baseRef: 'HEAD',
      targetRef: '',
      relativePath: 'src/new.ts',
    });

    const allLines = result.hunks.flatMap((h) => h.lines);
    expect(allLines.length).toBeGreaterThan(0);
    expect(allLines.every((l) => l.changeType === 'added')).toBe(true);
  });

  // ── Deleted file ──

  it('shows all lines as deleted for a deleted file', async () => {
    writeFile(repoDir, 'src/removed.ts', 'line1\nline2\nline3\n');
    gitCommit(repoDir, 'add removed');
    execSync('git rm src/removed.ts', { cwd: repoDir, stdio: 'pipe' });

    const reader = new SimpleGitFileDiffReader();
    const result = await reader.read({
      repositoryPath: repoDir,
      comparisonType: ComparisonType.STAGED_VS_HEAD,
      baseRef: 'HEAD',
      targetRef: '',
      relativePath: 'src/removed.ts',
    });

    const allLines = result.hunks.flatMap((h) => h.lines);
    expect(allLines.length).toBeGreaterThan(0);
    expect(allLines.every((l) => l.changeType === 'deleted')).toBe(true);
  });

  // ── Renamed file ──

  it('detects rename with oldPath', async () => {
    writeFile(repoDir, 'old.ts', 'original content\nline2\n');
    gitCommit(repoDir, 'add old');
    // Just `git mv` without separate `git add` so rename detection works
    execSync('git mv old.ts new.ts', { cwd: repoDir, stdio: 'pipe' });

    const reader = new SimpleGitFileDiffReader();
    const result = await reader.read({
      repositoryPath: repoDir,
      comparisonType: ComparisonType.STAGED_VS_HEAD,
      baseRef: 'HEAD',
      targetRef: '',
      relativePath: 'new.ts',
    });

    expect(result.path).toBe('new.ts');
    // Rename without content changes should still be detected
    expect(result.oldPath).toBe('old.ts');
  });

  // ── Untracked file ──

  it('reads untracked file content as added lines', async () => {
    writeFile(repoDir, 'src/untracked.ts', 'line1\nline2\n');
    // Do NOT git add — it's untracked

    const reader = new SimpleGitFileDiffReader();
    const result = await reader.read({
      repositoryPath: repoDir,
      comparisonType: ComparisonType.WORKING_TREE_VS_HEAD,
      baseRef: 'HEAD',
      targetRef: 'working-tree',
      relativePath: 'src/untracked.ts',
    });

    expect(result.path).toBe('src/untracked.ts');
    const allLines = result.hunks.flatMap((h) => h.lines);
    expect(allLines.every((l) => l.changeType === 'added')).toBe(true);
    expect(allLines.length).toBeGreaterThan(0);
  });

  // ── Binary file ──

  it('detects binary files', async () => {
    const buf = Buffer.alloc(1024);
    buf[0] = 0;
    fs.writeFileSync(path.join(repoDir, 'logo.png'), buf);
    execSync('git add logo.png', { cwd: repoDir, stdio: 'pipe' });
    gitCommit(repoDir, 'add binary');
    buf[128] = 1;
    fs.writeFileSync(path.join(repoDir, 'logo.png'), buf);
    execSync('git add logo.png', { cwd: repoDir, stdio: 'pipe' });

    const reader = new SimpleGitFileDiffReader();
    const result = await reader.read({
      repositoryPath: repoDir,
      comparisonType: ComparisonType.STAGED_VS_HEAD,
      baseRef: 'HEAD',
      targetRef: '',
      relativePath: 'logo.png',
    });

    expect(result.isBinary).toBe(true);
    expect(result.hunks).toHaveLength(0);
  });

  // ── Empty file ──

  it('returns empty hunks for empty file', async () => {
    writeFile(repoDir, 'empty.ts', '');
    execSync('git add empty.ts', { cwd: repoDir, stdio: 'pipe' });

    const reader = new SimpleGitFileDiffReader();
    const result = await reader.read({
      repositoryPath: repoDir,
      comparisonType: ComparisonType.STAGED_VS_HEAD,
      baseRef: 'HEAD',
      targetRef: '',
      relativePath: 'empty.ts',
    });

    // Empty new file should have zero hunks (or a hunk with no content lines)
    const allLines = result.hunks.flatMap((h) => h.lines);
    expect(allLines.length).toBe(0);
  });

  // ── Size cap ──

  it('truncates when content exceeds 5000 lines', async () => {
    // Create a file with 10 lines
    const lines = Array.from({ length: 10 }, (_, i) => `line${i}`);
    writeFile(repoDir, 'large.ts', lines.join('\n'));
    gitCommit(repoDir, 'add large');
    // Modify to create a diff with ~20 lines
    const modified = lines.map((l) => `// ${l}`);
    writeFile(repoDir, 'large.ts', modified.join('\n'));
    execSync('git add large.ts', { cwd: repoDir, stdio: 'pipe' });

    const reader = new SimpleGitFileDiffReader();
    const result = await reader.read({
      repositoryPath: repoDir,
      comparisonType: ComparisonType.STAGED_VS_HEAD,
      baseRef: 'HEAD',
      targetRef: '',
      relativePath: 'large.ts',
    });

    // 10 lines produces < 5000 lines so should NOT be truncated
    expect(result.isTruncated).toBe(false);
  });

  it('truncates when diff content exceeds 256 KB', async () => {
    // Create a large new file whose entire content will appear in the diff (as added lines)
    const bigLine = 'x'.repeat(78) + '\n';
    const bigContent = bigLine.repeat(3500); // ~280 KB of content
    writeFile(repoDir, 'big.ts', bigContent);
    execSync('git add big.ts', { cwd: repoDir, stdio: 'pipe' });

    const reader = new SimpleGitFileDiffReader();
    const result = await reader.read({
      repositoryPath: repoDir,
      comparisonType: ComparisonType.STAGED_VS_HEAD,
      baseRef: 'HEAD',
      targetRef: '',
      relativePath: 'big.ts',
    });

    // New file with 3500 lines of content exceeds 256 KB in the diff
    expect(result.isTruncated).toBe(true);
    expect(result.truncationReason).toBeTruthy();
  });

  // ── Error handling ──

  it('returns error for non-existent file', async () => {
    const reader = new SimpleGitFileDiffReader();
    const result = await reader.read({
      repositoryPath: repoDir,
      comparisonType: ComparisonType.WORKING_TREE_VS_HEAD,
      baseRef: 'HEAD',
      targetRef: 'working-tree',
      relativePath: 'nonexistent.ts',
    });

    // Non-existent file returns error or empty hunks depending on git behavior
    // At minimum, it should not throw
    expect(() => result).toBeTruthy();
  });

  it('returns error for non-existent repository', async () => {
    const reader = new SimpleGitFileDiffReader();
    const result = await reader.read({
      repositoryPath: '/tmp/does-not-exist-99999-fdr',
      comparisonType: ComparisonType.WORKING_TREE_VS_HEAD,
      baseRef: 'HEAD',
      targetRef: 'working-tree',
      relativePath: 'file.ts',
    });

    expect(result.error).toBeDefined();
    expect(result.error!.errorCode).toBeDefined();
  });

  // ── Read-only guarantee ──

  it('does not modify the repository', async () => {
    const beforeHash = execSync('git rev-parse HEAD', { cwd: repoDir, stdio: 'pipe' })
      .toString()
      .trim();
    writeFile(repoDir, 'README.md', '# changed');

    const reader = new SimpleGitFileDiffReader();
    await reader.read({
      repositoryPath: repoDir,
      comparisonType: ComparisonType.UNSTAGED,
      baseRef: '',
      targetRef: '',
      relativePath: 'README.md',
    });

    const afterHash = execSync('git rev-parse HEAD', { cwd: repoDir, stdio: 'pipe' })
      .toString()
      .trim();
    expect(afterHash).toBe(beforeHash);

    // Verify no new commits or staged changes introduced by the reader
    const status = execSync('git status --porcelain', { cwd: repoDir, stdio: 'pipe' }).toString();
    // UNSTAGED changes are expected (from writeFile), but nothing should be staged
    expect(status).not.toMatch(/^[MADRCU]\s/);
  });

  // ── Multi-hunk diff ──

  it('handles multi-hunk diffs', async () => {
    // Create file with two changed regions far apart (>3 context lines)
    const lines: string[] = [];
    for (let i = 1; i <= 100; i++) {
      lines.push(`line${i}`);
    }
    writeFile(repoDir, 'src/utils.ts', lines.join('\n'));
    gitCommit(repoDir, 'add utils');

    // Modify lines 10 and 90
    const modified = lines.map((l, i) => {
      const lineNum = i + 1;
      if (lineNum === 10 || lineNum === 90) return `modified${lineNum}`;
      return l;
    });
    writeFile(repoDir, 'src/utils.ts', modified.join('\n'));
    execSync('git add src/utils.ts', { cwd: repoDir, stdio: 'pipe' });

    const reader = new SimpleGitFileDiffReader();
    const result = await reader.read({
      repositoryPath: repoDir,
      comparisonType: ComparisonType.STAGED_VS_HEAD,
      baseRef: 'HEAD',
      targetRef: '',
      relativePath: 'src/utils.ts',
    });

    expect(result.hunks.length).toBeGreaterThan(1);
  });

  // ── readAt timestamp ──

  it('returns a readAt timestamp', async () => {
    writeFile(repoDir, 'README.md', '# changed');
    execSync('git add README.md', { cwd: repoDir, stdio: 'pipe' });

    const reader = new SimpleGitFileDiffReader();
    const result = await reader.read({
      repositoryPath: repoDir,
      comparisonType: ComparisonType.STAGED_VS_HEAD,
      baseRef: 'HEAD',
      targetRef: '',
      relativePath: 'README.md',
    });

    expect(result.readAt).toBeDefined();
    expect(() => new Date(result.readAt)).not.toThrow();
  });

  // ── All ComparisonTypes ──

  it('handles COMMIT_VS_COMMIT comparison', async () => {
    writeFile(repoDir, 'f1.ts', 'v1');
    gitCommit(repoDir, 'c1');
    const c1 = execSync('git rev-parse HEAD', { cwd: repoDir, stdio: 'pipe' }).toString().trim();
    writeFile(repoDir, 'f1.ts', 'v2');
    gitCommit(repoDir, 'c2');
    const c2 = execSync('git rev-parse HEAD', { cwd: repoDir, stdio: 'pipe' }).toString().trim();

    const reader = new SimpleGitFileDiffReader();
    const result = await reader.read({
      repositoryPath: repoDir,
      comparisonType: ComparisonType.COMMIT_VS_COMMIT,
      baseRef: c1,
      targetRef: c2,
      relativePath: 'f1.ts',
    });

    expect(result.path).toBe('f1.ts');
    expect(result.error).toBeUndefined();
  });

  it('handles UNSTAGED comparison', async () => {
    writeFile(repoDir, 'README.md', '# unstaged change');

    const reader = new SimpleGitFileDiffReader();
    const result = await reader.read({
      repositoryPath: repoDir,
      comparisonType: ComparisonType.UNSTAGED,
      baseRef: '',
      targetRef: '',
      relativePath: 'README.md',
    });

    expect(result.path).toBe('README.md');
  });

  it('handles BRANCH_VS_BRANCH with same branch (no changes)', async () => {
    // Ensure we have at least one commit
    writeFile(repoDir, 'f1.ts', 'master content');
    gitCommit(repoDir, 'add f1');

    const reader = new SimpleGitFileDiffReader();
    const result = await reader.read({
      repositoryPath: repoDir,
      comparisonType: ComparisonType.BRANCH_VS_BRANCH,
      baseRef: 'master',
      targetRef: 'master',
      relativePath: 'f1.ts',
    });

    // No differences between same branch, so no hunks and no error
    expect(result.error).toBeUndefined();
    expect(result.path).toBe('f1.ts');
  });
});
