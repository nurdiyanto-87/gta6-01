// San Cielo Heat — pedestrians: locals strolling the sidewalks who
// scatter when guns fire or cars mount the kerb.

import { TUNING, WORLD } from './config.js';
import { collideCircle, randomSidewalkPoint } from './city.js';
import { angleTo, clamp, dist, makeRng } from './util.js';

const SHIRTS = ['#d95f4b', '#4b8ad9', '#e0a83c', '#5da56a', '#8a5aa8', '#e8e3d3', '#3a4a5a', '#e87a9a'];
const PANTS = ['#3a4a5a', '#2b2b30', '#6b5a44', '#4a6b8a', '#7a7a7a'];
const SKINS = ['#f2c9a0', '#e0ac82', '#c98a5e', '#a06a42', '#8a5432'];
const HAIRS = ['#2b2b30', '#6b4a2a', '#c9a24b', '#8a8a8a', '#3a2a1a', '#d95f4b'];

export class PedSystem {
  constructor(city) {
    this.city = city;
    this.peds = [];
    this.rng = makeRng(424242);
  }

  spawnInitial(count) {
    for (let i = 0; i < count; i++) this.spawnPed();
  }

  makeLook() {
    return {
      shirt: this.rng.pick(SHIRTS),
      pants: this.rng.pick(PANTS),
      skin: this.rng.pick(SKINS),
      hair: this.rng.pick(HAIRS),
    };
  }

  spawnPed(x, y) {
    const spot = x !== undefined ? { x, y } : randomSidewalkPoint(this.city, this.rng);
    const ped = {
      x: spot.x,
      y: spot.y,
      angle: this.rng.range(0, Math.PI * 2),
      look: this.makeLook(),
      state: 'walk', // walk | flee | down
      target: null,
      wait: 0,
      walkPhase: this.rng.range(0, Math.PI * 2),
      speed: TUNING.pedWalk * this.rng.range(0.8, 1.2),
      fleeTimer: 0,
      health: 30,
    };
    this.peds.push(ped);
    return ped;
  }

  scareAt(x, y, radius) {
    for (const p of this.peds) {
      if (p.state === 'down') continue;
      if (dist(p.x, p.y, x, y) < radius) {
        p.state = 'flee';
        p.fleeTimer = 4 + Math.random() * 3;
        p.angle = angleTo(x, y, p.x, p.y);
      }
    }
  }

  // True when a pedestrian stands in the cone ahead of a moving car.
  pedAhead(x, y, angle, range) {
    const fx = Math.cos(angle);
    const fy = Math.sin(angle);
    for (const p of this.peds) {
      if (p.state === 'down') continue;
      const dx = p.x - x;
      const dy = p.y - y;
      const forward = dx * fx + dy * fy;
      const side = Math.abs(-dx * fy + dy * fx);
      if (forward > 0 && forward < range && side < 24) return true;
    }
    return false;
  }

  nearest(x, y, radius) {
    let best = null;
    let bestD = radius;
    for (const p of this.peds) {
      if (p.state === 'down') continue;
      const d = dist(p.x, p.y, x, y);
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  }

  hurtPed(game, ped, damage, fromX, fromY) {
    ped.health -= damage;
    game.effects.blood(ped.x, ped.y);
    if (ped.health <= 0 && ped.state !== 'down') {
      ped.state = 'down';
      game.effects.floater(ped.x, ped.y - 18, 'DOWN', '#ff6a5a');
      this.scareAt(ped.x, ped.y, 320);
    } else {
      ped.state = 'flee';
      ped.fleeTimer = 5;
      ped.angle = angleTo(fromX, fromY, ped.x, ped.y);
      this.scareAt(ped.x, ped.y, 200);
    }
  }

  update(dt, game) {
    const px = game.player.x;
    const py = game.player.y;
    for (const p of this.peds) {
      if (p.state === 'down') continue;
      p.walkPhase += dt * (p.state === 'flee' ? 11 : 6);
      if (p.state === 'flee') {
        p.fleeTimer -= dt;
        const sp = TUNING.pedFlee;
        p.x += Math.cos(p.angle) * sp * dt;
        p.y += Math.sin(p.angle) * sp * dt;
        const probe = { x: p.x, y: p.y, radius: 11 };
        if (collideCircle(this.city, probe)) {
          p.x = probe.x;
          p.y = probe.y;
          p.angle += Math.PI / 2 + Math.random() * 0.6; // slide along the wall
        }
        if (p.fleeTimer <= 0) p.state = 'walk';
        continue;
      }
      // Strolling: pick a nearby sidewalk target, walk to it, pause.
      if (p.wait > 0) {
        p.wait -= dt;
        continue;
      }
      if (!p.target) {
        p.target = randomSidewalkPoint(this.city, this.rng);
        if (dist(p.x, p.y, p.target.x, p.target.y) > 700) p.target = null;
      }
      if (p.target) {
        const want = angleTo(p.x, p.y, p.target.x, p.target.y);
        let d = want - p.angle;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        p.angle += clamp(d, -3 * dt, 3 * dt);
        p.x += Math.cos(p.angle) * p.speed * dt;
        p.y += Math.sin(p.angle) * p.speed * dt;
        const probe = { x: p.x, y: p.y, radius: 11 };
        if (collideCircle(this.city, probe)) {
          p.x = probe.x;
          p.y = probe.y;
          p.target = null;
        }
        if (p.target && dist(p.x, p.y, p.target.x, p.target.y) < 24) {
          p.target = null;
          p.wait = Math.random() * 3;
        }
      }
      // A car roaring onto the sidewalk sends everyone running.
      for (const car of game.allCars) {
        if (car.wrecked) continue;
        const sp = Math.hypot(car.vx, car.vy);
        if (sp > 130 && dist(p.x, p.y, car.x, car.y) < 90) {
          p.state = 'flee';
          p.fleeTimer = 3;
          p.angle = angleTo(car.x, car.y, p.x, p.y);
          break;
        }
      }
    }
    // Keep the streets populated near the player.
    if (this.peds.filter((p) => p.state !== 'down').length < 34) this.spawnPed();
    for (let i = this.peds.length - 1; i >= 0; i--) {
      const p = this.peds[i];
      if (p.state === 'down' && dist(p.x, p.y, px, py) > 900) this.peds.splice(i, 1);
      else if (dist(p.x, p.y, px, py) > 1500) {
        const spot = randomSidewalkPoint(this.city, this.rng);
        p.x = spot.x;
        p.y = spot.y;
        p.state = 'walk';
        p.target = null;
      }
    }
  }
}
