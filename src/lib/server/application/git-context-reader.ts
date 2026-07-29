import type { GitContextResult } from '$lib/server/application/dto/results/git-context-results';

export interface GitContextReader {
  read(repositoryPath: string): Promise<GitContextResult>;
}
