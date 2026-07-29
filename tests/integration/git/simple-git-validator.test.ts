import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SimpleGitValidator } from '../../../src/lib/server/infrastructure/git/simple-git-validator';

function mkTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'diffscribe-test-'));
  return dir;
}

function gitInit(dir: string): void {
  execSync('git init', { cwd: dir, stdio: 'pipe' });
}

function rmDir(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

describe('SimpleGitValidator (integration)', () => {
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

  it('validates a valid Git root path', async () => {
    const validator = new SimpleGitValidator();
    const result = await validator.validate(gitRepo);
    expect(result.isValid).toBe(true);
    expect(result.isRoot).toBe(true);
  });

  it('rejects a path that does not exist', async () => {
    const validator = new SimpleGitValidator();
    const result = await validator.validate('/tmp/does-not-exist-99999');
    expect(result.isValid).toBe(false);
  });

  it('rejects a path that exists but is not a Git repo', async () => {
    const nonGitDir = path.join(tempRoot, 'not-repo');
    fs.mkdirSync(nonGitDir);
    const validator = new SimpleGitValidator();
    const result = await validator.validate(nonGitDir);
    expect(result.isValid).toBe(false);
  });

  it('rejects a subdirectory of a Git repo', async () => {
    const subDir = path.join(gitRepo, 'src');
    fs.mkdirSync(subDir);
    const validator = new SimpleGitValidator();
    const result = await validator.validate(subDir);
    expect(result.isValid).toBe(true);
    expect(result.isRoot).toBe(false);
  });

  it('provides error message for non-existent path', async () => {
    const validator = new SimpleGitValidator();
    const result = await validator.validate('/tmp/nowhere');
    expect(result.error).toBeTruthy();
  });
});
