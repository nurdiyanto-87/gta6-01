// San Cielo Heat — world layout, districts, palette and tuning numbers.
// One file holds every constant that shapes the city and the chase.

export const WORLD = 3600; // the city is a square, WORLD x WORLD pixels
export const ROAD_WIDTH = 84;
export const BLOCK = 400; // distance between neighbouring road centres
export const ROAD_CENTERS = [180, 580, 980, 1380, 1780, 2180, 2580, 2980, 3380];
export const OCEAN_Y = 3432; // below the last road the sand meets the sea
export const CITY_SEED = 20261117;

// Blocks are the 8x8 squares between roads, indexed col 0..7, row 0..7.
export const DISTRICTS = {
  downtown: { name: 'Downtown', cols: [3, 4], rows: [0, 1, 2] },
  harbor: { name: 'Harbor', cols: [6, 7], rows: [0, 1] },
  park: { name: 'Cielo Park', cols: [3, 4], rows: [3, 4] },
  market: { name: 'Grand Market', cols: [2, 3, 4, 5], rows: [5, 6] },
  residential: { name: 'Palm Heights', cols: [0, 1, 2], rows: [0, 1, 2, 3, 4, 5, 6] },
  midtown: { name: 'Midtown', cols: [5, 6, 7], rows: [2, 3, 4, 5, 6] },
  beach: { name: 'Playa Azul', cols: [0, 1, 2, 3, 4, 5, 6, 7], rows: [7] },
};

export function districtKeyForBlock(col, row) {
  for (const key of Object.keys(DISTRICTS)) {
    const d = DISTRICTS[key];
    if (d.cols.includes(col) && d.rows.includes(row)) return key;
  }
  return 'midtown';
}

// Sun-soaked palette: bleached asphalt, warm sand, pastel walls, teal sea.
export const PALETTE = {
  grass: '#79a854',
  grassDark: '#6a9a48',
  parkGrass: '#6fa04e',
  sand: '#eedca6',
  sandDark: '#e2cd8f',
  ocean: '#35a0bd',
  oceanDeep: '#2a8aa8',
  foam: '#dff3f2',
  asphalt: '#4c4c55',
  asphaltDark: '#43434c',
  sidewalk: '#cbc3b2',
  sidewalkEdge: '#b5ad9a',
  curb: '#a09a8a',
  laneLine: '#e9e4d4',
  centerLine: '#f0bd45',
  crosswalk: '#ddd6c4',
  towerRoof: ['#e9ddc6', '#dcc9a9', '#cfba9c', '#e4d6be'],
  towerGlass: ['#86b8cc', '#74adc4', '#93c2d2'],
  houseWall: ['#f6e2c2', '#f1d1a9', '#ead9ba', '#f3d8b9'],
  shopWall: ['#f0dcc0', '#e8cfae', '#dfc7a6', '#f2e4c8'],
  warehouse: ['#c9b9a1', '#b9a991', '#d1c1a9'],
  apartment: ['#e6d6ba', '#dcc9a8', '#e9dcbf'],
  tree: '#4e8b40',
  treeDark: '#417a35',
  palm: '#5ea347',
  palmTrunk: '#8a6b4a',
  awning: ['#d95f4b', '#4b8ad9', '#e0a83c', '#5da56a'],
};

export const TUNING = {
  walkSpeed: 175,
  runSpeed: 275,
  playerRadius: 13,
  carAccel: 350,
  carBrake: 540,
  carReverseMax: 135,
  carDrag: 0.6,
  carSteer: 2.6,
  handbrakeGrip: 1.2,
  pedWalk: 58,
  pedFlee: 155,
  trafficSpeed: 118,
  policeSpeed: 345,
  bulletSpeed: 950,
  maxWanted: 5,
  bustTime: 2.2,
  evadeTime: 9,
  repaintCost: 150,
  startMoney: 150,
  startHealth: 100,
  maxHealth: 100,
  maxArmor: 100,
};

// Landmarks: fixed showpieces that anchor the map and the story.
export const LANDMARKS = [
  { name: 'Cielo Tower', kind: 'tower', col: 3, row: 1 },
  { name: 'Palm Court Hotel', kind: 'hotel', col: 4, row: 0 },
  { name: 'Sunset Arena', kind: 'arena', col: 6, row: 3 },
  { name: 'Harbor Cranes', kind: 'cranes', col: 7, row: 0 },
  { name: 'Grand Bazaar', kind: 'bazaar', col: 3, row: 5 },
  { name: 'Fort San Cielo', kind: 'fort', col: 0, row: 7 },
  { name: 'Marina Pier', kind: 'pier', col: 4, row: 7 },
  { name: 'Bayview Light', kind: 'lighthouse', col: 7, row: 7 },
];

// Story places, in world coordinates, used by missions and the HUD.
export const PLACES = {
  garage: { x: 1180, y: 300, name: "Ram's Garage" },
  paintShop: { x: 2580, y: 1380, name: 'Spray & Shine' },
  hospital: { x: 580, y: 980, name: 'St. Cielo Hospital' },
  policeHQ: { x: 1780, y: 580, name: 'SCPD Headquarters' },
  marina: { x: 1780, y: 3520, name: 'Marina Pier' },
  depot: { x: 2980, y: 580, name: 'Harbor Depot' },
  bazaar: { x: 1380, y: 2180, name: 'Grand Bazaar' },
  arena: { x: 2580, y: 1380, name: 'Sunset Arena' },
};
