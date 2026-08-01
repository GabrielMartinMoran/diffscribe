import { describe, expect, it } from 'vitest';

import type { FileListEntry } from '$lib/server/application/dto/results/file-list-results';
import { buildFileTree, type FileTreeNode } from '$lib/web/components/file-list-tree';

function entry(path: string, status = 'modified'): FileListEntry {
  return {
    path,
    status,
    additions: 1,
    deletions: 0,
    binary: false,
    oldPath: null,
  } as unknown as FileListEntry;
}

function names(nodes: FileTreeNode[]): string[] {
  return nodes.map((n) => `${n.kind}:${n.name}`);
}

describe('buildFileTree', () => {
  it('returns an empty tree for no entries', () => {
    expect(buildFileTree([])).toEqual([]);
  });

  it('puts root files at the top level sorted alphabetically', () => {
    const tree = buildFileTree([entry('b.ts'), entry('a.ts')]);
    expect(names(tree)).toEqual(['file:a.ts', 'file:b.ts']);
  });

  it('groups files by their directory', () => {
    const tree = buildFileTree([entry('src/app.ts'), entry('src/lib.ts')]);
    expect(names(tree)).toEqual(['directory:src']);
    expect(tree[0].children.map((c) => c.name)).toEqual(['app.ts', 'lib.ts']);
  });

  it('orders directories before files', () => {
    const tree = buildFileTree([entry('README.md'), entry('src/app.ts')]);
    expect(names(tree)).toEqual(['directory:src', 'file:README.md']);
  });

  it('builds nested directories recursively', () => {
    const tree = buildFileTree([entry('src/components/Button.tsx')]);
    const src = tree[0];
    expect(src.kind).toBe('directory');
    expect(src.children[0].name).toBe('components');
    expect(src.children[0].children[0].name).toBe('Button.tsx');
    expect(src.children[0].children[0].kind).toBe('file');
  });

  it('keeps the full entry on file nodes', () => {
    const e = entry('src/app.ts');
    const tree = buildFileTree([e]);
    const fileNode = tree[0].children[0];
    expect(fileNode.entry).toBe(e);
    expect(fileNode.path).toBe('src/app.ts');
  });

  it('handles files at mixed depths without duplication', () => {
    const tree = buildFileTree([entry('a/b/c.ts'), entry('a/b.ts'), entry('a.ts')]);
    const a = tree[0];
    expect(a.kind).toBe('directory');
    const aChildren = a.children.map((c) => `${c.kind}:${c.name}`);
    expect(aChildren).toEqual(['directory:b', 'file:b.ts']);
    expect(a.children[0].children[0].name).toBe('c.ts');
  });
});
