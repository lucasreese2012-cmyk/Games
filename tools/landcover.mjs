// Land-cover classification for the Cassena Islands.
// Biomes follow elevation, aspect, slope, curvature (coves vs. ridges),
// drainage, salt exposure and land use; boundaries are never arbitrary.
import { ISLANDS, PEAKS, LAKES, RIVERS, WATERS } from '../world/geography.mjs';
import { SETTLEMENTS } from '../world/settlements.mjs';
import { AIRPORTS, POWER, UTILITIES } from '../world/transport.mjs';
import { W } from './terrain.mjs';
import { makeNoise } from './lib/noise.mjs';
import { distanceTransform } from './lib/edt.mjs';
import { segDist, smoothstep, clamp, pointInPoly, bbox, ellipseR } from './lib/geom.mjs';

export const LC = [
  { key: 'water', name: 'Water', color: [70, 120, 170] },
  { key: 'beach', name: 'Beach sand', color: [238, 229, 200] },
  { key: 'dune', name: 'Dunes and sea oats', color: [214, 205, 160] },
  { key: 'salt-marsh', name: 'Salt marsh (cordgrass, needlerush)', color: [182, 178, 118] },
  { key: 'fresh-marsh', name: 'Freshwater marsh and wet prairie', color: [152, 170, 104] },
  { key: 'mangrove', name: 'Black and red mangrove', color: [58, 96, 62] },
  { key: 'cypress-swamp', name: 'Cypress–tupelo swamp', color: [74, 98, 68] },
  { key: 'bay-forest', name: 'Bay forest and pocosin', color: [62, 88, 60] },
  { key: 'bottomland', name: 'Bottomland hardwoods', color: [84, 114, 66] },
  { key: 'maritime-forest', name: 'Maritime live-oak forest', color: [80, 102, 64] },
  { key: 'longleaf', name: 'Longleaf pine savanna', color: [152, 162, 98] },
  { key: 'flatwoods', name: 'Slash-pine flatwoods', color: [116, 134, 80] },
  { key: 'pine-plantation', name: 'Pine plantation', color: [96, 120, 74] },
  { key: 'scrub', name: 'Sand-pine and oak scrub', color: [176, 172, 120] },
  { key: 'cropland', name: 'Cropland', color: [204, 192, 132] },
  { key: 'pasture', name: 'Pasture and hay', color: [176, 190, 114] },
  { key: 'orchard', name: 'Orchards (pecan, peach, apple)', color: [140, 158, 90] },
  { key: 'mixed-forest', name: 'Pine–hardwood forest', color: [98, 124, 72] },
  { key: 'oak-hickory', name: 'Oak–hickory forest', color: [110, 126, 72] },
  { key: 'cove-hardwood', name: 'Cove hardwood and rhododendron', color: [72, 106, 62] },
  { key: 'northern-hardwood', name: 'Northern hardwoods', color: [100, 118, 82] },
  { key: 'spruce-fir', name: 'Spruce–fir', color: [46, 70, 58] },
  { key: 'grassy-bald', name: 'Grassy bald', color: [184, 186, 124] },
  { key: 'heath-bald', name: 'Heath bald', color: [124, 118, 94] },
  { key: 'rock', name: 'Bare rock and cliff', color: [156, 150, 142] },
  { key: 'urban-core', name: 'Urban core', color: [150, 138, 134] },
  { key: 'urban', name: 'Urban', color: [178, 166, 152] },
  { key: 'suburban', name: 'Suburban', color: [204, 198, 178] },
  { key: 'industrial', name: 'Industrial and port', color: [168, 162, 176] },
  { key: 'airport', name: 'Airport', color: [206, 202, 196] },
  { key: 'quarry', name: 'Quarry and mine', color: [218, 212, 200] },
  { key: 'park', name: 'Parks and golf courses', color: [146, 176, 104] },
  { key: 'solar', name: 'Solar farm', color: [92, 102, 128] },
];
export const C = Object.fromEntries(LC.map((c, i) => [c.key, i]));

function hash2(a, b) {
  let h = (a * 374761393 + b * 668265263) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const FS = 0.55;
function fieldAt(x, y) {
  const gx = Math.floor(x / FS), gy = Math.floor(y / FS);
  let best = 1e9, bid = 0;
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
    const cx = gx + a, cy = gy + b;
    const px = (cx + hash2(cx + 31, cy + 7)) * FS, py = (cy + hash2(cx - 5, cy + 91)) * FS;
    // Stretch along the old survey lines so fields read as long strips.
    const d = (x - px) ** 2 * 0.6 + (y - py) ** 2 * 1.4;
    if (d < best) { best = d; bid = hash2(cx + 1000, cy + 2000); }
  }
  return bid;
}

export function classify(T, zones = {}) {
  const { g, h, island, water, dLand, dOpen } = T;
  const N = g.nx * g.ny;
  const nz = makeNoise(4242), nz2 = makeNoise(777);
  const out = new Uint8Array(N);
  const kindOf = ISLANDS.map((s) => s.base.kind);
  const idOf = ISLANDS.map((s) => s.id);

  // Slope (fraction) and curvature from a lightly smoothed surface.
  const slope = new Float32Array(N), curv = new Float32Array(N), north = new Float32Array(N);
  const cm = g.c * 1000;
  for (let r = 2; r < g.ny - 2; r++) for (let c = 2; c < g.nx - 2; c++) {
    const i = r * g.nx + c;
    if (!island[i]) continue;
    const dx = (h[i + 1] - h[i - 1]) / (2 * cm), dy = (h[i - g.nx] - h[i + g.nx]) / (2 * cm);
    slope[i] = Math.hypot(dx, dy);
    north[i] = slope[i] > 0.02 ? -dy / slope[i] : 0; // +1 = faces north (cooler, moister)
    // Curvature over ~200 m: positive = concave hollow/cove.
    const k = 4;
    const ring = (h[i - k] + h[i + k] + h[i - k * g.nx] + h[i + k * g.nx]) / 4;
    curv[i] = (ring - h[i]) / (k * cm) * 1000;
  }

  // Distance to flowing or standing fresh water.
  const dWet = distanceTransform(g.nx, g.ny, (i) => water[i] === W.RIVER || water[i] === W.LAKE);
  for (let i = 0; i < N; i++) dWet[i] *= g.c;

  const islandIdx = Object.fromEntries(ISLANDS.map((s, k) => [s.id, k + 1]));
  const balds = new Set(['gooseberry-bald', 'painted-bald', 'sheepback-bald']);
  const heaths = new Set(['the-steeples', 'hornet-spire', 'bald-rock', 'anvil-rock', 'ravenrock']);
  const domes = ['grayback', 'glassface-dome', 'cutstone-mountain', 'pale-wall', 'lookout-bluff'];

  for (let r = 0; r < g.ny; r++) {
    const y = g.Y(r);
    for (let c = 0; c < g.nx; c++) {
      const i = r * g.nx + c;
      if (!island[i]) { out[i] = C.water; continue; }
      if (water[i]) { out[i] = C.water; continue; }
      const x = g.X(c);
      const z = h[i], s = slope[i], d = dLand[i], dO = dOpen[i];
      const kind = kindOf[island[i] - 1], id = idOf[island[i] - 1];
      const n1 = nz.fbm(x * 0.8, y * 0.8, 3), n2 = nz2.fbm(x * 2.2, y * 2.2, 3);
      let v;
      // Field patchwork: irregular (Worley) fields of ~350–700 m, with
      // larger woodlots and hedgerow-like breaks from low-frequency noise.
      const field = fieldAt(x, y);
      const saltEdge = z < 1.7;
      const nearOpen = dO < 0.07 && z < 3.5;

      if (kind === 'mountain' || kind === 'mainland') {
        const cove = curv[i] > 0.6, ridge = curv[i] < -0.6;
        if (s > 0.85 || (s > 0.55 && n2 > 0.15)) v = C.rock;
        else if (id === 'halcomb' && z > 1880 - 60 * north[i]) v = C['spruce-fir'];
        else if (z > 1650 - 120 * north[i]) v = id === 'graystone' ? (north[i] > 0.2 ? C['spruce-fir'] : C['northern-hardwood']) : C['northern-hardwood'];
        else if (z > 1400 - 80 * north[i]) v = cove ? C['cove-hardwood'] : C['northern-hardwood'];
        else if (z > 600) v = cove || north[i] > 0.4 ? C['cove-hardwood'] : ridge || north[i] < -0.4 ? C['oak-hickory'] : (n1 > 0 ? C['cove-hardwood'] : C['oak-hickory']);
        else if (s < 0.09 && z < 700) {
          v = field < 0.42 ? C.pasture : field < 0.62 ? C.cropland : field < 0.7 && z > 250 ? C.orchard : C['mixed-forest'];
        } else v = s > 0.3 && cove ? C['cove-hardwood'] : C['mixed-forest'];
        if (id === 'graystone' && z > 900 && s < 0.08 && field < 0.25) v = C.pasture; // highland meadows
        if (saltEdge && d < 0.4) v = C['salt-marsh'];
        if (d < 0.05 && s < 0.15 && z < 4) v = C.beach;
      } else if (kind === 'plain') {
        const north = smoothstep(38, 47, y);
        if (saltEdge && d < 1.5) v = C['salt-marsh'];
        else if (dWet[i] < 0.35 && z < 30 - 10 * north) v = C.bottomland;
        else if (z < 12) {
          v = field < 0.35 ? C['pine-plantation'] : field < 0.62 ? C.flatwoods : field < 0.8 ? C.pasture : field < 0.88 ? C['cypress-swamp'] : C.cropland;
        } else {
          const pOrch = 0.08 + 0.1 * north;
          v = field < 0.36 ? C.cropland : field < 0.58 ? C.pasture : field < 0.58 + pOrch ? C.orchard : field < 0.82 ? C['pine-plantation'] : C['mixed-forest'];
          if (nz2.fbm(x * 0.35 + 9, y * 0.35, 3) > 0.17) v = n1 > 0 ? C['mixed-forest'] : C['pine-plantation'];
        }
        if (nearOpen) v = C.beach;
      } else if (kind === 'seaisland') {
        if (saltEdge) v = n2 > 0.32 ? C['fresh-marsh'] : C['salt-marsh'];
        else if (dO < 0.06 && z < 4) v = C.beach;
        else if (dO < 0.35) v = C.dune;
        else if (dO < 2.2 || d < 0.25) v = C['maritime-forest'];
        else v = field < 0.3 ? C['maritime-forest'] : field < 0.5 ? C['pine-plantation'] : field < 0.68 ? C.pasture : field < 0.8 ? C.cropland : C['mixed-forest'];
      } else if (kind === 'karst') {
        if (saltEdge) v = C['salt-marsh'];
        else if (z > 44 + 10 * n1) v = n2 > 0.05 ? C.longleaf : C.scrub;
        else if (z > 15 + 8 * n2) v = n1 > 0.28 ? C.flatwoods : C.longleaf;
        else if (dWet[i] < 0.5) v = C.bottomland;
        else if (d < 1.2) v = C['maritime-forest'];
        else v = n2 > 0.25 ? C['cypress-swamp'] : n1 > 0.15 ? C.longleaf : C.flatwoods;
        if (nearOpen) v = C.beach;
      } else if (kind === 'swamp') {
        if (saltEdge) v = y < 6.8 && n2 > -0.1 ? C.mangrove : C['salt-marsh'];
        else if (z > 27) v = field < 0.55 ? C.longleaf : field < 0.85 ? C['pine-plantation'] : C.scrub;
        else if (y > 21.5 && z > 14) v = field < 0.45 ? C.flatwoods : field < 0.8 ? C['pine-plantation'] : C['cypress-swamp'];
        else {
          const m = nz.fbm(x * 0.55 + 3, y * 0.55, 4) + 0.25 * n2;
          v = m < -0.12 ? C['fresh-marsh'] : m < 0.12 ? C['cypress-swamp'] : m < 0.24 ? C['bay-forest'] : C.flatwoods;
        }
      } else if (kind === 'barrier') {
        if (dO < 0.07 && z < 4) v = C.beach;
        else if (dO < 0.32) v = C.dune;
        else if (saltEdge) v = C['salt-marsh'];
        else if (id === 'mirabel' && y < 32.2) v = z < 2.6 ? C['fresh-marsh'] : n1 > -0.05 ? C['maritime-forest'] : C.flatwoods;
        else if (d > 0.45) v = C['maritime-forest'];
        else v = C.scrub;
      } else if (kind === 'keys') {
        if (nearOpen) v = C.beach;
        else v = z < 1.3 || n2 > -0.2 ? C.mangrove : C['maritime-forest'];
      } else if (kind === 'urban') v = C.urban;
      else if (kind === 'delta') v = C.industrial;
      else v = C['mixed-forest'];
      out[i] = v;
    }
  }

  // Special summits: grassy and heath balds, bare granite domes.
  for (const [pid, p] of Object.entries(PEAKS)) {
    const isB = balds.has(pid), isH = heaths.has(pid), isD = domes.includes(pid);
    if (!isB && !isH && !isD) continue;
    const R = isD ? 0.9 : 0.7;
    for (let r = g.row(p.at[1] + R); r <= g.row(p.at[1] - R); r++) for (let c = g.col(p.at[0] - R); c <= g.col(p.at[0] + R); c++) {
      const i = r * g.nx + c;
      if (!island[i] || water[i]) continue;
      const dd = Math.hypot(g.X(c) - p.at[0], g.Y(r) - p.at[1]);
      if (dd > R) continue;
      if (isB && h[i] > p.z - 140 && nz.fbm(g.X(c) * 4, g.Y(r) * 4, 2) > -0.25) out[i] = C['grassy-bald'];
      else if (isH && h[i] > p.z - 110) out[i] = slope[i] > 0.6 ? C.rock : C['heath-bald'];
      else if (isD && slope[i] > 0.22 && h[i] > p.z * 0.55) out[i] = C.rock;
    }
  }

  // Bay-forest (pocosin) rims around the Carolina bays.
  for (const lk of LAKES) {
    if (!/bay$/.test(lk.id) && lk.id !== 'little-bay' && lk.id !== 'sand-bay') continue;
    const R = Math.max(lk.rx, lk.ry) * 1.6;
    for (let r = g.row(lk.at[1] + R); r <= g.row(lk.at[1] - R); r++) for (let c = g.col(lk.at[0] - R); c <= g.col(lk.at[0] + R); c++) {
      const i = r * g.nx + c;
      if (water[i] || !island[i]) continue;
      const er = ellipseR(g.X(c), g.Y(r), lk.at[0], lk.at[1], lk.rx, lk.ry, lk.rot);
      if (er < 1.45) out[i] = er < 1.18 ? C['bay-forest'] : C['cypress-swamp'];
    }
  }

  // Land use: settlements, airports, quarries, industry, power.
  const paint = (cx, cy, R, fn) => {
    for (let r = Math.max(0, g.row(cy + R)); r <= Math.min(g.ny - 1, g.row(cy - R)); r++) for (let c = Math.max(0, g.col(cx - R)); c <= Math.min(g.nx - 1, g.col(cx + R)); c++) {
      const i = r * g.nx + c;
      if (!island[i] || water[i]) continue;
      const dd = Math.hypot(g.X(c) - cx, g.Y(r) - cy);
      if (dd <= R) fn(i, dd / R, g.X(c), g.Y(r));
    }
  };
  for (const s of SETTLEMENTS) {
    const R = s.r * (s.form === 'city' ? 1.15 : 1.05);
    paint(s.at[0], s.at[1], R * 1.2, (i, u0, x, y) => {
      if (out[i] === C['salt-marsh'] || out[i] === C.beach || out[i] === C.rock) return;
      const u = u0 * 1.2 * (1 + 0.28 * nz.fbm(x * 1.6 + s.at[0], y * 1.6, 3));
      if (u > 1) return;
      if (s.form === 'city') {
        if (island[i] !== islandIdx[s.island]) return;
        out[i] = u < 0.32 ? C['urban-core'] : u < 0.75 ? C.urban : C.suburban;
      } else if (s.form === 'town' || s.form === 'suburb') {
        out[i] = u < 0.35 ? C.urban : u < 0.9 ? C.suburban : out[i];
      } else if (s.form === 'resort') {
        out[i] = u < 0.6 ? C.urban : C.suburban;
      } else if (s.form === 'village') {
        out[i] = u < 0.55 ? C.suburban : out[i];
      } else if (u < 0.6 && nz2.fbm(x * 6, y * 6, 2) > -0.1) out[i] = C.suburban;
    });
  }
  // Calder island is built out shore to shore, with parks.
  const calderK = islandIdx.calder, corlissK = islandIdx.corliss;
  for (let i = 0; i < N; i++) {
    if (island[i] === calderK && !water[i] && out[i] !== C['urban-core']) out[i] = out[i] === C.urban || out[i] === C.suburban ? out[i] : C.urban;
    if (island[i] === corlissK && !water[i] && out[i] !== C.urban && out[i] !== C.suburban) out[i] = h[i] < 1.4 ? C['salt-marsh'] : C.industrial;
  }
  for (const ap of AIRPORTS) {
    for (const rw of ap.runways) {
      const buf = ap.kind === 'international' ? 0.32 : 0.12;
      const [bx0, by0, bx1, by1] = bbox([rw.a, rw.b], buf);
      for (let r = g.row(by1); r <= g.row(by0); r++) for (let c = g.col(bx0); c <= g.col(bx1); c++) {
        const i = r * g.nx + c;
        if (!island[i] || water[i]) continue;
        const [dd] = segDist(g.X(c), g.Y(r), rw.a[0], rw.a[1], rw.b[0], rw.b[1]);
        if (dd < buf) out[i] = C.airport;
      }
    }
    if (ap.terminal) paint(ap.terminal[0], ap.terminal[1], ap.kind === 'international' ? 0.7 : 0.25, (i) => { out[i] = C.airport; });
  }
  for (const u of UTILITIES) {
    if (u.kind === 'quarry') paint(u.at[0], u.at[1], 0.45, (i) => { out[i] = C.quarry; });
    if (u.kind === 'landfill') paint(u.at[0], u.at[1], 0.5, (i) => { out[i] = C.quarry; });
    if (u.kind === 'industrial' || u.kind === 'distribution' || u.kind === 'wastewater' || u.kind === 'recycling') paint(u.at[0], u.at[1], u.kind === 'industrial' ? 0.45 : 0.22, (i) => { out[i] = C.industrial; });
  }
  for (const p of POWER.plants) {
    if (p.area) {
      const [bx0, by0, bx1, by1] = bbox(p.area);
      for (let r = g.row(by1); r <= g.row(by0); r++) for (let c = g.col(bx0); c <= g.col(bx1); c++) {
        const i = r * g.nx + c;
        if (island[i] && !water[i] && pointInPoly(g.X(c), g.Y(r), p.area)) out[i] = C.solar;
      }
    } else paint(p.at[0], p.at[1], p.id === 'ocosta-nuclear' ? 0.55 : 0.35, (i) => { out[i] = C.industrial; });
  }
  // Zone overrides from the registers (forests, parks, districts).
  for (const zn of zones.list || []) {
    const cls = C[zn.cover];
    if (cls === undefined) continue;
    const R = Math.max(zn.rx || zn.r || 0.5, zn.ry || zn.r || 0.5);
    paint(zn.at[0], zn.at[1], R, (i, u, x, y) => {
      const er = zn.rx ? ellipseR(x, y, zn.at[0], zn.at[1], zn.rx, zn.ry, zn.rot || 0) : u;
      if (er > 1) return;
      if (zn.only && !zn.only.includes(LC[out[i]].key)) return;
      if (out[i] === C.water || out[i] === C.rock && cls !== C.park) return;
      out[i] = cls;
    });
  }
  // Runway protection zones: trees and buildings cleared to mown grass for
  // 900 m beyond each threshold; beyond that, out to 4 km, only stands whose
  // tops would penetrate the 50:1 approach surface are cleared.
  for (const ap of AIRPORTS) for (const rw of ap.runways) {
    for (const [e, o] of [[rw.a, rw.b], [rw.b, rw.a]]) {
      const L = Math.hypot(e[0] - o[0], e[1] - o[1]), ux = (e[0] - o[0]) / L, uy = (e[1] - o[1]) / L;
      const z0 = h[g.row(e[1]) * g.nx + g.col(e[0])];
      const far = [e[0] + ux * 4, e[1] + uy * 4];
      const [qx0, qy0, qx1, qy1] = bbox([e, far], 0.6);
      for (let r = Math.max(0, g.row(qy1)); r <= Math.min(g.ny - 1, g.row(qy0)); r++) for (let c = Math.max(0, g.col(qx0)); c <= Math.min(g.nx - 1, g.col(qx1)); c++) {
        const i = r * g.nx + c;
        if (!island[i] || water[i] || out[i] === C.airport) continue;
        const vx = g.X(c) - e[0], vy = g.Y(r) - e[1];
        const along = vx * ux + vy * uy, across = Math.abs(-vx * uy + vy * ux);
        if (along <= 0 || along > 4 || across > 0.12 + along * 0.15) continue;
        if (along < 0.9 || h[i] + 20 > z0 + along * 20) out[i] = C.pasture;
      }
    }
  }
  return { cover: out, slope };
}
