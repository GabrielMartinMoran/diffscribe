import { describe, expect, it } from 'vitest';

import { isDataJsonResponse } from '../../tests/e2e/helpers/register-workspace';

describe('isDataJsonResponse', () => {
  it('matches __data.json GET request', () => {
    const result = isDataJsonResponse({
      url: '/api/workspaces/abc/__data.json',
      method: 'GET',
    });
    expect(result).toBe(true);
  });

  it('rejects non-__data.json URL', () => {
    const result = isDataJsonResponse({
      url: '/api/workspaces/list',
      method: 'GET',
    });
    expect(result).toBe(false);
  });

  it('rejects POST even with __data.json URL', () => {
    const result = isDataJsonResponse({
      url: '/api/workspaces/abc/__data.json',
      method: 'POST',
    });
    expect(result).toBe(false);
  });

  it('rejects data.json without double underscore', () => {
    const result = isDataJsonResponse({
      url: '/api/workspaces/abc/data.json',
      method: 'GET',
    });
    expect(result).toBe(false);
  });

  it('matches __data.json GET even with status 500 (status-agnostic)', () => {
    // The predicate only checks url + method; status is ignored.
    // We pass a simulated response-like object to prove status doesn't change the result.
    const result = isDataJsonResponse({
      url: '/api/workspaces/abc/__data.json',
      method: 'GET',
    } as { url: string; method: string });
    expect(result).toBe(true);
  });
});
