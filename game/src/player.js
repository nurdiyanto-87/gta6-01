// Solmar Heat — the player: Leo Marsh, on foot and behind the wheel.
// Movement, aiming, weapons, health and armour, and getting in and out of
// cars. Driving itself lives in vehicles.js; this file decides what the
// player's hands are doing.

import { TUNING, clamp, dist, angleTo } from './config.js';
import { collideCircle } from './city.js';
import { Input } from './input.js';
import { driveCar, damageCar } from './vehicles.js';
import { Effects } from './effects.js';
import { AudioSys } from './audio.js';
import { spawnBullet } from './combat.js';
import { makePed } from './pedestrians.js';

export const WEAPONS = {
  pistol: { name: 'P-9 Pistol', damage: 26, rate: 0.26, mag: 12, spread: 0.045, pellets: 1, range: 520, auto: false, reload: 0.9, sound: 'pistol' },
  smg: { name: 'K-7 SMG', damage: 13, rate: 0.085, mag: 30, spread: 0.09, pellets: 1, range: 460, auto: true, reload: 1.2, sound: 'smg' },
  shotgun: { name: 'Breacher Shotgun', damage: 13, rate: 0.72, mag: 6, spread: 0.16, pellets: 6, range: 300, auto: false, reload: 1.5, sound: 'shotgun' },
};

export function createPlayer(x, y) {
  return {
    name: 'Leo Marsh',
    x, y, angle: -Math.PI / 2,
    radius: TUNING.playerRadius,
    health: 100, maxHealth: 100,
    armor: 0, maxArmor: 100,
    money: TUNING.startMoney,
    weapon: 'pistol',
    weapons: { pistol: { ammo: 12, reserve: 72 }, smg: { ammo: 0, reserve: 0 }, shotgun: { ammo: 0, reserve: 0 } },
    unlocked: { pistol: true, smg: false, shotgun: false },
    cooldown: 0,
    reloadTimer: 0,
    moving: false,
    phase: 0,
    car: null, // the car Leo is driving, or null when on foot
    dead: false,
    deadTimer: 0,
    shirt: '#3d7ab8',
    pants: '#2c2c34',
    skin: '#e8b98a',
    hair: '#2c2c34',
    armed: true,
  };
}

export function playerPos(state) {
  const p = state.player;
  return p.car ? { x: p.car.x, y: p.car.y } : { x: p.x, y: p.y };
}

export function updatePlayer(state, dt) {
  const p = state.player;
  if (p.dead) {
    p.deadTimer -= dt;
    return;
  }
  p.cooldown -= dt;
  if (p.reloadTimer > 0) {
    p.reloadTimer -= dt;
    if (p.reloadTimer <= 0) finishReload(p);
  }

  if (p.car) {
    updateDriving(state, dt);
    return;
  }
  updateOnFoot(state, dt);
}

function updateOnFoot(state, dt) {
  const p = state.player;
  const mv = Input.moveVector();
  const sprint = Input.isDown('ShiftLeft') || Input.isDown('ShiftRight');
  const speed = sprint ? TUNING.playerRun : TUNING.playerWalk;
  p.moving = mv.x !== 0 || mv.y !== 0;
  if (p.moving) {
    const circle = { x: p.x + mv.x * speed * dt, y: p.y + mv.y * speed * dt, radius: p.radius };
    collideCircle(state.city, circle);
    p.x = circle.x; p.y = circle.y;
    p.phase += dt * (sprint ? 13 : 9);
  }
  // Face the mouse.
  const world = state.camera.screenToWorld(Input.mouseX, Input.mouseY);
  p.angle = angleTo(p.x, p.y, world.x, world.y);

  // Weapons.
  if (Input.wasPressed('Digit1') && p.unlocked.pistol) switchWeapon(state, 'pistol');
  if (Input.wasPressed('Digit2') && p.unlocked.smg) switchWeapon(state, 'smg');
  if (Input.wasPressed('Digit3') && p.unlocked.shotgun) switchWeapon(state, 'shotgun');
  if (Input.wasPressed('KeyR')) startReload(p);

  const w = WEAPONS[p.weapon];
  const wantFire = w.auto ? Input.mouseDown : Input.mousePressed;
  if (wantFire && p.cooldown <= 0 && p.reloadTimer <= 0) {
    fireWeapon(state);
  }

  // Enter the nearest car.
  if (Input.wasPressed('KeyF')) tryEnterCar(state);
}

function updateDriving(state, dt) {
  const p = state.player;
  const car = p.car;
  const throttle = (Input.isDown('KeyW') || Input.isDown('ArrowUp') ? 1 : 0)
    - (Input.isDown('KeyS') || Input.isDown('ArrowDown') ? 1 : 0);
  const steer = (Input.isDown('KeyA') || Input.isDown('ArrowLeft') ? -1 : 0)
    + (Input.isDown('KeyD') || Input.isDown('ArrowRight') ? 1 : 0);
  const handbrake = Input.isDown('Space');
  driveCar(car, { throttle, steer, handbrake }, dt, state.city, state);
  p.x = car.x; p.y = car.y;
  p.angle = car.angle;
  p.moving = Math.abs(car.speed) > 10;
  AudioSys.setEngine(true, Math.min(1, Math.abs(car.speed) / car.def.topSpeed));

  // Horn.
  if (Input.wasPressed('KeyH')) AudioSys.horn();
  // Exit the car.
  if (Input.wasPressed('KeyF')) exitCar(state, false);
}

function switchWeapon(state, id) {
  const p = state.player;
  if (p.weapon === id) return;
  p.weapon = id;
  p.cooldown = Math.max(p.cooldown, 0.18);
  p.reloadTimer = 0;
  AudioSys.click();
  state.hud.message(WEAPONS[id].name, '#ffffff');
}

function startReload(p) {
  const w = WEAPONS[p.weapon];
  const slot = p.weapons[p.weapon];
  if (slot.ammo >= w.mag || slot.reserve <= 0 || p.reloadTimer > 0) return;
  p.reloadTimer = w.reload;
  AudioSys.reload();
}

function finishReload(p) {
  const w = WEAPONS[p.weapon];
  const slot = p.weapons[p.weapon];
  const need = w.mag - slot.ammo;
  const take = Math.min(need, slot.reserve);
  slot.ammo += take;
  slot.reserve -= take;
}

function fireWeapon(state) {
  const p = state.player;
  const w = WEAPONS[p.weapon];
  const slot = p.weapons[p.weapon];
  if (slot.ammo <= 0) {
    AudioSys.click();
    if (slot.reserve > 0) startReload(p);
    else state.hud.message('No ammo — find an ammo pickup', '#ff8a7a');
    p.cooldown = 0.25;
    return;
  }
  slot.ammo--;
  p.cooldown = w.rate;
  const gx = p.x + Math.cos(p.angle) * 20;
  const gy = p.y + Math.sin(p.angle) * 20;
  for (let i = 0; i < w.pellets; i++) {
    spawnBullet(state, gx, gy, p.angle + (Math.random() - 0.5) * 2 * w.spread, w, 'player');
  }
  Effects.muzzle(gx, gy, p.angle);
  AudioSys.shoot(w.sound);
  state.combat.noiseAt(state, gx, gy, 420);
}

function tryEnterCar(state) {
  const p = state.player;
  let best = null, bestD = 70;
  for (const car of state.cars) {
    if (car.dead || car.def.police) continue;
    const d = dist(p.x, p.y, car.x, car.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  if (!best) return;
  const wasParked = best.driver === 'parked';
  const wasTraffic = best.driver === 'traffic';
  if (wasTraffic) {
    // The driver bails out and runs.
    const ped = makePed(best.x + 26, best.y);
    ped.state = 'flee';
    ped.fleeTimer = 5;
    ped.fleeFrom = { x: p.x, y: p.y };
    state.peds.push(ped);
  }
  best.driver = 'player';
  p.car = best;
  p.x = best.x; p.y = best.y;
  AudioSys.doorSlam();
  state.stats.carsStolen++;
  if (!wasParked || state.police.nearbyPolice(state, 320)) {
    state.police.addHeat(state, 1, 'Car stolen!');
  } else {
    state.hud.message(best.def.name + ' — yours now', '#ffd76a');
  }
  state.missions.onEnterCar(state, best);
}

export function exitCar(state, thrownOut) {
  const p = state.player;
  const car = p.car;
  if (!car) return;
  p.car = null;
  car.driver = 'parked';
  car.speed = 0;
  const side = p.angle + Math.PI / 2;
  p.x = car.x + Math.cos(side) * 34;
  p.y = car.y + Math.sin(side) * 34;
  const circle = { x: p.x, y: p.y, radius: p.radius };
  collideCircle(state.city, circle);
  p.x = circle.x; p.y = circle.y;
  AudioSys.setEngine(false, 0);
  if (!thrownOut) AudioSys.doorSlam();
  state.missions.onExitCar(state, car);
}

export function damagePlayer(state, amount, fromX, fromY) {
  const p = state.player;
  if (p.dead || state.godMode) return;
  let rest = amount;
  if (p.armor > 0) {
    const absorbed = Math.min(p.armor, rest * 0.6);
    p.armor -= absorbed;
    rest -= absorbed;
  }
  p.health -= rest;
  Effects.addFlash(0.25);
  Effects.addShake(4);
  if (p.health <= 0) {
    p.health = 0;
    p.dead = true;
    p.deadTimer = 2.4;
    if (p.car) exitCar(state, true);
    AudioSys.busted();
    state.onWasted(state);
  }
}

export function healPlayer(p, amount) {
  p.health = Math.min(p.maxHealth, p.health + amount);
}

export function giveAmmo(p, id, amount) {
  p.unlocked[id] = true;
  p.weapons[id].reserve += amount;
  if (p.weapons[id].ammo === 0) {
    const w = WEAPONS[id];
    const take = Math.min(w.mag, p.weapons[id].reserve);
    p.weapons[id].ammo = take;
    p.weapons[id].reserve -= take;
  }
}
