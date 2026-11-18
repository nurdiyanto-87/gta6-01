// San Cielo Heat — combat: bullets, muzzle flashes, armed goons with
// simple seek-and-shoot AI, and melee swings.

import { TUNING } from './config.js';
import { clamp, dist, makeRng, turnToward } from './util.js';
import { collideCircle, isOnRoad } from './city.js';

export class CombatSystem {
  constructor() {
    this.bullets = [];
    this.enemies = [];
    this.rng = makeRng(11223344);
    this.meleeTimer = 0;
  }

  reset() {
    this.bullets = [];
    this.enemies = [];
  }

  spawnEnemy(x, y, opts) {
    opts = opts || {};
    const enemy = {
      x, y,
      angle: this.rng.range(0, Math.PI * 2),
      health: opts.health || 50,
      speed: opts.speed || 120,
      radius: 12,
      cooldown: this.rng.range(0.4, 1.2),
      walkPhase: 0,
      look: {
        shirt: opts.shirt || '#2e2e36',
        pants: '#22222a',
        skin: this.rng.pick(['#e8b98d', '#c98d5e', '#8a5a3a']),
        hat: opts.hat || '#1c1c22',
      },
      homeX: x,
      homeY: y,
      alerted: !!opts.alerted,
      dropCash: opts.dropCash !== undefined ? opts.dropCash : 40,
    };
    this.enemies.push(enemy);
    return enemy;
  }

  fireBullet(x, y, angle, opts) {
    opts = opts || {};
    const spread = opts.spread || 0;
    const a = angle + (Math.random() - 0.5) * 2 * spread;
    this.bullets.push({
      x, y,
      vx: Math.cos(a) * TUNING.bulletSpeed,
      vy: Math.sin(a) * TUNING.bulletSpeed,
      damage: opts.damage || 20,
      range: opts.range || 420,
      travelled: 0,
      friendly: !!opts.friendly,
      life: 0.8,
    });
  }

  // The player swings fists: damage the nearest enemy in reach and arc.
  melee(game) {
    const player = game.player;
    this.meleeTimer = 0.18;
    let hitAny = false;
    for (const enemy of this.enemies) {
      const d = dist(player.x, player.y, enemy.x, enemy.y);
      if (d > 40) continue;
      const toEnemy = Math.atan2(enemy.y - player.y, enemy.x - player.x);
      let diff = Math.abs(toEnemy - player.angle);
      if (diff > Math.PI) diff = Math.PI * 2 - diff;
      if (diff > 1.2) continue;
      this.damageEnemy(game, enemy, 12);
      hitAny = true;
    }
    if (hitAny && game.audio) game.audio.shot('fists');
    return hitAny;
  }

  damageEnemy(game, enemy, amount) {
    enemy.health -= amount;
    enemy.alerted = true;
    if (game.effects) game.effects.blood(enemy.x, enemy.y);
    if (enemy.health <= 0) {
      const idx = this.enemies.indexOf(enemy);
      if (idx >= 0) this.enemies.splice(idx, 1);
      if (game.effects) {
        game.effects.burst(enemy.x, enemy.y, { count: 12, speed: 140, life: 0.6, size: 3, color: '#c22e2e' });
        game.effects.floatText(enemy.x, enemy.y - 18, '+' + enemy.dropCash + ' $', '#7ddb6a');
      }
      game.player.addMoney(enemy.dropCash);
      game.player.kills++;
      if (game.pickups) game.pickups.dropAmmo(enemy.x, enemy.y);
      if (game.onEnemyDown) game.onEnemyDown(enemy);
    }
  }

  update(dt, game) {
    this.meleeTimer = Math.max(0, this.meleeTimer - dt);
    const player = game.player;
    const px = player.inCar ? player.inCar.x : player.x;
    const py = player.inCar ? player.inCar.y : player.y;

    // Bullets fly, hit walls, cars, enemies or the player.
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      const stepX = b.vx * dt;
      const stepY = b.vy * dt;
      b.x += stepX;
      b.y += stepY;
      b.travelled += Math.hypot(stepX, stepY);
      b.life -= dt;
      let dead = b.life <= 0 || b.travelled >= b.range;
      if (!dead && pointBlocked(game.city, b.x, b.y)) {
        if (game.effects) game.effects.sparks(b.x, b.y);
        dead = true;
      }
      if (!dead && b.friendly) {
        for (const enemy of this.enemies) {
          if (dist(b.x, b.y, enemy.x, enemy.y) < 14) {
            this.damageEnemy(game, enemy, b.damage);
            dead = true;
            break;
          }
        }
      }
      if (!dead && !b.friendly && !player.inCar) {
        if (dist(b.x, b.y, player.x, player.y) < 14) {
          if (player.takeDamage(b.damage, game.audio)) game.onPlayerDown('wasted');
          dead = true;
        }
      }
      if (!dead && !b.friendly && player.inCar) {
        if (dist(b.x, b.y, px, py) < 26) {
          player.inCar.damage = clamp(player.inCar.damage + 0.05, 0, 1);
          if (game.effects) game.effects.sparks(b.x, b.y);
          dead = true;
        }
      }
      if (dead) this.bullets.splice(i, 1);
    }

    // Enemies: chase the player when alerted, shoot when in range.
    for (const enemy of this.enemies) {
      const d = dist(enemy.x, enemy.y, px, py);
      if (d < 420) enemy.alerted = true;
      enemy.cooldown -= dt;
      if (enemy.alerted) {
        const wantAngle = Math.atan2(py - enemy.y, px - enemy.x);
        enemy.angle = turnToward(enemy.angle, wantAngle, 5 * dt);
        if (d > 190) {
          enemy.x += Math.cos(enemy.angle) * enemy.speed * dt;
          enemy.y += Math.sin(enemy.angle) * enemy.speed * dt;
          enemy.walkPhase += dt * 8;
        }
        if (d < 380 && enemy.cooldown <= 0 && !pointBlocked(game.city, (enemy.x + px) / 2, (enemy.y + py) / 2)) {
          enemy.cooldown = 1.1 + this.rng.range(0, 0.7);
          this.fireBullet(enemy.x + Math.cos(enemy.angle) * 16, enemy.y + Math.sin(enemy.angle) * 16, enemy.angle, {
            damage: 8, range: 380, spread: 0.06, friendly: false,
          });
          if (game.audio) game.audio.shot('pistol');
          if (game.effects) game.effects.burst(enemy.x + Math.cos(enemy.angle) * 18, enemy.y + Math.sin(enemy.angle) * 18, { count: 3, speed: 60, life: 0.12, size: 3, color: '#ffd76a' });
        }
        if (d > 900) enemy.alerted = false;
      } else {
        // Idle patrol around home.
        if (dist(enemy.x, enemy.y, enemy.homeX, enemy.homeY) > 60) {
          const home = Math.atan2(enemy.homeY - enemy.y, enemy.homeX - enemy.x);
          enemy.angle = turnToward(enemy.angle, home, 3 * dt);
          enemy.x += Math.cos(enemy.angle) * enemy.speed * 0.4 * dt;
          enemy.y += Math.sin(enemy.angle) * enemy.speed * 0.4 * dt;
          enemy.walkPhase += dt * 4;
        }
      }
      collideCircle(game.city, enemy);
    }
  }

  draw(ctx) {
    for (const b of this.bullets) {
      ctx.strokeStyle = '#ffe9a8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(b.x - b.vx * 0.012, b.y - b.vy * 0.012);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }
}

function pointBlocked(city, x, y) {
  // A point is blocked when it sits inside a building collider.
  for (const rect of city.colliders) {
    if (x >= rect.x && x <= rect.x + rect.w && y >= rect.y && y <= rect.y + rect.h) return true;
  }
  return false;
}
