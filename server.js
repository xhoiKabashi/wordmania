const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

/** @type {Set<http.ServerResponse>} */
const sseClients = new Set();

function broadcastEvent(payload) {
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  for (const res of sseClients) {
    try {
      res.write(data);
    } catch {
      sseClients.delete(res);
    }
  }
}

function sendJson(res, statusCode, body) {
  const payload = JSON.stringify(body);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(payload);
}

function serveStaticFile(reqPath, res) {
  let targetPath = reqPath === '/' ? '/index.html' : reqPath;
  try {
    targetPath = decodeURIComponent(targetPath);
  } catch {
    res.writeHead(400);
    res.end('Bad Request');
    return;
  }

  const normalized = path.normalize(targetPath).replace(/^(\.\.[/\\])+/, '');
  const fullPath = path.join(PUBLIC_DIR, normalized);

  if (!fullPath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(fullPath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not Found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Internal Server Error');
      }
      return;
    }

    const ext = path.extname(fullPath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    });
    res.end(content);
  });
}

function handleEventPost(req, res) {
  let body = '';
  let aborted = false;

  req.on('data', (chunk) => {
    body += chunk.toString('utf8');
    if (body.length > 64 * 1024) {
      aborted = true;
      sendJson(res, 413, { error: 'Payload too large' });
      req.destroy();
    }
  });

  req.on('end', () => {
    if (aborted) return;
    try {
      const parsed = body ? JSON.parse(body) : {};
      const eventType = parsed.type;
      if (!['comment', 'like', 'gift'].includes(eventType)) {
        sendJson(res, 400, { error: 'Invalid event type. Expected comment, like, or gift.' });
        return;
      }

      const sanitized = {
        type: eventType,
        user: String(parsed.user || 'Anonim').slice(0, 40),
        text: parsed.text ? String(parsed.text).slice(0, 140) : '',
        count: Number.isFinite(Number(parsed.count)) ? Math.max(1, Number(parsed.count)) : 1,
        giftType: parsed.giftType ? String(parsed.giftType).slice(0, 32) : '',
        team: parsed.team ? String(parsed.team).slice(0, 32) : '',
        ts: Date.now()
      };

      broadcastEvent(sanitized);
      sendJson(res, 200, { ok: true, clients: sseClients.size, event: sanitized });
    } catch {
      sendJson(res, 400, { error: 'Invalid JSON payload' });
    }
  });
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  if (req.method === 'GET' && pathname === '/api/health') {
    sendJson(res, 200, {
      status: 'ok',
      game: 'FjalëMania Live AL',
      clients: sseClients.size,
      uptime: Math.round(process.uptime())
    });
    return;
  }

  if (req.method === 'GET' && pathname === '/api/stream') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    res.write(`data: ${JSON.stringify({ type: 'connected', ts: Date.now() })}\n\n`);
    sseClients.add(res);

    const heartbeat = setInterval(() => {
      if (!sseClients.has(res)) {
        clearInterval(heartbeat);
        return;
      }
      res.write(': ping\n\n');
    }, 20000);

    req.on('close', () => {
      clearInterval(heartbeat);
      sseClients.delete(res);
    });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/event') {
    handleEventPost(req, res);
    return;
  }

  if (req.method === 'GET') {
    serveStaticFile(pathname, res);
    return;
  }

  res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Method Not Allowed');
});

server.listen(PORT, () => {
  console.log(`FJALËMANIA LIVE AL running at http://localhost:${PORT}`);
});
