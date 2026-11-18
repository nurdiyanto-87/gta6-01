// San Cielo Heat — the chase camera: smooth follow, speed zoom-out,
// and impact shake. The world is drawn through this transform.

import { WORLD } from './config.js';
import { clamp, damp, lerp } from './util.js';

export class Camera {
  constructor(viewW, viewH) {
    this.x = WORLD / 2;
    this.y = WORLD / 2;
    this.viewW = viewW;
    this.viewH = viewH;
    this.zoom = 1;
    this.shake = 0;
    this.shakeX = 0;
    this.shakeY = 0;
  }

  resize(viewW, viewH) {
    this.viewW = viewW;
    this.viewH = viewH;
  }

  snapTo(x, y) {
    this.x = x;
    this.y = y;
  }

  follow(targetX, targetY, speed, dt) {
    // Lead slightly in the direction of travel so fast driving reads ahead.
    const lead = clamp(speed / 300, 0, 1) * 40;
    const tx = targetX + Math.cos(this.leadAngle || 0) * lead;
    const ty = targetY + Math.sin(this.leadAngle || 0) * lead;
    this.x = damp(this.x, tx, 5, dt);
    this.y = damp(this.y, ty, 5, dt);
    const wantZoom = speed > 220 ? 0.88 : speed > 120 ? 0.95 : 1;
    this.zoom = damp(this.zoom, wantZoom, 2.5, dt);
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 26);
      this.shakeX = (Math.random() - 0.5) * this.shake;
      this.shakeY = (Math.random() - 0.5) * this.shake;
    } else {
      this.shakeX = 0;
      this.shakeY = 0;
    }
  }

  setLeadAngle(angle) {
    this.leadAngle = angle;
  }

  addShake(amount) {
    this.shake = Math.min(18, this.shake + amount);
  }

  apply(ctx) {
    ctx.save();
    ctx.translate(this.viewW / 2 + this.shakeX, this.viewH / 2 + this.shakeY);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.x, -this.y);
  }

  restore(ctx) {
    ctx.restore();
  }

  viewBounds() {
    const hw = this.viewW / 2 / this.zoom;
    const hh = this.viewH / 2 / this.zoom;
    return { x0: this.x - hw - 40, y0: this.y - hh - 40, x1: this.x + hw + 40, y1: this.y + hh + 40 };
  }

  screenToWorld(sx, sy) {
    return {
      x: this.x + (sx - this.viewW / 2) / this.zoom,
      y: this.y + (sy - this.viewH / 2) / this.zoom,
    };
  }

  visible(x, y, margin) {
    const b = this.viewBounds();
    return x >= b.x0 - margin && x <= b.x1 + margin && y >= b.y0 - margin && y <= b.y1 + margin;
  }
}
