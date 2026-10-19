# Plan: Documentación de la API con OpenAPI 3

- **Tipo:** feature
- **Fecha:** 2026-10-19
- **Estado:** en curso
- **Estimación total:** ~90 min (11 tareas)

## Objetivo

Definir el contrato completo de la API del backend en un único archivo `docs/api/openapi.yaml` (OpenAPI 3.0.3) y generar a partir de él una página HTML publicable (`docs/api/index.html`) con Redocly. Así cualquier persona (frontend, terceros) puede consultar endpoints, roles, cuerpos de petición/respuesta y códigos de estado sin leer el código. Como extra, la skill `plan-feature` debe incluir de forma obligatoria la actualización del `openapi.yaml` en todo plan que toque la API.

### Fuera de alcance

- Cambiar el comportamiento de la API: se documenta lo que hace hoy el código, incluidas sus inconsistencias (p. ej. `order` devuelve `{ error }` y no `{ error, message }`).
- Servir la documentación desde Express (`swagger-ui-express` o similar) o generar el YAML automáticamente desde el código (decoradores, `zod-to-openapi`…).
- Tests de contrato automáticos (validar respuestas reales contra el esquema).
- Publicar el HTML en un hosting (GitHub Pages, etc.).
- Modificar la skill `implement-plan`.

## Contexto

Estado actual detectado:

- `package.json` raíz ya tiene `docs:api:lint` y `docs:api` (Redocly CLI v2 vía `npx`, sin dependencia instalada).
- `docs/api/redocly.yaml` (reglas `recommended`, sin `info-license` ni `no-server-example.com`) y `docs/api/.redocly.lint-ignore.yaml` (ignora `operation-4xx-response` en `/health`, `GET /public/restaurants` y `GET /public/restaurants/{restaurantId}/dishes`) ya existen y esperan el archivo `openapi.yaml`.
- **Falta `docs/api/openapi.yaml`**. Hay un `docs/api/index.html` generado antiguamente cuya especificación embebida (`__redoc_state`) cubre las 20 rutas actuales; sirve como referencia para cotejar, pero la fuente de verdad es el código.

Inventario de endpoints (de `src/app.ts` y los archivos `*.routes.ts`):

| Tag | Método y ruta | Auth / roles | Éxito |
| --- | ------------- | ------------ | ----- |
| Health | `GET /health` | pública | 200 `{ status: "ok" }` |
| Auth | `POST /api/v1/auth/login` | pública | 200 |
| Auth | `POST /api/v1/auth/register` | pública | 201 |
| Public | `GET /api/v1/public/restaurants` | pública | 200 |
| Public | `GET /api/v1/public/restaurants/{id}` | pública | 200 |
| Public | `GET /api/v1/public/restaurants/{restaurantId}/dishes` | pública (solo `available`) | 200 |
| Restaurants | `POST /api/v1/restaurants` | admin | 201 |
| Restaurants | `GET /api/v1/restaurants` | autenticado (admin: todos; resto: el suyo o `[]`) | 200 |
| Restaurants | `GET /api/v1/restaurants/{id}` | autenticado | 200 |
| Restaurants | `PUT /api/v1/restaurants/{id}` | admin | 200 |
| Employees | `POST /api/v1/employees` | admin | 201 |
| Employees | `GET /api/v1/employees` (`limit`, `offset`, `role`) | admin | 200 |
| Employees | `GET /api/v1/employees/{id}` | admin | 200 |
| Employees | `GET /api/v1/restaurants/{restaurantId}/employees` | admin | 200 |
| Dishes | `POST`, `GET /api/v1/restaurants/{restaurantId}/dishes` | POST admin/manager; GET admin/manager/camarero/cocinero | 201 / 200 |
| Dishes | `GET`, `PUT`, `DELETE …/dishes/{id}` | GET 4 roles; PUT/DELETE admin/manager | 200 / 200 / 204 |
| Ingredients | `POST`, `GET /api/v1/restaurants/{restaurantId}/ingredients` | POST admin; GET admin/manager/cocinero | 201 / 200 |
| Ingredients | `GET`, `PUT`, `DELETE …/ingredients/{id}` | GET admin/manager/cocinero; PUT/DELETE admin | 200 / 200 / 204 |
| Orders | `POST /api/v1/orders`, `GET /active?restaurantId=`, `GET /mine`, `GET /{id}`, `PATCH /{orderId}/items/{itemId}/status` | autenticado (sin `authorize`) | 201 / 200 / 200 / 200 / 204 |

Errores comunes:

- `authenticate` → 401 `{ error: "Unauthorized: …" }`; `authorize` → 403 `{ error: "Forbidden: Insufficient permissions" }` (esquema `SimpleError`).
- `errorHandler` → `AppError` como `{ error: <name>, message }` (esquema `DomainError`): 404 para `*NotFoundError` de employee/restaurant/ingredient/dish, 401 para `InvalidCredentialsError`, 400 para el resto; 500 `InternalServerError`.
- `order.controller.ts` gestiona sus errores a mano: 400/404/500 con `{ error }` (`SimpleError`).

| Capa | Archivo | Cambio |
| ---- | ------- | ------ |
| docs | `docs/api/openapi.yaml` | Nuevo: contrato completo OpenAPI 3.0.3 |
| docs | `docs/api/index.html` | Regenerado con `npm run docs:api` (nunca a mano) |
| docs | `README.md`, `docs/arquitectura/arquitectura-api.md` | Enlace y cómo regenerar la documentación |
| config | `.claude/skills/plan-feature/SKILL.md` | Regla: si se toca la API, tarea obligatoria de actualizar `openapi.yaml` |
| config | `.claude/skills/plan-feature/assets/template.md` | Capa `docs` y criterio global fijo condicional sobre OpenAPI |

Decisiones técnicas:

- Un solo archivo YAML (sin `$ref` a ficheros externos) para que `build-docs` y la revisión sean simples.
- Esquemas reutilizables en `components/schemas` con los nombres del spec antiguo (`Restaurant`, `RestaurantInput`, `Dish`, `DishInput`, `DishIngredient`, `Ingredient`, `CreateIngredientRequest`, `UpdateIngredientRequest`, `Order`, `OrderItem`, `CreateOrderRequest`, `UpdateOrderItemStatusRequest`, `Employee`, `CreateEmployeeRequest`, `LoginRequest`, `RegisterClientRequest`, `AuthResponse`, `DomainError`, `SimpleError`) y enums (`Role`, `DishCategory`, `IngredientUnit`, `OrderItemStatus`) sacados de `src/models/*.ts` y `Role.ts`.
- Respuestas de error reutilizables en `components/responses` (`Unauthorized`, `Forbidden`, `NotFound`, `BadRequest`) para no repetirlas en cada operación.
- `securitySchemes.bearerAuth` (HTTP bearer, JWT); las rutas públicas declaran `security: []`.
- Los roles permitidos se documentan en la `description` de cada operación (OpenAPI 3.0 no tiene campo nativo para ello).
- Servidor: `http://localhost:3000`.

## Tareas

### [x] T1 — Esqueleto del `openapi.yaml` y componentes comunes (~10 min)

- **Capa:** docs
- **Archivos:** `docs/api/openapi.yaml`
- **Depende de:** —
- **Qué hacer:**
  1. Crear el archivo con `openapi: 3.0.3`, `info` (título `Resttek API`, versión `1.0.0`, descripción con roles y credenciales de prueba del README), `servers` y `tags` (Health, Auth, Public, Restaurants, Employees, Dishes, Ingredients, Orders).
  2. Añadir `components.securitySchemes.bearerAuth` y la `security` global.
  3. Añadir esquemas `DomainError`, `SimpleError` y los enums `Role`, `DishCategory`, `IngredientUnit`, `OrderItemStatus` (valores de `src/models/*.ts` y `contexts/employee/domain/value-objects/Role.ts`).
  4. Añadir `components.responses` (`BadRequest`, `Unauthorized`, `Forbidden`, `NotFound`, `InternalError`).
  5. Documentar `GET /health` con `security: []`.
- **Criterios de aceptación:**
  - [x] `npm run docs:api:lint` termina sin errores.
  - [x] `curl -s localhost:3000/health` devuelve `{"status":"ok"}`, igual que el ejemplo del YAML.

### [x] T2 — Endpoints de autenticación (~10 min)

- **Capa:** docs
- **Archivos:** `docs/api/openapi.yaml`
- **Depende de:** T1
- **Qué hacer:**
  1. Leer `AuthController.ts`, `LoginUseCase.ts` y `RegisterClientUseCase.ts` para sacar la forma exacta de la respuesta.
  2. Añadir esquemas `LoginRequest`, `RegisterClientRequest`, `AuthResponse` (token + usuario).
  3. Documentar `POST /api/v1/auth/login` (200, 400, 401) y `POST /api/v1/auth/register` (201, 400 incl. `DuplicatedEmailError`), ambos con `security: []` y ejemplos.
- **Criterios de aceptación:**
  - [x] `npm run docs:api:lint` sin errores.
  - [x] Un `curl -X POST localhost:3000/api/v1/auth/login` con credenciales del seed devuelve un JSON con las mismas propiedades que `AuthResponse`.

### [x] T3 — Restaurantes (privados y públicos) (~10 min)

- **Capa:** docs
- **Archivos:** `docs/api/openapi.yaml`
- **Depende de:** T1
- **Qué hacer:**
  1. Añadir esquemas `Restaurant` y `RestaurantInput` (de `restaurant.model.ts` y `restaurant.controller.ts`, `logoUrl` nullable).
  2. Documentar `POST`/`GET /api/v1/restaurants` y `GET`/`PUT /api/v1/restaurants/{id}` con roles y el comportamiento de `GET` según rol.
  3. Documentar `GET /api/v1/public/restaurants` y `GET /api/v1/public/restaurants/{id}` con `security: []`.
- **Criterios de aceptación:**
  - [x] `npm run docs:api:lint` sin errores.
  - [x] Las 6 operaciones de restaurante aparecen con sus códigos (201/200/400/401/403/404 según aplique).

### [x] T4 — Empleados (~10 min)

- **Capa:** docs
- **Archivos:** `docs/api/openapi.yaml`
- **Depende de:** T1
- **Qué hacer:**
  1. Leer `EmployeeController.ts` para la forma de la respuesta (sin `passwordHash`).
  2. Añadir esquemas `Employee` y `CreateEmployeeRequest`.
  3. Documentar `POST`/`GET /api/v1/employees` (query `limit` por defecto 10, `offset` 0, `role` opcional), `GET /api/v1/employees/{id}` y `GET /api/v1/restaurants/{restaurantId}/employees`, todas solo `admin`.
- **Criterios de aceptación:**
  - [x] `npm run docs:api:lint` sin errores.
  - [x] `GET /api/v1/employees` documenta los 3 parámetros de query con su valor por defecto.

### [x] T5 — Platos (privados y públicos) (~10 min)

- **Capa:** docs
- **Archivos:** `docs/api/openapi.yaml`
- **Depende de:** T1
- **Qué hacer:**
  1. Añadir esquemas `DishIngredient`, `Dish` y `DishInput` (de `dish.model.ts` y `dish.controller.ts`; `description` nullable, `available` por defecto `true`).
  2. Documentar las 5 operaciones de `/api/v1/restaurants/{restaurantId}/dishes[/{id}]` con sus roles (DELETE → 204).
  3. Documentar `GET /api/v1/public/restaurants/{restaurantId}/dishes` (solo platos disponibles, `security: []`).
- **Criterios de aceptación:**
  - [x] `npm run docs:api:lint` sin errores.
  - [x] El parámetro `restaurantId` se define una vez a nivel de path y se reutiliza.

### [x] T6 — Ingredientes (~10 min)

- **Capa:** docs
- **Archivos:** `docs/api/openapi.yaml`
- **Depende de:** T1
- **Qué hacer:**
  1. Añadir esquemas `Ingredient`, `CreateIngredientRequest` (`currentStock` por defecto 0) y `UpdateIngredientRequest`.
  2. Documentar las 5 operaciones de `/api/v1/restaurants/{restaurantId}/ingredients[/{id}]` (POST/PUT/DELETE solo admin; GET admin/manager/cocinero; DELETE → 204).
  3. Incluir en el 400 los errores `InvalidUnitError` y `NegativeStockError`.
- **Criterios de aceptación:**
  - [x] `npm run docs:api:lint` sin errores.
  - [x] `IngredientUnit` se referencia con `$ref`, no se duplica el enum.

### [x] T7 — Pedidos (~10 min)

- **Capa:** docs
- **Archivos:** `docs/api/openapi.yaml`
- **Depende de:** T1, T5
- **Qué hacer:**
  1. Leer `order.controller.ts` y `order.service.ts` para cuerpos y errores.
  2. Añadir esquemas `OrderItem`, `Order` (campos opcionales `dishName`, `dishPrice`, `restaurantName`…), `CreateOrderRequest` y `UpdateOrderItemStatusRequest`.
  3. Documentar `POST /orders` (201), `GET /orders/active` (query `restaurantId` obligatoria, 400 si falta), `GET /orders/mine`, `GET /orders/{id}` (404) y `PATCH /orders/{orderId}/items/{itemId}/status` (204), con errores `SimpleError`.
- **Criterios de aceptación:**
  - [x] `npm run docs:api:lint` sin errores.
  - [x] `curl` autenticado a `GET /api/v1/orders/active` sin `restaurantId` devuelve 400 `{ "error": "restaurantId is required" }`, igual que lo documentado.

### [x] T8 — Generar el HTML y cotejar cobertura (~5 min)

- **Capa:** docs
- **Archivos:** `docs/api/index.html`
- **Depende de:** T2–T7
- **Qué hacer:**
  1. Ejecutar `npm run docs:api`.
  2. Comparar las rutas del YAML con las del inventario del Contexto (y con la especificación embebida en el `index.html` antiguo antes de sobrescribirlo).
  3. Abrir `docs/api/index.html` en el navegador y revisar que todas las secciones se ven.
- **Criterios de aceptación:**
  - [x] `npm run docs:api` termina sin errores ni warnings y regenera `docs/api/index.html`.
  - [x] El YAML contiene las 20 rutas (29 operaciones) del inventario; ninguna sobra ni falta.
- **Notas:** el lint termina con 0 errores y 0 warnings. `build-docs` muestra un aviso de deprecación de la propia herramienta (pasará a Redoc 3 en una versión futura de Redocly CLI); no afecta a la especificación. Cotejo hecho con la especificación embebida en el `index.html` antiguo: mismas 29 operaciones. Revisión visual con Chrome headless.

### [ ] T9 — Enlazar la documentación (~5 min)

- **Capa:** docs
- **Archivos:** `README.md`, `docs/arquitectura/arquitectura-api.md`
- **Depende de:** T8
- **Qué hacer:**
  1. Añadir en el README una sección "Documentación de la API" con la ruta de `openapi.yaml`/`index.html` y los comandos `npm run docs:api` y `npm run docs:api:lint`.
  2. Añadir en `arquitectura-api.md` una referencia al contrato y la regla "cualquier cambio de rutas, roles, cuerpos o códigos actualiza el YAML".
- **Criterios de aceptación:**
  - [ ] Ambos archivos enlazan a `docs/api/openapi.yaml` con ruta relativa válida.

### [ ] T10 — EXTRA: regla OpenAPI en la skill `plan-feature` (~10 min)

- **Capa:** config
- **Archivos:** `.claude/skills/plan-feature/SKILL.md`
- **Depende de:** T8
- **Qué hacer:**
  1. En el paso 2 (Analizar el código), añadir: determinar si el trabajo toca la API pública (rutas, roles/`authorize`, cuerpos de petición/respuesta, query params, códigos de estado o errores mapeados en `errorHandler`) y, si es así, leer `docs/api/openapi.yaml`.
  2. En el paso 3 (Desglosar en tareas), añadir: si toca la API, incluir siempre una tarea de capa `docs` justo después de la de `routes`/`controllers` que actualice `docs/api/openapi.yaml` y ejecute `npm run docs:api` (nunca editar `index.html` a mano).
  3. En el paso 4, añadir que ese caso exige el criterio global de OpenAPI de la plantilla.
- **Criterios de aceptación:**
  - [ ] `SKILL.md` contiene la regla en los pasos 2, 3 y 4, nombrando `docs/api/openapi.yaml` y `npm run docs:api`.
  - [ ] Al planificar en una sesión nueva una feature de prueba (p. ej. "añadir `DELETE /restaurants/{id}`"), el plan generado incluye la tarea de actualizar el `openapi.yaml` (se descarta después).

### [ ] T11 — EXTRA: plantilla del plan (~5 min)

- **Capa:** config
- **Archivos:** `.claude/skills/plan-feature/assets/template.md`
- **Depende de:** T10
- **Qué hacer:**
  1. Añadir `docs` a la lista de capas posibles de cada tarea.
  2. Añadir a los criterios globales fijos: "Si se toca la API: `docs/api/openapi.yaml` refleja los cambios y `npm run docs:api` termina sin errores".
- **Criterios de aceptación:**
  - [ ] La plantilla contiene la capa `docs` y el nuevo criterio fijo.

## Criterios de aceptación globales

**Específicos:**

- [ ] Existe `docs/api/openapi.yaml` (OpenAPI 3.0.3) con las 29 operaciones de la API, cada una con tag, roles en la descripción, `security` correcta, cuerpo de petición (si aplica) y todas sus respuestas (éxito y error).
- [ ] `npm run docs:api` termina sin errores y `docs/api/index.html` se ha regenerado desde el YAML (no editado a mano).
- [ ] Todos los esquemas se definen una vez en `components` y se reutilizan con `$ref`.
- [ ] Al menos 3 respuestas reales (`/health`, login, `orders/active` sin `restaurantId`) coinciden con lo documentado.
- [ ] README y `docs/arquitectura/arquitectura-api.md` enlazan la documentación.
- [ ] La skill `plan-feature` (SKILL.md y plantilla) obliga a incluir la actualización del `openapi.yaml` cuando un plan toca la API.

**Fijos** (adaptados a los comandos reales del repo):

- [ ] Todas las tareas y sus criterios están marcados como cumplidos.
- [ ] `npm run dev:api` arranca sin errores y `GET /health` responde `{ "status": "ok" }`.
- [ ] Se respetan las capas: este plan no modifica código de `packages/api/src`.
- [ ] Convenciones de nombres de `CLAUDE.md`: no aplica (no hay código nuevo).
- [ ] Errores: no aplica (no cambia el manejo de errores).
- [ ] No se añaden dependencias: Redocly se ejecuta con `npx` y no entra en ningún `package.json`.
- [ ] `npm test` pasa.

## Riesgos y preguntas abiertas

- **"Automáticamente"**: la skill solo garantiza que *los planes* incluyan la tarea de actualizar el YAML; no lo hace si se toca la API sin pasar por `plan-feature`. Para una garantía real haría falta un hook de Claude Code (p. ej. `PostToolUse` que avise al editar `*.routes.ts`/`*Controller.ts`) o una comprobación en CI. ¿Lo añadimos como siguiente plan?
- **Atajo posible**: la especificación embebida del `index.html` antiguo se podría extraer y convertir a YAML en un minuto. Se propone escribirla a partir del código (es la fuente de verdad) y usar la antigua solo para cotejar en T8; si preferís el atajo, T1–T7 se reducen a una revisión.
- **Inconsistencias que se documentarán tal cual**: `order` usa `{ error }` en vez de `{ error, message }` y no aplica `authorize`; `OrderNotFoundError` no está en la lista de 404 del `errorHandler`; `validateDishIngredient` lanza `Error` genérico (acaba en 500). Conviene registrarlas en `docs/revisiones/inconsistencias-backend.md` si no lo están.
- **Plantilla de `plan-feature` desalineada con el repo**: sus criterios fijos hablan de `npm start`, `{ ok: true }`, `snake_case`, `HttpError` y `node --test`, que no corresponden a este proyecto (vitest, `{ status: "ok" }`, `AppError`…). En este plan se han adaptado; corregir la plantilla queda fuera de alcance salvo que se quiera aprovechar T11.
- La generación depende de `npx` con acceso a red para descargar `@redocly/cli@2`.
