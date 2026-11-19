# FJALËMANIA LIVE 🇦🇱

An interactive **9:16 TikTok Live word game** made for an OBS browser source.
Viewers play with the streamer's chat:

- **Comments** → find the hidden words and win points.
- **Likes** → reveal letters, reveal a whole word, then unlock a 2X frenzy.
- **Gifts** → change theme/song, reveal letters, or trigger a 3X VIP power-up.
- **Team effort** → every 5 gifts trigger **HYPER**: golden word unlocked + 3X.

The whole stage is authored at **1080 × 1920** and scales as one unit, so the OBS
capture is pixel-perfect.

**Content:** 24 topics · 925 Albanian words · 96 golden words · 20-track music
playlist with crossfade.

---

## Quick start

```bash
npm start
```

- Studio (host panel + preview): <http://localhost:3000/>
- OBS capture: <http://localhost:3000/?obs=1>
- Phone (same Wi-Fi): printed in the terminal as **Phone:**, also shown in the studio
- Health check: <http://localhost:3000/api/health>

No dependencies. Node 18+.

---

## OBS setup

1. **Sources → + → Browser**
2. Set **Width 1080**, **Height 1920**
3. URL: `http://localhost:3000/?obs=1`
4. Enable **Control audio via OBS** if you want the music (MP3 playlist or the
   procedural fallback) in the mix.
5. Keep **Shutdown source when not visible** OFF and **Refresh browser when scene
   becomes active** OFF — otherwise scores reset when you switch scenes.
6. In TikTok LIVE Studio / OBS, add the source under your camera and stream in
   **9:16**.

The stage already leaves room for TikTok's own UI:

| Zone | Reserved |
| --- | --- |
| Top (LIVE badge, viewers) | `150px` |
| Bottom (comments, gift bar) | `280px` |
| Right (like/comment/gift rail) | `120px` |

To see the guides while setting up, open `/?obs=1&safe=1` or press
**📐 Safe zones** in the studio.

---

## Watch on your phone (same Wi-Fi)

The server listens on `0.0.0.0`, so it is already reachable from the same Wi-Fi.
When it starts, the terminal prints:

```text
Phone  : http://192.168.1.23:3000/?phone=1   (same Wi-Fi)
```

The same URL appears in the studio under **🔌 Bridge & OBS**, with a copy button.

Open it on your phone and you get a clean 9:16 viewer with fullscreen and local
music buttons. It **mirrors the page that OBS is capturing** (`?obs=1`): same
topic, board, golden, solved words, likes, timer, leaderboard and result cards.
The mirror uses a lightweight snapshot every ~0.9s over the local network; it
does not need OBS WebSocket, screen sharing or an internet connection.

> The mirror needs the OBS page (`?obs=1`) to be open — the OBS browser source is
> enough. If the phone shows **DUKE U LIDHUR…**, open the OBS source (or
> `http://localhost:3000/?obs=1` in a tab on the PC).

If the phone cannot open the URL, Windows Firewall is usually blocking Node.js
or TCP 3000. Run once **as Administrator**:

```bash
npm run firewall
```

…or allow Node.js on **Private** networks when Windows asks. The script creates a
Private-network inbound rule for TCP 3000. If you use another port, pass it:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/open-firewall.ps1 -Port 3001
```

The phone viewer is read-only. Its music/fullscreen buttons only affect the phone.
Anyone on the same Wi-Fi can reach the studio and webhook, so use a trusted
network.

---

## How the game plays

- Each round has **90 seconds**, 9 letters, **6 normal words + 1 golden word**.
- **24 topics** are drawn from a shuffled deck. Every topic appears once per
  cycle before the deck reshuffles, and the last topic of a cycle never starts
  the next one.
- Each topic has **4 golden candidates**. The golden rotates, never repeating
  either of the previous two goldens for that topic.
- The board avoids the words used in the topic's **previous two appearances**,
  so revisiting a topic gives a fresh board.
- Words are matched case/diacritic-insensitively (`BUKA` = `BUKË`).
- Points: `letters × 20`; the **golden word is ×3**.
- **Combo:** find another word within 14s and your multiplier grows by 25%,
  up to **2X** (stacks with 2X/3X power-ups).
- **Bonus words** from the topic's extra dictionary are worth +25 and trigger a
  letter trace. Words left over from the board pool also count as bonus.
- Solve the whole board for a **PERFECT** result card, or let the timer run out
  to reveal the missing words.
- The **TOP 3** accumulates across rounds. New leader → "MBRET I RI" alert.
- **Seasons:** every **90 rounds** (≈1.5–2h of busy chat) the game shows a season
  recap with the top 3 and total points, then resets scores, likes and hype for a
  fresh season. Change it with `CFG.seasonRounds` or `?season=N`.

### Comment matching is forgiving

- **Case-insensitive:** `BUKË`, `bukë`, `Buke` all match the same word.
- **Trimmed:** leading/trailing spaces are removed; spaces and punctuation are
  ignored, so `  bukë! ` works.
- **Ë = E and Ç = C:** you can type `buke` for `BUKË`, or `caj` for `ÇAJ`, exactly
  like writing Albanian on a phone keyboard without the Ë key.
- **Definite/indefinite stay distinct:** `BUKA` (the bread) and `BUKË` (bread) are
  different answers, as they should be.

The server also trims comments before broadcasting them; the game then normalizes
them for matching. Player names keep their original display case.

### Likes ladder (progressive: 200 → 400 → 600 → …)

Every likes level reveals **1 random letter**, then the meter resets and the
next level needs **200 more likes** than the previous one:

| Level | Likes needed | Reward |
| --- | --- | --- |
| 1 | 200 | 1 random letter |
| 2 | 400 | 1 random letter |
| 3 | 600 | 1 random letter |
| … | +200 each level | 1 random letter |

Leftover likes carry over (e.g. 500 likes finish level 1 at 200, then put the
remaining 300 toward the 400 needed for level 2). The ladder restarts at 200
when the season or game is reset.

### Gifts

Every 5 gifts trigger **HYPER**: the golden word is unlocked and the game gets
3X for 30 seconds. (The progress is no longer shown as a meter; the 5th gift
announces it.)

| Raw gift name contains | Game effect | Points |
| --- | --- | --- |
| `rose`, `roze`, `ngjyr`, `color` | Changes the game colors/theme | +30 |
| `tiktok`, `music`, `song`, `keng` | Next track from the music playlist | +50 |
| `finger`, `heart`, `donut`, `ice`, `hint`, `rrufe` | +2 letters revealed | +60 |
| `eagle`, `lion`, `galaxy`, `crown`, `castle`, `shqiponj` | 3X VIP for 45s + reveal a word | +200 |
| anything else | Hype + points only | +30 |

Combos (`repeatCount`) are counted: 3× Rose = 3 hype, 3× the points (capped at 10).

The mapping lives in `public/words-al.js → GIFTS` (`id + aliases`). The server
uses the same list, so changing aliases changes both sides.

---

## Connecting TikTok events

The game listens on Server-Sent Events (`GET /api/stream`) and accepts events on
`POST` **or** `GET /api/event`. Any bridge that can make an HTTP request works
(TikFinity custom API, Streamer.bot, TikTokLive, Node/Python scripts…).

### Test with curl

```bash
# comment (guess)
curl -X POST http://localhost:3000/api/event \
  -H "Content-Type: application/json" \
  -d '{"type":"comment","uniqueId":"andi_tirana","comment":"bukë"}'

# like
curl -X POST http://localhost:3000/api/event \
  -H "Content-Type: application/json" \
  -d '{"type":"like","count":120}'

# gift
curl -X POST http://localhost:3000/api/event \
  -H "Content-Type: application/json" \
  -d '{"type":"gift","uniqueId":"drilon_ch","giftName":"Rose","repeatCount":3}'

# viewers (optional)
curl "http://localhost:3000/api/event?type=viewers&count=1284"
```

### Forwarding raw TikTok payloads

The server normalizes common TikTok bridge fields, so you can forward an event
almost unchanged:

| Game field | Accepted raw fields |
| --- | --- |
| type | `type`, `event`, `eventType`, `action` (`comment`, `like`, `gift`, `viewers`, `join`, `follow`) |
| user | `user`, `uniqueId`, `nickname`, `nickName`, `userName`, `userId` |
| text | `text`, `comment`, `message`, `content` |
| count | `count`, `repeatCount`, `likeCount`, `likes` |
| gift | `giftName`, `gift`, `giftType`, `presentName` |
| viewers | `count`, `viewerCount`, `viewers`, `audience` |

Example TikTokLive bridge:

```js
// npm i tiktok-live-connector
const { WebcastPushConnection } = require('tiktok-live-connector');
const tiktok = new WebcastPushConnection('YOUR_TIKTOK_USERNAME');

const send = (payload) =>
  fetch('http://localhost:3000/api/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

tiktok.on('chat', (d) => send({ type: 'comment', uniqueId: d.uniqueId, comment: d.comment }));
tiktok.on('like', (d) => send({ type: 'like', count: d.likeCount }));
tiktok.on('gift', (d) =>
  send({ type: 'gift', uniqueId: d.uniqueId, giftName: d.giftName, repeatCount: d.repeatCount })
);
tiktok.on('roomUser', (d) => send({ type: 'viewers', count: d.viewerCount }));

tiktok.connect();
```

> If your bridge sends **cumulative** like totals instead of a delta, send the
> difference (most bridges send the increment in `likeCount`).

### Demo vs. live

The built-in simulator keeps the studio alive while you set up. On the **first
real event** it turns itself off and the game starts a clean round so demo scores
never mix with real viewers. You can re-enable it manually in **👥 Simulator**.

Check what the bridge is actually sending at <http://localhost:3000/api/state>.

---

## Host controls

Studio panel (right side of the app, hidden in OBS mode):

- **Testo komentin** — type a guess as any user; quick chips solve board words.
- **Dhuratat** — one-click test for every gift.
- **Likes & kontrol** — +500 likes, +2 letters, reveal word, 2X, next round, music.
  Below the buttons: **now playing** + a music **volume** slider (saved locally).
- **Simulator** — auto/normal/viral, auto-disabled by live events.
- **Bridge & OBS** — copy the webhook / OBS URL, safe-zone guides, reset.

Keyboard shortcuts (when not typing in an input):

| Key | Action |
| --- | --- |
| `Space` | next round |
| `H` | reveal 2 letters |
| `L` | +500 likes |
| `M` | music on/off |
| `E` | fire the eagle (3X) |
| `O` | toggle OBS mode |

In OBS mode the "Exit OBS" pill is hidden from the capture and only appears if
you move a real mouse over the browser window.

URL flags:

- `?obs=1` → clean full-screen mode
- `?phone=1` → clean read-only phone viewer (mirrors the OBS page)
- `?safe=1` → show TikTok safe-zone guides
- `?music=1` → start the music playlist on load
- `?season=60` → rounds per season (2–999, for testing or a shorter show)

---

## Customize

| What | Where |
| --- | --- |
| Topics, letters, words, goldens, bonus | `public/words-al.js → ROUNDS` |
| Themes / procedural songs | `public/words-al.js → THEMES / SONGS` + `.theme-*` in `styles.css` |
| Gifts & effects | `public/words-al.js → GIFTS` + `handleGift()` in `public/game.js` |
| Round length, board size, seasons, tiers | `CFG` at the top of `public/game.js` |
| Colors, sizes, safe zones | `public/styles.css` (`:root` + theme blocks) |
| Music playlist | drop `.mp3` / `.m4a` / `.ogg` / `.wav` files into `music/` |
| Stage artwork | `public/art/bg.svg` (Tirana backdrop) |
| Mascot | `public/art/mascot.svg` (the duck host) |

After editing any topic, run:

```bash
npm run check:words
```

It verifies that every word (including **all four goldens**) can be formed from
the topic's letters, that there are no normalized duplicates (`Ë`/`E` and `Ç`/`C`
are the same guess in-game), and that at least 6 short words exist for every
possible golden.

Every topic must include at least **6 non-golden words of 6 letters or fewer** —
the board picks 6 of them, balanced across 3–4, 5 and 6 letter words, and avoids
words from the topic's previous two boards.

### Music

The server scans `music/` at request time and exposes:

- `GET /api/music` → `{ tracks: [{ name, file, url, size }] }`
- `GET /music/<file>` → audio with `Range` support

The client shuffles the playlist, crossfades every track, and advances on its own
when a song ends. The **🎵 TikTok** gift switches to the next track, and the
studio shows the current track + volume. If `music/` is empty, the game falls back
to the six generated WebAudio tracks.

---

## API

| Endpoint | Description |
| --- | --- |
| `GET /api/stream` | SSE stream consumed by the game |
| `GET/POST /api/event` | Send a comment, like, gift, viewers, join or follow |
| `GET /api/music` | Scan `music/` and return the playlist |
| `GET /music/<file>` | Stream an audio file (Range supported) |
| `GET /api/network` | LAN URLs for the phone viewer |
| `GET/POST /api/spectate` | Latest mirrored frame / publish from the OBS page |
| `GET /api/health` | Uptime + connected clients |
| `GET /api/state` | Event counters + the last 12 normalized events |

There is also a tiny console helper while the page is open:

```js
FJALEMANIA.snapshot()          // topic, board, golden, season, likes, hype
FJALEMANIA.comment('user', 'bukë')
FJALEMANIA.gift('user', 'song')  // next music track
FJALEMANIA.like(500)
FJALEMANIA.nextRound()
FJALEMANIA.setSeason(60)
```

---

## Files

```text
server.js                HTTP + SSE + music library + spectate + webhooks
scripts/verify-words.js  dictionary checks (npm run check:words)
scripts/open-firewall.ps1  Windows Private-network rule for TCP 3000
music/                   MP3 playlist (auto-detected by the server)
public/index.html        stage markup + host studio + phone viewer
public/styles.css        1080×1920 design system, themes, phone mode
public/game.js           topics, scoring, seasons, rotation, mirror, bridge
public/words-al.js       24 topics, 925 words, 96 goldens, gifts, themes
public/audio.js          playlist player + procedural fallback + SFX
```

---

## Troubleshooting

- **No events arrive** — open `/api/state`; if `events` stays 0, the bridge is not
  reaching `/api/event`. Test with the curl example first.
- **Scores reset when the bridge connects** — expected once: the first live event
  clears the demo leaderboard. It does not repeat on reconnects.
- **OBS shows the wrong size** — the browser source must be 1080×1920; the page
  letterboxes to fit any other size.
- **Phone can't connect** — both devices must be on the same Wi-Fi. Use the
  `Phone:` URL from the terminal, not `localhost`. Allow Node.js / TCP 3000:
  `npm run firewall` as Administrator.
- **Phone says DUKE U LIDHUR…** — the OBS page (`?obs=1`) isn't open; the phone
  mirrors that page. Open the OBS browser source or a local `?obs=1` tab.
- **No music** — check `/api/music`; if `tracks` is empty, add MP3 files to
  `music/`. Browsers (and OBS without audio control) may block autoplay until a
  real interaction: use `?music=1`, click **Muzikë**, or set the source to
  *Control audio via OBS*. The studio volume slider is saved locally.
- **Scores reset every ~90 rounds** — that's the season recap. Use
  `?season=999` (or `CFG.seasonRounds`) for a longer season.
- **Port in use** — run `PORT=3001 npm start`.
- **Words seem wrong** — re-run `npm run check:words`; every word, including all
  goldens, must be formable from the topic's letters.
