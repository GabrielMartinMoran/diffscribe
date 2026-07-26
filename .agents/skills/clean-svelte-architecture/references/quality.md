# Quality: Semantic Code, Guard Clauses, and Quality Gates

## Semantic Code

Code should read like well-written prose. Names express intent, structure
reveals logic, and comments explain only what code cannot.

### Naming Conventions

| Category       | Convention                           | Examples                               |
| -------------- | ------------------------------------ | -------------------------------------- |
| Booleans       | `is`, `has`, `should`, `can` prefix  | `isActive`, `hasPermission`, `canEdit` |
| Collections    | Plural noun                          | `users`, `products`, `activeOrders`    |
| Functions      | Verb or verb-noun                    | `save()`, `calculateTotal()`           |
| Classes        | Noun or noun phrase                  | `ProductRetriever`, `EmailValidator`   |
| Constants      | UPPER_SNAKE_CASE                     | `MAX_RETRY_COUNT`                      |
| Private fields | `#` prefix (native JS) or `_` prefix | `#cache`, `_db`                        |

Avoid Hungarian notation (prefixes like `strName`, `intCount`) and type
suffixes (avoid `userList` when `users` suffices).

### Before / After: Semantic Transformation

```typescript
// ❌ BEFORE: implementation details leaking into names
const d = Date.now();
const arr = db.q('SELECT * FROM users WHERE active = 1');
for (let i = 0; i < arr.length; i++) {
    const u = arr[i];
    if (u.role !== 'admin') arr2.push(u);
}

// ✅ AFTER: names express intent
const now = Date.now();
const activeUsers = await this.userRepo.findActive();
const nonAdminUsers = activeUsers.filter(user => user.role !== 'admin');
```

## Guard Clauses

Use guard clauses (early returns) instead of nested `if-else` chains. This
flattens control flow and keeps the happy path at the function's lowest
indentation level.

### Before / After

```typescript
// ❌ BEFORE: nested if-else (3 indentation levels)
function processOrder(order: Order): void {
    if (order.isValid()) {
        if (order.hasInventory()) {
            if (order.customer.isActive()) {
                chargeCustomer(order);
                shipOrder(order);
            } else {
                throw new Error('Customer inactive');
            }
        } else {
            throw new Error('No inventory');
        }
    } else {
        throw new Error('Invalid order');
    }
}

// ✅ AFTER: guard clauses (flat, happy path at end)
function processOrder(order: Order): void {
    if (!order.isValid()) throw new ValidationError('Invalid order');
    if (!order.hasInventory()) throw new ConflictError('No inventory');
    if (!order.customer.isActive()) throw new ForbiddenError('Customer inactive');

    chargeCustomer(order);
    shipOrder(order);
}
```

### Nesting Limit

Maximum two levels of indentation within a function body. Beyond that, extract
or use guard clauses.

## Functions Under 20 Lines

Every function should do one thing at one level of abstraction. If a function
exceeds 20 lines, it likely does too much.

### Single Responsibility Rule

```typescript
// ❌ BAD: mixing validation, transformation, and persistence (28 lines)
async function importProducts(raw: unknown[]): Promise<void> {
    const results: Product[] = [];
    for (const item of raw) {
        if (typeof item !== 'object' || item === null) continue;
        const record = item as Record<string, unknown>;
        if (!record.name || typeof record.name !== 'string') continue;
        if (!record.price || typeof record.price !== 'number' || record.price < 0) continue;
        results.push(
            new Product({
                id: crypto.randomUUID(),
                name: record.name as string,
                price: record.price as number,
            })
        );
    }
    if (results.length === 0) throw new ValidationError('No valid products');
    await this.productRepo.saveMany(results);
}

// ✅ GOOD: decomposed into single-responsibility functions
async function importProducts(raw: unknown[]): Promise<void> {
    const products = raw.map(tryParseProduct).filter((p): p is Product => p !== null);

    if (products.length === 0) throw new ValidationError('No valid products');
    await this.productRepo.saveMany(products);
}

function tryParseProduct(raw: unknown): Product | null {
    if (!isRecord(raw)) return null;
    if (!isValidProductData(raw)) return null;
    return new Product({ id: crypto.randomUUID(), name: raw.name, price: raw.price });
}
```

## Comments

Comments explain **why**, not **what**. The code itself explains what.

### Good Comments

```typescript
// Use a custom threshold here because the default 100ms causes
// flickering on Safari 17 under heavy load.
const DEBOUNCE_MS = 200;

// TODO: Replace with streaming API once backend supports SSE (issue #452)
const products = await fetchAllProducts();
```

### Bad Comments

```typescript
// ❌ Redundant: code already says this
// Set the name to "Widget"
product.name = 'Widget';

// ❌ Commented-out code: delete it, version control has the history
// const oldPrice = product.price * 1.2;

// ❌ Position markers: use functions instead
// ========== VALIDATION ==========
```

## Boy Scout Rule

Leave the codebase better than you found it. Each change includes one small,
incremental improvement.

### Practical Examples

| Current State              | Boy Scout Improvement            |
| -------------------------- | -------------------------------- |
| Magic string `"admin"`     | Extract to `ADMIN_ROLE` constant |
| Variable named `d`         | Rename to `retryDelayMs`         |
| Unchecked `any` cast       | Add proper type guard            |
| Function > 30 lines        | Extract one helper function      |
| Missing test on error path | Add one test case                |

### Boundaries

- Improve only what you touch. Do not refactor unrelated code.
- One improvement per change. Ship it, then do another.
- If a deeper refactor is needed, open a separate issue.

## Quality Gates

Enforce quality at every commit and pull request.

### Pre-Commit Hook

Automatically runs on staged files:

- **Format**: Prettier auto-formats code
- **Lint**: ESLint fixes and checks for violations (`--max-warnings=0`)
- **Type-check**: TypeScript strict mode compilation

```bash
npm run format   # Prettier auto-format
npm run lint     # ESLint with auto-fix
npm run check    # Svelte check + TypeScript
```

### PR Checklist

Every pull request must pass these gates:

- [ ] All tests pass: `npm run test`
- [ ] No lint warnings: `npm run lint:check`
- [ ] Type check passes: `npm run check`
- [ ] Build succeeds: `npm run build`
- [ ] Functions are under 20 lines
- [ ] Business logic is in `lib/api/`, not in `.svelte` files
- [ ] Tests cover the changed behavior
- [ ] No commented-out code remains
- [ ] No unnecessary dependencies introduced

## Import Discipline

Strict import path conventions keep the module graph clean and prevent
circular dependencies.

| Import Type        | Rule                                  | Example                                 |
| ------------------ | ------------------------------------- | --------------------------------------- |
| Cross-module       | Use `$lib/` alias                     | `import { CONFIG } from '$lib/config'`  |
| Immediate neighbor | Relative `./` or `../` (max 2 levels) | `import { User } from '../models/user'` |
| Deep relative      | **Prohibited** — use `$lib/` instead  | Never `../../../../config`              |

```typescript
// ✅ VALID
import { UserCreator } from '$lib/api/application/services/user-creator.service';
import type { User } from '../models/user';

// ❌ INVALID
import { CONFIG } from '../../../../config';
```

Enforce through ESLint rules and code review. The `$lib/` alias ensures imports
remain stable even when files move.

## Prettier, ESLint, and TypeScript

### TypeScript, Never JavaScript

All `.svelte` files use `<script lang="ts">`. All modules are `.ts`. No `.js`
files exist except configuration files that do not support TypeScript (e.g.,
some legacy tool configs).

### Prettier — Mandatory Formatter

Prettier is the project's sole code formatter. Configuration lives in
`.prettierrc` or the `package.json` `prettier` key. Standard settings:

- `singleQuote: true`
- `trailingComma: 'all'`
- `printWidth: 100`

Run Prettier via:

```bash
npm run format          # Format all files
npm run format:check    # Check only (CI)
```

The pre-commit hook runs Prettier automatically on staged files.

### ESLint — Mandatory Linter

ESLint is configured via `eslint.config.js` (flat config format). Key rules:

- `no-unused-vars` (with `_` prefix exception for intentionally unused
  variables).
- Import ordering (sorting, no duplicates, no circular dependencies).
- `no-console.log` in production code (use a logger abstraction instead).

Run ESLint via:

```bash
npm run lint            # Lint with auto-fix
npm run lint:check      # Strict check (--max-warnings=0, for CI)
```

### Pre-Commit Automation

Husky + lint-staged run Prettier and ESLint before every commit. This prevents
poorly formatted or lint-violating code from entering the repository.

### Type Checking

Run type checking in the CI pipeline:

```bash
npm run check           # svelte-check + tsc --noEmit
```

TypeScript is configured with `strict: true`. No `any` types without explicit
justification.

## Package Version Locking

### Exact Versions

Use **exact versions** in `package.json`:

```json
{
    "dependencies": {
        "zod": "3.23.8"
    }
}
```

**Do NOT use** caret (`^3.23.8`) or tilde (`~3.23.8`). These operators allow
patch and minor updates that can introduce breaking changes, behavioral
regressions, or compromised packages in the supply chain.

### Why

- **Reproducible builds**: exact versions guarantee the same dependency tree on
  every install.
- **Security**: caret/tilde ranges can silently pull in compromised package
  versions.
- **Controlled upgrades**: dependencies are upgraded intentionally, with a
  changelog review and full test suite run.

### Commit the Lockfile

`package-lock.json` must be committed to version control — never add it to
`.gitignore`. The lockfile records the exact dependency graph and ensures
`npm ci` produces identical installations.

### Upgrading Dependencies

When upgrading a package:

1. Install the exact version: `npm install package-name@1.2.3`
2. Review the changelog for breaking changes.
3. Run the full test suite: `npm run test`
4. Commit `package.json` and `package-lock.json` together.

### Security Scanning

Run `npm audit` regularly. Pin versions of dependencies with known
vulnerability fixes. Integrate audit into CI to block builds with critical
vulnerabilities.
