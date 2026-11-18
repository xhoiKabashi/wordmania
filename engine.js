'use strict';

/* ============================================================
   FJALËMANIA LIVE — Single Authoritative Server Game Engine
   Runs once in server.js; all views (Studio, OBS, Phone)
   render snapshots and play FX events from this engine.
   ============================================================ */

function createGameEngine(opts = {}) {
  const DATA = opts.data || globalThis.ALBANIAN_DATA || {};
  const emit = typeof opts.onBroadcast === 'function' ? opts.onBroadcast : () => {};

  const GIFTS = Array.isArray(DATA.GIFTS) ? DATA.GIFTS : [];
  const TIPS = Array.isArray(DATA.TIPS) && DATA.TIPS.length ? DATA.TIPS : [['💬', 'SHKRUAJ FJALËN NË KOMENT']];
  const TEAMS = Array.isArray(DATA.TEAMS) ? DATA.TEAMS : [{ id: 'tirana', tag: '#tirana', label: 'Tirana', flag: '🇦🇱' }];
  const THEMES = Array.isArray(DATA.THEMES) ? DATA.THEMES : [{ id: 'theme-kuqezi', name: 'Kuq e Zi VIP' }];
  const ROUNDS = Array.isArray(DATA.ROUNDS) ? DATA.ROUNDS : [];
  const VIEWERS_POOL = Array.isArray(DATA.VIEWERS_POOL) ? DATA.VIEWERS_POOL : [{ user: 'andi_tirana', team: 'tirana' }];

  const normalizeAlbanian =
    typeof DATA.normalizeAlbanian === 'function'
      ? DATA.normalizeAlbanian
      : (raw) =>
          String(raw || '')
            .toUpperCase()
            .replace(/Ë/g, 'E')
            .replace(/Ç/g, 'C')
            .replace(/[^A-Z]/g, '');

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
    seasonRounds: 90
  };

  const state = {
    seq: 0,
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
    mainBonusSet: new Set(),
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
    simEnabled: false,
    simMode: 'normal',
    live: false,
    everLive: false,
    eventCount: 0,
    idleIdx: 0,
    cta: { icon: '💬', text: 'SHKRUAJ FJALËN NË KOMENT', kind: 'idle' },
    ctaHoldUntil: 0,
    ctaTimer: null,
    overlay: { show: false, emoji: '🏆', title: '', rows: [], next: '' },
    resultTimers: [],
    resultTicker: null,
    animateId: '',
    wrongAt: 0,
    joinAt: 0
  };

  /* ---------------------------------------------------------------
     HELPERS
     --------------------------------------------------------------- */

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

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function clearTimers(list) {
    list.forEach((id) => clearTimeout(id));
    list.length = 0;
  }

  function clearAllTimers() {
    clearTimers(state.resultTimers);
    if (state.resultTicker) {
      clearInterval(state.resultTicker);
      state.resultTicker = null;
    }
    if (state.ctaTimer) {
      clearTimeout(state.ctaTimer);
      state.ctaTimer = null;
    }
  }

  function multiplier() {
    const now = Date.now();
    if (now < state.eagleUntil) return 3;
    if (now < state.frenzyUntil) return 2;
    return 1;
  }

  function teamOf(text) {
    const lower = String(text || '').toLowerCase();
    const team = TEAMS.find((t) => lower.includes(t.tag));
    return team ? team.id : '';
  }

  function teamJoin(text) {
    const lower = String(text || '').trim().toLowerCase();
    return TEAMS.find((t) => t.tag === lower) || null;
  }

  function getOrCreatePlayer(name, team) {
    const user = cleanUser(name);
    let p = state.players.get(user);
    if (!p) {
      p = {
        user,
        score: 0,
        words: 0,
        team: team || TEAMS[user.length % TEAMS.length].id
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

  /* ---------------------------------------------------------------
     SNAPSHOT & BROADCAST
     --------------------------------------------------------------- */

  let pendingFx = [];

  function pushFx(item) {
    if (item) pendingFx.push(item);
  }

  function getSnapshot() {
    if (!state.golden) return null;
    const round = ROUNDS[state.roundIdx] || { category: '' };
    const serializeEntry = (w) => ({
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

    return {
      v: 3,
      seq: state.seq,
      roundIdx: state.roundIdx,
      category: round.category,
      phase: state.phase,
      letters: state.letters.slice(),
      board: state.board.map(serializeEntry),
      golden: serializeEntry(state.golden),
      animateId: state.animateId,
      likesTotal: state.likesTotal,
      likesProgress: state.likesProgress,
      likeGoal: state.likeGoal,
      hype: state.hype,
      timeLeft: state.timeLeft,
      mult: multiplier(),
      frenzyUntil: state.frenzyUntil,
      eagleUntil: state.eagleUntil,
      vip: state.vip,
      king: state.king,
      themeIdx: state.themeIdx,
      theme: (THEMES[state.themeIdx] || THEMES[0]).id,
      seasonRound: state.seasonRound,
      seasonRounds: CFG.seasonRounds,
      live: state.live,
      eventCount: state.eventCount,
      simEnabled: state.simEnabled,
      simMode: state.simMode,
      players: leaderboard()
        .slice(0, 10)
        .map((p) => ({
          user: p.user,
          score: p.score,
          words: p.words,
          team: p.team
        })),
      cta: { icon: state.cta.icon, text: state.cta.text, kind: state.cta.kind },
      overlay: {
        show: Boolean(state.overlay.show),
        emoji: state.overlay.emoji,
        title: state.overlay.title,
        rows: state.overlay.rows,
        next: state.overlay.next
      }
    };
  }

  function flushState() {
    state.seq += 1;
    const fx = pendingFx;
    pendingFx = [];
    const snapshot = getSnapshot();
    state.animateId = '';
    emit({
      type: 'state',
      snapshot,
      fx,
      ts: Date.now()
    });
  }

  /* ---------------------------------------------------------------
     CTA / ANNOUNCEMENTS
     --------------------------------------------------------------- */

  function setCta(icon, text, kind) {
    state.cta = { icon: icon || '💬', text: String(text || ''), kind: kind || 'idle' };
  }

  function showIdleCta(shouldFlush = true) {
    if (state.idleIdx % 2 === 0 || TIPS.length < 2) {
      setCta('💬', 'SHKRUAJ FJALËN NË KOMENT', 'idle');
    } else {
      const tip = TIPS[1 + (Math.floor(state.idleIdx / 2) % (TIPS.length - 1))];
      setCta(tip[0], tip[1], 'idle');
    }
    if (shouldFlush) flushState();
  }

  function announce(icon, text, kind = 'idle', ms = 3000) {
    if (state.ctaTimer) clearTimeout(state.ctaTimer);
    state.ctaHoldUntil = Date.now() + ms;
    setCta(icon, text, kind);
    state.ctaTimer = setTimeout(() => {
      state.ctaTimer = null;
      state.ctaHoldUntil = 0;
      if (state.phase === 'playing') {
        showIdleCta(true);
      }
    }, ms);
  }

  function maybeAnnounce(icon, text, kind) {
    if (Date.now() < state.ctaHoldUntil) return false;
    announce(icon, text, kind, 1900);
    return true;
  }

  /* ---------------------------------------------------------------
     ROUND LIFECYCLE
     --------------------------------------------------------------- */

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

  function nextRoundIndex() {
    if (!state.deck.length) {
      state.deck = shuffleArray(ROUNDS.map((_, i) => i));
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

  function pickGolden(round) {
    const pool = goldensOf(round);
    if (!pool.length) return 'HINT';
    const history = state.goldenHistory.get(round.id) || [];
    const blocked = new Set(history);
    const available = pool.filter((g) => !blocked.has(normalizeAlbanian(g)));
    const choice = available.length ? pick(available) : pick(pool);
    const depth = Math.min(2, Math.max(0, pool.length - 1));
    state.goldenHistory.set(round.id, [normalizeAlbanian(choice), ...history].slice(0, depth));
    return choice;
  }

  function makeEntry(id, raw, golden) {
    const chars = Array.from(String(raw).toUpperCase());
    return {
      id,
      raw: chars.join(''),
      chars,
      norm: normalizeAlbanian(raw),
      golden: Boolean(golden),
      solved: false,
      finder: '',
      points: 0,
      hinted: new Set()
    };
  }

  function hideResult() {
    clearTimers(state.resultTimers);
    if (state.resultTicker) {
      clearInterval(state.resultTicker);
      state.resultTicker = null;
    }
    state.overlay = { show: false, emoji: '🏆', title: '', rows: [], next: '' };
  }

  function loadRound(index, shouldFlush = true) {
    if (!ROUNDS.length) return;
    hideResult();
    state.phase = 'playing';
    state.roundIdx = ((index % ROUNDS.length) + ROUNDS.length) % ROUNDS.length;
    const round = ROUNDS[state.roundIdx];

    state.timeLeft = CFG.roundSeconds;
    state.roundEndsAt = Date.now() + CFG.roundSeconds * 1000;
    state.foundBonus = new Set();
    state.comboUser = '';
    state.comboCount = 0;
    state.letters = shuffleArray([...round.letters]);

    const goldenRaw = pickGolden(round);
    const goldenNorm = normalizeAlbanian(goldenRaw);
    const normals = round.words
      .filter((w) => normalizeAlbanian(w) !== goldenNorm)
      .map((w) => ({ raw: w, norm: normalizeAlbanian(w) }));

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
    state.mainBonusSet = new Set();
    for (const x of normals) {
      if (x.norm && x.norm.length >= 2 && !used.has(x.norm)) {
        state.bonusPool.set(x.norm, x.raw);
        state.mainBonusSet.add(x.norm);
      }
    }
    for (const w of round.bonus || []) {
      const n = normalizeAlbanian(w);
      if (n && n.length >= 2 && !used.has(n) && !state.bonusPool.has(n)) {
        state.bonusPool.set(n, w);
      }
    }

    pushFx({ kind: 'shuffle' });
    announce('🎬', round.category, 'warn', 3200);
    if (shouldFlush) flushState();
  }

  function showResult(emoji, title, rows, opts = {}) {
    const duration = opts.ms || CFG.resultMs;
    const label = opts.nextLabel || 'Raundi tjetër në';
    let left = Math.ceil(duration / 1000);

    state.overlay = {
      show: true,
      emoji,
      title,
      rows,
      next: `${label} ${left}…`
    };
    flushState();

    if (state.resultTicker) clearInterval(state.resultTicker);
    state.resultTicker = setInterval(() => {
      left -= 1;
      if (left > 0) {
        state.overlay = { ...state.overlay, next: `${label} ${left}…` };
        flushState();
      }
    }, 1000);

    state.resultTimers.push(
      setTimeout(() => {
        hideResult();
        if (opts.onDone) opts.onDone();
        else advanceRound();
      }, duration)
    );
  }

  function endRound(reason) {
    if (state.phase === 'ended') return;
    state.phase = 'ended';

    const perfect = reason === 'perfect';
    const title = perfect ? 'TABELA U KOMPLETUA!' : 'KOHA MBAROI!';
    const emoji = perfect ? '🏆' : '⏱️';
    let rows = [];

    if (perfect) {
      rows = leaderboard()
        .slice(0, 3)
        .map((p, i) => ({
          idx: ['🥇', '🥈', '🥉'][i],
          name: `@${p.user}`,
          pts: `${fmt(p.score)} PK`
        }));
      if (!rows.length) rows = [{ idx: '🏆', name: 'Të gjitha fjalët u gjetën!', pts: '' }];
      pushFx({ kind: 'round_win' });
    } else {
      const missing = [...state.board, state.golden].filter((w) => !w.solved).slice(0, 4);
      rows = missing.map((w) => ({ idx: '✗', name: w.raw, pts: '' }));
      if (!rows.length) rows = [{ idx: '✅', name: 'Të gjitha u gjetën!', pts: '' }];
      pushFx({ kind: 'tick' });
    }

    showResult(emoji, title, rows);
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
    state.seasonRound = 0;
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
        loadRound(nextRoundIndex(), false);
        announce('🆕', 'SEZONI I RI · PIKËT U RESETUAN', 'gold', 3800);
        flushState();
      }
    });
  }

  function advanceRound() {
    if (state.seasonShowing) return;
    state.seasonRound += 1;
    if (state.seasonRound >= CFG.seasonRounds) {
      if (!leaderboard().length) {
        state.seasonRound = 0;
        loadRound(nextRoundIndex(), true);
        return;
      }
      showSeasonRecap();
      return;
    }
    loadRound(nextRoundIndex(), true);
  }

  function resetGame(silent) {
    clearAllTimers();
    resetSeason();
    state.wrongAt = 0;
    state.eventCount = 0;
    state.deck = [];
    state.seasonShowing = false;
    state.roundHistory.clear();
    state.goldenHistory.clear();
    loadRound(nextRoundIndex(), false);
    if (!silent) announce('♻️', 'Loja u resetua', 'warn', 2200);
    flushState();
  }

  /* ---------------------------------------------------------------
     GUESSING, LIKES, GIFTS
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

  function refreshKing() {
    const top = leaderboard()[0];
    if (!top || !top.user) return;
    if (top.user !== state.king) {
      const hadKing = Boolean(state.king);
      state.king = top.user;
      if (hadKing) {
        pushFx({ kind: 'new_king' });
        announce('👑', `MBRET I RI: @${top.user} · ${fmt(top.score)} PK`, 'gold', 3400);
      }
    }
  }

  function completeWord(entry, user, points) {
    if (entry.solved) return false;
    entry.solved = true;
    entry.finder = user || '';
    entry.points = Math.max(0, Math.round(points || 0));
    state.animateId = entry.id;
    pushFx({ kind: 'word_found', id: entry.id, golden: Boolean(entry.golden), chars: entry.chars });
    checkComplete();
    return true;
  }

  function solveByPlayer(entry, player) {
    const base = entry.chars.length * 20;
    const mult = multiplier() * (entry.golden ? CFG.goldenMult : 1);
    const combo = comboMultiplier(player);
    const points = Math.round(base * mult * combo);
    const comboLevel =
      state.comboUser === player.user && Date.now() - state.comboAt <= CFG.comboWindowMs ? state.comboCount + 1 : 1;

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

    if (comboLevel >= 2) pushFx({ kind: 'combo', level: comboLevel });
  }

  function handleComment(rawUser, rawText, forcedTeam) {
    if (state.phase !== 'playing') return false;
    const text = String(rawText || '').trim();
    if (!text) return false;

    const user = cleanUser(rawUser);
    const team = teamOf(text) || forcedTeam || '';
    const player = getOrCreatePlayer(user, team);
    const norm = normalizeAlbanian(text);

    const join = teamJoin(text);
    if (join) {
      if (maybeAnnounce(join.flag, `@${user} u bashkua me ${join.label}!`, 'gift')) return true;
      return false;
    }
    if (!norm) return false;

    let target = norm.length <= 28 ? [state.golden, ...state.board].find((w) => !w.solved && w.norm === norm) : null;

    const tokens = text
      .split(/[\s,.;:!?+*#_~-]+/)
      .map((t) => normalizeAlbanian(t))
      .filter((t) => t.length >= 2 && t.length <= 28);

    if (!target) {
      for (const tok of tokens) {
        target = [state.golden, ...state.board].find((w) => !w.solved && w.norm === tok);
        if (target) break;
      }
    }

    if (target) {
      solveByPlayer(target, player);
      return true;
    }

    let already = norm.length <= 28 ? [state.golden, ...state.board].find((w) => w.solved && w.norm === norm) : null;
    if (!already) {
      for (const tok of tokens) {
        already = [state.golden, ...state.board].find((w) => w.solved && w.norm === tok);
        if (already) break;
      }
    }
    if (already) {
      return maybeAnnounce('⏱️', `"${already.raw}" u gjet më parë · @${user}`, 'warn');
    }

    let bonusHit = norm.length <= 28 && state.bonusPool.has(norm) && !state.foundBonus.has(norm) ? norm : null;
    if (!bonusHit) {
      for (const tok of tokens) {
        if (state.bonusPool.has(tok) && !state.foundBonus.has(tok)) {
          bonusHit = tok;
          break;
        }
      }
    }

    if (bonusHit) {
      const raw = state.bonusPool.get(bonusHit);
      const rawChars = Array.from(String(raw).toUpperCase());

      if (state.mainBonusSet.has(bonusHit)) {
        const swapSlot = state.board.find((w) => !w.solved && w.hinted.size === 0 && w.chars.length === rawChars.length);
        if (swapSlot) {
          state.bonusPool.delete(bonusHit);
          state.mainBonusSet.delete(bonusHit);
          if (!state.foundBonus.has(swapSlot.norm)) {
            state.bonusPool.set(swapSlot.norm, swapSlot.raw);
            state.mainBonusSet.add(swapSlot.norm);
          }
          swapSlot.raw = rawChars.join('');
          swapSlot.chars = rawChars;
          swapSlot.norm = bonusHit;
          solveByPlayer(swapSlot, player);
          return true;
        }
      }

      state.foundBonus.add(bonusHit);
      const points = Math.round(CFG.bonusPoints * multiplier());
      player.score += points;
      player.words += 1;
      pushFx({ kind: 'bonus_word', chars: rawChars });
      announce('🌟', `BONUS "${raw}" +${fmt(points)} PK · @${user}`, 'find', 3000);
      refreshKing();
      return true;
    }

    if (Date.now() - state.wrongAt > 2500) {
      state.wrongAt = Date.now();
      return maybeAnnounce('💬', `"${shortText(text)}" — jo në tabelë · @${user}`, 'warn');
    }
    return false;
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
      pushFx({ kind: 'reveal_letters', count: revealed });
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
  }

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
        state.likesProgress = 0;
        break;
      }
      state.likesProgress -= goal;
      state.likeGoal = goal + step;
      revealed += got;
    }

    pushFx({ kind: 'like_bump', count, revealed });
    if (revealed > 0) {
      const text =
        revealed === 1
          ? `${fmt(state.likeGoal - step)} LIKES! U ZBULUA 1 SHKRONJË`
          : `${fmt(count)} LIKES! U ZBULUAN ${revealed} SHKRONJA`;
      announce('❤️', text, 'like', 3400);
    }
    return true;
  }

  function nextTheme(user, combo = '') {
    state.themeIdx = (state.themeIdx + 1) % THEMES.length;
    const theme = THEMES[state.themeIdx];
    pushFx({ kind: 'theme' });
    announce('🌹', `NGJYRAT: ${theme.name} · @${user}${combo}`, 'gift', 3400);
  }

  function nextSong(user, combo = '') {
    pushFx({ kind: 'song', user, combo });
    announce('🎵', `KËNGË E RE · @${user}${combo}`, 'gift', 3400);
  }

  function startEagle(user, combo = '') {
    state.eagleUntil = Date.now() + 45000;
    state.vip = user;
    pushFx({ kind: 'eagle' });
    revealWord(user);
    announce('🫰', `3X VIP 45 SEKONDA · @${user}${combo}`, 'gold', 4200);
  }

  function hyperUnlock(player) {
    pushFx({ kind: 'hyper' });
    if (!state.golden.solved) {
      completeWord(state.golden, 'HYPER', 0);
    } else {
      revealLetters(4);
    }
    startFrenzy(30);
    announce('🎁', `HYPER! FJALA E ARTË + 3X · @${player.user}`, 'gold', 4600);
  }

  function handleGift(rawUser, typeId, repeat = 1) {
    if (state.phase === 'ended') return false;
    const user = cleanUser(rawUser || 'VIP');
    const player = getOrCreatePlayer(user);
    const gift = GIFTS.find((g) => g.id === typeId) || GIFTS[0];
    const times = Math.max(1, Math.min(10, Math.floor(Number(repeat) || 1)));
    const combo = times > 1 ? ` ${times}×` : '';

    player.score += gift.points * times;
    refreshKing();

    pushFx({ kind: 'gift', giftId: gift.id, emoji: gift.emoji });

    if (gift.id === 'theme') {
      nextTheme(user, combo);
    } else if (gift.id === 'song') {
      nextSong(user, combo);
    } else if (gift.id === 'hint') {
      const count = 2 * Math.min(times, 2);
      let revealed = 0;
      for (let i = 0; i < count; i++) {
        if (revealWord(user)) revealed += 1;
      }
      announce('🚀', `+${revealed || 2} FJALË · @${user}`, 'gift', 3200);
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
    return true;
  }

  /* ---------------------------------------------------------------
     SIMULATOR + BACKGROUND TIMERS
     --------------------------------------------------------------- */

  function simulatorTick() {
    if (!state.simEnabled || state.phase !== 'playing') return;
    const viral = state.simMode === 'viral';
    const viewer = pick(VIEWERS_POOL);
    const roll = Math.random();
    let changed = false;

    if (roll < (viral ? 0.6 : 0.45)) {
      const unsolved = [...state.board, state.golden].filter((w) => !w.solved);
      if (unsolved.length) {
        const word = pick(unsolved);
        if (handleComment(viewer.user, word.raw, viewer.team)) changed = true;
      }
    } else if (roll < (viral ? 0.82 : 0.62)) {
      if (addLikes(viral ? randInt(90, 260) : randInt(18, 55))) changed = true;
    }

    if (Math.random() < (viral ? 0.2 : 0.08)) {
      if (handleGift(viewer.user, pick(GIFTS).id)) changed = true;
    }

    if (changed) flushState();
  }

  const simInterval = setInterval(simulatorTick, CFG.simMs);
  const idleInterval = setInterval(() => {
    if (state.phase !== 'playing') return;
    if (Date.now() < state.ctaHoldUntil) return;
    state.idleIdx += 1;
    showIdleCta(true);
  }, CFG.idleMs);
  const shuffleInterval = setInterval(() => {
    if (state.phase !== 'playing') return;
    state.letters = shuffleArray(state.letters);
    flushState();
  }, CFG.shuffleMs);
  simInterval.unref?.();
  idleInterval.unref?.();
  shuffleInterval.unref?.();

  /* ---------------------------------------------------------------
     PUBLIC EVENT INGESTION
     --------------------------------------------------------------- */

  function handleCommand(action, raw = {}) {
    switch (action) {
      case 'nextRound':
        advanceRound();
        return;
      case 'hint': {
        const got = revealLetters(2);
        announce('🔍', `+${got || 2} shkronja të zbuluara`, 'warn', 2200);
        flushState();
        return;
      }
      case 'reveal': {
        const word = revealWord('Hint');
        if (word) {
          announce('💡', `Fjala "${word}" u zbulua`, 'warn', 2400);
          flushState();
        }
        return;
      }
      case 'frenzy':
        startFrenzy(30);
        pushFx({ kind: 'frenzy' });
        announce('🔥', '2X PËR 30 SEKONDA', 'gold', 3000);
        flushState();
        return;
      case 'reset':
        resetGame(false);
        return;
      case 'simOn':
        state.simEnabled = true;
        flushState();
        return;
      case 'simOff':
        state.simEnabled = false;
        flushState();
        return;
      case 'simNormal':
        state.simMode = 'normal';
        state.simEnabled = true;
        flushState();
        return;
      case 'simViral':
        state.simMode = 'viral';
        state.simEnabled = true;
        flushState();
        return;
      case 'setSeason': {
        const n = Number(raw.value ?? raw.count ?? raw.rounds);
        if (Number.isFinite(n) && n >= 2) {
          CFG.seasonRounds = Math.floor(n);
          flushState();
        }
        return;
      }
      default:
        return;
    }
  }

  function handleEvent(event) {
    if (!event || typeof event !== 'object') return;

    if (event.type === 'command') {
      handleCommand(event.action, event);
      return;
    }

    if (!event.isSimulated) {
      if (!state.everLive) {
        state.everLive = true;
        if (state.simEnabled) state.simEnabled = false;
      }
      state.live = true;
      state.eventCount += 1;
    }

    let changed = !event.isSimulated;
    switch (event.type) {
      case 'comment':
        if (handleComment(event.user, event.text, event.team)) changed = true;
        break;
      case 'like':
        if (addLikes(event.count || 1)) changed = true;
        break;
      case 'gift':
        if (handleGift(event.user, event.giftType || event.giftName || 'theme', event.count || 1)) changed = true;
        break;
      case 'join':
      case 'follow':
      case 'share': {
        const user = cleanUser(event.user);
        if (Date.now() - state.joinAt > 8000) {
          state.joinAt = Date.now();
          pushFx({ kind: 'join' });
          maybeAnnounce('👋', `@${user} u bashkua live`, 'gift');
          changed = true;
        }
        break;
      }
      default:
        break;
    }

    if (changed) flushState();
  }

  function destroy() {
    clearAllTimers();
    clearInterval(simInterval);
    clearInterval(idleInterval);
    clearInterval(shuffleInterval);
  }

  // Boot the single authoritative game immediately on server startup.
  loadRound(nextRoundIndex(), false);

  return {
    handleEvent,
    getSnapshot,
    destroy
  };
}

module.exports = { createGameEngine };
