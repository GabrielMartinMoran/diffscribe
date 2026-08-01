import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const UI_DIR = path.resolve(process.cwd(), 'src/lib/web/components/ui');
const TOKENS_PATH = path.resolve(process.cwd(), 'src/lib/web/styles/tokens.css');

function declaredTokens(): Set<string> {
  const css = fs.readFileSync(TOKENS_PATH, 'utf-8');
  const tokens = new Set<string>();
  // :root block, [data-theme='dark'] block, [data-theme='synthwave-84'] block
  for (const selector of [':root', "[data-theme='dark']", "[data-theme='synthwave-84']"]) {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const block = css.match(new RegExp(`${escaped}\\s*\\{[^}]+\\}`));
    if (!block) continue;
    for (const m of block[0].matchAll(/--([a-zA-Z0-9-]+)\s*:/g)) {
      tokens.add(`--${m[1]}`);
    }
  }
  return tokens;
}

function varRefs(source: string): Set<string> {
  const refs = new Set<string>();
  for (const m of source.matchAll(/var\((--[a-zA-Z0-9-]+)/g)) {
    refs.add(m[1]);
  }
  return refs;
}

function kitSvelteFiles(): string[] {
  return fs
    .readdirSync(UI_DIR)
    .filter((f) => f.endsWith('.svelte'))
    .map((f) => path.join(UI_DIR, f));
}

describe('UI kit token audit', () => {
  it('every var() reference in kit styles is declared in all three theme blocks', () => {
    const declared = declaredTokens();
    const missing: string[] = [];
    for (const file of kitSvelteFiles()) {
      const src = fs.readFileSync(file, 'utf-8');
      const styleMatch = src.match(/<style[^>]*>([\s\S]*?)<\/style>/);
      const styleSource = styleMatch ? styleMatch[1] : '';
      const refs = varRefs(styleSource);
      for (const m of src.matchAll(/style\s*=\s*["'][^"']*?var\((--[a-zA-Z0-9-]+)/g)) {
        refs.add(m[1]);
      }
      for (const ref of refs) {
        if (!declared.has(ref)) {
          missing.push(`${path.basename(file)}: ${ref}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it('the focus ring tokens are declared in :root and available to every theme', () => {
    const css = fs.readFileSync(TOKENS_PATH, 'utf-8');
    // The repo token contract allows theme blocks to inherit focus tokens from
    // :root (see design-token-contract.feature), so the union must contain them.
    const root = css.match(/:root\s*\{[^}]+}/);
    expect(root).not.toBeNull();
    expect(root![0]).toContain('--focus-ring');
    expect(root![0]).toContain('--focus-ring-offset');
    for (const selector of ["[data-theme='dark']", "[data-theme='synthwave-84']"]) {
      const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const block = css.match(new RegExp(`${escaped}\\s*\\{[^}]+\\}`));
      expect(block, `missing block ${selector}`).not.toBeNull();
    }
  });

  it('no kit file uses forbidden wrapping or breaking utilities', () => {
    const forbidden = ['overflow-wrap:anywhere', 'word-break:break-all'];
    const offenders: string[] = [];
    for (const file of kitSvelteFiles()) {
      const src = fs.readFileSync(file, 'utf-8');
      const styleMatch = src.match(/<style[^>]*>([\s\S]*?)<\/style>/);
      const styleSource = styleMatch ? styleMatch[1] : '';
      for (const f of forbidden) {
        if (styleSource.includes(f)) {
          offenders.push(`${path.basename(file)}: ${f}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
