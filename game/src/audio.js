// San Cielo Heat — procedural sound: every effect is synthesised with
// WebAudio oscillators and filtered noise. No audio files, no network.

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenTimer = 0;
    this.sirenOn = false;
    this.musicTimer = 0;
    this.musicStep = 0;
    this.musicOn = false;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
      this.startEngineLoop();
      this.startSirenLoop();
      return true;
    } catch (err) {
      this.ctx = null;
      return false;
    }
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.5, this.ctx.currentTime, 0.02);
    }
  }

  startEngineLoop() {
    const ctx = this.ctx;
    this.engineOsc = ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    this.engineFilter = ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 220;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();
  }

  startSirenLoop() {
    const ctx = this.ctx;
    this.sirenOsc = ctx.createOscillator();
    this.sirenOsc.type = 'triangle';
    this.sirenOsc.frequency.value = 660;
    this.sirenGain = ctx.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain);
    this.sirenGain.connect(this.master);
    this.sirenOsc.start();
  }

  // Continuous engine hum, driven by the driven car's speed each frame.
  engine(speedFrac, inCar) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const target = inCar ? 0.05 + 0.1 * Math.min(1, speedFrac) : 0;
    this.engineGain.gain.setTargetAtTime(target, t, 0.08);
    this.engineOsc.frequency.setTargetAtTime(50 + 130 * Math.min(1, speedFrac), t, 0.08);
    this.engineFilter.frequency.setTargetAtTime(180 + 700 * Math.min(1, speedFrac), t, 0.08);
  }

  siren(active, dt) {
    if (!this.ctx) return;
    this.sirenOn = active;
    const t = this.ctx.currentTime;
    this.sirenGain.gain.setTargetAtTime(active ? 0.045 : 0, t, 0.15);
    if (active) {
      this.sirenTimer += dt;
      const phase = (this.sirenTimer % 1.1) / 1.1;
      this.sirenOsc.frequency.value = phase < 0.5 ? 720 : 540;
    }
  }

  blip(freq, dur, type, vol, slideTo) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol || 0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  noise(dur, vol, filterFreq, type) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type || 'lowpass';
    filter.frequency.value = filterFreq || 1200;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol || 0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t);
  }

  shot(kind) {
    if (kind === 'smg') { this.noise(0.09, 0.22, 2600, 'bandpass'); this.blip(190, 0.07, 'square', 0.1, 70); }
    else if (kind === 'pistol') { this.noise(0.14, 0.3, 1800, 'lowpass'); this.blip(140, 0.1, 'square', 0.14, 55); }
    else { this.noise(0.08, 0.18, 700, 'lowpass'); }
  }

  crash(strength) {
    this.noise(0.25, 0.12 + 0.25 * Math.min(1, strength), 500, 'lowpass');
    this.blip(90, 0.2, 'sawtooth', 0.12, 40);
  }

  pickup() { this.blip(880, 0.09, 'sine', 0.16); setTimeout(() => this.blip(1320, 0.12, 'sine', 0.16), 70); }
  cash() { this.blip(1046, 0.08, 'triangle', 0.16); setTimeout(() => this.blip(1568, 0.14, 'triangle', 0.16), 80); }
  uiClick() { this.blip(660, 0.05, 'sine', 0.1); }
  horn() { this.blip(392, 0.25, 'square', 0.1); this.blip(494, 0.25, 'square', 0.08); }
  doorSlam() { this.noise(0.08, 0.2, 400, 'lowpass'); }
  hurt() { this.blip(220, 0.12, 'sawtooth', 0.14, 110); }
  wantedUp() { this.blip(520, 0.12, 'square', 0.12); setTimeout(() => this.blip(520, 0.12, 'square', 0.12), 150); }
  busted() { this.blip(440, 0.3, 'sawtooth', 0.15, 220); setTimeout(() => this.blip(330, 0.4, 'sawtooth', 0.15, 165), 250); }
  wasted() { this.blip(330, 0.35, 'sawtooth', 0.15, 110); setTimeout(() => this.blip(220, 0.5, 'sawtooth', 0.15, 80), 300); }

  jingle() {
    const notes = [523, 659, 784, 1046];
    notes.forEach((freq, i) => setTimeout(() => this.blip(freq, 0.16, 'triangle', 0.16), i * 110));
  }

  missionFail() {
    const notes = [392, 330, 262, 196];
    notes.forEach((freq, i) => setTimeout(() => this.blip(freq, 0.2, 'triangle', 0.14), i * 140));
  }

  // A lazy two-bar bass-and-pluck loop that keeps the city humming.
  updateMusic(dt, playing) {
    if (!this.ctx || !playing) return;
    this.musicTimer += dt;
    const stepLen = 0.24;
    if (this.musicTimer < stepLen) return;
    this.musicTimer -= stepLen;
    this.musicStep = (this.musicStep + 1) % 16;
    const bass = [110, 0, 110, 0, 131, 0, 110, 0, 98, 0, 98, 0, 147, 0, 131, 0];
    const pluck = [0, 440, 0, 523, 0, 0, 659, 0, 0, 587, 0, 523, 0, 659, 0, 784];
    if (bass[this.musicStep]) this.blip(bass[this.musicStep], 0.2, 'triangle', 0.05);
    if (pluck[this.musicStep]) this.blip(pluck[this.musicStep], 0.12, 'sine', 0.035);
  }
}
