// San Cielo Heat — Mara Vega: on-foot movement, entering and leaving cars,
// health and armour, weapons, money and the wanted level.

import { TUNING } from './config.js';
import { clamp } from './util.js';

export const WEAPONS = {
  fists: { name: 'Fists', damage: 12, rate: 0.32, range: 34, ammo: Infinity, auto: false, spread: 0, kick: 0 },
  pistol: { name: 'Pistol', damage: 22, rate: 0.26, range: 460, ammo: 60, auto: false, spread: 0.03, kick: 1.5 },
  smg: { name: 'SMG', damage: 11, rate: 0.085, range: 400, ammo: 180, auto: true, spread: 0.09, kick: 0.8 },
};

const WEAPON_ORDER = ['fists', 'pistol', 'smg'];

export class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.angle = -Math.PI / 2;
    this.radius = TUNING.playerRadius;
    this.health = TUNING.startHealth;
    this.armor = 0;
    this.money = TUNING.startMoney;
    this.wanted = 0;
    this.inCar = null;
    this.weapon = 'fists';
    this.ammo = { pistol: 60, smg: 120 };
    this.cooldown = 0;
    this.walkPhase = 0;
    this.moving = false;
    this.running = false;
    this.aiming = false;
    this.hurtTimer = 0;
    this.look = { shirt: '#c95f4b', pants: '#3a4a6b', skin: '#e8b98d', hat: null };
    this.kills = 0;
    this.carsStolen = 0;
    this.missionsDone = 0;
    this.courierDone = 0;
    this.playTime = 0;
  }

  get speed() {
    return this.inCar ? Math.abs(this.inCar.speed) : 0;
  }

  get weaponDef() {
    return WEAPONS[this.weapon];
  }

  cycleWeapon(dir) {
    const idx = WEAPON_ORDER.indexOf(this.weapon);
    this.weapon = WEAPON_ORDER[(idx + dir + WEAPON_ORDER.length) % WEAPON_ORDER.length];
  }

  selectWeapon(key) {
    if (WEAPONS[key]) this.weapon = key;
  }

  canFire() {
    if (this.cooldown > 0) return false;
    if (this.weapon === 'fists') return true;
    return (this.ammo[this.weapon] || 0) > 0;
  }

  spendAmmo() {
    if (this.weapon !== 'fists') {
      this.ammo[this.weapon] = Math.max(0, (this.ammo[this.weapon] || 0) - 1);
    }
    this.cooldown = this.weaponDef.rate;
  }

  addWanted(stars) {
    const before = this.wanted;
    this.wanted = clamp(this.wanted + stars, 0, TUNING.maxWanted);
    return this.wanted > before;
  }

  clearWanted() {
    this.wanted = 0;
  }

  takeDamage(amount, audio) {
    let rest = amount;
    if (this.armor > 0) {
      const absorbed = Math.min(this.armor, rest * 0.6);
      this.armor -= absorbed;
      rest -= absorbed;
    }
    this.health = Math.max(0, this.health - rest);
    this.hurtTimer = 0.35;
    if (audio) audio.hurt();
    return this.health <= 0;
  }

  heal(amount) {
    this.health = clamp(this.health + amount, 0, TUNING.maxHealth);
  }

  addArmor(amount) {
    this.armor = clamp(this.armor + amount, 0, TUNING.maxArmor);
  }

  addMoney(amount) {
    this.money += amount;
    return this.money;
  }

  updateTimers(dt) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.hurtTimer = Math.max(0, this.hurtTimer - dt);
    this.playTime += dt;
  }
}
