import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

function mkTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'diffscribe-test-fse-'));
}

function gitInit(dir: string): void {
  execSync('git init', { cwd: dir, stdio: 'pipe' });
  execSync('git config user.email "test@test.com"', { cwd: dir, stdio: 'pipe' });
  execSync('git config user.name "Test"', { cwd: dir, stdio: 'pipe' });
}

function rmDir(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

describe('File Source endpoint (integration)', () => {
  let tempDir: string;
  let repoDir: string;
  let baseUrl: string;

  beforeEach(async () => {
    tempDir = mkTempDir();
    repoDir = path.join(tempDir, 'repo');
    fs.mkdirSync(repoDir);
    gitInit(repoDir);
    fs.writeFileSync(path.join(repoDir, 'README.md'), '# e2e\n');
    execSync('git add . && git commit -m "init"', { cwd: repoDir, stdio: 'pipe' });

    const appUrl = process.env.DIFFSCRIBE_TEST_URL ?? '';
    baseUrl = appUrl;
  });

  afterEach(() => {
    rmDir(tempDir);
  });

  it('rejects requests to workspace that does not exist', async () => {
    if (!baseUrl) return;
    const comparison = JSON.stringify({
      base: { type: 'head', value: 'HEAD' },
      target: { type: 'working-tree', value: 'working-tree' },
      comparisonType: 'working-tree-vs-head',
    });
    const encodedComparison = encodeURIComponent(comparison);
    const encodedPath = encodeURIComponent('README.md');

    const response = await fetch(
      `${baseUrl}/api/workspaces/nonexistent-id/source?comparison=${encodedComparison}&path=${encodedPath}`,
    );
    expect(response.status).toBe(404);
  });

  it('rejects missing comparison parameter', async () => {
    if (!baseUrl) return;
    const encodedPath = encodeURIComponent('README.md');

    const response = await fetch(
      `${baseUrl}/api/workspaces/nonexistent-id/source?path=${encodedPath}`,
    );
    expect(response.status).toBe(400);
  });

  it('rejects missing path parameter', async () => {
    if (!baseUrl) return;
    const comparison = JSON.stringify({
      base: { type: 'head', value: 'HEAD' },
      target: { type: 'working-tree', value: 'working-tree' },
      comparisonType: 'working-tree-vs-head',
    });
    const encodedComparison = encodeURIComponent(comparison);

    const response = await fetch(
      `${baseUrl}/api/workspaces/nonexistent-id/source?comparison=${encodedComparison}`,
    );
    expect(response.status).toBe(400);
  });

  it('rejects absolute paths (path traversal)', async () => {
    if (!baseUrl) return;
    const comparison = JSON.stringify({
      base: { type: 'head', value: 'HEAD' },
      target: { type: 'working-tree', value: 'working-tree' },
      comparisonType: 'working-tree-vs-head',
    });
    const encodedComparison = encodeURIComponent(comparison);
    const encodedPath = encodeURIComponent('/etc/passwd');

    const response = await fetch(
      `${baseUrl}/api/workspaces/some-id/source?comparison=${encodedComparison}&path=${encodedPath}`,
    );
    expect(response.status).toBe(400);
  });

  it('rejects path traversal with ..', async () => {
    if (!baseUrl) return;
    const comparison = JSON.stringify({
      base: { type: 'head', value: 'HEAD' },
      target: { type: 'working-tree', value: 'working-tree' },
      comparisonType: 'working-tree-vs-head',
    });
    const encodedComparison = encodeURIComponent(comparison);
    const encodedPath = encodeURIComponent('../../etc/passwd');

    const response = await fetch(
      `${baseUrl}/api/workspaces/some-id/source?comparison=${encodedComparison}&path=${encodedPath}`,
    );
    expect(response.status).toBe(400);
  });
});
