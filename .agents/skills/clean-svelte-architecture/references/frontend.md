# Frontend: Components, Routes, Forms, and State

## Component Categories

Organize components by responsibility. Each category has a distinct role in the
rendering pipeline. A sub-directory structure is recommended for clarity as the number of components grows.

| Category         | Directory                        | Responsibility                         | Example                                           |
| ---------------- | -------------------------------- | -------------------------------------- | ------------------------------------------------- |
| **Page**         | `routes/`                        | Orchestrate page-level data and layout | `routes/products/+page.svelte`                    |
| **Feature**      | `web/components/<feature>/` | Domain-specific composite views        | `web/components/products-list/ProductList.svelte` |
| **Layout**       | `routes/` or `web/components/`   | Shared structural wrappers             | `AppShell.svelte`                                 |
| **UI Primitive** | `web/components/ui`              | Generic, reusable, context-free atoms  | `Button.svelte`, `Modal.svelte`                   |

### Responsibility Rules

- **Pages** delegate to feature components. They receive data from load
  functions and pass it as props.
- **Feature components** compose UI primitives and wire up event handlers.
  They do not fetch data.
- **UI primitives** are stateless and framework-agnostic. They expose props
  and dispatch events.
- **Layouts** provide consistent chrome (nav, sidebar, footer) and are
  applied via SvelteKit's layout system.

## Props Down, Events Up

Components receive data through props and communicate changes upward through
callback props. In Svelte 5, use the `$props()` rune.

```svelte
<!-- ProductCard.svelte -->
<script lang="ts">
    import type { Product } from '$lib/api/domain/models/product';

    interface Props {
        product: Product;
        onDelete: (id: string) => void;
    }

    let { product, onDelete }: Props = $props();
</script>

<article>
    <h2>{product.name}</h2>
    <button onclick={() => onDelete(product.id)}>Delete</button>
</article>
```

## No Data Fetching in Components

Components receive data through props, never through direct fetch calls or
service instantiation. Data loading belongs in route load functions.

```svelte
<!-- ❌ WRONG: component fetches its own data -->
<script lang="ts">
    let products = $state<Product[]>([]);
    $effect(() => {
        fetch('/api/products').then(r => r.json()).then(d => products = d);
    });
</script>

<!-- ✅ RIGHT: data comes from load function via props -->
<script lang="ts">
    let { data } = $props();
</script>

{#each data.products as product}
    <ProductCard {product} />
{/each}
```

## Container vs Presentational

| Pattern            | Location          | Has data logic | Has markup |
| ------------------ | ----------------- | -------------- | ---------- |
| **Container**      | `routes/`         | Yes            | Minimal    |
| **Presentational** | `web/components/` | No             | Yes        |

Containers (route pages) fetch data and pass it to presentational components.
Presentational components focus purely on rendering and user interaction.

## Svelte 5 Runes

Svelte 5 introduces runes for reactive state management. They work in `.svelte`
and `.svelte.ts` files.

### Core Runes

```svelte
<script lang="ts">
    // $state: reactive variable
    let count = $state(0);

    // $derived: computed from state
    let doubled = $derived(count * 2);

    // $effect: side effects (runs when dependencies change)
    $effect(() => {
        console.log(`Count is now ${count}`);
    });

    // $props: component props
    let { name, age = 0 }: { name: string; age?: number } = $props();
</script>

<button onclick={() => count++}>
    {name}: {count} (doubled: {doubled})
</button>
```

### Rune Rules

- `$state` replaces `let` for reactive variables
- `$derived` replaces `$:` reactive declarations
- `$effect` replaces `$:` for side effects
- `$props` replaces `export let` for component props
- Runes work in `.svelte.ts` files for shared reactive state

## Global State

Shared reactive state lives in `.svelte.ts` modules using runes. These modules
are imported by components and other stores.

```typescript
// web/stores/AuthStore.svelte.ts

class AuthStore {
  #user = $state<User | null>(null);

  get user(): User | null {
    return this.#user;
  }

  set user(value: User | null) {
    this.#user = value;
  }

  get isAuthenticated(): boolean {
    return this.#user !== null;
  }
}

export const authStore = new AuthStore();
```

### SSR-Safe Patterns

For state that differs between server and client, use SvelteKit's `browser`
check:

```typescript
import { browser } from "$app/environment";

class PreferencesStore {
  #theme = $state(
    browser ? (localStorage.getItem("theme") ?? "light") : "light",
  );

  get theme(): string {
    return this.#theme;
  }

  set theme(value: string) {
    this.#theme = value;
    if (browser) localStorage.setItem("theme", value);
  }
}
```

## Route Conventions

SvelteKit routes follow a file-based convention. Each route can have load
functions, actions, and API endpoints.

### Data Loading

```typescript
// routes/products/+page.server.ts
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async (event) => {
  const products = await productRetriever.list(event.locals.user);
  return { products };
};
```

### Form Actions

```svelte
<!-- routes/products/+page.svelte -->
<script lang="ts">
    let { data, form } = $props();
</script>

<form method="POST" action="?/create" use:enhance>
    <input name="name" required />
    <input name="price" type="number" step="0.01" required />
    <button type="submit">Create Product</button>
</form>
```

Use `use:enhance` for progressive enhancement — forms work without JavaScript
and upgrade when available.

### API Endpoints

```typescript
// routes/api/products/+server.ts
import { buildEndpoint } from "$lib/api/infrastructure/utils/build-endpoint";
import { CreateProductCommand } from "$lib/api/application/dto/commands/create-product.command";

export const GET = buildEndpoint({
  requiresAuth: true,
  handler: async (_command, { user }) => {
    return productRetriever.list(user);
  },
});

export const POST = buildEndpoint({
  requiresAuth: true,
  schema: CreateProductCommand,
  handler: async (command, { user }) => {
    const product = await productCreator.create(command, user);
    return { productId: product.id };
  },
});
```

## Frontend Service Layer

Frontend services encapsulate API calls and error handling. They are singleton
classes that throw `ApiError` on failure.

```typescript
// web/services/products.service.ts
import { ApiError } from "$lib/web/utils/api-client/api-error";

class ProductsService {
  async list(): Promise<Product[]> {
    const res = await fetch("/api/products");
    if (!res.ok) throw await ApiError.fromResponse(res);
    return res.json();
  }

  async getById(id: string): Promise<Product> {
    const res = await fetch(`/api/products/${id}`);
    if (!res.ok) throw await ApiError.fromResponse(res);
    return res.json();
  }

  async create(command: CreateProductCommand): Promise<{ productId: string }> {
    const res = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(command),
    });
    if (!res.ok) throw await ApiError.fromResponse(res);
    return res.json();
  }
}

export const productsService = new ProductsService();
```

### Component Usage

```svelte
<script lang="ts">
    import { productsService } from '$lib/web/services/products.service';
    import { ApiError } from '$lib/web/utils/api-client/api-error';

    let error = $state<string | null>(null);

    async function handleDelete(productId: string) {
        try {
            await productsService.delete(productId);
        } catch (err) {
            if (err instanceof ApiError) {
                error = err.message;
            }
        }
    }
</script>
```

## CSS Architecture

### Design Token Hierarchy

Organize CSS custom properties in three tiers:

```
┌─────────────────────────────┐
│  Primitives (values only)    │  --gray-100: #f5f5f5;
├─────────────────────────────┤
│  Semantics (purpose)          │  --color-bg: var(--gray-100);
├─────────────────────────────┤
│  Components (scoped usage)    │  .card { background: var(--color-bg); }
└─────────────────────────────┘
```

### Semantic Naming

Name tokens by purpose, not by visual appearance.

```css
/* ❌ Visual naming — brittle to redesign */
--color-red: #ef4444;
--font-large: 2rem;

/* ✅ Semantic naming — stable across redesigns */
--color-danger: #ef4444;
--font-heading: 2rem;
```

### Scoped Styles

Use Svelte's `<style>` block for component-scoped CSS. Styles are automatically
scoped to the component.

```svelte
<style>
    .card {
        background: var(--color-surface);
        border-radius: var(--radius-md);
        padding: var(--space-md);
    }
</style>

<div class="card">
    <h2>{title}</h2>
</div>
```

### Dark Mode

Implement dark mode with CSS custom properties and a `data-theme` attribute.

```css
/* app.css */
:root {
  --color-bg: #ffffff;
  --color-text: #1a1a1a;
}

[data-theme="dark"] {
  --color-bg: #1a1a1a;
  --color-text: #f5f5f5;
}
```

Toggle the attribute on the `<html>` element via a store or script. No external
CSS frameworks needed — Svelte scoped styles and CSS custom properties handle
everything.
