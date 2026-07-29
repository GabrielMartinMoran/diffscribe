# DiffScribe — Guía de diseño

**Estado:** Borrador inicial — los valores de branding, tipografía definitiva,
icon set y resize de paneles quedan `[PENDIENTE]`.

Esta guía define el sistema visual de DiffScribe: principios, tokens CSS,
layout, comportamiento responsive, estados de componentes, accesibilidad y
validación. Es la fuente única de verdad para toda decisión visual.

---

## Principios visuales

### Jerarquía

La interfaz debe comunicar prioridad sin ambigüedad. El diff es el elemento
central; las observaciones y la navegación lo rodean sin competir. La jerarquía
se construye con tamaño, peso, color y posición, no con decoración.

### Foco

Cada vista tiene un propósito claro. El usuario debe poder identificar en menos
de un segundo qué puede hacer en cada zona. Los elementos accionables se
distinguen del contenido estático por contraste y affordance, no solo por color.

### Densidad para lectura de código

El diff viewer requiere densidad controlada: suficiente contexto visible sin
abrumar. El espaciado, el line-height y el tamaño de fuente están calibrados
para lectura prolongada de código, no para consumo rápido de texto.

### Claridad

La interfaz evita ambigüedad. Los estados de diff (added, removed, modified),
las severidades de observación y los tipos de contenido se distinguen por
múltiples canales: color, icono, posición y texto.

### Diseño intencional

Ningún elemento visual existe por defecto. Cada color, espaciado, borde y
sombra tiene una razón vinculada a la experiencia del reviewer. Se evita la
decoración genérica.

### Accesibilidad cognitiva

La interfaz reduce la carga cognitiva mediante:

- estructura predecible y consistente entre vistas;
- etiquetas visibles y descriptivas;
- feedback inmediato ante cada acción;
- atajos de teclado documentados y descubribles;
- ausencia de animaciones innecesarias o distractoras.

---

## Jerarquía de tokens

Los tokens se organizan en tres tiers. Cada tier hereda o restringe al
anterior:

```text
primitives → semantics → component
```

- **Primitives:** valores atómicos (colores base, escalas de spacing, radios).
  No tienen significado semántico por sí mismos.
- **Semantics:** tokens con significado funcional (superficie primaria, texto
  de alto contraste, borde sutil). Mapean primitives a roles.
- **Component:** tokens específicos de componentes (file-list-item-hover,
  diff-added-bg). Restringen los tokens semánticos a un contexto concreto.

Los componentes consumen tokens component-level. Solo se crea un token de
componente cuando el valor difiere del token semántico que hereda.

---

## Tokens de color

### Superficies

| Token                     | Claro              | Oscuro             |
| ------------------------- | ------------------ | ------------------ |
| `--surface-primary`       | `#FFFFFF`          | `#1A1A2E`         |
| `--surface-secondary`     | `#F8F9FA`          | `#16213E`         |
| `--surface-tertiary`      | `#F1F3F5`          | `#0F3460`         |
| `--surface-elevated`      | `#FFFFFF`          | `#1A1A2E`         |
| `--surface-overlay`       | `rgba(0,0,0,0.04)` | `rgba(0,0,0,0.30)` |

### Texto

| Token                     | Claro              | Oscuro             |
| ------------------------- | ------------------ | ------------------ |
| `--text-primary`          | `#1A1A2E`          | `#E4E6EB`         |
| `--text-secondary`        | `#495057`          | `#B0B3B8`         |
| `--text-tertiary`         | `#868E96`          | `#6C757D`         |
| `--text-inverse`          | `#FFFFFF`          | `#1A1A2E`         |
| `--text-link`             | `#2563EB`          | `#60A5FA`         |

### Bordes

| Token                     | Claro              | Oscuro             |
| ------------------------- | ------------------ | ------------------ |
| `--border-subtle`         | `#E9ECEF`          | `#2D2D44`         |
| `--border-default`        | `#DEE2E6`          | `#3D3D5C`         |
| `--border-strong`         | `#ADB5BD`          | `#5A5A7A`         |

### Acento

| Token                     | Claro              | Oscuro             |
| ------------------------- | ------------------ | ------------------ |
| `--accent`                | `#2563EB`          | `#3B82F6`         |
| `--accent-hover`          | `#1D4ED8`          | `#60A5FA`         |
| `--accent-muted`          | `#EFF6FF`          | `#1E3A5F`         |

El color de acento `#2563EB` es inicial y `[PENDIENTE]` de validación
definitiva. El valor en dark mode se ajusta automáticamente para mantener
contraste equivalente.

### Focus

| Token                     | Valor              |
| ------------------------- | ------------------ |
| `--focus-ring`            | `#2563EB`          |
| `--focus-ring-offset`     | `2px`               |

### Estados de diff

| Token                     | Claro              | Oscuro             |
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

### Estados de archivo (file list)

| Token                           | Claro              | Oscuro             |
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

Los estados `untracked` se tratan visualmente de forma neutra (escala de
grises) para indicar que el archivo no está bajo control de versiones. El
indicador binary se aplica mediante un badge compacto junto al status badge;
el indicador no depende del color como canal único.

### Severidades de observación

| Token                     | Claro              | Oscuro             |
| ------------------------- | ------------------ | ------------------ |
| `--severity-critical`     | `#DC2626`          | `#EF4444`         |
| `--severity-major`        | `#EA580C`          | `#F97316`         |
| `--severity-minor`        | `#CA8A04`          | `#EAB308`         |
| `--severity-info`         | `#2563EB`          | `#3B82F6`         |

### Tipos de observación

| Tipo           | Color claro   | Color oscuro  |
| -------------- | ------------- | ------------- |
| Issue          | `#DC2626`     | `#EF4444`     |
| Risk           | `#EA580C`     | `#F97316`     |
| Suggestion     | `#2563EB`     | `#3B82F6`     |
| Question       | `#8B5CF6`     | `#A78BFA`     |
| Praise         | `#16A34A`     | `#22C55E`     |
| Note           | `#6C757D`     | `#9CA3AF`     |

### Estados de componentes

| Token                     | Claro              | Oscuro             |
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

## Tipografía

La tipografía definitiva es `[PENDIENTE]`. Se usará una familia de sistema como
fallback inicial:

```css
font-family: ui-monospace, SFMono-Regular, 'Cascadia Code', 'Fira Code',
  Menlo, Consolas, monospace;
```

### Escala

| Token             | Size / Line-height | Uso                                |
| ----------------- | ------------------ | ---------------------------------- |
| `--text-xs`       | `0.75rem / 1rem`   | Line numbers, badges, timestamps   |
| `--text-sm`       | `0.8125rem / 1.25rem` | Código en diff, file list        |
| `--text-base`     | `0.875rem / 1.5rem` | Texto de UI, observaciones        |
| `--text-lg`       | `1rem / 1.5rem`    | Títulos de sección                 |
| `--text-xl`       | `1.125rem / 1.5rem` | Encabezados de panel              |
| `--text-2xl`      | `1.5rem / 1.75rem`  | Título de revisión                |

### Pesos

| Token                    | Valor | Uso                          |
| ------------------------ | ----- | ---------------------------- |
| `--font-weight-normal`   | 400   | Texto general                |
| `--font-weight-medium`   | 500   | Énfasis sutil, labels        |
| `--font-weight-semibold` | 600   | Títulos, navegación activa   |
| `--font-weight-bold`     | 700   | Severidades, contadores      |

### Altos de línea

| Token                 | Valor   | Uso                                     |
| --------------------- | ------- | --------------------------------------- |
| `--line-height-tight` | `1rem`  | Badges, line numbers, elementos densos  |
| `--line-height-code`  | `1.25rem` | Código en diff, file list             |
| `--line-height-normal` | `1.5rem` | Texto de UI, observaciones, títulos   |
| `--line-height-relaxed` | `1.75rem` | Títulos de revisión                |

---

## Spacing

Escala base de 4px.

| Token         | Valor | Uso                                  |
| ------------- | ----- | ------------------------------------ |
| `--space-0`   | 0     | Sin espacio                          |
| `--space-1`   | 4px   | Gap mínimo, iconos pegados a texto   |
| `--space-2`   | 8px   | Padding interno reducido             |
| `--space-3`   | 12px  | Padding de componente                |
| `--space-4`   | 16px  | Padding de panel, gap entre secciones|
| `--space-5`   | 20px  | Separación entre grupos              |
| `--space-6`   | 24px  | Margen de layout                     |
| `--space-8`   | 32px  | Separación de zonas                  |
| `--space-10`  | 40px  | Margen de página                     |
| `--space-12`  | 48px  | Separación mayor                     |

---

## Radios

| Token            | Valor | Uso                         |
| ---------------- | ----- | --------------------------- |
| `--radius-none`  | 0     | Paneles, diff lines         |
| `--radius-sm`    | 4px   | Botones, inputs, badges     |
| `--radius-md`    | 6px   | Cards, modales              |
| `--radius-lg`    | 8px   | Paneles principales         |
| `--radius-full`  | 9999px | Pills, tags               |

---

## Sombras

| Token             | Valor                                                  | Uso                    |
| ----------------- | ------------------------------------------------------ | ---------------------- |
| `--shadow-none`   | none                                                   | Default                |
| `--shadow-sm`     | `0 1px 2px rgba(0,0,0,0.06)`                          | File list hover        |
| `--shadow-md`     | `0 2px 8px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)` | Dropdowns, tooltips |
| `--shadow-lg`     | `0 4px 16px rgba(0,0,0,0.12)`                         | Modales                |

---

## Z-index

| Token                  | Valor | Uso                          |
| ---------------------- | ----- | ---------------------------- |
| `--z-base`             | 0     | Contenido                    |
| `--z-dropdown`         | 100   | Dropdowns, selects           |
| `--z-sticky`           | 200   | Headers fijos                |
| `--z-overlay`          | 300   | Overlays, backdrops          |
| `--z-modal`            | 400   | Modales                      |
| `--z-toast`            | 500   | Notificaciones               |
| `--z-tooltip`          | 600   | Tooltips                     |

---

## Motion

| Token                  | Valor  | Uso                              |
| ---------------------- | ------ | -------------------------------- |
| `--duration-instant`   | 0ms    | Cambios sin animación            |
| `--duration-fast`      | 150ms  | Hover, focus, toggle             |
| `--duration-normal`    | 250ms  | Transiciones de panel, expandir  |
| `--duration-slow`      | 350ms  | Entrada de modal, reveal         |
| `--ease-default`       | `cubic-bezier(0.16, 1, 0.3, 1)` | Curva estándar         |
| `--ease-out`           | `cubic-bezier(0, 0, 0.2, 1)`    | Entrada                |
| `--ease-in`            | `cubic-bezier(0.4, 0, 1, 1)`    | Salida                 |

---

## CSS de referencia

### `:root` — tema claro

```css
:root {
  /* Superficies */
  --surface-primary: #FFFFFF;
  --surface-secondary: #F8F9FA;
  --surface-tertiary: #F1F3F5;
  --surface-elevated: #FFFFFF;
  --surface-overlay: rgba(0, 0, 0, 0.04);

  /* Texto */
  --text-primary: #1A1A2E;
  --text-secondary: #495057;
  --text-tertiary: #868E96;
  --text-inverse: #FFFFFF;
  --text-link: #2563EB;

  /* Bordes */
  --border-subtle: #E9ECEF;
  --border-default: #DEE2E6;
  --border-strong: #ADB5BD;

  /* Acento */
  --accent: #2563EB;
  --accent-hover: #1D4ED8;
  --accent-muted: #EFF6FF;

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

  /* Severidades */
  --severity-critical: #DC2626;
  --severity-major: #EA580C;
  --severity-minor: #CA8A04;
  --severity-info: #2563EB;

  /* Estados */
  --state-hover: rgba(0, 0, 0, 0.04);
  --state-active: rgba(0, 0, 0, 0.08);
  --state-disabled-bg: #F1F3F5;
  --state-disabled-text: #ADB5BD;
  --state-error-bg: #FEF2F2;
  --state-error-border: #FECACA;
  --state-success-bg: #F0FDF4;
  --state-success-border: #BBF7D0;
  --state-loading: #E9ECEF;

  /* Tipografía */
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

  /* Radios */
  --radius-none: 0;
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --radius-full: 9999px;

  /* Sombras */
  --shadow-none: none;
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.06);
  --shadow-md: 0 2px 8px rgba(0, 0, 0, 0.08),
               0 1px 2px rgba(0, 0, 0, 0.04);
  --shadow-lg: 0 4px 16px rgba(0, 0, 0, 0.12);

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

## Breakpoints

| Breakpoint  | Rango                    | Uso                                     |
| ----------- | ------------------------ | --------------------------------------- |
| `compact`   | `max-width: 768px`       | Móvil, panel único                      |
| `tablet`    | `769px – 1024px`         | Dos paneles apilables                   |
| `desktop`   | `min-width: 1025px`      | Tres/cuatro zonas, layout completo      |
| `wide`      | `min-width: 1440px`      | Máximo espacio, side-by-side cómodo     |

---

## Comportamiento responsive

### Navegación global

- **Compact:** colapsada en un menú tipo drawer o bottom sheet. El selector de
  workspace ocupa la zona superior.
- **Tablet y desktop:** barra lateral fija con íconos y labels. El workspace
  activo se destaca.
- **Wide:** igual que desktop, con más espacio para labels extendidos.

### File list

- **Compact:** lista colapsable que ocupa el ancho completo sobre el diff.
- **Tablet:** panel lateral estrecho, colapsable.
- **Desktop y wide:** panel lateral de ancho fijo (~260px), siempre visible.

#### Marcador de revisado (Review marker)

Cuando existe una review activa, cada fila del file list muestra un marcador
visual de estado de revisión:

- **Revisado (✓):** verde (`--diff-added-fg`), negrita. Indica que el archivo fue marcado como revisado.
- **No revisado (○):** gris terciario con opacidad 0.5. Indica que el archivo aún no fue marcado.
- **Sin review activa:** la columna `.review-cell` no se renderiza (0 width).

El marcador usa `aria-label="Reviewed"` / `aria-label="Not reviewed"` para
accesibilidad. Se ubica a la derecha de la celda de estadísticas (±), con un
ancho fijo de 32px.

#### Progreso de review

El panel ReviewPanel muestra una barra de progreso `<progress>` con valor
porcentual derivado de `reviewedCount / totalCount`. El texto acompaña en
formato `N/M files reviewed`. La barra usa `--accent` como color de relleno y
`--surface-tertiary` como fondo. Responde a `prefers-reduced-motion` eliminando
transiciones.

**Selección de review en la lista:** Cada opción del listado de reviews
(`role="listbox"`) usa `role="option"` con `aria-selected` que refleja si
la review es la activa (`review.id === activeReview.id`).

### Diff viewer

- **Compact:** unified por defecto. Side-by-side no disponible.
- **Tablet:** unified por defecto; side-by-side disponible si el viewport
  supera aproximadamente 900px de ancho.
- **Desktop:** unified o side-by-side según preferencia del usuario.
- **Wide:** side-by-side cómodo con números de línea visibles.

### Observation panel

- **Compact:** panel inferior o drawer que cubre el diff.
- **Tablet:** panel inferior o lateral estrecho.
- **Desktop y wide:** panel lateral derecho (~320px), siempre visible.

---

## Layout de cuatro zonas

La interfaz principal se organiza en cuatro zonas:

```text
┌──────────┬──────────────────────────┬─────────────┐
│          │                          │             │
│  Nav     │  Diff Viewer             │  Obs.       │
│  global  │  (unified o              │  Panel      │
│  + file  │   side-by-side)          │             │
│  list    │                          │             │
│          │                          │             │
└──────────┴──────────────────────────┴─────────────┘
```

### Scroll ownership

Cada zona maneja su propio scroll de forma independiente:

- La **file list** scrollea verticalmente su contenido.
- El **diff viewer** scrollea tanto vertical como horizontalmente (para líneas
  largas en side-by-side).
- El **observation panel** scrollea su lista de observaciones.
- La **navegación global** es fija (no scrollea).

La barra de scroll del viewport principal es propiedad del diff viewer. Los
paneles laterales no empujan el contenido central.

### Side-by-side mínimo

El modo side-by-side requiere un ancho mínimo aproximado de 900px en el
viewport para ser usable. Por debajo de ese umbral, la interfaz fuerza unified
independientemente de la preferencia del usuario.

---

## Estados de componentes

Cada componente interactivo debe contemplar los siguientes estados, aplicables
según su naturaleza:

| Estado          | Descripción                                      |
| --------------- | ------------------------------------------------ |
| `default`       | Estado inicial, sin interacción                  |
| `hover`         | Cursor sobre el elemento                         |
| `focus-visible` | Foco de teclado visible (anillo de focus)        |
| `active`        | Elemento presionado o en uso                     |
| `disabled`      | No interactivo, visualmente atenuado             |
| `loading`       | Cargando datos o procesando acción               |
| `empty`         | Sin datos que mostrar                            |
| `error`         | Fallo en la carga o validación                   |
| `stale`         | Datos potencialmente desactualizados             |
| `success`       | Operación completada exitosamente                |

No todos los componentes requieren los diez estados. La tabla siguiente lista
el subset esperado por tipo de componente:

| Componente       | Estados requeridos                                    |
| ---------------- | ----------------------------------------------------- |
| Botón            | default, hover, focus-visible, active, disabled, loading |
| Input / Select   | default, focus-visible, disabled, error, success      |
| File list item   | default, hover, focus-visible, active, disabled       |
| Diff line        | default, hover, active (seleccionada)                 |
| Observation card | default, hover, focus-visible, active (seleccionada)  |
| Panel            | default, loading, empty, error, stale                 |
| Badge / Tag      | default (por tipo y severidad)                        |

---

## Accesibilidad

DiffScribe apunta a **WCAG 2.2 Nivel AA** como objetivo de diseño.

### Contraste

- Texto normal: relación mínima 4.5:1 contra el fondo.
- Texto grande (≥18px bold o ≥24px): relación mínima 3:1.
- Componentes de UI y objetos gráficos: relación mínima 3:1.
- Los tokens de esta guía fueron seleccionados para cumplir estos ratios. La
  validación definitiva requiere verificación con herramienta de contraste
  (`[PENDIENTE]` automatizar en CI).

### Navegación por teclado

- Todas las acciones principales deben ser accesibles sin mouse.
- El orden de tabulación debe seguir el flujo visual: nav → file list → diff →
  observation panel.
- Los atajos de teclado no deben interferir con combinaciones del navegador o
  del sistema operativo.
- El foco debe ser visible en todo momento (`focus-visible`, no `focus`).

#### Navegación por teclado en el sidebar de workspaces

- Cada item del sidebar expone tres controles focusables: **Select**, **Rename**
  y **Delete**. Los tres son stops de Tab naturales.
- El botón **Select** de cada workspace incluye el atributo
  `data-workspace-select` para targeting estable en tests.
- El botón **Select** implementa navegación vertical por teclado:
  - **ArrowDown:** mueve el foco al botón Select del workspace siguiente.
  - **ArrowUp:** mueve el foco al botón Select del workspace anterior.
  - **Home:** mueve el foco al primer botón Select del sidebar.
  - **End:** mueve el foco al último botón Select del sidebar.
- **Enter** y **Space** conservan el comportamiento nativo de submit del
  formulario asociado.
- Los botones **Rename** y **Delete** mantienen acceso directo por teclado
  mediante Tab y activación nativa.

### Focus

- Anillo de focus visible de al menos 2px de grosor con contraste ≥3:1 contra
  fondos adyacentes.
- El anillo usa `--focus-ring` con un offset visible (`--focus-ring-offset` en
  el tema correspondiente).
- No se debe remover el outline sin reemplazarlo por un indicador igualmente
  visible.

### ARIA y semántica

- Usar elementos HTML semánticos (landmarks, headings, lists).
- Las regiones de la interfaz deben tener roles y labels accesibles.
- Los componentes interactivos deben anunciar cambios de estado mediante
  `aria-live` cuando sea relevante.
- El diff viewer debe exponer su estructura de manera que lectores de pantalla
  puedan navegar cambios.

### No depender solo del color

- Los estados de diff (added/removed/modified) deben distinguirse por algo más
  que color: prefijos (`+`/`-`), posición o patrones.
- Las severidades deben incluir íconos o texto, no solo color.
- Los estados de componentes (error, success, loading) deben comunicarse con
  texto o íconos además de color.

### Targets

- Área mínima de toque: 24×24px para controles interactivos (WCAG 2.5.5).
- Espaciado suficiente entre targets adyacentes para evitar activaciones
  accidentales.

### Zoom

- La interfaz debe ser funcional con zoom del 200% sin pérdida de contenido ni
  funcionalidad.
- El layout debe adaptarse sin scroll horizontal forzado (excepto en el diff
  viewer, donde líneas largas de código lo justifican).

### Reduced motion

- Respetar `prefers-reduced-motion: reduce` deshabilitando todas las
  animaciones y transiciones no esenciales.
- Las transiciones de duración `0ms` no deben causar cambios de layout
  abruptos o pérdida de contexto.

---

## Selección de líneas (Inc-7)

La selección de líneas en el diff-viewer permite anclar observaciones a rangos específicos.

**Interacciones:**
- **Click:** selecciona una sola línea
- **Shift+click:** extiende la selección desde el ancla hasta la línea clickeada
- **Shift+ArrowUp/Down:** extiende la selección línea por línea
- **L key:** ancla la selección en la línea actual
- **Escape:** limpia la selección
- **Keyboard-only:** navegación con Arrow keys + L para anclar + Enter para confirmar

**Estados visuales:**
- Línea seleccionada: borde izquierdo azul (3px `#4285f4`) + fondo semitransparente (`rgba(66,133,244,0.2)`)
- En líneas added: fondo `rgba(0,200,0,0.2)`
- En líneas deleted: fondo `rgba(200,0,0,0.2)`
- Focus-visible: outline 1px `var(--focus-ring)`
- Hover: `var(--surface-hover)`

**Atributos accesibles:**
- `role="checkbox"` + `tabindex="0"` en cada línea seleccionable
- `aria-checked` refleja estado de selección (`"true"` | `"false"`)
- `data-line-num` y `data-side` para targeting en tests E2E
- Región ARIA live (`role="status" aria-live="polite"`) anuncia selecciones
- Side-by-side: columna old tiene `data-side="old"`, columna new `data-side="new"`
- Atajos globales de teclado (j/k/Arrow y Shift+Arrow) se registran en `window`
  mediante `$effect` reactivo que se activa solo cuando el diff está renderizado
- Ctrl+Shift+D (atajo global persistente) recarga el diff sin navegar hunks

## Panel de Observaciones (Inc-7)

**Layout responsive:**
- ≥1100px: right rail de 320px fijo a la derecha del diff
- <1100px: drawer bottom (position:fixed, max-height 40vh, bottom:0, z-index:10)

**ObservationCard:**
- Badges de tipo coloreados: issue (rojo), risk (naranja), suggestion (verde), question (azul), praise (violeta), note (gris)
- Badge de severidad: critical/major/minor/nitpick
- Badge de Stale (amarillo) cuando `staleStatus` no es current
- Status dot: open (verde), resolved (azul), dismissed (gris), pending (naranja)
- Acciones (edit, delete, status) ocultas por defecto (`display: none`), visibles
  con `.obs-card:hover .card-actions` y `.obs-card:focus-within .card-actions` —
  sin handlers JavaScript de `mouseenter`/`focusin`
- Snapshot original expandible con `<details>` cuando la observación es stale
- En modo read-only (`readOnly=true`) los botones de acción no se renderizan en
  el DOM

**ObservationForm:**
- Select de tipo, select de severidad (solo para issue/risk)
- Input de título (requerido, 1-200 chars)
- Textarea de body (≤5000 chars)
- Info de scope (filePath, lines, side) cuando hay selección activa
- Validación client-side antes del submit
- SHA-256 computado via Web Crypto API con formato canónico

**Estados del panel:**
- Loading: spinner + texto "Loading observations..."
- Empty: mensaje contextual (con/sin review completada)
- Error: fondo rojo claro con mensaje
- Read-only: banner "This review is completed — read-only"

**A11y:**
- Form labels asociados a inputs
- Focus-visible en todos los botones y selects
- Estados disabled en botones durante submit
- Mensajes de error con `role="alert"`

---

### Svelte 5 + CSS propio

DiffScribe no usa Tailwind ni frameworks de utilidades CSS. El enfoque es:

- **Tokens globales** definidos en `:root` y `[data-theme="dark"]`, cargados
  como CSS global desde un archivo `app.css` o equivalente.
- **Estilos scoped** de Svelte para componentes individuales. Cada componente
  consume tokens globales mediante variables CSS y define sus reglas locales.
- **Sin preprocesador:** CSS nativo con variables. No se requiere Sass, Less ni
  PostCSS más allá de lo que Vite ya procesa.

### Convenciones

- Los tokens globales se definen una sola vez en `src/lib/web/styles/tokens.css`.
- Los componentes referencian tokens como `var(--token-name)`.
- Los valores mágicos en componentes son error de linting (cuando se implemente
  la regla correspondiente).

---

## Validación QA

La validación visual se realizará manualmente en Etapa 1, con intención de
automatizar progresivamente:

| Verificación              | Método Etapa 1                     | Automatización futura       |
| ------------------------- | ---------------------------------- | --------------------------- |
| Contraste                 | Herramienta manual (axe, browser)  | Lighthouse CI o axe-core    |
| Breakpoints               | Inspección visual + DevTools       | Playwright snapshots        |
| Focus visible             | Navegación manual por teclado      | Playwright `tab` assertions |
| Reduced motion            | Toggle del SO + inspección visual  | Playwright con emulación    |
| Tokens aplicados          | Inspección de computed styles      | Snapshot testing de tokens  |
| Regresión visual          | `[PENDIENTE]`                      | `[PENDIENTE]`               |

---

## Pendientes

Estos aspectos del diseño quedan marcados como `[PENDIENTE]` y serán resueltos
antes o durante la implementación de componentes:

- **Branding:** nombre visual, logotipo, paleta complementaria al acento.
- **Tipografía definitiva:** selección de fuente mono para código y fuente sans
  para UI. Evaluar fuentes web auto-hospedadas vs. sistema.
- **Icon set:** librería de íconos (Lucide, Phosphor, o SVG propio).
- **Resize de paneles:** comportamiento de paneles redimensionables (drag
  handles, persistencia de anchos).
- **Acento definitivo:** `#2563EB` es placeholder; validar contraste y
  armonía con el resto de la paleta.
- **Regresión visual automatizada:** herramienta y flujo de snapshot testing.
