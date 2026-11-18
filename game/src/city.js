// San Cielo Heat — the city itself: a fixed-seed grid of roads, blocks,
// buildings, trees and landmarks, plus the collision and road queries
// every moving system asks.

import { BLOCK, CITY_SEED, DISTRICTS, LANDMARKS, OCEAN_Y, PALETTE, ROAD_CENTERS, ROAD_WIDTH, WORLD, districtKeyForBlock } from './config.js';
import { circleRectPush, clamp, makeRng, pointInRect } from './util.js';

const HALF_ROAD = ROAD_WIDTH / 2;
const GRID_CELL = 200;

function blockRect(col, row) {
  return {
    x: ROAD_CENTERS[col] + HALF_ROAD,
    y: ROAD_CENTERS[row] + HALF_ROAD,
    w: BLOCK - ROAD_WIDTH,
    h: BLOCK - ROAD_WIDTH,
  };
}

export function buildCity() {
  const rng = makeRng(CITY_SEED);
  const city = {
    buildings: [],
    trees: [],
    lamps: [],
    benches: [],
    landmarks: [],
    roadCenters: ROAD_CENTERS.slice(),
    grid: new Map(),
  };

  // ---- buildings, one recipe per district ----
  for (let col = 0; col < 8; col++) {
    for (let row = 0; row < 8; row++) {
      const key = districtKeyForBlock(col, row);
      const rect = blockRect(col, row);
      const landmark = LANDMARKS.find((l) => l.col === col && l.row === row);
      if (landmark) {
        buildLandmark(city, landmark, rect, rng);
        continue;
      }
      if (key === 'park') {
        buildPark(city, rect, rng);
      } else if (key === 'beach') {
        buildBeach(city, rect, rng);
      } else if (key === 'downtown') {
        buildTowers(city, rect, rng);
      } else if (key === 'harbor') {
        buildWarehouses(city, rect, rng);
      } else if (key === 'market') {
        buildShops(city, rect, rng);
      } else if (key === 'residential') {
        buildHouses(city, rect, rng);
      } else {
        buildApartments(city, rect, rng);
      }
    }
  }

  // ---- street lamps at every intersection corner ----
  for (const cx of ROAD_CENTERS) {
    for (const cy of ROAD_CENTERS) {
      city.lamps.push({ x: cx - HALF_ROAD - 8, y: cy - HALF_ROAD - 8 });
      city.lamps.push({ x: cx + HALF_ROAD + 8, y: cy + HALF_ROAD + 8 });
    }
  }

  // ---- spatial hash for collision queries ----
  for (const b of city.buildings) indexRect(city.grid, b, { kind: 'building', ref: b });
  for (const t of city.trees) {
    indexRect(city.grid, { x: t.x - 8, y: t.y - 8, w: 16, h: 16 }, { kind: 'tree', ref: t });
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
      let list = grid.get(key);
      if (!list) { list = []; grid.set(key, list); }
      list.push(entry);
    }
  }
}

function nearbyEntries(city, x, y, radius) {
  const out = [];
  const x0 = Math.floor((x - radius) / GRID_CELL);
  const x1 = Math.floor((x + radius) / GRID_CELL);
  const y0 = Math.floor((y - radius) / GRID_CELL);
  const y1 = Math.floor((y + radius) / GRID_CELL);
  const seen = new Set();
  for (let gx = x0; gx <= x1; gx++) {
    for (let gy = y0; gy <= y1; gy++) {
      const list = city.grid.get(gx + ',' + gy);
      if (!list) continue;
      for (const e of list) {
        if (!seen.has(e.ref)) { seen.add(e.ref); out.push(e); }
      }
    }
  }
  return out;
}

function addBuilding(city, x, y, w, h, opts) {
  const b = {
    x, y, w, h,
    hgt: opts.hgt || 18,
    wall: opts.wall,
    roof: opts.roof || opts.wall,
    kind: opts.kind || 'block',
    district: opts.district,
    name: opts.name || null,
    awning: opts.awning || null,
    windows: opts.windows !== false,
  };
  city.buildings.push(b);
  return b;
}

function buildTowers(city, rect, rng) {
  const n = rng.int(1, 2);
  for (let i = 0; i < n; i++) {
    const w = rng.range(90, 150);
    const h = rng.range(90, 150);
    const x = rect.x + 20 + (i * (rect.w - 40 - w)) / Math.max(1, n - 1) + (n === 1 ? (rect.w - 40 - w) / 2 : 0);
    const y = rect.y + (rect.h - h) / 2 + rng.range(-20, 20);
    addBuilding(city, x, y, w, h, {
      hgt: rng.range(60, 120),
      wall: rng.pick(PALETTE.towerGlass),
      roof: rng.pick(PALETTE.towerRoof),
      kind: 'tower',
      district: 'downtown',
    });
  }
  scatterTrees(city, rect, rng, 2, 'leaf');
}

function buildWarehouses(city, rect, rng) {
  const w = rect.w - 50;
  const h = rng.range(90, 130);
  addBuilding(city, rect.x + 25, rect.y + (rect.h - h) / 2, w, h, {
    hgt: 26,
    wall: rng.pick(PALETTE.warehouse),
    kind: 'warehouse',
    district: 'harbor',
    windows: false,
  });
  for (let i = 0; i < 3; i++) {
    city.benches.push({ x: rect.x + 30 + i * 90, y: rect.y + rect.h - 26, kind: 'crate' });
  }
}

function buildShops(city, rect, rng) {
  const n = rng.int(3, 4);
  const gap = 14;
  const w = (rect.w - 30 - gap * (n - 1)) / n;
  for (let i = 0; i < n; i++) {
    const h = rng.range(70, 110);
    addBuilding(city, rect.x + 15 + i * (w + gap), rect.y + 30, w, h, {
      hgt: 20,
      wall: rng.pick(PALETTE.shopWall),
      kind: 'shop',
      district: 'market',
      awning: rng.pick(PALETTE.awning),
    });
  }
  scatterTrees(city, { x: rect.x, y: rect.y + rect.h - 60, w: rect.w, h: 50 }, rng, 3, 'palm');
}

function buildHouses(city, rect, rng) {
  for (let ix = 0; ix < 2; ix++) {
    for (let iy = 0; iy < 2; iy++) {
      if (rng.chance(0.12)) continue; // an empty lot keeps the block airy
      const w = rng.range(70, 95);
      const h = rng.range(60, 85);
      addBuilding(city, rect.x + 24 + ix * (rect.w / 2) + rng.range(0, 20), rect.y + 24 + iy * (rect.h / 2) + rng.range(0, 20), w, h, {
        hgt: 16,
        wall: rng.pick(PALETTE.houseWall),
        roof: rng.pick(['#c96f4a', '#b8573f', '#8a6f52', '#a85f43']),
        kind: 'house',
        district: 'residential',
      });
    }
  }
  scatterTrees(city, rect, rng, 4, 'leaf');
}

function buildApartments(city, rect, rng) {
  const n = rng.int(2, 3);
  for (let i = 0; i < n; i++) {
    const w = rng.range(80, 120);
    const h = rng.range(80, 120);
    addBuilding(city, rect.x + 18 + (i % 2) * (rect.w / 2), rect.y + 18 + Math.floor(i / 2) * (rect.h / 2), w, h, {
      hgt: rng.range(28, 48),
      wall: rng.pick(PALETTE.apartment),
      kind: 'apartment',
      district: 'midtown',
    });
  }
  scatterTrees(city, rect, rng, 2, 'leaf');
}

function buildPark(city, rect, rng) {
  // A pond in the middle, paths implied by the ground, trees everywhere.
  const pond = { x: rect.x + rect.w / 2 - 55, y: rect.y + rect.h / 2 - 40, w: 110, h: 80, kind: 'pond' };
  city.benches.push(pond);
  scatterTrees(city, rect, rng, 16, 'leaf');
  for (let i = 0; i < 4; i++) {
    city.benches.push({ x: rect.x + 30 + rng.range(0, rect.w - 60), y: rect.y + 30 + rng.range(0, rect.h - 60), kind: 'bench' });
  }
}

function buildBeach(city, rect, rng) {
  scatterTrees(city, rect, rng, 7, 'palm');
  for (let i = 0; i < 2; i++) {
    addBuilding(city, rect.x + 30 + i * 130, rect.y + 40, 70, 55, {
      hgt: 14,
      wall: rng.pick(PALETTE.houseWall),
      kind: 'shack',
      district: 'beach',
      awning: rng.pick(PALETTE.awning),
    });
  }
}

function scatterTrees(city, rect, rng, count, kind) {
  for (let i = 0; i < count; i++) {
    const x = rect.x + rng.range(14, rect.w - 14);
    const y = rect.y + rng.range(14, rect.h - 14);
    if (city.buildings.some((b) => pointInRect(x, y, { x: b.x - 12, y: b.y - 12, w: b.w + 24, h: b.h + 24 }))) continue;
    city.trees.push({ x, y, r: kind === 'palm' ? rng.range(9, 12) : rng.range(11, 16), kind, sway: rng.range(0, Math.PI * 2) });
  }
}

function buildLandmark(city, landmark, rect, rng) {
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  let b = null;
  if (landmark.kind === 'tower') {
    b = addBuilding(city, cx - 70, cy - 70, 140, 140, { hgt: 150, wall: PALETTE.towerGlass[0], roof: '#f2e8d0', kind: 'tower', district: 'downtown', name: landmark.name });
  } else if (landmark.kind === 'hotel') {
    b = addBuilding(city, cx - 90, cy - 55, 180, 110, { hgt: 70, wall: '#f2e2c4', roof: '#e8d3ac', kind: 'hotel', district: 'downtown', name: landmark.name });
  } else if (landmark.kind === 'arena') {
    b = addBuilding(city, cx - 110, cy - 85, 220, 170, { hgt: 34, wall: '#d9c9a8', roof: '#c4b193', kind: 'arena', district: 'midtown', name: landmark.name, windows: false });
  } else if (landmark.kind === 'cranes') {
    b = addBuilding(city, cx - 100, cy - 60, 200, 120, { hgt: 24, wall: PALETTE.warehouse[1], kind: 'warehouse', district: 'harbor', name: landmark.name, windows: false });
    city.benches.push({ x: cx - 120, y: cy - 90, kind: 'crane' });
    city.benches.push({ x: cx + 90, y: cy - 90, kind: 'crane' });
  } else if (landmark.kind === 'bazaar') {
    b = addBuilding(city, cx - 110, cy - 70, 220, 140, { hgt: 24, wall: '#ecd9b4', roof: '#d9b878', kind: 'bazaar', district: 'market', name: landmark.name, awning: '#d95f4b' });
  } else if (landmark.kind === 'fort') {
    b = addBuilding(city, cx - 80, cy - 60, 160, 120, { hgt: 30, wall: '#cbb894', roof: '#b39d78', kind: 'fort', district: 'beach', name: landmark.name, windows: false });
  } else if (landmark.kind === 'pier') {
    b = addBuilding(city, cx - 60, cy - 50, 120, 100, { hgt: 16, wall: '#e8d3ac', kind: 'shack', district: 'beach', name: landmark.name, awning: '#4b8ad9' });
    city.benches.push({ x: cx - 26, y: rect.y + rect.h, w: 52, h: OCEAN_Y + 130 - (rect.y + rect.h), kind: 'pier' });
  } else if (landmark.kind === 'lighthouse') {
    b = addBuilding(city, cx - 26, cy - 26, 52, 52, { hgt: 90, wall: '#f2ead8', roof: '#d95f4b', kind: 'lighthouse', district: 'beach', name: landmark.name, windows: false });
  }
  if (b) city.landmarks.push({ name: landmark.name, kind: landmark.kind, x: b.x + b.w / 2, y: b.y + b.h / 2, w: b.w, h: b.h });
  scatterTrees(city, rect, rng, 3, landmark.kind === 'pier' || landmark.kind === 'lighthouse' || landmark.kind === 'fort' ? 'palm' : 'leaf');
}

// ---- queries ----

export function isOnRoad(city, x, y) {
  for (const c of city.roadCenters) {
    if (Math.abs(x - c) <= HALF_ROAD || Math.abs(y - c) <= HALF_ROAD) {
      if (Math.abs(x - c) <= HALF_ROAD && y >= 0 && y <= WORLD) return true;
      if (Math.abs(y - c) <= HALF_ROAD && x >= 0 && x <= WORLD) return true;
    }
  }
  return false;
}

export function nearestRoadCenter(v) {
  let best = ROAD_CENTERS[0];
  let bestD = Math.abs(v - best);
  for (const c of ROAD_CENTERS) {
    const d = Math.abs(v - c);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

// Snap a point to the closest point on the road network.
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
  return city.benches.some((p) => p.kind === 'pier' && x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h);
}

// Push a circle out of every solid thing: buildings, trees, the sea,
// the world edge. Returns true when anything pushed.
export function collideCircle(city, circle) {
  let hit = false;
  circle.x = clamp(circle.x, circle.radius, WORLD - circle.radius);
  circle.y = clamp(circle.y, circle.radius, WORLD - circle.radius);
  if (circle.y + circle.radius > OCEAN_Y && !onPier(city, circle.x, circle.y)) {
    circle.y = OCEAN_Y - circle.radius;
    hit = true;
  }
  for (const e of nearbyEntries(city, circle.x, circle.y, circle.radius + 20)) {
    if (e.kind === 'building') {
      if (circleRectPush(circle, e.ref)) hit = true;
    } else if (e.kind === 'tree') {
      const dx = circle.x - e.ref.x;
      const dy = circle.y - e.ref.y;
      const rr = circle.radius + 6;
      const d2 = dx * dx + dy * dy;
      if (d2 < rr * rr && d2 > 0.001) {
        const d = Math.sqrt(d2);
        circle.x = e.ref.x + (dx / d) * rr;
        circle.y = e.ref.y + (dy / d) * rr;
        hit = true;
      }
    }
  }
  return hit;
}

// A car is two circles, nose and tail. Push both out, report the impact.
export function collideCar(city, car, halfLen, halfWid) {
  const cos = Math.cos(car.angle);
  const sin = Math.sin(car.angle);
  let hit = false;
  for (const along of [halfLen * 0.55, -halfLen * 0.55]) {
    const probe = { x: car.x + cos * along, y: car.y + sin * along, radius: halfWid };
    if (collideCircle(city, probe)) {
      // Move the car body by the same correction the probe received.
      car.x += probe.x - (car.x + cos * along);
      car.y += probe.y - (car.y + sin * along);
      hit = true;
    }
  }
  return hit;
}

export function randomRoadPoint(city, rng, nearX, nearY, minD, maxD) {
  for (let tries = 0; tries < 40; tries++) {
    const vertical = rng.chance(0.5);
    const c = rng.pick(city.roadCenters);
    const along = rng.range(60, WORLD - 60);
    const x = vertical ? c : along;
    const y = vertical ? along : c;
    const d = Math.hypot(x - nearX, y - nearY);
    if (d >= minD && d <= maxD && y < OCEAN_Y - 40) return { x, y };
  }
  return { x: ROAD_CENTERS[4], y: ROAD_CENTERS[4] };
}

export function randomSidewalkPoint(city, rng) {
  for (let tries = 0; tries < 30; tries++) {
    const x = rng.range(80, WORLD - 80);
    const y = rng.range(80, OCEAN_Y - 80);
    if (isOnRoad(city, x, y)) continue;
    const probe = { x, y, radius: 14 };
    const before = { x, y };
    collideCircle(city, probe);
    if (probe.x === before.x && probe.y === before.y) return { x, y };
  }
  return { x: 700, y: 700 };
}

export function buildingsInView(city, x0, y0, x1, y1) {
  return city.buildings.filter((b) => b.x + b.w >= x0 && b.x <= x1 && b.y + b.h >= y0 && b.y <= y1);
}
