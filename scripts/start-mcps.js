import { spawn } from 'child_process';

const processes = [
  { name: 'cloudwatch', cmd: 'node', args: ['servers/mock-cloudwatch-mcp.js'] },
  { name: 'datadog', cmd: 'node', args: ['servers/mock-datadog-mcp.js'] },
  { name: 'config', cmd: 'node', args: ['servers/mock-config-mcp.js'] }
];

const children = [];

processes.forEach((proc) => {
  const child = spawn(proc.cmd, proc.args, {
    stdio: ['pipe', 'pipe', 'pipe']
  });
  children.push(child);
  process.stdout.write(`[${proc.name}] started (pid ${child.pid})\n`);

  child.stdout.on('data', (data) => {
    process.stdout.write(`[${proc.name}] ${data}`);
  });
  child.stderr.on('data', (data) => {
    process.stderr.write(`[${proc.name} ERROR] ${data}`);
  });
  child.on('exit', (code) => {
    process.stderr.write(`[${proc.name}] exited with code ${code}\n`);
  });
});

process.on('SIGINT', () => {
  process.stderr.write('Stopping MCP servers...\n');
  children.forEach((child) => child.kill('SIGINT'));
  process.exit(0);
});
