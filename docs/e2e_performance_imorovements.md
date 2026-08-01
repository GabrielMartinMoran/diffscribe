# DiffScribe — Mejoras de performance E2E (Playwright)

**Estado:** Investigación cerrada — pendiente de implementación
**Origen:** análisis del transcript `session-ses_0520.md` (2026-07-29, feature
`ui-redesign-v1`)
**Audiencia:** agente implementador (Developer o Commander) que tome el plan y
lo ejecute bajo TDD.
**Scope:** solo cambios en configuración, helpers E2E y posiblemente un hook de
hidratación dev-only. **No** modifica código de producción, dominio,
aplicación, infraestructura ni docs de producto.

---

## Resumen ejecutivo

La sesión `ses_0520ad0efffeWzp1bmlluo6p0v` ejecutó **22 invocaciones de
Playwright** con 4h 33min de tiempo total del orquestador. La mayor parte del
costo es **tiempo muerto de serialización, cold-start del dev server y
re-registro UI por test**, no latencia del modelo.

El config actual corre Playwright con `workers: 1` y `fullyParallel: false`
sobre hardware con **16 cores y 30 GB de RAM** disponibles, dejando ~94 % de
CPU ociosa. Además, cada invocación levanta `vite dev` en frío (~8–12 s) y los
tests que usan `registerAndSelectWorkspace` (~80 de 135) repiten un ciclo
completo de UI antes de empezar a validar.

Este documento describe **7 estrategias** ordenadas por impacto estimado,
agrupadas en 3 paquetes de implementación (mínimo, recomendado, completo).

### Tabla resumen — impacto y costo

| # | Estrategia | Impacto orquestador | Impacto CI | Costo | Riesgo |
|---|---|---|---|---|---|
| 1 | `reuseExistingServer: true` | Alto | Bajo | Config-only | Bajo |
| 2 | `workers ≥ 2` con DB por worker | Muy alto | Alto | Config + helper | Medio |
| 3 | `vite preview` en lugar de `vite dev` | Alto | Alto | Config + script | Bajo |
| 4 | Hidratación vía signal JS en lugar de click-probe | Medio | Medio | Helper + 1 hook dev | Bajo |
| 5 | Storage state para evitar re-registro | Medio | Bajo | Nuevo helper | Medio |
| 6 | Proyectos paralelos en puertos distintos | Muy alto | Muy alto | Config mayor | Medio |
| 7 | Sharding horizontal en CI | Bajo (local) | Muy alto | CI workflow | Bajo |

**Ganancia compuesta esperada** para el orquestador Pulsar:
~45 % menos tiempo total (de ~4h 33min a ~2h 30min en una sesión equivalente).

---

## Estado actual (baseline)

### Configuración vigente

Archivo: `playwright.config.ts`.

| Campo | Valor |
|---|---|
| `testDir` | `./tests/e2e` |
| `timeout` | `30_000` ms |
| `retries` | `0` |
| `fullyParallel` | **`false`** |
| `workers` | **`1`** |
| `globalSetup` / `globalTeardown` | `./tests/e2e/global-setup.ts` |
| `browserName` | `chromium` |
| `headless` | `true` |
| `baseURL` | `http://localhost:5173` |
| `webServer.command` | `npm run dev -- --port 5173` |
| `webServer.reuseExistingServer` | **`false`** |
| `webServer.timeout` | `30_000` ms |

### Inventario de specs y tests

| Spec | Tests |
|---|---:|
| `smoke.spec.ts` | 1 |
| `comparison-propagation.spec.ts` | 2 |
| `project-view.spec.ts` | 6 |
| `line-selection.spec.ts` | 7 |
| `review-lifecycle.spec.ts` | 7 |
| `workspace-registration.spec.ts` | 9 |
| `workspace-management.spec.ts` | 12 |
| `file-list-panel.spec.ts` | 13 |
| `panel-resize.spec.ts` | 13 |
| `diff-viewer.spec.ts` | 15 |
| `ui-shell.spec.ts` | 15 |
| `git-context-panel.spec.ts` | 16 |
| `responsive-mobile.spec.ts` | 19 |
| **Total** | **135** |

(La sesión cerró con ~82 tests; los restantes se agregaron con
`PANELS-UI-01` y `RESPONSIVE-UI-01`.)

### Cobertura del helper `registerAndSelectWorkspace`

`tests/e2e/helpers/register-workspace.ts` se invoca en **7 specs** y cubre
**~80 tests**. Cada invocación ejecuta:

1. `waitForHydration(page)` (probe click→click→click con `toPass({ timeout: 40_000 })`).
2. `selectRailTab(page, 'workspaces')`.
3. Toggle del form `open-workspace-form`.
4. `page.fill('#ws-path', repoPath)`.
5. `page.fill('#ws-name', name)`.
6. Submit + `waitForLoadState('networkidle')`.
7. Click en `Select` del workspace item.
8. `page.reload()` + `waitForLoadState('networkidle')`.
9. `selectRailTab(page, targetRail)`.
10. Verificación final del panel correspondiente.

Costo empírico por invocación: **2,5–4,5 s** según máquina y carga.

### Inventario de hidratación

Archivo: `tests/e2e/helpers/hydration.ts`. El probe actual:

1. `waitForLoadState('networkidle')`.
2. `toPass` sobre `#workspace-sidebar` visible (timeout 20 s).
3. `toPass` sobre `open-workspace-toggle` visible (timeout 20 s).
4. `toPass` que normaliza estado cerrado, abre (`click` → assert `aria-expanded=true`),
   vuelve a cerrar (`click` → assert `aria-expanded=false`). Timeout 40 s.

Costo empírico: **1,5–3 s** por test que lo invoca. Espera redundante: el
bundle JS ya terminó cuando `networkidle` se cumple.

### Setup de repos git en tests

Tests crean repos con `execSync('git init && git add && git commit')` desde
el spec. Distribución:

| Spec | `execSync.*git` count |
|---|---:|
| `git-context-panel.spec.ts` | 18 |
| `file-list-panel.spec.ts` | 17 |
| `diff-viewer.spec.ts` | 17 |
| `review-lifecycle.spec.ts` | 7 |
| `comparison-propagation.spec.ts` | 7 |
| `workspace-registration.spec.ts` | 5 |
| `workspace-management.spec.ts` | 5 |
| `project-view.spec.ts` | 5 |
| `line-selection.spec.ts` | 4 |
| `ui-shell.spec.ts` | 0 |

Cada `execSync` gasta **40–150 ms** según I/O. Total estimado por suite:
~5–8 s.

### Aislamiento de base de datos

Documentado en `docs/architecture.md:240-269`. Cada run genera un directorio
único con `fs.mkdtempSync(path.join(os.tmpdir(), 'diffscribe-e2e-'))` en
**tiempo de evaluación del config** (línea 10). El endpoint
`DELETE /api/test/state` requiere `DIFFSCRIBE_E2E_RESET_SECRET` y se invoca
desde `beforeEach` para limpiar la DB entre tests.

> [!IMPORTANT]
> La generación del DB dir en **config-time** sólo es segura con `workers: 1`.
> Si se sube `workers`, hay que **migrar a globalSetup-time** y usar
> `workerInfo.parallelIndex` para asignar un DB por worker. Esto es un
> prerrequisito de cualquier estrategia con paralelismo intra-run.

### Hardware disponible

| Recurso | Valor |
|---|---|
| CPU | 16 cores |
| RAM | 30 GB (15 GB libres al momento del análisis) |
| Node | v24.18.0 |
| OS | Linux 7.0.0-28-generic |

### Observaciones del transcript `session-ses_0520.md`

- **22 invocaciones Playwright** en la sesión (10 del Developer, 10 de QA, 2 del
  full `npm run test:e2e`).
- Conflictos recurrentes por **puerto 5173 zombie**:
  - `DEFERRED — "Error: http://localhost:5173 is already used"`
  - `ENV_FAIL — port 5173 conflict con ejecución previa`
  - `timeout | 54/54 passed before timeout`
- `pas_qa` re-ejecuta el **gate determinista completo** (~9 comandos) en cada
  verificación, incluido Playwright cuando aplica.

---

## Diagnóstico de causas

1. **Serialización forzada.** `workers: 1` ejecuta los 135 tests uno a uno
   sobre hardware con paralelismo disponible. Una suite que paralelizada toma
   ~25 s en este hardware hoy toma ~80–100 s serial.
2. **Cold start repetido del dev server.** `reuseExistingServer: false` +
   `npm run dev` como comando significa que cada invocación del binario
   Playwright paga **8–12 s** de arranque de `vite` antes del primer test.
   En la sesión hubo 22 invocaciones → **~3–4 min de overhead puro**.
3. **Conflictos de puerto 5173.** Las invocaciones previas dejan procesos
   `vite dev` zombis. Playwright los detecta, los mata o falla con
   `http://localhost:5173 is already used`. Esto fuerza reintentos o
   deferral de la verificación E2E completa.
4. **Re-registro UI por test.** `registerAndSelectWorkspace` se invoca en
   ~80 tests. Cada uno paga ~3 s para crear un workspace desde cero vía UI,
   aunque el workspace podría pre-crearse una sola vez por run.
5. **Probe de hidratación síncrono.** El click→assertion→click→assertion de
   `waitForHydration` consume 1,5–3 s por test. Espera hasta 40 s en el peor
   caso. La información que obtiene (handler attachment) puede obtenerse con
   un `waitForFunction` sobre un signal JS.
6. **`vite dev` cuando `vite preview` basta.** El QA gate ya invoca
   `npm run build`. `vite preview` sirve el bundle ya compilado y arranca en
   1–2 s. La pérdida de HMR y source maps no afecta a tests E2E.
7. **Sin sharding en CI.** El gate completo `npm run qa` corre todos los 135
   tests en serie en una sola máquina CI. Tres shards paralelos dividirían el
   wall-clock por ~3×.

---

## Estrategias (ordenadas por impacto)

### Estrategia 1 — `reuseExistingServer: true`

**Impacto:** Alto en orquestador (mata zombies de puerto 5173 y elimina
8–12 s de cold start por cada invocación repetida). Bajo en CI puro (donde
sólo hay una invocación por job).

**Riesgo:** Bajo. Mitigable con cleanup al final del proceso.

**Archivos a modificar:**

- `playwright.config.ts` línea 29.

**Cambio propuesto:**

```ts
webServer: {
  command: 'npm run dev -- --port 5173',
  url: 'http://localhost:5173',
  reuseExistingServer: true,    // ← cambio único
  timeout: 30_000,
  env: {
    DIFFSCRIBE_E2E_RESET_SECRET: 'e2e-reset-894a7f3c',
  },
},
```

**Justificación:**

`reuseExistingServer: true` permite que múltiples invocaciones del binario
Playwright en el mismo proceso padre (mismo job CI o misma sesión de
orquestador) reusen el dev server vivo. La generación del DB dir en
config-time (línea 10) es **por run del proceso Playwright**, no por vida del
dev server, así que el aislamiento entre invocaciones se mantiene.

**Validación:**

```bash
# 1. Matar cualquier zombie de 5173
pkill -f "vite dev --port 5173" || true

# 2. Primera invocación (cold start)
npx playwright test tests/e2e/smoke.spec.ts   # exit 0 esperado

# 3. Segunda invocación (reuse, sin cold start)
time npx playwright test tests/e2e/smoke.spec.ts
# esperado: <2 s de "Starting webserver" en logs

# 4. Verificar que el aislamiento sigue funcionando
DIFFSCRIBE_E2E_RESET_SECRET=e2e-reset-894a7f3c \
  curl -X DELETE -H "x-reset-secret: e2e-reset-894a7f3c" \
  http://localhost:5173/api/test/state
# esperado: 204 No Content
```

**Limitaciones conocidas:**

- No aplica si el código bajo test cambia entre invocaciones: `vite dev`
  detecta cambios y reinicia módulos, pero el ciclo completo no es confiable
  para cambios estructurales (añadir archivos, nuevos imports en rutas no
  refrescadas). En SDD activo donde hay cambios constantes, considerar
  combinar con Estrategia 3 (preview) o mantener `reuseExistingServer: true`
  sólo en CI puro.
- En sesiones de orquestador con muchos cambios (como `ses_0520`), el primer
  cold start todavía paga el costo. Los siguientes invocaciones sí se
  aceleran.

**Dependencias:** Ninguna. Aplicable de forma independiente.

---

### Estrategia 2 — Paralelismo intra-run con DB por worker

**Impacto:** Muy alto. Es el multiplicador más fuerte para la duración
individual de una suite E2E. Estimación: ~3–6× speedup al pasar de
`workers: 1` a `workers: 4` (asumiendo tests paralelizables).

**Riesgo:** Medio. Requiere refactorizar la inicialización del DB dir.

**Archivos a modificar:**

- `playwright.config.ts` (líneas 10–11, 17–18).
- `tests/e2e/global-setup.ts` (añadir init por worker).
- `tests/e2e/helpers/register-workspace.ts` (aceptar worker index si
  necesario).
- `tests/e2e/helpers/reset-db.ts` (sin cambios, ya usa el endpoint).

**Cambio propuesto en `playwright.config.ts`:**

```ts
// Eliminar las líneas 10–11 (mkdtempSync a nivel de config).
// El DB dir se asigna en globalSetup por worker.

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  retries: 0,
  fullyParallel: true,                          // ← cambio
  workers: process.env.CI ? 4 : 8,              // ← cambio
  globalSetup: './tests/e2e/global-setup.ts',
  globalTeardown: './tests/e2e/global-setup.ts',
  use: {
    baseURL: 'http://localhost:5173',
    browserName: 'chromium',
    headless: true,
  },
  webServer: {
    command: 'npm run dev -- --port 5173',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,       // ← ver Estrategia 1
    timeout: 30_000,
    env: {
      DIFFSCRIBE_E2E_RESET_SECRET: 'e2e-reset-894a7f3c',
    },
  },
});
```

**Cambio propuesto en `tests/e2e/global-setup.ts`:**

```ts
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export async function globalSetup(): Promise<void> {
  // Pre-crear un DB dir por worker. Playwright invoca globalSetup
  // una vez por worker antes de la primera test de ese worker.
  const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'diffscribe-e2e-'));
  process.env.DIFFSCRIBE_DB_DIR = dbDir;
}

export async function globalTeardown(): Promise<void> {
  const dbDir = process.env.DIFFSCRIBE_DB_DIR;
  if (dbDir && fs.existsSync(dbDir)) {
    fs.rmSync(dbDir, { recursive: true, force: true });
  }
}
```

> [!IMPORTANT]
> El orden `webServer` → `globalSetup` se mantiene. Como el dev server
> hereda `process.env.DIFFSCRIBE_DB_DIR` ya inyectado por Playwright en el
> comando, no hace falta cambiar nada en el `command` del webServer. Verificar
> con `printenv` desde el dev server antes de seguir.

**Validación:**

```bash
# 1. Smoke baseline con workers=1 (asegurar que pasa antes de paralelizar)
npm run test:e2e -- --workers=1 tests/e2e/smoke.spec.ts

# 2. Subir a workers=4 y verificar el suite completo
time npx playwright test --workers=4
# esperado: speedup 2,5–4× sobre workers=1

# 3. Verificar aislamiento entre workers
# Inspeccionar logs: cada worker debe reportar su DB dir único.
# Confirmar que los tests no se interfieren (no hay flakiness nuevos).
npx playwright test --workers=4 --repeat-each=3
# esperado: 0 flakiness nuevos en 3 repeticiones
```

**Limitaciones conocidas:**

- El endpoint `/api/test/state` recibe llamadas concurrentes de múltiples
  workers apuntando al **mismo DB** si la inicialización no se hace por
  worker. Es la razón por la que `mkdtempSync` debe ejecutarse en
  `globalSetup` y no en `webServer`/`config`.
- Tests que usan `mkTempDir()` para fixtures de repos (visible en
  `diff-viewer.spec.ts:11`) generan paths basados en `Date.now()`. Con
  workers paralelos existe riesgo de colisión si dos workers piden el mismo
  timestamp en el mismo milisegundo. Mitigación: pasar `parallelIndex` o
  `workerInfo.parallelIndex` al helper.
- Algunos specs pueden tener estado compartido implícito (e.g. localStorage
  del navegador). El context de Playwright es por test, no por worker, así
  que este riesgo es bajo.

**Dependencias:**

- **Prerrequisito:** debe coordinarse con la Estrategia 1 si se usa
  `reuseExistingServer`. Con reuse, todos los workers apuntan al mismo dev
  server pero con `DIFFSCRIBE_DB_DIR` distinto heredado del proceso
  Playwright, no del server. Verificar que el server lee el env en cada
  request (SvelteKit lo hace por defecto vía `process.env` en el handler).
- Compatible con Estrategia 3 (`vite preview`).
- Compatible con Estrategia 6 (proyectos paralelos en puertos distintos).

---

### Estrategia 3 — `vite preview` con bundle prebuilt

**Impacto:** Alto en cold start. `vite preview` arranca en 1–2 s frente a
8–12 s de `vite dev`. Combinado con Estrategia 1, elimina prácticamente todo
el cold start entre invocaciones.

**Riesgo:** Bajo. El QA gate ya corre `npm run build`.

**Archivos a modificar:**

- `playwright.config.ts` (línea 27).
- `package.json` script `test:e2e` (sin cambios necesarios si se hace sólo en
  config).
- `docs/architecture.md` (§ Aislamiento E2E, ~líneas 240–269) — actualizar
  texto.

**Cambio propuesto en `playwright.config.ts`:**

```ts
webServer: {
  // Vite preview sirve el bundle estático precompilado. Arranca en ~1 s.
  // Requiere que `npm run build` se haya ejecutado antes.
  command: 'npm run preview -- --port 5173 --strictPort',
  url: 'http://localhost:5173',
  reuseExistingServer: !process.env.CI,
  timeout: 30_000,
  env: {
    DIFFSCRIBE_E2E_RESET_SECRET: 'e2e-reset-894a7f3c',
  },
},
```

**Cambio propuesto en `package.json`:**

```json
"test:e2e": "npm run build && playwright test"
```

(O ejecutar `npm run build` una vez en CI antes del job de tests.)

**Validación:**

```bash
# 1. Verificar que preview arranca rápido
time npm run preview -- --port 5173 --strictPort &
sleep 2
curl -s http://localhost:5173/ | head -1
pkill -f "vite preview"

# 2. Suite completa contra preview
npm run build
time npx playwright test
# esperado: cold start medible en <2 s
```

**Limitaciones conocidas:**

- `vite preview` no tiene HMR ni source maps dev. Para E2E no es
  relevante.
- El bundle debe estar sincronizado con el código bajo test. En SDD activo
  esto implica ejecutar `npm run build` antes de cada corrida E2E, lo cual
  añade ~5 s pero compensa con creces el ahorro en cold start (10× más
  rápido).
- `preview` usa `--strictPort` para que falle explícitamente si el puerto
  está ocupado, en lugar de elegir otro puerto automáticamente (lo cual
  desincroniza `baseURL`).

**Dependencias:**

- Compatible con Estrategias 1, 2 y 6.
- En CI puro: `npm run build` ya está en el QA gate, no añade costo.

---

### Estrategia 4 — Hidratación vía signal JS

**Impacto:** Medio. Ahorra ~1,5–3 s por test que invoca
`waitForHydration` (~80 tests × 2 s = ~2,5 min por suite).

**Riesgo:** Bajo. La señal JS es trivial de añadir en dev/test.

**Archivos a modificar:**

- `tests/e2e/helpers/hydration.ts` (reescribir).
- `src/routes/+layout.svelte` o equivalente (añadir signal dev-only).
- `docs/architecture.md` (mencionar el hook dev-only).

**Cambio propuesto en `tests/e2e/helpers/hydration.ts`:**

```ts
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * Espera a que SvelteKit haya completado la hidratación del cliente.
 * Usa una señal expuesta por el código de la app en lugar de click-probe.
 *
 * La señal `window.__diffscribeHydrated` se establece en el onMount del
 * layout raíz, sólo cuando `import.meta.env.DEV === true` o cuando
 * `process.env.NODE_ENV !== 'production'`.
 */
export async function waitForHydration(page: Page): Promise<void> {
  await page.waitForFunction(
    () => (window as unknown as { __diffscribeHydrated?: boolean })
      .__diffscribeHydrated === true,
    { timeout: 10_000 },
  );

  // Mantener compatibilidad: el helper original también espera a que
  // #workspace-sidebar sea visible. Re-aplicar como segunda fase.
  const sidebar = page.locator('#workspace-sidebar');
  await expect(sidebar).toBeVisible({ timeout: 5_000 });
}
```

**Cambio propuesto en `src/routes/+layout.svelte` (o el archivo raíz que
monte la app):**

```svelte
<script lang="ts">
  import { onMount } from 'svelte';

  onMount(() => {
    // Expone una señal para tests E2E. Sólo en builds no-production.
    if (import.meta.env.MODE !== 'production') {
      (window as unknown as { __diffscribeHydrated?: boolean })
        .__diffscribeHydrated = true;
    }
  });
</script>
```

> [!IMPORTANT]
> El hook de hidratación **no** debe filtrarse al bundle de producción.
> Verificar con `npm run build && grep -r '__diffscribeHydrated' build/` que
> la cadena aparece (build dev/test) o usar un compilador condicional más
> estricto si se requiere cero impacto en producción.

**Validación:**

```bash
# 1. Verificar que el helper nuevo funciona contra la app real
npx playwright test tests/e2e/workspace-registration.spec.ts
# esperado: 9/9 passed

# 2. Medir tiempo por test
time npx playwright test tests/e2e/diff-viewer.spec.ts
# esperado: <50 % del tiempo previo

# 3. Verificar que el bundle de producción NO contiene la señal
npm run build
grep -c '__diffscribeHydrated' build/client/_app/immutable/chunks/*.js 2>/dev/null
# esperado: 0 (o un número bajo aceptable según cómo Vite tree-shake)
```

**Limitaciones conocidas:**

- El probe original tenía un propósito real: detectaba que el handler
  delegado estaba attached. El signal-based replacement sólo verifica que
  el módulo corrió. En la práctica, Svelte 5 monta handlers en `onMount`
  síncronamente, así que la equivalencia es razonable.
- Si el layout raíz cambia, hay que recordar mover el `onMount` ahí.

**Dependencias:**

- Independiente. Aplicable sin tocar Playwright config.

---

### Estrategia 5 — Storage state para evitar re-registro

**Impacto:** Medio. Ahorra ~2–3 s por test que invoca
`registerAndSelectWorkspace`. Aplica a ~80 tests.

**Riesgo:** Medio. Storage state depende del DB dir, que cambia por run.
Hay que ajustar el helper para pre-crear el workspace vía API y guardar el
state, no el workspace on-disk.

**Archivos a crear/modificar:**

- `tests/e2e/helpers/storage-state.ts` (nuevo).
- `tests/e2e/helpers/register-workspace.ts` (usar storageState cuando
  esté disponible).
- Scripts de seed del workspace.

**Estrategia:**

1. En `globalSetup` o un nuevo `globalSetupForWorker`, pre-registrar un
   workspace **canónico** (e.g. `E2E-Default-Workspace`) usando el endpoint
   `POST /api/workspaces` o el form UI una sola vez.
2. Guardar el `storageState` (cookies + localStorage) en
   `tests/e2e/.auth/default.json`.
3. En `beforeEach` de specs que usen el helper, hacer
   `test.use({ storageState: 'tests/e2e/.auth/default.json' })`.
4. `registerAndSelectWorkspace` se reduce a `selectRailTab(page, targetRail)`
   + verificación del panel.

**Limitaciones conocidas:**

- El endpoint para crear workspace vía API puede no existir o no aceptar
  paths absolutos arbitrarios. Hay que verificar `src/routes/api/workspaces/`
  o añadir un endpoint de seed específico para E2E.
- Si los tests modifican el workspace (e.g. cambian `name`), el state queda
  sucio entre tests. Solución: usar `test.beforeEach` que llame a
  `resetDb(request)` para volver al estado seed.
- El storage state no funciona si el DB dir cambia entre workers (lo cual
  es justo lo que hace la Estrategia 2). Hay que **regenerar el storage
  state por worker en `globalSetup`**, no compartir el archivo en disco.

**Dependencias:**

- Asume que existe o se crea un endpoint API para registrar workspaces
  programáticamente.
- Compatible con Estrategias 1–4.
- Si se combina con workers múltiples (Estrategia 2), hay que regenerar el
  storage state por worker.

---

### Estrategia 6 — Proyectos paralelos en puertos distintos

**Impacto:** Muy alto. Permite que **varios dev servers corran en paralelo**
en la misma máquina, cada uno atendiendo un subconjunto de specs. Estimación:
3 proyectos × 4 workers = 12 workers efectivos.

**Riesgo:** Medio. Requiere reorganizar specs en proyectos.

**Archivos a modificar:**

- `playwright.config.ts` (declarar `projects`).
- `package.json` (nuevos scripts por tier).
- Posible reorganización de specs en subcarpetas.

**Cambio propuesto en `playwright.config.ts`:**

```ts
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  retries: 0,
  fullyParallel: true,
  workers: 4,
  globalSetup: './tests/e2e/global-setup.ts',
  globalTeardown: './tests/e2e/global-setup.ts',

  projects: [
    {
      name: 'shell',
      testMatch: /smoke\.spec\.ts|ui-shell\.spec\.ts|panel-resize\.spec\.ts/,
      use: {
        baseURL: 'http://localhost:5173',
        browserName: 'chromium',
      },
      webServer: {
        command: 'npm run preview -- --port 5173 --strictPort',
        url: 'http://localhost:5173',
        reuseExistingServer: !process.env.CI,
        timeout: 30_000,
        env: { DIFFSCRIBE_E2E_RESET_SECRET: 'e2e-reset-894a7f3c' },
      },
    },
    {
      name: 'git',
      testMatch: /git-context-panel\.spec\.ts|file-list-panel\.spec\.ts|diff-viewer\.spec\.ts|line-selection\.spec\.ts|review-lifecycle\.spec\.ts/,
      use: {
        baseURL: 'http://localhost:5174',
        browserName: 'chromium',
      },
      webServer: {
        command: 'npm run preview -- --port 5174 --strictPort',
        url: 'http://localhost:5174',
        reuseExistingServer: !process.env.CI,
        timeout: 30_000,
        env: { DIFFSCRIBE_E2E_RESET_SECRET: 'e2e-reset-894a7f3c' },
      },
    },
    {
      name: 'legacy',
      testMatch: /workspace-management\.spec\.ts|workspace-registration\.spec\.ts|comparison-propagation\.spec\.ts|project-view\.spec\.ts/,
      use: {
        baseURL: 'http://localhost:5175',
        browserName: 'chromium',
      },
      webServer: {
        command: 'npm run preview -- --port 5175 --strictPort',
        url: 'http://localhost:5175',
        reuseExistingServer: !process.env.CI,
        timeout: 30_000,
        env: { DIFFSCRIBE_E2E_RESET_SECRET: 'e2e-reset-894a7f3c' },
      },
    },
    {
      name: 'responsive',
      testMatch: /responsive-mobile\.spec\.ts/,
      use: {
        baseURL: 'http://localhost:5176',
        browserName: 'chromium',
      },
      webServer: {
        command: 'npm run preview -- --port 5176 --strictPort',
        url: 'http://localhost:5176',
        reuseExistingServer: !process.env.CI,
        timeout: 30_000,
        env: { DIFFSCRIBE_E2E_RESET_SECRET: 'e2e-reset-894a7f3c' },
      },
    },
  ],
});
```

**Cambio propuesto en `package.json`:**

```json
{
  "test:e2e": "playwright test",
  "test:e2e:shell": "playwright test --project=shell",
  "test:e2e:git": "playwright test --project=git",
  "test:e2e:legacy": "playwright test --project=legacy",
  "test:e2e:responsive": "playwright test --project=responsive"
}
```

**Validación:**

```bash
# 1. Verificar que cada proyecto arranca en su puerto
npx playwright test --project=shell --list
# esperado: 29 tests listados (1 smoke + 15 ui-shell + 13 panel-resize)

# 2. Suite completa con 4 proyectos en paralelo
time npx playwright test
# esperado: speedup proporcional al nº de proyectos, hasta saturar CPU

# 3. Verificar consumo de memoria
ps aux | grep -E "vite preview" | wc -l
# esperado: 4 procesos
free -h
# esperado: <8 GB usados (4 × ~1,5 GB por preview)
```

**Limitaciones conocidas:**

- 4 dev servers simultáneos × ~1,5 GB RAM = ~6 GB extra. Hay 30 GB
  disponibles, no es problema.
- Si dos specs del mismo proyecto necesitan compartir estado (e.g. fixtures
  en `os.tmpdir()`), hay que verificar que no colisionen.
- `--strictPort` evita que Playwright cambie de puerto automáticamente
  cuando hay conflicto, lo cual fallaría silenciosamente.

**Dependencias:**

- Asume Estrategias 1–3 ya aplicadas.
- Compatible con Estrategia 2 (workers múltiples por proyecto).
- Compatible con Estrategia 7 (sharding CI: cada shard puede ser un
  subconjunto de proyectos).

---

### Estrategia 7 — Sharding horizontal en CI

**Impacto:** Bajo en local (orquestador ya no usa CI directamente). Muy
alto en CI (~3× speedup con 3 shards).

**Riesgo:** Bajo. Sharding es un feature soportado de Playwright.

**Archivos a modificar:**

- `.github/workflows/*.yml` (o script CI equivalente).

**Cambio propuesto en workflow:**

```yaml
jobs:
  e2e:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        shard: [1, 2, 3]
      fail-fast: false
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - run: npm ci
      - run: npm run build
      - run: npx playwright test --shard=${{ matrix.shard }}/3
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report-${{ matrix.shard }}
          path: playwright-report/
```

**Limitaciones conocidas:**

- Requiere 3 runners paralelos (no 1). Costo CI ~3× pero wall-clock /3.
- Si un shard falla, los otros siguen corriendo (`fail-fast: false`).

**Dependencias:**

- Aplicable en cualquier momento. Sin dependencias con las otras
  estrategias.

---

## Paquetes de implementación sugeridos

### Paquete mínimo (bajo riesgo)

**Cambios:** Estrategias 1 + 4.

- `reuseExistingServer: true` en `playwright.config.ts`.
- Reemplazar `waitForHydration` por signal JS + añadir hook dev-only en
  layout.

**Ganancia estimada:** ~10–15 % en suite única, ~25–35 % en sesión de
orquestador con invocaciones repetidas.

**Riesgo agregado:** Bajo. No requiere migrar DB a per-worker.

**Validación de regresión:**

```bash
npm run format
npm run lint
npm run check
npm run test:unit
npm run test:integration
npm run check:bdd-language
npm run build
npm run test:e2e
```

### Paquete recomendado (impacto alto, riesgo medio)

**Cambios:** Estrategias 1 + 2 + 3 + 4.

- Todo lo del paquete mínimo.
- `workers: 4` (o `process.env.CI ? 4 : 8`) con DB por worker en
  `globalSetup`.
- `vite preview` en lugar de `vite dev` + `npm run build` antes del
  `test:e2e`.

**Ganancia estimada:** ~50–60 % en suite única, ~45–55 % en sesión de
orquestador.

**Riesgo agregado:** Medio. La migración del DB dir de config-time a
globalSetup-time es la parte más delicada.

**Validación de regresión:** igual al paquete mínimo, más:

```bash
# Verificar aislamiento entre workers
npx playwright test --workers=4 --repeat-each=3
# esperado: 0 flakiness nuevos

# Verificar que el QA hard gate sigue pasando con workers=1 (smoke)
npm run qa   # con CI=1 fuerza workers=1 en QA

# Verificar parallelismo
time npm run test:e2e -- --workers=1
time npm run test:e2e -- --workers=4
# esperado: workers=4 significativamente más rápido
```

### Paquete completo (máximo paralelismo)

**Cambios:** Estrategias 1 + 2 + 3 + 4 + 6 + 7. (Estrategia 5 omitida por
complejidad; puede sumarse después si los tests lentos persisten.)

- Todo lo del paquete recomendado.
- 4 proyectos paralelos (shell, git, legacy, responsive) en puertos 5173–
  5176.
- Sharding en CI con matriz 1/3, 2/3, 3/3.

**Ganancia estimada:** ~70–80 % en suite única, ~60–70 % en sesión de
orquestador, ~75 % en CI.

**Riesgo agregado:** Medio-alto. Reorganizar specs en proyectos cambia
el modelo mental de los developers. Documentar claramente la partición.

**Validación de regresión:** igual al paquete recomendado, más:

```bash
# Suite completa con proyectos paralelos
time npx playwright test
# esperado: speedup ~3–4× sobre workers=1 serial

# Sharding en dry-run
npx playwright test --shard=1/3 --list
npx playwright test --shard=2/3 --list
npx playwright test --shard=3/3 --list
# esperado: tests distribuidos aproximadamente iguales
```

---

## Riesgos transversales

1. **Compatibilidad con `pas_qa` y `pas_developer`.** Los prompts actuales
   dicen "ejecuta `npx playwright test <subset>`". Con `fullyParallel:
   true` y proyectos, hay que asegurar que los subsets pequeños también se
   paralelicen dentro del subset. Playwright lo hace automáticamente.

2. **Documentación de arquitectura.** Si se aplica Estrategia 2 o 6, hay
   que actualizar `docs/architecture.md:240-269` para reflejar el modelo
   per-worker DB y por proyecto. AGENTS.md indica que cambios
   arquitectónicos van en `architecture.md`.

3. **CI matrix cost.** Estrategia 7 multiplica el costo de minutos CI por
   3. Si el budget de CI es estricto, considerar 2 shards en lugar de 3.

4. **Pre-commit hook.** `npm run format && npm run lint` no invoca
   Playwright, no se ve afectado.

5. **Compatibilidad con BDD.** Las estrategias E2E no afectan Vitest BDD
   ni unit/integration. No hay riesgo cruzado.

6. **Hook dev-only en producción.** Estrategia 4 introduce un `onMount` que
   expone `window.__diffscribeHydrated`. Hay que confirmar con `grep` sobre
   el bundle de producción que la cadena sólo aparece si
   `import.meta.env.MODE !== 'production'`.

---

## Métricas para medir el éxito

Antes de aplicar cualquier paquete, capturar baseline con:

```bash
# Baseline: suite completa con config actual
time npm run test:e2e -- --workers=1 --repeat-each=1 > /tmp/opencode/baseline-e2e.log 2>&1
# Anotar: duración total, número de tests, tiempo del primer test vs último.
```

Después de aplicar, capturar métrica equivalente:

```bash
time npm run test:e2e > /tmp/opencode/after-e2e.log 2>&1
diff /tmp/opencode/baseline-e2e.log /tmp/opencode/after-e2e.log
```

Métricas objetivo:

| Métrica | Baseline | Objetivo paquete recomendado |
|---|---:|---:|
| Duración total de la suite E2E | ~80–100 s | ~40 s |
| Tiempo del primer test (cold start) | ~10 s | ~2 s |
| Duración por test (mediana) | ~0,8 s | ~0,3 s |
| Conflictos de puerto 5173 por sesión | 3–5 | 0 |
| Flakiness rate (3 repeticiones) | desconocido | <1 % |

---

## Próximos pasos

1. **Decidir paquete** (mínimo, recomendado, completo) según tolerancia al
   riesgo y ROI.
2. **Crear change folder** según el proceso SDD activo en el repositorio
   (e.g. `.pas/state/active/` o `specs/NNN-e2e-perf/`).
3. **Escribir feature(s) BDD** si aplica alguna nueva invariante
   (e.g. "test:e2e con workers=4 termina en menos de 60 s").
4. **Implementar** siguiendo el paquete elegido, con TDD estricto:
   cambiar config → smoke test → suite completa → QA gate.
5. **Actualizar** `docs/architecture.md` § Aislamiento E2E y
   `docs/changelog.md` con el release note correspondiente.
6. **Medir** baseline vs después y publicar las métricas en el
   `implementation_report.md` o equivalente.

---

## Referencias

- Transcript origen: `session-ses_0520.md` (líneas 9–11835).
- Plan de la sesión: `.pas/state/active/plan.md` (feature
  `ui-redesign-v1`).
- Config actual: `playwright.config.ts`.
- Helpers E2E: `tests/e2e/helpers/{hydration,register-workspace,reset-db}.ts`.
- Aislamiento DB documentado: `docs/architecture.md:240-269`.
- QA hard gate documentado: `AGENTS.md` § QA hard gate y
  `package.json` script `qa`.

---

---

## Cold-start / readiness protocol (implemented 2026-07-31)

### Problem

Vite cold-start (after cleaning `.svelte-kit` and `node_modules/.vite`) can
produce incomplete HTML, stale chunks, or SSR errors (`transport was
disconnected, cannot call fetchModule`) during the first few seconds of the
dev server's lifetime.  This causes Svelte 5 client-side hydration failures:
`TypeError: undefined.call`, `Failed to hydrate`, and `pageerror` events.

### Solution

Three-layered defense-in-depth hardening:

1. **Readiness probe** (`scripts/wait-for-dev-server.sh`): a standalone bash
   script that polls `GET /` until the server responds with HTTP 200.  It
   accepts `--url` (default `http://127.0.0.1:56823`) and `--timeout`
   (default 30 s).  Returns exit code 0 on success, 1 on timeout.  No
   `sleep` calls in tests — polling interval is 200 ms with configurable
   timeout.  The probe must succeed before any browser navigates to the page.

2. **Stale process guard** (`tests/e2e/helpers/stale-process-guard.ts`):
   detects `vite dev` processes running from the same project working
   directory on common ports (5173, 56823, 5174, 5175, 5176, 4173).
   Processes from a different `cwd` are reported as foreign and **never**
   killed.  By default, only a warning is emitted.  Set
   `DIFFSCRIBE_E2E_KILL_ZOMBIES=true` to auto-kill stale processes.  The
   guard uses `lsof -i` and `ps` for detection.

3. **Playwright `baseURL` alignment**: `playwright.config.ts` now uses
   `baseURL: 'http://127.0.0.1:56823'` (option A, explicit configuration
   decision).  The worker server fixture keeps `DEFAULT_BASE_PORT = 5173`
   for per-worker port isolation — the config-level `baseURL` is only the
   Playwright default, overridden by the fixture's `workerBaseURL`.

### Cold-start workflow

For a clean cold-start run:

```bash
# 1. Kill stale Vite processes for this project (with explicit permission)
DIFFSCRIBE_E2E_KILL_ZOMBIES=true node -e "require('./tests/e2e/helpers/stale-process-guard').guardStaleProcesses()"

# 2. Clean caches
rm -rf .svelte-kit node_modules/.vite

# 3. Start dev server + readiness
npm run dev -- --port 56823 &
./scripts/wait-for-dev-server.sh --url http://127.0.0.1:56823 --timeout 30

# 4. Run E2E tests (with hard reload + cleared site data)
npx playwright test
```

In Playwright, the E2E `rail-hydration.spec.ts` registers `pageerror` and
`console.error` listeners **before** `page.goto('/')` and uses
`waitForHydration` (no `waitForTimeout`) to verify Svelte 5 hydration
completes without errors.

### Browser hard reload and clear site data

To ensure no stale service workers, cached chunks, or localStorage state
interfere with hydration:

```ts
// In Playwright: clear storage state before navigation
await page.context().clearCookies();
await page.evaluate(() => {
  localStorage.clear();
  sessionStorage.clear();
});
// Then perform a hard reload
await page.goto('/', { waitUntil: 'networkidle' });
```

### Limitations

- The root cause is likely a **cold-start / process / chunk race**, not the
  `tab.icon` dynamic import pattern alone.  The icon pattern change in
  `rail-tabs.svelte` (destructuring → explicit `tab.icon` access) is
  defense-in-depth hardening, not a confirmed fix.
- The stale process guard is Linux/macOS only (uses `lsof`, `ps`).  Windows
  support is not planned for Stage 1.
- The readiness probe script requires `curl` and `bash`.  It does **not**
  introduce new npm dependencies.
- Process killing is opt-in via `DIFFSCRIBE_E2E_KILL_ZOMBIES=true`.  The
  guard never kills processes from a different `cwd`.

### Verificación

```bash
# BDD scenarios for readiness, guard, and hydration stability
npm run test:bdd
# 11 hydration-stability scenarios + 1 rail-tabs hydration scenario

# E2E: rail-hydration.spec.ts
npx playwright test tests/e2e/rail-hydration.spec.ts

# Unit tests: stale-process-guard
npm run test:unit -- tests/unit/stale-process-guard.test.ts
```

---

## Open questions

- `[PENDIENTE]` ¿Existe o se puede añadir un endpoint API para registrar
  workspaces programáticamente? (Bloquea Estrategia 5.)
- `[PENDIENTE]` ¿Cuál es el presupuesto CI actual? (Dimensiona Estrategia 7.)
- `[PENDIENTE]` ¿Hay tests que asumen estado compartido entre specs? (Riesgo
  para Estrategia 2 con `fullyParallel: true`.)
