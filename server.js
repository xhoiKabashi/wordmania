'use strict';

/* ============================================================
   FJALËMANIA LIVE — local server
   - Serves the 1080×1920 game
   - SSE bridge for OBS/Chrome (GET /api/stream)
   - Webhook for TikTok bridges (POST or GET /api/event)
   - Normalizes raw TikTok payloads (uniqueId/nickname/comment/
     giftName/repeatCount/likeCount) so most bridges work as-is
   ============================================================ */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { URL } = require('url');

// Load the shared game data (gift aliases live there, single source of truth)
try {
  require('./public/words-al.js');
} catch {
  /* ignore: fallback aliases below */
}

const DATA = globalThis.ALBANIAN_DATA || {};
const GIFTS = Array.isArray(DATA.GIFTS) && DATA.GIFTS.length
  ? DATA.GIFTS
  : [
      { id: 'theme', aliases: ['rose', 'roze', 'trendafil', 'trëndafil', 'ngjyr', 'color'] },
      { id: 'song', aliases: ['tiktok', 'music', 'song', 'keng'] },
      { id: 'hint', aliases: ['rocket', 'raket', 'rakete', 'raketë', 'hint', 'lightning', 'rrufe'] },
      { id: 'eagle', aliases: ['finger heart', 'finger', 'heart', 'zemer', 'zemër', 'gisht', 'eagle', 'lion', 'galaxy', 'universe', 'castle', 'crown', 'shqiponj', 'vip'] }
    ];

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const PUBLIC_DIR = path.join(__dirname, 'public');
const MUSIC_DIR = path.join(__dirname, 'music');
const MAX_BODY = 32 * 1024;
const VERBOSE = process.env.VERBOSE === '1';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg'
};

const AUDIO_EXTS = new Map([
  ['.mp3', 'audio/mpeg'],
  ['.m4a', 'audio/mp4'],
  ['.ogg', 'audio/ogg'],
  ['.wav', 'audio/wav']
]);

function listMusicTracks() {
  let files = [];
  try {
    files = fs.readdirSync(MUSIC_DIR);
  } catch {
    return [];
  }

  return files
    .filter((file) => AUDIO_EXTS.has(path.extname(file).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, 'sq'))
    .map((file) => {
      const ext = path.extname(file).toLowerCase();
      let size = 0;
      try {
        size = fs.statSync(path.join(MUSIC_DIR, file)).size;
      } catch {
        /* ignore */
      }
      return {
        name: path.basename(file, ext),
        file,
        url: `/music/${encodeURIComponent(file)}`,
        size
      };
    });
}


/** @type {Map<number, http.ServerResponse>} */
const sseClients = new Map();
let nextClientId = 1;

/** Latest mirrored game frame from the OBS page (for the phone viewer). */
let latestSpectate = null;

const LAN_DISABLED = ['127.0.0.1', 'localhost', '::1'].includes(HOST);

function lanAddresses() {
  const list = [];
  const ifaces = os.networkInterfaces();
  for (const [name, nets] of Object.entries(ifaces)) {
    for (const net of nets || []) {
      if (net.family !== 'IPv4' && net.family !== 4) continue;
      if (net.internal) continue;
      const address = net.address;
      if (!address || address.startsWith('169.254.')) continue;
      list.push({ name, address });
    }
  }
  const score = (ip) => {
    if (ip.startsWith('192.168.')) return 3;
    if (ip.startsWith('10.')) return 2;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return 2;
    return 1;
  };
  list.sort((a, b) => score(b.address) - score(a.address));
  return list;
}

function networkInfo() {
  const addresses = lanAddresses().map(({ name, address }) => ({
    name,
    address,
    url: `http://${address}:${PORT}/`,
    phoneUrl: `http://${address}:${PORT}/?phone=1`
  }));
  return { port: PORT, lanEnabled: !LAN_DISABLED, addresses };
}

const stats = {
  startedAt: Date.now(),
  events: 0,
  comments: 0,
  likes: 0,
  gifts: 0,
  rejected: 0,
  lastEventAt: 0,
  recent: []
};

const likeQueue = { pending: 0, timer: null };
const rateBuckets = new Map();

/* ---------------------------------------------------------------
   SSE
   --------------------------------------------------------------- */

function broadcast(payload) {
  const frame = `data: ${JSON.stringify(payload)}\n\n`;
  for (const [id, res] of sseClients) {
    try {
      if (res.writableEnded || res.destroyed) {
        sseClients.delete(id);
        continue;
      }
      // drop frames for a stalled client rather than buffering forever
      if (res.writableLength > 512 * 1024) continue;
      res.write(frame);
    } catch {
      sseClients.delete(id);
    }
  }
}

function broadcastLikes() {
  likeQueue.timer = null;
  if (likeQueue.pending <= 0) return;
  const count = Math.min(likeQueue.pending, 100000);
  likeQueue.pending = 0;
  broadcast({ type: 'like', count, ts: Date.now() });
}

function queueLike(count) {
  likeQueue.pending += count;
  if (!likeQueue.timer) {
    likeQueue.timer = setTimeout(broadcastLikes, 120);
  }
}

function handleStream(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
    'Access-Control-Allow-Origin': '*'
  });
  if (typeof res.flushHeaders === 'function') res.flushHeaders();

  const id = nextClientId++;
  sseClients.set(id, res);
  res.write(`data: ${JSON.stringify({ type: 'connected', clients: sseClients.size, ts: Date.now() })}\n\n`);

  const heartbeat = setInterval(() => {
    if (!sseClients.has(id)) {
      clearInterval(heartbeat);
      return;
    }
    try {
      res.write(': ping\n\n');
    } catch {
      sseClients.delete(id);
    }
  }, 20000);

  const cleanup = () => {
    clearInterval(heartbeat);
    sseClients.delete(id);
  };
  req.on('close', cleanup);
  req.on('aborted', cleanup);
  res.on('close', cleanup);
  res.on('error', cleanup);
}

/* ---------------------------------------------------------------
   EVENT NORMALIZATION
   --------------------------------------------------------------- */

function pickFirst(...values) {
  for (const v of values) {
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return '';
}

function mapGift(rawGift) {
  const name = String(rawGift || '').toLowerCase().trim();
  if (!name) return GIFTS[0].id;
  const direct = GIFTS.find((g) => g.id === name);
  if (direct) return direct.id;
  const hit = GIFTS.find((g) => (g.aliases || []).some((alias) => name.includes(alias)));
  return hit ? hit.id : GIFTS[0].id;
}

function normalizeType(raw) {
  const t = String(raw || '').toLowerCase().trim();
  if (['comment', 'chat', 'message', 'commentary'].includes(t)) return 'comment';
  if (['like', 'likes', 'heart', 'hearts'].includes(t)) return 'like';
  if (['gift', 'gifts', 'present'].includes(t)) return 'gift';
  if (['viewers', 'viewer', 'viewercount', 'audience'].includes(t)) return 'viewers';
  if (['join', 'member', 'enter', 'joined'].includes(t)) return 'join';
  if (['follow', 'follower', 'share', 'subscribe'].includes(t)) return 'follow';
  return '';
}

function sanitizeEvent(input) {
  if (!input || typeof input !== 'object') return { error: 'Invalid payload' };

  const type = normalizeType(pickFirst(input.type, input.event, input.eventType, input.action));
  if (!type) return { error: 'Invalid event type. Use comment, like, gift, viewers, join or follow.' };

  if (type === 'like') {
    const raw = Number(pickFirst(input.count, input.repeatCount, input.likeCount, input.likes, 1));
    const count = Number.isFinite(raw) ? Math.min(100000, Math.max(1, Math.round(raw))) : 1;
    return { event: { type: 'like', count, ts: Date.now() } };
  }

  if (type === 'viewers') {
    const raw = Number(pickFirst(input.count, input.viewerCount, input.viewers, input.audience, 0));
    return {
      event: {
        type: 'viewers',
        count: Number.isFinite(raw) ? Math.max(0, Math.round(raw)) : 0,
        ts: Date.now()
      }
    };
  }

  const user = String(
    pickFirst(input.user, input.uniqueId, input.nickname, input.nickName, input.userName, input.userId, 'Anonim')
  )
    .replace(/^@+/, '')
    .trim()
    .slice(0, 24) || 'Anonim';

  if (type === 'comment') {
    const text = String(pickFirst(input.text, input.comment, input.message, input.content, ''))
      .trim()
      .slice(0, 140);
    if (!text) return { error: 'Comment text is empty' };
    return { event: { type: 'comment', user, text, team: String(pickFirst(input.team, '')).slice(0, 32), ts: Date.now() } };
  }

  if (type === 'gift') {
    const repeatRaw = Number(pickFirst(input.repeatCount, input.count, input.combo, 1));
    const repeat = Number.isFinite(repeatRaw) ? Math.min(100, Math.max(1, Math.round(repeatRaw))) : 1;
    const giftName = pickFirst(input.giftName, input.gift, input.giftType, input.presentName, '');
    return {
      event: {
        type: 'gift',
        user,
        giftType: mapGift(giftName),
        giftName: String(giftName).slice(0, 40),
        count: repeat,
        ts: Date.now()
      }
    };
  }

  // join / follow
  return { event: { type, user, ts: Date.now() } };
}

/* ---------------------------------------------------------------
   RATE LIMIT
   --------------------------------------------------------------- */

function allowRequest(ip) {
  const now = Date.now();
  let bucket = rateBuckets.get(ip);
  if (!bucket || now - bucket.start > 1000) {
    bucket = { start: now, count: 0 };
    rateBuckets.set(ip, bucket);
  }
  bucket.count += 1;
  return bucket.count <= 80;
}

setInterval(() => {
  const now = Date.now();
  for (const [ip, bucket] of rateBuckets) {
    if (now - bucket.start > 15000) rateBuckets.delete(ip);
  }
}, 30000).unref();

/* ---------------------------------------------------------------
   HTTP HELPERS
   --------------------------------------------------------------- */

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
}

function sendJson(res, statusCode, body) {
  const payload = JSON.stringify(body);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(payload),
    ...corsHeaders()
  });
  res.end(payload);
}

function publish(event) {
  stats.events += 1;
  stats.lastEventAt = Date.now();
  if (event.type === 'comment') stats.comments += 1;
  if (event.type === 'like') stats.likes += event.count || 1;
  if (event.type === 'gift') stats.gifts += 1;

  stats.recent.unshift(event);
  if (stats.recent.length > 12) stats.recent.length = 12;

  if (event.type === 'like') {
    queueLike(event.count || 1);
  } else {
    broadcast(event);
  }

  if (VERBOSE) {
    const bits = [event.type, event.user || '', event.text || '', event.giftType || ''].filter(Boolean);
    console.log(`[event] ${bits.join(' · ')}`);
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    let done = false;
    req.on('data', (chunk) => {
      if (done) return;
      body += chunk.toString('utf8');
      if (body.length > MAX_BODY) {
        done = true;
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!done) resolve(body);
    });
    req.on('error', reject);
  });
}

function parsePayload(body, contentType) {
  const type = String(contentType || '').toLowerCase();
  const trimmed = body.trim();
  if (!trimmed) return {};
  if (type.includes('application/json') || trimmed.startsWith('{')) {
    return JSON.parse(trimmed);
  }
  const params = new URLSearchParams(trimmed);
  return Object.fromEntries(params.entries());
}

async function handleEventRequest(req, res) {
  const ip = req.socket.remoteAddress || 'local';
  if (!allowRequest(ip)) {
    stats.rejected += 1;
    sendJson(res, 429, { ok: false, error: 'Rate limit exceeded' });
    return;
  }

  try {
    const u = new URL(req.url, 'http://localhost');
    const query = Object.fromEntries(u.searchParams.entries());
    let raw = query;

    if (req.method !== 'GET') {
      const body = await readBody(req);
      // merge so bridges that POST empty bodies with query params also work
      raw = { ...query, ...parsePayload(body, req.headers['content-type']) };
    }

    const { event, error } = sanitizeEvent(raw);
    if (error) {
      stats.rejected += 1;
      sendJson(res, 400, { ok: false, error });
      return;
    }

    publish(event);
    sendJson(res, 200, { ok: true, clients: sseClients.size, event });
  } catch (err) {
    stats.rejected += 1;
    const message = err && err.message === 'Payload too large' ? err.message : 'Invalid JSON payload';
    sendJson(res, err && err.message === 'Payload too large' ? 413 : 400, { ok: false, error: message });
  }
}

async function handleSpectatePost(req, res) {
  try {
    const body = await readBody(req);
    const snapshot = JSON.parse(body);
    if (!snapshot || typeof snapshot !== 'object' || !Array.isArray(snapshot.board) || !snapshot.golden) {
      sendJson(res, 400, { ok: false, error: 'Invalid snapshot' });
      return;
    }

    latestSpectate = { ...snapshot, ts: Date.now() };
    broadcast({ type: 'spectate', snapshot: latestSpectate });
    sendJson(res, 200, { ok: true, clients: sseClients.size });
  } catch (err) {
    const tooLarge = err && err.message === 'Payload too large';
    sendJson(res, tooLarge ? 413 : 400, {
      ok: false,
      error: tooLarge ? 'Payload too large' : 'Invalid snapshot'
    });
  }
}

/* ---------------------------------------------------------------
   MUSIC LIBRARY
   --------------------------------------------------------------- */

function serveMusic(reqPath, req, res) {
  let file = '';
  try {
    file = decodeURIComponent(reqPath.slice('/music/'.length));
  } catch {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Bad Request');
    return;
  }

  const fullPath = path.resolve(MUSIC_DIR, file);
  if (!fullPath.startsWith(MUSIC_DIR + path.sep)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  const mime = AUDIO_EXTS.get(path.extname(fullPath).toLowerCase());
  if (!mime) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
    return;
  }

  fs.stat(fullPath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
      return;
    }

    const total = stat.size;
    const headers = {
      'Content-Type': mime,
      'Cache-Control': 'public, max-age=3600',
      'Accept-Ranges': 'bytes'
    };
    const range = req.headers.range;

    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      let start = match && match[1] ? Number(match[1]) : 0;
      let end = match && match[2] ? Number(match[2]) : total - 1;

      if (!match || !Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= total) {
        res.writeHead(416, {
          ...headers,
          'Content-Range': `bytes */${total}`
        });
        res.end();
        return;
      }

      end = Math.min(end, total - 1);
      res.writeHead(206, {
        ...headers,
        'Content-Range': `bytes ${start}-${end}/${total}`,
        'Content-Length': end - start + 1
      });
      if (req.method === 'HEAD') {
        res.end();
        return;
      }
      const stream = fs.createReadStream(fullPath, { start, end });
      stream.on('error', () => res.destroy());
      stream.pipe(res);
      return;
    }

    res.writeHead(200, {
      ...headers,
      'Content-Length': total
    });
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    const stream = fs.createReadStream(fullPath);
    stream.on('error', () => res.destroy());
    stream.pipe(res);
  });
}

/* ---------------------------------------------------------------
   STATIC FILES
   --------------------------------------------------------------- */

function serveStatic(reqPath, res, req) {
  let target = reqPath === '/' ? '/index.html' : reqPath;
  try {
    target = decodeURIComponent(target);
  } catch {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Bad Request');
    return;
  }

  if (target === '/favicon.ico') {
    res.writeHead(204);
    res.end();
    return;
  }

  const fullPath = path.resolve(PUBLIC_DIR, `.${path.posix.normalize(target)}`);
  if (fullPath !== PUBLIC_DIR && !fullPath.startsWith(PUBLIC_DIR + path.sep)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  fs.stat(fullPath, (statErr, stat) => {
    if (statErr || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
      return;
    }

    const ext = path.extname(fullPath).toLowerCase();
    const headers = {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Cache-Control': 'no-store',
      'Content-Length': stat.size
    };

    if (req.method === 'HEAD') {
      res.writeHead(200, headers);
      res.end();
      return;
    }

    fs.readFile(fullPath, (err, content) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Internal Server Error');
        return;
      }
      res.writeHead(200, headers);
      res.end(content);
    });
  });
}

/* ---------------------------------------------------------------
   SERVER
   --------------------------------------------------------------- */

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders());
    res.end();
    return;
  }

  let pathname = '/';
  try {
    pathname = new URL(req.url, `http://${req.headers.host || 'localhost'}`).pathname;
  } catch {
    res.writeHead(400);
    res.end('Bad Request');
    return;
  }

  if (pathname === '/api/health') {
    sendJson(res, 200, {
      status: 'ok',
      game: 'FjalëMania Live AL',
      version: '2.2.0',
      clients: sseClients.size,
      uptime: Math.round((Date.now() - stats.startedAt) / 1000)
    });
    return;
  }

  if (pathname === '/api/state') {
    sendJson(res, 200, {
      clients: sseClients.size,
      events: stats.events,
      comments: stats.comments,
      likes: stats.likes,
      gifts: stats.gifts,
      rejected: stats.rejected,
      lastEventAt: stats.lastEventAt,
      recent: stats.recent
    });
    return;
  }

  if (pathname === '/api/music') {
    sendJson(res, 200, { tracks: listMusicTracks() });
    return;
  }

  if (pathname === '/api/network') {
    sendJson(res, 200, networkInfo());
    return;
  }

  if (pathname === '/api/spectate') {
    if (req.method === 'GET') {
      sendJson(res, 200, { snapshot: latestSpectate });
      return;
    }
    if (req.method === 'POST') {
      handleSpectatePost(req, res);
      return;
    }
    sendJson(res, 405, { ok: false, error: 'Method not allowed' });
    return;
  }

  if (pathname === '/api/stream' && req.method === 'GET') {
    handleStream(req, res);
    return;
  }

  if (pathname === '/api/event') {
    if (req.method === 'GET' || req.method === 'POST') {
      handleEventRequest(req, res);
      return;
    }
    sendJson(res, 405, { ok: false, error: 'Method not allowed' });
    return;
  }

  if ((req.method === 'GET' || req.method === 'HEAD') && pathname.startsWith('/music/')) {
    serveMusic(pathname, req, res);
    return;
  }

  if (req.method === 'GET' || req.method === 'HEAD') {
    serveStatic(pathname, res, req);
    return;
  }

  res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Method Not Allowed');
});

server.keepAliveTimeout = 65000;
server.headersTimeout = 70000;

server.listen(PORT, HOST, () => {
  const tracks = listMusicTracks();
  const net = networkInfo();
  const phone = net.lanEnabled && net.addresses[0] ? net.addresses[0].phoneUrl : '';
  console.log('');
  console.log('  FJALËMANIA LIVE AL  ·  v2');
  console.log(`  Studio : http://localhost:${PORT}/`);
  console.log(`  OBS    : http://localhost:${PORT}/?obs=1   (Browser 1080×1920)`);
  console.log(`  Webhook: http://localhost:${PORT}/api/event`);
  console.log(
    `  Music  : ${tracks.length ? `${tracks.length} tracks from ./music` : 'procedural fallback (./music is empty)'}`
  );
  console.log(
    `  Phone  : ${
      phone ||
      (net.lanEnabled ? 'no LAN IPv4 found — check Wi-Fi/Ethernet' : 'LAN disabled (HOST=localhost)')
    }${phone ? '   (same Wi-Fi)' : ''}`
  );
  if (net.addresses.length > 1) {
    console.log(`           ${net.addresses.slice(1).map((a) => a.phoneUrl).join('  ·  ')}`);
  }
  console.log('');
});

function shutdown() {
  console.log('\nDuke u mbyllur…');
  for (const [id, res] of sseClients) {
    try {
      res.end();
    } catch {
      /* ignore */
    }
    sseClients.delete(id);
  }
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
