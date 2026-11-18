// San Cielo Heat — the camera: follows the player with a soft lag, looks
// ahead in the direction of travel, and shakes on impacts.

import { WORLD } from './config.js';
import { clamp, damp } from './util.js';

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
    this.shake = 0;
  }

  addShake(amount) {
    this.shake = Math.min(26, this.shake + amount);
  }

  update(targetX, targetY, lookX, lookY, dt) {
    const focusX = targetX + (lookX || 0) * 70;
    const focusY = targetY + (lookY || 0) * 70;
    this.x = damp(this.x, focusX, 5.5, dt);
    this.y = damp(this.y, focusY, 5.5, dt);
    const halfW = this.viewW / 2 / this.zoom;
    const halfH = this.viewH / 2 / this.zoom;
    this.x = clamp(this.x, halfW - 120, WORLD - halfW + 120);
    this.y = clamp(this.y, halfH - 120, WORLD - halfH + 120);
    if (this.shake > 0.2) {
      this.shake = damp(this.shake, 0, 6, dt);
      this.shakeX = (Math.random() * 2 - 1) * this.shake;
      this.shakeY = (Math.random() * 2 - 1) * this.shake;
    } else {
      this.shake = 0;
      this.shakeX = 0;
      this.shakeY = 0;
    }
  }

  // World coordinates of the top-left corner of the visible area.
  viewLeft() { return this.x - this.viewW / 2 / this.zoom + this.shakeX; }
  viewTop() { return this.y - this.viewH / 2 / this.zoom + this.shakeY; }

  toScreen(wx, wy) {
    return {
      x: (wx - this.x) * this.zoom + this.viewW / 2 + this.shakeX,
      y: (wy - this.y) * this.zoom + this.viewH / 2 + this.shakeY,
    };
  }

  toWorld(sx, sy) {
    return {
      x: (sx - this.viewW / 2 - this.shakeX) / this.zoom + this.x,
      y: (sy - this.viewH / 2 - this.shakeY) / this.zoom + this.y,
    };
  }
}
