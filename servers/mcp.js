import { StringDecoder } from 'string_decoder';

// Minimal JSON-RPC over stdio with Content-Length framing.
export function startStdioMcpServer({ name, version, tools }) {
  const decoder = new StringDecoder('utf8');
  let buffer = '';

  process.stdin.on('data', (chunk) => {
    buffer += decoder.write(chunk);
    parseBuffer();
  });

  function parseBuffer() {
    while (true) {
      const headerEnd = buffer.indexOf('\r\n\r\n');
      if (headerEnd === -1) return;

      const header = buffer.slice(0, headerEnd);
      const lengthMatch = header.match(/Content-Length:\s*(\d+)/i);
      if (!lengthMatch) {
        buffer = buffer.slice(headerEnd + 4);
        continue;
      }

      const bodyLength = parseInt(lengthMatch[1], 10);
      const messageStart = headerEnd + 4;
      const totalLength = messageStart + bodyLength;
      if (buffer.length < totalLength) return;

      const body = buffer.slice(messageStart, totalLength);
      buffer = buffer.slice(totalLength);

      try {
        const message = JSON.parse(body);
        handleMessage(message);
      } catch (error) {
        sendError(null, 'parse_error', String(error));
      }
    }
  }

  function handleMessage(message) {
    const { id, method, params } = message;
    if (!method) return;

    if (method === 'initialize') {
      sendResponse(id, {
        serverInfo: { name, version },
        capabilities: { tools: true }
      });
      return;
    }

    if (method === 'ping') {
      sendResponse(id, { pong: true });
      return;
    }

    if (method === 'tools/list' || method === 'list_tools') {
      sendResponse(id, { tools: listTools() });
      return;
    }

    if (method === 'tools/call' || method === 'call_tool') {
      callTool(id, params);
      return;
    }

    sendError(id, 'method_not_found', `Unknown method: ${method}`);
  }

  function listTools() {
    return Object.entries(tools).map(([name, tool]) => ({
      name,
      description: tool.description,
      inputSchema: tool.inputSchema
    }));
  }

  async function callTool(id, params = {}) {
    const { name: toolName, arguments: args = {} } = params;
    const tool = tools[toolName];
    if (!tool) {
      sendError(id, 'tool_not_found', `No tool named ${toolName}`);
      return;
    }

    try {
      const result = await tool.handler(args);
      sendResponse(id, { name: toolName, result });
    } catch (error) {
      sendError(id, 'tool_error', String(error?.message ?? error));
    }
  }

  function sendResponse(id, result) {
    const payload = JSON.stringify({ jsonrpc: '2.0', id, result });
    const frame = `Content-Length: ${Buffer.byteLength(payload, 'utf8')}\r\n\r\n${payload}`;
    process.stdout.write(frame);
  }

  function sendError(id, code, message) {
    const payload = JSON.stringify({
      jsonrpc: '2.0',
      id,
      error: { code, message }
    });
    const frame = `Content-Length: ${Buffer.byteLength(payload, 'utf8')}\r\n\r\n${payload}`;
    process.stdout.write(frame);
  }
}
