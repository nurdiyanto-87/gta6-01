// San Cielo Heat — pickups: health kits, armour, ammo and cash scattered
// around the city, plus the mission briefcase.

import { dist, makeRng } from './util.js';
import { randomRoadPoint, randomSidewalkPoint } from './city.js';

export function pickupKindInfo(kind) {
  if (kind === 'health') return { label: '+25 Health', color: '#e84c3d', radius: 13 };
  if (kind === 'armor') return { label: '+25 Armour', color: '#4b8ad9', radius: 13 };
  if (kind === 'ammo') return { label: '+Ammo', color: '#e0a83c', radius: 11 };
  if (kind === 'cash') return { label: '+$50', color: '#5da56a', radius: 11 };
  if (kind === 'briefcase') return { label: 'Briefcase', color: '#8a5fb0', radius: 14 };
  return { label: '?', color: '#ffffff', radius: 11 };
}

export class PickupSystem {
  constructor() {
    this.items = [];
    this.rng = makeRng(555444333);
    this.respawnTimer = 0;
  }

  spawnInitial() {
    for (let i = 0; i < 10; i++) this.spawn('health');
    for (let i = 0; i < 6; i++) this.spawn('armor');
    for (let i = 0; i < 12; i++) this.spawn('ammo');
    for (let i = 0; i < 8; i++) this.spawn('cash');
  }

  spawn(kind, x, y, city) {
    let point;
    if (x !== undefined) point = { x, y };
    else if (city) point = randomSidewalkPoint(city, this.rng);
    else return null;
    const item = { kind, x: point.x, y: point.y, bob: this.rng.range(0, Math.PI * 2), life: kind === 'briefcase' ? Infinity : 0 };
    this.items.push(item);
    return item;
  }

  dropAmmo(x, y) {
    if (this.rng.chance(0.6)) this.spawn('ammo', x + this.rng.range(-14, 14), y + this.rng.range(-14, 14));
  }

  spawnBriefcase(x, y) {
    this.items = this.items.filter((item) => item.kind !== 'briefcase');
    return this.spawn('briefcase', x, y);
  }

  update(dt, game) {
    const player = game.player;
    const px = player.inCar ? player.inCar.x : player.x;
    const py = player.inCar ? player.inCar.y : player.y;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      item.bob += dt * 3;
      const d = dist(item.x, item.y, px, py);
      const reach = player.inCar ? 44 : 30;
      if (d > reach) continue;
      const info = pickupKindInfo(item.kind);
      let taken = false;
      if (item.kind === 'health' && player.health < 100) { player.heal(25); taken = true; }
      else if (item.kind === 'armor' && player.armor < 100) { player.addArmor(25); taken = true; }
      else if (item.kind === 'ammo') {
        player.ammo.pistol += 24;
        player.ammo.smg += 60;
        taken = true;
      } else if (item.kind === 'cash') { player.addMoney(50); taken = true; }
      else if (item.kind === 'briefcase') {
        taken = true;
        if (game.onBriefcase) game.onBriefcase(item);
      }
      if (taken) {
        this.items.splice(i, 1);
        if (game.effects) game.effects.floatText(item.x, item.y - 20, info.label, info.color);
        if (game.audio) game.audio.pickup();
      }
    }
    this.respawnTimer -= dt;
    if (this.respawnTimer <= 0) {
      this.respawnTimer = 6;
      const kinds = ['health', 'armor', 'ammo', 'cash'];
      const counts = {};
      for (const item of this.items) counts[item.kind] = (counts[item.kind] || 0) + 1;
      for (const kind of kinds) {
        const want = kind === 'ammo' ? 12 : kind === 'health' ? 10 : kind === 'cash' ? 8 : 6;
        if ((counts[kind] || 0) < want && game.city) this.spawn(kind, undefined, undefined, game.city);
      }
    }
  }

  draw(ctx, time) {
    for (const item of this.items) {
      const info = pickupKindInfo(item.kind);
      const bobY = Math.sin(item.bob) * 3;
      ctx.save();
      ctx.translate(item.x, item.y + bobY);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath();
      ctx.ellipse(0, 10 - bobY, 11, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = info.color;
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 2;
      if (item.kind === 'health') {
        ctx.fillRect(-8, -8, 16, 16);
        ctx.strokeRect(-8, -8, 16, 16);
        ctx.fillStyle = '#fff';
        ctx.fillRect(-2, -6, 4, 12);
        ctx.fillRect(-6, -2, 12, 4);
      } else if (item.kind === 'armor') {
        ctx.beginPath();
        ctx.moveTo(0, -10);
        ctx.lineTo(9, -5);
        ctx.lineTo(7, 7);
        ctx.lineTo(0, 11);
        ctx.lineTo(-7, 7);
        ctx.lineTo(-9, -5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (item.kind === 'briefcase') {
        ctx.fillRect(-11, -7, 22, 14);
        ctx.strokeRect(-11, -7, 22, 14);
        ctx.fillStyle = '#ffd94d';
        ctx.fillRect(-4, -10, 8, 4);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px Verdana, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(item.kind === 'cash' ? '$' : 'A', 0, 4);
      }
      ctx.restore();
    }
  }
}
