# DiffScribe — AGENTS.md

Todo agente que trabaje en este repositorio debe leer este documento antes de
tocar código. Define las reglas del proyecto, los documentos fuente de verdad y
las skills requeridas.

---

## Documentación fuente

Estos documentos contienen la verdad actual del proyecto. Cualquier agente debe
consultarlos antes de implementar, revisar o planificar:

- [Product Requirements Document](docs/PRD.md) — requisitos de producto,
  conceptos centrales, etapas y decisiones tomadas
- [Arquitectura](docs/architecture.md) — stack, capas, flujo de datos,
  decisiones arquitectónicas y CI/QA
- [Guía de diseño](docs/design.md) — tokens CSS, layout, breakpoints,
  responsive, accesibilidad y validación visual
- [Modelo de dominio](docs/domain.md) — lenguaje ubicuo, entidades, value
  objects, aggregates, repositorios y decisiones abiertas
- [Versionado](docs/versioning.md) — SemVer, Conventional Commits, releases
  y migraciones
- [Changelog](docs/changelog.md) — registro de cambios según Keep a Changelog

---

## Documentación viva

Cada tipo de cambio tiene un documento canónico que debe actualizarse:

| Cambio                                   | Documento a actualizar   |
| ---------------------------------------- | ------------------------ |
| Nueva decisión de producto o etapa       | `docs/PRD.md`            |
| Cambio en stack, capas, CI o límites     | `docs/architecture.md`   |
| Nuevo token, breakpoint o regla visual   | `docs/design.md`         |
| Nueva entidad, agregado o invariante     | `docs/domain.md`         |
| Release, breaking change o nueva versión | `docs/versioning.md`     |
| Cambio liberado en una versión           | `docs/changelog.md`      |
| Nueva skill, regla o proceso de agente   | `AGENTS.md`              |

La documentación se mantiene en español. Los términos técnicos se escriben en
inglés.

---

## Skills locales obligatorias

Todo agente debe cargar las siguientes skills del repositorio antes de tocar
código. La ruta de cada skill es relativa a la raíz del proyecto:

1. [clean-backend-architecture](.agents/skills/clean-backend-architecture/SKILL.md)
2. [clean-code](.agents/skills/clean-code/SKILL.md)
3. [clean-svelte-architecture](.agents/skills/clean-svelte-architecture/SKILL.md)
4. [frontend-design](.agents/skills/frontend-design/SKILL.md)
5. [svelte-code-writer](.agents/skills/svelte-code-writer/SKILL.md)

El agente debe cargar únicamente las skills aplicables a su tarea. Las skills
no aplicables pueden omitirse, pero las que apliquen son obligatorias.

---

## Proceso NAS (IADEV)

DiffScribe usa el pipeline NAS con subagentes IADEV. Las skills globales
relevantes describen cada fase del proceso. Estas skills no se convierten en
skills locales del repositorio; se cargan desde la configuración global del
entorno:

### BDD-first

Todo comportamiento nuevo debe especificarse en Gherkin antes de implementarse.
Los archivos `.feature` se almacenan en `specs/features/`. El runner de BDD es
quickpickle, que lee `.feature` directamente y los ejecuta con Vitest.

La skill `IADEV-bdd-implementation` define cómo consumir las especificaciones
`.feature` y convertirlas en pruebas ejecutables. La skill
`IADEV-writing-gherkin` establece las reglas de sintaxis y buenas prácticas
para escribir escenarios.

El planner y el developer consumen las features como contrato de aceptación.
Ningún código de producción se escribe sin un escenario Gherkin que lo
especifique.

### Convención de idioma para BDD

Todos los archivos `.feature` bajo `specs/features/` y las step definitions
bajo `tests/steps/` se escriben en inglés. Esta regla aplica tanto a los
escenarios existentes como a cualquier escenario nuevo. El guard estático
`check:bdd-language` (definido en `scripts/check-bdd-language.mjs`) se
ejecuta como parte de la cadena de QA y detecta texto en español (diacríticos
y wordlist curada) en patrones Gherkin y comentarios de step definitions.

La documentación general (`docs/`, `AGENTS.md`) se mantiene en español.
Los términos técnicos, comandos, paths, nombres de scripts y APIs se
escriben en inglés como es habitual en el proyecto.

### TDD (Red → Green → Refactor)

Todo código de producción debe estar respaldado por pruebas escritas antes de
la implementación. El ciclo es estricto:

1. **Red:** escribir una prueba que falle.
2. **Green:** escribir el código mínimo para que pase.
3. **Refactor:** mejorar el código sin cambiar el comportamiento.

La skill `IADEV-test-driven-development` define la disciplina TDD que todo
developer debe seguir. No se considera terminado ningún cambio sin una
verificación fresca de que todas las pruebas pasan.

### Validación y QA

La skill `IADEV-validating-implementation` define el protocolo del Tester para
auditar el trabajo del Developer contra los artefactos OpenSpec, re-ejecutar
pruebas y emitir `validation-results.md` con hallazgos PASS/FAIL.

La skill `IADEV-applying-feedback` define cómo el Developer consume ese reporte
y convierte cada FAIL en una corrección concreta respaldada por una prueba.

---

## QA hard gate

Ningún cambio se considera completo si alguna de estas verificaciones falla.
Cualquier fallo implica `FAIL`. El comando `npm run qa` ejecuta todas las
verificaciones en orden. Si una etapa falla, las siguientes no se ejecutan.

| Etapa       | Comando                        | Criterio                  |
| ----------- | ------------------------------ | ------------------------- |
| Formato     | `npm run format`               | Sin diferencias           |
| Lint        | `npm run lint`                 | `--max-warnings=0`        |
| Tipos       | `npm run check` o equivalente  | Sin errores de tipo       |
| Unit        | `npm run test:unit`            | 100% pasando              |
| Integ.      | `npm run test:integration`     | 100% pasando              |
| Idioma BDD  | `npm run check:bdd-language`   | Sin español en BDD        |
| BDD         | `npm run test:bdd`             | 100% pasando              |
| E2E         | `npm run test:e2e`             | 100% pasando              |
| Build       | `npm run build`                | Build exitoso sin errores |

Prettier se encarga del formato. ESLint con flat config gestiona el linting,
orden de imports (`simple-import-sort`), estructura (`import-x`) y limpieza de
imports no usados (`eslint-plugin-unused-imports`). Prettier y ESLint se
mantienen separados mediante `eslint-config-prettier/flat`. El developer puede
usar `npm run format:fix` y `npm run lint:fix` localmente; QA solo verifica sin
`--fix`.

### Protocolo ante fallo de formato

Si `npm run format` falla —ya sea durante el pre-commit hook, QA manual, o CI—,
el primer paso obligatorio es ejecutar el autofix:

```bash
npm run format:fix
```

Después del autofix, el agente debe:

1. Revisar el diff generado (`git diff`) para confirmar que los cambios son solo
   de formato y no alteran lógica.
2. Volver a ejecutar `npm run format`. Debe pasar con cero diferencias.
3. Stagear de nuevo los archivos modificados (`git add <archivos>`).
4. Continuar con `npm run lint` y el resto de la verificación QA.

El hook pre-commit **nunca** debe modificarse para que ejecute `format:fix` ni
`--fix`. El hook es y seguirá siendo check-only: `npm run format && npm run lint`.

---

## Clean Architecture

El proyecto sigue Clean Architecture combinando Clean Backend Architecture y
Clean Svelte Architecture. Los límites entre capas son estrictos:

| Capa              | Propio                                                                    | Prohibido                                |
| ----------------- | ------------------------------------------------------------------------- | ---------------------------------------- |
| `domain`          | Entidades, value objects, interfaces de repositorios, errores de dominio  | Frameworks, HTTP, DB, vendor SDKs        |
| `application`     | Casos de uso, commands, queries, DTOs, resultados                         | Transporte, persistencia, componentes UI |
| `infrastructure`  | Implementaciones de repositorios, mappers, SQL, clientes Git, gateways    | Lógica de negocio, decisión de producto  |
| `web` (o routes)  | Componentes Svelte, stores, endpoints, handlers HTTP                      | Reglas de negocio, acceso directo a DB   |

Las dependencias apuntan hacia adentro: `web → infrastructure → application →
domain`. El dominio no importa nada de capas externas. Las interfaces de
repositorios se definen en `domain/repositories/`. Las implementaciones
concretas y los mappers viven en `infrastructure/repositories/`.

---

## Límites de Etapa 1

La Etapa 1 entrega el workbench de revisión sin IA. El alcance está definido
en `docs/PRD.md` §18. Todo agente debe respetar estos límites:

- No implementar features de Etapa 2, 3 o 4.
- No anticipar integraciones con proveedores de IA.
- No agregar capacidades colaborativas, multi-usuario o de red.
- No implementar auto-fix, modificación de código ni creación de commits.

### Scope creep

Si una tarea, sugerencia o descubrimiento implica funcionalidad fuera de la
Etapa 1 actual, el agente debe:

1. Registrar el hallazgo sin implementarlo.
2. Reportarlo al Orchestrator.
3. No modificar código ni documentación para acomodarlo.

Está prohibido inventar decisiones de arquitectura, producto, diseño o dominio
que no estén respaldadas por los documentos fuente o por una memoria aprobada.
Las preguntas abiertas del PRD §21 deben tratarse como `[PENDIENTE]`.

---

## Versionado y commits

El proyecto sigue:

- **SemVer 2.0.0** — versionado semántico para la API pública (CLI, export
  JSON/Markdown, esquema DB, HTTP local).
- **Conventional Commits 1.0.0** — mensajes de commit estructurados con tipos
  `feat`, `fix`, `breaking`, y scope opcional.
- **Keep a Changelog 1.1.0** — changelog mantenido por humanos en
  `docs/changelog.md`.

La versión inicial es `0.x`. Los releases se crean con tags Git. Las
migraciones de SQLite deben mantener compatibilidad hacia atrás dentro de una
misma versión mayor.

Consulta `docs/versioning.md` para la política completa y
`docs/changelog.md` para el registro de cambios.
