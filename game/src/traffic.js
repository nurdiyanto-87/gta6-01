// San Cielo Heat — traffic: cars that follow the road grid in lanes, slow
// for the car ahead and for the player, plus parked cars to steal.

import { ROAD_CENTERS, ROAD_WIDTH, TUNING, WORLD } from './config.js';
import { VEHICLE_TYPES, driveCar, makeVehicle } from './vehicles.js';
import { clamp, dist, makeRng, turnToward } from './util.js';
import { nearestRoadCenter, randomRoadPoint } from './city.js';

const LANE_OFFSET = 17;
const DRIVE_KEYS = ['sedan', 'coupe', 'muscle', 'taxi', 'van', 'pickup', 'compact'];

export class TrafficSystem {
  constructor(city) {
    this.city = city;
    this.cars = [];
    this.parked = [];
    this.rng = makeRng(987654321);
    this.respawnTimer = 0;
  }

  spawnInitial() {
    for (let i = 0; i < 26; i++) this.spawnMovingCar();
    for (let i = 0; i < 22; i++) this.spawnParkedCar();
  }

  spawnMovingCar(nearX, nearY) {
    const point = randomRoadPoint(this.city, this.rng, nearX, nearY, 500, 2400);
    const vertical = Math.abs(point.x - nearestRoadCenter(point.x)) < 1;
    const dir = this.rng.chance(0.5) ? 1 : -1;
    const type = this.rng.pick(DRIVE_KEYS);
    const car = makeVehicle(type, point.x, point.y, vertical ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI));
    car.driver = 'traffic';
    car.speed = TUNING.trafficSpeed * this.rng.range(0.85, 1.05);
    car.vertical = vertical;
    car.dir = dir;
    car.road = vertical ? point.x : point.y;
    car.targetSpeed = car.speed;
    car.waitTimer = 0;
    this.cars.push(car);
    return car;
  }

  spawnParkedCar() {
    const point = randomRoadPoint(this.city, this.rng);
    const vertical = Math.abs(point.x - nearestRoadCenter(point.x)) < 1;
    const side = this.rng.chance(0.5) ? 1 : -1;
    const offset = ROAD_WIDTH / 2 - 16;
    const x = vertical ? point.x + side * offset : point.x;
    const y = vertical ? point.y : point.y + side * offset;
    const angle = vertical ? (side > 0 ? Math.PI / 2 : -Math.PI / 2) : (side > 0 ? 0 : Math.PI);
    const car = makeVehicle(this.rng.pick(DRIVE_KEYS), x, y, angle);
    car.driver = null;
    this.parked.push(car);
    return car;
  }

  nearestCar(x, y, maxD, includeParked) {
    let best = null;
    let bestD = maxD;
    const lists = includeParked ? [this.cars, this.parked] : [this.cars];
    for (const list of lists) {
      for (const car of list) {
        const d = dist(x, y, car.x, car.y);
        if (d < bestD) { bestD = d; best = car; }
      }
    }
    return best;
  }

  removeCar(car) {
    const i = this.cars.indexOf(car);
    if (i >= 0) this.cars.splice(i, 1);
    const j = this.parked.indexOf(car);
    if (j >= 0) this.parked.splice(j, 1);
  }

  parkCar(car) {
    car.driver = null;
    car.speed = 0;
    this.removeCar(car);
    this.parked.push(car);
  }

  update(dt, player, allCars) {
    const px = player.inCar ? player.inCar.x : player.x;
    const py = player.inCar ? player.inCar.y : player.y;

    for (let i = this.cars.length - 1; i >= 0; i--) {
      const car = this.cars[i];
      this.updateMovingCar(car, dt, player, allCars);
      // Recycle cars that wandered too far from the player.
      if (dist(car.x, car.y, px, py) > 2600) {
        this.cars.splice(i, 1);
        this.spawnMovingCar(px, py);
      }
    }

    this.respawnTimer -= dt;
    if (this.respawnTimer <= 0) {
      this.respawnTimer = 2;
      if (this.cars.length < 26) this.spawnMovingCar(px, py);
      if (this.parked.length < 18) this.spawnParkedCar();
    }
  }

  updateMovingCar(car, dt, player, allCars) {
    // Lane target: stay on the right-hand side of the road.
    const lane = car.road + car.dir * LANE_OFFSET * (car.vertical ? 1 : 1);
    let targetAngle;
    if (car.vertical) {
      targetAngle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      car.x += (lane - car.x) * Math.min(1, 2.2 * dt);
    } else {
      targetAngle = car.dir > 0 ? 0 : Math.PI;
      car.y += (lane - car.y) * Math.min(1, 2.2 * dt);
    }

    // At an intersection, sometimes turn onto the cross street.
    const along = car.vertical ? car.y : car.x;
    const crossing = nearestCrossing(along);
    if (Math.abs(along - crossing) < 6 && this.rng.chance(0.3)) {
      car.vertical = !car.vertical;
      car.road = crossing;
      car.dir = this.rng.chance(0.5) ? 1 : -1;
    }
    // Turn around at the map edge.
    if (along < 130 || along > WORLD - 130) car.dir *= -1;

    // Slow for the car ahead or for a person in the way.
    let wantSpeed = car.targetSpeed;
    const aheadX = car.x + Math.cos(car.angle) * 70;
    const aheadY = car.y + Math.sin(car.angle) * 70;
    for (const other of allCars) {
      if (other === car || other.dead) continue;
      if (dist(aheadX, aheadY, other.x, other.y) < 46) { wantSpeed = 0; break; }
    }
    if (!player.inCar && dist(aheadX, aheadY, player.x, player.y) < 40) wantSpeed = 0;

    car.angle = turnToward(car.angle, targetAngle, 3.2 * dt);
    car.speed += clamp(wantSpeed - car.speed, -320 * dt, 160 * dt);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    car.x = clamp(car.x, 60, WORLD - 60);
    car.y = clamp(car.y, 60, WORLD - 60);
  }
}

function nearestCrossing(along) {
  let best = ROAD_CENTERS[0];
  let bestD = Infinity;
  for (const c of ROAD_CENTERS) {
    const d = Math.abs(along - c);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}
