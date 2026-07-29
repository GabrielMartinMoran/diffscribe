import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * Proves actual Svelte 5 delegated handler hydration with a non-destructive
 * click-smoke mutation: toggle → form visible → restore closed.
 *
 * Idempotent and safe for repeated calls within the same page session (e.g.,
 * a multi-registration loop).  The entire probe runs inside a single `toPass`
 * so every retry normalizes the toggle state before probing.
 *
 * Each `toPass` attempt:
 *   1. Checks current toggle state (`aria-expanded` / form visibility).
 *   2. If form is open → closes it and asserts closed.
 *   3. Asserts form is closed.
 *   4. Clicks toggle → asserts `aria-expanded=true` and form visible.
 *   5. Clicks toggle → asserts `aria-expanded=false` and form hidden.
 *
 * A lost pre-hydration click causes the attempt to fail; the next attempt
 * recovers from whichever state the previous attempt left.
 *
 * Contains no `waitForTimeout`, `force:true`, or `page.evaluate`.
 * networkidle is used as a precondition signal alongside the DOM assertion,
 * not as a sole signal.
 */
export async function waitForHydration(page: Page): Promise<void> {
  // Precondition: ensure the JS bundle has finished loading so Svelte 5
  // can attach delegated event handlers. Combined with the DOM assertion
  // below, this avoids using networkidle as the sole signal.
  await page.waitForLoadState('networkidle');

  // Wait for the sidebar to be visible as a secondary stability signal.
  // SvelteKit SSR renders it; its presence in the DOM confirms the page
  // layout has settled enough for the toggle to be interactive.
  const sidebar = page.locator('#workspace-sidebar');
  await expect(async () => {
    await expect(sidebar).toBeAttached({ timeout: 3000 });
    await expect(sidebar).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 20000 });

  const toggle = page.getByTestId('open-workspace-toggle');

  // Verify the toggle is in the DOM and interactive.
  await expect(async () => {
    await expect(toggle).toBeAttached({ timeout: 3000 });
    await expect(toggle).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 20000 });

  const form = page.locator('[data-testid="open-workspace-form"]');

  // Single toPass — every retry normalizes state before probing.
  // This makes the helper idempotent: if an earlier call (or a previous
  // retry within this call) left the form in an unexpected state, the next
  // retry recovers by closing it first.
  await expect(async () => {
    // ── Normalize: if form is open (or aria-expanded is true), close it ──
    const expanded = await toggle.getAttribute('aria-expanded');
    const formVisible = await form.isVisible().catch(() => false);

    if (expanded === 'true' || formVisible) {
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-expanded', 'false', {
        timeout: 5000,
      });
      await expect(form).toBeHidden({ timeout: 5000 });
    }

    // ── Assert closed before probing ──
    await expect(toggle).toHaveAttribute('aria-expanded', 'false', {
      timeout: 3000,
    });
    await expect(form).toBeHidden({ timeout: 3000 });

    // ── Open: proves delegated handler is attached ──
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true', {
      timeout: 5000,
    });
    await expect(form).toBeVisible({ timeout: 5000 });

    // ── Restore closed: leave the page in its original state ──
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false', {
      timeout: 5000,
    });
    await expect(form).toBeHidden({ timeout: 5000 });
  }).toPass({ timeout: 40000 });
}
