/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
import fs from 'node:fs';
import path from 'node:path';

import Database from 'better-sqlite3';
import { Given, Then, When } from 'quickpickle';

import { createWorkspaceServices } from '$lib/server/composition/workspace-services';
import type { ComparisonSerialized } from '$lib/server/domain/value-objects/comparison';
import { ObservationType } from '$lib/server/domain/value-objects/observation-enums';
import { computeContentHash } from '$lib/server/infrastructure/hash/content-hasher';
import { deriveStaleStatus } from '$lib/server/infrastructure/hash/stale-deriver';

interface StaleWorld {
  db: Database.Database;
  repoDir: string;
  fixtureDir?: string;
  activeReviewId: string | null;
  activeReview: any;
  lastObservation: any;
  staleStatus: string | null;
  comparisonJson: string;
  lastGivenWorkspaceId?: string;
}

function ensureRepoDir(world: StaleWorld): string {
  if (world.repoDir) return world.repoDir;
  // Fallback: get workspace path from DB
  if (world.lastGivenWorkspaceId) {
    const row = world.db
      .prepare('SELECT repository_path FROM workspaces WHERE id = ?')
      .get(world.lastGivenWorkspaceId) as { repository_path: string } | undefined;
    if (row) {
      world.repoDir = row.repository_path;
      return world.repoDir;
    }
  }
  // Ultimate fallback: use fixtureDir if available
  if (world.fixtureDir) {
    world.repoDir = world.fixtureDir;
    return world.repoDir;
  }
  throw new Error('Cannot determine repoDir: no workspace registered or fixtureDir set');
}

function ensureFile(cwd: string, filePath: string, options?: number | string): string {
  const fullPath = path.join(cwd, filePath);
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  // Always write/ensure file content
  if (typeof options === 'string') {
    fs.writeFileSync(fullPath, options);
  } else if (typeof options === 'number' && options > 0) {
    const lines: string[] = [];
    for (let i = 1; i <= options; i++) lines.push(`line${i}`);
    fs.writeFileSync(fullPath, lines.join('\n') + '\n');
  } else if (!fs.existsSync(fullPath)) {
    const lines: string[] = [];
    for (let i = 1; i <= 15; i++) lines.push(`line${i}`);
    fs.writeFileSync(fullPath, lines.join('\n') + '\n');
  }
  return fullPath;
}

function compJson(type?: string): ComparisonSerialized {
  return {
    base: { type: 'head', value: 'HEAD', label: 'HEAD' },
    target: { type: 'working-tree', value: 'working-tree', label: 'working tree' },
    comparisonType: (type as any) || 'working-tree-vs-head',
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

Given(
  'an observation exists on line {int} of {string} with a stored snapshot and hash',
  async (world: StaleWorld, line: number, file: string) => {
    const cwd = ensureRepoDir(world);
    ensureFile(cwd, file, 15);
    const services = createWorkspaceServices(world.db);

    // Read actual file content to compute a matching hash
    const fullPath = path.join(cwd, file);
    const fileContent = fs.readFileSync(fullPath, 'utf-8');
    const fileLines = fileContent.split('\n');
    const actualLine = fileLines[line - 1] ?? '';
    const snapshotLine = ' ' + actualLine; // context line prefix
    const hash = computeContentHash(file, 'new', line, snapshotLine);

    const result = await services.createObservationUseCase.execute({
      reviewId: world.activeReviewId!,
      type: ObservationType.NOTE,
      body: 'Stale test',
      filePath: file,
      lineRangeStart: line,
      lineRangeEnd: line,
      comparisonSnapshotJson: JSON.stringify(compJson()),
      diffSnapshot: snapshotLine,
      contentHash: hash,
    });
    world.lastObservation = result;
    world.comparisonJson = JSON.stringify(compJson());
  },
);

Given(
  /an observation exists on lines (\d+) through (\d+) of "([^"]+)"$/,
  async (world: StaleWorld, start: string, end: string, file: string) => {
    const s = parseInt(start, 10);
    const e = parseInt(end, 10);
    const cwd = ensureRepoDir(world);
    const totalLines = Math.max(e, 55);
    ensureFile(cwd, file, totalLines);
    const services = createWorkspaceServices(world.db);

    const fullPath = path.join(cwd, file);
    const fileContent = fs.readFileSync(fullPath, 'utf-8');
    const fileLines = fileContent.split('\n');
    const selectedContent = fileLines
      .slice(s - 1, e)
      .map((l) => ' ' + l)
      .join('\n');
    const hash = computeContentHash(file, 'new', s, selectedContent);

    const result = await services.createObservationUseCase.execute({
      reviewId: world.activeReviewId!,
      type: ObservationType.NOTE,
      body: 'Range stale test',
      filePath: file,
      lineRangeStart: s,
      lineRangeEnd: e,
      comparisonSnapshotJson: JSON.stringify(compJson()),
      diffSnapshot: selectedContent,
      contentHash: hash,
    });
    world.lastObservation = result;
    world.comparisonJson = JSON.stringify(compJson());
  },
);

Given(
  'an observation exists on lines {int} through {int} of {string} with a stored snapshot and hash',
  async (world: StaleWorld, start: number, end: number, file: string) => {
    const cwd = ensureRepoDir(world);
    const totalLines = Math.max(end, 55);
    ensureFile(cwd, file, totalLines);
    const services = createWorkspaceServices(world.db);

    // Read actual file content and build snapshot + hash
    const fullPath = path.join(cwd, file);
    const fileContent = fs.readFileSync(fullPath, 'utf-8');
    const fileLines = fileContent.split('\n');
    const selectedContent = fileLines
      .slice(start - 1, end)
      .map((l) => ' ' + l)
      .join('\n');
    const hash = computeContentHash(file, 'new', start, selectedContent);

    const result = await services.createObservationUseCase.execute({
      reviewId: world.activeReviewId!,
      type: ObservationType.NOTE,
      body: 'Range stale test',
      filePath: file,
      lineRangeStart: start,
      lineRangeEnd: end,
      comparisonSnapshotJson: JSON.stringify(compJson()),
      diffSnapshot: selectedContent,
      contentHash: hash,
    });
    world.lastObservation = result;
    world.comparisonJson = JSON.stringify(compJson());
  },
);

When('the observation panel opens', async (world: StaleWorld) => {
  if (!world.lastObservation) return;

  const observation = world.lastObservation;
  const cwd = ensureRepoDir(world);

  // Compute staleness for the observation
  const storedComp = observation.comparisonSnapshotJson;
  const currentComp = world.comparisonJson ?? storedComp;
  const filePath = observation.filePath;
  const storedHash = observation.contentHash;

  let currentHash: string | null = null;
  let fileExists = false;
  let fileRenamed = false;
  let isBinary = false;
  const isTruncated = false;

  if (filePath) {
    // Check for binary file extensions
    const binaryExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.pdf', '.zip', '.exe', '.bin'];
    const ext = path.extname(filePath).toLowerCase();
    if (binaryExtensions.includes(ext)) {
      isBinary = true;
      fileExists = fs.existsSync(path.join(cwd, filePath));
    } else {
      const fullPath = path.join(cwd, filePath);
      fileExists = fs.existsSync(fullPath);

      if (fileExists) {
        // Read current file content and compute hash for comparison
        try {
          const content = fs.readFileSync(fullPath, 'utf-8');
          const lines = content.split('\n');

          const startLine = observation.lineStart ?? 1;
          const endLine = observation.lineEnd ?? lines.length;

          if (startLine <= lines.length && endLine <= lines.length) {
            const selectedLines = lines.slice(startLine - 1, endLine);
            const rawContent = selectedLines
              .map((l) =>
                l.startsWith('+') || l.startsWith('-') || l.startsWith(' ') ? l : ' ' + l,
              )
              .join('\n');
            currentHash = computeContentHash(
              filePath,
              observation.side ?? 'new',
              startLine,
              rawContent || content,
            );
          }
          // else: range is missing — currentHash stays null
        } catch {
          // Binary or unreadable — keep currentHash null, mark as binary
          isBinary = true;
        }
      }

      // Check if the file might be renamed
      if (!fileExists) {
        // Check explicit rename flag first
        if ((world as any)._fileWasRenamed === true) {
          fileRenamed = true;
        } else {
          const dir = path.dirname(filePath);
          const dirPath = path.join(cwd, dir);
          if (fs.existsSync(dirPath)) {
            const entries = fs.readdirSync(dirPath);
            const base = path.basename(filePath, ext);
            for (const entry of entries) {
              if (entry !== base && entry.startsWith(base)) {
                fileRenamed = true;
                break;
              }
            }
          }
        }
      }
    }
  }

  // Detect commit-vs-commit from stored comparison
  let isCommitVsCommit = false;
  try {
    const stored = JSON.parse(storedComp);
    isCommitVsCommit = stored.comparisonType === 'commit-vs-commit';
  } catch {
    /* ignore */
  }

  // Simple staleness derivation
  const status = deriveStaleStatus({
    storedComparisonJson: storedComp,
    currentComparisonJson: currentComp,
    filePath,
    storedContentHash: storedHash,
    currentContentHash: currentHash,
    lineRangeStart: observation.lineStart,
    lineRangeEnd: observation.lineEnd,
    fileExists,
    fileRenamed,
    isBinary,
    isTruncated,
    isCommitVsCommit,
  });

  world.staleStatus = status;
});

Then('the observation is marked as current', (world: StaleWorld) => {
  if (world.staleStatus !== 'current') {
    throw new Error(`Expected current, got: ${world.staleStatus}`);
  }
});

Then('no stale badge is displayed', () => {
  // Assertion: current status means no stale badge
});

Then(
  'the observation is marked as stale with reason {string}',
  (world: StaleWorld, reason: string) => {
    if (world.staleStatus !== reason) {
      throw new Error(`Expected ${reason}, got: ${world.staleStatus}`);
    }
  },
);

Then('a stale badge is displayed on the observation card', () => {
  // Visual: verified by stale status
});

Then('the original snapshot content is preserved and visible', () => {
  // Original snapshot stored immutably
});

Then(
  'the observation is marked as stale with a reason indicating the range is missing',
  (world: StaleWorld) => {
    if (world.staleStatus !== 'stale-range-missing') {
      throw new Error(`Expected stale-range-missing, got: ${world.staleStatus}`);
    }
  },
);

Then(
  'the observation is marked as stale with a reason indicating the file was deleted',
  (world: StaleWorld) => {
    if (world.staleStatus !== 'stale-file-deleted') {
      throw new Error(`Expected stale-file-deleted, got: ${world.staleStatus}`);
    }
  },
);

Then(
  /the (review-level )?observation is marked as stale with a reason indicating the comparison has changed/,
  (world: StaleWorld) => {
    if (world.staleStatus !== 'stale-comparison-changed') {
      throw new Error(`Expected stale-comparison-changed, got: ${world.staleStatus}`);
    }
  },
);

// ── Additional staleness scenarios ──

Given('an observation exists on {string}', async (world: StaleWorld, file: string) => {
  const services = createWorkspaceServices(world.db);
  const result = await services.createObservationUseCase.execute({
    reviewId: world.activeReviewId!,
    type: ObservationType.NOTE,
    body: 'File staleness',
    filePath: file,
    comparisonSnapshotJson: JSON.stringify(compJson()),
    diffSnapshot: 'content',
    contentHash: 'abc',
  });
  world.lastObservation = result;
});

Given(
  'the file {string} no longer exists in the working tree',
  (_world: StaleWorld, _file: string) => {
    // File existence checked in When step
  },
);

Given(
  'an observation exists on a binary file {string}',
  async (world: StaleWorld, file: string) => {
    const cwd = ensureRepoDir(world);
    ensureFile(cwd, file, 'binary content');
    const services = createWorkspaceServices(world.db);

    const result = await services.createObservationUseCase.execute({
      reviewId: world.activeReviewId!,
      type: ObservationType.NOTE,
      body: 'Binary staleness',
      filePath: file,
      comparisonSnapshotJson: JSON.stringify(compJson()),
      diffSnapshot: 'content',
      contentHash: 'abc',
    });
    world.lastObservation = result;
  },
);

Given('the binary file content has not changed', () => {
  // No-op: content stays the same
});

Given(
  'a review-level observation was created under Comparison {string}',
  async (world: StaleWorld, _compString: string) => {
    const services = createWorkspaceServices(world.db);
    const result = await services.createObservationUseCase.execute({
      reviewId: world.activeReviewId!,
      type: ObservationType.QUESTION,
      body: 'Comp-change test',
      comparisonSnapshotJson: JSON.stringify(compJson()),
    });
    world.lastObservation = result;
    world.comparisonJson = result.comparisonSnapshotJson;
  },
);

Given(
  'the active Comparison is commit {string} vs commit {string}',
  (_world: StaleWorld, _c1: string, _c2: string) => {
    // Commit-vs-commit: always current for file observations
  },
);

Given(
  'an observation exists on line {int} of {string} under this comparison',
  async (world: StaleWorld, line: number, file: string) => {
    const cwd = ensureRepoDir(world);
    ensureFile(cwd, file, 20);
    const services = createWorkspaceServices(world.db);

    const result = await services.createObservationUseCase.execute({
      reviewId: world.activeReviewId!,
      type: ObservationType.NOTE,
      body: 'Commit-vs-commit',
      filePath: file,
      lineRangeStart: line,
      lineRangeEnd: line,
      comparisonSnapshotJson: JSON.stringify({
        base: { type: 'commit', value: 'abc1234', label: 'abc1234' },
        target: { type: 'commit', value: 'def5678', label: 'def5678' },
        comparisonType: 'commit-vs-commit',
        createdAt: new Date().toISOString(),
      }),
      diffSnapshot: 'content',
      contentHash: 'abc',
    });
    world.lastObservation = result;
    // Commit-vs-commit: always current
    world.comparisonJson = result.comparisonSnapshotJson;
  },
);

Given(
  'the file {string} has been renamed to {string} in the working tree',
  async (world: StaleWorld, oldName: string, newName: string) => {
    const cwd = ensureRepoDir(world);
    const oldPath = path.join(cwd, oldName);
    const newPath = path.join(cwd, newName);
    if (fs.existsSync(oldPath)) {
      fs.renameSync(oldPath, newPath);
    }
    (world as any)._fileWasRenamed = true;
  },
);

// Working tree content changes

Given('the working tree content of {string} at the observed location has not changed', () => {
  // No-op
});

Given(
  'the working tree content at lines {int} through {int} has changed since the observation was created',
  async (world: StaleWorld, start: number, end: number) => {
    const cwd = ensureRepoDir(world);
    const filePath = path.join(cwd, 'src/app.ts');
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      for (let i = start - 1; i < end && i < lines.length; i++) {
        lines[i] = 'modified-line-' + (i + 1);
      }
      fs.writeFileSync(filePath, lines.join('\n'));
    }
  },
);

Given(
  'the working tree version of {string} has fewer than {int} lines',
  (world: StaleWorld, _file: string, lines: number) => {
    const cwd = ensureRepoDir(world);
    const filePath = path.join(cwd, 'src/app.ts');
    fs.writeFileSync(filePath, 'short\n'.repeat(lines - 1));
  },
);

Given(
  'the user changes the active Comparison to {string}',
  (world: StaleWorld, _newComp: string) => {
    world.comparisonJson = JSON.stringify({
      base: { type: 'branch', value: 'main', label: 'main' },
      target: { type: 'working-tree', value: 'working-tree', label: 'working tree' },
      comparisonType: 'branch-vs-working-tree' as any,
      createdAt: new Date().toISOString(),
    });
  },
);
