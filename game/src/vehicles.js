// San Cielo Heat — vehicle types, the arcade driving model, and the
// car-versus-car collision pass.

import { TUNING } from './config.js';
import { clamp, dist } from './util.js';

// Nine original vehicle types. len/wid are pixels; topSpeed in px/s.
export const VEHICLE_TYPES = {
  sedan: { name: 'Cielo Sedan', len: 52, wid: 26, topSpeed: 330, accel: 1.0, grip: 1.0, kind: 'car', roof: 0.42 },
  coupe: { name: 'Vento Coupe', len: 50, wid: 25, topSpeed: 390, accel: 1.2, grip: 1.1, kind: 'car', roof: 0.4 },
  muscle: { name: 'Bravado Muscle', len: 54, wid: 27, topSpeed: 360, accel: 1.25, grip: 0.9, kind: 'car', roof: 0.38 },
  taxi: { name: 'Sun Cab', len: 52, wid: 26, topSpeed: 330, accel: 1.0, grip: 1.0, kind: 'taxi', roof: 0.42 },
  van: { name: 'Marlin Van', len: 58, wid: 28, topSpeed: 280, accel: 0.8, grip: 0.85, kind: 'van', roof: 0.3 },
  truck: { name: 'Harbor Hauler', len: 72, wid: 30, topSpeed: 250, accel: 0.7, grip: 0.8, kind: 'truck', roof: 0.22 },
  pickup: { name: 'Rancho Pickup', len: 56, wid: 27, topSpeed: 320, accel: 1.05, grip: 0.95, kind: 'car', roof: 0.34 },
  compact: { name: 'Pip Compact', len: 44, wid: 23, topSpeed: 300, accel: 0.95, grip: 1.15, kind: 'car', roof: 0.46 },
  police: { name: 'SCPD Cruiser', len: 54, wid: 27, topSpeed: 400, accel: 1.3, grip: 1.1, kind: 'police', roof: 0.42 },
};

export const CAR_COLORS = [
  '#c94f43', '#4b8ad9', '#e0a83c', '#5da56a', '#e8e4da', '#3c3c44',
  '#8a5fb0', '#d97b2b', '#6fb7b0', '#b0b8c4', '#7a4a3a', '#2e6b4f',
];

let nextCarId = 1;

export function makeVehicle(typeKey, x, y, angle, color) {
  const def = VEHICLE_TYPES[typeKey];
  return {
    id: nextCarId++,
    type: typeKey,
    def,
    x, y, angle,
    speed: 0,
    color: color || CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)],
    damage: 0,
    driver: null, // 'player' | 'traffic' | 'police' | null (parked)
    dead: false,
    smokeTimer: 0,
  };
}

// Arcade driving: accelerate along the heading, steer harder at low speed,
// drift a little with the handbrake. Returns the distance travelled.
export function driveCar(car, throttle, steer, handbrake, dt) {
  const def = car.def;
  if (throttle > 0) {
    car.speed += TUNING.carAccel * def.accel * throttle * dt;
  } else if (throttle < 0) {
    if (car.speed > 20) car.speed -= TUNING.carBrake * dt;
    else car.speed = Math.max(-TUNING.carReverseMax, car.speed + TUNING.carAccel * 0.6 * throttle * dt);
  }
  // Drag and rolling resistance.
  const drag = TUNING.carDrag * (handbrake ? 2.4 : 1);
  car.speed -= car.speed * drag * dt;
  if (Math.abs(car.speed) < 4 && throttle === 0) car.speed = 0;
  car.speed = clamp(car.speed, -TUNING.carReverseMax, def.topSpeed);

  const speedFrac = Math.min(1, Math.abs(car.speed) / 220);
  const steerRate = TUNING.carSteer * def.grip * (1.25 - speedFrac * 0.55) * (handbrake ? 1.5 : 1);
  const dir = car.speed >= 0 ? 1 : -1;
  car.angle += steer * steerRate * speedFrac * dir * dt;

  const moved = car.speed * dt;
  car.x += Math.cos(car.angle) * moved;
  car.y += Math.sin(car.angle) * moved;
  return Math.abs(moved);
}

// Push overlapping cars apart and trade some speed; returns impact strength.
export function resolveCarCollisions(cars, effects, audio) {
  let worst = 0;
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i];
      const b = cars[j];
      if (a.dead || b.dead) continue;
      const minD = (a.def.len + b.def.len) / 2 * 0.62;
      const d = dist(a.x, a.y, b.x, b.y);
      if (d >= minD || d < 0.01) continue;
      const nx = (b.x - a.x) / d;
      const ny = (b.y - a.y) / d;
      const push = (minD - d) / 2;
      a.x -= nx * push;
      a.y -= ny * push;
      b.x += nx * push;
      b.y += ny * push;
      const impact = Math.abs(a.speed - b.speed);
      if (impact > 60) {
        const exchange = (a.speed + b.speed) / 2;
        a.speed = exchange * 0.6;
        b.speed = exchange * 0.6;
        a.damage = clamp(a.damage + impact / 900, 0, 1);
        b.damage = clamp(b.damage + impact / 900, 0, 1);
        if (effects) effects.sparks((a.x + b.x) / 2, (a.y + b.y) / 2);
        if (audio) audio.crash(impact / 400);
        worst = Math.max(worst, impact);
      } else {
        const tmp = a.speed;
        a.speed = b.speed * 0.5;
        b.speed = tmp * 0.5;
      }
    }
  }
  return worst;
}

export function carCorners(car) {
  const hl = car.def.len / 2;
  const hw = car.def.wid / 2;
  const cos = Math.cos(car.angle);
  const sin = Math.sin(car.angle);
  return [
    { x: car.x + hl * cos - hw * sin, y: car.y + hl * sin + hw * cos },
    { x: car.x + hl * cos + hw * sin, y: car.y + hl * sin - hw * cos },
    { x: car.x - hl * cos - hw * sin, y: car.y - hl * sin + hw * cos },
    { x: car.x - hl * cos + hw * sin, y: car.y - hl * sin - hw * cos },
  ];
}
