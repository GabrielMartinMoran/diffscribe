import { describe, expect, it } from 'vitest';

import { Observation } from '$lib/server/domain/entities/observation';
import { Comparison, ComparisonType } from '$lib/server/domain/value-objects/comparison';
import { GitRef } from '$lib/server/domain/value-objects/git-ref';
import { LineRange } from '$lib/server/domain/value-objects/line-range';
import {
  ObservationSeverity,
  ObservationStatus,
  ObservationType,
} from '$lib/server/domain/value-objects/observation-enums';
import { ObservationId } from '$lib/server/domain/value-objects/observation-id';
import { ReviewId } from '$lib/server/domain/value-objects/review-id';

function makeComparison(): Comparison {
  return new Comparison({
    base: new GitRef('head', 'HEAD'),
    target: new GitRef('working-tree', 'working-tree'),
    comparisonType: ComparisonType.WORKING_TREE_VS_HEAD,
  });
}

describe('Observation', () => {
  const reviewId = ReviewId.generate();
  const comparison = makeComparison();

  it('creates a valid range-level observation', () => {
    const obs = new Observation({
      id: ObservationId.generate(),
      reviewId,
      type: ObservationType.ISSUE,
      severity: ObservationSeverity.MAJOR,
      body: 'Should validate input',
      filePath: 'src/app.ts',
      lineRange: new LineRange(10, 15),
      comparisonSnapshotJson: JSON.stringify(comparison.toJSON()),
      diffSnapshot: '+added\n-removed\n unchanged',
      contentHash: 'abc123',
    });

    expect(obs.type).toBe(ObservationType.ISSUE);
    expect(obs.severity).toBe(ObservationSeverity.MAJOR);
    expect(obs.filePath).toBe('src/app.ts');
    expect(obs.lineRange?.start).toBe(10);
    expect(obs.lineRange?.end).toBe(15);
    expect(obs.status).toBe(ObservationStatus.OPEN);
    expect(obs.origin).toBe('human');
  });

  it('creates a valid file-level observation without line range', () => {
    const obs = new Observation({
      id: ObservationId.generate(),
      reviewId,
      type: ObservationType.NOTE,
      body: 'File-level comment',
      filePath: 'src/app.ts',
      comparisonSnapshotJson: JSON.stringify(comparison.toJSON()),
      diffSnapshot: '+added\n unchanged',
      contentHash: 'def456',
    });

    expect(obs.filePath).toBe('src/app.ts');
    expect(obs.lineRange).toBeNull();
    expect(obs.diffSnapshot).toBe('+added\n unchanged');
    expect(obs.contentHash).toBe('def456');
  });

  it('creates a valid review-level observation with no file/range/hash', () => {
    const obs = new Observation({
      id: ObservationId.generate(),
      reviewId,
      type: ObservationType.QUESTION,
      body: 'Are we targeting the right branch?',
      comparisonSnapshotJson: JSON.stringify(comparison.toJSON()),
    });

    expect(obs.filePath).toBeNull();
    expect(obs.lineRange).toBeNull();
    expect(obs.diffSnapshot).toBeNull();
    expect(obs.contentHash).toBeNull();
  });

  it('rejects issue without severity', () => {
    expect(
      () =>
        new Observation({
          id: ObservationId.generate(),
          reviewId,
          type: ObservationType.ISSUE,
          body: 'Missing validation',
          filePath: 'src/app.ts',
          lineRange: new LineRange(10, 15),
          comparisonSnapshotJson: JSON.stringify(comparison.toJSON()),
          diffSnapshot: 'content',
          contentHash: 'abc',
        }),
    ).toThrow(/issue requires a severity/);
  });

  it('rejects risk without severity', () => {
    expect(
      () =>
        new Observation({
          id: ObservationId.generate(),
          reviewId,
          type: ObservationType.RISK,
          body: 'Risk without severity',
          filePath: 'src/app.ts',
          lineRange: new LineRange(1, 2),
          comparisonSnapshotJson: JSON.stringify(comparison.toJSON()),
          diffSnapshot: 'content',
          contentHash: 'abc',
        }),
    ).toThrow(/risk requires a severity/);
  });

  it('accepts praise with null severity', () => {
    const obs = new Observation({
      id: ObservationId.generate(),
      reviewId,
      type: ObservationType.PRAISE,
      body: 'Great work',
      filePath: 'src/app.ts',
      comparisonSnapshotJson: JSON.stringify(comparison.toJSON()),
      diffSnapshot: 'content',
      contentHash: 'abc',
    });

    expect(obs.severity).toBeNull();
  });

  it('rejects an empty body', () => {
    expect(
      () =>
        new Observation({
          id: ObservationId.generate(),
          reviewId,
          type: ObservationType.NOTE,
          body: '',
          filePath: 'src/app.ts',
          comparisonSnapshotJson: JSON.stringify(comparison.toJSON()),
          diffSnapshot: 'content',
          contentHash: 'abc',
        }),
    ).toThrow(/body must not be empty/);
  });

  it('rejects a whitespace-only body', () => {
    expect(
      () =>
        new Observation({
          id: ObservationId.generate(),
          reviewId,
          type: ObservationType.NOTE,
          body: '   ',
          filePath: 'src/app.ts',
          comparisonSnapshotJson: JSON.stringify(comparison.toJSON()),
          diffSnapshot: 'content',
          contentHash: 'abc',
        }),
    ).toThrow(/body must not be empty/);
  });

  it('rejects a body exceeding 5000 characters', () => {
    expect(
      () =>
        new Observation({
          id: ObservationId.generate(),
          reviewId,
          type: ObservationType.NOTE,
          body: 'x'.repeat(5001),
          filePath: 'src/app.ts',
          comparisonSnapshotJson: JSON.stringify(comparison.toJSON()),
          diffSnapshot: 'content',
          contentHash: 'abc',
        }),
    ).toThrow(/body exceeds 5000 characters/);
  });

  it('accepts a body of exactly 5000 characters', () => {
    const obs = new Observation({
      id: ObservationId.generate(),
      reviewId,
      type: ObservationType.NOTE,
      body: 'x'.repeat(5000),
      filePath: 'src/app.ts',
      comparisonSnapshotJson: JSON.stringify(comparison.toJSON()),
      diffSnapshot: 'content',
      contentHash: 'abc',
    });
    expect(obs.body).toBe('x'.repeat(5000));
  });

  it('rejects an agent instruction exceeding 2000 characters', () => {
    expect(
      () =>
        new Observation({
          id: ObservationId.generate(),
          reviewId,
          type: ObservationType.NOTE,
          body: 'Test',
          agentInstruction: 'x'.repeat(2001),
          filePath: 'src/app.ts',
          comparisonSnapshotJson: JSON.stringify(comparison.toJSON()),
          diffSnapshot: 'content',
          contentHash: 'abc',
        }),
    ).toThrow(/agentInstruction exceeds 2000 characters/);
  });

  it('defaults side to "new"', () => {
    const obs = new Observation({
      id: ObservationId.generate(),
      reviewId,
      type: ObservationType.NOTE,
      body: 'Test',
      filePath: 'src/app.ts',
      comparisonSnapshotJson: JSON.stringify(comparison.toJSON()),
      diffSnapshot: 'content',
      contentHash: 'abc',
    });
    expect(obs.side).toBe('new');
  });

  it('accepts explicit old side', () => {
    const obs = new Observation({
      id: ObservationId.generate(),
      reviewId,
      type: ObservationType.NOTE,
      body: 'Test',
      filePath: 'src/app.ts',
      side: 'old',
      comparisonSnapshotJson: JSON.stringify(comparison.toJSON()),
      diffSnapshot: 'content',
      contentHash: 'abc',
    });
    expect(obs.side).toBe('old');
  });

  it('rejects an invalid side value', () => {
    expect(
      () =>
        new Observation({
          id: ObservationId.generate(),
          reviewId,
          type: ObservationType.NOTE,
          body: 'Test',
          filePath: 'src/app.ts',
          side: 'invalid',
          comparisonSnapshotJson: JSON.stringify(comparison.toJSON()),
          diffSnapshot: 'content',
          contentHash: 'abc',
        }),
    ).toThrow(/side must be "new" or "old"/);
  });

  // Status transitions
  it('resolves an open observation', () => {
    const obs = new Observation({
      id: ObservationId.generate(),
      reviewId,
      type: ObservationType.NOTE,
      body: 'Test',
      filePath: 'src/app.ts',
      comparisonSnapshotJson: JSON.stringify(comparison.toJSON()),
      diffSnapshot: 'content',
      contentHash: 'abc',
    });
    obs.resolve();
    expect(obs.status).toBe(ObservationStatus.RESOLVED);
  });

  it('dismisses an open observation', () => {
    const obs = new Observation({
      id: ObservationId.generate(),
      reviewId,
      type: ObservationType.NOTE,
      body: 'Test',
      filePath: 'src/app.ts',
      comparisonSnapshotJson: JSON.stringify(comparison.toJSON()),
      diffSnapshot: 'content',
      contentHash: 'abc',
    });
    obs.dismiss();
    expect(obs.status).toBe(ObservationStatus.DISMISSED);
  });

  it('marks an open observation as pending', () => {
    const obs = new Observation({
      id: ObservationId.generate(),
      reviewId,
      type: ObservationType.NOTE,
      body: 'Test',
      filePath: 'src/app.ts',
      comparisonSnapshotJson: JSON.stringify(comparison.toJSON()),
      diffSnapshot: 'content',
      contentHash: 'abc',
    });
    obs.markPending();
    expect(obs.status).toBe(ObservationStatus.PENDING);
  });

  it('reopens a resolved observation', () => {
    const obs = new Observation({
      id: ObservationId.generate(),
      reviewId,
      type: ObservationType.NOTE,
      body: 'Test',
      filePath: 'src/app.ts',
      comparisonSnapshotJson: JSON.stringify(comparison.toJSON()),
      diffSnapshot: 'content',
      contentHash: 'abc',
    });
    obs.resolve();
    obs.reopen();
    expect(obs.status).toBe(ObservationStatus.OPEN);
  });

  it('reopens a dismissed observation', () => {
    const obs = new Observation({
      id: ObservationId.generate(),
      reviewId,
      type: ObservationType.NOTE,
      body: 'Test',
      filePath: 'src/app.ts',
      comparisonSnapshotJson: JSON.stringify(comparison.toJSON()),
      diffSnapshot: 'content',
      contentHash: 'abc',
    });
    obs.dismiss();
    obs.reopen();
    expect(obs.status).toBe(ObservationStatus.OPEN);
  });

  it('reopens a pending observation', () => {
    const obs = new Observation({
      id: ObservationId.generate(),
      reviewId,
      type: ObservationType.NOTE,
      body: 'Test',
      filePath: 'src/app.ts',
      comparisonSnapshotJson: JSON.stringify(comparison.toJSON()),
      diffSnapshot: 'content',
      contentHash: 'abc',
    });
    obs.markPending();
    obs.reopen();
    expect(obs.status).toBe(ObservationStatus.OPEN);
  });

  it('throws when resolving a non-open observation', () => {
    const obs = new Observation({
      id: ObservationId.generate(),
      reviewId,
      type: ObservationType.NOTE,
      body: 'Test',
      filePath: 'src/app.ts',
      comparisonSnapshotJson: JSON.stringify(comparison.toJSON()),
      diffSnapshot: 'content',
      contentHash: 'abc',
    });
    obs.resolve();
    expect(() => obs.resolve()).toThrow(
      'Cannot transition observation from "resolved" to "resolved"',
    );
  });

  it('throws when dismissing a non-open observation', () => {
    const obs = new Observation({
      id: ObservationId.generate(),
      reviewId,
      type: ObservationType.NOTE,
      body: 'Test',
      filePath: 'src/app.ts',
      comparisonSnapshotJson: JSON.stringify(comparison.toJSON()),
      diffSnapshot: 'content',
      contentHash: 'abc',
    });
    obs.dismiss();
    expect(() => obs.dismiss()).toThrow(
      'Cannot transition observation from "dismissed" to "dismissed"',
    );
  });

  it('can edit body', () => {
    const obs = new Observation({
      id: ObservationId.generate(),
      reviewId,
      type: ObservationType.NOTE,
      body: 'Original',
      filePath: 'src/app.ts',
      comparisonSnapshotJson: JSON.stringify(comparison.toJSON()),
      diffSnapshot: 'content',
      contentHash: 'abc',
    });
    obs.editBody('Updated body');
    expect(obs.body).toBe('Updated body');
  });

  it('rejects editing body to empty', () => {
    const obs = new Observation({
      id: ObservationId.generate(),
      reviewId,
      type: ObservationType.NOTE,
      body: 'Original',
      filePath: 'src/app.ts',
      comparisonSnapshotJson: JSON.stringify(comparison.toJSON()),
      diffSnapshot: 'content',
      contentHash: 'abc',
    });
    expect(() => obs.editBody('')).toThrow(/body must not be empty/);
  });

  it('rejects file-level observation without diff snapshot', () => {
    expect(
      () =>
        new Observation({
          id: ObservationId.generate(),
          reviewId,
          type: ObservationType.NOTE,
          body: 'Missing snapshot',
          filePath: 'src/app.ts',
          comparisonSnapshotJson: JSON.stringify(comparison.toJSON()),
        }),
    ).toThrow(/file-level observations require a diff snapshot/);
  });

  it('rejects a line range without a file path', () => {
    expect(
      () =>
        new Observation({
          id: ObservationId.generate(),
          reviewId,
          type: ObservationType.NOTE,
          body: 'Range without file',
          lineRange: new LineRange(10, 15),
          comparisonSnapshotJson: JSON.stringify(comparison.toJSON()),
          diffSnapshot: 'content',
          contentHash: 'abc',
        }),
    ).toThrow(/line range requires a file path/);
  });

  it('rejects diff snapshot without a file path', () => {
    expect(
      () =>
        new Observation({
          id: ObservationId.generate(),
          reviewId,
          type: ObservationType.NOTE,
          body: 'Snapshot without file',
          comparisonSnapshotJson: JSON.stringify(comparison.toJSON()),
          diffSnapshot: 'content',
          contentHash: 'abc',
        }),
    ).toThrow(/diff snapshot requires a file path/);
  });

  it('rejects a file path without a diff snapshot', () => {
    expect(
      () =>
        new Observation({
          id: ObservationId.generate(),
          reviewId,
          type: ObservationType.NOTE,
          body: 'File without snapshot',
          filePath: 'src/app.ts',
          comparisonSnapshotJson: JSON.stringify(comparison.toJSON()),
        }),
    ).toThrow(/file-level observations require a diff snapshot/);
  });

  it('rejects a file path without a content hash', () => {
    expect(
      () =>
        new Observation({
          id: ObservationId.generate(),
          reviewId,
          type: ObservationType.NOTE,
          body: 'File without hash',
          filePath: 'src/app.ts',
          comparisonSnapshotJson: JSON.stringify(comparison.toJSON()),
          diffSnapshot: 'content',
        }),
    ).toThrow(/file-level observations require a content hash/);
  });
});
