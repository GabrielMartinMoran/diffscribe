import { describe, expect, it } from 'vitest';

import { statusLabel, statusTone } from '$lib/web/components/file-status';

describe('statusTone', () => {
  it('maps added to success', () => {
    expect(statusTone('added')).toBe('success');
  });

  it('maps deleted and unmerged to error', () => {
    expect(statusTone('deleted')).toBe('error');
    expect(statusTone('unmerged')).toBe('error');
  });

  it('maps modified and type-changed to warning', () => {
    expect(statusTone('modified')).toBe('warning');
    expect(statusTone('type-changed')).toBe('warning');
  });

  it('maps renamed and copied to info', () => {
    expect(statusTone('renamed')).toBe('info');
    expect(statusTone('copied')).toBe('info');
  });

  it('maps untracked and unknown to neutral', () => {
    expect(statusTone('unknown')).toBe('neutral');
  });

  // W5/W13: the technical `untracked` status renders as a green (success)
  // tone so "new" reads green in the UI.
  it('maps untracked to success (green tone)', () => {
    expect(statusTone('untracked')).toBe('success');
  });

  it('falls back to neutral for unrecognized statuses', () => {
    expect(statusTone('bogus')).toBe('neutral');
  });
});

describe('statusLabel', () => {
  // W5: the visible UI label for the technical `untracked` status is the
  // English word New; the technical/API status itself stays `untracked`.
  it('labels untracked as New', () => {
    expect(statusLabel('untracked')).toBe('New');
  });

  it('keeps the other technical status labels stable', () => {
    expect(statusLabel('added')).toBe('added');
    expect(statusLabel('modified')).toBe('modified');
    expect(statusLabel('deleted')).toBe('deleted');
    expect(statusLabel('renamed')).toBe('renamed');
    expect(statusLabel('copied')).toBe('copied');
    expect(statusLabel('type-changed')).toBe('type changed');
    expect(statusLabel('unmerged')).toBe('unmerged');
    expect(statusLabel('unknown')).toBe('unknown');
  });

  it('falls back to the raw status for unrecognized values', () => {
    expect(statusLabel('bogus')).toBe('bogus');
  });
});
