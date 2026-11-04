/**
 * Thin HTTP client for the NestJS API-server.
 * Base URL comes from API_BASE_URL (default http://localhost:3001).
 */
const API_BASE_URL = (process.env.API_BASE_URL ?? 'http://localhost:3001').replace(/\/+$/, '');

type Query = Record<string, string | number | undefined>;

export async function apiRequest(
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  options: { query?: Query; body?: unknown } = {},
): Promise<{ status: number; body: unknown }> {
  const url = new URL(API_BASE_URL + path);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  const res = await fetch(url, {
    method,
    headers: options.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const text = await res.text();
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    // keep raw text
  }
  return { status: res.status, body };
}

export interface User {
  id: number;
  name: string;
  email?: string;
  address?: string;
  phone?: number | null;
  is_active?: boolean;
}

export interface UserResponse {
  data: User[] | null;
  code: 0 | 1;
  message: string;
}

/** GET /users, throwing on HTTP or API (code 0) errors. */
export async function fetchUsers(id?: number): Promise<User[]> {
  const { status, body } = await apiRequest('GET', '/users', { query: { id } });
  const res = body as UserResponse;
  if (status >= 400 || res?.code !== 1) {
    throw new Error(`GET /users failed (HTTP ${status}): ${res?.message ?? JSON.stringify(body)}`);
  }
  return res.data ?? [];
}
