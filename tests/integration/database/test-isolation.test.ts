import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import { getDb } from '../../../src/lib/server/infrastructure/database/connection';

describe('Vitest DB isolation', () => {
  it('has DIFFSCRIBE_DB_DIR set by global setup', () => {
    expect(process.env.DIFFSCRIBE_DB_DIR).toBeDefined();
    expect(process.env.DIFFSCRIBE_DB_DIR).toBeTruthy();
  });

  it('DIFFSCRIBE_DB_DIR is an absolute path', () => {
    const dbDir = process.env.DIFFSCRIBE_DB_DIR!;
    expect(path.isAbsolute(dbDir)).toBe(true);
  });

  it('DIFFSCRIBE_DB_DIR exists as a directory', () => {
    const dbDir = process.env.DIFFSCRIBE_DB_DIR!;
    expect(fs.existsSync(dbDir)).toBe(true);
    expect(fs.statSync(dbDir).isDirectory()).toBe(true);
  });

  it('DIFFSCRIBE_DB_DIR is under os.tmpdir (canonical path)', () => {
    const dbDir = process.env.DIFFSCRIBE_DB_DIR!;
    const realDbDir = fs.realpathSync(dbDir);
    const realTmp = fs.realpathSync(os.tmpdir());
    const relative = path.relative(realTmp, realDbDir);
    expect(relative).not.toBe('');
    expect(relative.startsWith('..')).toBe(false);
    expect(path.isAbsolute(relative)).toBe(false);
  });

  it('DIFFSCRIBE_DB_DIR is NOT under ~/.diffscribe', () => {
    const dbDir = process.env.DIFFSCRIBE_DB_DIR!;
    const realDbDir = fs.realpathSync(dbDir);
    const homeDiffscribe = path.join(os.homedir(), '.diffscribe');
    let realHome: string;
    try {
      realHome = fs.realpathSync(homeDiffscribe);
    } catch {
      realHome = path.resolve(homeDiffscribe);
    }
    const relativeToHome = path.relative(realHome, realDbDir);
    expect(
      relativeToHome === '' ||
        (!relativeToHome.startsWith('..') && !path.isAbsolute(relativeToHome)),
    ).toBe(false);
  });

  it('getDb() resolves to the isolated temp directory', () => {
    // getDb() returns a singleton — do NOT close it here,
    // as subsequent tests depend on the same connection.
    const db = getDb();
    const dbPath = db.name; // better-sqlite3 stores the file path in .name
    const dir = path.dirname(dbPath);
    const expectedDir = process.env.DIFFSCRIBE_DB_DIR!;
    expect(fs.realpathSync(dir)).toBe(fs.realpathSync(expectedDir));
    expect(dbPath).toContain('diffscribe.db');
  });

  it('getDb() does NOT connect to ~/.diffscribe', () => {
    const db = getDb();
    const dbPath = db.name;
    const homeDiffscribe = path.join(os.homedir(), '.diffscribe');
    const realHome: string = (() => {
      try {
        return fs.realpathSync(homeDiffscribe);
      } catch {
        return path.resolve(homeDiffscribe);
      }
    })();
    const relative = path.relative(realHome, dbPath);
    expect(relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))).toBe(
      false,
    );
  });

  afterAll(() => {
    // Close the singleton DB opened by getDb() during this test file.
    // The connection module caches _db — we force-close it here so
    // the global teardown can clean up the temp directory.
    const db = getDb();
    db.close();
  });
});
