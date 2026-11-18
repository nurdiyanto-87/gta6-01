// Solmar Heat — vehicles: definitions and arcade driving physics.
// Every car in the city, from a rusty pickup to a police interceptor, is one
// of these definitions plus a physics state. The player drives with the same
// model the traffic uses, so chases feel fair.

import { TUNING, clamp, rand, choice } from './config.js';
import { collideCircle } from './city.js';
import { Effects } from './effects.js';
import { AudioSys } from './audio.js';

export const CAR_DEFS = {
  sedan: { name: 'Solmar Sedan', length: 46, width: 22, topSpeed: 300, accel: 300, turn: 2.6, seats: 4, price: 0 },
  coupe: { name: 'Vela Coupe', length: 44, width: 21, topSpeed: 340, accel: 350, turn: 2.9, seats: 2, price: 0 },
  pickup: { name: 'Rancho Pickup', length: 50, width: 23, topSpeed: 270, accel: 260, turn: 2.3, seats: 3, price: 0 },
  van: { name: 'Cargo Van', length: 52, width: 24, topSpeed: 250, accel: 230, turn: 2.1, seats: 3, price: 0 },
  taxi: { name: 'Solmar Taxi', length: 46, width: 22, topSpeed: 300, accel: 300, turn: 2.6, seats: 4, price: 0 },
  sports: { name: 'Falcon GT', length: 45, width: 21, topSpeed: 430, accel: 430, turn: 3.3, seats: 2, price: 0 },
  muscle: { name: 'Bravo Muscle', length: 48, width: 23, topSpeed: 370, accel: 390, turn: 2.7, seats: 2, price: 0 },
  police: { name: 'Interceptor', length: 47, width: 22, topSpeed: 400, accel: 400, turn: 3.1, seats: 4, police: true, price: 0 },
  beater: { name: 'Rusty Beater', length: 44, width: 21, topSpeed: 230, accel: 210, turn: 2.2, seats: 4, price: 0 },
};

export const CAR_COLORS = [
  '#c8452c', '#2c6ec8', '#e8c53d', '#3fae6a', '#e8e8e8', '#3a3a42',
  '#8a4fb8', '#e87f3d', '#4fb8c8', '#b8c83d', '#d8d8d8', '#7a4a2c',
];

export function makeCar(defId, x, y, angle, opts) {
  const def = CAR_DEFS[defId];
  return {
    defId, def, x, y, angle: angle || 0,
    speed: 0, steer: 0,
    color: (opts && opts.color) || choice(CAR_COLORS),
    health: 100, maxHealth: 100,
    driver: (opts && opts.driver) || 'parked', // parked | traffic | player | police | none
    id: Math.floor(Math.random() * 1e9),
    smokeTimer: 0,
    dead: false,
    locked: false,
    siren: def.police || false,
    waypoint: null,
    cruiseSpeed: 0,
    brakeLight: false,
    honkTimer: 0,
  };
}

// Arcade car physics: accelerate along the heading, steer harder at low
// speed, slide with the handbrake. Collisions use two circles (nose/tail).
export function driveCar(car, input, dt, city, state) {
  const def = car.def;
  const forward = input.throttle; // -1..1
  const steering = input.steer; // -1..1
  const handbrake = input.handbrake;

  if (forward > 0) car.speed += def.accel * forward * dt;
  else if (forward < 0) {
    if (car.speed > 20) car.speed -= TUNING.carBrake * dt; // braking
    else car.speed += def.accel * 0.55 * forward * dt; // reverse
  }
  // Drag and rolling resistance.
  car.speed -= car.speed * TUNING.carDrag * dt;
  if (Math.abs(car.speed) < 4 && forward === 0) car.speed = 0;
  car.speed = clamp(car.speed, -TUNING.carReverseMax, def.topSpeed);

  // Steering: sharper when slow, looser at speed; handbrake loosens the rear.
  const speedNorm = Math.min(1, Math.abs(car.speed) / def.topSpeed);
  const steerAuthority = def.turn * (1 - speedNorm * 0.55) * (handbrake ? 1.5 : 1);
  car.steer += (steering - car.steer) * Math.min(1, dt * 8);
  const dir = car.speed >= 0 ? 1 : -1;
  car.angle += car.steer * steerAuthority * (Math.abs(car.speed) / 160) * dt * dir;

  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;

  // Two collision circles: nose and tail.
  const half = def.length / 2 - 8;
  const nose = { x: nx + Math.cos(car.angle) * half, y: ny + Math.sin(car.angle) * half, radius: def.width / 2 };
  const tail = { x: nx - Math.cos(car.angle) * half, y: ny - Math.sin(car.angle) * half, radius: def.width / 2 };
  const hitNose = collideCircle(city, nose);
  const hitTail = collideCircle(city, tail);
  if (hitNose || hitTail) {
    const impact = Math.abs(car.speed);
    if (impact > 90) {
      const dmg = (impact - 90) / 22;
      damageCar(car, dmg, state);
      Effects.sparks(car.x + Math.cos(car.angle) * half, car.y + Math.sin(car.angle) * half);
      Effects.addShake(Math.min(8, impact / 60));
      if (state && state.player && state.player.car === car) AudioSys.crash(impact / 400);
    }
    // Recompute the centre from the pushed circles and kill some speed.
    car.x = (nose.x + tail.x) / 2;
    car.y = (nose.y + tail.y) / 2;
    car.speed *= 0.45;
  } else {
    car.x = nx;
    car.y = ny;
  }

  // Handbrake slides leave skid marks and smoke.
  if (handbrake && Math.abs(car.speed) > 120) {
    Effects.addSkid(car.x - Math.cos(car.angle) * half, car.y - Math.sin(car.angle) * half, car.angle);
    if (Math.random() < 0.5) Effects.smoke(car.x - Math.cos(car.angle) * half, car.y - Math.sin(car.angle) * half, false);
  }
  // Damaged cars smoke.
  if (car.health < 45) {
    car.smokeTimer -= dt;
    if (car.smokeTimer <= 0) {
      car.smokeTimer = car.health < 25 ? 0.08 : 0.2;
      Effects.smoke(car.x + Math.cos(car.angle) * half, car.y + Math.sin(car.angle) * half, car.health < 25);
    }
  }
  car.brakeLight = forward < 0 && car.speed > 20;
}

export function damageCar(car, amount, state) {
  if (car.dead) return;
  car.health -= amount;
  if (car.health <= 0) {
    car.health = 0;
    car.dead = true;
    car.speed = 0;
    Effects.explosion(car.x, car.y);
    AudioSys.explosion();
    if (state && state.player && state.player.car === car) {
      // The player's car blew up: throw them out, hurt, on foot. The hook
      // lives on state so this module never imports the player module.
      if (state.ejectPlayerFromCar) state.ejectPlayerFromCar(true);
      else state.player.car = null;
    }
  }
}

// Circle-vs-car test for bullets, pedestrians and other cars.
export function carHitTest(car, x, y, radius) {
  const dx = x - car.x, dy = y - car.y;
  const c = Math.cos(-car.angle), s = Math.sin(-car.angle);
  const lx = dx * c - dy * s, ly = dx * s + dy * c;
  return Math.abs(lx) < car.def.length / 2 + radius && Math.abs(ly) < car.def.width / 2 + radius;
}

export function carFront(car) {
  return {
    x: car.x + Math.cos(car.angle) * (car.def.length / 2),
    y: car.y + Math.sin(car.angle) * (car.def.length / 2),
  };
}
