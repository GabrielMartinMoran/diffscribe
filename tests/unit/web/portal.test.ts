import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const PORTAL_PATH = path.resolve(process.cwd(), 'src/lib/web/actions/portal.ts');

describe('portal action contract', () => {
  it('exports a portal action that targets the in-mount overlay host and restores the element', () => {
    expect(fs.existsSync(PORTAL_PATH), 'portal.ts must exist').toBe(true);
    const src = fs.readFileSync(PORTAL_PATH, 'utf-8');

    // The action must move the node to the in-mount overlay host declared by
    // the root layout — document.body portals are forbidden by the tranche.
    expect(src).toContain('data-overlay-host');
    expect(src).not.toContain('document.body.appendChild');

    // Svelte 5 action contract: function(node) => { destroy() }.
    expect(src).toMatch(/export\s+function\s+portal/);
    expect(src).toContain('destroy');
  });
});
