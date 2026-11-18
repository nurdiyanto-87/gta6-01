// San Cielo Heat — particles, skid marks, floating texts and flashes:
// the juice that makes a hit feel like a hit.

import { clamp } from './util.js';

export class Effects {
  constructor() {
    this.particles = [];
    this.skids = [];
    this.floaters = [];
    this.flash = 0;
    this.flashColor = '255,255,255';
  }

  burst(x, y, count, opts) {
    const o = opts || {};
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (o.speed || 120) * (0.4 + Math.random() * 0.8);
      this.particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: (o.life || 0.5) * (0.6 + Math.random() * 0.7),
        maxLife: o.life || 0.5,
        size: (o.size || 3) * (0.6 + Math.random() * 0.8),
        color: o.color || '#ffcf5a',
        drag: o.drag || 3,
        gravity: o.gravity || 0,
      });
    }
    if (this.particles.length > 600) this.particles.splice(0, this.particles.length - 600);
  }

  sparks(x, y) {
    this.burst(x, y, 10, { speed: 220, life: 0.35, size: 2.5, color: '#ffd94a' });
  }

  smoke(x, y, big) {
    this.burst(x, y, big ? 6 : 3, { speed: 40, life: 0.9, size: big ? 9 : 6, color: 'rgba(120,120,120,0.5)', drag: 1 });
  }

  dust(x, y) {
    this.burst(x, y, 4, { speed: 60, life: 0.5, size: 5, color: 'rgba(203,195,178,0.6)', drag: 2 });
  }

  hitPuff(x, y) {
    this.burst(x, y, 8, { speed: 90, life: 0.4, size: 3.5, color: '#c94a3a' });
  }

  muzzle(x, y, angle) {
    this.burst(x + Math.cos(angle) * 14, y + Math.sin(angle) * 14, 3, { speed: 60, life: 0.08, size: 4, color: '#ffe9a3' });
  }

  blood(x, y) {
    this.burst(x, y, 7, { speed: 110, life: 0.5, size: 3, color: '#a8281e', gravity: 160 });
  }

  addSkid(x, y, angle) {
    this.skids.push({ x, y, angle, life: 5 });
    if (this.skids.length > 400) this.skids.splice(0, this.skids.length - 400);
  }

  floater(x, y, text, color) {
    this.floaters.push({ x, y, text, color: color || '#ffffff', life: 1.4 });
  }

  screenFlash(color, amount) {
    this.flash = Math.max(this.flash, amount);
    this.flashColor = color;
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) { this.particles.splice(i, 1); continue; }
      const d = Math.exp(-p.drag * dt);
      p.vx *= d;
      p.vy *= d;
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    for (let i = this.skids.length - 1; i >= 0; i--) {
      this.skids[i].life -= dt;
      if (this.skids[i].life <= 0) this.skids.splice(i, 1);
    }
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.life -= dt;
      f.y -= 34 * dt;
      if (f.life <= 0) this.floaters.splice(i, 1);
    }
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 2.4);
  }

  drawWorld(ctx) {
    // Skid marks lie flat on the asphalt.
    for (const s of this.skids) {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.angle);
      ctx.fillStyle = 'rgba(20,20,22,' + (0.35 * clamp(s.life / 5, 0, 1)).toFixed(3) + ')';
      ctx.fillRect(-7, -2, 14, 4);
      ctx.restore();
    }
    for (const p of this.particles) {
      const a = clamp(p.life / p.maxLife, 0, 1);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.5 + a * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.font = 'bold 15px sans-serif';
    for (const f of this.floaters) {
      ctx.globalAlpha = clamp(f.life, 0, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillText(f.text, f.x + 1, f.y + 1);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }

  drawScreenFlash(ctx, w, h) {
    if (this.flash <= 0) return;
    ctx.fillStyle = 'rgba(' + this.flashColor + ',' + (this.flash * 0.35).toFixed(3) + ')';
    ctx.fillRect(0, 0, w, h);
  }
}
