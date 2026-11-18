// Solmar Heat — pickups: health, armour, ammo and hidden cash stashes.
// Fixed spots around the city refill over time, so exploring always pays.
// Cash stashes are the collectibles: ten briefcases tucked into alleys,
// rooftops of huts and the far corners of the map.

import { dist, randi } from './config.js';
import { Effects } from './effects.js';
import { AudioSys } from './audio.js';
import { healPlayer, giveAmmo } from './player.js';

const SPOTS = [
  { kind: 'health', x: 1050, y: 1450 },
  { kind: 'health', x: 2450, y: 1050 },
  { kind: 'health', x: 1850, y: 2650 },
  { kind: 'armor', x: 1450, y: 650 },
  { kind: 'armor', x: 2650, y: 1850 },
  { kind: 'ammo', x: 650, y: 2250, weapon: 'smg', amount: 60 },
  { kind: 'ammo', x: 2250, y: 450, weapon: 'shotgun', amount: 12 },
  { kind: 'ammo', x: 350, y: 2850, weapon: 'smg', amount: 60 },
  { kind: 'stash', x: 300, y: 250, amount: 250 },
  { kind: 'stash', x: 2900, y: 300, amount: 250 },
  { kind: 'stash', x: 300, y: 2540, amount: 250 },
  { kind: 'stash', x: 2880, y: 2500, amount: 250 },
  { kind: 'stash', x: 1600, y: 3040, amount: 250 },
  { kind: 'stash', x: 1350, y: 1350, amount: 250 },
  { kind: 'stash', x: 2300, y: 1350, amount: 250 },
  { kind: 'stash', x: 900, y: 900, amount: 250 },
  { kind: 'stash', x: 2050, y: 2120, amount: 250 },
  { kind: 'stash', x: 380, y: 1730, amount: 250 },
];

export function spawnWorldPickups(state) {
  state.pickups.length = 0;
  for (const s of SPOTS) {
    state.pickups.push({ ...s, timer: 0, taken: false, bob: Math.random() * Math.PI * 2 });
  }
}

export function updatePickups(state, dt) {
  const p = state.player;
  const px = p.car ? p.car.x : p.x, py = p.car ? p.car.y : p.y;
  for (let i = state.pickups.length - 1; i >= 0; i--) {
    const pk = state.pickups[i];
    pk.bob += dt * 3;
    // Enemy drops expire.
    if (pk.expires !== undefined && !pk.taken) {
      pk.expires -= dt;
      if (pk.expires <= 0) { state.pickups.splice(i, 1); continue; }
    }
    if (pk.taken) {
      // Stashes never come back; the rest refill after 45 seconds.
      if (pk.kind === 'stash') continue;
      pk.timer -= dt;
      if (pk.timer <= 0) pk.taken = false;
      continue;
    }
    if (dist(px, py, pk.x, pk.y) <= 34) collectPickup(state, pk);
  }
}

function collectPickup(state, pk) {
  const p = state.player;
  pk.taken = true;
  pk.timer = 45;
  if (pk.kind === 'health') {
    healPlayer(p, 50);
    state.hud.message('Health +50', '#7fd4c1');
    Effects.floatText(pk.x, pk.y - 20, '+50 HP', '#7fd4c1');
  } else if (pk.kind === 'armor') {
    p.armor = Math.min(p.maxArmor, p.armor + 50);
    state.hud.message('Armour +50', '#8ab8ff');
    Effects.floatText(pk.x, pk.y - 20, '+50 ARMOUR', '#8ab8ff');
  } else if (pk.kind === 'ammo') {
    giveAmmo(p, pk.weapon, pk.amount);
    state.hud.message('Ammo for the ' + pk.weapon.toUpperCase(), '#ffd76a');
  } else if (pk.kind === 'stash' || pk.kind === 'cash') {
    p.money += pk.amount;
    state.stats.moneyEarned += pk.amount;
    if (pk.kind === 'stash') state.stats.stashes++;
    state.hud.message('+$' + pk.amount, '#7fd4c1');
    Effects.floatText(pk.x, pk.y - 20, '+$' + pk.amount, '#7fd4c1');
    AudioSys.cash();
  }
  Effects.confetti(pk.x, pk.y);
  AudioSys.pickup();
  // One-shot drops vanish once collected; world pickups respawn via timer.
  if (pk.expires !== undefined) {
    const idx = state.pickups.indexOf(pk);
    if (idx >= 0) state.pickups.splice(idx, 1);
  }
}

export function drawPickup(ctx, pk, time) {
  if (pk.taken) return;
  const bob = Math.sin(pk.bob) * 3;
  const x = pk.x, y = pk.y + bob;
  ctx.save();
  ctx.translate(x, y);
  // Glow ring.
  ctx.fillStyle = 'rgba(255,215,106,0.18)';
  ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(2, 8, 12, 5, 0, 0, Math.PI * 2); ctx.fill();
  if (pk.kind === 'health') {
    ctx.fillStyle = '#f2f2f2';
    ctx.fillRect(-10, -10, 20, 20);
    ctx.fillStyle = '#3fae6a';
    ctx.fillRect(-3, -8, 6, 16);
    ctx.fillRect(-8, -3, 16, 6);
  } else if (pk.kind === 'armor') {
    ctx.fillStyle = '#3d6b8a';
    ctx.beginPath();
    ctx.moveTo(0, -11); ctx.lineTo(10, -6); ctx.lineTo(8, 8); ctx.lineTo(0, 12); ctx.lineTo(-8, 8); ctx.lineTo(-10, -6);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#8ab8ff';
    ctx.fillRect(-2, -6, 4, 10);
  } else if (pk.kind === 'ammo') {
    ctx.fillStyle = '#c8a848';
    for (let i = -1; i <= 1; i++) ctx.fillRect(i * 7 - 2, -8, 5, 16);
    ctx.fillStyle = '#8a6a44';
    ctx.fillRect(-10, 6, 20, 4);
  } else {
    // Briefcase full of cash.
    ctx.fillStyle = '#6a4e2e';
    ctx.fillRect(-12, -8, 24, 16);
    ctx.fillStyle = '#8a6a44';
    ctx.fillRect(-12, -8, 24, 5);
    ctx.fillStyle = '#ffd76a';
    ctx.fillRect(-3, -3, 6, 4);
  }
  ctx.restore();
}
