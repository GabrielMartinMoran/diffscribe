import { createHash } from 'node:crypto';

/**
 * Canonical content hash for observation staleness detection.
 *
 * The canonical input for a file/range observation is:
 *   filePath + ":" + side + ":" + String(startLine) + ":" + LF-normalized raw content
 *
 * Where content is a selected substring of the unified diff (with +/-, and space prefixes).
 * LF normalization replaces CRLF with LF.
 * Hash algorithm: SHA-256 via node:crypto.
 */

export function canonicalizeForHash(
  filePath: string,
  side: string,
  startLine: number,
  rawContent: string,
): string {
  const normalized = rawContent.replace(/\r\n/g, '\n');
  return `${filePath}:${side}:${String(startLine)}:${normalized}`;
}

export function computeContentHash(
  filePath: string,
  side: string,
  startLine: number,
  rawContent: string,
): string {
  const canonical = canonicalizeForHash(filePath, side, startLine, rawContent);
  return createHash('sha256').update(canonical).digest('hex');
}
