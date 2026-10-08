// Full build: terrain (cached) → analysis → generated docs → images → game data.
// Usage: node tools/build.mjs [--no-images] [--no-game]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadTerrain } from './cache.mjs';
import { analyze } from './analyze.mjs';
import { writeRegisters, scaleTables, auditTables, islandBlock, splice } from './docgen.mjs';
import { renderAtlas } from './atlas.mjs';
import { exportGame } from './export.mjs';
import { ISLANDS } from '../world/geography.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const t0 = Date.now();
const log = (m) => console.log(`${((Date.now() - t0) / 1000).toFixed(1)}s ${m}`);

const T = loadTerrain(log);
const A = analyze(T, log);
if (A.issues.length) {
  console.log(`${A.issues.length} open issues:`);
  for (const i of A.issues) console.log(`  ${i.kind} ${i.id}: ${i.msg}`);
}

writeRegisters(A);
splice('docs/13-world-scale.md', scaleTables(A));
splice('docs/15-realism-audit.md', auditTables(A));
const main = ISLANDS.filter((s) => !s.offworld && !s.partOf);
for (const s of main) splice(`docs/islands/${s.id}.md`, islandBlock(A, s.id));
log('docs written');

if (!args.includes('--no-images')) {
  const img = path.join(ROOT, 'docs/img');
  fs.mkdirSync(img, { recursive: true });
  const { g } = T;
  const full = renderAtlas(T, A.cover, [g.x0, g.y0, g.x1, g.y1], 4);
  fs.writeFileSync(path.join(img, 'atlas.png'), full.png);
  for (const s of main) {
    const ks = new Set([ISLANDS.indexOf(s) + 1, ...ISLANDS.filter((q) => q.partOf === s.id).map((q) => ISLANDS.indexOf(q) + 1)]);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let r = 0; r < g.ny; r += 2) for (let c = 0; c < g.nx; c += 2) {
      const i = r * g.nx + c;
      if (!ks.has(T.island[i]) || T.water[i]) continue;
      const x = g.X(c), y = g.Y(r);
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
    const pad = 1.2;
    const box = [Math.max(g.x0, x0 - pad), Math.max(g.y0, y0 - pad), Math.min(g.x1, x1 + pad), Math.min(g.y1, y1 + pad)];
    const span = Math.max(box[2] - box[0], box[3] - box[1]);
    const step = Math.max(1, Math.round(span / 0.05 / 900));
    const r = renderAtlas(T, A.cover, box, step);
    fs.writeFileSync(path.join(img, `${s.id}.png`), r.png);
  }
  log('images written');
}

if (!args.includes('--no-game')) {
  exportGame(T, A, path.join(ROOT, 'game/data'));
  for (const f of fs.readdirSync(path.join(ROOT, 'game/data'))) log(`game/data/${f} ${(fs.statSync(path.join(ROOT, 'game/data', f)).size / 1e6).toFixed(2)} MB`);
}
log('build complete');
