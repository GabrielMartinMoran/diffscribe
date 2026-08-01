import type { FileListEntry } from '$lib/server/application/dto/results/file-list-results';

/**
 * Tree representation of the file list: entries grouped by directory.
 * Directories sort before files; siblings sort alphabetically.
 */

export type FileTreeNode = {
  name: string;
  path: string;
  kind: 'directory' | 'file';
  entry?: FileListEntry;
  children: FileTreeNode[];
};

function insert(node: FileTreeNode, segments: string[], entry: FileListEntry): void {
  const [head, ...rest] = segments;
  const fullPath = node.path === '' ? head : `${node.path}/${head}`;
  let child = node.children.find((c) => c.name === head);
  if (!child) {
    child = {
      name: head,
      path: fullPath,
      kind: rest.length > 0 ? 'directory' : 'file',
      children: [],
      ...(rest.length === 0 ? { entry } : {}),
    };
    node.children.push(child);
  } else if (rest.length === 0) {
    child.entry = entry;
    child.kind = 'file';
  }
  if (rest.length > 0) {
    child.kind = 'directory';
    insert(child, rest, entry);
  }
}

function sortNodes(nodes: FileTreeNode[]): void {
  nodes.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  for (const node of nodes) {
    sortNodes(node.children);
  }
}

export function buildFileTree(entries: FileListEntry[]): FileTreeNode[] {
  const root: FileTreeNode = { name: '', path: '', kind: 'directory', children: [] };
  for (const entry of entries) {
    const segments = entry.path.split('/').filter((s) => s.length > 0);
    if (segments.length === 0) continue;
    insert(root, segments, entry);
  }
  sortNodes(root.children);
  return root.children;
}
