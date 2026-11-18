// Solmar Heat — the city of Port Solmar.
// A fixed-seed generator lays out the same city every run: a road grid, five
// districts, named landmarks, trees, lamps and props, plus the collision
// queries every moving thing in the game asks.

import { WORLD, ROAD_WIDTH, ROAD_CENTERS, PALETTE, rand, randi, choice, clamp } from './config.js';

// Deterministic random so the city never changes between runs.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const BEACH_TOP = 2952;
export const OCEAN_TOP = 3112;
export const PIER = { x: 1556, y: 2940, w: 88, h: 240 };

const LANDMARKS = [
  { id: 'diner', name: "Rosa's Diner", block: [1, 1], color: '#e85d5d', sign: "ROSA'S" },
  { id: 'garage', name: "Prado's Garage", block: [5, 4], color: '#e8a13d', sign: 'GARAGE' },
  { id: 'police', name: 'Solmar PD', block: [4, 1], color: '#5d7fa8', sign: 'POLICE' },
  { id: 'hospital', name: 'Solmar General', block: [2, 4], color: '#e8e8e8', sign: 'HOSPITAL' },
  { id: 'motel', name: 'Sandy Palms Motel', block: [1, 5], color: '#e8c85d', sign: 'MOTEL' },
  { id: 'warehouse', name: 'Kroll Warehouse', block: [6, 1], color: '#8a7a66', sign: 'KROLL' },
  { id: 'tower', name: 'Kroll Tower', block: [3, 1], color: '#7fb3c8', sign: 'KROLL TOWER' },
  { id: 'safehouse', name: 'Leo\'s Safehouse', block: [0, 4], color: '#f5e0c0', sign: 'HOME' },
];

function blockRect(col, row) {
  return {
    x: ROAD_CENTERS[col] + ROAD_WIDTH / 2,
    y: ROAD_CENTERS[row] + ROAD_WIDTH / 2,
    w: 400 - ROAD_WIDTH,
    h: 400 - ROAD_WIDTH,
  };
}

function districtOf(col, row) {
  if (row === 6) return 'beach';
  if (col === 3 && row === 3) return 'park';
  if (col >= 2 && col <= 4 && row <= 2) return 'downtown';
  if (col >= 5 && row <= 2) return 'industrial';
  if (col <= 1) return 'residential';
  return 'commercial';
}

export function buildCity() {
  const rng = mulberry32(20261117);
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  const rrange = (lo, hi) => lo + rng() * (hi - lo);
  const rint = (lo, hi) => Math.floor(rrange(lo, hi + 1));

  const buildings = [];
  const props = [];
  const parks = [];
  const landmarks = {};
  let seed = 1;

  for (let col = 0; col < 7; col++) {
    for (let row = 0; row < 7; row++) {
      const district = districtOf(col, row);
      const br = blockRect(col, row);
      const landmark = LANDMARKS.find((l) => l.block[0] === col && l.block[1] === row);

      if (district === 'park') {
        // Central park: lawn, pond, paths, many trees, no buildings.
        parks.push({ x: br.x, y: br.y, w: br.w, h: br.h });
        for (let i = 0; i < 26; i++) {
          props.push({
            kind: 'tree', x: br.x + rrange(20, br.w - 20), y: br.y + rrange(20, br.h - 20),
            r: rrange(10, 15), seed: seed++,
          });
        }
        props.push({ kind: 'pond', x: br.x + br.w / 2, y: br.y + br.h / 2, r: 52, seed: seed++ });
        for (let i = 0; i < 6; i++) {
          props.push({
            kind: 'bench', x: br.x + rrange(30, br.w - 30), y: br.y + rrange(30, br.h - 30),
            angle: rrange(0, Math.PI), seed: seed++,
          });
        }
        continue;
      }
      if (district === 'beach') {
        // Boardwalk blocks: palms, beach huts, volleyball nets, no tall buildings.
        for (let i = 0; i < 8; i++) {
          props.push({
            kind: 'palm', x: br.x + rrange(16, br.w - 16), y: br.y + rrange(16, br.h - 16),
            r: 9, seed: seed++,
          });
        }
        if (col % 2 === 0) {
          buildings.push(makeBuilding(br.x + 40, br.y + 90, 120, 90, '#f2e6d0', '#e8dcc8', 1, 'hut', null, seed++));
        }
        props.push({ kind: 'umbrella', x: br.x + br.w / 2, y: br.y + 210, r: 10, seed: seed++ });
        continue;
      }

      if (landmark) {
        const w = landmark.id === 'tower' ? 150 : landmark.id === 'warehouse' ? 230 : 170;
        const h = landmark.id === 'tower' ? 150 : landmark.id === 'warehouse' ? 130 : 120;
        const b = makeBuilding(
          br.x + (br.w - w) / 2, br.y + (br.h - h) / 2, w, h,
          landmark.color, landmark.color, landmark.id === 'tower' ? 9 : 2,
          landmark.id === 'tower' ? 'tower' : 'landmark', landmark, seed++,
        );
        buildings.push(b);
        landmarks[landmark.id] = {
          ...landmark, x: b.x + b.w / 2, y: b.y + b.h / 2, doorX: b.x + b.w / 2, doorY: b.y + b.h + 14,
        };
        // A couple of trees flanking the landmark.
        props.push({ kind: 'tree', x: br.x + 24, y: br.y + 24, r: 11, seed: seed++ });
        props.push({ kind: 'tree', x: br.x + br.w - 24, y: br.y + br.h - 24, r: 11, seed: seed++ });
        continue;
      }

      if (district === 'downtown') {
        const n = rint(1, 2);
        for (let i = 0; i < n; i++) {
          const w = rrange(90, 150), h = rrange(90, 150);
          const x = br.x + 20 + (n === 1 ? (br.w - w) / 2 - 20 : i * (br.w - w - 40));
          const y = br.y + (br.h - h) / 2;
          const glass = rng() < 0.6;
          buildings.push(makeBuilding(x, y, w, h,
            glass ? pick(PALETTE.towerGlass) : pick(PALETTE.buildingWall),
            glass ? '#5d93a8' : pick(PALETTE.buildingRoof),
            rint(4, 8), glass ? 'tower' : 'office', null, seed++));
        }
      } else if (district === 'industrial') {
        const w = rrange(180, 240), h = rrange(110, 150);
        buildings.push(makeBuilding(br.x + (br.w - w) / 2, br.y + (br.h - h) / 2, w, h,
          pick(PALETTE.warehouse), '#a89880', 1, 'warehouse', null, seed++));
        for (let i = 0; i < 5; i++) {
          props.push({
            kind: 'crate', x: br.x + rrange(16, br.w - 16), y: br.y + rrange(16, br.h - 16),
            r: 9, angle: rrange(0, Math.PI), seed: seed++,
          });
        }
      } else if (district === 'residential') {
        for (let i = 0; i < 4; i++) {
          const w = rrange(70, 95), h = rrange(60, 85);
          const x = br.x + 24 + (i % 2) * (br.w / 2);
          const y = br.y + 24 + Math.floor(i / 2) * (br.h / 2);
          buildings.push(makeBuilding(x, y, w, h, pick(PALETTE.houseWall), '#b8764a', 1, 'house', null, seed++));
          props.push({ kind: 'tree', x: x + w + 16, y: y + 10, r: 10, seed: seed++ });
        }
      } else {
        // Commercial: shops with awnings along the block.
        const n = rint(2, 3);
        for (let i = 0; i < n; i++) {
          const w = (br.w - 60) / n, h = rrange(90, 130);
          buildings.push(makeBuilding(
            br.x + 30 + i * w, br.y + (br.h - h) / 2, w - 14, h,
            pick(PALETTE.buildingWall), pick(PALETTE.buildingRoof), rint(1, 3), 'shop', null, seed++));
        }
      }
    }
  }

  // Street lamps along every road, hydrants and bus stops here and there.
  for (const cx of ROAD_CENTERS) {
    for (let y = 300; y < WORLD - 200; y += 400) {
      props.push({ kind: 'lamp', x: cx + ROAD_WIDTH / 2 + 8, y, r: 5, seed: seed++ });
      props.push({ kind: 'lamp', x: cx - ROAD_WIDTH / 2 - 8, y: y + 200, r: 5, seed: seed++ });
    }
  }
  for (let i = 0; i < 14; i++) {
    const cx = pick(ROAD_CENTERS), cy = pick(ROAD_CENTERS);
    props.push({ kind: 'hydrant', x: cx + ROAD_WIDTH / 2 + 10, y: cy + rrange(-120, 120), r: 5, seed: seed++ });
  }
  // Marina on the west edge: docks and boats (decorative, over the water strip).
  for (let i = 0; i < 4; i++) {
    props.push({ kind: 'boat', x: 60 + (i % 2) * 40, y: 1150 + i * 130, r: 16, angle: Math.PI / 2, seed: seed++ });
  }
  // Pier props.
  props.push({ kind: 'pierhut', x: PIER.x + PIER.w / 2, y: PIER.y + PIER.h - 30, r: 18, seed: seed++ });

  return { buildings, props, landmarks, parks, seed, BEACH_TOP, OCEAN_TOP, PIER };
}

function makeBuilding(x, y, w, h, color, roof, height, type, landmark, seed) {
  return {
    x, y, w, h, color, roof, height, type, landmark, seed,
    cx: x + w / 2, cy: y + h / 2,
  };
}

// ---- queries ----

export function isOnRoad(x, y) {
  for (const c of ROAD_CENTERS) {
    if (Math.abs(x - c) < ROAD_WIDTH / 2) return true;
    if (Math.abs(y - c) < ROAD_WIDTH / 2) return true;
  }
  return false;
}

export function nearestRoadPoint(x, y) {
  let best = null, bestD = Infinity;
  for (const c of ROAD_CENTERS) {
    const d1 = Math.abs(x - c), d2 = Math.abs(y - c);
    if (d1 < bestD) { bestD = d1; best = { x: c, y }; }
    if (d2 < bestD) { bestD = d2; best = { x, y: c }; }
  }
  return best;
}

export function nearestIntersection(x, y) {
  let bx = ROAD_CENTERS[0], by = ROAD_CENTERS[0], bd = Infinity;
  for (const cx of ROAD_CENTERS) for (const cy of ROAD_CENTERS) {
    const d = (cx - x) ** 2 + (cy - y) ** 2;
    if (d < bd) { bd = d; bx = cx; by = cy; }
  }
  return { x: bx, y: by };
}

export function isInOcean(x, y) {
  if (y < OCEAN_TOP) return false;
  if (x >= PIER.x && x <= PIER.x + PIER.w && y >= PIER.y && y <= PIER.y + PIER.h) return false;
  return true;
}

// Push a circle out of buildings, solid props, the ocean and the world edge.
// Returns true when the circle was pushed (a collision happened).
export function collideCircle(city, circle) {
  let hit = false;
  for (const b of city.buildings) {
    if (circle.x + circle.radius < b.x || circle.x - circle.radius > b.x + b.w ||
        circle.y + circle.radius < b.y || circle.y - circle.radius > b.y + b.h) continue;
    // Circle-vs-rectangle push-out, done inline for speed.
    const nx = clamp(circle.x, b.x, b.x + b.w);
    const ny = clamp(circle.y, b.y, b.y + b.h);
    const dx = circle.x - nx, dy = circle.y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 >= circle.radius * circle.radius) continue;
    hit = true;
    if (d2 > 0.001) {
      const d = Math.sqrt(d2);
      circle.x = nx + (dx / d) * circle.radius;
      circle.y = ny + (dy / d) * circle.radius;
    } else {
      const left = circle.x - b.x, right = b.x + b.w - circle.x;
      const top = circle.y - b.y, bottom = b.y + b.h - circle.y;
      const m = Math.min(left, right, top, bottom);
      if (m === left) circle.x = b.x - circle.radius;
      else if (m === right) circle.x = b.x + b.w + circle.radius;
      else if (m === top) circle.y = b.y - circle.radius;
      else circle.y = b.y + b.h + circle.radius;
    }
  }
  for (const p of city.props) {
    if (p.kind !== 'tree' && p.kind !== 'palm' && p.kind !== 'lamp' && p.kind !== 'crate') continue;
    const dx = circle.x - p.x, dy = circle.y - p.y;
    const rr = circle.radius + p.r * 0.5;
    const d2 = dx * dx + dy * dy;
    if (d2 >= rr * rr || d2 < 0.001) continue;
    const d = Math.sqrt(d2);
    circle.x = p.x + (dx / d) * rr;
    circle.y = p.y + (dy / d) * rr;
    hit = true;
  }
  if (isInOcean(circle.x, circle.y)) {
    circle.y = OCEAN_TOP - circle.radius;
    hit = true;
  }
  const m = circle.radius;
  if (circle.x < m) { circle.x = m; hit = true; }
  if (circle.x > WORLD - m) { circle.x = WORLD - m; hit = true; }
  if (circle.y < m) { circle.y = m; hit = true; }
  if (circle.y > WORLD - m) { circle.y = WORLD - m; hit = true; }
  return hit;
}

// A random point on a sidewalk ring (for pedestrians).
export function randomSidewalkPoint() {
  const col = randi(0, 6), row = randi(0, 6);
  const br = blockRect(col, row);
  const inset = 14;
  const side = randi(0, 3);
  if (side === 0) return { x: br.x + rand(0, br.w), y: br.y - inset };
  if (side === 1) return { x: br.x + rand(0, br.w), y: br.y + br.h + inset };
  if (side === 2) return { x: br.x - inset, y: br.y + rand(0, br.h) };
  return { x: br.x + br.w + inset, y: br.y + rand(0, br.h) };
}

// A random point on a road centre line (for traffic and parked cars).
export function randomRoadPoint() {
  const vertical = Math.random() < 0.5;
  const c = choice(ROAD_CENTERS);
  const along = rand(120, WORLD - 320);
  return vertical ? { x: c, y: along } : { x: along, y: c };
}
