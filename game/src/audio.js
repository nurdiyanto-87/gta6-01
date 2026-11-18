// San Cielo Heat — every sound is synthesised live with WebAudio:
// engine hum, siren wail, gunfire, pickups, jingles and a laid-back
// synth groove. No audio files, no network.

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.musicTimer = 0;
    this.musicStep = 0;
    this.musicOn = true;
    this.master = null;
  }

  // Browsers require a user gesture before audio starts.
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.startEngineLoop();
      this.startSirenLoop();
    } catch (err) {
      this.ctx = null;
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }

  startEngineLoop() {
    const ctx = this.ctx;
    this.engineOsc = ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(filter);
    filter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();
  }

  startSirenLoop() {
    const ctx = this.ctx;
    this.sirenOsc = ctx.createOscillator();
    this.sirenOsc.type = 'triangle';
    this.sirenOsc.frequency.value = 700;
    this.sirenGain = ctx.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain);
    this.sirenGain.connect(this.master);
    this.sirenOsc.start();
  }

  // Called every frame: engine pitch follows speed, siren wails when
  // police are near.
  update(dt, engineRatio, sirenNear) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (this.engineGain) {
      const target = engineRatio > 0.02 ? 0.05 + engineRatio * 0.09 : 0;
      this.engineGain.gain.setTargetAtTime(target, t, 0.1);
      this.engineOsc.frequency.setTargetAtTime(50 + engineRatio * 130, t, 0.1);
    }
    if (this.sirenGain) {
      const target = sirenNear ? 0.045 : 0;
      this.sirenGain.gain.setTargetAtTime(target, t, 0.3);
      if (sirenNear) {
        this.sirenOsc.frequency.setTargetAtTime(650 + Math.sin(t * 4.5) * 180, t, 0.05);
      }
    }
    this.updateMusic(dt);
  }

  // A slow two-chord groove: soft triangle bass + plucked thirds.
  updateMusic(dt) {
    if (!this.musicOn || !this.ctx) return;
    this.musicTimer -= dt;
    if (this.musicTimer > 0) return;
    this.musicTimer = 0.42;
    const bassNotes = [110, 110, 130.8, 98];
    const arpNotes = [220, 277.2, 329.6, 277.2, 220, 329.6, 261.6, 196];
    const step = this.musicStep++;
    if (step % 4 === 0) this.tone(bassNotes[(step / 4) % 4], 0.36, 'triangle', 0.05);
    if (step % 2 === 0) this.tone(arpNotes[step % 8], 0.2, 'sine', 0.028);
  }

  tone(freq, dur, type, vol) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  noise(dur, vol, filterFreq) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq || 1200;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(t);
  }

  shot(big) {
    this.noise(big ? 0.16 : 0.09, big ? 0.35 : 0.22, big ? 900 : 1800);
    this.tone(big ? 90 : 140, 0.08, 'square', 0.08);
  }

  crash(hard) {
    this.noise(hard ? 0.3 : 0.15, hard ? 0.4 : 0.22, 500);
    this.tone(60, 0.2, 'sine', 0.2);
  }

  pickup() {
    this.tone(660, 0.09, 'sine', 0.12);
    setTimeout(() => this.tone(880, 0.12, 'sine', 0.12), 70);
  }

  cash() {
    this.tone(988, 0.08, 'triangle', 0.12);
    setTimeout(() => this.tone(1319, 0.14, 'triangle', 0.12), 80);
  }

  hurt() {
    this.tone(180, 0.12, 'sawtooth', 0.12);
  }

  sirenBlip() {
    this.tone(950, 0.12, 'triangle', 0.1);
    setTimeout(() => this.tone(700, 0.12, 'triangle', 0.1), 120);
  }

  missionDone() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((n, i) => setTimeout(() => this.tone(n, 0.22, 'triangle', 0.14), i * 110));
  }

  missionFail() {
    const notes = [392, 330, 262, 196];
    notes.forEach((n, i) => setTimeout(() => this.tone(n, 0.25, 'triangle', 0.12), i * 130));
  }

  doorSlam() {
    this.noise(0.08, 0.25, 400);
  }

  skid() {
    this.noise(0.18, 0.06, 2600);
  }
}
