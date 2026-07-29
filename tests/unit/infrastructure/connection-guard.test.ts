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

  beforeEach(() => {
    // Reset the module graph so dynamic imports re-evaluate module-level code
    vi.resetModules();
    if (!process.env.VITEST) {
      process.env.VITEST = 'true';
    }
    delete process.env.DIFFSCRIBE_DB_DIR;
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
});
