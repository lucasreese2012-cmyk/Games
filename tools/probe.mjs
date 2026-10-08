// Probe terrain at named points: node tools/probe.mjs name:x,y ...
// With --settlements / --peaks it checks those data sets instead.
import { loadTerrain, probe } from './cache.mjs';
import { ISLANDS, PEAKS } from '../world/geography.mjs';

const T = loadTerrain(() => {});
const q = probe(T);
const args = process.argv.slice(2);
const pts = [];
if (args.includes('--settlements')) {
  const { SETTLEMENTS } = await import('../world/settlements.mjs');
  for (const s of SETTLEMENTS) pts.push([s.id, s.at[0], s.at[1], s.island]);
}
if (args.includes('--peaks')) for (const [id, p] of Object.entries(PEAKS)) pts.push([id, p.at[0], p.at[1], p.island, p.z]);
for (const a of args.filter((x) => !x.startsWith('--'))) {
  const [name, xy] = a.split(':');
  const [x, y] = xy.split(',').map(Number);
  pts.push([name, x, y]);
}
const kinds = ['land', 'SEA', 'LAKE', 'RIVER'];
for (const [name, x, y, want, z] of pts) {
  const r = q(x, y);
  const isl = r && r.island ? ISLANDS[r.island - 1].id : '-';
  const flag = want && want !== isl ? '  <-- expected ' + want : r && r.water ? '  <-- in water' : '';
  const zf = z ? ` (target ${z}, diff ${(r.h - z).toFixed(0)})` : '';
  console.log(`${name.padEnd(22)} ${x.toFixed(2).padStart(6)},${y.toFixed(2).padStart(6)}  ${isl.padEnd(14)} ${kinds[r ? r.water : 0].padEnd(5)} h=${r ? r.h.toFixed(1) : '?'} dCoast=${r ? (r.water ? r.dSea : r.dLand).toFixed(2) : '?'}${zf}${flag}`);
}
