import { beforeEach, describe, expect, it } from 'vitest';

import type {
  GitValidationResult,
  GitValidator,
} from '../../../../src/lib/server/application/git-validator';
import { GetWorkspaceUseCase } from '../../../../src/lib/server/application/services/get-workspace-use-case';
import { ListWorkspacesUseCase } from '../../../../src/lib/server/application/services/list-workspaces-use-case';
import { RegisterWorkspaceUseCase } from '../../../../src/lib/server/application/services/register-workspace-use-case';
import { RepairWorkspacePathUseCase } from '../../../../src/lib/server/application/services/repair-workspace-path-use-case';
import { DuplicateWorkspaceError } from '../../../../src/lib/server/domain/errors/duplicate-workspace-error';
import { InvalidWorkspacePathError } from '../../../../src/lib/server/domain/errors/invalid-workspace-path-error';
import { WorkspaceNotFoundError } from '../../../../src/lib/server/domain/errors/workspace-not-found-error';
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

describe('List / Get / Repair use cases', () => {
  let repo: FakeWorkspaceRepository;
  let gitValidator: FakeGitValidator;
  let register: RegisterWorkspaceUseCase;
  let list: ListWorkspacesUseCase;
  let get: GetWorkspaceUseCase;
  let repair: RepairWorkspacePathUseCase;

  beforeEach(() => {
    repo = new FakeWorkspaceRepository();
    gitValidator = new FakeGitValidator();
    register = new RegisterWorkspaceUseCase(repo, gitValidator);
    list = new ListWorkspacesUseCase(repo, gitValidator);
    get = new GetWorkspaceUseCase(repo, gitValidator);
    repair = new RepairWorkspacePathUseCase(repo, gitValidator);
  });

  describe('ListWorkspacesUseCase', () => {
    it('returns an empty list when no workspaces are registered', async () => {
      const result = await list.execute();
      expect(result.workspaces).toHaveLength(0);
    });

    it('lists all registered workspaces with derived status', async () => {
      await register.execute({ repositoryPath: '/tmp/repo-a', displayName: 'Repo A' });
      await register.execute({ repositoryPath: '/tmp/repo-b', displayName: 'Repo B' });

      const result = await list.execute();
      expect(result.workspaces).toHaveLength(2);
    });

    it('marks workspace as valid when Git root exists', async () => {
      const ws = await register.execute({ repositoryPath: '/tmp/valid', displayName: 'Valid' });
      const result = await list.execute();
      const item = result.workspaces.find((w) => w.id === ws.workspace.id);
      expect(item?.status).toBe('valid');
    });

    it('marks workspace as invalid when path does not exist', async () => {
      await register.execute({ repositoryPath: '/tmp/was-valid', displayName: 'Will Vanish' });
      gitValidator.setResult('/tmp/was-valid', {
        isValid: false,
        isRoot: false,
        error: 'Path does not exist',
      });

      const result = await list.execute();
      const item = result.workspaces.find((w) => w.displayName === 'Will Vanish');
      expect(item?.status).toBe('invalid');
    });

    it('revalidates workspace when path becomes valid again', async () => {
      await register.execute({ repositoryPath: '/tmp/reappear', displayName: 'Reappear' });
      gitValidator.setResult('/tmp/reappear', { isValid: false, isRoot: false });
      const beforeResult = await list.execute();
      expect(beforeResult.workspaces[0].status).toBe('invalid');

      gitValidator.setResult('/tmp/reappear', { isValid: true, isRoot: true });
      const afterResult = await list.execute();
      expect(afterResult.workspaces[0].status).toBe('valid');
    });
  });

  describe('GetWorkspaceUseCase', () => {
    it('returns null when workspace is not found', async () => {
      const result = await get.execute({ id: 'non-existent-id' });
      expect(result.workspace).toBeNull();
    });

    it('returns workspace details by id', async () => {
      const ws = await register.execute({ repositoryPath: '/tmp/repo', displayName: 'My Repo' });
      const result = await get.execute({ id: ws.workspace.id });
      expect(result.workspace).not.toBeNull();
      expect(result.workspace!.displayName).toBe('My Repo');
      expect(result.workspace!.status).toBe('valid');
    });

    it('returns invalid status when Git root is gone', async () => {
      const ws = await register.execute({
        repositoryPath: '/tmp/will-lose',
        displayName: 'Lose Git',
      });
      gitValidator.setResult('/tmp/will-lose', {
        isValid: false,
        isRoot: false,
        error: 'Not a Git repository',
      });

      const result = await get.execute({ id: ws.workspace.id });
      expect(result.workspace!.status).toBe('invalid');
    });
  });

  describe('RepairWorkspacePathUseCase', () => {
    it('repairs workspace path to a new valid Git root', async () => {
      const ws = await register.execute({
        repositoryPath: '/tmp/old-path',
        displayName: 'Movable',
      });
      const result = await repair.execute({
        id: ws.workspace.id,
        newRepositoryPath: '/tmp/new-path',
      });

      expect(result.workspace.id).toBe(ws.workspace.id);
      expect(result.workspace.displayName).toBe('Movable');
      expect(result.workspace.repositoryPath).toBe('/tmp/new-path');
      expect(result.workspace.status).toBe('valid');
      expect(result.workspace.createdAt).toBe(ws.workspace.createdAt);
    });

    it('throws WorkspaceNotFoundError for unknown id', async () => {
      await expect(
        repair.execute({
          id: '00000000-0000-4000-a000-000000000000',
          newRepositoryPath: '/tmp/new',
        }),
      ).rejects.toThrow(WorkspaceNotFoundError);
    });

    it('throws InvalidWorkspacePathError when new path is not a Git root', async () => {
      const ws = await register.execute({ repositoryPath: '/tmp/old', displayName: 'Old' });
      gitValidator.setResult('/tmp/bad-path', {
        isValid: false,
        isRoot: false,
        error: 'Not a Git repo',
      });

      await expect(
        repair.execute({ id: ws.workspace.id, newRepositoryPath: '/tmp/bad-path' }),
      ).rejects.toThrow(InvalidWorkspacePathError);
    });

    it('throws DuplicateWorkspaceError when new path is already taken', async () => {
      await register.execute({ repositoryPath: '/tmp/taken', displayName: 'Taken' });
      const ws = await register.execute({ repositoryPath: '/tmp/movable', displayName: 'Movable' });

      await expect(
        repair.execute({ id: ws.workspace.id, newRepositoryPath: '/tmp/taken' }),
      ).rejects.toThrow(DuplicateWorkspaceError);
    });

    it('does not alter workspace when repair fails', async () => {
      const ws = await register.execute({
        repositoryPath: '/tmp/original',
        displayName: 'Original',
      });

      try {
        gitValidator.setResult('/tmp/bad', { isValid: false, isRoot: false });
        await repair.execute({ id: ws.workspace.id, newRepositoryPath: '/tmp/bad' });
      } catch {
        // Expected
      }

      const result = await get.execute({ id: ws.workspace.id });
      expect(result.workspace!.repositoryPath).toBe('/tmp/original');
    });
  });
});
