import http from 'http';
import { readFile, stat } from 'fs/promises';
import path from 'path';
import { checkLogin } from './auth.js';
import { loadRuntimeConfig } from './config.js';

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(process.cwd(), 'public');

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
  const normalized = pathname === '/' ? '/index.html' : pathname;
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

function sendJSON(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}
