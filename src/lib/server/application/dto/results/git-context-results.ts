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
  /** Visible short label (e.g. "dev" or "origin/dev"). Never a full ref. */
  name: string;
  /**
   * Canonical Git ref used as the selection value/key
   * (e.g. "refs/heads/dev" or "refs/remotes/origin/dev"). Distinct values
   * prevent collisions such as a local branch and a cached remote branch
   * that share the same visible name.
   */
  canonicalRef: string;
  isCurrent: boolean;
  /** True for branches read from locally cached `refs/remotes/*`. */
  isRemote?: boolean;
  /** Remote name for remote branches (e.g. "origin"), when known. */
  remoteName?: string;
  /**
   * Committer date serialized as ISO-8601 UTC (e.g. "2026-08-02T10:00:00.000Z").
   * Omitted when the ref has no committer date.
   */
  committerDate?: string;
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
