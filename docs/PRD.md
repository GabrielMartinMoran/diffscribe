# DiffScribe — Product Requirements Document

**Estado:** Borrador inicial
**Tipo de producto:** Herramienta open source de revisión local de código
**Plataforma inicial:** Aplicación web local
**Framework definido:** SvelteKit
**Distribución inicial:** Paquete npm ejecutable
**Usuario principal:** Ingenieros de software que trabajan con código generado o modificado mediante agentes de IA

---

## 1. Resumen ejecutivo

DiffScribe es una mesa de trabajo local para realizar revisiones manuales de código de manera estructurada, especialmente en flujos de desarrollo asistidos por agentes de IA.

La herramienta permite abrir repositorios Git, navegar cambios entre diferentes estados, ramas o commits, seleccionar fragmentos de código, registrar observaciones y producir un reporte de revisión accionable.

La inteligencia artificial funciona como copiloto del reviewer. Puede ayudar a redactar observaciones, reformular instrucciones y buscar posibles ocurrencias similares, pero no reemplaza el juicio técnico del usuario ni realiza una revisión autónoma del repositorio.

DiffScribe está diseñado para integrarse en ciclos de trabajo donde uno o más agentes generan código y un ingeniero necesita inspeccionar ese trabajo, registrar sus decisiones y devolver instrucciones claras para la siguiente iteración.

---

## 2. Problema

El desarrollo asistido por IA aumenta considerablemente la velocidad y el volumen de los cambios de código.

Esto genera un nuevo cuello de botella: la revisión humana.

Las herramientas tradicionales de code review están diseñadas principalmente alrededor de pull requests, colaboración remota y plataformas como GitHub o GitLab. Las herramientas automáticas de revisión con IA, por otro lado, tienden a intentar reemplazar al reviewer mediante análisis autónomos, comentarios automáticos o correcciones directas.

Ninguno de esos modelos resuelve completamente el flujo de un ingeniero que:

* trabaja localmente con uno o varios agentes;
* recibe cambios grandes o frecuentes;
* necesita comprender qué cambió antes de aceptarlo;
* quiere aplicar criterio de ingeniería, no solamente detectar errores;
* necesita registrar observaciones positivas y negativas;
* quiere encontrar problemas repetidos sin delegar la decisión final;
* necesita convertir la revisión en instrucciones claras para un agente;
* puede querer revisar cambios antes de crear un pull request;
* puede necesitar comparar el estado actual contra ramas o commits anteriores.

Actualmente, este proceso suele resolverse alternando entre el editor, comandos Git, interfaces de diff, archivos Markdown y conversaciones con agentes. El contexto y las observaciones quedan fragmentados.

---

## 3. Tesis de producto

El código producido por agentes sigue necesitando juicio de ingeniería.

DiffScribe no intenta automatizar ese juicio. Su objetivo es darle al ingeniero una interfaz enfocada para inspeccionar cambios, registrar conclusiones y convertirlas en instrucciones accionables.

La herramienta debe reducir la fricción entre tres momentos:

1. El agente produce cambios.
2. El ingeniero revisa esos cambios.
3. El agente recibe feedback y continúa trabajando.

DiffScribe ocupa deliberadamente el segundo momento y mejora la transición hacia el tercero.

---

## 4. Posicionamiento

### Definición

**DiffScribe es un workbench local de revisión de ingeniería para código producido con asistencia de agentes.**

### No es

* Un bot de pull requests.
* Un reemplazo del reviewer humano.
* Un sistema de aprobación automática.
* Un linter.
* Un scanner de seguridad.
* Un agente de programación.
* Un editor de código completo.
* Una plataforma de colaboración similar a GitHub.
* Una herramienta de corrección automática.
* Una interfaz para que personas sin conocimientos técnicos validen código.

### Diferenciación principal

DiffScribe está diseñado alrededor de una revisión:

* local;
* manual;
* profunda;
* informada por el contexto del proyecto;
* asistida puntualmente por IA;
* persistente;
* exportable;
* independiente de un proveedor de agentes.

---

## 5. Usuario objetivo

### Usuario principal

Un desarrollador, maintainer o ingeniero de software con criterio técnico suficiente para evaluar código, arquitectura, mantenibilidad y decisiones de implementación.

No es necesario que tenga un título formal de ingeniería. Sí debe poder leer, comprender y juzgar código.

Este usuario:

* utiliza uno o varios agentes para desarrollar software;
* trabaja con repositorios Git;
* realiza revisiones antes de aceptar los cambios;
* quiere conservar el control sobre las decisiones;
* necesita revisar más código del que produciría manualmente;
* suele devolver feedback a un agente para continuar la iteración;
* puede trabajar solo o dentro de un equipo;
* valora la claridad, la velocidad y la trazabilidad.

### Usuario secundario futuro

Equipos de ingeniería que deseen compartir o estandarizar revisiones realizadas localmente.

Este usuario no constituye el foco inicial y no debe forzar capacidades colaborativas en la primera versión.

---

## 6. Principios de producto

### 6.1. Human in control

La herramienta asiste al reviewer, pero no emite decisiones finales en su nombre.

Toda observación generada o ampliada por IA debe ser editable y requerir confirmación humana antes de formar parte de la revisión.

### 6.2. Manual-first, AI-assisted

El flujo principal debe funcionar completamente sin IA.

La asistencia de IA mejora acciones concretas, pero no debe ser necesaria para navegar, marcar, clasificar o exportar una revisión.

### 6.3. Local-first

Los repositorios, diffs, comentarios y revisiones deben procesarse y almacenarse localmente por defecto.

El uso de proveedores externos de modelos debe ser explícito y configurable.

### 6.4. Git-native

La herramienta debe reflejar de manera clara qué estados de Git se están comparando.

Nunca debe existir ambigüedad sobre el origen y destino del diff actual.

### 6.5. Contexto visible y controlable

El usuario debe saber qué archivos o reglas se están utilizando como contexto para la asistencia de IA.

No se debe cargar contexto relevante de manera invisible o impredecible.

### 6.6. Interoperabilidad con agentes

El resultado de una revisión debe ser útil para distintos agentes, modelos y herramientas.

DiffScribe no debe depender de un proveedor concreto para completar el ciclo de trabajo.

### 6.7. Profundidad sin complejidad accidental

La herramienta puede soportar revisiones profundas, pero su interfaz debe permanecer enfocada.

Las funciones avanzadas deben incorporarse sin convertir el proceso básico en una configuración permanente.

---

## 7. Objetivos

### Objetivos principales

1. Facilitar la inspección manual de cambios Git dentro de una interfaz web local.

2. Permitir que un ingeniero registre observaciones vinculadas a archivos, líneas o fragmentos concretos.

3. Conservar revisiones anteriores y permitir recuperarlas por proyecto.

4. Convertir observaciones dispersas en un reporte de revisión estructurado.

5. Generar un bloque de instrucciones accionables que pueda entregarse a un agente.

6. Usar contexto explícito del proyecto para mejorar la redacción y relevancia de la asistencia de IA.

7. Permitir la búsqueda asistida de posibles ocurrencias similares a una observación.

8. Soportar repositorios y lenguajes diversos sin asumir un stack específico.

9. Permitir alternar rápidamente entre varios proyectos previamente abiertos.

10. Ser instalable y ejecutable desde npm con una experiencia de inicio simple.

---

## 8. No objetivos iniciales

La primera versión no busca:

* publicar comentarios directamente en GitHub, GitLab o Bitbucket;
* integrarse como bot de pull request;
* ejecutar en pipelines de CI;
* aprobar o rechazar cambios automáticamente;
* aplicar arreglos automáticos;
* modificar código desde la interfaz;
* reemplazar un editor o IDE;
* ofrecer edición colaborativa en tiempo real;
* administrar usuarios, equipos o permisos;
* alojar repositorios remotamente;
* funcionar como una plataforma SaaS obligatoria;
* analizar todo el repositorio automáticamente al abrirlo;
* generar una revisión completa sin intervención humana;
* garantizar detección de vulnerabilidades o defectos;
* sincronizar revisiones entre dispositivos en la primera versión.

---

## 9. Conceptos centrales

### 9.1. Workspace

Un workspace representa un repositorio local registrado en DiffScribe.

Cada workspace conserva:

* ruta local;
* nombre visible;
* metadatos básicos del repositorio;
* revisiones anteriores;
* revisión activa;
* configuración de contexto;
* preferencias de visualización;
* proveedor de IA seleccionado;
* estado de la última comparación utilizada.

Los workspaces abiertos previamente deben aparecer en un menú lateral o selector persistente.

El usuario debe poder:

* agregar un workspace;
* cambiar rápidamente entre workspaces;
* renombrarlo dentro de DiffScribe;
* actualizar su ruta si fue movido;
* cerrarlo o eliminarlo de la lista sin borrar el repositorio;
* identificar workspaces no disponibles o movidos.

### 9.2. Review

Una review es una sesión persistente de análisis sobre una comparación Git determinada.

Una review contiene:

* workspace;
* nombre opcional;
* fecha de creación;
* fecha de última modificación;
* comparación Git;
* estado;
* archivos incluidos;
* observaciones;
* contexto utilizado;
* configuración de IA;
* reporte generado;
* exportaciones realizadas.

Estados iniciales sugeridos:

* Draft
* In progress
* Completed
* Archived

Cerrar una review no debe impedir volver a abrirla o modificarla.

### 9.3. Comparison

Una comparison describe los dos estados Git utilizados para construir un diff.

Debe ser posible representar, como mínimo:

* working tree contra HEAD;
* cambios staged contra HEAD;
* cambios unstaged;
* rama contra rama;
* commit contra commit;
* commit contra working tree;
* rama contra working tree;
* un rango de commits.

La interfaz debe mostrar permanentemente:

* base;
* objetivo;
* tipo de comparación;
* rama actual;
* existencia de cambios no guardados;
* momento en que el diff fue actualizado.

### 9.4. Observation

Una observation es una conclusión registrada por el reviewer.

Puede estar vinculada a:

* una línea;
* un rango de líneas;
* un bloque de diff;
* un archivo completo;
* varios archivos;
* la revisión general.

Una observación puede ser positiva, negativa o neutral.

Tipos iniciales sugeridos:

* Issue
* Risk
* Suggestion
* Question
* Praise
* Note

Severidades iniciales sugeridas:

* Critical
* Major
* Minor
* Informational

No todas las observaciones deben requerir severidad. Por ejemplo, Praise y Note pueden omitirla.

### 9.5. Occurrence

Una occurrence es una ubicación potencialmente relacionada con una observación.

Puede haber sido:

* seleccionada manualmente;
* sugerida por búsqueda textual;
* sugerida por búsqueda estructural;
* sugerida por IA.

Una ocurrencia sugerida no se incorpora automáticamente a la observación.

El usuario debe confirmarla, descartarla o dejarla pendiente.

### 9.6. Review context

El review context es el conjunto explícito de reglas y documentación utilizado para asistir al usuario.

Puede incluir:

* archivos;
* directorios;
* patrones de archivos;
* texto ingresado manualmente;
* archivos detectados automáticamente.

El contexto no constituye una revisión automática. Solo informa las acciones asistidas.

### 9.7. Review package

El review package es el artefacto final producido por DiffScribe.

Debe poder incluir:

* identificación de la revisión;
* comparación analizada;
* resumen ejecutivo;
* observaciones agrupadas;
* referencias a archivos y líneas;
* ocurrencias confirmadas;
* comentarios positivos;
* preguntas pendientes;
* instrucciones para el agente;
* contexto utilizado;
* metadatos opcionales.

---

## 10. Flujo principal

### 10.1. Inicio

1. El usuario ejecuta DiffScribe mediante npm.
2. DiffScribe inicia un servidor local.
3. La interfaz se abre o queda disponible en una URL local.
4. El usuario accede a la lista de workspaces.
5. Puede seleccionar un workspace existente o agregar un repositorio.

### 10.2. Selección de proyecto

1. El usuario selecciona un workspace.
2. DiffScribe valida que el repositorio esté disponible.
3. La herramienta muestra su estado Git actual.
4. Si existe una review activa, permite continuarla.
5. También permite iniciar una review nueva.

### 10.3. Creación de revisión

1. DiffScribe propone working tree contra HEAD como comparación inicial.
2. El usuario puede cambiar la comparación antes o durante la revisión.
3. La herramienta presenta la lista de archivos modificados.
4. El usuario puede incluir o excluir archivos.
5. Se crea la revisión y se registra la comparación elegida.

### 10.4. Navegación

1. El usuario navega entre archivos.
2. Puede utilizar teclado, mouse o controles visibles.
3. Observa el diff formateado según el lenguaje.
4. Puede alternar entre visualización unificada y lado a lado.
5. Puede ocultar archivos revisados, generados o irrelevantes.
6. El progreso de revisión queda registrado por archivo.

### 10.5. Registro de observaciones

1. El usuario selecciona líneas o un bloque.
2. Crea una observación.
3. Puede escribirla manualmente.
4. Puede pedir asistencia para redactarla o mejorarla.
5. Clasifica la observación.
6. Puede agregar severidad, etiquetas o instrucciones.
7. La observación queda vinculada al contexto exacto del diff.

### 10.6. Búsqueda de similares

1. El usuario solicita buscar ocurrencias similares.
2. DiffScribe utiliza la observación, el fragmento seleccionado y el contexto del proyecto.
3. La herramienta devuelve candidatos.
4. Cada candidato muestra:

   * archivo;
   * ubicación;
   * fragmento;
   * razón de similitud;
   * nivel estimado de relevancia.
5. El usuario confirma o descarta cada candidato.
6. Las ocurrencias confirmadas se agrupan con la observación original.

### 10.7. Síntesis

1. El usuario abre la vista de resumen.
2. Revisa todas las observaciones.
3. Ordena, agrupa, edita o elimina elementos.
4. Puede solicitar ayuda para transformar observaciones en instrucciones.
5. DiffScribe genera un review package.
6. El usuario revisa y edita el resultado.
7. Exporta o copia el artefacto.

### 10.8. Historial

1. La revisión queda almacenada dentro del workspace.
2. El usuario puede consultarla posteriormente.
3. Puede ver qué comparación se utilizó.
4. Puede duplicarla o reabrirla.
5. Puede generar nuevamente un reporte con otro formato.

---

## 11. Requisitos funcionales

### 11.1. Administración de workspaces

**FR-001.** El usuario debe poder registrar un repositorio Git local como workspace.

**FR-002.** DiffScribe debe recordar workspaces entre ejecuciones.

**FR-003.** El usuario debe poder alternar entre workspaces sin reiniciar la aplicación.

**FR-004.** La interfaz debe mostrar workspaces recientes en un área persistente.

**FR-005.** El usuario debe poder eliminar un workspace de DiffScribe sin eliminar archivos del disco.

**FR-006.** DiffScribe debe detectar cuando una ruta dejó de existir o dejó de contener un repositorio válido.

**FR-007.** Cada workspace debe conservar su configuración de contexto y revisiones.

---

### 11.2. Integración con Git

**FR-010.** DiffScribe debe detectar el estado Git del workspace.

**FR-011.** Debe mostrar working tree contra HEAD como comparación predeterminada.

**FR-012.** Debe soportar staged y unstaged por separado.

**FR-013.** Debe permitir seleccionar ramas y commits como base u objetivo.

**FR-014.** Debe ofrecer búsqueda o filtrado de ramas y commits.

**FR-015.** Debe mostrar una descripción inequívoca de la comparación activa.

**FR-016.** Debe permitir actualizar el diff cuando cambia el repositorio.

**FR-017.** Debe advertir cuando una revisión está basada en un estado que cambió desde su creación.

**FR-018.** Debe conservar suficiente información para identificar la comparación utilizada posteriormente.

**FR-019.** La primera versión será de solo lectura respecto de Git: no creará commits, ramas ni modificaciones sobre archivos.

---

### 11.3. Visualización del diff

**FR-020.** La interfaz debe mostrar archivos modificados en una lista navegable.

**FR-021.** Debe indicar el estado del archivo: agregado, modificado, eliminado, renombrado o binario.

**FR-022.** Debe soportar diffs unificados.

**FR-023.** Debe soportar diffs lado a lado.

**FR-024.** Debe aplicar resaltado de sintaxis cuando el lenguaje sea reconocido.

**FR-025.** Debe ofrecer una representación legible cuando el lenguaje no sea reconocido.

**FR-026.** Debe soportar repositorios con una variedad amplia de lenguajes sin depender de analizadores específicos por defecto.

**FR-027.** Debe permitir plegar bloques sin cambios.

**FR-028.** Debe permitir marcar archivos como revisados.

**FR-029.** Debe conservar el progreso de navegación y revisión.

**FR-030.** Debe ofrecer navegación eficiente mediante teclado.

**FR-031.** Debe permitir filtrar archivos por nombre, ruta y estado.

**FR-032.** Debe detectar y tratar de forma diferenciada archivos binarios y archivos demasiado grandes.

---

### 11.4. Observaciones

**FR-040.** El usuario debe poder seleccionar un rango de líneas dentro del diff.

**FR-041.** Debe poder crear una observación vinculada a esa selección.

**FR-042.** Debe poder crear observaciones a nivel archivo o revisión.

**FR-043.** Debe poder editar o eliminar observaciones.

**FR-044.** Debe poder clasificar observaciones por tipo.

**FR-045.** Debe poder asignar severidad cuando corresponda.

**FR-046.** Debe poder marcar observaciones como resueltas, descartadas o pendientes.

**FR-047.** Debe permitir comentarios positivos, no solamente problemas.

**FR-048.** Debe mantener una referencia al fragmento revisado aunque el diff visible se actualice.

**FR-049.** Debe advertir si una observación apunta a código que cambió posteriormente.

**FR-050.** Debe permitir ordenar y agrupar observaciones.

---

### 11.5. Asistencia de IA

**FR-060.** El uso de IA debe ser opcional.

**FR-061.** El usuario debe poder redactar todas las observaciones sin configurar un modelo.

**FR-062.** La herramienta debe poder sugerir una redacción a partir de una selección.

**FR-063.** Debe poder reformular una observación existente.

**FR-064.** Debe poder transformar una observación en una instrucción para un agente.

**FR-065.** Debe poder resumir un grupo de observaciones relacionadas.

**FR-066.** Debe poder ayudar a producir el resumen ejecutivo de la revisión.

**FR-067.** Toda salida generada debe ser editable.

**FR-068.** Ninguna sugerencia debe incorporarse automáticamente al reporte final.

**FR-069.** La interfaz debe distinguir claramente texto escrito por el usuario de texto sugerido por IA hasta que sea confirmado.

**FR-070.** La herramienta debe mostrar qué contexto será enviado al modelo antes o durante una operación.

**FR-071.** La configuración del proveedor y modelo debe conservarse localmente.

**FR-072.** La primera versión debe permitir una capa de integración desacoplada del proveedor específico.

---

### 11.6. Contexto del proyecto

**FR-080.** DiffScribe debe buscar automáticamente archivos `AGENTS.md` relevantes.

**FR-081.** Los archivos `AGENTS.md` detectados deben estar habilitados por defecto como contexto.

**FR-082.** El usuario debe poder deshabilitarlos.

**FR-083.** La interfaz debe mostrar claramente todos los elementos de contexto activos.

**FR-084.** El usuario debe poder seleccionar archivos adicionales.

**FR-085.** El usuario debe poder seleccionar directorios completos.

**FR-086.** El usuario debe poder definir patrones de inclusión y exclusión.

**FR-087.** El usuario debe poder agregar reglas manuales.

**FR-088.** La configuración debe persistir por workspace.

**FR-089.** El contexto debe utilizarse solamente para funciones asistidas, salvo que una función indique explícitamente lo contrario.

**FR-090.** DiffScribe debe advertir sobre contextos excesivamente grandes.

**FR-091.** El usuario debe poder inspeccionar qué fragmentos serán utilizados en una solicitud.

**FR-092.** La selección de contexto no debe implicar que todo el contenido será enviado siempre; la herramienta podrá seleccionar fragmentos relevantes de manera transparente.

**FR-093.** La primera versión no necesita interpretar sistemas arbitrarios de skills o herramientas de agentes.

---

### 11.7. Búsqueda de ocurrencias similares

**FR-100.** El usuario debe poder iniciar una búsqueda desde una observación.

**FR-101.** La búsqueda debe poder considerar texto, código, descripción y contexto.

**FR-102.** Los resultados deben presentarse como candidatos, no como hallazgos confirmados.

**FR-103.** Cada resultado debe explicar brevemente por qué fue sugerido.

**FR-104.** El usuario debe poder confirmar, rechazar o ignorar candidatos.

**FR-105.** Las ocurrencias confirmadas deben poder agruparse en una única observación.

**FR-106.** El usuario debe poder convertir una ocurrencia en una observación independiente.

**FR-107.** La búsqueda debe poder limitarse al diff o ampliarse al repositorio.

**FR-108.** La herramienta debe evitar presentar grandes cantidades de resultados sin priorización.

---

### 11.8. Historial de revisiones

**FR-110.** Cada workspace debe conservar un historial de reviews.

**FR-111.** El historial debe mostrar estado, fecha, comparación y cantidad de observaciones.

**FR-112.** El usuario debe poder buscar revisiones anteriores.

**FR-113.** Debe poder filtrar por estado, rama, commit o fecha.

**FR-114.** Debe poder abrir una revisión completada.

**FR-115.** Debe poder duplicar una revisión como punto de partida.

**FR-116.** Debe poder archivar o eliminar una revisión.

**FR-117.** La eliminación debe requerir confirmación.

**FR-118.** Una review debe poder distinguirse aunque analice una comparación similar a otra.

---

### 11.9. Review package y exportación

**FR-120.** DiffScribe debe generar una vista de resumen antes de exportar.

**FR-121.** El usuario debe poder editar el contenido del reporte.

**FR-122.** Debe poder excluir observaciones del resultado sin borrarlas.

**FR-123.** Debe generar Markdown.

**FR-124.** Debe generar JSON estructurado.

**FR-125.** Debe permitir copiar un bloque de instrucciones para agentes.

**FR-126.** Debe conservar las referencias a archivos y líneas cuando sea posible.

**FR-127.** Debe permitir agrupar por severidad, archivo, categoría o tema.

**FR-128.** Debe incluir observaciones positivas cuando el usuario lo elija.

**FR-129.** Debe permitir exportar la revisión completa o solamente las instrucciones.

**FR-130.** El formato JSON debe ser suficientemente estable para futuras integraciones.

---

## 12. Requisitos de experiencia de usuario

### 12.1. Estructura general

La interfaz se organiza en tres zonas más un rail izquierdo:

1. **Rail izquierdo:** íconos de navegación global (Lucide), fijo.
2. **Panel contextual:** tres tabs — Workspaces, Project (árbol read‑only +
   source view), Git (comparación y diff).
3. **Zona central:** Diff Viewer o Source View según el tab activo.
4. **Panel derecho:** dos tabs — Comments (observaciones) y Review (progreso).

El resumen de revisión puede utilizar una vista separada. Todos los paneles son
colapsables y redimensionables.

### 12.2. Navegación global

El menú global debe permitir:

* cambiar de workspace;
* abrir una review;
* iniciar una review;
* consultar historial;
* acceder a contexto;
* configurar proveedores;
* acceder a preferencias.

### 12.3. Jerarquía de información

El usuario debe poder responder permanentemente:

* ¿En qué repositorio estoy?
* ¿Qué comparación estoy viendo?
* ¿Qué archivo estoy revisando?
* ¿Qué parte del diff está seleccionada?
* ¿Cuántas observaciones existen?
* ¿Qué archivos ya revisé?
* ¿Qué contexto está activo?
* ¿La asistencia de IA está habilitada?
* ¿La revisión está actualizada respecto del repositorio?

### 12.4. Interacciones rápidas

Las acciones frecuentes deben tener atajos:

* archivo siguiente y anterior;
* siguiente cambio;
* marcar archivo como revisado;
* crear observación;
* abrir panel de observaciones;
* buscar archivo;
* cambiar modo de diff;
* abrir resumen.

### 12.5. Uso móvil y desktop

La interfaz debe ser funcional desde el primer momento tanto en desktop como en
dispositivos móviles. El diseño adopta mobile-first: la experiencia en pantallas
pequeñas (compact) es usable y completa, y las capacidades se expanden
progresivamente en tablet, desktop y wide.

No se sacrifica la revisión profunda en desktop para acomodar móvil, pero
tampoco se pospone la experiencia móvil a una etapa posterior. Ambos tamaños
son parte del diseño inicial.

---

## 13. Privacidad y seguridad

### 13.1. Principios

* El código permanece local salvo acciones explícitas.
* Ningún repositorio se sube automáticamente.
* El usuario debe conocer qué contenido se envía a un proveedor.
* Las credenciales deben almacenarse de manera segura.
* Los logs no deben contener código ni secretos por defecto.

### 13.2. Proveedores de IA

Antes de enviar una solicitud, DiffScribe debe poder identificar:

* proveedor;
* modelo;
* fragmento de código;
* observación;
* archivos de contexto;
* instrucciones adicionales.

La herramienta debe advertir que los datos enviados estarán sujetos a las políticas del proveedor configurado.

### 13.3. Secretos

DiffScribe debe intentar evitar el envío accidental de:

* archivos de entorno;
* claves privadas;
* tokens;
* credenciales;
* archivos excluidos explícitamente;
* rutas sensibles.

La detección no debe presentarse como garantía de seguridad.

### 13.4. Exposición de red

El servidor local debe escuchar únicamente en loopback por defecto.

La exposición a la red local debe ser una acción explícita y acompañarse de una advertencia.

---

## 14. Requisitos no funcionales

### Rendimiento

* La interfaz debe seguir siendo utilizable con diffs grandes.
* El cambio entre archivos comunes debe sentirse inmediato.
* Las operaciones costosas deben ejecutarse de forma progresiva.
* El procesamiento de un repositorio no debe bloquear toda la interfaz.
* Los resultados parciales deben mostrarse cuando sea posible.

### Compatibilidad

* Debe funcionar inicialmente en macOS, Linux y Windows.
* Debe soportar repositorios Git estándar.
* Debe funcionar en navegadores modernos basados en Chromium, Firefox y Safari.
* La instalación no debe requerir un runtime distinto de Node.js y las dependencias declaradas.

### Persistencia

* La información debe conservarse entre ejecuciones.
* Las escrituras deben ser resilientes a cierres inesperados.
* Debe existir una estrategia de migración de datos entre versiones.
* Los datos deben poder exportarse o respaldarse.

### Accesibilidad

* Las acciones principales deben ser utilizables con teclado.
* El diff no debe depender exclusivamente del color.
* Los controles deben tener nombres accesibles.
* El contraste debe ser adecuado para sesiones prolongadas.

### Extensibilidad

* La integración con modelos debe ser desacoplada.
* El formato de exportación debe permitir futuras integraciones.
* La capa de Git debe poder ampliarse sin cambiar el modelo de producto.
* El sistema de resaltado debe admitir lenguajes adicionales.

---

## 15. Restricciones técnicas definidas

### Aplicación

DiffScribe se implementará como una aplicación SvelteKit.

La aplicación combinará:

* interfaz web;
* servidor local;
* acceso al sistema de archivos;
* acceso al repositorio Git;
* persistencia local;
* integraciones opcionales con modelos.

SvelteKit permite construir aplicaciones web completas y utiliza Vite como base del proyecto. La elección deberá mantenerse alineada con las APIs y prácticas vigentes del framework.

### Distribución npm

DiffScribe se publicará como un paquete npm ejecutable.

La experiencia esperada será equivalente a:

```bash
npx diffscribe
```

o, después de una instalación global:

```bash
npm install --global diffscribe
diffscribe
```

El comando debe:

1. validar el entorno;
2. iniciar el servidor local;
3. seleccionar un puerto disponible;
4. mostrar la URL;
5. opcionalmente abrir el navegador;
6. detenerse correctamente al recibir una señal de cierre.

La publicación como paquete ejecutable es una decisión distinta de la capacidad de SvelteKit para empaquetar librerías de componentes. La documentación de SvelteKit distingue la construcción de aplicaciones de su sistema de packaging para librerías, por lo que DiffScribe deberá definir su propio empaquetado del servidor y su binario npm.

### Modos de ejecución previstos

```bash
diffscribe
diffscribe --port 4173
diffscribe --host 127.0.0.1
diffscribe --open
diffscribe /ruta/al/repositorio
```

Los nombres concretos de flags pueden cambiar durante el diseño técnico.

### Nombre de paquete

El nombre preferido es:

```text
diffscribe
```

Antes de publicar deberá verificarse la disponibilidad del nombre en npm y de los identificadores asociados en GitHub y otros canales relevantes.

---

## 16. Modelo conceptual inicial

### Workspace

```text
id
displayName
repositoryPath
createdAt
lastOpenedAt
contextConfiguration
preferences
```

### Review

```text
id
workspaceId
title
status
comparison
createdAt
updatedAt
completedAt
observations
reviewedFiles
contextSnapshot
generatedReport
```

### Comparison

```text
base
target
comparisonType
baseCommit
targetCommit
workingTreeState
createdAt
```

### Observation

```text
id
reviewId
type
severity
status
title
body
agentInstruction
filePath
lineRange
diffSnapshot
occurrences
createdAt
updatedAt
origin
```

### Context source

```text
id
workspaceId
type
pathOrPattern
enabled
autoDetected
priority
```

Estos modelos son conceptuales y no constituyen una definición de base de datos.

---

## 17. Casos de uso prioritarios

### Caso A: Revisión del working tree generado por un agente

Un ingeniero le pide a un agente implementar una funcionalidad. El agente modifica veinte archivos.

El ingeniero abre DiffScribe, selecciona el workspace y revisa working tree contra HEAD.

Encuentra:

* una abstracción innecesaria;
* una validación faltante;
* tres casos donde se repite el mismo patrón;
* una decisión de implementación especialmente buena.

Registra las observaciones, busca ocurrencias similares y genera instrucciones para la siguiente iteración.

### Caso B: Revisión desde un commit anterior

El agente realizó varios commits durante una sesión.

El ingeniero quiere evaluar todo el trabajo desde el último punto conocido como correcto.

Selecciona ese commit como base y compara contra el estado actual.

La review conserva esa comparación aunque la rama continúe avanzando.

### Caso C: Revisión informada por reglas del repositorio

El repositorio contiene un `AGENTS.md`, una guía de arquitectura y convenciones internas.

DiffScribe detecta `AGENTS.md`. El usuario agrega los documentos de arquitectura al contexto del workspace.

Cuando solicita ayuda para redactar una observación, la sugerencia considera esas reglas.

### Caso D: Historial y trazabilidad

Semanas después, el ingeniero quiere recordar por qué había rechazado una estrategia concreta.

Abre el historial del workspace, encuentra la review y consulta las observaciones, el diff original y las instrucciones exportadas.

---

## 18. Etapas de entrega

Las etapas organizan el desarrollo. No representan productos desechables.

### Etapa 1 — Workbench de revisión

Incluye:

* instalación por npm;
* servidor local;
* workspaces persistentes;
* integración Git;
* selector de comparación;
* lista de archivos;
* tree read‑only completo del repositorio (tab Project);
* source view con syntax highlighting y marcadores de líneas Git (tab Project);
* diff unificado y lado a lado (tab Git);
* resaltado de sintaxis;
* observaciones manuales;
* progreso por archivo;
* historial básico;
* exportación Markdown y JSON;
* rail izquierdo + panel contextual con tabs Workspaces/Project/Git;
* panel derecho con Comments/Review;
* paneles colapsables y redimensionables;
* dos temas globales: Dark Deep (predeterminado) y Synthwave '84';
* experiencia funcional en desktop y mobile desde el inicio.

**Resultado:** DiffScribe ya es útil sin IA.

### Etapa 2 — Asistencia contextual

Incluye:

* configuración de proveedores;
* detección de `AGENTS.md`;
* contexto configurable;
* redacción asistida;
* reformulación;
* generación de instrucciones;
* resumen de revisión;
* controles de privacidad.

**Resultado:** Se completa el flujo de copiloto.

### Etapa 3 — Búsqueda y agrupación

Incluye:

* búsqueda textual de ocurrencias;
* búsqueda ampliada al repositorio;
* sugerencias asistidas por modelo;
* explicación de similitud;
* confirmación manual;
* agrupación de ocurrencias;
* síntesis de patrones.

**Resultado:** DiffScribe ayuda a escalar revisiones profundas.

### Etapa 4 — Refinamiento operativo

Incluye:

* mejoras para diffs muy grandes;
* migraciones de almacenamiento;
* respaldo y exportación de datos;
* theming;
* accesibilidad avanzada;
* sistema de extensiones o integraciones, si existe demanda;
* preparación para contribuciones externas.

---

## 19. Criterios de éxito

Como DiffScribe nace primero como herramienta de uso propio, las métricas iniciales deben evaluar utilidad real, no adquisición de mercado.

### Indicadores principales

* El usuario realiza revisiones completas dentro de DiffScribe.
* El usuario vuelve a utilizar revisiones anteriores.
* El reporte exportado puede entregarse a un agente sin reescritura significativa.
* La herramienta reduce el cambio constante entre Git, editor, notas y agente.
* El usuario puede revisar un conjunto grande de cambios sin perder su progreso.
* Las observaciones permanecen vinculadas al código correcto.
* La búsqueda de similares encuentra candidatos útiles sin inundar al usuario.
* El contexto del proyecto mejora la calidad de las sugerencias.
* La herramienta sigue siendo valiosa con la IA deshabilitada.

### Preguntas cualitativas

* ¿DiffScribe mejora la calidad del feedback?
* ¿Hace más fácil revisar grandes cantidades de código?
* ¿Ayuda a detectar patrones repetidos?
* ¿Reduce observaciones olvidadas o ambiguas?
* ¿El review package produce mejores iteraciones del agente?
* ¿El historial aporta valor después de varios días o semanas?
* ¿La asistencia se siente controlable o invasiva?

---

## 20. Riesgos de producto

### Riesgo: convertirse en otro AI reviewer

**Mitigación:** mantener el flujo manual como centro y presentar la IA únicamente en acciones explícitas.

### Riesgo: intentar comprender todo el repositorio

**Mitigación:** contexto configurable, selección visible y carga progresiva.

### Riesgo: sobrecargar la interfaz

**Mitigación:** mantener una jerarquía clara entre diff, observaciones y asistencia.

### Riesgo: diffs demasiado grandes

**Mitigación:** virtualización, carga progresiva, filtros y procesamiento por archivo.

### Riesgo: referencias obsoletas

El repositorio puede cambiar durante una review.

**Mitigación:** conservar snapshots, hashes y advertencias de desactualización.

### Riesgo: enviar código sensible

**Mitigación:** local-first, vista previa de contexto, exclusiones y proveedores opcionales.

### Riesgo: metáfora incorrecta del producto

Si se promociona como revisión automática, atraerá usuarios con expectativas contrarias al diseño.

**Mitigación:** usar consistentemente los conceptos de workbench, manual review y engineering judgment.

### Riesgo: ampliar demasiado el alcance

Integraciones con plataformas, colaboración, edición y auto-fix pueden diluir el núcleo.

**Mitigación:** evaluar toda función según si mejora directamente el ciclo de revisión humana.

---

## 21. Preguntas abiertas

Estas preguntas no bloquean la definición del producto, pero deberán resolverse durante el diseño:

1. ¿Las revisiones se almacenarán dentro del repositorio, fuera de él o mediante una opción configurable?

2. ¿Debe existir un archivo portable de revisión que pueda versionarse?

3. ¿Cómo se identificará una línea cuando el archivo cambie después de crear la observación?

4. ¿Qué proveedores de modelos se soportarán inicialmente?

5. ¿Se permitirá usar modelos locales desde la primera versión?

6. ¿La búsqueda de similares utilizará primero métodos determinísticos y luego IA?

7. ¿Qué límites se aplicarán a archivos y diffs grandes?

8. ¿Cómo se representarán submódulos, monorepos y repositorios anidados?

9. ¿Cómo se resolverá la precedencia de varios archivos `AGENTS.md`?

10. ¿Las observaciones tendrán etiquetas personalizadas desde el inicio?

11. ¿Se soportarán plantillas configurables para los review packages?

12. ¿Conviene persistir un snapshot completo del diff o solo referencias y fragmentos?

13. ¿Cómo deberá comportarse DiffScribe cuando el repositorio cambie mientras la web está abierta?

14. ¿El paquete npm incluirá todos los assets necesarios o descargará componentes durante la primera ejecución?

15. ¿Será necesario ofrecer una distribución alternativa para usuarios sin Node.js?

---

## 22. Decisiones tomadas

* El producto se llama **DiffScribe**.
* Será open source.
* Será una aplicación web local.
* Se implementará con SvelteKit.
* Se distribuirá inicialmente como paquete npm ejecutable.
* Tendrá múltiples workspaces persistentes.
* Trabajará directamente con repositorios Git locales.
* Permitirá comparar working tree, staged, ramas y commits.
* Guardará revisiones anteriores.
* La revisión será manual.
* La IA será opcional y asistirá acciones puntuales.
* `AGENTS.md` se detectará y activará como contexto por defecto.
* El contexto del proyecto será visible, editable y desactivable.
* El usuario podrá sumar archivos y directorios al contexto.
* Existirá búsqueda asistida de ocurrencias similares.
* Las ocurrencias requerirán confirmación humana.
* El artefacto principal será un review package exportable.
* La primera versión no editará código ni realizará auto-fix.
* La primera versión no dependerá de GitHub, GitLab ni de un proveedor de IA específico.
* **UI redesign v1:** el layout principal usa un rail izquierdo con íconos Lucide
  y un panel contextual con tabs Workspaces, Project y Git. El panel derecho
  contiene Comments y Review. Ambos paneles son colapsables y redimensionables.
* **Temas:** Dark Deep es el tema predeterminado. Synthwave '84' es el segundo
  tema global. La preferencia se almacena en `localStorage` (client‑only).
* **Project tree:** árbol read‑only completo del repositorio activo en el tab
  Project. Al abrir un archivo se muestra el Source View: fuente completa con
  syntax highlighting y marcadores de líneas afectadas por Git, sin diff.
* **Desktop y mobile:** la interfaz es funcional desde el primer momento en ambos
  tamaños. El diseño es mobile-first.
* **Límites de Etapa 1:** sin edición, auto‑fix, mutación Git, proveedores
  remotos, IA, colaboración ni sync cross-device.
 * **Etapa 1 completada (Inc‑1 a Inc‑5):** workbench con registro de workspaces, panel de contexto Git (branches/commits/comparación), file list con filtrado y selección, y diff viewer con resaltado Shiki (unified parser custom, hard cap 256 KB/5 000 líneas, side‑by‑side >=900 px, navegación de hunks, shortcut Ctrl+Shift+D). Endpoint seguro `GET /api/workspaces/[id]/file-diff`. Sin IA, sin colaboración, sin mutación de repositorio.
 * **Inc‑6 (Review Foundation):** Review aggregate con ReviewId UUID, ReviewStatus (draft/in_progress/completed/archived), captura de ComparisonSerialized con validación. Migraciones SQL 001‑004 ordenadas con `import.meta.glob`, transacción por migración y `PRAGMA foreign_keys = ON`. Tablas `reviews` y `review_files` con FK CASCADE. Repositorio SQLite con mapper Comparison↔JSON y marcas dinámicas sin inventario total. Casos de uso: create draft, list/reopen, get, set active, mark, unmark, complete. Review completada es read‑only (409 en mark/unmark). Active review en `app_state` key `active_review:<workspaceId>`. REST endpoints bajo `/api/workspaces/[id]/reviews/...`. Panel ReviewPanel con New/Complete/Mark/Unmark, progreso reactivo N/M, confirmación de completado, listado y reopen, keyboard/ARIA/reduced‑motion. Marcador visual de revisado en file‑list cuando hay active review. Propagación de Comparison unificada entre GitContextPanel, DiffViewer y Review. Eliminación de workspace limpia clave active_review y datos por FK cascade. Sin Observation, snapshots, stale detection, portable/export, CLI, IA, colaboración, ni delete individual de review.
  * **Inc‑7 (Observations):** Observation aggregate con CRUD completo. Tipos issue/risk/suggestion/question/praise/note. Severidad critical/major/minor/nitpick. Estados open/resolved/dismissed/pending con reopen. Scope review/file/range-level. Snapshot híbrido: comparison_snapshot_json (siempre) + diff_snapshot/content_hash SHA-256 canónico (solo file/range). StaleStatus derivado bajo demanda (9 estados). Migración 005, FK CASCADE, CHECKs, índices. REST: CRUD + status transition. Panel responsive right rail (>=1100px) / drawer (<1100px). Form client-side SHA-256 via Web Crypto. Line selection en diff-viewer con ARIA. Guards: completed 409, binary range 422, ownership, cascade. Sin multi-file/tags/AI/remap/polling/export/CLI/Review delete.

---

## 23. Propuesta de mensaje de producto

### Descripción breve

**DiffScribe is a local engineering review workbench for agent-generated code.**

### Descripción ampliada

**Inspect Git changes, record engineering observations, find related occurrences and produce actionable review packages for your coding agents—without giving up human judgment.**

### Principio comunicacional

**The agent writes. You review. DiffScribe records the judgment.**
