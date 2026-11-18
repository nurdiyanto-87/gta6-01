// San Cielo Heat — the city generator: a fixed-seed grid of roads, blocks,
// buildings, trees and landmarks, plus the collision and road queries the
// other systems need. The same seed builds the same city on every load.

import {
  BLOCK, CITY_SEED, DISTRICTS, LANDMARKS, OCEAN_Y, PALETTE, ROAD_CENTERS, ROAD_WIDTH, WORLD,
  districtKeyForBlock,
} from './config.js';
import { circleRectPush, clamp, makeRng } from './util.js';

const GRID_CELL = 400;

function blockRect(col, row) {
  const x0 = ROAD_CENTERS[col] + ROAD_WIDTH / 2;
  const y0 = ROAD_CENTERS[row] + ROAD_WIDTH / 2;
  return { x: x0, y: y0, w: BLOCK - ROAD_WIDTH, h: BLOCK - ROAD_WIDTH };
}

export function buildCity() {
  const rng = makeRng(CITY_SEED);
  const city = {
    buildings: [],
    trees: [],
    lamps: [],
    props: [],
    colliders: [],
    grid: new Map(),
    landmarks: LANDMARKS,
  };

  for (let col = 0; col < 8; col++) {
    for (let row = 0; row < 8; row++) {
      const rect = blockRect(col, row);
      const key = districtKeyForBlock(col, row);
      const landmark = LANDMARKS.find((l) => l.col === col && l.row === row);
      if (landmark) {
        buildLandmark(city, landmark, rect, rng);
        continue;
      }
      if (key === 'downtown') buildTowers(city, rect, rng);
      else if (key === 'harbor') buildWarehouses(city, rect, rng);
      else if (key === 'park') buildPark(city, rect, rng);
      else if (key === 'market') buildShops(city, rect, rng);
      else if (key === 'residential') buildHouses(city, rect, rng);
      else if (key === 'beach') buildBeach(city, rect, rng);
      else buildApartments(city, rect, rng);
      scatterTrees(city, rect, rng, key === 'park' ? 14 : 5, key === 'beach' ? 'palm' : 'tree');
    }
  }

  // Street lamps at every intersection corner.
  for (const cx of ROAD_CENTERS) {
    for (const cy of ROAD_CENTERS) {
      city.lamps.push({ x: cx - ROAD_WIDTH / 2 - 6, y: cy - ROAD_WIDTH / 2 - 6 });
      city.lamps.push({ x: cx + ROAD_WIDTH / 2 + 6, y: cy + ROAD_WIDTH / 2 + 6 });
    }
  }
  // Buoys bobbing in the bay.
  for (let i = 0; i < 9; i++) {
    city.props.push({ kind: 'buoy', x: 260 + i * 380 + rng.range(-40, 40), y: OCEAN_Y + 50 + rng.range(0, 80) });
  }
  return city;
}

function indexRect(grid, rect, entry) {
  const x0 = Math.floor(rect.x / GRID_CELL);
  const x1 = Math.floor((rect.x + rect.w) / GRID_CELL);
  const y0 = Math.floor(rect.y / GRID_CELL);
  const y1 = Math.floor((rect.y + rect.h) / GRID_CELL);
  for (let gx = x0; gx <= x1; gx++) {
    for (let gy = y0; gy <= y1; gy++) {
      const key = gx + ',' + gy;
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push(entry);
    }
  }
}

function nearbyEntries(city, x, y, radius) {
  const out = [];
  const seen = new Set();
  const x0 = Math.floor((x - radius) / GRID_CELL);
  const x1 = Math.floor((x + radius) / GRID_CELL);
  const y0 = Math.floor((y - radius) / GRID_CELL);
  const y1 = Math.floor((y + radius) / GRID_CELL);
  for (let gx = x0; gx <= x1; gx++) {
    for (let gy = y0; gy <= y1; gy++) {
      const list = city.grid.get(gx + ',' + gy);
      if (!list) continue;
      for (const entry of list) {
        if (!seen.has(entry)) { seen.add(entry); out.push(entry); }
      }
    }
  }
  return out;
}

function addBuilding(city, x, y, w, h, opts) {
  const b = { x, y, w, h, kind: opts.kind || 'block', roof: opts.roof, glass: opts.glass, awning: opts.awning, label: opts.label || null };
  city.buildings.push(b);
  const collider = { x: x - 2, y: y - 2, w: w + 4, h: h + 4 };
  city.colliders.push(collider);
  indexRect(city.grid, collider, collider);
  return b;
}

function buildTowers(city, rect, rng) {
  const cols = 2;
  const rows = 2;
  const cw = rect.w / cols;
  const ch = rect.h / rows;
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const w = cw * rng.range(0.62, 0.8);
      const h = ch * rng.range(0.62, 0.8);
      addBuilding(city,
        rect.x + i * cw + (cw - w) / 2, rect.y + j * ch + (ch - h) / 2, w, h,
        { kind: 'tower', roof: rng.pick(PALETTE.towerRoof), glass: rng.pick(PALETTE.towerGlass) });
    }
  }
}

function buildWarehouses(city, rect, rng) {
  const w = rect.w * rng.range(0.7, 0.84);
  const h = rect.h * rng.range(0.5, 0.62);
  addBuilding(city, rect.x + (rect.w - w) / 2, rect.y + 18, w, h,
    { kind: 'warehouse', roof: rng.pick(PALETTE.warehouse) });
  for (let i = 0; i < 5; i++) {
    city.props.push({
      kind: rng.chance(0.5) ? 'crate' : 'barrel',
      x: rect.x + rng.range(30, rect.w - 30), y: rect.y + rect.h - rng.range(20, 70),
      color: rng.pick(['#c2573f', '#4b8ad9', '#5da56a']),
    });
  }
}

function buildShops(city, rect, rng) {
  const n = 3;
  const cw = rect.w / n;
  for (let i = 0; i < n; i++) {
    const w = cw * rng.range(0.78, 0.9);
    const h = rect.h * rng.range(0.55, 0.7);
    addBuilding(city, rect.x + i * cw + (cw - w) / 2, rect.y + (rect.h - h) / 2, w, h,
      { kind: 'shop', roof: rng.pick(PALETTE.shopWall), awning: rng.pick(PALETTE.awning) });
  }
}

function buildHouses(city, rect, rng) {
  const cols = 3;
  const rows = 2;
  const cw = rect.w / cols;
  const ch = rect.h / rows;
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const w = cw * rng.range(0.55, 0.68);
      const h = ch * rng.range(0.55, 0.68);
      addBuilding(city,
        rect.x + i * cw + (cw - w) / 2, rect.y + j * ch + (ch - h) / 2, w, h,
        { kind: 'house', roof: rng.pick(PALETTE.houseWall) });
    }
  }
}

function buildApartments(city, rect, rng) {
  const w = rect.w * rng.range(0.6, 0.72);
  const h = rect.h * rng.range(0.6, 0.72);
  addBuilding(city, rect.x + (rect.w - w) / 2, rect.y + (rect.h - h) / 2, w, h,
    { kind: 'apartment', roof: rng.pick(PALETTE.apartment), glass: rng.pick(PALETTE.towerGlass) });
  const w2 = rect.w * 0.3;
  const h2 = rect.h * 0.3;
  addBuilding(city, rect.x + 14, rect.y + 14, w2, h2,
    { kind: 'apartment', roof: rng.pick(PALETTE.apartment) });
}

function buildPark(city, rect, rng) {
  city.props.push({ kind: 'fountain', x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 });
  for (let i = 0; i < 4; i++) {
    city.props.push({
      kind: 'bench',
      x: rect.x + rect.w / 2 + (i % 2 === 0 ? -70 : 70),
      y: rect.y + rect.h / 2 + (i < 2 ? -60 : 60),
    });
  }
}

function buildBeach(city, rect, rng) {
  // Boardwalk strip at the top of the beach block, open sand below.
  const w = rect.w * 0.5;
  addBuilding(city, rect.x + (rect.w - w) / 2, rect.y + 8, w, 34,
    { kind: 'shop', roof: rng.pick(PALETTE.shopWall), awning: rng.pick(PALETTE.awning) });
}

function scatterTrees(city, rect, rng, count, kind) {
  for (let i = 0; i < count; i++) {
    const x = rect.x + rng.range(16, rect.w - 16);
    const y = rect.y + rng.range(16, rect.h - 16);
    // Keep trees out of building footprints.
    let blocked = false;
    for (const c of city.colliders) {
      if (x > c.x - 14 && x < c.x + c.w + 14 && y > c.y - 14 && y < c.y + c.h + 14) { blocked = true; break; }
    }
    if (blocked) continue;
    city.trees.push({ x, y, kind, r: kind === 'palm' ? 10 : rng.range(9, 14), color: kind === 'palm' ? PALETTE.palm : rng.pick([PALETTE.tree, PALETTE.treeDark]) });
  }
}

function buildLandmark(city, landmark, rect, rng) {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  if (landmark.kind === 'tower' || landmark.kind === 'hotel') {
    const w = rect.w * 0.55;
    const h = rect.h * 0.55;
    addBuilding(city, cx - w / 2, cy - h / 2, w, h,
      { kind: landmark.kind, roof: PALETTE.towerRoof[0], glass: PALETTE.towerGlass[0], label: landmark.name });
  } else if (landmark.kind === 'arena') {
    const w = rect.w * 0.8;
    const h = rect.h * 0.66;
    addBuilding(city, cx - w / 2, cy - h / 2, w, h,
      { kind: 'arena', roof: '#d8c9a8', label: landmark.name });
  } else if (landmark.kind === 'cranes') {
    addBuilding(city, rect.x + 20, rect.y + 20, rect.w * 0.45, rect.h * 0.5,
      { kind: 'warehouse', roof: PALETTE.warehouse[0], label: 'Harbor' });
    for (let i = 0; i < 3; i++) {
      city.props.push({ kind: 'crane', x: rect.x + rect.w * (0.62 + i * 0.14), y: rect.y + rect.h * 0.55 });
    }
  } else if (landmark.kind === 'bazaar') {
    buildShops(city, rect, rng);
    city.props.push({ kind: 'fountain', x: cx, y: cy });
  } else if (landmark.kind === 'fort') {
    const w = rect.w * 0.62;
    const h = rect.h * 0.5;
    addBuilding(city, cx - w / 2, cy - h / 2, w, h,
      { kind: 'fort', roof: '#cbb896', label: landmark.name });
  } else if (landmark.kind === 'pier') {
    // The pier is walkable planks reaching into the sea, not a collider.
    city.props.push({ kind: 'pier', x: cx, y: rect.y + rect.h - 10, w: 60, h: 120 });
  } else if (landmark.kind === 'lighthouse') {
    const w = 54;
    const h = 54;
    addBuilding(city, cx - w / 2, cy - h / 2, w, h,
      { kind: 'lighthouse', roof: '#f2ead8', label: landmark.name });
  }
  scatterTrees(city, rect, rng, 4, 'palm');
}

export function isOnRoad(city, x, y) {
  for (const c of ROAD_CENTERS) {
    if (Math.abs(x - c) <= ROAD_WIDTH / 2) return true;
    if (Math.abs(y - c) <= ROAD_WIDTH / 2) return true;
  }
  return false;
}

export function nearestRoadCenter(v) {
  let best = ROAD_CENTERS[0];
  let bestD = Infinity;
  for (const c of ROAD_CENTERS) {
    const d = Math.abs(v - c);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

export function nearestRoadPoint(x, y) {
  const cx = nearestRoadCenter(x);
  const cy = nearestRoadCenter(y);
  if (Math.abs(x - cx) <= Math.abs(y - cy)) return { x: cx, y };
  return { x, y: cy };
}

export function districtAt(x, y) {
  const col = clamp(Math.floor(x / BLOCK), 0, 7);
  const row = clamp(Math.floor(y / BLOCK), 0, 7);
  const key = districtKeyForBlock(col, row);
  return DISTRICTS[key].name;
}

function onPier(city, x, y) {
  for (const p of city.props) {
    if (p.kind === 'pier' && Math.abs(x - p.x) < p.w / 2 && y > p.y - 10 && y < p.y + p.h) return true;
  }
  return false;
}

// Keep a circle (the player on foot) inside the walkable world.
export function collideCircle(city, circle) {
  circle.x = clamp(circle.x, circle.radius, WORLD - circle.radius);
  circle.y = clamp(circle.y, circle.radius, WORLD - circle.radius);
  if (circle.y + circle.radius > OCEAN_Y && !onPier(city, circle.x, circle.y)) {
    circle.y = OCEAN_Y - circle.radius;
  }
  for (const rect of nearbyEntries(city, circle.x, circle.y, 60)) {
    circleRectPush(circle, rect);
  }
}

// Keep a car out of buildings; returns true when a wall was hit.
export function collideCar(city, car, halfLen, halfWid) {
  let hit = false;
  car.x = clamp(car.x, halfLen, WORLD - halfLen);
  car.y = clamp(car.y, halfLen, WORLD - halfLen);
  if (car.y + halfLen > OCEAN_Y && !onPier(city, car.x, car.y)) {
    car.y = OCEAN_Y - halfLen;
    hit = true;
  }
  const corners = [
    { dx: halfLen, dy: halfWid }, { dx: halfLen, dy: -halfWid },
    { dx: -halfLen, dy: halfWid }, { dx: -halfLen, dy: -halfWid },
  ];
  const cos = Math.cos(car.angle);
  const sin = Math.sin(car.angle);
  for (const corner of corners) {
    const wx = car.x + corner.dx * cos - corner.dy * sin;
    const wy = car.y + corner.dx * sin + corner.dy * cos;
    const probe = { x: wx, y: wy, radius: 6 };
    for (const rect of nearbyEntries(city, wx, wy, 40)) {
      if (circleRectPush(probe, rect)) {
        car.x += probe.x - wx;
        car.y += probe.y - wy;
        hit = true;
      }
    }
  }
  return hit;
}

export function randomRoadPoint(city, rng, nearX, nearY, minD, maxD) {
  for (let tries = 0; tries < 24; tries++) {
    const vertical = rng.chance(0.5);
    const c = rng.pick(ROAD_CENTERS);
    const along = rng.range(120, WORLD - 120);
    const point = vertical ? { x: c, y: along } : { x: along, y: c };
    if (nearX === undefined) return point;
    const d = Math.hypot(point.x - nearX, point.y - nearY);
    if (d >= minD && d <= maxD) return point;
  }
  return { x: ROAD_CENTERS[4], y: ROAD_CENTERS[4] };
}

export function randomSidewalkPoint(city, rng) {
  const col = rng.int(0, 7);
  const row = rng.int(0, 7);
  const rect = blockRect(col, row);
  const side = rng.int(0, 3);
  const inset = ROAD_WIDTH / 2 + 8;
  if (side === 0) return { x: rng.range(rect.x, rect.x + rect.w), y: rect.y - inset + 14 };
  if (side === 1) return { x: rng.range(rect.x, rect.x + rect.w), y: rect.y + rect.h + inset - 14 };
  if (side === 2) return { x: rect.x - inset + 14, y: rng.range(rect.y, rect.y + rect.h) };
  return { x: rect.x + rect.w + inset - 14, y: rng.range(rect.y, rect.y + rect.h) };
}

export function buildingsInView(city, x0, y0, x1, y1) {
  return city.buildings.filter((b) => b.x + b.w > x0 && b.x < x1 && b.y + b.h > y0 && b.y < y1);
}
