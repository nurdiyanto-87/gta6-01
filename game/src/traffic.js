// San Cielo Heat — traffic: civilian cars that cruise the road grid in
// their lanes, turn at intersections, brake for trouble ahead, and park
// along the kerb waiting to be stolen.

import { OCEAN_Y, ROAD_CENTERS, TUNING, WORLD } from './config.js';
import { collideCircle, isOnRoad } from './city.js';
import { clamp, makeRng } from './util.js';
import { driveCar, makeVehicle, vehicleDef } from './vehicles.js';

const CIVILIAN_TYPES = ['hatch', 'sedan', 'coupe', 'muscle', 'pickup', 'van', 'taxi', 'limo'];
const LANE = 20; // lane offset from the road centre

export class TrafficSystem {
  constructor(city) {
    this.city = city;
    this.cars = []; // moving traffic
    this.parked = []; // parked, stealable
    this.rng = makeRng(777001);
  }

  spawnInitial() {
    for (let i = 0; i < 26; i++) this.spawnTrafficCar(true);
    for (let i = 0; i < 30; i++) this.spawnParkedCar();
  }

  randomRoadSpot() {
    const vertical = this.rng.chance(0.5);
    const c = this.rng.pick(ROAD_CENTERS);
    const along = this.rng.range(80, WORLD - 80);
    return vertical ? { x: c, y: along, vertical } : { x: along, y: c, vertical };
  }

  spawnTrafficCar(anywhere) {
    const spot = this.randomRoadSpot();
    if (spot.y > OCEAN_Y - 60) return;
    const dir = this.rng.chance(0.5) ? 1 : -1;
    const type = this.rng.pick(CIVILIAN_TYPES);
    const lane = dir > 0 ? LANE : -LANE;
    const x = spot.vertical ? spot.x + lane : spot.x;
    const y = spot.vertical ? spot.y : spot.y + lane;
    const angle = spot.vertical ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
    const car = makeVehicle(type, x, y, angle, { driver: 'traffic' });
    car.traffic = {
      vertical: spot.vertical,
      road: spot.vertical ? spot.x : spot.y,
      dir,
      speed: TUNING.trafficSpeed * this.rng.range(0.8, 1.1),
      pause: 0,
    };
    car.speed = car.traffic.speed;
    this.cars.push(car);
  }

  spawnParkedCar() {
    for (let tries = 0; tries < 20; tries++) {
      const spot = this.randomRoadSpot();
      if (spot.y > OCEAN_Y - 60) continue;
      const side = this.rng.chance(0.5) ? 1 : -1;
      const off = 30 * side;
      const x = spot.vertical ? spot.x + off : spot.x;
      const y = spot.vertical ? spot.y : spot.y + off;
      if (!isOnRoad(this.city, x, y)) continue;
      if (this.parked.some((p) => Math.hypot(p.x - x, p.y - y) < 90)) continue;
      const angle = spot.vertical ? (side > 0 ? Math.PI / 2 : -Math.PI / 2) : (side > 0 ? 0 : Math.PI);
      const type = this.rng.pick(CIVILIAN_TYPES);
      const car = makeVehicle(type, x, y, angle, { driver: null });
      this.parked.push(car);
      return;
    }
  }

  // A traffic car whose driver bails (stolen, wrecked) becomes an empty car.
  removeTrafficCar(car) {
    const i = this.cars.indexOf(car);
    if (i >= 0) this.cars.splice(i, 1);
  }

  removeParkedCar(car) {
    const i = this.parked.indexOf(car);
    if (i >= 0) this.parked.splice(i, 1);
  }

  nearestStealable(x, y, radius) {
    let best = null;
    let bestD = radius;
    const consider = (car) => {
      if (car.wrecked) return;
      const d = Math.hypot(car.x - x, car.y - y);
      if (d < bestD) { bestD = d; best = car; }
    };
    for (const c of this.parked) consider(c);
    for (const c of this.cars) {
      if (Math.hypot(c.vx, c.vy) > 40) continue; // only slow traffic can be jacked
      consider(c);
    }
    return best;
  }

  update(dt, game) {
    const player = game.player;
    const px = player.x;
    const py = player.y;

    for (const car of this.cars) {
      const t = car.traffic;
      if (car.wrecked) {
        driveCar(game, car, { throttle: 0, steer: 0 }, dt);
        continue;
      }
      // Brake for the car ahead or a pedestrian in the way.
      let want = t.speed;
      const ahead = this.carAhead(car, 95);
      if (ahead) want = Math.min(want, Math.max(0, ahead.speed - 20));
      if (game.peds.pedAhead(car.x, car.y, car.angle, 70)) want = 0;
      if (t.pause > 0) { t.pause -= dt; want = 0; }

      // Steer back onto the lane centre and turn at intersections.
      const lanePos = t.vertical ? car.x : car.y;
      const laneTarget = t.road + (t.dir > 0 ? LANE : -LANE);
      const laneErr = laneTarget - lanePos;
      const wantAngle = t.vertical ? (t.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (t.dir > 0 ? 0 : Math.PI);
      let steer = clamp(laneErr * 0.02, -1, 1) * 0.6;
      // Near an intersection, sometimes pick a new road. Remember the
      // crossing so the same car does not re-decide every frame.
      const along = t.vertical ? car.y : car.x;
      const cross = nearestCrossing(along);
      if (t.lastCross && Math.hypot(car.x - t.lastCross.x, car.y - t.lastCross.y) > 90) t.lastCross = null;
      if (Math.abs(along - cross) < 26 && !t.lastCross) {
        t.lastCross = { x: car.x, y: car.y };
        if (this.rng.chance(0.35)) {
          t.vertical = !t.vertical;
          t.road = cross;
          t.dir = this.rng.chance(0.5) ? 1 : -1;
        }
      }

      const angleErr = angleDelta(car.angle, wantAngle);
      steer += clamp(angleErr * 1.6, -1, 1);
      const throttle = car.speed < want ? 1 : car.speed > want + 8 ? -0.6 : 0;
      driveCar(game, car, { throttle, steer: clamp(steer, -1, 1) }, dt);

      // Despawn far away, respawn near the player to keep streets alive.
      if (Math.hypot(car.x - px, car.y - py) > 1400) {
        this.respawnNear(car, px, py);
      }
    }

    // Keep the traffic count steady.
    while (this.cars.length < 24) this.spawnTrafficCar(false);
  }

  carAhead(car, range) {
    let best = null;
    let bestD = range;
    const fx = Math.cos(car.angle);
    const fy = Math.sin(car.angle);
    const check = (other) => {
      if (other === car || other.wrecked) return;
      const dx = other.x - car.x;
      const dy = other.y - car.y;
      const forward = dx * fx + dy * fy;
      const side = Math.abs(-dx * fy + dy * fx);
      if (forward > 0 && forward < bestD && side < 26) { bestD = forward; best = other; }
    };
    for (const c of this.cars) check(c);
    for (const c of this.parked) check(c);
    return best;
  }

  respawnNear(car, px, py) {
    for (let tries = 0; tries < 12; tries++) {
      const spot = this.randomRoadSpot();
      const d = Math.hypot(spot.x - px, spot.y - py);
      if (d > 700 && d < 1200 && spot.y < OCEAN_Y - 60) {
        const t = car.traffic;
        const lane = t.dir > 0 ? LANE : -LANE;
        car.x = spot.vertical ? spot.x + lane : spot.x;
        car.y = spot.vertical ? spot.y : spot.y + lane;
        t.vertical = spot.vertical;
        t.road = spot.vertical ? spot.x : spot.y;
        car.angle = t.vertical ? (t.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (t.dir > 0 ? 0 : Math.PI);
        car.vx = 0;
        car.vy = 0;
        car.speed = t.speed;
        car.health = car.maxHealth;
        car.wrecked = false;
        return;
      }
    }
  }
}

function nearestCrossing(along) {
  let best = ROAD_CENTERS[0];
  let bestD = Math.abs(along - best);
  for (const c of ROAD_CENTERS) {
    const d = Math.abs(along - c);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

function angleDelta(from, to) {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
