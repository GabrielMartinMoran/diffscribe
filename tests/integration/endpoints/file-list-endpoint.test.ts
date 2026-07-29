import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createWorkspaceServices } from '../../../src/lib/server/composition/workspace-services';
import type { ComparisonSerialized } from '../../../src/lib/server/domain/value-objects/comparison';
import {
  Comparison,
  ComparisonType,
} from '../../../src/lib/server/domain/value-objects/comparison';
import { GitRef } from '../../../src/lib/server/domain/value-objects/git-ref';
import { runMigrations } from '../../../src/lib/server/infrastructure/database/connection';

function mkTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'diffscribe-flr-uc-'));
}

function createGitRepo(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
  execSync('git init', { cwd: dir, stdio: 'pipe' });
  execSync('git config user.email "test@test.com"', { cwd: dir, stdio: 'pipe' });
  execSync('git config user.name "Test"', { cwd: dir, stdio: 'pipe' });
  fs.writeFileSync(path.join(dir, 'README.md'), '# test');
  execSync('git add .', { cwd: dir, stdio: 'pipe' });
  execSync('git commit -m "init"', { cwd: dir, stdio: 'pipe' });
}

function rmDir(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

// Helper to parse and validate a comparison from URL params (simulating endpoint validation)
function validateComparison(raw: string): Comparison | null {
  const VALID_COMPARISON_TYPES = Object.values(ComparisonType) as string[];
  const VALID_REF_TYPES = ['branch', 'commit', 'head', 'working-tree', 'index'];

  try {
    const parsed = JSON.parse(raw) as ComparisonSerialized;
    if (!parsed || typeof parsed !== 'object') return null;
    if (!parsed.base || !parsed.target || !parsed.comparisonType) return null;
    if (!VALID_COMPARISON_TYPES.includes(parsed.comparisonType)) return null;
    if (!VALID_REF_TYPES.includes(parsed.base.type)) return null;
    if (!VALID_REF_TYPES.includes(parsed.target.type)) return null;
    if (typeof parsed.base.value !== 'string' || parsed.base.value.trim() === '') return null;
    if (typeof parsed.target.value !== 'string' || parsed.target.value.trim() === '') return null;

    return new Comparison({
      base: new GitRef(
        parsed.base.type as 'branch' | 'commit' | 'head' | 'working-tree' | 'index',
        parsed.base.value,
      ),
      target: new GitRef(
        parsed.target.type as 'branch' | 'commit' | 'head' | 'working-tree' | 'index',
        parsed.target.value,
      ),
      comparisonType: parsed.comparisonType as ComparisonType,
    });
  } catch {
    return null;
  }
}

const validComparisonJson = JSON.stringify({
  base: { type: 'head', value: 'HEAD', label: 'HEAD' },
  target: { type: 'working-tree', value: 'working-tree', label: 'working tree' },
  comparisonType: 'working-tree-vs-head',
  createdAt: new Date().toISOString(),
});

describe('File list endpoint validation logic', () => {
  let db: Database.Database;
  let tempRoot: string;
  let repoDir: string;
  let workspaceId: string;

  beforeEach(async () => {
    db = new Database(':memory:');
    db.pragma('journal_mode = WAL');
    runMigrations(db);

    tempRoot = mkTempDir();
    repoDir = path.join(tempRoot, 'repo');
    createGitRepo(repoDir);

    const services = createWorkspaceServices(db);
    const result = await services.registerUseCase.execute({
      repositoryPath: repoDir,
      displayName: 'Endpoint Test',
    });
    workspaceId = result.workspace.id;
    services.appState.set('active_workspace_id', workspaceId);
  });

  afterEach(() => {
    db.close();
    rmDir(tempRoot);
  });

  it('getFileListUseCase returns entries for valid comparison', async () => {
    const services = createWorkspaceServices(db);
    const comparison = validateComparison(validComparisonJson);
    expect(comparison).not.toBeNull();

    const ws = await services.getUseCase.execute({ id: workspaceId });
    expect(ws.workspace).not.toBeNull();

    const result = await services.getFileListUseCase.execute(
      ws.workspace!.repositoryPath,
      comparison!,
    );
    expect(result.entries).toBeDefined();
    expect(Array.isArray(result.entries)).toBe(true);
    expect(result.readAt).toBeDefined();
    expect(result.error).toBeUndefined();
  });

  it('returns error for non-existent workspace', async () => {
    const services = createWorkspaceServices(db);
    const ws = await services.getUseCase.execute({ id: 'non-existent-id' });
    expect(ws.workspace).toBeNull();
  });

  it('rejects missing comparison parameter', () => {
    const comparison = validateComparison('');
    expect(comparison).toBeNull();
  });

  it('rejects malformed JSON', () => {
    const comparison = validateComparison('not-json');
    expect(comparison).toBeNull();
  });

  it('rejects invalid comparisonType enum', () => {
    const badJson = JSON.stringify({
      base: { type: 'head', value: 'HEAD', label: 'HEAD' },
      target: { type: 'working-tree', value: 'working-tree', label: 'working tree' },
      comparisonType: 'INVALID_TYPE',
      createdAt: new Date().toISOString(),
    });
    const comparison = validateComparison(badJson);
    expect(comparison).toBeNull();
  });

  it('rejects missing base field', () => {
    const badJson = JSON.stringify({
      target: { type: 'working-tree', value: 'working-tree', label: 'working tree' },
      comparisonType: 'working-tree-vs-head',
      createdAt: new Date().toISOString(),
    });
    const comparison = validateComparison(badJson);
    expect(comparison).toBeNull();
  });

  it('rejects invalid ref type', () => {
    const badJson = JSON.stringify({
      base: { type: 'HEAD', value: 'main', label: 'main' },
      target: { type: 'working-tree', value: 'working-tree', label: 'working tree' },
      comparisonType: 'branch-vs-working-tree',
      createdAt: new Date().toISOString(),
    });
    const comparison = validateComparison(badJson);
    expect(comparison).toBeNull();
  });
});
