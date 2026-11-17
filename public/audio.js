(function (global) {
  const SONGS = (global.ALBANIAN_DATA && global.ALBANIAN_DATA.SONGS) || [
    { id: 0, name: 'Valle Elektronike (Tallava Trap)', bpm: 128 },
    { id: 1, name: 'Tirana Drill & 808', bpm: 136 },
    { id: 2, name: 'Ksamil Sunset Lofi', bpm: 94 },
    { id: 3, name: 'Çifteli Synthwave', bpm: 134 },
    { id: 4, name: 'Shkodra Retro Arcade', bpm: 142 },
    { id: 5, name: 'Kuq e Zi Stadium Anthem', bpm: 124 }
  ];

  // MIDI note to Hz
  function midiToFreq(m) {
    return 440 * Math.pow(2, (m - 69) / 12);
  }

  // 16-step patterns per song
  const PATTERNS = [
    // 0: Valle Elektronike (E Hijaz: E, F, G#, A, B, C, D)
    {
      lead: [64, 0, 68, 69, 71, 0, 69, 68, 65, 0, 68, 65, 64, 68, 65, 64],
      bass: [40, 0, 40, 0, 40, 0, 45, 0, 41, 0, 41, 0, 40, 0, 47, 0],
      kick: [1, 0, 0, 1, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 1, 0],
      snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1],
      hat: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
      wave: 'sawtooth',
      bassWave: 'triangle'
    },
    // 1: Tirana Drill & 808 (C minor)
    {
      lead: [60, 0, 63, 0, 67, 0, 68, 0, 67, 0, 63, 62, 60, 0, 0, 58],
      bass: [36, 0, 0, 36, 0, 0, 43, 0, 41, 0, 0, 39, 0, 0, 38, 0],
      kick: [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 0, 0],
      snare: [0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0],
      hat: [1, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 1, 1, 0, 1],
      wave: 'triangle',
      bassWave: 'sine'
    },
    // 2: Ksamil Sunset Lofi (A minor pentatonic chill)
    {
      lead: [69, 0, 72, 0, 76, 0, 74, 0, 72, 0, 69, 0, 67, 0, 69, 0],
      bass: [45, 0, 0, 0, 45, 0, 0, 0, 41, 0, 0, 0, 43, 0, 0, 0],
      kick: [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0],
      snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
      hat: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1],
      wave: 'sine',
      bassWave: 'sine'
    },
    // 3: Çifteli Synthwave (D Dorian/Balkan drone feel)
    {
      lead: [62, 69, 65, 69, 67, 69, 65, 69, 62, 69, 64, 69, 65, 64, 62, 69],
      bass: [38, 38, 0, 38, 38, 38, 0, 38, 41, 41, 0, 41, 43, 43, 0, 43],
      kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
      snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
      hat: [0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1],
      wave: 'sawtooth',
      bassWave: 'sawtooth'
    },
    // 4: Shkodra Retro Arcade (C major 8-bit)
    {
      lead: [72, 76, 79, 76, 84, 0, 79, 0, 77, 81, 84, 81, 79, 0, 74, 0],
      bass: [48, 0, 55, 0, 48, 0, 55, 0, 41, 0, 48, 0, 43, 0, 55, 0],
      kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0],
      snare: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 1],
      hat: [1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 1],
      wave: 'square',
      bassWave: 'square'
    },
    // 5: Kuq e Zi Stadium Anthem (E minor epic)
    {
      lead: [64, 0, 64, 67, 71, 0, 67, 0, 69, 0, 67, 66, 64, 0, 71, 0],
      bass: [40, 0, 40, 0, 43, 0, 43, 0, 45, 0, 43, 0, 40, 0, 38, 0],
      kick: [1, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 1, 0],
      snare: [0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0],
      hat: [1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1],
      wave: 'sawtooth',
      bassWave: 'triangle'
    }
  ];

  class SoundEngineImpl {
    constructor() {
      this.ctx = null;
      this.masterGain = null;
      this.musicGain = null;
      this.sfxGain = null;
      this.noiseBuffer = null;
      this.muted = false;
      this.musicEnabled = false;
      this.currentSong = 0;
      this.step = 0;
      this.timerId = null;
      this.playlist = [];
      this.trackIndex = 0;
      this.players = [null, null];
      this.activePlayer = 0;
      this.fadeTimer = null;
      this.volume = 0.55;
      this.onTrackChange = null;
    }

    ensureContext() {
      if (!this.ctx) {
        const AudioCtx = global.AudioContext || global.webkitAudioContext;
        if (!AudioCtx) return null;
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.muted ? 0 : 0.75;
        this.masterGain.connect(this.ctx.destination);

        this.musicGain = this.ctx.createGain();
        this.musicGain.gain.value = this.volume * 0.5;
        this.musicGain.connect(this.masterGain);

        this.sfxGain = this.ctx.createGain();
        this.sfxGain.gain.value = 0.65;
        this.sfxGain.connect(this.masterGain);

        this.noiseBuffer = this.createNoiseBuffer();
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    }

    createNoiseBuffer() {
      const length = this.ctx.sampleRate * 0.4;
      const buf = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < length; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      return buf;
    }

    unlock() {
      this.ensureContext();
    }

    setMuted(flag) {
      this.muted = Boolean(flag);
      if (this.masterGain && this.ctx) {
        this.masterGain.gain.setTargetAtTime(this.muted ? 0 : 0.75, this.ctx.currentTime, 0.03);
      }
      for (const player of this.players) {
        if (player) player.muted = this.muted;
      }
      return this.muted;
    }

    isMuted() {
      return this.muted;
    }

    getCurrentSong() {
      if (this.playlist.length) {
        return this.playlist[this.trackIndex] || this.playlist[0];
      }
      return SONGS[this.currentSong] || SONGS[0];
    }

    emitTrack() {
      if (typeof this.onTrackChange === 'function') {
        try {
          this.onTrackChange(this.getCurrentSong());
        } catch {
          /* ignore UI callback errors */
        }
      }
    }

    ensureAudioPlayer(index) {
      let player = this.players[index];
      if (!player) {
        player = new global.Audio();
        player.preload = 'auto';
        player.addEventListener('ended', () => {
          if (index === this.activePlayer && this.musicEnabled && this.playlist.length) {
            this.nextSong();
          }
        });
        this.players[index] = player;
      }
      return player;
    }

    setPlaylist(tracks) {
      const list = Array.isArray(tracks)
        ? tracks.filter((t) => t && typeof t.name === 'string' && typeof t.url === 'string')
        : [];

      // shuffle once per session so a 5-hour stream doesn't loop alphabetically
      for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
      }

      this.playlist = list;
      this.trackIndex = 0;

      if (this.timerId) {
        clearInterval(this.timerId);
        this.timerId = null;
      }
      if (!list.length) {
        if (this.musicEnabled) this.restartScheduler();
        return;
      }
      if (this.musicEnabled) this.playTrack(0);
      else this.emitTrack();
    }

    playTrack(index) {
      if (!this.playlist.length) return null;
      const len = this.playlist.length;
      this.trackIndex = ((Math.floor(index) % len) + len) % len;
      const track = this.playlist[this.trackIndex];
      const nextSlot = 1 - this.activePlayer;
      const next = this.ensureAudioPlayer(nextSlot);
      const prev = this.players[this.activePlayer];

      clearInterval(this.fadeTimer);
      this.fadeTimer = null;

      try {
        next.pause();
        next.src = track.url;
        next.load();
        next.volume = 0;
        next.muted = this.muted;
        const played = next.play();
        if (played && typeof played.catch === 'function') played.catch(() => {});
      } catch {
        /* ignore autoplay errors */
      }

      this.activePlayer = nextSlot;
      const fadePrev = prev && prev !== next && !prev.paused ? prev : null;
      const steps = 22;
      let step = 0;

      this.fadeTimer = setInterval(() => {
        step += 1;
        const t = Math.min(1, step / steps);
        try {
          next.volume = Math.max(0, Math.min(1, this.volume * t));
        } catch {}
        if (fadePrev) {
          try {
            fadePrev.volume = Math.max(0, Math.min(1, this.volume * (1 - t)));
          } catch {}
        }
        if (t >= 1) {
          clearInterval(this.fadeTimer);
          this.fadeTimer = null;
          if (fadePrev) {
            try {
              fadePrev.pause();
              fadePrev.removeAttribute('src');
              fadePrev.load();
            } catch {}
          }
        }
      }, 40);

      this.emitTrack();
      return track;
    }

    stopPlaylist() {
      clearInterval(this.fadeTimer);
      this.fadeTimer = null;
      for (const player of this.players) {
        if (!player) continue;
        try {
          player.pause();
          player.removeAttribute('src');
          player.load();
        } catch {}
      }
    }

    setMusicVolume(value) {
      const volume = Math.max(0, Math.min(1, Number(value) || 0));
      this.volume = volume;
      if (this.musicGain && this.ctx) {
        this.musicGain.gain.setTargetAtTime(volume * 0.5, this.ctx.currentTime, 0.03);
      }
      for (const player of this.players) {
        if (!player) continue;
        try {
          player.volume = volume;
        } catch {}
      }
      return volume;
    }

    getMusicVolume() {
      return this.volume;
    }

    startMusic() {
      this.ensureContext();
      this.musicEnabled = true;
      if (this.playlist.length) {
        this.playTrack(this.trackIndex);
        return;
      }
      this.restartScheduler();
    }

    stopMusic() {
      this.musicEnabled = false;
      if (this.playlist.length) {
        this.stopPlaylist();
        return;
      }
      if (this.timerId) {
        clearInterval(this.timerId);
        this.timerId = null;
      }
    }

    toggleMusic() {
      if (this.musicEnabled) {
        this.stopMusic();
      } else {
        this.startMusic();
      }
      return this.musicEnabled;
    }

    setSong(index) {
      if (this.playlist.length) {
        const len = this.playlist.length;
        this.trackIndex = ((Math.floor(index) % len) + len) % len;
        if (this.musicEnabled) this.playTrack(this.trackIndex);
        else this.emitTrack();
        return this.getCurrentSong();
      }

      this.currentSong = ((index % SONGS.length) + SONGS.length) % SONGS.length;
      this.step = 0;
      if (this.musicEnabled) {
        this.restartScheduler();
      }
      return this.getCurrentSong();
    }

    nextSong() {
      if (this.playlist.length) {
        return this.setSong(this.trackIndex + 1);
      }
      return this.setSong(this.currentSong + 1);
    }

    restartScheduler() {
      if (this.playlist.length) return;
      if (this.timerId) {
        clearInterval(this.timerId);
        this.timerId = null;
      }
      if (!this.musicEnabled) return;
      const song = this.getCurrentSong();
      const stepMs = Math.round((60 / song.bpm / 4) * 1000);
      this.timerId = setInterval(() => this.tickStep(), stepMs);
    }

    tickStep() {
      if (this.playlist.length) return;
      if (!this.musicEnabled || this.muted) return;
      const ctx = this.ensureContext();
      if (!ctx || ctx.state !== 'running') return;

      const pat = PATTERNS[this.currentSong] || PATTERNS[0];
      const idx = this.step % 16;
      const now = ctx.currentTime;

      if (pat.kick[idx]) this.triggerKick(now);
      if (pat.snare[idx]) this.triggerSnare(now);
      if (pat.hat[idx]) this.triggerHat(now);

      const bassNote = pat.bass[idx];
      if (bassNote) {
        this.triggerNote(midiToFreq(bassNote), now, 0.17, pat.bassWave, 0.24, this.musicGain, 500);
      }
      const leadNote = pat.lead[idx];
      if (leadNote) {
        this.triggerNote(midiToFreq(leadNote), now, 0.15, pat.wave, 0.14, this.musicGain, 2200);
      }

      this.step = (this.step + 1) % 16;
    }

    triggerKick(t) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(145, t);
      osc.frequency.exponentialRampToValueAtTime(42, t + 0.12);
      gain.gain.setValueAtTime(0.45, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      osc.connect(gain);
      gain.connect(this.musicGain);
      osc.start(t);
      osc.stop(t + 0.16);
    }

    triggerSnare(t) {
      if (!this.noiseBuffer) return;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1800;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.22, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicGain);
      src.start(t);
      src.stop(t + 0.13);
    }

    triggerHat(t) {
      if (!this.noiseBuffer) return;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 6500;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.09, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicGain);
      src.start(t);
      src.stop(t + 0.05);
    }

    triggerNote(freq, t, dur, wave, vol, targetGain, cutoff) {
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();
      osc.type = wave || 'triangle';
      osc.frequency.setValueAtTime(freq, t);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(cutoff || 2600, t);

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(vol, t + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(targetGain || this.sfxGain);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    }

    playSequence(notes, wave = 'triangle', stepSec = 0.07, vol = 0.25) {
      if (this.muted) return;
      const ctx = this.ensureContext();
      if (!ctx) return;
      const base = ctx.currentTime;
      notes.forEach((m, i) => {
        if (!m) return;
        this.triggerNote(midiToFreq(m), base + i * stepSec, stepSec * 1.45, wave, vol, this.sfxGain, 4500);
      });
    }

    playWordFound(isGolden, isBomb) {
      if (isGolden) {
        this.playSequence([64, 68, 71, 76, 80, 83], 'sawtooth', 0.065, 0.26);
      } else if (isBomb) {
        this.playSequence([48, 43, 38, 72, 76], 'sawtooth', 0.06, 0.28);
      } else {
        this.playSequence([64, 69, 73, 76], 'triangle', 0.055, 0.24);
      }
    }

    playBonusWord() {
      this.playSequence([72, 76, 79, 84], 'sine', 0.05, 0.2);
    }

    playNewKing() {
      this.playSequence([60, 64, 67, 72, 72, 76, 79], 'sawtooth', 0.08, 0.24);
    }

    playLikeMilestone() {
      this.playSequence([60, 63, 67, 70, 75, 79], 'square', 0.05, 0.18);
    }

    playCombo(level) {
      const base = 72 + Math.min(12, Math.max(0, level - 1) * 2);
      this.playSequence([base, base + 4, base + 7], 'triangle', 0.05, 0.22);
    }

    playHype() {
      this.playSequence([55, 62, 67, 72, 76, 79, 84, 88], 'sawtooth', 0.06, 0.28);
    }

    playShuffle() {
      this.playSequence([72, 76, 79, 76, 72], 'sine', 0.035, 0.14);
    }

    playJoin() {
      this.playSequence([69, 73], 'sine', 0.06, 0.14);
    }

    playGiftEffect(type) {
      switch (type) {
        case 'theme':
          this.playSequence([67, 71, 74, 79], 'sine', 0.06, 0.25);
          break;
        case 'font':
          this.playSequence([69, 73, 76, 81], 'triangle', 0.055, 0.25);
          break;
        case 'song':
          this.playSequence([55, 62, 67, 74, 79], 'sawtooth', 0.055, 0.22);
          break;
        case 'hint':
          this.playSequence([76, 79, 83, 88], 'sine', 0.05, 0.24);
          break;
        case 'eagle':
          this.playSequence([52, 59, 64, 68, 71, 76, 83], 'sawtooth', 0.075, 0.28);
          break;
        default:
          this.playSequence([64, 68, 71], 'triangle', 0.06, 0.2);
      }
    }

    playTick() {
      this.playSequence([84], 'sine', 0.03, 0.1);
    }

    playRoundWin() {
      this.playSequence([60, 64, 67, 72, 76, 79, 84], 'triangle', 0.08, 0.28);
    }
  }

  global.SoundEngine = new SoundEngineImpl();
})(window);
