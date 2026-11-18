// Solmar Heat — the renderer.
// Draws the city ground-up: grass and roads, then everything standing in it
// in y-order so a car south of a building correctly overlaps its roof, then
// bullets, effects and the mission beacon. A soft vignette finishes the dusk
// look. Only what the camera can see is drawn.

import { WORLD, ROAD_CENTERS, ROAD_WIDTH, PALETTE } from './config.js';
import { drawCar } from './sprites.js';
import { drawPerson } from './sprites.js';
import { drawBuilding, drawProp } from './sprites.js';
import { drawPickup } from './pickups.js';
import { Effects } from './effects.js';

export function drawWorld(ctx, state, camera, viewW, viewH, time) {
  const city = state.city;
  const vis = camera.visibleRect();
  camera.apply(ctx);

  drawGround(ctx, city, vis, time);
  Effects.drawSkids(ctx);

  // Everything standing, sorted by its foot position.
  const drawables = [];
  for (const b of city.buildings) {
    if (b.x > vis.x + vis.w || b.x + b.w < vis.x || b.y > vis.y + vis.h || b.y + b.h < vis.y) continue;
    drawables.push({ y: b.y + b.h, draw: () => drawBuilding(ctx, b, time) });
  }
  for (const prop of city.props) {
    if (prop.x < vis.x || prop.x > vis.x + vis.w || prop.y < vis.y || prop.y > vis.y + vis.h) continue;
    drawables.push({ y: prop.y, draw: () => drawProp(ctx, prop, time) });
  }
  for (const pk of state.pickups) {
    if (pk.taken) continue;
    if (pk.x < vis.x || pk.x > vis.x + vis.w || pk.y < vis.y || pk.y > vis.y + vis.h) continue;
    drawables.push({ y: pk.y, draw: () => drawPickup(ctx, pk, time) });
  }
  for (const car of state.cars) {
    if (car.x < vis.x - 60 || car.x > vis.x + vis.w + 60 || car.y < vis.y - 60 || car.y > vis.y + vis.h + 60) continue;
    drawables.push({ y: car.y, draw: () => drawCar(ctx, car, time) });
  }
  for (const ped of state.peds) {
    if (ped.x < vis.x || ped.x > vis.x + vis.w || ped.y < vis.y || ped.y > vis.y + vis.h) continue;
    drawables.push({ y: ped.y, draw: () => drawPerson(ctx, ped, time) });
  }
  for (const e of state.enemies) {
    if (e.x < vis.x || e.x > vis.x + vis.w || e.y < vis.y || e.y > vis.y + vis.h) continue;
    drawables.push({ y: e.y, draw: () => drawPerson(ctx, e, time) });
  }
  const p = state.player;
  if (!p.car) {
    drawables.push({ y: p.y, draw: () => drawPerson(ctx, p, time) });
  }
  drawables.sort((a, b) => a.y - b.y);
  for (const d of drawables) d.draw();

  // Mission item (package / ledger) glows on the ground.
  const run = state.missions.active || state.missions.courier;
  if (run && run.item && !run.item.taken) {
    drawMissionItem(ctx, run.item, time);
  }
  // Race checkpoints.
  if (run) {
    const step = run.def.steps[run.stepIndex];
    if (step && step.type === 'race') {
      const cp = step.checkpoints[run.checkpointIndex];
      if (cp) drawCheckpoint(ctx, cp, time);
    }
  }

  // Bullets as tracers.
  ctx.save();
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  for (const b of state.bullets) {
    ctx.strokeStyle = b.color;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x - b.vx * 0.018, b.y - b.vy * 0.018);
    ctx.stroke();
  }
  ctx.restore();

  Effects.drawParticles(ctx);
  Effects.drawFloats(ctx);
  drawBeacon(ctx, state, time);

  ctx.restore();

  // Screen-space: damage flash, off-screen objective arrow + vignette.
  if (Effects.flash > 0) {
    ctx.fillStyle = 'rgba(255,240,230,' + (Effects.flash * 0.35).toFixed(3) + ')';
    ctx.fillRect(0, 0, viewW, viewH);
  }
  drawOffscreenArrow(ctx, state, camera, viewW, viewH);
  drawVignette(ctx, viewW, viewH);
}

function drawGround(ctx, city, vis, time) {
  // Base grass.
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(vis.x, vis.y, vis.w, vis.h);

  // Parks.
  for (const park of city.parks) {
    ctx.fillStyle = PALETTE.grassDark;
    ctx.fillRect(park.x, park.y, park.w, park.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 3;
    ctx.strokeRect(park.x, park.y, park.w, park.h);
  }

  // Beach and ocean.
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(vis.x, Math.max(vis.y, city.BEACH_TOP), vis.w, Math.max(0, city.OCEAN_TOP - Math.max(vis.y, city.BEACH_TOP)));
  ctx.fillStyle = PALETTE.ocean;
  ctx.fillRect(vis.x, Math.max(vis.y, city.OCEAN_TOP), vis.w, WORLD - Math.max(vis.y, city.OCEAN_TOP));
  // Animated wave lines.
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    const wy = city.OCEAN_TOP + 14 + i * 26;
    if (wy < vis.y || wy > vis.y + vis.h) continue;
    ctx.beginPath();
    for (let x = vis.x; x < vis.x + vis.w; x += 18) {
      const y = wy + Math.sin(x / 60 + time * 1.4 + i * 2) * 4;
      if (x === vis.x) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Pier.
  const pier = city.PIER;
  ctx.fillStyle = '#7a5a38';
  ctx.fillRect(pier.x, pier.y, pier.w, pier.h);
  ctx.fillStyle = '#8a6a44';
  for (let y = pier.y; y < pier.y + pier.h; y += 14) ctx.fillRect(pier.x, y, pier.w, 3);
  ctx.fillStyle = '#5a4028';
  ctx.fillRect(pier.x - 3, pier.y, 4, pier.h);
  ctx.fillRect(pier.x + pier.w - 1, pier.y, 4, pier.h);

  // Sidewalk blocks: light pavement between roads.
  ctx.fillStyle = PALETTE.sidewalk;
  const edges = [0, ...ROAD_CENTERS.map((r) => r - ROAD_WIDTH / 2), WORLD];
  for (let i = 0; i < edges.length - 1; i++) {
    for (let j = 0; j < edges.length - 1; j++) {
      const x0 = edges[i] + (i === 0 ? 0 : ROAD_WIDTH / 2);
      const x1 = edges[i + 1] - (i + 1 === edges.length - 1 ? 0 : ROAD_WIDTH / 2);
      const y0 = edges[j] + (j === 0 ? 0 : ROAD_WIDTH / 2);
      const y1 = edges[j + 1] - (j + 1 === edges.length - 1 ? 0 : ROAD_WIDTH / 2);
      if (x1 <= x0 || y1 <= y0) continue;
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    }
  }

  // Roads.
  ctx.fillStyle = PALETTE.asphalt;
  for (const r of ROAD_CENTERS) {
    ctx.fillRect(r - ROAD_WIDTH / 2, vis.y, ROAD_WIDTH, vis.h);
    ctx.fillRect(vis.x, r - ROAD_WIDTH / 2, vis.w, ROAD_WIDTH);
  }
  // Centre dashes.
  ctx.fillStyle = PALETTE.centerLine;
  for (const r of ROAD_CENTERS) {
    for (let d = 0; d < WORLD; d += 46) {
      if (d > vis.y - 30 && d < vis.y + vis.h + 30) ctx.fillRect(r - 2, d, 4, 24);
      if (d > vis.x - 30 && d < vis.x + vis.w + 30) ctx.fillRect(d, r - 2, 24, 4);
    }
  }
  // Crosswalks at intersections.
  ctx.fillStyle = 'rgba(240,240,240,0.55)';
  for (const rx of ROAD_CENTERS) {
    for (const ry of ROAD_CENTERS) {
      if (rx < vis.x - 80 || rx > vis.x + vis.w + 80 || ry < vis.y - 80 || ry > vis.y + vis.h + 80) continue;
      for (let k = -2; k <= 2; k++) {
        ctx.fillRect(rx + k * 14 - 4, ry - ROAD_WIDTH / 2 - 8, 8, 12);
        ctx.fillRect(rx + k * 14 - 4, ry + ROAD_WIDTH / 2 - 4, 8, 12);
        ctx.fillRect(rx - ROAD_WIDTH / 2 - 8, ry + k * 14 - 4, 12, 8);
        ctx.fillRect(rx + ROAD_WIDTH / 2 - 4, ry + k * 14 - 4, 12, 8);
      }
    }
  }
}

function drawBeacon(ctx, state, time) {
  const marker = state.missions.currentMarker(state);
  if (!marker) return;
  const pulse = 1 + Math.sin(time * 4) * 0.12;
  ctx.save();
  ctx.translate(marker.x, marker.y);
  // Ground ring.
  ctx.strokeStyle = marker.color || '#ffd76a';
  ctx.lineWidth = 3;
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.ellipse(0, 0, 46 * pulse, 22 * pulse, 0, 0, Math.PI * 2);
  ctx.stroke();
  // Light column.
  const grad = ctx.createLinearGradient(0, -190, 0, 0);
  grad.addColorStop(0, 'rgba(255,215,106,0)');
  grad.addColorStop(1, 'rgba(255,215,106,0.35)');
  ctx.fillStyle = grad;
  ctx.fillRect(-14, -190, 28, 190);
  // Floating diamond.
  const dy = -120 + Math.sin(time * 2.4) * 8;
  ctx.fillStyle = marker.color || '#ffd76a';
  ctx.beginPath();
  ctx.moveTo(0, dy - 14); ctx.lineTo(11, dy); ctx.lineTo(0, dy + 14); ctx.lineTo(-11, dy);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawMissionItem(ctx, item, time) {
  ctx.save();
  ctx.translate(item.x, item.y + Math.sin(time * 3) * 3);
  ctx.fillStyle = 'rgba(127,212,193,0.25)';
  ctx.beginPath(); ctx.arc(0, 0, 24, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#3d3d48';
  ctx.fillRect(-14, -9, 28, 18);
  ctx.fillStyle = '#ffd76a';
  ctx.fillRect(-14, -9, 28, 5);
  ctx.fillStyle = '#14141c';
  ctx.fillRect(-4, -2, 8, 5);
  ctx.restore();
}

function drawCheckpoint(ctx, cp, time) {
  ctx.save();
  ctx.translate(cp.x, cp.y);
  const pulse = 1 + Math.sin(time * 5) * 0.08;
  ctx.strokeStyle = '#ffd76a';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.ellipse(0, 0, 62 * pulse, 30 * pulse, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,215,106,0.12)';
  ctx.beginPath();
  ctx.ellipse(0, 0, 62 * pulse, 30 * pulse, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawOffscreenArrow(ctx, state, camera, viewW, viewH) {
  const marker = state.missions.currentMarker(state);
  if (!marker) return;
  const vis = camera.visibleRect();
  if (marker.x > vis.x && marker.x < vis.x + vis.w && marker.y > vis.y && marker.y < vis.y + vis.h) return;
  // Clamp the marker to the screen edge, keeping clear of the message feed
  // in the bottom-left corner.
  const sx = ((marker.x - camera.x) * camera.zoom) + viewW / 2;
  const sy = ((marker.y - camera.y) * camera.zoom) + viewH / 2;
  let cx = Math.max(40, Math.min(viewW - 40, sx));
  const cy = Math.max(70, Math.min(viewH - 70, sy));
  if (cy >= viewH - 100 && cx < 430) cx = 430;
  const ang = Math.atan2(sy - cy, sx - cx);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(ang);
  ctx.fillStyle = marker.color || '#ffd76a';
  ctx.beginPath();
  ctx.moveTo(18, 0); ctx.lineTo(-10, -12); ctx.lineTo(-4, 0); ctx.lineTo(-10, 12);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // Distance readout: above the arrow when it hugs the bottom edge, so it
  // never collides with the message feed.
  const p = state.player;
  const d = Math.round(Math.hypot(marker.x - p.x, marker.y - p.y));
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 12px "Trebuchet MS", Verdana, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(d + 'm', cx, cy > viewH - 100 ? cy - 26 : cy + 30);
}

function drawVignette(ctx, viewW, viewH) {
  const grad = ctx.createRadialGradient(viewW / 2, viewH / 2, Math.min(viewW, viewH) * 0.42,
    viewW / 2, viewH / 2, Math.max(viewW, viewH) * 0.72);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.32)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, viewW, viewH);
}
