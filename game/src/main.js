// San Cielo Heat — the game itself: state machine, main loop, menus,
// scene staging for screenshots, and the wiring between every system.

import { PLACES, TUNING } from './config.js';
import { buildCity, collideCar, collideCircle, districtAt } from './city.js';
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
import { driveCar, makeVehicle, resolveCarCollisions } from './vehicles.js';
import { drawWorld } from './renderer.js';
import {
  drawHUD, drawOverlayScreen, drawTitle, endButtons, helpLines,
  pauseButtons, titleButtons,
} from './hud.js';
import { applySaveState, clearSave, hasSave, loadGameState, saveGameState } from './savegame.js';
import { clamp, dist } from './util.js';

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
    this.shotMode = new URLSearchParams(window.location.search).get('shot');

    this.traffic.spawnInitial();
    this.peds.spawnInitial(40);
    this.pickups.spawnInitial();
    this.camera.snapTo(START_POS.x, START_POS.y);
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('blur', () => {
      if (this.state === 'playing') this.state = 'paused';
    });
    this.onEnemyDown = (enemy) => this.missions.onEnemyDown(this);
    this.onBriefcase = () => this.missions.onBriefcase(this);
    this.onPlayerDown = (reason) => this.endRun(reason);

    if (this.shotMode) this.stageShot(this.shotMode);
  }

  get allCars() {
    const cars = this.traffic.cars.concat(this.traffic.parked, this.police.cruisers, this.police.roadblocks, this.courierCars);
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
    if (saveGameState(this)) this.addMessage('Game saved.');
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
    this.audio.ensure();
  }

  continueGame() {
    const data = loadGameState();
    if (!data) return;
    this.newGame();
    applySaveState(this, data);
    this.state = 'playing';
    this.splash('Welcome back', 'San Cielo kept your seat warm.');
    this.audio.ensure();
  }

  endRun(reason) {
    if (this.state !== 'playing') return;
    this.state = 'ended';
    this.endReason = reason;
    this.endTimer = 0;
    if (reason === 'wasted') {
      this.audio.wasted();
      this.player.money = Math.max(0, this.player.money - 100);
    } else {
      this.audio.busted();
      this.player.money = Math.max(0, this.player.money - 150);
      this.player.clearWanted();
      this.police.reset();
    }
    this.saveGame();
  }

  retryRun() {
    const data = loadGameState();
    this.player.health = TUNING.maxHealth;
    this.player.armor = 0;
    if (this.player.inCar) {
      this.traffic.parkCar(this.player.inCar);
      this.player.inCar = null;
    }
    if (this.endReason === 'wasted') {
      this.player.x = PLACES.hospital.x;
      this.player.y = PLACES.hospital.y;
    } else {
      this.player.x = PLACES.policeHQ.x;
      this.player.y = PLACES.policeHQ.y + 90;
    }
    this.player.clearWanted();
    this.police.reset();
    this.combat.reset();
    this.missions.active = null;
    this.missions.stepIndex = 0;
    this.courierCars = [];
    this.camera.snapTo(this.player.x, this.player.y);
    this.state = 'playing';
    this.splash(this.endReason === 'wasted' ? 'Patched up' : 'Released', 'Back on the streets. The city waits.');
  }

  // Scene staging for screenshots: put the game in a lively, readable state.
  stageShot(mode) {
    this.state = 'playing';
    this.audio.ensure();
    if (mode === 'menu') {
      this.state = 'title';
      return;
    }
    if (mode === 'chase') {
      const car = makeVehicle('muscle', 1780, 980, 0, '#c94f43');
      car.driver = 'player';
      this.player.inCar = car;
      this.player.x = car.x;
      this.player.y = car.y;
      this.player.wanted = 3;
      this.player.weapon = 'pistol';
      this.player.money = 1250;
      this.player.health = 82;
      this.missions.startStory(this);
      // The car is already stolen: jump to the "bring it to Ram" step so the
      // cover shot shows a live objective with its beacon.
      this.missions.stepIndex = 1;
      // Pre-spawn cruisers in pursuit formation, close enough to stay in frame.
      const cruiserSpots = [
        { dx: -170, dy: -8, angle: 0 },
        { dx: -210, dy: 46, angle: 0 },
        { dx: 210, dy: 30, angle: Math.PI },
      ];
      for (const spot of cruiserSpots) {
        const cruiser = this.police.spawnCruiser(car.x, car.y);
        cruiser.x = car.x + spot.dx;
        cruiser.y = car.y + spot.dy;
        cruiser.angle = spot.angle;
        cruiser.speed = 260;
      }
      this.camera.snapTo(car.x, car.y);
      this.splash('Hot Wheels', "Ram needs wheels. Steal a car and bring it to the garage.");
      this.addMessage('The Kestrels called it in — lose the heat!');
    } else if (mode === 'street') {
      this.player.x = 1380;
      this.player.y = 580;
      this.player.weapon = 'fists';
      this.player.money = 420;
      this.camera.snapTo(this.player.x, this.player.y);
      this.addMessage("Go to Ram's Garage (green marker) to start your first job.");
      this.splash('San Cielo', 'Downtown, midday. The city is yours to explore.');
    } else if (mode === 'combat') {
      this.player.x = PLACES.depot.x - 130;
      this.player.y = PLACES.depot.y + 60;
      this.player.weapon = 'smg';
      this.player.armor = 50;
      this.player.money = 860;
      for (let i = 0; i < 4; i++) {
        this.combat.spawnEnemy(PLACES.depot.x + (i % 2) * 90 - 40, PLACES.depot.y + Math.floor(i / 2) * 80 - 30, { alerted: true });
      }
      this.camera.snapTo(this.player.x + 60, this.player.y);
      this.splash('The Crew', 'Hit the Harbor Depot.');
      this.addMessage('Hostiles ahead — take them down.');
    }
  }

  startLoop() {
    const step = (now) => {
      const dt = Math.min(0.05, this.lastTime ? (now - this.lastTime) / 1000 : 0.016);
      this.lastTime = now;
      this.frame(dt);
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  frame(dt) {
    const input = this.input;
    if (input.wasPressed('m')) {
      this.audio.setMuted(!this.audio.muted);
      this.mutedNote = true;
      this.addMessage(this.audio.muted ? 'Sound muted.' : 'Sound on.');
    }

    if (this.state === 'title') this.updateTitle(input);
    else if (this.state === 'help') this.updateHelp(input);
    else if (this.state === 'paused') this.updatePaused(input);
    else if (this.state === 'ended') this.updateEnded(dt, input);
    else if (this.state === 'playing') this.updatePlaying(dt, input);

    this.draw();
    input.endFrame();
  }

  buttonsUnderMouse(buttons) {
    for (const b of buttons) {
      if (this.input.mouseX >= b.x && this.input.mouseX <= b.x + b.w &&
          this.input.mouseY >= b.y && this.input.mouseY <= b.y + b.h) return b;
    }
    return null;
  }

  updateTitle(input) {
    const buttons = titleButtons(this.viewW, this.viewH, hasSave());
    const hover = this.buttonsUnderMouse(buttons);
    this.hoverId = hover ? hover.id : null;
    if (hover && input.clicked) {
      this.audio.ensure();
      this.audio.uiClick();
      if (hover.id === 'new') this.newGame();
      else if (hover.id === 'continue') this.continueGame();
      else if (hover.id === 'help') { this.helpReturn = 'title'; this.state = 'help'; }
    }
    if (input.wasPressed('Enter')) {
      this.audio.ensure();
      if (hasSave()) this.continueGame();
      else this.newGame();
    }
  }

  updateHelp(input) {
    if (input.clicked || input.wasPressed('Escape') || input.wasPressed('p') || input.wasPressed('Enter')) {
      this.state = this.helpReturn;
    }
  }

  updatePaused(input) {
    const buttons = pauseButtons(this.viewW, this.viewH);
    const hover = this.buttonsUnderMouse(buttons);
    this.hoverId = hover ? hover.id : null;
    if (hover && input.clicked) {
      this.audio.uiClick();
      if (hover.id === 'resume') this.state = 'playing';
      else if (hover.id === 'save') { this.saveGame(); }
      else if (hover.id === 'help') { this.helpReturn = 'paused'; this.state = 'help'; }
      else if (hover.id === 'quit') this.state = 'title';
    }
    if (input.wasPressed('p') || input.wasPressed('Escape')) this.state = 'playing';
  }

  updateEnded(dt, input) {
    this.endTimer += dt;
    const buttons = endButtons(this.viewW, this.viewH);
    const hover = this.buttonsUnderMouse(buttons);
    this.hoverId = hover ? hover.id : null;
    if (this.endTimer > 0.6 && hover && input.clicked) {
      this.audio.uiClick();
      if (hover.id === 'retry') this.retryRun();
      else if (hover.id === 'quit') this.state = 'title';
    }
  }

  updatePlaying(dt, input) {
    this.time += dt;
    this.splashTimer = Math.max(0, this.splashTimer - dt);
    for (let i = this.messages.length - 1; i >= 0; i--) {
      this.messages[i].life -= dt;
      if (this.messages[i].life <= 0) this.messages.splice(i, 1);
    }
    const player = this.player;
    player.updateTimers(dt);

    if (input.wasPressed('p') || input.wasPressed('Escape')) {
      this.state = 'paused';
      return;
    }
    if (input.wasPressed('f')) this.saveGame();
    if (input.wasPressed('1')) player.selectWeapon('fists');
    if (input.wasPressed('2')) player.selectWeapon('pistol');
    if (input.wasPressed('3')) player.selectWeapon('smg');
    if (input.wheel !== 0) player.cycleWeapon(input.wheel > 0 ? 1 : -1);

    // Aim at the mouse.
    const world = this.camera.toWorld(input.mouseX, input.mouseY);
    const focusX = player.inCar ? player.inCar.x : player.x;
    const focusY = player.inCar ? player.inCar.y : player.y;
    player.angle = Math.atan2(world.y - focusY, world.x - focusX);
    player.aiming = input.mouseDown;

    if (player.inCar) this.updateDriving(dt, input);
    else this.updateOnFoot(dt, input, world);

    // Interactions.
    this.hint = this.computeHint();
    if (input.wasPressed('e')) this.useInteraction();

    // World systems.
    this.traffic.update(dt, player, this.allCars);
    this.peds.update(dt, player, null);
    for (const car of this.courierCars) {
      if (!car.dead) updateCourierCar(this, car, dt);
    }
    const policeResult = this.police.update(dt, this);
    if (policeResult.busted) this.endRun('busted');
    if (policeResult.evaded) {
      this.addMessage(player.wanted > 0 ? 'Heat dropping... ' + player.wanted + ' star' + (player.wanted > 1 ? 's' : '') + ' left.' : 'You lost them. The heat is off.');
    }
    this.combat.update(dt, this);
    this.pickups.update(dt, this);
    this.missions.update(dt, this);
    this.effects.update(dt);
    this.audio.engine(player.inCar ? Math.abs(player.inCar.speed) / 380 : 0, !!player.inCar);
    this.audio.siren(player.wanted > 0 && this.police.cruisers.length > 0, dt);
    this.audio.updateMusic(dt, true);

    // Car-vs-car collisions, then building collisions for the player's car.
    resolveCarCollisions(this.allCars, this.effects, this.audio);
    if (player.inCar) {
      if (collideCar(this.city, player.inCar, player.inCar.def.len / 2, player.inCar.def.wid / 2)) {
        if (Math.abs(player.inCar.speed) > 130) {
          player.inCar.damage = clamp(player.inCar.damage + 0.08, 0, 1);
          this.effects.sparks(player.inCar.x, player.inCar.y);
          this.audio.crash(Math.abs(player.inCar.speed) / 400);
          this.camera.addShake(6);
        }
        player.inCar.speed *= 0.4;
      }
      // A wrecked car catches fire and the player is forced out.
      if (player.inCar.damage >= 1) {
        this.effects.explosion(player.inCar.x, player.inCar.y);
        this.audio.crash(1);
        this.camera.addShake(16);
        const wreck = player.inCar;
        player.x = wreck.x + 40;
        player.y = wreck.y + 40;
        player.inCar = null;
        wreck.dead = true;
        wreck.speed = 0;
        this.traffic.parkCar(wreck);
        this.addMessage('Your car is wrecked!');
      }
      // Smoking engine when badly damaged.
      if (player.inCar && player.inCar.damage > 0.55) {
        player.inCar.smokeTimer -= dt;
        if (player.inCar.smokeTimer <= 0) {
          player.inCar.smokeTimer = 0.09;
          this.effects.smoke(player.inCar.x + Math.cos(player.inCar.angle) * 20, player.inCar.y + Math.sin(player.inCar.angle) * 20);
        }
      }
    }

    // Pedestrians hit by the player's car.
    if (player.inCar && Math.abs(player.inCar.speed) > 60) {
      for (const ped of this.peds.peds) {
        if (dist(ped.x, ped.y, player.inCar.x, player.inCar.y) < 30 && ped.fleeing <= 0) {
          ped.fleeing = 3;
          if (player.addWanted(1)) {
            this.addMessage('The SCPD saw that!');
            this.audio.wantedUp();
          }
          this.peds.alarm();
        }
      }
    }

    this.districtName = districtAt(focusX, focusY);
    const lookX = player.inCar ? Math.cos(player.inCar.angle) : 0;
    const lookY = player.inCar ? Math.sin(player.inCar.angle) : 0;
    this.camera.update(focusX, focusY, lookX, lookY, dt);
  }

  updateOnFoot(dt, input, world) {
    const player = this.player;
    const axes = input.axes();
    const mag = Math.hypot(axes.x, axes.y);
    player.moving = mag > 0;
    player.running = input.isDown('Shift') && mag > 0;
    const speed = player.running ? TUNING.runSpeed : TUNING.walkSpeed;
    if (mag > 0) {
      const nx = axes.x / mag;
      const ny = axes.y / mag;
      player.x += nx * speed * dt;
      player.y += ny * speed * dt;
      player.walkPhase += dt * (player.running ? 11 : 7);
    }
    collideCircle(this.city, player);

    // Shooting.
    if (input.mouseDown && player.canFire()) {
      this.fireWeapon(world);
    }
  }

  updateDriving(dt, input) {
    const player = this.player;
    const car = player.inCar;
    const axes = input.axes();
    const throttle = axes.y < 0 ? 1 : axes.y > 0 ? -1 : 0;
    const steer = axes.x;
    const handbrake = input.isDown(' ');
    const before = Math.abs(car.speed);
    driveCar(car, throttle, steer, handbrake, dt);
    player.x = car.x;
    player.y = car.y;
    // Skid marks while drifting.
    if (handbrake && before > 120) {
      this.effects.skid(car.x - Math.cos(car.angle) * 18, car.y - Math.sin(car.angle) * 18, car.angle);
    }
    if (input.wasPressed('h')) this.audio.horn();
    // Drive-by shooting is not a thing here; the horn is.
    if (input.mouseDown && player.canFire() && player.weapon !== 'fists') {
      // Lean out and shoot from the car window, slowly.
      if (player.cooldown <= 0) {
        const world = this.camera.toWorld(input.mouseX, input.mouseY);
        this.fireWeapon(world, true);
      }
    }
  }

  fireWeapon(world, fromCar) {
    const player = this.player;
    const originX = player.inCar ? player.inCar.x : player.x;
    const originY = player.inCar ? player.inCar.y : player.y;
    const angle = Math.atan2(world.y - originY, world.x - originX);
    if (player.weapon === 'fists') {
      player.spendAmmo();
      this.combat.melee(this);
      return;
    }
    if (!player.canFire()) return;
    player.spendAmmo();
    const def = player.weaponDef;
    const mx = originX + Math.cos(angle) * 22;
    const my = originY + Math.sin(angle) * 22;
    this.combat.fireBullet(mx, my, angle, {
      damage: def.damage, range: def.range, spread: def.spread, friendly: true,
    });
    this.effects.burst(mx, my, { count: 3, speed: 70, life: 0.1, size: 3, color: '#ffd76a' });
    this.audio.shot(player.weapon);
    this.peds.alarm();
    // Gunfire draws the law, but one burst is one alarm, not five stars.
    if (player.wanted === 0) {
      player.addWanted(1);
      this.addMessage('Shots fired — the SCPD is on the way.');
      this.audio.wantedUp();
    }
    this.camera.addShake(def.kick);
  }

  computeHint() {
    const player = this.player;
    const px = player.inCar ? player.inCar.x : player.x;
    const py = player.inCar ? player.inCar.y : player.y;
    if (!player.inCar) {
      const near = this.traffic.nearestCar(px, py, 56, true);
      if (near) return 'Press E to steal the ' + near.def.name;
      if (dist(px, py, PLACES.garage.x, PLACES.garage.y) < 90 && !this.missions.active && !this.missions.completedStory) {
        return 'Press E to start the next job for Ram';
      }
      if (dist(px, py, PLACES.paintShop.x, PLACES.paintShop.y) < 70) {
        return 'Spray & Shine — bring a car here to clear wanted stars ($150)';
      }
    } else {
      if (dist(px, py, PLACES.paintShop.x, PLACES.paintShop.y) < 70 && player.wanted > 0) {
        return 'Press E for a respray — clears wanted stars ($150)';
      }
      return 'Press E to leave the car · Space to handbrake';
    }
    return '';
  }

  useInteraction() {
    const player = this.player;
    const px = player.inCar ? player.inCar.x : player.x;
    const py = player.inCar ? player.inCar.y : player.y;

    if (player.inCar) {
      // Respray at the paint shop.
      if (dist(px, py, PLACES.paintShop.x, PLACES.paintShop.y) < 70 && player.wanted > 0) {
        if (player.money >= TUNING.repaintCost) {
          player.addMoney(-TUNING.repaintCost);
          player.clearWanted();
          this.police.reset();
          const colors = ['#c94f43', '#4b8ad9', '#e0a83c', '#5da56a', '#e8e4da', '#8a5fb0'];
          player.inCar.color = colors[Math.floor(Math.random() * colors.length)];
          player.inCar.damage = 0;
          this.addMessage('Fresh paint, clean slate. The heat is off.');
          this.audio.cash();
          this.effects.burst(px, py, { count: 16, speed: 120, life: 0.6, size: 4, color: '#ffd94d' });
        } else {
          this.addMessage('Not enough cash for a respray ($150).');
        }
        return;
      }
      // Exit the car.
      const car = player.inCar;
      player.inCar = null;
      player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
      player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
      collideCircle(this.city, player);
      this.traffic.parkCar(car);
      this.audio.doorSlam();
      return;
    }

    // Enter the nearest car.
    const near = this.traffic.nearestCar(px, py, 56, true);
    if (near) {
      this.traffic.removeCar(near);
      near.driver = 'player';
      player.inCar = near;
      player.carsStolen++;
      this.audio.doorSlam();
      this.missions.onCarStolen(this);
      // Stealing in view of the police draws heat.
      for (const cruiser of this.police.cruisers) {
        if (dist(cruiser.x, cruiser.y, px, py) < 400 && player.addWanted(1)) {
          this.addMessage('A cruiser saw you steal that car!');
          this.audio.wantedUp();
          break;
        }
      }
      return;
    }

    // Start the next story job at the garage.
    if (dist(px, py, PLACES.garage.x, PLACES.garage.y) < 90 && !this.missions.active && !this.missions.completedStory) {
      this.missions.startStory(this);
      return;
    }

    // Start a courier job at any courier stop.
    if (!this.missions.courier && !this.missions.active) {
      const stops = [
        { x: 1380, y: 380 }, { x: 1380, y: 2180 }, { x: 580, y: 1780 }, { x: 1580, y: 1580 }, { x: 2980, y: 580 },
      ];
      for (const stop of stops) {
        if (dist(px, py, stop.x, stop.y) < 80) {
          if (this.missions.startCourier(this)) this.audio.uiClick();
          return;
        }
      }
    }
  }

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.viewW, this.viewH);
    if (this.state === 'title') {
      drawTitle(ctx, this, titleButtons(this.viewW, this.viewH, hasSave()), this.hoverId);
      return;
    }
    drawWorld(ctx, this);
    if (this.state === 'playing') {
      drawHUD(ctx, this);
    } else if (this.state === 'paused') {
      drawHUD(ctx, this);
      drawOverlayScreen(ctx, this, 'PAUSED', [
        'Mara Vega · ' + this.districtName,
        'Jobs done: ' + this.player.missionsDone + ' · Courier runs: ' + this.player.courierDone + ' · Cars stolen: ' + this.player.carsStolen,
      ], pauseButtons(this.viewW, this.viewH), this.hoverId);
    } else if (this.state === 'help') {
      drawOverlayScreen(ctx, this, 'HOW TO PLAY', helpLines(), [], this.hoverId);
      ctx.font = '13px Verdana, sans-serif';
      ctx.fillStyle = '#ffd94d';
      ctx.textAlign = 'center';
      ctx.fillText('Click anywhere to go back', this.viewW / 2, this.viewH * 0.78);
      ctx.textAlign = 'left';
    } else if (this.state === 'ended') {
      const wasted = this.endReason === 'wasted';
      drawOverlayScreen(ctx, this, wasted ? 'WASTED' : 'BUSTED', [
        wasted ? 'Mara wakes up at St. Cielo Hospital, $100 lighter.' : 'The SCPD lets Mara go, $150 lighter. The heat is off.',
        'Money: ' + '$' + this.player.money + ' · Jobs done: ' + this.player.missionsDone,
      ], endButtons(this.viewW, this.viewH), this.hoverId, wasted ? '#e84c3d' : '#4b8ad9');
    }
  }
}

const canvas = document.getElementById('game');
const game = new Game(canvas);
window.__sanCieloGame = game;
game.startLoop();
