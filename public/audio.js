(function (global) {
  function midiToFreq(m) {
    return 440 * Math.pow(2, (m - 69) / 12);
  }

  class SoundEngineImpl {
    constructor() {
      this.ctx = null;
      this.masterGain = null;
      this.sfxGain = null;
      this.muted = false;
      this.musicEnabled = false;
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

        this.sfxGain = this.ctx.createGain();
        this.sfxGain.gain.value = 0.65;
        this.sfxGain.connect(this.masterGain);
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    }

    unlock() {
      this.ensureContext();
    }

    setMuted(flag) {
      this.muted = Boolean(flag);
      if (this.masterGain && this.ctx) {
        this.masterGain.gain.setTargetAtTime(this.muted ? 0 : 0.75, this.ctx.currentTime, 0.03);
      }
      return this.muted;
    }

    isMuted() {
      return this.muted;
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
        case 'hint':
          this.playSequence([76, 79, 83, 88], 'sine', 0.05, 0.24);
          break;
        case 'mascot':
          this.playSequence([60, 67, 72, 76, 79, 84], 'triangle', 0.06, 0.26);
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
