/**
 * Pure client-side fuzzy scorer for Quick Open.
 *
 * Ranking categories (dominant first):
 *   1. exact path match
 *   2. basename prefix
 *   3. basename subsequence
 *   4. path fuzzy subsequence
 *
 * Within a category, matches are boosted for consecutive characters,
 * start-of-word / after-separator positions, and exact case; compact
 * matches (short character span) rank above scattered ones. Ties are
 * broken deterministically by lexical path order. Every whitespace
 * separated term must match, results are capped, and highlight ranges
 * are reported for the matched characters.
 *
 * Inspired by the principles of VS Code's fuzzyScorer without
 * transplanting its internals.
 */

export interface ScorableFile {
  path: string;
  /** `undefined` means unknown — treated as tracked. */
  tracked?: boolean;
}

export interface HighlightRange {
  start: number;
  end: number;
}

export interface ScoredFile {
  path: string;
  tracked: boolean | undefined;
  score: number;
  highlights: HighlightRange[];
}

export const QUICK_OPEN_MAX_RESULTS = 512;

const CATEGORY_EXACT = 10_000;
const CATEGORY_BASENAME_PREFIX = 9_000;
const CATEGORY_BASENAME_SUBSEQUENCE = 8_000;
const CATEGORY_PATH_FUZZY = 7_000;

const BONUS_CONSECUTIVE = 4;
const BONUS_START_OF_WORD = 6;
const BONUS_CASE_EXACT = 2;
const COMPACTNESS_PENALTY = 0.01;

function normalizePath(p: string): string {
  return p.replace(/\\/g, '/').toLowerCase();
}

function basenameOf(p: string): string {
  const idx = p.lastIndexOf('/');
  return idx >= 0 ? p.slice(idx + 1) : p;
}

/**
 * Greedy leftmost subsequence match. Returns the matched ranges (as
 * [start, end) pairs) in the original path, or null when the term does not
 * match. Deterministic: always the leftmost match.
 */
function subsequenceRanges(normPath: string, term: string): [number, number][] | null {
  const ranges: [number, number][] = [];
  let searchFrom = 0;
  for (const ch of term) {
    const idx = normPath.indexOf(ch, searchFrom);
    if (idx < 0) return null;
    const last = ranges[ranges.length - 1];
    if (last && idx === last[1]) {
      last[1] = idx + 1;
    } else {
      ranges.push([idx, idx + 1]);
    }
    searchFrom = idx + 1;
  }
  return ranges;
}

/** Bonus points for a single matched character at `idx` with `prevMatched`. */
function charBonus(
  normPath: string,
  origPath: string,
  idx: number,
  term: string,
  j: number,
  prevMatched: boolean,
): number {
  let bonus = 0;
  if (prevMatched) {
    bonus += BONUS_CONSECUTIVE;
  } else if (idx === 0 || normPath[idx - 1] === '/') {
    bonus += BONUS_START_OF_WORD;
  }
  // Exact-case match bonus (query char vs original path char).
  if (origPath[idx] === term[j]) {
    bonus += BONUS_CASE_EXACT;
  }
  return bonus;
}

interface TermMatch {
  score: number;
  ranges: [number, number][];
}

/** Expand ranges into individual matched character positions. */
function positionsOf(ranges: [number, number][]): number[] {
  const positions: number[] = [];
  for (const [s, e] of ranges) {
    for (let i = s; i < e; i++) positions.push(i);
  }
  return positions;
}

/**
 * Score one term against one path. Returns null when the term does not
 * match at all.
 */
function scoreTerm(origPath: string, normPath: string, term: string): TermMatch | null {
  if (normPath === term) {
    return { score: CATEGORY_EXACT, ranges: [[0, origPath.length]] };
  }

  const bn = basenameOf(normPath);
  const bnStart = normPath.length - bn.length;

  // Basename prefix: the basename starts with the term.
  if (bn.startsWith(term)) {
    const ranges: [number, number][] = [[bnStart, bnStart + term.length]];
    const score =
      CATEGORY_BASENAME_PREFIX + positionBonus(origPath, normPath, positionsOf(ranges), term);
    return { score, ranges };
  }

  // Basename subsequence.
  const bnRanges = subsequenceRanges(bn, term);
  if (bnRanges) {
    const ranges = bnRanges.map(([s, e]): [number, number] => [s + bnStart, e + bnStart]);
    const score =
      CATEGORY_BASENAME_SUBSEQUENCE + positionBonus(origPath, normPath, positionsOf(ranges), term);
    return { score, ranges };
  }

  // Path fuzzy subsequence.
  const pathRanges = subsequenceRanges(normPath, term);
  if (pathRanges) {
    const score =
      CATEGORY_PATH_FUZZY + positionBonus(origPath, normPath, positionsOf(pathRanges), term);
    return { score, ranges: pathRanges };
  }

  return null;
}

function positionBonus(
  origPath: string,
  normPath: string,
  positions: number[],
  term: string,
): number {
  let bonus = 0;
  for (let j = 0; j < positions.length; j++) {
    const idx = positions[j];
    const prevMatched = j > 0 && positions[j - 1] === idx - 1;
    bonus += charBonus(normPath, origPath, idx, term, j, prevMatched);
  }
  // Compactness: matches spanning a short character range score higher.
  const span = positions[positions.length - 1] - positions[0] + 1;
  bonus -= span * COMPACTNESS_PENALTY;
  return bonus;
}

export interface ScoreOptions {
  includeUntracked?: boolean;
}

/**
 * Score every file against the query. Returns results sorted by score
 * (descending) with deterministic lexical tie-breaks, capped at
 * `QUICK_OPEN_MAX_RESULTS`. An empty query returns every eligible file in
 * index order (also capped).
 */
export function scoreFiles(
  files: ScorableFile[],
  query: string,
  options: ScoreOptions = {},
): ScoredFile[] {
  const includeUntracked = options.includeUntracked ?? false;
  const eligible = files.filter((f) => includeUntracked || f.tracked !== false);

  const rawQuery = query.replace(/\\/g, '/').toLowerCase();
  const terms = rawQuery.split(/\s+/).filter((t) => t.length > 0);

  if (terms.length === 0) {
    return eligible.slice(0, QUICK_OPEN_MAX_RESULTS).map((f) => ({
      path: f.path,
      tracked: f.tracked,
      score: 0,
      highlights: [],
    }));
  }

  const results: ScoredFile[] = [];
  for (const f of eligible) {
    const normPath = normalizePath(f.path);
    let total = 0;
    const highlights: HighlightRange[] = [];
    let matched = true;
    for (const term of terms) {
      const termMatch = scoreTerm(f.path, normPath, term);
      if (!termMatch) {
        matched = false;
        break;
      }
      total += termMatch.score;
      for (const [s, e] of termMatch.ranges) {
        highlights.push({ start: s, end: e });
      }
    }
    if (!matched) continue;
    results.push({ path: f.path, tracked: f.tracked, score: total, highlights });
  }

  results.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
  return results.slice(0, QUICK_OPEN_MAX_RESULTS);
}
