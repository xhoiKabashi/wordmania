/* ============================================================
   FJALËMANIA LIVE — game engine
   Designed for a 1080×1920 OBS browser source.
   Events: comments (guess), likes (reveal), gifts (power-ups).
   ============================================================ */
(function () {
  'use strict';

  const DATA = window.ALBANIAN_DATA;
  const SFX = window.SoundEngine;
  const GIFTS = DATA.GIFTS || [];
  const TIPS = DATA.TIPS || [['💬', 'SHKRUAJ FJALËN NË KOMENT']];
  const THEME_IDS = DATA.THEMES.map((t) => t.id);
  let wantsMusic = false;
  let phoneMode = false;
  let obsPage = false;

  const CFG = {
    roundSeconds: 90,
    boardWords: 6,
    likeGoalStart: 200,
    likeGoalStep: 200,
    hypeGoal: 5,
    goldenMult: 3,
    bonusPoints: 25,
    resultMs: 4000,
    idleMs: 6000,
    shuffleMs: 24000,
    simMs: 2400,
    comboWindowMs: 14000,
    comboStep: 0.25,
    comboMax: 2,
    maxParticles: 240,
    seasonRounds: 90
  };

  const state = {
    roundIdx: 0,
    deck: [],
    seasonRound: 0,
    seasonShowing: false,
    roundHistory: new Map(),
    goldenHistory: new Map(),
    timeLeft: CFG.roundSeconds,
    roundEndsAt: 0,
    phase: 'playing', // playing | ending | ended
    board: [],
    golden: null,
    letters: [],
    bonusPool: new Map(),
    foundBonus: new Set(),
    players: new Map(),
    king: '',
    likesTotal: 0,
    likesProgress: 0,
    likeGoal: CFG.likeGoalStart,
    frenzyUntil: 0,
    eagleUntil: 0,
    vip: '',
    themeIdx: 0,
    hype: 0,
    comboUser: '',
    comboCount: 0,
    comboAt: 0,
    simEnabled: true,
    simMode: 'normal',
    live: false,
    everLive: false,
    eventCount: 0,
    idleIdx: 0,
    ctaHoldUntil: 0,
    ctaTimer: null,
    resultTimers: [],
    resultTicker: null,
    traceTimers: [],
    wordEls: new Map(),
    letterNodes: [],
    animateId: '',
    spectateTheme: '',
    lettersSig: '',
    spectateSig: '',
    lastSnapAt: 0,
    topUsers: ['', '', ''],
    wrongAt: 0,
    joinAt: 0,
    lastTickSec: -1
  };

  /* ---------------------------------------------------------------
     DOM
     --------------------------------------------------------------- */

  const $ = (id) => document.getElementById(id);

  const el = {
    stage: $('stage'),
    stageWrap: $('stageWrap'),
    fx: $('fxCanvas'),
    flash: $('flashLayer'),
    multPill: $('multPill'),
    category: $('categoryText'),
    likesTotal: $('likesTotal'),
    likesLevel: $('likesLevel'),
    likesGoal: $('likesGoal'),
    likesFill: $('likesFill'),
    roundFill: $('roundFill'),
    ctaBar: $('ctaBar'),
    ctaIcon: $('ctaIcon'),
    ctaText: $('ctaText'),
    goldenCard: $('goldenCard'),
    goldenTiles: $('goldenTiles'),
    goldenSub: $('goldenSub'),
    wordsGrid: $('wordsGrid'),
    progress: $('progressText'),
    letterBank: $('letterBank'),
    giftLegend: $('giftLegend'),
    top3: $('top3Strip'),
    overlay: $('roundOverlay'),
    overlayEmoji: $('overlayEmoji'),
    overlayTitle: $('overlayTitle'),
    overlayList: $('overlayList'),
    overlayNext: $('overlayNext'),
    obsExitBtn: $('obsExitBtn'),
    obsToggleBtn: $('obsToggleBtn'),
    bridgeDot: $('bridgeDot'),
    bridgeText: $('bridgeText'),
    bridgeStatus: document.querySelector('.bridge-status'),
    eventCounter: $('eventCounter'),
    testUser: $('testUserInput'),
    testComment: $('testCommentInput'),
    sendCommentBtn: $('sendCommentBtn'),
    quickWords: $('quickWordButtons'),
    giftButtons: $('giftButtons'),
    like500Btn: $('like500Btn'),
    hintBtn: $('hintBtn'),
    revealBtn: $('revealBtn'),
    frenzyBtn: $('frenzyBtn'),
    nextRoundBtn: $('nextRoundBtn'),
    musicBtn: $('toggleMusicBtn'),
    nowPlaying: $('nowPlaying'),
    musicVolume: $('musicVolume'),
    simToggle: $('simToggle'),
    simHint: $('simHint'),
    copyHookBtn: $('copyHookBtn'),
    copyObsBtn: $('copyObsBtn'),
    copyPhoneBtn: $('copyPhoneBtn'),
    phoneUrl: $('phoneUrl'),
    phoneTools: $('phoneTools'),
    phoneMusicBtn: $('phoneMusicBtn'),
    phoneFullscreenBtn: $('phoneFullscreenBtn'),
    safeToggle: $('safeToggle'),
    resetBtn: $('resetBtn')
  };

  /* ---------------------------------------------------------------
     HELPERS
     --------------------------------------------------------------- */

  function makeEl(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function fmt(n) {
    const v = Math.max(0, Math.round(Number(n) || 0));
    return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  function cleanUser(raw) {
    return String(raw || 'Anonim').replace(/^@+/, '').replace(/\s+/g, ' ').trim().slice(0, 24) || 'Anonim';
  }

  function shortText(text, max = 14) {
    const t = String(text || '');
    return t.length > max ? `${t.slice(0, max)}…` : t;
  }

  function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // Mix short/mid/long words and avoid near-duplicate stems
  // (e.g. MAL + MALI or BUKË + BUKA on the same board).
  function pickBoardWords(pool, count) {
    const buckets = [[], [], []];
    for (const w of pool) {
      const len = Array.from(w.raw).length;
      buckets[len <= 4 ? 0 : len === 5 ? 1 : 2].push(w);
    }
    for (const bucket of buckets) shuffleArray(bucket);

    const picked = [];
    const conflicts = (w) => picked.some((p) => p.norm === w.norm || p.norm.slice(0, 3) === w.norm.slice(0, 3));
    const takeFrom = (bucket) => {
      for (let i = bucket.length - 1; i >= 0; i--) {
        if (!conflicts(bucket[i])) {
          picked.push(bucket.splice(i, 1)[0]);
          return true;
        }
      }
      return false;
    };

    const plan = [2, 2, 2];
    for (let b = 0; b < buckets.length; b++) {
      while (plan[b] > 0 && takeFrom(buckets[b])) plan[b] -= 1;
    }

    const rest = shuffleArray([...buckets[0], ...buckets[1], ...buckets[2]]);
    while (picked.length < count && rest.length) {
      const w = rest.pop();
      if (!conflicts(w)) picked.push(w);
    }
    return picked.slice(0, count);
  }

  // Draw topics from a shuffled deck so every category appears once per cycle.
  function nextRoundIndex() {
    if (!state.deck.length) {
      state.deck = shuffleArray(DATA.ROUNDS.map((_, i) => i));
      if (state.deck.length > 1 && state.deck[state.deck.length - 1] === state.roundIdx) {
        const first = state.deck[0];
        state.deck[0] = state.deck[state.deck.length - 1];
        state.deck[state.deck.length - 1] = first;
      }
    }
    return state.deck.pop();
  }

  function goldensOf(round) {
    if (Array.isArray(round.goldens) && round.goldens.length) return round.goldens;
    return round.golden ? [round.golden] : [];
  }

  // Rotate the golden word so the same topic never shows the same hero twice in a row.
  function pickGolden(round) {
    const pool = goldensOf(round);
    if (!pool.length) return 'HINT';
    const history = state.goldenHistory.get(round.id) || [];
    const blocked = new Set(history);
    const available = pool.filter((g) => !blocked.has(DATA.normalizeAlbanian(g)));
    const choice = available.length ? pick(available) : pick(pool);
    const depth = Math.min(2, Math.max(0, pool.length - 1));
    state.goldenHistory.set(
      round.id,
      [DATA.normalizeAlbanian(choice), ...history].slice(0, depth)
    );
    return choice;
  }

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function multiplier() {
    const now = Date.now();
    if (now < state.eagleUntil) return 3;
    if (now < state.frenzyUntil) return 2;
    return 1;
  }

  function teamOf(text) {
    const lower = String(text || '').toLowerCase();
    const team = DATA.TEAMS.find((t) => lower.includes(t.tag));
    return team ? team.id : '';
  }

  function teamJoin(text) {
    const lower = String(text || '').trim().toLowerCase();
    return DATA.TEAMS.find((t) => t.tag === lower) || null;
  }

  function getOrCreatePlayer(name, team) {
    const user = cleanUser(name);
    let p = state.players.get(user);
    if (!p) {
      p = {
        user,
        score: 0,
        words: 0,
        team: team || DATA.TEAMS[user.length % DATA.TEAMS.length].id
      };
      state.players.set(user, p);
      if (state.players.size > 4000) {
        const weakest = Array.from(state.players.values()).sort((a, b) => a.score - b.score);
        for (let i = 0; i < 1000 && i < weakest.length; i++) {
          state.players.delete(weakest[i].user);
        }
      }
    } else if (team) {
      p.team = team;
    }
    return p;
  }

  function leaderboard() {
    return Array.from(state.players.values())
      .filter((p) => p.score > 0)
      .sort((a, b) => b.score - a.score || b.words - a.words);
  }

  function tileFont(len, golden) {
    const avail = golden ? 852 : 424;
    const maxWidth = golden ? 100 : 118;
    const gap = 10;
    const width = Math.min(maxWidth, (avail - gap * (len - 1)) / len);
    return Math.max(22, Math.min(golden ? 56 : 58, Math.round(width * 0.56)));
  }

  function clearTimers(list) {
    list.forEach((id) => clearTimeout(id));
    list.length = 0;
  }

  /* ---------------------------------------------------------------
     PARTICLE FX
     --------------------------------------------------------------- */

  const fx = (function () {
    const canvas = el.fx;
    const ctx = canvas.getContext('2d');
    const COLORS = ['#fbbf24', '#ef4444', '#22d3ee', '#a3e635', '#f472b6', '#ffffff', '#f97316'];
    let parts = [];
    let raf = null;

    function spawn(x, y, opts = {}) {
      const count = opts.count || 30;
      const power = opts.power || 15;
      const colors = opts.colors || COLORS;
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = power * (0.3 + Math.random());
        parts.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 4,
          g: 0.42 + Math.random() * 0.3,
          life: 1,
          decay: 0.016 + Math.random() * 0.014,
          size: 4 + Math.random() * 7,
          color: pick(colors),
          rot: Math.random() * Math.PI,
          vr: (Math.random() - 0.5) * 0.35,
          emoji: opts.emoji || '',
          shape: Math.random() < 0.45 ? 'rect' : 'circle'
        });
      }
      if (parts.length > CFG.maxParticles) {
        parts = parts.slice(parts.length - CFG.maxParticles);
      }
      if (!raf) raf = requestAnimationFrame(loop);
    }

    function loop() {
      ctx.clearRect(0, 0, 1080, 1920);
      for (const p of parts) {
        if (p.life <= 0) continue;
        p.vx *= 0.994;
        p.vy *= 0.994;
        p.vy += p.g;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        p.life -= p.decay;
        if (p.life <= 0 || p.y > 1980) continue;

        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        if (p.emoji) {
          ctx.font = '34px "Segoe UI Emoji", "Apple Color Emoji", serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(p.emoji, 0, 0);
        } else if (p.shape === 'rect') {
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 1.7);
        } else {
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
      parts = parts.filter((p) => p.life > 0 && p.y < 1980);
      if (parts.length) {
        raf = requestAnimationFrame(loop);
      } else {
        raf = null;
        ctx.clearRect(0, 0, 1080, 1920);
      }
    }

    function clear() {
      parts = [];
      ctx.clearRect(0, 0, 1080, 1920);
    }

    return { spawn, clear };
  })();

  function stagePoint(node) {
    if (!node) return { x: 540, y: 900 };
    const sr = el.stage.getBoundingClientRect();
    const r = node.getBoundingClientRect();
    const scale = sr.width / 1080 || 1;
    return {
      x: (r.left - sr.left) / scale + r.width / scale / 2,
      y: (r.top - sr.top) / scale + r.height / scale / 2
    };
  }

  function burstAt(node, count = 24, emoji = '') {
    const pt = stagePoint(node);
    fx.spawn(pt.x, pt.y, { count, emoji, power: emoji ? 17 : 14 });
  }

  function bigConfetti(emoji = '') {
    fx.spawn(540, 720, { count: 46, power: 23, emoji });
    fx.spawn(240, 980, { count: 18, power: 18 });
    fx.spawn(840, 980, { count: 18, power: 18 });
  }

  function flash(kind) {
    el.stage.classList.remove('flash-gold', 'flash-pink');
    void el.stage.offsetWidth;
    el.stage.classList.add(kind);
    setTimeout(() => el.stage.classList.remove(kind), 1000);
  }

  function shake() {
    el.stage.classList.remove('shake');
    void el.stage.offsetWidth;
    el.stage.classList.add('shake');
    setTimeout(() => el.stage.classList.remove('shake'), 560);
  }

  /* ---------------------------------------------------------------
     CTA / ANNOUNCEMENTS
     --------------------------------------------------------------- */

  function setCta(icon, text, kind) {
    el.ctaBar.className = `cta ${kind || 'idle'}`;
    el.ctaIcon.textContent = icon;
    el.ctaText.textContent = text;
    el.ctaText.title = text;
  }

  function showIdleCta() {
    if (phoneMode) return;
    // Alternate between the core instruction and a rotating tip so new
    // viewers always learn how to play within ~12 seconds.
    if (state.idleIdx % 2 === 0 || TIPS.length < 2) {
      setCta('💬', 'SHKRUAJ FJALËN NË KOMENT', 'idle');
      return;
    }
    const tip = TIPS[1 + (Math.floor(state.idleIdx / 2) % (TIPS.length - 1))];
    setCta(tip[0], tip[1], 'idle');
  }

  function announce(icon, text, kind = 'idle', ms = 3000) {
    clearTimeout(state.ctaTimer);
    state.ctaHoldUntil = Date.now() + ms;
    setCta(icon, text, kind);
    state.ctaTimer = setTimeout(() => {
      state.ctaHoldUntil = 0;
      showIdleCta();
    }, ms);
  }

  function maybeAnnounce(icon, text, kind) {
    if (Date.now() < state.ctaHoldUntil) return;
    announce(icon, text, kind, 1900);
  }

  /* ---------------------------------------------------------------
     RENDER
     --------------------------------------------------------------- */

  function renderHeader() {
    const round = DATA.ROUNDS[state.roundIdx];
    el.category.textContent = round.category;
    renderTimer();
    renderMult();
    renderLikes();
  }

  function renderTimer() {
    const pct = Math.max(0, Math.min(100, (state.timeLeft / CFG.roundSeconds) * 100));
    el.roundFill.style.width = `${pct}%`;
    el.roundFill.classList.toggle('low', state.timeLeft <= 15);
  }

  function renderMult() {
    if (phoneMode) return;
    const m = multiplier();
    el.multPill.textContent = m > 1 ? `${m}X` : '1X';
    el.multPill.classList.toggle('on', m > 1);
    el.stage.classList.toggle('eagle', m === 3);
    el.stage.classList.toggle('frenzy', m === 2);
  }

  function renderLikes() {
    el.likesTotal.textContent = fmt(state.likesTotal);
    const goal = state.likeGoal || CFG.likeGoalStart;
    const progress = Math.max(0, Math.min(goal, state.likesProgress));
    const level = Math.max(1, Math.round((goal - CFG.likeGoalStart) / CFG.likeGoalStep) + 1);
    el.likesFill.style.width = `${(progress / goal) * 100}%`;
    el.likesLevel.textContent = `NIVELI ${level}`;
    el.likesGoal.textContent = `${fmt(progress)}/${fmt(goal)} LIKES ZBULON 1 SHKRONJË`;
  }

  function renderProgress() {
    const solved = state.board.filter((w) => w.solved).length + (state.golden.solved ? 1 : 0);
    el.progress.textContent = `${solved} / ${state.board.length + 1} gjetur`;
  }

  function buildTile(entry, index) {
    const tile = makeEl('div', 'tile');
    if (entry.solved) {
      tile.classList.add('solved');
      if (entry.id === state.animateId) tile.classList.add('animate');
      tile.textContent = entry.chars[index];
    } else if (entry.hinted.has(index)) {
      tile.classList.add('hinted');
      tile.textContent = entry.chars[index];
    } else {
      tile.textContent = '•';
    }
    return tile;
  }

  function buildWordSlot(entry) {
    const slot = makeEl('div', 'word-slot');
    slot.dataset.id = entry.id;
    if (entry.solved) slot.classList.add('solved');

    const tiles = makeEl('div', 'word-tiles');
    tiles.style.fontSize = `${tileFont(entry.chars.length, false)}px`;
    entry.chars.forEach((_, i) => tiles.appendChild(buildTile(entry, i)));

    let captionText;
    let captionClass = 'word-caption';
    if (entry.solved) {
      captionClass += ' solved-by';
      if (entry.points > 0) {
        captionText = `@${entry.finder} +${fmt(entry.points)}`;
      } else {
        captionText = entry.finder === 'HYPER' ? '🎁 HYPER' : '💡 Hint';
      }
    } else {
      captionText = `${entry.chars.length} shkronja · ${fmt(entry.chars.length * 20)} PK`;
      if (entry.hinted.size > 0) captionClass += ' hint-tag';
    }
    const caption = makeEl('div', captionClass, captionText);

    slot.appendChild(tiles);
    slot.appendChild(caption);
    return slot;
  }

  function renderBoard() {
    el.wordsGrid.textContent = '';
    state.wordEls.clear();
    for (const entry of state.board) {
      const slot = buildWordSlot(entry);
      el.wordsGrid.appendChild(slot);
      state.wordEls.set(entry.id, slot);
    }
    renderGolden();
    renderProgress();
    renderQuickWords();
  }

  // Update a single word in place. Rebuilding the whole board on every find was
  // the main source of frame drops during the golden-word moment.
  function refreshWordSlot(entry) {
    const old = state.wordEls.get(entry.id);
    if (!old) {
      renderBoard();
      return;
    }
    const fresh = buildWordSlot(entry);
    old.replaceWith(fresh);
    state.wordEls.set(entry.id, fresh);
  }

  function renderGolden() {
    const w = state.golden;
    el.goldenCard.classList.toggle('solved', w.solved);
    el.goldenTiles.textContent = '';
    el.goldenTiles.style.fontSize = `${tileFont(w.chars.length, true)}px`;
    w.chars.forEach((_, i) => el.goldenTiles.appendChild(buildTile(w, i)));

    if (w.solved) {
      if (w.points > 0) {
        el.goldenSub.textContent = `@${w.finder} +${fmt(w.points)} PK`;
      } else {
        el.goldenSub.textContent = w.finder === 'HYPER' ? '🎁 HYPER UNLOCK' : '💡 U ZBULUA';
      }
    } else {
      el.goldenSub.textContent = `${w.chars.length} shkronja · +${fmt(w.chars.length * 20 * CFG.goldenMult)} PK`;
    }
  }

  function renderLetters() {
    el.letterBank.textContent = '';
    state.letterNodes = [];
    state.letters.forEach((ch, i) => {
      const node = makeEl('div', 'letter', ch);
      node.style.animationDelay = `${i * 30}ms`;
      node.classList.add('pulse');
      el.letterBank.appendChild(node);
      state.letterNodes.push({ el: node, norm: DATA.normalizeAlbanian(ch), char: ch });
    });
    setTimeout(() => {
      el.letterBank.querySelectorAll('.letter.pulse').forEach((n) => n.classList.remove('pulse'));
    }, 700);
  }

  function renderTop3() {
    const top = leaderboard().slice(0, 3);
    el.top3.textContent = '';

    if (!top.length) {
      const empty = makeEl('div', 't3 t3-empty');
      empty.append(
        makeEl('div', 't3-rank', '🏆 TOP 3'),
        makeEl('div', 't3-name', 'Bëhu i pari në koment!')
      );
      el.top3.appendChild(empty);
      state.topUsers = ['', '', ''];
      return;
    }

    const ranks = ['👑 #1', '#2', '#3'];

    for (let i = 0; i < 3; i++) {
      const p = top[i];
      const card = makeEl('div', `t3${i === 0 && p ? ' first' : ''}`);
      const rank = makeEl('div', 't3-rank', ranks[i]);
      const name = makeEl('div', 't3-name', p ? `@${p.user}` : '—');
      const score = makeEl('div', 't3-score', p ? `${fmt(p.score)} PK` : '0');
      if (p && state.topUsers[i] !== p.user) {
        name.classList.add('new');
        score.classList.add('new');
      }
      card.append(rank, name, score);
      el.top3.appendChild(card);
    }

    state.topUsers = [top[0] && top[0].user, top[1] && top[1].user, top[2] && top[2].user].map((v) => v || '');
  }

  function renderQuickWords() {
    el.quickWords.textContent = '';
    const unsolved = state.board.filter((w) => !w.solved).slice(0, 5);
    for (const w of unsolved) {
      const btn = makeEl('button', 'chip', w.raw);
      btn.type = 'button';
      btn.addEventListener('click', () => {
        SFX.unlock();
        handleComment(currentTestUser(), w.raw);
      });
      el.quickWords.appendChild(btn);
    }
  }

  function buildStaticUi() {
    // gift cheat sheet on stream
    el.giftLegend.textContent = '';
    GIFTS.forEach((g) => {
      const chip = makeEl('div', 'gift-chip');
      const text = makeEl('span', 'gift-text');
      text.append(makeEl('b', '', g.name), makeEl('small', '', g.effect));
      chip.append(makeEl('span', 'gift-emoji', g.emoji), text);
      el.giftLegend.appendChild(chip);
    });

    // host gift buttons
    el.giftButtons.textContent = '';
    GIFTS.forEach((g) => {
      const btn = makeEl('button', 'btn', `${g.emoji} ${g.name}`);
      btn.type = 'button';
      btn.title = `${g.effect} · +${g.points} PK`;
      btn.addEventListener('click', () => {
        SFX.unlock();
        handleGift(currentTestUser(), g.id);
      });
      el.giftButtons.appendChild(btn);
    });
  }

  /* ---------------------------------------------------------------
     ROUND LIFECYCLE
     --------------------------------------------------------------- */

  function makeEntry(id, raw, golden) {
    const chars = Array.from(String(raw).toUpperCase());
    return {
      id,
      raw: chars.join(''),
      chars,
      norm: DATA.normalizeAlbanian(raw),
      golden: Boolean(golden),
      solved: false,
      finder: '',
      points: 0,
      hinted: new Set()
    };
  }

  function loadRound(index) {
    hideResult();
    state.phase = 'playing';
    state.roundIdx = ((index % DATA.ROUNDS.length) + DATA.ROUNDS.length) % DATA.ROUNDS.length;
    const round = DATA.ROUNDS[state.roundIdx];

    state.timeLeft = CFG.roundSeconds;
    state.roundEndsAt = Date.now() + CFG.roundSeconds * 1000;
    state.lastTickSec = -1;
    state.foundBonus = new Set();
    state.comboUser = '';
    state.comboCount = 0;
    state.letters = shuffleArray([...round.letters]);

    const goldenRaw = pickGolden(round);
    const goldenNorm = DATA.normalizeAlbanian(goldenRaw);
    const normals = round.words
      .filter((w) => DATA.normalizeAlbanian(w) !== goldenNorm)
      .map((w) => ({ raw: w, norm: DATA.normalizeAlbanian(w) }));

    // Per-topic history: never show the same board words twice in a row.
    const history = state.roundHistory.get(round.id) || [];
    const shortOnes = normals.filter((w) => Array.from(w.raw).length <= 6);
    let picked = [];
    for (const depth of [2, 1, 0]) {
      const blocked = new Set();
      for (let i = 0; i < depth && i < history.length; i++) {
        history[i].forEach((n) => blocked.add(n));
      }
      const pool = blocked.size ? shortOnes.filter((w) => !blocked.has(w.norm)) : shortOnes;
      picked = pickBoardWords(pool, CFG.boardWords);
      if (picked.length >= CFG.boardWords) break;
    }
    if (picked.length < CFG.boardWords) {
      const rest = shuffleArray(normals.filter((w) => !picked.some((p) => p.norm === w.norm)));
      while (picked.length < CFG.boardWords && rest.length) picked.push(rest.pop());
    }

    state.board = picked.map((w, i) => makeEntry(`w${i}`, w.raw, false));
    state.golden = makeEntry('golden', goldenRaw, true);

    const usedRoundNorms = new Set(state.board.map((w) => w.norm));
    usedRoundNorms.add(goldenNorm);
    state.roundHistory.set(round.id, [usedRoundNorms, ...history].slice(0, 2));

    const used = new Set([...state.board.map((w) => w.norm), goldenNorm]);
    state.bonusPool = new Map();
    for (const w of [...normals.map((x) => x.raw), ...round.bonus]) {
      const n = DATA.normalizeAlbanian(w);
      if (n && n.length >= 2 && !used.has(n)) state.bonusPool.set(n, w);
    }

    renderHeader();
    renderBoard();
    renderLetters();
    renderTop3();
    SFX.playShuffle();
    announce('🎬', round.category, 'warn', 3200);
  }

  function checkComplete() {
    if (state.phase !== 'playing') return;
    const total = state.board.length + 1;
    const solved = state.board.filter((w) => w.solved).length + (state.golden.solved ? 1 : 0);
    if (solved >= total) {
      state.phase = 'ending';
      state.resultTimers.push(setTimeout(() => endRound('perfect'), 950));
    }
  }

  function endRound(reason) {
    if (state.phase === 'ended') return;
    state.phase = 'ended';

    const perfect = reason === 'perfect';
    const title = perfect ? 'TABELA U KOMPLETUA!' : 'KOHA MBAROI!';
    const emoji = perfect ? '🏆' : '⏱️';
    let rows = [];

    if (perfect) {
      rows = leaderboard().slice(0, 3).map((p, i) => ({
        idx: ['🥇', '🥈', '🥉'][i],
        name: `@${p.user}`,
        pts: `${fmt(p.score)} PK`
      }));
      if (!rows.length) rows = [{ idx: '🏆', name: 'Të gjitha fjalët u gjetën!', pts: '' }];
      SFX.playRoundWin();
      bigConfetti();
    } else {
      const missing = [...state.board, state.golden].filter((w) => !w.solved).slice(0, 4);
      rows = missing.map((w) => ({ idx: '✗', name: w.raw, pts: '' }));
      if (!rows.length) rows = [{ idx: '✅', name: 'Të gjitha u gjetën!', pts: '' }];
      SFX.playTick();
    }

    showResult(emoji, title, rows);
  }

  function showResult(emoji, title, rows, opts = {}) {
    const duration = opts.ms || CFG.resultMs;
    const label = opts.nextLabel || 'Raundi tjetër në';

    el.overlayEmoji.textContent = emoji;
    el.overlayTitle.textContent = title;
    el.overlayList.textContent = '';
    for (const row of rows) {
      const line = makeEl('div', 'overlay-row');
      line.append(
        makeEl('span', 'idx', row.idx),
        makeEl('span', 'name', row.name),
        makeEl('span', 'pts', row.pts || '')
      );
      el.overlayList.appendChild(line);
    }
    el.overlay.classList.add('show');
    el.overlay.setAttribute('aria-hidden', 'false');

    let left = Math.ceil(duration / 1000);
    el.overlayNext.textContent = `${label} ${left}…`;
    clearInterval(state.resultTicker);
    state.resultTicker = setInterval(() => {
      left -= 1;
      if (left > 0) el.overlayNext.textContent = `${label} ${left}…`;
    }, 1000);

    state.resultTimers.push(
      setTimeout(() => {
        hideResult();
        if (opts.onDone) opts.onDone();
        else advanceRound();
      }, duration)
    );
  }

  function hideResult() {
    clearTimers(state.resultTimers);
    clearInterval(state.resultTicker);
    state.resultTicker = null;
    el.overlay.classList.remove('show');
    el.overlay.setAttribute('aria-hidden', 'true');
  }

  function advanceRound() {
    if (state.seasonShowing) return;
    state.seasonRound += 1;
    if (state.seasonRound >= CFG.seasonRounds) {
      if (!leaderboard().length) {
        state.seasonRound = 0;
        loadRound(nextRoundIndex());
        return;
      }
      showSeasonRecap();
      return;
    }
    loadRound(nextRoundIndex());
  }

  function showSeasonRecap() {
    if (state.seasonShowing) return;
    state.seasonShowing = true;
    state.phase = 'ended';

    const top = leaderboard().slice(0, 3);
    const rows = top.map((p, i) => ({
      idx: ['🥇', '🥈', '🥉'][i],
      name: `@${p.user}`,
      pts: `${fmt(p.score)} PK`
    }));
    const total = leaderboard().reduce((sum, p) => sum + p.score, 0);
    rows.push({ idx: '📊', name: 'Totali i sezonit', pts: `${fmt(total)} PK` });

    showResult('🏆', 'SEZONI MBAROI!', rows, {
      ms: 9000,
      nextLabel: 'Sezoni i ri në',
      onDone: () => {
        state.seasonShowing = false;
        resetSeason();
        loadRound(nextRoundIndex());
        announce('🆕', 'SEZONI I RI · PIKËT U RESETUAN', 'gold', 3800);
      }
    });
  }

  function resetSeason() {
    state.players.clear();
    state.king = '';
    state.likesTotal = 0;
    state.likesProgress = 0;
    state.likeGoal = CFG.likeGoalStart;
    state.hype = 0;
    state.comboUser = '';
    state.comboCount = 0;
    state.comboAt = 0;
    state.frenzyUntil = 0;
    state.eagleUntil = 0;
    state.vip = '';
    state.topUsers = ['', '', ''];
    state.seasonRound = 0;
    clearTimers(state.traceTimers);
    renderTop3();
    renderLikes();
    renderMult();
  }

  /* ---------------------------------------------------------------
     GUESSING
     --------------------------------------------------------------- */

  function comboMultiplier(player) {
    if (state.comboUser !== player.user) return 1;
    if (Date.now() - state.comboAt > CFG.comboWindowMs) return 1;
    return Math.min(CFG.comboMax, 1 + CFG.comboStep * state.comboCount);
  }

  function bumpCombo(player) {
    const now = Date.now();
    if (state.comboUser === player.user && now - state.comboAt <= CFG.comboWindowMs) {
      state.comboCount += 1;
    } else {
      state.comboUser = player.user;
      state.comboCount = 1;
    }
    state.comboAt = now;
  }

  function completeWord(entry, user, points) {
    if (entry.solved) return false;
    entry.solved = true;
    entry.finder = user || '';
    entry.points = Math.max(0, Math.round(points || 0));

    // only the freshly found word flips; previously solved tiles stay still
    state.animateId = entry.id;
    if (entry.golden) renderGolden();
    else refreshWordSlot(entry);
    state.animateId = '';

    renderProgress();
    renderQuickWords();
    renderTop3();

    const node = entry.golden ? el.goldenCard : state.wordEls.get(entry.id);
    if (entry.golden) {
      const pt = stagePoint(node);
      fx.spawn(pt.x, pt.y, {
        count: 40,
        power: 18,
        colors: ['#fde047', '#fbbf24', '#f59e0b', '#fff7cc', '#ffffff']
      });
    } else {
      burstAt(node, 20);
    }
    traceChars(entry.chars);
    SFX.playWordFound(entry.golden, false);

    checkComplete();
    return true;
  }

  function solveByPlayer(entry, player) {
    const base = entry.chars.length * 20;
    const mult = multiplier() * (entry.golden ? CFG.goldenMult : 1);
    const combo = comboMultiplier(player);
    const points = Math.round(base * mult * combo);
    const comboLevel = state.comboUser === player.user && Date.now() - state.comboAt <= CFG.comboWindowMs
      ? state.comboCount + 1
      : 1;

    bumpCombo(player);
    player.score += points;
    player.words += 1;

    const ok = completeWord(entry, player.user, points);
    if (!ok) return;

    refreshKing();

    if (entry.golden) {
      announce('👑', `FJALA E ARTË +${fmt(points)} PK · @${player.user}`, 'gold', 4200);
    } else {
      const comboTag = comboLevel > 1 ? ` 🔥x${comboLevel}` : '';
      announce('🎉', `"${entry.raw}" +${fmt(points)} PK${comboTag} · @${player.user}`, 'find', 3200);
    }

    if (comboLevel >= 2) SFX.playCombo(comboLevel);
    renderTop3();
  }

  function handleComment(rawUser, rawText, forcedTeam) {
    if (state.phase !== 'playing') return;
    const text = String(rawText || '').trim();
    if (!text) return;

    const user = cleanUser(rawUser);
    const team = teamOf(text) || forcedTeam || '';
    const player = getOrCreatePlayer(user, team);
    const norm = DATA.normalizeAlbanian(text);

    const join = teamJoin(text);
    if (join) {
      maybeAnnounce(join.flag, `@${user} u bashkua me ${join.label}!`, 'gift');
      return;
    }
    if (!norm || norm.length > 18) return;

    const target = [state.golden, ...state.board].find((w) => !w.solved && w.norm === norm);
    if (target) {
      solveByPlayer(target, player);
      return;
    }

    const already = [state.golden, ...state.board].find((w) => w.solved && w.norm === norm);
    if (already) {
      maybeAnnounce('⏱️', `"${already.raw}" u gjet më parë · @${user}`, 'warn');
      return;
    }

    if (state.bonusPool.has(norm) && !state.foundBonus.has(norm)) {
      state.foundBonus.add(norm);
      const raw = state.bonusPool.get(norm);
      const points = Math.round(CFG.bonusPoints * multiplier());
      player.score += points;
      player.words += 1;
      SFX.playBonusWord();
      traceChars(Array.from(String(raw).toUpperCase()));
      announce('🌟', `BONUS "${raw}" +${fmt(points)} PK · @${user}`, 'find', 3000);
      renderTop3();
      refreshKing();
      return;
    }

    if (Date.now() - state.wrongAt > 2500) {
      state.wrongAt = Date.now();
      maybeAnnounce('💬', `"${shortText(text)}" — jo në tabelë · @${user}`, 'warn');
    }
  }

  function refreshKing() {
    const top = leaderboard()[0];
    if (!top || !top.user) return;
    if (top.user !== state.king) {
      const hadKing = Boolean(state.king);
      state.king = top.user;
      if (hadKing) {
        SFX.playNewKing();
        announce('👑', `MBRET I RI: @${top.user} · ${fmt(top.score)} PK`, 'gold', 3400);
      }
    }
  }

  /* ---------------------------------------------------------------
     LIKES + REVEALS
     --------------------------------------------------------------- */

  function addLikes(rawCount) {
    const count = Math.max(1, Math.min(100000, Math.floor(Number(rawCount) || 1)));
    const step = CFG.likeGoalStep;
    state.likesTotal += count;
    state.likesProgress += count;

    let revealed = 0;
    let guard = 0;
    while (state.likesProgress >= state.likeGoal && guard++ < 20) {
      const goal = state.likeGoal;
      const got = revealLetters(1);
      if (!got) {
        // No hidden letters left — restart the meter for the current level.
        state.likesProgress = 0;
        break;
      }
      state.likesProgress -= goal;
      state.likeGoal = goal + step;
      revealed += got;
    }

    if (revealed > 0) {
      SFX.playLikeMilestone();
      burstAt(el.ctaBar, 12, '❤️');
      const text =
        revealed === 1
          ? `${fmt(state.likeGoal - step)} LIKES! U ZBULUA 1 SHKRONJË`
          : `${fmt(count)} LIKES! U ZBULUAN ${revealed} SHKRONJA`;
      announce('❤️', text, 'like', 3400);
    }

    renderLikes();
  }

  function revealLetters(count) {
    let revealed = 0;
    const candidates = shuffleArray(state.board.filter((w) => !w.solved));
    if (!state.golden.solved) candidates.push(state.golden);

    for (const entry of candidates) {
      const hidden = [];
      for (let i = 0; i < entry.chars.length; i++) {
        if (!entry.hinted.has(i)) hidden.push(i);
      }
      if (!hidden.length) continue;
      shuffleArray(hidden);
      while (hidden.length && revealed < count) {
        entry.hinted.add(hidden.pop());
        revealed += 1;
      }
      if (revealed >= count) break;
    }

    if (revealed > 0) {
      renderBoard();
      burstAt(el.letterBank, 10);
    }
    return revealed;
  }

  function revealWord(finder) {
    const pool = state.board.filter((w) => !w.solved).sort((a, b) => a.chars.length - b.chars.length);
    if (pool.length) {
      const entry = pool[0];
      completeWord(entry, finder || 'Hint', 0);
      return entry.raw;
    }
    if (!state.golden.solved) {
      completeWord(state.golden, finder || 'Hint', 0);
      return state.golden.raw;
    }
    return null;
  }

  function startFrenzy(seconds) {
    state.frenzyUntil = Math.max(state.frenzyUntil, Date.now()) + seconds * 1000;
    renderMult();
  }

  /* ---------------------------------------------------------------
     GIFTS
     --------------------------------------------------------------- */

  function handleGift(rawUser, typeId, repeat = 1) {
    if (state.phase === 'ended') return;
    const user = cleanUser(rawUser || 'VIP');
    const player = getOrCreatePlayer(user);
    const gift = GIFTS.find((g) => g.id === typeId) || GIFTS[0];
    const times = Math.max(1, Math.min(10, Math.floor(Number(repeat) || 1)));
    const combo = times > 1 ? ` ${times}×` : '';

    player.score += gift.points * times;
    renderTop3();
    refreshKing();

    SFX.playGiftEffect(gift.id);
    burstAt(el.giftLegend, 10, gift.emoji);

    if (gift.id === 'theme') {
      nextTheme(user, combo);
    } else if (gift.id === 'song') {
      nextSong(user, combo);
    } else if (gift.id === 'hint') {
      const got = revealLetters(2 * Math.min(times, 3));
      announce('⚡', `+${got || 2} SHKRONJA · @${user}`, 'gift', 3200);
    } else if (gift.id === 'eagle') {
      startEagle(user, combo);
    } else {
      announce(gift.emoji, `@${user} dërgoi${combo} ${gift.name}!`, 'gift', 2600);
    }

    state.hype += times;
    while (state.hype >= CFG.hypeGoal) {
      state.hype -= CFG.hypeGoal;
      hyperUnlock(player);
    }
  }

  function nextTheme(user, combo = '') {
    el.stage.classList.remove(...THEME_IDS);
    state.themeIdx = (state.themeIdx + 1) % DATA.THEMES.length;
    const theme = DATA.THEMES[state.themeIdx];
    el.stage.classList.add(theme.id);
    flash('flash-pink');
    bigConfetti();
    burstAt(el.giftLegend, 14, '🌹');
    announce('🌹', `NGJYRAT: ${theme.name} · @${user}${combo}`, 'gift', 3400);
  }

  function nextSong(user, combo = '') {
    const song = SFX.nextSong();
    if (!SFX.musicEnabled) {
      SFX.startMusic();
      el.musicBtn.textContent = '⏸️ Muzikë';
    }
    updateNowPlaying();
    announce('🎵', `${song.name} · @${user}${combo}`, 'gift', 3400);
  }

  function startEagle(user, combo = '') {
    state.eagleUntil = Date.now() + 45000;
    state.vip = user;
    flash('flash-gold');
    shake();
    burstAt(el.goldenCard, 20, '🦅');
    bigConfetti();
    SFX.playNewKing();
    revealWord(user);
    announce('🦅', `3X VIP 45 SEKONDA · @${user}${combo}`, 'gold', 4200);
    renderMult();
  }

  function hyperUnlock(player) {
    flash('flash-pink');
    shake();
    bigConfetti();
    burstAt(el.goldenCard, 16, '🎁');
    SFX.playHype();
    if (!state.golden.solved) {
      completeWord(state.golden, 'HYPER', 0);
    } else {
      revealLetters(4);
    }
    startFrenzy(30);
    announce('🎁', `HYPER! FJALA E ARTË + 3X · @${player.user}`, 'gold', 4600);
  }

  /* ---------------------------------------------------------------
     TRACING
     --------------------------------------------------------------- */

  function traceChars(chars) {
    clearTimers(state.traceTimers);
    state.letterNodes.forEach((n) => n.el.classList.remove('active'));
    const used = new Set();
    const matched = [];

    for (const ch of chars) {
      const norm = DATA.normalizeAlbanian(ch);
      // Prefer the exact tile (Ë vs E, Ç vs C) so the trace looks right.
      let idx = state.letterNodes.findIndex((n, i) => !used.has(i) && n.char === ch);
      if (idx === -1) {
        idx = state.letterNodes.findIndex((n, i) => !used.has(i) && n.norm === norm);
      }
      if (idx !== -1) {
        used.add(idx);
        matched.push(state.letterNodes[idx].el);
      }
    }
    if (!matched.length) return;

    matched.forEach((node, i) => {
      state.traceTimers.push(
        setTimeout(() => {
          node.classList.add('active');
          node.classList.add('pulse');
        }, i * 90)
      );
    });

    state.traceTimers.push(
      setTimeout(() => {
        matched.forEach((node) => node.classList.remove('active', 'pulse'));
      }, matched.length * 90 + 1500)
    );
  }

  /* ---------------------------------------------------------------
     SIMULATOR (demo mode only)
     --------------------------------------------------------------- */

  function currentTestUser() {
    return (el.testUser.value || 'andi_tirana').trim() || 'andi_tirana';
  }

  function simulatorTick() {
    if (phoneMode) return;
    if (!state.simEnabled || state.phase !== 'playing') return;

    const viral = state.simMode === 'viral';
    const viewer = pick(DATA.VIEWERS_POOL);
    const roll = Math.random();

    if (roll < (viral ? 0.6 : 0.45)) {
      const unsolved = [...state.board, state.golden].filter((w) => !w.solved);
      if (unsolved.length) {
        const word = pick(unsolved);
        handleComment(viewer.user, word.raw, viewer.team);
      }
    } else if (roll < (viral ? 0.82 : 0.62)) {
      addLikes(viral ? randInt(90, 260) : randInt(18, 55));
    }

    if (Math.random() < (viral ? 0.2 : 0.08)) {
      handleGift(viewer.user, pick(GIFTS).id);
    }
  }

  /* ---------------------------------------------------------------
     BRIDGE
     --------------------------------------------------------------- */

  function setTransport(ok) {
    el.bridgeStatus.classList.toggle('is-live', ok);
    if (!ok) {
      el.bridgeText.textContent = 'Server offline';
      return;
    }
    el.bridgeText.textContent = state.live ? 'LIVE · duke marrë evente' : 'Server OK · në pritje';
  }

  function markLive() {
    state.lastEventAt = Date.now();
    if (state.live) return;
    state.live = true;
    el.bridgeStatus.classList.add('is-live');
    el.bridgeText.textContent = 'LIVE · duke marrë evente';
  }

  function handleEvent(msg) {
    if (!msg || typeof msg !== 'object') return;

    // The phone viewer only consumes mirrored frames from the OBS page.
    if (msg.type === 'spectate') {
      if (phoneMode) applySnapshot(msg.snapshot);
      return;
    }
    if (phoneMode) return;

    if (!['comment', 'like', 'gift', 'viewers', 'join', 'follow'].includes(msg.type)) {
      if (msg.type === 'connected') setTransport(true);
      return;
    }

    // First real event from a bridge: stop the demo simulator and start clean.
    if (!state.everLive) {
      state.everLive = true;
      if (state.simEnabled) {
        resetGame(true);
        setSim(false);
      }
    }

    markLive();
    state.eventCount += 1;
    el.eventCounter.textContent = `${state.eventCount} ngjarje`;

    switch (msg.type) {
      case 'comment':
        handleComment(msg.user, msg.text, msg.team);
        break;
      case 'like':
        addLikes(msg.count || 1);
        break;
      case 'gift':
        handleGift(msg.user, msg.giftType || 'theme', msg.count || 1);
        break;
      case 'viewers':
        // TikTok already displays the viewer count; kept for bridge compatibility.
        break;
      case 'join':
      case 'follow': {
        const user = cleanUser(msg.user);
        if (Date.now() - state.joinAt > 8000) {
          state.joinAt = Date.now();
          SFX.playJoin();
          maybeAnnounce('👋', `@${user} u bashkua live`, 'gift');
        }
        break;
      }
      default:
        break;
    }
  }

  function connectBridge() {
    if (!('EventSource' in window)) {
      el.bridgeText.textContent = 'SSE i pambështetur';
      return;
    }
    const es = new EventSource('/api/stream');

    es.onopen = () => setTransport(true);
    es.onerror = () => setTransport(false);
    es.onmessage = (evt) => {
      try {
        handleEvent(JSON.parse(evt.data));
      } catch {
        /* ignore malformed frames */
      }
    };
  }

  function resetGame(silent) {
    clearTimers(state.resultTimers);
    clearInterval(state.resultTicker);
    fx.clear();
    state.players.clear();
    state.king = '';
    state.likesTotal = 0;
    state.likesProgress = 0;
    state.likeGoal = CFG.likeGoalStart;
    state.frenzyUntil = 0;
    state.eagleUntil = 0;
    state.vip = '';
    state.hype = 0;
    state.comboUser = '';
    state.comboCount = 0;
    state.topUsers = ['', '', ''];
    state.wrongAt = 0;
    state.eventCount = 0;
    state.deck = [];
    state.seasonRound = 0;
    state.seasonShowing = false;
    state.roundHistory.clear();
    state.goldenHistory.clear();
    el.eventCounter.textContent = '0 ngjarje';
    loadRound(nextRoundIndex());
    if (!silent) announce('♻️', 'Loja u resetua', 'warn', 2200);
  }

  function setSim(enabled) {
    state.simEnabled = Boolean(enabled);
    el.simToggle.checked = state.simEnabled;
    if (state.simEnabled) {
      el.simHint.textContent = state.live
        ? 'Kujdes: bridge-i live është aktiv, komentet janë test.'
        : 'Aktiv: komente, likes & dhurata test.';
    } else {
      el.simHint.textContent = 'Fikur — vetëm ngjarje reale.';
    }
  }

  /* ---------------------------------------------------------------
     HOST CONTROLS
     --------------------------------------------------------------- */

  function wireControls() {
    el.sendCommentBtn.addEventListener('click', () => {
      SFX.unlock();
      const text = el.testComment.value.trim();
      if (!text) return;
      handleComment(currentTestUser(), text);
      el.testComment.value = '';
      el.testComment.focus();
    });

    el.testComment.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') el.sendCommentBtn.click();
    });

    document.querySelectorAll('.sim-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.sim-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        state.simMode = btn.getAttribute('data-sim') || 'normal';
        if (!state.simEnabled) setSim(true);
        renderHeader();
      });
    });

    el.simToggle.addEventListener('change', () => setSim(el.simToggle.checked));
    el.like500Btn.addEventListener('click', () => {
      SFX.unlock();
      addLikes(500);
    });

    el.hintBtn.addEventListener('click', () => {
      SFX.unlock();
      const got = revealLetters(2);
      announce('🔍', `+${got || 2} shkronja të zbuluara`, 'warn', 2200);
    });

    el.revealBtn.addEventListener('click', () => {
      SFX.unlock();
      const word = revealWord('Hint');
      if (word) announce('💡', `Fjala "${word}" u zbulua`, 'warn', 2400);
    });

    el.frenzyBtn.addEventListener('click', () => {
      SFX.unlock();
      startFrenzy(30);
      burstAt(el.ctaBar, 18, '🔥');
      announce('🔥', '2X PËR 30 SEKONDA', 'gold', 3000);
    });

    el.nextRoundBtn.addEventListener('click', () => {
      SFX.unlock();
      advanceRound();
    });

    el.musicBtn.addEventListener('click', () => {
      SFX.unlock();
      const on = SFX.toggleMusic();
      el.musicBtn.textContent = on ? '⏸️ Muzikë' : '🔊 Muzikë';
      updateNowPlaying();
    });

    try {
      const stored = localStorage.getItem('fjalemania.volume');
      let savedVolume = stored === null ? 55 : Number(stored);
      if (!Number.isFinite(savedVolume)) savedVolume = 55;
      el.musicVolume.value = String(savedVolume);
      SFX.setMusicVolume(savedVolume / 100);
    } catch {
      SFX.setMusicVolume(0.55);
    }

    el.musicVolume.addEventListener('input', () => {
      const value = Number(el.musicVolume.value);
      SFX.setMusicVolume(value / 100);
      try {
        localStorage.setItem('fjalemania.volume', String(value));
      } catch {
        /* ignore storage errors */
      }
    });

    el.obsToggleBtn.addEventListener('click', () => {
      document.body.classList.toggle('obs-mode');
      document.body.classList.remove('obs-hover');
      renderHeader();
      fitStage();
    });
    el.obsExitBtn.addEventListener('click', () => {
      document.body.classList.remove('obs-mode', 'obs-hover');
      renderHeader();
      fitStage();
    });
    el.safeToggle.addEventListener('click', () => {
      document.body.classList.toggle('show-safe');
      el.safeToggle.classList.toggle('is-on', document.body.classList.contains('show-safe'));
    });

    el.resetBtn.addEventListener('click', () => {
      if (window.confirm('Të resetohet loja? Pikët dhe likes do të fshihen.')) resetGame(false);
    });

    el.copyHookBtn.addEventListener('click', () => {
      copyText(`${location.origin}/api/event`, el.copyHookBtn, 'Kopjo');
    });
    el.copyObsBtn.addEventListener('click', () => {
      copyText(`${location.origin}/?obs=1`, el.copyObsBtn, 'Kopjo URL');
    });

    el.copyPhoneBtn.addEventListener('click', () => {
      const url = el.copyPhoneBtn.dataset.url;
      if (url) copyText(url, el.copyPhoneBtn, 'Kopjo');
    });

    el.phoneMusicBtn.addEventListener('click', () => {
      SFX.unlock();
      const on = SFX.toggleMusic();
      el.phoneMusicBtn.textContent = on ? '⏸️' : '🔊';
      el.phoneMusicBtn.title = on ? 'Ndal muzikën' : 'Muzikë';
    });

    if (!document.documentElement.requestFullscreen) {
      el.phoneFullscreenBtn.style.display = 'none';
    } else {
      el.phoneFullscreenBtn.addEventListener('click', () => {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        } else {
          document.documentElement.requestFullscreen().catch(() => {});
        }
      });
    }

    document.querySelectorAll('[data-gift]').forEach((btn) => {
      btn.addEventListener('click', () => {
        SFX.unlock();
        handleGift(currentTestUser(), btn.getAttribute('data-gift'));
      });
    });

    window.addEventListener('keydown', (e) => {
      const tag = (e.target && e.target.tagName ? e.target.tagName : '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || e.metaKey || e.ctrlKey || e.altKey) return;
      const key = String(e.key || '').toLowerCase();

      if (e.code === 'Space') {
        e.preventDefault();
        advanceRound();
      } else if (key === 'h') {
        SFX.unlock();
        revealLetters(2);
      } else if (key === 'l') {
        addLikes(500);
      } else if (key === 'm') {
        SFX.unlock();
        const on = SFX.toggleMusic();
        el.musicBtn.textContent = on ? '⏸️ Muzikë' : '🔊 Muzikë';
        updateNowPlaying();
      } else if (key === 'e') {
        handleGift(currentTestUser(), 'eagle');
      } else if (key === 'o') {
        document.body.classList.toggle('obs-mode');
        renderHeader();
        fitStage();
      }
    });

    window.addEventListener('pointerdown', () => SFX.unlock(), { once: true });

    // Hide in OBS captures: the exit pill only appears on real mouse movement.
    let hoverTimer = null;
    document.addEventListener('mousemove', () => {
      if (!document.body.classList.contains('obs-mode')) return;
      document.body.classList.add('obs-hover');
      clearTimeout(hoverTimer);
      hoverTimer = setTimeout(() => document.body.classList.remove('obs-hover'), 2200);
    });
  }

  async function copyText(text, btn, restore) {
    const original = btn.textContent;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
      btn.textContent = '✓';
    } catch {
      window.prompt('Kopjo manualisht:', text);
    }
    setTimeout(() => {
      btn.textContent = restore || original;
    }, 1400);
  }

  /* ---------------------------------------------------------------
     SCALING + BOOT
     --------------------------------------------------------------- */

  function fitStage() {
    const rect = el.stageWrap.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const scale = Math.min(rect.width / 1080, rect.height / 1920);
    el.stage.style.setProperty('--stage-scale', String(scale));
  }

  function applyUrlFlags() {
    const params = new URLSearchParams(location.search);
    if (params.get('obs') === '1' || params.get('obs') === 'true') {
      document.body.classList.add('obs-mode');
    }
    if (params.get('safe') === '1') document.body.classList.add('show-safe');
    const season = Number(params.get('season'));
    if (Number.isFinite(season) && season >= 2) CFG.seasonRounds = Math.floor(season);
    wantsMusic = params.get('music') === '1';
    phoneMode = params.get('phone') === '1';
    obsPage = params.get('obs') === '1' || params.get('obs') === 'true';
    if (phoneMode) document.body.classList.add('phone-mode');
  }

  function updateNowPlaying() {
    const song = SFX.getCurrentSong();
    if (!song || !song.name) return;
    el.nowPlaying.textContent = `🎵 ${song.name}`;
    el.nowPlaying.title = song.name;
    if (el.phoneMusicBtn) el.phoneMusicBtn.title = song.name;
  }

  async function loadMusicLibrary() {
    try {
      const res = await fetch('/api/music', { cache: 'no-store' });
      const data = await res.json();
      const tracks = Array.isArray(data.tracks) ? data.tracks : [];
      SFX.setPlaylist(tracks);
    } catch {
      SFX.setPlaylist([]);
    }
    updateNowPlaying();
    if (wantsMusic) {
      SFX.startMusic();
      el.musicBtn.textContent = '⏸️ Muzikë';
      updateNowPlaying();
    }
    if (el.phoneMusicBtn) {
      el.phoneMusicBtn.textContent = SFX.musicEnabled ? '⏸️' : '🔊';
    }
  }

  async function loadNetworkInfo() {
    if (!el.phoneUrl) return;
    try {
      const res = await fetch('/api/network', { cache: 'no-store' });
      const data = await res.json();
      const first = Array.isArray(data.addresses) ? data.addresses[0] : null;
      if (first && data.lanEnabled) {
        el.phoneUrl.textContent = first.phoneUrl.replace(/^https?:\/\//, '');
        el.phoneUrl.title = first.phoneUrl;
        el.copyPhoneBtn.dataset.url = first.phoneUrl;
      } else {
        el.phoneUrl.textContent = data.lanEnabled ? 'Nuk u gjet IP LAN' : 'LAN i fikur (HOST=localhost)';
        el.copyPhoneBtn.disabled = true;
      }
    } catch {
      el.phoneUrl.textContent = 'Nuk u lexua rrjeti';
      el.copyPhoneBtn.disabled = true;
    }
  }

  function buildSnapshot() {
    if (!state.golden) return null;
    const round = DATA.ROUNDS[state.roundIdx];
    const entry = (w) => ({
      id: w.id,
      raw: w.raw,
      chars: w.chars,
      norm: w.norm,
      golden: Boolean(w.golden),
      solved: Boolean(w.solved),
      finder: w.finder || '',
      points: Number(w.points) || 0,
      hinted: Array.from(w.hinted || [])
    });
    const overlayRows = Array.from(el.overlayList.children).map((row) => ({
      idx: row.querySelector('.idx')?.textContent || '',
      name: row.querySelector('.name')?.textContent || '',
      pts: row.querySelector('.pts')?.textContent || ''
    }));
    const ctaKind = Array.from(el.ctaBar.classList).find((c) => !['cta', 'pop'].includes(c)) || 'idle';

    return {
      v: 1,
      roundIdx: state.roundIdx,
      category: round.category,
      letters: state.letters,
      board: state.board.map(entry),
      golden: entry(state.golden),
      likesTotal: state.likesTotal,
      likesProgress: state.likesProgress,
      likeGoal: state.likeGoal,
      hype: state.hype,
      timeLeft: state.timeLeft,
      mult: multiplier(),
      theme: DATA.THEMES[state.themeIdx].id,
      seasonRound: state.seasonRound,
      seasonRounds: CFG.seasonRounds,
      players: leaderboard().slice(0, 5).map((p) => ({
        user: p.user,
        score: p.score,
        words: p.words,
        team: p.team
      })),
      cta: { icon: el.ctaIcon.textContent, text: el.ctaText.textContent, kind: ctaKind },
      overlay: {
        show: el.overlay.classList.contains('show'),
        emoji: el.overlayEmoji.textContent,
        title: el.overlayTitle.textContent,
        rows: overlayRows,
        next: el.overlayNext.textContent
      }
    };
  }

  // Only the page used as the OBS source publishes; the phone mirrors that page.
  function startSpectatorPublisher() {
    if (phoneMode) return;
    const publish = () => {
      if (!obsPage) return;
      const snapshot = buildSnapshot();
      if (!snapshot) return;
      fetch('/api/spectate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(snapshot)
      }).catch(() => {});
    };
    setInterval(publish, 900);
    publish();
  }

  function showSpectatorWaiting() {
    el.overlayEmoji.textContent = '📱';
    el.overlayTitle.textContent = 'DUKE U LIDHUR…';
    el.overlayList.textContent = '';
    el.overlayNext.textContent = 'Pamja e hostit po vjen…';
    el.overlay.classList.add('show');
    el.overlay.setAttribute('aria-hidden', 'false');
  }

  function applySnapshot(snapshot) {
    if (!snapshot || !Array.isArray(snapshot.board) || !snapshot.golden) return;

    state.phase = 'spectating';
    state.lastSnapAt = Date.now();
    if (Number.isFinite(Number(snapshot.roundIdx))) state.roundIdx = Number(snapshot.roundIdx);
    if (Array.isArray(snapshot.letters)) state.letters = snapshot.letters;

    state.board = snapshot.board.map((w) => ({
      id: w.id,
      raw: w.raw,
      chars: Array.isArray(w.chars) ? w.chars : Array.from(String(w.raw).toUpperCase()),
      norm: w.norm || DATA.normalizeAlbanian(w.raw),
      golden: Boolean(w.golden),
      solved: Boolean(w.solved),
      finder: w.finder || '',
      points: Number(w.points) || 0,
      hinted: new Set(Array.isArray(w.hinted) ? w.hinted : [])
    }));

    const g = snapshot.golden;
    state.golden = {
      id: 'golden',
      raw: g.raw,
      chars: Array.isArray(g.chars) ? g.chars : Array.from(String(g.raw).toUpperCase()),
      norm: g.norm || DATA.normalizeAlbanian(g.raw),
      golden: true,
      solved: Boolean(g.solved),
      finder: g.finder || '',
      points: Number(g.points) || 0,
      hinted: new Set(Array.isArray(g.hinted) ? g.hinted : [])
    };

    state.likesTotal = Number(snapshot.likesTotal) || 0;
    state.likesProgress = Number(snapshot.likesProgress) || 0;
    state.likeGoal = Math.max(CFG.likeGoalStart, Number(snapshot.likeGoal) || CFG.likeGoalStart);
    state.hype = Number(snapshot.hype) || 0;
    state.timeLeft = Number(snapshot.timeLeft) || 0;
    state.seasonRound = Number(snapshot.seasonRound) || 0;
    state.players = new Map(
      (Array.isArray(snapshot.players) ? snapshot.players : []).map((p) => [
        p.user,
        { user: p.user, score: Number(p.score) || 0, words: Number(p.words) || 0, team: p.team || '' }
      ])
    );

    if (snapshot.theme && snapshot.theme !== state.spectateTheme) {
      el.stage.classList.remove(...THEME_IDS);
      el.stage.classList.add(snapshot.theme);
      state.spectateTheme = snapshot.theme;
    }

    if (snapshot.category) el.category.textContent = snapshot.category;
    renderTimer();
    renderLikes();
    renderTop3();

    const lettersSig = state.letters.join('');
    if (lettersSig !== state.lettersSig) {
      state.lettersSig = lettersSig;
      renderLetters();
    }

    const boardSig = JSON.stringify([
      snapshot.roundIdx,
      snapshot.board.map((w) => [w.raw, w.solved, w.finder, w.points, w.hinted]),
      [g.raw, g.solved, g.finder, g.points, g.hinted]
    ]);
    if (boardSig !== state.spectateSig) {
      state.spectateSig = boardSig;
      renderBoard();
    }

    const mult = Number(snapshot.mult) || 1;
    el.multPill.textContent = mult > 1 ? `${mult}X` : '1X';
    el.multPill.classList.toggle('on', mult > 1);
    el.stage.classList.toggle('eagle', mult === 3);
    el.stage.classList.toggle('frenzy', mult === 2);

    const cta = snapshot.cta || {};
    el.ctaBar.className = `cta ${cta.kind || 'idle'}`;
    el.ctaIcon.textContent = cta.icon || '💬';
    el.ctaText.textContent = cta.text || '';

    const overlay = snapshot.overlay || {};
    const show = Boolean(overlay.show);
    el.overlay.classList.toggle('show', show);
    el.overlay.setAttribute('aria-hidden', show ? 'false' : 'true');
    if (show) {
      el.overlayEmoji.textContent = overlay.emoji || '';
      el.overlayTitle.textContent = overlay.title || '';
      el.overlayList.textContent = '';
      for (const row of overlay.rows || []) {
        const line = makeEl('div', 'overlay-row');
        line.append(
          makeEl('span', 'idx', row.idx || ''),
          makeEl('span', 'name', row.name || ''),
          makeEl('span', 'pts', row.pts || '')
        );
        el.overlayList.appendChild(line);
      }
      el.overlayNext.textContent = overlay.next || '';
    }
  }

  function boot() {
    buildStaticUi();
    applyUrlFlags();
    wireControls();
    SFX.onTrackChange = updateNowPlaying;
    loadRound(nextRoundIndex());

    if (phoneMode) {
      state.phase = 'spectating';
      setSim(false);
      showSpectatorWaiting();
      fetch('/api/spectate', { cache: 'no-store' })
        .then((res) => res.json())
        .then((data) => {
          if (data && data.snapshot) applySnapshot(data.snapshot);
        })
        .catch(() => {});
    } else {
      startSpectatorPublisher();
    }

    connectBridge();
    fitStage();
    loadMusicLibrary();
    loadNetworkInfo();

    // Small integration/debug surface for hosts and automation.
    window.FJALEMANIA = {
      snapshot: () => ({
        round: state.roundIdx + 1,
        topic: DATA.ROUNDS[state.roundIdx].category,
        seasonRound: state.seasonRound,
        seasonRounds: CFG.seasonRounds,
        phase: state.phase,
        live: state.live,
        likes: state.likesTotal,
        hype: state.hype,
        golden: { word: state.golden.raw, solved: state.golden.solved },
        board: state.board.map((w) => ({ word: w.raw, solved: w.solved, points: w.points }))
      }),
      comment: (user, text) => handleComment(user, text),
      like: (n) => addLikes(n),
      gift: (user, type, repeat) => handleGift(user, type, repeat),
      nextRound: () => advanceRound(),
      setSeason: (n) => { CFG.seasonRounds = Math.max(2, Math.floor(Number(n) || CFG.seasonRounds)); },
      endRound: (reason) => endRound(reason || 'time'),
      revealWord: () => revealWord('Debug'),
      revealLetters: (n) => revealLetters(n || 2),
      reset: () => resetGame(false)
    };

    if ('ResizeObserver' in window) {
      new ResizeObserver(fitStage).observe(el.stageWrap);
    }
    window.addEventListener('resize', fitStage);

    setInterval(() => {
      if (state.phase !== 'playing') {
        renderMult();
        return;
      }
      const left = Math.max(0, Math.ceil((state.roundEndsAt - Date.now()) / 1000));
      if (left !== state.timeLeft) {
        state.timeLeft = left;
        renderTimer();
        if (left > 0 && left <= 5 && left !== state.lastTickSec) {
          state.lastTickSec = left;
          SFX.playTick();
        }
      }
      if (left === 0) endRound('time');
      renderMult();
    }, 500);

    setInterval(simulatorTick, CFG.simMs);

    setInterval(() => {
      if (phoneMode) return;
      if (state.phase !== 'playing') return;
      if (Date.now() < state.ctaHoldUntil) return;
      state.idleIdx += 1;
      showIdleCta();
    }, CFG.idleMs);

    setInterval(() => {
      if (phoneMode) return;
      if (state.phase !== 'playing') return;
      state.letters = shuffleArray(state.letters);
      renderLetters();
    }, CFG.shuffleMs);

    if (!phoneMode) showIdleCta();
    if (!phoneMode) setSim(true);
  }

  boot();
})();
