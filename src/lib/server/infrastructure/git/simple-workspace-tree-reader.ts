import { existsSync } from 'node:fs';

import { simpleGit } from 'simple-git';

import type {
  WorkspaceTreeNode,
  WorkspaceTreeResult,
} from '$lib/server/application/dto/results/workspace-tree-results';
import type { WorkspaceTreeReader } from '$lib/server/application/workspace-tree-reader';

export class SimpleWorkspaceTreeReader implements WorkspaceTreeReader {
  async readTree(repositoryPath: string): Promise<WorkspaceTreeResult> {
    const readAt = new Date().toISOString();

    if (!existsSync(repositoryPath)) {
      return {
        tree: [],
        readAt,
        error: { message: 'Repository path does not exist', errorCode: 'PATH_NOT_FOUND' },
      };
    }

    const git = simpleGit({ baseDir: repositoryPath });

    try {
      const isRepo = await git.checkIsRepo();
      if (!isRepo) {
        return {
          tree: [],
          readAt,
          error: { message: 'Not a Git repository', errorCode: 'NOT_A_GIT_REPOSITORY' },
        };
      }
    } catch {
      return {
        tree: [],
        readAt,
        error: { message: 'Git error checking repository', errorCode: 'NOT_A_GIT_REPOSITORY' },
      };
    }

    try {
      return await this.readTreeFromRepo(git, repositoryPath, readAt);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unknown Git error';
      return {
        tree: [],
        readAt,
        error: { message, errorCode: 'GIT_ERROR' },
      };
    }
  }

  private async readTreeFromRepo(
    git: ReturnType<typeof simpleGit>,
    repositoryPath: string,
    readAt: string,
  ): Promise<WorkspaceTreeResult> {
    // Get tracked files from the index
    const trackedRaw = await git.raw('ls-files', '--cached', '-z');
    // Get untracked files not ignored
    const untrackedRaw = await git.raw('ls-files', '--others', '--exclude-standard', '-z');

    const trackedPaths = this.splitNull(trackedRaw);
    const untrackedPaths = this.splitNull(untrackedRaw);

    const tree = this.buildTree(trackedPaths, untrackedPaths);

    return { tree, readAt };
  }

  private splitNull(raw: string): string[] {
    if (!raw) return [];
    return raw.split('\0').filter(Boolean);
  }

  private buildTree(trackedPaths: string[], untrackedPaths: string[]): WorkspaceTreeNode[] {
    const trackedSet = new Set(trackedPaths);
    const allPaths = [...new Set([...trackedPaths, ...untrackedPaths])].sort();

    const root = new Map<string, WorkspaceTreeNode>();

    for (const filePath of allPaths) {
      const segments = filePath.split('/');
      const isTracked = trackedSet.has(filePath);

      this.insertPath(root, segments, 0, filePath, isTracked);
    }

    return this.sortEntries([...root.values()]);
  }

  private insertPath(
    parent: Map<string, WorkspaceTreeNode>,
    segments: string[],
    index: number,
    fullPath: string,
    isTracked: boolean,
  ): void {
    const segment = segments[index];
    const isLast = index === segments.length - 1;

    if (isLast) {
      // File node
      if (!parent.has(segment)) {
        parent.set(segment, {
          name: segment,
          path: fullPath,
          kind: 'file',
          tracked: isTracked,
        });
      } else {
        // If the node exists as a directory placeholder, upgrade tracked info
        const existing = parent.get(segment)!;
        if (existing.kind === 'file' && existing.tracked === undefined) {
          existing.tracked = isTracked;
        }
      }
    } else {
      // Directory segment
      if (!parent.has(segment)) {
        parent.set(segment, {
          name: segment,
          path: segments.slice(0, index + 1).join('/'),
          kind: 'directory',
          children: [],
        });
      }

      const node = parent.get(segment)!;
      if (!node.children) {
        node.children = [];
      }

      // Build the children map from existing nodes
      const childrenMap = new Map<string, WorkspaceTreeNode>();
      for (const child of node.children) {
        childrenMap.set(child.name, child);
      }

      this.insertPath(childrenMap, segments, index + 1, fullPath, isTracked);

      node.children = this.sortEntries([...childrenMap.values()]);
    }
  }

  private sortEntries(entries: WorkspaceTreeNode[]): WorkspaceTreeNode[] {
    return entries.sort((a, b) => {
      // Directories come first
      if (a.kind !== b.kind) {
        return a.kind === 'directory' ? -1 : 1;
      }
      // Then alphabetical by name
      return a.name.localeCompare(b.name);
    });
  }
}
