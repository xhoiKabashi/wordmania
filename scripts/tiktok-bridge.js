#!/usr/bin/env node
'use strict';

/**
 * TikTok Live -> FjalëMania Live Bridge
 * Based on the battle-tested TikTok Live adapter architecture.
 *
 * Connects directly to a TikTok creator's live stream using tiktok-live-connector v2
 * and automatically relays chat comments, likes, gifts, and joins into the
 * local game server at http://localhost:3000/api/event.
 *
 * Usage:
 *   node scripts/tiktok-bridge.js <TIKTOK_USERNAME>
 *
 * Example:
 *   node scripts/tiktok-bridge.js my_user_name
 */

const http = require('http');
let connector;
try {
  connector = require('tiktok-live-connector');
} catch (err) {
  console.error('\n[Error] "tiktok-live-connector" is not installed.');
  console.error('Run: npm install tiktok-live-connector\n');
  process.exit(1);
}

const TikTokLiveConnection = connector.TikTokLiveConnection || connector.WebcastPushConnection;
const WebcastEvent = connector.WebcastEvent || {
  CHAT: 'chat',
  LIKE: 'like',
  GIFT: 'gift',
  FOLLOW: 'follow',
  SHARE: 'share',
  STREAM_END: 'streamEnd'
};
const ControlEvent = connector.ControlEvent || { DISCONNECTED: 'disconnected' };

const rawUser = process.argv[2] || process.env.TIKTOK_USER || process.env.TIKTOK_USERNAME;
const SERVER_URL = process.env.GAME_SERVER_URL || 'http://localhost:3000/api/event';

if (!rawUser) {
  console.log('----------------------------------------------------');
  console.log(' FJALËMANIA LIVE AL — TikTok Live Connector Bridge');
  console.log('----------------------------------------------------');
  console.log('Usage:');
  console.log('  node scripts/tiktok-bridge.js <TIKTOK_USERNAME>\n');
  console.log('Example:');
  console.log('  node scripts/tiktok-bridge.js andi_tirana\n');
  process.exit(1);
}

const username = String(rawUser).replace(/^@+/, '').trim();

function extractTikTokUser(data) {
  const u = data?.user;
  const userId = String(
    u?.displayId || u?.uniqueId || data?.uniqueId || u?.id || u?.userId || data?.userId || ''
  ).trim();
  if (!userId) return null;
  const nickname = String(u?.nickname || data?.nickname || userId).trim() || userId;
  return { userId, nickname };
}

function mapTikTokChat(data) {
  const user = extractTikTokUser(data);
  const text = String(data?.content ?? data?.comment ?? '').trim();
  if (!text) return null;
  return {
    user: user ? user.userId : 'Viewer',
    nickname: user ? user.nickname : 'Viewer',
    text
  };
}

let lastTotalLikes = 0;
function mapTikTokLike(data) {
  const user = extractTikTokUser(data);
  const parsedCount = Number(data?.count ?? data?.likeCount);
  let count = Number.isFinite(parsedCount) && parsedCount > 0 ? Math.round(parsedCount) : 0;
  const totalLikes = Number(data?.total ?? data?.totalLikeCount ?? 0) || 0;
  if (totalLikes > 0) {
    if (lastTotalLikes === 0 && totalLikes - count > 200) {
      lastTotalLikes = totalLikes;
    } else if (totalLikes > lastTotalLikes) {
      const totalDelta = totalLikes - lastTotalLikes;
      lastTotalLikes = totalLikes;
      if (count <= 0) count = Math.min(100, totalDelta);
    }
  }
  return {
    user: user ? user.userId : 'Viewer',
    count: count > 0 ? count : 1,
    totalLikes
  };
}

function mapTikTokGift(data) {
  const user = extractTikTokUser(data);
  const giftObj = data?.gift;
  const ext = data?.extendedGiftInfo;
  const legacy = data?.giftDetails;

  const giftName = String(giftObj?.name || ext?.name || legacy?.giftName || data?.giftName || 'Gift');
  const repeatCount = Math.max(1, Number(data?.repeatCount || 1) || 1);
  const repeatEnd = Boolean(data?.repeatEnd);
  const rawType = giftObj?.type ?? ext?.type ?? legacy?.giftType ?? data?.giftType;
  const giftType = rawType !== undefined && rawType !== null ? Number(rawType) : (giftObj?.combo ? 1 : 0);

  return {
    user: user ? user.userId : 'Viewer',
    giftName,
    count: repeatCount,
    repeatEnd,
    giftType
  };
}

function postEvent(payload) {
  const data = JSON.stringify(payload);
  const u = new URL(SERVER_URL);
  const req = http.request(
    {
      hostname: u.hostname,
      port: u.port || 80,
      path: u.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    },
    (res) => {
      res.resume();
    }
  );
  req.on('error', () => {
    // Ignore transient network errors
  });
  req.write(data);
  req.end();
}

console.log(`[Bridge] Lidhja me @${username}...`);

const signApiKey = process.env.EULER_API_KEY || process.env.SIGN_API_KEY || undefined;
const tiktok = new TikTokLiveConnection(username, {
  ...(signApiKey ? { signApiKey } : {}),
  enableExtendedGiftInfo: false,
  processInitialData: false,
  fetchRoomInfoOnConnect: true
});

tiktok
  .connect()
  .then((state) => {
    console.log(`[Bridge] ✓ E lidhur me sukses me dhomën Live: ${state.roomId || 'OK'}!`);
    console.log(`[Bridge] Duke dërguar komentet, likes dhe gifts te ${SERVER_URL}...\n`);
  })
  .catch((err) => {
    console.error(`[Bridge] Lidhja dështoi për @${username}:`, err.message || err);
    console.log('\nKëshillë: Sigurohuni që llogaria @' + username + ' është aktualisht LIVE në TikTok.');
  });

tiktok.on(WebcastEvent.CHAT || 'chat', (data) => {
  const msg = mapTikTokChat(data);
  if (!msg) return;
  postEvent({
    type: 'comment',
    user: msg.user,
    text: msg.text
  });
  console.log(`[Koment] @${msg.user}: "${msg.text}"`);
});

tiktok.on(WebcastEvent.LIKE || 'like', (data) => {
  const msg = mapTikTokLike(data);
  if (!msg) return;
  postEvent({
    type: 'like',
    count: msg.count
  });
  console.log(`[Like] +${msg.count} likes nga @${msg.user}`);
});

tiktok.on(WebcastEvent.GIFT || 'gift', (data) => {
  const msg = mapTikTokGift(data);
  if (!msg) return;
  if (msg.giftType === 1 && !msg.repeatEnd) return; // streak in progress
  postEvent({
    type: 'gift',
    gift: msg.giftName,
    giftName: msg.giftName,
    user: msg.user,
    count: msg.count
  });
  console.log(`[Dhuratë] @${msg.user} dërgoi ${msg.count}x ${msg.giftName}`);
});

tiktok.on(WebcastEvent.FOLLOW || 'follow', (data) => {
  const user = extractTikTokUser(data);
  if (user) {
    postEvent({ type: 'follow', user: user.userId });
    console.log(`[Follow] @${user.userId} bëri follow`);
  }
});

tiktok.on(WebcastEvent.SHARE || 'share', (data) => {
  const user = extractTikTokUser(data);
  if (user) {
    postEvent({ type: 'share', user: user.userId });
    console.log(`[Share] @${user.userId} ndau live-in`);
  }
});

tiktok.on(ControlEvent.DISCONNECTED || 'disconnected', () => {
  console.log('[Bridge] U shkëput nga TikTok. Duke u rilidhur pas 3s...');
  setTimeout(() => {
    tiktok.connect().catch(() => {});
  }, 3000);
});

tiktok.on(WebcastEvent.STREAM_END || 'streamEnd', () => {
  console.log('[Bridge] Live stream përfundoi nga krijuesi.');
});
