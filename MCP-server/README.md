# MCP-server

An MCP server (built with `@modelcontextprotocol/sdk`) that exposes the `API-server` endpoints as tools over stdio.

| Tool          | API call          | Arguments                                              |
| ------------- | ----------------- | ------------------------------------------------------ |
| `get_users`   | `GET /users`      | `id?` (omit to list all active users)                  |
| `add_user`    | `POST /users`     | `name`, `email`, `address`, `phone?`                   |
| `remove_user` | `DELETE /users`   | `id` (soft delete)                                     |

A tool result is flagged `isError` when the API is unreachable, returns HTTP 4xx/5xx, or returns `code: 0`.

### Resources (`src/resources/`)

| URI             | Content                                                                 |
| --------------- | ----------------------------------------------------------------------- |
| `users://all`   | Every active user (JSON)                                                |
| `users://{id}`  | One active user; listing enumerates all active users; `id` autocompletes |
| `api://openapi` | The API server's OpenAPI spec (from `/api-json`)                         |

### Prompts (`src/prompts/`)

| Prompt            | Arguments                               | What it does                                                         |
| ----------------- | --------------------------------------- | -------------------------------------------------------------------- |
| `onboard_user`    | `name`, `email`, `address`, `phone?`    | Validate details, check the email is free, then call `add_user`      |
| `deactivate_user` | `id` (autocompletes), `reason?`         | Look the user up, ask for confirmation, then call `remove_user`      |
| `user_report`     | `focus?`                                | Embeds `users://all` and asks for a summary (missing fields, duplicates) |

## Setup

```bash
npm install
npm run build
```

The API server must be running (`cd ../API-server && npm run start:dev`). Its port comes from `PORT` in `API-server/.env.dev` (currently 3001).

| Env var        | Default                 |
| -------------- | ----------------------- |
| `API_BASE_URL` | `http://localhost:3001` |

## Try it

```bash
npm run inspect   # opens the MCP Inspector against dist/index.js
```

## Use with Claude Code

```bash
claude mcp add api-server -e API_BASE_URL=http://localhost:3001 -- node C:/work/learn/mcp/MCP-server/dist/index.js
```

## Use with Claude Desktop (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "api-server": {
      "command": "node",
      "args": ["C:/work/learn/mcp/MCP-server/dist/index.js"],
      "env": { "API_BASE_URL": "http://localhost:3001" }
    }
  }
}
```

## Adding a tool for a new endpoint

Add a `server.registerTool(...)` call in `src/tools/` (see `src/tools/users.ts`) using `callApi(method, path, { query, body })`, and register the function in `src/index.ts`.
