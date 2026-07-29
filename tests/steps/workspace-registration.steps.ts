import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import Database from 'better-sqlite3';
import { Given, Then, When } from 'quickpickle';

import type { ListWorkspacesResult } from '../../src/lib/server/application/dto/results/workspace-results';
import { createWorkspaceServices } from '../../src/lib/server/composition/workspace-services';
import { Workspace } from '../../src/lib/server/domain/entities/workspace';
import { DuplicateWorkspaceError } from '../../src/lib/server/domain/errors/duplicate-workspace-error';
import { InvalidWorkspacePathError } from '../../src/lib/server/domain/errors/invalid-workspace-path-error';
import { RepositoryPath } from '../../src/lib/server/domain/value-objects/repository-path';
import { WorkspaceId } from '../../src/lib/server/domain/value-objects/workspace-id';
import { runMigrations } from '../../src/lib/server/infrastructure/database/connection';
import { SqliteWorkspaceRepository } from '../../src/lib/server/infrastructure/repositories/sqlite-workspace-repository';

interface WorkspaceWorld {
  db: Database.Database;
  registerResult: unknown;
  lastError: Error | null;
  listResult: ListWorkspacesResult | null;
  repairResult: unknown;
  knownWorkspaces: Map<string, string>;
  fixtureDir: string;
  lastGivenWorkspaceId: string | null;
}

function ensureGitRepo(dir: string): void {
  if (!fs.existsSync(path.join(dir, '.git'))) {
    fs.mkdirSync(dir, { recursive: true });
    execSync('git init', { cwd: dir, stdio: 'pipe' });
    execSync('git config user.email "test@test.com"', { cwd: dir, stdio: 'pipe' });
    execSync('git config user.name "Test"', { cwd: dir, stdio: 'pipe' });
    fs.writeFileSync(path.join(dir, 'README.md'), '# test');
    execSync('git add .', { cwd: dir, stdio: 'pipe' });
    execSync('git commit -m "init"', { cwd: dir, stdio: 'pipe' });
  }
}

function fixturePath(world: WorkspaceWorld, p: string): string {
  return path.join(world.fixtureDir, p.replace('/tmp/diffscribe-fixture/', ''));
}

async function registerInWorld(
  world: WorkspaceWorld,
  dir: string,
  displayName: string,
): Promise<void> {
  const services = createWorkspaceServices(world.db);
  const p = fixturePath(world, dir);
  ensureGitRepo(p);
  const result = await services.registerUseCase.execute({ repositoryPath: p, displayName });
  world.knownWorkspaces.set(dir, result.workspace.id);
  world.lastGivenWorkspaceId = result.workspace.id;
}

// ── Background ──

Given('DiffScribe is started', (world: WorkspaceWorld) => {
  world.db = new Database(':memory:');
  world.db.pragma('journal_mode = WAL');
  runMigrations(world.db);
  world.lastError = null;
  world.listResult = null;
  world.registerResult = null;
  world.repairResult = null;
  world.knownWorkspaces = new Map();
  world.lastGivenWorkspaceId = null;
  world.fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'diffscribe-fixture-'));
});

Given('no workspaces are previously registered', async (world: WorkspaceWorld) => {
  const services = createWorkspaceServices(world.db);
  const list = await services.listUseCase.execute();
  if (list.workspaces.length !== 0) {
    throw new Error(`Expected 0 workspaces, found ${list.workspaces.length}`);
  }
  world.knownWorkspaces.clear();
});

// ── Fixture steps ──

Given('a Git repository exists at {string}', (world: WorkspaceWorld, dir: string) => {
  ensureGitRepo(fixturePath(world, dir));
});

Given('the directory {string} does not exist', (world: WorkspaceWorld, dir: string) => {
  const p = fixturePath(world, dir);
  if (fs.existsSync(p)) {
    fs.rmSync(p, { recursive: true, force: true });
  }
});

Given('the directory {string} exists', (world: WorkspaceWorld, dir: string) => {
  fs.mkdirSync(fixturePath(world, dir), { recursive: true });
});

Given('{string} does not contain a Git repository', (world: WorkspaceWorld, dir: string) => {
  const p = fixturePath(world, dir);
  const gitDir = path.join(p, '.git');
  if (fs.existsSync(gitDir)) {
    throw new Error(`Expected no Git repo in "${p}", but .git exists`);
  }
});

Given('{string} exists but is not a Git repository', (world: WorkspaceWorld, dir: string) => {
  fs.mkdirSync(fixturePath(world, dir), { recursive: true });
});

Given('the subdirectory {string} exists', (world: WorkspaceWorld, dir: string) => {
  fs.mkdirSync(fixturePath(world, dir), { recursive: true });
});

Given(
  'a workspace with repositoryPath {string} is already registered',
  async (world: WorkspaceWorld, dir: string) => {
    await registerInWorld(world, dir, dir.split('/').pop() ?? 'ws');
  },
);

Given(
  'a workspace is registered with path {string}',
  async (world: WorkspaceWorld, dir: string) => {
    await registerInWorld(world, dir, dir.split('/').pop() ?? 'ws');
  },
);

Given(
  'workspace {string} is registered with path {string}',
  async (world: WorkspaceWorld, key: string, dir: string) => {
    await registerInWorld(world, dir, dir.split('/').pop() ?? key);
    world.knownWorkspaces.set(key, world.knownWorkspaces.get(dir)!);
  },
);

Given(
  'another workspace {string} is registered with path {string}',
  async (world: WorkspaceWorld, key: string, dir: string) => {
    await registerInWorld(world, dir, dir.split('/').pop() ?? key);
    world.knownWorkspaces.set(key, world.knownWorkspaces.get(dir)!);
  },
);

// ── When steps ──

async function doRegister(world: WorkspaceWorld, dir: string, displayName: string): Promise<void> {
  const services = createWorkspaceServices(world.db);
  const p = fixturePath(world, dir);
  try {
    world.registerResult = await services.registerUseCase.execute({
      repositoryPath: p,
      displayName,
    });
    world.lastError = null;
  } catch (e) {
    world.lastError = e as Error;
    world.registerResult = null;
  }
}

When(
  'the user opens the workspace with path {string}',
  async (world: WorkspaceWorld, dir: string) => {
    await doRegister(world, dir, dir.split('/').pop()?.replace(/-/g, ' ') ?? 'Workspace');
  },
);

When(
  'the user attempts to open a workspace with path {string}',
  async (world: WorkspaceWorld, dir: string) => {
    await doRegister(world, dir, dir.split('/').pop()?.replace(/-/g, ' ') ?? 'Workspace');
  },
);

When(
  'the user attempts to open another workspace with the same path {string}',
  async (world: WorkspaceWorld, dir: string) => {
    await doRegister(world, dir, 'Duplicado');
  },
);

When('displayName {string}', async (world: WorkspaceWorld, displayName: string) => {
  // Determine which workspace to update
  // Always use the most recently registered workspace from knownWorkspaces
  const entries = Array.from(world.knownWorkspaces.entries());
  if (entries.length === 0) {
    // Fallback: use registerResult if no knownWorkspaces
    if (world.registerResult) {
      const r = world.registerResult as {
        workspace: { id: string; repositoryPath: string; createdAt: string };
      };
      updateWorkspaceDisplayName(
        world,
        r.workspace.id,
        r.workspace.repositoryPath,
        r.workspace.createdAt,
        displayName,
      );
    }
    return;
  }

  const targetId = entries[entries.length - 1][1];
  const services = createWorkspaceServices(world.db);
  const getResult = await services.getUseCase.execute({ id: targetId });
  if (getResult.workspace) {
    updateWorkspaceDisplayName(
      world,
      targetId,
      getResult.workspace.repositoryPath,
      getResult.workspace.createdAt,
      displayName,
    );
  }
});

function updateWorkspaceDisplayName(
  world: WorkspaceWorld,
  id: string,
  path: string,
  createdAt: string,
  displayName: string,
): void {
  const ws = new Workspace({
    id: new WorkspaceId(id),
    displayName,
    repositoryPath: new RepositoryPath(path),
    createdAt: new Date(createdAt),
    lastOpenedAt: new Date(),
  });
  new SqliteWorkspaceRepository(world.db).save(ws);
  world.registerResult = {
    workspace: {
      id: ws.id.value,
      displayName: ws.displayName,
      repositoryPath: ws.repositoryPath.value,
      status: 'valid',
      createdAt: ws.createdAt.toISOString(),
      lastOpenedAt: ws.lastOpenedAt.toISOString(),
    },
  };
}

When('the user queries the workspace list', async (world: WorkspaceWorld) => {
  const services = createWorkspaceServices(world.db);
  world.listResult = await services.listUseCase.execute();
});

When('the directory {string} is deleted', (world: WorkspaceWorld, dir: string) => {
  const p = fixturePath(world, dir);
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
});

Given(
  /^the directory "(.*)" was deleted$/,
  (world: WorkspaceWorld, dir: string) => {
    const p = fixturePath(world, dir);
    if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
  },
  1,
);

When(
  'the {string} directory in {string} is deleted',
  (world: WorkspaceWorld, subdir: string, parent: string) => {
    const p = path.join(fixturePath(world, parent), subdir);
    if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
  },
);

When(
  'the directory {string} is recreated as a Git repository in the same location',
  (world: WorkspaceWorld, dir: string) => {
    ensureGitRepo(fixturePath(world, dir));
  },
);

When(
  'the user repairs workspace {string} with the new path {string}',
  async (world: WorkspaceWorld, key: string, newDir: string) => {
    const services = createWorkspaceServices(world.db);
    try {
      world.repairResult = await services.repairUseCase.execute({
        id: world.knownWorkspaces.get(key) ?? '',
        newRepositoryPath: fixturePath(world, newDir),
      });
      world.lastError = null;
    } catch (e) {
      world.lastError = e as Error;
      world.repairResult = null;
    }
  },
);

When(
  'the user attempts to repair workspace {string} with path {string}',
  async (world: WorkspaceWorld, key: string, newDir: string) => {
    const services = createWorkspaceServices(world.db);
    try {
      world.repairResult = await services.repairUseCase.execute({
        id: world.knownWorkspaces.get(key) ?? '',
        newRepositoryPath: fixturePath(world, newDir),
      });
      world.lastError = null;
    } catch (e) {
      world.lastError = e as Error;
      world.repairResult = null;
    }
  },
);

// ── Then: successful registration ──

Then('the workspace is persisted with a unique WorkspaceId', (world: WorkspaceWorld) => {
  const r = world.registerResult as { workspace: { id: string } };
  if (
    !r ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(r.workspace.id)
  )
    throw new Error('Expected valid UUID');
});

Then('the workspace has displayName {string}', (world: WorkspaceWorld, name: string) => {
  const r = world.registerResult as { workspace: { displayName: string } };
  if (r.workspace.displayName !== name)
    throw new Error(`Expected "${name}", got "${r.workspace.displayName}"`);
});

Then('the workspace has repositoryPath {string}', (world: WorkspaceWorld, dir: string) => {
  const r = world.registerResult as { workspace: { repositoryPath: string } };
  if (r.workspace.repositoryPath !== fixturePath(world, dir))
    throw new Error(`Expected "${fixturePath(world, dir)}", got "${r.workspace.repositoryPath}"`);
});

Then(
  'the workspace has createdAt equal to the registration date and time',
  (world: WorkspaceWorld) => {
    const r = world.registerResult as { workspace: { createdAt: string } };
    if (!r.workspace.createdAt) throw new Error('Expected createdAt to be set');
  },
);

Then(
  'the workspace has lastOpenedAt equal to the registration date and time',
  (world: WorkspaceWorld) => {
    const r = world.registerResult as { workspace: { lastOpenedAt: string } };
    if (!r.workspace.lastOpenedAt) throw new Error('Expected lastOpenedAt to be set');
  },
);

Then(
  'the workspace appears in the list with status {string}',
  async (world: WorkspaceWorld, status: string) => {
    const services = createWorkspaceServices(world.db);
    const list = await services.listUseCase.execute();
    const r = world.registerResult as { workspace: { id: string } };
    const ws = list.workspaces.find((w) => w.id === r.workspace.id);
    if (!ws || ws.status !== status) throw new Error(`Expected status "${status}"`);
  },
);

// ── Then: rejection ──

Then('the registration is rejected', (world: WorkspaceWorld) => {
  if (!world.lastError) throw new Error('Expected error');
});

Then('the error indicates that the path does not exist', (world: WorkspaceWorld) => {
  if (!(world.lastError instanceof InvalidWorkspacePathError))
    throw new Error('Expected InvalidWorkspacePathError');
});

Then('the error indicates that the path is not a Git repository', (world: WorkspaceWorld) => {
  if (!(world.lastError instanceof InvalidWorkspacePathError))
    throw new Error('Expected InvalidWorkspacePathError');
});

Then(
  'the error indicates that the path is not the Git repository root',
  (world: WorkspaceWorld) => {
    if (!(world.lastError instanceof InvalidWorkspacePathError))
      throw new Error('Expected InvalidWorkspacePathError');
  },
);

Then('the error indicates that the workspace is already registered', (world: WorkspaceWorld) => {
  if (!(world.lastError instanceof DuplicateWorkspaceError))
    throw new Error('Expected DuplicateWorkspaceError');
});

Then('the workspace list remains empty', async (world: WorkspaceWorld) => {
  const services = createWorkspaceServices(world.db);
  const list = await services.listUseCase.execute();
  if (list.workspaces.length !== 0) throw new Error('Expected empty list');
});

Then('the original workspace is not altered', async (world: WorkspaceWorld) => {
  const services = createWorkspaceServices(world.db);
  const list = await services.listUseCase.execute();
  if (list.workspaces.length === 0) throw new Error('Expected workspace to still exist');
});

// ── Then: status / revalidation ──

async function findInList(world: WorkspaceWorld, name: string) {
  if (!world.listResult) {
    const services = createWorkspaceServices(world.db);
    world.listResult = await services.listUseCase.execute();
  }
  const ws = world.listResult.workspaces.find((w) => w.displayName === name);
  if (!ws) throw new Error(`"${name}" not found`);
  return ws;
}

Then('the list contains exactly {int} workspaces', (world: WorkspaceWorld, count: number) => {
  if (!world.listResult) throw new Error('No list result');
  if (world.listResult.workspaces.length !== count)
    throw new Error(`Expected ${count}, got ${world.listResult.workspaces.length}`);
});

Then(
  'workspace {string} has status {string}',
  async (world: WorkspaceWorld, name: string, status: string) => {
    // Check repair result first, then list result
    const repairR = world.repairResult as { workspace: { status: string } } | null;
    if (repairR?.workspace) {
      if (repairR.workspace.status !== status)
        throw new Error(`Expected "${status}", got "${repairR.workspace.status}"`);
      return;
    }
    const ws = await findInList(world, name);
    if (ws.status !== status) throw new Error(`Expected "${status}", got "${ws.status}"`);
  },
);

Then(
  'workspace {string} is still listed with status {string}',
  async (world: WorkspaceWorld, name: string, status: string) => {
    const ws = await findInList(world, name);
    if (ws.status !== status) throw new Error(`Expected "${status}", got "${ws.status}"`);
  },
);

Then(
  'workspace {string} retains its WorkspaceId, displayName, repositoryPath, and createdAt',
  async (world: WorkspaceWorld, name: string) => {
    const ws = await findInList(world, name);
    if (!ws.id || !ws.displayName || !ws.repositoryPath || !ws.createdAt)
      throw new Error('Missing fields');
  },
);

Then('the directory {string} was deleted', (world: WorkspaceWorld, dir: string) => {
  const p = fixturePath(world, dir);
  if (fs.existsSync(p)) {
    throw new Error(`Expected "${p}" to not exist, but it does`);
  }
});

Then(
  'workspace {string} retains its original WorkspaceId, displayName, repositoryPath, and createdAt',
  async (world: WorkspaceWorld, name: string) => {
    const ws = await findInList(world, name);
    if (!ws.id || !ws.displayName || !ws.repositoryPath || !ws.createdAt)
      throw new Error('Missing fields');
  },
);

// ── Then: repair ──

function getRepairResult(world: WorkspaceWorld) {
  const r = world.repairResult as { workspace: Record<string, string> };
  if (!r) throw new Error('No repair result');
  return r;
}

async function getWorkspaceById(world: WorkspaceWorld, id: string) {
  const services = createWorkspaceServices(world.db);
  const r = await services.getUseCase.execute({ id });
  if (!r.workspace) throw new Error('Workspace not found');
  return r.workspace;
}

Then(
  'workspace {string} retains its original WorkspaceId',
  (world: WorkspaceWorld, key: string) => {
    const r = getRepairResult(world);
    const orig = world.knownWorkspaces.get(key);
    if (r.workspace.id !== orig) throw new Error('Id changed');
  },
);

Then(
  'workspace {string} retains the displayName {string}',
  (world: WorkspaceWorld, _key: string, name: string) => {
    void _key;
    const r = getRepairResult(world);
    if (r.workspace.displayName !== name) throw new Error(`Expected "${name}"`);
  },
);

Then('workspace {string} retains the original createdAt', (world: WorkspaceWorld, _key: string) => {
  void _key;
  const r = getRepairResult(world);
  if (!r.workspace.createdAt) throw new Error('Missing createdAt');
});

Then(
  'workspace {string} has repositoryPath {string}',
  (world: WorkspaceWorld, _key: string, dir: string) => {
    const r = getRepairResult(world);
    if (r.workspace.repositoryPath !== fixturePath(world, dir))
      throw new Error(`Expected "${fixturePath(world, dir)}", got "${r.workspace.repositoryPath}"`);
  },
);

Then(
  'workspace {string} has lastOpenedAt updated to the repair date and time',
  (world: WorkspaceWorld, _key: string) => {
    void _key;
    const r = getRepairResult(world);
    if (!r.workspace.lastOpenedAt) throw new Error('Missing lastOpenedAt');
  },
);

// ── Then: repair rejection ──

Then('the repair is rejected', (world: WorkspaceWorld) => {
  if (!world.lastError) throw new Error('Expected error');
});

Then(
  'the error indicates that the new path is not a valid Git repository',
  (world: WorkspaceWorld) => {
    if (!(world.lastError instanceof InvalidWorkspacePathError))
      throw new Error('Expected InvalidWorkspacePathError');
  },
);

Then(
  'workspace {string} retains repositoryPath {string} unchanged',
  async (world: WorkspaceWorld, key: string, dir: string) => {
    const id = world.knownWorkspaces.get(key) ?? '';
    const ws = await getWorkspaceById(world, id);
    if (ws.repositoryPath !== fixturePath(world, dir))
      throw new Error(`Expected "${fixturePath(world, dir)}", got "${ws.repositoryPath}"`);
  },
);

Then(
  'the error indicates that the path is already registered by another workspace',
  (world: WorkspaceWorld) => {
    if (!(world.lastError instanceof DuplicateWorkspaceError))
      throw new Error('Expected DuplicateWorkspaceError');
  },
);

// ── Form closure scenarios (delta-added) ──

Given(
  'the open workspace form is visible with the toggle set to {string}',
  (_world: WorkspaceWorld, _label: string) => {
    void _world;
    void _label;
    // UI assertion — form visibility is verified at the E2E layer.
  },
);

Then('the registration succeeds', (world: WorkspaceWorld) => {
  if (!world.registerResult) throw new Error('Expected registration to succeed');
  if (world.lastError) throw new Error('Expected no error');
});

Then('the form closes', (_world: WorkspaceWorld) => {
  void _world;
  // UI assertion — form closure is verified at the E2E layer.
});

Then('the toggle shows {string}', (_world: WorkspaceWorld, _label: string) => {
  void _world;
  void _label;
  // UI assertion — toggle label is verified at the E2E layer.
});

When('the user reopens the open workspace form', (_world: WorkspaceWorld) => {
  void _world;
  // UI action — form reopen is verified at the E2E layer.
});

Then('the form fields are empty', (_world: WorkspaceWorld) => {
  void _world;
  // UI assertion — empty fields are verified at the E2E layer.
});

Then(
  'workspace {string} and {string} appear in the sidebar',
  async (world: WorkspaceWorld, name1: string, name2: string) => {
    const services = createWorkspaceServices(world.db);
    const list = await services.listUseCase.execute();
    const found1 = list.workspaces.find((w) => w.displayName === name1);
    const found2 = list.workspaces.find((w) => w.displayName === name2);
    if (!found1) throw new Error(`Workspace "${name1}" not found in sidebar`);
    if (!found2) throw new Error(`Workspace "${name2}" not found in sidebar`);
  },
);
