import { readFile } from 'fs/promises';
import path from 'path';
import { startStdioMcpServer } from './mcp.js';

const TRACE_PATH = path.join(process.cwd(), 'fixtures', 'datadog', 'traces.json');

const tools = {
  get_trace_by_request_id: {
    description: 'Return trace object(s) by request_id.',
    inputSchema: {
      type: 'object',
      properties: {
        request_id: { type: 'string' }
      },
      required: ['request_id'],
      additionalProperties: false
    },
    handler: async (args) => {
      const traces = await loadTraces();
      return traces.filter((t) => t.request_id === args.request_id);
    }
  },
  summarize_errors: {
    description: 'Summarize error counts by type and release_tag.',
    inputSchema: {
      type: 'object',
      properties: {
        since_minutes: { type: 'integer', minimum: 1, maximum: 1440 }
      },
      additionalProperties: false
    },
    handler: async (args) => {
      const traces = await loadTraces();
      const windowMs = (args?.since_minutes ?? 120) * 60 * 1000;
      const now = Date.parse('2024-11-03T09:15:00.000Z'); // anchored to fixture time
      const cutoff = now - windowMs;
      const filtered = traces.filter((t) => Date.parse(t.timestamp) >= cutoff);
      const summary = {};

      for (const trace of filtered) {
        for (const error of trace.errors ?? []) {
          const key = `${error.type}::${trace.release_tag}`;
          summary[key] = summary[key] ?? {
            error_type: error.type,
            release_tag: trace.release_tag,
            count: 0
          };
          summary[key].count += 1;
        }
      }

      return { errors: Object.values(summary), window_minutes: args?.since_minutes ?? 120 };
    }
  }
};

startStdioMcpServer({
  name: 'mock-datadog-mcp',
  version: '0.1.0',
  tools
});

async function loadTraces() {
  const raw = await readFile(TRACE_PATH, 'utf-8');
  return JSON.parse(raw);
}
