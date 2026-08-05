import { describe, expect, it, vi } from 'vitest';

import type { CompleteDiffResult } from '../../../src/lib/server/application/dto/results/complete-diff-results';
import type { GitCompleteDiffReader } from '../../../src/lib/server/application/git-complete-diff-reader';
import { GetCompleteDiffUseCase } from '../../../src/lib/server/application/services/get-complete-diff-use-case';
import {
  Comparison,
  ComparisonType,
} from '../../../src/lib/server/domain/value-objects/comparison';
import { FileChangeStatus } from '../../../src/lib/server/domain/value-objects/file-change-status';
import { GitRef } from '../../../src/lib/server/domain/value-objects/git-ref';

function sampleResult(overrides: Partial<CompleteDiffResult> = {}): CompleteDiffResult {
  return {
    comparisonType: ComparisonType.WORKING_TREE_VS_HEAD,
    files: [
      {
        path: 'README.md',
        status: FileChangeStatus.MODIFIED,
        binary: false,
        isTruncated: false,
        hunks: [],
        readAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    isTruncated: false,
    partialErrors: [],
    readAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('GetCompleteDiffUseCase', () => {
  it('resolves refs and passes them to the reader', async () => {
    const reader: GitCompleteDiffReader = {
      read: vi.fn().mockResolvedValue(sampleResult()),
    };
    const useCase = new GetCompleteDiffUseCase(reader);

    const result = await useCase.execute(
      '/repo',
      new Comparison({
        comparisonType: ComparisonType.BRANCH_VS_BRANCH,
        base: new GitRef('branch', 'main'),
        target: new GitRef('branch', 'feat/a'),
      }),
    );

    expect(reader.read).toHaveBeenCalledWith({
      repositoryPath: '/repo',
      comparisonType: ComparisonType.BRANCH_VS_BRANCH,
      baseRef: 'main',
      targetRef: 'feat/a',
    });
    expect(result).toEqual(sampleResult());
  });

  it('forwards the optional file limit', async () => {
    const reader: GitCompleteDiffReader = {
      read: vi.fn().mockResolvedValue(sampleResult()),
    };
    const useCase = new GetCompleteDiffUseCase(reader);

    await useCase.execute(
      '/repo',
      new Comparison({
        comparisonType: ComparisonType.WORKING_TREE_VS_HEAD,
        base: new GitRef('head', 'HEAD'),
        target: new GitRef('working-tree', 'working-tree'),
      }),
      25,
    );

    expect(reader.read).toHaveBeenCalledWith({
      repositoryPath: '/repo',
      comparisonType: ComparisonType.WORKING_TREE_VS_HEAD,
      baseRef: 'HEAD',
      targetRef: 'working-tree',
      fileLimit: 25,
    });
  });

  it('propagates the reader result unchanged', async () => {
    const expected = sampleResult({
      comparisonType: ComparisonType.STAGED_VS_HEAD,
      isTruncated: true,
      truncationReason: 'File limit exceeded (10)',
      files: [],
    });
    const reader: GitCompleteDiffReader = {
      read: vi.fn().mockResolvedValue(expected),
    };
    const useCase = new GetCompleteDiffUseCase(reader);

    const result = await useCase.execute(
      '/repo',
      new Comparison({
        comparisonType: ComparisonType.STAGED_VS_HEAD,
        base: new GitRef('head', 'HEAD'),
        target: new GitRef('head', 'HEAD'),
      }),
    );

    expect(result).toBe(expected);
  });
});
