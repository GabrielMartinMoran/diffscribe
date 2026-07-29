# DiffScribe — Arquitectura

**Estado:** Borrador inicial

Este documento define la arquitectura técnica de DiffScribe: stack, capas,
flujo de datos, decisiones arquitectónicas, CI/QA y límites entre módulos.

La guía de diseño visual, tokens CSS, breakpoints y accesibilidad están en
[docs/design.md](design.md).

---

## Stack

| Componente         | Elección                  | Notas                                           |
| ------------------ | ------------------------- | ----------------------------------------------- |
| Framework          | SvelteKit + adapter-node  | SSR + servidor local; Vite como bundler         |
| Lenguaje           | TypeScript                | Modo estricto                                   |
| UI                 | Svelte 5 + CSS propio     | Sin Tailwind; tokens globales y estilos scoped  |
| Persistencia       | SQLite (`better-sqlite3`) | Síncrono; base en `~/.diffscribe/diffscribe.db` |
| Git                | CLI nativa + `simple-git` | `simple-git` para operaciones comunes           |
| Resaltado          | Shiki                     | Sintaxis declarativa; temas configurables       |
| Tests unitarios    | Vitest                    | Runner rápido; integrado con Vite               |
| Tests BDD          | quickpickle + Vitest      | `.feature` leídos directamente                  |
| Tests E2E          | Playwright                | Navegador real                                  |
| CI                 | GitHub Actions            | Desde Etapa 1                                   |
| Distribución       | Paquete npm ejecutable    | `npx diffscribe`                                |

---

## Capas

DiffScribe aplica Clean Architecture con dos skills complementarias: Clean
Backend Architecture para el servidor y Clean Svelte Architecture para la capa
web. Las dependencias apuntan hacia adentro: las capas externas conocen a las
internas; las internas no conocen nada de las externas.

```text
web / routes  ───  infraestructura  ───  aplicación  ───  dominio
```

| Capa              | Propio                                                                    | Prohibido                                |
| ----------------- | ------------------------------------------------------------------------- | ---------------------------------------- |
| `domain`          | Entidades, value objects, interfaces de repositorios, errores de dominio  | Frameworks, HTTP, DB, vendor SDKs        |
| `application`     | Casos de uso, commands, queries, DTOs, resultados                         | Transporte, persistencia, componentes UI |
| `infrastructure`  | Implementaciones de repositorios, mappers, SQL, clientes Git, gateways    | Lógica de negocio, decisión de producto  |
| `web` (o routes)  | Componentes Svelte, stores, endpoints, handlers HTTP                      | Reglas de negocio, acceso directo a DB   |

### Estructura esperada de directorios

```text
src/
├── lib/
│   ├── server/
│   │   ├── domain/
│   │   │   ├── entities/
│   │   │   ├── value-objects/
│   │   │   ├── repositories/       # Interfaces (puertos)
│   │   │   └── errors/
│   │   ├── application/
│   │   │   ├── dto/
│   │   │   │   ├── commands/
│   │   │   │   ├── queries/
│   │   │   │   └── results/
│   │   │   └── services/           # Casos de uso
│   │   └── infrastructure/
│   │       ├── repositories/       # Implementaciones concretas
│   │       ├── mappers/
│   │       ├── git/
│   │       └── database/
│   └── web/                        # Componentes Svelte, stores, CSS
│       ├── components/
│       ├── stores/
│       └── styles/
└── routes/                         # Endpoints SvelteKit
```

### Interfaces de repositorios (puertos)

Toda interfaz de repositorio se define en `domain/repositories/`. Solamente
el dominio conoce la forma del contrato. La capa `application` consume esas
interfaces sin saber quién las implementa.

Las implementaciones concretas y los mappers de persistencia viven
exclusivamente en `infrastructure/repositories/`. Ninguna capa externa al
dominio define interfaces de repositorio.

### Server-only boundary

El acceso a filesystem, Git, SQLite y secretos está restringido al lado
servidor. Los módulos que tocan estos recursos deben residir bajo
`$lib/server/` y nunca importarse desde código del lado cliente.

SvelteKit impone esta separación mediante `$env/static/private` para secretos
y la convención `$lib/server/` para módulos exclusivos del servidor.

### Lectura de contexto Git (Inc-3)

La lectura del estado Git del workspace activo se implementa con un puerto
técnico `GitContextReader` en `src/lib/server/application/git-context-reader.ts`
y su adaptador `SimpleGitContextReader` en
`src/lib/server/infrastructure/git/simple-git-context-reader.ts`.

**Límites estrictos:**

- El puerto expone DTOs tipados (`StatusDto`, `BranchDto`, `CommitDto`,
  `GitContextResult`). Ningún tipo de `simple-git` cruza la frontera del
  adaptador.
- El adaptador usa exclusivamente APIs read-only de `simple-git` v3.36.0:
  `status()`, `branchLocal()`, `log({maxCount})`, `revparse()`, `checkIsRepo()`.
- No se ejecuta checkout, commit, branch, push, fetch, merge, ni reset.
- El caso de uso `GetGitContextUseCase` devuelve datos agregados tipados +
  timestamp de lectura. Sin caché.
- El endpoint `GET /api/workspaces/[id]/git-context` permite refresco manual.
  No hay polling, watcher, ni recarga automática.
- El panel UI (`GitContextPanel.svelte`) mantiene un draft de Comparison
  efímero en memoria del cliente. La selección de Base/Target actualiza el
  draft sin mutar el repositorio.

**Estados de HEAD cubiertos:** clean, dirty, detached, unborn, conflict, error.

### Lectura de lista de archivos (Inc-4)

El panel de lista de archivos muestra los archivos modificados por el
Comparison activo. La arquitectura sigue el mismo patrón que la lectura de
contexto Git:

- **Puerto:** `GitFileListReader` en `src/lib/server/application/git-file-list-reader.ts`.
  Expone un método `read(params)` que recibe `repositoryPath`, `comparisonType`,
  `baseRef` y `targetRef`, y retorna un `FileListResult` tipado.
- **Adaptador:** `SimpleGitFileListReader` en
  `src/lib/server/infrastructure/git/simple-git-file-list-reader.ts`.
  Implementa el puerto usando dos llamadas read-only a `simple-git.raw()` con
  parsing NUL:
  - `git diff --name-status -z -C -C <args>`: obtiene la lista de archivos
    con sus códigos de estado (A, M, D, R, C, T, U).
  - `git diff --numstat -z <args>`: obtiene adiciones y eliminaciones por
    archivo. Los archivos binarios reportan `-` en lugar de números.
  - `git ls-files --others --exclude-standard -z`: obtiene archivos
    untracked cuando el target es el working tree.
- **Detección binaria:** archivos trackeados se detectan mediante el output
  `--numstat` (`-` para binarios). Archivos untracked se inspeccionan
  mediante lectura read-only de los primeros 8000 bytes buscando bytes NUL.
- **Caso de uso:** `GetFileListUseCase` en
  `src/lib/server/application/services/get-file-list-use-case.ts`.
  Resuelve los refs del `Comparison` y delega al adapter.
- **Endpoint:** `GET /api/workspaces/[id]/file-list?comparison=<encoded>`.
  Valida workspace, tipo de comparación, tipos de refs y contenido del JSON
  antes de delegar al caso de uso. Sin parámetros de filtro, orden ni
  paginación del lado servidor.
- **Componente UI:** `file-list.svelte` en `src/lib/web/components/`.
  Filtrado por path/status, ordenamiento por path/status/additions/deletions,
  paginación (50 por página), selección de fila activa, navegación por
  teclado, badges de estado, indicador binario y oldPath para renombrados.
  Integrado dentro de `git-context-panel.svelte`.

**Status de archivo cubiertos:** added, modified, deleted, renamed, copied,
type-changed, unmerged, untracked, unknown. Binary es un booleano separado,
nunca un status.

**Límites estrictos:**
- `simple-git` solo en infraestructura. Ningún tipo de `simple-git` cruza
  la frontera del adaptador.
- Solo operaciones read-only. Sin `git add`, `git add -N`, checkout, commit,
  ni ninguna mutación.
- Detección binaria de untracked mediante `readFileSync`; sin `git add`.
- Filtrado, ordenamiento y paginación son exclusivamente del lado cliente.
- Sin polling, watcher, recarga automática, ni mutaciones Git.

---

## Persistencia

DiffScribe usa SQLite mediante `better-sqlite3` como almacenamiento local
principal.

### Ubicación y configuración

La base de datos se almacena en:

```text
~/.diffscribe/diffscribe.db
```

El directorio `~/.diffscribe/` se crea automáticamente en la primera ejecución.
La ubicación es configurable mediante variable de entorno, pero el default es
`~/.diffscribe/`.

### WAL y performance

SQLite opera en modo WAL (Write-Ahead Logging) por defecto. Esto permite
lecturas concurrentes con escrituras y mejora la performance en cargas mixtas.

### Aislamiento de base de datos en tests E2E

Para evitar contaminación entre ejecuciones y proteger la base de datos real
(`~/.diffscribe/diffscribe.db`), los tests E2E usan una base de datos aislada:

- **Directorio único por ejecución:** El `global-setup.ts` de Playwright crea
  un directorio temporal con `fs.mkdtempSync(path.join(os.tmpdir(), 'diffscribe-e2e-'))`
  y lo asigna a `process.env.DIFFSCRIBE_DB_DIR` antes de que el servidor de
  desarrollo se inicie.
- **Teardown garantizado:** `globalTeardown` elimina el directorio temporal
  incluso si los tests fallan o crashean.
- **Endpoint de reset fail-closed:** `DELETE /api/test/state` permite a cada
  test E2E limpiar la base de datos antes de ejecutarse. El endpoint:
  - Requiere la variable de entorno `DIFFSCRIBE_E2E_RESET_SECRET` — sin ella,
    retorna 404 indistinguible de una ruta inexistente.
  - Requiere el header `x-reset-secret` con el valor exacto del secreto.
    Errores de secreto retornan 404.
  - Canonicaliza el directorio de la DB con `fs.realpathSync` para resolver
    symlinks.
  - Rechaza paths fuera de `os.tmpdir()` y paths que resuelvan dentro de
    `~/.diffscribe`, usando `path.relative()` semántico (no substring checks).
  - Ejecuta `DELETE FROM app_state` y `DELETE FROM workspaces` en una
    transacción atómica. Las migraciones, el esquema y otros archivos no se
    modifican.
- **Reset por test:** Una función helper `resetDb()` en
  `tests/e2e/helpers/reset-db.ts` se invoca desde `test.beforeEach` en cada
  archivo de spec E2E (`smoke`, `workspace-management`, `workspace-registration`,
  `git-context-panel`, `file-list-panel`).
- **Seguridad:** La base de datos real en `~/.diffscribe/` nunca se lee,
  borra, migra ni abre desde código de testing E2E. El endpoint de reset no
  acepta paths arbitrarios y nunca expone el secreto en logs.
- **Sin impacto en producción:** El endpoint de reset no está disponible sin
  la variable de entorno `DIFFSCRIBE_E2E_RESET_SECRET`. En producción, la
  variable no se define, resultando en 404 para cualquier petición al
  endpoint.

### Aislamiento de base de datos en Vitest (unit, integration, BDD)

Los tests unitarios, de integración y BDD ejecutados con Vitest también
deben usar una base de datos aislada. Para lograrlo sin modificar el código
de producción más allá de un guard fail-closed, se implementaron dos
mecanismos complementarios:

#### Guard fail-closed en `connection.ts`

El módulo `src/lib/server/infrastructure/database/connection.ts` resuelve
el directorio de la base de datos de forma lazy dentro de `getDb()`. Antes
de abrir la conexión, verifica:

- Si `process.env.VITEST` está presente y `DIFFSCRIBE_DB_DIR` no está
  definida, lanza un error descriptivo. Esto impide que cualquier test
  de Vitest use accidentalmente la base de datos de producción en
  `~/.diffscribe`.
- Si `process.env.VITEST` NO está presente (producción o servidor de
  desarrollo), usa `DIFFSCRIBE_DB_DIR` si está definida o hace fallback
  a `~/.diffscribe/diffscribe.db`.
- Si `process.env.VITEST` está presente Y `DIFFSCRIBE_DB_DIR` apunta a un
  directorio temporal seguro, permite la conexión normalmente.

Este guard es evaluado en cada llamada a `getDb()`, no en tiempo de carga
del módulo. La función `createTestDb()` (base de datos en memoria) no se
ve afectada por este guard, ya que no usa `DIFFSCRIBE_DB_DIR`.

#### Global setup por proyecto Vitest

Cada proyecto Vitest (`unit` e `integration` en `vitest.config.ts`, y el
proyecto BDD en `vitest.bdd.config.ts`) configura un `globalSetup` que:

- Crea un directorio temporal único con `fs.mkdtempSync` bajo `os.tmpdir()`
  y lo inyecta en los workers mediante `provide('dbDir', dbDir)`.
- Los workers reciben el directorio a través de `inject('dbDir')` en el
  archivo `tests/setup/vitest-setup.ts`, que asigna
  `process.env.DIFFSCRIBE_DB_DIR` antes de que se cargue cualquier test o
  step definition.
- El `teardown` del `globalSetup` elimina el directorio temporal incluso
  si los tests fallan o crashean.

#### Verificación de aislamiento

- **Tests unitarios:** `tests/unit/infrastructure/connection-guard.test.ts`
  verifica los tres escenarios del guard fail-closed (VITEST sin env lanza
  error, VITEST con temp dir permite conexión, sin VITEST en modo producción
  permite conexión).
- **Tests de integración:** `tests/integration/database/test-isolation.test.ts`
  verifica que `DIFFSCRIBE_DB_DIR` está definido, es absoluto, existe, está
  bajo `os.tmpdir()`, no está bajo `~/.diffscribe`, y que `getDb()` resuelve
  correctamente al directorio aislado.
- **Tests BDD:** `specs/features/application/test-db-isolation.feature`
  cubre los mismos tres escenarios del guard en formato Gherkin, con step
  definitions en `tests/steps/test-db-isolation.steps.ts`.
- **Sin impacto en producción:** El guard solo se activa cuando
  `process.env.VITEST` está presente. Vitest establece esta variable
  automáticamente en todos los workers. En el servidor de desarrollo y en
  producción, la variable no existe, por lo que el guard nunca se activa
  y el fallback a `~/.diffscribe` funciona normalmente.

### Migraciones

Las migraciones se aplican al iniciar la aplicación. Cada migración es un
archivo SQL numerado (`001_*.sql`, `002_*.sql`, etc.) cargado mediante
`import.meta.glob('./migrations/*.sql', { eager: true, query: '?raw' })`. Se
ejecutan en orden alfabético y cada una se envuelve en `db.transaction()` para
atomicidad. Una tabla `_migrations` registra qué migraciones ya fueron
aplicadas, garantizando idempotencia.

Migraciones actuales:
- `001_create_workspaces` — tabla `workspaces` con id, display_name, repository_path, timestamps
- `002_app_state` — tabla `app_state` key/value para estado de aplicación
- `003_create_reviews` — tabla `reviews` con FK `workspace_id` ON DELETE CASCADE, CHECK en status y comparison_type, `json_valid()` en comparison_json
- `004_create_review_files` — tabla `review_files` con PK compuesta `(review_id, file_path)`, FK `review_id` ON DELETE CASCADE

`PRAGMA foreign_keys = ON` se activa en conexiones de producción y test
(`connection.ts`). Las migraciones deben mantener compatibilidad hacia atrás
dentro de una misma versión mayor (consultar
[docs/versioning.md](versioning.md)).

### Active Review (app_state)

La review activa por workspace se almacena en `app_state` con clave
`active_review:<workspaceId>`. No hay tabla separada de active review.
Crear una review establece la clave; completarla la limpia; eliminar el
workspace también limpia la clave desde `DeleteWorkspaceUseCase`. Al cargar
la página (`+page.server.ts`), se verifica que la review activa referenciada
exista; si no (clave huérfana), se limpia automáticamente.

### E2E Reset

El endpoint `DELETE /api/test/state` limpia `review_files`, `reviews`,
`app_state` y `workspaces` en una transacción atómica. El FK CASCADE
garantiza que eliminar workspaces también elimina sus reviews y review_files,
pero el orden explícito en el reset asegura la limpieza incluso si
`foreign_keys` está desactivado.

---

## Integración con Git

DiffScribe interactúa con Git mediante:

1. **CLI nativa de Git** — requerida en el sistema. Se asume que `git` está
   disponible en el `PATH`.
2. **`simple-git`** — wrapper de Node.js sobre la CLI de Git. Simplifica
   operaciones comunes como `diff`, `log`, `branch` y `status`.

La herramienta es de solo lectura respecto de Git en Etapa 1. No crea commits,
ramas ni modifica archivos.

### Comparaciones soportadas

Las comparaciones Git se representan mediante los tipos definidos en el modelo
de dominio (consultar [docs/domain.md](domain.md)). La capa de infraestructura
traduce estos conceptos a comandos Git concretos.

---

## Resaltado de sintaxis

Shiki proporciona resaltado de sintaxis declarativo. Se configura con temas
claro y oscuro según el tema activo de la aplicación. El CSS de los tokens de
Shiki se integra con los tokens de diseño propios definidos en
[docs/design.md](design.md).

---

## CI y QA

### Pipeline

GitHub Actions ejecuta el pipeline de QA en cada push y pull request. Las
etapas son secuenciales (si una falla, las siguientes no se ejecutan):

| Etapa          | Comando                     |
| -------------- | --------------------------- |
| Formato        | `npm run format`            |
| Lint           | `npm run lint`              |
| Typecheck      | `npm run check`             |
| Tests unit     | `npm run test:unit`         |
| Tests integ.   | `npm run test:integration`  |
| Tests BDD      | `npm run test:bdd`          |
| Tests E2E      | `npm run test:e2e`          |
| Build          | `npm run build`             |

El comando `npm run qa` ejecuta todas las etapas localmente.

### Herramientas

- **Prettier:** formato consistente.
- **ESLint** (flat config): reglas de linting, orden de imports
  (`simple-import-sort`), estructura (`import-x`) y limpieza de imports no
  usados (`eslint-plugin-unused-imports`). Prettier y ESLint se mantienen
  separados mediante `eslint-config-prettier/flat`.
- **TypeScript:** modo estricto; sin `any` sin justificación explícita.

---

## Flujo de datos

### Apertura de un workspace

```text
Usuario → SvelteKit route → application (GetWorkspaceUseCase)
  → infrastructure (WorkspaceRepository) → SQLite
  → domain (Workspace entity) → response
```

### Obtención de un diff

```text
Usuario → SvelteKit route → application (GetDiffUseCase)
  → infrastructure (GitService) → git CLI
  → domain (Comparison, DiffResult) → response
```

### Creación de una observación

```text
Usuario → SvelteKit route → application (CreateObservationUseCase)
  → domain (Observation entity, invariantes)
  → infrastructure (ObservationRepository) → SQLite
  → infrastructure (GitService) → snapshot del fragmento
  → response
```

### Exportación

```text
Usuario → SvelteKit route → application (ExportReviewUseCase)
  → infrastructure (ObservationRepository) → SQLite
  → domain (Review aggregate) → formateo Markdown/JSON
  → response
```

---

## Decisiones arquitectónicas

### ADR-001: SQLite local y síncrono

**Decisión:** Usar `better-sqlite3` con acceso síncrono en lugar de un driver
asíncrono o una base de datos separada.

**Razón:** La aplicación es single-user y local. SQLite síncrono simplifica el
modelo de concurrencia sin sacrificar performance. No hay contención real entre
múltiples conexiones.

### ADR-002: Snapshot híbrido con hash canónico para staleness

**Decisión:** Cada observación almacena dos artefactos inmutables al crearse:
1. `comparison_snapshot_json` — el JSON del Comparison activo (siempre presente, para todos los tipos de observación).
2. `diff_snapshot` y `content_hash` (SHA-256) — solo para observaciones file-level y range-level. Nulos para observaciones review-level.

**Formato canónico del hash:** `filePath + ":" + side + ":" + String(startLine) + ":" + contenido normalizado LF`. Sin hunk header ni changeType. Se usa `node:crypto` sin dependencias externas.

**Razón:** El snapshot de diff preserva el contexto exacto que vio el reviewer. El hash SHA-256 permite detectar cambios de contenido de forma determinista. La combinación (snapshot + hash) cubre tanto la visualización del contexto original como la detección eficiente de staleness.

**Staleness (derivado, no persistido):** Se recalcula bajo demanda al abrir el ObservationPanel, cambiar el Comparison o refrescar el diff. Sin polling ni watchers. Status posibles: `current`, `stale-content-changed`, `stale-range-missing`, `stale-file-deleted`, `stale-file-renamed`, `stale-binary`, `stale-truncated`, `stale-comparison-changed`, `stale-unknown`. Commit-vs-commit es siempre current para file/range. Binary devuelve CURRENT si el comparison no cambió.

**Triggers:** Apertura del panel, cambio de Comparison, refresh manual del diff.

### ADR-003: Interfaces de repositorio en dominio

**Decisión:** Las interfaces de repositorio se definen exclusivamente en
`domain/repositories/`. La capa `application` nunca define puertos de
persistencia.

**Razón:** Mantener la dependency rule de Clean Architecture: el dominio no
depende de nada externo. Las interfaces de repositorio pertenecen al dominio
porque expresan qué necesita persistir el dominio, no cómo se persiste.

### ADR-004: Sin Tailwind, CSS propio

**Decisión:** Usar CSS propio con tokens globales y estilos scoped de Svelte.

**Razón:** La interfaz de DiffScribe es un workbench de revisión de código con
requisitos visuales específicos (syntax highlighting, diffs, anotaciones). Un
sistema de tokens propio da control preciso sobre la densidad, jerarquía y
estados del diff. Tailwind añadiría una capa de abstracción que no se justifica
para este dominio visual.

### ADR-005: Shiki sobre highlight.js o Prism

**Decisión:** Usar Shiki para resaltado de sintaxis.

**Razón:** Shiki usa gramáticas de TextMate (las mismas que VS Code), produce
HTML con tokens semánticos, y permite temas duales claro/oscuro. Funciona en
servidor (SSR) sin payload de JS adicional. El output es predecible y
estilizable con CSS propio.

### ADR-006: quickpickle para BDD

**Decisión:** Usar quickpickle como runner de BDD, que lee archivos `.feature`
directamente y los ejecuta con Vitest.

**Razón:** quickpickle no requiere compilación intermedia de features a código.
Los `.feature` son la fuente de verdad y el runner los consume tal cual. Vitest
como engine ofrece velocidad, watch mode y compatibilidad con el ecosistema
Vite/SvelteKit.

---

## Inc-7: Observations

**Arquitectura de capas:**

| Capa | Componentes nuevos |
|------|-------------------|
| `domain/` | `Observation` (entidad), `ObservationId`, `LineRange`, `ObservationType/Severity/Origin/Status` (enums), `StaleStatus` (enum), `ObservationRepository` (puerto) |
| `application/` | `CreateObservationUseCase`, `GetObservationUseCase`, `ListObservationsUseCase`, `UpdateObservationUseCase`, `DeleteObservationUseCase`, `TransitionObservationStatusUseCase` |
| `infrastructure/` | `SqliteObservationRepository`, `ObservationMapper`, `ContentHasher` (SHA-256 canónico), `StaleDeriver` (9 statuses) |
| `web/routes/` | REST: `GET/POST /observations`, `GET/PATCH/DELETE /observations/:id`, `POST /observations/:id/status` |
| `web/components/` | `ObservationPanel`, `ObservationCard`, `ObservationForm`, line selection en `DiffViewer` |

**Migración:** `005_create_observations` con FK `review_id -> reviews(id) ON DELETE CASCADE`, CHECKs para type/status/origin/severity, `json_valid()` en comparison_snapshot_json, diff_snapshot y content_hash nulos juntos, índices en review_id/type/status.

**Hash canónico:** `SHA-256(filePath + ":" + side + ":" + startLine + ":" + LF-normalized content)` via `node:crypto`. Sin dependencias externas.

**REST endpoints:**
- `GET/POST /api/workspaces/[id]/reviews/[reviewId]/observations`
- `GET/PATCH/DELETE .../[observationId]`
- `POST .../[observationId]/status` body `{status}`

**Guards:** Workspace existe, review pertenece al workspace, observation pertenece al review. Mutación en review completed/archived → 409. Range sobre binary → 422.

**Staleness:** Recalculado bajo demanda (apertura panel, cambio Comparison, refresh diff). 9 statuses. Binary → CURRENT si comparison no cambió. Rename detectado antes que file-deleted.

---

## Referencias

- [Product Requirements Document](PRD.md) — requisitos y decisiones de producto
- [Guía de diseño](design.md) — tokens CSS, layout, breakpoints y accesibilidad
- [Modelo de dominio](domain.md) — entidades, value objects, aggregates
- [Versionado](versioning.md) — SemVer, Conventional Commits, migraciones

---

## Componentes — Diff Viewer (Inc‑5)

### GitFileDiffReader

Puerto de aplicación (`src/lib/server/application/git-file-diff-reader.ts`) con
un único método `read()` que recibe `repositoryPath`, `comparisonType`,
`baseRef`, `targetRef` y `relativePath`. Devuelve un `FileDiffResult` tipado.

### SimpleGitFileDiffReader

Implementación en infraestructura (`src/lib/server/infrastructure/git/simple-git-file-diff-reader.ts`).
Usa `simple-git` para ejecutar `git diff` con paths separados por `--`.
Soporta los 8 `ComparisonType` y detección de archivos untracked (lectura desde
filesystem). Detecta renames mediante fallback con `--name-status -M` cuando el
path filter elimina la información de rename. Aplica hard cap de 256 KB o 5 000
líneas antes del parseo.

### UnifiedDiffParser

Parser custom (`src/lib/server/infrastructure/git/unified-diff-parser.ts`),
sin dependencia de librerías de terceros. Maneja headers de hunk
(`@@ -old,count +new,count @@`), líneas context/add/delete, números de línea
old/new, `\\ No newline at end of file`, rename from/to, detección binaria y
diffs multi-hunk.

### Shiki — Resaltado de sintaxis

- `language-map.ts`: ~40 extensiones mapeadas a lenguajes Shiki (`BundledLanguage`).
  Extensión desconocida → `text`.
- `highlighter.ts`: singleton lazy con `createHighlighter({ themes: ['min-light','min-dark'], langs: [...] })`.
  Usa `codeToTokens` por línea, no `codeToHtml`. Nunca se importa en el bundle
  del navegador.
- `token-renderer.ts`: `escapeHtml()` + `renderTokensToHtml()` que convierte
  tokens Shiki en spans inline con atributos HTML escapados. El contenido de
  cada token pasa por `escapeHtml` antes de inyectarse como `{@html}` en el
  componente Svelte.

### GetFileDiffUseCase

Caso de uso en `src/lib/server/application/services/get-file-diff-use-case.ts`.
Resuelve el lenguaje desde el path con `resolveLanguage()`, delega en el reader
para obtener el diff crudo, y aplica resaltado solo a líneas `context` y
`added`. Las líneas `deleted` quedan en texto plano (`html: ''`).

### Endpoint: GET /api/workspaces/[id]/file-diff

Endpoint en `src/routes/api/workspaces/[id]/file-diff/+server.ts`. Recibe
`comparison` (JSON encoded) y `path` (repo‑relative encoded). Valida workspace,
comparison, path no vacío y rechaza traversal (`/abs`, `..`, `~`, null bytes).
Usa argument arrays para Git, nunca interpolación de shell.

### DI — workspace-services.ts

`createWorkspaceServices()` inyecta `SimpleGitFileDiffReader` y un adaptador de
`getHighlighter()` en `GetFileDiffUseCase`. El highlighter se construye como
wrapper para que coincida con la interfaz `DiffHighlighter`.

### Componente: diff-viewer.svelte

Componente Svelte 5 con 7 estados: placeholder (sin archivo), loading, error
con retry, binary, empty, truncated y rendered. Unificado por defecto con
números old/new e indicadores multi‑canal add/delete. Toggle side‑by‑side solo
≥900 px; forzado unificado debajo. `@html` seguro porque el HTML proviene del
servidor ya escapado. Navegación de hunks con teclado (j/k, ↑/↓), shortcut
Ctrl+Shift+D, aria‑pressed, focus‑visible y reduced motion. Sin polling ni
auto‑refresh.

### Integración en +page.svelte

El estado `selectedFile` se propaga desde `GitContextPanel.onFileSelect` hacia
`DiffViewer` con `comparisonDraft` y `activeWorkspaceId`. No hay persistencia
en DB ni en URL. Layout principal usa `grid-template-columns: 300px 1fr` con
un sub‑grid `grid-template-rows: auto 1fr` en el área principal para apilar
GitContextPanel + DiffViewer verticalmente.
