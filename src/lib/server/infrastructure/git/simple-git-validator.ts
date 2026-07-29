import { existsSync } from 'node:fs';
import path from 'node:path';

import { simpleGit } from 'simple-git';

import type { GitValidationResult, GitValidator } from '$lib/server/application/git-validator';

export class SimpleGitValidator implements GitValidator {
  async validate(repositoryPath: string): Promise<GitValidationResult> {
    const resolved = path.resolve(repositoryPath);

    if (!existsSync(resolved)) {
      return {
        isValid: false,
        isRoot: false,
        error: `Path does not exist: ${resolved}`,
      };
    }

    try {
      const git = simpleGit({ baseDir: resolved });
      const isRepo = await git.checkIsRepo();
      if (!isRepo) {
        return {
          isValid: false,
          isRoot: false,
          error: 'Path is not a Git repository',
        };
      }

      const topLevel = (await git.revparse(['--show-toplevel'])).trim();
      const normalizedTop = path.resolve(topLevel);
      const normalizedPath = path.resolve(resolved);

      if (normalizedPath === normalizedTop) {
        return { isValid: true, isRoot: true };
      }

      return {
        isValid: true,
        isRoot: false,
        error: 'Path is inside a Git repository but is not the root',
      };
    } catch {
      return {
        isValid: false,
        isRoot: false,
        error: 'Path is not a Git repository',
      };
    }
  }
}
