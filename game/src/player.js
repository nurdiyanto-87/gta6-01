// San Cielo Heat — Mara Vega, the player: on foot and behind the wheel,
// her health, armour, wallet and weapons, and the steal-a-car dance.

import { TUNING } from './config.js';
import { collideCircle } from './city.js';
import { angleTo, clamp } from './util.js';
import { carSpeed, driveCar } from './vehicles.js';

export const WEAPONS = {
  fists: { name: 'Fists', damage: 14, rate: 0.38, range: 42, ammo: Infinity, auto: false, spread: 0, kick: 0 },
  pistol: { name: 'Pistol', damage: 26, rate: 0.26, range: 620, ammo: 0, auto: false, spread: 0.02, kick: 1.2 },
  smg: { name: 'SMG', damage: 13, rate: 0.09, range: 520, ammo: 0, auto: true, spread: 0.09, kick: 0.5 },
};

export class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.angle = -Math.PI / 2; // aim direction on foot
    this.walkPhase = 0;
    this.moving = false;
    this.running = false;
    this.inCar = null; // the vehicle Mara drives, or null
    this.health = TUNING.startHealth;
    this.armor = 0;
    this.money = TUNING.startMoney;
    this.weapons = {
      fists: { owned: true, ammo: Infinity },
      pistol: { owned: true, ammo: 36 },
      smg: { owned: false, ammo: 0 },
    };
    this.weapon = 'pistol';
    this.fireTimer = 0;
    this.hurtTimer = 0;
    this.dead = false;
    this.look = { shirt: '#e87a3c', pants: '#2b3a4a', skin: '#e0ac82', hair: '#2b2b30' };
    this.enterCooldown = 0;
  }

  get speed() {
    return this.inCar ? carSpeed(this.inCar) : 0;
  }

  get currentWeaponDef() {
    return WEAPONS[this.weapon];
  }

  get ammo() {
    return this.weapons[this.weapon].ammo;
  }

  giveWeapon(id, ammo) {
    this.weapons[id].owned = true;
    if (this.weapons[id].ammo !== Infinity) this.weapons[id].ammo += ammo;
  }

  giveAmmo(id, ammo) {
    if (!this.weapons[id].owned) this.weapons[id].owned = true;
    if (this.weapons[id].ammo !== Infinity) this.weapons[id].ammo += ammo;
  }

  heal(amount) {
    this.health = Math.min(TUNING.maxHealth, this.health + amount);
  }

  giveArmor(amount) {
    this.armor = Math.min(TUNING.maxArmor, this.armor + amount);
  }

  damage(game, amount) {
    if (this.dead) return;
    let rest = amount;
    if (this.armor > 0) {
      const absorbed = Math.min(this.armor, rest * 0.6);
      this.armor -= absorbed;
      rest -= absorbed;
    }
    this.health -= rest;
    this.hurtTimer = 0.4;
    game.effects.screenFlash('200,30,20', 0.35);
    game.effects.blood(this.x, this.y);
    game.audio.hurt();
    if (this.health <= 0) {
      this.health = 0;
      this.dead = true;
    }
  }

  // Step on foot. Returns nothing; entering a car is handled by tryEnterCar.
  updateOnFoot(dt, input, game) {
    const mv = input.moveVector();
    this.moving = mv.x !== 0 || mv.y !== 0;
    this.running = this.moving && (input.down('ShiftLeft') || input.down('ShiftRight'));
    const sp = this.running ? TUNING.runSpeed : TUNING.walkSpeed;
    if (this.moving) {
      this.x += mv.x * sp * dt;
      this.y += mv.y * sp * dt;
      this.walkPhase += dt * (this.running ? 12 : 8);
    }
    const probe = { x: this.x, y: this.y, radius: TUNING.playerRadius };
    collideCircle(game.city, probe);
    this.x = probe.x;
    this.y = probe.y;
    // Face the mouse.
    const world = game.camera.screenToWorld(input.mouse.x, input.mouse.y);
    this.angle = angleTo(this.x, this.y, world.x, world.y);
    if (this.enterCooldown > 0) this.enterCooldown -= dt;
    if (this.fireTimer > 0) this.fireTimer -= dt;
    if (this.hurtTimer > 0) this.hurtTimer -= dt;
  }

  updateInCar(dt, input, game) {
    const car = this.inCar;
    const throttle = input.axis('KeyS', 'KeyW') + input.axis('ArrowDown', 'ArrowUp');
    const steer = input.axis('KeyA', 'KeyD') + input.axis('ArrowLeft', 'ArrowRight');
    const handbrake = input.down('Space');
    driveCar(game, car, {
      throttle: clamp(throttle, -1, 1),
      steer: clamp(steer, -1, 1),
      handbrake,
    }, dt);
    this.x = car.x;
    this.y = car.y;
    this.angle = car.angle;
    game.camera.setLeadAngle(car.angle);
    if (this.enterCooldown > 0) this.enterCooldown -= dt;
    if (this.hurtTimer > 0) this.hurtTimer -= dt;
    // Bailing from a wreck.
    if (car.wrecked && input.wasPressed('KeyE')) this.exitCar(game);
  }

  tryEnterCar(game) {
    if (this.enterCooldown > 0 || this.inCar) return;
    const car = game.traffic.nearestStealable(this.x, this.y, 70)
      || game.police.nearestAbandonedCruiser(this.x, this.y, 70);
    if (!car) return;
    const wasTraffic = game.traffic.cars.includes(car);
    const wasParked = game.traffic.parked.includes(car);
    if (wasTraffic) {
      game.traffic.removeTrafficCar(car);
      // The driver bails and runs.
      const ped = game.peds.spawnPed(car.x + 24, car.y + 10);
      ped.state = 'flee';
      ped.fleeTimer = 5;
      game.police.addWanted(1, 'Car jacked!');
    } else if (wasParked) {
      game.traffic.removeParkedCar(car);
      if (game.police.nearestCopDistance(this.x, this.y) < 420) {
        game.police.addWanted(1, 'Spotted stealing a car!');
      } else {
        game.addMessage('Car taken. Nobody saw a thing.');
      }
    } else {
      game.police.claimCruiser(car);
      game.police.addWanted(1, 'Stole a police cruiser!');
    }
    car.driver = 'player';
    this.inCar = car;
    this.enterCooldown = 0.4;
    game.audio.doorSlam();
    game.missions.onEnterCar(car);
  }

  exitCar(game) {
    if (!this.inCar || this.enterCooldown > 0) return;
    const car = this.inCar;
    const side = { x: car.x + Math.cos(car.angle + Math.PI / 2) * 30, y: car.y + Math.sin(car.angle + Math.PI / 2) * 30 };
    const probe = { x: side.x, y: side.y, radius: TUNING.playerRadius };
    collideCircle(game.city, probe);
    this.x = probe.x;
    this.y = probe.y;
    car.driver = null;
    car.speed = 0;
    car.vx = 0;
    car.vy = 0;
    this.inCar = null;
    this.enterCooldown = 0.4;
    game.audio.doorSlam();
    game.traffic.parked.push(car);
  }

  // Fire the current weapon toward the aim point. Melee is instant.
  tryFire(game, worldX, worldY) {
    if (this.inCar || this.dead || this.fireTimer > 0) return;
    const def = this.currentWeaponDef;
    const slot = this.weapons[this.weapon];
    if (slot.ammo <= 0) {
      game.audio.tone(140, 0.06, 'square', 0.06);
      this.fireTimer = 0.25;
      return;
    }
    this.fireTimer = def.rate;
    if (this.weapon === 'fists') {
      game.combat.meleeHit(game, this.x, this.y, this.angle, def);
      return;
    }
    slot.ammo -= 1;
    const spread = (Math.random() - 0.5) * 2 * def.spread;
    game.combat.fireBullet(game, this.x, this.y, this.angle + spread, def, 'player');
    game.police.noiseAt(this.x, this.y);
  }

  respawn(game, x, y) {
    this.x = x;
    this.y = y;
    this.health = TUNING.startHealth;
    this.armor = 0;
    this.dead = false;
    this.inCar = null;
    this.hurtTimer = 0;
    game.camera.snapTo(x, y);
  }
}
