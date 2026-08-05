# DiffScribe — Domain model

**Status:** Initial draft — derived from PRD §9 and §16.

This guide defines the ubiquitous language, entities, value objects, aggregates,
invariants, states, domain services, and repository interfaces of the project.
It follows Domain-Driven Design and Clean Architecture principles.

---

## Ubiquitous language

| Term             | Definition                                                                             |
| ---------------- | -------------------------------------------------------------------------------------- |
| Workspace        | Local Git repository registered in DiffScribe. Stores reviews, context, and preferences. |
| Review           | Persistent analysis session over a Git comparison. Contains observations.              |
| Comparison       | Two Git states (base and target) used to build a diff.                                 |
| Observation      | Conclusion recorded by the reviewer, linked to code, file, or review.                  |
| Occurrence       | Location potentially related to an existing observation.                               |
| ReviewContext    | Explicit set of rules and documentation used to assist the user.                       |
| ContextSource    | Individual context source: file, directory, pattern, or manual text.                   |
| ReviewPackage    | Exportable final artifact: summary, observations, occurrences, and instructions.       |

---

## Entities

### Workspace

Represents a Git repository registered in the application.

```text
id:            WorkspaceId (UUID)
displayName:   string (1-200 characters)
repositoryPath:string (valid absolute path)
createdAt:     DateTime
lastOpenedAt:  DateTime
contextConfig: ContextConfiguration
preferences:   WorkspacePreferences
```

**Invariants:**

- `repositoryPath` must be an absolute path to a directory containing a valid
  Git repository at registration time.
- `displayName` must not be empty and must be between 1 and 200 characters.
- Two workspaces cannot share the same `repositoryPath` within the same
  installation.

**Aggregate root:** Workspace is the aggregate root of its context configuration
and preferences. It does not contain reviews directly (reviews reference the
workspace by ID).

### Review

Persistent analysis session over a Git comparison. In Stage 1 implemented without Observation or contextSnapshot.

```text
id:             ReviewId (UUID v4)
workspaceId:    WorkspaceId
title:          string | null (optional)
status:         ReviewStatus (draft → completed; in_progress/archived in DB CHECK)
comparison:     Comparison (captured at creation; persisted as JSON + comparison_type)
createdAt:      DateTime
updatedAt:      DateTime
completedAt:    DateTime | null
```

**Implemented invariants (Stage 1):**

- A review always belongs to an existing workspace (FK CASCADE).
- `status` only transitions from `draft` to `completed`. Completion assigns `completedAt`.
- Completed review is read‑only: `mark` and `unmark` return 409.
- Reopening a completed review keeps it `completed` (read‑only) but activates it for the workspace.
- `comparison` is captured from the active draft at review creation and persisted as validated JSON (`json_valid`).
- There is no static `reviewedFiles` or total inventory. Marks are dynamic: `reviewedCount` = marks intersecting the current file list; `totalCount` = current file list size.
- The active review is saved in `app_state` with key `active_review:<workspaceId>`. Creating sets it active, completing clears it, deleting workspace removes it by cascade.
- No Observation, snapshots, stale detection, export, or portable in Stage 1.

### Observation

Conclusion recorded by the reviewer. Implemented in Inc-7 with hybrid snapshot.

```text
id:                   ObservationId (UUID v4)
reviewId:             ReviewId
type:                 ObservationType (issue|risk|suggestion|question|praise|note)
severity:             ObservationSeverity | null (critical|major|minor|nitpick)
status:               ObservationStatus (open|resolved|dismissed|pending)
body:                 string (1-5000 characters, single mandatory description)
agentInstruction:     string (≤2000 characters, optional)
filePath:             string | null (repo-relative, required for file/range)
lineRange:            LineRange | null (start≥1, end≥start)
side:                 string ("new" default, "old" explicit)
comparisonSnapshotJson: string (JSON of the Comparison at creation; always present)
diffSnapshot:         string | null (raw unified diff with +/-\space prefixes; file/range)
contentHash:          string | null (canonical SHA-256; file/range)
createdAt:            DateTime
updatedAt:            DateTime
origin:               ObservationOrigin (human in Stage 1; DB forward-compatible ai-generated)
```

**Invariants:**

- `body` is the single mandatory description field: must not be empty (trimmed)
  and max 5000 characters. There is no `title` — migration
  `006_drop_observation_title_require_body` (destructive) deleted rows with
  empty bodies, dropped the `title` column, and enforces
  `body TEXT NOT NULL CHECK (length(trim(body)) > 0)`.
- `agentInstruction` max 2000.
- `severity` is required for `Issue` and `Risk`. Is `null` for `Praise` and `Note`. Optional for `Suggestion` and `Question`.
- `filePath` and `lineRange` are optional (review-level observations do not have them).
- If `lineRange` is present, `filePath` must also be present. If `filePath` is present, `diffSnapshot` and `contentHash` are required.
- Review-level: `filePath=null`, `lineRange=null`, `diffSnapshot=null`, `contentHash=null`.
- `comparisonSnapshotJson` always present (valid JSON of the Comparison at creation).
- Range over binary → rejected (422). File-level binary → allowed with diff/hash null.
- `side` only "new" or "old". Default "new".
- `origin` indicates `human` (Stage 1); DB CHECK accepts `ai-generated` for forward compatibility.

**Canonical hash:** `SHA-256(filePath + ":" + side + ":" + String(startLine) + ":" + LF-normalized content)` via `node:crypto`. No external dependencies.

**Hybrid snapshot:** `comparison_snapshot_json` (always) + `diff_snapshot`/`content_hash` (only file/range). The snapshot preserves the `+`/`-`/` ` prefixes from the original unified diff.

**State transitions:**
```
open → resolved | dismissed | pending
resolved → open
dismissed → open
pending → open
```
Mutation on completed/archived review → rejected (409).

**StaleStatus (derived, not persisted):**

| Status | Condition |
|--------|----------|
| `current` | No changes detected |
| `stale-content-changed` | Content hash differs from stored |
| `stale-range-missing` | Referenced lines no longer exist |
| `stale-file-deleted` | Referenced file was deleted |
| `stale-file-renamed` | File was renamed |
| `stale-binary` | File is binary (only if comparison changed) |
| `stale-truncated` | Content is truncated |
| `stale-comparison-changed` | Active Comparison differs from stored |
| `stale-unknown` | Could not be determined |

Recalculated on demand when opening ObservationPanel, changing Comparison, or refreshing diff. No polling. Commit-vs-commit always current for file/range. Binary returns CURRENT if comparison did not change. Rename detected before file-deleted.

### Occurrence

Location potentially related to an observation.

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

**Invariants:**

- An occurrence always belongs to an existing observation.
- `filePath` and `lineRange` are required.
- `status` starts as `suggested`. Can only change to `confirmed` or `dismissed`
  through explicit user action.
- `relevance` is estimated: `high`, `medium`, or `low`.

---

## Value Objects

### Comparison

Describes the two Git states used to build a diff.

```text
base:              GitRef
target:            GitRef
comparisonType:    ComparisonType
createdAt:         DateTime
```

**Comparison types (`ComparisonType`):**

- `working-tree-vs-head` — working tree vs HEAD
- `staged-vs-head` — staged changes vs HEAD
- `unstaged` — unstaged changes only
- `branch-vs-branch` — branch vs branch
- `commit-vs-commit` — commit vs commit
- `commit-vs-working-tree` — commit vs working tree
- `branch-vs-working-tree` — branch vs working tree
- `commit-range` — commit range

**Equality:** Two comparisons are equal if `base`, `target`, and
`comparisonType` match. `createdAt` is informational.

**Serialization:** `ComparisonSerialized` provides a flat representation
(`base`, `target`, `comparisonType`, `createdAt`) used as input for the
`GET /api/workspaces/[id]/file-list?comparison=<encoded>` endpoint.

### GitRef

Reference to a Git state.

```text
type:  GitRefType  (branch | commit | head | working-tree | index)
value: string      (branch name, commit hash, or reserved identifier)
```

**Implementation status:** GitRef and Comparison are implemented as value objects
in `src/lib/server/domain/value-objects/git-ref.ts` and
`src/lib/server/domain/value-objects/comparison.ts`. The Comparison draft is
ephemeral (not persisted in database). The default comparison is HEAD vs
working tree. Base/Target selection is local and does not execute checkout or
repository mutation. The `ComparisonSerialized` and `GitRefSerialized` types
provide serializable representations for client transport without exposing
class instances.

**Canonical ref convention (tranche C):** when a branch is selected as a
comparison ref, the draft `value` is the **canonical Git ref**
(`refs/heads/<name>` for local branches, `refs/remotes/<remote>/<name>` for
cached remote branches) and the `label` is the short visible name (`dev`,
`origin/dev`). Full refs are never displayed. The canonical value is a stable
selection key that prevents collisions between a local branch and a cached
remote branch that share the same visible name (e.g. local `origin/main` vs
cached remote `origin/main`). Branch refs are resolved by Git by their full
ref name, so the existing file-list/diff readers accept them without change.

### FileChangeStatus

Enum representing the change state of a file in a Git comparison.

```text
added, modified, deleted, renamed, copied, type-changed, unmerged,
untracked, unknown
```

**Values:** 9 possible states. `binary` is a separate boolean in
`FileListEntry`, never a `FileChangeStatus` value. Implemented in
`src/lib/server/domain/value-objects/file-change-status.ts`.

**Client presentation (0003):** Quick Open consumes the existing
`FileChangeStatus`/`FileListEntry` values by path — the client joins the
comparison-aware `/file-list` result and renders the technical statuses
through the existing UI mapping (`statusTone`/`statusLabel`). No domain
change: the values, the endpoint contract, and the Git readers are
untouched.

### FileListEntry / FileListResult

Application DTOs representing a file list entry and the aggregated result:

```text
FileListEntry:
  path:       string
  status:     FileChangeStatus
  binary:     boolean
  additions?: number
  deletions?: number
  oldPath?:   string        (only for rename/copy)
  error?:     string        (only for unreadable files)

FileListResult:
  entries:    FileListEntry[]
  readAt:     string (ISO 8601)
  error?:     { message: string; errorCode: string }
```

Implemented in `src/lib/server/application/dto/results/file-list-results.ts`.

### LineRange

Line range in a file.

```text
filePath: FilePath
startLine:positive integer
endLine:  positive integer
```

**Invariant:** `endLine >= startLine`.

### ContextConfiguration

Context configuration of a workspace.

```text
autoDetectAgentsMd: boolean
sources:            ContextSource[]
```

### ContextSource

Individual context source.

```text
id:            ContextSourceId (UUID)
workspaceId:   WorkspaceId
type:          ContextSourceType (file | directory | pattern | manual)
pathOrPattern: string
content:       string (only for type=manual)
enabled:       boolean
autoDetected:  boolean
priority:      number
```

### WorkspacePreferences

Display and behavior preferences per workspace.

```text
defaultDiffMode:   DiffMode (unified | side-by-side)
fileListWidth:     number (px, only if user-configurable)
observationPanelWidth: number (px, only if user-configurable)
```

Note: the active theme (`ThemeKey: dark | synthwave-84`) is a global browser
preference stored in `localStorage`, not a per-workspace preference. The theme
preference does not travel to the server and is not persisted in SQLite.

### ThemeKey

Global theme preference, stored exclusively in browser `localStorage`. It is
not a domain entity and is not persisted on the server.

```text
ThemeKey: "dark" | "synthwave-84"
```

- `dark` is the Dark Deep theme (default).
- `synthwave-84` is the alternate Synthwave '84 theme.
- The value is resolved on the client and applied via the `data-theme`
  attribute on the `<html>` element.

### WorkspaceTreeNode

Read‑only representation of an entry in the project tree. Retrieved from
the `GET /api/workspaces/[id]/tree` endpoint.

```text
path:       string (repo-relative path)
kind:       "file" | "directory"
name:       string (file or directory name)
children?:  WorkspaceTreeNode[] (only if kind = "directory")
changeType?: FileChangeStatus | null (if the file has Git changes)
```

**Read‑only contract:** the tree is exclusively read‑only. It does not support
create, rename, delete, edit, or mutation operations from the UI.

### FileSource

Read‑only representation of the source content of a repository file. Retrieved
from the `GET /api/workspaces/[id]/source` endpoint.

```text
path:      string (repo-relative path)
language:  string (detected language, or "text")
lines:     FileSourceLine[]
```

Each line contains:

```text
lineNumber: number (1‑based)
content:    string (line text)
changeType: "added" | "removed" | "modified" | "unchanged" | null
```

`changeType` is derived from the active Git comparison and serves as a visual
marker in the gutter. It does not represent a diff nor replace the Diff Viewer
in the Git tab.

**Read‑only contract:** the source view is exclusively read‑only. Editing,
auto‑fix, and file mutation from the UI are not allowed.

---

### ReviewContextSnapshot

Copy of the active context at the time of creating or updating a review.

```text
sources:       ContextSource[]
capturedAt:    DateTime
reviewId:      ReviewId
```

---

## Enums

### ReviewStatus

| Value        | Description                             |
| ------------ | --------------------------------------- |
| `draft`      | Created, not formally started           |
| `in_progress`| In active review                        |
| `completed`  | Review finished                         |
| `archived`   | Archived, not shown in active views     |

### ObservationType

| Value        | Description                                   |
| ------------ | --------------------------------------------- |
| `issue`      | Problem that must be fixed                    |
| `risk`       | Potential risk requiring evaluation           |
| `suggestion` | Proposed improvement, not mandatory           |
| `question`   | Doubt or aspect requiring clarification       |
| `praise`     | Positive recognition                          |
| `note`       | Informational comment without value judgment  |

### Severity

| Value           | Description                         |
| --------------- | ----------------------------------- |
| `critical`      | Blocks acceptance of the change     |
| `major`         | Must be resolved before completing  |
| `minor`         | Can be resolved in a future iteration |
| `informational` | No impact on the decision           |

### ObservationStatus

| Value       | Description                                    |
| ----------- | ---------------------------------------------- |
| `open`      | Active, requires attention                     |
| `resolved`  | The reviewer considers it addressed            |
| `dismissed` | Discarded (not applicable, duplicate, etc.)    |
| `pending`   | Awaiting information or decision               |

### ObservationOrigin

| Value          | Description                              |
| -------------- | ---------------------------------------- |
| `human`        | Written manually by the user             |
| `ai-generated` | AI-generated, pending human review       |

### OccurrenceStatus

| Value       | Description                      |
| ----------- | -------------------------------- |
| `suggested` | Candidate, not confirmed         |
| `confirmed` | Accepted by the user             |
| `dismissed` | Rejected by the user             |

### OccurrenceSource

| Value         | Description                               |
| ------------- | ----------------------------------------- |
| `manual`      | Manually selected by the user             |
| `text-search` | Suggested by text search                  |
| `structural`  | Suggested by structural search            |
| `ai`          | AI-suggested                              |

### RelevanceLevel

| Value    | Description                  |
| -------- | ---------------------------- |
| `high`   | High probability of relation |
| `medium` | Possible relation            |
| `low`    | Weak or uncertain relation   |

---

## States and transitions

### Review

```text
[draft] ──→ in_progress ──→ completed ──→ archived
  │              │                │            │
  └──────────────└────────────────└────────────┘
         (can transition to archived from any state)
```

- `draft → in_progress`: user starts the review.
- `in_progress → completed`: user finishes the review.
- `completed → archived`: user archives.
- Any state → `archived`: manual archive.
- No automatic transition between states.

### Observation

```text
[open] ──→ resolved
  │  ──→ dismissed
  │  ──→ pending
  └── (can return to open from any state)
```

- `open → resolved`: reviewer marks as addressed.
- `open → dismissed`: reviewer discards.
- `open → pending`: reviewer postpones.
- Any state → `open`: reopen.

### Occurrence

```text
[suggested] ──→ confirmed
            ──→ dismissed
```

- `suggested → confirmed`: user accepts.
- `suggested → dismissed`: user rejects.
- Reverse transition not allowed (once confirmed or dismissed, does not return
  to `suggested`).

---

## Domain services

Domain services contain logic that does not naturally belong to a single entity
or value object. They are implemented in the application layer as use cases,
but their semantic contract is defined here.

### DiffService

Responsibility: build the diff representation from a `Comparison`.

- `getDiff(comparison: Comparison): DiffResult`
- `getFileList(comparison: Comparison): FileList`
- `getFileDiff(comparison: Comparison, filePath: FilePath): FileDiff`

### ObservationService

Responsibility: operations involving multiple observations or relationships
between observations and other aggregates.

- `groupObservations(review: Review, criteria: GroupCriteria): ObservationGroup[]`
- `findRelatedObservations(observation: Observation, review: Review): Observation[]`

### OccurrenceService

Responsibility: searching and managing occurrences.

- `searchSimilar(observation: Observation, scope: SearchScope): OccurrenceCandidate[]`
- `confirmOccurrence(occurrence: Occurrence): void`
- `dismissOccurrence(occurrence: Occurrence): void`

### ExportService

Responsibility: transforming a review into an exportable review package.

- `exportToMarkdown(review: Review): string`
- `exportToJson(review: Review): ReviewPackageJson`
- `generateAgentInstructions(review: Review): string`

---

## Repository interfaces

Repository interfaces are defined in `domain/repositories/`. They are ports
exposed by the domain and implemented by the infrastructure layer.

Concrete implementations and mappers live in
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

## Open decisions

The following questions from PRD §21 affect the domain model. They are recorded
as `[PENDIENTE]` without inventing answers:

1. `[PENDIENTE]` Should reviews be stored inside the repository, outside it, or
   via a configurable option? — affects `ReviewRepository` and possibly
   snapshot location.

2. `[PENDIENTE]` Should there be a portable review file that can be versioned? —
   affects `ReviewPackage` and `ExportService`.

3. `[PENDIENTE]` How will a line be identified when the file changes after the
   observation is created? — affects `LineRange`, `diffSnapshot`, and the
   stale detection strategy.

4. `[PENDIENTE]` Will observations have custom tags from the start? — affects
   `Observation` (optional `tags` field).

5. `[PENDIENTE]` Is it better to persist a full diff snapshot or only references
   and fragments? — the current model assumes a fragment snapshot
   (`diffSnapshot` in `Observation`), but the final decision is open.

6. `[PENDIENTE]` How will the precedence of multiple `AGENTS.md` files be
   resolved? — affects `ContextConfiguration` and auto-detection.

## Presentation mapping (workspace‑git‑review‑ux)

The domain vocabulary is unchanged; the following mappings live only at the
consumer (web) layer:

- **`FileChangeStatus.UNTRACKED` → UI label `New`** (always English). The
  domain/API/DTO value remains `untracked`; no localization is introduced.
- **Untracked tone**: `untracked` maps to the success (green) tone in the UI;
  `added` stays green too.
- **Directory status aggregation**: directories in the Project tree show a
  single dot derived from descendant statuses with deterministic precedence
  (highest wins): `unmerged > deleted > modified > type-changed > added >
  renamed > copied > untracked > unknown`. This is a presentation rule, not a
  domain invariant — the precedence lives in
  `src/lib/web/utils/status-aggregation.ts`.
- **Working tree as target**: the Git comparison target accepts a fixed
  `working-tree` ref (serialized label "Working tree"); `ComparisonType`
  inference produces `working-tree-vs-head`, `branch-vs-working-tree`, or
  `commit-vs-working-tree` as before.

---

## References

- [Product Requirements Document](PRD.md) §9 (core concepts) and §16
  (initial conceptual model)
- [Architecture](architecture.md) — layers and directory structure
- [Versioning](versioning.md) — migrations and schema compatibility
