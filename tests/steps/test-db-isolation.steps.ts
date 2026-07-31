import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type Database from 'better-sqlite3';
import { Given, Then, When } from 'quickpickle';
import { afterEach, beforeEach, expect, vi } from 'vitest';

interface IsolationWorld {
  tempDir?: string;
  error?: Error;
  dbPath?: string;
  originalVitest?: string;
  originalDbDir?: string;
  connectionModule?: typeof import('$lib/server/infrastructure/database/connection');
  firstDb?: Database.Database;
  secondDb?: Database.Database;
  openedDb?: Database.Database;
}

const MODULE_PATH = '../../src/lib/server/infrastructure/database/connection';

// Module-level env backup for cleanup between scenarios
let _savedVars: Record<string, string | undefined> = {};

beforeEach(() => {
  _savedVars = {
    VITEST: process.env.VITEST,
    DIFFSCRIBE_DB_DIR: process.env.DIFFSCRIBE_DB_DIR,
    NODE_ENV: process.env.NODE_ENV,
    DIFFSCRIBE_E2E_IN_MEMORY_DB: process.env.DIFFSCRIBE_E2E_IN_MEMORY_DB,
  };
});

afterEach(() => {
  // Restore env vars that might have been modified
  for (const [key, value] of Object.entries(_savedVars)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

Given('the Vitest test environment is active', (world: IsolationWorld) => {
  world.originalVitest = process.env.VITEST;
  world.originalDbDir = process.env.DIFFSCRIBE_DB_DIR;
});

When('DIFFSCRIBE_DB_DIR is absent', (_world: IsolationWorld) => {
  void _world;
  process.env.VITEST = 'true';
  delete process.env.DIFFSCRIBE_DB_DIR;
});

When('VITEST is not set', (_world: IsolationWorld) => {
  void _world;
  delete process.env.VITEST;
});

When('VITEST is set', (_world: IsolationWorld) => {
  void _world;
  process.env.VITEST = 'true';
});

When('a safe temp DIFFSCRIBE_DB_DIR is provided', (world: IsolationWorld) => {
  world.tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'diffscribe-bdd-'));
  process.env.DIFFSCRIBE_DB_DIR = world.tempDir;
});

When('getDb is called', async (world: IsolationWorld) => {
  vi.resetModules();
  try {
    const mod = (await import(
      MODULE_PATH
    )) as typeof import('$lib/server/infrastructure/database/connection');
    world.connectionModule = mod;
    const db = mod.getDb();
    world.dbPath = db.name;
    world.openedDb = db;
  } catch (e) {
    world.error = e as Error;
  }
});

When('getDb is called twice', async (world: IsolationWorld) => {
  vi.resetModules();
  try {
    const mod = (await import(
      MODULE_PATH
    )) as typeof import('$lib/server/infrastructure/database/connection');
    world.connectionModule = mod;
    world.firstDb = mod.getDb();
    world.secondDb = mod.getDb();
    world.dbPath = world.firstDb.name;
    world.openedDb = world.firstDb;
  } catch (e) {
    world.error = e as Error;
  }
});

When('DIFFSCRIBE_E2E_IN_MEMORY_DB is set to {string}', (_world: IsolationWorld, value: string) => {
  void _world;
  process.env.DIFFSCRIBE_E2E_IN_MEMORY_DB = value;
});

When('NODE_ENV is set to {string}', (_world: IsolationWorld, value: string) => {
  void _world;
  process.env.NODE_ENV = value;
});

Then(
  'an error is thrown with message containing {string}',
  (world: IsolationWorld, expected: string) => {
    expect(world.error).toBeDefined();
    expect(world.error!.message).toContain(expected);
  },
);

Then('the database connection succeeds without error', (world: IsolationWorld) => {
  expect(world.error).toBeUndefined();
  expect(world.dbPath).toBeDefined();
});

Then('the database path is under the configured temp directory', (world: IsolationWorld) => {
  const dbDir = path.dirname(world.dbPath!);
  const expected = world.tempDir!;
  expect(fs.realpathSync(dbDir)).toBe(fs.realpathSync(expected));
});

Then('the database connection is in-memory', (world: IsolationWorld) => {
  expect(world.error).toBeUndefined();
  expect(world.dbPath).toBe(':memory:');
});

Then('both calls return the same database instance', (world: IsolationWorld) => {
  expect(world.error).toBeUndefined();
  expect(world.firstDb).toBeDefined();
  expect(world.secondDb).toBeDefined();
  expect(world.firstDb).toBe(world.secondDb);
});

Then('foreign keys are enabled', (world: IsolationWorld) => {
  expect(world.error).toBeUndefined();
  expect(world.openedDb).toBeDefined();
  const result = world.openedDb!.pragma('foreign_keys', { simple: true });
  expect(result).toBe(1);
});

// --- @reset step definitions ---

When(
  'the test database singleton is seeded with app_state and workspaces',
  async (world: IsolationWorld) => {
    vi.resetModules();
    const mod = (await import(
      MODULE_PATH
    )) as typeof import('$lib/server/infrastructure/database/connection');
    world.connectionModule = mod;
    const db = mod.getDb();
    mod.runMigrations(db);
    world.openedDb = db;
    world.dbPath = db.name;

    // Insert test data
    db.prepare("INSERT INTO app_state (key, value) VALUES ('e2e-key', 'e2e-val')").run();
    db.prepare(
      "INSERT INTO workspaces (id, display_name, repository_path, created_at, last_opened_at) VALUES ('reset-ws', 'Reset WS', '/tmp/reset', '2024-01-01', '2024-01-01')",
    ).run();
  },
);

When('the in-memory singleton is reset', (world: IsolationWorld) => {
  try {
    world.connectionModule!.resetInMemoryDb();
  } catch (e) {
    world.error = e as Error;
  }
});

When('the in-memory singleton is reset before getDb', async (world: IsolationWorld) => {
  vi.resetModules();
  try {
    const mod = (await import(
      MODULE_PATH
    )) as typeof import('$lib/server/infrastructure/database/connection');
    world.connectionModule = mod;
    mod.resetInMemoryDb();
    // After lazy-init, capture the singleton reference for subsequent assertions
    world.openedDb = mod.getDb();
    world.dbPath = world.openedDb.name;
  } catch (e) {
    world.error = e as Error;
  }
});

Then('the in-memory reset succeeds', (world: IsolationWorld) => {
  expect(world.error).toBeUndefined();
});

Then('the database has no app_state or workspaces rows', (world: IsolationWorld) => {
  expect(world.error).toBeUndefined();
  const db = world.openedDb!;
  const appStateCount = (
    db.prepare('SELECT COUNT(*) as cnt FROM app_state').get() as { cnt: number }
  ).cnt;
  expect(appStateCount).toBe(0);
  const workspaceCount = (
    db.prepare('SELECT COUNT(*) as cnt FROM workspaces').get() as { cnt: number }
  ).cnt;
  expect(workspaceCount).toBe(0);
});

Then('the _migrations table is preserved', (world: IsolationWorld) => {
  expect(world.error).toBeUndefined();
  const db = world.openedDb!;
  const migrationCount = (
    db.prepare('SELECT COUNT(*) as cnt FROM _migrations').get() as { cnt: number }
  ).cnt;
  expect(migrationCount).toBeGreaterThan(0);

  // Schema is intact: can re-insert
  db.prepare("INSERT INTO app_state (key, value) VALUES ('post-reset', 'yes')").run();
  const val = (
    db.prepare("SELECT value FROM app_state WHERE key = 'post-reset'").get() as { value: string }
  ).value;
  expect(val).toBe('yes');
});
