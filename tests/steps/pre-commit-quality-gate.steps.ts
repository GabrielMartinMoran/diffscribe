import { execSync } from 'node:child_process';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { Given, Then, When } from 'quickpickle';

interface PreCommitWorld {
  tempFilePath: string;
  tempFileOriginalContent: string;
  hookResult: {
    exitCode: number;
    stdout: string;
    stderr: string;
  };
  preHookDirtyFiles: Set<string>;
}

const repoRoot = resolve(import.meta.dirname, '../..');

const TEMP_FILES = [
  resolve(repoRoot, 'tests/_precommit_test_badfmt.js'),
  resolve(repoRoot, 'tests/_precommit_test_badlint.js'),
];

// Remove any leftover temp files from previous scenarios
function preCleanup(): void {
  for (const p of TEMP_FILES) {
    if (existsSync(p)) {
      try {
        execSync(`git rm -f --cached "${p}" 2>/dev/null; true`, {
          cwd: repoRoot,
          encoding: 'utf-8',
        });
      } catch {
        // ok
      }
      try {
        unlinkSync(p);
      } catch {
        // ok
      }
    }
  }
}

// Cleanup after all scenarios: unstage and remove any temp file
function cleanupTempFile(world: PreCommitWorld): void {
  if (world.tempFilePath && existsSync(world.tempFilePath)) {
    try {
      execSync(`git rm -f --cached "${world.tempFilePath}" 2>/dev/null; true`, {
        cwd: repoRoot,
        encoding: 'utf-8',
      });
    } catch {
      // file might not be tracked, that's ok
    }
    try {
      unlinkSync(world.tempFilePath);
    } catch {
      // already gone
    }
  }
}

// ── Background steps ──

Given('the pre-commit hook is configured', () => {
  const hookPath = resolve(repoRoot, '.husky/pre-commit');
  if (!existsSync(hookPath)) {
    throw new Error(`.husky/pre-commit not found at ${hookPath}`);
  }
  try {
    execSync(`test -x "${hookPath}"`, { cwd: repoRoot });
  } catch {
    throw new Error('.husky/pre-commit is not executable');
  }
});

Given('files are staged for commit', () => {
  // ponytail: stages are isolated by test runner; ensure git init exists
  const gitDir = resolve(repoRoot, '.git');
  if (!existsSync(gitDir)) {
    throw new Error('Not a git repository');
  }
  // Clean up any leftover temp files from previous scenarios
  preCleanup();
});

// ── Bad-format file setup ──

Given('there is a file with incorrect formatting staged', (world: PreCommitWorld) => {
  const tempPath = resolve(repoRoot, 'tests/_precommit_test_badfmt.js');
  const badContent = 'const x=1\nconst y=2\n'; // bad formatting: no semicolons, no spaces
  writeFileSync(tempPath, badContent, 'utf-8');
  world.tempFilePath = tempPath;
  world.tempFileOriginalContent = badContent;

  // Stage the file
  execSync(`git add "${tempPath}"`, { cwd: repoRoot });
});

// ── Bad-lint file setup ──

Given('there is a file with a lint error staged', (world: PreCommitWorld) => {
  const tempPath = resolve(repoRoot, 'tests/_precommit_test_badlint.js');
  const badContent = 'const unused = 1;\n'; // unused variable = lint error
  writeFileSync(tempPath, badContent, 'utf-8');
  world.tempFilePath = tempPath;
  world.tempFileOriginalContent = badContent;

  // Stage the file
  execSync(`git add "${tempPath}"`, { cwd: repoRoot });
});

// ── Execute hook ──

When('I run the pre-commit hook', (world: PreCommitWorld) => {
  // Snapshot dirty files before hook execution to detect only
  // hook-introduced changes, not pre-existing working-tree drift.
  const beforeDirty = execSync('git diff --name-only', {
    cwd: repoRoot,
    encoding: 'utf-8',
  }).trim();
  world.preHookDirtyFiles = new Set(beforeDirty ? beforeDirty.split('\n') : []);

  const hookPath = resolve(repoRoot, '.husky/pre-commit');
  try {
    const result = execSync(`sh "${hookPath}"`, {
      cwd: repoRoot,
      encoding: 'utf-8',
      stdio: 'pipe',
    });
    world.hookResult = {
      exitCode: 0,
      stdout: result,
      stderr: '',
    };
  } catch (err: unknown) {
    const e = err as {
      code?: number;
      stdout?: string;
      stderr?: string;
      status?: number;
    };
    world.hookResult = {
      exitCode: e.status ?? e.code ?? 1,
      stdout: (e.stdout as string) ?? '',
      stderr: (e.stderr as string) ?? '',
    };
  }
});

// ── Then assertions ──

Then('the hook exits with code 0', (world: PreCommitWorld) => {
  if (world.hookResult.exitCode !== 0) {
    throw new Error(
      `Expected exit code 0 but got ${world.hookResult.exitCode}\nstdout: ${world.hookResult.stdout}\nstderr: ${world.hookResult.stderr}`,
    );
  }
});

Then('the hook exits with a non-zero code', (world: PreCommitWorld) => {
  if (world.hookResult.exitCode === 0) {
    throw new Error('Expected non-zero exit code but got 0');
  }
});

Then('there are no modified files in the working tree', (world: PreCommitWorld) => {
  // Only fail if the hook introduced NEW dirty files beyond the
  // pre-existing snapshot. This isolates the hook's effect from
  // unrelated implementation work-in-progress in the working tree.
  const afterDirty = execSync('git diff --name-only', {
    cwd: repoRoot,
    encoding: 'utf-8',
  }).trim();
  const afterFiles = new Set(afterDirty ? afterDirty.split('\n') : []);
  const newDirty = [...afterFiles].filter((f) => !world.preHookDirtyFiles.has(f));
  if (newDirty.length > 0) {
    throw new Error(`Hook introduced dirty files:\n${newDirty.join('\n')}`);
  }
  // Cleanup any temp files created during this scenario
  cleanupTempFile(world);
});

Then('the error message contains {string}', (_world: PreCommitWorld, substr: string) => {
  const output = `${_world.hookResult.stdout}\n${_world.hookResult.stderr}`.toLowerCase();
  if (!output.includes(substr.toLowerCase())) {
    throw new Error(
      `Expected output to contain "${substr}" but got:\n${_world.hookResult.stdout}\n${_world.hookResult.stderr}`,
    );
  }
});

Then(
  'the error message contains {string} or {string}',
  (_world: PreCommitWorld, substr1: string, substr2: string) => {
    const output = `${_world.hookResult.stdout}\n${_world.hookResult.stderr}`.toLowerCase();
    if (!output.includes(substr1.toLowerCase()) && !output.includes(substr2.toLowerCase())) {
      throw new Error(
        `Expected output to contain "${substr1}" or "${substr2}" but got:\n${_world.hookResult.stdout}\n${_world.hookResult.stderr}`,
      );
    }
  },
);

Then('the incorrectly formatted file retains its original content', (world: PreCommitWorld) => {
  if (!existsSync(world.tempFilePath)) {
    throw new Error(`Temp file no longer exists: ${world.tempFilePath}`);
  }
  const current = readFileSync(world.tempFilePath, 'utf-8');
  if (current !== world.tempFileOriginalContent) {
    throw new Error(
      'File was modified by the hook.\nOriginal:\n' +
        world.tempFileOriginalContent +
        '\nCurrent:\n' +
        current,
    );
  }
  cleanupTempFile(world);
});
