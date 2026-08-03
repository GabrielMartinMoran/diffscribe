import { describe, expect, it } from 'vitest';

import {
  QUICK_OPEN_MAX_RESULTS,
  type ScorableFile,
  scoreFiles,
} from '$lib/web/services/quick-open-scorer';

function file(path: string, tracked = true): ScorableFile {
  return { path, tracked };
}

function pathsOf(results: ReturnType<typeof scoreFiles>): string[] {
  return results.map((r) => r.path);
}

describe('quick-open-scorer ranking categories', () => {
  it('exact path beats basename prefix and fuzzy matches', () => {
    const files = [file('src/app.ts'), file('app.ts'), file('xapp.ts')];
    const results = scoreFiles(files, 'app.ts');
    expect(pathsOf(results).slice(0, 2)).toEqual(['app.ts', 'src/app.ts']);
  });

  it('basename prefix beats basename subsequence', () => {
    const files = [file('src/my-app.ts'), file('src/app.ts')];
    const results = scoreFiles(files, 'app');
    expect(pathsOf(results)[0]).toBe('src/app.ts');
  });

  it('basename subsequence beats path fuzzy', () => {
    const files = [file('src/xutil/more.ts'), file('src/lib/util.ts')];
    const results = scoreFiles(files, 'util');
    expect(pathsOf(results)[0]).toBe('src/lib/util.ts');
  });

  it('consecutive matches are boosted over scattered matches', () => {
    const files = [file('src/a.p.ts'), file('src/app.ts')];
    const results = scoreFiles(files, 'ap');
    expect(pathsOf(results)[0]).toBe('src/app.ts');
  });

  it('start-of-word and separator matches are boosted', () => {
    const files = [file('src/globalib/more.ts'), file('src/lib/util.ts')];
    const results = scoreFiles(files, 'lib');
    expect(pathsOf(results)[0]).toBe('src/lib/util.ts');
  });
});

describe('quick-open-scorer terms and normalization', () => {
  it('all whitespace-separated terms must match', () => {
    const files = [file('src/lib/util.ts'), file('src/app.ts')];
    expect(pathsOf(scoreFiles(files, 'lib util'))).toEqual(['src/lib/util.ts']);
    expect(scoreFiles(files, 'lib nope')).toEqual([]);
  });

  it('query normalization ignores case', () => {
    const files = [file('src/lib/Util.ts')];
    expect(pathsOf(scoreFiles(files, 'UTIL'))).toEqual(['src/lib/Util.ts']);
  });

  it('query normalization unifies path separators', () => {
    const files = [file('src/lib/util.ts')];
    expect(pathsOf(scoreFiles(files, 'src\\lib\\util'))).toEqual(['src/lib/util.ts']);
  });

  it('an empty query returns every file in index order', () => {
    const files = [file('b.ts'), file('a.ts'), file('c.ts')];
    expect(pathsOf(scoreFiles(files, ''))).toEqual(['b.ts', 'a.ts', 'c.ts']);
  });

  it('an empty query is capped at 512 results', () => {
    const files: ScorableFile[] = [];
    for (let i = 0; i < 600; i++) files.push(file(`src/file-${i}.ts`));
    const results = scoreFiles(files, '');
    expect(results.length).toBe(QUICK_OPEN_MAX_RESULTS);
    expect(results.length).toBeLessThanOrEqual(512);
  });

  it('a non-empty query is also capped at 512 results', () => {
    const files: ScorableFile[] = [];
    for (let i = 0; i < 600; i++) files.push(file(`src/file-${i}.ts`));
    const results = scoreFiles(files, 'file');
    expect(results.length).toBe(512);
  });

  it('ties are broken deterministically by lexical path order', () => {
    const files = [file('src/zeta.ts'), file('src/alpha.ts')];
    const results = scoreFiles(files, 'ts');
    // Same category and bonus: the lexical order decides.
    expect(pathsOf(results)).toEqual(['src/alpha.ts', 'src/zeta.ts']);
  });
});

describe('quick-open-scorer tracked filtering and highlights', () => {
  it('excludes untracked files by default', () => {
    const files = [file('src/app.ts', true), file('src/scratch.ts', false)];
    const results = scoreFiles(files, 'scratch');
    expect(results).toEqual([]);
  });

  it('includes untracked files when requested', () => {
    const files = [file('src/app.ts', true), file('src/scratch.ts', false)];
    const results = scoreFiles(files, 'scratch', { includeUntracked: true });
    expect(pathsOf(results)).toEqual(['src/scratch.ts']);
  });

  it('reports highlight ranges for the matched characters', () => {
    const results = scoreFiles([file('src/lib/util.ts')], 'util');
    const [match] = results[0].highlights;
    expect(match).toBeDefined();
    expect('src/lib/util.ts'.slice(match.start, match.end)).toBe('util');
  });

  it('tracks untracked flag through to results', () => {
    const results = scoreFiles([file('src/scratch.ts', false)], 'scratch', {
      includeUntracked: true,
    });
    expect(results[0].tracked).toBe(false);
  });
});
