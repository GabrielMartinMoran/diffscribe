import type { APIRequestContext } from '@playwright/test';

const RESET_SECRET = 'e2e-reset-894a7f3c';

/**
 * Calls the fail-closed E2E reset endpoint to clear the database
 * before each test. Fails fast if the reset is misconfigured.
 */
export async function resetDb(request: APIRequestContext): Promise<void> {
  const response = await request.delete('/api/test/state', {
    headers: { 'x-reset-secret': RESET_SECRET },
  });
  if (!response.ok()) {
    const body = await response.text().catch(() => '<unreadable>');
    throw new Error(
      `E2E DB reset failed: status ${response.status()}, body: ${body}. ` +
        'Check DIFFSCRIBE_DB_DIR and DIFFSCRIBE_E2E_RESET_SECRET configuration.',
    );
  }
}
