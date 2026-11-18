// San Cielo Heat — the HUD: health and armour bars, money, wanted stars,
// weapon and ammo, speed, mission objective, messages, and the live minimap,
// plus the title, pause, help and end screens.

import { BLOCK, DISTRICTS, OCEAN_Y, PALETTE, ROAD_CENTERS, ROAD_WIDTH, WORLD } from './config.js';
import { clamp, dist, formatMoney, formatTime, mulberry32 } from './util.js';
import { drawWantedStar } from './sprites.js';

let minimapBase = null;

function buildMinimapBase(city) {
  const size = 180;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const scale = size / WORLD;
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(0, 0, size, size);
  // Ocean.
  ctx.fillStyle = PALETTE.ocean;
  ctx.fillRect(0, OCEAN_Y * scale, size, size - OCEAN_Y * scale);
  // Sand strip.
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(0, (OCEAN_Y - 60) * scale, size, 60 * scale);
  // Blocks.
  for (let col = 0; col < 8; col++) {
    for (let row = 0; row < 8; row++) {
      const x = ROAD_CENTERS[col] + ROAD_WIDTH / 2;
      const y = ROAD_CENTERS[row] + ROAD_WIDTH / 2;
      ctx.fillStyle = '#8aa86a';
      ctx.fillRect(x * scale, y * scale, (BLOCK - ROAD_WIDTH) * scale, (BLOCK - ROAD_WIDTH) * scale);
    }
  }
  // Buildings.
  ctx.fillStyle = '#b8a888';
  for (const b of city.buildings) {
    ctx.fillRect(b.x * scale, b.y * scale, Math.max(1, b.w * scale), Math.max(1, b.h * scale));
  }
  // Roads.
  ctx.fillStyle = '#5a5a64';
  for (const c of ROAD_CENTERS) {
    ctx.fillRect(0, (c - ROAD_WIDTH / 2) * scale, size, ROAD_WIDTH * scale);
    ctx.fillRect((c - ROAD_WIDTH / 2) * scale, 0, ROAD_WIDTH * scale, size);
  }
  return canvas;
}

function panel(ctx, x, y, w, h, alpha) {
  ctx.fillStyle = 'rgba(12,14,20,' + (alpha === undefined ? 0.62 : alpha) + ')';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function bar(ctx, x, y, w, h, frac, color, back) {
  ctx.fillStyle = back || 'rgba(0,0,0,0.55)';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * clamp(frac, 0, 1), h);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w, h);
}

export function drawHUD(ctx, game) {
  const player = game.player;
  const w = game.viewW;
  const h = game.viewH;
  const time = game.time;

  // Top-left: health, armour, money, wanted stars.
  panel(ctx, 14, 14, 240, 108, 0.6);
  ctx.textAlign = 'left';
  ctx.font = 'bold 13px Verdana, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('MARA VEGA', 26, 34);
  ctx.font = '11px Verdana, sans-serif';
  ctx.fillStyle = '#c8c8d0';
  ctx.fillText('HP', 26, 54);
  bar(ctx, 52, 45, 146, 10, player.health / 100, player.health > 30 ? '#5da56a' : '#e84c3d');
  ctx.fillText('AR', 26, 72);
  bar(ctx, 52, 63, 146, 10, player.armor / 100, '#4b8ad9');
  ctx.font = 'bold 16px Verdana, sans-serif';
  ctx.fillStyle = '#7ddb6a';
  ctx.fillText(formatMoney(player.money), 26, 98);
  ctx.fillStyle = '#c8c8d0';
  ctx.font = '11px Verdana, sans-serif';
  ctx.fillText(game.districtName, 150, 98);

  // Wanted stars row under the status panel.
  const starX0 = 26;
  const starY = 132;
  panel(ctx, 14, 122, 240, 30, 0.5);
  for (let i = 0; i < 5; i++) {
    drawWantedStar(ctx, starX0 + 14 + i * 26, starY + 15, 10, i < player.wanted, time);
  }
  ctx.font = '11px Verdana, sans-serif';
  ctx.fillStyle = game.police.searching ? '#ffd94d' : '#c8c8d0';
  ctx.textAlign = 'right';
  ctx.fillText(game.police.searching ? 'EVADE!' : player.wanted > 0 ? 'WANTED' : 'CLEAR', 244, 141);
  ctx.textAlign = 'left';

  // Top-right: minimap.
  drawMinimap(ctx, game, w - 194, 14);

  // Bottom-left: weapon and ammo.
  panel(ctx, 14, h - 76, 210, 62, 0.6);
  ctx.font = 'bold 14px Verdana, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(player.weaponDef.name.toUpperCase(), 26, h - 52);
  ctx.font = '12px Verdana, sans-serif';
  ctx.fillStyle = '#ffd94d';
  const ammoText = player.weapon === 'fists' ? '∞' : String(player.ammo[player.weapon] || 0);
  ctx.fillText('AMMO  ' + ammoText, 26, h - 32);
  ctx.fillStyle = '#c8c8d0';
  ctx.font = '11px Verdana, sans-serif';
  ctx.fillText('1/2/3 or wheel to swap', 110, h - 32);

  // Bottom-right: speed and car state.
  if (player.inCar) {
    panel(ctx, w - 190, h - 76, 176, 62, 0.6);
    const kmh = Math.round(Math.abs(player.inCar.speed) * 0.55);
    ctx.font = 'bold 24px Verdana, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'right';
    ctx.fillText(kmh + '', w - 40, h - 44);
    ctx.font = '11px Verdana, sans-serif';
    ctx.fillStyle = '#c8c8d0';
    ctx.fillText('km/h', w - 40, h - 28);
    ctx.textAlign = 'left';
    ctx.fillText(player.inCar.def.name, w - 178, h - 52);
    bar(ctx, w - 178, h - 40, 90, 8, 1 - player.inCar.damage, player.inCar.damage > 0.6 ? '#e84c3d' : '#e0a83c');
  }

  // Objective line under the minimap.
  const objective = game.missions.objectiveText;
  ctx.font = '13px Verdana, sans-serif';
  const objW = Math.min(w - 460, ctx.measureText(objective).width + 32);
  panel(ctx, (w - objW) / 2, 14, objW, 30, 0.6);
  ctx.fillStyle = '#ffd94d';
  ctx.textAlign = 'center';
  ctx.fillText('◆ ' + objective, w / 2, 34);
  ctx.textAlign = 'left';

  // Hint line above the bottom bar.
  if (game.hint) {
    ctx.font = '13px Verdana, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    const hw = ctx.measureText(game.hint).width + 24;
    ctx.fillRect(w / 2 - hw / 2, h - 108, hw, 24);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(game.hint, w / 2, h - 91);
    ctx.textAlign = 'left';
  }

  // Message feed, bottom centre-left.
  ctx.font = '13px Verdana, sans-serif';
  let my = h - 130;
  for (let i = game.messages.length - 1; i >= 0; i--) {
    const msg = game.messages[i];
    ctx.globalAlpha = clamp(msg.life / 1.5, 0, 1);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(msg.text, 26, my);
    my -= 20;
  }
  ctx.globalAlpha = 1;

  // Centre splash for mission titles.
  if (game.splashTimer > 0) {
    const alpha = clamp(game.splashTimer / 0.6, 0, 1);
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.font = 'bold 44px Georgia, serif';
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillText(game.splashTitle, w / 2 + 2, h * 0.3 + 2);
    ctx.fillStyle = '#ffd94d';
    ctx.fillText(game.splashTitle, w / 2, h * 0.3);
    ctx.font = '17px Verdana, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(game.splashSub, w / 2, h * 0.3 + 30);
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
  }

  // Bust progress bar.
  if (game.police.bustTimer > 0) {
    const bw = 260;
    panel(ctx, (w - bw) / 2, h - 150, bw, 30, 0.7);
    ctx.fillStyle = '#ff5a4d';
    ctx.font = 'bold 12px Verdana, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('BUSTED IN...', w / 2, h - 138);
    bar(ctx, (w - bw) / 2 + 14, h - 132, bw - 28, 8, game.police.bustTimer / 2.2, '#ff5a4d');
    ctx.textAlign = 'left';
  }

  // Damage vignette.
  if (player.hurtTimer > 0) {
    ctx.fillStyle = 'rgba(200,30,20,' + (player.hurtTimer * 0.5) + ')';
    ctx.fillRect(0, 0, w, h);
  }
  // Low health pulse.
  if (player.health <= 30 && player.health > 0) {
    const pulse = 0.08 + 0.06 * Math.sin(time * 4);
    ctx.fillStyle = 'rgba(200,30,20,' + pulse + ')';
    ctx.fillRect(0, 0, w, h);
  }
}

function drawMinimap(ctx, game, x, y) {
  if (!minimapBase) minimapBase = buildMinimapBase(game.city);
  const size = 180;
  panel(ctx, x - 6, y - 6, size + 12, size + 12, 0.7);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, size, size);
  ctx.clip();
  ctx.drawImage(minimapBase, x, y);
  const scale = size / WORLD;
  const player = game.player;
  const px = player.inCar ? player.inCar.x : player.x;
  const py = player.inCar ? player.inCar.y : player.y;

  // Police blips.
  ctx.fillStyle = '#4b8ad9';
  for (const car of game.police.cruisers) {
    ctx.beginPath();
    ctx.arc(x + car.x * scale, y + car.y * scale, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Objective marker, pulsing.
  const obj = game.missions.objectivePoint;
  if (obj) {
    const pulse = 4 + Math.sin(game.time * 5) * 1.5;
    ctx.fillStyle = '#ffd94d';
    ctx.beginPath();
    ctx.arc(x + obj.x * scale, y + obj.y * scale, pulse + 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff8a2a';
    ctx.beginPath();
    ctx.arc(x + obj.x * scale, y + obj.y * scale, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Garage marker.
  ctx.fillStyle = '#5da56a';
  ctx.fillRect(x + 1180 * scale - 3, y + 300 * scale - 3, 6, 6);
  // Player arrow.
  ctx.save();
  ctx.translate(x + px * scale, y + py * scale);
  ctx.rotate(player.inCar ? player.inCar.angle : player.angle);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-5, -4.5);
  ctx.lineTo(-5, 4.5);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  // North label.
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.font = 'bold 10px Verdana, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('N', x + 6, y + 14);
  ctx.restore();
}

export function menuButton(ctx, b, hover) {
  ctx.fillStyle = hover ? 'rgba(255,217,77,0.92)' : 'rgba(16,18,26,0.85)';
  ctx.beginPath();
  ctx.roundRect(b.x, b.y, b.w, b.h, 8);
  ctx.fill();
  ctx.strokeStyle = hover ? '#ffd94d' : 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = hover ? '#181818' : '#ffffff';
  ctx.font = 'bold 16px Verdana, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 6);
  ctx.textAlign = 'left';
}

export function titleButtons(w, h, hasSave) {
  const bw = 280;
  const bx = w / 2 - bw / 2;
  const buttons = [
    { id: 'new', label: 'NEW GAME', x: bx, y: h * 0.56, w: bw, h: 48 },
    { id: 'help', label: 'HOW TO PLAY', x: bx, y: h * 0.56 + 60, w: bw, h: 48 },
  ];
  if (hasSave) {
    buttons.unshift({ id: 'continue', label: 'CONTINUE', x: bx, y: h * 0.56 - 60, w: bw, h: 48 });
  }
  return buttons;
}

export function drawTitle(ctx, game, buttons, hoverId) {
  const w = game.viewW;
  const h = game.viewH;
  // Sun-soaked gradient sky over a silhouetted skyline.
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#ff9a5c');
  grad.addColorStop(0.45, '#ffb877');
  grad.addColorStop(0.7, '#f7c98a');
  grad.addColorStop(1, '#3d6b8a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  // Sun.
  ctx.fillStyle = '#fff3c9';
  ctx.beginPath();
  ctx.arc(w * 0.72, h * 0.3, 70, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,243,201,0.35)';
  ctx.beginPath();
  ctx.arc(w * 0.72, h * 0.3, 110, 0, Math.PI * 2);
  ctx.fill();
  // Skyline.
  const rng = mulberry32(42);
  ctx.fillStyle = '#4a3a52';
  let sx = 0;
  while (sx < w) {
    const bw = 40 + rng() * 80;
    const bh = h * 0.18 + rng() * h * 0.3;
    ctx.fillRect(sx, h * 0.72 - bh, bw, bh + h * 0.28);
    sx += bw + 6;
  }
  ctx.fillStyle = '#2e6b7a';
  ctx.fillRect(0, h * 0.72, w, h * 0.28);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  for (let i = 0; i < 24; i++) {
    ctx.fillRect(rng() * w, h * 0.74 + rng() * h * 0.22, 30 + rng() * 60, 2);
  }
  // Title.
  ctx.textAlign = 'center';
  ctx.font = 'bold 64px Georgia, serif';
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillText('SAN CIELO HEAT', w / 2 + 3, h * 0.3 + 3);
  ctx.fillStyle = '#fff8e8';
  ctx.fillText('SAN CIELO HEAT', w / 2, h * 0.3);
  ctx.font = '17px Verdana, sans-serif';
  ctx.fillStyle = '#fff8e8';
  ctx.fillText('An open-world crime story — steal, drive, run, survive.', w / 2, h * 0.3 + 34);
  ctx.font = '13px Verdana, sans-serif';
  ctx.fillStyle = 'rgba(255,248,232,0.85)';
  ctx.fillText('Mara Vega owes everyone in San Cielo. Ram has jobs. The SCPD has questions.', w / 2, h * 0.3 + 58);
  ctx.textAlign = 'left';
  for (const b of buttons) menuButton(ctx, b, hoverId === b.id);
  ctx.font = '12px Verdana, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.textAlign = 'center';
  ctx.fillText('WASD move / drive · Mouse aim · Click shoot · E enter car · 1/2/3 weapons · P pause · F save', w / 2, h - 24);
  ctx.textAlign = 'left';
}

export function drawOverlayScreen(ctx, game, title, lines, buttons, hoverId, titleColor) {
  const w = game.viewW;
  const h = game.viewH;
  ctx.fillStyle = 'rgba(8,10,16,0.72)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.font = 'bold 48px Georgia, serif';
  ctx.fillStyle = titleColor || '#ffd94d';
  ctx.fillText(title, w / 2, h * 0.3);
  ctx.font = '16px Verdana, sans-serif';
  ctx.fillStyle = '#ffffff';
  lines.forEach((line, i) => {
    ctx.fillText(line, w / 2, h * 0.3 + 40 + i * 26);
  });
  ctx.textAlign = 'left';
  for (const b of buttons) menuButton(ctx, b, hoverId === b.id);
}

export function pauseButtons(w, h) {
  const bw = 280;
  const bx = w / 2 - bw / 2;
  return [
    { id: 'resume', label: 'RESUME', x: bx, y: h * 0.52, w: bw, h: 48 },
    { id: 'save', label: 'SAVE GAME', x: bx, y: h * 0.52 + 60, w: bw, h: 48 },
    { id: 'help', label: 'HOW TO PLAY', x: bx, y: h * 0.52 + 120, w: bw, h: 48 },
    { id: 'quit', label: 'QUIT TO TITLE', x: bx, y: h * 0.52 + 180, w: bw, h: 48 },
  ];
}

export function helpLines() {
  return [
    'WASD / Arrows — walk, or drive when in a car',
    'Shift — run · Space — handbrake · H — horn',
    'Mouse — aim · Click / hold — shoot (SMG is automatic)',
    'E — enter or exit a car, start jobs, use the paint shop',
    '1 / 2 / 3 or mouse wheel — fists, pistol, SMG',
    'P or Esc — pause · F — save game · M — mute',
    'Steal cars, lose the cops, run jobs for Ram at the garage.',
    'Spray & Shine repaints your car and clears wanted stars for $150.',
  ];
}

export function endButtons(w, h) {
  const bw = 280;
  const bx = w / 2 - bw / 2;
  return [
    { id: 'retry', label: 'TRY AGAIN', x: bx, y: h * 0.52, w: bw, h: 48 },
    { id: 'quit', label: 'QUIT TO TITLE', x: bx, y: h * 0.52 + 60, w: bw, h: 48 },
  ];
}
