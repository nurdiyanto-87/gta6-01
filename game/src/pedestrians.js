// Solmar Heat — pedestrians.
// Ordinary people of Port Solmar: they stroll the sidewalks, wait at corners,
// and run for their lives when shots ring out or a car mounts the kerb. They
// are the city breathing, and the reason reckless driving has consequences.

import { TUNING, rand, randi, choice, dist, angleTo, clamp } from './config.js';
import { randomSidewalkPoint, collideCircle } from './city.js';
import { Effects } from './effects.js';

const SHIRTS = ['#d85858', '#58a0d8', '#e8c53d', '#7fc86a', '#c88ad8', '#e8e8e8', '#5a5a66', '#e87f3d', '#4fb8c8'];
const PANTS = ['#3a4a6b', '#5a4a3a', '#2c2c34', '#6b6b7a', '#4a5a3a'];
const SKINS = ['#e8b98a', '#c98a5a', '#8a5a3a', '#f2d0a8', '#6a4530'];
const HAIRS = ['#4a3220', '#1c1c22', '#c8a848', '#8a8a8a', '#b05028', '#2c2c34'];

export function makePed(x, y) {
  return {
    x, y, angle: rand(0, Math.PI * 2),
    shirt: choice(SHIRTS), pants: choice(PANTS), skin: choice(SKINS), hair: choice(HAIRS),
    phase: rand(0, Math.PI * 2),
    waypoint: randomSidewalkPoint(),
    state: 'walk', // walk | idle | flee | dead
    idleTimer: rand(0, 4),
    fleeTimer: 0,
    fleeFrom: null,
    moving: false,
    dead: false,
    deadTimer: 0,
    speed: rand(45, 70),
    scared: false,
  };
}

export function spawnPeds(state, count) {
  for (let i = 0; i < count; i++) {
    const p = randomSidewalkPoint();
    // Keep the player's doorstep clear at spawn time.
    if (dist(p.x, p.y, state.player.x, state.player.y) < 120) continue;
    state.peds.push(makePed(p.x, p.y));
  }
}

export function scarePeds(state, x, y, radius) {
  for (const ped of state.peds) {
    if (ped.dead) continue;
    if (dist(ped.x, ped.y, x, y) < radius) {
      ped.state = 'flee';
      ped.fleeTimer = rand(2.5, 5);
      ped.fleeFrom = { x, y };
      ped.scared = true;
    }
  }
}

export function updatePeds(state, dt) {
  const player = state.player;
  for (let i = state.peds.length - 1; i >= 0; i--) {
    const ped = state.peds[i];
    if (ped.dead) {
      ped.deadTimer -= dt;
      if (ped.deadTimer <= 0) state.peds.splice(i, 1);
      continue;
    }
    // A speeding car bearing down scares people off the road.
    if (ped.state !== 'flee') {
      for (const car of state.cars) {
        if (Math.abs(car.speed) < 120) continue;
        const aheadX = car.x + Math.cos(car.angle) * 70;
        const aheadY = car.y + Math.sin(car.angle) * 70;
        if (dist(aheadX, aheadY, ped.x, ped.y) < 40) {
          ped.state = 'flee';
          ped.fleeTimer = rand(2, 4);
          ped.fleeFrom = { x: car.x, y: car.y };
          break;
        }
      }
    }

    let tx, ty, speed;
    if (ped.state === 'flee') {
      ped.fleeTimer -= dt;
      const away = angleTo(ped.fleeFrom.x, ped.fleeFrom.y, ped.x, ped.y);
      tx = ped.x + Math.cos(away) * 100;
      ty = ped.y + Math.sin(away) * 100;
      speed = TUNING.pedFlee;
      if (ped.fleeTimer <= 0) {
        ped.state = 'walk';
        ped.waypoint = randomSidewalkPoint();
      }
    } else if (ped.state === 'idle') {
      ped.idleTimer -= dt;
      ped.moving = false;
      if (ped.idleTimer <= 0) {
        ped.state = 'walk';
        ped.waypoint = randomSidewalkPoint();
      }
      continue;
    } else {
      tx = ped.waypoint.x; ty = ped.waypoint.y;
      speed = ped.speed;
      if (dist(ped.x, ped.y, tx, ty) < 18) {
        if (Math.random() < 0.3) {
          ped.state = 'idle';
          ped.idleTimer = rand(2, 7);
        } else {
          ped.waypoint = randomSidewalkPoint();
        }
        continue;
      }
    }

    const want = angleTo(ped.x, ped.y, tx, ty);
    let diff = want - ped.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    ped.angle += clamp(diff, -3.2 * dt, 3.2 * dt);
    const circle = { x: ped.x + Math.cos(ped.angle) * speed * dt, y: ped.y + Math.sin(ped.angle) * speed * dt, radius: 10 };
    collideCircle(state.city, circle);
    ped.x = circle.x; ped.y = circle.y;
    ped.moving = true;
  }

  // Keep the sidewalks populated near the player.
  let near = 0;
  for (const ped of state.peds) if (!ped.dead && dist(ped.x, ped.y, player.x, player.y) < 1100) near++;
  if (near < 34 && Math.random() < dt * 2) {
    const p = randomSidewalkPoint();
    if (dist(p.x, p.y, player.x, player.y) > 450 && dist(p.x, p.y, player.x, player.y) < 1100) {
      state.peds.push(makePed(p.x, p.y));
    }
  }
  // Recycle far-away peds.
  for (let i = state.peds.length - 1; i >= 0; i--) {
    if (dist(state.peds[i].x, state.peds[i].y, player.x, player.y) > 1400) state.peds.splice(i, 1);
  }
}

// A car strike: peds go down hard, and the city notices.
export function hitPedByCar(state, ped, car) {
  if (ped.dead) return;
  ped.dead = true;
  ped.deadTimer = 18;
  ped.angle += rand(-1, 1);
  Effects.blood(ped.x, ped.y);
  Effects.floatText(ped.x, ped.y - 20, '!', '#ff5050');
  scarePeds(state, ped.x, ped.y, 260);
  if (car.driver === 'player') {
    state.stats.pedsHit++;
    state.police.addHeat(state, 1, 'You ran someone down!');
  }
}
