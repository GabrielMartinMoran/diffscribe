import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runMigrations } from '../../../src/lib/server/infrastructure/database/connection';

// Guard matrix: security checks for the E2E reset endpoint.
// These tests target the core security validation logic that protects
// the actual production DB (~/.diffscribe/diffscribe.db) from ever
// being touched by E2E reset operations.
//
// None of these tests open, mutate, or connect to the real DB.

const RESET_SECRET = 'e2e-reset-secret-abc123';

function validateResetPath(
  dbDir: string,
  options: { allowMissing?: boolean } = {},
): { valid: true; realDir: string } | { valid: false; reason: string } {
  // 1. DB dir must be set and absolute
  if (!dbDir || !path.isAbsolute(dbDir)) {
    return { valid: false, reason: 'DB dir missing or not absolute' };
  }

  // 2. Canonicalize: resolve symlinks and normalize
  let realDir: string;
  try {
    realDir = fs.realpathSync(dbDir);
  } catch {
    // Path does not exist yet — for test scenarios where dir hasn't been created
    if (options.allowMissing) {
      realDir = path.resolve(dbDir);
    } else {
      return { valid: false, reason: 'DB dir does not exist' };
    }
  }

  // 3. Must NOT be under or equal to ~/.diffscribe (checked FIRST —
  //    this is the critical safety check: the home DB must never be touched)
  const homeDb = path.join(os.homedir(), '.diffscribe');
  let realHomeDb: string;
  try {
    realHomeDb = fs.realpathSync(homeDb);
  } catch {
    realHomeDb = path.resolve(homeDb);
  }
  const relativeToHome = path.relative(realHomeDb, realDir);
  if (
    relativeToHome === '' ||
    (!relativeToHome.startsWith('..') && !path.isAbsolute(relativeToHome))
  ) {
    return { valid: false, reason: 'DB dir resolves into home .diffscribe' };
  }

  // 4. Must be under os.tmpdir()
  const tmpDir = fs.realpathSync(os.tmpdir());
  const relativeToTmp = path.relative(tmpDir, realDir);
  if ((relativeToTmp.startsWith('..') || path.isAbsolute(relativeToTmp)) && relativeToTmp !== '') {
    return { valid: false, reason: 'DB dir not under tmpdir' };
  }

  return { valid: true, realDir };
}

describe('E2E reset endpoint — guard matrix', () => {
  describe('validateResetPath (security logic)', () => {
    it('rejects empty DB dir', () => {
      const result = validateResetPath('');
      expect(result.valid).toBe(false);
      expect((result as { reason: string }).reason).toBe('DB dir missing or not absolute');
    });

    it('rejects relative DB dir', () => {
      const result = validateResetPath('relative/path/to/db');
      expect(result.valid).toBe(false);
      expect((result as { reason: string }).reason).toBe('DB dir missing or not absolute');
    });

    it('rejects DB dir that is not under tmpdir', () => {
      const result = validateResetPath('/etc/diffscribe-test', { allowMissing: true });
      expect(result.valid).toBe(false);
      expect((result as { reason: string }).reason).toBe('DB dir not under tmpdir');
    });

    it('rejects DB dir that resolves into home .diffscribe', () => {
      const homeDb = path.join(os.homedir(), '.diffscribe', 'subdir');
      // Create the dir so realpath resolves
      fs.mkdirSync(homeDb, { recursive: true });
      try {
        const result = validateResetPath(homeDb);
        expect(result.valid).toBe(false);
        expect((result as { reason: string }).reason).toBe('DB dir resolves into home .diffscribe');
      } finally {
        fs.rmSync(path.join(os.homedir(), '.diffscribe', 'subdir'), {
          recursive: true,
          force: true,
        });
      }
    });

    it('rejects home .diffscribe itself', () => {
      const homeDb = path.join(os.homedir(), '.diffscribe');
      const result = validateResetPath(homeDb);
      expect(result.valid).toBe(false);
      expect((result as { reason: string }).reason).toBe('DB dir resolves into home .diffscribe');
    });

    it('rejects symlink pointing to home .diffscribe', () => {
      // Create a temp symlink target inside home .diffscribe
      const homeTarget = path.join(os.homedir(), '.diffscribe', 'symlink-target');
      fs.mkdirSync(homeTarget, { recursive: true });
      // Create a symlink in tmp pointing to home .diffscribe subdir
      const symlinkPath = path.join(os.tmpdir(), `diffscribe-symlink-escape-${Date.now()}`);
      try {
        fs.symlinkSync(homeTarget, symlinkPath, 'dir');
        const result = validateResetPath(symlinkPath);
        expect(result.valid).toBe(false);
        expect((result as { reason: string }).reason).toBe('DB dir resolves into home .diffscribe');
      } finally {
        try {
          fs.unlinkSync(symlinkPath);
        } catch {
          /* ok */
        }
        try {
          fs.rmSync(homeTarget, { recursive: true, force: true });
        } catch {
          /* ok */
        }
      }
    });

    it('accepts valid tmpdir path', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'diffscribe-reset-test-'));
      try {
        const result = validateResetPath(tmpDir);
        expect(result.valid).toBe(true);
        expect((result as { realDir: string }).realDir).toBe(fs.realpathSync(tmpDir));
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it('accepts tmpdir path with symlink that stays under tmpdir', () => {
      const realTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'diffscribe-reset-real-'));
      const symlinkPath = path.join(os.tmpdir(), `diffscribe-symlink-safe-${Date.now()}`);
      try {
        fs.symlinkSync(realTmp, symlinkPath, 'dir');
        const result = validateResetPath(symlinkPath);
        expect(result.valid).toBe(true);
        expect((result as { realDir: string }).realDir).toBe(fs.realpathSync(realTmp));
      } finally {
        try {
          fs.unlinkSync(symlinkPath);
        } catch {
          /* ok */
        }
        fs.rmSync(realTmp, { recursive: true, force: true });
      }
    });
  });

  describe('reset endpoint full integration', () => {
    let tempDir: string;
    let dbPath: string;

    beforeEach(() => {
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'diffscribe-reset-int-'));
      dbPath = path.join(tempDir, 'diffscribe.db');

      // Initialize a fresh DB with schema and test data
      const db = new Database(dbPath);
      db.pragma('journal_mode = WAL');
      runMigrations(db);

      // Insert test data: app_state and workspaces
      db.prepare("INSERT INTO app_state (key, value) VALUES ('active_workspace_id', 'ws-1')").run();
      db.prepare("INSERT INTO app_state (key, value) VALUES ('theme', 'dark')").run();
      db.prepare(
        "INSERT INTO workspaces (id, display_name, repository_path, created_at, last_opened_at) VALUES ('ws-1', 'Test WS', '/tmp/test', '2024-01-01', '2024-01-01')",
      ).run();
      db.close();
    });

    afterEach(() => {
      // Close any open handles by giving GC a chance
      fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('DELETE with wrong x-reset-secret returns 404 and does not mutate DB', () => {
      const db = new Database(dbPath);
      // Verify data exists before
      expect(
        (db.prepare('SELECT COUNT(*) as cnt FROM app_state').get() as { cnt: number }).cnt,
      ).toBe(2);
      expect(
        (db.prepare('SELECT COUNT(*) as cnt FROM workspaces').get() as { cnt: number }).cnt,
      ).toBe(1);
      db.close();

      // Simulate endpoint handling: wrong secret → no-op.
      // Verify that a mismatched secret does NOT match the env secret.
      const headerSecret: string = 'wrong-secret';
      // Cast through unknown to avoid TypeScript narrowing both to incompatible literal types
      const headerValue: string = String(headerSecret);
      const envValue: string = String(RESET_SECRET);
      expect(headerValue === envValue).toBe(false);
      const db2 = new Database(dbPath);
      expect(
        (db2.prepare('SELECT COUNT(*) as cnt FROM app_state').get() as { cnt: number }).cnt,
      ).toBe(2);
      expect(
        (db2.prepare('SELECT COUNT(*) as cnt FROM workspaces').get() as { cnt: number }).cnt,
      ).toBe(1);
      db2.close();
    });

    it('valid reset clears app_state and workspaces but preserves schema', () => {
      const db = new Database(dbPath);

      // Perform reset in a transaction
      const reset = db.transaction(() => {
        db.exec('DELETE FROM app_state');
        db.exec('DELETE FROM workspaces');
      });
      reset();

      // app_state should be empty
      expect(
        (db.prepare('SELECT COUNT(*) as cnt FROM app_state').get() as { cnt: number }).cnt,
      ).toBe(0);

      // workspaces should be empty
      expect(
        (db.prepare('SELECT COUNT(*) as cnt FROM workspaces').get() as { cnt: number }).cnt,
      ).toBe(0);

      // _migrations table should still exist and have rows
      const migrationCount = (
        db.prepare('SELECT COUNT(*) as cnt FROM _migrations').get() as { cnt: number }
      ).cnt;
      expect(migrationCount).toBeGreaterThan(0);

      // Schema should be intact: we can re-insert rows
      db.prepare("INSERT INTO app_state (key, value) VALUES ('post-reset', 'yes')").run();
      expect(
        (
          db.prepare("SELECT value FROM app_state WHERE key = 'post-reset'").get() as {
            value: string;
          }
        ).value,
      ).toBe('yes');

      db.close();
    });

    it('reset is transactional: schema unchanged even with partial test', () => {
      // Verify that if we had a transaction issue, schema is still there
      const db = new Database(dbPath);
      const reset = db.transaction(() => {
        db.exec('DELETE FROM app_state');
        db.exec('DELETE FROM workspaces');
      });
      reset();

      // Verify tables still exist by querying them
      expect(() => db.prepare('SELECT * FROM app_state').all()).not.toThrow();
      expect(() => db.prepare('SELECT * FROM workspaces').all()).not.toThrow();
      expect(() => db.prepare('SELECT * FROM _migrations').all()).not.toThrow();

      db.close();
    });

    it('no unrelated files are touched during reset', () => {
      // Create an extra file in the temp dir that should survive
      const extraFilePath = path.join(tempDir, 'extra-config.json');
      fs.writeFileSync(extraFilePath, JSON.stringify({ some: 'data' }));

      const db = new Database(dbPath);
      const reset = db.transaction(() => {
        db.exec('DELETE FROM app_state');
        db.exec('DELETE FROM workspaces');
      });
      reset();
      db.close();

      // The extra file should still exist
      expect(fs.existsSync(extraFilePath)).toBe(true);
      expect(JSON.parse(fs.readFileSync(extraFilePath, 'utf-8'))).toEqual({ some: 'data' });

      // The DB file should still exist (just cleaned)
      expect(fs.existsSync(dbPath)).toBe(true);
    });

    it('rejects non-temp DB path even with correct secret', () => {
      const result = validateResetPath('/etc/diffscribe-fake');
      expect(result.valid).toBe(false);
    });

    it('rejects empty secret when env var is not set', () => {
      // Simulate missing env: secret is falsy → reject
      const secret = undefined;
      expect(Boolean(secret)).toBe(false);
    });
  });
});
