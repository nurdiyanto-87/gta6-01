// San Cielo Heat — particles, skid marks, floating text and shockwaves:
// the juice that makes hits, drifts and explosions read on screen.

import { clamp } from './util.js';

export class Effects {
  constructor() {
    this.particles = [];
    this.skids = [];
    this.texts = [];
    this.rings = [];
  }

  burst(x, y, opts) {
    const count = opts.count || 10;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = (opts.speed || 120) * (0.3 + Math.random() * 0.9);
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed + (opts.vx || 0),
        vy: Math.sin(angle) * speed + (opts.vy || 0),
        life: (opts.life || 0.6) * (0.6 + Math.random() * 0.7),
        maxLife: opts.life || 0.6,
        size: (opts.size || 3) * (0.6 + Math.random() * 0.8),
        color: opts.color || '#ffcf5c',
        drag: opts.drag || 2.5,
        gravity: opts.gravity || 0,
      });
    }
    if (this.particles.length > 600) this.particles.splice(0, this.particles.length - 600);
  }

  smoke(x, y, color) {
    this.particles.push({
      x: x + (Math.random() - 0.5) * 8, y: y + (Math.random() - 0.5) * 8,
      vx: (Math.random() - 0.5) * 24, vy: -18 - Math.random() * 22,
      life: 0.9 + Math.random() * 0.5, maxLife: 1.2,
      size: 5 + Math.random() * 5, color: color || '#8a8a8a', drag: 1.2, gravity: -14,
    });
  }

  blood(x, y) {
    this.burst(x, y, { count: 8, speed: 130, life: 0.5, size: 3, color: '#c22e2e' });
  }

  sparks(x, y) {
    this.burst(x, y, { count: 6, speed: 190, life: 0.35, size: 2, color: '#ffd76a' });
  }

  explosion(x, y) {
    this.burst(x, y, { count: 34, speed: 260, life: 0.8, size: 6, color: '#ff8a2a' });
    this.burst(x, y, { count: 20, speed: 150, life: 1.1, size: 8, color: '#5a5a5a' });
    this.rings.push({ x, y, r: 12, maxR: 130, life: 0.45, maxLife: 0.45 });
  }

  skid(x, y, angle) {
    this.skids.push({ x, y, angle, life: 5 });
    if (this.skids.length > 400) this.skids.splice(0, this.skids.length - 400);
  }

  floatText(x, y, text, color) {
    this.texts.push({ x, y, text, color: color || '#ffffff', life: 1.2, maxLife: 1.2 });
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) { this.particles.splice(i, 1); continue; }
      const drag = Math.exp(-p.drag * dt);
      p.vx *= drag;
      p.vy *= drag;
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    for (let i = this.skids.length - 1; i >= 0; i--) {
      this.skids[i].life -= dt;
      if (this.skids[i].life <= 0) this.skids.splice(i, 1);
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= dt;
      t.y -= 42 * dt;
      if (t.life <= 0) this.texts.splice(i, 1);
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life -= dt;
      r.r = r.maxR * (1 - r.life / r.maxLife);
      if (r.life <= 0) this.rings.splice(i, 1);
    }
  }

  drawUnder(ctx) {
    for (const s of this.skids) {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.angle);
      ctx.globalAlpha = clamp(s.life / 5, 0, 1) * 0.5;
      ctx.fillStyle = '#22222a';
      ctx.fillRect(-7, -2.5, 14, 5);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  drawOver(ctx) {
    for (const r of this.rings) {
      ctx.save();
      ctx.globalAlpha = clamp(r.life / r.maxLife, 0, 1) * 0.8;
      ctx.strokeStyle = '#ffdf8a';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    for (const p of this.particles) {
      ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.font = 'bold 15px Verdana, sans-serif';
    for (const t of this.texts) {
      ctx.globalAlpha = clamp(t.life / t.maxLife, 0, 1);
      ctx.fillStyle = '#101010';
      ctx.fillText(t.text, t.x + 1, t.y + 1);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }
}
