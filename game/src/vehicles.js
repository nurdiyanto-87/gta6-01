// San Cielo Heat — the cars: nine civilian types plus the police fleet,
// and the arcade driving model every car shares.

import { TUNING } from './config.js';
import { collideCar } from './city.js';
import { clamp } from './util.js';

export const VEHICLE_TYPES = [
  { id: 'hatch', name: 'Cielo Hatch', kind: 'hatch', length: 44, width: 22, accel: 300, maxSpeed: 250, grip: 3.6, steer: 2.8, health: 80, colors: ['#d95f4b', '#4b8ad9', '#e8e3d3', '#5da56a'] },
  { id: 'sedan', name: 'Marlin Sedan', kind: 'sedan', length: 50, width: 23, accel: 320, maxSpeed: 275, grip: 3.4, steer: 2.6, health: 100, colors: ['#3a4a5a', '#c9c2b4', '#7a4a8a', '#e0e0e0'] },
  { id: 'coupe', name: 'Sol Coupe', kind: 'coupe', length: 48, width: 22, accel: 360, maxSpeed: 305, grip: 3.8, steer: 3.0, health: 85, colors: ['#e0a83c', '#c93a4b', '#2e86a3', '#f2f2ee'] },
  { id: 'muscle', name: 'Bravo Muscle', kind: 'muscle', length: 52, width: 24, accel: 420, maxSpeed: 320, grip: 2.9, steer: 2.4, health: 110, colors: ['#8a2f2f', '#2b2b30', '#d97b2e', '#4a6b3a'] },
  { id: 'sports', name: 'Veloce GT', kind: 'sports', length: 50, width: 23, accel: 480, maxSpeed: 380, grip: 4.4, steer: 3.3, health: 90, colors: ['#f2c14e', '#d93a2b', '#1e88c8', '#e8e3d3'] },
  { id: 'pickup', name: 'Rancho Pickup', kind: 'pickup', length: 54, width: 24, accel: 300, maxSpeed: 260, grip: 3.2, steer: 2.4, health: 130, colors: ['#6b7a5a', '#a85a24', '#c9c2b4', '#3a4a5a'] },
  { id: 'van', name: 'Cargo Van', kind: 'van', length: 56, width: 25, accel: 260, maxSpeed: 235, grip: 3.0, steer: 2.2, health: 140, colors: ['#e8e3d3', '#4b8ad9', '#8a8a8a', '#c9a24b'] },
  { id: 'taxi', name: 'City Cab', kind: 'sedan', length: 50, width: 23, accel: 320, maxSpeed: 275, grip: 3.4, steer: 2.6, health: 100, colors: ['#f5c81e'], taxi: true },
  { id: 'limo', name: 'Regal Limo', kind: 'limo', length: 66, width: 24, accel: 270, maxSpeed: 255, grip: 3.0, steer: 2.1, health: 130, colors: ['#1c1c20', '#e8e3d3'] },
  { id: 'cruiser', name: 'SCPD Cruiser', kind: 'sedan', length: 50, width: 23, accel: 400, maxSpeed: 345, grip: 4.0, steer: 3.0, health: 150, colors: ['#1c1c20'], police: true },
  { id: 'interceptor', name: 'SCPD Interceptor', kind: 'sports', length: 50, width: 23, accel: 470, maxSpeed: 375, grip: 4.5, steer: 3.3, health: 150, colors: ['#1c1c20'], police: true },
];

export function vehicleDef(id) {
  return VEHICLE_TYPES.find((v) => v.id === id) || VEHICLE_TYPES[1];
}

let nextCarId = 1;

export function makeVehicle(typeId, x, y, angle, opts) {
  const o = opts || {};
  const def = vehicleDef(typeId);
  return {
    id: nextCarId++,
    type: typeId,
    def,
    x, y, angle,
    vx: 0, vy: 0,
    speed: 0,
    steer: 0,
    color: o.color || def.colors[Math.floor(Math.random() * def.colors.length)],
    health: def.health,
    maxHealth: def.health,
    wrecked: false,
    driver: o.driver || null, // 'player' | 'traffic' | 'police' | null (parked)
    siren: false,
    smokeTimer: 0,
    skidTimer: 0,
    lastHitAt: -99,
  };
}

// Arcade driving: speed along the heading, velocity eased toward it so
// handbrake turns slide. Returns impact info for effects and sound.
export function driveCar(game, car, input, dt) {
  const def = car.def;
  if (car.wrecked) {
    car.vx *= Math.exp(-2 * dt);
    car.vy *= Math.exp(-2 * dt);
    car.x += car.vx * dt;
    car.y += car.vy * dt;
    car.speed = 0;
    return { crashed: false, impact: 0 };
  }

  const throttle = clamp(input.throttle || 0, -1, 1);
  const steerInput = clamp(input.steer || 0, -1, 1);
  const handbrake = !!input.handbrake;

  if (throttle > 0) car.speed += def.accel * throttle * dt;
  else if (throttle < 0) {
    if (car.speed > 20) car.speed -= TUNING.carBrake * dt; // braking
    else car.speed += def.accel * 0.6 * throttle * dt; // reversing
  }
  // Drag and rolling resistance.
  car.speed -= car.speed * TUNING.carDrag * dt;
  if (Math.abs(car.speed) < 4 && throttle === 0) car.speed = 0;
  car.speed = clamp(car.speed, -TUNING.carReverseMax, def.maxSpeed);

  // Steering: sharper at moderate speed, numb when crawling or sliding.
  const speedFactor = clamp(Math.abs(car.speed) / 120, 0, 1);
  const steerRate = def.steer * speedFactor * (handbrake ? 1.35 : 1);
  car.steer += (steerInput - car.steer) * Math.min(1, dt * 8);
  car.angle += car.steer * steerRate * dt * (car.speed >= 0 ? 1 : -1);

  const grip = handbrake ? TUNING.handbrakeGrip : def.grip;
  const wantVx = Math.cos(car.angle) * car.speed;
  const wantVy = Math.sin(car.angle) * car.speed;
  const k = 1 - Math.exp(-grip * dt);
  car.vx += (wantVx - car.vx) * k;
  car.vy += (wantVy - car.vy) * k;

  const prevX = car.x;
  const prevY = car.y;
  car.x += car.vx * dt;
  car.y += car.vy * dt;

  // Skid marks while sliding hard.
  const slide = Math.abs(car.vx * Math.sin(car.angle) - car.vy * Math.cos(car.angle));
  if ((handbrake || slide > 60) && Math.hypot(car.vx, car.vy) > 120) {
    car.skidTimer -= dt;
    if (car.skidTimer <= 0) {
      car.skidTimer = 0.03;
      game.effects.addSkid(car.x - Math.cos(car.angle) * def.length * 0.35, car.y - Math.sin(car.angle) * def.length * 0.35, car.angle);
    }
  }

  const crashed = collideCar(game.city, car, def.length / 2, def.width / 2);
  let impact = 0;
  if (crashed) {
    const moved = Math.hypot(car.x - prevX, car.y - prevY);
    const expected = Math.hypot(car.vx, car.vy) * dt;
    impact = Math.max(0, expected - moved) / Math.max(dt, 0.001);
    if (impact > 40) {
      const dmg = impact * 0.06;
      damageCar(game, car, dmg);
      game.effects.sparks(car.x + Math.cos(car.angle) * def.length * 0.4, car.y + Math.sin(car.angle) * def.length * 0.4);
      game.audio.crash(impact > 160);
      if (car.driver === 'player') game.camera.addShake(Math.min(10, impact * 0.05));
      car.speed *= 0.35;
      car.vx *= 0.3;
      car.vy *= 0.3;
    } else {
      car.speed *= 0.7;
    }
  }

  // Smoke from a dying engine.
  if (car.health < car.maxHealth * 0.35 && !car.wrecked) {
    car.smokeTimer -= dt;
    if (car.smokeTimer <= 0) {
      car.smokeTimer = 0.12;
      game.effects.smoke(car.x + Math.cos(car.angle) * car.def.length * 0.4, car.y + Math.sin(car.angle) * car.def.length * 0.4, car.health < car.maxHealth * 0.18);
    }
  }
  return { crashed, impact };
}

export function damageCar(game, car, amount) {
  if (car.wrecked) return;
  car.health -= amount;
  if (car.health <= 0) {
    car.health = 0;
    car.wrecked = true;
    car.speed = 0;
    game.effects.burst(car.x, car.y, 26, { speed: 180, life: 0.8, size: 5, color: '#ff7a3c' });
    game.effects.smoke(car.x, car.y, true);
    game.audio.crash(true);
    if (car.driver === 'player') game.camera.addShake(12);
  }
}

// Pairwise car-vs-car: circles at nose and tail, simple impulse swap.
export function resolveCarCollisions(game, cars, dt) {
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i];
      const b = cars[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const rr = (a.def.length + b.def.length) / 4 + 4;
      const d2 = dx * dx + dy * dy;
      if (d2 >= rr * rr || d2 < 0.01) continue;
      const d = Math.sqrt(d2);
      const nx = dx / d;
      const ny = dy / d;
      const overlap = rr - d;
      a.x -= nx * overlap * 0.5;
      a.y -= ny * overlap * 0.5;
      b.x += nx * overlap * 0.5;
      b.y += ny * overlap * 0.5;
      const relVx = b.vx - a.vx;
      const relVy = b.vy - a.vy;
      const closing = -(relVx * nx + relVy * ny);
      if (closing > 30) {
        const impulse = closing * 0.55;
        a.vx -= nx * impulse;
        a.vy -= ny * impulse;
        b.vx += nx * impulse;
        b.vy += ny * impulse;
        a.speed *= 0.7;
        b.speed *= 0.7;
        const now = game.time;
        if (now - a.lastHitAt > 0.4) {
          a.lastHitAt = now;
          b.lastHitAt = now;
          damageCar(game, a, closing * 0.045);
          damageCar(game, b, closing * 0.045);
          const hx = (a.x + b.x) / 2;
          const hy = (a.y + b.y) / 2;
          game.effects.sparks(hx, hy);
          game.audio.crash(closing > 160);
          if (a.driver === 'player' || b.driver === 'player') game.camera.addShake(Math.min(9, closing * 0.04));
          game.peds.scareAt(hx, hy, 260);
        }
      }
    }
  }
}

export function carSpeed(car) {
  return Math.hypot(car.vx, car.vy);
}

export function carNose(car) {
  return { x: car.x + Math.cos(car.angle) * car.def.length * 0.5, y: car.y + Math.sin(car.angle) * car.def.length * 0.5 };
}
