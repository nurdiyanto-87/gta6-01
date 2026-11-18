// San Cielo Heat — procedural top-down art: every car, person, building
// and tree is drawn from shapes, so the game ships no image assets.

import { PALETTE } from './config.js';

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amt));
  const b = Math.max(0, Math.min(255, (n & 0xff) + amt));
  return 'rgb(' + r + ',' + g + ',' + b + ')';
}

// ---- vehicles ----
// Cars point along +X when angle is 0. Length runs along X, width along Y.
export function drawVehicle(ctx, x, y, angle, def, color, opts) {
  const o = opts || {};
  const L = def.length;
  const W = def.width;
  const steer = o.steer || 0;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  // Soft shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  roundRectPath(ctx, -L / 2 + 3, -W / 2 + 4, L, W, 8);
  ctx.fill();

  // Wheels: front pair steers.
  ctx.fillStyle = '#1c1c20';
  const wheelW = 10;
  const wheelH = 5;
  const wy = W / 2 - 1;
  const wx = L / 2 - 12;
  for (const [fx, fy, front] of [[wx, -wy, true], [wx, wy, true], [-wx, -wy, false], [-wx, wy, false]]) {
    ctx.save();
    ctx.translate(fx, fy);
    if (front) ctx.rotate(steer * 0.45);
    ctx.fillRect(-wheelW / 2, -wheelH / 2, wheelW, wheelH);
    ctx.restore();
  }

  // Body.
  ctx.fillStyle = o.wrecked ? shade(color, -60) : color;
  roundRectPath(ctx, -L / 2, -W / 2, L, W, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Cabin: windshield + roof.
  const cabinL = L * 0.44;
  const cabinW = W * 0.78;
  ctx.fillStyle = '#20262e';
  roundRectPath(ctx, -cabinL / 2 + L * 0.04, -cabinW / 2, cabinL, cabinW, 5);
  ctx.fill();
  ctx.fillStyle = shade(color, 26);
  roundRectPath(ctx, -cabinL / 2 + L * 0.02, -cabinW / 2 + 3, cabinL * 0.55, cabinW - 6, 4);
  ctx.fill();

  // Headlights and taillights.
  ctx.fillStyle = '#fff6c8';
  ctx.fillRect(L / 2 - 3, -W / 2 + 4, 3, 6);
  ctx.fillRect(L / 2 - 3, W / 2 - 10, 3, 6);
  ctx.fillStyle = '#d93a2b';
  ctx.fillRect(-L / 2, -W / 2 + 4, 3, 6);
  ctx.fillRect(-L / 2, W / 2 - 10, 3, 6);

  if (def.kind === 'pickup') {
    ctx.fillStyle = shade(color, -30);
    ctx.fillRect(-L / 2 + 6, -W / 2 + 5, L * 0.3, W - 10);
  }
  if (def.kind === 'van') {
    ctx.fillStyle = shade(color, 18);
    roundRectPath(ctx, -L / 2 + 4, -W / 2 + 4, L - 8, W - 8, 6);
    ctx.fill();
    ctx.fillStyle = '#20262e';
    ctx.fillRect(L / 2 - 12, -W / 2 + 5, 7, W - 10);
  }
  if (o.taxi) {
    ctx.fillStyle = '#1c1c20';
    ctx.fillRect(-6, -W / 2 + 2, 12, 5);
    ctx.fillRect(-6, W / 2 - 7, 12, 5);
    ctx.fillStyle = '#f5c81e';
    ctx.fillRect(-5, -4, 10, 8);
  }
  if (o.police) {
    // Black-and-white livery with a flashing light bar.
    ctx.fillStyle = '#f2f2ee';
    ctx.fillRect(-L * 0.1, -W / 2 + 2, L * 0.34, W - 4);
    ctx.fillStyle = '#1c1c20';
    ctx.font = 'bold 7px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SCPD', L * 0.07, 3);
    const phase = Math.floor((o.time || 0) * 6) % 2;
    ctx.fillStyle = phase === 0 ? '#ff3b30' : '#3b7bff';
    ctx.fillRect(-4, -W / 2 - 1, 8, 5);
    ctx.fillStyle = phase === 0 ? '#3b7bff' : '#ff3b30';
    ctx.fillRect(-4, W / 2 - 4, 8, 5);
  }
  if (o.damage > 55) {
    // Smoke wisps from a battered engine.
    ctx.fillStyle = 'rgba(120,120,120,0.35)';
    ctx.beginPath();
    ctx.arc(L / 2 - 6, 0, 7 + Math.sin((o.time || 0) * 9) * 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ---- people ----

export function drawPerson(ctx, x, y, angle, look, walkPhase, opts) {
  const o = opts || {};
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const bob = Math.sin(walkPhase || 0) * 1.5;

  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(2, 3, 10, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  // Legs (two small feet stepping).
  ctx.fillStyle = look.pants;
  ctx.fillRect(-3, -6 + bob, 7, 4);
  ctx.fillRect(-3, 2 - bob, 7, 4);

  // Torso.
  ctx.fillStyle = look.shirt;
  roundRectPath(ctx, -7, -7, 14, 14, 5);
  ctx.fill();

  // Arms: forward arm holds a weapon when armed.
  ctx.fillStyle = look.shirt;
  ctx.fillRect(4, -8, 6, 4);
  ctx.fillRect(4, 4, 6, 4);
  if (o.weapon) {
    ctx.fillStyle = '#2a2a2e';
    ctx.fillRect(8, -2, 9, 3);
  }

  // Head with hair.
  ctx.fillStyle = look.skin;
  ctx.beginPath();
  ctx.arc(1, 0, 5.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = look.hair;
  ctx.beginPath();
  ctx.arc(-1, 0, 5.5, Math.PI * 0.5, Math.PI * 1.5);
  ctx.fill();

  if (o.down) {
    ctx.fillStyle = 'rgba(160,30,20,0.5)';
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ---- buildings ----

export function drawBuilding(ctx, b, time) {
  const h = b.hgt;
  // Long afternoon shadow, cast south-east.
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(b.x + h * 0.35, b.y + h * 0.3, b.w, b.h);

  // Walls: the south and east faces catch the light differently.
  ctx.fillStyle = shade(b.wall, -24);
  ctx.fillRect(b.x, b.y + b.h - 6, b.w, 6);
  ctx.fillStyle = b.wall;
  ctx.fillRect(b.x, b.y, b.w, b.h);

  if (b.kind === 'tower' || b.kind === 'hotel' || b.kind === 'apartment') {
    // Window grid.
    ctx.fillStyle = 'rgba(30,50,66,0.55)';
    const cols = Math.max(2, Math.floor(b.w / 22));
    const rows = Math.max(2, Math.floor(b.h / 22));
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        ctx.fillRect(b.x + 6 + i * ((b.w - 12) / cols), b.y + 6 + j * ((b.h - 12) / rows), 9, 7);
      }
    }
  }
  if (b.kind === 'house') {
    // Pitched roof: a ridge line and two slopes.
    ctx.fillStyle = shade(b.roof, -10);
    ctx.beginPath();
    ctx.moveTo(b.x, b.y + b.h);
    ctx.lineTo(b.x + b.w / 2, b.y);
    ctx.lineTo(b.x + b.w, b.y + b.h);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = shade(b.roof, 14);
    ctx.beginPath();
    ctx.moveTo(b.x, b.y + b.h);
    ctx.lineTo(b.x + b.w / 2, b.y);
    ctx.lineTo(b.x + b.w / 2, b.y + b.h);
    ctx.closePath();
    ctx.fill();
  }
  if (b.kind === 'arena') {
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 4;
    ctx.strokeRect(b.x + 8, b.y + 8, b.w - 16, b.h - 16);
    ctx.fillStyle = '#7fae56';
    ctx.fillRect(b.x + b.w / 2 - 30, b.y + b.h / 2 - 20, 60, 40);
  }
  if (b.kind === 'lighthouse') {
    ctx.fillStyle = '#d95f4b';
    ctx.fillRect(b.x, b.y + b.h * 0.3, b.w, 8);
    ctx.fillRect(b.x, b.y + b.h * 0.65, b.w, 8);
  }
  if (b.awning) {
    ctx.fillStyle = b.awning;
    ctx.fillRect(b.x, b.y + b.h - 2, b.w, 8);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (let sx = b.x + 6; sx < b.x + b.w; sx += 16) ctx.fillRect(sx, b.y + b.h - 2, 8, 8);
  }
  // Roof lip.
  ctx.strokeStyle = 'rgba(0,0,0,0.22)';
  ctx.lineWidth = 2;
  ctx.strokeRect(b.x, b.y, b.w, b.h);
  if (b.name) {
    ctx.fillStyle = 'rgba(20,20,24,0.75)';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(b.name.toUpperCase(), b.x + b.w / 2, b.y - 8);
  }
}

// ---- nature and street props ----

export function drawTree(ctx, t, time) {
  const sway = Math.sin(time * 0.8 + t.sway) * 1.5;
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(t.x + 4, t.y + 5, t.r, t.r * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();
  if (t.kind === 'palm') {
    ctx.strokeStyle = PALETTE.palmTrunk;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(t.x, t.y + 4);
    ctx.quadraticCurveTo(t.x + sway, t.y - 8, t.x + sway * 2, t.y - 16);
    ctx.stroke();
    ctx.strokeStyle = PALETTE.palm;
    ctx.lineWidth = 3;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + t.sway;
      ctx.beginPath();
      ctx.moveTo(t.x + sway * 2, t.y - 16);
      ctx.quadraticCurveTo(
        t.x + sway * 2 + Math.cos(a) * 9, t.y - 16 + Math.sin(a) * 9 - 3,
        t.x + sway * 2 + Math.cos(a) * 15, t.y - 16 + Math.sin(a) * 15 + 4,
      );
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = PALETTE.treeDark;
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.tree;
    ctx.beginPath();
    ctx.arc(t.x - 2 + sway * 0.4, t.y - 2, t.r * 0.75, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawLamp(ctx, lamp) {
  ctx.fillStyle = '#3a3a40';
  ctx.fillRect(lamp.x - 2, lamp.y - 2, 4, 4);
  ctx.fillStyle = '#f5eec8';
  ctx.beginPath();
  ctx.arc(lamp.x, lamp.y, 3, 0, Math.PI * 2);
  ctx.fill();
}

export function drawProp(ctx, prop) {
  if (prop.kind === 'bench') {
    ctx.fillStyle = '#8a6b4a';
    ctx.fillRect(prop.x - 12, prop.y - 4, 24, 8);
    ctx.fillStyle = '#6d5439';
    ctx.fillRect(prop.x - 12, prop.y - 7, 24, 3);
  } else if (prop.kind === 'crate') {
    ctx.fillStyle = '#b08d55';
    ctx.fillRect(prop.x - 9, prop.y - 9, 18, 18);
    ctx.strokeStyle = '#8a6b3d';
    ctx.strokeRect(prop.x - 9, prop.y - 9, 18, 18);
  } else if (prop.kind === 'crane') {
    ctx.strokeStyle = '#c96f2e';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(prop.x, prop.y + 40);
    ctx.lineTo(prop.x, prop.y - 50);
    ctx.lineTo(prop.x + 70, prop.y - 50);
    ctx.stroke();
    ctx.strokeStyle = '#a85a24';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(prop.x + 70, prop.y - 50);
    ctx.lineTo(prop.x + 70, prop.y - 20);
    ctx.stroke();
  } else if (prop.kind === 'pond') {
    ctx.fillStyle = '#4aa8c4';
    ctx.beginPath();
    ctx.ellipse(prop.x + prop.w / 2, prop.y + prop.h / 2, prop.w / 2, prop.h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.ellipse(prop.x + prop.w / 2 - 18, prop.y + prop.h / 2 - 10, 22, 9, -0.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawWantedStar(ctx, x, y, r, filled, time) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    if (i === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = filled ? '#ffd94a' : 'rgba(20,20,24,0.45)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}
