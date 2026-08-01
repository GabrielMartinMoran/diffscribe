import { describe, expect, it } from 'vitest';

import {
  BADGE_TONES,
  BUTTON_SIZES,
  BUTTON_VARIANTS,
  CONTROL_MIN_HEIGHTS,
  CONTROL_SIZES,
  isBadgeTone,
  isButtonVariant,
  isControlSize,
  isTabOrientation,
  TAB_ORIENTATIONS,
} from '$lib/web/components/ui/variants';

describe('BUTTON_VARIANTS', () => {
  it('lists the four approved variants', () => {
    expect(BUTTON_VARIANTS).toEqual(['primary', 'secondary', 'ghost', 'danger']);
  });

  it('isButtonVariant accepts only declared variants', () => {
    expect(isButtonVariant('primary')).toBe(true);
    expect(isButtonVariant('danger')).toBe(true);
    expect(isButtonVariant('bogus')).toBe(false);
  });
});

describe('control sizes', () => {
  it('BUTTON_SIZES lists sm, md, lg', () => {
    expect(BUTTON_SIZES).toEqual(['sm', 'md', 'lg']);
  });

  it('CONTROL_SIZES lists sm, md, lg', () => {
    expect(CONTROL_SIZES).toEqual(['sm', 'md', 'lg']);
  });

  it('CONTROL_MIN_HEIGHTS keeps the provisional scale sm=24, md=32, lg=40', () => {
    expect(CONTROL_MIN_HEIGHTS).toEqual({ sm: 24, md: 32, lg: 40 });
  });

  it('isControlSize accepts only declared sizes', () => {
    expect(isControlSize('sm')).toBe(true);
    expect(isControlSize('lg')).toBe(true);
    expect(isControlSize('xl')).toBe(false);
  });
});

describe('BADGE_TONES', () => {
  it('lists the five approved tones', () => {
    expect(BADGE_TONES).toEqual(['neutral', 'info', 'success', 'warning', 'error']);
  });

  it('isBadgeTone accepts only declared tones', () => {
    expect(isBadgeTone('success')).toBe(true);
    expect(isBadgeTone('error')).toBe(true);
    expect(isBadgeTone('rainbow')).toBe(false);
  });
});

describe('TAB_ORIENTATIONS', () => {
  it('lists horizontal and vertical', () => {
    expect(TAB_ORIENTATIONS).toEqual(['horizontal', 'vertical']);
  });

  it('isTabOrientation accepts only declared orientations', () => {
    expect(isTabOrientation('vertical')).toBe(true);
    expect(isTabOrientation('diagonal')).toBe(false);
  });
});
