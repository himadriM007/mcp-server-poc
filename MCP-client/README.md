# MCP-client

A React chat UI (Vite) for the user directory chatbot. All chat logic lives in the
**API-server** (`src/modules/chat`); this app only renders the conversation.

```
React UI (MCP-client/web, :5173) ──HTTP──▶ API-server (:3001) /chat/*
                                       ├─ Gemini (@google/genai)   ← GEMINI_API_KEY in API-server/.env.dev
                                       └─ MCP client ──stdio──▶ MCP-server ──HTTP──▶ API-server /users
```

Tools the MCP server marks `destructiveHint` (`remove_user`) pause the turn and show an
**Allow / Deny** card.

## Setup

```bash
# 1. MCP server (the API server starts it on demand)
cd ../MCP-server && npm install && npm run server:build

# 2. API server: set GEMINI_API_KEY and GEMINI_MODEL in API-server/.env.dev
cd ../API-server && npm install && npm run start:dev

# 3. This UI
cd ../MCP-client && npm install
npm run dev        # http://localhost:5173, calls the API at VITE_API_BASE_URL
```

| Env var (`MCP-client/.env`) | Default                 |
| --------------------------- | ----------------------- |
| `VITE_API_BASE_URL`         | `http://localhost:3001` |

`npm run build` builds to `web/dist` (the base URL is baked in at build time); `npm run preview` serves it on :4173.

The browser calls the API server cross-origin, so the API server allows CORS from
`CORS_ORIGINS` in `API-server/.env.dev` (default `http://localhost:5173,http://localhost:4173`).
If you run the UI on another origin, add it there.

## Endpoints used (API-server, documented in Swagger at `/api`)

| Route                | Body                     | Returns                          |
| -------------------- | ------------------------ | -------------------------------- |
| `GET /chat/info`     | –                        | `{ model, tools[] }`             |
| `POST /chat`         | `{ sessionId, message }` | `{ steps[], reply?, confirm? }`  |
| `POST /chat/confirm` | `{ sessionId, approve }` | same as `POST /chat`             |
| `POST /chat/reset`   | `{ sessionId }`          | `{ ok: true }`                   |
