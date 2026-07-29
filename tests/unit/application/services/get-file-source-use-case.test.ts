import { describe, expect, it, vi } from 'vitest';

import type { FileDiffResult } from '../../../../src/lib/server/application/dto/results/file-diff-results';
import type { FileSourceReader } from '../../../../src/lib/server/application/file-source-reader';
import type { GitFileDiffReader } from '../../../../src/lib/server/application/git-file-diff-reader';
import { GetFileSourceUseCase } from '../../../../src/lib/server/application/services/get-file-source-use-case';
import { ComparisonType } from '../../../../src/lib/server/domain/value-objects/comparison';
import type { DiffHighlighter } from '../../../../src/lib/server/infrastructure/shiki/highlighter';

// ── Fixtures ──────────────────────────────────────────────────────────────

function createSourceReader(result: {
  content: string;
  isBinary?: boolean;
  isDeleted?: boolean;
  error?: { message: string; errorCode: string };
}): FileSourceReader {
  return {
    read: vi.fn().mockResolvedValue({
      content: result.content,
      isBinary: result.isBinary ?? false,
      isDeleted: result.isDeleted ?? false,
      error: result.error,
    }),
  };
}

const DIFF_READER_NO_CHANGES: GitFileDiffReader = {
  read: vi.fn().mockResolvedValue({
    path: 'src/app.ts',
    hunks: [],
    isBinary: false,
    isTruncated: false,
    readAt: '2026-01-01T00:00:00Z',
  }),
};

const DIFF_READER_WITH_CHANGES: GitFileDiffReader = {
  read: vi.fn().mockResolvedValue({
    path: 'src/app.ts',
    hunks: [
      {
        header: '@@ -1,5 +1,6 @@',
        lines: [
          { changeType: 'context', content: 'line1', oldLineNumber: 1, newLineNumber: 1 },
          { changeType: 'deleted', content: 'old2', oldLineNumber: 2, newLineNumber: 0 },
          { changeType: 'added', content: 'new2', oldLineNumber: 0, newLineNumber: 2 },
          { changeType: 'added', content: 'line3b', oldLineNumber: 0, newLineNumber: 3 },
          { changeType: 'context', content: 'line4', oldLineNumber: 3, newLineNumber: 4 },
        ],
      },
    ],
    isBinary: false,
    isTruncated: false,
    readAt: '2026-01-01T00:00:00Z',
  } as FileDiffResult),
};

function createMockHighlighter(): DiffHighlighter {
  return {
    highlight: vi.fn().mockImplementation(async (code: string, _lang: string) => {
      void _lang;
      const lines = code.split('\n').map((text) => ({
        html: `<span>${text}</span>`,
        text,
      }));
      return { lines };
    }),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('GetFileSourceUseCase', () => {
  describe('execute', () => {
    it('returns source lines with language and change markers from the active comparison', async () => {
      const sourceReader = createSourceReader({ content: 'line1\nnew2\nline3b\nline4' });
      const highlighter = createMockHighlighter();
      const useCase = new GetFileSourceUseCase(sourceReader, DIFF_READER_WITH_CHANGES, highlighter);

      const result = await useCase.execute('/repo', 'src/app.ts', {
        comparisonType: ComparisonType.WORKING_TREE_VS_HEAD,
        baseRef: 'HEAD',
        targetRef: 'working-tree',
      });

      expect(result.path).toBe('src/app.ts');
      expect(result.lines).toHaveLength(4);

      // Line 1: unchanged (context in diff)
      expect(result.lines[0]).toMatchObject({
        lineNumber: 1,
        content: 'line1',
        changeType: 'unchanged',
      });

      // Line 2: added line that replaces a deleted line → modified
      expect(result.lines[1]).toMatchObject({
        lineNumber: 2,
        content: 'new2',
        changeType: 'modified',
      });

      // Line 3: added line without preceding deletion → added
      expect(result.lines[2]).toMatchObject({
        lineNumber: 3,
        content: 'line3b',
        changeType: 'added',
      });

      // Line 4: unchanged
      expect(result.lines[3]).toMatchObject({
        lineNumber: 4,
        content: 'line4',
        changeType: 'unchanged',
      });

      expect(result.language).toBe('typescript');
      expect(result.isBinary).toBe(false);
      expect(result.isTruncated).toBe(false);
      expect(result.isDeleted).toBe(false);
      expect(result.readAt).toBeTruthy();
    });

    it('returns all lines as unchanged when no diff exists', async () => {
      const sourceReader = createSourceReader({ content: 'line1\nline2\nline3' });
      const highlighter = createMockHighlighter();
      const useCase = new GetFileSourceUseCase(sourceReader, DIFF_READER_NO_CHANGES, highlighter);

      const result = await useCase.execute('/repo', 'src/app.ts', {
        comparisonType: ComparisonType.WORKING_TREE_VS_HEAD,
        baseRef: 'HEAD',
        targetRef: 'working-tree',
      });

      expect(result.lines).toHaveLength(3);
      expect(result.lines[0].changeType).toBe('unchanged');
      expect(result.lines[1].changeType).toBe('unchanged');
      expect(result.lines[2].changeType).toBe('unchanged');
    });

    it('resolves language from file path using language-map', async () => {
      const sourceReader = createSourceReader({ content: '{"key": "value"}' });
      const highlighter = createMockHighlighter();
      const spy = vi.spyOn(highlighter, 'highlight');
      const useCase = new GetFileSourceUseCase(sourceReader, DIFF_READER_NO_CHANGES, highlighter);

      const result = await useCase.execute('/repo', 'config.json', {
        comparisonType: ComparisonType.WORKING_TREE_VS_HEAD,
        baseRef: 'HEAD',
        targetRef: 'working-tree',
      });

      expect(result.language).toBe('json');
      expect(spy).toHaveBeenCalledWith(expect.any(String), 'json');
    });

    it('highlights each line using the highlighter', async () => {
      const sourceReader = createSourceReader({ content: 'const x = 1;\nconst y = 2;' });
      const highlighter = createMockHighlighter();
      const useCase = new GetFileSourceUseCase(sourceReader, DIFF_READER_NO_CHANGES, highlighter);

      const result = await useCase.execute('/repo', 'src/app.ts', {
        comparisonType: ComparisonType.WORKING_TREE_VS_HEAD,
        baseRef: 'HEAD',
        targetRef: 'working-tree',
      });

      expect(result.lines[0].html).toBeTruthy();
      expect(result.lines[0].text).toBe('const x = 1;');
    });

    it('returns error from source reader without throwing', async () => {
      const sourceReader = createSourceReader({
        content: '',
        error: { message: 'File not found', errorCode: 'FILE_NOT_FOUND' },
      });
      const highlighter = createMockHighlighter();
      const useCase = new GetFileSourceUseCase(sourceReader, DIFF_READER_NO_CHANGES, highlighter);

      const result = await useCase.execute('/repo', 'src/missing.ts', {
        comparisonType: ComparisonType.WORKING_TREE_VS_HEAD,
        baseRef: 'HEAD',
        targetRef: 'working-tree',
      });

      expect(result.error).toBeDefined();
      expect(result.error!.errorCode).toBe('FILE_NOT_FOUND');
      expect(result.lines).toHaveLength(0);
    });

    it('returns binary state without content', async () => {
      const sourceReader = createSourceReader({
        content: '',
        isBinary: true,
      });
      const highlighter = createMockHighlighter();
      const useCase = new GetFileSourceUseCase(sourceReader, DIFF_READER_NO_CHANGES, highlighter);

      const result = await useCase.execute('/repo', 'assets/logo.png', {
        comparisonType: ComparisonType.WORKING_TREE_VS_HEAD,
        baseRef: 'HEAD',
        targetRef: 'working-tree',
      });

      expect(result.isBinary).toBe(true);
      expect(result.lines).toHaveLength(0);
    });

    it('returns isDeleted when file was deleted in the working tree', async () => {
      const sourceReader = createSourceReader({
        content: '',
        isDeleted: true,
        error: { message: 'File was deleted', errorCode: 'FILE_DELETED' },
      });
      const highlighter = createMockHighlighter();
      const useCase = new GetFileSourceUseCase(sourceReader, DIFF_READER_NO_CHANGES, highlighter);

      const result = await useCase.execute('/repo', 'src/removed.ts', {
        comparisonType: ComparisonType.WORKING_TREE_VS_HEAD,
        baseRef: 'HEAD',
        targetRef: 'working-tree',
      });

      expect(result.isDeleted).toBe(true);
      expect(result.lines).toHaveLength(0);
      expect(result.error?.errorCode).toBe('FILE_DELETED');
    });

    it('applies size cap and reports isTruncated', async () => {
      // Generate content that exceeds 5000 lines
      const bigLines = Array.from({ length: 6000 }, (_, i) => `line ${i + 1}`);
      const bigContent = bigLines.join('\n');
      const sourceReader = createSourceReader({ content: bigContent });
      const highlighter = createMockHighlighter();
      const useCase = new GetFileSourceUseCase(sourceReader, DIFF_READER_NO_CHANGES, highlighter);

      const result = await useCase.execute('/repo', 'src/large.ts', {
        comparisonType: ComparisonType.WORKING_TREE_VS_HEAD,
        baseRef: 'HEAD',
        targetRef: 'working-tree',
      });

      expect(result.isTruncated).toBe(true);
      expect(result.truncationReason).toBeTruthy();
      // Should have at most 5000 lines
      expect(result.lines.length).toBeLessThanOrEqual(5000);
    });

    it('passes target ref to the source reader', async () => {
      const mockReader: FileSourceReader = {
        read: vi.fn().mockResolvedValue({
          content: 'content',
          isBinary: false,
          isDeleted: false,
        }),
      };
      const highlighter = createMockHighlighter();
      const useCase = new GetFileSourceUseCase(mockReader, DIFF_READER_NO_CHANGES, highlighter);

      await useCase.execute('/repo', 'src/app.ts', {
        comparisonType: ComparisonType.COMMIT_VS_COMMIT,
        baseRef: 'abc123',
        targetRef: 'def456',
      });

      expect(mockReader.read).toHaveBeenCalledWith({
        repositoryPath: '/repo',
        relativePath: 'src/app.ts',
        ref: 'def456',
      });
    });

    it('marks all lines as added for untracked files (synthetic diff)', async () => {
      const DIFF_READER_UNTRACKED: GitFileDiffReader = {
        read: vi.fn().mockResolvedValue({
          path: 'src/scratch.ts',
          hunks: [
            {
              header: '@@ -0,0 +1,3 @@',
              lines: [
                { changeType: 'added', content: 'a', oldLineNumber: 0, newLineNumber: 1 },
                { changeType: 'added', content: 'b', oldLineNumber: 0, newLineNumber: 2 },
                { changeType: 'added', content: 'c', oldLineNumber: 0, newLineNumber: 3 },
              ],
            },
          ],
          isBinary: false,
          isTruncated: false,
          readAt: '2026-01-01T00:00:00Z',
        } as FileDiffResult),
      };

      const sourceReader = createSourceReader({ content: 'a\nb\nc' });
      const highlighter = createMockHighlighter();
      const useCase = new GetFileSourceUseCase(sourceReader, DIFF_READER_UNTRACKED, highlighter);

      const result = await useCase.execute('/repo', 'src/scratch.ts', {
        comparisonType: ComparisonType.WORKING_TREE_VS_HEAD,
        baseRef: 'HEAD',
        targetRef: 'working-tree',
      });

      expect(result.lines).toHaveLength(3);
      expect(result.lines[0].changeType).toBe('added');
      expect(result.lines[1].changeType).toBe('added');
      expect(result.lines[2].changeType).toBe('added');
    });

    it('returns plain-text fallback for unrecognized languages', async () => {
      const sourceReader = createSourceReader({ content: 'some content' });
      const highlighter = createMockHighlighter();
      const useCase = new GetFileSourceUseCase(sourceReader, DIFF_READER_NO_CHANGES, highlighter);

      const result = await useCase.execute('/repo', 'data/unknown.xyz', {
        comparisonType: ComparisonType.WORKING_TREE_VS_HEAD,
        baseRef: 'HEAD',
        targetRef: 'working-tree',
      });

      expect(result.language).toBe('text');
    });
  });
});
