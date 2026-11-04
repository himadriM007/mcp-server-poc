#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerUserTools } from './tools/users.js';
import { registerUserResources } from './resources/users.js';
import { registerUserPrompts } from './prompts/users.js';

const server = new McpServer({ name: 'api-server-mcp', version: '0.0.1' });

registerUserTools(server);
registerUserResources(server);
registerUserPrompts(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stdout is the MCP channel; log to stderr only.
  console.error(`api-server-mcp running on stdio (API_BASE_URL=${process.env.API_BASE_URL ?? 'http://localhost:3001'})`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
