# Testing: Unit, Integration, Component, and Factories

## Test Organization

```
tests/
├── unit/              # Services, mappers, utilities
│   └── *.spec.ts
├── integration/       # Endpoints, route handlers
│   └── *.spec.ts
├── helpers/           # Factories, fixtures, utilities
│   └── factories.ts
│   └── db-utils.ts
└── setup/             # Global config, hooks
    ├── global-setup.ts
    ├── worker-setup.ts
    └── tests-config.ts
```

## Unit Tests for Services

Unit tests verify application services in isolation. Mock repository interfaces
to test business logic without a database.

### Pattern: Arrange, Act, Assert

```typescript
import { describe, it, expect, vi } from 'vitest';
import { ProductCreator } from '$lib/api/application/services/product-creator.service';
import type { ProductRepository } from '$lib/api/domain/repositories/product.repository';
import type { CategoryRepository } from '$lib/api/domain/repositories/category.repository';
import { NotFoundError } from '$lib/api/domain/errors/not-found.error';

describe('ProductCreator', () => {
    it('creates a product when category exists', async () => {
        // Arrange
        const productRepo = { save: vi.fn() } as unknown as ProductRepository;
        const categoryRepo = {
            findById: vi.fn().mockResolvedValue({ id: 'cat-1', name: 'Books' }),
        } as unknown as CategoryRepository;
        const creator = new ProductCreator(productRepo, categoryRepo);
        const command = { name: 'Clean Code', price: 29.99, categoryId: 'cat-1' };

        // Act
        const product = await creator.create(command, aUser());

        // Assert
        expect(product.name).toBe('Clean Code');
        expect(productRepo.save).toHaveBeenCalledOnce();
    });

    it('throws NotFoundError when category does not exist', async () => {
        // Arrange
        const productRepo = { save: vi.fn() } as unknown as ProductRepository;
        const categoryRepo = {
            findById: vi.fn().mockResolvedValue(null),
        } as unknown as CategoryRepository;
        const creator = new ProductCreator(productRepo, categoryRepo);

        // Act & Assert
        await expect(creator.create({ name: 'X', price: 1, categoryId: 'missing' }, aUser())).rejects.toThrow(
            NotFoundError
        );
    });
});
```

## Integration Tests for Endpoints

Integration tests exercise HTTP endpoints through the full stack. They test the
boundary where Zod validation, auth, and response formatting occur.

### Test Setup

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

describe('POST /api/products', () => {
    let app: App;

    beforeAll(async () => {
        app = await createTestApp(); // Setup with test DB, DI container
    });

    afterAll(async () => {
        await cleanDatabase(); // Teardown
    });

    it('creates a product and returns 201', async () => {
        const response = await app.request('/api/products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: authHeader(aUser()) },
            body: JSON.stringify({ name: 'Widget', price: 9.99, categoryId: 'cat-1' }),
        });

        expect(response.status).toBe(201);
        const body = await response.json();
        expect(body.productId).toBeDefined();
    });

    it('returns 400 when price is negative', async () => {
        const response = await app.request('/api/products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: authHeader(aUser()) },
            body: JSON.stringify({ name: 'Widget', price: -5, categoryId: 'cat-1' }),
        });

        expect(response.status).toBe(400);
    });

    it('returns 401 when not authenticated', async () => {
        const response = await app.request('/api/products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'Widget', price: 9.99, categoryId: 'cat-1' }),
        });

        expect(response.status).toBe(401);
    });
});
```

## Component Testing

Component tests verify rendering, user interactions, and event handling using
Svelte Testing Library.

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import ProductCard from '$lib/web/components/ProductCard.svelte';

describe('ProductCard', () => {
    const product = {
        id: 'prod-1',
        name: 'Widget',
        price: 9.99,
    };

    it('renders product name and price', () => {
        render(ProductCard, {
            props: { product, onDelete: vi.fn() },
        });

        expect(screen.getByText('Widget')).toBeInTheDocument();
        expect(screen.getByText('$9.99')).toBeInTheDocument();
    });

    it('calls onDelete when delete button is clicked', async () => {
        const onDelete = vi.fn();
        render(ProductCard, {
            props: { product, onDelete },
        });

        await fireEvent.click(screen.getByRole('button', { name: /delete/i }));

        expect(onDelete).toHaveBeenCalledWith('prod-1');
    });
});
```

## Test Data Factories

Factories create test data with sensible defaults that can be overridden per
test. Use a builder pattern for composability.

```typescript
// tests/helpers/factories.ts
import type { User } from '$lib/api/domain/models/user';
import type { Product } from '$lib/api/domain/models/product';

export function aUser(overrides: Partial<User> = {}): User {
    return {
        id: 'user-1',
        name: 'Test User',
        email: 'test@example.com',
        ...overrides,
    };
}

export function aProduct(overrides: Partial<Product> = {}): Product {
    return {
        id: 'prod-1',
        name: 'Test Product',
        price: 19.99,
        categoryId: 'cat-1',
        ...overrides,
    };
}
```

### Factory Usage

```typescript
it('flags products over max price', () => {
    const expensiveProduct = aProduct({ price: 10000 });
    const result = priceValidator.isOverMax(expensiveProduct, 5000);
    expect(result).toBe(true);
});

it('sends notification to user', async () => {
    const admin = aUser({ id: 'admin-1', role: 'admin' });
    await notificationService.notify(admin, 'New product added');
});
```

## Coverage Expectations

| Change Type             | Minimum Tests                                     |
| ----------------------- | ------------------------------------------------- |
| New service             | Unit test: happy path + 2 error paths             |
| New endpoint            | Integration test: auth, validation, success paths |
| New component (feature) | Component test: render + key interactions         |
| New repository impl     | Integration test against real or test DB          |
| New mapper              | Unit test: round-trip (domain → row → domain)     |
| Bug fix                 | Regression test proving the bug existed           |

## Test Stubs (Object Mother / Builder Pattern)

A _stub_ or _Object Mother_ is a factory function that produces fully-valid test
objects where you pass only the properties you care about. All other fields
receive sensible, realistic defaults. This keeps tests focused on the behavior
under test and eliminates distracting setup boilerplate.

A regular factory might require every field to be explicitly specified. A stub
factory auto-fills with valid defaults so tests specify only what matters to
the assertion.

### Stub Example

Create one stub per domain entity in `tests/helpers/stubs.ts` (or per-module
stub files for larger domains):

```typescript
// tests/helpers/stubs.ts
export function aUser(overrides?: Partial<User>): User {
    return {
        id: crypto.randomUUID(),
        email: 'test@example.com',
        name: 'Test User',
        role: 'member',
        createdAt: new Date(),
        ...overrides,
    };
}

// Usage — only specify what matters
const adminUser = aUser({ role: 'admin' });
const specificUser = aUser({ email: 'john@example.com', name: 'John' });
```

### Nested Entities

Stubs compose naturally for aggregates. Build child stubs and pass them as
overrides:

```typescript
const order = anOrder({
    items: [anOrderItem({ productId: 'prod-1' }), anOrderItem({ quantity: 3 })],
});
```

### Key Practices

- **One stub per domain entity** — keeps test data predictable and discoverable.
- **Defaults must be valid** — every default value must pass the entity's
  validation rules. Use realistic values (real emails, valid UUIDs, sensible
  prices).
- **Use `Partial<>` for overrides** — the `overrides` parameter is always
  `Partial<T>` so callers only specify what they change.
- **Place in `tests/helpers/stubs.ts`** — or co-locate in per-module
  `__tests__/stubs.ts` files for larger domains.
- **Never random values** — use fixed defaults. Tests must be deterministic;
  random data produces flaky tests.
