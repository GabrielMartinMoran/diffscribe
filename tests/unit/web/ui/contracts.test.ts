import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const UI_DIR = path.resolve(process.cwd(), 'src/lib/web/components/ui');

function source(name: string): string {
  const file = path.join(UI_DIR, name);
  expect(fs.existsSync(file), `missing ${name}`).toBe(true);
  return fs.readFileSync(file, 'utf-8');
}

const expectAll = (name: string, markers: string[]) => {
  const src = source(name);
  for (const marker of markers) {
    expect(src, `${name} missing marker: ${marker}`).toContain(marker);
  }
};

describe('Button', () => {
  it('renders a native button with focus-visible and disabled wiring', () => {
    expectAll('Button.svelte', ['<button', ':focus-visible', 'disabled', 'type']);
  });
});

describe('IconButton', () => {
  it('renders a native button with a required accessible name', () => {
    expectAll('IconButton.svelte', ['<button', 'aria-label={label}']);
    expect(source('IconButton.svelte')).toMatch(/label:\s*string/);
  });
});

describe('TextInput', () => {
  it('wires label, error, and focus-visible contracts', () => {
    expectAll('TextInput.svelte', [
      '<input',
      'aria-invalid',
      'aria-describedby',
      'label',
      ':focus-visible',
    ]);
  });
});

describe('Select', () => {
  it('renders a native select with error and focus-visible wiring', () => {
    expectAll('Select.svelte', ['<select', 'aria-invalid', 'aria-describedby', ':focus-visible']);
  });

  it('is a native select, not a custom combobox', () => {
    expect(source('Select.svelte')).not.toContain('role="combobox"');
    expect(source('Select.svelte')).not.toContain('role="listbox"');
  });
});

describe('Checkbox', () => {
  it('uses a native checkbox input', () => {
    expectAll('Checkbox.svelte', ['<input', 'type="checkbox"', 'checked']);
  });
});

describe('Switch', () => {
  it('uses a native checkbox with switch role and aria-checked', () => {
    expectAll('Switch.svelte', ['<input', 'type="checkbox"', 'role="switch"', 'aria-checked']);
  });
});

describe('Dialog', () => {
  it('uses the native dialog element with showModal and a linked title', () => {
    expectAll('Dialog.svelte', ['<dialog', 'showModal', 'aria-labelledby']);
  });
});

describe('Tabs', () => {
  it('exposes tablist, tab, roving tabindex, and aria links', () => {
    expectAll('Tabs.svelte', [
      'role="tablist"',
      'role="tab"',
      'aria-controls',
      'aria-selected',
      'tabindex',
      "'Home'",
      "'End'",
    ]);
  });
});

describe('Menu', () => {
  it('exposes menu roles, trigger state, and the keyboard contract', () => {
    expectAll('Menu.svelte', [
      'aria-haspopup',
      'aria-expanded',
      'role="menu"',
      'role="menuitem"',
      "'Escape'",
      "'Home'",
      "'End'",
    ]);
  });
});

describe('Popover', () => {
  it('is non-modal with Escape handling and no menu role by default', () => {
    expectAll('Popover.svelte', ["'Escape'"]);
    expect(source('Popover.svelte')).not.toContain('role="menu"');
  });
});

describe('Tooltip', () => {
  it('links via aria-describedby, dismisses with Escape, and never uses title', () => {
    expectAll('Tooltip.svelte', ['aria-describedby', "'Escape'"]);
    const src = source('Tooltip.svelte');
    expect(src).not.toMatch(/title\s*=\s*["']/);
    expect(src).not.toContain('role="menu"');
  });
});

describe('Badge', () => {
  it('is a non-interactive span with visible text', () => {
    expectAll('Badge.svelte', ['<span']);
    expect(source('Badge.svelte')).not.toContain('role="button"');
  });
});

describe('StatusBadge', () => {
  it('is a non-interactive span with visible text and a non-color channel', () => {
    expectAll('StatusBadge.svelte', ['<span']);
    const src = source('StatusBadge.svelte');
    expect(src).not.toContain('role="button"');
    expect(src).toContain('aria-hidden');
  });
});
