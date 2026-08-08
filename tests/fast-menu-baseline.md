# Fast Menu Interactions — Baseline

> Generated artifact — measurement only. Budgets are explicit user decisions after this baseline.

- Environment: dev-warm/cold (worker-server mode: `dev`, command: `npm run dev`)
- Date: 2026-08-08T01:47:06.358Z
- Node: v24.18.0
- Platform: linux x64

## Metrics (ms)

| Interaction                              | shell visible |  focus | first content | settled | requests | long tasks | page errors |
| ---------------------------------------- | ------------: | -----: | ------------: | ------: | -------: | ---------: | ----------: |
| initial page load (dev cold / prod cold) |         41 ms |  41 ms |         56 ms |   74 ms |        0 |          0 |           0 |
| overflow menu open                       |         79 ms |  80 ms |         81 ms |   84 ms |        0 |          0 |           0 |
| quick open                               |        206 ms | 208 ms |        210 ms |  213 ms |        1 |          0 |           0 |
| rail switch project→git                  |         46 ms |  48 ms |         50 ms |   54 ms |        0 |          0 |           0 |
| right panel comments→review              |         33 ms |  35 ms |         36 ms |   38 ms |        0 |          0 |           0 |
| review list open                         |         49 ms |  50 ms |         52 ms |  107 ms |        1 |          0 |           0 |

## How to re-run

- Dev: `npm run test:e2e -- fast-menu-baseline`
- Production: `npm run build && DIFFSCRIBE_E2E_BASELINE_ENV=production npx playwright test fast-menu-baseline`

Budgets (e.g. shell ≤ 100 ms, focus ≤ 150 ms, first content ≤ 500 ms, settled ≤ 1000 ms) are proposed as an explicit user decision and recorded in `docs/PRD.md` only if approved.
