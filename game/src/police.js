// San Cielo Heat — the wanted system and the SCPD: stars that rise with
// every crime, cruisers that chase along the road grid, roadblocks at
// three stars, and the bust that ends a run when the cops box Mara in.
//
// Pursuit routing: interceptors drive the streets like everyone else.
// Each cruiser plans a Manhattan route over the road grid — onto the
// nearest road, along it to the intersection nearest the player, then
// down the player's road — and only cuts straight at the target for the
// final approach, so chases read as chases instead of cross-country
// shortcuts through buildings.

import { PLACES, TUNING } from './config.js';
import { nearestRoadCenter, nearestRoadPoint, randomRoadPoint } from './city.js';
import { angleTo, clamp, dist, makeRng } from './util.js';
import { carSpeed, driveCar, makeVehicle } from './vehicles.js';

export class PoliceSystem {
  constructor(city) {
    this.city = city;
    this.wanted = 0;
    this.cruisers = [];
    this.roadblocks = [];
    this.evadeTimer = 0;
    this.bustTimer = 0;
    this.spawnTimer = 0;
    this.rng = makeRng(909090);
    this.busted = false;
  }

  addWanted(n, message) {
    const before = this.wanted;
    this.wanted = clamp(this.wanted + n, 0, TUNING.maxWanted);
    if (this.wanted > before && this.game) {
      if (message && this.game) this.game.addMessage(message);
      this.game.audio.sirenBlip();
      this.game.effects.screenFlash('60,90,255', 0.35);
    }
    this.evadeTimer = 0;
  }

  clearWanted(message) {
    this.wanted = 0;
    this.evadeTimer = 0;
    this.bustTimer = 0;
    for (const c of this.cruisers) c.leaving = true;
    this.roadblocks = [];
    if (message && this.game) this.game.addMessage(message);
  }

  // Gunfire draws attention: a quiet street turns hot fast.
  noiseAt(x, y) {
    if (this.wanted === 0) this.addWanted(1, 'Shots reported — police responding!');
    else this.evadeTimer = 0;
  }

  wantedCount() {
    return [0, 1, 2, 3, 4, 5][this.wanted];
  }

  nearestCopDistance(x, y) {
    let best = Infinity;
    for (const c of this.cruisers) best = Math.min(best, dist(c.x, c.y, x, y));
    return best;
  }

  nearestAbandonedCruiser(x, y, radius) {
    for (const c of this.cruisers) {
      if (c.driver === null && !c.wrecked && dist(c.x, c.y, x, y) < radius) return c;
    }
    return null;
  }

  claimCruiser(car) {
    const i = this.cruisers.indexOf(car);
    if (i >= 0) this.cruisers.splice(i, 1);
  }

  update(dt, game) {
    this.game = game;
    const player = game.player;

    // Keep the fleet matched to the heat.
    const want = this.wantedCount();
    this.spawnTimer -= dt;
    if (this.cruisers.length < want && this.spawnTimer <= 0) {
      this.spawnTimer = 1.2;
      this.spawnCruiser(game);
    }

    // Drive every cruiser.
    for (let i = this.cruisers.length - 1; i >= 0; i--) {
      const car = this.cruisers[i];
      if (car.driver === 'player') { this.cruisers.splice(i, 1); continue; }
      if (car.leaving) {
        // Heat cleared: drive off and despawn.
        driveCar(game, car, { throttle: 0.7, steer: 0.1 }, dt);
        if (dist(car.x, car.y, player.x, player.y) > 900) this.cruisers.splice(i, 1);
        continue;
      }
      const input = this.pursuitInput(car, player, dt);
      driveCar(game, car, input, dt);
      car.siren = true;

      // Ramming a cruiser into Mara's car is the SCPD's favourite tactic.
      if (carSpeed(car) > 60 && dist(car.x, car.y, player.x, player.y) < 60 && player.inCar) {
        game.peds.scareAt(car.x, car.y, 200);
      }
    }

    // Roadblocks at three stars and up.
    if (this.wanted >= 3 && this.roadblocks.length === 0) this.placeRoadblock(game);
    if (this.wanted < 3) this.roadblocks = [];

    // Evading: unseen for long enough and one star cools off.
    if (this.wanted > 0) {
      const nearest = this.nearestCopDistance(player.x, player.y);
      if (nearest > 520) {
        this.evadeTimer += dt;
        if (this.evadeTimer >= TUNING.evadeTime) {
          this.evadeTimer = 0;
          this.wanted -= 1;
          game.addMessage(this.wanted === 0 ? 'You lost them. The heat is off.' : 'Heat cooling down: ' + this.wanted + ' star' + (this.wanted > 1 ? 's' : '') + '.');
          if (this.wanted === 0) this.clearWanted(null);
        }
      } else {
        this.evadeTimer = 0;
      }
    }

    // Busted: crawling, with a cruiser on the bumper.
    if (this.wanted > 0 && !player.dead) {
      const playerSpeed = player.inCar ? carSpeed(player.inCar) : (player.moving ? 120 : 0);
      const nearest = this.nearestCopDistance(player.x, player.y);
      if (playerSpeed < 30 && nearest < 70) {
        this.bustTimer += dt;
        if (this.bustTimer >= TUNING.bustTime) {
          this.busted = true;
          this.bustTimer = 0;
        }
      } else {
        this.bustTimer = Math.max(0, this.bustTimer - dt * 2);
      }
    }
  }

  spawnCruiser(game) {
    const player = game.player;
    const spot = randomRoadPoint(this.city, this.rng, player.x, player.y, 380, 700);
    const type = this.wanted >= 3 ? 'interceptor' : 'cruiser';
    const car = makeVehicle(type, spot.x, spot.y, angleTo(spot.x, spot.y, player.x, player.y), { driver: 'police' });
    car.siren = true;
    car.stuckTimer = 0;
    this.cruisers.push(car);
  }

  placeRoadblock(game) {
    const player = game.player;
    const ahead = {
      x: player.x + Math.cos(player.angle) * 420,
      y: player.y + Math.sin(player.angle) * 420,
    };
    const road = nearestRoadPoint(ahead.x, ahead.y);
    const horizontal = Math.abs(ahead.x - road.x) > Math.abs(ahead.y - road.y);
    for (const side of [-1, 1]) {
      const x = horizontal ? road.x : road.x + side * 26;
      const y = horizontal ? road.y + side * 26 : road.y;
      const car = makeVehicle('cruiser', x, y, horizontal ? 0 : Math.PI / 2, { driver: 'police' });
      car.roadblock = true;
      car.siren = true;
      this.roadblocks.push(car);
      this.cruisers.push(car);
    }
    game.addMessage('Roadblock ahead!');
  }

  // Road-following pursuit: follow the planned route over the grid,
  // re-planning twice a second, and steer straight at the player only
  // for the final approach.
  pursuitInput(car, player, dt) {
    if (car.roadblock) return { throttle: 0, steer: 0 };

    car.routeTimer = (car.routeTimer || 0) - dt;
    if (car.routeTimer <= 0 || !car.route || car.route.length === 0) {
      car.routeTimer = 0.5 + Math.random() * 0.2;
      car.route = this.planRoute(car, player);
      car.routeStep = 0;
    }
    const target = this.routeTarget(car, player);
    const targetAngle = angleTo(car.x, car.y, target.x, target.y);
    let d = targetAngle - car.angle;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    const steer = clamp(d * 2.2, -1, 1);
    const distance = dist(car.x, car.y, player.x, player.y);
    let throttle = 1;
    if (distance < 46 && carSpeed(car) > 140) throttle = 0.2; // don't overshoot the ram
    if (Math.abs(d) > 1.9 && carSpeed(car) > 60) throttle = 0.35; // slow for a hard turn

    // Stuck against a building or a wreck: back up and try a new angle.
    if (carSpeed(car) < 25 && throttle > 0) {
      car.stuckTimer = (car.stuckTimer || 0) + dt;
    } else {
      car.stuckTimer = 0;
    }
    if (car.stuckTimer > 1.1) {
      car.stuckTimer = -0.7; // reverse for a beat
      car.route = null; // re-plan from the new spot
      return { throttle: -1, steer: -steer };
    }
    if (car.stuckTimer < 0) return { throttle: -1, steer: -steer };
    return { throttle, steer };
  }

  // The waypoint the cruiser steers at: the next route point, or the
  // player directly when close enough to close in.
  routeTarget(car, player) {
    const distance = dist(car.x, car.y, player.x, player.y);
    if (distance < 130) return { x: player.x, y: player.y };
    const route = car.route || [];
    while (car.routeStep < route.length) {
      const wp = route[car.routeStep];
      if (dist(car.x, car.y, wp.x, wp.y) < 70) car.routeStep++;
      else return wp;
    }
    return { x: player.x, y: player.y };
  }

  // Manhattan route over the road grid: onto the nearest road, along
  // one road to the intersection nearest the player, then to the
  // player. Picks the shorter of the two L-shaped paths.
  planRoute(car, player) {
    const onRoad = nearestRoadPoint(car.x, car.y);
    const playerRoadX = nearestRoadCenter(player.x);
    const playerRoadY = nearestRoadCenter(player.y);
    const carRoadX = nearestRoadCenter(car.x);
    const carRoadY = nearestRoadCenter(car.y);

    // Same street: no route needed, straight chase.
    if (Math.abs(car.x - player.x) < 60 || Math.abs(car.y - player.y) < 60) {
      return [{ x: player.x, y: player.y }];
    }

    // Two L-paths: across first then down, or down first then across.
    const viaA = { x: playerRoadX, y: carRoadY };
    const viaB = { x: carRoadX, y: playerRoadY };
    const lenA = Math.abs(viaA.x - car.x) + Math.abs(viaA.y - car.y) + Math.abs(player.x - viaA.x) + Math.abs(player.y - viaA.y);
    const lenB = Math.abs(viaB.x - car.x) + Math.abs(viaB.y - car.y) + Math.abs(player.x - viaB.x) + Math.abs(player.y - viaB.y);
    const via = lenA <= lenB ? viaA : viaB;

    const route = [];
    if (dist(car.x, car.y, onRoad.x, onRoad.y) > 50) route.push(onRoad);
    route.push(via);
    route.push({ x: player.x, y: player.y });
    return route;
  }

  reset() {
    this.wanted = 0;
    this.cruisers = [];
    this.roadblocks = [];
    this.evadeTimer = 0;
    this.bustTimer = 0;
    this.busted = false;
  }
}
