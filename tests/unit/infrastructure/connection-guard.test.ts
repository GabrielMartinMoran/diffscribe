import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The connection module has module-level DB_DIR/DB_PATH evaluated at import time.
// We use vi.resetModules() + dynamic import to force re-evaluation with new env vars.
// The RED→GREEN step moves DB_DIR resolution inside getDb() so env changes take effect.

const MODULE_PATH = '../../../src/lib/server/infrastructure/database/connection';

describe('DB connection guard — Vitest fail‑closed', () => {
  const originalVitest = process.env.VITEST;
  const originalDbDir = process.env.DIFFSCRIBE_DB_DIR;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalInMemoryDb = process.env.DIFFSCRIBE_E2E_IN_MEMORY_DB;

  beforeEach(() => {
    // Reset the module graph so dynamic imports re-evaluate module-level code
    vi.resetModules();
    if (!process.env.VITEST) {
      process.env.VITEST = 'true';
    }
    delete process.env.DIFFSCRIBE_DB_DIR;
    delete process.env.NODE_ENV;
    delete process.env.DIFFSCRIBE_E2E_IN_MEMORY_DB;
  });

  afterEach(() => {
    if (originalVitest === undefined) {
      delete process.env.VITEST;
    } else {
      process.env.VITEST = originalVitest;
    }
    if (originalDbDir === undefined) {
      delete process.env.DIFFSCRIBE_DB_DIR;
    } else {
      process.env.DIFFSCRIBE_DB_DIR = originalDbDir;
    }
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
    if (originalInMemoryDb === undefined) {
      delete process.env.DIFFSCRIBE_E2E_IN_MEMORY_DB;
    } else {
      process.env.DIFFSCRIBE_E2E_IN_MEMORY_DB = originalInMemoryDb;
    }
  });

  it('throws descriptive error when VITEST is set and DIFFSCRIBE_DB_DIR is absent', async () => {
    expect(process.env.VITEST).toBe('true');
    expect(process.env.DIFFSCRIBE_DB_DIR).toBeUndefined();

    const mod = await import(MODULE_PATH);
    expect(() => mod.getDb()).toThrow(/DIFFSCRIBE_DB_DIR must be set when running under Vitest/i);
  });

  it('permits connection when VITEST is set and DIFFSCRIBE_DB_DIR is a safe temp directory', async () => {
    const tmpDir = path.join(os.tmpdir(), `diffscribe-guard-${Date.now()}`);
    process.env.DIFFSCRIBE_DB_DIR = tmpDir;

    const mod = await import(MODULE_PATH);
    let openedDb: ReturnType<typeof mod.getDb> | null = null;
    try {
      expect(() => {
        openedDb = mod.getDb();
      }).not.toThrow();
      expect(openedDb).toBeDefined();
    } finally {
      openedDb?.close();
    }
  });

  it('does not throw when VITEST is NOT set (production‑like mode)', async () => {
    delete process.env.VITEST;
    expect(process.env.VITEST).toBeUndefined();

    const tmpDir = path.join(os.tmpdir(), `diffscribe-prod-${Date.now()}`);
    process.env.DIFFSCRIBE_DB_DIR = tmpDir;

    const mod = await import(MODULE_PATH);
    let openedDb: ReturnType<typeof mod.getDb> | null = null;
    try {
      expect(() => {
        openedDb = mod.getDb();
      }).not.toThrow();
      expect(openedDb).toBeDefined();
    } finally {
      openedDb?.close();
    }
  });

  it('returns :memory: when DIFFSCRIBE_E2E_IN_MEMORY_DB is set to "1"', async () => {
    process.env.DIFFSCRIBE_E2E_IN_MEMORY_DB = '1';
    delete process.env.DIFFSCRIBE_DB_DIR;

    const mod = await import(MODULE_PATH);
    let openedDb: ReturnType<typeof mod.getDb> | null = null;
    try {
      openedDb = mod.getDb();
      expect(openedDb.name).toBe(':memory:');
    } finally {
      openedDb?.close();
    }
  });

  it('returns the same singleton on repeated getDb() calls in memory mode', async () => {
    process.env.DIFFSCRIBE_E2E_IN_MEMORY_DB = '1';

    const mod = await import(MODULE_PATH);
    const db1 = mod.getDb();
    const db2 = mod.getDb();
    try {
      expect(db1).toBe(db2);
      expect(db1.name).toBe(':memory:');
    } finally {
      db1.close();
    }
  });

  it('enables foreign_keys pragma in memory mode', async () => {
    process.env.DIFFSCRIBE_E2E_IN_MEMORY_DB = '1';

    const mod = await import(MODULE_PATH);
    const db = mod.getDb();
    try {
      const result = db.pragma('foreign_keys', { simple: true });
      expect(result).toBe(1);
    } finally {
      db.close();
    }
  });

  it('throws when DIFFSCRIBE_E2E_IN_MEMORY_DB is set and NODE_ENV is production', async () => {
    process.env.DIFFSCRIBE_E2E_IN_MEMORY_DB = '1';
    process.env.NODE_ENV = 'production';

    const mod = await import(MODULE_PATH);
    expect(() => mod.getDb()).toThrow(/not allowed in production/i);
  });
});
