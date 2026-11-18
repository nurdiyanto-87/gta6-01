// Solmar Heat — boot, game loop and screen flow.
// Builds the world state, runs the update order every frame, owns the
// title/pause/wasted screens, and handles the E-key interactions and the
// car-vs-person collisions that belong to no single system. The ?scene=
// parameter sets up staged tableaus used for screenshots; normal play
// always starts at the title screen.

import { WORLD, TUNING, dist, clamp } from './config.js';
import { buildCity } from './city.js';
import { Input } from './input.js';
import { AudioSys } from './audio.js';
import { Effects } from './effects.js';
import { createCamera } from './camera.js';
import { createPlayer, updatePlayer, exitCar, damagePlayer } from './player.js';
import { makeCar, carHitTest } from './vehicles.js';
import { spawnTrafficCar, spawnParkedCar, updateTraffic, resolveCarCollisions } from './traffic.js';
import { spawnPeds, updatePeds, hitPedByCar } from './pedestrians.js';
import { updateBullets, updateEnemies, noiseAt, spawnEnemy } from './combat.js';
import { Police } from './police.js';
import { Missions } from './missions.js';
import { spawnWorldPickups, updatePickups } from './pickups.js';
import { Hud, layoutButtons } from './hud.js';
import { drawWorld } from './renderer.js';
import { SaveGame } from './savegame.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

let viewW = 1280, viewH = 720;
function resize() {
  viewW = window.innerWidth;
  viewH = window.innerHeight;
  canvas.width = viewW;
  canvas.height = viewH;
  if (state && state.camera) {
    state.camera.viewW = viewW;
    state.camera.viewH = viewH;
  }
}
window.addEventListener('resize', resize);
// The first resize() runs in the boot section below, after state exists:
// calling it here would touch `state` before its declaration initializes.

// ---- state ----

const state = {
  city: buildCity(),
  cars: [],
  peds: [],
  enemies: [],
  bullets: [],
  pickups: [],
  player: null,
  police: Police,
  missions: Missions,
  combat: { noiseAt },
  hud: Hud,
  camera: createCamera(viewW, viewH),
  savegame: SaveGame,
  godMode: false,
  storyComplete: false,
  parkedRespawn: 0,
  stats: {
    pedsHit: 0, carsStolen: 0, enemiesDown: 0,
    deliveries: 0, missionsDone: 0, moneyEarned: 0, stashes: 0,
  },
  onWasted: null,
  onBusted: null,
  ejectPlayerFromCar: null,
};

let screen = 'title'; // title | help | playing | paused | wasted | busted
let buttons = [];
let saveCooldown = 0;
let playerHitCooldown = 0;
let time = 0;
let lastTs = 0;
let framesRendered = 0;

function newRun(fromSave) {
  const diner = state.city.landmarks.diner;
  state.player = createPlayer(diner.doorX, diner.doorY + 40);
  state.cars.length = 0;
  state.peds.length = 0;
  state.enemies.length = 0;
  state.bullets.length = 0;
  Effects.reset();
  Hud.reset();
  Police.reset();
  Missions.reset();
  state.storyComplete = false;
  state.stats = {
    pedsHit: 0, carsStolen: 0, enemiesDown: 0,
    deliveries: 0, missionsDone: 0, moneyEarned: 0, stashes: 0,
  };
  if (fromSave) SaveGame.load(state);
  // If the save put Leo somewhere odd, the doorstep is the fallback.
  if (!state.player.x || !state.player.y) {
    state.player.x = diner.doorX;
    state.player.y = diner.doorY + 40;
  }
  // Populate the streets around the player.
  for (let i = 0; i < 16; i++) state.cars.push(spawnTrafficCar(state.city, state.player.x, state.player.y));
  for (let i = 0; i < 20; i++) state.cars.push(spawnParkedCar(state.city, state.player.x, state.player.y));
  spawnPeds(state, 30);
  spawnWorldPickups(state);
  state.camera.x = state.player.x;
  state.camera.y = state.player.y;
  state.camera.zoom = 1;
  Hud.message('Welcome to Port Solmar, Leo.', '#ffd76a');
  Hud.message('Follow the yellow marker to your first job.', '#ffffff');
}

state.onWasted = function (st) {
  Missions.failActiveIfAny(st, 'Leo went down.');
  AudioSys.setEngine(false, 0);
  AudioSys.setSiren(false, 0);
  screen = 'wasted';
};

state.onBusted = function (st) {
  Missions.failActiveIfAny(st, 'Busted by the Solmar PD.');
  const fine = Math.floor(st.player.money * 0.15);
  st.player.money -= fine;
  Police.clearHeat(st, true);
  AudioSys.busted();
  AudioSys.setEngine(false, 0);
  Hud.message('Fine paid: $' + fine, '#ff8a7a');
  screen = 'busted';
};

state.ejectPlayerFromCar = function (thrownOut) {
  const car = state.player.car;
  exitCar(state, thrownOut);
  if (car) damagePlayer(state, 15, car.x, car.y);
};

// ---- menus ----

function showTitle() {
  screen = 'title';
  const labels = [];
  if (SaveGame.hasSave()) labels.push('Continue');
  labels.push('New Game', 'How to Play');
  labels.push(AudioSys.muted ? 'Sound: Off' : 'Sound: On');
  buttons = layoutButtons(viewW, viewH, labels, viewH * 0.48, 56);
}

function showHelp(fromPause) {
  screen = 'help';
  buttons = layoutButtons(viewW, viewH, ['Back'], viewH - 140, 56);
  showHelp.fromPause = fromPause;
}

function showPause() {
  screen = 'paused';
  buttons = layoutButtons(viewW, viewH,
    ['Resume', 'Save Game', 'How to Play', AudioSys.muted ? 'Sound: Off' : 'Sound: On', 'Quit to Title'],
    viewH * 0.36, 56);
}

function clickButton(action) {
  AudioSys.init();
  AudioSys.resume();
  AudioSys.click();
  if (action === 'Continue') { newRun(true); screen = 'playing'; }
  else if (action === 'New Game') { SaveGame.clear(); newRun(false); screen = 'playing'; }
  else if (action === 'How to Play') { showHelp(screen === 'paused'); }
  else if (action === 'Back') { if (showHelp.fromPause) showPause(); else showTitle(); }
  else if (action === 'Sound: On' || action === 'Sound: Off') {
    AudioSys.toggleMute();
    if (screen === 'title') showTitle(); else showPause();
  }
  else if (action === 'Resume') { screen = 'playing'; }
  else if (action === 'Save Game') {
    SaveGame.save(state);
    Hud.message('Progress saved.', '#7fd4c1');
    screen = 'playing';
  }
  else if (action === 'Quit to Title') {
    SaveGame.save(state);
    showTitle();
  }
}

function updateMenuHover() {
  for (const b of buttons) {
    b.hover = Input.mouseX >= b.x && Input.mouseX <= b.x + b.w && Input.mouseY >= b.y && Input.mouseY <= b.y + b.h;
  }
  if (Input.mousePressed) {
    for (const b of buttons) {
      if (b.hover) { clickButton(b.action); break; }
    }
  }
}

// ---- interactions ----

function computePrompt() {
  const p = state.player;
  const px = p.car ? p.car.x : p.x, py = p.car ? p.car.y : p.y;
  Hud.prompt = '';
  const run = Missions.active || Missions.courier;
  if (!run) {
    const marker = Missions.startMarker(state);
    if (marker && dist(px, py, marker.x, marker.y) < 120) {
      Hud.prompt = 'Press E — ' + marker.label;
      return;
    }
    if (Missions.completed >= 1) {
      const g = state.city.landmarks.garage;
      if (dist(px, py, g.doorX, g.doorY) < 120) {
        Hud.prompt = 'Press E — Courier job ($120)';
        return;
      }
    }
  } else {
    const step = run.def.steps[run.stepIndex];
    if (step && step.type === 'talk') {
      const lm = state.city.landmarks[step.landmark];
      if (dist(px, py, lm.doorX, lm.doorY) < 110) {
        Hud.prompt = 'Press E — Talk to ' + lm.name;
        return;
      }
    }
  }
  if (p.car && Police.wanted > 0) {
    const g = state.city.landmarks.garage;
    if (dist(p.car.x, p.car.y, g.x, g.y) < 150) {
      Hud.prompt = 'Press E — Repaint $' + TUNING.repaintCost + ' (lose the cops)';
    }
  }
}

function handleInteractKey() {
  if (!Input.wasPressed('KeyE')) return;
  if (Missions.tryInteract(state)) return;
  Police.tryRepaint(state);
}

// ---- collisions between cars and people ----

function carPersonCollisions(dt) {
  playerHitCooldown = Math.max(0, playerHitCooldown - dt);
  const p = state.player;
  for (const car of state.cars) {
    if (car.dead) continue;
    const speed = Math.abs(car.speed);
    if (speed < 40) continue;
    // Pedestrians.
    for (const ped of state.peds) {
      if (ped.dead) continue;
      if (carHitTest(car, ped.x, ped.y, 4)) {
        hitPedByCar(state, ped, car);
        car.speed *= 0.7;
      }
    }
    // The player on foot.
    if (!p.car && !p.dead && playerHitCooldown <= 0 && car.driver !== 'player') {
      if (carHitTest(car, p.x, p.y, 4)) {
        playerHitCooldown = 0.8;
        damagePlayer(state, speed > 200 ? 22 : 12, car.x, car.y);
        Effects.addShake(6);
        // Knock the player aside.
        const a = Math.atan2(p.y - car.y, p.x - car.x);
        p.x += Math.cos(a) * 26;
        p.y += Math.sin(a) * 26;
        car.speed *= 0.75;
      }
    }
  }
}

// ---- per-frame update ----

function update(dt) {
  time += dt;
  saveCooldown = Math.max(0, saveCooldown - dt);

  updatePlayer(state, dt);
  updateTraffic(state, dt);
  resolveCarCollisions(state);
  carPersonCollisions(dt);
  updatePeds(state, dt);
  updateEnemies(state, dt);
  updateBullets(state, dt);
  Police.update(state, dt);
  Missions.update(state, dt);
  updatePickups(state, dt);
  Effects.update(dt);
  Hud.update(dt);
  AudioSys.updateMusic(dt, true);

  // Engine sound follows the player's car.
  if (state.player.car) {
    const car = state.player.car;
    AudioSys.setEngine(true, Math.min(1, Math.abs(car.speed) / car.def.topSpeed));
  } else {
    AudioSys.setEngine(false, 0);
  }

  // Camera follows the player, leading the direction of travel.
  const p = state.player;
  const focus = p.car || p;
  const moving = p.car ? { x: Math.cos(p.car.angle) * Math.sign(p.car.speed), y: Math.sin(p.car.angle) * Math.sign(p.car.speed) }
    : (p.moving ? { x: Math.cos(p.angle), y: Math.sin(p.angle) } : { x: 0, y: 0 });
  state.camera.lookX = moving.x;
  state.camera.lookY = moving.y;
  const speedNorm = p.car ? Math.min(1, Math.abs(p.car.speed) / p.car.def.topSpeed) : 0;
  state.camera.update(focus.x, focus.y, speedNorm, dt, Effects.shakeOffset());

  computePrompt();
  handleInteractKey();

  // The safehouse saves the game when Leo walks in.
  const home = state.city.landmarks.safehouse;
  if (saveCooldown <= 0 && dist(p.x, p.y, home.doorX, home.doorY) < 90) {
    saveCooldown = 25;
    SaveGame.save(state);
    Hud.message('Safehouse — progress saved.', '#7fd4c1');
  }

  // Pause keys.
  if (Input.wasPressed('Escape') || Input.wasPressed('KeyP')) showPause();
  if (Input.wasPressed('KeyM')) {
    AudioSys.toggleMute();
    Hud.message(AudioSys.muted ? 'Sound off' : 'Sound on', '#ffffff');
  }
}

function respawn(kind) {
  const p = state.player;
  const dest = kind === 'wasted' ? state.city.landmarks.hospital : state.city.landmarks.police;
  p.dead = false;
  p.health = 100;
  p.armor = 0;
  p.x = dest.doorX;
  p.y = dest.doorY + 30;
  p.angle = Math.PI / 2;
  if (p.car) { p.car.driver = 'parked'; p.car = null; }
  if (kind === 'wasted') {
    const bill = Math.floor(p.money * 0.1);
    p.money -= bill;
    Hud.message('Hospital bill: $' + bill, '#ff8a7a');
  }
  state.camera.x = p.x;
  state.camera.y = p.y;
  SaveGame.save(state);
  screen = 'playing';
}

// ---- staged scenes for screenshots ----

function setupScene(name) {
  newRun(false);
  const p = state.player;
  screen = 'playing';
  if (name === 'chase') {
    // Mid-pursuit: Leo in a Falcon GT heading north up 14th Street (the
    // x=1400 road), three stars, interceptors closing in behind and ahead,
    // and the Pier Package mission objective on the HUD.
    const car = makeCar('sports', 1400, 1900, -Math.PI / 2, { driver: 'player', color: '#c8452c' });
    car.speed = 210;
    state.cars.push(car);
    p.car = car;
    p.x = car.x; p.y = car.y;
    p.money = 1250;
    p.unlocked.smg = true;
    p.weapons.smg = { ammo: 30, reserve: 90 };
    Missions.completed = 2;
    Missions.startMission(state, Missions.nextMission());
    // Skip to the delivery step so the objective reads on the HUD, and clear
    // the mission splash so the staged frame is clean.
    const run = Missions.active;
    run.stepIndex = 2;
    Missions.beginStep(state);
    Hud.splashTimer = 0;
    Police.addHeat(state, 3, 'Kroll\'s tip-off: the cops are coming!');
    Police.update(state, 0.016);
    // Stage the interceptors on the same road: two behind, one ahead.
    const cops = state.cars.filter((c) => c.driver === 'police' && !c.roadblock);
    const slots = [
      { x: 1400, y: 2160, angle: -Math.PI / 2, speed: 280 },
      { x: 1400, y: 2380, angle: -Math.PI / 2, speed: 270 },
      { x: 1400, y: 1080, angle: Math.PI / 2, speed: 200 },
    ];
    cops.forEach((cop, i) => {
      const s = slots[i % slots.length];
      cop.x = s.x; cop.y = s.y; cop.angle = s.angle;
      cop.speed = s.speed;
    });
    // Clear the road ahead so the staged run is not wrecked by traffic.
    for (let i = state.cars.length - 1; i >= 0; i--) {
      const c = state.cars[i];
      if (c !== car && c.driver !== 'police' && Math.abs(c.x - 1400) < 80 && c.y > 900 && c.y < 2000) {
        state.cars.splice(i, 1);
      }
    }
    Hud.message('Lose the heat or outrun it — the motel pays either way.', '#ffd76a');
    state.camera.x = car.x;
    state.camera.y = car.y;
  } else if (name === 'street') {
    // A quiet street moment: Leo on foot by the diner, traffic and
    // pedestrians around, first mission marker glowing.
    const diner = state.city.landmarks.diner;
    p.x = diner.doorX + 60;
    p.y = diner.doorY + 90;
    p.angle = Math.PI * 0.75;
    p.money = 150;
    state.camera.x = p.x;
    state.camera.y = p.y;
  } else if (name === 'combat') {
    // The warehouse fight: Leo armed, Kroll crew closing in.
    const wh = state.city.landmarks.warehouse;
    p.x = wh.x;
    p.y = wh.y + 220;
    p.angle = -Math.PI / 2;
    p.unlocked.smg = true;
    p.weapon = 'smg';
    p.weapons.smg = { ammo: 30, reserve: 120 };
    p.health = 82;
    p.armor = 40;
    p.money = 640;
    Missions.completed = 4;
    Missions.startMission(state, Missions.nextMission());
    const run = Missions.active;
    run.stepIndex = 1;
    Missions.beginStep(state);
    for (let i = 0; i < 3; i++) {
      const e = state.enemies[i];
      if (e) { e.x = p.x + (i - 1) * 120; e.y = p.y - 180 - i * 30; }
    }
    Hud.message('Kroll\'s crew is onto you!', '#ff8a7a');
    state.camera.x = p.x;
    state.camera.y = p.y - 60;
  }
}

// ---- main loop ----

function frame(ts) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (ts - lastTs) / 1000 || 0.016);
  lastTs = ts;

  if (screen === 'playing') {
    update(dt);
    drawWorld(ctx, state, state.camera, viewW, viewH, time);
    Hud.draw(ctx, state, viewW, viewH);
  } else if (screen === 'title') {
    updateMenuHover();
    Hud.drawTitle(ctx, viewW, viewH, SaveGame.hasSave(), buttons);
  } else if (screen === 'help') {
    updateMenuHover();
    Hud.drawHelp(ctx, viewW, viewH, buttons);
  } else if (screen === 'paused') {
    updateMenuHover();
    drawWorld(ctx, state, state.camera, viewW, viewH, time);
    Hud.drawPause(ctx, viewW, viewH, buttons, state);
  } else if (screen === 'wasted' || screen === 'busted') {
    drawWorld(ctx, state, state.camera, viewW, viewH, time);
    Hud.drawEndScreen(ctx, viewW, viewH, screen);
    if (Input.wasPressed('Enter')) respawn(screen);
  }

  framesRendered++;
  if (framesRendered === 3) window.__solmarReady = true;
  Input.endFrame();
}

// Boot.
resize();
Input.init(canvas);
const params = new URLSearchParams(window.location.search);
const scene = params.get('scene');
if (scene) {
  // Screenshot mode: skip the title screen and the audio unlock dance.
  setupScene(scene);
} else {
  newRun(false);
  showTitle();
}
window.__solmar = { state, get screen() { return screen; } };
requestAnimationFrame(frame);
