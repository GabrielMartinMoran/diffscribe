import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { Given, Then, When } from 'quickpickle';
import { expect, vi } from 'vitest';

interface IsolationWorld {
  tempDir?: string;
  error?: Error;
  dbPath?: string;
  originalVitest?: string;
  originalDbDir?: string;
  connectionModule?: typeof import('$lib/server/infrastructure/database/connection');
}

const MODULE_PATH = '../../src/lib/server/infrastructure/database/connection';

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
    db.close();
  } catch (e) {
    world.error = e as Error;
  }
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
