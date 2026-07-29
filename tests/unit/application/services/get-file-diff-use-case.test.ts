import { describe, expect, it, vi } from 'vitest';

import type { FileDiffResult } from '../../../../src/lib/server/application/dto/results/file-diff-results';
import type { GitFileDiffReader } from '../../../../src/lib/server/application/git-file-diff-reader';
import { GetFileDiffUseCase } from '../../../../src/lib/server/application/services/get-file-diff-use-case';
import { ComparisonType } from '../../../../src/lib/server/domain/value-objects/comparison';
import type { DiffHighlighter } from '../../../../src/lib/server/infrastructure/shiki/highlighter';

function createMockReader(result: FileDiffResult): GitFileDiffReader {
  return { read: vi.fn().mockResolvedValue(result) };
}

function createMockHighlighter(): DiffHighlighter {
  return {
    highlight: vi.fn().mockImplementation(async (code: string, lang: string) => {
      if (lang === 'text') {
        return { lines: [{ html: code, text: code }] };
      }
      const lines = code.split('\n').map((text) => ({
        html: `<span>${text}</span>`,
        text,
      }));
      return { lines };
    }),
  };
}

const PORT_HUNK: FileDiffResult = {
  path: 'src/app.ts',
  hunks: [
    {
      header: '@@ -1,1 +1,1 @@',
      lines: [
        { changeType: 'context', content: 'import from', oldLineNumber: 1, newLineNumber: 1 },
        { changeType: 'added', content: 'const x = 1', oldLineNumber: 0, newLineNumber: 2 },
        { changeType: 'deleted', content: 'const y = 2', oldLineNumber: 2, newLineNumber: 0 },
      ],
    },
  ],
  isBinary: false,
  isTruncated: false,
  readAt: '2026-01-01T00:00:00Z',
};

describe('GetFileDiffUseCase', () => {
  describe('execute', () => {
    it('delegates to the reader and highlighter and returns highlighted result', async () => {
      const reader = createMockReader(PORT_HUNK);
      const highlighter = createMockHighlighter();
      const useCase = new GetFileDiffUseCase(reader, highlighter);

      const result = await useCase.execute('/repo', 'src/app.ts', {
        comparisonType: ComparisonType.WORKING_TREE_VS_HEAD,
        baseRef: 'HEAD',
        targetRef: 'working-tree',
      });

      expect(result.path).toBe('src/app.ts');
      expect(result.hunks.length).toBe(1);
      // Context and added lines should have highlighted html
      const contextLine = result.hunks[0].lines[0];
      expect(contextLine.html).toBeTruthy();

      const addedLine = result.hunks[0].lines[1];
      expect(addedLine.html).toBeTruthy();

      // Deleted lines may have empty html
      const deletedLine = result.hunks[0].lines[2];
      expect(deletedLine.html).toBe('');
      // But they should still have text content
      expect(deletedLine.text).toBe('const y = 2');
    });

    it('resolves language from file path using language-map', async () => {
      const reader = createMockReader({ ...PORT_HUNK, path: 'src/app.py' });
      const highlighter = createMockHighlighter();
      const spy = vi.spyOn(highlighter, 'highlight');
      const useCase = new GetFileDiffUseCase(reader, highlighter);

      await useCase.execute('/repo', 'src/app.py', {
        comparisonType: ComparisonType.WORKING_TREE_VS_HEAD,
        baseRef: 'HEAD',
        targetRef: 'working-tree',
      });

      expect(spy).toHaveBeenCalledWith(expect.any(String), 'python');
    });

    it('passes resolved refs to the reader', async () => {
      const mockReader = { read: vi.fn().mockResolvedValue(PORT_HUNK) };
      const highlighter = createMockHighlighter();
      const useCase = new GetFileDiffUseCase(mockReader, highlighter);

      await useCase.execute('/repo', 'src/app.ts', {
        comparisonType: ComparisonType.COMMIT_VS_COMMIT,
        baseRef: 'abc123',
        targetRef: 'def456',
      });

      expect(mockReader.read).toHaveBeenCalledWith({
        repositoryPath: '/repo',
        comparisonType: ComparisonType.COMMIT_VS_COMMIT,
        baseRef: 'abc123',
        targetRef: 'def456',
        relativePath: 'src/app.ts',
      });
    });

    it('returns error from reader without throwing', async () => {
      const reader: GitFileDiffReader = {
        read: vi.fn().mockResolvedValue({
          path: 'src/missing.ts',
          hunks: [],
          isBinary: false,
          isTruncated: false,
          readAt: '',
          error: { message: 'File not found', errorCode: 'FILE_NOT_FOUND' },
        }),
      };
      const highlighter = createMockHighlighter();
      const useCase = new GetFileDiffUseCase(reader, highlighter);

      const result = await useCase.execute('/repo', 'src/missing.ts', {
        comparisonType: ComparisonType.WORKING_TREE_VS_HEAD,
        baseRef: 'HEAD',
        targetRef: 'working-tree',
      });

      expect(result.error).toBeDefined();
      expect(result.error!.errorCode).toBe('FILE_NOT_FOUND');
      expect(result.hunks).toHaveLength(0);
    });

    it('returns partial result when isTruncated', async () => {
      const truncatedResult: FileDiffResult = {
        ...PORT_HUNK,
        isTruncated: true,
        truncationReason: 'Content exceeds 256 KB',
      };
      const reader = createMockReader(truncatedResult);
      const highlighter = createMockHighlighter();
      const useCase = new GetFileDiffUseCase(reader, highlighter);

      const result = await useCase.execute('/repo', 'src/large.ts', {
        comparisonType: ComparisonType.WORKING_TREE_VS_HEAD,
        baseRef: 'HEAD',
        targetRef: 'working-tree',
      });

      expect(result.isTruncated).toBe(true);
      expect(result.truncationReason).toBe('Content exceeds 256 KB');
      expect(result.hunks.length).toBeGreaterThan(0);
    });

    it('returns binary result without highlighting', async () => {
      const binaryResult: FileDiffResult = {
        path: 'assets/logo.png',
        hunks: [],
        isBinary: true,
        isTruncated: false,
        readAt: '2026-01-01T00:00:00Z',
      };
      const reader = createMockReader(binaryResult);
      const highlighter = createMockHighlighter();
      const useCase = new GetFileDiffUseCase(reader, highlighter);

      const result = await useCase.execute('/repo', 'assets/logo.png', {
        comparisonType: ComparisonType.WORKING_TREE_VS_HEAD,
        baseRef: 'HEAD',
        targetRef: 'working-tree',
      });

      expect(result.isBinary).toBe(true);
      expect(result.hunks).toHaveLength(0);
    });

    it('returns empty result for empty hunks', async () => {
      const emptyResult: FileDiffResult = {
        path: 'src/empty.ts',
        hunks: [],
        isBinary: false,
        isTruncated: false,
        readAt: '2026-01-01T00:00:00Z',
      };
      const reader = createMockReader(emptyResult);
      const highlighter = createMockHighlighter();
      const useCase = new GetFileDiffUseCase(reader, highlighter);

      const result = await useCase.execute('/repo', 'src/empty.ts', {
        comparisonType: ComparisonType.WORKING_TREE_VS_HEAD,
        baseRef: 'HEAD',
        targetRef: 'working-tree',
      });

      expect(result.hunks).toHaveLength(0);
      expect(result.isBinary).toBe(false);
    });
  });
});
