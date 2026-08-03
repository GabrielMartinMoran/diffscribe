import { describe, expect, it } from 'vitest';

import { createRequestGuard } from '$lib/web/utils/request-guard';

describe('createRequestGuard', () => {
  it('marks the first generation as current', () => {
    const guard = createRequestGuard();
    expect(guard.isCurrent(guard.begin())).toBe(true);
  });

  it('increments generations monotonically', () => {
    const guard = createRequestGuard();
    const first = guard.begin();
    const second = guard.begin();
    expect(second).toBeGreaterThan(first);
    expect(guard.isCurrent(first)).toBe(false);
    expect(guard.isCurrent(second)).toBe(true);
  });

  it('a stale response can never overwrite a newer one', () => {
    const guard = createRequestGuard();
    const stale = guard.begin();
    const current = guard.begin();
    // The stale response resolves after the current one: it must be ignored.
    expect(guard.isCurrent(stale)).toBe(false);
    expect(guard.isCurrent(current)).toBe(true);
  });

  it('rejects a response that never began', () => {
    const guard = createRequestGuard();
    expect(guard.isCurrent(0)).toBe(false);
  });

  it('is independent per instance', () => {
    const a = createRequestGuard();
    const b = createRequestGuard();
    const a1 = a.begin();
    const b1 = b.begin();
    expect(a.isCurrent(a1)).toBe(true);
    expect(b.isCurrent(b1)).toBe(true);
    // Advancing one guard does not invalidate the other.
    a.begin();
    expect(a.isCurrent(a1)).toBe(false);
    expect(b.isCurrent(b1)).toBe(true);
  });
});
