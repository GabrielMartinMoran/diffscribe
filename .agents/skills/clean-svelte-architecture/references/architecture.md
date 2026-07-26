# Architecture: Layers, Dependencies, and DI

## Four-Layer Structure

```
┌──────────────────────────────────────────────┐
│  Domain (domain/)                             │
│  Entities, repo interfaces, error types       │
│  → Zero imports from outer layers             │
├──────────────────────────────────────────────┤
│  Application (application/)                   │
│  Use cases, commands, DTOs, service contracts │
│  → May import from domain only                │
├──────────────────────────────────────────────┤
│  Infrastructure (infrastructure/)              │
│  Repo implementations, DB clients, mappers    │
│  → May import from domain and application     │
├──────────────────────────────────────────────┤
│  Web / Routes (web/, routes/)                 │
│  Components, stores, pages, API endpoints     │
│  → May import from any inner layer            │
└──────────────────────────────────────────────┘
```

Dependencies flow inward. No inner layer may import from an outer layer.

## Dependency Direction Rule

Every `import` statement must point toward the domain core. Violations create
tight coupling and prevent isolated testing.

### Import Rules by Layer

| Layer               | Allowed imports                                        | Forbidden imports                              |
| ------------------- | ------------------------------------------------------ | ---------------------------------------------- |
| **domain/**         | Other domain files, `zod`                              | `$app/*`, `$lib/server`, `svelte`              |
| **application/**    | domain/ files, `zod`                                   | `$app/*`, `svelte`, `infrastructure/` directly |
| **infrastructure/** | domain/, application/, external SDKs, DB drivers       | `$app/*`, `svelte` components                  |
| **web/**            | domain/, application/, infrastructure/ via DI, $app/\* | Direct DB clients in components                |
| **routes/**         | Everything, plus `$env/*`                              | Business logic mixed with HTTP handling        |

### Example: Valid vs Invalid Import

```typescript
// ✅ VALID: infrastructure imports domain interface
import type { UserRepository } from '$lib/api/domain/repositories/user.repository';

// ✅ VALID: application imports domain interface
import type { ProductRepository } from '$lib/api/domain/repositories/product.repository';

// ❌ INVALID: domain imports framework
import { env } from '$env/static/private'; // NEVER in domain/

// ❌ INVALID: infrastructure imports Svelte component
import UserCard from '$lib/web/components/UserCard.svelte'; // NEVER in infrastructure/
```

## Constructor Dependency Injection

All application services receive their dependencies through the constructor.
No service instantiates its own dependencies.

### Pattern

```typescript
// Domain: repository interface
export interface UserRepository {
    findById(id: string): Promise<User | null>;
    save(user: User): Promise<void>;
}

// Application: service with constructor DI
export class UserCreator {
    constructor(
        private readonly userRepository: UserRepository,
        private readonly emailValidator: EmailValidator
    ) {}

    async create(command: CreateUserCommand): Promise<User> {
        // business logic here
    }
}

// Infrastructure: implementation
export class UserPgRepository implements UserRepository {
    constructor(private readonly db: DatabaseClient) {}

    async findById(id: string): Promise<User | null> {
        // SQL query
    }

    async save(user: User): Promise<void> {
        // SQL insert/update
    }
}
```

## File Naming Conventions

| Extension    | Convention | Rationale                                              |
| ------------ | ---------- | ------------------------------------------------------ |
| `.ts`        | kebab-case | Matches module resolution, readable in URLs/imports    |
| `.svelte`    | PascalCase | Convention in Svelte ecosystem, matches component name |
| `.server.ts` | kebab-case | Distinguishes server-only modules                      |
| `.svelte.ts` | PascalCase | Rune-based stores, treated as modules                  |

### Examples

```
domain/
  repositories/
    user.repository.ts          ← kebab-case .ts
  errors/
    not-found.error.ts          ← kebab-case .ts

application/
  services/
    user-creator.service.ts     ← kebab-case .ts
  dto/
    commands/
      create-user.command.ts    ← kebab-case .ts

infrastructure/
  repositories/
    user-pg.repository.ts       ← kebab-case, data source in name

web/
  components/
    UserCard.svelte             ← PascalCase .svelte
  stores/
    AuthStore.svelte.ts          ← PascalCase .svelte.ts
```

## SvelteKit Routes as Adapters

SvelteKit route files serve as the outermost adapter layer. They delegate to
application services and never contain business logic.

| Route File          | Role                                           |
| ------------------- | ---------------------------------------------- |
| `+page.server.ts`   | Load data via `load()`, handle form `actions`  |
| `+page.ts`          | Client-side data loading (rare, prefer server) |
| `+server.ts`        | REST API endpoints (GET, POST, PUT, DELETE)    |
| `+layout.server.ts` | Global data (session, navigation)              |

### Route Handler Pattern

```typescript
// +page.server.ts
import { buildEndpoint } from '$lib/api/infrastructure/utils/build-endpoint';
import { CreateProductCommand } from '$lib/api/application/dto/commands/create-product.command';
import { ProductCreator } from '$lib/api/application/services/product-creator.service';

export const load = async event => {
    const products = await productRetriever.list(event.locals.user);
    return { products };
};

export const actions = {
    create: async event => {
        const formData = await event.request.formData();
        const command = CreateProductCommand.parse(Object.fromEntries(formData));
        await productCreator.create(command, event.locals.user);
    },
};
```

## Common Anti-Patterns

| Anti-Pattern                          | Violation                             | Fix                                   |
| ------------------------------------- | ------------------------------------- | ------------------------------------- |
| Domain entity imports `$env/*`        | Dependency rule (inner → outer)       | Pass config via constructor or method |
| Service instantiates repository       | Tight coupling, untestable            | Use constructor DI                    |
| Component calls DB directly           | Layer bypass, coupling                | Delegate to service via route handler |
| `+page.ts` fetches from internal API  | Unnecessary network hop               | Use `+page.server.ts` load            |
| Barrel files at every directory level | Hidden dependencies, circular imports | Direct imports, minimal barrels       |
