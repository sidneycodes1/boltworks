/**
 * Synthesised runtime audio engine for BOLTWORKS.
 * Zero external asset dependencies - all SFX, engine hum, and BGM are
 * synthesised via the Web Audio API.
 */
export class BoltAudio {
  constructor() {
    this.ctx = null;
    this.ok = false;
    this.muted = false;
    this.masterGain = null;
    this.sfxGain = null;
    this.bgmGain = null;
    this.noiseBuffer = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.bgmTimer = null;
    this.bgmStep = 0;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
        // Synchronous silent buffer play for iOS WebKit unlock — must be in the same call as the gesture
        try {
          const buffer = this.ctx.createBuffer(1, 1, this.ctx.sampleRate);
          const source = this.ctx.createBufferSource();
          source.buffer = buffer;
          source.connect(this.ctx.destination);
          source.start(0);
          source.stop(0.01);
        } catch (e) {}
      }
      return;
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    this.ctx = ctx;

    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = this.muted ? 0 : 0.6;
    this.masterGain.connect(ctx.destination);

    this.sfxGain = ctx.createGain();
    this.sfxGain.gain.value = 0.85;
    this.sfxGain.connect(this.masterGain);

    this.bgmGain = ctx.createGain();
    this.bgmGain.gain.value = 0.22;
    this.bgmGain.connect(this.masterGain);

    this._createNoiseBuffer(2.0);
    this._initEngineHum();
    this.ok = true;
    this._startBgm();
    // Synchronous silent buffer play for iOS WebKit unlock
    try {
      const buffer = this.ctx.createBuffer(1, 1, this.ctx.sampleRate);
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(this.ctx.destination);
      source.start(0);
      source.stop(0.01);
    } catch (e) {}
  }

  _createNoiseBuffer(seconds) {
    const ctx = this.ctx;
    const length = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
  }

  _env(node, peak, attack, decay, when = this.ctx.currentTime, dest = this.sfxGain) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), when + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, when + attack + decay);
    node.connect(g);
    g.connect(dest);
    return g;
  }

  _noiseSource(when, duration, filterType, freq, q = 1) {
    if (!this.noiseBuffer) return null;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;

    let output = src;
    if (filterType) {
      const filter = this.ctx.createBiquadFilter();
      filter.type = filterType;
      filter.frequency.value = freq;
      filter.Q.value = q;
      src.connect(filter);
      output = filter;
    }

    src.start(when);
    src.stop(when + duration + 0.05);
    return output;
  }

  playFire() {
    if (!this.ok || this.muted) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;

    // Layer 1: sharp broadband transient — the crack (phone speakers reproduce this)
    const crack = this._noiseSource(t, 0.04, 'highpass', 2600);
    if (crack) this._env(crack, 0.95, 0.001, 0.018, t);

    // Layer 2: punchy low-frequency thump underneath
    const thump = ctx.createOscillator();
    thump.type = 'triangle';
    thump.frequency.setValueAtTime(150, t);
    thump.frequency.exponentialRampToValueAtTime(42, t + 0.065);
    this._env(thump, 0.85, 0.001, 0.07, t);
    thump.start(t);
    thump.stop(t + 0.08);

    // Layer 3: midrange body/resonance — gives crack some boom
    const body = this._noiseSource(t, 0.12, 'bandpass', 620, 1.0);
    if (body) this._env(body, 0.62, 0.002, 0.09, t);

    // Tail: closing lowpass body (expanding air) + short reverb decay
    const tailSrc = this._noiseSource(t, 0.35, null, 0);
    if (tailSrc) {
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(1800, t);
      lp.frequency.exponentialRampToValueAtTime(280, t + 0.22);
      try { tailSrc.disconnect(); } catch(e) {}
      tailSrc.connect(lp);
      this._env(lp, 0.45, 0.002, 0.22, t);
    }
    // Short reverb tail — 3 decaying taps
    for (let i = 1; i <= 3; i++) {
      const d = i * 0.07;
      const g = 0.32 / (i * 1.6);
      const tap = this._noiseSource(t + d, 0.12, 'lowpass', 1100 - i * 180);
      if (tap) this._env(tap, g, 0.002, 0.14, t + d);
    }
  }

  playHit() {
    if (!this.ok || this.muted) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;

    const noise = this._noiseSource(t, 0.08, 'bandpass', 2400, 2.5);
    if (noise) this._env(noise, 0.5, 0.001, 0.06, t);

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.exponentialRampToValueAtTime(320, t + 0.1);
    this._env(osc, 0.35, 0.001, 0.09, t);
    osc.start(t);
    osc.stop(t + 0.12);
  }

  playEnemyDeath() {
    if (!this.ok || this.muted) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;

    const blast = this._noiseSource(t, 0.45, 'lowpass', 600);
    if (blast) this._env(blast, 0.75, 0.005, 0.38, t);

    const sub = ctx.createOscillator();
    sub.type = 'sawtooth';
    sub.frequency.setValueAtTime(140, t);
    sub.frequency.exponentialRampToValueAtTime(24, t + 0.35);
    this._env(sub, 0.65, 0.004, 0.32, t);
    sub.start(t);
    sub.stop(t + 0.38);
  }

  playWaveClear() {
    if (!this.ok || this.muted) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const notes = [440, 554.37, 659.25, 880];
    notes.forEach((freq, i) => {
      const start = t + i * 0.08;
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);
      this._env(osc, 0.4, 0.01, 0.28, start);
      osc.start(start);
      osc.stop(start + 0.32);
    });
  }

  _initEngineHum() {
    const ctx = this.ctx;
    const t = ctx.currentTime;

    this.engineOsc = ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 45;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 140;

    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0.02;

    this.engineOsc.connect(filter);
    filter.connect(this.engineGain);
    this.engineGain.connect(this.sfxGain);

    this.engineOsc.start(t);
  }

  updateEngine(movingSpeedRatio) {
    if (!this.ok || !this.engineGain) return;
    const targetFreq = 45 + movingSpeedRatio * 35;
    const targetGain = 0.02 + movingSpeedRatio * 0.06;
    const t = this.ctx.currentTime;
    this.engineOsc.frequency.setTargetAtTime(targetFreq, t, 0.08);
    this.engineGain.gain.setTargetAtTime(targetGain, t, 0.08);
  }

  _startBgm() {
    if (!this.ok || this.bgmTimer) return;
    const bassline = [110, 110, 130.81, 110, 146.83, 110, 130.81, 164.81];
    const stepDuration = 0.22;

    const tick = () => {
      if (!this.ok) return;
      const t = this.ctx.currentTime;
      const freq = bassline[this.bgmStep % bassline.length];
      this.bgmStep++;

      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq / 2, t);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(260, t);
      filter.frequency.exponentialRampToValueAtTime(80, t + stepDuration * 0.85);

      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.18, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + stepDuration * 0.9);

      osc.connect(filter);
      filter.connect(g);
      g.connect(this.bgmGain);

      osc.start(t);
      osc.stop(t + stepDuration);

      this.bgmTimer = setTimeout(tick, stepDuration * 1000);
    };

    tick();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.muted ? 0 : 0.6, this.ctx.currentTime, 0.04);
    }
    return this.muted;
  }
}
