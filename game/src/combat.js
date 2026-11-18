// Solmar Heat — combat: bullets, Kroll crew enemies, and noise.
// Gunfire is hitscan-free: real projectiles with travel, spread and range, so
// dodging behind a building is a real tactic. Enemies hunt the player, take
// cover behind nothing, and drop cash when they fall.

import { TUNING, clamp, rand, randi, dist, angleTo } from './config.js';
import { collideCircle } from './city.js';
import { Effects } from './effects.js';
import { AudioSys } from './audio.js';
import { damageCar, carHitTest } from './vehicles.js';
import { scarePeds } from './pedestrians.js';
import { damagePlayer } from './player.js';

export function spawnBullet(state, x, y, angle, weapon, from) {
  state.bullets.push({
    x, y,
    vx: Math.cos(angle) * TUNING.bulletSpeed,
    vy: Math.sin(angle) * TUNING.bulletSpeed,
    damage: weapon.damage,
    range: weapon.range,
    traveled: 0,
    from, // 'player' | 'enemy'
    color: from === 'player' ? '#ffd76a' : '#ff7a5a',
  });
}

export function makeEnemy(x, y, opts) {
  const o = opts || {};
  return {
    x, y, angle: rand(0, Math.PI * 2),
    health: o.health || 60, maxHealth: o.health || 60,
    shirt: o.shirt || '#8c2f2f', pants: '#2c2c34',
    skin: ['#e8b98a', '#c98a5a', '#8a5a3a'][Math.floor(Math.random() * 3)],
    hair: '#1c1c22',
    phase: rand(0, Math.PI * 2),
    moving: false,
    armed: true,
    showHealth: true,
    cooldown: rand(0.4, 1.2),
    strafeDir: Math.random() < 0.5 ? 1 : -1,
    strafeTimer: rand(1, 2.5),
    weapon: o.weapon || { damage: 8, rate: 0.9, mag: 99, spread: 0.14, pellets: 1, range: 420, sound: 'pistol' },
    dead: false,
    deadTimer: 0,
    boss: !!o.boss,
    speed: o.speed || 135,
  };
}

export function spawnEnemy(state, x, y, opts) {
  const e = makeEnemy(x, y, opts);
  state.enemies.push(e);
  return e;
}

export function updateBullets(state, dt) {
  const player = state.player;
  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const b = state.bullets[i];
    const step = TUNING.bulletSpeed * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.traveled += step;
    let dead = b.traveled > b.range;
    // Buildings stop bullets.
    if (!dead) {
      const probe = { x: b.x, y: b.y, radius: 2 };
      if (collideCircle(state.city, probe)) {
        dead = true;
        Effects.sparks(b.x, b.y);
      }
    }
    // Cars stop bullets too.
    if (!dead) {
      for (const car of state.cars) {
        if (car.dead) continue;
        if (carHitTest(car, b.x, b.y, 2)) {
          dead = true;
          damageCar(car, b.damage * 0.6, state);
          Effects.sparks(b.x, b.y);
          break;
        }
      }
    }
    if (!dead && b.from === 'player') {
      // Enemies.
      for (const e of state.enemies) {
        if (e.dead) continue;
        if (dist(b.x, b.y, e.x, e.y) < 14) {
          dead = true;
          damageEnemy(state, e, b.damage);
          break;
        }
      }
      // Pedestrians can be hit: the city notices.
      if (!dead) {
        for (const ped of state.peds) {
          if (ped.dead) continue;
          if (dist(b.x, b.y, ped.x, ped.y) < 13) {
            dead = true;
            ped.dead = true;
            ped.deadTimer = 18;
            Effects.blood(ped.x, ped.y);
            scarePeds(state, ped.x, ped.y, 300);
            state.stats.pedsHit++;
            state.police.addHeat(state, 1, 'Civilian down!');
            break;
          }
        }
      }
    }
    if (!dead && b.from === 'enemy') {
      const target = player.car || player;
      const r = player.car ? 26 : 14;
      if (dist(b.x, b.y, target.x, target.y) < r) {
        dead = true;
        if (player.car) {
          damageCar(player.car, b.damage * 0.5, state);
        } else {
          damagePlayer(state, b.damage, b.x, b.y);
          Effects.blood(player.x, player.y);
        }
      }
    }
    if (dead) state.bullets.splice(i, 1);
  }
}

export function damageEnemy(state, e, amount) {
  if (e.dead) return;
  e.health -= amount;
  Effects.blood(e.x, e.y);
  AudioSys.hit();
  if (e.health <= 0) {
    e.dead = true;
    e.deadTimer = 14;
    state.stats.enemiesDown++;
    Effects.floatText(e.x, e.y - 22, '+$' + (e.boss ? 500 : 80), '#7fd4c1');
    state.player.money += e.boss ? 500 : 80;
    AudioSys.cash();
    // Drops: cash and sometimes ammo. Drops expire after 30 seconds.
    state.pickups.push({ kind: 'cash', x: e.x + rand(-14, 14), y: e.y + rand(-14, 14), amount: randi(20, 60), timer: 0, taken: false, bob: 0, expires: 30 });
    if (Math.random() < 0.45) {
      state.pickups.push({ kind: 'ammo', x: e.x + rand(-14, 14), y: e.y + rand(-14, 14), weapon: 'smg', amount: 30, timer: 0, taken: false, bob: 0, expires: 30 });
    }
    state.missions.onEnemyKilled(state, e);
  }
}

export function updateEnemies(state, dt) {
  const player = state.player;
  const px = player.car ? player.car.x : player.x;
  const py = player.car ? player.car.y : player.y;
  for (let i = state.enemies.length - 1; i >= 0; i--) {
    const e = state.enemies[i];
    if (e.dead) {
      e.deadTimer -= dt;
      if (e.deadTimer <= 0) state.enemies.splice(i, 1);
      continue;
    }
    const d = dist(e.x, e.y, px, py);
    e.cooldown -= dt;
    e.strafeTimer -= dt;
    if (e.strafeTimer <= 0) {
      e.strafeTimer = rand(1, 2.5);
      e.strafeDir *= -1;
    }
    // Behaviour: close in to shooting range, then strafe and fire.
    let mx = 0, my = 0;
    if (d > 280) {
      const a = angleTo(e.x, e.y, px, py);
      mx = Math.cos(a); my = Math.sin(a);
    } else if (d < 150) {
      const a = angleTo(px, py, e.x, e.y);
      mx = Math.cos(a) * 0.6; my = Math.sin(a) * 0.6;
    } else {
      const a = angleTo(e.x, e.y, px, py) + (Math.PI / 2) * e.strafeDir;
      mx = Math.cos(a) * 0.55; my = Math.sin(a) * 0.55;
    }
    e.moving = mx !== 0 || my !== 0;
    if (e.moving) {
      const circle = { x: e.x + mx * e.speed * dt, y: e.y + my * e.speed * dt, radius: 12 };
      collideCircle(state.city, circle);
      e.x = circle.x; e.y = circle.y;
      e.phase += dt * 10;
    }
    e.angle = angleTo(e.x, e.y, px, py);
    // Fire when in range and roughly facing the player.
    if (d < e.weapon.range && e.cooldown <= 0 && hasLineOfSight(state, e.x, e.y, px, py)) {
      e.cooldown = e.weapon.rate * rand(0.9, 1.3);
      const gx = e.x + Math.cos(e.angle) * 20;
      const gy = e.y + Math.sin(e.angle) * 20;
      spawnBullet(state, gx, gy, e.angle + (Math.random() - 0.5) * 2 * e.weapon.spread, e.weapon, 'enemy');
      Effects.muzzle(gx, gy, e.angle);
      if (d < 620) AudioSys.shoot('pistol');
    }
  }
}

// Cheap line-of-sight: sample points along the segment against buildings.
export function hasLineOfSight(state, x1, y1, x2, y2) {
  const steps = Math.ceil(dist(x1, y1, x2, y2) / 36);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = x1 + (x2 - x1) * t, y = y1 + (y2 - y1) * t;
    for (const b of state.city.buildings) {
      if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) return false;
    }
  }
  return true;
}

// Gunfire noise: scares pedestrians, wakes nearby enemies, and — when the
// police are close enough to hear it — draws heat.
export function noiseAt(state, x, y, radius) {
  scarePeds(state, x, y, radius);
  for (const e of state.enemies) {
    if (!e.dead && dist(e.x, e.y, x, y) < radius * 1.4) {
      e.cooldown = Math.min(e.cooldown, 0.3);
    }
  }
  state.police.hearShot(state, x, y);
}
