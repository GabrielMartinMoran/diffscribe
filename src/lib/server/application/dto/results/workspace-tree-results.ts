export interface WorkspaceTreeNode {
  name: string;
  path: string;
  kind: 'file' | 'directory';
  children?: WorkspaceTreeNode[];
  tracked?: boolean;
}

export interface WorkspaceTreeError {
  message: string;
  errorCode: string;
}

export interface WorkspaceTreeResult {
  tree: WorkspaceTreeNode[];
  readAt: string;
  error?: WorkspaceTreeError;
}
