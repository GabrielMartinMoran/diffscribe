import { describe, expect, it } from 'vitest';

import { dialogTitleId, tabButtonId, tabPanelId, uid } from '$lib/web/components/ui/ids';

describe('uid', () => {
  it('returns ids prefixed with the given prefix', () => {
    expect(uid('ui-tooltip').startsWith('ui-tooltip-')).toBe(true);
  });

  it('returns unique ids for consecutive calls', () => {
    const a = uid('ui-x');
    const b = uid('ui-x');
    const c = uid('ui-x');
    expect(new Set([a, b, c]).size).toBe(3);
  });

  it('keeps prefixes independent', () => {
    expect(uid('ui-a').startsWith('ui-a-')).toBe(true);
    expect(uid('ui-b').startsWith('ui-b-')).toBe(true);
  });
});

describe('deterministic tab ids', () => {
  it('tabButtonId derives from the tab id', () => {
    expect(tabButtonId('git')).toBe('ui-tab-git');
    expect(tabButtonId('comments')).toBe('ui-tab-comments');
  });

  it('tabPanelId derives from the tab id', () => {
    expect(tabPanelId('git')).toBe('ui-tab-panel-git');
    expect(tabPanelId('comments')).toBe('ui-tab-panel-comments');
  });

  it('tab button and panel ids never collide', () => {
    expect(tabButtonId('x')).not.toBe(tabPanelId('x'));
  });
});

describe('dialogTitleId', () => {
  it('derives from the dialog id', () => {
    expect(dialogTitleId('delete-confirm')).toBe('ui-dialog-title-delete-confirm');
  });
});
