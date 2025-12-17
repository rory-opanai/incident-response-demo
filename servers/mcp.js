// servers/mcp.js
import { Server } from '@modelcontextprotocol/sdk/server';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';

export async function startStdioMcpServer({
  name,
  version,
  tools,
  logRequests = false
}) {
  const server = new Server(
    { name, version },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: Object.entries(tools).map(([toolName, tool]) => ({
      name: toolName,
      description: tool.description,
      inputSchema: tool.inputSchema
    }))
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const toolName = req.params.name;
    const args = req.params.arguments ?? {};
    const tool = tools[toolName];

    if (!tool) {
      throw new Error(`Unknown tool: ${toolName}`);
    }

    if (logRequests) {
      console.error(`[${name}] tools/call`, toolName);
    }

    const result = await tool.handler(args);
    const text = typeof result === 'string' ? result : JSON.stringify(result, null, 2);

    return {
      content: [{ type: 'text', text }]
    };
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Required when spawned by Codex
  process.stdin.resume();
}
