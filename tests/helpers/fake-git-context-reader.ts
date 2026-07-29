import type {
  BranchDto,
  CommitDto,
  GitContextResult,
  StatusDto,
} from '../../src/lib/server/application/dto/results/git-context-results';
import type { GitContextReader } from '../../src/lib/server/application/git-context-reader';

export class FakeGitContextReader implements GitContextReader {
  private _status: StatusDto | null = null;
  private _branches: BranchDto[] = [];
  private _commits: CommitDto[] = [];
  private _error: Error | null = null;

  setStatus(status: StatusDto | null): void {
    this._status = status;
  }

  setBranches(branches: BranchDto[]): void {
    this._branches = branches;
  }

  setCommits(commits: CommitDto[]): void {
    this._commits = commits;
  }

  setError(error: Error | null): void {
    this._error = error;
  }

  async read(repositoryPath: string): Promise<GitContextResult> {
    void repositoryPath;
    if (this._error) {
      return {
        status: null,
        branches: [],
        commits: [],
        headState: 'error',
        error: {
          message: this._error.message,
          errorCode: 'READ_ERROR',
        },
        readAt: new Date().toISOString(),
      };
    }

    return {
      status: this._status,
      branches: this._branches,
      commits: this._commits,
      headState: this._status ? 'clean' : 'error',
      error: null,
      readAt: new Date().toISOString(),
    };
  }
}
