import { describe, expect, it } from 'vitest';

import { GetGitContextUseCase } from '../../../../src/lib/server/application/services/get-git-context-use-case';
import { FakeGitContextReader } from '../../../helpers/fake-git-context-reader';

describe('GetGitContextUseCase', () => {
  const fakeReader = new FakeGitContextReader();
  const useCase = new GetGitContextUseCase(fakeReader);

  it('returns clean status when reader provides clean working tree', async () => {
    fakeReader.setStatus({
      stagedCount: 0,
      unstagedCount: 0,
      untrackedCount: 0,
      conflictedCount: 0,
      isDirty: false,
      currentBranch: 'main',
      headState: 'clean',
    });
    fakeReader.setBranches([
      { name: 'main', isCurrent: true },
      { name: 'feat/a', isCurrent: false },
    ]);
    fakeReader.setCommits([
      {
        shortHash: 'abc1234',
        fullHash: 'abc1234567890123456789012345678901234567',
        message: 'initial commit',
        authorName: 'Test',
        date: new Date().toISOString(),
      },
    ]);
    fakeReader.setError(null);

    const result = await useCase.execute('/some/repo');

    expect(result.status).not.toBeNull();
    expect(result.status!.isDirty).toBe(false);
    expect(result.status!.currentBranch).toBe('main');
    expect(result.status!.headState).toBe('clean');
    expect(result.branches).toHaveLength(2);
    expect(result.branches[0].name).toBe('main');
    expect(result.branches[0].isCurrent).toBe(true);
    expect(result.commits).toHaveLength(1);
    expect(result.commits[0].shortHash).toBe('abc1234');
  });

  it('returns dirty status correctly', async () => {
    fakeReader.setStatus({
      stagedCount: 2,
      unstagedCount: 3,
      untrackedCount: 1,
      conflictedCount: 0,
      isDirty: true,
      currentBranch: 'main',
      headState: 'dirty',
    });
    fakeReader.setBranches([]);
    fakeReader.setCommits([]);
    fakeReader.setError(null);

    const result = await useCase.execute('/some/repo');

    expect(result.status!.isDirty).toBe(true);
    expect(result.status!.stagedCount).toBe(2);
    expect(result.status!.unstagedCount).toBe(3);
    expect(result.status!.untrackedCount).toBe(1);
  });

  it('returns conflicted status correctly', async () => {
    fakeReader.setStatus({
      stagedCount: 0,
      unstagedCount: 0,
      untrackedCount: 0,
      conflictedCount: 2,
      isDirty: true,
      currentBranch: 'main',
      headState: 'conflict',
    });
    fakeReader.setBranches([]);
    fakeReader.setCommits([]);
    fakeReader.setError(null);

    const result = await useCase.execute('/some/repo');

    expect(result.status!.conflictedCount).toBe(2);
    expect(result.status!.isDirty).toBe(true);
    expect(result.status!.headState).toBe('conflict');
  });

  it('returns detached HEAD state from reader', async () => {
    fakeReader.setStatus({
      stagedCount: 0,
      unstagedCount: 0,
      untrackedCount: 0,
      conflictedCount: 0,
      isDirty: false,
      currentBranch: null,
      headState: 'detached',
      detachedCommitHash: 'abc1234',
    });
    fakeReader.setBranches([
      { name: 'main', isCurrent: false },
      { name: 'feat/a', isCurrent: false },
    ]);
    fakeReader.setCommits([]);
    fakeReader.setError(null);

    const result = await useCase.execute('/some/repo');

    expect(result.status!.headState).toBe('detached');
    expect(result.status!.detachedCommitHash).toBe('abc1234');
    expect(result.status!.currentBranch).toBeNull();
    expect(result.branches).toHaveLength(2);
  });

  it('returns unborn HEAD state from reader', async () => {
    fakeReader.setStatus({
      stagedCount: 0,
      unstagedCount: 0,
      untrackedCount: 0,
      conflictedCount: 0,
      isDirty: false,
      currentBranch: null,
      headState: 'unborn',
    });
    fakeReader.setBranches([]);
    fakeReader.setCommits([]);
    fakeReader.setError(null);

    const result = await useCase.execute('/some/repo');

    expect(result.status!.headState).toBe('unborn');
    expect(result.branches).toHaveLength(0);
    expect(result.commits).toHaveLength(0);
  });

  it('handles adapter error gracefully', async () => {
    fakeReader.setError(new Error('not a git repository'));
    fakeReader.setStatus(null);
    fakeReader.setBranches([]);
    fakeReader.setCommits([]);

    const result = await useCase.execute('/bad/path');

    expect(result.status).toBeNull();
    expect(result.error).not.toBeNull();
    expect(result.error!.errorCode).toBe('READ_ERROR');
  });

  it('includes readAt timestamp in result', async () => {
    fakeReader.setStatus({
      stagedCount: 0,
      unstagedCount: 0,
      untrackedCount: 0,
      conflictedCount: 0,
      isDirty: false,
      currentBranch: 'main',
      headState: 'clean',
    });
    fakeReader.setBranches([]);
    fakeReader.setCommits([]);
    fakeReader.setError(null);

    const result = await useCase.execute('/some/repo');

    expect(result.readAt).toBeDefined();
    expect(typeof result.readAt).toBe('string');
    // Should be a valid ISO date string
    expect(new Date(result.readAt!).getTime()).not.toBeNaN();
  });

  it('default comparison is HEAD vs working tree when both slots unassigned', async () => {
    fakeReader.setStatus({
      stagedCount: 0,
      unstagedCount: 0,
      untrackedCount: 0,
      conflictedCount: 0,
      isDirty: false,
      currentBranch: 'main',
      headState: 'clean',
    });
    fakeReader.setBranches([{ name: 'main', isCurrent: true }]);
    fakeReader.setCommits([]);
    fakeReader.setError(null);

    const result = await useCase.execute('/some/repo');

    expect(result.defaultComparison).toBeDefined();
    expect(result.defaultComparison!.base).toEqual({ type: 'head', value: 'HEAD', label: 'HEAD' });
    expect(result.defaultComparison!.target).toEqual({
      type: 'working-tree',
      value: 'working-tree',
      label: 'working tree',
    });
    expect(result.defaultComparison!.comparisonType).toBe('working-tree-vs-head');
  });
});
