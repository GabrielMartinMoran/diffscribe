# DiffScribe — Versioning

**Status:** Initial draft

This document defines DiffScribe's versioning policy: version numbering, public
API, commit messages, releases, and migrations.

---

## Adopted standards

| Standard               | Version | Applies to                                       |
| ---------------------- | ------- | ------------------------------------------------ |
| SemVer                 | 2.0.0   | Release numbering                                |
| Conventional Commits   | 1.0.0   | Commit messages                                  |
| Keep a Changelog       | 1.1.0   | Change log (`docs/changelog.md`)                 |

---

## Semantic Versioning 2.0.0

DiffScribe follows SemVer 2.0.0. Given a version `MAJOR.MINOR.PATCH`:

- **MAJOR:** incompatible changes to the public API.
- **MINOR:** new backward-compatible functionality.
- **PATCH:** backward-compatible bug fixes.

### Initial version

The project starts at `0.x`:

- `0.1.0` — first functional release (review workbench, Stage 1).
- `0.x.y` — subsequent iterations within the pre-1.0 phase.
- During `0.x`, MINOR may include breaking changes. PATCH only includes
  compatible fixes.
- `1.0.0` — first stable version with frozen public API.

### Pre-releases

The SemVer suffix is used for pre-releases:

```text
0.1.0-alpha.1
0.1.0-beta.1
0.1.0-rc.1
```

The `alpha`, `beta`, and `rc` suffixes indicate increasing maturity. Build
metadata (`+`) is not used unless a CI tool requires it.

---

## Public API

DiffScribe's public API includes everything whose change would break backward
compatibility for users:

### Command-line interface (CLI)

- The `diffscribe` command and its flags (`--port`, `--host`, `--open`, path).
- Changing, removing, or renaming an existing flag is breaking.
- Adding a new flag is MINOR.

### Export formats

- **Markdown:** review package structure in Markdown. Changes that break tools
  that parse this format are breaking.
- **JSON:** review package schema in JSON. Schema changes that remove fields,
  change types, or modify array/object structure are breaking. Adding new
  fields is MINOR.

### Database schema

- The SQLite schema (`~/.diffscribe/diffscribe.db`) is part of the internal
  public API. Migrations must maintain backward compatibility within the same
  major version.
- See "SQLite migrations" section below.

### Local HTTP (when applicable)

- Endpoints, methods, and request/response formats of the local server.
  Currently not exposed as a stable API; will be documented when applicable.

---

## Conventional Commits 1.0.0

Every commit must follow Conventional Commits 1.0.0:

```text
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Types

| Type        | Use                                                       | SemVer impact        |
| ----------- | --------------------------------------------------------- | -------------------- |
| `feat`      | New functionality                                         | MINOR (0.x)          |
| `fix`       | Bug fix                                                   | PATCH                |
| `breaking`  | Breaking change (use `!` after type/scope)                | MAJOR (0.x: MINOR)   |
| `docs`      | Documentation                                             | None                 |
| `style`     | Format, whitespace (no logic changes)                     | None                 |
| `refactor`  | Refactor without behavior change or fix                   | None                 |
| `perf`      | Performance improvement                                   | PATCH (if it is a fix) |
| `test`      | Add or fix tests                                          | None                 |
| `chore`     | Build tasks, CI, dependencies                             | None                 |
| `ci`        | CI/CD configuration changes                               | None                 |
| `build`     | Build system or external dependency changes               | None                 |
| `revert`    | Revert a previous commit                                  | Variable             |

### Breaking changes

A breaking change is indicated in two equivalent ways:

```text
feat!: remove deprecated export flag
```

or

```text
feat: remove deprecated export flag

BREAKING CHANGE: The --export flag has been removed. Use --output instead.
```

The `BREAKING CHANGE` footer must describe what broke and how to migrate.

### Scope

The scope is optional. When used, it must refer to a project module or area:

```text
feat(git): support commit-range comparison
fix(export): handle empty observation list
chore(deps): bump better-sqlite3 to v11
```

### Examples

```text
feat: add workspace selector sidebar
fix: correct line number offset in unified diff
feat(observations)!: rename severity 'warning' to 'major'
chore: configure GitHub Actions CI pipeline
docs: document comparison types in domain model
```

---

## Releases

### Tags

Each release is marked with an annotated Git tag:

```bash
git tag -a v0.1.0 -m "v0.1.0"
```

The tag follows the format `v<MAJOR>.<MINOR>.<PATCH>` without additional
prefixes.

### Process

1. Update `docs/changelog.md` by moving changes from `[Unreleased]` to the
   new version.
2. Update `package.json` with the new version.
3. Create commit: `chore(release): v0.1.0`.
4. Create tag: `git tag -a v0.1.0 -m "v0.1.0"`.
5. Push: `git push --follow-tags`.
6. Publish to npm: `npm publish`.

### Frequency

No fixed cadence is defined. Releases are created when there are enough changes
to justify a new version. During `0.x`, frequent releases are preferred to get
early feedback.

---

## SQLite migrations

### Principles

- Migrations are incremental and sequentially numbered.
- Each migration is applied exactly once.
- Migrations must be backward compatible within the same major version.
- During `0.x`, migrations may be breaking between MINOR versions (consistent
  with SemVer for the `0.x` phase). This must be documented in the changelog.

### Strategy

Migrations are stored as SQL files in
`src/lib/server/infrastructure/database/migrations/`. Each file follows the
pattern:

```text
001_create_workspaces.sql
002_app_state.sql
003_create_reviews.sql
004_create_review_files.sql
```

The loader (`connection.ts`) uses
`import.meta.glob('./migrations/*.sql', { eager: true, query: '?raw', import: 'default' })`
to load and sort the files. Each migration runs inside `db.transaction()` to
guarantee atomicity. The `_migrations` table records applied migrations:

```sql
CREATE TABLE IF NOT EXISTS _migrations (
  name TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

`PRAGMA foreign_keys = ON` is activated in production and test connections so
that FK CASCADE is effective.

### Compatibility

The compatibility contract is:

- **Same MAJOR:** the new application can open a database created by a previous
  version of the same MAJOR.
- **Different MAJOR:** may require manual migration, data export/import, or an
  explicit migration tool.

During `0.x`, since MINOR may include breaking changes, it is recommended to
back up data before upgrading between MINOR versions.

### Rollback

Automatic migration rollback is not supported. If a migration fails, the
application does not start and reports the error. The user must resolve the
problem manually or restore a backup.

### Destructive migrations

During `0.x`, migrations may be breaking between MINOR versions (consistent
with SemVer for the `0.x` phase). Destructive migrations delete data and must
be called out explicitly:

- **`006_drop_observation_title_require_body` (2026-08-01):** removes the
  `title` column from `observations` and deletes rows whose `body` is empty or
  whitespace-only. The body becomes the single mandatory description field
  (1..5000 characters, `CHECK (length(trim(body)) > 0)` at the DB level).
  `reviews.title` is untouched.
- **Backup requirement:** before upgrading to a release that includes a
  destructive migration, back up `~/.diffscribe/diffscribe.db` (or the
  configured `DIFFSCRIBE_DB_DIR`). The migration is atomic: if it fails, the
  whole transaction rolls back and `_migrations` is not updated.

---

## References

- [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html)
- [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/)
- [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/)
- [Changelog](changelog.md) — change log
