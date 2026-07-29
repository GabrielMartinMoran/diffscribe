export interface WorkspaceListItem {
  id: string;
  displayName: string;
  repositoryPath: string;
  status: 'valid' | 'invalid';
  createdAt: string;
  lastOpenedAt: string;
}

export interface WorkspaceDetail {
  id: string;
  displayName: string;
  repositoryPath: string;
  status: 'valid' | 'invalid';
  createdAt: string;
  lastOpenedAt: string;
}

export interface RegisterWorkspaceResult {
  workspace: WorkspaceDetail;
}

export interface ListWorkspacesResult {
  workspaces: WorkspaceListItem[];
}

export interface GetWorkspaceResult {
  workspace: WorkspaceDetail | null;
}

export interface RepairWorkspaceResult {
  workspace: WorkspaceDetail;
}
