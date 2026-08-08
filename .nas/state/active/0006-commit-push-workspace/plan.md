# Plan — Commit/Push full workspace (0006-commit-push-workspace)

**Status:** PENDING
**Date:** 2026-08-08
**Executor:** nas_developer
**Skills required:** `mind-management`, `clean-code`, `IADEV-writing-implementation`

---

## User authorization (explicit)

The user explicitly authorized:

1. **Including the ENTIRE current workspace** in the commit — all 27 modified
   tracked files, all 22 untracked files, including `.nas/state/archived/**`
   (feature archives 0001–0005) and the generated `tests/fast-menu-baseline.md`.
2. **Using the current branch and remote as defaults** — branch `develop`,
   upstream `origin/develop`, HEAD `9ffbaa8`.
3. **Pushing the current state** — do not auto-fix format/lint unless strictly
   necessary (a failing pre-commit hook IS the necessary case).

No code changes are part of this task. This is a pure commit/push operation.

---

## Research facts (verified)

| Fact | Value | Verification |
| ---- | ----- | ------------ |
| Branch / upstream | `develop` / `origin/develop` | research |
| HEAD | `9ffbaa8` | research |
| Modified tracked | 27 files, +1434/−297 | research |
| Untracked | 22 files | research |
| Staged / conflicts | none | research |
| Secrets | none detected | research |
| Pre-commit hook | `npm run format && npm run lint` | `.husky/pre-commit` (read) |
| Pre-push hook | none | `.husky/` contains only `_/` and `pre-commit` (read) |
| `.gitignore` | does NOT ignore `.nas` or `tests/fast-menu-baseline.md` | `.gitignore` (read) |
| Active feature state | `.nas/state/active/` empty — this plan creates `0006-commit-push-workspace/` | read |
| `.feature` files | none exist under `specs/features/` | glob |

---

## Approach

Single atomic commit of the full authorized workspace on `develop`, pushed to
`origin/develop`. Sequence: pre-flight read-only checks → format/lint
verification → review + stage everything → cached-diff secret/artifact review →
commit with Conventional Commit message → push → post-push verification.
Rollback is `git revert` (or `git reset --soft` before push); **never
force-push**.

---

## Execution steps (exact commands for nas_developer)

### Step 0 — Pre-flight (read-only)

```bash
git status --short --branch
git diff --stat
git log --oneline -5
```

Acceptance: status matches research (27 modified + 22 untracked, no staged,
no conflicts), HEAD `9ffbaa8`, branch `develop` tracking `origin/develop`.

### Step 1 — Format + lint verification (no auto-fix unless necessary)

```bash
npm run format
npm run lint
```

- These are check-only (`prettier --check .`, `eslint . --max-warnings=0`).
- If both pass → proceed to Step 2.
- If `npm run format` fails → follow the AGENTS.md format-failure protocol
  (this is the "necessary" case the user allowed):
  1. `npm run format:fix`
  2. Review `git diff` — confirm formatting-only, no logic changes
  3. Re-run `npm run format` — must pass with zero differences
  4. Re-stage modified files (`git add <files>`)
  5. Continue with `npm run lint`
- If `npm run lint` fails → fix lint issues (or report to user if the fix
  would change behavior; do not silently change code beyond lint fixes).
- Acceptance: `npm run format` and `npm run lint` both pass with zero
  warnings/errors.

### Step 2 — Review status/diff, stage all authorized changes

```bash
git status --short
git diff --check
git diff --stat
git add -A
```

- `git diff --check` must report no whitespace errors.
- `git add -A` stages: 27 modified, all untracked (including
  `.nas/state/archived/**` and `tests/fast-menu-baseline.md`), and any
  deletions.
- NOTE: this also stages this plan file
  (`.nas/state/active/0006-commit-push-workspace/plan.md`) — consistent with
  the user's full-workspace authorization. If the user prefers to exclude it,
  use instead:
  `git add -A -- . ':(exclude).nas/state/active'`
- Acceptance: `git status --short` shows the full expected set staged
  (27 modified + 22 untracked + plan.md), no conflicts.

### Step 3 — Review cached diff (secrets / undesired files)

```bash
git diff --cached --stat
git diff --cached
git status --short
git status --ignored --short   # confirm what .gitignore excludes
```

- Scan the cached diff for: secrets (`.env`-style values, tokens, keys),
  unintended binaries, generated junk.
- `.gitignore` behavior to note: `node_modules/`, `.svelte-kit/`, `build/`,
  `.vite/`, `test-results/`, `playwright-report/`, `.husky/_/`, `*.db`,
  `.env*` (except `.env.example`), `.DS_Store`, `Thumbs.db`, `--version/`,
  `DiffScribe.fig`, `.pas/`, `/*.png` are ignored and will NOT be committed.
  `.nas/**` and `tests/fast-menu-baseline.md` are NOT ignored → committed
  (user-authorized).
- Acceptance: no secrets, no undesired ignored/generated files in the staged
  set; any anomaly is reported to the user before committing.

### Step 4 — Commit

```bash
git commit -m "feat(web): optimize menu loading and stabilize E2E"
```

- Recommended message (research): `feat(web): optimize menu loading and
  stabilize E2E`. Keep it unless the Step 3 diff inspection shows a clearly
  better concise message (e.g., dominant scope is not web).
- Optional body (only if diff inspection supports it):
  `git commit -m "feat(web): optimize menu loading and stabilize E2E" -m "Fast menu loading optimization with performance harness and baseline; E2E stability hardening (rail hydration, worker guard, readiness probe); archive NAS state 0001-0005."`
- The pre-commit hook (`npm run format && npm run lint`) runs automatically.
  If it fails, the commit aborts → resolve per Step 1 protocol, then retry.
- Acceptance: commit created, hook passed, `git log --oneline -1` shows the
  new commit on `develop`.

### Step 5 — Push

```bash
git push origin develop
```

- Pushes HEAD to upstream `origin/develop`. No pre-push hook exists.
- If rejected (remote drift): do NOT force. Stop and report to the user;
  propose `git pull --rebase origin develop` only after user confirmation.
- Acceptance: push succeeds, remote `origin/develop` now points at the new
  commit.

### Step 6 — Verify

```bash
git status --short --branch
git log --oneline -3
git show --stat HEAD
git show --check HEAD
git rev-parse origin/develop
git log --oneline origin/develop..HEAD
```

- Acceptance:
  - Working tree clean (or only expected leftovers), branch `develop` in sync
    with `origin/develop` (ahead 0).
  - HEAD is the new commit with the expected message.
  - `git show --check HEAD` reports no whitespace errors.
  - `git rev-parse origin/develop` equals the new HEAD SHA.
  - `git log --oneline origin/develop..HEAD` is empty (nothing unpushed).

---

## Rollback

- **Before push (local only):** `git reset --soft HEAD~1` — undoes the commit,
  keeps everything staged. Or `git reset --mixed HEAD~1` to unstage.
- **After push (remote affected):** `git revert <sha>` — creates an inverse
  commit and push it normally. **Never force-push** (`git push --force` is
  forbidden).
- The commit is a single atomic workspace snapshot; revert restores the
  previous state `9ffbaa8`.

---

## Test plan

- RED: not applicable — no code changes, no behavioral surface change.
- GREEN (verification commands):
  - `npm run format` — zero differences
  - `npm run lint` — zero warnings
  - `git diff --check` / `git show --check HEAD` — no whitespace errors
  - `git status --short --branch` — clean, in sync with `origin/develop`
  - `git rev-parse origin/develop` == new HEAD SHA
- REFACTOR: none — no source changes. Post-push, update the mind checkpoint
  (mind-management skill) with the commit SHA and outcome.

---

## Risks

| Risk | Mitigation |
|------|------------|
| Pre-commit hook fails (format/lint) and blocks commit | Follow AGENTS.md format-failure protocol; user pre-authorized the necessary auto-fix case |
| Large mixed commit (1434 insertions) hides an undesired file | Step 3 cached-diff review; report anomalies before committing |
| Generated artifacts (`tests/fast-menu-baseline.md`, `.nas/state/archived/**`) enter history | User explicitly authorized; documented in commit body |
| Secrets in cached diff (research says none) | Step 3 re-scan of `git diff --cached`; abort and report if found |
| Remote `origin/develop` moved → push rejected | Stop, report; propose `git pull --rebase` — never force-push |
| Plan file itself gets committed | Consistent with full-workspace authorization; exclusion alternative documented in Step 2 |
| No pre-push hook → no automatic verification | Step 6 post-push verification is mandatory |

## Assumptions

1. User authorization covers the entire workspace including `.nas/state/archived/**` and `tests/fast-menu-baseline.md`.
2. Branch `develop` and remote `origin` are used as-is.
3. No code changes, no Gherkin (no `.feature` files exist; no behavioral surface change), no changelog/version bump (not a release).
4. The plan file created by this pass is part of the commit unless the user excludes it (Step 2 alternative).
5. Auto-fix of format/lint is only applied when the check fails (the necessary case).