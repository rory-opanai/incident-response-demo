import { readFile } from 'fs/promises';
import path from 'path';
import { startStdioMcpServer } from './mcp.js';

const LOG_PATH = path.join(process.cwd(), 'fixtures', 'cloudwatch', 'auth-log.jsonl');

const tools = {
  search_logs: {
    description: 'Search CloudWatch-style login logs by request_id, trace_id, or substring.',
    inputSchema: {
      type: 'object',
      properties: {
        request_id: { type: 'string' },
        trace_id: { type: 'string' },
        contains: { type: 'string' },
        limit: { type: 'integer', minimum: 1, maximum: 50 }
      },
      additionalProperties: false
    },
    handler: async (args) => {
      const entries = await loadLogs();
      const filtered = entries.filter((entry) => matches(entry, args));
      const limit = args?.limit ?? 10;
      return { entries: filtered.slice(0, limit) };
    }
  },
  tail_errors: {
    description: 'Return the most recent error entries (status >= 400).',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'integer', minimum: 1, maximum: 50 }
      },
      additionalProperties: false
    },
    handler: async (args) => {
      const entries = await loadLogs();
      const errors = entries.filter((entry) => Number(entry.status) >= 400);
      const limit = args?.limit ?? 10;
      const sorted = errors.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      return { entries: sorted.slice(0, limit) };
    }
  }
};

startStdioMcpServer({
  name: 'mock-cloudwatch-mcp',
  version: '0.1.0',
  tools
});

async function loadLogs() {
  const raw = await readFile(LOG_PATH, 'utf-8');
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function matches(entry, args = {}) {
  if (args.request_id && entry.request_id !== args.request_id) return false;
  if (args.trace_id && entry.trace_id !== args.trace_id) return false;
  if (args.contains) {
    const haystack = `${entry.message ?? ''} ${JSON.stringify(entry.details ?? {})}`;
    if (!haystack.toLowerCase().includes(String(args.contains).toLowerCase())) return false;
  }
  return true;
}
