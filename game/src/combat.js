// San Cielo Heat — combat: bullets with tracers, melee swings, and the
// armed goons who guard the Kestrels' business.

import { TUNING } from './config.js';
import { collideCircle } from './city.js';
import { angleTo, dist } from './util.js';
import { damageCar } from './vehicles.js';

function pointBlocked(city, x, y) {
  const probe = { x, y, radius: 2 };
  const ox = probe.x;
  const oy = probe.y;
  collideCircle(city, probe);
  return probe.x !== ox || probe.y !== oy;
}

export class CombatSystem {
  constructor() {
    this.bullets = [];
    this.enemies = [];
  }

  fireBullet(game, x, y, angle, def, from) {
    const speed = TUNING.bulletSpeed;
    this.bullets.push({
      x: x + Math.cos(angle) * 20,
      y: y + Math.sin(angle) * 20,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      angle,
      life: def.range / speed,
      damage: def.damage,
      from,
    });
    game.effects.muzzle(x, y, angle);
    game.audio.shot(def.damage >= 26);
    game.peds.scareAt(x, y, 300);
  }

  meleeHit(game, x, y, angle, def) {
    game.audio.noise(0.07, 0.18, 700);
    const hx = x + Math.cos(angle) * 30;
    const hy = y + Math.sin(angle) * 30;
    game.effects.burst(hx, hy, 5, { speed: 80, life: 0.25, size: 3, color: '#e8e3d3' });
    for (const e of this.enemies) {
      if (e.health > 0 && dist(e.x, e.y, x, y) < def.range + 14) this.hurtEnemy(game, e, def.damage);
    }
    const ped = game.peds.nearest(x, y, def.range + 14);
    if (ped) {
      game.peds.hurtPed(game, ped, def.damage, x, y);
      game.police.addWanted(1, 'Assault reported!');
    }
  }

  spawnEnemy(x, y, opts) {
    const o = opts || {};
    const e = {
      x, y,
      angle: 0,
      health: o.health || 50,
      maxHealth: o.health || 50,
      damage: o.damage || 8,
      range: o.range || 300,
      cooldown: 0,
      walkPhase: 0,
      look: o.look || { shirt: '#3a3a40', pants: '#222226', skin: '#c98a5e', hair: '#1c1c20' },
      kind: o.kind || 'goon',
      reward: o.reward || 40,
      guard: o.guard || null, // {x, y} post to return to
    };
    this.enemies.push(e);
    return e;
  }

  hurtEnemy(game, e, damage) {
    e.health -= damage;
    game.effects.blood(e.x, e.y);
    if (e.health <= 0) {
      game.effects.floater(e.x, e.y - 18, '+$' + e.reward, '#7ddb6a');
      game.player.money += e.reward;
      game.pickups.dropCash(e.x + 8, e.y + 6, 0);
      game.audio.cash();
      game.missions.onEnemyDown(e);
    }
  }

  update(dt, game) {
    const player = game.player;

    // Bullets fly, spark off walls, and bite what they meet.
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.life -= dt;
      const step = 14;
      const steps = Math.ceil((Math.hypot(b.vx, b.vy) * dt) / step);
      let dead = b.life <= 0;
      for (let s = 0; s < steps && !dead; s++) {
        b.x += (b.vx * dt) / steps;
        b.y += (b.vy * dt) / steps;
        if (pointBlocked(game.city, b.x, b.y)) {
          game.effects.sparks(b.x, b.y);
          dead = true;
          break;
        }
        if (b.from === 'player') {
          for (const e of this.enemies) {
            if (e.health > 0 && dist(e.x, e.y, b.x, b.y) < 15) {
              this.hurtEnemy(game, e, b.damage);
              dead = true;
              break;
            }
          }
          if (dead) break;
          const ped = game.peds.nearest(b.x, b.y, 13);
          if (ped) {
            game.peds.hurtPed(game, ped, b.damage, player.x, player.y);
            game.police.addWanted(1, 'Shots fired at a civilian!');
            dead = true;
            break;
          }
        } else if (dist(player.x, player.y, b.x, b.y) < 15 && !player.dead) {
          player.damage(game, b.damage);
          dead = true;
          break;
        }
        for (const car of game.allCars) {
          if (car.wrecked) continue;
          const dx = b.x - car.x;
          const dy = b.y - car.y;
          const localX = dx * Math.cos(-car.angle) - dy * Math.sin(-car.angle);
          const localY = dx * Math.sin(-car.angle) + dy * Math.cos(-car.angle);
          if (Math.abs(localX) < car.def.length / 2 && Math.abs(localY) < car.def.width / 2) {
            damageCar(game, car, b.damage * 0.7);
            game.effects.sparks(b.x, b.y);
            dead = true;
            break;
          }
        }
      }
      if (dead) this.bullets.splice(i, 1);
    }

    // Goon AI: hold the post, chase and shoot when Mara closes in.
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.health <= 0) {
        e.deadTimer = (e.deadTimer || 0) + dt;
        if (e.deadTimer > 6) this.enemies.splice(i, 1);
        continue;
      }
      e.cooldown -= dt;
      e.walkPhase += dt * 6;
      const d = dist(e.x, e.y, player.x, player.y);
      const alerted = d < 480 && !player.dead;
      if (alerted) {
        e.angle = angleTo(e.x, e.y, player.x, player.y);
        if (d > e.range * 0.75) {
          e.x += Math.cos(e.angle) * 95 * dt;
          e.y += Math.sin(e.angle) * 95 * dt;
          const probe = { x: e.x, y: e.y, radius: 12 };
          collideCircle(game.city, probe);
          e.x = probe.x;
          e.y = probe.y;
        } else if (e.cooldown <= 0 && d < e.range) {
          e.cooldown = 0.9 + Math.random() * 0.5;
          const spread = (Math.random() - 0.5) * 0.14;
          this.fireBullet(game, e.x, e.y, e.angle + spread, { damage: e.damage, range: 420 }, 'enemy');
        }
      } else if (e.guard) {
        const gd = dist(e.x, e.y, e.guard.x, e.guard.y);
        if (gd > 30) {
          const ga = angleTo(e.x, e.y, e.guard.x, e.guard.y);
          e.angle = ga;
          e.x += Math.cos(ga) * 60 * dt;
          e.y += Math.sin(ga) * 60 * dt;
        }
      }
    }
  }

  reset() {
    this.bullets = [];
    this.enemies = [];
  }
}
