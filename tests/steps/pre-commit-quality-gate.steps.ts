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

Given('que el hook pre-commit esta configurado', () => {
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

Given('los archivos estan stageados para commit', () => {
  // ponytail: stages are isolated by test runner; ensure git init exists
  const gitDir = resolve(repoRoot, '.git');
  if (!existsSync(gitDir)) {
    throw new Error('Not a git repository');
  }
  // Clean up any leftover temp files from previous scenarios
  preCleanup();
});

// ── Bad-format file setup ──

Given('que hay un archivo con formato incorrecto stageado', (world: PreCommitWorld) => {
  const tempPath = resolve(repoRoot, 'tests/_precommit_test_badfmt.js');
  const badContent = 'const x=1\nconst y=2\n'; // bad formatting: no semicolons, no spaces
  writeFileSync(tempPath, badContent, 'utf-8');
  world.tempFilePath = tempPath;
  world.tempFileOriginalContent = badContent;

  // Stage the file
  execSync(`git add "${tempPath}"`, { cwd: repoRoot });
});

// ── Bad-lint file setup ──

Given('que hay un archivo con error de lint stageado', (world: PreCommitWorld) => {
  const tempPath = resolve(repoRoot, 'tests/_precommit_test_badlint.js');
  const badContent = 'const unused = 1;\n'; // unused variable = lint error
  writeFileSync(tempPath, badContent, 'utf-8');
  world.tempFilePath = tempPath;
  world.tempFileOriginalContent = badContent;

  // Stage the file
  execSync(`git add "${tempPath}"`, { cwd: repoRoot });
});

// ── Execute hook ──

When('ejecuto el hook pre-commit', (world: PreCommitWorld) => {
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

Then('el hook termina con codigo de salida 0', (world: PreCommitWorld) => {
  if (world.hookResult.exitCode !== 0) {
    throw new Error(
      `Expected exit code 0 but got ${world.hookResult.exitCode}\nstdout: ${world.hookResult.stdout}\nstderr: ${world.hookResult.stderr}`,
    );
  }
});

Then('el hook termina con codigo de salida distinto de 0', (world: PreCommitWorld) => {
  if (world.hookResult.exitCode === 0) {
    throw new Error('Expected non-zero exit code but got 0');
  }
});

Then('no hay archivos modificados en el working tree', (world: PreCommitWorld) => {
  // ponytail: use git diff to check working tree is clean (ignoring staged changes)
  const dirty = execSync('git diff --name-only', {
    cwd: repoRoot,
    encoding: 'utf-8',
  }).trim();
  if (dirty) {
    throw new Error(`Working tree is dirty:\n${dirty}`);
  }
  // Cleanup any temp files created during this scenario
  cleanupTempFile(world);
});

Then('el mensaje de error contiene {string}', (_world: PreCommitWorld, substr: string) => {
  const output = `${_world.hookResult.stdout}\n${_world.hookResult.stderr}`.toLowerCase();
  if (!output.includes(substr.toLowerCase())) {
    throw new Error(
      `Expected output to contain "${substr}" but got:\n${_world.hookResult.stdout}\n${_world.hookResult.stderr}`,
    );
  }
});

Then(
  'el mensaje de error contiene {string} o {string}',
  (_world: PreCommitWorld, substr1: string, substr2: string) => {
    const output = `${_world.hookResult.stdout}\n${_world.hookResult.stderr}`.toLowerCase();
    if (!output.includes(substr1.toLowerCase()) && !output.includes(substr2.toLowerCase())) {
      throw new Error(
        `Expected output to contain "${substr1}" or "${substr2}" but got:\n${_world.hookResult.stdout}\n${_world.hookResult.stderr}`,
      );
    }
  },
);

Then(
  'el archivo con formato incorrecto conserva su contenido original',
  (world: PreCommitWorld) => {
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
  },
);
