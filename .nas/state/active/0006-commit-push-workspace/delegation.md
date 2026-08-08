# Delegation: 0006-commit-push-workspace

## Contract

- **Feature**: 0006-commit-push-workspace
- **Scope**: All current workspace changes, explicitly authorized by the user
- **Branch**: `develop`
- **Remote**: `origin/develop`
- **Mode**: operational commit → push → verification
- **Goal**: Create one atomic Conventional Commit for the full workspace and push it without force-pushing.

## Files

### To modify

All currently modified and untracked files, including `.nas/state/archived/**` and `tests/fast-menu-baseline.md`, because the user explicitly authorized the entire workspace.

### Do NOT touch

- Do not edit source files to change behavior.
- Do not force-push.
- Do not include ignored files or secrets.
- Do not resolve remote drift without returning to the user for approval.

## Existing verification

- Research found 27 modified tracked files and 22 untracked files.
- No staged changes or merge conflicts.
- No private keys or API credentials detected.
- Pre-commit hook: `npm run format && npm run lint`.

## Commands

- `npm run format`
- `npm run lint`
- `git diff --check`
- `git add -A`
- `git diff --cached --check`
- `git diff --cached --stat`
- `git commit -m "feat(web): optimize menu loading and stabilize E2E"`
- `git push origin develop`
- Post-push: `git status --short --branch`, `git log`, `git show --check`, remote SHA verification.

## Authorization

- **Task**: Commit and push all current workspace changes.
- **User approval**: Explicitly granted: “Todo el workspace” and current/default branch/remote.
- **Developer**: `nas_developer` FULL.
- **Exact approved skills**: `mind-management`, `clean-code`, `IADEV-writing-implementation`.
- **Safety**: Review cached diff for secrets/artifacts before commit; abort and report anomalies.
- **Rollback**: Before push, reset locally; after push, use `git revert`; never force-push.
