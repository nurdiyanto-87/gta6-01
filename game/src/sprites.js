// Solmar Heat — procedural sprites.
// Every visible thing is drawn with canvas paths: no image files, no assets.
// Cars, people, buildings and props all come from these functions, so the
// whole game ships as code and stays under the dossier's limits.

import { PALETTE } from './config.js';

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---- cars ----
// Car bodies are drawn pointing along +X; the caller rotates the context.
export function drawCar(ctx, car, time) {
  const L = car.def.length, W = car.def.width;
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  // Soft shadow under the car.
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  rr(ctx, -L / 2 + 3, -W / 2 + 4, L, W, 8);
  ctx.fill();
  // Wheels.
  ctx.fillStyle = '#1c1c22';
  const wl = 11, ww = 6;
  const wx = L / 2 - 12, wy = W / 2 - 2;
  const steer = (car.steer || 0) * 0.42;
  drawWheel(ctx, wx, -wy, wl, ww, steer);
  drawWheel(ctx, wx, wy - ww, wl, ww, steer);
  drawWheel(ctx, -wx - wl, -wy, wl, ww, 0);
  drawWheel(ctx, -wx - wl, wy - ww, wl, ww, 0);
  // Body.
  ctx.fillStyle = car.color;
  rr(ctx, -L / 2, -W / 2, L, W, 8);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  rr(ctx, -L / 2 + 3, -W / 2 + 3, L - 6, W * 0.32, 6);
  ctx.fill();
  // Cabin / windshield.
  const cabL = L * 0.44, cabW = W * 0.78;
  ctx.fillStyle = car.def.cabin || '#20242c';
  rr(ctx, -cabL * 0.28, -cabW / 2, cabL, cabW, 6);
  ctx.fill();
  ctx.fillStyle = 'rgba(160,210,235,0.55)';
  rr(ctx, cabL * 0.42, -cabW / 2 + 3, 7, cabW - 6, 3);
  ctx.fill();
  // Headlights and tail lights.
  ctx.fillStyle = '#fff6c8';
  ctx.fillRect(L / 2 - 3, -W / 2 + 4, 3, 6);
  ctx.fillRect(L / 2 - 3, W / 2 - 10, 3, 6);
  ctx.fillStyle = '#e04040';
  ctx.fillRect(-L / 2, -W / 2 + 4, 3, 6);
  ctx.fillRect(-L / 2, W / 2 - 10, 3, 6);
  // Damage: dents show as dark patches as health drops.
  if (car.health < 70) {
    ctx.fillStyle = 'rgba(30,30,34,0.35)';
    ctx.beginPath();
    ctx.arc(-L * 0.28, -W * 0.2, 9, 0, Math.PI * 2);
    ctx.fill();
  }
  if (car.health < 40) {
    ctx.fillStyle = 'rgba(30,30,34,0.4)';
    ctx.beginPath();
    ctx.arc(L * 0.2, W * 0.18, 11, 0, Math.PI * 2);
    ctx.fill();
  }
  // Police light bar.
  if (car.def.police) {
    const phase = Math.floor(time * 6) % 2 === 0;
    ctx.fillStyle = '#22242c';
    rr(ctx, -8, -W / 2 + 4, 16, W - 8, 3);
    ctx.fill();
    ctx.fillStyle = phase ? '#ff4040' : '#4080ff';
    ctx.fillRect(-6, -W / 2 + 6, 12, 8);
    ctx.fillStyle = phase ? '#4080ff' : '#ff4040';
    ctx.fillRect(-6, W / 2 - 14, 12, 8);
  }
  ctx.restore();
}

function drawWheel(ctx, x, y, w, h, steer) {
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(steer);
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.restore();
}

// ---- people ----
export function drawPerson(ctx, p, time) {
  ctx.save();
  ctx.translate(p.x, p.y);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(2, 3, 11, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(p.angle);
  const walk = p.moving ? Math.sin(time * 11 + (p.phase || 0)) * 4 : 0;
  // Legs.
  ctx.fillStyle = p.pants || '#3a4a6b';
  ctx.fillRect(-3, -8 + walk, 7, 6);
  ctx.fillRect(-3, 2 - walk, 7, 6);
  // Body.
  ctx.fillStyle = p.shirt || '#d8d8d8';
  rr(ctx, -8, -9, 16, 18, 5);
  ctx.fill();
  // Arms: one holds the weapon when armed.
  ctx.fillStyle = p.shirt || '#d8d8d8';
  ctx.fillRect(2, -12, 9, 5);
  ctx.fillRect(2, 7, 9, 5);
  if (p.armed) {
    ctx.fillStyle = '#22242c';
    ctx.fillRect(9, -3, 11, 4);
  }
  // Head.
  ctx.fillStyle = p.skin || '#e8b98a';
  ctx.beginPath();
  ctx.arc(1, 0, 6.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = p.hair || '#4a3220';
  ctx.beginPath();
  ctx.arc(-1, 0, 6.5, Math.PI * 0.5, Math.PI * 1.5);
  ctx.fill();
  ctx.restore();
  // Health pip above enemies.
  if (p.showHealth && p.health < p.maxHealth) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(p.x - 14, p.y - 24, 28, 5);
    ctx.fillStyle = '#e04040';
    ctx.fillRect(p.x - 13, p.y - 23, 26 * Math.max(0, p.health / p.maxHealth), 3);
  }
}

// ---- buildings ----
// A building is a roof with a sun-cast shadow and a lit wall face, so the
// flat map reads as a 3D city from above.
export function drawBuilding(ctx, b, time) {
  const h = b.height;
  const sx = h * 3.2, sy = h * 2.2; // shadow offset: sun from the north-west
  ctx.fillStyle = 'rgba(0,0,0,0.20)';
  ctx.fillRect(b.x + sx, b.y + sy, b.w, b.h);
  // Wall face (south edge) for height.
  ctx.fillStyle = shade(b.color, -28);
  ctx.fillRect(b.x, b.y + b.h, b.w, Math.min(10, 2 + h));
  // Roof.
  ctx.fillStyle = b.roof;
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 2;
  ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
  // Roof detail: vents and a skylight, placed by the building's seed.
  const rng = seeded(b.seed);
  ctx.fillStyle = 'rgba(0,0,0,0.14)';
  const vents = b.type === 'warehouse' ? 4 : 2;
  for (let i = 0; i < vents; i++) {
    const vx = b.x + 10 + rng() * (b.w - 26);
    const vy = b.y + 10 + rng() * (b.h - 26);
    ctx.fillRect(vx, vy, 12, 9);
  }
  if (b.type === 'tower' || b.type === 'office') {
    // Glass curtain: a grid of windows on the roof face.
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    const cols = Math.max(2, Math.floor(b.w / 26));
    const rows = Math.max(2, Math.floor(b.h / 26));
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        if (seeded(b.seed * 31 + i * 7 + j * 13)() < 0.5) {
          ctx.fillRect(b.x + 8 + i * ((b.w - 16) / cols), b.y + 8 + j * ((b.h - 16) / rows), 9, 7);
        }
      }
    }
  }
  if (b.type === 'house') {
    // Pitched roof ridge.
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(b.x + 6, b.y + b.h / 2);
    ctx.lineTo(b.x + b.w - 6, b.y + b.h / 2);
    ctx.stroke();
  }
  if (b.type === 'shop') {
    // Shop awning on the south face.
    ctx.fillStyle = shade(b.color, -60);
    ctx.fillRect(b.x + 6, b.y + b.h - 4, b.w - 12, 8);
  }
  // Landmark sign.
  if (b.landmark) {
    ctx.save();
    ctx.font = 'bold 13px Verdana, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    const tw = ctx.measureText(b.landmark.sign).width + 16;
    rr(ctx, b.cx - tw / 2, b.y + b.h + 12, tw, 20, 5);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(b.landmark.sign, b.cx, b.y + b.h + 27);
    ctx.restore();
  }
}

export function drawProp(ctx, p, time) {
  ctx.save();
  ctx.translate(p.x, p.y);
  if (p.kind === 'tree' || p.kind === 'palm') {
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(4, 5, p.r + 2, p.r * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    if (p.kind === 'tree') {
      ctx.fillStyle = PALETTE.treeDark;
      ctx.beginPath(); ctx.arc(0, 0, p.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = PALETTE.tree;
      ctx.beginPath(); ctx.arc(-2, -2, p.r * 0.72, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#6fae52';
      ctx.beginPath(); ctx.arc(-4, -4, p.r * 0.38, 0, Math.PI * 2); ctx.fill();
    } else {
      // Palm: trunk + radiating fronds.
      ctx.strokeStyle = '#8a6a44';
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(0, 6); ctx.lineTo(2, -4); ctx.stroke();
      ctx.strokeStyle = PALETTE.palm;
      ctx.lineWidth = 3;
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2 + p.seed;
        ctx.beginPath();
        ctx.moveTo(2, -4);
        ctx.quadraticCurveTo(Math.cos(a) * 10, -4 + Math.sin(a) * 10, Math.cos(a) * 17, Math.sin(a) * 17 + 3);
        ctx.stroke();
      }
    }
  } else if (p.kind === 'lamp') {
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath(); ctx.arc(2, 2, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3c3c44';
    ctx.fillRect(-2, -2, 4, 4);
    ctx.fillStyle = '#ffe9a8';
    ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill();
  } else if (p.kind === 'hydrant') {
    ctx.fillStyle = '#c8352c';
    ctx.fillRect(-4, -5, 8, 10);
    ctx.fillStyle = '#a02820';
    ctx.fillRect(-5, -7, 10, 3);
  } else if (p.kind === 'crate') {
    ctx.save();
    ctx.rotate(p.angle || 0);
    ctx.fillStyle = '#a8825a';
    ctx.fillRect(-9, -9, 18, 18);
    ctx.strokeStyle = '#7a5c38';
    ctx.lineWidth = 2;
    ctx.strokeRect(-9, -9, 18, 18);
    ctx.beginPath(); ctx.moveTo(-9, -9); ctx.lineTo(9, 9); ctx.moveTo(9, -9); ctx.lineTo(-9, 9); ctx.stroke();
    ctx.restore();
  } else if (p.kind === 'bench') {
    ctx.save();
    ctx.rotate(p.angle || 0);
    ctx.fillStyle = '#8a6a44';
    ctx.fillRect(-14, -4, 28, 8);
    ctx.fillStyle = '#6a4e2e';
    ctx.fillRect(-14, -6, 28, 3);
    ctx.restore();
  } else if (p.kind === 'pond') {
    ctx.fillStyle = '#5db3d4';
    ctx.beginPath(); ctx.ellipse(0, 0, p.r, p.r * 0.7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.ellipse(-12, -8, p.r * 0.4, p.r * 0.22, -0.4, 0, Math.PI * 2); ctx.fill();
  } else if (p.kind === 'umbrella') {
    ctx.fillStyle = '#e85d5d';
    ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI / 2); ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, 13, Math.PI, Math.PI * 1.5); ctx.fill();
  } else if (p.kind === 'boat') {
    ctx.save();
    ctx.rotate(p.angle || 0);
    ctx.fillStyle = '#f2f2f2';
    rr(ctx, -20, -7, 40, 14, 6);
    ctx.fill();
    ctx.fillStyle = '#3d6b8a';
    ctx.fillRect(-8, -4, 16, 8);
    ctx.restore();
  } else if (p.kind === 'pierhut') {
    ctx.fillStyle = '#a8825a';
    ctx.fillRect(-16, -14, 32, 28);
    ctx.fillStyle = '#c8352c';
    ctx.beginPath();
    ctx.moveTo(-18, -14); ctx.lineTo(0, -26); ctx.lineTo(18, -14);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

// Darken a hex colour by `amt` (negative) or lighten it (positive).
export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amt));
  const b = Math.max(0, Math.min(255, (n & 0xff) + amt));
  return 'rgb(' + r + ',' + g + ',' + b + ')';
}

function seeded(seed) {
  let a = (seed * 2654435761) >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
