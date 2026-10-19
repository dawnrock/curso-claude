---
name: plan-feature
description: Planifica un nuevo desarrollo, una corrección de un error o un refactor antes de escribir código. Genera un plan con objetivo, tareas pequeñas (5-10 min cada una) y criterios de aceptación, siguiendo la plantilla template.md. Úsala cuando el usuario pida planificar, diseñar o desglosar una funcionalidad, un fix o un refactor.
argument-hint: <descripción del desarrollo, fix o refactor>
allowed-tools: Read, Grep, Glob, Write, AskUserQuestion, Bash(git status:*), Bash(git log:*), Bash(git diff:*), Bash(ls:*), Bash(find:*), mcp__slack__slack_list_channels, mcp__slack__slack_post_message
---

Planifica el trabajo descrito por el usuario. **No implementes nada**: el resultado de esta skill es solo el plan.

Petición del usuario: $ARGUMENTS

## Pasos

### 1. Entender la petición

- Clasifícala como `feature` (nuevo desarrollo), `fix` (corrección) o `refactor`.
- Si la petición está vacía o es ambigua en algo que cambie el plan (qué endpoint, qué comportamiento esperado, qué queda fuera), pregunta con `AskUserQuestion` antes de seguir. No preguntes lo que puedas averiguar leyendo el código.

### 2. Analizar el código

- Relee las convenciones de `CLAUDE.md`: capas `routes → controllers → services → repositories → models`, clases con métodos en `snake_case`, errores con `HttpError`, solo dependencias nativas de Node salvo `express`.
- Localiza los archivos afectados y léelos. Para un `fix`, identifica la causa probable y dónde se manifiesta.
- Si el trabajo toca algo documentado en `docs/` (por ejemplo paginación → `docs/api/api-pagination.md`), léelo y aplica esa convención en el plan.
- Determina si el trabajo **toca la API**: añade, quita o cambia rutas, roles (`authorize()`), cuerpos de petición o respuesta, parámetros de ruta o query, códigos de estado o errores que mapea `errorHandler`. Si es así, lee `docs/api/openapi.yaml` (el contrato de la API) y localiza las operaciones y esquemas afectados.

### 3. Desglosar en tareas

Cada tarea debe poder hacerse en **5-10 minutos**. Reglas para conseguirlo:

- Una tarea toca, como norma, **una sola capa** y uno o dos archivos.
- Cada tarea deja el proyecto en un estado que arranca (`npm start`) y produce un resultado verificable por sí misma.
- Si una tarea necesita más de ~5 pasos o más de 2 archivos, divídela.
- Ordena las tareas de abajo arriba siguiendo las capas (models → repositories → services → controllers → routes) y deja explícitas las dependencias entre ellas.
- Para un `fix`, la primera tarea es reproducir el error (un test con `node:test` o una petición `curl` que falle). Para un `refactor`, la primera es fijar el comportamiento actual que no debe cambiar.
- Si la tarea añade o cambia comportamiento, incluye el test correspondiente (`node:test` + `node:assert`) en esa misma tarea o en la siguiente.
- Si el trabajo toca la API, incluye **siempre** una tarea de capa `docs` justo después de la última tarea de `controllers`/`routes`, con este contenido:
  - **Archivos:** `docs/api/openapi.yaml` y `docs/api/index.html`.
  - **Qué hacer:** reflejar en el `openapi.yaml` las operaciones, esquemas, roles y códigos de estado afectados y regenerar el HTML con `npm run docs:api`. El `index.html` es generado: nunca se edita a mano.
  - **Criterios:** `npm run docs:api` termina sin errores, y una petición `curl` a cada operación cambiada devuelve el código de estado y la forma de respuesta documentados.

### 4. Definir los criterios de aceptación

- **Por tarea**: 1-3 criterios concretos y comprobables que indican que la tarea está terminada (un comando, una petición con su respuesta y código de estado esperados, un test que pasa).
- **Globales**: lo que debe cumplirse para dar por aceptado el desarrollo completo. Incluye siempre los criterios fijos de la plantilla (convenciones, arranque, sin dependencias nuevas) además de los específicos del trabajo. Si el trabajo toca la API, el criterio fijo de OpenAPI es obligatorio; si no la toca, márcalo como "no aplica".
- Evita criterios vagos como "funciona bien" o "código limpio": cada criterio debe poder marcarse como cumplido o no sin discusión.

### 5. Escribir el plan

- Rellena la plantilla [template.md](template.md) respetando su estructura y sus secciones. Elimina los comentarios de ayuda (`<!-- ... -->`) en el resultado.
- Guarda el plan en `docs/plans/AAAA-MM-DD-<slug>.md` (fecha de hoy, slug corto en kebab-case en inglés, por ejemplo `docs/plans/2026-10-19-paginate-vendehumos.md`).
- El plan se redacta en español; los nombres de archivos, clases, métodos y fragmentos de código, en inglés.

### 6. Avisar en Slack

Cuando el plan esté guardado, avisa en el canal de Slack `revisar-plan` de que está listo para revisarse:

1. Obtén el ID del canal con `mcp__slack__slack_list_channels` (busca el canal llamado `revisar-plan`).
2. Publica con `mcp__slack__slack_post_message` un mensaje breve en español, por ejemplo:
   > :memo: Plan listo para revisar: *<título del plan>* (`<tipo>`)
   > Archivo: `docs/plans/AAAA-MM-DD-<slug>.md`
   > Objetivo: <objetivo en una frase>. Tareas: <n> (~<estimación total>).
3. Si el canal no existe o la publicación falla, no bloquees la skill: continúa y menciónalo al usuario en el resumen.

### 7. Presentarlo

- Muestra al usuario un resumen: objetivo, número de tareas con su título y estimación total, y ruta del archivo.
- Indica si se avisó en `#revisar-plan` o si el aviso falló.
- Señala las preguntas abiertas o riesgos si los hay.
- Pregunta si quiere ajustar algo o empezar con la primera tarea. No empieces a implementar sin su confirmación.
