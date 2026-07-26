# DiffScribe — Changelog

Todos los cambios notables de este proyecto se documentan en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
y este proyecto adhiere a [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added

- Scaffold inicial del workbench: `package.json`, config de build (SvelteKit + Vite + TypeScript strict), ESLint flat config, Prettier, Vitest, quickpickle, Playwright.
- Clean Architecture skeleton con directorios vacíos (domain, application, infrastructure, web).
- Tokens de diseño extraídos de `docs/design.md` en `src/lib/web/styles/tokens.css`.
- Landing mínima con "DiffScribe" en `src/routes/+page.svelte`.
- Bin placeholder `src/bin/diffscribe.js`.
- Smoke tests técnicos: unit, integration, BDD, E2E.
- CI pipeline con Node 22 y 24, `npm ci`, `npm run qa`.
- Documentación base del proyecto: `AGENTS.md`, `docs/architecture.md`,
  `docs/design.md`, `docs/domain.md`, `docs/versioning.md` y
  `docs/changelog.md`.
- Product Requirements Document (`docs/PRD.md`).
- Configuración NAS y skills locales del repositorio.
- Feature técnico BDD `post-setup-discrepancies.feature` que verifica
  D1 (token parity), D2 (unit/integration disjuntos) y D3 (audit sin
  high/moderate).
- Git hook pre-commit con Husky v9.1.7: ejecuta `npm run format && npm run lint`
  en modo check-only sin modificar archivos.
- Feature técnico BDD `pre-commit-quality-gate.feature` que verifica que el
  hook bloquea commits ante fallo de formato o lint.
- Protocolo ante fallo de formato en `AGENTS.md` con pasos obligatorios de
  autofix, review de `git diff` y re-stage.

### Fixed

- D1 — Token parity: añadido `--shadow-none: none;` a los bloques CSS de
  referencia `:root` y `[data-theme="dark"]` en `docs/design.md`.
- D2 — Separación unit/integration: `vitest.config.ts` usa proyectos
  nombrados (`unit`, `integration`) con includes disjuntos. Scripts
  `test:unit` y `test:integration` usan `vitest run --project`.

### Security

- D3 — Dependencias: actualizado `eslint` a `^10.8.0`, `@eslint/js` a
  `^10.0.1`, `typescript-eslint` a `^8.65.0`. Añadidos overrides
  `uuid >=11.1.1` y `cookie >=0.7.0`. `npm audit` reporta 0
  vulnerabilidades (0 critical, 0 high, 0 moderate, 0 low).

---

<!-- Template para futuras versiones:

## [0.1.0] — YYYY-MM-DD

### Added

- Primer release funcional.

### Changed

### Deprecated

### Removed

### Fixed

### Security

-->

---

[Unreleased]: <REPO_URL>/compare/v0.1.0...HEAD
