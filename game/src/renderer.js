// San Cielo Heat — the world renderer: ground, roads and markings, the
// ocean and beach, buildings, props, entities sorted by depth, and the
// mission markers and objective beacon.

import { BLOCK, OCEAN_Y, PALETTE, ROAD_CENTERS, ROAD_WIDTH, WORLD } from './config.js';
import { buildingsInView } from './city.js';
import { drawBuilding, drawLamp, drawPerson, drawProp, drawTree, drawVehicle } from './sprites.js';
import { clamp } from './util.js';

export function drawWorld(ctx, game) {
  const cam = game.camera;
  const left = cam.viewLeft();
  const top = cam.viewTop();
  const right = left + game.viewW / cam.zoom;
  const bottom = top + game.viewH / cam.zoom;

  ctx.save();
  ctx.translate(game.viewW / 2, game.viewH / 2);
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(-cam.x + cam.shakeX, -cam.y + cam.shakeY);

  drawGround(ctx, left, top, right, bottom, game.time);
  drawRoads(ctx, left, top, right, bottom);
  drawOcean(ctx, left, top, right, bottom, game.time);

  // Ground decals: skid marks, then the mission ground markers.
  game.effects.drawUnder(ctx);
  drawGroundMarkers(ctx, game, game.time);

  // Buildings in view, then everything else sorted by y for depth.
  const buildings = buildingsInView(game.city, left - 80, top - 80, right + 80, bottom + 80);
  for (const b of buildings) drawBuilding(ctx, b, game.time);

  const drawables = [];
  for (const t of game.city.trees) {
    if (t.x > left - 40 && t.x < right + 40 && t.y > top - 40 && t.y < bottom + 40) {
      drawables.push({ y: t.y, draw: () => drawTree(ctx, t, game.time) });
    }
  }
  for (const lamp of game.city.lamps) {
    if (lamp.x > left && lamp.x < right && lamp.y > top && lamp.y < bottom) {
      drawables.push({ y: lamp.y, draw: () => drawLamp(ctx, lamp) });
    }
  }
  for (const prop of game.city.props) {
    if (prop.kind === 'pier') continue;
    if (prop.x > left - 40 && prop.x < right + 40 && prop.y > top - 40 && prop.y < bottom + 40) {
      drawables.push({ y: prop.y, draw: () => drawProp(ctx, prop) });
    }
  }
  for (const car of game.allCars) {
    if (car.x > left - 90 && car.x < right + 90 && car.y > top - 90 && car.y < bottom + 90) {
      drawables.push({
        y: car.y,
        draw: () => drawVehicle(ctx, car.x, car.y, car.angle, car.def, car.color, {
          flash: car.sirenPhase !== undefined ? car.sirenPhase : game.police.flashPhase,
          damage: car.damage,
          broken: car.dead,
        }),
      });
    }
  }
  for (const ped of game.peds.peds) {
    if (ped.x > left - 30 && ped.x < right + 30 && ped.y > top - 30 && ped.y < bottom + 30) {
      drawables.push({
        y: ped.y,
        draw: () => drawPerson(ctx, ped.x, ped.y, ped.angle, ped.look, ped.walkPhase, {}),
      });
    }
  }
  for (const enemy of game.combat.enemies) {
    if (enemy.x > left - 30 && enemy.x < right + 30 && enemy.y > top - 30 && enemy.y < bottom + 30) {
      drawables.push({
        y: enemy.y,
        draw: () => drawPerson(ctx, enemy.x, enemy.y, enemy.angle, enemy.look, enemy.walkPhase, { aiming: enemy.alerted }),
      });
    }
  }
  const player = game.player;
  if (!player.inCar) {
    drawables.push({
      y: player.y,
      draw: () => drawPerson(ctx, player.x, player.y, player.angle, player.look, player.walkPhase, { aiming: player.aiming }),
    });
  }
  drawables.sort((a, b) => a.y - b.y);
  for (const d of drawables) d.draw();

  // Pickups, bullets, particles and floating text on top.
  game.pickups.draw(ctx, game.time);
  game.combat.draw(ctx);
  game.effects.drawOver(ctx);

  drawObjectiveBeacon(ctx, game, game.time);
  ctx.restore();

  drawEdgeArrow(ctx, game);
}

function drawGround(ctx, left, top, right, bottom, time) {
  // Base grass.
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(left, top, right - left, bottom - top);
  // Block interiors: alternating mow stripes for texture.
  for (let col = 0; col < 8; col++) {
    for (let row = 0; row < 8; row++) {
      const x = ROAD_CENTERS[col] + ROAD_WIDTH / 2;
      const y = ROAD_CENTERS[row] + ROAD_WIDTH / 2;
      const w = BLOCK - ROAD_WIDTH;
      const h = BLOCK - ROAD_WIDTH;
      if (x > right || x + w < left || y > bottom || y + h < top) continue;
      ctx.fillStyle = (col + row) % 2 === 0 ? PALETTE.grass : PALETTE.grassDark;
      ctx.fillRect(x, y, w, h);
      // Sidewalk border around the block.
      ctx.fillStyle = PALETTE.sidewalk;
      ctx.fillRect(x, y, w, 10);
      ctx.fillRect(x, y + h - 10, w, 10);
      ctx.fillRect(x, y, 10, h);
      ctx.fillRect(x + w - 10, y, 10, h);
    }
  }
  // Beach sand below the last road.
  const sandTop = ROAD_CENTERS[8] + ROAD_WIDTH / 2;
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(left, Math.max(top, sandTop), right - left, Math.max(0, Math.min(bottom, OCEAN_Y) - Math.max(top, sandTop)));
}

function onCrossStreet(v) {
  for (const c of ROAD_CENTERS) {
    if (Math.abs(v - c) <= ROAD_WIDTH / 2 + 4) return true;
  }
  return false;
}

function drawRoads(ctx, left, top, right, bottom) {
  ctx.fillStyle = PALETTE.asphalt;
  for (const c of ROAD_CENTERS) {
    ctx.fillRect(left, c - ROAD_WIDTH / 2, right - left, ROAD_WIDTH);
    ctx.fillRect(c - ROAD_WIDTH / 2, top, ROAD_WIDTH, bottom - top);
  }
  // Centre dashes.
  ctx.fillStyle = PALETTE.centerLine;
  for (const c of ROAD_CENTERS) {
    for (let v = 0; v < WORLD; v += 64) {
      if (!onCrossStreet(v)) {
        if (v > left - 32 && v < right + 32) ctx.fillRect(v, c - 2, 32, 4);
        if (v > top - 32 && v < bottom + 32) ctx.fillRect(c - 2, v, 4, 32);
      }
    }
  }
  // Lane lines.
  ctx.fillStyle = PALETTE.laneLine;
  for (const c of ROAD_CENTERS) {
    for (const off of [-21, 21]) {
      for (let v = 0; v < WORLD; v += 48) {
        if (!onCrossStreet(v)) {
          if (v > left - 24 && v < right + 24) ctx.fillRect(v, c + off - 1, 24, 2);
          if (v > top - 24 && v < bottom + 24) ctx.fillRect(c + off - 1, v, 2, 24);
        }
      }
    }
  }
  // Crosswalks at intersections.
  ctx.fillStyle = PALETTE.crosswalk;
  for (const cx of ROAD_CENTERS) {
    for (const cy of ROAD_CENTERS) {
      if (cx < left - 60 || cx > right + 60 || cy < top - 60 || cy > bottom + 60) continue;
      for (let i = -3; i <= 3; i++) {
        ctx.fillRect(cx + i * 11 - 3, cy - ROAD_WIDTH / 2 + 6, 6, 12);
        ctx.fillRect(cx + i * 11 - 3, cy + ROAD_WIDTH / 2 - 18, 6, 12);
        ctx.fillRect(cx - ROAD_WIDTH / 2 + 6, cy + i * 11 - 3, 12, 6);
        ctx.fillRect(cx + ROAD_WIDTH / 2 - 18, cy + i * 11 - 3, 12, 6);
      }
    }
  }
}

function drawOcean(ctx, left, top, right, bottom, time) {
  if (bottom < OCEAN_Y) return;
  const grad = ctx.createLinearGradient(0, OCEAN_Y, 0, WORLD);
  grad.addColorStop(0, PALETTE.ocean);
  grad.addColorStop(1, PALETTE.oceanDeep);
  ctx.fillStyle = grad;
  ctx.fillRect(left, OCEAN_Y, right - left, bottom - OCEAN_Y);
  // Foam line and drifting wave streaks.
  ctx.fillStyle = PALETTE.foam;
  const waveOff = Math.sin(time * 1.2) * 4;
  ctx.fillRect(left, OCEAN_Y + waveOff, right - left, 4);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  for (let x = 0; x < WORLD; x += 170) {
    const y = OCEAN_Y + 40 + ((x * 7) % 90);
    const wobble = Math.sin(time * 0.9 + x * 0.02) * 8;
    if (x > left - 80 && x < right + 80 && y > top && y < bottom) {
      ctx.fillRect(x + wobble, y, 60, 3);
    }
  }
  // The pier.
  ctx.fillStyle = '#8a6b4a';
  ctx.fillRect(1780 - 30, OCEAN_Y - 40, 60, 120);
  ctx.fillStyle = '#6d5439';
  for (let y = OCEAN_Y - 40; y < OCEAN_Y + 80; y += 16) ctx.fillRect(1780 - 30, y, 60, 3);
}

function drawObjectiveBeacon(ctx, game, time) {
  const obj = game.missions.objectivePoint;
  if (!obj) return;
  const bob = Math.sin(time * 3) * 6;
  const beamH = 130;
  const grad = ctx.createLinearGradient(0, obj.y - beamH + bob, 0, obj.y);
  grad.addColorStop(0, 'rgba(255,217,77,0)');
  grad.addColorStop(1, 'rgba(255,217,77,0.4)');
  ctx.fillStyle = grad;
  ctx.fillRect(obj.x - 8, obj.y - beamH + bob, 16, beamH);
  ctx.fillStyle = '#ffd94d';
  ctx.beginPath();
  ctx.moveTo(obj.x, obj.y - beamH + bob - 14);
  ctx.lineTo(obj.x - 10, obj.y - beamH + bob - 30);
  ctx.lineTo(obj.x + 10, obj.y - beamH + bob - 30);
  ctx.closePath();
  ctx.fill();
}

// Off-screen objective arrow, drawn in screen space at the viewport edge.
function drawEdgeArrow(ctx, game) {
  const obj = game.missions.objectivePoint;
  if (!obj) return;
  const cam = game.camera;
  const sx = (obj.x - cam.x) * cam.zoom + game.viewW / 2;
  const sy = (obj.y - cam.y) * cam.zoom + game.viewH / 2;
  if (sx < 30 || sx > game.viewW - 30 || sy < 30 || sy > game.viewH - 30) {
    const cx = clamp(sx, 40, game.viewW - 40);
    const cy = clamp(sy, 50, game.viewH - 40);
    const angle = Math.atan2(sy - game.viewH / 2, sx - game.viewW / 2);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.fillStyle = '#ffd94d';
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(-8, -10);
    ctx.lineTo(-8, 10);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function drawGroundMarkers(ctx, game, time) {
  const pulse = 0.6 + 0.4 * Math.sin(time * 4);
  // Garage marker.
  markerRing(ctx, 1180, 300, 46, 'rgba(93,165,106,' + (0.35 + 0.3 * pulse) + ')');
  // Paint shop marker.
  markerRing(ctx, 2580, 1380, 40, 'rgba(224,168,60,' + (0.3 + 0.3 * pulse) + ')');
  // Hospital marker.
  markerRing(ctx, 580, 980, 34, 'rgba(232,76,61,' + (0.25 + 0.25 * pulse) + ')');
}

function markerRing(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 2;
  ctx.stroke();
}
