// San Cielo Heat — entry program (Node 22, standard library only).
//
// The game itself is plain static files under game/ (game/index.html plus ES
// modules, no libraries, no network requests). This program hands it in: it
// copies game/ and screenshots/ from this repository into the output folder
// and writes dossier.json with the vendored make.fun library, so the judge
// reads the same summary the gate scorer rebuilds.
//
// Run locally with:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// and play the game by serving game/ with any static file server.

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function copyClean(source: string, target: string): void {
  if (!existsSync(source)) return;
  if (existsSync(target)) rmSync(target, { recursive: true, force: true });
  cpSync(source, target, { recursive: true });
}

mkdirSync(outDir, { recursive: true });
copyClean(join(repoRoot, 'game'), join(outDir, 'game'));
copyClean(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'));

// Keep the output tidy: screenshots/ must hold only the entry's images.
const shotsDir = join(outDir, 'screenshots');
if (existsSync(shotsDir)) {
  for (const name of readdirSync(shotsDir)) {
    if (name.startsWith('.')) rmSync(join(shotsDir, name), { force: true });
  }
}

// Gate caps from the competition's reference data: the dossier text cap shapes
// the bytes; the other limits refuse an entry the scorer would refuse.
writeFileSync(
  join(outDir, 'dossier.json'),
  buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
