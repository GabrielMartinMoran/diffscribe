import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const UI_DIR = path.resolve(process.cwd(), 'src/lib/web/components/ui');

const CATALOG = [
  'Button.svelte',
  'IconButton.svelte',
  'TextInput.svelte',
  'Select.svelte',
  'Checkbox.svelte',
  'Switch.svelte',
  'Menu.svelte',
  'Popover.svelte',
  'Dialog.svelte',
  'Tabs.svelte',
  'Tooltip.svelte',
  'Badge.svelte',
  'StatusBadge.svelte',
  'ids.ts',
  'variants.ts',
];

function kitFiles(): string[] {
  return fs
    .readdirSync(UI_DIR)
    .filter((f) => f.endsWith('.svelte') || f.endsWith('.ts'))
    .map((f) => path.join(UI_DIR, f));
}

function importsOf(file: string): string[] {
  const src = fs.readFileSync(file, 'utf-8');
  const imports: string[] = [];
  for (const m of src.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
    imports.push(m[1]);
  }
  return imports;
}

describe('UI kit catalog', () => {
  it('contains the 13 approved primitives plus helpers', () => {
    expect(fs.existsSync(UI_DIR)).toBe(true);
    const entries = fs.readdirSync(UI_DIR);
    for (const file of CATALOG) {
      expect(entries, `missing kit file ${file}`).toContain(file);
    }
  });

  it('is a flat directory without atom/molecule/organism grouping', () => {
    const dirs = fs
      .readdirSync(UI_DIR, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
    expect(dirs).toEqual([]);
    expect(entriesAreFlat());
  });
});

function entriesAreFlat(): boolean {
  const names = fs.readdirSync(UI_DIR).map((f) => f.toLowerCase());
  return !names.some((n) => n.includes('atom') || n.includes('molecule') || n.includes('organism'));
}

describe('UI kit import boundary', () => {
  it('kit files import only relative modules, svelte itself, or the overlay portal action', () => {
    const offenders: string[] = [];
    for (const file of kitFiles()) {
      for (const spec of importsOf(file)) {
        // The portal action (src/lib/web/actions/portal.ts) is a tranche
        // contract: Menu popups are portaled to the in-mount overlay host
        // declared by the root layout. It is the kit's only app-root
        // dependency and it never references product modules.
        if (!spec.startsWith('.') && spec !== 'svelte' && spec !== '$lib/web/actions/portal') {
          offenders.push(`${path.basename(file)} -> ${spec}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('no kit file references stores, server, application, or domain modules', () => {
    const forbidden = ['$lib/server', 'stores', 'application/', 'domain/'];
    const offenders: string[] = [];
    for (const file of kitFiles()) {
      for (const spec of importsOf(file)) {
        if (forbidden.some((f) => spec.includes(f))) {
          offenders.push(`${path.basename(file)} -> ${spec}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('no kit file contains product vocabulary', () => {
    const vocabulary =
      /\b(workspace|workspaces|review|reviews|observation|observations|diff|branch|branches|commit|commits)\b/;
    const offenders: string[] = [];
    for (const file of kitFiles()) {
      const src = fs.readFileSync(file, 'utf-8');
      if (vocabulary.test(src)) {
        offenders.push(path.basename(file));
      }
    }
    expect(offenders).toEqual([]);
  });
});
