export interface StatusDto {
  stagedCount: number;
  unstagedCount: number;
  untrackedCount: number;
  conflictedCount: number;
  isDirty: boolean;
  currentBranch: string | null;
  headState: 'clean' | 'dirty' | 'detached' | 'unborn' | 'conflict' | 'error';
  detachedCommitHash?: string;
}

export interface BranchDto {
  name: string;
  isCurrent: boolean;
  /** True for branches read from locally cached `refs/remotes/*`. */
  isRemote?: boolean;
  /** Remote name for remote branches (e.g. "origin"), when known. */
  remoteName?: string;
}

export interface CommitDto {
  shortHash: string;
  fullHash: string;
  message: string;
  authorName: string;
  date: string;
}

export interface GitContextErrorDto {
  message: string;
  errorCode: string;
}

export interface GitContextResult {
  status: StatusDto | null;
  branches: BranchDto[];
  commits: CommitDto[];
  headState: StatusDto['headState'];
  error: GitContextErrorDto | null;
  readAt: string;
}
