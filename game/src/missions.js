// San Cielo Heat — missions and the story: six jobs for Ram that take Mara
// from car thief to the queen of the bay, plus repeatable courier runs.

import { PLACES, TUNING } from './config.js';
import { collideCar } from './city.js';
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
    id: 'queen-of-the-bay',
    title: 'Queen of the Bay',
    brief: 'One last run: the Kestrel boss is at the Marina. End it.',
    reward: 800,
    steps: [
      { type: 'goto', x: PLACES.marina.x, y: PLACES.marina.y, radius: 110, text: 'Reach the Marina Pier.' },
      { type: 'clearEnemies', count: 6, text: 'Take down the Kestrel crew.' },
      { type: 'loseWanted', text: 'Lose the heat and disappear.' },
    ],
  },
];

// Courier loops: fixed pairs of pickup/dropoff spots around the city.
const COURIER_STOPS = [
  { from: 'Downtown', x: 1380, y: 380, to: 'Harbor Depot', tx: 2980, ty: 580 },
  { from: 'Grand Bazaar', x: 1380, y: 2180, to: 'Sunset Arena', tx: 2580, ty: 1380 },
  { from: 'Palm Heights', x: 580, y: 1780, to: 'Marina Pier', tx: 1780, ty: 3400 },
  { from: 'Cielo Park', x: 1580, y: 1580, to: 'St. Cielo Hospital', tx: 580, ty: 980 },
  { from: 'Harbor Depot', x: 2980, y: 580, to: 'Fort San Cielo', tx: 380, ty: 3180 },
];

export class MissionSystem {
  constructor() {
    this.storyIndex = 0;
    this.active = null;
    this.stepIndex = 0;
    this.stepTimer = 0;
    this.courier = null;
    this.courierIndex = 0;
    this.targetCar = null;
    this.enemiesLeft = 0;
    this.briefcaseCarried = false;
    this.completedStory = false;
  }

  get currentStory() {
    return STORY[this.storyIndex] || null;
  }

  get currentStep() {
    if (!this.active) return null;
    return this.active.steps[this.stepIndex] || null;
  }

  get objectiveText() {
    if (this.courier) {
      if (this.courier.phase === 'pickup') return 'Courier: pick up the parcel at ' + this.courier.stop.from + '.';
      return 'Courier: deliver to ' + this.courier.stop.to + ' (' + formatTime(this.courier.timeLeft) + ').';
    }
    const step = this.currentStep;
    if (!step) return this.completedStory ? 'Story complete — free roam, or run courier jobs (E at a stop).' : "Go to Ram's Garage (green marker) to start your next job.";
    if (step.type === 'gotoTimed' || step.type === 'escape') return step.text + ' (' + formatTime(this.stepTimer) + ')';
    if (step.type === 'clearEnemies') return step.text + ' (' + this.enemiesLeft + ' left)';
    return step.text;
  }

  get objectivePoint() {
    if (this.courier) {
      return this.courier.phase === 'pickup'
        ? { x: this.courier.stop.x, y: this.courier.stop.y }
        : { x: this.courier.stop.tx, y: this.courier.stop.ty };
    }
    const step = this.currentStep;
    if (step && step.x !== undefined) return { x: step.x, y: step.y };
    if (this.targetCar && !this.targetCar.dead) return { x: this.targetCar.x, y: this.targetCar.y };
    if (!this.active && !this.completedStory) return { x: PLACES.garage.x, y: PLACES.garage.y };
    return null;
  }

  startStory(game) {
    const story = this.currentStory;
    if (!story || this.active) return false;
    this.active = story;
    this.stepIndex = 0;
    this.stepTimer = 0;
    this.briefcaseCarried = false;
    if (story.startWanted) game.player.addWanted(story.startWanted);
    this.enterStep(game);
    game.splash(story.title, story.brief);
    game.addMessage(story.brief);
    return true;
  }

  enterStep(game) {
    const step = this.currentStep;
    if (!step) return;
    if (step.type === 'gotoTimed' || step.type === 'escape') this.stepTimer = step.time;
    if (step.type === 'takedown') {
      this.targetCar = makeVehicle('van', 2980, 300, 0, '#3c3c44');
      this.targetCar.driver = 'courier';
      this.targetCar.speed = 150;
      game.courierCars.push(this.targetCar);
      game.addMessage('The Kestrel courier is on the move — marked on your minimap.');
    }
    if (step.type === 'clearEnemies') {
      const stepDef = step;
      const cx = this.active.id === 'queen-of-the-bay' ? PLACES.marina.x : PLACES.depot.x;
      const cy = this.active.id === 'queen-of-the-bay' ? PLACES.marina.y : PLACES.depot.y;
      for (let i = 0; i < stepDef.count; i++) {
        game.combat.spawnEnemy(cx + (Math.random() - 0.5) * 220, cy + (Math.random() - 0.5) * 220, { alerted: true, dropCash: 60 });
      }
      this.enemiesLeft = stepDef.count;
      if (this.active.id === 'queen-of-the-bay') game.player.addWanted(3);
      game.addMessage('Hostiles ahead — take them down.');
    }
    if (step.type === 'escape') {
      game.player.addWanted(3);
    }
  }

  advanceStep(game) {
    this.stepIndex++;
    if (this.stepIndex >= this.active.steps.length) {
      this.completeStory(game);
    } else {
      this.enterStep(game);
    }
  }

  completeStory(game) {
    const reward = this.active.reward;
    game.player.addMoney(reward);
    game.player.missionsDone++;
    game.splash('Job Complete', '+' + formatMoney(reward));
    game.addMessage('Job complete: ' + this.active.title + ' — ' + formatMoney(reward) + ' earned.');
    if (game.audio) game.audio.jingle();
    this.storyIndex++;
    this.active = null;
    this.stepIndex = 0;
    if (this.storyIndex >= STORY.length) {
      this.completedStory = true;
      game.splash('Queen of the Bay', 'The Kestrels are finished. San Cielo is yours.');
    }
    game.saveGame();
  }

  failStory(game, reason) {
    game.splash('Job Failed', reason);
    game.addMessage('Job failed: ' + reason);
    if (game.audio) game.audio.missionFail();
    this.active = null;
    this.stepIndex = 0;
    this.targetCar = null;
    game.courierCars = [];
  }

  onEnemyDown(game) {
    const step = this.currentStep;
    if (this.active && step && step.type === 'clearEnemies') {
      this.enemiesLeft = Math.max(0, this.enemiesLeft - 1);
      if (this.enemiesLeft <= 0) this.advanceStep(game);
    }
  }

  onBriefcase(game) {
    const step = this.currentStep;
    if (this.active && step && step.type === 'briefcase') {
      this.briefcaseCarried = true;
      game.addMessage('Briefcase secured. Get it to Ram.');
      this.advanceStep(game);
    }
  }

  onCarStolen(game) {
    const step = this.currentStep;
    if (this.active && step && step.type === 'stealCar') this.advanceStep(game);
  }

  startCourier(game) {
    if (this.courier || this.active) return false;
    const stop = COURIER_STOPS[this.courierIndex % COURIER_STOPS.length];
    this.courierIndex++;
    this.courier = { stop, phase: 'pickup', timeLeft: 100 };
    game.addMessage('Courier job: collect the parcel at ' + stop.from + '.');
    return true;
  }

  update(dt, game) {
    const player = game.player;
    const px = player.inCar ? player.inCar.x : player.x;
    const py = player.inCar ? player.inCar.y : player.y;

    // Courier job progress.
    if (this.courier) {
      const c = this.courier;
      if (c.phase === 'pickup') {
        if (dist(px, py, c.stop.x, c.stop.y) < 80) {
          c.phase = 'deliver';
          c.timeLeft = 100;
          game.addMessage('Parcel collected. Deliver to ' + c.stop.to + ' — hurry!');
        }
      } else {
        c.timeLeft -= dt;
        if (dist(px, py, c.stop.tx, c.stop.ty) < 80) {
          const pay = 120;
          player.addMoney(pay);
          player.courierDone++;
          game.splash('Delivered', '+' + formatMoney(pay));
          if (game.audio) game.audio.cash();
          this.courier = null;
          game.saveGame();
        } else if (c.timeLeft <= 0) {
          game.addMessage('Courier job failed — too slow.');
          this.courier = null;
        }
      }
      return;
    }

    const step = this.currentStep;
    if (!this.active || !step) return;

    if (step.type === 'gotoTimed' || step.type === 'escape') {
      this.stepTimer -= dt;
      if (this.stepTimer <= 0) {
        this.failStory(game, 'Out of time.');
        return;
      }
    }

    switch (step.type) {
      case 'goto':
      case 'gotoTimed':
      case 'escape':
        if (dist(px, py, step.x, step.y) < step.radius) this.advanceStep(game);
        break;
      case 'gotoCar':
        if (player.inCar && dist(px, py, step.x, step.y) < step.radius) this.advanceStep(game);
        break;
      case 'loseWanted':
        if (player.wanted === 0) this.advanceStep(game);
        break;
      case 'takedown':
        if (this.targetCar && this.targetCar.damage >= 0.85) {
          this.targetCar.dead = true;
          this.targetCar.speed = 0;
          game.pickups.spawnBriefcase(this.targetCar.x, this.targetCar.y);
          if (game.effects) game.effects.explosion(this.targetCar.x, this.targetCar.y);
          if (game.audio) game.audio.crash(1);
          game.camera.addShake(14);
          this.advanceStep(game);
        }
        break;
      default:
        break;
    }
  }
}

// The Kestrel courier van flees along the roads when the player closes in.
export function updateCourierCar(game, car, dt) {
  const player = game.player;
  const px = player.inCar ? player.inCar.x : player.x;
  const py = player.inCar ? player.inCar.y : player.y;
  const d = dist(car.x, car.y, px, py);
  const flee = d < 700;
  let targetAngle = car.angle;
  if (flee) {
    // Flee along the nearest road: pick the road direction away from the player.
    const roadX = car.x;
    const roadY = car.y;
    const away = Math.atan2(car.y - py, car.x - px);
    // Snap to the nearest axis so the van stays on streets.
    const snapped = Math.round(away / (Math.PI / 2)) * (Math.PI / 2);
    targetAngle = snapped;
    car.speed = Math.min(car.speed + 120 * dt, 300);
  } else {
    car.speed = Math.max(90, car.speed - 60 * dt);
  }
  const diff = targetAngle - car.angle;
  const wrapped = Math.atan2(Math.sin(diff), Math.cos(diff));
  car.angle += Math.max(-2.4 * dt, Math.min(2.4 * dt, wrapped));
  driveCar(car, 1, 0, false, dt);
  car.speed = Math.min(car.speed, 300);
  if (collideCar(game.city, car, car.def.len / 2, car.def.wid / 2)) {
    car.speed *= 0.5;
    car.angle += 0.6;
  }
}
