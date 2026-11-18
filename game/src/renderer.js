// San Cielo Heat — the world renderer: ground, roads and markings,
// buildings, props and every moving thing, painted back to front with
// viewport culling so the frame stays fast.

import { BLOCK, OCEAN_Y, PALETTE, PLACES, ROAD_CENTERS, ROAD_WIDTH, WORLD, districtKeyForBlock } from './config.js';
import { buildingsInView } from './city.js';
import { dist } from './util.js';
import { drawBuilding, drawLamp, drawPerson, drawProp, drawTree, drawVehicle } from './sprites.js';
import { pickupKindInfo } from './pickups.js';

const HALF_ROAD = ROAD_WIDTH / 2;

export function drawWorld(ctx, game) {
  const camera = game.camera;
  const city = game.city;
  const b = camera.viewBounds();
  const time = game.time;

  // ---- ground base ----
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);

  // Beach sand along the south edge, then the sea.
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(b.x0, Math.max(b.y0, ROAD_CENTERS[7] + HALF_ROAD), b.x1 - b.x0, Math.min(b.y1, OCEAN_Y) - Math.max(b.y0, ROAD_CENTERS[7] + HALF_ROAD));
  ctx.fillStyle = PALETTE.ocean;
  ctx.fillRect(b.x0, Math.max(b.y0, OCEAN_Y), b.x1 - b.x0, b.y1 - Math.max(b.y0, OCEAN_Y));
  drawWaves(ctx, b, time);

  // ---- block ground: sidewalk, then the district's inner ground ----
  for (let col = 0; col < 8; col++) {
    for (let row = 0; row < 8; row++) {
      const x = ROAD_CENTERS[col] + HALF_ROAD;
      const y = ROAD_CENTERS[row] + HALF_ROAD;
      const w = BLOCK - ROAD_WIDTH;
      const h = BLOCK - ROAD_WIDTH;
      if (x > b.x1 || x + w < b.x0 || y > b.y1 || y + h < b.y0) continue;
      const key = districtKeyForBlock(col, row);
      ctx.fillStyle = PALETTE.sidewalk;
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = PALETTE.sidewalkEdge;
      ctx.fillRect(x, y, w, 4);
      ctx.fillRect(x, y, 4, h);
      ctx.fillRect(x, y + h - 4, w, 4);
      ctx.fillRect(x + w - 4, y, 4, h);
      const inner = 26;
      if (key === 'park') {
        ctx.fillStyle = PALETTE.parkGrass;
        ctx.fillRect(x + inner, y + inner, w - inner * 2, h - inner * 2);
        // Crossing paths.
        ctx.fillStyle = PALETTE.sidewalk;
        ctx.fillRect(x + w / 2 - 8, y + inner, 16, h - inner * 2);
        ctx.fillRect(x + inner, y + h / 2 - 8, w - inner * 2, 16);
      } else if (key === 'beach') {
        ctx.fillStyle = PALETTE.sand;
        ctx.fillRect(x + inner, y + inner, w - inner * 2, h - inner * 2);
      } else if (key === 'downtown' || key === 'market') {
        ctx.fillStyle = '#bdb5a4';
        ctx.fillRect(x + inner, y + inner, w - inner * 2, h - inner * 2);
      } else {
        ctx.fillStyle = PALETTE.grass;
        ctx.fillRect(x + inner, y + inner, w - inner * 2, h - inner * 2);
      }
    }
  }

  // ---- roads ----
  ctx.fillStyle = PALETTE.asphalt;
  for (const c of ROAD_CENTERS) {
    if (c + HALF_ROAD >= b.x0 && c - HALF_ROAD <= b.x1) ctx.fillRect(c - HALF_ROAD, b.y0, ROAD_WIDTH, b.y1 - b.y0);
    if (c + HALF_ROAD >= b.y0 && c - HALF_ROAD <= b.y1) ctx.fillRect(b.x0, c - HALF_ROAD, b.x1 - b.x0, ROAD_WIDTH);
  }
  // Centre dashes and crosswalks.
  ctx.fillStyle = PALETTE.centerLine;
  for (const c of ROAD_CENTERS) {
    if (c >= b.x0 - 10 && c <= b.x1 + 10) {
      for (let y = Math.floor(b.y0 / 64) * 64; y < b.y1; y += 64) {
        if (onCrossStreet(y)) continue;
        ctx.fillRect(c - 2, y, 4, 30);
      }
    }
    if (c >= b.y0 - 10 && c <= b.y1 + 10) {
      for (let x = Math.floor(b.x0 / 64) * 64; x < b.x1; x += 64) {
        if (onCrossStreet(x)) continue;
        ctx.fillRect(x, c - 2, 30, 4);
      }
    }
  }
  ctx.fillStyle = PALETTE.crosswalk;
  for (const cx of ROAD_CENTERS) {
    for (const cy of ROAD_CENTERS) {
      if (cx < b.x0 - 60 || cx > b.x1 + 60 || cy < b.y0 - 60 || cy > b.y1 + 60) continue;
      for (let i = -2; i <= 2; i++) {
        ctx.fillRect(cx + i * 16 - 5, cy - HALF_ROAD + 8, 10, 12);
        ctx.fillRect(cx + i * 16 - 5, cy + HALF_ROAD - 20, 10, 12);
      }
    }
  }

  // ---- pier planks over the water ----
  for (const prop of city.benches) {
    if (prop.kind !== 'pier') continue;
    ctx.fillStyle = '#a88155';
    ctx.fillRect(prop.x, prop.y, prop.w, prop.h);
    ctx.fillStyle = '#8a6b3d';
    for (let y = prop.y + 12; y < prop.y + prop.h; y += 16) ctx.fillRect(prop.x, y, prop.w, 2);
  }

  // ---- mission markers on the ground ----
  drawGroundMarkers(ctx, game, time);

  // ---- props: ponds, benches, crates, cranes ----
  for (const prop of city.benches) {
    if (prop.kind === 'pier') continue;
    if (!camera.visible(prop.x, prop.y, 80)) continue;
    drawProp(ctx, prop);
  }

  // ---- buildings, painter-sorted ----
  const visible = buildingsInView(city, b.x0, b.y0, b.x1, b.y1).sort((a, c2) => a.y - c2.y);
  for (const building of visible) drawBuilding(ctx, building, time);

  // ---- trees and lamps ----
  for (const t of city.trees) {
    if (!camera.visible(t.x, t.y, 30)) continue;
    drawTree(ctx, t, time);
  }
  for (const lamp of city.lamps) {
    if (!camera.visible(lamp.x, lamp.y, 10)) continue;
    drawLamp(ctx, lamp);
  }

  // ---- pickups ----
  for (const p of game.pickups.pickups) {
    if (!p.active || !camera.visible(p.x, p.y, 30)) continue;
    const info = pickupKindInfo(p.kind);
    const bobY = Math.sin(p.bob) * 3;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 8, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = info.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y + bobY, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(info.icon, p.x, p.y + bobY + 5);
  }

  // ---- vehicles, sorted so nearer ones overlap correctly ----
  const cars = game.allCars.slice().sort((a, c2) => a.y - c2.y);
  for (const car of cars) {
    if (!camera.visible(car.x, car.y, 70)) continue;
    drawVehicle(ctx, car.x, car.y, car.angle, car.def, car.color, {
      steer: car.steer,
      police: !!car.def.police,
      taxi: !!car.def.taxi,
      time,
      damage: 100 - (car.health / car.maxHealth) * 100,
      wrecked: car.wrecked,
    });
  }

  // ---- pedestrians and goons ----
  for (const ped of game.peds.peds) {
    if (!camera.visible(ped.x, ped.y, 30)) continue;
    drawPerson(ctx, ped.x, ped.y, ped.angle, ped.look, ped.walkPhase, { down: ped.state === 'down' });
  }
  for (const e of game.combat.enemies) {
    if (!camera.visible(e.x, e.y, 30)) continue;
    drawPerson(ctx, e.x, e.y, e.angle, e.look, e.walkPhase, { weapon: e.health > 0, down: e.health <= 0 });
  }

  // ---- the player on foot ----
  const player = game.player;
  if (!player.inCar && !player.dead) {
    drawPerson(ctx, player.x, player.y, player.angle, player.look, player.walkPhase, {
      weapon: player.weapon !== 'fists',
    });
  }

  // ---- bullets as bright tracers ----
  ctx.strokeStyle = '#ffe9a3';
  ctx.lineWidth = 2;
  for (const bullet of game.combat.bullets) {
    ctx.beginPath();
    ctx.moveTo(bullet.x, bullet.y);
    ctx.lineTo(bullet.x - bullet.vx * 0.016, bullet.y - bullet.vy * 0.016);
    ctx.stroke();
  }

  // ---- particles, skids, floaters ----
  game.effects.drawWorld(ctx);

  // ---- objective beacon ----
  drawObjectiveBeacon(ctx, game, time);
}

function onCrossStreet(v) {
  for (const c of ROAD_CENTERS) {
    if (Math.abs(v - c) < HALF_ROAD + 20) return true;
  }
  return false;
}

function drawWaves(ctx, b, time) {
  if (b.y1 < OCEAN_Y) return;
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  const y0 = Math.max(b.y0, OCEAN_Y + 8);
  for (let y = Math.floor(y0 / 46) * 46; y < b.y1; y += 46) {
    ctx.beginPath();
    for (let x = Math.floor(b.x0 / 30) * 30; x < b.x1; x += 30) {
      const yy = y + Math.sin(x * 0.02 + time * 1.4 + y) * 3;
      if (x === Math.floor(b.x0 / 30) * 30) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  // Foam at the waterline.
  ctx.fillStyle = PALETTE.foam;
  for (let x = Math.floor(b.x0 / 40) * 40; x < b.x1; x += 40) {
    const wobble = Math.sin(x * 0.05 + time * 1.8) * 3;
    ctx.fillRect(x, OCEAN_Y + wobble, 26, 3);
  }
}

function drawGroundMarkers(ctx, game, time) {
  const pulse = 0.5 + Math.sin(time * 3.2) * 0.5;
  const ring = (x, y, radius, color) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.45 + pulse * 0.5;
    ctx.beginPath();
    ctx.arc(x, y, radius + pulse * 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 0.16 + pulse * 0.1;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  };
  // Garage: green when a story job waits.
  if (game.missions.canStartStory(game)) ring(PLACES.garage.x, PLACES.garage.y, 46, '#7ddb6a');
  // Paint shop: pink when wanted.
  if (game.police.wanted > 0) ring(PLACES.paintShop.x, PLACES.paintShop.y, 40, '#e87a9a');
  // Courier spots: gold when free.
  if (!game.missions.active && !game.missions.courier) {
    for (const spot of [{ x: PLACES.bazaar.x, y: PLACES.bazaar.y }, { x: PLACES.arena.x, y: PLACES.arena.y }, { x: PLACES.hospital.x, y: PLACES.hospital.y }, { x: PLACES.depot.x, y: PLACES.depot.y }]) {
      ring(spot.x, spot.y, 30, '#f2c14e');
    }
  }
}

function drawObjectiveBeacon(ctx, game, time) {
  const obj = game.missions.activeObjective(game);
  if (obj.x === null || obj.x === undefined) return;
  const pulse = 0.5 + Math.sin(time * 4) * 0.5;
  // A beam of light the player can see from blocks away.
  const grad = ctx.createLinearGradient(obj.x, obj.y - 220, obj.x, obj.y);
  grad.addColorStop(0, 'rgba(255,217,74,0)');
  grad.addColorStop(1, 'rgba(255,217,74,' + (0.35 + pulse * 0.25).toFixed(3) + ')');
  ctx.fillStyle = grad;
  ctx.fillRect(obj.x - 8, obj.y - 220, 16, 220);
  // Down arrow.
  const ay = obj.y - 46 - pulse * 8;
  ctx.fillStyle = '#ffd94a';
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(obj.x, ay + 16);
  ctx.lineTo(obj.x - 12, ay);
  ctx.lineTo(obj.x - 4, ay);
  ctx.lineTo(obj.x - 4, ay - 12);
  ctx.lineTo(obj.x + 4, ay - 12);
  ctx.lineTo(obj.x + 4, ay);
  ctx.lineTo(obj.x + 12, ay);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Ground ring.
  ctx.strokeStyle = '#ffd94a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(obj.x, obj.y, 26 + pulse * 6, 0, Math.PI * 2);
  ctx.stroke();
}
