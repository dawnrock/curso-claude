# Plan: <título breve>

- **Issue:** [#N](<URL de la issue>)
- **Tipo:** feature | fix | refactor
- **Fecha:** AAAA-MM-DD
- **Estado:** borrador
- **Estimación total:** ~N min (N tareas)

## Objetivo

<!-- Qué se quiere conseguir y por qué, en 2-4 frases. Para un fix: comportamiento actual vs. esperado. Para un refactor: qué mejora y qué comportamiento NO debe cambiar. -->

### Fuera de alcance

<!-- Lo que explícitamente no se hará en este plan. -->

- ...

## Contexto

<!-- Archivos y capas afectados, y decisiones técnicas relevantes (convenciones de docs/ que aplican, causa del error, etc.). -->

| Capa | Archivo | Cambio |
| ---- | ------- | ------ |
| models | `src/models/...` | ... |

## Tareas

<!-- Cada tarea: 5-10 min, una capa, 1-2 archivos, deja el proyecto arrancando. Ordenadas de abajo arriba por capas. -->

### [ ] T1 — <título> (~5 min)

- **Capa:** models | repositories | services | controllers | routes | tests | config | docs
- **Archivos:** `src/...`
- **Depende de:** —
- **Qué hacer:**
  1. ...
- **Criterios de aceptación:**
  - [ ] ...

### [ ] T2 — <título> (~10 min)

- **Capa:** ...
- **Archivos:** `src/...`
- **Depende de:** T1
- **Qué hacer:**
  1. ...
- **Criterios de aceptación:**
  - [ ] ...

## Criterios de aceptación globales

<!-- Condiciones para dar por aceptado el desarrollo completo. Los criterios fijos se mantienen siempre; añade los específicos debajo. -->

**Específicos:**

- [ ] ...

**Fijos:**

- [ ] Todas las tareas y sus criterios están marcados como cumplidos.
- [ ] `npm start` arranca sin errores y `GET /health` responde `{ ok: true }`.
- [ ] Se respetan las capas (`routes → controllers → services → repositories → models`): ninguna capa depende de otra que no sea la inmediatamente inferior.
- [ ] El código nuevo o modificado usa clases y métodos en `snake_case`.
- [ ] Los errores se lanzan como `HttpError` en los services y se reenvían con `next(err)` en los controllers.
- [ ] No se añaden dependencias externas (o se justifica por qué no hay alternativa nativa).
- [ ] Los tests (`node --test`) pasan, si existen.
- [ ] Si se toca la API: `docs/api/openapi.yaml` refleja los cambios y `npm run docs:api` termina sin errores (si no se toca, "no aplica").

## Riesgos y preguntas abiertas

- ...
