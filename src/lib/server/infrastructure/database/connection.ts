import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import Database from 'better-sqlite3';

let _db: Database.Database | null = null;

function resolveDbDir(): string {
  if (process.env.VITEST && !process.env.DIFFSCRIBE_DB_DIR) {
    throw new Error(
      'DIFFSCRIBE_DB_DIR must be set when running under Vitest. ' +
        'Tests must use an isolated temporary database directory to avoid ' +
        'mutating the production database at ~/.diffscribe.',
    );
  }

  return process.env.DIFFSCRIBE_DB_DIR ?? path.join(os.homedir(), '.diffscribe');
}

function resolveDbPath(): string {
  return path.join(resolveDbDir(), 'diffscribe.db');
}

export function getDb(): Database.Database {
  if (_db) return _db;

  const dbDir = resolveDbDir();
  const dbPath = resolveDbPath();

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  _db = new Database(dbPath);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  return _db;
}

export function createTestDb(): Database.Database {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

const migrationModules = import.meta.glob('./migrations/*.sql', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

export function runMigrations(db: Database.Database): void {
  // Ensure migrations tracking table exists first
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const applied = new Set(
    (db.prepare('SELECT name FROM _migrations').all() as { name: string }[]).map((r) => r.name),
  );

  // Sort migration keys to ensure ordered execution
  const sortedKeys = Object.keys(migrationModules).sort();

  for (const modulePath of sortedKeys) {
    const name = path.basename(modulePath, '.sql');
    if (applied.has(name)) continue;

    const sql = migrationModules[modulePath];
    const runInTx = db.transaction(() => {
      db.exec(sql);
      db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(name);
    });
    runInTx();
  }
}
