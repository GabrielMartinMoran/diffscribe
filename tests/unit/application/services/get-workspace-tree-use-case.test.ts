import { describe, expect, it, vi } from 'vitest';

import type { WorkspaceTreeNode } from '../../../../src/lib/server/application/dto/results/workspace-tree-results';
import { GetWorkspaceTreeUseCase } from '../../../../src/lib/server/application/services/get-workspace-tree-use-case';
import type { WorkspaceTreeReader } from '../../../../src/lib/server/application/workspace-tree-reader';

describe('GetWorkspaceTreeUseCase', () => {
  function makeTreeResult(nodes: WorkspaceTreeNode[]) {
    return {
      tree: nodes,
      readAt: new Date().toISOString(),
    };
  }

  it('delegates to the WorkspaceTreeReader with the repository path', async () => {
    const mockReader: WorkspaceTreeReader = {
      readTree: vi.fn().mockResolvedValue(makeTreeResult([])),
    };
    const useCase = new GetWorkspaceTreeUseCase(mockReader);

    await useCase.execute('/tmp/repo');

    expect(mockReader.readTree).toHaveBeenCalledWith('/tmp/repo');
  });

  it('returns the tree result from the reader', async () => {
    const nodes: WorkspaceTreeNode[] = [
      {
        name: 'src',
        path: 'src',
        kind: 'directory',
        children: [
          {
            name: 'index.ts',
            path: 'src/index.ts',
            kind: 'file',
            tracked: true,
          },
        ],
      },
      {
        name: 'README.md',
        path: 'README.md',
        kind: 'file',
        tracked: true,
      },
    ];
    const expected = makeTreeResult(nodes);
    const mockReader: WorkspaceTreeReader = {
      readTree: vi.fn().mockResolvedValue(expected),
    };
    const useCase = new GetWorkspaceTreeUseCase(mockReader);

    const result = await useCase.execute('/tmp/repo');

    expect(result).toEqual(expected);
  });

  it('returns an empty tree when the reader returns no nodes', async () => {
    const expected = makeTreeResult([]);
    const mockReader: WorkspaceTreeReader = {
      readTree: vi.fn().mockResolvedValue(expected),
    };
    const useCase = new GetWorkspaceTreeUseCase(mockReader);

    const result = await useCase.execute('/tmp/repo');

    expect(result).toEqual(expected);
  });

  it('handles nested directory structure', async () => {
    const nodes: WorkspaceTreeNode[] = [
      {
        name: 'a',
        path: 'a',
        kind: 'directory',
        children: [
          {
            name: 'b',
            path: 'a/b',
            kind: 'directory',
            children: [
              {
                name: 'c.txt',
                path: 'a/b/c.txt',
                kind: 'file',
                tracked: true,
              },
            ],
          },
        ],
      },
    ];
    const expected = makeTreeResult(nodes);
    const mockReader: WorkspaceTreeReader = {
      readTree: vi.fn().mockResolvedValue(expected),
    };
    const useCase = new GetWorkspaceTreeUseCase(mockReader);

    const result = await useCase.execute('/tmp/repo');

    expect(result).toEqual(expected);
  });

  it('includes untracked files with tracked false', async () => {
    const nodes: WorkspaceTreeNode[] = [
      {
        name: 'scratch.ts',
        path: 'scratch.ts',
        kind: 'file',
        tracked: false,
      },
    ];
    const expected = makeTreeResult(nodes);
    const mockReader: WorkspaceTreeReader = {
      readTree: vi.fn().mockResolvedValue(expected),
    };
    const useCase = new GetWorkspaceTreeUseCase(mockReader);

    const result = await useCase.execute('/tmp/repo');

    expect(result.tree).toHaveLength(1);
    expect(result.tree[0].name).toBe('scratch.ts');
    expect(result.tree[0].tracked).toBe(false);
  });

  it('propagates reader error result', async () => {
    const errorResult = {
      tree: [],
      readAt: new Date().toISOString(),
      error: { message: 'Not a Git repository', errorCode: 'NOT_A_GIT_REPOSITORY' },
    };
    const mockReader: WorkspaceTreeReader = {
      readTree: vi.fn().mockResolvedValue(errorResult),
    };
    const useCase = new GetWorkspaceTreeUseCase(mockReader);

    const result = await useCase.execute('/tmp/repo');

    expect(result.error).toBeDefined();
    expect(result.error!.errorCode).toBe('NOT_A_GIT_REPOSITORY');
  });
});
