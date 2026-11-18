// Solmar Heat — procedural sound.
// Every sound is synthesised with the Web Audio API: no audio files, no
// network requests. The engine hum, siren, gunshots and the little sun-soaked
// melody are all oscillators and filtered noise written here.

export const AudioSys = {
  ctx: null,
  master: null,
  musicGain: null,
  sfxGain: null,
  engineOsc: null,
  engineGain: null,
  sirenOsc: null,
  sirenGain: null,
  sirenTimer: 0,
  sirenHigh: false,
  muted: false,
  musicTimer: 0,
  musicStep: 0,
  started: false,

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.16;
    this.musicGain.connect(this.master);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.9;
    this.sfxGain.connect(this.master);
    this.started = true;
  },

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.55;
    return this.muted;
  },

  // ---- one-shot effects ----
  blip(freq, dur, type, vol, slideTo) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol || 0.3, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g); g.connect(this.sfxGain);
    osc.start(t); osc.stop(t + dur + 0.02);
  },

  noise(dur, vol, filterFreq, type) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type || 'lowpass';
    filter.frequency.value = filterFreq || 1200;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol || 0.4, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter); filter.connect(g); g.connect(this.sfxGain);
    src.start(t);
  },

  shoot(kind) {
    if (kind === 'shotgun') { this.noise(0.22, 0.7, 900); this.blip(120, 0.15, 'square', 0.25, 50); }
    else if (kind === 'smg') { this.noise(0.08, 0.4, 1800); this.blip(220, 0.06, 'square', 0.15, 90); }
    else { this.noise(0.12, 0.5, 1400); this.blip(180, 0.09, 'square', 0.2, 70); }
  },
  hit() { this.blip(160, 0.08, 'triangle', 0.3, 90); },
  crash(strength) {
    const v = Math.min(0.8, 0.25 + strength * 0.5);
    this.noise(0.18, v, 700);
    this.blip(90, 0.16, 'sawtooth', v * 0.5, 40);
  },
  pickup() { this.blip(660, 0.09, 'sine', 0.3); setTimeout(() => this.blip(990, 0.12, 'sine', 0.3), 70); },
  cash() { this.blip(880, 0.08, 'triangle', 0.28); setTimeout(() => this.blip(1320, 0.14, 'triangle', 0.28), 80); },
  doorSlam() { this.noise(0.09, 0.5, 500); this.blip(110, 0.08, 'sine', 0.35, 60); },
  horn() { this.blip(370, 0.25, 'square', 0.16, 370); this.blip(466, 0.25, 'square', 0.12, 466); },
  wantedUp() { this.blip(520, 0.12, 'sawtooth', 0.2); setTimeout(() => this.blip(520, 0.12, 'sawtooth', 0.2), 140); },
  busted() { this.blip(392, 0.25, 'sawtooth', 0.25); setTimeout(() => this.blip(311, 0.4, 'sawtooth', 0.25), 220); },
  missionDone() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((n, i) => setTimeout(() => this.blip(n, 0.18, 'triangle', 0.3), i * 110));
  },
  missionFail() {
    const notes = [330, 294, 247, 196];
    notes.forEach((n, i) => setTimeout(() => this.blip(n, 0.22, 'triangle', 0.25), i * 140));
  },
  explosion() {
    this.noise(0.7, 0.9, 350);
    this.blip(70, 0.6, 'sine', 0.6, 30);
  },
  skid() { this.noise(0.15, 0.12, 2400, 'bandpass'); },
  reload() { this.blip(300, 0.05, 'square', 0.15); setTimeout(() => this.blip(420, 0.05, 'square', 0.15), 120); },
  click() { this.blip(700, 0.05, 'sine', 0.2); },

  // ---- continuous sounds: engine hum and police siren ----
  setEngine(running, speedNorm) {
    if (!this.ctx) return;
    if (running && !this.engineOsc) {
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0.0;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      this.engineOsc.connect(filter); filter.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
    }
    if (this.engineOsc) {
      const target = running ? 0.05 + speedNorm * 0.07 : 0;
      this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.1);
      this.engineOsc.frequency.setTargetAtTime(55 + speedNorm * 95, this.ctx.currentTime, 0.08);
      if (!running && target === 0) {
        try { this.engineOsc.stop(); } catch (e) { /* already stopped */ }
        this.engineOsc = null;
      }
    }
  },

  setSiren(active, dt) {
    if (!this.ctx) return;
    if (active && !this.sirenOsc) {
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'triangle';
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0.045;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.sirenOsc.start();
      this.sirenTimer = 0;
    }
    if (this.sirenOsc) {
      if (!active) {
        try { this.sirenOsc.stop(); } catch (e) { /* already stopped */ }
        this.sirenOsc = null;
        return;
      }
      this.sirenTimer += dt;
      if (this.sirenTimer > 0.42) {
        this.sirenTimer = 0;
        this.sirenHigh = !this.sirenHigh;
        this.sirenOsc.frequency.setTargetAtTime(this.sirenHigh ? 880 : 620, this.ctx.currentTime, 0.05);
      }
    }
  },

  // ---- the little sun-soaked melody: a slow original chord loop ----
  // Chords: Cmaj7 - Am7 - Fmaj7 - G6, one soft pluck arpeggio each bar.
  updateMusic(dt, playing) {
    if (!this.ctx || !playing || this.muted) return;
    this.musicTimer -= dt;
    if (this.musicTimer > 0) return;
    const chords = [
      [261.6, 329.6, 392.0, 493.9],
      [220.0, 261.6, 329.6, 392.0],
      [174.6, 220.0, 261.6, 329.6],
      [196.0, 246.9, 293.7, 329.6],
    ];
    const chord = chords[this.musicStep % chords.length];
    const note = chord[this.musicStep % chord.length];
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = note;
    g.gain.setValueAtTime(0.22, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.4);
    osc.connect(g); g.connect(this.musicGain);
    osc.start(t); osc.stop(t + 1.5);
    this.musicStep++;
    this.musicTimer = 0.55;
  },
};
