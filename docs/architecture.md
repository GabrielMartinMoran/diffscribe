# DiffScribe — Architecture

**Status:** Initial draft

This document defines the technical architecture of DiffScribe: stack, layers,
data flow, architectural decisions, CI/QA, and boundaries between modules.

The visual design guide, CSS tokens, breakpoints, and accessibility are in
[docs/design.md](design.md).

---

## Stack

| Component          | Choice                     | Notes                                           |
| ------------------ | -------------------------- | ----------------------------------------------- |
| Framework          | SvelteKit + adapter-node   | SSR + local server; Vite as bundler             |
| Language           | TypeScript                 | Strict mode                                     |
| UI                 | Svelte 5 + custom CSS      | No Tailwind; global tokens and scoped styles    |
| Persistence        | SQLite (`better-sqlite3`)  | Synchronous; database in `~/.diffscribe/diffscribe.db` |
| Git                | Native CLI + `simple-git`  | `simple-git` for common operations              |
| Highlighting       | Shiki                      | Declarative syntax; configurable themes         |
| Unit tests         | Vitest                     | Fast runner; integrated with Vite               |
| BDD tests          | quickpickle + Vitest       | `.feature` read directly                        |
| E2E tests          | Playwright                 | Real browser                                    |
| CI                 | GitHub Actions             | From Stage 1                                    |
| Distribution       | Executable npm package     | `npx diffscribe`                                |

---

## Layers

DiffScribe applies Clean Architecture with two complementary skills: Clean
Backend Architecture for the server and Clean Svelte Architecture for the web
layer. Dependencies point inward: outer layers know about inner ones; inner
ones know nothing about outer ones.

```text
web / routes  ───  infrastructure  ───  application  ───  domain
```

| Layer             | Own                                                                       | Forbidden                               |
| ----------------- | ------------------------------------------------------------------------- | --------------------------------------- |
| `domain`          | Entities, value objects, repository interfaces, domain errors             | Frameworks, HTTP, DB, vendor SDKs       |
| `application`     | Use cases, commands, queries, DTOs, results                               | Transport, persistence, UI components   |
| `infrastructure`  | Repository implementations, mappers, SQL, Git clients, gateways           | Business logic, product decisions       |
| `web` (or routes) | Svelte components, stores, endpoints, HTTP handlers                       | Business rules, direct DB access        |

### Expected directory structure

```text
src/
├── lib/
│   ├── server/
│   │   ├── domain/
│   │   │   ├── entities/
│   │   │   ├── value-objects/
│   │   │   ├── repositories/       # Interfaces (ports)
│   │   │   └── errors/
│   │   ├── application/
│   │   │   ├── dto/
│   │   │   │   ├── commands/
│   │   │   │   ├── queries/
│   │   │   │   └── results/
│   │   │   └── services/           # Use cases
│   │   └── infrastructure/
│   │       ├── repositories/       # Concrete implementations
│   │       ├── mappers/
│   │       ├── git/
│   │       └── database/
│   └── web/                        # Svelte components, stores, CSS
│       ├── components/
│       │   └── ui/                 # Base UI kit: generic stateless primitives
│       ├── stores/
│       └── styles/
└── routes/                         # SvelteKit endpoints
```

### Base UI kit boundary

`web/components/ui/` hosts the generic, stateless, token-driven UI
primitives (Button, IconButton, TextInput, Select, Checkbox, Switch, Menu,
Popover, Dialog, Tabs, Tooltip, Badge, StatusBadge). The directory is flat
(no `atoms/`/`molecules/`/`organisms/` grouping) and enforces three
invariants:

- **Stateless:** props down, events up. `ui/` modules never import stores,
  `$lib/server`, application, or domain modules, and never reference product
  vocabulary (workspace, review, observation, diff, branch).
- **Native HTML:** `button`, `input`, `select`, `dialog` are used directly;
  no custom combobox, headless UI library, or portal dependency.
- **Token-driven:** every visual value references a CSS custom property from
  the design token contract (see `docs/design.md` — Base UI kit).

Product composites (panels, forms, viewer chrome) live in
`web/components/` and may consume `ui/` primitives; they must not place
generic controls inside `ui/`. The import boundary is enforced by a unit
guard that statically scans `ui/` sources.

### Repository interfaces (ports)

Every repository interface is defined in `domain/repositories/`. Only the
domain knows the contract shape. The `application` layer consumes these
interfaces without knowing who implements them.

Concrete implementations and persistence mappers live exclusively in
`infrastructure/repositories/`. No layer external to the domain defines
repository interfaces.

### Server-only boundary

Access to filesystem, Git, SQLite, and secrets is restricted to the server
side. Modules that touch these resources must reside under `$lib/server/` and
must never be imported from client-side code.

SvelteKit enforces this separation via `$env/static/private` for secrets and
the `$lib/server/` convention for server-only modules.

### Git context reader (Inc-3)

The workspace active Git state reader is implemented with a technical port
`GitContextReader` in `src/lib/server/application/git-context-reader.ts` and
its adapter `SimpleGitContextReader` in
`src/lib/server/infrastructure/git/simple-git-context-reader.ts`.

**Strict boundaries:**

- The port exposes typed DTOs (`StatusDto`, `BranchDto`, `CommitDto`,
  `GitContextResult`). No `simple-git` type crosses the adapter boundary.
- The adapter uses exclusively read-only APIs from `simple-git` v3.36.0:
  `status()`, `branchLocal()`, `log({maxCount})`, `revparse()`, `checkIsRepo()`.
- No checkout, commit, branch, push, fetch, merge, or reset is executed.
- The `GetGitContextUseCase` use case returns typed aggregated data +
  read timestamp. No cache.
- The `GET /api/workspaces/[id]/git-context` endpoint allows manual refresh.
  No polling, watcher, or auto-reload.
- The UI panel (`GitContextPanel.svelte`) maintains an ephemeral Comparison
  draft in client memory. Base/Target selection updates the draft without
  mutating the repository.

**HEAD states covered:** clean, dirty, detached, unborn, conflict, error.

### File list reader (Inc-4)

The file list panel shows the files modified by the active Comparison. The
architecture follows the same pattern as the Git context reader:

- **Port:** `GitFileListReader` in `src/lib/server/application/git-file-list-reader.ts`.
  Exposes a `read(params)` method that receives `repositoryPath`, `comparisonType`,
  `baseRef`, and `targetRef`, and returns a typed `FileListResult`.
- **Adapter:** `SimpleGitFileListReader` in
  `src/lib/server/infrastructure/git/simple-git-file-list-reader.ts`.
  Implements the port using two read-only calls to `simple-git.raw()` with
  NUL parsing:
  - `git diff --name-status -z -C -C <args>`: gets the file list with
    status codes (A, M, D, R, C, T, U).
  - `git diff --numstat -z <args>`: gets additions and deletions per file.
    Binary files report `-` instead of numbers.
  - `git ls-files --others --exclude-standard -z`: gets untracked files
    when the target is the working tree.
- **Binary detection:** tracked files are detected via `--numstat` output
  (`-` for binaries). Untracked files are inspected by reading the first
  8000 bytes read‑only looking for NUL bytes.
- **Use case:** `GetFileListUseCase` in
  `src/lib/server/application/services/get-file-list-use-case.ts`.
  Resolves the `Comparison` refs and delegates to the adapter.
- **Endpoint:** `GET /api/workspaces/[id]/file-list?comparison=<encoded>`.
  Validates workspace, comparison type, ref types, and JSON content
  before delegating to the use case. No server-side filter, sort, or
  pagination parameters.
- **UI component:** `file-list.svelte` in `src/lib/web/components/`.
  Filtering by path/status, sorting by path/status/additions/deletions,
  pagination (50 per page), active row selection, keyboard navigation,
  status badges, binary indicator, and oldPath for renames. Integrated
  inside `git-context-panel.svelte`.

**File statuses covered:** added, modified, deleted, renamed, copied,
type-changed, unmerged, untracked, unknown. Binary is a separate boolean,
never a status.

**Strict boundaries:**
- `simple-git` only in infrastructure. No `simple-git` type crosses the
  adapter boundary.
- Only read-only operations. No `git add`, `git add -N`, checkout, commit,
  or any mutation.
- Binary detection of untracked via `readFileSync`; no `git add`.
- Filtering, sorting, and pagination are exclusively client-side.
- No polling, watcher, auto-reload, or Git mutations.

### Project tree reader

The full repository tree is served through the
`GET /api/workspaces/[id]/tree` endpoint. It follows the same Clean
Architecture pattern as the existing readers:

- **Port:** `WorkspaceTreeReader` in `src/lib/server/application/`. Exposes a
  `read(repositoryPath)` method that returns a root `WorkspaceTreeNode` with
  recursive children.
- **Adapter:** in `src/lib/server/infrastructure/`. Implements the port by
  traversing the filesystem in a read‑only manner (no `git` for the tree
  structure; only for change metadata).
- **Use case:** `GetWorkspaceTreeUseCase`.
- **Endpoint:** `GET /api/workspaces/[id]/tree`. Returns the full tree as JSON.
- **Contract:** the tree is read‑only. No mutation operations.

### Source reader (Source View)

The full source of a file is served through the
`GET /api/workspaces/[id]/source` endpoint. It follows Clean Architecture:

- **Port:** `FileSourceReader` in `src/lib/server/application/`. Exposes a
  `read(repositoryPath, relativePath)` method that returns a `FileSource` with
  numbered lines and Git change metadata.
- **Adapter:** in `src/lib/server/infrastructure/`. Reads the file from the
  filesystem (read‑only), applies Shiki for syntax highlighting, and queries the
  active diff to derive `changeType` per line.
- **Use case:** `GetFileSourceUseCase`.
- **Endpoint:** `GET /api/workspaces/[id]/source?path=<encoded>`. Returns
  source with highlighting and change markers.
- **Contract:** the source view is read‑only. No editing, auto‑fix, or mutation.

### Client-side preferences

The active theme (`ThemeKey`) and resized panel widths are stored exclusively
in the browser's `localStorage`. These values:

- Are not persisted in SQLite or on the server.
- Are not part of the server-side domain model.
- Are not synchronized between devices or sessions.
- Are resolved on the client and applied via the `data-theme` attribute on the
  `<html>` element.

---

## Persistence

DiffScribe uses SQLite via `better-sqlite3` as the primary local storage.

### Location and configuration

The database is stored at:

```text
~/.diffscribe/diffscribe.db
```

The `~/.diffscribe/` directory is created automatically on first run. The
location is configurable via an environment variable, but the default is
`~/.diffscribe/`.

### WAL and performance

SQLite operates in WAL (Write-Ahead Logging) mode by default. This allows
concurrent reads with writes and improves performance under mixed workloads.

### Database isolation in E2E tests

To prevent contamination between runs and protect the real database
(`~/.diffscribe/diffscribe.db`), E2E tests use an isolated database:

- **Unique directory per run:** Playwright's `global-setup.ts` creates a
  temporary directory with `fs.mkdtempSync(path.join(os.tmpdir(), 'diffscribe-e2e-'))`
  and assigns it to `process.env.DIFFSCRIBE_DB_DIR` before the development
  server starts.
- **Guaranteed teardown:** `globalTeardown` deletes the temporary directory
  even if tests fail or crash.
- **Fail-closed reset endpoint:** `DELETE /api/test/state` allows each E2E test
  to clean the database before running. The endpoint:
  - Requires the `DIFFSCRIBE_E2E_RESET_SECRET` environment variable — without
    it, returns 404 indistinguishable from a non-existent route.
  - Requires the `x-reset-secret` header with the secret's exact value. Secret
    errors return 404.
  - Canonicalizes the DB directory with `fs.realpathSync` to resolve symlinks.
  - Rejects paths outside `os.tmpdir()` and paths that resolve inside
    `~/.diffscribe`, using semantic `path.relative()` (not substring checks).
  - Executes `DELETE FROM app_state` and `DELETE FROM workspaces` in an
    atomic transaction. Migrations, schema, and other files are not modified.
- **Reset per test:** A helper function `resetDb()` in
  `tests/e2e/helpers/reset-db.ts` is called from `test.beforeEach` in each
  E2E spec file (`smoke`, `workspace-management`, `workspace-registration`,
  `git-context-panel`, `file-list-panel`).
- **Security:** The real database at `~/.diffscribe/` is never read, deleted,
  migrated, or opened from E2E testing code. The reset endpoint does not accept
  arbitrary paths and never exposes the secret in logs.
- **No production impact:** The reset endpoint is not available without the
  `DIFFSCRIBE_E2E_RESET_SECRET` environment variable. In production, the
  variable is not set, resulting in 404 for any request to the endpoint.

### Database isolation in Vitest (unit, integration, BDD)

Unit, integration, and BDD tests executed with Vitest must also use an isolated
database. To achieve this without modifying production code beyond a fail-closed
guard, two complementary mechanisms were implemented:

#### Fail-closed guard in `connection.ts`

The `src/lib/server/infrastructure/database/connection.ts` module resolves the
database directory lazily inside `getDb()`. Before opening the connection, it
verifies:

- If `process.env.VITEST` is present and `DIFFSCRIBE_DB_DIR` is not defined,
  it throws a descriptive error. This prevents any Vitest test from
  accidentally using the production database at `~/.diffscribe`.
- If `process.env.VITEST` is NOT present (production or development server),
  it uses `DIFFSCRIBE_DB_DIR` if defined or falls back to
  `~/.diffscribe/diffscribe.db`.
- If `process.env.VITEST` is present AND `DIFFSCRIBE_DB_DIR` points to a
  safe temporary directory, it allows the connection normally.

This guard is evaluated on each call to `getDb()`, not at module load time.
The `createTestDb()` function (in‑memory database) is not affected by this
guard, as it does not use `DIFFSCRIBE_DB_DIR`.

#### Global setup per Vitest project

Each Vitest project (`unit` and `integration` in `vitest.config.ts`, and the
BDD project in `vitest.bdd.config.ts`) configures a `globalSetup` that:

- Creates a unique temporary directory with `fs.mkdtempSync` under `os.tmpdir()`
  and injects it into workers via `provide('dbDir', dbDir)`.
- Workers receive the directory through `inject('dbDir')` in the
  `tests/setup/vitest-setup.ts` file, which assigns
  `process.env.DIFFSCRIBE_DB_DIR` before any test or step definition is loaded.
- The `teardown` of the `globalSetup` deletes the temporary directory even
  if tests fail or crash.

#### Isolation verification

- **Unit tests:** `tests/unit/infrastructure/connection-guard.test.ts`
  verifies the three scenarios of the fail-closed guard (VITEST without env
  throws error, VITEST with temp dir allows connection, without VITEST in
  production mode allows connection).
- **Integration tests:** `tests/integration/database/test-isolation.test.ts`
  verifies that `DIFFSCRIBE_DB_DIR` is defined, absolute, exists, is under
  `os.tmpdir()`, is not under `~/.diffscribe`, and that `getDb()` correctly
  resolves to the isolated directory.
- **BDD tests:** `specs/features/application/test-db-isolation.feature`
  covers the same three guard scenarios in Gherkin format, with step
  definitions in `tests/steps/test-db-isolation.steps.ts`.
- **No production impact:** The guard only activates when
  `process.env.VITEST` is present. Vitest sets this variable automatically in
  all workers. In the development server and in production, the variable does
  not exist, so the guard never activates and the fallback to `~/.diffscribe`
  works normally.

### Migrations

Migrations are applied at application startup. Each migration is a numbered SQL
file (`001_*.sql`, `002_*.sql`, etc.) loaded via
`import.meta.glob('./migrations/*.sql', { eager: true, query: '?raw' })`.
They are executed in alphabetical order and each is wrapped in
`db.transaction()` for atomicity. A `_migrations` table records which
migrations have already been applied, ensuring idempotency.

Current migrations:
- `001_create_workspaces` — `workspaces` table with id, display_name, repository_path, timestamps
- `002_app_state` — `app_state` key/value table for application state
- `003_create_reviews` — `reviews` table with FK `workspace_id` ON DELETE CASCADE, CHECK on status and comparison_type, `json_valid()` on comparison_json
- `004_create_review_files` — `review_files` table with composite PK `(review_id, file_path)`, FK `review_id` ON DELETE CASCADE

`PRAGMA foreign_keys = ON` is activated in production and test connections
(`connection.ts`). Migrations must maintain backward compatibility within the
same major version (see [docs/versioning.md](versioning.md)).

### Active Review (app_state)

The active review per workspace is stored in `app_state` with key
`active_review:<workspaceId>`. There is no separate active review table.
Creating a review sets the key; completing it clears it; deleting the
workspace also clears the key from `DeleteWorkspaceUseCase`. On page load
(`+page.server.ts`), it verifies that the referenced active review exists;
if not (orphan key), it is automatically cleaned up.

### E2E Reset

The `DELETE /api/test/state` endpoint cleans `review_files`, `reviews`,
`app_state`, and `workspaces` in an atomic transaction. FK CASCADE guarantees
that deleting workspaces also deletes their reviews and review_files, but the
explicit order in the reset ensures cleanup even if `foreign_keys` is disabled.

---

## Git integration

DiffScribe interacts with Git via:

1. **Native Git CLI** — required on the system. It is assumed that `git` is
   available in the `PATH`.
2. **`simple-git`** — Node.js wrapper over the Git CLI. Simplifies common
   operations such as `diff`, `log`, `branch`, and `status`.

The tool is read‑only with respect to Git in Stage 1. It does not create
commits, branches, or modify files.

### Supported comparisons

Git comparisons are represented by the types defined in the domain model (see
[docs/domain.md](domain.md)). The infrastructure layer translates these concepts
into concrete Git commands.

---

## Syntax highlighting

Shiki provides declarative syntax highlighting. It is configured with light and
dark themes matching the application's active theme. Shiki's token CSS is
integrated with the custom design tokens defined in
[docs/design.md](design.md).

---

## CI and QA

### Pipeline

GitHub Actions runs the QA pipeline on every push and pull request. The stages
are sequential (if one fails, subsequent ones do not run):

| Stage          | Command                     |
| -------------- | --------------------------- |
| Format         | `npm run format`            |
| Lint           | `npm run lint`              |
| Typecheck      | `npm run check`             |
| Unit tests     | `npm run test:unit`         |
| Integ. tests   | `npm run test:integration`  |
| BDD tests      | `npm run test:bdd`          |
| E2E tests      | `npm run test:e2e`          |
| Build          | `npm run build`             |

The `npm run qa` command runs all stages locally.

### Tools

- **Prettier:** consistent formatting.
- **ESLint** (flat config): linting rules, import order (`simple-import-sort`),
  structure (`import-x`), and unused import cleanup
  (`eslint-plugin-unused-imports`). Prettier and ESLint are kept separate via
  `eslint-config-prettier/flat`.
- **TypeScript:** strict mode; no `any` without explicit justification.

---

## Data flow

### Opening a workspace

```text
User → SvelteKit route → application (GetWorkspaceUseCase)
  → infrastructure (WorkspaceRepository) → SQLite
  → domain (Workspace entity) → response
```

### Getting a diff

```text
User → SvelteKit route → application (GetDiffUseCase)
  → infrastructure (GitService) → git CLI
  → domain (Comparison, DiffResult) → response
```

### Creating an observation

```text
User → SvelteKit route → application (CreateObservationUseCase)
  → domain (Observation entity, invariants)
  → infrastructure (ObservationRepository) → SQLite
  → infrastructure (GitService) → fragment snapshot
  → response
```

### Export

```text
User → SvelteKit route → application (ExportReviewUseCase)
  → infrastructure (ObservationRepository) → SQLite
  → domain (Review aggregate) → Markdown/JSON formatting
  → response
```

---

## Architectural decisions

### ADR-001: Local and synchronous SQLite

**Decision:** Use `better-sqlite3` with synchronous access instead of an
asynchronous driver or a separate database.

**Reason:** The application is single-user and local. Synchronous SQLite
simplifies the concurrency model without sacrificing performance. There is no
real contention between multiple connections.

### ADR-002: Hybrid snapshot with canonical hash for staleness

**Decision:** Each observation stores two immutable artifacts at creation:
1. `comparison_snapshot_json` — the JSON of the active Comparison (always present, for all observation types).
2. `diff_snapshot` and `content_hash` (SHA-256) — only for file-level and range-level observations. Null for review-level observations.

**Canonical hash format:** `filePath + ":" + side + ":" + String(startLine) + ":" + LF-normalized content`. No hunk header or changeType. Uses `node:crypto` without external dependencies.

**Reason:** The diff snapshot preserves the exact context the reviewer saw. The SHA-256 hash enables deterministic content change detection. The combination (snapshot + hash) covers both original context visualization and efficient staleness detection.

**Staleness (derived, not persisted):** Recalculated on demand when opening the ObservationPanel, changing the Comparison, or refreshing the diff. No polling or watchers. Possible statuses: `current`, `stale-content-changed`, `stale-range-missing`, `stale-file-deleted`, `stale-file-renamed`, `stale-binary`, `stale-truncated`, `stale-comparison-changed`, `stale-unknown`. Commit-vs-commit is always current for file/range. Binary returns CURRENT if the comparison did not change.

**Triggers:** Panel open, Comparison change, manual diff refresh.

### ADR-003: Repository interfaces in domain

**Decision:** Repository interfaces are defined exclusively in
`domain/repositories/`. The `application` layer never defines persistence
ports.

**Reason:** Maintain the Clean Architecture dependency rule: the domain does
not depend on anything external. Repository interfaces belong to the domain
because they express what the domain needs to persist, not how it is persisted.

### ADR-004: No Tailwind, custom CSS

**Decision:** Use custom CSS with global tokens and Svelte scoped styles.

**Reason:** DiffScribe's UI is a code review workbench with specific visual
requirements (syntax highlighting, diffs, annotations). A custom token system
gives precise control over density, hierarchy, and diff states. Tailwind would
add an abstraction layer that is not justified for this visual domain.

### ADR-005: Shiki over highlight.js or Prism

**Decision:** Use Shiki for syntax highlighting.

**Reason:** Shiki uses TextMate grammars (the same as VS Code), produces HTML
with semantic tokens, and supports dual light/dark themes. It works on the
server (SSR) without additional JS payload. The output is predictable and
styleable with custom CSS.

### ADR-006: quickpickle for BDD

**Decision:** Use quickpickle as the BDD runner, which reads `.feature` files
directly and runs them with Vitest.

**Reason:** quickpickle does not require intermediate compilation of features to
code. The `.feature` files are the source of truth and the runner consumes them
as-is. Vitest as the engine offers speed, watch mode, and compatibility with the
Vite/SvelteKit ecosystem.

---

## Inc-7: Observations

**Layer architecture:**

| Layer | New components |
|-------|---------------|
| `domain/` | `Observation` (entity), `ObservationId`, `LineRange`, `ObservationType/Severity/Origin/Status` (enums), `StaleStatus` (enum), `ObservationRepository` (port) |
| `application/` | `CreateObservationUseCase`, `GetObservationUseCase`, `ListObservationsUseCase`, `UpdateObservationUseCase`, `DeleteObservationUseCase`, `TransitionObservationStatusUseCase` |
| `infrastructure/` | `SqliteObservationRepository`, `ObservationMapper`, `ContentHasher` (canonical SHA-256), `StaleDeriver` (9 statuses) |
| `web/routes/` | REST: `GET/POST /observations`, `GET/PATCH/DELETE /observations/:id`, `POST /observations/:id/status` |
| `web/components/` | `ObservationPanel`, `ObservationCard`, `ObservationForm`, line selection in `DiffViewer` |

**Migration:** `005_create_observations` with FK `review_id -> reviews(id) ON DELETE CASCADE`, CHECKs for type/status/origin/severity, `json_valid()` on comparison_snapshot_json, diff_snapshot and content_hash null together, indexes on review_id/type/status.

**Canonical hash:** `SHA-256(filePath + ":" + side + ":" + startLine + ":" + LF-normalized content)` via `node:crypto`. No external dependencies.

**REST endpoints:**
- `GET/POST /api/workspaces/[id]/reviews/[reviewId]/observations`
- `GET/PATCH/DELETE .../[observationId]`
- `POST .../[observationId]/status` body `{status}`

**Guards:** Workspace exists, review belongs to workspace, observation belongs to review. Mutation on completed/archived review → 409. Range over binary → 422.

**Staleness:** Recalculated on demand (panel open, Comparison change, diff refresh). 9 statuses. Binary → CURRENT if comparison did not change. Rename detected before file-deleted.

---

## References

- [Product Requirements Document](PRD.md) — requirements and product decisions
- [Design guide](design.md) — CSS tokens, layout, breakpoints, and accessibility
- [Domain model](domain.md) — entities, value objects, aggregates
- [Versioning](versioning.md) — SemVer, Conventional Commits, migrations

---

## Components — Diff Viewer (Inc‑5)

### GitFileDiffReader

Application port (`src/lib/server/application/git-file-diff-reader.ts`) with a
single `read()` method that receives `repositoryPath`, `comparisonType`,
`baseRef`, `targetRef`, and `relativePath`. Returns a typed `FileDiffResult`.

### SimpleGitFileDiffReader

Infrastructure implementation (`src/lib/server/infrastructure/git/simple-git-file-diff-reader.ts`).
Uses `simple-git` to execute `git diff` with paths separated by `--`. Supports
the 8 `ComparisonType` values and untracked file detection (read from
filesystem). Detects renames via fallback with `--name-status -M` when the path
filter strips rename information. Applies a hard cap of 256 KB or 5 000 lines
before parsing.

### UnifiedDiffParser

Custom parser (`src/lib/server/infrastructure/git/unified-diff-parser.ts`),
without third-party library dependencies. Handles hunk headers
(`@@ -old,count +new,count @@`), context/add/delete lines, old/new line numbers,
`\\ No newline at end of file`, rename from/to, binary detection, and
multi-hunk diffs.

### Shiki — Syntax highlighting

- `language-map.ts`: ~40 extensions mapped to Shiki languages (`BundledLanguage`).
  Unknown extension → `text`.
- `highlighter.ts`: lazy singleton with `createHighlighter({ themes: ['min-light','min-dark'], langs: [...] })`.
  Uses `codeToTokens` per line, not `codeToHtml`. Never imported in the browser
  bundle.
- `token-renderer.ts`: `escapeHtml()` + `renderTokensToHtml()` that converts
  Shiki tokens into inline spans with escaped HTML attributes. Each token's
  content passes through `escapeHtml` before being injected as `{@html}` in the
  Svelte component.

### GetFileDiffUseCase

Use case in `src/lib/server/application/services/get-file-diff-use-case.ts`.
Resolves the language from the path with `resolveLanguage()`, delegates to the
reader for the raw diff, and applies highlighting only to `context` and `added`
lines. `deleted` lines remain as plain text (`html: ''`).

### Endpoint: GET /api/workspaces/[id]/file-diff

Endpoint in `src/routes/api/workspaces/[id]/file-diff/+server.ts`. Receives
`comparison` (JSON encoded) and `path` (repo‑relative encoded). Validates
workspace, comparison, non-empty path, and rejects traversal (`/abs`, `..`, `~`,
null bytes). Uses argument arrays for Git, never shell interpolation.

### DI — workspace-services.ts

`createWorkspaceServices()` injects `SimpleGitFileDiffReader` and a
`getHighlighter()` adapter into `GetFileDiffUseCase`. The highlighter is
built as a wrapper to match the `DiffHighlighter` interface.

### Component: diff-viewer.svelte

Svelte 5 component with 7 states: placeholder (no file), loading, error with
retry, binary, empty, truncated, and rendered. Unified by default with old/new
line numbers and multi‑channel add/delete indicators. Side‑by‑side toggle only
≥900 px; forced unified below. `@html` is safe because the HTML comes from the
server already escaped. Hunk navigation with keyboard (j/k, ↑/↓), shortcut
Ctrl+Shift+D, aria‑pressed, focus‑visible, and reduced motion. No polling or
auto‑refresh.

### Integration in +page.svelte

The `selectedFile` state propagates from `GitContextPanel.onFileSelect` to
`DiffViewer` with `comparisonDraft` and `activeWorkspaceId`. No DB or URL
persistence. Main layout uses `grid-template-columns: 300px 1fr` with a
sub‑grid `grid-template-rows: auto 1fr` in the main area to stack
GitContextPanel + DiffViewer vertically.
