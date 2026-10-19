---
name: implement-plan
description: Implementa un plan de docs/plans/ (generado con plan-feature) en un git worktree aislado, tarea a tarea, con TDD estricto. Cada tarea terminada se commitea y se marca como hecha en el plan, hasta cumplir los criterios de aceptación globales. Úsala cuando el usuario pida implementar, ejecutar o llevar a cabo un plan.
argument-hint: <ruta del plan, p. ej. docs/plans/2026-10-19-error-handler-middleware.md>
allowed-tools: Read, Grep, Glob, Edit, Write, AskUserQuestion, Bash(git:*), Bash(npm:*), Bash(node:*), Bash(curl:*), Bash(ls:*), Bash(cp:*), Bash(cat:*), Bash(source:*), mcp__slack__slack_list_channels, mcp__slack__slack_post_message
---

Implementa el plan indicado por el usuario siguiendo el proceso de abajo. El plan es la fuente de verdad: no añadas trabajo que no esté en él ni te saltes tareas.

Plan: $ARGUMENTS

## Pasos

### 1. Cargar el plan

- Si no se indica ruta, busca en `docs/plans/` los planes con `**Estado:**` distinto de `completado`. Si hay uno, úsalo; si hay varios, pregunta con `AskUserQuestion`.
- Lee el plan completo y relee `CLAUDE.md` (capas, clases con métodos en `snake_case`, `HttpError`, solo dependencias nativas salvo `express`).
- Si el plan tiene preguntas abiertas que bloquean alguna tarea, resuélvelas con el usuario **antes** de crear el worktree.

### 2. Crear el git worktree

- Slug = nombre del archivo del plan sin la fecha ni `.md` (p. ej. `error-handler-middleware`). Rama `<tipo>/<slug>` según el `**Tipo:**` del plan (`feat`, `fix` o `refactor`).
- Ruta: `.claude/worktrees/<slug>` dentro del repo principal.
- `.claude/worktrees/` debe estar en el `.gitignore` del repo principal para que el worktree no aparezca en su `git status`. Si no lo está, añade la línea en el árbol de trabajo del repo principal (sin commitearla) y avísalo en el informe final.
- Si el worktree ya existe para esta rama, **reutilízalo** y continúa desde la primera tarea sin marcar (`### [ ]`). Si no:
  ```bash
  git worktree add -b <tipo>/<slug> .claude/worktrees/<slug> HEAD
  ```
- Antes de crearlo, revisa `git status` del repo principal:
  - Si el plan está sin commitear, cópialo al worktree y haz un primer commit `docs: add <slug> plan`.
  - Si hay otros cambios sin commitear que el plan necesita (p. ej. un script en `package.json`), pregunta al usuario si los llevas al worktree en el commit de la primera tarea. No toques el árbol de trabajo del repo principal.
- Prepara el worktree: `npm install` y copia `.env` del repo principal si existe (está en `.gitignore`, no se commitea).
- Node está instalado con nvm: si `node` no está en el `PATH`, ejecuta `source ~/.nvm/nvm.sh` antes de los comandos.
- A partir de aquí, **todo** (lecturas, ediciones, comandos, commits) se hace dentro del worktree. Como el worktree está dentro del repo principal, comprueba que las rutas absolutas incluyen `.claude/worktrees/<slug>/` antes de editar: es fácil tocar por error el archivo homónimo del repo principal.
- Cambia `**Estado:**` del plan a `en curso`.

### 3. Implementar cada tarea con TDD estricto

Toma las tareas en orden, de una en una, respetando `**Depende de:**`. No empieces una tarea hasta haber commiteado la anterior.

Para cada tarea:

1. **Rojo.** Escribe primero el test (`node:test` + `node:assert`, en `test/`) que expresa el comportamiento o criterio de la tarea. Ejecuta `npm test` y confirma que **falla por el motivo esperado** (aserción incumplida o módulo inexistente, no un error de sintaxis del propio test).
2. **Verde.** Escribe el código mínimo para que pase. Ejecuta `npm test`: deben pasar el test nuevo y **todos** los anteriores.
3. **Refactor.** Limpia el código (convenciones de `CLAUDE.md`, nombres, duplicados) sin cambiar comportamiento y vuelve a ejecutar `npm test`.
4. **Criterios de la tarea.** Comprueba uno a uno sus criterios de aceptación (comandos, `curl`, etc.) y marca cada uno como `- [x]` solo si se cumple de verdad.

Casos especiales:

- **Tests de caracterización** (fijar el comportamiento actual antes de un refactor) o tests sobre código que ya existe: pasarán a la primera. Demuestra que pueden fallar rompiendo temporalmente el código (cambiar un status o un mensaje), viendo el rojo y revirtiendo. Indícalo en el resumen de la tarea.
- **Si el plan pone los tests en una tarea posterior a la implementación**, adelanta esos tests: escríbelos en rojo al principio de la tarea que implementa el código. En la tarea de tests, completa lo que falte y verifica sus criterios.
- **Tareas sin comportamiento testeable** (documentación, `CLAUDE.md`, configuración): el ciclo rojo/verde se sustituye por verificar los criterios de aceptación de la tarea, más `npm test` para confirmar que nada se ha roto.

### 4. Cerrar la tarea: marcar y commitear

1. En el plan del worktree, cambia `### [ ] Tn` por `### [x] Tn` y deja marcados sus criterios.
2. Haz **un commit por tarea** que incluya el código, los tests y la actualización del plan:
   - Usa la skill `commit` si está disponible; si no, Conventional Commits en inglés (`test:`, `feat:`, `fix:`, `refactor:`, `docs:`...).
   - El cuerpo del mensaje referencia la tarea: `Plan task Tn: <título>`.
   - Añade solo los archivos de la tarea (`git add <rutas>`), nunca `git add -A` a ciegas.
3. Pasa a la siguiente tarea.

### 5. Si algo se tuerce

- Si un test no se puede poner en verde sin salirte del plan, si un criterio no se puede cumplir o si el plan resulta incorrecto, **para** y explica el problema al usuario con `AskUserQuestion` (opciones: ajustar el plan, cambiar el enfoque, saltar la tarea). No marques como hecho algo que no lo está.
- No uses `--no-verify`, no hagas `git reset --hard` ni reescribas commits ya hechos sin permiso.

### 6. Criterios de aceptación globales

Cuando todas las tareas estén marcadas:

1. Comprueba cada criterio global (específicos y fijos): `npm test`, `npm start` + `curl localhost:<PORT>/health`, revisión de capas y convenciones, `git diff <rama-base>... -- package.json` para confirmar que no hay dependencias nuevas. Para el arranque, lanza el servidor en segundo plano y detenlo al acabar.
2. Marca cada criterio cumplido. Si alguno falla, trátalo como en el paso 5.
3. Cambia `**Estado:**` a `completado` y haz un commit final `docs: complete <slug> plan`.

### 7. Avisar en Slack

Cuando todas las tareas y los criterios globales estén cumplidos y commiteados, avisa en el canal de Slack `revisar-plan` de que la implementación está lista para revisarse:

1. Obtén el ID del canal con `mcp__slack__slack_list_channels` (busca el canal llamado `revisar-plan`).
2. Publica con `mcp__slack__slack_post_message` un mensaje breve en español, por ejemplo:
   > :white_check_mark: Implementación lista para revisar: *<título del plan>*
   > Rama: `<tipo>/<slug>` · Plan: `docs/plans/AAAA-MM-DD-<slug>.md`
   > Tareas completadas: <n>/<n> · Commits: <n>. <Desviaciones respecto al plan, si las hay.>
3. No avises si la implementación se ha detenido a medias (paso 5) o algún criterio global no se cumple.
4. Si el canal no existe o la publicación falla, no bloquees la skill: continúa y menciónalo en el informe.

### 8. Informar

Muestra al usuario:

- Rama y ruta del worktree.
- Lista de commits (`git log --oneline <rama-base>..HEAD`).
- Tareas completadas y criterios globales, señalando cualquier desviación respecto al plan o test de caracterización verificado por sabotaje.
- Si se avisó en `#revisar-plan` o si el aviso falló.

No hagas merge, push ni borres el worktree: pregunta al usuario qué quiere hacer (merge a la rama base, abrir PR o revisar antes).
