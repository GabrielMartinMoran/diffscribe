import { describe, expect, it, vi } from 'vitest';

import type { FileListResult } from '../../../../src/lib/server/application/dto/results/file-list-results';
import type { GitFileListReader } from '../../../../src/lib/server/application/git-file-list-reader';
import { GetFileListUseCase } from '../../../../src/lib/server/application/services/get-file-list-use-case';
import {
  Comparison,
  ComparisonType,
} from '../../../../src/lib/server/domain/value-objects/comparison';
import { FileChangeStatus } from '../../../../src/lib/server/domain/value-objects/file-change-status';
import { GitRef } from '../../../../src/lib/server/domain/value-objects/git-ref';

describe('GetFileListUseCase', () => {
  function makeComparison(type: ComparisonType): Comparison {
    const baseMap: Record<string, [string, string]> = {
      [ComparisonType.WORKING_TREE_VS_HEAD]: ['head', 'HEAD'],
      [ComparisonType.STAGED_VS_HEAD]: ['head', 'HEAD'],
      [ComparisonType.UNSTAGED]: ['index', 'index'],
      [ComparisonType.BRANCH_VS_BRANCH]: ['branch', 'main'],
      [ComparisonType.COMMIT_VS_COMMIT]: ['commit', 'abc1234'],
      [ComparisonType.COMMIT_VS_WORKING_TREE]: ['commit', 'abc1234'],
      [ComparisonType.BRANCH_VS_WORKING_TREE]: ['branch', 'main'],
      [ComparisonType.COMMIT_RANGE]: ['commit', 'abc1234'],
    };
    const [baseType, baseValue] = baseMap[type];
    // Determine target type from the comparison type
    let targetType: 'branch' | 'commit' | 'head' | 'working-tree' | 'index' = 'working-tree';
    let targetValue = 'working-tree';

    switch (type) {
      case ComparisonType.WORKING_TREE_VS_HEAD:
        targetType = 'working-tree';
        targetValue = 'working-tree';
        break;
      case ComparisonType.STAGED_VS_HEAD:
        targetType = 'head';
        targetValue = 'HEAD';
        break;
      case ComparisonType.UNSTAGED:
        targetType = 'working-tree';
        targetValue = 'working-tree';
        break;
      case ComparisonType.BRANCH_VS_BRANCH:
        targetType = 'branch';
        targetValue = 'feat/a';
        break;
      case ComparisonType.COMMIT_VS_COMMIT:
        targetType = 'commit';
        targetValue = 'def5678';
        break;
      case ComparisonType.COMMIT_VS_WORKING_TREE:
        targetType = 'working-tree';
        targetValue = 'working-tree';
        break;
      case ComparisonType.BRANCH_VS_WORKING_TREE:
        targetType = 'working-tree';
        targetValue = 'working-tree';
        break;
      case ComparisonType.COMMIT_RANGE:
        targetType = 'commit';
        targetValue = 'def5678';
        break;
    }

    return new Comparison({
      base: new GitRef(baseType as 'head' | 'branch' | 'commit' | 'index', baseValue),
      target: new GitRef(targetType, targetValue),
      comparisonType: type,
    });
  }

  it('delegates to the GitFileListReader with the correct params for working-tree-vs-head', async () => {
    const mockReader: GitFileListReader = {
      read: vi.fn().mockResolvedValue({ entries: [], readAt: new Date().toISOString() }),
    };
    const useCase = new GetFileListUseCase(mockReader);
    const comparison = makeComparison(ComparisonType.WORKING_TREE_VS_HEAD);

    await useCase.execute('/tmp/repo', comparison);

    expect(mockReader.read).toHaveBeenCalledWith({
      repositoryPath: '/tmp/repo',
      comparisonType: ComparisonType.WORKING_TREE_VS_HEAD,
      baseRef: 'HEAD',
      targetRef: 'working-tree',
    });
  });

  it('delegates with correct refs for staged-vs-head', async () => {
    const mockReader: GitFileListReader = {
      read: vi.fn().mockResolvedValue({ entries: [], readAt: new Date().toISOString() }),
    };
    const useCase = new GetFileListUseCase(mockReader);
    const comparison = makeComparison(ComparisonType.STAGED_VS_HEAD);

    await useCase.execute('/tmp/repo', comparison);

    expect(mockReader.read).toHaveBeenCalledWith(
      expect.objectContaining({
        baseRef: 'HEAD',
        comparisonType: ComparisonType.STAGED_VS_HEAD,
      }),
    );
  });

  it('delegates with correct refs for unstaged', async () => {
    const mockReader: GitFileListReader = {
      read: vi.fn().mockResolvedValue({ entries: [], readAt: new Date().toISOString() }),
    };
    const useCase = new GetFileListUseCase(mockReader);
    const comparison = makeComparison(ComparisonType.UNSTAGED);

    await useCase.execute('/tmp/repo', comparison);

    expect(mockReader.read).toHaveBeenCalledWith(
      expect.objectContaining({
        comparisonType: ComparisonType.UNSTAGED,
      }),
    );
  });

  it('delegates with correct refs for branch-vs-branch', async () => {
    const mockReader: GitFileListReader = {
      read: vi.fn().mockResolvedValue({ entries: [], readAt: new Date().toISOString() }),
    };
    const useCase = new GetFileListUseCase(mockReader);
    const comparison = makeComparison(ComparisonType.BRANCH_VS_BRANCH);

    await useCase.execute('/tmp/repo', comparison);

    expect(mockReader.read).toHaveBeenCalledWith(
      expect.objectContaining({
        comparisonType: ComparisonType.BRANCH_VS_BRANCH,
        baseRef: 'main',
        targetRef: 'feat/a',
      }),
    );
  });

  it('delegates with correct refs for commit-vs-commit', async () => {
    const mockReader: GitFileListReader = {
      read: vi.fn().mockResolvedValue({ entries: [], readAt: new Date().toISOString() }),
    };
    const useCase = new GetFileListUseCase(mockReader);
    const comparison = makeComparison(ComparisonType.COMMIT_VS_COMMIT);

    await useCase.execute('/tmp/repo', comparison);

    expect(mockReader.read).toHaveBeenCalledWith(
      expect.objectContaining({
        comparisonType: ComparisonType.COMMIT_VS_COMMIT,
      }),
    );
  });

  it('delegates with correct refs for commit-vs-working-tree', async () => {
    const mockReader: GitFileListReader = {
      read: vi.fn().mockResolvedValue({ entries: [], readAt: new Date().toISOString() }),
    };
    const useCase = new GetFileListUseCase(mockReader);
    const comparison = makeComparison(ComparisonType.COMMIT_VS_WORKING_TREE);

    await useCase.execute('/tmp/repo', comparison);

    expect(mockReader.read).toHaveBeenCalledWith(
      expect.objectContaining({
        comparisonType: ComparisonType.COMMIT_VS_WORKING_TREE,
        targetRef: 'working-tree',
      }),
    );
  });

  it('delegates with correct refs for branch-vs-working-tree', async () => {
    const mockReader: GitFileListReader = {
      read: vi.fn().mockResolvedValue({ entries: [], readAt: new Date().toISOString() }),
    };
    const useCase = new GetFileListUseCase(mockReader);
    const comparison = makeComparison(ComparisonType.BRANCH_VS_WORKING_TREE);

    await useCase.execute('/tmp/repo', comparison);

    expect(mockReader.read).toHaveBeenCalledWith(
      expect.objectContaining({
        comparisonType: ComparisonType.BRANCH_VS_WORKING_TREE,
        targetRef: 'working-tree',
      }),
    );
  });

  it('delegates with correct refs for commit-range', async () => {
    const mockReader: GitFileListReader = {
      read: vi.fn().mockResolvedValue({ entries: [], readAt: new Date().toISOString() }),
    };
    const useCase = new GetFileListUseCase(mockReader);
    const comparison = makeComparison(ComparisonType.COMMIT_RANGE);

    await useCase.execute('/tmp/repo', comparison);

    expect(mockReader.read).toHaveBeenCalledWith(
      expect.objectContaining({
        comparisonType: ComparisonType.COMMIT_RANGE,
      }),
    );
  });

  it('returns the FileListResult from the reader', async () => {
    const expected: FileListResult = {
      entries: [{ path: 'src/a.ts', status: FileChangeStatus.MODIFIED, binary: false }],
      readAt: '2026-01-01T00:00:00.000Z',
    };
    const mockReader: GitFileListReader = {
      read: vi.fn().mockResolvedValue(expected),
    };
    const useCase = new GetFileListUseCase(mockReader);
    const comparison = makeComparison(ComparisonType.WORKING_TREE_VS_HEAD);

    const result = await useCase.execute('/tmp/repo', comparison);

    expect(result).toEqual(expected);
  });

  it('returns error result when reader returns an error', async () => {
    const errorResult: FileListResult = {
      entries: [],
      readAt: new Date().toISOString(),
      error: { message: 'Git failed', errorCode: 'GIT_ERROR' },
    };
    const mockReader: GitFileListReader = {
      read: vi.fn().mockResolvedValue(errorResult),
    };
    const useCase = new GetFileListUseCase(mockReader);
    const comparison = makeComparison(ComparisonType.WORKING_TREE_VS_HEAD);

    const result = await useCase.execute('/tmp/repo', comparison);

    expect(result.error).toBeDefined();
    expect(result.error!.errorCode).toBe('GIT_ERROR');
  });
});
