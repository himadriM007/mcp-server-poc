import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiRequest, fetchUsers } from '../apiClient.js';

const json = (uri: URL, value: unknown) => ({
  contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(value, null, 2) }],
});

export function registerUserResources(server: McpServer): void {
  // All active users.
  server.registerResource(
    'users',
    'users://all',
    {
      title: 'All active users',
      description: 'Every active user from GET /users.',
      mimeType: 'application/json',
    },
    async (uri) => json(uri, await fetchUsers()),
  );

  // One user by id, e.g. users://1. Listing enumerates every active user.
  server.registerResource(
    'user',
    new ResourceTemplate('users://{id}', {
      list: async () => ({
        resources: (await fetchUsers()).map((u) => ({
          uri: `users://${u.id}`,
          name: `user-${u.id}`,
          title: u.name,
          description: u.email,
          mimeType: 'application/json',
        })),
      }),
      complete: {
        id: async (value) =>
          (await fetchUsers()).map((u) => String(u.id)).filter((id) => id.startsWith(value)),
      },
    }),
    {
      title: 'User by id',
      description: 'A single active user from GET /users?id={id}.',
      mimeType: 'application/json',
    },
    async (uri, { id }) => {
      const userId = Number(id);
      if (!Number.isInteger(userId)) throw new Error(`Invalid user id: ${id}`);
      const [user] = await fetchUsers(userId);
      if (!user) throw new Error(`No active user with id ${userId}`);
      return json(uri, user);
    },
  );

  // OpenAPI spec published by the API server's Swagger setup.
  server.registerResource(
    'openapi',
    'api://openapi',
    {
      title: 'API server OpenAPI spec',
      description: 'OpenAPI document served by the API server at /api-json.',
      mimeType: 'application/json',
    },
    async (uri) => {
      const { status, body } = await apiRequest('GET', '/api-json');
      if (status >= 400) throw new Error(`GET /api-json failed (HTTP ${status})`);
      return json(uri, body);
    },
  );
}
