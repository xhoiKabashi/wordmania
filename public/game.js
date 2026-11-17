(function () {
  const DATA = window.ALBANIAN_DATA;
  const SFX = window.SoundEngine;

  const LIKE_CYCLE = 5000;
  const TIER_1 = 1000;
  const TIER_2 = 2500;
  const TIER_3 = 5000;
  const MAX_BOARD_WORDS = 7;

  const state = {
    roundIdx: 0,
    roundTimeLeft: 120,
    wheelLetters: [],
    boardWords: [], // max 7 visible words on board
    extraRoundWords: new Set(), // overflow board words moved to bonus pool
    foundBonus: new Set(),
    players: new Map(),
    currentKing: null,
    likesTotal: 0,
    likesCycleProgress: 0,
    tier1Done: false,
    tier2Done: false,
    frenzyUntil: 0,
    eagleUntil: 0,
    vipSponsor: '',
    themeIdx: 0,
    songIdx: 0,
    simMode: 'normal', // 'manual' | 'normal' | 'viral'
    viewers: 185,
    roundTransitioning: false
  };

  const el = {
    phoneStage: document.getElementById('phoneStage'),
    headerCategory: document.getElementById('headerCategory'),
    viewerCount: document.getElementById('viewerCount'),
    roundTimer: document.getElementById('roundTimer'),
    multiplierBadge: document.getElementById('multiplierBadge'),
    likesCountText: document.getElementById('likesCountText'),
    likesGoalText: document.getElementById('likesGoalText'),
    likesFill: document.getElementById('likesFill'),
    announceBar: document.getElementById('announceBar'),
    announceText: document.getElementById('announceText'),
    wordsGrid: document.getElementById('wordsGrid'),
    wheelRing: document.getElementById('wheelRing'),
    shuffleBtn: document.getElementById('shuffleBtn'),
    top5Strip: document.getElementById('top5Strip'),
    vipBadgeText: document.getElementById('vipBadgeText'),
    songTag: document.getElementById('songTag'),
    eagleOverlay: document.getElementById('eagleOverlay'),
    eagleDonorText: document.getElementById('eagleDonorText'),
    obsToggleBtn: document.getElementById('obsToggleBtn'),
    obsExitBtn: document.getElementById('obsExitBtn'),
    testUserInput: document.getElementById('testUserInput'),
    testCommentInput: document.getElementById('testCommentInput'),
    sendCommentBtn: document.getElementById('sendCommentBtn'),
    quickWordButtons: document.getElementById('quickWordButtons'),
    like500Btn: document.getElementById('like500Btn'),
    toggleMusicBtn: document.getElementById('toggleMusicBtn'),
    hintWordBtn: document.getElementById('hintWordBtn'),
    nextRoundBtn: document.getElementById('nextRoundBtn'),
    sseBadge: document.getElementById('sseBadge')
  };

  function formatNumber(n) {
    return Number(n).toLocaleString('en-US');
  }

  function formatTime(sec) {
    const s = Math.max(0, Math.floor(sec));
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  }

  function getTeamById(id) {
    return DATA.TEAMS.find((t) => t.id === id) || DATA.TEAMS[0];
  }

  function getOrCreatePlayer(username, preferredTeam) {
    const cleanName = String(username || 'Anonim').replace(/^@+/, '').trim() || 'Anonim';
    let p = state.players.get(cleanName);
    if (!p) {
      const fallbackTeam = DATA.TEAMS[cleanName.length % DATA.TEAMS.length].id;
      p = {
        user: cleanName,
        score: 0,
        wordsFound: 0,
        team: preferredTeam || fallbackTeam
      };
      state.players.set(cleanName, p);
    } else if (preferredTeam) {
      p.team = preferredTeam;
    }
    return p;
  }

  function getMultiplier() {
    const now = Date.now();
    if (now < state.eagleUntil) return 3;
    if (now < state.frenzyUntil) return 2;
    return 1;
  }

  function setAnnouncement(message, kind = '') {
    el.announceText.textContent = message;
    el.announceBar.className = `zone-announce${kind ? ` ${kind}` : ''}`;
  }

  function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  function loadRound(index) {
    state.roundIdx = ((index % DATA.ROUNDS.length) + DATA.ROUNDS.length) % DATA.ROUNDS.length;
    const round = DATA.ROUNDS[state.roundIdx];
    state.roundTimeLeft = 120;
    state.roundTransitioning = false;
    state.foundBonus = new Set();
    state.extraRoundWords = new Set();
    state.wheelLetters = [...round.letters];
    shuffleArray(state.wheelLetters);

    // Select 7 balanced words ensuring Golden word is included
    const selected = [];
    for (const w of round.words) {
      if (selected.length < MAX_BOARD_WORDS - 1 && w !== round.golden) {
        selected.push(w);
      }
    }
    if (!selected.includes(round.golden)) {
      selected.push(round.golden);
    }
    for (const w of round.words) {
      if (!selected.includes(w)) {
        state.extraRoundWords.add(DATA.normalizeAlbanian(w));
      }
    }

    state.boardWords = selected.map((w) => ({
      raw: w,
      norm: DATA.normalizeAlbanian(w),
      solved: false,
      finder: null,
      points: 0,
      isGolden: w === round.golden,
      revealedIndices: new Set()
    }));

    setAnnouncement(`Raundi ${state.roundIdx + 1}: ${round.category} — Shkruaj fjalët në koment!`);
    renderAll();
    renderQuickWordButtons();
  }

  function renderWheel() {
    el.wheelRing.querySelectorAll('.wheel-letter').forEach((n) => n.remove());
    const total = state.wheelLetters.length;
    const radius = 64;
    const center = 86;

    state.wheelLetters.forEach((ch, idx) => {
      const angle = (idx / total) * Math.PI * 2 - Math.PI / 2;
      const x = center + radius * Math.cos(angle) - 19;
      const y = center + radius * Math.sin(angle) - 19;
      const node = document.createElement('div');
      node.className = 'wheel-letter';
      node.textContent = ch;
      node.style.left = `${x}px`;
      node.style.top = `${y}px`;
      el.wheelRing.appendChild(node);
    });
  }

  function renderBoard() {
    el.wordsGrid.innerHTML = '';
    state.boardWords.forEach((w) => {
      const chars = Array.from(w.raw);
      const slot = document.createElement('div');
      slot.className = 'word-slot';
      if (w.isGolden) slot.classList.add('is-golden');
      if (chars.length >= 6 || w.isGolden) slot.classList.add('full-row');
      if (chars.length >= 8) slot.classList.add('compact-tiles');

      const tilesWrap = document.createElement('div');
      tilesWrap.className = 'word-tiles';

      chars.forEach((ch, idx) => {
        const tile = document.createElement('div');
        tile.className = 'tile';
        if (w.solved) {
          tile.classList.add('solved');
          tile.textContent = ch;
        } else if (w.revealedIndices.has(idx)) {
          tile.classList.add('hinted');
          tile.textContent = ch;
        } else {
          tile.textContent = '•';
        }
        tilesWrap.appendChild(tile);
      });

      const caption = document.createElement('div');
      caption.className = 'word-caption';
      if (w.solved) {
        caption.classList.add('solved-by');
        caption.textContent = `@${w.finder} +${w.points}`;
      } else if (w.isGolden) {
        caption.classList.add('golden-tag');
        caption.textContent = `👑 Fjala e Artë (3X) • ${chars.length} shkronja`;
      } else {
        caption.textContent = `${chars.length} shkronja`;
      }

      slot.appendChild(tilesWrap);
      slot.appendChild(caption);
      el.wordsGrid.appendChild(slot);
    });
  }

  function renderTop5() {
    const sorted = Array.from(state.players.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    el.top5Strip.innerHTML = '';
    for (let i = 0; i < 5; i++) {
      const p = sorted[i];
      const pill = document.createElement('div');
      pill.className = `top5-pill${i === 0 ? ' first' : ''}`;
      if (p) {
        const team = getTeamById(p.team);
        pill.innerHTML = `
          <div class="t5-rank">${i === 0 ? '👑 #1' : `#${i + 1}`} ${team.flag}</div>
          <div class="t5-name">@${escapeHtml(p.user)}</div>
          <div class="t5-score">${formatNumber(p.score)}</div>
        `;
      } else {
        pill.innerHTML = `
          <div class="t5-rank">#${i + 1}</div>
          <div class="t5-name">---</div>
          <div class="t5-score">0</div>
        `;
      }
      el.top5Strip.appendChild(pill);
    }
  }

  function renderHeaderAndLikes() {
    const round = DATA.ROUNDS[state.roundIdx];
    el.headerCategory.textContent = `R${state.roundIdx + 1} • ${round.category}`;
    el.viewerCount.textContent = formatNumber(state.viewers);
    el.roundTimer.textContent = formatTime(state.roundTimeLeft);

    const mult = getMultiplier();
    if (mult === 3) {
      el.multiplierBadge.textContent = '3X 🦅';
      el.multiplierBadge.classList.add('boosted');
      document.body.classList.add('eagle-active');
      document.body.classList.remove('frenzy-active');
    } else if (mult === 2) {
      el.multiplierBadge.textContent = '2X 🔥';
      el.multiplierBadge.classList.add('boosted');
      document.body.classList.add('frenzy-active');
      document.body.classList.remove('eagle-active');
    } else {
      el.multiplierBadge.textContent = '1X';
      el.multiplierBadge.classList.remove('boosted');
      document.body.classList.remove('frenzy-active', 'eagle-active');
    }

    el.likesCountText.textContent = formatNumber(state.likesTotal);
    const pct = Math.min(100, Math.round((state.likesCycleProgress / LIKE_CYCLE) * 100));
    el.likesFill.style.width = `${pct}%`;

    if (!state.tier1Done) {
      el.likesGoalText.textContent = `Caku: ${formatNumber(TIER_1)} → Zbulo Shkronja 🔍`;
    } else if (!state.tier2Done) {
      el.likesGoalText.textContent = `Caku: ${formatNumber(TIER_2)} → Zbulo Fjalë 💡`;
    } else {
      el.likesGoalText.textContent = `Caku: ${formatNumber(TIER_3)} → 2X Zjarr 🔥`;
    }

    const song = DATA.SONGS[state.songIdx];
    if (state.vipSponsor) {
      el.vipBadgeText.textContent = `👑 VIP: @${state.vipSponsor}`;
    } else {
      el.vipBadgeText.innerHTML = `🎵 <span id="songTag">${escapeHtml(song.name)}</span>`;
    }
  }

  function renderQuickWordButtons() {
    el.quickWordButtons.innerHTML = '';
    const unsolved = state.boardWords.filter((w) => !w.solved).slice(0, 5);
    unsolved.forEach((w) => {
      const btn = document.createElement('button');
      btn.className = 'btn chip-btn';
      btn.textContent = w.raw;
      btn.addEventListener('click', () => {
        const user = el.testUserInput.value.trim() || 'andi_tirana';
        handleComment(user, w.raw);
      });
      el.quickWordButtons.appendChild(btn);
    });
  }

  function renderAll() {
    renderWheel();
    renderBoard();
    renderTop5();
    renderHeaderAndLikes();
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function awardPoints(player, pts) {
    const prevTop = Array.from(state.players.values()).sort((a, b) => b.score - a.score)[0];
    player.score += pts;
    player.wordsFound += 1;

    const newTop = Array.from(state.players.values()).sort((a, b) => b.score - a.score)[0];
    if (newTop && newTop.user !== state.currentKing && newTop.score > 0) {
      const hadKing = Boolean(state.currentKing);
      state.currentKing = newTop.user;
      if (hadKing && prevTop && prevTop.user !== newTop.user) {
        SFX.playNewKing();
        setAnnouncement(`👑 MBRET I RI: @${newTop.user} mori vendin #1 (${formatNumber(newTop.score)} PK)!`, 'king');
      }
    }
  }

  function revealRandomLetters(count = 2) {
    const candidates = state.boardWords.filter((w) => !w.solved);
    shuffleArray(candidates);
    let revealed = 0;
    for (const w of candidates) {
      const len = Array.from(w.raw).length;
      const hidden = [];
      for (let i = 0; i < len; i++) {
        if (!w.revealedIndices.has(i)) hidden.push(i);
      }
      if (hidden.length > 0) {
        w.revealedIndices.add(hidden[Math.floor(Math.random() * hidden.length)]);
        revealed += 1;
        if (revealed >= count) break;
      }
    }
    renderBoard();
    return revealed;
  }

  function revealOneFullWord(finderName = 'Hint') {
    const unsolved = state.boardWords.filter((w) => !w.solved);
    if (!unsolved.length) return null;
    const target = unsolved[0];
    target.solved = true;
    target.finder = finderName;
    target.points = 0;
    renderBoard();
    renderQuickWordButtons();
    checkRoundCompleted();
    return target.raw;
  }

  function checkRoundCompleted() {
    if (state.roundTransitioning) return;
    const remaining = state.boardWords.some((w) => !w.solved);
    if (!remaining) {
      state.roundTransitioning = true;
      SFX.playRoundWin();
      setAnnouncement('🏆 Tabela u kompletua! Po hapet raundi tjetër...', 'king');
      setTimeout(() => loadRound(state.roundIdx + 1), 2400);
    }
  }

  function handleComment(rawUser, rawText, forcedTeam) {
    const user = String(rawUser || 'Anonim').replace(/^@+/, '').trim() || 'Anonim';
    const text = String(rawText || '').trim();
    if (!text) return;

    const lower = text.toLowerCase();
    const matchedTeam = DATA.TEAMS.find((t) => lower.includes(t.tag));
    const player = getOrCreatePlayer(user, matchedTeam ? matchedTeam.id : forcedTeam);

    if (matchedTeam && lower.trim() === matchedTeam.tag) {
      setAnnouncement(`${matchedTeam.flag} @${player.user} u bashkua me ekipin ${matchedTeam.label}!`);
      renderTop5();
      return;
    }

    const normGuess = DATA.normalizeAlbanian(text);
    if (!normGuess) return;

    // 1. Main Board Match
    const boardMatch = state.boardWords.find((w) => !w.solved && w.norm === normGuess);
    if (boardMatch) {
      const basePts = Array.from(boardMatch.raw).length * 20;
      const mult = getMultiplier() * (boardMatch.isGolden ? 3 : 1);
      const totalPts = basePts * mult;

      boardMatch.solved = true;
      boardMatch.finder = player.user;
      boardMatch.points = totalPts;

      awardPoints(player, totalPts);
      SFX.playWordFound(boardMatch.isGolden, false);

      if (boardMatch.isGolden) {
        setAnnouncement(`👑 @${player.user} gjeti FJALËN E ARTË "${boardMatch.raw}" (+${totalPts} PK)!`, 'king');
      } else {
        setAnnouncement(`🎉 @${player.user} gjeti "${boardMatch.raw}" (+${totalPts} PK)`);
      }

      renderBoard();
      renderTop5();
      renderQuickWordButtons();
      checkRoundCompleted();
      return;
    }

    // 2. Bonus or Overflow Word Match
    const round = DATA.ROUNDS[state.roundIdx];
    const isBonus = round.bonus.some((b) => DATA.normalizeAlbanian(b) === normGuess) || state.extraRoundWords.has(normGuess);
    if (isBonus && !state.foundBonus.has(normGuess)) {
      state.foundBonus.add(normGuess);
      const bonusPts = 25 * getMultiplier();
      awardPoints(player, bonusPts);
      SFX.playBonusWord();
      setAnnouncement(`🌟 Fjalë Bonus "${normGuess}" nga @${player.user} (+${bonusPts} PK)`);
      renderTop5();
    }
  }

  function handleLikes(count = 1) {
    const n = Math.max(1, Number(count) || 1);
    state.likesTotal += n;
    state.likesCycleProgress += n;

    if (!state.tier1Done && state.likesCycleProgress >= TIER_1) {
      state.tier1Done = true;
      revealRandomLetters(2);
      SFX.playLikeMilestone();
      setAnnouncement('❤️ 1,000 Likes! U zbuluan 2 shkronja falas 🔍', 'milestone');
    }

    if (!state.tier2Done && state.likesCycleProgress >= TIER_2) {
      state.tier2Done = true;
      const word = revealOneFullWord('Likes_Hint');
      SFX.playLikeMilestone();
      setAnnouncement(`❤️ 2,500 Likes! U hap fjala "${word || 'Hint'}" 💡`, 'milestone');
    }

    if (state.likesCycleProgress >= TIER_3) {
      state.likesCycleProgress -= LIKE_CYCLE;
      state.tier1Done = false;
      state.tier2Done = false;
      state.frenzyUntil = Date.now() + 45000;
      SFX.playLikeMilestone();
      setAnnouncement('🔥 5,000 Likes! KOHA E ZJARRIT 2X për 45 sekonda!', 'king');
    }

    renderHeaderAndLikes();
  }

  function handleGift(rawUser, giftType) {
    const user = String(rawUser || 'VIP_Shqiptar').replace(/^@+/, '').trim() || 'VIP_Shqiptar';
    const player = getOrCreatePlayer(user);

    if (giftType === 'theme') {
      el.phoneStage.classList.remove(DATA.THEMES[state.themeIdx].id);
      state.themeIdx = (state.themeIdx + 1) % DATA.THEMES.length;
      const theme = DATA.THEMES[state.themeIdx];
      el.phoneStage.classList.add(theme.id);
      awardPoints(player, 30);
      SFX.playGiftEffect('theme');
      setAnnouncement(`🌹 @${player.user} ndryshoi sfondin → ${theme.name}`, 'gift');
    } else if (giftType === 'song') {
      state.songIdx = (state.songIdx + 1) % DATA.SONGS.length;
      const song = SFX.setSong(state.songIdx);
      if (!SFX.musicEnabled) {
        SFX.startMusic();
        el.toggleMusicBtn.textContent = '⏸️ Ndal Muzikën';
      }
      awardPoints(player, 50);
      SFX.playGiftEffect('song');
      setAnnouncement(`🎵 DJ @${player.user} vendosi → ${song.name}`, 'gift');
    } else if (giftType === 'hint') {
      revealRandomLetters(2);
      awardPoints(player, 60);
      SFX.playGiftEffect('hint');
      setAnnouncement(`⚡ @${player.user} dërgoi Rrufe → +2 shkronja Hint!`, 'milestone');
    } else if (giftType === 'eagle') {
      state.eagleUntil = Date.now() + 30000;
      state.vipSponsor = player.user;
      awardPoints(player, 200);
      const word = revealOneFullWord(player.user);
      SFX.playGiftEffect('eagle');
      setAnnouncement(`🦅 @${player.user} aktivizoi 3X VIP!`, 'king');
      el.eagleDonorText.textContent = `@${player.user} aktivizoi 3X PIKË${word ? ` & hapi "${word}"` : ''}!`;
      el.eagleOverlay.classList.add('show');
      setTimeout(() => el.eagleOverlay.classList.remove('show'), 2400);
    }

    renderTop5();
    renderHeaderAndLikes();
  }

  // Calm, readable simulator loop
  function simulatorTick() {
    if (state.simMode === 'manual') return;

    const isViral = state.simMode === 'viral';
    const base = isViral ? 1042 : 185;
    state.viewers = base + Math.floor(Math.random() * (isViral ? 35 : 14)) - (isViral ? 12 : 6);

    const round = DATA.ROUNDS[state.roundIdx];
    const viewer = DATA.VIEWERS_POOL[Math.floor(Math.random() * DATA.VIEWERS_POOL.length)];
    const roll = Math.random();

    if (roll < (isViral ? 0.45 : 0.3)) {
      const unsolved = state.boardWords.filter((w) => !w.solved);
      if (unsolved.length) {
        const w = unsolved[Math.floor(Math.random() * unsolved.length)];
        const typed = Math.random() < 0.7 ? DATA.normalizeAlbanian(w.raw).toLowerCase() : w.raw.toLowerCase();
        handleComment(viewer.user, typed, viewer.team);
      }
    } else if (roll < (isViral ? 0.72 : 0.5)) {
      const b = round.bonus[Math.floor(Math.random() * round.bonus.length)];
      handleComment(viewer.user, b.toLowerCase(), viewer.team);
    }

    handleLikes(isViral ? Math.floor(Math.random() * 160) + 80 : Math.floor(Math.random() * 45) + 15);

    if (Math.random() < (isViral ? 0.16 : 0.06)) {
      const gifts = ['theme', 'song', 'hint', 'eagle'];
      const g = gifts[Math.floor(Math.random() * gifts.length)];
      handleGift(viewer.user, g === 'eagle' && Math.random() > 0.35 ? 'theme' : g);
    }

    renderHeaderAndLikes();
  }

  setInterval(() => {
    state.roundTimeLeft -= 1;
    if (state.roundTimeLeft <= 5 && state.roundTimeLeft > 0) {
      SFX.playTick();
    }
    if (state.roundTimeLeft <= 0 && !state.roundTransitioning) {
      state.roundTransitioning = true;
      setAnnouncement('⏱️ Koha mbaroi! Raundi tjetër...', 'milestone');
      setTimeout(() => loadRound(state.roundIdx + 1), 1800);
    }
    renderHeaderAndLikes();
  }, 1000);

  setInterval(simulatorTick, 2200);

  // Wire Controls
  el.shuffleBtn.addEventListener('click', () => {
    SFX.unlock();
    shuffleArray(state.wheelLetters);
    renderWheel();
  });

  el.sendCommentBtn.addEventListener('click', () => {
    SFX.unlock();
    const user = el.testUserInput.value.trim() || 'andi_tirana';
    const text = el.testCommentInput.value.trim();
    if (text) {
      handleComment(user, text);
      el.testCommentInput.value = '';
    }
  });

  el.testCommentInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') el.sendCommentBtn.click();
  });

  document.querySelectorAll('.sim-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      SFX.unlock();
      document.querySelectorAll('.sim-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      state.simMode = btn.getAttribute('data-sim');
      state.viewers = state.simMode === 'manual' ? 1 : state.simMode === 'normal' ? 185 : 1042;
      renderHeaderAndLikes();
    });
  });

  el.like500Btn.addEventListener('click', () => {
    SFX.unlock();
    handleLikes(500);
  });

  document.querySelectorAll('[data-gift]').forEach((btn) => {
    btn.addEventListener('click', () => {
      SFX.unlock();
      const giftType = btn.getAttribute('data-gift');
      const user = el.testUserInput.value.trim() || 'drilon_ch';
      handleGift(user, giftType);
    });
  });

  el.toggleMusicBtn.addEventListener('click', () => {
    SFX.unlock();
    const playing = SFX.toggleMusic();
    el.toggleMusicBtn.textContent = playing ? '⏸️ Ndal Muzikën' : '🔊 Muzikë';
    renderHeaderAndLikes();
  });

  el.hintWordBtn.addEventListener('click', () => {
    SFX.unlock();
    revealOneFullWord('Host');
    SFX.playGiftEffect('hint');
  });

  el.nextRoundBtn.addEventListener('click', () => {
    SFX.unlock();
    loadRound(state.roundIdx + 1);
  });

  el.obsToggleBtn.addEventListener('click', () => document.body.classList.add('obs-mode'));
  el.obsExitBtn.addEventListener('click', () => document.body.classList.remove('obs-mode'));

  function connectSSE() {
    if (!window.EventSource) return;
    const es = new EventSource('/api/stream');
    es.onopen = () => {
      el.sseBadge.textContent = 'Live';
      el.sseBadge.classList.remove('offline');
    };
    es.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg.type === 'comment') handleComment(msg.user, msg.text, msg.team);
        else if (msg.type === 'like') handleLikes(msg.count || 1);
        else if (msg.type === 'gift') handleGift(msg.user, msg.giftType || 'theme');
      } catch {
        // ignore invalid messages
      }
    };
    es.onerror = () => {
      el.sseBadge.textContent = 'Demo';
      el.sseBadge.classList.add('offline');
    };
  }

  function seedInitialTop5() {
    const starter = [
      { user: 'andi_tirana', team: 'tirana', score: 180, words: 2 },
      { user: 'klea_ks', team: 'prishtina', score: 140, words: 2 },
      { user: 'drilon_ch', team: 'zvicra', score: 100, words: 1 },
      { user: 'genti_shkoder', team: 'shkodra', score: 80, words: 1 },
      { user: 'erion_vlora', team: 'vlora', score: 60, words: 1 }
    ];
    starter.forEach((s) => {
      const p = getOrCreatePlayer(s.user, s.team);
      p.score = s.score;
      p.wordsFound = s.words;
    });
    state.currentKing = 'andi_tirana';
  }

  seedInitialTop5();
  loadRound(0);
  connectSSE();
})();
