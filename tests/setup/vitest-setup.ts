import { inject } from 'vitest';

declare module 'vitest' {
  export interface ProvidedContext {
    dbDir: string;
  }
}

/**
 * Worker-level setup — runs in each Vitest worker before any test file.
 *
 * Reads the temporary DB directory created by the global setup and sets
 * DIFFSCRIBE_DB_DIR so that getDb() resolves to the isolated temp DB
 * instead of falling back to ~/.diffscribe.
 */

const dbDir = inject('dbDir');
process.env.DIFFSCRIBE_DB_DIR = dbDir;
