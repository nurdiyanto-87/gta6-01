// Solmar Heat — city traffic and parked cars.
// Traffic cars cruise the road grid between intersections, brake for what is
// ahead of them and honk when stuck. Parked cars line the kerbs: they are the
// cars the player can steal. Both populations refill near the player.

import { WORLD, ROAD_WIDTH, ROAD_CENTERS, TUNING, clamp, rand, randi, choice, dist, angleDiff } from './config.js';
import { nearestIntersection, randomRoadPoint } from './city.js';
import { makeCar, driveCar, damageCar, CAR_DEFS } from './vehicles.js';
import { Effects } from './effects.js';
import { AudioSys } from './audio.js';

const TRAFFIC_DEFS = ['sedan', 'sedan', 'coupe', 'pickup', 'van', 'taxi', 'beater', 'muscle'];

export function spawnTrafficCar(city, nearX, nearY) {
  // Pick a road point near the player but off-screen when possible.
  let p = randomRoadPoint();
  for (let tries = 0; tries < 8; tries++) {
    const cand = randomRoadPoint();
    const d = dist(cand.x, cand.y, nearX, nearY);
    if (d > 520 && d < 1100) { p = cand; break; }
    p = cand;
  }
  const vertical = Math.abs(p.x - nearestIntersection(p.x, p.y).x) < 4;
  const angle = vertical ? (Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (Math.random() < 0.5 ? 0 : Math.PI);
  const car = makeCar(choice(TRAFFIC_DEFS), p.x, p.y, angle, { driver: 'traffic' });
  car.cruiseSpeed = rand(100, 145);
  car.waypoint = pickNextIntersection(p.x, p.y, angle);
  car.stuckTimer = 0;
  return car;
}

export function spawnParkedCar(city, nearX, nearY) {
  const vertical = Math.random() < 0.5;
  const c = choice(ROAD_CENTERS);
  const along = rand(150, WORLD - 350);
  const side = Math.random() < 0.5 ? 1 : -1;
  const off = side * (ROAD_WIDTH / 2 - 15);
  const x = vertical ? c + off : along;
  const y = vertical ? along : c + off;
  const angle = vertical ? (side > 0 ? Math.PI / 2 : -Math.PI / 2) : (side > 0 ? 0 : Math.PI);
  const car = makeCar(choice(TRAFFIC_DEFS), x, y, angle, { driver: 'parked' });
  return car;
}

function pickNextIntersection(x, y, angle) {
  const here = nearestIntersection(x, y);
  const neighbours = [];
  for (const cx of ROAD_CENTERS) {
    if (Math.abs(cx - here.x) === 400 && Math.abs(here.y - y) < 400) neighbours.push({ x: cx, y: here.y });
  }
  for (const cy of ROAD_CENTERS) {
    if (Math.abs(cy - here.y) === 400 && Math.abs(here.x - x) < 400) neighbours.push({ x: here.x, y: cy });
  }
  // Also allow continuing straight past the intersection to the next one.
  if (neighbours.length === 0) return { x: here.x, y: here.y };
  return choice(neighbours);
}

export function updateTraffic(state, dt) {
  const player = state.player;
  const px = player.x, py = player.y;

  for (const car of state.cars) {
    if (car.driver !== 'traffic') continue;
    if (car.dead) continue;
    const wp = car.waypoint;
    const d = dist(car.x, car.y, wp.x, wp.y);
    if (d < 30) {
      car.waypoint = pickNextIntersection(car.x, car.y, car.angle);
      continue;
    }
    // Steer toward the waypoint.
    const want = Math.atan2(wp.y - car.y, wp.x - car.x);
    const diff = angleDiff(car.angle, want);
    const steer = clamp(diff * 2.2, -1, 1);

    // Brake for obstacles ahead: cars and people.
    const aheadX = car.x + Math.cos(car.angle) * 62;
    const aheadY = car.y + Math.sin(car.angle) * 62;
    let blocked = false;
    for (const other of state.cars) {
      if (other === car || other.dead) continue;
      if (dist(aheadX, aheadY, other.x, other.y) < 34) { blocked = true; break; }
    }
    if (!blocked) {
      for (const ped of state.peds) {
        if (ped.dead) continue;
        if (dist(aheadX, aheadY, ped.x, ped.y) < 26) { blocked = true; break; }
      }
      if (!player.car && dist(aheadX, aheadY, px, py) < 26) blocked = true;
    }
    if (blocked) {
      car.honkTimer -= dt;
      if (car.honkTimer <= 0 && dist(car.x, car.y, px, py) < 500) {
        car.honkTimer = rand(2, 4);
        AudioSys.horn();
      }
    }

    const targetSpeed = blocked ? 0 : car.cruiseSpeed;
    const throttle = car.speed < targetSpeed ? 1 : (car.speed > targetSpeed + 10 ? -0.6 : 0);
    driveCar(car, { throttle, steer, handbrake: false }, dt, state.city, state);

    // Stuck detection: pick a fresh route instead of grinding a wall.
    if (Math.abs(car.speed) < 6 && throttle > 0) {
      car.stuckTimer += dt;
      if (car.stuckTimer > 3) {
        car.stuckTimer = 0;
        car.waypoint = pickNextIntersection(car.x + rand(-100, 100), car.y + rand(-100, 100), car.angle);
      }
    } else {
      car.stuckTimer = 0;
    }
  }

  // Keep the streets populated near the player; recycle far-away cars.
  let trafficCount = 0, parkedCount = 0;
  for (let i = state.cars.length - 1; i >= 0; i--) {
    const car = state.cars[i];
    if (car.driver === 'traffic') {
      trafficCount++;
      if (dist(car.x, car.y, px, py) > 1300 || car.dead) {
        state.cars.splice(i, 1);
        trafficCount--;
      }
    } else if (car.driver === 'parked') {
      parkedCount++;
      if (car.dead) { state.cars.splice(i, 1); parkedCount--; }
    }
  }
  while (trafficCount < 20) {
    state.cars.push(spawnTrafficCar(state.city, px, py));
    trafficCount++;
  }
  state.parkedRespawn = (state.parkedRespawn || 0) - dt;
  if (parkedCount < 14 && state.parkedRespawn <= 0) {
    state.parkedRespawn = 4;
    state.cars.push(spawnParkedCar(state.city, px, py));
  }
}

// Gentle pairwise separation between cars, with damage on hard impacts.
export function resolveCarCollisions(state) {
  const cars = state.cars;
  for (let i = 0; i < cars.length; i++) {
    const a = cars[i];
    if (a.dead) continue;
    for (let j = i + 1; j < cars.length; j++) {
      const b = cars[j];
      if (b.dead) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const rr = (a.def.length + b.def.length) / 2 - 14;
      const d2 = dx * dx + dy * dy;
      if (d2 >= rr * rr || d2 < 0.01) continue;
      const d = Math.sqrt(d2);
      const push = (rr - d) / 2;
      const nx = dx / d, ny = dy / d;
      a.x -= nx * push; a.y -= ny * push;
      b.x += nx * push; b.y += ny * push;
      const closing = Math.abs(a.speed - b.speed);
      if (closing > 110) {
        const midX = (a.x + b.x) / 2, midY = (a.y + b.y) / 2;
        Effects.sparks(midX, midY);
        damageCar(a, closing / 40, state);
        damageCar(b, closing / 40, state);
        if (state.player.car === a || state.player.car === b) {
          AudioSys.crash(closing / 400);
          Effects.addShake(5);
        }
        a.speed *= 0.6; b.speed *= 0.6;
      }
    }
  }
}
