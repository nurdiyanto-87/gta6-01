// San Cielo Heat — pedestrians: sidewalk walkers with their own looks and
// paces who flee when shots ring out or a car bears down on them.

import { TUNING, WORLD } from './config.js';
import { clamp, dist, makeRng } from './util.js';
import { collideCircle, randomSidewalkPoint } from './city.js';

const SHIRTS = ['#d95f4b', '#4b8ad9', '#e0a83c', '#5da56a', '#8a5fb0', '#e8e4da', '#3c3c44', '#d97b2b'];
const PANTS = ['#3a4a6b', '#5a4a3a', '#2e4a3a', '#444', '#6b3a4a'];
const SKINS = ['#e8b98d', '#c98d5e', '#8a5a3a', '#f0cba8', '#6b4226'];
const HATS = [null, null, null, '#c94f43', '#3c3c44', '#e0a83c'];

export class PedSystem {
  constructor(city) {
    this.city = city;
    this.peds = [];
    this.rng = makeRng(1357911);
    this.alarmTimer = 0;
  }

  spawnInitial(count) {
    for (let i = 0; i < count; i++) this.spawnPed();
  }

  spawnPed(nearX, nearY) {
    const point = randomSidewalkPoint(this.city, this.rng);
    const ped = {
      x: point.x,
      y: point.y,
      angle: this.rng.range(0, Math.PI * 2),
      target: randomSidewalkPoint(this.city, this.rng),
      speed: TUNING.pedWalk * this.rng.range(0.8, 1.2),
      walkPhase: this.rng.range(0, Math.PI * 2),
      fleeing: 0,
      look: {
        shirt: this.rng.pick(SHIRTS),
        pants: this.rng.pick(PANTS),
        skin: this.rng.pick(SKINS),
        hat: this.rng.pick(HATS),
      },
      radius: 11,
      pauseTimer: 0,
    };
    this.peds.push(ped);
    return ped;
  }

  alarm() {
    this.alarmTimer = 4;
  }

  update(dt, player, danger) {
    this.alarmTimer = Math.max(0, this.alarmTimer - dt);
    const px = player.inCar ? player.inCar.x : player.x;
    const py = player.inCar ? player.inCar.y : player.y;

    for (let i = this.peds.length - 1; i >= 0; i--) {
      const ped = this.peds[i];
      // Cull far-away walkers and respawn near the action.
      if (dist(ped.x, ped.y, px, py) > 2400) {
        this.peds.splice(i, 1);
        this.spawnPed(px, py);
        continue;
      }
      const dangerNear = this.alarmTimer > 0 || (danger && dist(ped.x, ped.y, danger.x, danger.y) < 260);
      const carNear = player.inCar && dist(ped.x, ped.y, px, py) < 90 && Math.abs(player.inCar.speed) > 80;
      if (dangerNear || carNear) ped.fleeing = 3;

      if (ped.fleeing > 0) {
        ped.fleeing -= dt;
        const away = Math.atan2(ped.y - py, ped.x - px);
        ped.angle = away;
        ped.x += Math.cos(away) * TUNING.pedFlee * dt;
        ped.y += Math.sin(away) * TUNING.pedFlee * dt;
        ped.walkPhase += dt * 11;
      } else if (ped.pauseTimer > 0) {
        ped.pauseTimer -= dt;
      } else {
        const d = dist(ped.x, ped.y, ped.target.x, ped.target.y);
        if (d < 14) {
          ped.target = randomSidewalkPoint(this.city, this.rng);
          if (this.rng.chance(0.25)) ped.pauseTimer = this.rng.range(1, 4);
        } else {
          ped.angle = Math.atan2(ped.target.y - ped.y, ped.target.x - ped.x);
          ped.x += Math.cos(ped.angle) * ped.speed * dt;
          ped.y += Math.sin(ped.angle) * ped.speed * dt;
          ped.walkPhase += dt * 6;
        }
      }
      ped.x = clamp(ped.x, 20, WORLD - 20);
      ped.y = clamp(ped.y, 20, WORLD - 20);
      collideCircle(this.city, ped);
    }
  }
}
