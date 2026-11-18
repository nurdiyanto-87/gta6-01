// Solmar Heat — particles, skid marks, explosions and floating text.
// Everything cosmetic that does not change the rules of the game lives here,
// so the gameplay files stay readable.

import { rand, randi, choice } from './config.js';

export const Effects = {
  particles: [],
  skids: [],
  floats: [], // floating world-space texts ("+$250", "WASTED!")
  shake: 0,
  flash: 0, // white screen flash, 0..1

  reset() {
    this.particles.length = 0;
    this.skids.length = 0;
    this.floats.length = 0;
    this.shake = 0;
    this.flash = 0;
  },

  addShake(amount) { this.shake = Math.min(18, this.shake + amount); },
  addFlash(amount) { this.flash = Math.min(1, this.flash + amount); },

  burst(x, y, opts) {
    const n = opts.count || 10;
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const sp = rand(opts.speedMin || 40, opts.speedMax || 180);
      this.particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: rand(opts.lifeMin || 0.3, opts.lifeMax || 0.8),
        maxLife: opts.lifeMax || 0.8,
        size: rand(opts.sizeMin || 2, opts.sizeMax || 5),
        color: choice(opts.colors),
        gravity: opts.gravity || 0,
        drag: opts.drag || 0.9,
        shrink: opts.shrink !== false,
      });
    }
    if (this.particles.length > 900) this.particles.splice(0, this.particles.length - 900);
  },

  sparks(x, y) {
    this.burst(x, y, { count: 8, speedMin: 120, speedMax: 320, lifeMin: 0.15, lifeMax: 0.4, sizeMin: 1, sizeMax: 3, colors: ['#ffd76a', '#fff3c4', '#ff9a3d'] });
  },
  smoke(x, y, dark) {
    this.burst(x, y, { count: 3, speedMin: 10, speedMax: 45, lifeMin: 0.6, lifeMax: 1.4, sizeMin: 5, sizeMax: 11, colors: dark ? ['#55555e', '#3c3c44'] : ['#e8e4da', '#cfccc2'], drag: 0.94 });
  },
  blood(x, y) {
    this.burst(x, y, { count: 7, speedMin: 50, speedMax: 170, lifeMin: 0.25, lifeMax: 0.55, sizeMin: 2, sizeMax: 4, colors: ['#b02020', '#8c1616', '#d03434'] });
  },
  muzzle(x, y, angle) {
    for (let i = 0; i < 3; i++) {
      const a = angle + rand(-0.3, 0.3);
      const sp = rand(260, 420);
      this.particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0.08, maxLife: 0.08, size: rand(3, 6),
        color: '#ffd76a', gravity: 0, drag: 0.8, shrink: true,
      });
    }
  },
  explosion(x, y) {
    this.burst(x, y, { count: 42, speedMin: 60, speedMax: 380, lifeMin: 0.35, lifeMax: 1.0, sizeMin: 3, sizeMax: 9, colors: ['#ff9a3d', '#ff5a2a', '#ffd76a', '#55555e'] });
    this.addShake(12);
    this.addFlash(0.5);
  },
  dust(x, y) {
    this.burst(x, y, { count: 2, speedMin: 8, speedMax: 30, lifeMin: 0.3, lifeMax: 0.7, sizeMin: 3, sizeMax: 6, colors: ['#d8cbb0', '#c9b896'], drag: 0.92 });
  },
  confetti(x, y) {
    this.burst(x, y, { count: 26, speedMin: 60, speedMax: 240, lifeMin: 0.5, lifeMax: 1.1, sizeMin: 2, sizeMax: 5, colors: ['#ffd76a', '#7fd4c1', '#ff8a7a', '#8ab8ff'] });
  },

  addSkid(x, y, angle) {
    this.skids.push({ x, y, angle, life: 6 });
    if (this.skids.length > 700) this.skids.splice(0, this.skids.length - 700);
  },

  floatText(x, y, text, color) {
    this.floats.push({ x, y, text, color: color || '#ffffff', life: 1.4 });
  },

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) { this.particles.splice(i, 1); continue; }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.pow(p.drag, dt * 60);
      p.vy *= Math.pow(p.drag, dt * 60);
    }
    for (let i = this.skids.length - 1; i >= 0; i--) {
      this.skids[i].life -= dt;
      if (this.skids[i].life <= 0) this.skids.splice(i, 1);
    }
    for (let i = this.floats.length - 1; i >= 0; i--) {
      const f = this.floats[i];
      f.life -= dt;
      f.y -= 34 * dt;
      if (f.life <= 0) this.floats.splice(i, 1);
    }
    this.shake = Math.max(0, this.shake - dt * 26);
    this.flash = Math.max(0, this.flash - dt * 2.2);
  },

  shakeOffset() {
    if (this.shake <= 0.1) return { x: 0, y: 0 };
    return { x: rand(-this.shake, this.shake), y: rand(-this.shake, this.shake) };
  },

  drawSkids(ctx, cam) {
    if (this.skids.length === 0) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(20,20,24,0.55)';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    for (const s of this.skids) {
      const dx = Math.cos(s.angle) * 7, dy = Math.sin(s.angle) * 7;
      ctx.globalAlpha = Math.min(0.6, s.life / 6);
      ctx.beginPath();
      ctx.moveTo(s.x - dx, s.y - dy);
      ctx.lineTo(s.x + dx, s.y + dy);
      ctx.stroke();
    }
    ctx.restore();
  },

  drawParticles(ctx) {
    for (const p of this.particles) {
      const a = p.shrink ? Math.max(0, p.life / p.maxLife) : 1;
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      const s = p.shrink ? p.size * (0.4 + 0.6 * a) : p.size;
      ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
  },

  drawFloats(ctx) {
    ctx.save();
    ctx.font = 'bold 15px Verdana, sans-serif';
    ctx.textAlign = 'center';
    for (const f of this.floats) {
      ctx.globalAlpha = Math.min(1, f.life);
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.restore();
  },
};
