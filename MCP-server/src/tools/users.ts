import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { apiRequest } from '../apiClient.js';

/**
 * Calls the API and converts the result into an MCP tool result.
 * HTTP errors, network failures and `code: 0` responses are flagged with isError.
 */
async function callApi(...args: Parameters<typeof apiRequest>): Promise<CallToolResult> {
  try {
    const { status, body } = await apiRequest(...args);
    const failed =
      status >= 400 ||
      (typeof body === 'object' && body !== null && (body as { code?: unknown }).code === 0);
    return {
      content: [{ type: 'text', text: JSON.stringify(body, null, 2) }],
      isError: failed,
    };
  } catch (err) {
    return {
      content: [
        {
          type: 'text',
          text: `Could not reach the API server: ${err instanceof Error ? err.message : String(err)}`,
        },
      ],
      isError: true,
    };
  }
}

export function registerUserTools(server: McpServer): void {
  server.registerTool(
    'get_users',
    {
      title: 'Get users',
      description:
        'GET /users. Returns one user when id is given, otherwise all users. Only active users are returned. ' +
        'A missing user returns code 1 with null data.',
      inputSchema: {
        id: z.number().int().optional().describe('User id. Omit to list all active users.'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ id }) => callApi('GET', '/users', { query: { id } }),
  );

  server.registerTool(
    'add_user',
    {
      title: 'Add a user',
      description:
        'POST /users. Creates a user and returns its id, name and email. ' +
        'A duplicate email (including one held by an inactive user) returns code 0.',
      inputSchema: {
        name: z.string().min(1).describe('Full name'),
        email: z.email().describe('Email address'),
        address: z.string().min(1).describe('Postal address'),
        phone: z.number().int().max(2147483647).optional().describe('Phone number'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async (args) => callApi('POST', '/users', { body: args }),
  );

  server.registerTool(
    'remove_user',
    {
      title: 'Remove a user',
      description:
        'DELETE /users. Soft-deletes a user (marks it inactive) and returns its id, name and email. ' +
        'A missing or already inactive user returns code 0.',
      inputSchema: {
        id: z.number().int().describe('User id'),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
    },
    async ({ id }) => callApi('DELETE', '/users', { query: { id } }),
  );
}
