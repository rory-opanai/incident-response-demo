import { readFile } from 'fs/promises';
import path from 'path';
import { startStdioMcpServer } from './mcp.js';

const CONFIG_DIR = path.join(process.cwd(), 'fixtures', 'config');

const tools = {
  get_runtime_config: {
    description: 'Return the active runtime configuration.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: async () => {
      return loadConfig('runtime.active.json');
    }
  },
  diff_good_vs_active: {
    description: 'Diff runtime.good.json vs runtime.active.json.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: async () => {
      const active = await loadConfig('runtime.active.json');
      const good = await loadConfig('runtime.good.json');
      return { changed: diffObjects('', active, good) };
    }
  }
};

startStdioMcpServer({
  name: 'mock-config-mcp',
  version: '0.1.0',
  tools
});

async function loadConfig(filename) {
  const filePath = path.join(CONFIG_DIR, filename);
  const raw = await readFile(filePath, 'utf-8');
  return JSON.parse(raw);
}

function diffObjects(pathPrefix, active, good) {
  const diffs = [];
  const isObject = (value) => value && typeof value === 'object' && !Array.isArray(value);

  if (isObject(active) && isObject(good)) {
    const keys = new Set([...Object.keys(active), ...Object.keys(good)]);
    for (const key of keys) {
      const childPath = pathPrefix ? `${pathPrefix}.${key}` : key;
      const childDiffs = diffObjects(childPath, active[key], good[key]);
      diffs.push(...childDiffs);
    }
    return diffs;
  }

  if (JSON.stringify(active) !== JSON.stringify(good)) {
    diffs.push({
      path: pathPrefix || 'root',
      active,
      good
    });
  }

  return diffs;
}
