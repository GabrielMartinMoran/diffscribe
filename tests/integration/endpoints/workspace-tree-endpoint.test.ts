import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createWorkspaceServices } from '../../../src/lib/server/composition/workspace-services';
import { runMigrations } from '../../../src/lib/server/infrastructure/database/connection';

function mkTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'diffscribe-tree-uc-'));
}

function createGitRepo(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
  execSync('git init', { cwd: dir, stdio: 'pipe' });
  execSync('git config user.email "test@test.com"', { cwd: dir, stdio: 'pipe' });
  execSync('git config user.name "Test"', { cwd: dir, stdio: 'pipe' });
}

function rmDir(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

function addAndCommit(dir: string, message: string): void {
  execSync('git add .', { cwd: dir, stdio: 'pipe' });
  execSync(`git commit -m "${message}"`, { cwd: dir, stdio: 'pipe' });
}

describe('Workspace tree endpoint integration', () => {
  let db: Database.Database;
  let tempRoot: string;
  let repoDir: string;
  beforeEach(async () => {
    db = new Database(':memory:');
    db.pragma('journal_mode = WAL');
    runMigrations(db);

    tempRoot = mkTempDir();
    repoDir = path.join(tempRoot, 'repo');
    createGitRepo(repoDir);

    const services = createWorkspaceServices(db);
    await services.registerUseCase.execute({
      repositoryPath: repoDir,
      displayName: 'Tree Test',
    });
  });

  afterEach(() => {
    db.close();
    rmDir(tempRoot);
  });

  it('returns empty tree for empty repository', async () => {
    const services = createWorkspaceServices(db);

    const result = await services.getWorkspaceTreeUseCase.execute(repoDir);

    expect(result.tree).toBeDefined();
    expect(Array.isArray(result.tree)).toBe(true);
    expect(result.tree).toHaveLength(0);
    expect(result.readAt).toBeDefined();
    expect(result.error).toBeUndefined();
  });

  it('returns tree with files at root level', async () => {
    fs.writeFileSync(path.join(repoDir, 'README.md'), '# test');
    fs.writeFileSync(path.join(repoDir, 'index.js'), 'console.log("hello");');
    addAndCommit(repoDir, 'init');

    const services = createWorkspaceServices(db);
    const result = await services.getWorkspaceTreeUseCase.execute(repoDir);

    expect(result.tree).toBeDefined();
    expect(result.error).toBeUndefined();
    // Should have 2 file entries (no directories since these are root files)
    const rootFiles = result.tree.filter((n) => n.kind === 'file');
    expect(rootFiles).toHaveLength(2);
    expect(rootFiles.map((n) => n.name).sort()).toEqual(['README.md', 'index.js']);
  });

  it('returns tree with nested directories', async () => {
    fs.mkdirSync(path.join(repoDir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(repoDir, 'src', 'index.ts'), 'export const x = 1;');
    fs.writeFileSync(path.join(repoDir, 'src', 'utils.ts'), 'export const util = () => {};');
    fs.mkdirSync(path.join(repoDir, 'src', 'components'), { recursive: true });
    fs.writeFileSync(
      path.join(repoDir, 'src', 'components', 'Button.tsx'),
      'export const Button = () => <button />;',
    );
    addAndCommit(repoDir, 'init');

    const services = createWorkspaceServices(db);
    const result = await services.getWorkspaceTreeUseCase.execute(repoDir);

    expect(result.error).toBeUndefined();
    expect(result.tree).toBeDefined();

    // Should have a src directory
    const srcDir = result.tree.find((n) => n.name === 'src' && n.kind === 'directory');
    expect(srcDir).toBeDefined();
    expect(srcDir!.children).toBeDefined();
    expect(srcDir!.children).toHaveLength(3); // index.ts, utils.ts, + components dir

    const indexTs = srcDir!.children!.find((n) => n.name === 'index.ts');
    expect(indexTs).toBeDefined();
    expect(indexTs!.kind).toBe('file');
    expect(indexTs!.path).toBe('src/index.ts');

    // Check nested components directory
    const componentsDir = srcDir!.children!.find(
      (n) => n.name === 'components' && n.kind === 'directory',
    );
    expect(componentsDir).toBeDefined();
    expect(componentsDir!.children).toBeDefined();
    expect(componentsDir!.children).toHaveLength(1);
    expect(componentsDir!.children![0].name).toBe('Button.tsx');
  });

  it('includes untracked files', async () => {
    fs.writeFileSync(path.join(repoDir, 'tracked.txt'), 'tracked');
    addAndCommit(repoDir, 'init');
    // Add untracked file
    fs.writeFileSync(path.join(repoDir, 'untracked.txt'), 'untracked');

    const services = createWorkspaceServices(db);
    const result = await services.getWorkspaceTreeUseCase.execute(repoDir);

    expect(result.error).toBeUndefined();

    const untracked = result.tree.find((n) => n.name === 'untracked.txt');
    expect(untracked).toBeDefined();
    expect(untracked!.tracked).toBe(false);
  });

  it('excludes git-ignored files', async () => {
    fs.writeFileSync(path.join(repoDir, '.gitignore'), 'node_modules/\n');
    fs.mkdirSync(path.join(repoDir, 'node_modules'), { recursive: true });
    fs.writeFileSync(path.join(repoDir, 'node_modules', 'dep.js'), 'module.exports = {};');
    fs.writeFileSync(path.join(repoDir, 'valid.txt'), 'valid');
    addAndCommit(repoDir, 'init');

    const services = createWorkspaceServices(db);
    const result = await services.getWorkspaceTreeUseCase.execute(repoDir);

    expect(result.error).toBeUndefined();

    const ignored = result.tree.find((n) => n.name === 'node_modules');
    expect(ignored).toBeUndefined();

    const valid = result.tree.find((n) => n.name === 'valid.txt');
    expect(valid).toBeDefined();
  });

  it('returns error for missing workspace path', async () => {
    const services = createWorkspaceServices(db);
    const ws = await services.getUseCase.execute({ id: 'non-existent-id' });
    expect(ws.workspace).toBeNull();
  });

  it('returns error for non-git directory', async () => {
    const nonGitDir = path.join(tempRoot, 'non-git-repo');
    fs.mkdirSync(nonGitDir, { recursive: true });
    fs.writeFileSync(path.join(nonGitDir, 'file.txt'), 'content');

    const services = createWorkspaceServices(db);
    const result = await services.getWorkspaceTreeUseCase.execute(nonGitDir);

    expect(result.error).toBeDefined();
    expect(result.tree).toEqual([]);
  });

  it('returns deterministic ordering of tree entries', async () => {
    fs.mkdirSync(path.join(repoDir, 'b_dir'), { recursive: true });
    fs.writeFileSync(path.join(repoDir, 'b_dir', 'file2.txt'), 'content');
    fs.writeFileSync(path.join(repoDir, 'a_file.txt'), 'content');
    fs.writeFileSync(path.join(repoDir, 'c_file.txt'), 'content');
    fs.mkdirSync(path.join(repoDir, 'a_dir'), { recursive: true });
    fs.writeFileSync(path.join(repoDir, 'a_dir', 'file1.txt'), 'content');
    addAndCommit(repoDir, 'init');

    const services = createWorkspaceServices(db);
    const result = await services.getWorkspaceTreeUseCase.execute(repoDir);

    expect(result.error).toBeUndefined();

    // Directories should come first, then files, alphabetically
    const names = result.tree.map((n) => n.name);
    expect(names).toEqual(['a_dir', 'b_dir', 'a_file.txt', 'c_file.txt']);
  });

  it('readAt is a valid ISO timestamp', async () => {
    fs.writeFileSync(path.join(repoDir, 'README.md'), '# test');
    addAndCommit(repoDir, 'init');

    const services = createWorkspaceServices(db);
    const result = await services.getWorkspaceTreeUseCase.execute(repoDir);

    expect(result.readAt).toBeDefined();
    expect(() => new Date(result.readAt)).not.toThrow();
    expect(new Date(result.readAt).toISOString()).toBe(result.readAt);
  });
});
