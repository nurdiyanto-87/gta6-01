// Solmar Heat — the wanted level and the Solmar PD.
// Crimes add stars. Stars bring interceptors that hunt the player, ram their
// car and box them in; at three stars and up, roadblocks appear ahead. Break
// line of sight to cool off, or pay for a repaint at Prado's Garage.

import { TUNING, clamp, rand, choice, dist, angleTo, angleDiff } from './config.js';
import { nearestIntersection, randomRoadPoint, isOnRoad } from './city.js';
import { makeCar, driveCar } from './vehicles.js';
import { Effects } from './effects.js';
import { AudioSys } from './audio.js';

export const Police = {
  wanted: 0,
  evadeTimer: 0,
  bustTimer: 0,
  reportTimer: -1, // pending "shots reported" countdown
  roadblockTimer: 0,
  roadblocks: [],

  reset() {
    this.wanted = 0;
    this.evadeTimer = 0;
    this.bustTimer = 0;
    this.reportTimer = -1;
    this.roadblockTimer = 0;
    this.roadblocks = [];
  },

  addHeat(state, stars, message) {
    if (this.wanted >= TUNING.maxWanted) return;
    this.wanted = clamp(this.wanted + stars, 0, TUNING.maxWanted);
    this.evadeTimer = 0;
    if (message) state.hud.message(message, '#ff8a7a');
    AudioSys.wantedUp();
    state.hud.flashWanted();
  },

  clearHeat(state, silent) {
    this.wanted = 0;
    this.evadeTimer = 0;
    this.bustTimer = 0;
    this.reportTimer = -1;
    // The cops give up and drive away: recycle their cars.
    for (let i = state.cars.length - 1; i >= 0; i--) {
      if (state.cars[i].driver === 'police') state.cars.splice(i, 1);
    }
    this.roadblocks = [];
    AudioSys.setSiren(false, 0);
    if (!silent) state.hud.message('You lost the cops.', '#7fd4c1');
  },

  // A gunshot is only a crime if someone can pin it on you: a cop in earshot
  // responds at once, otherwise a witness phones it in after a few seconds.
  hearShot(state, x, y) {
    if (this.wanted > 0) return;
    if (this.nearbyPolice(state, 650)) {
      this.addHeat(state, 1, 'Shots fired — police responding!');
    } else if (this.reportTimer < 0) {
      this.reportTimer = 3.5;
    }
  },

  nearbyPolice(state, radius) {
    const p = state.player;
    const px = p.car ? p.car.x : p.x, py = p.car ? p.car.y : p.y;
    for (const car of state.cars) {
      if (car.driver === 'police' && !car.dead && dist(car.x, car.y, px, py) < radius) return true;
    }
    return false;
  },

  wantedCount() {
    // How many interceptors a wanted level fields.
    return [0, 1, 2, 3, 4, 6][this.wanted] || 0;
  },

  update(state, dt) {
    const p = state.player;
    const px = p.car ? p.car.x : p.x, py = p.car ? p.car.y : p.y;

    if (this.reportTimer >= 0) {
      this.reportTimer -= dt;
      if (this.reportTimer < 0) {
        this.addHeat(state, 1, 'A witness reported gunfire!');
      }
    }

    if (this.wanted === 0) {
      AudioSys.setSiren(false, dt);
      return;
    }
    AudioSys.setSiren(true, dt);

    // Maintain the pursuit force (roadblock cars hold their post and do
    // not count toward it).
    let cops = state.cars.filter((c) => c.driver === 'police' && !c.dead && !c.roadblock);
    const want = this.wantedCount();
    while (cops.length < want) {
      const car = this.spawnInterceptor(state, px, py);
      state.cars.push(car);
      cops.push(car);
    }
    // Remove wrecked interceptors; replacements arrive above.
    for (let i = state.cars.length - 1; i >= 0; i--) {
      const car = state.cars[i];
      if (car.driver === 'police' && car.dead) state.cars.splice(i, 1);
    }

    // Pursuit driving: steer at the player, ram speed, slight prediction.
    const playerSpeed = p.car ? Math.abs(p.car.speed) : 0;
    for (const cop of cops) {
      const lead = clamp(playerSpeed * 0.25, 0, 90);
      const tx = px + (p.car ? Math.cos(p.car.angle) * lead : 0);
      const ty = py + (p.car ? Math.sin(p.car.angle) * lead : 0);
      const wantAngle = angleTo(cop.x, cop.y, tx, ty);
      const diff = angleDiff(cop.angle, wantAngle);
      const steer = clamp(diff * 2.4, -1, 1);
      const d = dist(cop.x, cop.y, px, py);
      const throttle = d > 60 ? 1 : 0.4;
      driveCar(cop, { throttle, steer, handbrake: Math.abs(diff) > 2.2 }, dt, state.city, state);
      // Siren strobe particles when close.
      if (d < 400 && Math.random() < dt * 6) {
        Effects.burst(cop.x, cop.y - 14, { count: 1, speedMin: 4, speedMax: 12, lifeMin: 0.2, lifeMax: 0.3, sizeMin: 2, sizeMax: 3, colors: ['#ff4040', '#4080ff'] });
      }
    }

    // Roadblocks at 3+ stars: two interceptors parked across the road ahead.
    if (this.wanted >= 3) {
      this.roadblockTimer -= dt;
      if (this.roadblockTimer <= 0) {
        this.roadblockTimer = 14;
        this.placeRoadblock(state, px, py, p.car ? p.car.angle : p.angle);
      }
    }

    // Seen or hidden? Close means seen; far means the trail cools. Any
    // police car counts, roadblocks included.
    let nearest = Infinity;
    for (const car of state.cars) {
      if (car.driver === 'police' && !car.dead) nearest = Math.min(nearest, dist(car.x, car.y, px, py));
    }
    const seen = nearest < 560;
    if (seen) {
      this.evadeTimer = 0;
    } else {
      this.evadeTimer += dt;
      if (this.evadeTimer > TUNING.evadeTime) {
        this.evadeTimer = 0;
        this.wanted--;
        state.hud.message('Heat cooling off…', '#ffd76a');
        if (this.wanted <= 0) this.clearHeat(state);
      }
    }

    // Busted: a cop sits on you while you crawl.
    const crawling = p.car ? Math.abs(p.car.speed) < 26 : true;
    if (nearest < 78 && crawling && !p.dead) {
      this.bustTimer += dt;
      state.hud.showBustProgress(this.bustTimer / TUNING.bustTime);
      if (this.bustTimer > TUNING.bustTime) {
        this.bustTimer = 0;
        state.hud.showBustProgress(0);
        state.onBusted(state);
      }
    } else {
      this.bustTimer = Math.max(0, this.bustTimer - dt * 2);
      state.hud.showBustProgress(0);
    }
  },

  spawnInterceptor(state, px, py) {
    // Spawn on a road 550-950 away, ideally ahead of the player.
    let best = null;
    for (let i = 0; i < 10; i++) {
      const cand = randomRoadPoint();
      const d = dist(cand.x, cand.y, px, py);
      if (d > 550 && d < 950) { best = cand; break; }
      if (!best) best = cand;
    }
    const angle = angleTo(best.x, best.y, px, py);
    const car = makeCar('police', best.x, best.y, angle, { driver: 'police', color: '#e8e8e8' });
    car.cruiseSpeed = TUNING.policeSpeed;
    return car;
  },

  placeRoadblock(state, px, py, heading) {
    // Find a road point ahead of the player and park two interceptors across it.
    const ahead = { x: px + Math.cos(heading) * 420, y: py + Math.sin(heading) * 420 };
    const spot = nearestIntersection(ahead.x, ahead.y);
    if (dist(spot.x, spot.y, px, py) < 240) return;
    // Clear old roadblocks.
    for (const rb of this.roadblocks) {
      const idx = state.cars.indexOf(rb);
      if (idx >= 0) state.cars.splice(idx, 1);
    }
    this.roadblocks = [];
    const onVerticalRoad = Math.abs(spot.x - ahead.x) < Math.abs(spot.y - ahead.y);
    for (const side of [-1, 1]) {
      const car = makeCar('police', spot.x + (onVerticalRoad ? side * 26 : 0), spot.y + (onVerticalRoad ? 0 : side * 26),
        onVerticalRoad ? Math.PI / 2 : 0, { driver: 'police', color: '#e8e8e8' });
      car.speed = 0;
      car.roadblock = true;
      state.cars.push(car);
      this.roadblocks.push(car);
    }
    state.hud.message('Roadblock ahead!', '#ff8a7a');
  },

  // The repaint: drive into Prado's Garage with heat and cash, come out clean.
  tryRepaint(state) {
    const p = state.player;
    if (!p.car || this.wanted === 0) return false;
    const g = state.city.landmarks.garage;
    if (!g || dist(p.car.x, p.car.y, g.x, g.y) > 150) return false;
    if (p.money < TUNING.repaintCost) {
      state.hud.message('Repaint costs ' + TUNING.repaintCost + ' — you are short', '#ff8a7a');
      return true;
    }
    p.money -= TUNING.repaintCost;
    p.car.color = choice(['#c8452c', '#2c6ec8', '#e8c53d', '#3fae6a', '#e8e8e8', '#8a4fb8']);
    p.car.health = 100;
    this.clearHeat(state, true);
    Effects.confetti(p.car.x, p.car.y);
    AudioSys.cash();
    state.hud.message('Fresh paint — the cops lost your trail.', '#7fd4c1');
    return true;
  },
};
