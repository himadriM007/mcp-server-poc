/**
 * Client for the API-server's chat endpoints (API-server/src/modules/chat).
 * Base URL comes from VITE_API_BASE_URL in MCP-client/.env (default http://localhost:3001).
 */
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001').replace(/\/+$/, '');

export interface ToolInfo {
  name: string;
  description: string;
  destructive: boolean;
}

export interface ToolStep {
  name: string;
  args: Record<string, unknown>;
  status: 'ok' | 'error' | 'declined';
  result: string;
}

export interface TurnResult {
  steps: ToolStep[];
  reply?: string;
  confirm?: { name: string; args: Record<string, unknown> };
}

/** Reads a NestJS error body: { statusCode, message: string | string[], error }. */
async function errorFrom(res: Response): Promise<Error> {
  const data = await res.json().catch(() => ({}));
  const message = Array.isArray(data.message) ? data.message.join('; ') : data.message;
  if (message) return new Error(message);
  return new Error(`Request failed (HTTP ${res.status})`);
}

async function request<T>(path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(API_BASE_URL + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error(`Cannot reach the API server at ${API_BASE_URL}. Is it running?`);
  }
  if (!res.ok) throw await errorFrom(res);
  return res.json();
}

export const getInfo = () => request<{ model: string; tools: ToolInfo[] }>('/chat/info');

export const sendMessage = (sessionId: string, message: string) =>
  request<TurnResult>('/chat', { sessionId, message });

export const confirmTool = (sessionId: string, approve: boolean) =>
  request<TurnResult>('/chat/confirm', { sessionId, approve });

export const resetChat = (sessionId: string) => request<{ ok: true }>('/chat/reset', { sessionId });
