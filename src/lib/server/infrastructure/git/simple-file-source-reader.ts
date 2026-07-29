import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { simpleGit } from 'simple-git';

import type {
  FileSourceReader,
  FileSourceReaderReadParams,
  SourceFileContent,
} from '$lib/server/application/file-source-reader';

const BINARY_CHECK_SIZE = 8000;

function isBinaryContent(filePath: string): boolean {
  try {
    const buf = readFileSync(filePath, { flag: 'r' });
    const maxCheck = Math.min(buf.length, BINARY_CHECK_SIZE);
    for (let i = 0; i < maxCheck; i++) {
      if (buf[i] === 0) return true;
    }
    return false;
  } catch {
    return false;
  }
}

function hasTraversal(relativePath: string): boolean {
  if (relativePath.startsWith('/') || relativePath.startsWith('\\')) return true;
  if (relativePath.includes('..')) return true;
  if (relativePath.includes('~')) return true;
  if (relativePath.includes('\0')) return true;
  return false;
}

export class SimpleFileSourceReader implements FileSourceReader {
  async read(params: FileSourceReaderReadParams): Promise<SourceFileContent> {
    const { repositoryPath, relativePath, ref } = params;

    // Defense-in-depth: reject traversal patterns
    if (hasTraversal(relativePath)) {
      return {
        content: '',
        isBinary: false,
        isDeleted: false,
        error: { message: 'Invalid path', errorCode: 'PATH_INVALID' },
      };
    }

    // Working-tree target: read from disk
    if (ref === 'working-tree') {
      const fullPath = path.join(repositoryPath, relativePath);

      if (!existsSync(fullPath)) {
        // File doesn't exist — check if it was deleted (exists in HEAD)
        const wasTracked = await this.wasTrackedInHead(repositoryPath, relativePath);
        if (wasTracked) {
          return {
            content: '',
            isBinary: false,
            isDeleted: true,
            error: { message: 'File was deleted', errorCode: 'FILE_DELETED' },
          };
        }

        return {
          content: '',
          isBinary: false,
          isDeleted: false,
          error: { message: 'File not found', errorCode: 'FILE_NOT_FOUND' },
        };
      }

      if (isBinaryContent(fullPath)) {
        return { content: '', isBinary: true, isDeleted: false };
      }

      const content = readFileSync(fullPath, 'utf-8');
      return { content, isBinary: false, isDeleted: false };
    }

    // Git ref target: use git show
    return this.readFromGitShow(repositoryPath, relativePath, ref);
  }

  private async wasTrackedInHead(repositoryPath: string, relativePath: string): Promise<boolean> {
    try {
      const git = simpleGit({ baseDir: repositoryPath });
      await git.raw('show', `HEAD:${relativePath}`);
      return true;
    } catch {
      return false;
    }
  }

  private async readFromGitShow(
    repositoryPath: string,
    relativePath: string,
    ref: string,
  ): Promise<SourceFileContent> {
    try {
      const git = simpleGit({ baseDir: repositoryPath });
      const result = await git.raw('show', `${ref}:${relativePath}`);

      if (result === null || result === undefined) {
        return {
          content: '',
          isBinary: false,
          isDeleted: true,
          error: { message: 'File not found at ref', errorCode: 'FILE_NOT_FOUND' },
        };
      }

      // Quick binary check on the content
      const buf = Buffer.from(result, 'utf-8');
      const maxCheck = Math.min(buf.length, BINARY_CHECK_SIZE);
      for (let i = 0; i < maxCheck; i++) {
        if (buf[i] === 0) {
          return { content: '', isBinary: true, isDeleted: false };
        }
      }

      return { content: result, isBinary: false, isDeleted: false };
    } catch {
      return {
        content: '',
        isBinary: false,
        isDeleted: false,
        error: { message: 'Git show command failed', errorCode: 'GIT_ERROR' },
      };
    }
  }
}
