import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const RAIL_TABS_PATH = path.resolve(process.cwd(), 'src/lib/web/components/rail-tabs.svelte');
const RIGHT_PANEL_TABS_PATH = path.resolve(
  process.cwd(),
  'src/lib/web/components/right-panel-tabs.svelte',
);
const PAGE_PATH = path.resolve(process.cwd(), 'src/routes/+page.svelte');

describe('Panel/rail UX correction markers (0002)', () => {
  it('left rail groups reopen + Help in one bottom container with a single auto margin', () => {
    const src = fs.readFileSync(RAIL_TABS_PATH, 'utf-8');

    // One explicit bottom-controls group wrapper exists (reopen above Help).
    expect(src).toContain('rail-bottom-controls');

    // The auto margin lives on the group container only: exactly one
    // margin-top: auto in the whole component, never on the buttons.
    const autoMarginCount = src.split('margin-top: auto').length - 1;
    expect(autoMarginCount).toBe(1);
  });

  it('left rail reopen button exposes a title fallback (0003: lives in the shell footer)', () => {
    // 0003 moved the collapse/reopen control out of the rail into the stable
    // left-region footer row; Help stays in the rail above it.
    const railSrc = fs.readFileSync(RAIL_TABS_PATH, 'utf-8');
    expect(railSrc).not.toContain('left-panel-reopen-btn');
    const pageSrc = fs.readFileSync(PAGE_PATH, 'utf-8');
    expect(pageSrc).toContain('left-region-footer');
    expect(pageSrc).toContain('title="Open left panel"');
    expect(pageSrc).toContain('title="Collapse left panel"');
  });

  it('shell wires the idempotent open-if-collapsed guard for desktop rail clicks', () => {
    const src = fs.readFileSync(PAGE_PATH, 'utf-8');
    expect(src).toContain('!isMobileViewport && $panelLayout.leftCollapsed');
    expect(src).toContain('toggleLeft()');
  });

  it('shell hides and inerts the collapsed desktop left panel subtree', () => {
    const src = fs.readFileSync(PAGE_PATH, 'utf-8');
    expect(src).toContain('inert={!isMobileViewport && $panelLayout.leftCollapsed}');
    expect(src).toContain(
      'aria-hidden={isMobileViewport ? !mobileLeftOpen : $panelLayout.leftCollapsed}',
    );
    // Desktop aside is a tabpanel linked to the active rail tab.
    expect(src).toContain('tabPanelId(activeRailTab)');
    expect(src).toContain('aria-labelledby');
  });

  it('right panel renders two vertical tablists (expanded + collapsed) with real tabpanels', () => {
    const src = fs.readFileSync(RIGHT_PANEL_TABS_PATH, 'utf-8');
    // Both desktop branches pass orientation="vertical" to the kit; the
    // mobile sheet keeps the default horizontal orientation.
    const verticalCount = src.split('orientation="vertical"').length - 1;
    expect(verticalCount).toBe(2);
    // Consumer-rendered tabpanels with reciprocal aria-labelledby.
    expect(src).toContain('tabPanelId(');
    expect(src).toContain('aria-labelledby=');
    // The expanded panel wrapper no longer carries a stray tablist role.
    expect(src).not.toContain('role="tablist"');
  });

  it('right panel uses border-box sizing and title fallbacks on icon-only controls', () => {
    const src = fs.readFileSync(RIGHT_PANEL_TABS_PATH, 'utf-8');
    const rightPanelRule = src.match(/\.right-panel\s*\{[^}]*\}/);
    expect(rightPanelRule).not.toBeNull();
    expect(rightPanelRule![0]).toContain('box-sizing: border-box');
    expect(src).toContain('title="Open right panel"');
    expect(src).toContain('title="Collapse right panel"');
  });
});
