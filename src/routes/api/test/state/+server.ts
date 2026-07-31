import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import Database from 'better-sqlite3';

import { isE2eInMemoryMode, resetInMemoryDb } from '$lib/server/infrastructure/database/connection';

import type { RequestHandler } from './$types';

/**
 * Validates that the configured DB directory is safe for E2E reset.
 *
 * Rejects:
 *   - Missing, empty, or relative paths
 *   - Paths not under os.tmpdir()
 *   - Paths that canonicalize into or under ~/.diffscribe
 *   - Symlink escapes (via realpath)
 *
 * Returns the canonicalized realDir if valid, or a rejection reason.
 */
function validateDbDir(
  raw: string | undefined,
): { valid: true; realDir: string } | { valid: false; reason: string } {
  if (!raw || !path.isAbsolute(raw)) {
    return { valid: false, reason: 'DB dir missing or not absolute' };
  }

  let realDir: string;
  try {
    realDir = fs.realpathSync(raw);
  } catch {
    return { valid: false, reason: 'DB dir does not exist' };
  }

  // Critical safety: never allow the home production DB directory
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

  // Must be under the OS temp directory
  const tmpDir = fs.realpathSync(os.tmpdir());
  const relativeToTmp = path.relative(tmpDir, realDir);
  if ((relativeToTmp.startsWith('..') || path.isAbsolute(relativeToTmp)) && relativeToTmp !== '') {
    return { valid: false, reason: 'DB dir not under tmpdir' };
  }

  return { valid: true, realDir };
}

export const DELETE: RequestHandler = async ({ request }) => {
  // Fail closed: no secret = no reset capability
  const secret = process.env.DIFFSCRIBE_E2E_RESET_SECRET;
  if (!secret) {
    return new Response(null, { status: 404 });
  }

  const header = request.headers.get('x-reset-secret');
  if (header !== secret) {
    return new Response(null, { status: 404 });
  }

  // In-memory mode: reset the singleton directly, skip filesystem validation
  if (isE2eInMemoryMode()) {
    try {
      resetInMemoryDb();
      return new Response(JSON.stringify({ status: 'ok' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch {
      return new Response(null, { status: 500 });
    }
  }

  const validation = validateDbDir(process.env.DIFFSCRIBE_DB_DIR);
  if (!validation.valid) {
    return new Response(null, { status: 404 });
  }

  const dbPath = path.join(validation.realDir, 'diffscribe.db');
  if (!fs.existsSync(dbPath)) {
    return new Response(null, { status: 404 });
  }

  let db: Database.Database;
  try {
    db = new Database(dbPath);
  } catch {
    return new Response(null, { status: 500 });
  }

  try {
    const reset = db.transaction(() => {
      db.exec('DELETE FROM review_files');
      db.exec('DELETE FROM reviews');
      db.exec('DELETE FROM app_state');
      db.exec('DELETE FROM workspaces');
    });
    reset();
    return new Response(JSON.stringify({ status: 'ok' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(null, { status: 500 });
  } finally {
    db.close();
  }
};
