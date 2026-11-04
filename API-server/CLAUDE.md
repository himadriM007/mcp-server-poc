# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

This is a NestJS application, originally scaffolded via `@nestjs/cli@10` (the newer CLI requires Node 22+ and this machine runs Node 20.19.2). Beyond the starter's `AppModule` and `AppController`, a Postgres `DbService` (see Database section) and a `user` feature module (see Feature modules section) have been added. Not yet a git repository.

## Commands

```bash
npm run start:dev      # run with hot reload (primary dev loop)
npm run start:debug     # run with --inspect and hot reload
npm run build            # compile to dist/ via `nest build`
npm run start:prod       # run compiled output: node dist/main

npm run lint              # eslint --fix over src/apps/libs/test
npm run format            # prettier --write over src/ and test/

npm test                  # jest unit tests (*.spec.ts, colocated under src/)
npm run test:watch
npm run test:cov          # coverage report
npm run test:e2e          # jest against test/jest-e2e.json (test/*.e2e-spec.ts)
```

To run a single test file or test case, pass a path/pattern straight to jest, e.g.:
```bash
npx jest src/app/app.controller.spec.ts
npx jest -t "name of test case"
```

Note: the installed `@nestjs/cli` is pinned to v10 for Node 20 compatibility — do not blindly upgrade it without also bumping Node, or `nest` commands will throw `ERR_REQUIRE_CYCLE_MODULE`.

## Architecture

Standard Nest module/controller/service pattern:
- `src/main.ts` — entry point, bootstraps `AppModule` (from `src/app/app.module.ts`) via `NestFactory`.
- `src/app/app.module.ts` — root module; register new feature modules here as they're added.
- `src/app/app.controller.ts` — redirects `GET /` to the Swagger UI at `/api`, and is hidden from the docs itself.
- Controllers stay thin and services hold logic, per Nest convention.
- `src/routes/routes.ts` — central route config: maps URL paths to feature modules and is registered in `AppModule` via `RouterModule.register(routes)`. The path lives here, so feature controllers use a bare `@Controller()`; putting the path in both places doubles it (e.g. `/users/users`). `AppController` stays at `/` and is not listed here.
- Unit tests (`*.spec.ts`) live alongside the source file they test; e2e tests live under `test/` and spin up the full Nest app via `supertest`.

As the API grows, follow Nest's convention of one directory per feature under `src/` (mirroring `src/app/`), each with its own `*.module.ts`, `*.controller.ts`, `*.service.ts`, and `*.spec.ts`, imported into `AppModule`.

## Feature modules

Feature modules live under `src/modules/<feature>/`, imported into `src/app/app.module.ts` and given a path in `src/routes/routes.ts`. `src/modules/user/` is the reference example:
- `user.module.ts` / `user.controller.ts` / `user.service.ts` — standard Nest triad; `UserService` injects `DbService` (global, see Database section) directly, no `DbModule` import needed. Its `getUsers`, `create` and `remove` methods all go through `callDbFunction` (see Database section) rather than writing SQL.
- `user.model.ts` — exports the `UserResponse` interface (`data: User[] | null`, `code: 0 | 1`, `message`), returned by every `/users` endpoint. Its `User` interface is not exported; import `User` from `src/models/user.model.ts`.
- `user.dto.ts` — `GetUserDto` (optional `id`, used as a query DTO), `CreateUserDto` (`name`/`email`/`address` required, `phone` optional), `RemoveUserDto` (`id` required). All fields are decorated with `class-validator` and `@nestjs/swagger`'s `@ApiProperty`/`@ApiPropertyOptional`. There is deliberately no update/PATCH DTO or endpoint.
- `user.controller.ts` routes: `GET /users` (takes `GetUserDto` as a query string — omit `id` to list all users, pass `?id=` to fetch one), `POST /users` (`CreateUserDto` body), `DELETE /users` (`RemoveUserDto` as a query string, e.g. `?id=1`). No path-param (`:id`) routes.
- Every file has a matching `*.spec.ts`. Specs never hit a real DB: `user.service.spec.ts` mocks `callDbFunction` with `jest.mock`; `user.controller.spec.ts` mocks `UserService` via `useValue`; `user.dto.spec.ts` exercises `class-validator`'s `validate()` directly (with `plainToInstance` for query-string coercion); `user.model.spec.ts` checks the `UserResponse` type contract, relying on ts-jest type-checking and `@ts-expect-error`; `user.module.spec.ts` imports `DbModule` and `routes` alongside the feature module, uses `overrideProvider(DbService)` so no live Postgres connection is needed, and sends real HTTP requests to check the routes.
- The endpoints call the Postgres functions `fn_get_users`, `fn_add_user` and `fn_remove_user`, which work on the `tbl_users` table (`id`, `name`, `email`, `address`, `phone`, `is_active`, ...). These functions live only in the database, not in this repo, and no migration tooling is set up, so they must exist in whatever `.env.dev` points to. To see a definition, query `pg_get_functiondef` on `pg_proc`; do not assume its argument keys or return shape.
- DB function behaviour worth knowing:
  - `fn_get_users` takes `{ "id": <number> }` (the key is `id`, an unknown key returns every user) or `NULL` for all users, and returns only active users. A missing user returns `code: 1` with `data: null`.
  - `fn_add_user` returns only `id`, `name` and `email`. `phone` is `INT4`, so values above 2147483647 return `code: 0`. The duplicate email check includes inactive users.
  - `fn_remove_user` is a soft delete (`is_active = FALSE`) and returns only `name` and `email`, so `UserService.remove` adds `id` back from the DTO. A missing or already inactive user returns a generic `Error #<id>: <name>` message with `code: 0`.
- `src/main.ts` registers a global `ValidationPipe({ whitelist: true, transform: true })` (required for the `class-validator`/`class-transformer` decorators above to actually run and for query-string values to coerce to numbers) and sets up `@nestjs/swagger` (`DocumentBuilder` + `SwaggerModule.setup('api', ...)`) — Swagger UI is served at `/api` and the OpenAPI JSON at `/api-json` when the app is running. Swagger reads classes, not interfaces, so `UserResponseDto` and `UserDto` in `user.dto.ts` mirror the `UserResponse` interface for the docs. New endpoints should have `@ApiOperation` and a typed response decorator.

### Chat module

`src/modules/chat/` (routed at `/chat`) is a Gemini chatbot whose tools come from `../MCP-server` (which in turn calls this API's `/users`). The React UI in `../MCP-client` is its only client.
- Routes: `GET /chat/info`, `POST /chat` (`ChatMessageDto`), `POST /chat/confirm` (`ConfirmToolDto`), `POST /chat/reset` (`ResetChatDto`); POSTs return 200 via `@HttpCode`.
- `ChatService` connects lazily on the first request: it spawns `MCP_SERVER_PATH` (default `../MCP-server/dist/index.js`, resolved from `process.cwd()`) over stdio with `API_BASE_URL` (default `http://localhost:$PORT`). The app therefore still starts without a key; chat requests then return 503. A failed or closed connection is retried on the next request.
- `main.ts` enables CORS for the UI's origins: `CORS_ORIGINS` (comma-separated, default `http://localhost:5173,http://localhost:4173`).
- Config in `.env.dev`: `GEMINI_API_KEY` (required for chat), `GEMINI_MODEL` (required, no built-in default; read once on first connect, so restart after changing it), optional `MCP_SERVER_PATH` / `API_BASE_URL`.
- Conversations are kept in memory per client `sessionId` (max 200, oldest evicted). Tools with `destructiveHint` pause the turn and return `confirm`; the client resumes with `/chat/confirm`. A failed turn is rolled back out of the history. Gemini errors map to 502, a pending/busy session to 409.
- `@google/genai` and `@modelcontextprotocol/sdk` both ship CommonJS builds, so they import normally here. Specs `jest.mock` both SDKs; nothing hits Gemini or spawns the MCP server.

## Database (PostgreSQL)

- `src/services/db/db.service.ts` — `DbService` wraps a `pg` `Pool`. Exposes `query(text, params)` for parameterized queries and `testConnection()` which runs `SELECT 1` and throws on failure. Pool is closed in `onModuleDestroy`.
- `src/services/db/dbFunction.ts` — `callDbFunction<T>(dbService, fn, args, errorMessage)` is the shared way to call a Postgres function that takes one JSON argument and returns `{ data, code, message }`. It runs `SELECT fn($1) AS response`, sends `args` as JSON (`null` becomes SQL `NULL`), wraps a single `data` object in an array, and returns `DbFunctionResponse<T>`. If the query throws, it logs the error and returns `{ data: null, code: 0, message: errorMessage }` instead of rethrowing. The function name is interpolated into the SQL, so it must match `^fn_[a-z0-9_]+$`; pass only hardcoded names, never request input.
- `src/services/db/db.module.ts` — `DbModule` is `@Global()` and provides/exports `DbService`. It's imported once in `src/app/app.module.ts`; because it's global, **any** other module/provider can inject `DbService` via constructor without importing `DbModule` itself.
- Credentials are read via `ConfigService` from env vars (never hardcoded): `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_SSL`.
- `.env.dev` (repo root) holds these vars, pointing at a local dev Postgres instance.
- `src/services/db/db.service.spec.ts` is an integration test that calls `testConnection()` against whatever `.env.dev` points to — it requires a reachable Postgres instance with matching credentials to pass (currently passing).
