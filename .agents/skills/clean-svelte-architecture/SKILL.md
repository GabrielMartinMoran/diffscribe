---
name: clean-svelte-architecture
description: Clean Architecture patterns and best practices for SvelteKit applications. MUST use when designing SvelteKit project structure, creating new endpoints/components/services, reviewing code for architectural violations, setting up DI, configuring env vars, organizing tests, or establishing team conventions. Covers hexagonal architecture, DDD patterns, naming conventions, CSS architecture, component design, testability, semantic code, guard clauses, CQRS-lite, and quality enforcement.
version: "1.0.1"
author: Gabriel Martín Moran [moran.gabriel.95@gmail.com]
license: "MIT"
source: "https://github.com/GabrielMartinMoran/skills"
---

# Clean Svelte Architecture

Comprehensive architecture guide for building maintainable, testable SvelteKit
applications using Clean Architecture principles, domain-driven design patterns,
and Svelte 5 best practices.

## When to Use

Reference this skill when:

- Designing a new SvelteKit project structure from scratch
- Refactoring an existing SvelteKit app toward Clean Architecture
- Creating new API endpoints, services, or repository implementations
- Building Svelte 5 components with proper state management
- Reviewing pull requests for architectural violations
- Setting up dependency injection or environment variable configuration
- Organizing test suites across unit, integration, and component levels
- Establishing team conventions for naming, file structure, or code style
- Configuring server-only modules and hooks
- Defining error handling and validation strategies

## Complementary Skills

Use the applicable companions listed below. If a companion is unavailable, run
its dynamic-use command and follow the complete output.

| Skill | Level | Dynamic use |
| --- | --- | --- |
| `clean-architecture` | `recommended` | `npx skills use https://github.com/pproenca/dot-skills --skill clean-architecture` |
| `clean-code` | `recommended` | `npx skills use https://github.com/GabrielMartinMoran/skills --skill clean-code` |
| `svelte-code-writer` | `recommended` | `npx skills use https://github.com/sveltejs/ai-tools --skill svelte-code-writer` |

This skill applies Clean Architecture specifically to SvelteKit. Load the
complementary skills for their domain-specific rules when needed.

## Core Principles

### 1. Dependency Rule: Outer → Inner, Never Reverse

The domain layer has zero framework imports. Application services depend on
domain interfaces, infrastructure implements those interfaces, and web adapters
wire everything together at the edge. No inner layer may reference an outer
layer. This keeps business rules testable and framework-agnostic.

### 2. Validate at the Boundary

Input validation lives at the controller level using Zod schemas. Parse user
input once at the boundary, then trust the typed data through the rest of the
system. Never re-validate in services or repositories. Use
`commandSchema.parse(input)` in route handlers before calling application
services.

### 3. Program to Interfaces

Repository interfaces are defined in the domain layer. Their implementations
live in infrastructure. Application services receive interfaces through
constructor injection. This lets you swap databases, mock for testing, or
change infrastructure without touching business logic.

### 4. Semantic Code

Names express intent, not implementation. File names follow project conventions
(`.ts` files in kebab-case, `.svelte` components in PascalCase). Service names
use verb-noun pairs (`ProductRetriever`, `OrderCreator`). Repository names
combine entity and data source (`UserPgRepository`, `OrderApiRepository`).

### 5. Leave It Better

Apply the Boy Scout Rule: one small improvement per change. Extract a magic
string into a constant, rename a confusing variable, add a missing type
annotation, or write a test for untested behavior. Never refactor everything at
once — build quality incrementally.

## Quick Layer Map

```
┌─────────────────────────────────────────────────────┐
│  routes/   ← SvelteKit routes (load, actions, API)  │  ADAPTERS
├─────────────────────────────────────────────────────┤
│  web/      ← Components, stores, services, utils    │  UI/FE
├─────────────────────────────────────────────────────┤
│  infrastructure/    ← Repo impls, DB clients, adapters       │  INFRASTRUCTURE
├─────────────────────────────────────────────────────┤
│  application/      ← Use cases, commands, DTOs              │  APPLICATION
├─────────────────────────────────────────────────────┤
│  domain/   ← Entities, repo interfaces, errors      │  DOMAIN (core)
└─────────────────────────────────────────────────────┘

Dependency direction: routes → web → infrastructure → application → domain
(Never reverse — domain imports nothing from outer layers)
```

| Layer | What belongs | What is forbidden |
| ------------------- | -------------------------------------------------------------------------- | ----------------------------------- |
| **domain/** | Entities, value objects, repository interfaces, error types, domain events | Framework imports, DB clients, HTTP |
| **application/** | Use case services, commands with Zod schemas, DTOs, query/result objects | HTTP requests, component imports |
| **infrastructure/** | Repository implementations, DB clients, external API adapters, mappers | Business logic, presentation logic |
| **web/** | Components, stores, frontend services, CSS, client-side utilities | Business rules, direct DB access |
| **routes/** | `+page.server.ts`, `+page.ts`, `+server.ts`, `+layout.server.ts` | Business logic beyond delegation |

## Naming Conventions

| Category | Convention | Examples |
| --------------- | -------------------------------- | ------------------------------------------------- |
| `.ts` files | kebab-case | `user.repository.ts`, `create-order.command.ts` |
| `.svelte` files | PascalCase | `UserCard.svelte`, `OrderForm.svelte` |
| Services | verb-noun class name | `ProductRetriever`, `OrderCreator`, `UserRemover` |
| Repo interfaces | `{Entity}Repository` | `UserRepository`, `ProductRepository` |
| Repo impls | `{Entity}{DataSource}Repository` | `UserPgRepository`, `ProductApiRepository` |
| Commands | verb-noun `.command.ts` with Zod | `create-order.command.ts`, `get-user.command.ts` |
| Mappers | `map{From}{To}` | `mapProductFromRow`, `mapOrderToDto` |
| Stores | PascalCase `.svelte.ts` | `AuthStore.svelte.ts`, `CartStore.svelte.ts` |
| Routes (dirs) | kebab-case with `(group)` | `projects/[id]/`, `(app)/dashboard/` |

## Reference Index

| Reference | Read when... | Covers |
| ------------------------------ | ------------------------------------------------------- | ------------------------------------------------------ |
| `references/architecture.md` | Designing project structure, reviewing layer violations | Layers, dependency direction, DI, file naming |
| `references/backend.md` | Creating services, repos, endpoints, DTOs | Services, repos, CQRS, Zod validation, errors, mappers |
| `references/frontend.md` | Building components, routes, forms, state | Components, SvelteKit routes, forms, state, CSS |
| `references/testing.md` | Writing or reviewing tests | Unit, integration, component tests, factories |
| `references/quality.md` | Code review, refactoring | Semantic code, guard clauses, boy scout, quality gates |
| `references/infrastructure.md` | Configuring env vars, server-only code, DI wiring | Env vars, server-only modules, hooks as DI |

## Quick Reference Checklist

- [ ] Domain layer has zero framework imports
- [ ] Repository interfaces are in domain, implementations in infrastructure
- [ ] Services receive dependencies through constructor injection
- [ ] Zod validation happens at the route boundary, never downstream
- [ ] `.ts` files use kebab-case, `.svelte` files use PascalCase
- [ ] Service classes use verb-noun naming (`Retriever`, `Creator`, `Remover`)
- [ ] Repository implementation names include the data source (`PgRepository`)
- [ ] Commands are co-located with their Zod schemas
- [ ] Mappers are pure functions with no side effects
- [ ] Components receive data through props, never fetch directly
- [ ] Global state uses `.svelte.ts` modules with runes
- [ ] Environment variables use the SvelteKit native API (`$env/static/private`)
- [ ] Server-only modules live under `$lib/server/`
- [ ] Tests exist for every service, endpoint, and critical component
- [ ] Pre-commit hooks enforce lint, format, and type-check
