/**
 * DiffScribe — Base UI kit variant lists.
 *
 * Single source of truth for the variant/size/tone/orientation lists consumed
 * by the kit primitives and validated by the unit suite. Any new value must
 * be added here, documented in docs/design.md, and covered by a test.
 */

export const BUTTON_VARIANTS = ['primary', 'secondary', 'ghost', 'danger'] as const;
export type ButtonVariant = (typeof BUTTON_VARIANTS)[number];

export const BUTTON_SIZES = ['sm', 'md', 'lg'] as const;
export type ButtonSize = (typeof BUTTON_SIZES)[number];

export const CONTROL_SIZES = ['sm', 'md', 'lg'] as const;
export type ControlSize = (typeof CONTROL_SIZES)[number];

/**
 * Provisional control scale (sm=24, md=32, lg=40 px minimum heights).
 * Do not lock as a contract until E2E target-size validation passes on
 * migrated consumers (see docs/design.md — Base UI kit, Control scale).
 */
export const CONTROL_MIN_HEIGHTS = { sm: 24, md: 32, lg: 40 } as const;

export const BADGE_TONES = ['neutral', 'info', 'success', 'warning', 'error'] as const;
export type BadgeTone = (typeof BADGE_TONES)[number];

export const TAB_ORIENTATIONS = ['horizontal', 'vertical'] as const;
export type TabOrientation = (typeof TAB_ORIENTATIONS)[number];

export function isButtonVariant(value: string): value is ButtonVariant {
  return (BUTTON_VARIANTS as readonly string[]).includes(value);
}

export function isControlSize(value: string): value is ControlSize {
  return (CONTROL_SIZES as readonly string[]).includes(value);
}

export function isBadgeTone(value: string): value is BadgeTone {
  return (BADGE_TONES as readonly string[]).includes(value);
}

export function isTabOrientation(value: string): value is TabOrientation {
  return (TAB_ORIENTATIONS as readonly string[]).includes(value);
}
