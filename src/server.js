import http from 'http';
import { readFile, stat } from 'fs/promises';
import path from 'path';
import { checkLogin } from './auth.js';
import { loadRuntimeConfig } from './config.js';

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(process.cwd(), 'public');
const CLOUDWATCH_LOG_PATH = path.join(process.cwd(), 'fixtures', 'cloudwatch', 'auth-log.jsonl');
const DATADOG_TRACE_PATH = path.join(process.cwd(), 'fixtures', 'datadog', 'traces.json');

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png'
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (req.method === 'POST' && url.pathname === '/api/login') {
    await handleLogin(req, res);
    return;
  }

  if (req.method === 'GET') {
    if (url.pathname === '/api/release') {
      await handleRelease(res);
      return;
    }
    if (url.pathname === '/api/logs/cloudwatch') {
      await handleCloudwatchLogs(res, url);
      return;
    }
    if (url.pathname === '/api/logs/datadog') {
      await handleDatadogTraces(res, url);
      return;
    }
    await serveStatic(url.pathname, res);
    return;
  }

  res.writeHead(405);
  res.end();
});

server.listen(PORT, () => {
  console.log(`Demo app running at http://localhost:${PORT}`);
});

async function handleLogin(req, res) {
  let rawBody = '';

  for await (const chunk of req) {
    rawBody += chunk.toString();
  }

  try {
    const { email, password } = JSON.parse(rawBody || '{}');
    const result = await checkLogin(email, password);

    if (result.ok) {
      sendJSON(res, 200, { ok: true, user: result.user, releaseTag: result.releaseTag });
    } else {
      const status = result.reason === 'unknown_user' ? 404 : 401;
      sendJSON(res, status, { ok: false, reason: result.reason, releaseTag: result.releaseTag });
    }
  } catch (error) {
    console.error('Failed to handle login', error);
    sendJSON(res, 500, { ok: false, reason: 'internal_error' });
  }
}

async function handleRelease(res) {
  try {
    const runtime = await loadRuntimeConfig('active');
    const { releaseTag, features = {} } = runtime;
    sendJSON(res, 200, { releaseTag, features });
  } catch (error) {
    sendJSON(res, 500, { releaseTag: null, error: 'failed_to_load_release' });
  }
}

async function serveStatic(pathname, res) {
  const normalized = normalizePath(pathname);
  const targetPath = path.join(PUBLIC_DIR, decodeURIComponent(normalized));
  const isInside = targetPath.startsWith(PUBLIC_DIR);

  if (!isInside) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  try {
    const fileStat = await stat(targetPath);
    if (fileStat.isDirectory()) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    const ext = path.extname(targetPath);
    const contentType = CONTENT_TYPES[ext] ?? 'application/octet-stream';
    const data = await readFile(targetPath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  } catch (error) {
    res.writeHead(404);
    res.end('Not Found');
  }
}

function normalizePath(pathname) {
  if (pathname === '/') return '/index.html';
  if (pathname === '/logs' || pathname === '/logs/' || pathname === '/log' || pathname === '/log/') {
    return '/log.html';
  }
  return pathname;
}

function sendJSON(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

async function handleCloudwatchLogs(res, url) {
  try {
    const entries = await loadCloudwatchLogs();
    const args = {
      request_id: url.searchParams.get('request_id') || undefined,
      trace_id: url.searchParams.get('trace_id') || undefined,
      contains: url.searchParams.get('contains') || undefined
    };
    const limit = Number(url.searchParams.get('limit')) || entries.length;
    const filtered = entries.filter((entry) => matchesCloudwatch(entry, args));
    sendJSON(res, 200, { entries: filtered.slice(0, limit) });
  } catch (error) {
    console.error('Failed to load CloudWatch logs', error);
    sendJSON(res, 500, { error: 'failed_to_load_cloudwatch_logs' });
  }
}

async function handleDatadogTraces(res, url) {
  try {
    const traces = await loadDatadogTraces();
    const requestId = url.searchParams.get('request_id');
    const status = url.searchParams.get('status');
    const filtered = traces.filter((trace) => {
      if (requestId && trace.request_id !== requestId) return false;
      if (status && trace.status !== status) return false;
      return true;
    });
    sendJSON(res, 200, { traces: filtered });
  } catch (error) {
    console.error('Failed to load Datadog traces', error);
    sendJSON(res, 500, { error: 'failed_to_load_datadog_traces' });
  }
}

async function loadCloudwatchLogs() {
  const raw = await readFile(CLOUDWATCH_LOG_PATH, 'utf-8');
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

async function loadDatadogTraces() {
  const raw = await readFile(DATADOG_TRACE_PATH, 'utf-8');
  return JSON.parse(raw);
}

function matchesCloudwatch(entry, args = {}) {
  if (args.request_id && entry.request_id !== args.request_id) return false;
  if (args.trace_id && entry.trace_id !== args.trace_id) return false;
  if (args.contains) {
    const haystack = `${entry.message ?? ''} ${JSON.stringify(entry.details ?? {})}`;
    if (!haystack.toLowerCase().includes(String(args.contains).toLowerCase())) return false;
  }
  return true;
}
