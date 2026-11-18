/* ============================================================
   FJALËMANIA LIVE — thin client renderer + FX/audio + Studio controls
   Game state lives on server.js (engine.js); all views (Studio,
   OBS, Phone) render the exact same authoritative snapshots.
   ============================================================ */
(function () {
  'use strict';

  const DATA = window.ALBANIAN_DATA;
  const SFX = window.SoundEngine;
  const GIFTS = DATA.GIFTS || [];
  const THEME_IDS = DATA.THEMES.map((t) => t.id);

  let wantsMusic = false;
  let phoneMode = false;
  let obsPage = false;
  let urlTikTokUser = '';

  const CFG = {
    roundSeconds: 90,
    likeGoalStart: 200,
    likeGoalStep: 200,
    goldenMult: 3,
    maxParticles: 110
  };

  const state = {
    seq: 0,
    roundIdx: 0,
    phase: 'playing',
    board: [],
    golden: null,
    letters: [],
    players: [],
    likesTotal: 0,
    likesProgress: 0,
    likeGoal: CFG.likeGoalStart,
    frenzyUntil: 0,
    eagleUntil: 0,
    themeId: THEME_IDS[0] || 'theme-kuqezi',
    hype: 0,
    live: false,
    eventCount: 0,
    simEnabled: false,
    simMode: 'normal',
    animateId: '',
    traceTimers: [],
    wordEls: new Map(),
    letterNodes: [],
    appliedTheme: '',
    lettersSig: '',
    boardSig: '',
    top3Sig: '',
    overlaySig: '',
    topUsers: ['', '', ''],
    lastSnap: null
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
    tiktokUserInput: $('tiktokUserInput'),
    tiktokConnectBtn: $('tiktokConnectBtn'),
    tiktokDisconnectBtn: $('tiktokDisconnectBtn'),
    tiktokStatusBadge: $('tiktokStatusBadge'),
    tiktokStatusText: $('tiktokStatusText'),
    tiktokDot: $('tiktokDot'),
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

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function multiplier() {
    const now = Date.now();
    if (now < state.eagleUntil) return 3;
    if (now < state.frenzyUntil) return 2;
    return 1;
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
    const W = canvas.width;
    const H = canvas.height;
    const SCALE = W / 1080;
    const COLORS = ['#fbbf24', '#ef4444', '#22d3ee', '#a3e635', '#f472b6', '#ffffff', '#f97316'];
    const emojiCache = new Map();
    let parts = [];
    let raf = null;

    function emojiSprite(emoji) {
      let sprite = emojiCache.get(emoji);
      if (sprite) return sprite;
      const size = 28;
      sprite = document.createElement('canvas');
      sprite.width = size;
      sprite.height = size;
      const sctx = sprite.getContext('2d');
      sctx.font = '18px "Segoe UI Emoji", "Apple Color Emoji", serif';
      sctx.textAlign = 'center';
      sctx.textBaseline = 'middle';
      sctx.fillText(emoji, size / 2, size / 2);
      emojiCache.set(emoji, sprite);
      return sprite;
    }

    function spawn(x, y, opts = {}) {
      const count = opts.count || 20;
      const power = opts.power || 15;
      const colors = opts.colors || COLORS;
      const sprite = opts.emoji ? emojiSprite(opts.emoji) : null;
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
          decay: 0.018 + Math.random() * 0.015,
          size: (4 + Math.random() * 7) * SCALE,
          color: pick(colors),
          rot: Math.random() * Math.PI,
          vr: (Math.random() - 0.5) * 0.35,
          sprite,
          shape: Math.random() < 0.45 ? 'rect' : 'circle'
        });
      }
      if (parts.length > CFG.maxParticles) {
        parts.splice(0, parts.length - CFG.maxParticles);
      }
      if (!raf) raf = requestAnimationFrame(loop);
    }

    function loop() {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, W, H);

      let write = 0;
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        p.vx *= 0.994;
        p.vy *= 0.994;
        p.vy += p.g;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        p.life -= p.decay;
        if (p.life <= 0 || p.y > 1980) continue;

        parts[write++] = p;
        const cos = Math.cos(p.rot);
        const sin = Math.sin(p.rot);
        ctx.globalAlpha = p.life < 1 ? p.life : 1;
        ctx.setTransform(cos, sin, -sin, cos, p.x * SCALE, p.y * SCALE);

        if (p.sprite) {
          ctx.drawImage(p.sprite, -14, -14);
        } else if (p.shape === 'rect') {
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 1.7);
        } else {
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      parts.length = write;

      if (write > 0) {
        raf = requestAnimationFrame(loop);
      } else {
        raf = null;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalAlpha = 1;
        ctx.clearRect(0, 0, W, H);
      }
    }

    function clear() {
      parts.length = 0;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, W, H);
    }

    return { spawn, clear };
  })();

  function stagePoint(node) {
    if (!node) return { x: 540, y: 900 };
    const sr = el.stage.getBoundingClientRect();
    const scale = sr.width / 1080 || 1;
    if (typeof node.getBoundingClientRect !== 'function') {
      if (Number.isFinite(node.clientX) && Number.isFinite(node.clientY)) {
        return {
          x: (node.clientX - sr.left) / scale,
          y: (node.clientY - sr.top) / scale
        };
      }
      return { x: 540, y: 900 };
    }
    const r = node.getBoundingClientRect();
    return {
      x: (r.left - sr.left) / scale + r.width / scale / 2,
      y: (r.top - sr.top) / scale + r.height / scale / 2
    };
  }

  function burstAt(node, count = 16, emoji = '') {
    const pt = stagePoint(node);
    fx.spawn(pt.x, pt.y, { count, emoji, power: emoji ? 17 : 14 });
  }

  function bigConfetti(emoji = '') {
    fx.spawn(540, 720, { count: 28, power: 23, emoji });
    fx.spawn(240, 980, { count: 12, power: 18 });
    fx.spawn(840, 980, { count: 12, power: 18 });
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
     ICONS & RENDERING
     --------------------------------------------------------------- */

  const GIFT_SVGS = {
    theme: `<img class="gift-img" src="/gifts/rose.png" alt="Rose" />`,
    song: `<img class="gift-img" src="/gifts/tiktok.png" alt="TikTok" />`,
    hint: `<img class="gift-img" src="/gifts/rocket.png" alt="Rocket" />`,
    eagle: `<img class="gift-img" src="/gifts/finger-heart.png" alt="Finger Heart" />`
  };

  const UI_SVGS = {
    '💬': `<svg class="ui-ico" aria-hidden="true"><use href="#ico-chat"/></svg>`,
    '❤️': `<svg class="ui-ico" aria-hidden="true"><use href="#ico-heart"/></svg>`,
    '👑': `<svg class="ui-ico" aria-hidden="true"><use href="#ico-crown"/></svg>`,
    '🎁': `<svg class="ui-ico" aria-hidden="true"><use href="#ico-gift"/></svg>`,
    '⚡': `<svg class="ui-ico" aria-hidden="true"><use href="#ico-bolt"/></svg>`,
    '🔥': `<svg class="ui-ico" aria-hidden="true"><use href="#ico-flame"/></svg>`,
    '🏆': `<svg class="ui-ico" aria-hidden="true"><use href="#ico-trophy"/></svg>`,
    '🎉': `<svg class="ui-ico" aria-hidden="true"><use href="#ico-spark"/></svg>`,
    '🌹': GIFT_SVGS.theme,
    '🎵': GIFT_SVGS.song,
    '🚀': GIFT_SVGS.hint,
    '🫰': GIFT_SVGS.eagle
  };

  function renderIcon(node, key) {
    const svg = UI_SVGS[key];
    if (svg) {
      node.innerHTML = svg;
    } else {
      node.textContent = key || '';
    }
  }

  function renderMult() {
    if (phoneMode) return;
    const m = multiplier();
    if (m > 1) {
      const until = m === 3 ? state.eagleUntil : state.frenzyUntil;
      const secs = Math.max(1, Math.ceil((until - Date.now()) / 1000));
      el.multPill.textContent = `${m}X · ${secs}s`;
    } else {
      el.multPill.textContent = '1X';
    }
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
    el.likesGoal.textContent = `${fmt(progress)} / ${fmt(goal)} → ZBULON 1 SHKRONJË`;
  }

  function renderProgress() {
    if (!state.golden) return;
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
      } else if (entry.finder === 'HYPER') {
        captionText = '🎁 HYPER';
      } else if (entry.finder && entry.finder !== 'Hint') {
        captionText = `🎁 @${entry.finder}`;
      } else {
        captionText = '💡 Hint';
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

  function renderGolden() {
    const w = state.golden;
    if (!w) return;
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
    const top = state.players.slice(0, 3);
    el.top3.textContent = '';

    if (!top.length) {
      const empty = makeEl('div', 't3 t3-empty');
      const rank = makeEl('div', 't3-rank');
      rank.innerHTML = `${UI_SVGS['🏆']} TOP 3`;
      empty.append(rank, makeEl('div', 't3-name', 'Bëhu i pari në koment!'));
      el.top3.appendChild(empty);
      state.topUsers = ['', '', ''];
      return;
    }

    const ranks = [`${UI_SVGS['👑']} #1`, '#2', '#3'];

    for (let i = 0; i < 3; i++) {
      const p = top[i];
      const card = makeEl('div', `t3${i === 0 && p ? ' first' : ''}`);
      const rank = makeEl('div', 't3-rank');
      if (i === 0) rank.innerHTML = ranks[0];
      else rank.textContent = ranks[i];
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
    if (!el.quickWords) return;
    el.quickWords.textContent = '';
    const unsolved = state.board.filter((w) => !w.solved).slice(0, 5);
    for (const w of unsolved) {
      const btn = makeEl('button', 'chip', w.raw);
      btn.type = 'button';
      btn.addEventListener('click', () => {
        SFX.unlock();
        sendBridgeEvent({ type: 'comment', user: currentTestUser(), text: w.raw });
      });
      el.quickWords.appendChild(btn);
    }
  }

  function buildStaticUi() {
    el.giftLegend.textContent = '';
    GIFTS.forEach((g) => {
      const chip = makeEl('div', 'gift-chip');
      const text = makeEl('span', 'gift-text');
      text.append(makeEl('b', '', g.name), makeEl('small', '', g.effect));
      const ico = makeEl('span', 'gift-emoji');
      if (GIFT_SVGS[g.id]) ico.innerHTML = GIFT_SVGS[g.id];
      else ico.textContent = g.emoji;
      chip.append(ico, text);
      el.giftLegend.appendChild(chip);
    });

    if (el.giftButtons) {
      el.giftButtons.textContent = '';
      GIFTS.forEach((g) => {
        const btn = makeEl('button', 'btn', `${g.emoji} ${g.name}`);
        btn.type = 'button';
        btn.title = `${g.effect} · +${g.points} PK`;
        btn.addEventListener('click', () => {
          SFX.unlock();
          sendBridgeEvent({ type: 'gift', user: currentTestUser(), giftName: g.id });
        });
        el.giftButtons.appendChild(btn);
      });
    }
  }

  /* ---------------------------------------------------------------
     TRACING + FX PLAYBACK
     --------------------------------------------------------------- */

  function traceChars(chars) {
    if (!Array.isArray(chars)) return;
    clearTimers(state.traceTimers);
    state.letterNodes.forEach((n) => n.el.classList.remove('active'));
    const used = new Set();
    const matched = [];

    for (const ch of chars) {
      const norm = DATA.normalizeAlbanian(ch);
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

  function playServerFx(fxList) {
    if (phoneMode || !Array.isArray(fxList) || !fxList.length) return;
    for (const item of fxList) {
      if (!item || !item.kind) continue;
      switch (item.kind) {
        case 'word_found': {
          const node = item.golden ? el.goldenCard : state.wordEls.get(item.id);
          const pt = stagePoint(node);
          if (item.golden) {
            fx.spawn(pt.x, pt.y, {
              count: 26,
              power: 18,
              colors: ['#fde047', '#fbbf24', '#f59e0b', '#fff7cc', '#ffffff']
            });
          } else {
            fx.spawn(pt.x, pt.y, { count: 16, power: 14 });
          }
          traceChars(item.chars);
          SFX.playWordFound(Boolean(item.golden), false);
          break;
        }
        case 'combo':
          SFX.playCombo(item.level || 2);
          break;
        case 'bonus_word':
          SFX.playBonusWord();
          traceChars(item.chars);
          break;
        case 'like_bump': {
          const count = Number(item.count) || 1;
          if (el.likesTotal) {
            burstAt(el.likesTotal, Math.min(8, Math.max(2, Math.round(Math.min(count, 80) / 10))), '❤️');
            el.likesTotal.classList.remove('like-bump');
            void el.likesTotal.offsetWidth;
            el.likesTotal.classList.add('like-bump');
          }
          if (item.revealed > 0) {
            SFX.playLikeMilestone();
            burstAt(el.ctaBar, 12, '❤️');
            burstAt(el.letterBank, 10);
          }
          break;
        }
        case 'reveal_letters':
          burstAt(el.letterBank, 10);
          break;
        case 'gift':
          SFX.playGiftEffect(item.giftId || 'theme');
          burstAt(el.giftLegend, 10, item.emoji || '🎁');
          break;
        case 'theme':
          flash('flash-pink');
          bigConfetti();
          burstAt(el.giftLegend, 14, '🌹');
          break;
        case 'song': {
          SFX.nextSong();
          if (!SFX.musicEnabled) {
            SFX.startMusic();
            if (el.musicBtn) el.musicBtn.textContent = '⏸️ Muzikë';
          }
          updateNowPlaying();
          break;
        }
        case 'eagle':
          flash('flash-gold');
          shake();
          burstAt(el.goldenCard, 18, '🫰');
          bigConfetti();
          SFX.playNewKing();
          break;
        case 'hyper':
          flash('flash-pink');
          shake();
          bigConfetti();
          burstAt(el.goldenCard, 16, '🎁');
          SFX.playHype();
          break;
        case 'frenzy':
          burstAt(el.ctaBar, 18, '🔥');
          break;
        case 'new_king':
          SFX.playNewKing();
          break;
        case 'shuffle':
          SFX.playShuffle();
          break;
        case 'round_win':
          SFX.playRoundWin();
          bigConfetti();
          break;
        case 'tick':
          SFX.playTick();
          break;
        case 'join':
          SFX.playJoin();
          break;
        default:
          break;
      }
    }
  }

  /* ---------------------------------------------------------------
     APPLY AUTHORITATIVE SNAPSHOT FROM SERVER
     --------------------------------------------------------------- */

  function applySnapshot(snapshot, fxList) {
    if (!snapshot || !Array.isArray(snapshot.board) || !snapshot.golden) return;

    state.lastSnap = snapshot;
    state.seq = Number(snapshot.seq) || state.seq;
    if (Number.isFinite(Number(snapshot.roundIdx))) state.roundIdx = Number(snapshot.roundIdx);
    state.phase = snapshot.phase || 'playing';
    state.animateId = snapshot.animateId || '';
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
    state.frenzyUntil = Number(snapshot.frenzyUntil) || 0;
    state.eagleUntil = Number(snapshot.eagleUntil) || 0;
    state.players = Array.isArray(snapshot.players) ? snapshot.players : [];
    state.live = Boolean(snapshot.live);
    state.eventCount = Number(snapshot.eventCount) || 0;

    if (el.eventCounter) el.eventCounter.textContent = `${state.eventCount} ngjarje`;
    if (state.live && el.bridgeStatus) {
      el.bridgeStatus.classList.add('is-live');
      if (el.bridgeText) el.bridgeText.textContent = 'LIVE · duke marrë evente';
    }

    if (typeof snapshot.simEnabled === 'boolean' || snapshot.simMode) {
      updateSimUi(Boolean(snapshot.simEnabled), snapshot.simMode || 'normal');
    }

    if (snapshot.theme && snapshot.theme !== state.appliedTheme) {
      el.stage.classList.remove(...THEME_IDS);
      el.stage.classList.add(snapshot.theme);
      state.appliedTheme = snapshot.theme;
      state.themeId = snapshot.theme;
    }

    if (snapshot.category) el.category.textContent = snapshot.category;
    renderLikes();
    renderMult();

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
    if (boardSig !== state.boardSig || state.animateId) {
      state.boardSig = boardSig;
      renderBoard();
      state.animateId = '';
    }

    const top3Sig = JSON.stringify(state.players.slice(0, 3).map((p) => [p.user, p.score]));
    if (top3Sig !== state.top3Sig) {
      state.top3Sig = top3Sig;
      renderTop3();
    }

    const cta = snapshot.cta || {};
    el.ctaBar.className = `cta ${cta.kind || 'idle'}`;
    el.ctaIcon.dataset.icon = cta.icon || '';
    renderIcon(el.ctaIcon, cta.icon || '💬');
    el.ctaText.textContent = cta.text || '';
    el.ctaText.title = cta.text || '';

    const overlay = snapshot.overlay || {};
    const overlaySig = JSON.stringify(overlay);
    if (overlaySig !== state.overlaySig) {
      state.overlaySig = overlaySig;
      const show = Boolean(overlay.show);
      el.overlay.classList.toggle('show', show);
      el.overlay.setAttribute('aria-hidden', show ? 'false' : 'true');
      if (show) {
        renderIcon(el.overlayEmoji, overlay.emoji || '🏆');
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

    playServerFx(fxList);
  }

  /* ---------------------------------------------------------------
     BRIDGE / SSE
     --------------------------------------------------------------- */

  function setTransport(ok) {
    if (!el.bridgeStatus) return;
    el.bridgeStatus.classList.toggle('is-live', ok);
    if (!ok) {
      el.bridgeText.textContent = 'Server offline';
      return;
    }
    el.bridgeText.textContent = state.live ? 'LIVE · duke marrë evente' : 'Server OK · në pritje';
  }

  function handleEvent(msg) {
    if (!msg || typeof msg !== 'object') return;

    if (msg.type === 'connected') {
      setTransport(true);
      if (msg.tiktok) updateTikTokUI(msg.tiktok);
      if (msg.snapshot) applySnapshot(msg.snapshot);
      return;
    }

    if (msg.type === 'tiktok_status') {
      updateTikTokUI(msg);
      return;
    }

    if (msg.type === 'state' && msg.snapshot) {
      applySnapshot(msg.snapshot, msg.fx);
      return;
    }

    if (msg.type === 'spectate' && msg.snapshot) {
      applySnapshot(msg.snapshot);
    }
  }

  function connectBridge() {
    if (!('EventSource' in window)) {
      if (el.bridgeText) el.bridgeText.textContent = 'SSE i pambështetur';
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

  function sendBridgeEvent(payload) {
    fetch('/api/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch(() => {});
  }

  function currentTestUser() {
    return (el.testUser && el.testUser.value ? el.testUser.value : 'andi_tirana').trim() || 'andi_tirana';
  }

  function updateSimUi(enabled, mode) {
    state.simEnabled = Boolean(enabled);
    state.simMode = mode || state.simMode || 'normal';
    if (el.simToggle) el.simToggle.checked = state.simEnabled;
    document.querySelectorAll('.sim-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-sim') === state.simMode);
    });
    if (el.simHint) {
      el.simHint.textContent = state.simEnabled
        ? state.live
          ? 'Kujdes: bridge-i live është aktiv, komentet janë test.'
          : 'Aktiv: komente, likes & dhurata test.'
        : 'Fikur — gati për transmetim me lojtarë realë.';
    }
  }

  function updateTikTokUI(status) {
    if (!el.tiktokStatusText || !el.tiktokStatusBadge) return;
    const s = status || {};
    const st = s.status || 'disconnected';
    const user = s.username ? `@${s.username}` : '';

    el.tiktokStatusBadge.classList.remove('is-live', 'is-connecting', 'is-error');

    if (st === 'connected') {
      el.tiktokStatusBadge.classList.add('is-live');
      el.tiktokStatusText.textContent = `LIVE me ${user}${s.roomId ? ` (${s.roomId})` : ''}`;
      if (el.tiktokConnectBtn) el.tiktokConnectBtn.style.display = 'none';
      if (el.tiktokDisconnectBtn) el.tiktokDisconnectBtn.style.display = 'inline-block';
    } else if (st === 'connecting') {
      el.tiktokStatusBadge.classList.add('is-connecting');
      el.tiktokStatusText.textContent = `Duke u lidhur me ${user}…`;
      if (el.tiktokConnectBtn) {
        el.tiktokConnectBtn.style.display = 'inline-block';
        el.tiktokConnectBtn.disabled = true;
      }
      if (el.tiktokDisconnectBtn) el.tiktokDisconnectBtn.style.display = 'none';
    } else if (st === 'error') {
      el.tiktokStatusBadge.classList.add('is-error');
      el.tiktokStatusText.textContent = `Gabim: ${s.error || 'Dështoi lidhja'}`;
      if (el.tiktokConnectBtn) {
        el.tiktokConnectBtn.style.display = 'inline-block';
        el.tiktokConnectBtn.disabled = false;
        el.tiktokConnectBtn.textContent = 'Lidhu';
      }
      if (el.tiktokDisconnectBtn) el.tiktokDisconnectBtn.style.display = 'none';
    } else {
      el.tiktokStatusText.textContent = 'I shkëputur';
      if (el.tiktokConnectBtn) {
        el.tiktokConnectBtn.style.display = 'inline-block';
        el.tiktokConnectBtn.disabled = false;
        el.tiktokConnectBtn.textContent = 'Lidhu';
      }
      if (el.tiktokDisconnectBtn) el.tiktokDisconnectBtn.style.display = 'none';
    }

    if (s.username && el.tiktokUserInput && !el.tiktokUserInput.value) {
      el.tiktokUserInput.value = s.username;
    }
  }

  /* ---------------------------------------------------------------
     HOST CONTROLS
     --------------------------------------------------------------- */

  function wireControls() {
    if (el.tiktokConnectBtn) {
      el.tiktokConnectBtn.addEventListener('click', async () => {
        const raw = el.tiktokUserInput ? el.tiktokUserInput.value.trim() : '';
        const username = raw.replace(/^@+/, '').trim();
        if (!username) {
          alert('Ju lutem vendosni emrin e përdoruesit të TikTok.');
          return;
        }
        try {
          localStorage.setItem('fjalemania.tiktokUser', username);
        } catch {
          /* ignore storage errors */
        }
        updateTikTokUI({ status: 'connecting', username });
        try {
          const res = await fetch('/api/tiktok/connect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, autoRetry: true })
          });
          const data = await res.json();
          if (!data.ok) {
            updateTikTokUI({ status: 'error', username, error: data.error });
            alert('Lidhja me TikTok dështoi: ' + (data.error || 'Sigurohuni që llogaria është LIVE.'));
          } else {
            updateTikTokUI(data);
          }
        } catch (err) {
          updateTikTokUI({ status: 'error', username, error: err.message });
        }
      });
    }

    if (el.tiktokDisconnectBtn) {
      el.tiktokDisconnectBtn.addEventListener('click', async () => {
        try {
          const res = await fetch('/api/tiktok/disconnect', { method: 'POST' });
          const data = await res.json();
          updateTikTokUI(data);
        } catch {
          updateTikTokUI({ status: 'disconnected' });
        }
      });
    }

    if (el.tiktokUserInput) {
      el.tiktokUserInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && el.tiktokConnectBtn) el.tiktokConnectBtn.click();
      });
    }

    if (el.sendCommentBtn) {
      el.sendCommentBtn.addEventListener('click', () => {
        SFX.unlock();
        const text = el.testComment.value.trim();
        if (!text) return;
        sendBridgeEvent({ type: 'comment', user: currentTestUser(), text });
        el.testComment.value = '';
        el.testComment.focus();
      });
    }

    if (el.testComment) {
      el.testComment.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && el.sendCommentBtn) el.sendCommentBtn.click();
      });
    }

    document.querySelectorAll('.sim-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-sim') || 'normal';
        sendBridgeEvent({ type: 'command', action: mode === 'viral' ? 'simViral' : 'simNormal' });
      });
    });

    if (el.simToggle) {
      el.simToggle.addEventListener('change', () => {
        sendBridgeEvent({ type: 'command', action: el.simToggle.checked ? 'simOn' : 'simOff' });
      });
    }
    if (el.like500Btn) {
      el.like500Btn.addEventListener('click', () => {
        SFX.unlock();
        sendBridgeEvent({ type: 'like', count: 500 });
      });
    }
    if (el.hintBtn) {
      el.hintBtn.addEventListener('click', () => {
        SFX.unlock();
        sendBridgeEvent({ type: 'command', action: 'hint' });
      });
    }
    if (el.revealBtn) {
      el.revealBtn.addEventListener('click', () => {
        SFX.unlock();
        sendBridgeEvent({ type: 'command', action: 'reveal' });
      });
    }
    if (el.frenzyBtn) {
      el.frenzyBtn.addEventListener('click', () => {
        SFX.unlock();
        sendBridgeEvent({ type: 'command', action: 'frenzy' });
      });
    }
    if (el.nextRoundBtn) {
      el.nextRoundBtn.addEventListener('click', () => {
        SFX.unlock();
        sendBridgeEvent({ type: 'command', action: 'nextRound' });
      });
    }

    if (el.musicBtn) {
      el.musicBtn.addEventListener('click', () => {
        SFX.unlock();
        const on = SFX.toggleMusic();
        el.musicBtn.textContent = on ? '⏸️ Muzikë' : '🔊 Muzikë';
        updateNowPlaying();
      });
    }

    try {
      const stored = localStorage.getItem('fjalemania.volume');
      let savedVolume = stored === null ? 55 : Number(stored);
      if (!Number.isFinite(savedVolume)) savedVolume = 55;
      if (el.musicVolume) el.musicVolume.value = String(savedVolume);
      SFX.setMusicVolume(savedVolume / 100);
    } catch {
      SFX.setMusicVolume(0.55);
    }

    if (el.musicVolume) {
      el.musicVolume.addEventListener('input', () => {
        const value = Number(el.musicVolume.value);
        SFX.setMusicVolume(value / 100);
        try {
          localStorage.setItem('fjalemania.volume', String(value));
        } catch {
          /* ignore storage errors */
        }
      });
    }

    if (el.obsToggleBtn) {
      el.obsToggleBtn.addEventListener('click', () => {
        document.body.classList.toggle('obs-mode');
        document.body.classList.remove('obs-hover');
        fitStage();
      });
    }
    if (el.obsExitBtn) {
      el.obsExitBtn.addEventListener('click', () => {
        document.body.classList.remove('obs-mode', 'obs-hover');
        fitStage();
      });
    }
    if (el.safeToggle) {
      el.safeToggle.addEventListener('click', () => {
        document.body.classList.toggle('show-safe');
        el.safeToggle.classList.toggle('is-on', document.body.classList.contains('show-safe'));
      });
    }
    if (el.resetBtn) {
      el.resetBtn.addEventListener('click', () => {
        if (window.confirm('Të resetohet loja? Pikët dhe likes do të fshihen.')) {
          sendBridgeEvent({ type: 'command', action: 'reset' });
        }
      });
    }

    if (el.copyHookBtn) {
      el.copyHookBtn.addEventListener('click', () => {
        copyText(`${location.origin}/api/event`, el.copyHookBtn, 'Kopjo');
      });
    }
    if (el.copyObsBtn) {
      el.copyObsBtn.addEventListener('click', () => {
        copyText(`${location.origin}/?obs=1`, el.copyObsBtn, 'Kopjo URL');
      });
    }
    if (el.copyPhoneBtn) {
      el.copyPhoneBtn.addEventListener('click', () => {
        const url = el.copyPhoneBtn.dataset.url;
        if (url) copyText(url, el.copyPhoneBtn, 'Kopjo');
      });
    }
    if (el.phoneMusicBtn) {
      el.phoneMusicBtn.addEventListener('click', () => {
        SFX.unlock();
        const on = SFX.toggleMusic();
        el.phoneMusicBtn.textContent = on ? '⏸️' : '🔊';
        el.phoneMusicBtn.title = on ? 'Ndal muzikën' : 'Muzikë';
      });
    }

    if (el.phoneFullscreenBtn) {
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
    }

    window.addEventListener('keydown', (e) => {
      const tag = (e.target && e.target.tagName ? e.target.tagName : '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || e.metaKey || e.ctrlKey || e.altKey) return;
      const key = String(e.key || '').toLowerCase();

      if (e.code === 'Space') {
        e.preventDefault();
        sendBridgeEvent({ type: 'command', action: 'nextRound' });
      } else if (key === 'h') {
        SFX.unlock();
        sendBridgeEvent({ type: 'command', action: 'hint' });
      } else if (key === 'l') {
        sendBridgeEvent({ type: 'like', count: 500 });
      } else if (key === 'm') {
        SFX.unlock();
        const on = SFX.toggleMusic();
        if (el.musicBtn) el.musicBtn.textContent = on ? '⏸️ Muzikë' : '🔊 Muzikë';
        updateNowPlaying();
      } else if (key === 'e') {
        sendBridgeEvent({ type: 'gift', user: currentTestUser(), giftName: 'finger heart' });
      } else if (key === 'o') {
        document.body.classList.toggle('obs-mode');
        fitStage();
      }
    });

    const likesBlock = document.querySelector('.likes');
    if (likesBlock) {
      likesBlock.style.cursor = 'pointer';
      likesBlock.title = 'Kliko për të shtuar likes ❤️';
      likesBlock.addEventListener('click', () => {
        SFX.unlock();
        sendBridgeEvent({ type: 'like', count: 15 });
      });
    }

    if (el.stage) {
      el.stage.addEventListener('dblclick', (e) => {
        const pt = stagePoint(e);
        fx.spawn(pt.x, pt.y, { count: 5, emoji: '❤️', power: 14 });
        sendBridgeEvent({ type: 'like', count: 25 });
      });
    }

    if (phoneMode && el.stage) {
      el.stage.addEventListener('pointerdown', (e) => {
        const pt = stagePoint(e);
        fx.spawn(pt.x, pt.y, { count: 4, emoji: '❤️', power: 12 });
        sendBridgeEvent({ type: 'like', count: 10 });
      });
    }

    window.addEventListener('pointerdown', () => SFX.unlock(), { once: true });

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
    if (Number.isFinite(season) && season >= 2) {
      sendBridgeEvent({ type: 'command', action: 'setSeason', value: Math.floor(season) });
    }
    wantsMusic = params.get('music') === '1';
    phoneMode = params.get('phone') === '1';
    obsPage = params.get('obs') === '1' || params.get('obs') === 'true';
    urlTikTokUser = (params.get('user') || '').replace(/^@+/, '').trim();
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
      if (el.musicBtn) el.musicBtn.textContent = '⏸️ Muzikë';
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

  function showSpectatorWaiting() {
    el.overlayEmoji.textContent = '📱';
    el.overlayTitle.textContent = 'DUKE U LIDHUR…';
    el.overlayList.textContent = '';
    el.overlayNext.textContent = 'Pamja e lojës po vjen…';
    el.overlay.classList.add('show');
    el.overlay.setAttribute('aria-hidden', 'false');
  }

  function boot() {
    buildStaticUi();
    applyUrlFlags();
    wireControls();
    SFX.onTrackChange = updateNowPlaying;

    if (phoneMode) {
      showSpectatorWaiting();
    }

    fetch('/api/spectate', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (data && data.snapshot) applySnapshot(data.snapshot);
      })
      .catch(() => {})
      .finally(() => {
        connectBridge();
      });

    try {
      const savedUser = localStorage.getItem('fjalemania.tiktokUser') || 'game.studio.al';
      if (savedUser && el.tiktokUserInput && !el.tiktokUserInput.value) {
        el.tiktokUserInput.value = savedUser;
      }
    } catch {
      /* ignore storage errors */
    }

    fetch('/api/tiktok/status')
      .then((r) => r.json())
      .then((status) => {
        updateTikTokUI(status);
        if (
          urlTikTokUser &&
          !phoneMode &&
          !(status && status.username === urlTikTokUser && (status.status === 'connected' || status.status === 'connecting'))
        ) {
          fetch('/api/tiktok/connect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: urlTikTokUser, autoRetry: true })
          })
            .then((r) => r.json())
            .then(updateTikTokUI)
            .catch(() => {});
        }
      })
      .catch(() => {});

    fitStage();
    loadMusicLibrary();
    loadNetworkInfo();

    window.FJALEMANIA = {
      snapshot: () => ({
        round: state.roundIdx + 1,
        topic: (DATA.ROUNDS[state.roundIdx] && DATA.ROUNDS[state.roundIdx].category) || '',
        seasonRound: state.lastSnap ? state.lastSnap.seasonRound : 0,
        seasonRounds: state.lastSnap ? state.lastSnap.seasonRounds : 90,
        phase: state.phase,
        live: state.live,
        likes: state.likesTotal,
        hype: state.hype,
        golden: state.golden ? { word: state.golden.raw, solved: state.golden.solved } : null,
        board: state.board.map((w) => ({ word: w.raw, solved: w.solved, points: w.points }))
      }),
      comment: (user, text) => sendBridgeEvent({ type: 'comment', user, text }),
      like: (n) => sendBridgeEvent({ type: 'like', count: n || 1 }),
      gift: (user, type, repeat) => sendBridgeEvent({ type: 'gift', user, giftType: type, count: repeat || 1 }),
      nextRound: () => sendBridgeEvent({ type: 'command', action: 'nextRound' }),
      setSeason: (n) => sendBridgeEvent({ type: 'command', action: 'setSeason', value: n }),
      revealWord: () => sendBridgeEvent({ type: 'command', action: 'reveal' }),
      revealLetters: () => sendBridgeEvent({ type: 'command', action: 'hint' }),
      reset: () => sendBridgeEvent({ type: 'command', action: 'reset' })
    };

    if ('ResizeObserver' in window) {
      new ResizeObserver(fitStage).observe(el.stageWrap);
    }
    window.addEventListener('resize', fitStage);

    setInterval(() => {
      renderMult();
    }, 500);

    updateSimUi(false, 'normal');
  }

  boot();
})();
