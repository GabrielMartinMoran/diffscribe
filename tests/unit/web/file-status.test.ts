import { describe, expect, it } from 'vitest';

import { statusTone } from '$lib/web/components/file-status';

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
    expect(statusTone('untracked')).toBe('neutral');
    expect(statusTone('unknown')).toBe('neutral');
  });

  it('falls back to neutral for unrecognized statuses', () => {
    expect(statusTone('bogus')).toBe('neutral');
  });
});
