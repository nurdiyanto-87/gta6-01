// San Cielo Heat — the SCPD: wanted stars, pursuing cruisers that follow
// the roads, roadblocks at three stars, and the bust / evade timers.

import { ROAD_CENTERS, ROAD_WIDTH, TUNING } from './config.js';
import { clamp, dist, makeRng, turnToward } from './util.js';
import { collideCar, nearestRoadPoint, randomRoadPoint } from './city.js';
import { driveCar, makeVehicle } from './vehicles.js';

export class PoliceSystem {
  constructor(city) {
    this.city = city;
    this.cruisers = [];
    this.roadblocks = [];
    this.rng = makeRng(24681357);
    this.spawnTimer = 0;
    this.evadeTimer = 0;
    this.bustTimer = 0;
    this.searching = false;
    this.flashPhase = 0;
  }

  wantedCruisers(wanted) {
    if (wanted <= 0) return 0;
    if (wanted === 1) return 1;
    if (wanted === 2) return 2;
    if (wanted === 3) return 3;
    if (wanted === 4) return 4;
    return 5;
  }

  reset() {
    this.cruisers = [];
    this.roadblocks = [];
    this.evadeTimer = 0;
    this.bustTimer = 0;
    this.searching = false;
  }

  spawnCruiser(px, py) {
    const point = randomRoadPoint(this.city, this.rng, px, py, 500, 1200);
    const car = makeVehicle('police', point.x, point.y, Math.atan2(py - point.y, px - point.x));
    car.driver = 'police';
    car.color = '#e8e8ec';
    car.sirenPhase = this.rng.range(0, 1);
    this.cruisers.push(car);
    return car;
  }

  spawnRoadblock(px, py) {
    // Two cruisers parked across the nearest road, ahead of the player.
    const road = nearestRoadPoint(px, py);
    const vertical = Math.abs(px - road.x) < 1;
    const ahead = 320;
    const bx = vertical ? road.x : px + ahead;
    const by = vertical ? py + ahead : road.y;
    for (const side of [-1, 1]) {
      const car = makeVehicle('police', bx + (vertical ? side * 26 : 0), by + (vertical ? 0 : side * 26), vertical ? 0 : Math.PI / 2);
      car.driver = 'police';
      car.color = '#e8e8ec';
      car.roadblock = true;
      car.speed = 0;
      this.roadblocks.push(car);
    }
  }

  canSeePlayer(game, px, py) {
    // Police see the player when a cruiser is close, or the player is loud.
    for (const car of this.cruisers) {
      if (dist(car.x, car.y, px, py) < 520) return true;
    }
    if (game.player.inCar && Math.abs(game.player.inCar.speed) > 260) {
      for (const car of this.cruisers) {
        if (dist(car.x, car.y, px, py) < 800) return true;
      }
    }
    return false;
  }

  update(dt, game) {
    const player = game.player;
    const px = player.inCar ? player.inCar.x : player.x;
    const py = player.inCar ? player.inCar.y : player.y;
    this.flashPhase = (this.flashPhase + dt * 2) % 1;

    const want = this.wantedCruisers(player.wanted);
    this.spawnTimer -= dt;
    if (this.cruisers.length < want && this.spawnTimer <= 0 && player.wanted > 0) {
      this.spawnCruiser(px, py);
      this.spawnTimer = 1.4;
    }
    if (this.cruisers.length > want) {
      this.cruisers.length = want;
    }
    if (player.wanted === 0) {
      this.reset();
      return { busted: false, evaded: false };
    }

    // Roadblocks appear at 3+ stars and refresh as the player moves on.
    if (player.wanted >= 3 && this.roadblocks.length === 0) {
      this.spawnRoadblock(px, py);
    }
    if (player.wanted < 3) this.roadblocks = [];
    this.roadblocks = this.roadblocks.filter((c) => dist(c.x, c.y, px, py) < 1400);

    // Pursuit: each cruiser steers along the roads toward the player.
    for (const car of this.cruisers) {
      this.pursue(car, px, py, dt, game);
    }

    // Bust: a cruiser sits on top of a slow player for long enough.
    let busted = false;
    let touching = false;
    for (const car of this.cruisers) {
      const d = dist(car.x, car.y, px, py);
      const slow = player.inCar ? Math.abs(player.inCar.speed) < 40 : true;
      if (d < 60 && slow) touching = true;
      // Ramming damage to the player's car, scaled per second of contact.
      if (d < 52 && player.inCar && Math.abs(car.speed) > 120) {
        player.inCar.damage = clamp(player.inCar.damage + 0.3 * dt, 0, 1);
      }
    }
    if (touching) {
      this.bustTimer += dt;
      if (this.bustTimer >= TUNING.bustTime) busted = true;
    } else {
      this.bustTimer = Math.max(0, this.bustTimer - dt * 2);
    }

    // Evade: stay unseen for long enough and the heat fades one star at a time.
    let evaded = false;
    if (!this.canSeePlayer(game, px, py)) {
      this.searching = true;
      this.evadeTimer += dt;
      if (this.evadeTimer >= TUNING.evadeTime) {
        player.wanted = Math.max(0, player.wanted - 1);
        this.evadeTimer = 0;
        this.searching = false;
        evaded = true;
        if (player.wanted === 0) this.reset();
      }
    } else {
      this.searching = false;
      this.evadeTimer = 0;
    }

    return { busted, evaded };
  }

  pursue(car, px, py, dt, game) {
    // Steer toward the nearest road point on the way to the player, so the
    // cruiser follows streets instead of cutting through buildings.
    const road = nearestRoadPoint(car.x, car.y);
    const onRoad = Math.abs(car.x - road.x) < 4 || Math.abs(car.y - road.y) < 4;
    let targetX = px;
    let targetY = py;
    if (!onRoad) {
      targetX = road.x;
      targetY = road.y;
    } else {
      // Head for the road intersection nearest the player's street.
      const playerRoad = nearestRoadPoint(px, py);
      const dx = Math.abs(px - car.x);
      const dy = Math.abs(py - car.y);
      if (dx > 90 && dy > 90) {
        targetX = playerRoad.x;
        targetY = playerRoad.y;
      }
    }
    const wantAngle = Math.atan2(targetY - car.y, targetX - car.x);
    const diff = turnToward(car.angle, wantAngle, 3.4 * dt) - car.angle;
    const d = dist(car.x, car.y, px, py);
    const throttle = d > 46 ? 1 : 0.25;
    const steer = clamp(diff * 4, -1, 1);
    driveCar(car, throttle, steer, false, dt);
    car.speed = Math.min(car.speed, TUNING.policeSpeed);
    if (collideCar(this.city, car, car.def.len / 2, car.def.wid / 2)) {
      car.speed *= 0.45;
      if (game && game.effects) game.effects.sparks(car.x, car.y);
    }
    // Siren wail phase for the light bar.
    car.sirenPhase = (car.sirenPhase + dt * 2.2) % 1;
  }
}
