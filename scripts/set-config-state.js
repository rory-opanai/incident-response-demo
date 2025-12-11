import { copyFile } from 'fs/promises';
import path from 'path';

const state = process.argv[2];
const baseDir = path.join(process.cwd(), 'fixtures', 'config');
const target = path.join(baseDir, 'runtime.active.json');
const sources = {
  good: path.join(baseDir, 'runtime.good.json'),
  broken: path.join(baseDir, 'runtime.broken.json')
};

async function main() {
  if (!state || !sources[state]) {
    console.error('Usage: node scripts/set-config-state.js [good|broken]');
    process.exit(1);
  }

  await copyFile(sources[state], target);
  console.log(`Active runtime config updated to: ${state}`);
}

main().catch((error) => {
  console.error('Failed to update config state', error);
  process.exit(1);
});
