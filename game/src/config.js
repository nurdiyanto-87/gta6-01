// Solmar Heat — world constants, palette and small math helpers.
// Every tunable number for the city, the cars and the chase lives here so the
// rest of the game reads like a design document instead of magic numbers.

export const WORLD = 3200; // the city is a square, WORLD x WORLD pixels
export const ROAD_WIDTH = 96;
export const ROAD_CENTERS = [200, 600, 1000, 1400, 1800, 2200, 2600, 3000];
export const BLOCK = 400; // distance between neighbouring road centres

// Districts, by block column / row. Each block is BLOCK wide, indexed 0..7.
export const DISTRICTS = {
  downtown: { cols: [2, 3, 4, 5], rows: [0, 1, 2] },
  beach: { cols: [0, 1, 2, 3, 4, 5, 6, 7], rows: [7] },
  park: { cols: [3], rows: [3] },
  industrial: { cols: [6, 7], rows: [0, 1, 2, 3] },
  residential: { cols: [0, 1], rows: [0, 1, 2, 3, 4, 5, 6] },
};

// Sun-soaked palette: warm asphalt, pale sidewalks, pastel walls.
export const PALETTE = {
  grass: '#7fae56',
  grassDark: '#6f9c4a',
  sand: '#ecd9a0',
  ocean: '#3d9db8',
  oceanDeep: '#2e86a3',
  asphalt: '#4a4a52',
  asphaltDark: '#41414a',
  sidewalk: '#c9c2b4',
  sidewalkEdge: '#b3ab99',
  curb: '#9d9687',
  line: '#e8e3d3',
  centerLine: '#f2c14e',
  buildingRoof: ['#e8dcc8', '#d9c7a7', '#cbb9a0', '#e3d5c0', '#d6cfc0'],
  buildingWall: ['#f2e6d0', '#e6d3b3', '#dcc7a8', '#efe3cc', '#e0d2b8'],
  towerGlass: ['#7fb3c8', '#6fa8bf', '#8fbccd'],
  houseWall: ['#f5e0c0', '#f0cfa8', '#e8d8b8', '#f2d7b8'],
  warehouse: ['#c8b8a0', '#b8a890', '#d0c0a8'],
  tree: '#4d8a3f',
  treeDark: '#3f7a34',
  palm: '#5da244',
  water: '#3d9db8',
};

export const TUNING = {
  playerWalk: 170,
  playerRun: 265,
  playerRadius: 13,
  carAccel: 340,
  carBrake: 520,
  carReverseMax: 130,
  carDrag: 0.55,
  carGrip: 3.4,
  handbrakeGrip: 1.15,
  pedWalk: 55,
  pedFlee: 150,
  trafficSpeed: 120,
  policeSpeed: 330,
  bulletSpeed: 900,
  gravity: 0, // top-down world: no gravity, kept for clarity
  maxWanted: 5,
  bustTime: 2.2, // seconds a cop must stay close while you crawl
  evadeTime: 9, // seconds unseen before one star drops
  repaintCost: 150,
  startMoney: 150,
};

// ---- small math helpers shared by every system ----
export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function rand(lo, hi) { return lo + Math.random() * (hi - lo); }
export function randi(lo, hi) { return Math.floor(rand(lo, hi + 1)); }
export function choice(list) { return list[Math.floor(Math.random() * list.length)]; }
export function dist(x1, y1, x2, y2) { return Math.hypot(x2 - x1, y2 - y1); }
export function dist2(x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  return dx * dx + dy * dy;
}
export function angleTo(x1, y1, x2, y2) { return Math.atan2(y2 - y1, x2 - x1); }
export function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
export function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
// Push a circle out of a rectangle. Returns true when a push happened.
export function circleRectPush(circle, rect) {
  const nx = clamp(circle.x, rect.x, rect.x + rect.w);
  const ny = clamp(circle.y, rect.y, rect.y + rect.h);
  const dx = circle.x - nx, dy = circle.y - ny;
  const d2 = dx * dx + dy * dy;
  const r = circle.radius;
  if (d2 >= r * r) return false;
  if (d2 > 0.0001) {
    const d = Math.sqrt(d2);
    circle.x = nx + (dx / d) * r;
    circle.y = ny + (dy / d) * r;
  } else {
    // Centre inside the rectangle: push out along the smallest overlap.
    const left = circle.x - rect.x, right = rect.x + rect.w - circle.x;
    const top = circle.y - rect.y, bottom = rect.y + rect.h - circle.y;
    const m = Math.min(left, right, top, bottom);
    if (m === left) circle.x = rect.x - r;
    else if (m === right) circle.x = rect.x + rect.w + r;
    else if (m === top) circle.y = rect.y - r;
    else circle.y = rect.y + rect.h + r;
  }
  return true;
}
export function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
export function formatMoney(n) { return '$' + Math.floor(n).toLocaleString('en-US'); }
export function formatTime(sec) {
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return m + ':' + String(s).padStart(2, '0');
}
