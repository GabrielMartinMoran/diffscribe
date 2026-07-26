# DiffScribe — Versionado

**Estado:** Borrador inicial

Este documento define la política de versionado de DiffScribe: numeración de
versiones, API pública, mensajes de commit, releases y migraciones.

---

## Estándares adoptados

| Estándar               | Versión | Aplica a                                         |
| ---------------------- | ------- | ------------------------------------------------ |
| SemVer                 | 2.0.0   | Numeración de releases                           |
| Conventional Commits   | 1.0.0   | Mensajes de commit                               |
| Keep a Changelog       | 1.1.0   | Registro de cambios (`docs/changelog.md`)        |

---

## Semantic Versioning 2.0.0

DiffScribe sigue SemVer 2.0.0. Dada una versión `MAJOR.MINOR.PATCH`:

- **MAJOR:** cambios incompatibles con la API pública.
- **MINOR:** funcionalidad nueva compatible hacia atrás.
- **PATCH:** correcciones de bugs compatibles hacia atrás.

### Versión inicial

El proyecto comienza en `0.x`:

- `0.1.0` — primer release funcional (workbench de revisión, Etapa 1).
- `0.x.y` — iteraciones posteriores dentro de la fase pre-1.0.
- Durante `0.x`, MINOR puede incluir breaking changes. PATCH solo incluye
  correcciones compatibles.
- `1.0.0` — primera versión estable con API pública congelada.

### Pre-releases

Se usa el sufijo SemVer para pre-releases:

```text
0.1.0-alpha.1
0.1.0-beta.1
0.1.0-rc.1
```

Los sufijos `alpha`, `beta` y `rc` indican madurez creciente. No se usan
metadatos de build (`+`) a menos que una herramienta de CI lo requiera.

---

## API pública

La API pública de DiffScribe incluye todo aquello cuyo cambio rompería la
compatibilidad hacia atrás para los usuarios:

### Interfaz de línea de comandos (CLI)

- Comando `diffscribe` y sus flags (`--port`, `--host`, `--open`, path).
- Cambiar, remover o renombrar un flag existente es breaking.
- Agregar un flag nuevo es MINOR.

### Formatos de exportación

- **Markdown:** estructura del review package en Markdown. Cambios que rompan
  herramientas que parsean este formato son breaking.
- **JSON:** esquema del review package en JSON. Cambios en el esquema que
  eliminen campos, cambien tipos o modifiquen la estructura de arrays/objetos
  son breaking. Agregar campos nuevos es MINOR.

### Esquema de base de datos

- El esquema de SQLite (`~/.diffscribe/diffscribe.db`) es parte de la API
  pública interna. Las migraciones deben mantener compatibilidad hacia atrás
  dentro de una misma versión mayor.
- Ver sección "Migraciones de SQLite" más abajo.

### HTTP local (cuando aplique)

- Endpoints, métodos y formatos de request/response del servidor local.
  Actualmente no expuestos como API estable; se documentarán cuando corresponda.

---

## Conventional Commits 1.0.0

Todo commit debe seguir Conventional Commits 1.0.0:

```text
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Tipos

| Tipo        | Uso                                                       | Impacto SemVer       |
| ----------- | --------------------------------------------------------- | -------------------- |
| `feat`      | Nueva funcionalidad                                       | MINOR (0.x)          |
| `fix`       | Corrección de bug                                         | PATCH                |
| `breaking`  | Breaking change (usar `!` después del type/scope)         | MAJOR (0.x: MINOR)   |
| `docs`      | Documentación                                             | Ninguno              |
| `style`     | Formato, whitespace (sin cambios de lógica)               | Ninguno              |
| `refactor`  | Refactor sin cambio de comportamiento ni fix              | Ninguno              |
| `perf`      | Mejora de performance                                     | PATCH (si es fix)    |
| `test`      | Agregar o corregir tests                                  | Ninguno              |
| `chore`     | Tareas de build, CI, dependencias                         | Ninguno              |
| `ci`        | Cambios en configuración de CI/CD                         | Ninguno              |
| `build`     | Cambios en sistema de build o dependencias externas       | Ninguno              |
| `revert`    | Revertir un commit anterior                               | Variable             |

### Breaking changes

Un breaking change se indica de dos formas equivalentes:

```text
feat!: remove deprecated export flag
```

o

```text
feat: remove deprecated export flag

BREAKING CHANGE: The --export flag has been removed. Use --output instead.
```

El footer `BREAKING CHANGE` debe describir qué se rompió y cómo migrar.

### Scope

El scope es opcional. Cuando se usa, debe referirse a un módulo o área del
proyecto:

```text
feat(git): support commit-range comparison
fix(export): handle empty observation list
chore(deps): bump better-sqlite3 to v11
```

### Ejemplos

```text
feat: add workspace selector sidebar
fix: correct line number offset in unified diff
feat(observations)!: rename severity 'warning' to 'major'
chore: configure GitHub Actions CI pipeline
docs: document comparison types in domain model
```

---

## Releases

### Tags

Cada release se marca con un tag Git anotado:

```bash
git tag -a v0.1.0 -m "v0.1.0"
```

El tag sigue el formato `v<MAJOR>.<MINOR>.<PATCH>` sin prefijos adicionales.

### Proceso

1. Actualizar `docs/changelog.md` moviendo cambios de `[Unreleased]` a la
   nueva versión.
2. Actualizar `package.json` con la nueva versión.
3. Crear commit: `chore(release): v0.1.0`.
4. Crear tag: `git tag -a v0.1.0 -m "v0.1.0"`.
5. Push: `git push --follow-tags`.
6. Publicar en npm: `npm publish`.

### Frecuencia

No se define una cadencia fija. Los releases se crean cuando hay cambios
suficientes para justificar una versión nueva. Durante `0.x`, se prefiere
liberar frecuentemente para obtener feedback temprano.

---

## Migraciones de SQLite

### Principios

- Las migraciones son incrementales y numeradas secuencialmente.
- Cada migración se aplica exactamente una vez.
- Las migraciones deben ser compatibles hacia atrás dentro de una misma versión
  mayor.
- Durante `0.x`, las migraciones pueden ser breaking entre versiones MINOR
  (consistente con SemVer para fase `0.x`). Se debe documentar en el changelog.

### Estrategia

Las migraciones se almacenan como archivos SQL en un directorio dedicado
(`migrations/`). Cada archivo sigue el patrón:

```text
001_create_workspaces.sql
002_create_reviews.sql
003_add_context_sources.sql
```

Una tabla `_migrations` en la base de datos registra qué migraciones ya fueron
aplicadas:

```sql
CREATE TABLE IF NOT EXISTS _migrations (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### Compatibilidad

El contrato de compatibilidad es:

- **Misma MAJOR:** la aplicación nueva puede abrir una base de datos creada por
  una versión anterior de la misma MAJOR.
- **MAJOR distinta:** puede requerir migración manual, exportación/importación
  de datos, o una herramienta de migración explícita.

Durante `0.x`, dado que MINOR puede incluir breaking changes, se recomienda
respaldar los datos antes de actualizar entre versiones MINOR.

### Rollback

No se soporta rollback automático de migraciones. Si una migración falla, la
aplicación no inicia y reporta el error. El usuario debe resolver el problema
manualmente o restaurar un backup.

---

## Referencias

- [Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html)
- [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/)
- [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/)
- [Changelog](changelog.md) — registro de cambios
