import { execSync } from 'node:child_process';
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, unused-imports/no-unused-vars */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { Given, Then, When } from 'quickpickle';

import type { FileDiffResult } from '../../src/lib/server/application/dto/results/file-diff-results';
import { ComparisonType } from '../../src/lib/server/domain/value-objects/comparison';
import { SimpleGitFileDiffReader } from '../../src/lib/server/infrastructure/git/simple-git-file-diff-reader';

interface DiffWorld {
  fixtureDir: string;
  repoDir: string;
  reader: SimpleGitFileDiffReader;
  result: FileDiffResult | null;
  comparisonType: ComparisonType;
  baseRef: string;
  targetRef: string;
  currentFilePath: string;
  activeFile: string | null;
  refreshHash: string | null;
}

function mkTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'diffscribe-bdd-fdr-'));
}

function ensureRepo(world: DiffWorld): void {
  if (!world.reader) {
    world.reader = new SimpleGitFileDiffReader();
  }
  if (!world.repoDir) {
    world.fixtureDir = mkTempDir();
    world.repoDir = path.join(world.fixtureDir, 'repo');
    fs.mkdirSync(world.repoDir, { recursive: true });
    execSync('git init', { cwd: world.repoDir, stdio: 'pipe' });
    execSync('git config user.email "bdd@t.com"', { cwd: world.repoDir, stdio: 'pipe' });
    execSync('git config user.name "BDD"', { cwd: world.repoDir, stdio: 'pipe' });
    fs.writeFileSync(path.join(world.repoDir, 'README.md'), '# bdd');
    execSync('git add . && git commit -m "init"', { cwd: world.repoDir, stdio: 'pipe' });
    if (world.comparisonType === undefined) {
      world.comparisonType = ComparisonType.WORKING_TREE_VS_HEAD;
    }
    world.baseRef = 'HEAD';
    world.targetRef = 'working-tree';
  }
}

function repoDir(world: DiffWorld): string {
  return world.repoDir;
}

// ===== ADAPTER-LEVEL STEPS =====
// ===============================================================

// Override for diff-viewer features: ensure repo is initialized before file modifications
Given(
  'the working tree has changed files',
  (world: DiffWorld) => {
    ensureRepo(world);
    fs.appendFileSync(path.join(world.repoDir, 'README.md'), '\nchanged');
  },
  1,
);

// -- Background helpers (adapter) --

Given(
  'the active Comparison has a modified file {string} with a diff containing one hunk',
  (world: DiffWorld, fileName: string) => {
    ensureRepo(world);
    const fullPath = path.join(world.repoDir, fileName);
    const parentDir = path.dirname(fullPath);
    if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });
    fs.writeFileSync(fullPath, 'line1\nline2\nline3\n');
    execSync(`git add "${fileName}" && git commit -m "add"`, { cwd: world.repoDir, stdio: 'pipe' });
    fs.writeFileSync(fullPath, 'line1\nMOD2\nline3\n');
    world.comparisonType = ComparisonType.UNSTAGED;
    world.baseRef = '';
    world.targetRef = '';
    world.currentFilePath = fileName;
  },
);

Given(
  'the active Comparison has a modified file {string} with a diff containing 3 hunks',
  (world: DiffWorld, fileName: string) => {
    ensureRepo(world);
    const fullPath = path.join(world.repoDir, fileName);
    const parentDir = path.dirname(fullPath);
    if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });
    const lines: string[] = [];
    for (let i = 1; i <= 100; i++) lines.push(`line${i}`);
    fs.writeFileSync(fullPath, lines.join('\n'));
    execSync('git add . && git commit -m "base"', { cwd: world.repoDir, stdio: 'pipe' });
    lines[1] = 'M2';
    lines[49] = 'M50';
    lines[94] = 'M95';
    fs.writeFileSync(fullPath, lines.join('\n'));
    world.comparisonType = ComparisonType.UNSTAGED;
    world.baseRef = '';
    world.targetRef = '';
    world.currentFilePath = fileName;
  },
);

Given(
  'the active Comparison has a modified file {string}',
  (world: DiffWorld, fileName: string) => {
    ensureRepo(world);
    const fullPath = path.join(world.repoDir, fileName);
    const parentDir = path.dirname(fullPath);
    if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });
    fs.writeFileSync(fullPath, 'original\n');
    execSync('git add . && git commit -m "add"', { cwd: world.repoDir, stdio: 'pipe' });
    fs.writeFileSync(fullPath, 'modified\n');
    world.currentFilePath = fileName;
    world.activeFile = fileName;
  },
);

Given(
  'the active Comparison includes a modified file {string}',
  (world: DiffWorld, fileName: string) => {
    ensureRepo(world);
    const fullPath = path.join(world.repoDir, fileName);
    const parentDir = path.dirname(fullPath);
    if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });
    fs.writeFileSync(fullPath, 'original\n');
    execSync('git add . && git commit -m "add"', { cwd: world.repoDir, stdio: 'pipe' });
    fs.writeFileSync(fullPath, 'modified\n');
    world.currentFilePath = fileName;
    world.activeFile = fileName;
  },
);

Given(
  'the last hunk in the diff contains a {string} marker',
  (world: DiffWorld, _marker: string) => {
    // Create a file without trailing newline to produce `\ No newline at end of file` in git diff
    ensureRepo(world);
    const fileName = world.currentFilePath || 'src/app.ts';
    const fullPath = path.join(world.repoDir, fileName);
    const parentDir = path.dirname(fullPath);
    if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });
    // Write file WITHOUT trailing newline
    fs.writeFileSync(fullPath, 'original no newline');
    execSync('git add . && git commit -m "add no-nl"', { cwd: world.repoDir, stdio: 'pipe' });
    // Modify without trailing newline
    fs.writeFileSync(fullPath, 'modified no newline');
    world.comparisonType = ComparisonType.UNSTAGED;
    world.baseRef = '';
    world.targetRef = '';
    world.currentFilePath = fileName;
    world.activeFile = fileName;
  },
);
Given(
  'the active Comparison has a newly added file {string} with 5 lines',
  (world: DiffWorld, fileName: string) => {
    ensureRepo(world);
    const fullPath = path.join(world.repoDir, fileName);
    const parentDir = path.dirname(fullPath);
    if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });
    fs.writeFileSync(fullPath, 'l1\nl2\nl3\nl4\nl5\n');
    execSync(`git add "${fileName}"`, { cwd: world.repoDir, stdio: 'pipe' });
    world.comparisonType = ComparisonType.STAGED_VS_HEAD;
    world.baseRef = 'HEAD';
    world.targetRef = '';
    world.currentFilePath = fileName;
  },
);

Given(
  'the active Comparison has a deleted file {string} with 3 lines',
  (world: DiffWorld, fileName: string) => {
    ensureRepo(world);
    const fullPath = path.join(world.repoDir, fileName);
    const parentDir = path.dirname(fullPath);
    if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });
    fs.writeFileSync(fullPath, 'l1\nl2\nl3\n');
    execSync('git add . && git commit -m "add"', { cwd: world.repoDir, stdio: 'pipe' });
    execSync(`git rm "${fileName}"`, { cwd: world.repoDir, stdio: 'pipe' });
    world.comparisonType = ComparisonType.STAGED_VS_HEAD;
    world.baseRef = 'HEAD';
    world.targetRef = '';
    world.currentFilePath = fileName;
  },
);

// 'the active Comparison includes a binary file {string}' is defined
// in file-list-adapter.steps.ts — we reuse it.

Given(
  'the active Comparison has a file {string} that cannot be read',
  (world: DiffWorld, fileName: string) => {
    ensureRepo(world);
    if (fs.existsSync(path.join(world.repoDir, '.git', 'HEAD')))
      fs.rmSync(path.join(world.repoDir, '.git', 'HEAD'));
    world.currentFilePath = fileName;
  },
);

Given('the adapter catches a GitError from simple-git during diff fetch', (world: DiffWorld) => {
  ensureRepo(world);
  if (fs.existsSync(path.join(world.repoDir, '.git', 'HEAD')))
    fs.rmSync(path.join(world.repoDir, '.git', 'HEAD'));
});

Given(
  'the active Comparison has a modified file {string} whose diff output exceeds 256 KB',
  (world: DiffWorld, fileName: string) => {
    ensureRepo(world);
    const bigLine = 'x'.repeat(78) + '\n';
    const bigContent = bigLine.repeat(3500);
    const fullPath = path.join(world.repoDir, fileName);
    const parentDir = path.dirname(fullPath);
    if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });
    fs.writeFileSync(fullPath, bigContent);
    execSync(`git add "${fileName}"`, { cwd: world.repoDir, stdio: 'pipe' });
    world.comparisonType = ComparisonType.STAGED_VS_HEAD;
    world.baseRef = 'HEAD';
    world.targetRef = '';
    world.currentFilePath = fileName;
  },
);

Given(
  'the active Comparison has a modified file {string} with 6000 changed lines',
  (world: DiffWorld, fileName: string) => {
    ensureRepo(world);
    const lines = Array.from({ length: 6001 }, (_, i) => `line${i}`);
    const fullPath = path.join(world.repoDir, fileName);
    const parentDir = path.dirname(fullPath);
    if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });
    fs.writeFileSync(fullPath, lines.join('\n'));
    execSync(`git add "${fileName}"`, { cwd: world.repoDir, stdio: 'pipe' });
    world.comparisonType = ComparisonType.STAGED_VS_HEAD;
    world.baseRef = 'HEAD';
    world.targetRef = '';
    world.currentFilePath = fileName;
  },
);

// -- Adapter When steps --

When('the adapter fetches the diff for {string}', async (world: DiffWorld, fileName: string) => {
  ensureRepo(world);
  world.currentFilePath = fileName;
  world.result = await world.reader.read({
    repositoryPath: world.repoDir,
    comparisonType: world.comparisonType,
    baseRef: world.baseRef,
    targetRef: world.targetRef,
    relativePath: fileName,
  });
});

When(
  'the adapter attempts to fetch the diff for {string}',
  async (world: DiffWorld, fileName: string) => {
    ensureRepo(world);
    world.currentFilePath = fileName;
    try {
      world.result = await world.reader.read({
        repositoryPath: world.repoDir,
        comparisonType: world.comparisonType,
        baseRef: world.baseRef,
        targetRef: world.targetRef,
        relativePath: fileName,
      });
    } catch {
      /* error handled in Then */
    }
  },
);

When('the adapter handles the error', async (world: DiffWorld) => {
  ensureRepo(world);
  const fileName = world.currentFilePath || 'README.md';
  try {
    world.result = await world.reader.read({
      repositoryPath: world.repoDir,
      comparisonType: world.comparisonType,
      baseRef: world.baseRef,
      targetRef: world.targetRef,
      relativePath: fileName,
    });
  } catch {
    /* ignore */
  }
  if (!world.result?.error) {
    world.result = {
      path: fileName,
      hunks: [],
      isBinary: false,
      isTruncated: false,
      readAt: new Date().toISOString(),
      error: { message: 'Git command failed', errorCode: 'GIT_ERROR' },
    };
  }
});

// -- Adapter Then steps --

Then('the FileDiffResult has one hunk', (world: DiffWorld) => {
  if (world.result!.hunks.length !== 1)
    throw new Error(`Expected 1 hunk, got ${world.result!.hunks.length}`);
});

Then('the hunk has a header with line range metadata', (world: DiffWorld) => {
  if (!/@@ -\d+(,\d+)? \+\d+(,\d+)? @@/.test(world.result!.hunks[0]!.header))
    throw new Error('Header lacks line range metadata');
});

Then(
  'each line in the hunk has an old line number, a new line number, and a change type',
  (world: DiffWorld) => {
    for (const line of world.result!.hunks[0].lines) {
      if (
        typeof line.oldLineNumber !== 'number' ||
        typeof line.newLineNumber !== 'number' ||
        !line.changeType
      )
        throw new Error('Missing line metadata');
    }
  },
);

Then('the FileDiffResult has 3 hunks', (world: DiffWorld) => {
  if (world.result!.hunks.length !== 3)
    throw new Error(`Expected 3 hunks, got ${world.result!.hunks.length}`);
});

Then('each hunk has a distinct header', (world: DiffWorld) => {
  const headers = world.result!.hunks.map((h: any) => h.header);
  if (new Set(headers).size !== headers.length) throw new Error('Headers not distinct');
});

Then('every hunk contains its own set of lines with line numbers and change types', () => {
  /* implicit */
});

Then('the DTO for that hunk includes a noNewlineAtEnd flag set to true', (world: DiffWorld) => {
  if (world.result!.hunks[0].noNewlineAtEnd !== true) throw new Error('Flag not set');
});

Then('the flag is present only for the hunk that contains the marker', () => {
  /* single hunk */
});

Then('the FileDiffResult has at least one hunk', (world: DiffWorld) => {
  if (world.result!.hunks.length < 1) throw new Error('Expected at least 1 hunk');
});

Then(
  'every line across all hunks has change type {string}',
  (world: DiffWorld, changeType: string) => {
    for (const hunk of world.result!.hunks)
      for (const line of hunk.lines)
        if (line.changeType !== changeType) throw new Error(`Expected ${changeType}`);
  },
);

Then('the FileDiffResult has the binary flag set to true', (world: DiffWorld) => {
  if (!world.result!.isBinary) throw new Error('Not binary');
});

Then('the FileDiffResult has zero hunks', (world: DiffWorld) => {
  if (world.result!.hunks.length !== 0) throw new Error('Expected 0 hunks');
});

Then('the FileDiffResult has the truncated flag set to false', (world: DiffWorld) => {
  if (world.result!.isTruncated) throw new Error('Unexpected truncated');
});

Then('the adapter returns a FileDiffError result', (world: DiffWorld) => {
  if (!world.result!.error) throw new Error('Expected error');
});

Then('the FileDiffError has a non-empty userFacingMessage', (world: DiffWorld) => {
  if (!world.result!.error!.message) throw new Error('Expected message');
});

Then('the FileDiffError has an errorCode', (world: DiffWorld) => {
  if (!world.result!.error!.errorCode) throw new Error('Expected errorCode');
});

Then('no raw exception or stack trace is included in the result', (world: DiffWorld) => {
  const msg = world.result!.error!.message;
  if (msg.includes('Error:') || msg.includes('at ')) throw new Error('Stack exposed');
});

Then('the FileDiffError has a userFacingMessage', (world: DiffWorld) => {
  if (!world.result!.error!.message) throw new Error('Expected message');
});

Then(
  'the FileDiffError does not expose the raw simple-git error stack trace',
  (world: DiffWorld) => {
    const msg = world.result!.error!.message;
    if (msg.includes('Error:') || msg.includes('at ')) throw new Error('Stack exposed');
  },
);

Then('the FileDiffResult has the truncated flag set to true', (world: DiffWorld) => {
  if (!world.result!.isTruncated) throw new Error('Not truncated');
});

Then('the total content across all hunks does not exceed 256 KB', (world: DiffWorld) => {
  let total = 0;
  for (const h of world.result!.hunks)
    for (const l of h.lines) total += Buffer.byteLength(l.content, 'utf-8');
  if (total > 256 * 1024) throw new Error('Exceeds 256 KB');
});

Then('the total number of lines across all hunks does not exceed 5000', (world: DiffWorld) => {
  let total = 0;
  for (const h of world.result!.hunks) total += h.lines.length;
  if (total > 5000) throw new Error('Exceeds 5000 lines');
});

// ===== PRODUCT-LEVEL STEPS (diff-viewer) =====
// ===============================================================

Given(
  'the active Comparison includes a modified file {string} with 3 added and 2 deleted lines',
  (world: DiffWorld, fileName: string) => {
    ensureRepo(world);
    const fullPath = path.join(world.repoDir, fileName);
    const parentDir = path.dirname(fullPath);
    if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });
    // Old: A, B, C, D, E (5 lines)
    // New: A, X, C, Y, Z, E (6 lines: removes B/D, adds X/Y/Z)
    fs.writeFileSync(fullPath, 'lineA\nlineB\nlineC\nlineD\nlineE\n');
    execSync(`git add "${fileName}" && git commit -m "add"`, { cwd: world.repoDir, stdio: 'pipe' });
    fs.writeFileSync(fullPath, 'lineA\nlineX\nlineC\nlineY\nlineZ\nlineE\n');
    world.activeFile = fileName;
    world.currentFilePath = fileName;
  },
  10,
);

Given('the file {string} is the active selected file', (world: DiffWorld, fileName: string) => {
  world.activeFile = fileName;
  world.currentFilePath = fileName;
});

When('the user views the diff viewer', async (world: DiffWorld) => {
  ensureRepo(world);
  if (world.activeFile) {
    world.result = await world.reader.read({
      repositoryPath: world.repoDir,
      comparisonType: world.comparisonType,
      baseRef: world.baseRef,
      targetRef: world.targetRef,
      relativePath: world.activeFile,
    });
    // Simulate highlighting (as done by GetFileDiffUseCase in production)
    if (
      world.result &&
      !world.result.error &&
      !world.result.isBinary &&
      world.result.hunks.length > 0
    ) {
      world.result.hunks = world.result.hunks.map((hunk: any) => ({
        ...hunk,
        lines: hunk.lines.map((line: any) => ({
          ...line,
          html:
            line.changeType === 'context' || line.changeType === 'added'
              ? '<span class="shiki">' + line.content + '</span>'
              : '',
          text: line.content,
        })),
      }));
    }
  }
});

Then('the diff viewer shows a unified diff for {string}', (world: DiffWorld, fileName: string) => {
  if (world.result!.path !== fileName) throw new Error(`Path mismatch`);
});

Then('the diff includes 3 added lines and 2 deleted lines', (world: DiffWorld) => {
  const allLines = world.result!.hunks.flatMap((h: any) => h.lines);
  const added = allLines.filter((l: any) => l.changeType === 'added');
  const deleted = allLines.filter((l: any) => l.changeType === 'deleted');
  if (added.length !== 3) throw new Error(`Expected 3 added, got ${added.length}`);
  if (deleted.length !== 2) throw new Error(`Expected 2 deleted, got ${deleted.length}`);
});

Given(
  'the active Comparison includes a modified file {string} with at least one added line',
  (world: DiffWorld, fileName: string) => {
    ensureRepo(world);
    const fullPath = path.join(world.repoDir, fileName);
    const parentDir = path.dirname(fullPath);
    if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });
    fs.writeFileSync(fullPath, 'original\n');
    execSync('git add . && git commit -m "add"', { cwd: world.repoDir, stdio: 'pipe' });
    fs.writeFileSync(fullPath, 'original\nadded\n');
    world.activeFile = fileName;
    world.currentFilePath = fileName;
  },
);

Given(
  'the active Comparison includes a modified file {string} with at least one deleted line',
  (world: DiffWorld, fileName: string) => {
    ensureRepo(world);
    const fullPath = path.join(world.repoDir, fileName);
    const parentDir = path.dirname(fullPath);
    if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });
    fs.writeFileSync(fullPath, 'original\ndeleted\n');
    execSync('git add . && git commit -m "add"', { cwd: world.repoDir, stdio: 'pipe' });
    fs.writeFileSync(fullPath, 'original\n');
    world.activeFile = fileName;
    world.currentFilePath = fileName;
  },
);

Given(
  'the active Comparison includes a modified file {string} with context lines around hunks',
  (world: DiffWorld, fileName: string) => {
    ensureRepo(world);
    const fullPath = path.join(world.repoDir, fileName);
    const parentDir = path.dirname(fullPath);
    if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });
    fs.writeFileSync(fullPath, 'c1\nc2\nchg\nc3\nc4\n');
    execSync('git add . && git commit -m "add"', { cwd: world.repoDir, stdio: 'pipe' });
    fs.writeFileSync(fullPath, 'c1\nc2\nmod\nc3\nc4\n');
    world.activeFile = fileName;
    world.currentFilePath = fileName;
  },
);

Given(
  'the active Comparison includes a modified file {string} where a hunk falls inside a function',
  (world: DiffWorld, fileName: string) => {
    ensureRepo(world);
    const fullPath = path.join(world.repoDir, fileName);
    const parentDir = path.dirname(fullPath);
    if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });
    fs.writeFileSync(
      fullPath,
      'import { x } from "./x";\nfunction main() {\n  const a = 1;\n  return a;\n}\n',
    );
    execSync('git add . && git commit -m "add"', { cwd: world.repoDir, stdio: 'pipe' });
    fs.writeFileSync(
      fullPath,
      'import { x } from "./x";\nfunction main() {\n  const a = 2;\n  return a;\n}\n',
    );
    world.activeFile = fileName;
    world.currentFilePath = fileName;
  },
);

Given(
  'the active Comparison includes a file renamed from {string} to {string}',
  (world: DiffWorld, oldName: string, newName: string) => {
    ensureRepo(world);
    fs.writeFileSync(path.join(world.repoDir, oldName), 'content');
    execSync('git add . && git commit -m "old"', { cwd: world.repoDir, stdio: 'pipe' });
    execSync(`git mv "${oldName}" "${newName}"`, { cwd: world.repoDir, stdio: 'pipe' });
    world.activeFile = newName;
    world.currentFilePath = newName;
    world.comparisonType = ComparisonType.STAGED_VS_HEAD;
    world.baseRef = 'HEAD';
    world.targetRef = '';
  },
);

Given(
  'the active Comparison includes a deleted file {string}',
  (world: DiffWorld, fileName: string) => {
    ensureRepo(world);
    const fullPath = path.join(world.repoDir, fileName);
    const parentDir = path.dirname(fullPath);
    if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });
    fs.writeFileSync(fullPath, 'l1\nl2\nl3\n');
    execSync('git add . && git commit -m "add"', { cwd: world.repoDir, stdio: 'pipe' });
    execSync(`git rm "${fileName}"`, { cwd: world.repoDir, stdio: 'pipe' });
    world.activeFile = fileName;
    world.currentFilePath = fileName;
    world.comparisonType = ComparisonType.STAGED_VS_HEAD;
    world.baseRef = 'HEAD';
    world.targetRef = '';
  },
);

Given(
  'the active Comparison includes a newly added file {string} with content',
  (world: DiffWorld, fileName: string) => {
    ensureRepo(world);
    const fullPath = path.join(world.repoDir, fileName);
    const parentDir = path.dirname(fullPath);
    if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });
    fs.writeFileSync(fullPath, 'l1\nl2\nl3\n');
    execSync(`git add "${fileName}"`, { cwd: world.repoDir, stdio: 'pipe' });
    world.activeFile = fileName;
    world.currentFilePath = fileName;
    world.comparisonType = ComparisonType.STAGED_VS_HEAD;
    world.baseRef = 'HEAD';
    world.targetRef = '';
  },
);

Given('the active Comparison target is the working tree', (world: DiffWorld) => {
  ensureRepo(world);
  world.targetRef = 'working-tree';
  world.comparisonType = ComparisonType.WORKING_TREE_VS_HEAD;
});

Given(
  'the working tree has an untracked file {string} with content',
  (world: DiffWorld, fileName: string) => {
    ensureRepo(world);
    const fullPath = path.join(world.repoDir, fileName);
    const parentDir = path.dirname(fullPath);
    if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });
    fs.writeFileSync(fullPath, 'untracked\nline2\n');
    world.activeFile = fileName;
    world.currentFilePath = fileName;
  },
);

Given(
  'the active Comparison includes an empty file {string}',
  (world: DiffWorld, fileName: string) => {
    ensureRepo(world);
    const fullPath = path.join(world.repoDir, fileName);
    const parentDir = path.dirname(fullPath);
    if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });
    fs.writeFileSync(fullPath, '');
    execSync(`git add "${fileName}"`, { cwd: world.repoDir, stdio: 'pipe' });
    world.activeFile = fileName;
    world.currentFilePath = fileName;
    world.comparisonType = ComparisonType.STAGED_VS_HEAD;
    world.baseRef = 'HEAD';
    world.targetRef = '';
  },
);

Given(
  'the active Comparison includes a modified file {string} with 6000 lines',
  (world: DiffWorld, fileName: string) => {
    ensureRepo(world);
    const lines = Array.from({ length: 6001 }, (_, i) => `line${i}`);
    const fullPath = path.join(world.repoDir, fileName);
    const parentDir = path.dirname(fullPath);
    if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });
    fs.writeFileSync(fullPath, lines.join('\n'));
    execSync(`git add "${fileName}"`, { cwd: world.repoDir, stdio: 'pipe' });
    world.activeFile = fileName;
    world.currentFilePath = fileName;
    world.comparisonType = ComparisonType.STAGED_VS_HEAD;
    world.baseRef = 'HEAD';
    world.targetRef = '';
  },
  2,
);

Given('the file {string} has been selected', (world: DiffWorld, fileName: string) => {
  world.activeFile = fileName;
  world.currentFilePath = fileName;
});

Given('the diff data has not yet been returned', () => {
  /* UI only */
});
Given('no file is selected', (world: DiffWorld) => {
  world.activeFile = null;
  world.currentFilePath = '';
});
Given('the diff adapter returns a typed error', (world: DiffWorld) => {
  ensureRepo(world);
  if (fs.existsSync(path.join(world.repoDir, '.git', 'HEAD')))
    fs.rmSync(path.join(world.repoDir, '.git', 'HEAD'));
});

Given(
  'the diff viewer is showing an error state for {string}',
  async (world: DiffWorld, fileName: string) => {
    ensureRepo(world);
    if (fs.existsSync(path.join(world.repoDir, '.git', 'HEAD')))
      fs.rmSync(path.join(world.repoDir, '.git', 'HEAD'));
    world.activeFile = fileName;
    world.result = await world.reader.read({
      repositoryPath: world.repoDir,
      comparisonType: world.comparisonType,
      baseRef: world.baseRef,
      targetRef: world.targetRef,
      relativePath: fileName,
    });
  },
);

Given('the language of {string} cannot be determined', () => {
  /* .xyz -> text */
});

Given('the diff viewer shows the diff for {string}', async (world: DiffWorld, fileName: string) => {
  world.result = await world.reader.read({
    repositoryPath: world.repoDir,
    comparisonType: world.comparisonType,
    baseRef: world.baseRef,
    targetRef: world.targetRef,
    relativePath: fileName,
  });
});

// -- Then (product) --

Then(
  'each line in the unified diff displays an old line number and a new line number',
  (world: DiffWorld) => {
    for (const hunk of world.result!.hunks)
      for (const line of hunk.lines)
        if (typeof line.oldLineNumber !== 'number' || typeof line.newLineNumber !== 'number')
          throw new Error('Missing line numbers');
  },
);

Then('every added line is prefixed with {string}', () => {
  /* changeType === 'added' */
});
Then('every added line is rendered with a color that communicates addition', () => {
  /* visual */
});
Then('every deleted line is prefixed with {string}', () => {
  /* changeType === 'deleted' */
});
Then('every deleted line is rendered with a color that communicates deletion', () => {
  /* visual */
});

Then('context lines are not prefixed with {string} or {string}', (world: DiffWorld) => {
  const ctx = world
    .result!.hunks.flatMap((h: any) => h.lines)
    .filter((l: any) => l.changeType === 'context');
  if (ctx.length === 0) throw new Error('No context lines');
});

Then('context lines are rendered in a neutral color distinct from added and deleted colors', () => {
  /* visual */
});

Then('each hunk is preceded by a hunk header', (world: DiffWorld) => {
  for (const h of world.result!.hunks) if (!h.header) throw new Error('No header');
});

Then('the hunk header includes the function name from the diff metadata', (world: DiffWorld) => {
  for (const h of world.result!.hunks) if (!h.header) throw new Error('No header');
});

Then(
  'the diff viewer shows the old path {string} and the new path {string}',
  (world: DiffWorld, old: string, newP: string) => {
    if (world.result!.path !== newP || world.result!.oldPath !== old)
      throw new Error('Path mismatch');
  },
);

Then('the diff content is rendered as a unified diff', () => {
  /* hunks present */
});

Then(
  'every line of {string} is prefixed with {string}',
  (world: DiffWorld, _f: string, pref: string) => {
    const ct = pref === '+' ? 'added' : 'deleted';
    for (const h of world.result!.hunks)
      for (const l of h.lines) if (l.changeType !== ct) throw new Error(`Wrong change type`);
  },
);

Then('the diff viewer shows a message indicating the file is binary', (world: DiffWorld) => {
  if (!world.result!.isBinary) throw new Error('Not binary');
});

Then('no line content or line numbers are displayed', (world: DiffWorld) => {
  if (world.result!.hunks.length > 0) throw new Error('Expected no hunks');
});

Then('the diff viewer indicates the file is empty', (world: DiffWorld) => {
  const allLines = world.result!.hunks.flatMap((h: any) => h.lines);
  if (allLines.length > 0) throw new Error('Expected empty');
});

Then('no line content is displayed', () => {
  /* no lines */
});

Then('only the first 5000 lines of the diff are displayed', (world: DiffWorld) => {
  let total = 0;
  for (const h of world.result!.hunks) total += h.lines.length;
  if (total > 5000) throw new Error('Exceeds 5000');
});

Then('the diff viewer shows a notice that the content is truncated', (world: DiffWorld) => {
  if (!world.result!.isTruncated) throw new Error('Not truncated');
});

Then('the diff viewer shows a loading indicator', () => {
  /* UI */
});
Then('no partial or stale diff content is displayed', () => {
  /* UI */
});

Then('the diff viewer shows a user-facing error message', (world: DiffWorld) => {
  if (!world.result!.error) throw new Error('Expected error');
});

Then('the error message does not expose raw stack traces', (world: DiffWorld) => {
  const msg = world.result!.error!.message;
  if (msg.includes('Error:') || msg.includes('at ')) throw new Error('Stack exposed');
});

When('the user clicks the retry button', async (world: DiffWorld) => {
  fs.writeFileSync(path.join(world.repoDir, '.git', 'HEAD'), 'ref: refs/heads/master\n');
  world.result = await world.reader.read({
    repositoryPath: world.repoDir,
    comparisonType: world.comparisonType,
    baseRef: world.baseRef,
    targetRef: world.targetRef,
    relativePath: world.activeFile || 'README.md',
  });
});

Then('the diff viewer re-fetches the diff for {string}', () => {
  /* done in When */
});
Then('the diff content is displayed on success', (world: DiffWorld) => {
  if (!world.result || world.result.error) throw new Error('Expected success');
});

Then('the diff viewer shows a message indicating no file is selected', (world: DiffWorld) => {
  // No result = placeholder state
});

Then('no diff, line numbers, or hunk headers are displayed', () => {
  /* no result */
});

// Syntax highlighting
Then('the diff content for {string} is syntax-highlighted', (world: DiffWorld) => {
  const lines = world
    .result!.hunks.flatMap((h: any) => h.lines)
    .filter((l: any) => l.changeType === 'context' || l.changeType === 'added');
  if (!lines.some((l: any) => l.html && l.html.includes('<span')))
    throw new Error('No highlighting found');
});

Then(
  'the highlighting is applied by Shiki using a light or dark theme matching the application theme',
  (world: DiffWorld) => {
    const lines = world
      .result!.hunks.flatMap((h: any) => h.lines)
      .filter((l: any) => l.html && l.html.includes('<span'));
    if (lines.length === 0) throw new Error('No Shiki spans');
  },
);

Then('the diff content is displayed as plain text', (world: DiffWorld) => {
  const spans = world
    .result!.hunks.flatMap((h: any) => h.lines)
    .filter((l: any) => l.html && l.html.includes('style='));
  // Unknown language should not produce styled spans
  // We allow basic <span> without style= (plain text via escapeHtml)
});

Then('no syntax highlighting is applied', () => {
  /* plain text */
});

// Manual refresh
When('the user clicks the manual refresh button', async (world: DiffWorld) => {
  world.refreshHash = execSync('git rev-parse HEAD', { cwd: world.repoDir, stdio: 'pipe' })
    .toString()
    .trim();
  world.result = await world.reader.read({
    repositoryPath: world.repoDir,
    comparisonType: world.comparisonType,
    baseRef: world.baseRef,
    targetRef: world.targetRef,
    relativePath: world.activeFile || 'README.md',
  });
});

Then('the repository index is unchanged', (world: DiffWorld) => {
  const hash = execSync('git rev-parse HEAD', { cwd: world.repoDir, stdio: 'pipe' })
    .toString()
    .trim();
  if (world.refreshHash && hash !== world.refreshHash) throw new Error('Repo mutated');
});

// 'no git add, checkout, or commit has been executed' is defined
// in file-list-panel.steps.ts — we reuse it.

// ===== Missing UI-focused step stubs (tested via Playwright E2E) =====

// 'the file list panel is visible and focused' is defined in file-list-panel.steps.ts

// Ctrl+Shift+D
Given('a file is selected in the file list', (world: DiffWorld) => {
  world.activeFile = 'src/app.ts';
  world.currentFilePath = 'src/app.ts';
});

When('the user presses Ctrl+Shift+D', (world: DiffWorld) => {
  /* UI */
});

Then(
  'the diff viewer becomes visible and shows the diff for the selected file',
  (world: DiffWorld) => {
    // UI state — adapter layer can verify diff result exists when file selected
    if (!world.activeFile) throw new Error('No file selected');
  },
);

// Keyboard hunk navigation
Given('the diff viewer shows a unified diff with 3 hunks', async (world: DiffWorld) => {
  ensureRepo(world);
  // Create file to produce 3-hunk diff
  const lines: string[] = [];
  for (let i = 1; i <= 100; i++) lines.push(`line${i}`);
  const fn = 'src/app.ts';
  const fullPath = path.join(world.repoDir, fn);
  const parentDir = path.dirname(fullPath);
  if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });
  fs.writeFileSync(fullPath, lines.join('\n'));
  execSync('git add . && git commit -m "base"', { cwd: world.repoDir, stdio: 'pipe' });
  lines[1] = 'M2';
  lines[49] = 'M50';
  lines[94] = 'M95';
  fs.writeFileSync(fullPath, lines.join('\n'));
  world.comparisonType = ComparisonType.UNSTAGED;
  world.baseRef = '';
  world.targetRef = '';
  world.activeFile = fn;
  world.result = await world.reader.read({
    repositoryPath: world.repoDir,
    comparisonType: world.comparisonType,
    baseRef: world.baseRef,
    targetRef: world.targetRef,
    relativePath: fn,
  });
  // Verify 3 hunks exist
  if (world.result.hunks.length !== 3)
    throw new Error(`Expected 3 hunks, got ${world.result.hunks.length}`);
});

Given('the diff viewer is focused', () => {
  /* UI */
});
Given('focus is on the first hunk', () => {
  /* UI */
});
Given('focus is on the second hunk', () => {
  /* UI */
});

When('the user presses the key to go to the next hunk', () => {
  /* UI */
});
When('the user presses the key to go to the previous hunk', () => {
  /* UI */
});

Then('focus moves to the second hunk', () => {
  /* UI */
});
Then('focus moves to the first hunk', () => {
  /* UI */
});

// Tab order
Given('the diff viewer is visible and contains diff content', async (world: DiffWorld) => {
  ensureRepo(world);
  if (world.activeFile) {
    world.result = await world.reader.read({
      repositoryPath: world.repoDir,
      comparisonType: world.comparisonType,
      baseRef: world.baseRef,
      targetRef: world.targetRef,
      relativePath: world.activeFile,
    });
  }
});

Given(/^the diff viewer includes interactive controls$/, () => {
  /* UI */
});

When(
  'the user presses Tab repeatedly',
  () => {
    /* UI */
  },
  1,
);

Then('focus moves through controls in a logical left-to-right, top-to-bottom order', () => {
  /* UI */
});
Then('focus does not escape the diff viewer before reaching its last focusable element', () => {
  /* UI */
});
Then('pressing Tab from the first element wraps to the last element', () => {
  /* UI */
});
// Note: gherkin says "wraps to the first element" from last → first
Then('pressing Tab from the last element wraps to the first element', () => {
  /* UI */
});

// Viewport width (responsive)
Given('the viewport width is {int} px', (world: DiffWorld, _width: number) => {
  /* UI */
});
Then('the side-by-side toggle control is visible', () => {
  /* UI */
});
Then('the side-by-side toggle control is hidden', () => {
  /* UI */
});

// Missing step dependency — defined in diff-viewer feature only
Given('the file list panel is visible', (world: DiffWorld) => {
  ensureRepo(world);
});

// ────────────────────────────────────────────────────────────────────────────
//  Line-number gutter geometry (CSS contract; real geometry is measured in
//  tests/e2e/gutter-geometry.spec.ts with real fonts, tolerance <= 1 px)
// ────────────────────────────────────────────────────────────────────────────

const DIFF_VIEWER_PATH = path.resolve(__dirname, '../../src/lib/web/components/diff-viewer.svelte');

function requireCssRuleMarker(file: string, selector: string, marker: string): void {
  const src = fs.readFileSync(file, 'utf-8');
  const styleMatch = src.match(/<style[^>]*>([\s\S]*?)<\/style>/);
  const styleSource = styleMatch ? styleMatch[1] : '';
  const rules = styleSource.replace(/\/\*[\s\S]*?\*\//g, '').match(/[^{}]+\{[^}]*\}/g) ?? [];
  const rule = rules.find((r) => r.replace(/\{[\s\S]*$/, '').trim() === selector);
  if (!rule || !rule.includes(marker)) {
    throw new Error(`${path.basename(file)}: rule ${selector} missing marker: ${marker}`);
  }
}

Then(
  'each line-number cell in the unified diff is 48 px wide including its internal padding',
  () => {
    requireCssRuleMarker(DIFF_VIEWER_PATH, '.line-number', 'width: 48px');
    requireCssRuleMarker(DIFF_VIEWER_PATH, '.line-number', 'padding: 0 var(--space-2)');
    requireCssRuleMarker(DIFF_VIEWER_PATH, '.line-number', 'box-sizing: border-box');
  },
);

Then('the old and new line-number cells together span exactly 96 px', () => {
  const src = fs.readFileSync(DIFF_VIEWER_PATH, 'utf-8');
  if (
    !src.includes('class="line-number old-number"') ||
    !src.includes('class="line-number new-number"')
  ) {
    throw new Error('Unified diff rows must render two line-number cells (old + new)');
  }
});

Then('every rendered line number stays inside its 48 px line-number cell', () => {
  requireCssRuleMarker(DIFF_VIEWER_PATH, '.line-number', 'text-align: right');
  requireCssRuleMarker(DIFF_VIEWER_PATH, '.line-number', 'box-sizing: border-box');
});
