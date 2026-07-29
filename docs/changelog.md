# DiffScribe — Changelog

Todos los cambios notables de este proyecto se documentan en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
y este proyecto adhiere a [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added

- Inc‑6 (Review Foundation): Review aggregate con ReviewId UUID, ReviewStatus (draft/in_progress/completed/archived) y captura de ComparisonSerialized.
- Migraciones SQL 001‑004 con loader `import.meta.glob`, transacción por migración, y `PRAGMA foreign_keys = ON`.
- Tablas `reviews` (FK CASCADE a workspaces, CHECK status/comparison_type, json_valid) y `review_files` (PK compuesta, FK CASCADE a reviews).
- Repositorio `SqliteReviewRepository` con mapper Comparison↔JSON, marcas dinámicas sin inventario total.
- Casos de uso: CreateReviewUseCase, ListReviewsUseCase, GetReviewUseCase, SetActiveReviewUseCase, MarkFileUseCase, UnmarkFileUseCase, CompleteReviewUseCase.
- REST endpoints bajo `/api/workspaces/[id]/reviews/...`: GET list, POST create, GET detail, POST set-active, POST mark-file, POST unmark-file, POST complete.
- Active review en `app_state` con clave `active_review:<workspaceId>`. Crear activa, completar limpia, eliminar workspace limpia.

- Inc‑7 (Observations): Observation aggregate con CRUD completo. Tipos issue/risk/suggestion/question/praise/note con severidad critical/major/minor/nitpick. Estados open/resolved/dismissed/pending con transiciones y reopen.
- Migración 005 `observations` con FK CASCADE a reviews, CHECKs type/status/origin/severity, json_valid() en comparison_snapshot_json, índices review_id/type/status.
- Snapshot híbrido: `comparison_snapshot_json` (JSON del Comparison, siempre presente) + `diff_snapshot` y `content_hash` SHA-256 (solo file/range, nulos juntos).
- Hash canónico SHA-256 via `node:crypto`: `filePath:side:startLine:LF-normalized-content`.
- StaleDeriver con 9 statuses derivados bajo demanda (sin polling): current, stale-content-changed, stale-range-missing, stale-file-deleted, stale-file-renamed, stale-binary, stale-truncated, stale-comparison-changed, stale-unknown.
- REST: `GET/POST /api/workspaces/[id]/reviews/[reviewId]/observations`, `GET/PATCH/DELETE .../[observationId]`, `POST .../[observationId]/status`.
- Panel ObservationPanel responsive: right rail 320px (>=1100px) / drawer bottom 40vh (<1100px).
- ObservationForm con validación client-side, SHA-256 vía Web Crypto API, info de scope con rawSnapshot.
- ObservationCard con badges de tipo/severidad, status dot coloreado, acciones hover/focus, stale badge, snapshot expandible con `<details>`.
- Line selection en diff-viewer: click, Shift+click, L-key, Escape, Shift+Arrow, keyboard-only. ARIA live region, data-line-num/data-side para E2E. Old-side seleccionable en side-by-side.
- Guards: completed/archived review → 409 en mutación, range sobre binary → 422, ownership workspace→review→observation, cascade deletion ordenada observations→review_files→reviews→app_state→workspaces.
- DeleteWorkspaceUseCase extendido con ObservationRepository para orden explícito de cascade.
- ReviewPanel UI con New/Complete/Mark/Unmark, progreso reactivo N/M, confirmación, listado/reopen, keyboard/ARIA/reduced-motion.
- Marcador visual de revisado (✓/○) en file-list cuando existe review activa.
- Propagación de Comparison unificada entre GitContextPanel, DiffViewer y Review.
- `DeleteWorkspaceUseCase` limpia clave active_review + elimina reviews por FK cascade.
- E2E reset incluye `review_files` y `reviews` en transacción atómica.

- Inc‑5: Diff viewer con resaltado Shiki. Visor unificado por defecto con
  números de línea old/new, indicadores +/−, y toggle side‑by‑side >=900 px.
- `GitFileDiffReader` port + `SimpleGitFileDiffReader` con soporte para los
  8 ComparisonTypes y archivos untracked.
- Custom unified‑diff parser (`unified-diff-parser.ts`) sin dependencias de
  terceros.
- `GetFileDiffUseCase` que resuelve lenguaje, delega en reader y aplica
  resaltado Shiki con `codeToTokens` por línea.
- Endpoint `GET /api/workspaces/[id]/file-diff` con validación de path traversal.
- Shiki v4.3.1 como dependencia runtime server‑only; lazy singleton, dual
  theme (min‑light/min‑dark), language map de ~40 extensiones, token renderer
  con escape HTML.
- Hard cap de 256 KB o 5 000 líneas con aviso de truncamiento.
- Componente `diff-viewer.svelte` con 7 estados (placeholder, loading, error
  con retry, binary, empty, truncated, rendered), navegación de hunks por
  teclado (j/k, ↑/↓), shortcut Ctrl+Shift+D, aria‑pressed, focus‑visible y
  reduced motion.
- BDD step definitions para 34 escenarios (24 product + 10 application) en
  `tests/steps/file-diff.steps.ts`.
- 15 E2E Playwright tests para todos los estados de archivo, responsive,
  teclado, XSS safety y garantía read‑only.

- Inc‑4: File list panel con filtrado, ordenamiento, paginación y selección
  activa.
- Inc‑3: Git context panel con estado del repositorio, branches, commits y
  comparación.
- Inc‑2: Registro y gestión de workspaces (register, list, get, rename, delete,
  repair).
- Inc‑1: Scaffold inicial del workbench.
- Feature técnico BDD `pre-commit-quality-gate.feature` que verifica que el
  hook bloquea commits ante fallo de formato o lint.
- Protocolo ante fallo de formato en `AGENTS.md` con pasos obligatorios de
  autofix, review de `git diff` y re-stage.

- Inc-3 — Panel de contexto Git para el workspace activo:
  - Value objects `GitRef` y `Comparison` con tipos de comparación y
    representación serializable.
  - Puerto `GitContextReader` en capa de aplicación y adaptador
    `SimpleGitContextReader` en infraestructura (read-only, sin mutaciones).
  - Caso de uso `GetGitContextUseCase` con DTOs tipados (`StatusDto`,
    `BranchDto`, `CommitDto`, `GitContextResult`).
  - Componente `GitContextPanel.svelte` con barra de estado (clean/dirty/
    detached/unborn/conflict), lista de ramas, lista de commits, filtros
    locales, slots Base/Target para Comparison draft efímero, refresco manual
    y navegación por teclado.
  - Endpoint `GET /api/workspaces/[id]/git-context` para refresco manual.
  - Cobertura de tests: 40 escenarios BDD (quickpickle), 15 tests E2E
    (Playwright con repositorios reales), 92 tests unitarios, 38 tests de
    integración.
  - Sin polling, watcher, recarga automática, ni mutaciones Git.

- Inc-4 — Panel de lista de archivos para el Comparison activo:
  - Value object `FileChangeStatus` con 9 valores (added, modified, deleted,
    renamed, copied, type-changed, unmerged, untracked, unknown). Binary es
    un booleano separado, nunca un status.
  - DTOs `FileListEntry` y `FileListResult` con path, status, binary flag,
    additions/deletions (cuando aplica), oldPath para rename/copy, y error
    opcional para archivos no legibles.
  - Puerto `GitFileListReader` en capa de aplicación y adaptador
    `SimpleGitFileListReader` en infraestructura (read-only, sin mutaciones).
  - Parsing NUL de `git diff --name-status -z -C -C` y
    `git diff --numstat -z`, más `git ls-files --others --exclude-standard -z`
    para untracked. Los 8 ComparisonTypes mapean a comandos Git concretos.
  - Detección binaria: trackeados mediante `--numstat` (`-` para binarios);
    untracked mediante lectura read-only de bytes sin `git add`.
  - Caso de uso `GetFileListUseCase` con delegación al adapter.
  - Endpoint `GET /api/workspaces/[id]/file-list?comparison=<encoded>` con
    validación de workspace, JSON, enums y tipos de refs. 400/404 tipados.
  - Componente `file-list.svelte` con filtro por path y status, ordenamiento
    por path/status/additions/deletions, paginación (50 por página), fila
    activa, navegación por teclado, status badges, indicador binario y
    oldPath. Integrado en `git-context-panel.svelte`.
  - Inclusión de untracked solo cuando el target es el working tree; exclusión
    en comparaciones committed-target.
  - Cobertura de tests: 37 escenarios BDD (quickpickle), 114 tests unitarios
    (+22), 65 tests de integración (+27), 12 tests E2E (Playwright, nuevo
    archivo `file-list-panel.spec.ts`).
  - Tokens de diseño para estados de archivo en `docs/design.md` (untracked,
    binary badge, status badges).
- Sin mutaciones Git, sin `git add -N`, sin polling, sin Shiki, sin
  virtualización, sin `tooLarge`.

- Aislamiento de base de datos en tests E2E:
  - `global-setup.ts` crea directorio único por ejecución bajo `os.tmpdir()`
    y lo asigna a `DIFFSCRIBE_DB_DIR`.
  - `globalTeardown` garantiza limpieza del directorio temporal.
  - Endpoint de reset `DELETE /api/test/state` con validación fail-closed:
    secreto via `DIFFSCRIBE_E2E_RESET_SECRET` + header `x-reset-secret`,
    canonicalización de path, guard symlink, rechazo de paths fuera de
    `os.tmpdir()` o dentro de `~/.diffscribe`, delete transaccional de
    `app_state` y `workspaces` preservando migraciones y esquema.
  - Helper `tests/e2e/helpers/reset-db.ts` invocado desde `beforeEach` en
    los 5 specs E2E.
  - Tests de integración con matriz de guardas en
    `tests/integration/endpoints/test-reset-endpoint.test.ts`.
  - Documentación de arquitectura de aislamiento en `docs/architecture.md`.

### Fixed

- Navegación por teclado en el sidebar de workspaces: los botones Select ahora
  responden a ArrowDown, ArrowUp, Home y End para navegar entre workspaces.
  Los botones Rename y Delete mantienen acceso directo por teclado como stops
  de Tab naturales. Se agregó atributo `data-workspace-select` a los botones
  Select. El test E2E `keyboard navigation in sidebar` fue refactorizado para
  usar `locator.focus()` y aserciones explícitas de foco, eliminando el conteo
  de Tab hardcodeado.

### Security

- D3 — Dependencias: actualizado `eslint` a `^10.8.0`, `@eslint/js` a
  `^10.0.1`, `typescript-eslint` a `^8.65.0`. Añadidos overrides
  `uuid >=11.1.1` y `cookie >=0.7.0`. `npm audit` reporta 0
  vulnerabilidades (0 critical, 0 high, 0 moderate, 0 low).

---

<!-- Template para futuras versiones:

## [0.1.0] — YYYY-MM-DD

### Added

- Primer release funcional.

### Changed

### Deprecated

### Removed

### Fixed

### Security

-->

---

[Unreleased]: <REPO_URL>/compare/v0.1.0...HEAD
