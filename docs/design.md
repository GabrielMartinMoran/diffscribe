# DiffScribe — Design guide

**Status:** Updated for UI redesign v1. The icon set (Lucide), theme system
(Dark Deep + Synthwave '84), left rail layout with contextual panel, right
panel with Comments/Review, panel resize/collapse, and the Base UI kit
contract are resolved. Final visual branding and typography remain
`[PENDIENTE]`.

This guide defines DiffScribe's visual system: principles, CSS tokens, layout,
responsive behavior, component states, accessibility, and validation. It is
the single source of truth for all visual decisions.

---

## Visual principles

### Hierarchy

The interface must communicate priority without ambiguity. The diff is the
central element; observations and navigation surround it without competing.
Hierarchy is built with size, weight, color, and position, not decoration.

### Focus

Each view has a clear purpose. The user must be able to identify in under a
second what they can do in each zone. Actionable elements are distinguished
from static content by contrast and affordance, not just color.

### Density for code reading

The diff viewer requires controlled density: enough visible context without
overwhelming. Spacing, line-height, and font size are calibrated for prolonged
code reading, not for quick text consumption.

### Clarity

The interface avoids ambiguity. Diff states (added, removed, modified),
observation severities, and content types are distinguished by multiple
channels: color, icon, position, and text.

### Intentional design

No visual element exists by default. Every color, spacing, border, and shadow
has a reason tied to the reviewer's experience. Generic decoration is avoided.

### Cognitive accessibility

The interface reduces cognitive load through:

- predictable and consistent structure across views;
- visible and descriptive labels;
- immediate feedback on every action;
- documented and discoverable keyboard shortcuts;
- absence of unnecessary or distracting animations.

---

## Token hierarchy

Tokens are organized in three tiers. Each tier inherits from or constrains the
previous one:

```text
primitives → semantics → component
```

- **Primitives:** atomic values (base colors, spacing scales, radii). They have
  no semantic meaning by themselves.
- **Semantics:** tokens with functional meaning (primary surface, high-contrast
  text, subtle border). They map primitives to roles.
- **Component:** component-specific tokens (file-list-item-hover,
  diff-added-bg). They constrain semantic tokens to a concrete context.

Components consume component-level tokens. A component token is only created
when the value differs from the semantic token it inherits.

---

## Color tokens

### Surfaces

| Token                     | Light              | Dark               |
| ------------------------- | ------------------ | ------------------ |
| `--surface-primary`       | `#FFFFFF`          | `#1A1A2E`         |
| `--surface-secondary`     | `#F8F9FA`          | `#16213E`         |
| `--surface-tertiary`      | `#F1F3F5`          | `#0F3460`         |
| `--surface-elevated`      | `#FFFFFF`          | `#1A1A2E`         |
| `--surface-overlay`       | `rgba(0,0,0,0.04)` | `rgba(0,0,0,0.30)` |

### Text

| Token                     | Light              | Dark               |
| ------------------------- | ------------------ | ------------------ |
| `--text-primary`          | `#1A1A2E`          | `#E4E6EB`         |
| `--text-secondary`        | `#495057`          | `#B0B3B8`         |
| `--text-tertiary`         | `#868E96`          | `#6C757D`         |
| `--text-inverse`          | `#FFFFFF`          | `#1A1A2E`         |
| `--text-link`             | `#2563EB`          | `#60A5FA`         |

### Borders

| Token                     | Light              | Dark               |
| ------------------------- | ------------------ | ------------------ |
| `--border-subtle`         | `#E9ECEF`          | `#2D2D44`         |
| `--border-default`        | `#DEE2E6`          | `#3D3D5C`         |
| `--border-strong`         | `#ADB5BD`          | `#5A5A7A`         |

### Accent

| Token                     | Light              | Dark               |
| ------------------------- | ------------------ | ------------------ |
| `--accent`                | `#2563EB`          | `#3B82F6`         |
| `--accent-hover`          | `#1D4ED8`          | `#60A5FA`         |
| `--accent-muted`          | `#EFF6FF`          | `#1E3A5F`         |
| `--accent-light`          | `rgba(37,99,235,0.08)` | `rgba(59,130,246,0.1)` |

The accent color `#2563EB` is initial and `[PENDIENTE]` for final validation.
The value in dark mode adjusts automatically to maintain equivalent contrast.
`--accent-light` provides a subtle accent-tinted background for active tabs,
selected rows, and muted accent surfaces. It is a token value, distinct from
the Synthwave '84 palette role "Light accent" (`#540d6e`), which is a palette
color and not a token.

### Focus

| Token                     | Value              |
| ------------------------- | ------------------ |
| `--focus-ring`            | `#2563EB`          |
| `--focus-ring-offset`     | `2px`               |

### Diff states

| Token                     | Light              | Dark               |
| ------------------------- | ------------------ | ------------------ |
| `--diff-added-bg`         | `#E6FFEC`          | `#0D3320`         |
| `--diff-added-border`     | `#ABF2C2`          | `#196F3D`         |
| `--diff-added-text`       | `#116329`          | `#57D68D`         |
| `--diff-removed-bg`       | `#FFEBE9`          | `#3D1212`         |
| `--diff-removed-border`   | `#FFB1A8`          | `#78281F`         |
| `--diff-removed-text`     | `#8B1C0C`          | `#E06C5D`         |
| `--diff-modified-bg`      | `#FFF8E5`          | `#3D2E00`         |
| `--diff-modified-border`  | `#FFE082`          | `#7D6600`         |
| `--diff-hunk-header-bg`   | `#F0F4FF`          | `#1A2744`         |
| `--diff-line-number`      | `#6C757D`          | `#6C757D`         |

### File states (file list)

| Token                           | Light              | Dark               |
| ------------------------------- | ------------------ | ------------------ |
| `--file-list-row-hover`         | `rgba(0,0,0,0.04)` | `rgba(255,255,255,0.06)` |
| `--file-list-row-active`        | `#EFF6FF`          | `#1E3A5F`         |
| `--file-list-status-modified-bg`| `#FFF8E5`          | `#3D2E00`         |
| `--file-list-status-modified-text`| `#92400E`        | `#FCD34D`         |
| `--file-list-status-deleted-bg` | `#FFEBE9`          | `#3D1212`         |
| `--file-list-status-deleted-text`| `#991B1B`         | `#FCA5A5`         |
| `--file-list-status-renamed-bg` | `#EFF6FF`          | `#1E3A5F`         |
| `--file-list-status-renamed-text`| `#1D4ED8`         | `#93C5FD`         |
| `--file-list-status-untracked-bg`| `#F8F9FA`         | `#2D2D44`         |
| `--file-list-status-untracked-text`| `#6C757D`       | `#9CA3AF`         |
| `--file-list-status-unmerged-bg`| `#FEF2F2`          | `#3D1212`         |
| `--file-list-status-unmerged-text`| `#DC2626`        | `#EF4444`         |
| `--file-list-binary-badge-bg`   | `#6C757D`          | `#9CA3AF`         |
| `--file-list-binary-badge-text` | `#FFFFFF`          | `#1A1A2E`         |

`untracked` states are visually treated neutrally (grayscale) to indicate the
file is not under version control. The binary indicator is applied via a
compact badge next to the status badge; the indicator does not rely on color
as the sole channel.

### Observation severities

| Token                     | Light              | Dark               |
| ------------------------- | ------------------ | ------------------ |
| `--severity-critical`     | `#DC2626`          | `#EF4444`         |
| `--severity-major`        | `#EA580C`          | `#F97316`         |
| `--severity-minor`        | `#CA8A04`          | `#EAB308`         |
| `--severity-info`         | `#2563EB`          | `#3B82F6`         |

### Observation types

| Type           | Light color    | Dark color     |
| -------------- | -------------- | -------------- |
| Issue          | `#DC2626`      | `#EF4444`      |
| Risk           | `#EA580C`      | `#F97316`      |
| Suggestion     | `#2563EB`      | `#3B82F6`      |
| Question       | `#8B5CF6`      | `#A78BFA`      |
| Praise         | `#16A34A`      | `#22C55E`      |
| Note           | `#6C757D`      | `#9CA3AF`      |

### Component states

| Token                     | Light              | Dark               |
| ------------------------- | ------------------ | ------------------ |
| `--state-hover`           | `rgba(0,0,0,0.04)` | `rgba(255,255,255,0.06)` |
| `--state-active`          | `rgba(0,0,0,0.08)` | `rgba(255,255,255,0.10)` |
| `--state-disabled-bg`     | `#F1F3F5`          | `#2D2D44`         |
| `--state-disabled-text`   | `#ADB5BD`          | `#5A5A7A`         |
| `--state-error-bg`        | `#FEF2F2`          | `#3D1212`         |
| `--state-error-border`    | `#FECACA`          | `#78281F`         |
| `--state-success-bg`      | `#F0FDF4`          | `#0D3320`         |
| `--state-success-border`  | `#BBF7D0`          | `#196F3D`         |
| `--state-loading`         | `#E9ECEF`          | `#3D3D5C`         |

---

## Typography

Final typography is `[PENDIENTE]`. System font family stacks are used as the
initial fallback:

```css
--font-family-sans: system-ui, -apple-system, 'Segoe UI', Roboto,
  'Helvetica Neue', Arial, sans-serif;
--font-family-mono: ui-monospace, SFMono-Regular, 'Cascadia Code', 'Fira Code',
  Menlo, Consolas, monospace;
/* Aliases */
--font-sans: var(--font-family-sans);
--font-mono: var(--font-family-mono);
```

### Scale

| Token             | Size / Line-height | Use                                |
| ----------------- | ------------------ | ---------------------------------- |
| `--text-xs`       | `0.75rem / 1rem`   | Line numbers, badges, timestamps   |
| `--text-sm`       | `0.8125rem / 1.25rem` | Diff code, file list            |
| `--text-base`     | `0.875rem / 1.5rem` | UI text, observations             |
| `--text-lg`       | `1rem / 1.5rem`    | Section titles                     |
| `--text-xl`       | `1.125rem / 1.5rem` | Panel headings                   |
| `--text-2xl`      | `1.5rem / 1.75rem`  | Review title                      |

### Weights

| Token                    | Value | Use                          |
| ------------------------ | ----- | ---------------------------- |
| `--font-weight-normal`   | 400   | General text                 |
| `--font-weight-medium`   | 500   | Subtle emphasis, labels      |
| `--font-weight-semibold` | 600   | Titles, active navigation    |
| `--font-weight-bold`     | 700   | Severities, counters         |

### Line heights

| Token                 | Value   | Use                                      |
| --------------------- | ------- | ---------------------------------------- |
| `--line-height-tight` | `1rem`  | Badges, line numbers, dense elements     |
| `--line-height-code`  | `1.25rem` | Diff code, file list                  |
| `--line-height-normal` | `1.5rem` | UI text, observations, titles         |
| `--line-height-relaxed` | `1.75rem` | Review titles                       |

---

## Spacing

4px base scale.

| Token         | Value | Use                                   |
| ------------- | ----- | ------------------------------------- |
| `--space-0`   | 0     | No space                              |
| `--space-1`   | 4px   | Minimum gap, icons next to text       |
| `--space-2`   | 8px   | Reduced internal padding              |
| `--space-3`   | 12px  | Component padding                     |
| `--space-4`   | 16px  | Panel padding, gap between sections   |
| `--space-5`   | 20px  | Separation between groups             |
| `--space-6`   | 24px  | Layout margin                         |
| `--space-8`   | 32px  | Zone separation                       |
| `--space-10`  | 40px  | Page margin                           |
| `--space-12`  | 48px  | Major separation                      |

---

## Radii

| Token            | Value | Use                          |
| ---------------- | ----- | ---------------------------- |
| `--radius-none`  | 0     | Panels, diff lines           |
| `--radius-sm`    | 4px   | Buttons, inputs, badges      |
| `--radius-md`    | 6px   | Cards, modals                |
| `--radius-lg`    | 8px   | Main panels                  |
| `--radius-full`  | 9999px | Pills, tags                |

---

## Shadows

| Token             | Value                                                  | Use                     |
| ----------------- | ------------------------------------------------------ | ----------------------- |
| `--shadow-none`   | none                                                   | Default                 |
| `--shadow-sm`     | `0 1px 2px rgba(0,0,0,0.06)`                          | File list hover         |
| `--shadow-md`     | `0 2px 8px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)` | Dropdowns, tooltips  |
| `--shadow-lg`     | `0 4px 16px rgba(0,0,0,0.12)`                         | Modals                  |
| `--shadow-xl`     | `0 4px 24px rgba(0,0,0,0.15)`                         | Confirm dialogs, elevated surfaces |

---

## Z-index

| Token                  | Value | Use                           |
| ---------------------- | ----- | ----------------------------- |
| `--z-base`             | 0     | Content                       |
| `--z-dropdown`         | 100   | Dropdowns, selects            |
| `--z-sticky`           | 200   | Fixed headers                 |
| `--z-overlay`          | 300   | Overlays, backdrops           |
| `--z-modal`            | 400   | Modals                        |
| `--z-toast`            | 500   | Notifications                 |
| `--z-tooltip`          | 600   | Tooltips                      |

---

## Motion

| Token                  | Value  | Use                                |
| ---------------------- | ------ | ---------------------------------- |
| `--duration-instant`   | 0ms    | Changes without animation          |
| `--duration-fast`      | 150ms  | Hover, focus, toggle               |
| `--duration-normal`    | 250ms  | Panel transitions, expand          |
| `--duration-slow`      | 350ms  | Modal entrance, reveal             |
| `--ease-default`       | `cubic-bezier(0.16, 1, 0.3, 1)` | Standard curve          |
| `--ease-out`           | `cubic-bezier(0, 0, 0.2, 1)`    | Entrance               |
| `--ease-in`            | `cubic-bezier(0.4, 0, 1, 1)`    | Exit                   |

---

## Reference CSS

### `:root` — light theme

```css
:root {
  /* Surfaces */
  --surface-primary: #FFFFFF;
  --surface-secondary: #F8F9FA;
  --surface-tertiary: #F1F3F5;
  --surface-elevated: #FFFFFF;
  --surface-overlay: rgba(0, 0, 0, 0.04);

  /* Text */
  --text-primary: #1A1A2E;
  --text-secondary: #495057;
  --text-tertiary: #868E96;
  --text-inverse: #FFFFFF;
  --text-link: #2563EB;

  /* Borders */
  --border-subtle: #E9ECEF;
  --border-default: #DEE2E6;
  --border-strong: #ADB5BD;

  /* Accent */
  --accent: #2563EB;
  --accent-hover: #1D4ED8;
  --accent-muted: #EFF6FF;
  --accent-light: rgba(37, 99, 235, 0.08);

  /* Focus */
  --focus-ring: #2563EB;
  --focus-ring-offset: 2px;

  /* Diff */
  --diff-added-bg: #E6FFEC;
  --diff-added-border: #ABF2C2;
  --diff-added-text: #116329;
  --diff-removed-bg: #FFEBE9;
  --diff-removed-border: #FFB1A8;
  --diff-removed-text: #8B1C0C;
  --diff-modified-bg: #FFF8E5;
  --diff-modified-border: #FFE082;
  --diff-hunk-header-bg: #F0F4FF;
  --diff-line-number: #6C757D;

  /* Severities */
  --severity-critical: #DC2626;
  --severity-major: #EA580C;
  --severity-minor: #CA8A04;
  --severity-info: #2563EB;

  /* States */
  --state-hover: rgba(0, 0, 0, 0.04);
  --state-active: rgba(0, 0, 0, 0.08);
  --state-disabled-bg: #F1F3F5;
  --state-disabled-text: #ADB5BD;
  --state-error-bg: #FEF2F2;
  --state-error-border: #FECACA;
  --state-success-bg: #F0FDF4;
  --state-success-border: #BBF7D0;
  --state-loading: #E9ECEF;

  /* Typography */
  --font-family-mono: ui-monospace, SFMono-Regular, 'Cascadia Code',
    'Fira Code', Menlo, Consolas, monospace;
  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;
  --line-height-tight: 1rem;
  --line-height-code: 1.25rem;
  --line-height-normal: 1.5rem;
  --line-height-relaxed: 1.75rem;
  --text-xs: 0.75rem;
  --text-sm: 0.8125rem;
  --text-base: 0.875rem;
  --text-lg: 1rem;
  --text-xl: 1.125rem;
  --text-2xl: 1.5rem;

  /* Spacing */
  --space-0: 0;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;

  /* Radii */
  --radius-none: 0;
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --radius-full: 9999px;

  /* Shadows */
  --shadow-none: none;
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.06);
  --shadow-md: 0 2px 8px rgba(0, 0, 0, 0.08),
               0 1px 2px rgba(0, 0, 0, 0.04);
  --shadow-lg: 0 4px 16px rgba(0, 0, 0, 0.12);
  --shadow-xl: 0 4px 24px rgba(0, 0, 0, 0.15);

  /* Z-index */
  --z-base: 0;
  --z-dropdown: 100;
  --z-sticky: 200;
  --z-overlay: 300;
  --z-modal: 400;
  --z-toast: 500;
  --z-tooltip: 600;

  /* Motion */
  --duration-instant: 0ms;
  --duration-fast: 150ms;
  --duration-normal: 250ms;
  --duration-slow: 350ms;
  --ease-default: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-out: cubic-bezier(0, 0, 0.2, 1);
  --ease-in: cubic-bezier(0.4, 0, 1, 1);
}
```

### `[data-theme="dark"]`

```css
[data-theme="dark"] {
  --surface-primary: #1A1A2E;
  --surface-secondary: #16213E;
  --surface-tertiary: #0F3460;
  --surface-elevated: #1A1A2E;
  --surface-overlay: rgba(0, 0, 0, 0.30);

  --text-primary: #E4E6EB;
  --text-secondary: #B0B3B8;
  --text-tertiary: #6C757D;
  --text-inverse: #1A1A2E;
  --text-link: #60A5FA;

  --border-subtle: #2D2D44;
  --border-default: #3D3D5C;
  --border-strong: #5A5A7A;

  --accent: #3B82F6;
  --accent-hover: #60A5FA;
  --accent-muted: #1E3A5F;
  --accent-light: rgba(59, 130, 246, 0.1);

  --state-hover: rgba(255, 255, 255, 0.06);
  --state-active: rgba(255, 255, 255, 0.10);
  --state-disabled-bg: #2D2D44;
  --state-disabled-text: #5A5A7A;
  --state-error-bg: #3D1212;
  --state-error-border: #78281F;
  --state-success-bg: #0D3320;
  --state-success-border: #196F3D;
  --state-loading: #3D3D5C;

  --diff-added-bg: #0D3320;
  --diff-added-border: #196F3D;
  --diff-added-text: #57D68D;
  --diff-removed-bg: #3D1212;
  --diff-removed-border: #78281F;
  --diff-removed-text: #E06C5D;
  --diff-modified-bg: #3D2E00;
  --diff-modified-border: #7D6600;
  --diff-hunk-header-bg: #1A2744;

  --severity-critical: #EF4444;
  --severity-major: #F97316;
  --severity-minor: #EAB308;
  --severity-info: #3B82F6;

  --shadow-none: none;
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.20);
  --shadow-md: 0 2px 8px rgba(0, 0, 0, 0.30),
               0 1px 2px rgba(0, 0, 0, 0.20);
  --shadow-lg: 0 4px 16px rgba(0, 0, 0, 0.40);
  --shadow-xl: 0 4px 24px rgba(0, 0, 0, 0.5);
}
```

### `prefers-reduced-motion`

```css
@media (prefers-reduced-motion: reduce) {
  :root {
    --duration-instant: 0ms;
    --duration-fast: 0ms;
    --duration-normal: 0ms;
    --duration-slow: 0ms;
  }
}
```

---

## Themes

DiffScribe includes two global user-selectable themes. The preference is stored
in browser `localStorage` (client‑only, not persisted on server). The theme key
is `ThemeKey: dark | synthwave-84`.

### Dark Deep (default)

The dark theme defined in `[data-theme="dark"]` is the Dark Deep theme. Its
values are documented in the Color tokens section table and in the
corresponding CSS block. It is the default theme of the application.

### Synthwave '84'

Alternative theme inspired by the retro‑futuristic Synthwave '84 palette. The
palette comes from https://www.color-hex.com/color-palette/114197:

| Role           | Hex       | Use                                        |
| -------------- | --------- | ------------------------------------------ |
| Deep background| `#0d0221` | Primary surfaces                           |
| Mid background | `#2e2157` | Secondary surfaces, borders                |
| Accent         | `#920075` | Primary accent, active hover               |
| Light accent   | `#540d6e` | Secondary accent, muted                    |
| Neon           | `#2de2e6` | High-contrast text, focus, selection       |

The glow (bright outer shadow) is applied exclusively to focus states
(`focus-visible`), active selection, and elements with `active` state. No glow
is applied to elements in default state, simple hover, or static elements. The
glow is implemented with `box-shadow` and the neon color `#2de2e6` with
controlled opacity.

```css
[data-theme="synthwave-84"] {
  --surface-primary: #0d0221;
  --surface-secondary: #2e2157;
  --surface-tertiary: #1a0a3e;
  --surface-elevated: #0d0221;
  --surface-overlay: rgba(45, 33, 87, 0.30);

  --text-primary: #2de2e6;
  --text-secondary: #b0a8d0;
  --text-tertiary: #7a6a9a;
  --text-inverse: #0d0221;
  --text-link: #2de2e6;

  --border-subtle: #2e2157;
  --border-default: #540d6e;
  --border-strong: #920075;

  --accent: #920075;
  --accent-hover: #b0108a;
  --accent-muted: #2e2157;
  --accent-light: rgba(146, 0, 117, 0.1);

  --focus-ring: #2de2e6;
  --focus-ring-offset: 2px;

  --state-hover: rgba(45, 33, 87, 0.40);
  --state-active: rgba(146, 0, 117, 0.30);
  --state-disabled-bg: #1a0a3e;
  --state-disabled-text: #7a6a9a;
  --state-error-bg: #3d1212;
  --state-error-border: #78281f;
  --state-success-bg: #0d3320;
  --state-success-border: #196f3d;
  --state-loading: #2e2157;

  --diff-added-bg: rgba(45, 222, 230, 0.10);
  --diff-added-border: #2de2e6;
  --diff-added-text: #2de2e6;
  --diff-removed-bg: rgba(146, 0, 117, 0.15);
  --diff-removed-border: #920075;
  --diff-removed-text: #e06c5d;
  --diff-modified-bg: rgba(84, 13, 110, 0.20);
  --diff-modified-border: #540d6e;
  --diff-hunk-header-bg: #2e2157;

  --severity-critical: #ef4444;
  --severity-major: #f97316;
  --severity-minor: #eab308;
  --severity-info: #2de2e6;

  --shadow-none: none;
  --shadow-sm: 0 1px 2px rgba(45, 222, 230, 0.10);
  --shadow-md: 0 2px 8px rgba(45, 222, 230, 0.15);
  --shadow-lg: 0 4px 16px rgba(45, 222, 230, 0.20);
  --shadow-xl: 0 4px 24px rgba(45, 222, 230, 0.25);
}
```

Diff tokens in Synthwave use neon and accent colors with controlled opacity to
maintain legibility without saturating the dark background.

---

## Breakpoints

| Breakpoint  | Range                    | Use                                      |
| ----------- | ------------------------ | ---------------------------------------- |
| `compact`   | `max-width: 768px`       | Mobile, single panel, overlay drawers    |
| `tablet`    | `769px – 1024px`         | Rail + collapsible contextual panel      |
| `desktop`   | `min-width: 1025px`      | Rail + contextual panel + right panel    |
| `wide`      | `min-width: 1440px`      | Maximum space, expanded panels           |

The layout adopts mobile-first: the interface is functional from the start on
compact, and capabilities expand progressively on tablet, desktop, and wide.
There is no "desktop-only" version that later adapts to mobile.

---

## Responsive behavior

### Rail and contextual panel

- **Compact (mobile):** the left rail shrinks to icons without visible labels.
  The contextual panel and right panel appear as overlay drawers or bottom
  sheets, never permanent. Only one zone visible at a time.
- **Tablet:** rail with icons; contextual panel is collapsible. The right panel
  appears as an overlay when activating a tab.
- **Desktop and wide:** rail + contextual panel visible. The right panel is
  visible when there is an active review.

### Project tree (Project tab)

- **Compact:** collapsible tree occupying full width over the central area when
  activated.
- **Tablet:** narrow side panel, collapsible.
- **Desktop and wide:** contextual panel with tree visible (resizable width).

#### Review marker

When an active review exists, each file list row displays a visual review
status marker:

- **Reviewed (✓):** green (`--diff-added-fg`), bold. Indicates the file was marked as reviewed.
- **Not reviewed (○):** tertiary gray with 0.5 opacity. Indicates the file was not yet marked.
- **No active review:** the `.review-cell` column is not rendered (0 width).

The marker uses `aria-label="Reviewed"` / `aria-label="Not reviewed"` for
accessibility. It is positioned to the right of the stats cell (±), with a
fixed width of 32px.

#### Review progress

The ReviewPanel displays a `<progress>` bar with percentage derived from
`reviewedCount / totalCount`. The text accompanies in `N/M files reviewed`
format. The bar uses `--accent` as fill color and `--surface-tertiary` as
background. It respects `prefers-reduced-motion` by removing transitions.

**Review selection in the list:** Each option in the review list
(`role="listbox"`) uses `role="option"` with `aria-selected` reflecting whether
the review is the active one (`review.id === activeReview.id`).

### Diff viewer

- **Compact:** unified by default. Side-by-side not available.
- **Tablet:** unified by default; side-by-side available if the viewport
  exceeds approximately 900px width.
- **Desktop:** unified or side-by-side per user preference.
- **Wide:** comfortable side-by-side with visible line numbers.

### Right panel (Comments / Review)

The right panel contains two tabs: Comments (observation list) and Review
(progress and active review controls).

- **Compact:** bottom or overlay drawer covering the central area.
- **Tablet:** side overlay when activating a tab; collapsible.
- **Desktop and wide:** right side panel (~320px), collapsible and resizable.

---

## Rail + panels layout

The main interface is organized in three zones plus a left rail:

```text
┌───┬────────────────┬──────────────────────┬──────────────┐
│   │  Contextual    │                      │              │
│   │  Panel         │   Central Area       │  Right       │
│ R │ ────────────── │  (Diff Viewer /      │  Panel       │
│ A │ • Workspaces   │   Source View)       │ ───────────  │
│ I │ • Project      │                      │ • Comments   │
│ L │ • Git          │                      │ • Review     │
│   │                │                      │              │
└───┴────────────────┴──────────────────────┴──────────────┘
```

### Left rail

Compact rail of icons (Lucide) that allows toggling between global views:
Workspaces, settings, and preferences. It is fixed, does not scroll. Its width
is designed for icons without labels on compact desktop and expands on wide.

### Contextual panel

Collapsible and resizable panel to the right of the rail. Contains three tabs:

- **Workspaces:** registered workspaces list, quick selector, and history
  access.
- **Project:** full read‑only tree of the active repository. When opening a
  file, the central area shows the normal source with syntax highlighting and
  Git-affected line markers (change type), without diff.
- **Git:** existing Git comparison (status, branches, commits) and integrated
  diff viewer.

The contextual panel scrolls its content independently per the active tab.

### Central area

Shows the main content:

- **Diff Viewer** (from the Git tab): unified or side‑by‑side view of the diff
  between two Git states.
- **Source View** (from the Project tab): source of the selected file with
  syntax highlighting and affected line markers.

### Right panel

Collapsible and resizable panel with two tabs:

- **Comments:** list of observations/comments on the active review.
- **Review:** summary, progress, and controls of the active review.

Both panels (contextual and right) can be collapsed and resized within
predefined minimum and maximum limits.

### Scroll ownership

Each zone handles its own scroll independently:

- The **left rail** is fixed (does not scroll).
- The **contextual panel** scrolls vertically its content (Project tree,
  Workspaces list, Git context). Each tab has its own scroll.
- The **central area** (Diff Viewer or Source View) scrolls vertically and
  horizontally (for long lines in side-by-side or extensive source files).
- The **right panel** scrolls vertically its content (Comments and Review).
- The **global navigation** (header) is fixed (does not scroll).

The main viewport scrollbar belongs to the central area. The side panels do
not push the central content.

**Implementation (tranche):** the application is viewport-bound. `html` and
`body` set `overflow: hidden`; the shell grid uses a fixed
`height: 100dvh`; every grid item (rail, contextual panel, center content,
right panel) sets `min-height: 0` so zones cannot grow the shell. Zones that
own vertical scroll (`project-tree`, `diff-viewer`, panels) combine
`flex: 1; min-height: 0; overflow-y: auto`. The document never scrolls.

### Diff line wrapping (tranche)

Diff lines are **no-wrap by default**: `white-space: pre`. Long lines extend
the file's single horizontal scrollbar, owned by the diff viewer container
(`overflow-x: auto` on the viewer; per-line and per-column scrollbars are
prohibited).

- The contextual **Wrap** toggle in the diff header (aria-pressed) overrides
  the default for the current file only (not persisted).
- The global default lives in **Settings → Editor** ("Line wrapping"), is
  stored in `localStorage` under `diffscribe-line-wrap`, defaults to
  `false`, and applies to newly opened diffs.
- Wrap mode uses `white-space: pre-wrap`. `overflow-wrap: anywhere` and
  `word-break: break-all` are prohibited.
- No JavaScript scroll synchronization between zones.

### Settings (tranche)

The rail exposes a **Settings** entry at its bottom (fourth tab). Activating
it opens the Settings panel in the contextual area:

- **Appearance:** theme selection (Dark Deep / Synthwave '84). The theme
  switcher is not rendered in panel headers anymore.
- **Editor:** line wrapping default (see above).

Settings are client-only preferences; they persist in `localStorage` and are
not part of the server-side domain model.

### Git panel — branches and comparisons (tranche)

The Git contextual panel lists **local branches** and **cached remote
branches** (`refs/remotes/*` read with `git for-each-ref`, read-only). No
`git fetch`, tags, or network operation is ever executed; remote refs are
whatever the local clone already has on disk. Remote branches are marked
with a "remote" tag and are selectable as comparison refs.

The **Base/Target selector** works on the ephemeral comparison draft:

- Selecting a target **auto-activates the Base slot** with the current
  branch when the draft default (HEAD) has not been touched; a user-chosen
  base is preserved.
- The **ComparisonType is inferred from the real base/target pair**
  (`inferComparisonType`), never hardcoded: branch+branch →
  branch-vs-branch, commit+commit (or any pair containing a commit) →
  commit-vs-commit, commit+branch → commit-vs-commit (a branch is a commit
  pointer), HEAD+branch → branch-vs-branch, working tree pairs →
  working-tree-vs-head / branch-vs-working-tree / commit-vs-working-tree,
  index pairs → staged-vs-head / unstaged.
- The inferred type renders as a readable feedback label next to the slots.

### Side-by-side minimum

Side-by-side mode requires a minimum approximate width of 900px in the viewport
to be usable. Below that threshold, the interface forces unified regardless of
the user's preference.

---

## Panel collapse and resize

The contextual (left) and right panels can be collapsed and resized via drag
handles:

### Collapse

- Each panel has a toggle button (Lucide icon `PanelLeftClose` /
  `PanelLeftOpen` for contextual; `PanelRightClose` / `PanelRightOpen` for
  the right one).
- The collapsed state hides the panel content but keeps the tab rail or a
  minimal indicator visible.
- When collapsing the contextual panel, the central area occupies the freed
  space.
- When collapsing the right panel, the central area expands to the right edge
  of the viewport.

### Resize

- Each panel has a drag handle (`cursor: col-resize`) on its shared border
  with the central area.
- Limits: minimum width 200px, maximum width 480px for the contextual panel;
  minimum width 240px, maximum width 480px for the right panel.
- The width is persisted in `localStorage` (client‑only) to keep the preference
  between sessions.
- On compact (mobile), panels are not resizable; they behave as full-width or
  predefined-width drawers.

---

## Icon set

DiffScribe uses **Lucide** as the icon library. Components consume Lucide icons
via direct import. No sprite sheet or remote loading is used.

### Conventions

- Decorative icons (without independent meaning) carry `aria-hidden="true"`.
- Icons with informational function (states, alerts, badges) carry a
  descriptive `aria-label`.
- The base size is 16×16px (`--text-sm`). Icons in rails and tabs use 20×20px.
- Color inherits from `currentColor` of the context (text, accent, or state).

---

## Source View (Project tab)

When the user selects a file in the Project tree, the central area shows the
**Source View**: the full file content with syntax highlighting and
Git-affected line markers.

### Behavior

- **Read‑only:** editing, modification, auto‑fix, and file mutation are not
  allowed.
- **Syntax highlighting:** Shiki highlighting is applied based on the file
  extension. Unrecognized language → `text`.
- **Git change markers:** each affected line shows a gutter marker (added,
  modified, deleted) based on the diff between working tree and HEAD or another
  active comparison.
- **No diff:** the Source View does not show a side-by-side or unified diff. It
  is the full source with annotations, not a diff.
- **Binary or very large files:** an informational message is shown instead of
  content, identical to the Diff Viewer handling.

### States

| State        | Description                                       |
| ------------ | ------------------------------------------------- |
| `loading`    | Spinner + "Loading file..."                       |
| `rendered`   | Full content with highlighting and markers        |
| `binary`     | "Binary file — preview not available" message     |
| `too-large`  | "File too large to display" message               |
| `empty`      | Empty file with no content                        |
| `error`      | Error message with retry option                   |

---

## Project tree

The **Project tree** is the hierarchical read‑only representation of the active
repository inside the Project tab of the contextual panel.

### Behavior

- Full repository tree (not only modified files).
- Each entry shows: name, type (file/directory), and tree ChangeStatus when
  the file has Git changes.
- Clicking a file opens it in Source View in the central area.
- The active selection is visually highlighted.
- Directories are collapsible/expandable.
- Binary and unreadable files are shown in the tree but cannot be opened in
  Source View (the user is informed).

### Tree states

| State        | Description                                       |
| ------------ | ------------------------------------------------- |
| `loading`    | Spinner + "Loading project tree..."               |
| `rendered`   | Full tree with all nodes                          |
| `empty`      | Empty repository with no files                    |
| `error`      | Error message with retry                          |

---

## Component states

Each interactive component must contemplate the following states, applicable
according to its nature:

| State           | Description                                       |
| --------------- | ------------------------------------------------- |
| `default`       | Initial state, no interaction                     |
| `hover`         | Cursor over the element                           |
| `focus-visible` | Visible keyboard focus (focus ring)               |
| `active`        | Element pressed or in use                         |
| `disabled`      | Non-interactive, visually dimmed                  |
| `loading`       | Loading data or processing action                 |
| `empty`         | No data to show                                   |
| `error`         | Load or validation failure                        |
| `stale`         | Potentially outdated data                         |
| `success`       | Operation completed successfully                  |

Not all components require all ten states. The following table lists the
expected subset per component type:

| Component          | States required                                        |
| ------------------ | ------------------------------------------------------ |
| Button             | default, hover, focus-visible, active, disabled, loading |
| Input / Select     | default, focus-visible, disabled, error, success       |
| File list item     | default, hover, focus-visible, active, disabled        |
| Project tree item  | default, hover, focus-visible, active, disabled        |
| Diff line          | default, hover, active (selected)                      |
| Source view        | loading, rendered, binary, too-large, empty, error     |
| Observation card   | default, hover, focus-visible, active (selected)       |
| Panel              | default, loading, empty, error, stale, collapsed       |
| Panel tab          | default, hover, focus-visible, active, disabled        |
| Badge / Tag        | default (by type and severity)                         |
| Rail icon          | default, hover, focus-visible, active                  |
| Drag handle        | default, hover, active                                 |

---

## Base UI kit

The **base UI kit** is the set of generic, stateless, token-driven UI
primitives shared by every product surface. It lives in a flat directory:
`src/lib/web/components/ui/`. Product-specific composites (panels, forms,
viewer chrome, navigation assemblies) must NOT live in `ui/`.

### Purpose

Product components (forms, panels, dialogs, viewers) repeatedly recreated
control styles and implemented focus and ARIA contracts inconsistently. The
kit centralizes those contracts so new surfaces reuse them instead of
reinventing them.

### Boundaries

- **Generic only:** the kit contains no product vocabulary (workspace,
  review, observation, diff, branch, status semantics are mapped by
  consumers).
- **Stateless:** props down, events up. No imports from stores,
  `$lib/server`, application, or domain modules. No global state.
- **Native HTML first:** `<button>`, `<input>`, `<select>`, `<dialog>` are
  used where the platform provides them. There is no custom combobox, no
  headless UI library, and no portal dependency.
- **Token-driven:** every visual value references a CSS custom property
  declared in the three theme blocks (`:root`, `[data-theme="dark"]`,
  `[data-theme="synthwave-84"]`). Hardcoded hex colors are prohibited.
- **Semantics are distinct:** Checkbox and Switch are different semantics
  (binary choice vs. on/off setting). Menu and Popover are different
  contracts (action list with menu roles vs. non-modal surface). Badge is
  never interactive.

### Location and structure

```text
src/lib/web/components/ui/
├── Button.svelte
├── IconButton.svelte
├── TextInput.svelte
├── Select.svelte
├── Checkbox.svelte
├── Switch.svelte
├── Menu.svelte
├── Popover.svelte
├── Dialog.svelte
├── Tabs.svelte
├── Tooltip.svelte
├── Badge.svelte
├── StatusBadge.svelte
├── ids.ts          # deterministic id helpers
└── variants.ts     # exported variant/size/tone lists
```

The directory is flat: no `atoms/`, `molecules/`, or `organisms/` grouping.

### Catalog

| Primitive    | Element / role                          | Contract summary                                                      |
| ------------ | --------------------------------------- | --------------------------------------------------------------------- |
| Button       | `<button>`                              | Variants primary/secondary/ghost/danger; sizes sm/md/lg; loading; disabled |
| IconButton   | `<button>`                              | Requires `label` for the accessible name; icons are decorative (`aria-hidden`) |
| TextInput    | `<input type="text">`                   | Label association, `aria-invalid` + `aria-describedby` on error, focus-visible |
| Select       | native `<select>`                       | Label association, error wiring, focus-visible; no custom combobox    |
| Checkbox     | `<input type="checkbox">`               | Binary choice; native keyboard and checked state                      |
| Switch       | `<input type="checkbox" role="switch">` | On/off setting; `aria-checked`, stable label, native keyboard         |
| Menu         | `role="menu"` + `role="menuitem"`       | Trigger `aria-haspopup`/`aria-expanded`; arrows, Home/End, Enter/Space, Escape, focus return |
| Popover      | non-modal surface                       | No menu roles unless content is a menu; Escape, predictable focus, documented light dismiss |
| Dialog       | native `<dialog>` + `showModal()`       | Labelled title, sensible initial focus, Escape, focus returns to invoker |
| Tabs         | `role="tablist"` + `role="tab"`         | Orientation, roving tabindex, arrows per orientation, Home/End, `aria-controls`/`aria-labelledby` |
| Tooltip      | hover/focus surface                     | `aria-describedby`, Escape dismiss, persistent/hoverable, no interactive content, never relies on `title` |
| Badge        | `<span>`                                | Visible text, tone variants, never color-only                         |
| StatusBadge  | `<span>`                                | Visible text + tone, icon optional, never color-only                  |

### Control scale

The control scale is **provisional** until validated by E2E target-size
checks on real consumers:

| Size | Minimum height | Notes                                     |
| ---- | -------------- | ----------------------------------------- |
| sm   | 24 px          | Meets WCAG 2.2 2.5.8 (24×24 minimum)      |
| md   | 32 px          | Default for most controls                 |
| lg   | 40 px          | Primary actions, touch-first surfaces     |

The scale is declared in `ui/variants.ts` and enforced by E2E (computed
height ≥ minimum). Do not lock it as a contract until the E2E validation
passes on migrated consumers.

### Keyboard and focus contract

- Every interactive primitive exposes visible focus (`:focus-visible`) with
  `--focus-ring` and `--focus-ring-offset`.
- Tabs: roving tabindex (one stop per tablist), ArrowLeft/ArrowRight for
  horizontal, ArrowUp/ArrowDown for vertical, Home/End, Enter/Space
  activates (automatic activation).
- Menu: trigger toggles with `aria-expanded`; menu items navigate with
  ArrowUp/ArrowDown (or Left/Right for submenus — not used in Stage 1),
  Home/End, Enter/Space activates, Escape closes and returns focus to the
  trigger.
- Popover: Escape closes, focus moves predictably (first focusable or
  trigger), light dismiss (click outside) is part of the contract.
- Dialog: native `showModal()`; Escape closes natively; the browser returns
  focus to the invoker on close. No custom focus trap unless a test
  demonstrates the browser behavior is insufficient.
- Tooltip: opens on hover and keyboard focus, closes on Escape, blur, or
  mouse leave; content is never interactive.

### ARIA rules

- Button/IconButton always have an accessible name (text content or
  `label`/`aria-label`).
- TextInput/Select associate the label (`for`/`id`) and, when in error,
  `aria-invalid="true"` and `aria-describedby` pointing at the error text.
- Switch sets `role="switch"` and `aria-checked` from the checked state.
- Tabs wire `aria-controls` (panel id) and `aria-labelledby` (tab button id)
  both directions.
- Menu uses `role="menu"`/`role="menuitem"` only for action lists.
- Decorative icons inside primitives are `aria-hidden="true"`.

### Token usage

The kit consumes existing tokens only. New tokens are added only when
repetition demonstrates a gap, and any new token must be declared in the
three theme blocks (`:root`, `[data-theme="dark"]`, `[data-theme="synthwave-84"]`)
and documented in this guide. The unit suite includes a static audit that
fails on undeclared token references inside `ui/`.

### Reduced motion

All kit transitions and animations use the `--duration-*` and `--ease-*`
tokens. The global `prefers-reduced-motion: reduce` block in `tokens.css`
already zeroes those durations; kit components must not define their own
durations outside the token system.

### Validation

- Unit: variant lists, id helpers, import boundary guard, token audit.
- BDD (quickpickle): contract scenarios in
  `specs/features/product/base-ui-kit.feature`.
- E2E (Playwright): DOM, ARIA, focus, keyboard, target size, themes, and
  reduced motion through real consumers.

### Anti-patterns

- No custom combobox or Select replacement.
- No `overflow-wrap: anywhere` or `word-break: break-all`.
- No focus trap that duplicates native `<dialog>` behavior.
- No Tooltip content that is interactive.
- No color-only Badge/StatusBadge state.
- No product vocabulary or store imports inside `ui/`.
- No Storybook, Testing Library, jsdom, happy-dom, or headless UI
  dependencies.

---

## Accessibility

DiffScribe targets **WCAG 2.2 Level AA** as a design goal.

### Contrast

- Normal text: minimum ratio 4.5:1 against background.
- Large text (≥18px bold or ≥24px): minimum ratio 3:1.
- UI components and graphical objects: minimum ratio 3:1.
- The tokens in this guide were selected to meet these ratios. Final validation
  requires verification with a contrast tool (`[PENDIENTE]` automate in CI).

### Keyboard navigation

- All main actions must be accessible without a mouse.
- Tab order must follow the visual flow: nav → file list → diff →
  observation panel.
- Keyboard shortcuts must not interfere with browser or operating system
  combinations.
- Focus must be visible at all times (`focus-visible`, not `focus`).

#### Keyboard navigation in the workspaces sidebar

- Each sidebar item exposes three focusable controls: **Select**, **Rename**,
  and **Delete**. All three are natural Tab stops.
- The **Select** button of each workspace includes the
  `data-workspace-select` attribute for stable targeting in tests.
- The **Select** button implements vertical keyboard navigation:
  - **ArrowDown:** moves focus to the Select button of the next workspace.
  - **ArrowUp:** moves focus to the Select button of the previous workspace.
  - **Home:** moves focus to the first Select button in the sidebar.
  - **End:** moves focus to the last Select button in the sidebar.
- **Enter** and **Space** retain the native submit behavior of the associated
  form.
- The **Rename** and **Delete** buttons maintain direct keyboard access via Tab
  and native activation.

### Focus

- Visible focus ring of at least 2px thickness with contrast ≥3:1 against
  adjacent backgrounds.
- The ring uses `--focus-ring` with a visible offset (`--focus-ring-offset` in
  the corresponding theme).
- The outline must not be removed without replacing it with an equally visible
  indicator.

### ARIA and semantics

- Use semantic HTML elements (landmarks, headings, lists).
- Interface regions must have accessible roles and labels.
- Interactive components must announce state changes via `aria-live` when
  relevant.
- The diff viewer must expose its structure so that screen readers can navigate
  changes.

### Do not rely on color alone

- Diff states (added/removed/modified) must be distinguishable by more than
  color: prefixes (`+`/`-`), position, or patterns.
- Severities must include icons or text, not just color.
- Component states (error, success, loading) must communicate with text or
  icons in addition to color.

### Targets

- Minimum touch area: 24×24px for interactive controls
  (WCAG 2.2, criterion 2.5.8 Target Size (Minimum)).
- Sufficient spacing between adjacent targets to prevent accidental
  activations.

### Zoom

- The interface must be functional at 200% zoom without loss of content or
  functionality.
- The layout must adapt without forced horizontal scrolling (except in the diff
  viewer, where long code lines justify it).

### Reduced motion

- Respect `prefers-reduced-motion: reduce` by disabling all non-essential
  animations and transitions.
- `0ms` duration transitions must not cause abrupt layout changes or context
  loss.

---

## Line selection (Inc-7)

Line selection in the diff-viewer allows anchoring observations to specific
ranges.

**Interactions:**
- **Click:** selects a single line
- **Shift+click:** extends selection from anchor to clicked line
- **Shift+ArrowUp/Down:** extends selection line by line
- **L key:** anchors selection on the current line
- **Escape:** clears selection
- **Keyboard-only:** navigation with Arrow keys + L to anchor + Enter to confirm

**Visual states:**
- Selected line: blue left border (3px `#4285f4`) + semi-transparent background (`rgba(66,133,244,0.2)`)
- On added lines: background `rgba(0,200,0,0.2)`
- On deleted lines: background `rgba(200,0,0,0.2)`
- Focus-visible: outline 1px `var(--focus-ring)`
- Hover: `var(--surface-hover)`

**Accessible attributes:**
- `role="checkbox"` + `tabindex="0"` on each selectable line
- `aria-checked` reflects selection state (`"true"` | `"false"`)
- `data-line-num` and `data-side` for E2E test targeting
- ARIA live region (`role="status" aria-live="polite"`) announces selections
- Side-by-side: old column has `data-side="old"`, new column `data-side="new"`
- Global keyboard shortcuts (j/k/Arrow and Shift+Arrow) are registered on
  `window` via reactive `$effect` that only activates when the diff is rendered
- Ctrl+Shift+D (persistent global shortcut) reloads the diff without navigating
  hunks

## Observation Panel (Inc-7)

**Responsive layout:**
- ≥1100px: fixed 320px right rail to the right of the diff
- <1100px: bottom drawer (position:fixed, max-height 40vh, bottom:0, z-index:10)

**ObservationCard:**
- Colored type badges: issue (red), risk (orange), suggestion (green), question (blue), praise (violet), note (gray)
- Severity badge: critical/major/minor/nitpick
- Stale badge (yellow) when `staleStatus` is not current
- Status dot: open (green), resolved (blue), dismissed (gray), pending (orange)
- Actions (edit, delete, status) hidden by default (`display: none`), visible
  with `.obs-card:hover .card-actions` and `.obs-card:focus-within .card-actions` —
  no JavaScript `mouseenter`/`focusin` handlers
- Original snapshot expandable with `<details>` when the observation is stale
- In read-only mode (`readOnly=true`) the action buttons are not rendered in
  the DOM

**ObservationForm:**
- Type select, severity select (only for issue/risk)
- Title input (required, 1-200 chars)
- Body textarea (≤5000 chars)
- Scope info (filePath, lines, side) when there is an active selection
- Client-side validation before submit
- SHA-256 computed via Web Crypto API with canonical format

**Panel states:**
- Loading: spinner + "Loading observations..." text
- Empty: contextual message (with/without completed review)
- Error: light red background with message
- Read-only: "This review is completed — read-only" banner

**A11y:**
- Form labels associated to inputs
- Focus-visible on all buttons and selects
- Disabled states on buttons during submit
- Error messages with `role="alert"`

---

### Svelte 5 + custom CSS

DiffScribe does not use Tailwind or CSS utility frameworks. The approach is:

- **Global tokens** defined in `:root` (light theme), `[data-theme="dark"]`
  (Dark Deep), and `[data-theme="synthwave-84"]` (Synthwave '84'), loaded as
  global CSS from an `app.css` file or equivalent.
- **Scoped styles** from Svelte for individual components. Each component
  consumes global tokens via CSS variables and defines its local rules.
- **No preprocessor:** native CSS with variables. Sass, Less, or PostCSS beyond
  what Vite already processes are not required.

### Conventions

- Global tokens are defined once in `src/lib/web/styles/tokens.css`.
- Components reference tokens as `var(--token-name)`.
- Magic values in components are a linting error (when the corresponding rule is
  implemented).

---

## QA validation

Visual validation will be performed manually in Stage 1, with intent to
automate progressively:

| Verification              | Stage 1 method                     | Future automation           |
| ------------------------- | ---------------------------------- | --------------------------- |
| Contrast                  | Manual tool (axe, browser)         | Lighthouse CI or axe-core   |
| Breakpoints               | Visual inspection + DevTools       | Playwright snapshots        |
| Visible focus             | Manual keyboard navigation         | Playwright `tab` assertions |
| Reduced motion            | OS toggle + visual inspection      | Playwright with emulation   |
| Applied tokens            | Computed style inspection          | Token snapshot testing      |
| Visual regression         | `[PENDIENTE]`                      | `[PENDIENTE]`               |

---

## Global reset and root foundation

The `html` and `body` elements receive a global reset in `tokens.css`:

- `margin: 0; padding: 0` — eliminates white viewport margins.
- `background: var(--surface-primary)` — inherits the active theme background.
- `color: var(--text-primary); font-family: var(--font-family-sans)` —
  consistent text color and sans-serif system font.

--- *The shell layout areas (`.shell-layout`, `.center-content`, `.work-area`,
`.diff-area`) carry explicit `background: var(--surface-primary)` to prevent
white rectangles during theme switching and when no file is loaded.

### SvelteKit body wrapper

`%sveltekit.body%` is wrapped in `<div style="display: contents">…</div>` in
`src/app.html`. The wrapper is a CSS-hardening measure recommended by SvelteKit
to guard against external stylesheets (browser extensions, user stylesheets) that
target `<body>` direct children or use selectors sensitive to the body's child
structure. `display: contents` makes the wrapper invisible to layout — it has no
box, margin, padding, or border, and does not create a new stacking context.

**What the wrapper protects against:**

- CSS rules from browser extensions that use `body > *` selectors and set
  `display: none`, `visibility: hidden`, or `opacity: 0`.
- User stylesheets or Dark Reader variants that inject overlay elements as
  `<body>` direct children.
- Styles that depend on `<body>` having exactly one child element.

**What the wrapper does NOT protect against:**

- Extensions or user styles that target by class, `data-testid`, `id`, or tag
  name (`main`, `aside`, `nav`). The wrapper only changes the direct-child
  relationship with `<body>`.
- CSS-injected overlays positioned independently of the DOM hierarchy.
- Rendering bugs in extension font or color filters.

### Visual debugging guide: blank screen or dark background with no panels

This section helps diagnose when the shell renders as a blank (usually dark or
white) background without visible panels, rail, or center content.

**Step 1 — Verify the shell is present in the DOM.**

Open DevTools → Elements tab. The rendered HTML should contain:

- `<div style="display: contents">` as the direct child of `<body>`.
- Inside it: elements with `data-testid="shell-layout"`, `data-testid="rail-tabs"`,
  `data-testid="center-content"`, and `data-testid="right-panel"`.

If these DOM nodes exist but are visually invisible, the issue is CSS, not a
JavaScript hydration failure.

**Step 2 — Check for extension-injected styles.**

Open DevTools → Sources → Content Scripts (or inspect the Styles pane in the
Elements tab). Look for injected `<style>` elements or stylesheets with selectors
like `body > * { display: none !important; }`, `body > div { visibility: hidden; }`,
or `body > :not(style) { opacity: 0; }`.

To isolate: open DiffScribe in a guest/incognito window or a clean browser profile.
If the issue disappears, an extension or user stylesheet is responsible.

**Step 3 — Check the computed background color.**

In DevTools → Elements, select `<body>` and inspect the Computed tab →
`background-color`. It should match the active theme surface color. Select
`[data-testid="shell-layout"]` and confirm its computed `background-color`
matches `var(--surface-primary)` for the active theme.

**Step 4 — Check for SvelteKit console warnings.**

Open DevTools → Console. If the SvelteKit warning about `%sveltekit.body%`
appears, the wrapper is missing — verify `src/app.html` has the
`<div style="display: contents">` wrapper. If the warning does not appear and the
shell elements are in the DOM but invisible, the cause is almost certainly
external CSS (see Step 2).

**Limitation:** The wrapper is hardening, not a universal guarantee. Extensions
that target elements by `class`, `id`, `data-testid`, or tag name are not
affected by the wrapper. Diagnose those case by case using DevTools inspection.

---

## Auxiliary and semantic tokens

### Font, radius, size shorthands

| Token              | Value     | Purpose                       |
| ------------------ | --------- | ----------------------------- |
| `--font-sans`      | ref       | Alias for `--font-family-sans` |
| `--font-mono`      | ref       | Alias for `--font-family-mono` |
| `--text-md`        | 0.875rem  | Equivalent to `--text-base`    |
| `--radius-xs`      | 3px       | Tight badge/pill radius        |

### Surface hover

| Token              | Purpose                     |
| ------------------ | --------------------------- |
| `--surface-hover`  | Alias for `--state-hover`   |

### Error and warning semantic families

| Token              | Light        | Dark / Synthwave     |
| ------------------ | ------------ | -------------------- |
| `--text-error`     | `#d32f2f`    | `#e06c5d`            |
| `--surface-error`  | `#fce4ec`    | `#3d1212`            |
| `--border-error`   | `#fecaca`    | `#78281f`            |
| `--text-warning`   | `#92400e`    | `#fbbf24`            |
| `--surface-warning`| `#fff3e0`    | `#2d1a00` / `#3d2e00` |
| `--border-warning` | `#ff9800`    | `#ff9800` / `#7d6600` |

### Color semantic (status badges)

| Token              | Light        | Dark           |
| ------------------ | ------------ | -------------- |
| `--color-success`  | `#2e7d32`    | `#22c55e`      |
| `--color-warning`  | `#f9a825`    | `#fbbf24`      |
| `--color-error`    | `#d32f2f`    | `#e06c5d`      |
| `--color-info`     | `#1565c0`    | `#60a5fa`      |

### Selection

| Token                | Light                   | Dark                    |
| -------------------- | ----------------------- | ----------------------- |
| `--selection-border`  | `#4285f4`              | `#4285f4` / `#2de2e6`  |
| `--selection-bg`      | `rgba(66,133,244,0.15)`| semi-transparent        |

### Diff foreground

| Token                | Light       | Dark       |
| -------------------- | ----------- | ---------- |
| `--diff-added-fg`    | `#1b5e20`   | `#57d68d`  |
| `--diff-deleted-fg`  | `#b71c1c`   | `#e06c5d`  |

---

## Observation component tokens

### Type badges

| Token                    | Light / Dark / Synthwave purpose     |
| ------------------------ | ------------------------------------ |
| `--obs-type-issue-bg/fg` | Issue badge background and foreground |
| `--obs-type-risk-bg/fg`  | Risk badge                           |
| `--obs-type-suggestion-bg/fg` | Suggestion badge               |
| `--obs-type-question-bg/fg`  | Question badge                   |
| `--obs-type-praise-bg/fg`    | Praise badge                     |
| `--obs-type-stale-bg/fg`     | Stale indicator badge            |

### Severity badges

| Token                     | Purpose                         |
| ------------------------- | ------------------------------- |
| `--obs-sev-critical-bg/fg`| Critical severity badge         |
| `--obs-sev-major-bg/fg`   | Major severity badge            |
| `--obs-sev-minor-bg/fg`   | Minor severity badge            |

### Status dots

| Token                 | Purpose              |
| --------------------- | -------------------- |
| `--obs-status-open`    | Open status dot      |
| `--obs-status-resolved`| Resolved status dot  |
| `--obs-status-dismissed`| Dismissed status dot |
| `--obs-status-pending` | Pending status dot   |

---

## Source viewer marker tokens

| Token                       | Purpose                            |
| --------------------------- | ---------------------------------- |
| `--source-marker-added`     | Added-line gutter marker           |
| `--source-marker-removed`   | Removed-line gutter marker         |
| `--source-marker-modified`  | Modified-line gutter marker        |
| `--source-line-added-bg`    | Added-line background tint         |
| `--source-line-removed-bg`  | Removed-line background tint       |
| `--source-line-modified-bg` | Modified-line background tint      |

---

## Project tree status dot tokens

| Token                      | Purpose                    |
| -------------------------- | -------------------------- |
| `--tree-status-modified`   | Modified file indicator    |
| `--tree-status-added`      | Added file indicator       |
| `--tree-status-deleted`    | Deleted file indicator     |
| `--tree-status-renamed`    | Renamed/copied indicator   |
| `--tree-status-type-changed`| Type-change indicator     |
| `--tree-status-untracked`  | Untracked file indicator   |
| `--tree-status-other`      | Other/unrecognized status  |

---

## Favicon

A provisional "DS" favicon (`static/favicon.svg`) is linked in `app.html` via
`<link rel="icon" href="%sveltekit.assets%/favicon.svg">`. The SVG shows the
"DS" initials on the Dark Deep primary surface background with accent-colored
text. Final branding will replace this with a definitive logo.

---

## Pending

These design aspects remain marked as `[PENDIENTE]` and will be resolved
before or during component implementation:

- **Branding:** visual name, logo, complementary accent palette.
- **Final typography:** mono font selection for code and sans font for UI.
  Evaluate self-hosted web fonts vs. system.
- **Automated visual regression:** tool and snapshot testing flow.
