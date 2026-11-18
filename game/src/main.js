// San Cielo Heat — the game itself: state machine, main loop, menus,
// scene staging for screenshots, and the wiring between every system.

import { PLACES } from './config.js';
import { buildCity, districtAt } from './city.js';
import { Input } from './input.js';
import { Camera } from './camera.js';
import { AudioSys } from './audio.js';
import { Effects } from './effects.js';
import { Player } from './player.js';
import { TrafficSystem } from './traffic.js';
import { PedSystem } from './pedestrians.js';
import { PoliceSystem } from './police.js';
import { CombatSystem } from './combat.js';
import { PickupSystem } from './pickups.js';
import { MissionSystem, updateCourierCar } from './missions.js';
import { resolveCarCollisions } from './vehicles.js';
import { drawWorld } from './renderer.js';
import {
  drawHUD, drawOverlayScreen, drawTitle, endButtons, helpLines,
  pauseButtons, titleButtons,
} from './hud.js';
import { applySaveState, clearSave, hasSave, loadGameState, saveGameState } from './savegame.js';
import { dist } from './util.js';

const START_POS = { x: 1180, y: 420 };

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.viewW = window.innerWidth;
    this.viewH = window.innerHeight;
    this.input = new Input(canvas);
    this.camera = new Camera(this.viewW, this.viewH);
    this.audio = new AudioSys();
    this.effects = new Effects();
    this.city = buildCity();
    this.player = new Player(START_POS.x, START_POS.y);
    this.traffic = new TrafficSystem(this.city);
    this.peds = new PedSystem(this.city);
    this.police = new PoliceSystem(this.city);
    this.combat = new CombatSystem();
    this.pickups = new PickupSystem();
    this.missions = new MissionSystem();
    this.courierCars = [];
    this.state = 'title';
    this.helpReturn = 'title';
    this.time = 0;
    this.messages = [];
    this.splashTitle = '';
    this.splashSub = '';
    this.splashTimer = 0;
    this.hint = '';
    this.districtName = 'Downtown';
    this.endTimer = 0;
    this.endReason = '';
    this.hoverId = null;
    this.lastTime = 0;
    this.mutedNote = false;

    this.traffic.spawnInitial();
    this.peds.spawnInitial(40);
    this.pickups.spawnInitial();
    this.camera.snapTo(START_POS.x, START_POS.y);
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('blur', () => {
      if (this.state === 'playing') this.state = 'paused';
    });
  }

  get allCars() {
    const cars = this.traffic.cars.concat(this.traffic.parked, this.police.cruisers, this.courierCars);
    if (this.player.inCar) cars.push(this.player.inCar);
    return cars;
  }

  resize() {
    this.viewW = window.innerWidth;
    this.viewH = window.innerHeight;
    this.canvas.width = this.viewW;
    this.canvas.height = this.viewH;
    this.camera.resize(this.viewW, this.viewH);
  }

  addMessage(text) {
    this.messages.push({ text, life: 5 });
    if (this.messages.length > 5) this.messages.shift();
  }

  splash(title, sub) {
    this.splashTitle = title;
    this.splashSub = sub;
    this.splashTimer = 3.2;
  }

  saveGame() {
    saveGameState(this);
  }

  newGame() {
    clearSave();
    this.player = new Player(START_POS.x, START_POS.y);
    this.traffic = new TrafficSystem(this.city);
    this.traffic.spawnInitial();
    this.peds = new PedSystem(this.city);
    this.peds.spawnInitial(40);
    this.police = new PoliceSystem(this.city);
    this.combat = new CombatSystem();
    this.pickups = new PickupSystem();
    this.pickups.spawnInitial();
    this.missions = new MissionSystem();
    this.courierCars = [];
    this.messages = [];
    this.time = 0;
    this.camera.snapTo(START_POS.x, START_POS.y);
    this.state = 'playing';
    this.splash('San Cielo', "Mara Vega, fresh out of luck. Ram's Garage is waiting.");
    this.addMessage("Go to Ram's Garage (green marker) to start your first job.");
  }

  continueGame() {
    const data = loadGameState();
    if (!data) {
      this.newGame();
      return;
    }
    this.newGameSilent();
    applySaveState(this, data);
    this.state = 'playing';
    this.addMessage('Welcome back, Mara.');
  }

  // Rebuild the world without touching the save file.
  newGameSilent() {
    this.player = new Player(START_POS.x, START_POS.y);
    this.traffic = new TrafficSystem(this.city);
    this.traffic.spawnInitial();
    this.peds = new PedSystem(this.city);
    this.peds.spawnInitial(40);
    this.police = new PoliceSystem(this.city);
    this.combat = new CombatSystem();
    this.pickups = new PickupSystem();
    this.pickups.spawnInitial();
    this.missions = new MissionSystem();
    this.courierCars = [];
    this.messages = [];
    this.time = 0;
  }

  // ---- staged scenes for screenshots: real gameplay states, set up
  // through the same systems a player drives. ----
  stageScene(name) {
    this.newGameSilent();
    this.state = 'playing';
    if (name === 'street') {
      this.player.x = 1380;
      this.player.y = 980;
      this.camera.snapTo(1380, 980);
      this.missions.startStory(this);
      this.splashTimer = 0;
      this.addMessage("Ram needs wheels. Steal a car and bring it to the garage.");
    } else if (name === 'chase') {
      this.startChaseScene();
    } else if (name === 'combat') {
      this.player.x = PLACES.depot.x - 160;
      this.player.y = PLACES.depot.y;
      this.player.giveWeapon('smg', 120);
      this.player.weapon = 'smg';
      this.camera.snapTo(this.player.x, this.player.y);
      for (let i = 0; i < 3; i++) {
        this.combat.spawnEnemy(PLACES.depot.x + 60 + i * 70, PLACES.depot.y - 60 + i * 50, { health: 55 });
      }
      this.police.addWanted(1, 'Shots reported — police responding!');
      this.missions.storyIndex = 4;
      this.missions.startStory(this);
      this.splashTimer = 0;
    }
    this.state = 'playing';
  }

  startChaseScene() {
    const car = this.traffic.parked.find((c) => c.type === 'sports') || this.traffic.parked[0];
    if (car) {
      this.traffic.removeParkedCar(car);
      car.driver = 'player';
      car.x = 1780;
      car.y = 1780;
      car.angle = 0;
      this.player.inCar = car;
      this.player.x = car.x;
      this.player.y = car.y;
    }
    this.camera.snapTo(1780, 1780);
    this.police.addWanted(3, 'The heat is on!');
    for (let i = 0; i < 3; i++) this.police.spawnCruiser(this);
    this.missions.storyIndex = 1;
    this.missions.startStory(this);
    this.splashTimer = 0;
    this.addMessage('Deliver the parcel to the Grand Bazaar — and lose the cops.');
  }

  // ---- per-frame update ----

  update(dt) {
    this.time += dt;
    if (this.splashTimer > 0) this.splashTimer -= dt;
    for (let i = this.messages.length - 1; i >= 0; i--) {
      this.messages[i].life -= dt;
      if (this.messages[i].life <= 0) this.messages.splice(i, 1);
    }
    this.districtName = districtAt(this.player.x, this.player.y);

    const input = this.input;
    const player = this.player;

    // Global keys.
    if (input.wasPressed('KeyM')) {
      const muted = this.audio.toggleMute();
      this.addMessage(muted ? 'Sound muted.' : 'Sound on.');
    }
    if (input.wasPressed('KeyP') || input.wasPressed('Escape')) {
      this.state = 'paused';
      input.endFrame();
      return;
    }

    // Weapon switching.
    if (input.wasPressed('Digit1')) player.weapon = 'fists';
    if (input.wasPressed('Digit2') && player.weapons.pistol.owned) player.weapon = 'pistol';
    if (input.wasPressed('Digit3') && player.weapons.smg.owned) player.weapon = 'smg';

    // Interact.
    if (input.wasPressed('KeyE')) this.onInteract();

    // Fire.
    if (!player.inCar && !player.dead) {
      const def = player.currentWeaponDef;
      const wantFire = def.auto ? input.mouse.down : input.mouse.clicked;
      if (wantFire) {
        const world = this.camera.screenToWorld(input.mouse.x, input.mouse.y);
        player.tryFire(this, world.x, world.y);
      }
    }

    // Move the player.
    if (player.inCar) player.updateInCar(dt, input, this);
    else player.updateOnFoot(dt, input, this);

    // World systems.
    this.traffic.update(dt, this);
    this.peds.update(dt, this);
    this.police.update(dt, this);
    this.combat.update(dt, this);
    this.pickups.update(dt, this);
    this.missions.update(dt, this);
    for (const car of this.courierCars) updateCourierCar(this, car, dt);
    resolveCarCollisions(this, this.allCars, dt);
    this.effects.update(dt);

    // Running over pedestrians is a crime the city notices.
    if (player.inCar) {
      const car = player.inCar;
      const sp = Math.hypot(car.vx, car.vy);
      if (sp > 60) {
        const ped = this.peds.nearest(car.x, car.y, 30);
        if (ped) {
          this.peds.hurtPed(this, ped, 60, car.x, car.y);
          this.police.addWanted(1, 'Pedestrian hit!');
          this.camera.addShake(6);
        }
      }
    }

    // Camera follows Mara, or her car.
    const speed = player.inCar ? Math.hypot(player.inCar.vx, player.inCar.vy) : 0;
    this.camera.follow(player.x, player.y, speed, dt);

    // Audio beds.
    const engineRatio = player.inCar ? Math.min(1, Math.hypot(player.inCar.vx, player.inCar.vy) / 320) : 0;
    const sirenNear = this.police.cruisers.some((c) => dist(c.x, c.y, player.x, player.y) < 700);
    this.audio.update(dt, engineRatio, sirenNear);

    // Context hint.
    this.hint = this.computeHint();

    // Wasted / busted transitions.
    if (player.dead && this.endTimer <= 0) {
      this.endTimer = 1.1;
      this.endReason = 'wasted';
    }
    if (this.police.busted && this.endTimer <= 0) {
      this.endTimer = 0.6;
      this.endReason = 'busted';
      this.police.busted = false;
    }
    if (this.endTimer > 0) {
      this.endTimer -= dt;
      if (this.endTimer <= 0) this.enterEndState();
    }
  }

  computeHint() {
    const player = this.player;
    if (player.inCar) {
      if (this.police.wanted > 0 && dist(player.x, player.y, PLACES.paintShop.x, PLACES.paintShop.y) < 90) {
        return 'Respray here — $150 clears the heat.';
      }
      return 'E — Exit car · Space — Handbrake';
    }
    if (this.traffic.nearestStealable(player.x, player.y, 70)) return 'E — Steal car';
    if (this.missions.canStartStory(this)) return 'E — Start job: ' + this.missions.currentDef().title;
    if (this.missions.nearCourierSpot(player) && !this.missions.active && !this.missions.courier) return 'E — Take courier job';
    return '';
  }

  onInteract() {
    const player = this.player;
    if (player.inCar) {
      player.exitCar(this);
      return;
    }
    if (this.traffic.nearestStealable(player.x, player.y, 70) || this.police.nearestAbandonedCruiser(player.x, player.y, 70)) {
      player.tryEnterCar(this);
      return;
    }
    if (this.missions.canStartStory(this)) {
      this.missions.startStory(this);
      return;
    }
    this.missions.tryStartCourier(this);
  }

  enterEndState() {
    const player = this.player;
    this.missions.failActive(this, this.endReason === 'wasted' ? 'Mara is down.' : 'Mara is busted.');
    this.missions.courier = null;
    if (this.endReason === 'wasted') {
      const lost = Math.min(player.money, 100);
      player.money -= lost;
      this.state = 'wasted';
      this.endLines = ['The streets of San Cielo are unforgiving.', 'You lost $' + lost + ' at the hospital.'];
    } else {
      const lost = Math.min(player.money, 150);
      player.money -= lost;
      this.state = 'busted';
      this.endLines = ['The SCPD took you in.', 'Bail cost $' + lost + '. The heat is off — for now.'];
    }
    this.police.reset();
    this.saveGame();
  }

  retryFromEnd() {
    const spot = this.state === 'wasted' ? PLACES.hospital : PLACES.policeHQ;
    this.player.respawn(this, spot.x + 60, spot.y + 40);
    this.state = 'playing';
    this.endTimer = 0;
  }

  // ---- menus ----

  buttonAt(buttons, x, y) {
    return buttons.find((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) || null;
  }

  handleMenuClick(buttons) {
    const b = this.buttonAt(buttons, this.input.mouse.x, this.input.mouse.y);
    if (!b) return null;
    return b.id;
  }

  updateMenu() {
    const input = this.input;
    if (input.anyKey) this.audio.unlock();
    if (this.state === 'title') {
      const buttons = titleButtons(this.viewW, this.viewH, hasSave());
      const hover = this.buttonAt(buttons, input.mouse.x, input.mouse.y);
      this.hoverId = hover ? hover.id : null;
      if (input.mouse.clicked && hover) {
        this.audio.unlock();
        if (hover.id === 'new') this.newGame();
        else if (hover.id === 'continue') this.continueGame();
        else if (hover.id === 'help') { this.helpReturn = 'title'; this.state = 'help'; }
      }
    } else if (this.state === 'paused') {
      const buttons = pauseButtons(this.viewW, this.viewH);
      const hover = this.buttonAt(buttons, input.mouse.x, input.mouse.y);
      this.hoverId = hover ? hover.id : null;
      if (input.wasPressed('KeyP') || input.wasPressed('Escape')) this.state = 'playing';
      if (input.mouse.clicked && hover) {
        if (hover.id === 'resume') this.state = 'playing';
        else if (hover.id === 'help') { this.helpReturn = 'paused'; this.state = 'help'; }
        else if (hover.id === 'quit') { this.saveGame(); this.state = 'title'; }
      }
    } else if (this.state === 'help') {
      const buttons = [{ id: 'back', label: 'Back', x: (this.viewW - 260) / 2, y: this.viewH * 0.62, w: 260, h: 46 }];
      const hover = this.buttonAt(buttons, input.mouse.x, input.mouse.y);
      this.hoverId = hover ? hover.id : null;
      if (input.mouse.clicked && hover) this.state = this.helpReturn;
      if (input.wasPressed('Escape')) this.state = this.helpReturn;
    } else if (this.state === 'wasted' || this.state === 'busted') {
      const buttons = endButtons(this.viewW, this.viewH);
      const hover = this.buttonAt(buttons, input.mouse.x, input.mouse.y);
      this.hoverId = hover ? hover.id : null;
      if (input.mouse.clicked && hover) {
        if (hover.id === 'retry') this.retryFromEnd();
        else if (hover.id === 'quit') { this.saveGame(); this.state = 'title'; }
      }
    }
  }

  // ---- frame ----

  frame(timestamp) {
    const dt = Math.min(0.05, (timestamp - this.lastTime) / 1000 || 0.016);
    this.lastTime = timestamp;
    const input = this.input;
    if (input.anyKey || input.mouse.down) this.audio.unlock();

    if (this.state === 'playing') {
      this.update(dt);
    } else {
      this.updateMenu();
      this.effects.update(dt);
    }

    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.viewW, this.viewH);
    if (this.state === 'title') {
      drawTitle(ctx, this, titleButtons(this.viewW, this.viewH, hasSave()), this.hoverId);
    } else {
      this.camera.apply(ctx);
      drawWorld(ctx, this);
      this.camera.restore(ctx);
      if (this.state === 'playing') {
        drawHUD(ctx, this);
      } else if (this.state === 'paused') {
        drawHUD(ctx, this);
        drawOverlayScreen(ctx, this, 'PAUSED', ['Take a breath, Mara. The city waits.'], pauseButtons(this.viewW, this.viewH), this.hoverId);
      } else if (this.state === 'help') {
        drawHUD(ctx, this);
        drawOverlayScreen(ctx, this, 'HOW TO PLAY', helpLines(), [{ id: 'back', label: 'Back', x: (this.viewW - 260) / 2, y: this.viewH * 0.62, w: 260, h: 46 }], this.hoverId);
      } else if (this.state === 'wasted') {
        drawOverlayScreen(ctx, this, 'WASTED', this.endLines || [], endButtons(this.viewW, this.viewH), this.hoverId, '#e04a3a');
      } else if (this.state === 'busted') {
        drawOverlayScreen(ctx, this, 'BUSTED', this.endLines || [], endButtons(this.viewW, this.viewH), this.hoverId, '#4b8ad9');
      }
    }
    this.effects.drawScreenFlash(ctx, this.viewW, this.viewH);

    input.endFrame();
    requestAnimationFrame((t) => this.frame(t));
  }

  start() {
    const params = new URLSearchParams(window.location.search);
    const scene = params.get('scene');
    if (scene && scene !== 'menu') this.stageScene(scene);
    window.__game = this;
    window.__ready = true;
    requestAnimationFrame((t) => {
      this.lastTime = t;
      this.frame(t);
    });
  }
}

const canvas = document.getElementById('game');
const game = new Game(canvas);
game.start();
