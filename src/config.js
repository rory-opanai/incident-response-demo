import { readFile } from 'fs/promises';
import path from 'path';

const CONFIG_DIR = path.join(process.cwd(), 'fixtures', 'config');

export function getConfigPath(name = 'active') {
  const filename = `runtime.${name}.json`;
  return path.join(CONFIG_DIR, filename);
}

export async function loadRuntimeConfig(name = 'active') {
  const configPath = getConfigPath(name);
  const raw = await readFile(configPath, 'utf-8');
  return JSON.parse(raw);
}
