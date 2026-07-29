import { describe, expect, it } from 'vitest';

import { StaleStatus } from '$lib/server/domain/value-objects/stale-status';

describe('StaleStatus', () => {
  it('defines all nine stale status values', () => {
    expect(StaleStatus.CURRENT).toBe('current');
    expect(StaleStatus.STALE_CONTENT_CHANGED).toBe('stale-content-changed');
    expect(StaleStatus.STALE_RANGE_MISSING).toBe('stale-range-missing');
    expect(StaleStatus.STALE_FILE_DELETED).toBe('stale-file-deleted');
    expect(StaleStatus.STALE_FILE_RENAMED).toBe('stale-file-renamed');
    expect(StaleStatus.STALE_BINARY).toBe('stale-binary');
    expect(StaleStatus.STALE_TRUNCATED).toBe('stale-truncated');
    expect(StaleStatus.STALE_COMPARISON_CHANGED).toBe('stale-comparison-changed');
    expect(StaleStatus.STALE_UNKNOWN).toBe('stale-unknown');
  });
});
