# DiffScribe — AGENTS.md

Every agent working on this repository must read this document before touching
code. It defines the project rules, the source-of-truth documents, and the
required skills.

---

## Source documentation

These documents contain the current truth of the project. Every agent must
consult them before implementing, reviewing, or planning:

- [Product Requirements Document](docs/PRD.md) — product requirements,
  core concepts, stages, and decisions made
- [Architecture](docs/architecture.md) — stack, layers, data flow,
  architectural decisions, and CI/QA
- [Design guide](docs/design.md) — CSS tokens, layout, breakpoints,
  responsive, accessibility, and visual validation
- [Domain model](docs/domain.md) — ubiquitous language, entities, value
  objects, aggregates, repositories, and open decisions
- [Versioning](docs/versioning.md) — SemVer, Conventional Commits, releases,
  and migrations
- [Changelog](docs/changelog.md) — change log following Keep a Changelog

---

## Living documentation

Every type of change has a canonical document that must be updated:

| Change                                    | Document to update        |
| ----------------------------------------- | ------------------------- |
| New product decision or stage             | `docs/PRD.md`             |
| Change in stack, layers, CI, or boundaries| `docs/architecture.md`    |
| New token, breakpoint, or visual rule     | `docs/design.md`          |
| New entity, aggregate, or invariant       | `docs/domain.md`          |
| Release, breaking change, or new version  | `docs/versioning.md`      |
| Change released in a version              | `docs/changelog.md`       |
| New skill, rule, or agent process         | `AGENTS.md`               |

Documentation is maintained in English. Technical terms, commands, paths,
script names, and APIs are written in English as is standard in the project.

---

## Required local skills

Every agent must load the following skills from the repository before touching
code. The path of each skill is relative to the project root:

1. [clean-backend-architecture](.agents/skills/clean-backend-architecture/SKILL.md)
2. [clean-code](.agents/skills/clean-code/SKILL.md)
3. [clean-svelte-architecture](.agents/skills/clean-svelte-architecture/SKILL.md)
4. [frontend-design](.agents/skills/frontend-design/SKILL.md)
5. [svelte-code-writer](.agents/skills/svelte-code-writer/SKILL.md)

The agent must load only the skills applicable to its task. Non-applicable
skills can be omitted, but those that apply are mandatory.

---

## NAS process (IADEV)

DiffScribe uses the NAS pipeline with IADEV subagents. The relevant global
skills describe each phase of the process. These skills do not become local
repository skills; they are loaded from the global environment configuration:

### BDD-first

All new behavior must be specified in Gherkin before implementation. `.feature`
files are stored in `specs/features/`. The BDD runner is quickpickle, which
reads `.feature` files directly and runs them with Vitest.

The `IADEV-bdd-implementation` skill defines how to consume `.feature`
specifications and turn them into executable tests. The
`IADEV-writing-gherkin` skill establishes syntax rules and best practices for
writing scenarios.

The planner and developer consume the features as the acceptance contract. No
production code is written without a Gherkin scenario that specifies it.

### BDD language convention

All `.feature` files under `specs/features/` and step definitions under
`tests/steps/` are written in English. This rule applies to both existing
scenarios and any new scenarios. The static guard `check:bdd-language`
(defined in `scripts/check-bdd-language.mjs`) runs as part of the QA chain
and detects Spanish text (diacritics and curated wordlist) in Gherkin patterns
and step definition comments.

The general documentation (`docs/`, `AGENTS.md`) is maintained in English.
Technical terms, commands, paths, script names, and APIs are written in
English as is standard in the project.

### TDD (Red → Green → Refactor)

All production code must be backed by tests written before implementation. The
cycle is strict:

1. **Red:** write a failing test.
2. **Green:** write the minimum code to make it pass.
3. **Refactor:** improve the code without changing behavior.

The `IADEV-test-driven-development` skill defines the TDD discipline that every
developer must follow. No change is considered complete without a fresh
verification that all tests pass.

### Validation and QA

The `IADEV-validating-implementation` skill defines the Tester's protocol to
audit the Developer's work against the OpenSpec artifacts, re-run tests, and
emit `validation-results.md` with PASS/FAIL findings.

The `IADEV-applying-feedback` skill defines how the Developer consumes that
report and turns each FAIL into a concrete fix backed by a test.

---

## QA hard gate

No change is considered complete if any of these verifications fail. Any
failure means `FAIL`. The `npm run qa` command runs all verifications in
order. If one stage fails, the following stages do not run.

| Stage        | Command                        | Criterion                 |
| ------------ | ------------------------------ | ------------------------- |
| Format       | `npm run format`               | No differences            |
| Lint         | `npm run lint`                 | `--max-warnings=0`        |
| Types        | `npm run check` or equivalent  | No type errors            |
| Unit         | `npm run test:unit`            | 100% passing              |
| Integ.       | `npm run test:integration`     | 100% passing              |
| BDD language | `npm run check:bdd-language`   | No Spanish in BDD         |
| BDD          | `npm run test:bdd`             | 100% passing              |
| E2E          | `npm run test:e2e`             | 100% passing              |
| Build        | `npm run build`                | Successful build, no errors |

Prettier handles formatting. ESLint with flat config manages linting, import
order (`simple-import-sort`), structure (`import-x`), and unused import
cleanup (`eslint-plugin-unused-imports`). Prettier and ESLint are kept
separate via `eslint-config-prettier/flat`. The developer can use
`npm run format:fix` and `npm run lint:fix` locally; QA only verifies without
`--fix`.

### Format failure protocol

If `npm run format` fails — whether during the pre-commit hook, manual QA, or
CI —, the first mandatory step is to run the autofix:

```bash
npm run format:fix
```

After the autofix, the agent must:

1. Review the generated diff (`git diff`) to confirm that the changes are
   formatting-only and do not alter logic.
2. Re-run `npm run format`. It must pass with zero differences.
3. Re-stage the modified files (`git add <files>`).
4. Continue with `npm run lint` and the rest of the QA verification.

The pre-commit hook must **never** be modified to run `format:fix` or `--fix`.
The hook is and will remain check-only: `npm run format && npm run lint`.

---

## Clean Architecture

The project follows Clean Architecture combining Clean Backend Architecture and
Clean Svelte Architecture. Layer boundaries are strict:

| Layer              | Own                                                                       | Forbidden                               |
| ------------------ | ------------------------------------------------------------------------- | --------------------------------------- |
| `domain`           | Entities, value objects, repository interfaces, domain errors             | Frameworks, HTTP, DB, vendor SDKs       |
| `application`      | Use cases, commands, queries, DTOs, results                               | Transport, persistence, UI components   |
| `infrastructure`   | Repository implementations, mappers, SQL, Git clients, gateways           | Business logic, product decisions       |
| `web` (or routes)  | Svelte components, stores, endpoints, HTTP handlers                       | Business rules, direct DB access        |

Dependencies point inward: `web → infrastructure → application → domain`. The
domain imports nothing from outer layers. Repository interfaces are defined in
`domain/repositories/`. Concrete implementations and mappers live in
`infrastructure/repositories/`.

---

## Stage 1 boundaries

Stage 1 delivers the review workbench without AI. The scope is defined in
`docs/PRD.md` §18. Every agent must respect these boundaries:

- Do not implement Stage 2, 3, or 4 features.
- Do not anticipate integrations with AI providers.
- Do not add collaborative, multi-user, or network capabilities.
- Do not implement auto-fix, code modification, or commit creation.

### Scope creep

If a task, suggestion, or discovery involves functionality outside the current
Stage 1, the agent must:

1. Log the finding without implementing it.
2. Report it to the Orchestrator.
3. Not modify code or documentation to accommodate it.

It is forbidden to invent architecture, product, design, or domain decisions
not backed by source documents or an approved memory. Open questions from
PRD §21 must be treated as `[PENDIENTE]`.

---

## Versioning and commits

The project follows:

- **SemVer 2.0.0** — semantic versioning for the public API (CLI, export
  JSON/Markdown, DB schema, local HTTP).
- **Conventional Commits 1.0.0** — structured commit messages with types
  `feat`, `fix`, `breaking`, and optional scope.
- **Keep a Changelog 1.1.0** — human-maintained changelog in
  `docs/changelog.md`.

The initial version is `0.x`. Releases are created with Git tags. SQLite
migrations must maintain backward compatibility within the same major version.

See `docs/versioning.md` for the full policy and `docs/changelog.md` for the
change log.
