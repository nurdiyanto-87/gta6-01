// Solmar Heat — the camera.
// A soft follow camera that leads the player's motion, pulls back at speed
// so driving reads ahead, and shakes with impacts. All world drawing goes
// through its transform.

import { WORLD, clamp, lerp } from './config.js';

export function createCamera(viewW, viewH) {
  return {
    x: WORLD / 2, y: WORLD / 2, // centre of the view, in world pixels
    viewW, viewH,
    zoom: 1,
    targetZoom: 1,

    update(focusX, focusY, speedNorm, dt, shakeOffset) {
      // Lead the motion slightly so the player sees where they are going.
      const lead = 26 + speedNorm * 60;
      const tx = focusX + (this.lookX || 0) * lead;
      const ty = focusY + (this.lookY || 0) * lead;
      const k = 1 - Math.pow(0.0015, dt); // frame-rate independent smoothing
      this.x = lerp(this.x, tx, k);
      this.y = lerp(this.y, ty, k);
      // Pull back as speed rises: 1.0 on foot, 0.82 flat out.
      this.targetZoom = 1 - speedNorm * 0.18;
      this.zoom = lerp(this.zoom, this.targetZoom, Math.min(1, dt * 2.5));
      // Clamp the view inside the world.
      const hw = this.viewW / 2 / this.zoom, hh = this.viewH / 2 / this.zoom;
      this.x = clamp(this.x, hw, WORLD - hw);
      this.y = clamp(this.y, hh, WORLD - hh);
      if (shakeOffset) {
        this.sx = shakeOffset.x;
        this.sy = shakeOffset.y;
      } else {
        this.sx = 0; this.sy = 0;
      }
    },

    // The direction the focus is moving, set by the game each frame.
    lookX: 0, lookY: 0,
    sx: 0, sy: 0,

    apply(ctx) {
      ctx.save();
      ctx.translate(this.viewW / 2, this.viewH / 2);
      ctx.scale(this.zoom, this.zoom);
      ctx.translate(-this.x + this.sx, -this.y + this.sy);
    },

    screenToWorld(sx, sy) {
      return {
        x: (sx - this.viewW / 2) / this.zoom + this.x - this.sx,
        y: (sy - this.viewH / 2) / this.zoom + this.y - this.sy,
      };
    },

    visibleRect() {
      const hw = this.viewW / 2 / this.zoom + 40;
      const hh = this.viewH / 2 / this.zoom + 40;
      return { x: this.x - hw, y: this.y - hh, w: hw * 2, h: hh * 2 };
    },
  };
}
