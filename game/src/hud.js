// Solmar Heat — the HUD, minimap and menu screens.
// Everything on screen that is not the world lives here: health and armour
// bars, wanted stars, the cash counter, the objective banner, the minimap,
// the message feed, mission splashes, and the title/pause/help screens.

import { WORLD, ROAD_CENTERS, clamp } from './config.js';

const FONT = '"Trebuchet MS", Verdana, sans-serif';

export const Hud = {
  messages: [],
  splashTitle: '',
  splashSub: '',
  splashTimer: 0,
  bustProgress: 0,
  wantedFlash: 0,
  prompt: '',
  _mapCache: null,

  reset() {
    this.messages = [];
    this.splashTimer = 0;
    this.bustProgress = 0;
    this.wantedFlash = 0;
    this.prompt = '';
    this._mapCache = null;
  },

  message(text, color) {
    this.messages.push({ text, color: color || '#ffffff', timer: 5 });
    if (this.messages.length > 5) this.messages.shift();
  },

  splash(title, sub) {
    this.splashTitle = title;
    this.splashSub = sub || '';
    this.splashTimer = 3.4;
  },

  flashWanted() { this.wantedFlash = 1.2; },

  showBustProgress(v) { this.bustProgress = v; },

  update(dt) {
    for (let i = this.messages.length - 1; i >= 0; i--) {
      this.messages[i].timer -= dt;
      if (this.messages[i].timer <= 0) this.messages.splice(i, 1);
    }
    this.splashTimer = Math.max(0, this.splashTimer - dt);
    this.wantedFlash = Math.max(0, this.wantedFlash - dt);
  },

  // ---- In-game HUD ----

  draw(ctx, state, viewW, viewH) {
    const p = state.player;
    ctx.save();
    ctx.textBaseline = 'alphabetic';

    // Objective banner, top centre.
    const obj = state.missions.objectiveText(state);
    ctx.font = '600 15px ' + FONT;
    const ow = ctx.measureText(obj).width + 28;
    ctx.fillStyle = 'rgba(10,10,16,0.62)';
    roundRect(ctx, viewW / 2 - ow / 2, 10, ow, 28, 8);
    ctx.fill();
    ctx.fillStyle = '#ffd76a';
    ctx.textAlign = 'center';
    ctx.fillText(obj, viewW / 2, 30);

    // Wanted stars, top right (above the minimap).
    const wanted = state.police.wanted;
    ctx.font = '700 22px ' + FONT;
    ctx.textAlign = 'right';
    for (let i = 0; i < 5; i++) {
      const x = viewW - 24 - (4 - i) * 30;
      const lit = i < wanted;
      ctx.fillStyle = lit ? (this.wantedFlash > 0 && Math.floor(this.wantedFlash * 6) % 2 === 0 ? '#ffffff' : '#ffcf3d') : 'rgba(255,255,255,0.25)';
      ctx.fillText('★', x, 42);
    }

    // Health / armour bars, top left.
    bar(ctx, 16, 14, 220, 16, p.health / p.maxHealth, '#3fae6a', 'HP');
    bar(ctx, 16, 36, 220, 12, p.armor / p.maxArmor, '#8ab8ff', 'ARM');
    // Cash.
    ctx.font = '700 20px ' + FONT;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#7fd4c1';
    ctx.fillText('$' + Math.floor(p.money).toLocaleString('en-US'), 16, 76);

    // Weapon + ammo, above the minimap.
    const w = p.weapons[p.weapon];
    ctx.font = '600 15px ' + FONT;
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffffff';
    const ammoText = w ? w.ammo + ' / ' + w.reserve : '';
    ctx.fillText(p.weapon.toUpperCase() + '  ' + ammoText, viewW - 16, viewH - 206);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '12px ' + FONT;
    ctx.fillText('1 pistol · 2 smg · 3 shotgun · R reload', viewW - 16, viewH - 190);

    // Speed when driving.
    if (p.car) {
      ctx.font = '700 18px ' + FONT;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(Math.round(Math.abs(p.car.speed) * 0.36) + ' km/h', viewW - 16, viewH - 224);
      // Car health.
      bar(ctx, viewW - 196, viewH - 252, 180, 10, Math.max(0, p.car.health) / 100, '#e08a3c', '');
    }

    // Message feed, bottom left.
    ctx.textAlign = 'left';
    ctx.font = '600 14px ' + FONT;
    let my = viewH - 24;
    for (let i = this.messages.length - 1; i >= 0; i--) {
      const m = this.messages[i];
      ctx.globalAlpha = clamp(m.timer, 0, 1);
      ctx.fillStyle = m.color;
      ctx.fillText(m.text, 16, my);
      my -= 22;
    }
    ctx.globalAlpha = 1;

    // Interaction prompt, bottom centre.
    if (this.prompt) {
      ctx.font = '700 16px ' + FONT;
      const pw = ctx.measureText(this.prompt).width + 30;
      ctx.fillStyle = 'rgba(10,10,16,0.7)';
      roundRect(ctx, viewW / 2 - pw / 2, viewH - 56, pw, 30, 8);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(this.prompt, viewW / 2, viewH - 35);
    }

    // Bust progress.
    if (this.bustProgress > 0) {
      ctx.fillStyle = 'rgba(10,10,16,0.7)';
      roundRect(ctx, viewW / 2 - 130, 52, 260, 26, 8);
      ctx.fill();
      ctx.fillStyle = '#ff5050';
      ctx.fillRect(viewW / 2 - 122, 60, 244 * clamp(this.bustProgress, 0, 1), 10);
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 12px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText('THE COPS ARE ON YOU — MOVE!', viewW / 2, 74);
    }

    // Mission splash.
    if (this.splashTimer > 0) {
      const a = clamp(this.splashTimer, 0, 1);
      ctx.globalAlpha = a;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffd76a';
      ctx.font = '800 42px ' + FONT;
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 12;
      ctx.fillText(this.splashTitle, viewW / 2, viewH * 0.3);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffffff';
      ctx.font = '600 16px ' + FONT;
      wrapText(ctx, this.splashSub, viewW / 2, viewH * 0.3 + 34, 620, 22);
      ctx.globalAlpha = 1;
    }

    this.drawMinimap(ctx, state, viewW, viewH);
    ctx.restore();
  },

  drawMinimap(ctx, state, viewW, viewH) {
    const size = 172;
    const x0 = viewW - size - 14, y0 = viewH - size - 14;
    const scale = size / WORLD;
    ctx.save();
    ctx.fillStyle = 'rgba(10,10,16,0.78)';
    roundRect(ctx, x0 - 4, y0 - 4, size + 8, size + 8, 8);
    ctx.fill();
    ctx.beginPath();
    ctx.rect(x0, y0, size, size);
    ctx.clip();
    // Static base map, cached.
    if (!this._mapCache) this._mapCache = buildMapCache(state.city, size);
    ctx.drawImage(this._mapCache, x0, y0);
    const dot = (wx, wy, color, r) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x0 + wx * scale, y0 + wy * scale, r, 0, Math.PI * 2);
      ctx.fill();
    };
    // Mission marker: pulsing.
    const marker = state.missions.currentMarker(state);
    if (marker) {
      const pulse = 5 + Math.sin(performance.now() / 180) * 2;
      dot(marker.x, marker.y, marker.color || '#ffd76a', pulse);
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x0 + marker.x * scale, y0 + marker.y * scale, pulse + 3, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (const car of state.cars) {
      if (car.driver === 'police') dot(car.x, car.y, '#5a9dff', 3);
    }
    for (const e of state.enemies) {
      if (!e.dead) dot(e.x, e.y, '#ff5050', 3);
    }
    // Player arrow.
    const p = state.player;
    const px = x0 + p.x * scale, py = y0 + p.y * scale;
    const ang = p.car ? p.car.angle : p.angle;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(ang);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(7, 0); ctx.lineTo(-5, -5); ctx.lineTo(-5, 5);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.restore();
    // North marker, tucked inside the map's top-left corner.
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '700 12px ' + FONT;
    ctx.textAlign = 'left';
    ctx.fillText('N ↑', x0 + 8, y0 + 16);
  },

  // ---- Menu screens ----

  drawTitle(ctx, viewW, viewH, hasSave, buttons) {
    drawSkyline(ctx, viewW, viewH);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd76a';
    ctx.font = '800 72px ' + FONT;
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = 16;
    ctx.fillText('SOLMAR HEAT', viewW / 2, viewH * 0.28);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.font = '600 20px ' + FONT;
    ctx.fillText('An open-world crime story in Port Solmar', viewW / 2, viewH * 0.28 + 36);
    ctx.font = '15px ' + FONT;
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText('Steal cars. Outrun the cops. Break Victor Kroll\'s grip on the city.', viewW / 2, viewH * 0.28 + 62);
    drawButtons(ctx, buttons);
    ctx.font = '13px ' + FONT;
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText('WASD move / drive · Mouse aim · Click shoot · F enter car · E interact · R reload · 1/2/3 weapons · M mute', viewW / 2, viewH - 44);
    ctx.fillText('An original game — all characters, places and art are invented for this game.', viewW / 2, viewH - 24);
    if (hasSave) {
      ctx.fillStyle = '#7fd4c1';
      ctx.fillText('A saved game was found — Continue picks up where Leo left off.', viewW / 2, viewH * 0.28 + 92);
    }
    ctx.restore();
  },

  drawPause(ctx, viewW, viewH, buttons, state) {
    ctx.save();
    ctx.fillStyle = 'rgba(8,8,14,0.72)';
    ctx.fillRect(0, 0, viewW, viewH);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd76a';
    ctx.font = '800 44px ' + FONT;
    ctx.fillText('PAUSED', viewW / 2, viewH * 0.24);
    ctx.fillStyle = '#ffffff';
    ctx.font = '600 16px ' + FONT;
    const s = state.stats;
    ctx.fillText('Missions done: ' + s.missionsDone + ' / 6   ·   Cash earned: $' + Math.floor(s.moneyEarned).toLocaleString('en-US') +
      '   ·   Cars stolen: ' + s.carsStolen + '   ·   Stashes found: ' + s.stashes + ' / 10', viewW / 2, viewH * 0.24 + 36);
    drawButtons(ctx, buttons);
    ctx.restore();
  },

  drawHelp(ctx, viewW, viewH, buttons) {
    drawSkyline(ctx, viewW, viewH);
    ctx.save();
    ctx.fillStyle = 'rgba(8,8,14,0.72)';
    ctx.fillRect(0, 0, viewW, viewH);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffd76a';
    ctx.font = '800 36px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillText('HOW TO PLAY', viewW / 2, 90);
    const lines = [
      ['Move / drive', 'W A S D — on foot you walk, in a car you drive'],
      ['Aim', 'Mouse — Leo faces the cursor; the camera leads your motion'],
      ['Shoot', 'Left mouse button (hold for the SMG)'],
      ['Enter / exit a car', 'F — beside any parked or slow car; stealing in front of cops adds heat'],
      ['Interact', 'E — talk to contacts, start jobs, use the garage repaint'],
      ['Weapons', '1 pistol · 2 SMG · 3 shotgun — R reloads'],
      ['Handbrake', 'Space — sharp turns at speed'],
      ['Wanted level', 'Stars bring interceptors. Break line of sight to cool off, or pay $150 for a repaint at Prado\'s Garage'],
      ['Save', 'Progress saves after every job. Continue on the title screen resumes'],
      ['Sound', 'M mutes everything'],
    ];
    ctx.font = '600 15px ' + FONT;
    let y = 140;
    for (const [key, desc] of lines) {
      ctx.textAlign = 'right';
      ctx.fillStyle = '#ffd76a';
      ctx.fillText(key, viewW / 2 - 24, y);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(desc, viewW / 2 - 8, y);
      y += 30;
    }
    drawButtons(ctx, buttons);
    ctx.restore();
  },

  drawEndScreen(ctx, viewW, viewH, kind) {
    ctx.save();
    ctx.fillStyle = kind === 'wasted' ? 'rgba(80,10,10,0.55)' : 'rgba(10,20,80,0.55)';
    ctx.fillRect(0, 0, viewW, viewH);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 64px ' + FONT;
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 14;
    ctx.fillText(kind === 'wasted' ? 'WASTED' : 'BUSTED', viewW / 2, viewH * 0.42);
    ctx.shadowBlur = 0;
    ctx.font = '600 17px ' + FONT;
    ctx.fillText(kind === 'wasted'
      ? 'Leo wakes up at St. Marina Hospital, lighter in the pocket.'
      : 'The cops take their cut. Leo walks out of the station, poorer and wiser.', viewW / 2, viewH * 0.42 + 38);
    ctx.fillStyle = '#ffd76a';
    ctx.fillText('Press ENTER to continue', viewW / 2, viewH * 0.42 + 74);
    ctx.restore();
  },
};

export function layoutButtons(viewW, viewH, labels, startY, gap) {
  const w = 280, h = 44;
  return labels.map((label, i) => ({
    label, action: label,
    x: viewW / 2 - w / 2, y: startY + i * gap, w, h,
  }));
}

function drawButtons(ctx, buttons) {
  ctx.save();
  ctx.textAlign = 'center';
  for (const b of buttons) {
    const hover = b.hover;
    ctx.fillStyle = hover ? '#ffd76a' : 'rgba(16,16,24,0.85)';
    roundRect(ctx, b.x, b.y, b.w, b.h, 8);
    ctx.fill();
    ctx.strokeStyle = '#ffd76a';
    ctx.lineWidth = 2;
    roundRect(ctx, b.x, b.y, b.w, b.h, 8);
    ctx.stroke();
    ctx.fillStyle = hover ? '#14141c' : '#ffffff';
    ctx.font = '700 17px ' + FONT;
    ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 6);
  }
  ctx.restore();
}

function bar(ctx, x, y, w, h, frac, color, label) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fill();
  if (frac > 0) {
    ctx.fillStyle = color;
    roundRect(ctx, x + 2, y + 2, Math.max(0, (w - 4) * clamp(frac, 0, 1)), h - 4, (h - 4) / 2);
    ctx.fill();
  }
  if (label) {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '700 10px ' + FONT;
    ctx.textAlign = 'left';
    ctx.fillText(label, x + 8, y + h - 4);
  }
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, yy);
      line = word;
      yy += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, yy);
}

function buildMapCache(city, size) {
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const g = c.getContext('2d');
  const s = size / WORLD;
  g.fillStyle = '#33383e';
  g.fillRect(0, 0, size, size);
  // Ocean band.
  g.fillStyle = '#4a7d99';
  g.fillRect(0, city.OCEAN_TOP * s, size, size - city.OCEAN_TOP * s);
  g.fillStyle = '#d8c493';
  g.fillRect(0, city.BEACH_TOP * s, size, (city.OCEAN_TOP - city.BEACH_TOP) * s);
  // Parks.
  g.fillStyle = '#557a4e';
  for (const park of city.parks) g.fillRect(park.x * s, park.y * s, park.w * s, park.h * s);
  // Roads.
  g.fillStyle = '#5d646d';
  for (const r of ROAD_CENTERS) {
    g.fillRect(r * s - 4, 0, 8, size);
    g.fillRect(0, r * s - 4, size, 8);
  }
  // Blocks.
  g.fillStyle = '#49505a';
  for (const b of city.buildings) g.fillRect(b.x * s, b.y * s, Math.max(1, b.w * s), Math.max(1, b.h * s));
  return c;
}

function drawSkyline(ctx, viewW, viewH) {
  // Dusk gradient + a silhouetted skyline: the title screen's backdrop.
  const grad = ctx.createLinearGradient(0, 0, 0, viewH);
  grad.addColorStop(0, '#1a2340');
  grad.addColorStop(0.55, '#c86a3d');
  grad.addColorStop(0.75, '#e8a35a');
  grad.addColorStop(1, '#2a2f33');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, viewW, viewH);
  // Sun.
  ctx.fillStyle = 'rgba(255,220,150,0.9)';
  ctx.beginPath();
  ctx.arc(viewW * 0.72, viewH * 0.52, 46, 0, Math.PI * 2);
  ctx.fill();
  // Buildings, deterministic from a simple hash so the skyline is stable.
  let seed = 42;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  let x = -20;
  while (x < viewW) {
    const w = 40 + rnd() * 90;
    const h = 120 + rnd() * 220;
    ctx.fillStyle = '#14141c';
    ctx.fillRect(x, viewH * 0.62 - h + 160, w, h);
    // Windows.
    ctx.fillStyle = 'rgba(255,215,106,0.5)';
    for (let wy = viewH * 0.62 - h + 180; wy < viewH * 0.62 + 140; wy += 22) {
      for (let wx = x + 8; wx < x + w - 8; wx += 18) {
        if (rnd() > 0.55) ctx.fillRect(wx, wy, 7, 10);
      }
    }
    x += w + 6;
  }
  // Street glow at the bottom.
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(0, viewH * 0.62 + 140, viewW, viewH);
}
