# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Resttek: restaurant management platform. npm-workspaces monorepo (Node 22+, npm 10+) with one Express API and four Angular 21 packages. Docs (in Spanish) live in `docs/` (`arquitectura/`, `dominio/`, `revisiones/`); the README has setup, test credentials (password = the user's own email) and a happy-path walkthrough.

## Commands (run from repo root)

```bash
npm install                # installs all workspaces
npm run seed               # populate SQLite (INSERT OR IGNORE, idempotent)
npm run dev:api            # API on :3000 (tsx watch); GET /health
npm run dev:admin          # :4200
npm run dev:empleados      # :4201
npm run dev:clientes       # :4202
npm test                   # API tests only (vitest run)
npm run docs:api           # lint docs/api/openapi.yaml + regenerate docs/api/index.html (Redocly via npx)
npm run docs:api:lint      # lint only
```

- Single test: `cd packages/api && npx vitest run path/to/file.test.ts` (add `-t "name"` to filter); watch mode: `npm run test:watch` in `packages/api`.
- Frontend build: `npm run build -w @resttek/web-admin` (same for the other apps). There are no frontend tests and no lint script.
- Each frontend proxies `/api` → `localhost:3000` through its `proxy.conf.json`; always access via the frontend port.

## API architecture (`packages/api`)

Two coexisting styles; check which one applies before editing:

- **Hexagonal + DDD** only in `src/contexts/employee/` (domain → application use cases → infrastructure incl. `http/` controllers, routes and `dependencies.ts` for wiring). `Employee` is the only rich entity (private constructor + `create()` factory); value objects are `Email` (in `contexts/shared`) and `Role`. Interfaces use the `I` prefix.
- **Layered** for `restaurant`, `dish`, `ingredient`, `order`: `models/` (plain interfaces + `normalizeX()` functions), `repositories/` (interface + SQLite impl in the same file, no `I` prefix), `services/` (multi-method services holding validation), `controllers/`, `routes/` (compose dependencies).

Other notes:
- ESM (`"type": "module"`): imports use `.js` extensions and tsconfig path aliases (`@employee/*`, `@shared/*`, `@routes/*`, `@services/*`, `@repositories/*`, `@models/*`, `@errors/*`, `@config/*`, …). Vitest resolves them via `vite-tsconfig-paths`.
- Routes are mounted in `src/app.ts` under `/api/v1/...`; public (unauthenticated, client-facing) routes live under `/api/v1/public/...`. Roles are enforced with `authorize()` middleware.
- SQLite file is `packages/api/resttek.db`; with `NODE_ENV=test` it's `:memory:` (repository tests set this themselves). Tables are created on startup by `Database.runInitialMigrations`; `PRAGMA foreign_keys = ON` is enabled.
- Tests use mock repositories in `repositories/mocks/` and `contexts/employee/application/mocks/`.
- `JWT_SECRET` env var falls back to a hardcoded dev secret; `PORT` defaults to 3000.
- Domain errors are in `src/errors/DomainErrors.ts` and mapped to HTTP by `errorHandler`.
- The API contract lives in `docs/api/openapi.yaml` (hand-written, OpenAPI 3.0). Any change to routes, roles, request/response shapes or status codes must update it and run `npm run docs:api`; `docs/api/index.html` is generated, never edit it by hand.

## Frontend architecture

- Standalone components, signals, zoneless (no zone.js), lazy-loaded feature routes. Environment config in `src/environments/`.
- `web-admin` and `web-empleados`: `features/<feature>/{models,pages,services,store}`. Services return Observables; **stores** (`providedIn: 'root'`, private signals exposed `asReadonly`, `loading`/`error`/data trio) wrap them with `firstValueFrom`, and components talk only to stores. `web-empleados` `OrderStore` polls every 30 s.
- `web-clientes` differs: models/services/store in `core/`, features are flat components that call services directly with `.subscribe()`; only `CartStore` exists (local, single-restaurant cart). Order pages poll with `setInterval` (10 s list, 5 s detail).
- `@resttek/web-shared` is consumed directly from source (`main: src/index.ts`, no build): `API_URL` token, `AuthService`/`AuthStore` (token + user in localStorage), auth guard, auth/error interceptors, login/register components, base CSS design system. Changes there require restarting the frontend dev server.
- Roles: admin/manager → web-admin; manager/cocinero/camarero → web-empleados; cliente → web-clientes.

## Misc

- `scripts/seed-issues.sh` creates GitHub issues from `scripts/issues.json` via `gh` + `jq` (see `scripts/README.md`).
- `docs/revisiones/` contains audits of docs vs. code; update the relevant `docs/` file when behavior changes.
