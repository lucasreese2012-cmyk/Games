// Terrain cache: building the heightfield takes ~40 s, so later stages
// (land cover, audit, export) read a cached copy keyed on the source files.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { buildTerrain, createGrid } from './terrain.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'build');
const SOURCES = ['world/geography.mjs', 'world/transport.mjs', 'tools/terrain.mjs', 'tools/lib/erode.mjs', 'tools/lib/noise.mjs', 'tools/lib/geom.mjs', 'tools/lib/profile.mjs', 'tools/lib/router.mjs'];

function sourceHash() {
  const h = crypto.createHash('sha1');
  for (const f of SOURCES) h.update(fs.readFileSync(path.join(ROOT, f)));
  return h.digest('hex').slice(0, 12);
}

const FIELDS = [['h', Float32Array], ['island', Uint8Array], ['water', Uint8Array], ['surface', Float32Array], ['region', Uint8Array], ['lakeId', Uint8Array], ['dLand', Float32Array], ['dSea', Float32Array], ['dOpen', Float32Array]];

export function loadTerrain(log = console.log) {
  const key = sourceHash();
  const meta = path.join(DIR, `terrain-${key}.json`);
  if (fs.existsSync(meta)) {
    const m = JSON.parse(fs.readFileSync(meta, 'utf8'));
    const T = { ...m, g: createGrid() };
    for (const [name, Ctor] of FIELDS) {
      const buf = fs.readFileSync(path.join(DIR, `terrain-${key}.${name}.bin`));
      T[name] = new Ctor(buf.buffer, buf.byteOffset, buf.byteLength / Ctor.BYTES_PER_ELEMENT);
    }
    log(`terrain cache hit ${key}`);
    return T;
  }
  const t0 = Date.now();
  const T = buildTerrain((m) => log(`${((Date.now() - t0) / 1000).toFixed(1)}s ${m}`));
  fs.mkdirSync(DIR, { recursive: true });
  for (const f of fs.readdirSync(DIR)) if (f.startsWith('terrain-')) fs.unlinkSync(path.join(DIR, f));
  for (const [name] of FIELDS) fs.writeFileSync(path.join(DIR, `terrain-${key}.${name}.bin`), Buffer.from(T[name].buffer));
  const { riverProfiles, lakeInfo, peakFix, islandIdx, routeReports } = T;
  const rp = riverProfiles.map((r) => ({ id: r.id, name: r.name, pts: r.pts.map((p) => [+p[0].toFixed(3), +p[1].toFixed(3)]), bed: Array.from(r.bed, (v) => +v.toFixed(2)) }));
  fs.writeFileSync(meta, JSON.stringify({ riverProfiles: rp, lakeInfo, peakFix, islandIdx, routeReports }));
  return T;
}

// Point query helpers over a loaded terrain.
export function probe(T) {
  const { g } = T;
  return (x, y) => {
    const c = g.col(x), r = g.row(y);
    if (c < 0 || r < 0 || c >= g.nx || r >= g.ny) return null;
    const i = r * g.nx + c;
    return { i, h: T.h[i], island: T.island[i], water: T.water[i], dLand: T.dLand[i], dSea: T.dSea[i] };
  };
}
