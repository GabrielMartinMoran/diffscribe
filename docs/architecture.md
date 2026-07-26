# DiffScribe — Arquitectura

**Estado:** Borrador inicial

Este documento define la arquitectura técnica de DiffScribe: stack, capas,
flujo de datos, decisiones arquitectónicas, CI/QA y límites entre módulos.

La guía de diseño visual, tokens CSS, breakpoints y accesibilidad están en
[docs/design.md](design.md).

---

## Stack

| Componente         | Elección                  | Notas                                           |
| ------------------ | ------------------------- | ----------------------------------------------- |
| Framework          | SvelteKit + adapter-node  | SSR + servidor local; Vite como bundler         |
| Lenguaje           | TypeScript                | Modo estricto                                   |
| UI                 | Svelte 5 + CSS propio     | Sin Tailwind; tokens globales y estilos scoped  |
| Persistencia       | SQLite (`better-sqlite3`) | Síncrono; base en `~/.diffscribe/diffscribe.db` |
| Git                | CLI nativa + `simple-git` | `simple-git` para operaciones comunes           |
| Resaltado          | Shiki                     | Sintaxis declarativa; temas configurables       |
| Tests unitarios    | Vitest                    | Runner rápido; integrado con Vite               |
| Tests BDD          | quickpickle + Vitest      | `.feature` leídos directamente                  |
| Tests E2E          | Playwright                | Navegador real                                  |
| CI                 | GitHub Actions            | Desde Etapa 1                                   |
| Distribución       | Paquete npm ejecutable    | `npx diffscribe`                                |

---

## Capas

DiffScribe aplica Clean Architecture con dos skills complementarias: Clean
Backend Architecture para el servidor y Clean Svelte Architecture para la capa
web. Las dependencias apuntan hacia adentro: las capas externas conocen a las
internas; las internas no conocen nada de las externas.

```text
web / routes  ───  infraestructura  ───  aplicación  ───  dominio
```

| Capa              | Propio                                                                    | Prohibido                                |
| ----------------- | ------------------------------------------------------------------------- | ---------------------------------------- |
| `domain`          | Entidades, value objects, interfaces de repositorios, errores de dominio  | Frameworks, HTTP, DB, vendor SDKs        |
| `application`     | Casos de uso, commands, queries, DTOs, resultados                         | Transporte, persistencia, componentes UI |
| `infrastructure`  | Implementaciones de repositorios, mappers, SQL, clientes Git, gateways    | Lógica de negocio, decisión de producto  |
| `web` (o routes)  | Componentes Svelte, stores, endpoints, handlers HTTP                      | Reglas de negocio, acceso directo a DB   |

### Estructura esperada de directorios

```text
src/
├── lib/
│   ├── server/
│   │   ├── domain/
│   │   │   ├── entities/
│   │   │   ├── value-objects/
│   │   │   ├── repositories/       # Interfaces (puertos)
│   │   │   └── errors/
│   │   ├── application/
│   │   │   ├── dto/
│   │   │   │   ├── commands/
│   │   │   │   ├── queries/
│   │   │   │   └── results/
│   │   │   └── services/           # Casos de uso
│   │   └── infrastructure/
│   │       ├── repositories/       # Implementaciones concretas
│   │       ├── mappers/
│   │       ├── git/
│   │       └── database/
│   └── web/                        # Componentes Svelte, stores, CSS
│       ├── components/
│       ├── stores/
│       └── styles/
└── routes/                         # Endpoints SvelteKit
```

### Interfaces de repositorios (puertos)

Toda interfaz de repositorio se define en `domain/repositories/`. Solamente
el dominio conoce la forma del contrato. La capa `application` consume esas
interfaces sin saber quién las implementa.

Las implementaciones concretas y los mappers de persistencia viven
exclusivamente en `infrastructure/repositories/`. Ninguna capa externa al
dominio define interfaces de repositorio.

### Server-only boundary

El acceso a filesystem, Git, SQLite y secretos está restringido al lado
servidor. Los módulos que tocan estos recursos deben residir bajo
`$lib/server/` y nunca importarse desde código del lado cliente.

SvelteKit impone esta separación mediante `$env/static/private` para secretos
y la convención `$lib/server/` para módulos exclusivos del servidor.

---

## Persistencia

DiffScribe usa SQLite mediante `better-sqlite3` como almacenamiento local
principal.

### Ubicación y configuración

La base de datos se almacena en:

```text
~/.diffscribe/diffscribe.db
```

El directorio `~/.diffscribe/` se crea automáticamente en la primera ejecución.
La ubicación es configurable mediante variable de entorno, pero el default es
`~/.diffscribe/`.

### WAL y performance

SQLite opera en modo WAL (Write-Ahead Logging) por defecto. Esto permite
lecturas concurrentes con escrituras y mejora la performance en cargas mixtas.

### Migraciones

Las migraciones se aplican al iniciar la aplicación. Cada migración es un
archivo SQL numerado que se ejecuta en orden. Una tabla `_migrations` registra
qué migraciones ya fueron aplicadas.

Las migraciones deben mantener compatibilidad hacia atrás dentro de una misma
versión mayor (consultar [docs/versioning.md](versioning.md)).

### Snapshots

DiffScribe usa snapshots completos del diff para preservar el contexto de las
observaciones. Cuando se crea una observación, se guarda el fragmento exacto del
diff en ese momento. Esto permite consultar observaciones anteriores aunque el
repositorio haya cambiado.

---

## Integración con Git

DiffScribe interactúa con Git mediante:

1. **CLI nativa de Git** — requerida en el sistema. Se asume que `git` está
   disponible en el `PATH`.
2. **`simple-git`** — wrapper de Node.js sobre la CLI de Git. Simplifica
   operaciones comunes como `diff`, `log`, `branch` y `status`.

La herramienta es de solo lectura respecto de Git en Etapa 1. No crea commits,
ramas ni modifica archivos.

### Comparaciones soportadas

Las comparaciones Git se representan mediante los tipos definidos en el modelo
de dominio (consultar [docs/domain.md](domain.md)). La capa de infraestructura
traduce estos conceptos a comandos Git concretos.

---

## Resaltado de sintaxis

Shiki proporciona resaltado de sintaxis declarativo. Se configura con temas
claro y oscuro según el tema activo de la aplicación. El CSS de los tokens de
Shiki se integra con los tokens de diseño propios definidos en
[docs/design.md](design.md).

---

## CI y QA

### Pipeline

GitHub Actions ejecuta el pipeline de QA en cada push y pull request. Las
etapas son secuenciales (si una falla, las siguientes no se ejecutan):

| Etapa          | Comando                     |
| -------------- | --------------------------- |
| Formato        | `npm run format`            |
| Lint           | `npm run lint`              |
| Typecheck      | `npm run check`             |
| Tests unit     | `npm run test:unit`         |
| Tests integ.   | `npm run test:integration`  |
| Tests BDD      | `npm run test:bdd`          |
| Tests E2E      | `npm run test:e2e`          |
| Build          | `npm run build`             |

El comando `npm run qa` ejecuta todas las etapas localmente.

### Herramientas

- **Prettier:** formato consistente.
- **ESLint** (flat config): reglas de linting, orden de imports
  (`simple-import-sort`), estructura (`import-x`) y limpieza de imports no
  usados (`eslint-plugin-unused-imports`). Prettier y ESLint se mantienen
  separados mediante `eslint-config-prettier/flat`.
- **TypeScript:** modo estricto; sin `any` sin justificación explícita.

---

## Flujo de datos

### Apertura de un workspace

```text
Usuario → SvelteKit route → application (GetWorkspaceUseCase)
  → infrastructure (WorkspaceRepository) → SQLite
  → domain (Workspace entity) → response
```

### Obtención de un diff

```text
Usuario → SvelteKit route → application (GetDiffUseCase)
  → infrastructure (GitService) → git CLI
  → domain (Comparison, DiffResult) → response
```

### Creación de una observación

```text
Usuario → SvelteKit route → application (CreateObservationUseCase)
  → domain (Observation entity, invariantes)
  → infrastructure (ObservationRepository) → SQLite
  → infrastructure (GitService) → snapshot del fragmento
  → response
```

### Exportación

```text
Usuario → SvelteKit route → application (ExportReviewUseCase)
  → infrastructure (ObservationRepository) → SQLite
  → domain (Review aggregate) → formateo Markdown/JSON
  → response
```

---

## Decisiones arquitectónicas

### ADR-001: SQLite local y síncrono

**Decisión:** Usar `better-sqlite3` con acceso síncrono en lugar de un driver
asíncrono o una base de datos separada.

**Razón:** La aplicación es single-user y local. SQLite síncrono simplifica el
modelo de concurrencia sin sacrificar performance. No hay contención real entre
múltiples conexiones.

### ADR-002: Snapshots completos de diff

**Decisión:** Almacenar un snapshot completo del fragmento de diff al crear una
observación, en lugar de solo referencias a líneas y hashes.

**Razón:** El repositorio puede cambiar después de crear la observación. Un
snapshot preserva el contexto exacto que el reviewer vio. El costo de
almacenamiento es bajo para fragmentos de texto.

### ADR-003: Interfaces de repositorio en dominio

**Decisión:** Las interfaces de repositorio se definen exclusivamente en
`domain/repositories/`. La capa `application` nunca define puertos de
persistencia.

**Razón:** Mantener la dependency rule de Clean Architecture: el dominio no
depende de nada externo. Las interfaces de repositorio pertenecen al dominio
porque expresan qué necesita persistir el dominio, no cómo se persiste.

### ADR-004: Sin Tailwind, CSS propio

**Decisión:** Usar CSS propio con tokens globales y estilos scoped de Svelte.

**Razón:** La interfaz de DiffScribe es un workbench de revisión de código con
requisitos visuales específicos (syntax highlighting, diffs, anotaciones). Un
sistema de tokens propio da control preciso sobre la densidad, jerarquía y
estados del diff. Tailwind añadiría una capa de abstracción que no se justifica
para este dominio visual.

### ADR-005: Shiki sobre highlight.js o Prism

**Decisión:** Usar Shiki para resaltado de sintaxis.

**Razón:** Shiki usa gramáticas de TextMate (las mismas que VS Code), produce
HTML con tokens semánticos, y permite temas duales claro/oscuro. Funciona en
servidor (SSR) sin payload de JS adicional. El output es predecible y
estilizable con CSS propio.

### ADR-006: quickpickle para BDD

**Decisión:** Usar quickpickle como runner de BDD, que lee archivos `.feature`
directamente y los ejecuta con Vitest.

**Razón:** quickpickle no requiere compilación intermedia de features a código.
Los `.feature` son la fuente de verdad y el runner los consume tal cual. Vitest
como engine ofrece velocidad, watch mode y compatibilidad con el ecosistema
Vite/SvelteKit.

---

## Referencias

- [Product Requirements Document](PRD.md) — requisitos y decisiones de producto
- [Guía de diseño](design.md) — tokens CSS, layout, breakpoints y accesibilidad
- [Modelo de dominio](domain.md) — entidades, value objects, aggregates
- [Versionado](versioning.md) — SemVer, Conventional Commits, migraciones
