# Infrastructure: Env Vars, Server-Only Modules, and DI Wiring

## Environment Variables

SvelteKit provides a modern, type-safe API for environment variables. Use the
native `$env` modules instead of `process.env` or `VITE_` prefixed variables.

### Module Types

| Module                 | Visibility              | Use Case                        |
| ---------------------- | ----------------------- | ------------------------------- |
| `$env/static/private`  | Server only, build-time | Secrets, API keys               |
| `$env/static/public`   | Client and server       | Public config, feature flags    |
| `$env/dynamic/private` | Server only, runtime    | Secrets that change per-request |
| `$env/dynamic/public`  | Client and server       | Runtime config                  |

### Declaring Variables

```typescript
// $env/static/private
import { env } from '$env/static/private';

const dbUrl = env.DATABASE_URL;
const apiKey = env.STRIPE_SECRET_KEY;
```

### Validation with Zod

Always validate environment variables at startup. Never assume they exist.

```typescript
// lib/server/env.ts
import { z } from 'zod';
import { env } from '$env/static/private';

const envSchema = z.object({
    DATABASE_URL: z.string().url(),
    STRIPE_SECRET_KEY: z.string().min(1),
    SESSION_SECRET: z.string().min(32),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export const validatedEnv = envSchema.parse(env);
```

### Public Variables

Mark variables as `public: true` in your SvelteKit config to expose them to
the client.

```typescript
// In svelte.config.js or env declaration
// These are accessible via $env/static/public
// APP_NAME, FEATURE_FLAG_NEW_UI
```

### In app.html

Reference environment variables in the HTML shell using `%sveltekit.env.VAR%`:

```html
<!-- src/app.html -->
<meta name="app-version" content="%sveltekit.env.APP_VERSION%" />
```

### Anti-Patterns

- ❌ `VITE_` prefix — this is Vite-specific, not SvelteKit native
- ❌ `process.env` — not available in all SvelteKit contexts
- ❌ Unvalidated env access — use Zod at startup
- ❌ Secrets in `$env/static/public` — use `private` instead

## Server-Only Modules

SvelteKit enforces server-only code through two mechanisms:

### `$lib/server/` Directory

Any module under `$lib/server/` can only be imported by server-side code
(`+page.server.ts`, `+server.ts`, `hooks.server.ts`, other server modules).
Client-side imports of `$lib/server/*` cause build errors.

```typescript
// ✅ VALID: +page.server.ts imports server module
import { db } from '$lib/server/db';

// ❌ BUILDS FAILS: +page.svelte imports server module
import { db } from '$lib/server/db'; // Build error!
```

### `*.server.*` File Pattern

Files matching `*.server.ts` or `*.server.js` are automatically treated as
server-only, regardless of directory.

```
lib/
  server/
    db.ts               ← Server-only (directory)
    session.store.ts    ← Server-only (directory)
  utils/
    crypto.server.ts    ← Server-only (file pattern)
    format.ts           ← Shared (normal file)
```

### What Belongs in Server-Only

| Put in `$lib/server/`      | Keep out of `$lib/server/`  |
| -------------------------- | --------------------------- |
| Database clients           | Domain entities             |
| Repository implementations | DTOs and commands           |
| Session management         | Zod schemas (shared)        |
| API keys and secrets       | Pure utility functions      |
| Authentication middleware  | TypeScript type definitions |

## hooks.server.ts as Composition Root

The `hooks.server.ts` file serves as the composition root — the single place
where all dependencies are wired together and injected.

### event.locals as DI Container

Use `event.locals` to pass dependencies to route handlers. Every request gets
a fresh set of wired dependencies.

```typescript
// hooks.server.ts
import type { Handle } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { UserPgRepository } from '$lib/server/repositories/user-pg.repository';
import { ProductPgRepository } from '$lib/server/repositories/product-pg.repository';
import { ProductCreator } from '$lib/api/application/services/product-creator.service';
import { ProductRetriever } from '$lib/api/application/services/product-retriever.service';

export const handle: Handle = async ({ event, resolve }) => {
    // Wire dependencies
    const userRepo = new UserPgRepository(db);
    const productRepo = new ProductPgRepository(db);

    event.locals.userRepo = userRepo;
    event.locals.productRepo = productRepo;
    event.locals.productCreator = new ProductCreator(productRepo, userRepo);
    event.locals.productRetriever = new ProductRetriever(productRepo);

    return resolve(event);
};
```

### App.Locals Typing

Extend the `App.Locals` interface in `src/app.d.ts` to get type safety in
route handlers.

```typescript
// src/app.d.ts
import type { UserPgRepository } from '$lib/server/repositories/user-pg.repository';
import type { ProductCreator } from '$lib/api/application/services/product-creator.service';

declare global {
    namespace App {
        interface Locals {
            user: User | null;
            userRepo: UserPgRepository;
            productCreator: ProductCreator;
            productRetriever: ProductRetriever;
        }
    }
}
```

### Using sequence() for Multiple Handlers

```typescript
import { sequence } from '@sveltejs/kit/hooks';
import type { Handle } from '@sveltejs/kit';

const authHandler: Handle = async ({ event, resolve }) => {
    const session = await getSession(event.cookies);
    event.locals.user = session?.user ?? null;
    return resolve(event);
};

const diHandler: Handle = async ({ event, resolve }) => {
    event.locals.productRepo = new ProductPgRepository(db);
    return resolve(event);
};

export const handle = sequence(authHandler, diHandler);
```

### Per-Request Instantiation

Services are instantiated per-request, not as singletons. This ensures request
isolation and prevents state leaks between requests.

```typescript
// ✅ Per-request (inside handle function)
event.locals.creator = new ProductCreator(productRepo);

// ❌ Singleton (outside handle function)
const sharedCreator = new ProductCreator(productRepo);
```

### Route Handler Usage

```typescript
// +page.server.ts
export const load = async event => {
    // Dependencies are on event.locals, fully typed
    const products = await event.locals.productRetriever.list(event.locals.user!);
    return { products };
};

export const actions = {
    create: async event => {
        const command = CreateProductCommand.parse(Object.fromEntries(await event.request.formData()));
        await event.locals.productCreator.create(command, event.locals.user!);
    },
};
```

## Logging

### No Silent Failures

Every error must be logged somewhere. Never use an empty `catch` block without
logging. If an error is intentionally swallowed, add a comment explaining why
it is safe.

```typescript
// ❌ Silent failure
try {
    await riskyOperation();
} catch (_err) {
    // nothing — error is lost forever
}

// ✅ Logged and auditable
try {
    await riskOperation();
} catch (err) {
    logger.warn({ err, context: 'riskyOperation' }, 'Recoverable failure');
}
```

### Structured Logging

Use a structured logger (Pino, Winston, or structured `console.log` with JSON).
Every log entry includes:

- `timestamp` — when the event occurred.
- `level` — severity (error, warn, info, debug).
- `message` — human-readable description.
- `context` — machine-readable metadata (userId, requestId, error stack).

### Log Levels

| Level   | When to Use                                              |
| ------- | -------------------------------------------------------- |
| `error` | Crashes, data loss, unrecoverable failures               |
| `warn`  | Recoverable issues, degraded service, retryable errors   |
| `info`  | Key business events, server startup, major state changes |
| `debug` | Detailed diagnostic data — only enabled in development   |

### Backend Logging

Attach a request-scoped logger to `event.locals` in `hooks.server.ts`:

```typescript
// hooks.server.ts — request-level logger
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export const handle: Handle = async ({ event, resolve }) => {
    event.locals.logger = logger.child({ requestId: crypto.randomUUID() });
    const start = Date.now();
    const response = await resolve(event);
    event.locals.logger.info({ duration: Date.now() - start, status: response.status });
    return response;
};
```

### Frontend Logging

Client-side errors are captured via the `handleError` hook and forwarded to a
backend endpoint or external service (Sentry, LogRocket, Datadog RUM). Never
use `console.log` in production — use a logger abstraction:

```typescript
// hooks.client.ts
export const handleError = async ({ error, event }) => {
    const errorPayload = {
        message: error.message,
        stack: error.stack,
        url: event.url.toString(),
        timestamp: new Date().toISOString(),
    };
    // Send to backend logging endpoint
    await fetch('/api/log-error', {
        method: 'POST',
        body: JSON.stringify(errorPayload),
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
    });
};
```

### Log Aggregators

In production, ship logs to a central service (CloudWatch, Datadog, Grafana
Loki, OpenTelemetry collector). Never rely on `console.log` surviving a
container restart. Write logs to stdout as structured JSON; a log router
(Fluentd, Vector) forwards them to the aggregator.

## Error Boundaries

### Expected Errors

Use SvelteKit's `error()` helper in load functions to signal expected error
conditions. The function returns the appropriate HTTP status and message, and
SvelteKit renders the nearest `+error.svelte` page:

```typescript
import { error } from '@sveltejs/kit';

export const load = async ({ params }) => {
    const item = await repo.findById(params.id);
    if (!item) error(404, { message: 'Not found' });
    return { item };
};
```

### Unexpected Errors

SvelteKit catches unhandled errors and invokes the `handleError` hook. Customize
it to log and return a safe message:

```typescript
// hooks.server.ts
export const handleError = async ({ error, event, status, message }) => {
    const errorId = crypto.randomUUID();
    logger.error({ errorId, message: error.message, stack: error.stack, url: event.url });
    return { message: 'Something went wrong. Reference: ' + errorId };
};
```

### Custom Error Pages

Place `+error.svelte` files at any route level to provide context-sensitive
error pages:

```svelte
<!-- src/routes/products/[id]/+error.svelte -->
<script lang="ts">
    import { page } from '$app/state';
</script>

<h1>{page.status}: {page.error.message}</h1><p>We encountered an error while loading this product.</p>
```

### Error Boundary Principle

If something fails, something above it catches the failure. The application
does not crash — it degrades gracefully. SvelteKit walks up the route tree to
find the nearest `+error.svelte`. Within a page, use Svelte's `{#snippet}` or
error boundary components to isolate render errors without taking down the
entire page.

### No Silent Catches

Every `catch` block must do one of:

1. **Handle** — recover and continue (with logging).
2. **Re-throw** — let a higher error boundary handle it.
3. **Log** — create an audit trail, then re-throw or handle.

An empty `catch {}` block is never acceptable.

## Twelve-Factor App Principles

The [Twelve-Factor App](https://12factor.net) methodology maps directly to
SvelteKit practices. The six most relevant factors are summarized below.
Factors that do not directly apply (e.g., VIII. Concurrency, which is handled
by the Node.js cluster module or container orchestration) are omitted.

| Factor                                                  | SvelteKit Practice                                                                                                                  |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **I. Codebase** — One codebase, many deploys            | Single git repository. Deploy to staging and production from the same codebase via CI/CD.                                           |
| **II. Dependencies** — Explicitly declare and isolate   | `package.json` with exact versions, `package-lock.json` committed, `npm ci` for clean installs.                                     |
| **III. Config** — Store config in environment           | Use `$env/static/private` and `$env/static/public`. Never hardcode URLs, API keys, or secrets in source code.                       |
| **IV. Backing services** — Treat as attached resources  | Database, Redis, and S3 are accessed through repository interfaces. Services are swappable without production code changes.         |
| **V. Build, release, run** — Strictly separate stages   | `npm run build` (build), deploy the artifact (release), start the server (run). Never modify code at runtime.                       |
| **VI. Processes** — Stateless processes                 | SvelteKit servers are stateless. Session state lives in Redis or the database — never in memory between requests.                   |
| **VII. Port binding** — Export via port binding         | SvelteKit's adapter-node binds to the `PORT` environment variable. Self-contained; no external web server required.                 |
| **IX. Disposability** — Fast startup, graceful shutdown | Node.js processes handle SIGTERM. Use `process.on('SIGTERM', shutdown)` for graceful cleanup (close DB connections, flush buffers). |
| **X. Dev/prod parity** — Keep environments similar      | Use the same database type (PostgreSQL) in development, staging, and production. Docker Compose for local backing services.         |
| **XI. Logs** — Treat logs as event streams              | Write to stdout as structured JSON. A log router (Fluentd, Vector) ships to a central aggregator. Never write log files to disk.    |
| **XII. Admin processes** — One-off tasks                | Database migrations, seed scripts, and admin CLIs run as separate processes — not as part of the application server.                |
