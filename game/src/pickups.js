// San Cielo Heat — pickups: health kits, armour vests, ammo, cash and
// the odd SMG crate, scattered where a driver in trouble looks for them.

import { PLACES } from './config.js';
import { dist } from './util.js';

const KINDS = {
  health: { label: 'Health +40', color: '#4ecb5a', icon: '+' },
  armor: { label: 'Armour +50', color: '#4b8ad9', icon: 'A' },
  ammo_pistol: { label: 'Pistol ammo +24', color: '#e0a83c', icon: 'P' },
  ammo_smg: { label: 'SMG ammo +60', color: '#e0a83c', icon: 'S' },
  weapon_smg: { label: 'SMG acquired!', color: '#e87a3c', icon: 'W' },
  cash: { label: 'Cash', color: '#7ddb6a', icon: '$' },
  briefcase: { label: 'Briefcase', color: '#c9a24b', icon: 'B' },
};

export class PickupSystem {
  constructor() {
    this.pickups = [];
  }

  spawnInitial() {
    const spots = [
      { x: PLACES.hospital.x + 60, y: PLACES.hospital.y, kind: 'health' },
      { x: PLACES.hospital.x - 60, y: PLACES.hospital.y + 40, kind: 'health' },
      { x: PLACES.policeHQ.x + 70, y: PLACES.policeHQ.y, kind: 'armor' },
      { x: PLACES.garage.x + 60, y: PLACES.garage.y + 30, kind: 'ammo_pistol' },
      { x: PLACES.depot.x - 60, y: PLACES.depot.y, kind: 'weapon_smg' },
      { x: PLACES.bazaar.x, y: PLACES.bazaar.y + 80, kind: 'ammo_smg' },
      { x: PLACES.arena.x + 90, y: PLACES.arena.y, kind: 'health' },
      { x: PLACES.marina.x - 80, y: PLACES.marina.y - 120, kind: 'armor' },
      { x: 580, y: 2580, kind: 'ammo_pistol' },
      { x: 2580, y: 2580, kind: 'cash', amount: 60 },
      { x: 980, y: 1780, kind: 'health' },
      { x: 2180, y: 980, kind: 'ammo_smg' },
    ];
    for (const s of spots) this.add(s.x, s.y, s.kind, s.amount || 0, true);
  }

  add(x, y, kind, amount, respawns) {
    const p = {
      x, y, kind,
      amount: amount || 0,
      respawns: !!respawns,
      active: true,
      respawnTimer: 0,
      bob: Math.random() * Math.PI * 2,
    };
    this.pickups.push(p);
    return p;
  }

  dropCash(x, y, amount) {
    if (amount > 0) this.add(x, y, 'cash', amount, false);
  }

  dropBriefcase(x, y) {
    return this.add(x, y, 'briefcase', 0, false);
  }

  update(dt, game) {
    const player = game.player;
    for (const p of this.pickups) {
      p.bob += dt * 3;
      if (!p.active) {
        if (p.respawns) {
          p.respawnTimer -= dt;
          if (p.respawnTimer <= 0) p.active = true;
        }
        continue;
      }
      if (player.dead) continue;
      const d = dist(p.x, p.y, player.x, player.y);
      const reach = player.inCar ? 34 : 30;
      if (d < reach) this.collect(game, p);
    }
    // Sweep spent one-shot pickups.
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      if (!p.active && !p.respawns) this.pickups.splice(i, 1);
    }
  }

  collect(game, p) {
    const player = game.player;
    const kind = KINDS[p.kind];
    let ok = true;
    if (p.kind === 'health') {
      if (player.health >= 100) ok = false;
      else player.heal(40);
    } else if (p.kind === 'armor') {
      if (player.armor >= 100) ok = false;
      else player.giveArmor(50);
    } else if (p.kind === 'ammo_pistol') {
      player.giveAmmo('pistol', 24);
    } else if (p.kind === 'ammo_smg') {
      player.giveAmmo('smg', 60);
    } else if (p.kind === 'weapon_smg') {
      player.giveWeapon('smg', 90);
      player.weapon = 'smg';
    } else if (p.kind === 'cash') {
      const amount = p.amount || 25;
      player.money += amount;
      game.effects.floater(p.x, p.y - 20, '+$' + amount, '#7ddb6a');
      game.audio.cash();
    } else if (p.kind === 'briefcase') {
      game.missions.onBriefcaseTaken(p);
    }
    if (!ok) return;
    p.active = false;
    p.respawnTimer = 22;
    if (p.kind !== 'cash') {
      game.addMessage(kind.label);
      game.audio.pickup();
    }
    game.effects.burst(p.x, p.y, 10, { speed: 70, life: 0.4, size: 3, color: kind.color });
  }

  reset() {
    this.pickups = [];
    this.spawnInitial();
  }
}

export function pickupKindInfo(kind) {
  return KINDS[kind];
}
