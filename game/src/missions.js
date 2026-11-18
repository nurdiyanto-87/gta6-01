// Solmar Heat — the story of Leo Marsh and the mission engine.
// Six story missions take Leo from a broke drifter to the man who broke
// Victor Kroll's grip on Port Solmar, plus a repeatable courier job at the
// garage. Steps are small data objects; the engine below runs any of them.

import { dist, choice, randi } from './config.js';
import { collideCircle } from './city.js';
import { Effects } from './effects.js';
import { AudioSys } from './audio.js';
import { spawnEnemy } from './combat.js';
import { giveAmmo } from './player.js';

export const STORY = [
  {
    id: 'plate',
    title: 'A Plate of Trouble',
    giver: "Rosa",
    briefing: 'Broke, hungry and new in Port Solmar. Rosa at the diner says she has work for a driver with steady hands. Go and hear her out.',
    reward: 50,
    startAt: 'diner',
    steps: [
      { type: 'goto', landmark: 'diner', radius: 90, text: 'Go to Rosa\'s Diner' },
      { type: 'talk', landmark: 'diner', text: 'Talk to Rosa (press E)' },
    ],
  },
  {
    id: 'wheels',
    title: 'Wheels for Rosa',
    giver: 'Rosa',
    briefing: 'Rosa\'s delivery car gave up this morning. "Borrow" any car on the street and bring it to Felix at the garage. Try not to let the cops see you take it.',
    reward: 150,
    startAt: 'diner',
    steps: [
      { type: 'enterCar', text: 'Steal a car (press F beside one)' },
      { type: 'deliverCar', landmark: 'garage', radius: 120, text: 'Deliver the car to Prado\'s Garage' },
    ],
  },
  {
    id: 'package',
    title: 'The Pier Package',
    giver: 'Felix',
    briefing: 'A package is waiting under the pier. Collect it and take it to the Sandy Palms Motel. Kroll\'s boys have been watching the pier — expect company.',
    reward: 250,
    startAt: 'garage',
    steps: [
      { type: 'goto', x: 1600, y: 3000, radius: 70, text: 'Go to the pier' },
      { type: 'pickup', x: 1600, y: 3030, label: 'Package', text: 'Pick up the package' },
      { type: 'deliver', landmark: 'motel', radius: 100, text: 'Deliver the package to the motel' },
    ],
    onPickup: (state) => {
      state.police.addHeat(state, 2, 'Kroll\'s tip-off: the cops are coming!');
      state.hud.message('Lose the heat or outrun it — the motel pays either way.', '#ffd76a');
    },
  },
  {
    id: 'hotlap',
    title: 'Hot Lap',
    giver: 'Felix',
    briefing: 'Felix rebuilt a Falcon GT and wants proof it is the fastest thing in Solmar. Hit all five checkpoints before the clock runs out.',
    reward: 300,
    startAt: 'garage',
    steps: [
      { type: 'enterCar', text: 'Get in a car' },
      {
        type: 'race', timeLimit: 80,
        checkpoints: [
          { x: 600, y: 600 }, { x: 2600, y: 600 }, { x: 2600, y: 2200 },
          { x: 1000, y: 2600 }, { x: 600, y: 1800 },
        ],
        text: 'Hit the checkpoints before time runs out',
      },
    ],
  },
  {
    id: 'warehouse',
    title: 'Warehouse Party',
    giver: 'Rosa',
    briefing: 'Kroll\'s crew uses the east warehouse to lean on every shop in town. Rosa wants his ledger — and his boys gone. Take a weapon. Take the ledger. Come home.',
    reward: 400,
    startAt: 'diner',
    steps: [
      { type: 'goto', landmark: 'warehouse', radius: 190, text: 'Go to the Kroll warehouse' },
      {
        type: 'eliminate', count: 6,
        spawnAround: 'warehouse', spawnRadius: 170,
        text: 'Clear out Kroll\'s crew (0/6)',
      },
      { type: 'pickup', nearLandmark: 'warehouse', label: 'Ledger', text: 'Take Kroll\'s ledger' },
      { type: 'deliver', landmark: 'diner', radius: 100, text: 'Bring the ledger back to Rosa' },
    ],
    onComplete: (state) => {
      giveAmmo(state.player, 'shotgun', 12);
      state.hud.message('Rosa hands you a Breacher Shotgun. "For next time."', '#ffd76a');
    },
  },
  {
    id: 'tower',
    title: 'King of the Tower',
    giver: 'Felix',
    briefing: 'Tonight it ends. Kroll is in his tower with his whole crew. Go up through them, take Kroll down, and get back to the safehouse before the city swallows you.',
    reward: 600,
    startAt: 'garage',
    steps: [
      { type: 'goto', landmark: 'tower', radius: 200, text: 'Go to Kroll Tower' },
      {
        type: 'eliminate', count: 9, boss: true,
        spawnAround: 'tower', spawnRadius: 190,
        text: 'Take down Kroll and his crew (0/9)',
      },
      { type: 'escape', landmark: 'safehouse', radius: 110, wanted: 4, text: 'Escape to the safehouse!' },
    ],
    onComplete: (state) => {
      state.storyComplete = true;
      state.hud.splash('SOLMAR IS YOURS', 'Every mission complete. The city is yours now, Leo.');
    },
  },
];

export const Missions = {
  completed: 0, // how many story missions are done
  active: null, // runtime state of the running mission
  courier: null, // runtime state of the repeatable courier job

  reset() {
    this.completed = 0;
    this.active = null;
    this.courier = null;
  },

  nextMission() {
    return STORY[this.completed] || null;
  },

  isActive() { return this.active !== null; },

  startMarker(state) {
    if (this.active) return null;
    const next = this.nextMission();
    if (next) {
      const lm = state.city.landmarks[next.startAt];
      return { x: lm.doorX, y: lm.doorY, label: next.title, color: '#ffd76a', kind: 'mission' };
    }
    // Story done: the courier job keeps the garage busy.
    if (this.completed >= 1 && !this.courier) {
      const g = state.city.landmarks.garage;
      return { x: g.doorX, y: g.doorY, label: 'Courier job ($120)', color: '#7fd4c1', kind: 'courier' };
    }
    return null;
  },

  startMission(state, def) {
    this.active = {
      def, stepIndex: 0, timer: 0, kills: 0,
      spawned: [], item: null, checkpointIndex: 0, raceTime: 0,
    };
    state.hud.splash('MISSION: ' + def.title, def.giver + ': ' + def.briefing);
    AudioSys.missionDone();
    this.beginStep(state);
  },

  startCourier(state) {
    const targets = ['diner', 'motel', 'hospital', 'police', 'safehouse'];
    const target = choice(targets);
    this.courier = {
      def: {
        id: 'courier', title: 'Courier Run', giver: 'Felix',
        briefing: 'Deliver a car to ' + state.city.landmarks[target].name + '. Quick and clean.',
        reward: 120,
        steps: [
          { type: 'enterCar', text: 'Get in a car' },
          { type: 'deliverCar', landmark: target, radius: 120, text: 'Deliver the car' },
        ],
      },
      stepIndex: 0, timer: 0, kills: 0, spawned: [], item: null, checkpointIndex: 0, raceTime: 0,
    };
    state.hud.splash('COURIER RUN', 'Deliver a car to ' + state.city.landmarks[target].name + ' — $120.');
  },

  beginStep(state) {
    const run = this.active || this.courier;
    if (!run) return;
    const step = run.def.steps[run.stepIndex];
    if (!step) return;
    if (step.type === 'eliminate') {
      const lm = state.city.landmarks[step.spawnAround];
      run.spawned = [];
      for (let i = 0; i < step.count; i++) {
        const a = (i / step.count) * Math.PI * 2;
        // Ring outside the landmark's footprint, then one collision push so
        // nobody spawns on a roof or inside a wall.
        const r = step.spawnRadius * (0.85 + Math.random() * 0.45);
        const spot = { x: lm.x + Math.cos(a) * r, y: lm.y + Math.sin(a) * r, radius: 12 };
        collideCircle(state.city, spot);
        const e = spawnEnemy(state, spot.x, spot.y,
          { boss: step.boss && i === 0, health: step.boss && i === 0 ? 220 : 60, speed: step.boss && i === 0 ? 120 : 135 });
        run.spawned.push(e);
      }
      run.kills = 0;
    }
    if (step.type === 'race') {
      run.raceTime = step.timeLimit;
      run.checkpointIndex = 0;
    }
    if (step.type === 'escape') {
      state.police.addHeat(state, step.wanted, 'Every cop in Solmar is coming!');
    }
    if (step.type === 'pickup' && step.nearLandmark) {
      const lm = state.city.landmarks[step.nearLandmark];
      run.item = { x: lm.x, y: lm.y + 60, label: step.label, taken: false };
    } else if (step.type === 'pickup') {
      run.item = { x: step.x, y: step.y, label: step.label, taken: false };
    }
  },

  currentStep() {
    const run = this.active || this.courier;
    return run ? run.def.steps[run.stepIndex] : null;
  },

  currentMarker(state) {
    const run = this.active || this.courier;
    if (run) {
      const step = run.def.steps[run.stepIndex];
      if (!step) return null;
      if (step.type === 'race') {
        const cp = step.checkpoints[run.checkpointIndex];
        return cp ? { x: cp.x, y: cp.y, label: 'Checkpoint ' + (run.checkpointIndex + 1), color: '#ffd76a' } : null;
      }
      if (step.type === 'pickup' && run.item) {
        return { x: run.item.x, y: run.item.y, label: step.label, color: '#7fd4c1' };
      }
      if (step.landmark) {
        const lm = state.city.landmarks[step.landmark];
        return { x: lm.doorX, y: lm.doorY, label: step.text, color: '#ffd76a' };
      }
      if (step.x !== undefined) return { x: step.x, y: step.y, label: step.text, color: '#ffd76a' };
      if (step.type === 'eliminate') {
        const alive = run.spawned.filter((e) => !e.dead);
        if (alive.length > 0) {
          const e = alive[0];
          return { x: e.x, y: e.y, label: 'Hostile', color: '#ff5050' };
        }
      }
      return null;
    }
    return this.startMarker(state);
  },

  objectiveText(state) {
    const run = this.active || this.courier;
    if (!run) {
      const next = this.nextMission();
      if (next) return 'Next job: ' + next.title + ' — go to the yellow marker';
      return 'Free roam — courier jobs at the garage, cash stashes hidden in the city';
    }
    const step = run.def.steps[run.stepIndex];
    let text = step.text;
    if (step.type === 'eliminate') {
      text = step.text.replace(/\(\d+\/\d+\)/, '(' + run.kills + '/' + step.count + ')');
    }
    if (step.type === 'race') {
      text += ' — ' + Math.ceil(run.raceTime) + 's left';
    }
    return run.def.title + ': ' + text;
  },

  update(state, dt) {
    const run = this.active || this.courier;
    if (!run) return;
    const step = run.def.steps[run.stepIndex];
    if (!step) return;
    const p = state.player;
    const px = p.car ? p.car.x : p.x, py = p.car ? p.car.y : p.y;

    const advance = () => {
      run.stepIndex++;
      if (run.stepIndex >= run.def.steps.length) this.completeRun(state, run);
      else this.beginStep(state);
    };

    if (step.type === 'goto' || step.type === 'deliver') {
      const t = step.landmark ? state.city.landmarks[step.landmark] : step;
      const tx = step.landmark ? t.doorX : t.x, ty = step.landmark ? t.doorY : t.y;
      if (dist(px, py, tx, ty) < step.radius) advance();
    } else if (step.type === 'talk') {
      // Waiting for the E key; see tryInteract.
    } else if (step.type === 'enterCar') {
      if (p.car) advance();
    } else if (step.type === 'deliverCar') {
      const lm = state.city.landmarks[step.landmark];
      if (p.car && dist(p.car.x, p.car.y, lm.x, lm.y) < step.radius) {
        state.stats.deliveries++;
        advance();
      }
    } else if (step.type === 'pickup') {
      if (run.item && !run.item.taken && dist(px, py, run.item.x, run.item.y) < 46) {
        run.item.taken = true;
        AudioSys.pickup();
        Effects.confetti(run.item.x, run.item.y);
        state.hud.message('Got the ' + step.label + '!', '#7fd4c1');
        if (run.def.onPickup) run.def.onPickup(state);
        advance();
      }
    } else if (step.type === 'eliminate') {
      if (run.kills >= step.count) advance();
    } else if (step.type === 'race') {
      run.raceTime -= dt;
      const cp = step.checkpoints[run.checkpointIndex];
      if (cp && dist(px, py, cp.x, cp.y) < 70) {
        run.checkpointIndex++;
        AudioSys.pickup();
        Effects.confetti(cp.x, cp.y);
        if (run.checkpointIndex >= step.checkpoints.length) advance();
      }
      if (run.raceTime <= 0) this.failRun(state, run, 'Out of time!');
    } else if (step.type === 'escape') {
      const lm = state.city.landmarks[step.landmark];
      if (dist(px, py, lm.x, lm.y) < step.radius) {
        state.police.clearHeat(state, true);
        advance();
      }
    }
  },

  tryInteract(state) {
    // E key: start a mission, talk to a contact, or take the courier job.
    const p = state.player;
    const px = p.car ? p.car.x : p.x, py = p.car ? p.car.y : p.y;
    const run = this.active || this.courier;
    if (run) {
      const step = run.def.steps[run.stepIndex];
      if (step && step.type === 'talk') {
        const lm = state.city.landmarks[step.landmark];
        if (dist(px, py, lm.doorX, lm.doorY) < 110) {
          run.stepIndex++;
          if (run.stepIndex >= run.def.steps.length) this.completeRun(state, run);
          else this.beginStep(state);
          return true;
        }
      }
      return false;
    }
    const marker = this.startMarker(state);
    if (marker && dist(px, py, marker.x, marker.y) < 120) {
      if (marker.kind === 'courier') this.startCourier(state);
      else this.startMission(state, this.nextMission());
      return true;
    }
    // The courier job is also available at the garage between story jobs.
    if (this.completed >= 1) {
      const g = state.city.landmarks.garage;
      if (dist(px, py, g.doorX, g.doorY) < 120) {
        this.startCourier(state);
        return true;
      }
    }
    return false;
  },

  onEnterCar(state, car) { /* steps poll the player state; nothing to do */ },
  onExitCar(state, car) { /* nothing to do */ },

  onEnemyKilled(state, enemy) {
    const run = this.active || this.courier;
    if (!run) return;
    const step = run.def.steps[run.stepIndex];
    if (step && step.type === 'eliminate' && run.spawned.includes(enemy)) {
      run.kills++;
    }
  },

  completeRun(state, run) {
    const isStory = run === this.active;
    state.player.money += run.def.reward;
    state.stats.missionsDone += isStory ? 1 : 0;
    state.stats.moneyEarned += run.def.reward;
    AudioSys.missionDone();
    state.hud.splash('JOB DONE', run.def.title + ' — +' + '$' + run.def.reward);
    if (run.def.onComplete) run.def.onComplete(state);
    if (isStory) {
      this.completed++;
      this.active = null;
    } else {
      this.courier = null;
    }
    state.savegame.save(state);
  },

  failRun(state, run, reason) {
    AudioSys.missionFail();
    state.hud.splash('JOB FAILED', reason + ' Return to the marker to try again.');
    // Clean up spawned enemies.
    for (const e of run.spawned) {
      const idx = state.enemies.indexOf(e);
      if (idx >= 0) state.enemies.splice(idx, 1);
    }
    if (run === this.active) this.active = null;
    else this.courier = null;
  },

  failActiveIfAny(state, reason) {
    if (this.active) this.failRun(state, this.active, reason);
    if (this.courier) this.failRun(state, this.courier, reason);
  },
};
