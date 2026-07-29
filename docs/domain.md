# DiffScribe — Modelo de dominio

**Estado:** Borrador inicial — derivado de PRD §9 y §16.

Esta guía define el lenguaje ubicuo, las entidades, value objects, aggregates,
invariantes, estados, servicios de dominio e interfaces de repositorios del
proyecto. Sigue principios de Domain-Driven Design y Clean Architecture.

---

## Lenguaje ubicuo

| Término          | Definición                                                                          |
| ---------------- | ----------------------------------------------------------------------------------- |
| Workspace        | Repositorio Git local registrado en DiffScribe. Conserva revisiones, contexto y preferencias. |
| Review           | Sesión persistente de análisis sobre una comparación Git. Contiene observaciones.   |
| Comparison       | Dos estados Git (base y target) usados para construir un diff.                      |
| Observation      | Conclusión registrada por el reviewer, vinculada a código, archivo o revisión.      |
| Occurrence       | Ubicación potencialmente relacionada con una observación existente.                 |
| ReviewContext    | Conjunto explícito de reglas y documentación usado para asistir al usuario.          |
| ContextSource    | Fuente individual de contexto: archivo, directorio, patrón o texto manual.          |
| ReviewPackage    | Artefacto final exportable: resumen, observaciones, ocurrencias e instrucciones.    |

---

## Entidades

### Workspace

Representa un repositorio Git registrado en la aplicación.

```text
id:            WorkspaceId (UUID)
displayName:   string (1-200 caracteres)
repositoryPath:string (ruta absoluta válida)
createdAt:     DateTime
lastOpenedAt:  DateTime
contextConfig: ContextConfiguration
preferences:   WorkspacePreferences
```

**Invariantes:**

- `repositoryPath` debe ser una ruta absoluta a un directorio que contenga un
  repositorio Git válido al momento del registro.
- `displayName` no puede estar vacío y debe tener entre 1 y 200 caracteres.
- Dos workspaces no pueden compartir el mismo `repositoryPath` dentro de la
  misma instalación.

**Aggregate root:** Workspace es aggregate root de su configuración de contexto
y preferencias. No contiene revisions directamente (las revisions referencian
al workspace por ID).

### Review

Sesión persistente de análisis sobre una comparación Git. En Etapa 1 implementada sin Observation ni contextSnapshot.

```text
id:             ReviewId (UUID v4)
workspaceId:    WorkspaceId
title:          string | null (opcional)
status:         ReviewStatus (draft → completed; in_progress/archived en DB CHECK)
comparison:     Comparison (capturada al crear; persistida como JSON + comparison_type)
createdAt:      DateTime
updatedAt:      DateTime
completedAt:    DateTime | null
```

**Invariantes implementadas (Etapa 1):**

- Una review siempre pertenece a un workspace existente (FK CASCADE).
- El `status` solo transiciona de `draft` a `completed`. La completación asigna `completedAt`.
- Review completada es read‑only: `mark` y `unmark` devuelven 409.
- Reabrir una review completada la mantiene `completed` (read‑only) pero la activa para el workspace.
- `comparison` se captura del draft activo al crear la review y se persiste como JSON validado (`json_valid`).
- No hay `reviewedFiles` estático ni inventario total. Las marcas son dinámicas: `reviewedCount` = marcas que intersectan con el file list actual; `totalCount` = tamaño del file list actual.
- La review activa se guarda en `app_state` con clave `active_review:<workspaceId>`. Crear la activa, completar la limpia, eliminar workspace la borra por cascade.
- Sin Observation, snapshots, stale detection, export ni portable en Etapa 1.

### Observation

Conclusión registrada por el reviewer. Implementada en Inc-7 con snapshot híbrido.

```text
id:                   ObservationId (UUID v4)
reviewId:             ReviewId
type:                 ObservationType (issue|risk|suggestion|question|praise|note)
severity:             ObservationSeverity | null (critical|major|minor|nitpick)
status:               ObservationStatus (open|resolved|dismissed|pending)
title:                string (1-200 caracteres)
body:                 string (≤5000 caracteres)
agentInstruction:     string (≤2000 caracteres, opcional)
filePath:             string | null (repo-relative, requerido para file/range)
lineRange:            LineRange | null (start≥1, end≥start)
side:                 string ("new" default, "old" explícito)
comparisonSnapshotJson: string (JSON del Comparison al crear; siempre presente)
diffSnapshot:         string | null (raw unified diff con prefijos +/-\space; file/range)
contentHash:           string | null (SHA-256 canónico; file/range)
createdAt:            DateTime
updatedAt:            DateTime
origin:               ObservationOrigin (human en Etapa 1; DB forward-compatible ai-generated)
```

**Invariantes:**

- `title` no puede estar vacío, máximo 200 caracteres.
- `body` máximo 5000 caracteres; `agentInstruction` máximo 2000.
- `severity` es obligatorio para `Issue` y `Risk`. Es `null` para `Praise` y `Note`. Opcional para `Suggestion` y `Question`.
- `filePath` y `lineRange` son opcionales (observaciones review-level no los tienen).
- Si `lineRange` está presente, `filePath` también debe estarlo. Si `filePath` está presente, `diffSnapshot` y `contentHash` son obligatorios.
- Review-level: `filePath=null`, `lineRange=null`, `diffSnapshot=null`, `contentHash=null`.
- `comparisonSnapshotJson` siempre presente (JSON válido del Comparison al crear).
- Range sobre binary → rechazado (422). File-level binary → permitido con diff/hash null.
- `side` solo "new" o "old". Default "new".
- `origin` indica `human` (Etapa 1); DB CHECK acepta `ai-generated` para forward-compatibilidad.

**Hash canónico:** `SHA-256(filePath + ":" + side + ":" + String(startLine) + ":" + LF-normalized content)` via `node:crypto`. Sin dependencias externas.

**Snapshot híbrido:** `comparison_snapshot_json` (siempre) + `diff_snapshot`/`content_hash` (solo file/range). El snapshot preserva los prefijos `+`/`-/` ` ` del unified diff original.

**Transiciones de estado:**
```
open → resolved | dismissed | pending
resolved → open
dismissed → open
pending → open
```
Mutación en review completed/archived → rechazada (409).

**StaleStatus (derivado, no persistido):**

| Status | Condición |
|--------|----------|
| `current` | Sin cambios detectados |
| `stale-content-changed` | Hash del contenido difiere del almacenado |
| `stale-range-missing` | Las líneas referenciadas ya no existen |
| `stale-file-deleted` | El archivo referenciado fue eliminado |
| `stale-file-renamed` | El archivo fue renombrado |
| `stale-binary` | El archivo es binario (solo si comparison cambió) |
| `stale-truncated` | El contenido está truncado |
| `stale-comparison-changed` | El Comparison activo difiere del almacenado |
| `stale-unknown` | No se pudo determinar |

Se recalcula bajo demanda al abrir ObservationPanel, cambiar Comparison o refrescar diff. Sin polling. Commit-vs-commit siempre current para file/range. Binary devuelve CURRENT si comparison no cambió. Rename detectado antes que file-deleted.

### Occurrence

Ubicación potencialmente relacionada con una observación.

```text
id:               OccurrenceId (UUID)
observationId:    ObservationId
filePath:         FilePath
lineRange:        LineRange
fragment:         string
similarityReason: string
relevance:        RelevanceLevel
status:           OccurrenceStatus
source:           OccurrenceSource
```

**Invariantes:**

- Una occurrence siempre pertenece a una observation existente.
- `filePath` y `lineRange` son obligatorios.
- `status` parte como `suggested`. Solo puede cambiar a `confirmed` o
  `dismissed` mediante acción explícita del usuario.
- `relevance` es estimado: `high`, `medium` o `low`.

---

## Value Objects

### Comparison

Describe los dos estados Git usados para construir un diff.

```text
base:              GitRef
target:            GitRef
comparisonType:    ComparisonType
createdAt:         DateTime
```

**Tipos de comparación (`ComparisonType`):**

- `working-tree-vs-head` — working tree contra HEAD
- `staged-vs-head` — cambios staged contra HEAD
- `unstaged` — cambios unstaged solamente
- `branch-vs-branch` — rama contra rama
- `commit-vs-commit` — commit contra commit
- `commit-vs-working-tree` — commit contra working tree
- `branch-vs-working-tree` — rama contra working tree
- `commit-range` — rango de commits

**Igualdad:** Dos comparisons son iguales si `base`, `target` y
`comparisonType` coinciden. `createdAt` es informativo.

**Serialización:** `ComparisonSerialized` provee una representación plana
(`base`, `target`, `comparisonType`, `createdAt`) usada como input del
endpoint `GET /api/workspaces/[id]/file-list?comparison=<encoded>`.

### GitRef

Referencia a un estado Git.

```text
type:  GitRefType  (branch | commit | head | working-tree | index)
value: string      (nombre de rama, hash de commit, o identificador reservado)
```

**Estado de implementación:** GitRef y Comparison están implementados como value objects
en `src/lib/server/domain/value-objects/git-ref.ts` y
`src/lib/server/domain/value-objects/comparison.ts`. El Comparison draft es
efímero (no persistido en base de datos). La comparación por defecto es HEAD
vs working tree. La selección de Base/Target es local y no ejecuta checkout ni
mutación del repositorio. Los tipos ComparisonSerialized y GitRefSerialized
proveen representaciones serializables para el transporte al cliente sin
exponer instancias de clase.

### FileChangeStatus

Enum que representa el estado de cambio de un archivo en una comparación Git.

```text
added, modified, deleted, renamed, copied, type-changed, unmerged,
untracked, unknown
```

**Valores:** 9 estados posibles. `binary` es un booleano separado en
`FileListEntry`, nunca un valor de `FileChangeStatus`. Implementado en
`src/lib/server/domain/value-objects/file-change-status.ts`.

### FileListEntry / FileListResult

DTOs de aplicación que representan una entrada de la lista de archivos y el
resultado agregado:

```text
FileListEntry:
  path:       string
  status:     FileChangeStatus
  binary:     boolean
  additions?: number
  deletions?: number
  oldPath?:   string        (solo para rename/copy)
  error?:     string        (solo para archivos no legibles)

FileListResult:
  entries:    FileListEntry[]
  readAt:     string (ISO 8601)
  error?:     { message: string; errorCode: string }
```

Implementados en `src/lib/server/application/dto/results/file-list-results.ts`.

### LineRange

Rango de líneas en un archivo.

```text
filePath: FilePath
startLine:positive integer
endLine:  positive integer
```

**Invariante:** `endLine >= startLine`.

### ContextConfiguration

Configuración de contexto de un workspace.

```text
autoDetectAgentsMd: boolean
sources:            ContextSource[]
```

### ContextSource

Fuente individual de contexto.

```text
id:            ContextSourceId (UUID)
workspaceId:   WorkspaceId
type:          ContextSourceType (file | directory | pattern | manual)
pathOrPattern: string
content:       string (solo para type=manual)
enabled:       boolean
autoDetected:  boolean
priority:      number
```

### WorkspacePreferences

Preferencias de visualización y comportamiento.

```text
defaultDiffMode:   DiffMode (unified | side-by-side)
defaultTheme:      Theme (light | dark | system)
fileListWidth:     number (px, solo si es configurable por el usuario)
observationPanelWidth: number (px, solo si es configurable por el usuario)
```

### ReviewContextSnapshot

Copia del contexto activo al momento de crear o actualizar una review.

```text
sources:       ContextSource[]
capturedAt:    DateTime
reviewId:      ReviewId
```

---

## Enums

### ReviewStatus

| Valor       | Descripción                              |
| ----------- | ---------------------------------------- |
| `draft`     | Creada, no iniciada formalmente          |
| `in_progress` | En revisión activa                     |
| `completed` | Revisión finalizada                      |
| `archived`  | Archivada, no aparece en vistas activas  |

### ObservationType

| Valor        | Descripción                                  |
| ------------ | -------------------------------------------- |
| `issue`      | Problema que debe corregirse                 |
| `risk`       | Riesgo potencial que requiere evaluación     |
| `suggestion` | Mejora propuesta, no obligatoria             |
| `question`   | Duda o aspecto que requiere clarificación    |
| `praise`     | Reconocimiento positivo                      |
| `note`       | Comentario informativo sin juicio de valor   |

### Severity

| Valor           | Descripción                          |
| --------------- | ------------------------------------ |
| `critical`      | Bloquea la aceptación del cambio     |
| `major`         | Debe resolverse antes de completar   |
| `minor`         | Puede resolverse en iteración futura |
| `informational` | Sin impacto en la decisión           |

### ObservationStatus

| Valor       | Descripción                               |
| ----------- | ----------------------------------------- |
| `open`      | Activa, requiere atención                 |
| `resolved`  | El reviewer considera que fue atendida    |
| `dismissed` | Descartada (no aplica, duplicada, etc.)   |
| `pending`   | En espera de información o decisión       |

### ObservationOrigin

| Valor          | Descripción                          |
| -------------- | ------------------------------------ |
| `human`        | Escrita manualmente por el usuario   |
| `ai-generated` | Generada por IA, pendiente de revisión |

### OccurrenceStatus

| Valor       | Descripción                        |
| ----------- | ---------------------------------- |
| `suggested` | Candidata, no confirmada           |
| `confirmed` | Aceptada por el usuario            |
| `dismissed` | Rechazada por el usuario           |

### OccurrenceSource

| Valor       | Descripción                                  |
| ----------- | -------------------------------------------- |
| `manual`    | Seleccionada manualmente por el usuario      |
| `text-search` | Sugerida por búsqueda textual             |
| `structural`  | Sugerida por búsqueda estructural          |
| `ai`        | Sugerida por IA                              |

### RelevanceLevel

| Valor    | Descripción                     |
| -------- | ------------------------------- |
| `high`   | Alta probabilidad de relación   |
| `medium` | Relación posible                |
| `low`    | Relación débil o incierta       |

---

## Estados y transiciones

### Review

```text
[draft] ──→ in_progress ──→ completed ──→ archived
  │              │                │            │
  └──────────────└────────────────└────────────┘
         (puede pasar a archived desde cualquier estado)
```

- `draft → in_progress`: el usuario inicia la revisión.
- `in_progress → completed`: el usuario finaliza la revisión.
- `completed → archived`: el usuario archiva.
- Cualquier estado → `archived`: archivado manual.
- No hay transición automática entre estados.

### Observation

```text
[open] ──→ resolved
  │  ──→ dismissed
  │  ──→ pending
  └── (puede volver a open desde cualquier estado)
```

- `open → resolved`: el reviewer marca como atendida.
- `open → dismissed`: el reviewer descarta.
- `open → pending`: el reviewer pospone.
- Cualquier estado → `open`: reapertura.

### Occurrence

```text
[suggested] ──→ confirmed
            ──→ dismissed
```

- `suggested → confirmed`: el usuario acepta.
- `suggested → dismissed`: el usuario rechaza.
- No se permite transición inversa (una vez confirmada o descartada, no vuelve
  a `suggested`).

---

## Servicios de dominio

Los servicios de dominio contienen lógica que no pertenece naturalmente a una
entidad o value object individual. Se implementan en la capa de aplicación
como casos de uso, pero su contrato semántico se define aquí.

### DiffService

Responsabilidad: construir la representación del diff a partir de una
`Comparison`.

- `getDiff(comparison: Comparison): DiffResult`
- `getFileList(comparison: Comparison): FileList`
- `getFileDiff(comparison: Comparison, filePath: FilePath): FileDiff`

### ObservationService

Responsabilidad: operaciones que involucran múltiples observaciones o
relaciones entre observaciones y otros agregados.

- `groupObservations(review: Review, criteria: GroupCriteria): ObservationGroup[]`
- `findRelatedObservations(observation: Observation, review: Review): Observation[]`

### OccurrenceService

Responsabilidad: búsqueda y gestión de ocurrencias.

- `searchSimilar(observation: Observation, scope: SearchScope): OccurrenceCandidate[]`
- `confirmOccurrence(occurrence: Occurrence): void`
- `dismissOccurrence(occurrence: Occurrence): void`

### ExportService

Responsabilidad: transformar una review en un review package exportable.

- `exportToMarkdown(review: Review): string`
- `exportToJson(review: Review): ReviewPackageJson`
- `generateAgentInstructions(review: Review): string`

---

## Interfaces de repositorios

Las interfaces de repositorios se definen en `domain/repositories/`. Son
puertos que el dominio expone y que la capa de infraestructura implementa.

Las implementaciones concretas y los mappers viven en
`infrastructure/repositories/`.

### WorkspaceRepository

```typescript
interface WorkspaceRepository {
  findById(id: WorkspaceId): Workspace | null;
  findAll(): Workspace[];
  findByPath(path: string): Workspace | null;
  save(workspace: Workspace): void;
  delete(id: WorkspaceId): void;
}
```

### ReviewRepository

```typescript
interface ReviewRepository {
  findById(id: ReviewId): Review | null;
  findByWorkspace(workspaceId: WorkspaceId): Review[];
  findActive(workspaceId: WorkspaceId): Review | null;
  save(review: Review): void;
  delete(id: ReviewId): void;
}
```

### ObservationRepository

```typescript
interface ObservationRepository {
  findById(id: ObservationId): Observation | null;
  findByReview(reviewId: ReviewId): Observation[];
  save(observation: Observation): void;
  delete(id: ObservationId): void;
}
```

### OccurrenceRepository

```typescript
interface OccurrenceRepository {
  findById(id: OccurrenceId): Occurrence | null;
  findByObservation(observationId: ObservationId): Occurrence[];
  save(occurrence: Occurrence): void;
  delete(id: OccurrenceId): void;
}
```

### ContextSourceRepository

```typescript
interface ContextSourceRepository {
  findByWorkspace(workspaceId: WorkspaceId): ContextSource[];
  save(source: ContextSource): void;
  delete(id: ContextSourceId): void;
}
```

---

## Decisiones abiertas

Las siguientes preguntas del PRD §21 afectan al modelo de dominio. Se registran
como `[PENDIENTE]` sin inventar respuestas:

1. `[PENDIENTE]` ¿Las revisiones se almacenan dentro del repositorio, fuera de
   él o mediante una opción configurable? — afecta a `ReviewRepository` y
   posiblemente a la ubicación de snapshots.

2. `[PENDIENTE]` ¿Debe existir un archivo portable de revisión que pueda
   versionarse? — afecta a `ReviewPackage` y `ExportService`.

3. `[PENDIENTE]` ¿Cómo se identificará una línea cuando el archivo cambie
   después de crear la observación? — afecta a `LineRange`, `diffSnapshot` y la
   estrategia de stale detection.

4. `[PENDIENTE]` ¿Las observaciones tendrán etiquetas personalizadas desde el
   inicio? — afecta a `Observation` (campo `tags` opcional).

5. `[PENDIENTE]` ¿Conviene persistir un snapshot completo del diff o solo
   referencias y fragmentos? — el modelo actual asume snapshot del fragmento
   (`diffSnapshot` en `Observation`), pero la decisión final está abierta.

6. `[PENDIENTE]` ¿Cómo se resolverá la precedencia de varios archivos
   `AGENTS.md`? — afecta a `ContextConfiguration` y la detección automática.

---

## Referencias

- [Product Requirements Document](PRD.md) §9 (conceptos centrales) y §16
  (modelo conceptual inicial)
- [Arquitectura](architecture.md) — capas y estructura de directorios
- [Versionado](versioning.md) — migraciones y compatibilidad de esquema
