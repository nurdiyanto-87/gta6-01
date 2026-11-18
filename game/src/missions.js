// San Cielo Heat — missions and the story: six jobs for Ram that take
// Mara from car thief to the queen of the bay, plus repeatable courier
// runs for quick cash.

import { PLACES, TUNING } from './config.js';
import { dist, formatMoney, formatTime } from './util.js';
import { driveCar, makeVehicle } from './vehicles.js';

const STORY = [
  {
    id: 'hot-wheels',
    title: 'Hot Wheels',
    brief: "Ram needs wheels. Steal a car and bring it to the garage.",
    reward: 200,
    steps: [
      { type: 'stealCar', text: 'Steal a car — walk up to one and press E.' },
      { type: 'gotoCar', x: PLACES.garage.x, y: PLACES.garage.y, radius: 100, text: "Bring the car to Ram's Garage." },
    ],
  },
  {
    id: 'parcel-run',
    title: 'Parcel Run',
    brief: 'A parcel for the Bazaar, and the buyer does not wait.',
    reward: 250,
    steps: [
      { type: 'gotoTimed', x: PLACES.bazaar.x, y: PLACES.bazaar.y, radius: 90, time: 90, text: 'Deliver the parcel to the Grand Bazaar.' },
    ],
  },
  {
    id: 'cold-trail',
    title: 'Cold Trail',
    brief: 'The drop was watched. The whole city is looking for you.',
    reward: 150,
    startWanted: 2,
    steps: [
      { type: 'loseWanted', text: 'Lose the heat — break line of sight, or pay for a respray at Spray & Shine.' },
    ],
  },
  {
    id: 'bumper-diplomacy',
    title: 'Bumper Diplomacy',
    brief: 'A Kestrel courier is moving product through the Harbor. Take it.',
    reward: 350,
    steps: [
      { type: 'takedown', text: 'Ram the Kestrel courier until it stops.' },
      { type: 'briefcase', text: 'Grab the briefcase from the wreck.' },
      { type: 'goto', x: PLACES.garage.x, y: PLACES.garage.y, radius: 100, text: "Bring the briefcase to Ram's Garage." },
    ],
  },
  {
    id: 'the-crew',
    title: 'The Crew',
    brief: 'Juno and Felix are waiting. Then the depot. Then gone.',
    reward: 500,
    steps: [
      { type: 'goto', x: 2580, y: 1380, radius: 70, text: 'Pick up Juno at the Sunset Arena.' },
      { type: 'goto', x: 580, y: 3180, radius: 70, text: 'Pick up Felix at Playa Azul.' },
      { type: 'goto', x: PLACES.depot.x, y: PLACES.depot.y, radius: 110, text: 'Hit the Harbor Depot.' },
      { type: 'clearEnemies', count: 4, text: 'Clear the depot guards.' },
      { type: 'escape', x: PLACES.garage.x, y: PLACES.garage.y, radius: 100, time: 120, text: 'Get back to Ram — the Kestrels called it in!' },
    ],
  },
  {
    id: 'marina-lights',
    title: 'Marina Lights',
    brief: 'One last delivery, under every star in the sky.',
    reward: 800,
    startWanted: 3,
    steps: [
      { type: 'gotoTimed', x: PLACES.marina.x, y: PLACES.marina.y - 130, radius: 80, time: 150, text: 'Deliver the goods to the yacht at Marina Pier.' },
      { type: 'survive', time: 20, text: 'Hold the pier until the boat leaves!' },
    ],
  },
];

const COURIER_SPOTS = [
  { x: PLACES.bazaar.x, y: PLACES.bazaar.y, name: 'Grand Bazaar' },
  { x: PLACES.arena.x, y: PLACES.arena.y, name: 'Sunset Arena' },
  { x: PLACES.marina.x, y: PLACES.marina.y - 130, name: 'Marina Pier' },
  { x: PLACES.hospital.x, y: PLACES.hospital.y, name: 'St. Cielo Hospital' },
  { x: PLACES.depot.x, y: PLACES.depot.y, name: 'Harbor Depot' },
];

export class MissionSystem {
  constructor() {
    this.storyIndex = 0;
    this.completed = [];
    this.active = null;
    this.courier = null;
    this.couriersDone = 0;
    this.storyDone = false;
  }

  currentDef() {
    return STORY[this.storyIndex] || null;
  }

  atGarage(player) {
    return dist(player.x, player.y, PLACES.garage.x, PLACES.garage.y) < 110;
  }

  canStartStory(game) {
    return !this.active && !this.storyDone && this.atGarage(game.player);
  }

  startStory(game) {
    const def = this.currentDef();
    if (!def) return;
    this.active = { def, step: 0, timer: 0, data: {}, briefTimer: 4 };
    game.splash(def.title, def.brief);
    game.audio.missionDone();
    if (def.startWanted) game.police.addWanted(def.startWanted, 'The heat is on!');
    this.enterStep(game);
  }

  enterStep(game) {
    const m = this.active;
    if (!m) return;
    const step = m.def.steps[m.step];
    m.timer = step.time || 0;
    if (step.type === 'takedown') {
      const car = makeVehicle('van', PLACES.depot.x, PLACES.depot.y, 0, { driver: 'courier', color: '#3a3a40' });
      car.courierAI = { waypoints: courierLoop(), wp: 0 };
      m.data.targetCar = car;
      game.courierCars.push(car);
      game.addMessage('Courier spotted near the Harbor Depot.');
    }
    if (step.type === 'clearEnemies') {
      m.data.kills = 0;
      for (let i = 0; i < step.count; i++) {
        const gx = PLACES.depot.x + (i % 2 === 0 ? -70 : 70);
        const gy = PLACES.depot.y + (i < 2 ? -50 : 50);
        game.combat.spawnEnemy(gx, gy, { guard: { x: gx, y: gy }, health: 55 });
      }
    }
    if (step.type === 'survive') {
      for (let i = 0; i < 3; i++) {
        game.combat.spawnEnemy(PLACES.marina.x - 120 + i * 120, PLACES.marina.y - 260, { health: 45 });
      }
    }
    if (step.type === 'escape') {
      game.police.addWanted(2, 'The Kestrels called the cops!');
    }
  }

  advance(game) {
    const m = this.active;
    m.step++;
    if (m.step >= m.def.steps.length) {
      this.completeStory(game);
      return;
    }
    this.enterStep(game);
    game.addMessage(m.def.steps[m.step].text);
  }

  completeStory(game) {
    const m = this.active;
    this.completed.push(m.def.id);
    game.player.money += m.def.reward;
    game.splash('Job Done', m.def.title + ' — +' + formatMoney(m.def.reward));
    game.audio.missionDone();
    game.effects.floater(game.player.x, game.player.y - 30, '+' + formatMoney(m.def.reward), '#7ddb6a');
    this.storyIndex++;
    this.active = null;
    if (this.storyIndex >= STORY.length) {
      this.storyDone = true;
      game.splash('Queen of the Bay', 'Every job done. San Cielo is yours, Mara.');
    }
    game.saveGame();
  }

  failActive(game, reason) {
    if (!this.active) return;
    const m = this.active;
    if (m.data.targetCar) {
      const i = game.courierCars.indexOf(m.data.targetCar);
      if (i >= 0) game.courierCars.splice(i, 1);
    }
    this.active = null;
    game.splash('Job Failed', reason);
    game.audio.missionFail();
  }

  onEnterCar(car) {
    if (!this.active) return;
    const step = this.active.def.steps[this.active.step];
    if (step.type === 'stealCar') this.advanceStepSafe();
  }

  advanceStepSafe() {
    // advance() needs the game for messages; the caller re-enters via update.
    this._pendingAdvance = true;
  }

  onEnemyDown(enemy) {
    if (!this.active) return;
    const step = this.active.def.steps[this.active.step];
    if (step.type === 'clearEnemies') {
      this.active.data.kills = (this.active.data.kills || 0) + 1;
    }
  }

  onBriefcaseTaken(pickup) {
    if (!this.active) return;
    const step = this.active.def.steps[this.active.step];
    if (step.type === 'briefcase') this._pendingAdvance = true;
  }

  // ---- courier side jobs ----

  nearCourierSpot(player) {
    return COURIER_SPOTS.find((s) => dist(player.x, player.y, s.x, s.y) < 80) || null;
  }

  tryStartCourier(game) {
    if (this.courier || this.active) return;
    const spot = this.nearCourierSpot(game.player);
    if (!spot) return;
    const targets = COURIER_SPOTS.filter((s) => s !== spot);
    const target = targets[Math.floor(Math.random() * targets.length)];
    const d = dist(spot.x, spot.y, target.x, target.y);
    const time = Math.max(45, d / 26);
    this.courier = {
      from: spot,
      target,
      timer: time,
      total: time,
      reward: Math.round(80 + d / 18),
    };
    game.addMessage('Courier job: deliver to ' + target.name + ' in ' + formatTime(time) + ' — $' + this.courier.reward + '.');
    game.audio.pickup();
  }

  // ---- paint shop: always available, not just in missions ----

  updatePaintShop(game) {
    const player = game.player;
    if (!player.inCar || game.police.wanted === 0) return;
    if (dist(player.x, player.y, PLACES.paintShop.x, PLACES.paintShop.y) > 80) return;
    if (player.money < TUNING.repaintCost) {
      if (!this._paintWarned) {
        this._paintWarned = true;
        game.addMessage('Respray costs ' + formatMoney(TUNING.repaintCost) + ' — not enough cash.');
      }
      return;
    }
    this._paintWarned = false;
    player.money -= TUNING.repaintCost;
    player.inCar.color = '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
    game.police.clearWanted('Fresh paint, clean slate. The heat is off.');
    game.audio.cash();
    game.effects.burst(player.x, player.y, 18, { speed: 90, life: 0.5, size: 4, color: '#f2c14e' });
  }

  update(dt, game) {
    this.updatePaintShop(game);
    if (this._pendingAdvance && this.active) {
      this._pendingAdvance = false;
      this.advance(game);
    }

    // Courier timer.
    if (this.courier) {
      const c = this.courier;
      c.timer -= dt;
      if (dist(game.player.x, game.player.y, c.target.x, c.target.y) < 80) {
        game.player.money += c.reward;
        this.couriersDone++;
        game.addMessage('Delivered! +' + formatMoney(c.reward));
        game.audio.cash();
        this.courier = null;
        game.saveGame();
      } else if (c.timer <= 0) {
        game.addMessage('Courier job failed — too slow.');
        game.audio.missionFail();
        this.courier = null;
      }
    }

    const m = this.active;
    if (!m) return;
    const step = m.def.steps[m.step];
    const player = game.player;

    if (step.type === 'gotoTimed' || step.type === 'escape') {
      m.timer -= dt;
      if (m.timer <= 0) {
        this.failActive(game, 'Out of time.');
        return;
      }
    }
    if (step.type === 'survive') {
      m.timer -= dt;
      if (m.timer <= 0) {
        this.advance(game);
        return;
      }
    }

    switch (step.type) {
      case 'goto':
      case 'gotoTimed':
      case 'escape':
        if (dist(player.x, player.y, step.x, step.y) < step.radius) this.advance(game);
        break;
      case 'gotoCar':
        if (player.inCar && dist(player.x, player.y, step.x, step.y) < step.radius) this.advance(game);
        break;
      case 'loseWanted':
        if (game.police.wanted === 0) this.advance(game);
        break;
      case 'takedown': {
        const car = m.data.targetCar;
        if (car && (car.wrecked || (car.health < car.maxHealth * 0.3 && Math.hypot(car.vx, car.vy) < 12))) {
          game.pickups.dropBriefcase(car.x, car.y);
          game.addMessage('The courier is stopped. Grab the briefcase!');
          this.advance(game);
        }
        break;
      }
      case 'clearEnemies':
        if ((m.data.kills || 0) >= step.count) this.advance(game);
        break;
      default:
        break;
    }
  }

  // What the HUD points at right now.
  activeObjective(game) {
    if (this.active) {
      const step = this.active.def.steps[this.active.step];
      if (step.x !== undefined) return { text: step.text, x: step.x, y: step.y, timer: step.time ? this.active.timer : null };
      if (step.type === 'takedown' && this.active.data.targetCar) {
        const c = this.active.data.targetCar;
        return { text: step.text, x: c.x, y: c.y, timer: null };
      }
      if (step.type === 'briefcase') {
        const b = game.pickups.pickups.find((p) => p.kind === 'briefcase' && p.active);
        return { text: step.text, x: b ? b.x : PLACES.depot.x, y: b ? b.y : PLACES.depot.y, timer: null };
      }
      return { text: step.text, x: null, y: null, timer: step.time ? this.active.timer : null };
    }
    if (this.courier) {
      return { text: 'Courier: deliver to ' + this.courier.target.name, x: this.courier.target.x, y: this.courier.target.y, timer: this.courier.timer };
    }
    if (!this.storyDone) {
      return { text: 'Go to ' + PLACES.garage.name + " to start: " + (this.currentDef() ? this.currentDef().title : ''), x: PLACES.garage.x, y: PLACES.garage.y, timer: null };
    }
    return { text: 'Free roam — courier jobs pay at the gold markers.', x: null, y: null, timer: null };
  }

  reset() {
    this.storyIndex = 0;
    this.completed = [];
    this.active = null;
    this.courier = null;
    this.couriersDone = 0;
    this.storyDone = false;
  }
}

function courierLoop() {
  return [
    { x: 2980, y: 580 },
    { x: 2980, y: 1780 },
    { x: 1780, y: 1780 },
    { x: 1780, y: 580 },
  ];
}

// The courier van drives a road loop, speeding up when Mara closes in.
export function updateCourierCar(game, car, dt) {
  const ai = car.courierAI;
  if (!ai || car.wrecked) return;
  const target = ai.waypoints[ai.wp];
  const d = dist(car.x, car.y, target.x, target.y);
  if (d < 70) ai.wp = (ai.wp + 1) % ai.waypoints.length;
  const wantAngle = Math.atan2(target.y - car.y, target.x - car.x);
  let diff = wantAngle - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const playerNear = dist(car.x, car.y, game.player.x, game.player.y) < 350;
  driveCar(game, car, { throttle: playerNear ? 1 : 0.75, steer: Math.max(-1, Math.min(1, diff * 2)) }, dt);
}
