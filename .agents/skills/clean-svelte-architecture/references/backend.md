# Backend: Services, Repositories, Validation, and Mappers

## Service Naming

Application services follow a verb-noun naming convention using a curated set of
suffixes. Each suffix communicates the service's single responsibility. Here there are some examples of common suffixes and their responsibilities:

| Suffix | Responsibility | Example |
| --------------- | ------------------------------------ | ----------------------------------------- |
| `Retriever` | Fetch data by criteria (read) | `ProductRetriever`, `UserRetriever` |
| `Creator` | Create new entities (write) | `OrderCreator`, `InvoiceCreator` |
| `Remover` | Delete/archive entities (write) | `UserRemover`, `SessionRemover` |
| `Editor` | Update existing entities (write) | `ProfileEditor`, `SettingsEditor` |
| `Modifier` | Apply a specific mutation (write) | `PasswordModifier`, `StatusModifier` |
| `Validator` | Check business rules (read, boolean) | `EmailValidator`, `CouponValidator` |
| `Generator` | Produce derived values (read) | `TokenGenerator`, `ReportGenerator` |
| `Authenticator` | Verify identity (read) | `UserAuthenticator`, `TokenAuthenticator` |
| `Synchronizer` | Reconcile two data sources (write) | `InventorySynchronizer` |

### Service Class Pattern

```typescript
export class ProductCreator {
  constructor(
    private readonly productRepo: ProductRepository,
    private readonly categoryRepo: CategoryRepository,
  ) {}

  async create(command: CreateProductCommand, user: User): Promise<Product> {
    const category = await this.categoryRepo.findById(command.categoryId);
    if (!category) {
      throw new NotFoundError(`Category ${command.categoryId} not found`);
    }
    const product = new Product({
      id: crypto.randomUUID(),
      name: command.name,
      categoryId: category.id,
      createdBy: user.id,
    });
    await this.productRepo.save(product);
    return product;
  }
}
```

### Dependency Injection in Services

Application services must receive all their dependencies through the constructor. They must never instantiate repositories, API clients, or other services themselves.

**Rules:**

- **Constructor injection only.** Every dependency is declared as a constructor parameter. The service never calls `new` on a dependency.
- **Depend on interfaces, not implementations.** The constructor parameter type is the domain repository interface (e.g., `ProductRepository`), never the concrete class (`ProductPgRepository`).
- **No service locators.** Don't use global singletons, static factories, or container.resolve() inside services. Every dependency is explicit in the constructor signature.
- **Wiring happens at the composition root.** The concrete implementations are instantiated and injected in `hooks.server.ts` (see `references/infrastructure.md`). Services never know about the infrastructure layer.

```typescript
// ✅ CORRECT: constructor receives interfaces
export class ProductCreator {
  constructor(
    private readonly productRepo: ProductRepository,
    private readonly categoryRepo: CategoryRepository,
  ) {}

  async execute(command: CreateProductCommand): Promise<Product> {
    // Use the injected repos — never instantiate them
  }
}

// ❌ WRONG: service instantiates its own dependency
export class BadProductCreator {
  async execute(command: CreateProductCommand): Promise<Product> {
    const repo = new ProductPgRepository(db); // NEVER do this
  }
}
```

**Why this matters:**

- **Testability**: you can inject mock repositories in tests without touching the database.
- **Swapability**: change from PostgreSQL to an external API by writing a new implementation — the service doesn't change.
- **Explicit contracts**: the constructor signature documents every dependency the service needs.

## Repository Naming

Repository contracts are defined in the domain layer. Implementations live in
infrastructure and include the data source in their name.

| Type | Pattern | Example |
| ------------------ | ---------------------------- | ------------------------ |
| Interface (domain) | `{Entity}Repository` | `UserRepository` |
| PostgreSQL impl | `{Entity}PgRepository` | `UserPgRepository` |
| External API impl | `{Entity}ApiRepository` | `PaymentApiRepository` |
| In-memory impl | `{Entity}InMemoryRepository` | `UserInMemoryRepository` |

### Repository Contracts

Repository methods accept only primitives or domain models. Never pass raw HTTP
request objects, framework-specific types, or database row types.

```typescript
// ✅ CORRECT: primitives and domain types
export interface OrderRepository {
  findById(id: string): Promise<Order | null>;
  findByUser(userId: string): Promise<Order[]>;
  save(order: Order): Promise<void>;
}

// ❌ INCORRECT: framework or infrastructure types
export interface OrderRepository {
  findById(id: string): Promise<OrderRow>; // Row type is infrastructure
  findByUser(request: RequestEvent): Promise<Order[]>; // Framework type
}
```

### Implementation Example

```typescript
export class OrderPgRepository implements OrderRepository {
  constructor(private readonly db: DatabaseClient) {}

  async findById(id: string): Promise<Order | null> {
    const row = await this.db
      .selectFrom("orders")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    if (!row) return null;
    return mapOrderFromRow(row);
  }

  async save(order: Order): Promise<void> {
    const row = mapOrderToRow(order);
    await this.db
      .insertInto("orders")
      .values(row)
      .onConflict((oc) => oc.column("id").doUpdateSet(row))
      .execute();
  }
}
```

## Commands and Results (CQRS-lite)

Commands represent the input to a use case. Each command file contains both the
Zod schema and the inferred TypeScript type.

### Command File Structure

```typescript
// create-product.command.ts
import { z } from "zod";

export const CreateProductCommand = z.object({
  name: z.string().min(1, "Product name is required"),
  price: z.number().positive("Price must be positive"),
  categoryId: z.string().uuid("Invalid category ID"),
});

export type CreateProductCommand = z.infer<typeof CreateProductCommand>;
```

### Command Naming Convention

| Verb | Prefix | HTTP Method | Example |
| ------ | --------- | ----------- | --------------------------- |
| List | `list-` | GET | `list-products.command.ts` |
| Get | `get-` | GET | `get-product.command.ts` |
| Create | `create-` | POST | `create-product.command.ts` |
| Update | `update-` | PUT | `update-product.command.ts` |
| Delete | `delete-` | DELETE | `delete-product.command.ts` |

### Why Simplified CQRS

Full CQRS with separate read/write models adds complexity without proportional
benefit in most SvelteKit applications. The simplified approach keeps commands
(input validation) and results (output types) distinct while sharing the same
domain models. Graduate to full CQRS only when read and write patterns diverge
significantly.

## Zod at the Controller Boundary

Validation happens once, at the boundary, before any business logic executes.

```
User Input → [Zod Validation] → Typed Command → Service → Domain
                ↑
          Parse once here.
          Trust the type downstream.
```

### Boundary Validation Pattern

```typescript
// +server.ts or +page.server.ts action
import { buildEndpoint } from "$lib/api/infrastructure/utils/build-endpoint";
import { CreateProductCommand } from "$lib/api/application/dto/commands/create-product.command";

export const POST = buildEndpoint({
  requiresAuth: true,
  schema: CreateProductCommand, // Zod validation happens here
  handler: async (command, { user }) => {
    // command is already validated and typed
    const product = await productCreator.create(command, user);
    return { productId: product.id };
  },
});
```

### Manual Validation Pattern (without builder)

```typescript
export const actions = {
  create: async (event) => {
    const raw = Object.fromEntries(await event.request.formData());
    const command = CreateProductCommand.parse(raw); // throws ZodError on failure
    await productCreator.create(command, event.locals.user);
  },
};
```

## Semantic Error Handling

Errors communicate meaning, not implementation details. The domain layer defines
error codes; infrastructure maps them to HTTP status codes.

### Error Hierarchy

```typescript
// domain/errors/app-error.ts
export type AppErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "CONFLICT"
  | "INTERNAL";

export class AppError extends Error {
  constructor(
    public readonly code: AppErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

// domain/errors/not-found.error.ts
export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super("NOT_FOUND", message);
    this.name = "NotFoundError";
  }
}
```

### HTTP Status Mapping

| Error Class | Code | HTTP Status |
| ------------------- | -------------- | ----------- |
| `UnauthorizedError` | `UNAUTHORIZED` | 401 |
| `ForbiddenError` | `FORBIDDEN` | 403 |
| `NotFoundError` | `NOT_FOUND` | 404 |
| `ValidationError` | `VALIDATION` | 400 |
| `ConflictError` | `CONFLICT` | 409 |
| `InternalError` | `INTERNAL` | 500 |

### Throwing and Handling

```typescript
// In service: throw semantic error
async findById(id: string): Promise<Product> {
    const product = await this.productRepo.findById(id);
    if (!product) {
        throw new NotFoundError(`Product ${id} not found`);
    }
    return product;
}

// In route handler: errors are caught by the builder and mapped to HTTP status
export const GET = buildEndpoint({
    requiresAuth: true,
    schema: GetProductCommand,
    source: 'params',
    handler: async (command) => {
        return productRetriever.get(command.productId);
        // If NotFoundError is thrown, builder responds with 404
    },
});
```

## Mappers

Mappers are pure functions that translate between layers. They have no side
effects and no dependencies.

### Naming Convention

| Direction | Pattern | Example |
| ------------ | -------------------- | ------------------- |
| DB → Domain | `map{Entity}FromRow` | `mapProductFromRow` |
| Domain → DB | `map{Entity}ToRow` | `mapProductToRow` |
| Domain → DTO | `map{Entity}ToDto` | `mapProductToDto` |

### Mapper Implementation

```typescript
// infrastructure/mappers/product.mapper.ts

import type { Product } from "$lib/api/domain/models/product";
import type { ProductRow } from "./types";

export function mapProductFromRow(row: ProductRow): Product {
  return new Product({
    id: row.id,
    name: row.name,
    price: row.price_cents / 100, // snake_case → camelCase + transform
    categoryId: row.category_id,
    createdAt: new Date(row.created_at),
  });
}

export function mapProductToRow(product: Product): ProductRow {
  return {
    id: product.id,
    name: product.name,
    price_cents: Math.round(product.price * 100),
    category_id: product.categoryId,
    created_at: product.createdAt.toISOString(),
  };
}
```

## Barrel File Caution

Avoid deep `index.ts` re-export chains. They cause circular dependency risks,
slow TypeScript compilation, and make code navigation harder.

```typescript
// ❌ AVOID: barrel files that re-export everything
// domain/index.ts
export * from "./models/user";
export * from "./models/product";
export * from "./repositories/user.repository";
// ... 20 more re-exports

// ✅ PREFER: direct imports
import type { UserRepository } from "$lib/api/domain/repositories/user.repository";
```

Use barrel files sparingly, only for stable public APIs of a module with clear
boundaries.
