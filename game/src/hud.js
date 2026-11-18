// San Cielo Heat — the HUD and the menus: health and armour, wanted
// stars, the live minimap, objective banners, and every screen the game
// shows between the action.

import { OCEAN_Y, PALETTE, PLACES, ROAD_CENTERS, ROAD_WIDTH, WORLD } from './config.js';
import { clamp, dist, formatClock, formatMoney, formatTime } from './util.js';
import { drawWantedStar } from './sprites.js';
import { WEAPONS } from './player.js';

const MINIMAP_SIZE = 196;
const MINIMAP_WORLD = 1100; // world pixels across the minimap window

let minimapBase = null;

function buildMinimapBase(city) {
  const scale = 360 / WORLD;
  const c = document.createElement('canvas');
  c.width = 360;
  c.height = 360;
  const g = c.getContext('2d');
  g.fillStyle = PALETTE.grass;
  g.fillRect(0, 0, 360, 360);
  g.fillStyle = PALETTE.sand;
  g.fillRect(0, (ROAD_CENTERS[7] + ROAD_WIDTH / 2) * scale, 360, 360);
  g.fillStyle = PALETTE.ocean;
  g.fillRect(0, OCEAN_Y * scale, 360, 360);
  // Park blocks read green.
  g.fillStyle = PALETTE.parkGrass;
  for (const col of [3, 4]) {
    for (const row of [3, 4]) {
      g.fillRect((ROAD_CENTERS[col] + ROAD_WIDTH / 2) * scale, (ROAD_CENTERS[row] + ROAD_WIDTH / 2) * scale, (400 - ROAD_WIDTH) * scale, (400 - ROAD_WIDTH) * scale);
    }
  }
  // Roads.
  g.fillStyle = PALETTE.asphalt;
  for (const center of ROAD_CENTERS) {
    g.fillRect((center - ROAD_WIDTH / 2) * scale, 0, ROAD_WIDTH * scale, 360);
    g.fillRect(0, (center - ROAD_WIDTH / 2) * scale, 360, ROAD_WIDTH * scale);
  }
  // Buildings as pale blocks.
  g.fillStyle = 'rgba(232,220,196,0.9)';
  for (const b of city.buildings) {
    g.fillRect(b.x * scale, b.y * scale, Math.max(1.5, b.w * scale), Math.max(1.5, b.h * scale));
  }
  return c;
}

function panel(ctx, x, y, w, h, alpha) {
  ctx.fillStyle = 'rgba(12,14,20,' + (alpha || 0.55) + ')';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function bar(ctx, x, y, w, h, frac, color, back) {
  ctx.fillStyle = back || 'rgba(0,0,0,0.55)';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, h / 2);
  ctx.fill();
  if (frac > 0) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, y, w * clamp(frac, 0, 1), h, h / 2);
    ctx.fill();
  }
}

export function drawHUD(ctx, game) {
  const w = game.viewW;
  const h = game.viewH;
  const player = game.player;

  // ---- top-left: vitals and wallet ----
  panel(ctx, 14, 14, 250, 86, 0.55);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText('MARA VEGA', 26, 34);
  ctx.fillStyle = '#9fe08a';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText(formatMoney(player.money), 26, 54);
  ctx.fillStyle = '#c8d4e0';
  ctx.font = '12px sans-serif';
  ctx.fillText(formatClock(game.time) + '  ·  ' + game.districtName, 150, 54);
  bar(ctx, 26, 62, 150, 9, player.health / 100, player.health > 30 ? '#4ecb5a' : '#e04a3a');
  bar(ctx, 26, 76, 150, 9, player.armor / 100, '#4b8ad9');
  ctx.fillStyle = '#e8e3d3';
  ctx.font = '10px sans-serif';
  ctx.fillText('HP', 182, 70);
  ctx.fillText('ARM', 182, 85);

  // ---- top-right: wanted stars ----
  panel(ctx, w - 196, 14, 182, 44, 0.55);
  for (let i = 0; i < 5; i++) {
    drawWantedStar(ctx, w - 178 + i * 34, 36, 12, i < game.police.wanted, game.time);
  }
  if (game.police.bustTimer > 0) {
    bar(ctx, w - 184, 50, 158, 5, game.police.bustTimer / 2.2, '#e04a3a');
  }

  // ---- top-centre: objective ----
  const obj = game.missions.activeObjective(game);
  ctx.font = 'bold 15px sans-serif';
  const objW = Math.min(w - 420, ctx.measureText(obj.text).width + 34);
  panel(ctx, (w - objW) / 2, 14, objW, 40, 0.6);
  ctx.fillStyle = '#ffd94a';
  ctx.textAlign = 'center';
  let line = obj.text;
  if (obj.timer !== null && obj.timer !== undefined) line += '  ·  ' + formatTime(Math.max(0, obj.timer));
  if (obj.x !== null && obj.x !== undefined) {
    const d = Math.round(dist(player.x, player.y, obj.x, obj.y));
    line += '  ·  ' + d + 'm';
  }
  ctx.fillText(line, w / 2, 39);

  // ---- bottom-left: weapon and context hint ----
  panel(ctx, 14, h - 76, 250, 62, 0.55);
  const def = WEAPONS[player.weapon];
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText(def.name.toUpperCase(), 26, h - 52);
  ctx.fillStyle = '#ffd94a';
  ctx.font = 'bold 17px sans-serif';
  ctx.fillText(player.ammo === Infinity ? '∞' : String(player.ammo), 26, h - 30);
  ctx.fillStyle = '#c8d4e0';
  ctx.font = '12px sans-serif';
  ctx.fillText('1 Fists · 2 Pistol · 3 SMG', 90, h - 30);
  if (game.hint) {
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(game.hint, 26, h - 88);
  }

  // ---- bottom-right: minimap ----
  drawMinimap(ctx, game, w - MINIMAP_SIZE - 14, h - MINIMAP_SIZE - 14);

  // ---- speedometer when driving ----
  if (player.inCar) {
    const kmh = Math.round(Math.hypot(player.inCar.vx, player.inCar.vy) * 0.45);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText(String(kmh), w - 26, h - MINIMAP_SIZE - 30);
    ctx.font = '11px sans-serif';
    ctx.fillStyle = '#c8d4e0';
    ctx.fillText('KM/H', w - 26, h - MINIMAP_SIZE - 14);
    // Car condition.
    bar(ctx, w - 170, h - MINIMAP_SIZE - 52, 144, 7, player.inCar.health / player.inCar.maxHealth, '#e0a83c');
  }

  // ---- message feed ----
  ctx.textAlign = 'left';
  ctx.font = '13px sans-serif';
  let my = h - 100;
  for (let i = game.messages.length - 1; i >= 0; i--) {
    const m = game.messages[i];
    const a = clamp(m.life / 1.2, 0, 1);
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    const tw = ctx.measureText(m.text).width + 18;
    ctx.fillRect(14, my - 14, tw, 20);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(m.text, 23, my);
    my -= 24;
  }
  ctx.globalAlpha = 1;

  // ---- mission splash banner ----
  if (game.splashTimer > 0) {
    const a = clamp(game.splashTimer, 0, 1);
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, h * 0.3, w, 84);
    ctx.fillStyle = '#ffd94a';
    ctx.font = 'bold 38px sans-serif';
    ctx.fillText(game.splashTitle, w / 2, h * 0.3 + 40);
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px sans-serif';
    ctx.fillText(game.splashSub, w / 2, h * 0.3 + 66);
    ctx.globalAlpha = 1;
  }

  // ---- crosshair on foot ----
  if (!player.inCar && player.weapon !== 'fists' && !player.dead) {
    const mx = game.input.mouse.x;
    const my2 = game.input.mouse.y;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(mx - 9, my2);
    ctx.lineTo(mx - 3, my2);
    ctx.moveTo(mx + 3, my2);
    ctx.lineTo(mx + 9, my2);
    ctx.moveTo(mx, my2 - 9);
    ctx.lineTo(mx, my2 - 3);
    ctx.moveTo(mx, my2 + 3);
    ctx.lineTo(mx, my2 + 9);
    ctx.stroke();
  }

  // ---- hurt vignette ----
  if (player.hurtTimer > 0) {
    ctx.fillStyle = 'rgba(200,30,20,' + (player.hurtTimer * 0.25).toFixed(3) + ')';
    ctx.fillRect(0, 0, w, h);
  }
  if (player.health < 30 && !player.dead) {
    const pulse = 0.08 + Math.sin(game.time * 4) * 0.04;
    ctx.fillStyle = 'rgba(200,30,20,' + pulse.toFixed(3) + ')';
    ctx.fillRect(0, 0, w, h);
  }
}

function drawMinimap(ctx, game, x, y) {
  if (!minimapBase) minimapBase = buildMinimapBase(game.city);
  const player = game.player;
  const scale = 360 / WORLD;
  const half = MINIMAP_WORLD / 2;
  const sx = clamp(player.x * scale - (MINIMAP_WORLD * scale) / 2, 0, 360 - MINIMAP_WORLD * scale);
  const sy = clamp(player.y * scale - (MINIMAP_WORLD * scale) / 2, 0, 360 - MINIMAP_WORLD * scale);
  const sw = MINIMAP_WORLD * scale;

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, MINIMAP_SIZE, MINIMAP_SIZE, 10);
  ctx.clip();
  ctx.drawImage(minimapBase, sx, sy, sw, sw, x, y, MINIMAP_SIZE, MINIMAP_SIZE);

  const toMap = (wx, wy) => ({
    x: x + ((wx - (sx / scale)) / MINIMAP_WORLD) * MINIMAP_SIZE,
    y: y + ((wy - (sy / scale)) / MINIMAP_WORLD) * MINIMAP_SIZE,
  });

  // Objective blip.
  const obj = game.missions.activeObjective(game);
  if (obj.x !== null && obj.x !== undefined) {
    const p = toMap(obj.x, obj.y);
    const pulse = 5 + Math.sin(game.time * 5) * 1.5;
    ctx.fillStyle = '#ffd94a';
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-pulse, -pulse, pulse * 2, pulse * 2);
    ctx.restore();
  }
  // Garage + paint shop.
  for (const [place, color] of [[PLACES.garage, '#7ddb6a'], [PLACES.paintShop, '#e87a9a']]) {
    const p = toMap(place.x, place.y);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  // Cops flash red and blue.
  const flash = Math.floor(game.time * 4) % 2 === 0;
  for (const c of game.police.cruisers) {
    const p = toMap(c.x, c.y);
    ctx.fillStyle = flash ? '#ff3b30' : '#3b7bff';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  // The player: a white arrow pointing where Mara faces.
  const pp = toMap(player.x, player.y);
  ctx.save();
  ctx.translate(pp.x, pp.y);
  ctx.rotate(player.angle);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#1c1c20';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(8, 0);
  ctx.lineTo(-5, -5);
  ctx.lineTo(-3, 0);
  ctx.lineTo(-5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  ctx.restore();

  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, MINIMAP_SIZE, MINIMAP_SIZE, 10);
  ctx.stroke();
  // North tick.
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('N', x + MINIMAP_SIZE / 2, y + 14);
}

// ---- menu screens ----

export function menuButton(ctx, b, hover) {
  ctx.fillStyle = hover ? '#f2c14e' : 'rgba(12,14,20,0.72)';
  ctx.beginPath();
  ctx.roundRect(b.x, b.y, b.w, b.h, 8);
  ctx.fill();
  ctx.strokeStyle = hover ? '#ffffff' : 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = hover ? '#1c1c20' : '#ffffff';
  ctx.font = 'bold 17px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 6);
}

export function titleButtons(w, h, hasSave) {
  const bw = 280;
  const bx = (w - bw) / 2;
  const list = [];
  let y = h * 0.52;
  if (hasSave) {
    list.push({ id: 'continue', label: 'Continue', x: bx, y, w: bw, h: 46 });
    y += 58;
  }
  list.push({ id: 'new', label: 'New Game', x: bx, y, w: bw, h: 46 });
  y += 58;
  list.push({ id: 'help', label: 'How to Play', x: bx, y, w: bw, h: 46 });
  return list;
}

export function drawTitle(ctx, game, buttons, hoverId) {
  const w = game.viewW;
  const h = game.viewH;
  // Sun-soaked gradient sky over the city silhouette.
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#ff9a5a');
  grad.addColorStop(0.45, '#ffcf7a');
  grad.addColorStop(1, '#3d9db8');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  // Skyline silhouette.
  ctx.fillStyle = 'rgba(40,30,50,0.85)';
  const rng = mulberry(7);
  let sx = 0;
  while (sx < w) {
    const bw = 40 + rng() * 80;
    const bh = h * 0.18 + rng() * h * 0.22;
    ctx.fillRect(sx, h * 0.62 - bh, bw, bh + h * 0.4);
    sx += bw + 6;
  }
  ctx.fillStyle = 'rgba(20,16,28,0.9)';
  ctx.fillRect(0, h * 0.62, w, h * 0.38);
  // A soft backdrop keeps the title readable against the skyline.
  ctx.fillStyle = 'rgba(12,10,20,0.38)';
  ctx.beginPath();
  ctx.roundRect(w / 2 - 420, h * 0.17, 840, 148, 16);
  ctx.fill();
  // Title.
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 64px sans-serif';
  ctx.shadowColor = 'rgba(0,0,0,0.4)';
  ctx.shadowBlur = 18;
  ctx.fillText('SAN CIELO HEAT', w / 2, h * 0.3);
  ctx.shadowBlur = 0;
  ctx.font = '18px sans-serif';
  ctx.fillStyle = '#ffe9c8';
  ctx.fillText('An open-world crime story in a sun-soaked city of your own making', w / 2, h * 0.3 + 34);
  ctx.font = '14px sans-serif';
  ctx.fillStyle = '#ffd94a';
  ctx.fillText('Steal cars · Lose the cops · Run six jobs for Ram · Own the bay', w / 2, h * 0.3 + 58);

  for (const b of buttons) menuButton(ctx, b, b.id === hoverId);

  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '12px sans-serif';
  ctx.fillText('WASD drive & walk · Mouse aim · Click shoot · E enter car · P pause · M mute', w / 2, h - 24);
}

function mulberry(seed) {
  let s = seed;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function drawOverlayScreen(ctx, game, title, lines, buttons, hoverId, titleColor) {
  const w = game.viewW;
  const h = game.viewH;
  ctx.fillStyle = 'rgba(8,10,16,0.72)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = titleColor || '#ffd94a';
  ctx.font = 'bold 46px sans-serif';
  ctx.fillText(title, w / 2, h * 0.3);
  ctx.fillStyle = '#ffffff';
  ctx.font = '16px sans-serif';
  lines.forEach((line, i) => ctx.fillText(line, w / 2, h * 0.3 + 40 + i * 26));
  for (const b of buttons) menuButton(ctx, b, b.id === hoverId);
}

export function pauseButtons(w, h) {
  const bw = 260;
  const bx = (w - bw) / 2;
  return [
    { id: 'resume', label: 'Resume', x: bx, y: h * 0.52, w: bw, h: 46 },
    { id: 'help', label: 'How to Play', x: bx, y: h * 0.52 + 58, w: bw, h: 46 },
    { id: 'quit', label: 'Save & Title', x: bx, y: h * 0.52 + 116, w: bw, h: 46 },
  ];
}

export function helpLines() {
  return [
    'WASD / Arrows — walk, or drive when in a car (W accelerate, S brake/reverse)',
    'Shift — run on foot · Space — handbrake while driving',
    'Mouse — aim · Click — shoot · 1 / 2 / 3 — fists, pistol, SMG',
    'E — steal / enter a car, exit a car, start jobs at markers',
    'Steal cars, take courier jobs, and run the six story jobs at Ram\u2019s Garage.',
    'Wanted stars bring the SCPD: break line of sight, or pay for a respray.',
    'P / Esc — pause · M — mute · Progress saves automatically after every job.',
  ];
}

export function endButtons(w, h) {
  const bw = 260;
  const bx = (w - bw) / 2;
  return [
    { id: 'retry', label: 'Back to the Streets', x: bx, y: h * 0.52, w: bw, h: 46 },
    { id: 'quit', label: 'Save & Title', x: bx, y: h * 0.52 + 58, w: bw, h: 46 },
  ];
}
