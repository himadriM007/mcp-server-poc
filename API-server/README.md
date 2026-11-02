# API Server

A NestJS REST API for managing users, backed by PostgreSQL. All database access goes through Postgres functions, and the API is documented with Swagger.

## Prerequisites

- **Node.js 20** (developed on 20.19.2) and npm
- **PostgreSQL** (developed on 18.6)

Do not upgrade `@nestjs/cli` beyond v10 without also moving to Node 22 or later, or `nest` commands will fail with `ERR_REQUIRE_CYCLE_MODULE`.

## Setup

### 1. Install dependencies

Run all commands in this README from the `API-server` folder.

```bash
npm install
```

### 2. Set up the database

The server needs these objects in the `public` schema:

| Object | Purpose |
|---|---|
| `tbl_users` | Stores users |
| `fn_get_users(json)` | Used by `GET /users` |
| `fn_add_user(json)` | Used by `POST /users` |
| `fn_remove_user(json)` | Used by `DELETE /users` |
| `fn_log_error(...)` | Logs errors raised inside the functions above |

`tbl_users` has these columns:

| Column | Type | Rules |
|---|---|---|
| `id` | `integer` | Required, generated from `tbl_users_id_seq` |
| `name` | `varchar` | Required |
| `email` | `text` | Required |
| `address` | `text` | Required |
| `phone` | `integer` | Optional |
| `is_active` | `boolean` | Required, defaults to `true` |

**These objects are not in this repository**, and there are no migrations. To set up a new database, copy the schema from a database that already has them:

```bash
pg_dump --schema-only --no-owner -h <source-host> -U <user> -d <source-database> -f schema.sql
psql -h <target-host> -U <user> -d <target-database> -f schema.sql
```

`schema.sql` contains the structure only, with no user data.

### 3. Configure the environment

Create a file named `.env.dev` in the `API-server` folder:

```ini
PORT=3001
DB_HOST=localhost
DB_PORT=5432
DB_USER=<database-user>
DB_PASSWORD=<database-password>
DB_NAME=<database-name>
DB_SSL=false
```

| Variable | Description |
|---|---|
| `PORT` | Port the server listens on. Defaults to `3000` if not set. |
| `DB_HOST`, `DB_PORT` | Where PostgreSQL is running |
| `DB_USER`, `DB_PASSWORD` | Database login |
| `DB_NAME` | Database to connect to |
| `DB_SSL` | Set to `true` to connect over SSL |

`.env.dev` is ignored by git. Never commit it.

### 4. Start the server

```bash
npm run start:dev
```

The server restarts automatically when you save a file. Open <http://localhost:3001> and you will be redirected to the Swagger documentation. If you changed `PORT`, use that port instead.

## API

| Method | Path | Description | Input |
|---|---|---|---|
| `GET` | `/users` | Get all users, or one user | Optional query `id` |
| `POST` | `/users` | Add a user | JSON body with `name`, `email`, `address` and optional `phone` |
| `DELETE` | `/users` | Remove a user | Required query `id` |

| Path | Description |
|---|---|
| `/` | Redirects to `/api` |
| `/api` | Swagger UI |
| `/api-json` | OpenAPI document |

Every `/users` response has the same shape:

```json
{
  "data": [{ "id": 1, "name": "Jane Doe", "email": "jane@example.com" }],
  "code": 1,
  "message": "User fetched successfully"
}
```

- `data` is a list of users, or `null`.
- `code` is `1` for success and `0` for an error.
- `message` describes the result.

**Check `code`, not only the HTTP status.** A failed operation, such as a duplicate email, still returns HTTP 200 or 201 with `code: 0`. HTTP 400 is only returned when the request fails validation.

Things to keep in mind:

- `GET /users` returns active users only. A user that doesn't exist returns `code: 1` with `data: null`.
- `DELETE /users` is a soft delete. It sets `is_active` to `false` and keeps the row.
- An email can't be reused after its user is removed.
- `phone` is stored as an integer, so values above 2147483647 return `code: 0`.

## Scripts

| Command | Description |
|---|---|
| `npm run start:dev` | Run with automatic restart |
| `npm run start:debug` | Run with automatic restart and the debugger |
| `npm run build` | Compile to `dist/` |
| `npm run start:prod` | Run the compiled app. Run `npm run build` first. |
| `npm test` | Run unit tests |
| `npm run test:cov` | Run unit tests with a coverage report |
| `npm run test:e2e` | Run end-to-end tests |
| `npm run lint` | Lint and auto-fix |
| `npm run format` | Format with Prettier |

Most tests mock the database, but `src/services/db/db.service.spec.ts` connects using `.env.dev`, so `npm test` needs a reachable PostgreSQL server.

## Project structure

```text
src/
  main.ts               Starts the server and sets up validation and Swagger
  app/                  Root module and the redirect from / to /api
  routes/routes.ts      Maps URL paths to feature modules
  models/               Shared types
  modules/user/         Users feature: controller, service, DTOs and types
  services/db/
    db.service.ts       PostgreSQL connection pool
    dbFunction.ts       Shared helper for calling Postgres functions
test/                   End-to-end tests
```

## Troubleshooting

| Problem | What to do |
|---|---|
| `EADDRINUSE` | Another process is using the port. Stop it or change `PORT`. If it appears during a restart in watch mode, save a file again. |
| `/users` returns `Failed to fetch users` | The database query failed. Check the server log, the values in `.env.dev`, and that PostgreSQL is running and has the objects listed in step 2. |
| `/users` returns `Error #<id>: <name>` | A Postgres function caught an error and logged it through `fn_log_error`. The message gives the logged error's id and name. |
| The server is on the wrong port | Check `PORT` in `.env.dev`, then restart the server. |
| Database settings are ignored | `.env.dev` is loaded from the current folder, so start the server from `API-server`. |
| `ERR_REQUIRE_CYCLE_MODULE` | `@nestjs/cli` is too new for your Node version. See [Prerequisites](#prerequisites). |
