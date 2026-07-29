import { beforeEach, describe, expect, it } from 'vitest';

import type {
  GitValidationResult,
  GitValidator,
} from '../../../../src/lib/server/application/git-validator';
import { DeleteWorkspaceUseCase } from '../../../../src/lib/server/application/services/delete-workspace-use-case';
import { RegisterWorkspaceUseCase } from '../../../../src/lib/server/application/services/register-workspace-use-case';
import { RenameWorkspaceUseCase } from '../../../../src/lib/server/application/services/rename-workspace-use-case';
import { WorkspaceNotFoundError } from '../../../../src/lib/server/domain/errors/workspace-not-found-error';
import { WorkspaceId } from '../../../../src/lib/server/domain/value-objects/workspace-id';
import { FakeAppStateRepository } from '../../../helpers/fake-app-state-repository';
import { FakeWorkspaceRepository } from '../../../helpers/fake-workspace-repository';

class FakeGitValidator implements GitValidator {
  private defaultResult: GitValidationResult = { isValid: true, isRoot: true };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async validate(_repositoryPath: string): Promise<GitValidationResult> {
    return this.defaultResult;
  }
}

describe('RenameWorkspaceUseCase', () => {
  let repo: FakeWorkspaceRepository;
  let register: RegisterWorkspaceUseCase;
  let rename: RenameWorkspaceUseCase;

  beforeEach(() => {
    repo = new FakeWorkspaceRepository();
    const gitValidator = new FakeGitValidator();
    register = new RegisterWorkspaceUseCase(repo, gitValidator);
    rename = new RenameWorkspaceUseCase(repo);
  });

  it('renames a workspace to a valid displayName', async () => {
    const ws = await register.execute({
      repositoryPath: '/tmp/repo-a',
      displayName: 'Old Name',
    });
    const result = await rename.execute({
      id: ws.workspace.id,
      displayName: 'New Name',
    });

    expect(result.workspace.displayName).toBe('New Name');
    expect(result.workspace.id).toBe(ws.workspace.id);
    expect(result.workspace.repositoryPath).toBe(ws.workspace.repositoryPath);
    expect(result.workspace.createdAt).toBe(ws.workspace.createdAt);
  });

  it('throws WorkspaceNotFoundError when workspace does not exist', async () => {
    await expect(
      rename.execute({
        id: '00000000-0000-4000-a000-000000000000',
        displayName: 'New Name',
      }),
    ).rejects.toThrow(WorkspaceNotFoundError);
  });

  it('trims whitespace from displayName', async () => {
    const ws = await register.execute({
      repositoryPath: '/tmp/repo-a',
      displayName: 'Old Name',
    });
    const result = await rename.execute({
      id: ws.workspace.id,
      displayName: '  Trimmed  ',
    });

    expect(result.workspace.displayName).toBe('Trimmed');
  });

  it('rejects empty displayName', async () => {
    const ws = await register.execute({
      repositoryPath: '/tmp/repo-a',
      displayName: 'Old Name',
    });
    await expect(rename.execute({ id: ws.workspace.id, displayName: '' })).rejects.toThrow(
      'displayName',
    );
  });

  it('rejects displayName exceeding 200 characters', async () => {
    const ws = await register.execute({
      repositoryPath: '/tmp/repo-a',
      displayName: 'Old Name',
    });
    const longName = 'a'.repeat(201);
    await expect(rename.execute({ id: ws.workspace.id, displayName: longName })).rejects.toThrow(
      'displayName',
    );
  });
});

describe('DeleteWorkspaceUseCase', () => {
  let repo: FakeWorkspaceRepository;
  let appState: FakeAppStateRepository;
  let register: RegisterWorkspaceUseCase;
  let del: DeleteWorkspaceUseCase;

  beforeEach(() => {
    repo = new FakeWorkspaceRepository();
    appState = new FakeAppStateRepository();
    const gitValidator = new FakeGitValidator();
    register = new RegisterWorkspaceUseCase(repo, gitValidator);
    del = new DeleteWorkspaceUseCase(repo, appState);
  });

  it('deletes a workspace so it is no longer in the repository', async () => {
    const ws = await register.execute({
      repositoryPath: '/tmp/repo-a',
      displayName: 'Repo A',
    });
    await del.execute({ id: ws.workspace.id });
    expect(repo.findById(new WorkspaceId(ws.workspace.id))).toBeNull();
  });

  it('throws WorkspaceNotFoundError when workspace does not exist', async () => {
    await expect(del.execute({ id: '00000000-0000-4000-a000-000000000000' })).rejects.toThrow(
      WorkspaceNotFoundError,
    );
  });

  it('clears active_workspace_id when deleting the active workspace', async () => {
    const ws = await register.execute({
      repositoryPath: '/tmp/repo-a',
      displayName: 'Repo A',
    });
    appState.set('active_workspace_id', ws.workspace.id);

    await del.execute({ id: ws.workspace.id });

    expect(appState.get('active_workspace_id')).toBeNull();
  });

  it('does not clear active_workspace_id when deleting a non-active workspace', async () => {
    const ws = await register.execute({
      repositoryPath: '/tmp/repo-a',
      displayName: 'Repo A',
    });
    const ws2 = await register.execute({
      repositoryPath: '/tmp/repo-b',
      displayName: 'Repo B',
    });
    appState.set('active_workspace_id', ws.workspace.id);

    await del.execute({ id: ws2.workspace.id });

    expect(appState.get('active_workspace_id')).toBe(ws.workspace.id);
  });
});
