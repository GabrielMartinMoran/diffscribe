import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const TOKENS_PATH = path.resolve(process.cwd(), 'src/lib/web/styles/tokens.css');
const RAIL_PATH = path.resolve(process.cwd(), 'src/lib/web/components/rail-tabs.svelte');

function themeBlock(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`${escaped}\\s*\\{[^}]+}`));
  if (!match) throw new Error(`missing token block for ${selector}`);
  return match[0];
}

describe('--text-2xs token (TOKEN-02 / RAIL-02)', () => {
  it('declares --text-2xs: 0.625rem in the :root, dark, and synthwave token blocks', () => {
    const css = fs.readFileSync(TOKENS_PATH, 'utf-8');
    for (const selector of [':root', "[data-theme='dark']", "[data-theme='synthwave-84']"]) {
      expect(themeBlock(css, selector), `block ${selector}`).toContain('--text-2xs: 0.625rem');
    }
  });

  it('uses --text-2xs on rail labels with nowrap, constrained width, and ellipsis', () => {
    const src = fs.readFileSync(RAIL_PATH, 'utf-8');
    expect(src).toContain('var(--text-2xs)');
    expect(src).toContain('white-space: nowrap');
    expect(src).toContain('max-width');
    expect(src).toContain('text-overflow: ellipsis');
    expect(src).not.toMatch(/word-break|overflow-wrap/);
  });
});
