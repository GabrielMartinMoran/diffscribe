import { beforeEach, describe, expect, it } from 'vitest';

import type {
  GitValidationResult,
  GitValidator,
} from '../../../../src/lib/server/application/git-validator';
import { RegisterWorkspaceUseCase } from '../../../../src/lib/server/application/services/register-workspace-use-case';
import { DuplicateWorkspaceError } from '../../../../src/lib/server/domain/errors/duplicate-workspace-error';
import { InvalidWorkspacePathError } from '../../../../src/lib/server/domain/errors/invalid-workspace-path-error';
import { FakeWorkspaceRepository } from '../../../helpers/fake-workspace-repository';

class FakeGitValidator implements GitValidator {
  private results: Map<string, GitValidationResult> = new Map();
  private defaultResult: GitValidationResult = { isValid: true, isRoot: true };

  async validate(repositoryPath: string): Promise<GitValidationResult> {
    return this.results.get(repositoryPath) ?? this.defaultResult;
  }

  setResult(path: string, result: GitValidationResult): void {
    this.results.set(path, result);
  }
}

describe('RegisterWorkspaceUseCase', () => {
  let repo: FakeWorkspaceRepository;
  let gitValidator: FakeGitValidator;
  let useCase: RegisterWorkspaceUseCase;

  beforeEach(() => {
    repo = new FakeWorkspaceRepository();
    gitValidator = new FakeGitValidator();
    useCase = new RegisterWorkspaceUseCase(repo, gitValidator);
  });

  it('registers a new workspace with a valid Git root path', async () => {
    const result = await useCase.execute({
      repositoryPath: '/home/user/repo',
      displayName: 'My Repo',
    });

    expect(result.workspace.displayName).toBe('My Repo');
    expect(result.workspace.repositoryPath).toBe('/home/user/repo');
    expect(result.workspace.status).toBe('valid');
    expect(result.workspace.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(result.workspace.createdAt).toBeTruthy();
    expect(result.workspace.lastOpenedAt).toBeTruthy();
  });

  it('persists the workspace', async () => {
    const result = await useCase.execute({
      repositoryPath: '/home/user/repo',
      displayName: 'My Repo',
    });

    const saved = repo.findById({ value: result.workspace.id } as never);
    expect(saved).not.toBeNull();
    expect(saved!.displayName).toBe('My Repo');
  });

  it('throws InvalidWorkspacePathError when path does not exist', async () => {
    gitValidator.setResult('/tmp/nonexistent', {
      isValid: false,
      isRoot: false,
      error: 'Path does not exist',
    });

    await expect(
      useCase.execute({
        repositoryPath: '/tmp/nonexistent',
        displayName: 'Bad Repo',
      }),
    ).rejects.toThrow(InvalidWorkspacePathError);
  });

  it('throws InvalidWorkspacePathError when path is not a Git repo', async () => {
    gitValidator.setResult('/tmp/nogit', {
      isValid: false,
      isRoot: false,
      error: 'Not a Git repository',
    });

    await expect(
      useCase.execute({
        repositoryPath: '/tmp/nogit',
        displayName: 'No Git',
      }),
    ).rejects.toThrow(InvalidWorkspacePathError);
  });

  it('throws InvalidWorkspacePathError when path is not the Git root', async () => {
    gitValidator.setResult('/home/user/repo/src', {
      isValid: true,
      isRoot: false,
      error: 'Path is not the root of the repository',
    });

    await expect(
      useCase.execute({
        repositoryPath: '/home/user/repo/src',
        displayName: 'Subdir',
      }),
    ).rejects.toThrow(InvalidWorkspacePathError);
  });

  it('throws DuplicateWorkspaceError when path is already registered', async () => {
    await useCase.execute({
      repositoryPath: '/home/user/repo',
      displayName: 'First',
    });

    await expect(
      useCase.execute({
        repositoryPath: '/home/user/repo',
        displayName: 'Duplicate',
      }),
    ).rejects.toThrow(DuplicateWorkspaceError);
  });
});
