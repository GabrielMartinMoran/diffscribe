/**
 * Additive stability ledger (0005 Phase 7/8).
 *
 * Records per-spec, per-worker, per-run pass/fail with exact test names,
 * worker/port context, and error/stderr output. The ledger is strictly
 * additive: it never converts a flaky test into a pass, never changes test
 * behavior, and never applies lifecycle changes. Consumers decide what to do
 * with the recorded evidence.
 */
import fs from 'node:fs';
import path from 'node:path';

export type LedgerStatus = 'passed' | 'failed';

export interface LedgerEntry {
  /** Test file (relative path) the entry belongs to. */
  readonly spec: string;
  /** Exact test title as reported by the runner. */
  readonly test: string;
  /** Run index (from DIFFSCRIBE_LEDGER_RUN, default 1). */
  readonly runIndex: string;
  /** Sequential worker index (0-based), when available. */
  readonly workerIndex: number | null;
  /** Playwright parallelIndex (0-based), when available. */
  readonly parallelIndex: number | null;
  /** Worker server port, when available. */
  readonly port: number | null;
  /** Outcome of the run for this test. */
  readonly status: LedgerStatus;
  /** Error message / output when failed, else null. */
  readonly error: string | null;
  /** Latest worker server stderr snapshot, when available. */
  readonly stderrSnapshot: string;
  /** Epoch ms when the test finished. */
  readonly finishedAt: number;
}

export interface StabilityLedger {
  record(entry: Omit<LedgerEntry, 'runIndex' | 'finishedAt'> & { runIndex?: string }): void;
  entries(): readonly LedgerEntry[];
  clear(): void;
}

/** Run index from the environment; the runner sets it per full-suite run. */
export function currentRunIndex(): string {
  const raw = process.env.DIFFSCRIBE_LEDGER_RUN;
  return raw !== undefined && raw !== '' ? raw : '1';
}

/**
 * Create an in-memory stability ledger. Entries are append-only; `entries()`
 * returns a defensive copy so consumers cannot mutate recorded evidence.
 */
export function createStabilityLedger(): StabilityLedger {
  const entries: LedgerEntry[] = [];

  return {
    record(entry): void {
      entries.push({
        ...entry,
        runIndex: entry.runIndex ?? currentRunIndex(),
        finishedAt: Date.now(),
      });
    },
    entries(): readonly LedgerEntry[] {
      return [...entries];
    },
    clear(): void {
      entries.length = 0;
    },
  };
}

/** Format a ledger as one JSON object per line (ledger-friendly output). */
export function formatLedgerLines(ledger: StabilityLedger): string {
  return ledger
    .entries()
    .map((entry) => JSON.stringify(entry))
    .join('\n');
}

/**
 * Persist the ledger as JSON-lines to `DIFFSCRIBE_LEDGER_FILE` (or an
 * explicit path). Returns the written path, or `null` when no target is
 * configured. Appends when the file already exists so repeated runs of the
 * same suite accumulate evidence.
 */
export function writeLedgerFile(ledger: StabilityLedger, filePath?: string): string | null {
  const target = filePath ?? process.env.DIFFSCRIBE_LEDGER_FILE;
  if (!target) return null;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.appendFileSync(target, formatLedgerLines(ledger) + '\n');
  return target;
}
