// Terrain synthesis for the Cassena Islands.
// Produces a 50 m elevation grid plus water classification from the
// geographic source data in world/geography.mjs.

import {
  WORLD, PEAKS, ISLANDS, WATER_CORRIDORS, WATERS, BATHY, RIDGES, PLATEAUS,
  DOMES, BASINS, CLIFFS, UPLANDS, RIVERS, LAKES,
} from '../world/geography.mjs';
import { makeNoise } from './lib/noise.mjs';
import {
  pointInPoly, bbox, segDist, resample, smoothstep, clamp, lerp, ellipseR,
} from './lib/geom.mjs';
import { distanceTransform } from './lib/edt.mjs';
import { erode } from './lib/erode.mjs';
import { routeProfile, DESIGN } from './lib/profile.mjs';
import { makeRouteField, findRoute, simplify, chaikin } from './lib/router.mjs';
import { ROADS, RAILS, AIRPORTS, PORTS } from '../world/transport.mjs';

export const W = { LAND: 0, SEA: 1, LAKE: 2, RIVER: 3 };
const OPEN_WATERS = new Set(['atlantic', 'gulf', 'serena-bay']);

export function createGrid() {
  const { x0, y0, x1, y1 } = WORLD.bounds;
  const c = WORLD.cell;
  const nx = Math.round((x1 - x0) / c), ny = Math.round((y1 - y0) / c);
  return {
    nx, ny, c, x0, y0, x1, y1,
    X: (col) => x0 + (col + 0.5) * c,
    Y: (row) => y1 - (row + 0.5) * c,
    col: (x) => Math.floor((x - x0) / c),
    row: (y) => Math.floor((y1 - y) / c),
  };
}

// Iterate grid cells inside a world-space box.
function forBox(g, bx0, by0, bx1, by1, fn) {
  const c0 = Math.max(0, g.col(bx0)), c1 = Math.min(g.nx - 1, g.col(bx1));
  const r0 = Math.max(0, g.row(by1)), r1 = Math.min(g.ny - 1, g.row(by0));
  for (let r = r0; r <= r1; r++) {
    const y = g.Y(r);
    for (let c = c0; c <= c1; c++) fn(r * g.nx + c, g.X(c), y);
  }
}

export function sampler(g, arr) {
  return (x, y) => {
    const fx = (x - g.x0) / g.c - 0.5, fy = (g.y1 - y) / g.c - 0.5;
    const c = clamp(Math.floor(fx), 0, g.nx - 2), r = clamp(Math.floor(fy), 0, g.ny - 2);
    const tx = clamp(fx - c, 0, 1), ty = clamp(fy - r, 0, 1);
    const i = r * g.nx + c;
    const a = lerp(arr[i], arr[i + 1], tx), b = lerp(arr[i + g.nx], arr[i + g.nx + 1], tx);
    return lerp(a, b, ty);
  };
}

function resolvePts(pts) {
  return pts.map((p) => {
    if (typeof p === 'string') {
      const k = PEAKS[p];
      if (!k) throw new Error(`Unknown peak ${p}`);
      return [k.at[0], k.at[1], k.z];
    }
    return p;
  });
}

// Distance from a point to the boundary of a polygon (positive inside).
function polyInsideDist(x, y, poly) {
  let m = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [d] = segDist(x, y, poly[j][0], poly[j][1], poly[i][0], poly[i][1]);
    if (d < m) m = d;
  }
  return pointInPoly(x, y, poly) ? m : -m;
}

export function buildTerrain(log = () => {}, debugPts = null) {
  const g = createGrid();
  const N = g.nx * g.ny;
  let hRef = null;
  if (debugPts) {
    const orig = log;
    log = (m) => {
      orig(m);
      if (!hRef) return;
      orig('   ' + debugPts.map(([n, x, y]) => `${n}=${hRef[g.row(y) * g.nx + g.col(x)].toFixed(0)}`).join(' '));
    };
  }
  const nz = makeNoise(WORLD.seed);
  const nz2 = makeNoise(WORLD.seed + 77);

  // ---- 1. Land mask -------------------------------------------------------
  // Each island is a signed-distance field from its outline, perturbed by
  // multi-scale noise; the shoreline is the zero contour. This behaves like a
  // drowned landscape: bays, points and offshore islets fall out naturally.
  const island = new Uint8Array(N); // 0 = water, k+1 = ISLANDS[k]
  const best = new Float32Array(N).fill(-1e9);
  ISLANDS.forEach((isl, k) => {
    const cs = isl.coast;
    const amp = 4 * (cs.a1 + cs.a2 + cs.a3) * 0.75;
    const allPts = isl.polys.flat();
    const [bx0, by0, bx1, by1] = bbox(allPts, amp + 0.5);
    const c0 = Math.max(0, g.col(bx0)), c1 = Math.min(g.nx - 1, g.col(bx1));
    const r0 = Math.max(0, g.row(by1)), r1 = Math.min(g.ny - 1, g.row(by0));
    const lw = c1 - c0 + 1, lh = r1 - r0 + 1;
    const inside = new Uint8Array(lw * lh);
    for (const poly of isl.polys) {
      const [px0, py0, px1, py1] = bbox(poly);
      for (let r = r0; r <= r1; r++) {
        const y = g.Y(r);
        if (y < py0 || y > py1) continue;
        for (let c = c0; c <= c1; c++) {
          const x = g.X(c);
          if (x < px0 || x > px1) continue;
          if (pointInPoly(x, y, poly)) inside[(r - r0) * lw + (c - c0)] = 1;
        }
      }
    }
    const dIn = distanceTransform(lw, lh, (j) => !inside[j]);
    const dOut = distanceTransform(lw, lh, (j) => inside[j]);
    for (let r = r0; r <= r1; r++) {
      const y = g.Y(r);
      for (let c = c0; c <= c1; c++) {
        const j = (r - r0) * lw + (c - c0);
        const sdf = (inside[j] ? dIn[j] : -dOut[j]) * g.c;
        if (sdf < -amp) continue;
        const x = g.X(c);
        const v = sdf + 4 * (cs.a1 * nz2.fbm(x / cs.s1 + k * 13.1, y / cs.s1 - k * 7.3, 3)
          + cs.a2 * nz.fbm(x / cs.s2 + 11.1 + k, y / cs.s2 - 3.7, 3)
          + cs.a3 * nz.fbm(x / cs.s3 + 5 - k, y / cs.s3 + 2, 2));
        const i = r * g.nx + c;
        if (v > best[i]) { best[i] = v; if (v > 0) island[i] = k + 1; }
      }
    }
  });
  // Channels: variable-width drowned valleys with irregular, meandering banks.
  for (const cor of WATER_CORRIDORS) {
    for (const p of resample(cor.pts, g.c)) {
      const r0 = p[2] / 2;
      const R = r0 * 1.8 + 3.4;
      forBox(g, p[0] - R, p[1] - R, p[0] + R, p[1] + R, (i, x, y) => {
        if (!island[i]) return;
        const big = cor.rough ?? 0.3, mea = cor.meander ?? 0.3;
        const mx = x + 5 * mea * nz2.fbm(x * 0.16 + 50, y * 0.16, 2), my = y + 5 * mea * nz2.fbm(x * 0.16, y * 0.16 - 50, 2);
        const dd = Math.sqrt((mx - p[0]) ** 2 + (my - p[1]) ** 2);
        if (dd <= r0 * 0.3) { island[i] = 0; return; }
        const bank = r0 * (1 + 0.5 * big * nz2.fbm(x * 0.9 + 3, y * 0.9 + 1, 3)) + 1.6 * big * nz.fbm(x * 1.6, y * 1.6, 4);
        if (dd <= bank) island[i] = 0;
      });
    }
  }
  // Island identity: every connected land mass takes the island whose
  // outline it mostly lies inside (outlines overlap across the channels).
  {
    const comp = new Int32Array(N).fill(-1);
    const stack = new Int32Array(N);
    let nComp = 0;
    for (let i0 = 0; i0 < N; i0++) {
      if (!island[i0] || comp[i0] >= 0) continue;
      const votes = new Float64Array(ISLANDS.length + 1);
      let sp = 0, members = [];
      stack[sp++] = i0; comp[i0] = nComp;
      while (sp) {
        const i = stack[--sp];
        members.push(i);
        votes[island[i]] += 1;
        const c = i % g.nx;
        const nb = [c > 0 ? i - 1 : -1, c < g.nx - 1 ? i + 1 : -1, i - g.nx, i + g.nx];
        for (const j of nb) {
          if (j < 0 || j >= N || !island[j] || comp[j] >= 0) continue;
          comp[j] = nComp; stack[sp++] = j;
        }
      }
      let bk = 1;
      for (let k = 1; k < votes.length; k++) if (votes[k] > votes[bk]) bk = k;
      for (const i of members) island[i] = bk;
      nComp++;
    }
    log(`components: ${nComp}`);
  }
  log('land mask done');

  // ---- 2. Sea regions and distance fields ----------------------------------
  const region = new Uint8Array(N).fill(255);
  WATERS.forEach((wt, k) => {
    if (!wt.poly) return;
    const [bx0, by0, bx1, by1] = bbox(wt.poly);
    forBox(g, bx0, by0, bx1, by1, (i, x, y) => {
      if (region[i] === 255 && pointInPoly(x, y, wt.poly)) region[i] = k;
    });
  });
  const atl = WATERS.findIndex((w) => w.id === 'atlantic');
  for (let i = 0; i < N; i++) if (region[i] === 255) region[i] = atl;

  const dLand = distanceTransform(g.nx, g.ny, (i) => island[i] === 0);
  const dSea = distanceTransform(g.nx, g.ny, (i) => island[i] !== 0);
  const dOpen = distanceTransform(g.nx, g.ny, (i) => island[i] === 0 && OPEN_WATERS.has(WATERS[region[i]].id));
  for (let i = 0; i < N; i++) { dLand[i] *= g.c; dSea[i] *= g.c; dOpen[i] *= g.c; }
  log('distance fields done');

  // ---- 3. Structural elevation ---------------------------------------------
  const h = new Float32Array(N);
  hRef = h;
  const islandIdx = Object.fromEntries(ISLANDS.map((s, k) => [s.id, k + 1]));
  const ridges = RIDGES.map((r) => {
    const pts = resolvePts(r.pts);
    return { ...r, pts, isl: islandIdx[r.island], box: bbox(pts, r.w) };
  });
  const plateaus = PLATEAUS.map((p) => ({ ...p, isl: islandIdx[p.island], box: bbox(p.poly, 0.1) }));
  const uplands = UPLANDS.map((u) => ({ ...u, box: bbox(u.poly, 0.1) }));

  function ridgeValue(x, y, isl) {
    let best = 0;
    for (const rg of ridges) {
      if (rg.isl !== isl) continue;
      const b = rg.box;
      if (x < b[0] || x > b[2] || y < b[1] || y > b[3]) continue;
      for (let s = 1; s < rg.pts.length; s++) {
        const a = rg.pts[s - 1], c = rg.pts[s];
        const [d, t] = segDist(x, y, a[0], a[1], c[0], c[1]);
        const u = d / rg.w;
        if (u >= 1) continue;
        const z = lerp(a[2], c[2], t) * Math.pow(1 - u, rg.pow);
        if (z > best) best = z;
      }
    }
    return best;
  }

  // Best ridge contribution plus how close the point is to that crest line.
  function ridgeInfo(x, y, isl) {
    let best = 0, bu = 1;
    for (const rg of ridges) {
      if (rg.isl !== isl) continue;
      const b = rg.box;
      if (x < b[0] || x > b[2] || y < b[1] || y > b[3]) continue;
      for (let s = 1; s < rg.pts.length; s++) {
        const a = rg.pts[s - 1], c = rg.pts[s];
        const [d, t] = segDist(x, y, a[0], a[1], c[0], c[1]);
        const u = d / rg.w;
        if (u >= 1) continue;
        const z = lerp(a[2], c[2], t) * Math.pow(1 - u, rg.pow);
        if (z > best) { best = z; bu = d; }
      }
    }
    return [best, bu];
  }

  function plateauValue(x, y, isl) {
    let best = 0;
    for (const p of plateaus) {
      if (p.isl !== isl) continue;
      const b = p.box;
      if (x < b[0] || x > b[2] || y < b[1] || y > b[3]) continue;
      const di = polyInsideDist(x, y, p.poly);
      if (di <= 0) continue;
      const top = lerp(p.top.z0, p.top.z1, clamp((y - p.top.y0) / (p.top.y1 - p.top.y0), 0, 1));
      const z = (top + p.roughness * nz.fbm(x * 0.9 + 3, y * 0.9 - 2, 4)) * smoothstep(0, p.edge, di);
      if (z > best) best = z;
    }
    return best;
  }

  const dOpenAt = sampler(g, dOpen);

  for (let r = 0; r < g.ny; r++) {
    const y = g.Y(r);
    for (let c = 0; c < g.nx; c++) {
      const i = r * g.nx + c;
      const k = island[i];
      if (!k) continue;
      const x = g.X(c);
      const isl = ISLANDS[k - 1];
      const d = dLand[i];
      const n1 = nz.fbm(x * 0.35, y * 0.35, 4);
      let z = 0;
      switch (isl.base.kind) {
        case 'mainland':
          z = 15 + 220 * smoothstep(0, 4, d) * (0.7 + 0.6 * n1);
          break;
        case 'mountain': {
          const b = isl.base;
          const pv = plateauValue(x, y, k);
          const hills = (b.hills || 0) * (nz2.ridged(x * 0.55 + 7, y * 0.55 - 3, 4) - 0.25) * smoothstep(0.6, 4, d) * (pv > 0 ? 0.12 : 1);
          const base = b.floor + b.inland * smoothstep(0, b.rise, d) * (0.75 + 0.6 * n1) + 45 * nz2.fbm(x * 0.7, y * 0.7, 4) * smoothstep(0.2, 2, d) + hills;
          let s = Math.max(base, ridgeValue(x, y, k), pv);
          const relief = s - base;
          if (relief > 0) {
            const m = nz.ridged(x * 0.48 + 3.3, y * 0.48 - 7.1, 5);
            const f = clamp(0.86 + 0.5 * (m - 0.42), 0.62, 1.1);
            s = base + relief * f;
          }
          s += 35 * nz.fbm(x * 1.4, y * 1.4, 4) * smoothstep(60, 500, s);
          z = s;
          break;
        }
        case 'urban':
          z = Math.max(2.5 + 16 * smoothstep(0, 1.2, d) * (0.6 + 0.6 * n1), ridgeValue(x, y, k));
          break;
        case 'delta':
          z = 1.5 + 2.2 * smoothstep(0, 0.8, d) + 0.5 * nz.fbm(x * 2, y * 2, 3);
          break;
        case 'plain': {
          const north = smoothstep(38, 47.5, y);
          z = Math.min(d * 7, 20) + 46 * north * smoothstep(0, 3.5, d);
          z += (2.5 + 13 * north) * nz.fbm(x * 0.55, y * 0.55, 4) * smoothstep(0, 1.5, d);
          z = Math.max(z, ridgeValue(x, y, k));
          // Flatwoods south: poorly drained, very gentle
          z = Math.max(0.4, z);
          break;
        }
        case 'barrier': {
          const dO = dOpen[i];
          const fore = (5.5 + 3.5 * nz.fbm(x * 3, y * 3, 3)) * Math.exp(-(((dO - 0.11) / 0.07) ** 2));
          const back = 2.2 + 2.6 * smoothstep(0.15, 0.45, dO) * (0.6 + 0.8 * nz.fbm(x * 2.5 + 9, y * 2.5, 3));
          const lagoonMarsh = 1 - smoothstep(0.03, 0.35, d);
          z = Math.max(fore, back * (1 - 0.65 * lagoonMarsh)) + 0.6;
          if (isl.id === 'mirabel' && y < 32.2) {
            // Beach-ridge plain: ridges parallel to the old shorelines
            z += 2.0 * (0.5 + 0.5 * Math.sin((dO / 0.21) * Math.PI * 2 + nz.fbm(x, y) * 1.5)) * smoothstep(0.3, 0.7, dO);
          }
          z = Math.max(z, ridgeValue(x, y, k));
          break;
        }
        case 'seaisland': {
          let zz = 0.75 + 0.35 * nz.fbm(x * 1.7, y * 1.7, 3);
          // Live-oak hammocks: scattered low rises of Pleistocene sand in the marsh.
          const ham = nz2.fbm(x * 0.9 + 21, y * 0.9 - 5, 4);
          if (ham > 0.16) zz = Math.max(zz, 1.4 + (ham - 0.16) * 14);
          const wx = x + 0.6 * nz.fbm(x * 0.7 + 5, y * 0.7, 3), wy = y + 0.6 * nz.fbm(x * 0.7, y * 0.7 + 5, 3);
          for (const u of uplands) {
            const b = u.box;
            if (wx < b[0] || wx > b[2] || wy < b[1] || wy > b[3]) continue;
            const di = polyInsideDist(wx, wy, u.poly);
            if (di <= -0.05) continue;
            let v;
            if (u.dune) {
              const dO = dOpen[i];
              v = 1.6 + (4.2 + 2.5 * nz.fbm(x * 3, y * 3, 3)) * Math.exp(-(((dO - 0.12) / 0.09) ** 2)) + 1.5 * smoothstep(0.2, 0.5, dO);
              v *= smoothstep(-0.05, 0.12, di);
            } else {
              v = (u.z + 1.6 * nz.fbm(x * 1.2 + 4, y * 1.2, 3)) * smoothstep(-0.05, 0.4, di);
            }
            if (v > zz) zz = v;
          }
          z = zz;
          break;
        }
        case 'karst':
          z = Math.min(d * 4.5, 9) + 3 * nz.fbm(x * 0.8, y * 0.8, 4) * smoothstep(0, 1, d);
          z = Math.max(0.5, z, ridgeValue(x, y, k));
          break;
        case 'swamp': {
          const surf = 15 + 0.22 * (x - 24) + 0.12 * (y - 5);
          z = Math.min(d * 5.5, surf) + 0.8 * nz.fbm(x * 0.9, y * 0.9, 3);
          z -= 1.2 * Math.max(0, nz2.fbm(x * 3.2, y * 3.2, 3) - 0.25) * smoothstep(1, 3, d);
          z = Math.max(0.5, z, ridgeValue(x, y, k));
          break;
        }
        case 'keys':
          z = 0.4 + 1.5 * smoothstep(0, 0.35, d) + 0.4 * nz.fbm(x * 3, y * 3, 3);
          break;
        default:
          z = 2;
      }
      h[i] = z;
    }
  }
  log('structure done');

  // ---- 4. Basins, domes, cliffs --------------------------------------------
  const applyBasin = (b) => {
    const R = Math.max(b.rx, b.ry);
    forBox(g, b.at[0] - R, b.at[1] - R, b.at[0] + R, b.at[1] + R, (i, x, y) => {
      if (!island[i]) return;
      const rr = ellipseR(x, y, b.at[0], b.at[1], b.rx, b.ry, b.rot);
      if (rr >= 1) return;
      const wgt = b.blend * (1 - smoothstep(0.45, 1.0, rr));
      h[i] = lerp(h[i], b.floor + 8 * nz.fbm(x * 2, y * 2, 3), wgt);
    });
  };
  for (const b of BASINS) if (!b.late) applyBasin(b);
  for (const dm of DOMES) {
    const at = dm.peak ? PEAKS[dm.peak].at : dm.at;
    const top = dm.peak ? PEAKS[dm.peak].z : dm.z;
    forBox(g, at[0] - dm.r, at[1] - dm.r, at[0] + dm.r, at[1] + dm.r, (i, x, y) => {
      if (!island[i]) return;
      const u = Math.hypot(x - at[0], y - at[1]) / dm.r;
      if (u >= 1) return;
      let v;
      const base0 = h[i];
      if (dm.shape === 'dome') v = base0 + Math.max(0, top - base0) * Math.pow(1 - u * u, 1.15);
      else if (dm.shape === 'mesa') v = base0 + Math.max(0, top - base0) * smoothstep(1, 0.62, u);
      else v = base0 + Math.max(0, top - base0) * Math.exp(-u * u * 3) * (1 + 0.15 * nz.fbm(x * 8, y * 8, 2));
      if (v > h[i]) h[i] = v;
    });
  }
  for (const cl of CLIFFS) {
    const [bx0, by0, bx1, by1] = bbox(cl.poly);
    forBox(g, bx0, by0, bx1, by1, (i, x, y) => {
      if (!island[i] || dLand[i] > 1.2) return;
      const inZ = polyInsideDist(x, y, cl.poly);
      if (inZ <= 0) return;
      const v = cl.h * smoothstep(0, 1.5, inZ) * (0.75 + 0.45 * (0.5 + 0.5 * nz.fbm(x * 1.6 + 7, y * 1.6, 3))) * smoothstep(0, 0.07, dLand[i]) * (1 - smoothstep(0.5, 1.2, dLand[i]) * 0.0);
      if (v > h[i]) h[i] = v;
    });
  }
  log('basins/domes/cliffs done');

  // ---- 4b. Hydraulic erosion on the mountain islands ------------------------
  const mtn = new Set(ISLANDS.filter((s) => s.base.kind === 'mountain').map((s) => islandIdx[s.id]));
  const emask = new Uint8Array(N);
  for (let i = 0; i < N; i++) emask[i] = mtn.has(island[i]) && dLand[i] > 0.08 ? 1 : 0;
  {
    // Coarse pass (200 m) carves the major hollows and spur valleys.
    const f = 4, cx = Math.floor(g.nx / f), cy = Math.floor(g.ny / f);
    const ch = new Float32Array(cx * cy), cm = new Uint8Array(cx * cy);
    for (let r = 0; r < cy; r++) for (let c = 0; c < cx; c++) {
      let sum = 0, m = 0;
      for (let dr = 0; dr < f; dr++) for (let dc = 0; dc < f; dc++) {
        const i = (r * f + dr) * g.nx + c * f + dc;
        sum += h[i]; m += emask[i];
      }
      ch[r * cx + c] = sum / (f * f);
      cm[r * cx + c] = m === f * f ? 1 : 0;
    }
    const before = ch.slice();
    let cnt = 0; for (let i = 0; i < cm.length; i++) cnt += cm[i];
    erode(ch, cx, cy, cm, { droplets: cnt * 4, seed: 5, cellM: 200, radius: 2, maxErodePerStep: 1.2, capacity: 5, erodeRate: 0.3, depositRate: 0.2, maxSteps: 90 });
    const dlt = new Float32Array(cx * cy);
    let minD = 0;
    for (let i = 0; i < dlt.length; i++) { dlt[i] = clamp(ch[i] - before[i], -140, 60); minD = Math.min(minD, ch[i] - before[i]); }
    log(`coarse erosion max cut ${(-minD).toFixed(0)} m (clamped to 140)`);
    for (let r = 0; r < g.ny; r++) for (let c = 0; c < g.nx; c++) {
      const i = r * g.nx + c;
      if (!emask[i]) continue;
      const fx = clamp(c / f - 0.5, 0, cx - 1.001), fy = clamp(r / f - 0.5, 0, cy - 1.001);
      const ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
      const k = iy * cx + ix;
      const v = lerp(lerp(dlt[k], dlt[k + 1], tx), lerp(dlt[k + cx], dlt[k + cx + 1], tx), ty);
      h[i] += v * smoothstep(0.08, 0.6, dLand[i]);
    }
    log('coarse erosion done');
    let fc = 0; for (let i = 0; i < N; i++) fc += emask[i];
    erode(h, g.nx, g.ny, emask, { droplets: Math.floor(fc * 1.2), seed: 9, cellM: 50, radius: 2, maxErodePerStep: 0.7, capacity: 4, erodeRate: 0.3, depositRate: 0.2, maxSteps: 70 });
    log('fine erosion done');
  }

  // ---- 4c. Crest restoration: erosion and noise lower ridgelines; pull the
  // designed crests back up within a few hundred metres of each crest line.
  for (let r = 0; r < g.ny; r++) {
    const y = g.Y(r);
    for (let c = 0; c < g.nx; c++) {
      const i = r * g.nx + c;
      if (!emask[i]) continue;
      const x = g.X(c);
      const [rv, dist] = ridgeInfo(x, y, island[i]);
      if (rv <= h[i]) continue;
      const w = 1 - smoothstep(0.05, 0.9, dist);
      if (w > 0) h[i] = lerp(h[i], rv - 25 * nz.fbm(x * 3, y * 3, 2), w * 0.65);
    }
  }
  log('crest restoration done');

  // ---- 5. Summit correction -------------------------------------------------
  // Pull each named summit to its surveyed elevation and keep it the local high.
  const hAt = sampler(g, h);
  const peakFix = [];
  for (const [id, p] of Object.entries(PEAKS)) {
    const cur = hAt(p.at[0], p.at[1]);
    const delta = p.z - cur;
    const R = clamp(Math.abs(delta) / 220, p.z > 600 ? 0.9 : p.z > 150 ? 0.7 : 0.4, 2.4);
    peakFix.push({ id, ...p, delta, R });
  }
  for (const p of peakFix) {
    forBox(g, p.at[0] - p.R, p.at[1] - p.R, p.at[0] + p.R, p.at[1] + p.R, (i, x, y) => {
      if (!island[i]) return;
      const rr = Math.hypot(x - p.at[0], y - p.at[1]);
      const u = rr / p.R;
      if (u >= 1) return;
      let v = h[i] + p.delta * (1 - u * u) * (1 - u * u);
      const cap = p.z - (p.z > 600 ? 90 : p.z > 150 ? 50 : 20) * rr;
      if (v > cap) v = lerp(v, cap, 1 - smoothstep(0.35, 1, u));
      h[i] = v;
    });
  }
  log('summits done');

  // ---- 5b. Tidal creek networks in low marsh ---------------------------------
  const marshy = new Set(['seaisland', 'swamp', 'karst', 'keys', 'barrier', 'plain'].map((k) => k));
  for (let r = 0; r < g.ny; r++) {
    const y = g.Y(r);
    for (let c = 0; c < g.nx; c++) {
      const i = r * g.nx + c;
      const k = island[i];
      if (!k || h[i] > 1.6 || !marshy.has(ISLANDS[k - 1].base.kind)) continue;
      const x = g.X(c);
      const wx = x + 0.5 * nz2.fbm(x * 0.8, y * 0.8, 3), wy = y + 0.5 * nz2.fbm(x * 0.8 + 9, y * 0.8 - 4, 3);
      if (dLand[i] < 0.25) continue;
      const n = Math.abs(nz.fbm(wx * 0.6 + 40, wy * 0.6 - 12, 2));
      const near = 1 - smoothstep(0.5, 3.5, dLand[i]);
      if (n < 0.02 * (0.35 + near)) h[i] = -1.8;
    }
  }
  log('marsh creeks done');

  // ---- 6. Rivers ------------------------------------------------------------
  const water = new Uint8Array(N);
  const surface = new Float32Array(N).fill(NaN);
  for (let i = 0; i < N; i++) if (!island[i]) water[i] = W.SEA;
  const hRaw = sampler(g, h);
  const riverProfiles = [];
  const isLandAt = (x, y) => {
    const c = g.col(x), r = g.row(y);
    return c >= 0 && r >= 0 && c < g.nx && r < g.ny && island[r * g.nx + c] > 0 && water[r * g.nx + c] !== W.SEA;
  };
  for (const rv of RIVERS) {
    // Extend the mouth along its last bearing until it reaches open water.
    const src = rv.pts.slice();
    const a = src[src.length - 2], b = src[src.length - 1];
    if (!rv.tidal && isLandAt(b[0], b[1])) {
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const ux = (b[0] - a[0]) / L, uy = (b[1] - a[1]) / L;
      let ext = 0;
      while (ext < 6 && isLandAt(b[0] + ux * ext, b[1] + uy * ext)) ext += 0.1;
      if (ext > 0) src.push([b[0] + ux * (ext + 0.3), b[1] + uy * (ext + 0.3), Math.min(b[2], -2), b[3], b[4]]);
    }
    rv.extended = src;
    const pts = resample(src, g.c);
    // Meander: displace the resampled course sideways, pinned at both ends.
    {
      const n = pts.length, Lr = (n - 1) * g.c;
      const lowland = (rv.pts[Math.floor(rv.pts.length / 2)][3] || 0) > 0.25;
      const amp = rv.tidal ? 0.25 : lowland ? 0.32 : 0.1, wave = rv.tidal ? 2.5 : lowland ? 2.2 : 0.9;
      const disp = pts.map((p, k) => {
        const sk = k * g.c;
        const pin = smoothstep(0, 0.8, sk) * smoothstep(0, 0.8, Lr - sk);
        return amp * pin * (nz2.fbm(sk / wave + rv.id.length * 3.3, 7.7, 3) * 3);
      });
      const out = pts.map((p) => p.slice());
      for (let k = 0; k < n; k++) {
        const a = pts[Math.max(0, k - 1)], b = pts[Math.min(n - 1, k + 1)];
        let dx = b[0] - a[0], dy = b[1] - a[1];
        const l = Math.hypot(dx, dy) || 1;
        out[k][0] = pts[k][0] - (dy / l) * disp[k];
        out[k][1] = pts[k][1] + (dx / l) * disp[k];
      }
      for (let k = 0; k < n; k++) { pts[k][0] = out[k][0]; pts[k][1] = out[k][1]; }
    }
    const bed = new Float32Array(pts.length);
    for (let s = 0; s < pts.length; s++) {
      const spec = pts[s][2];
      bed[s] = rv.tidal ? spec : Math.min(spec, hRaw(pts[s][0], pts[s][1]) - 1.0);
      if (s > 0 && bed[s] > bed[s - 1]) bed[s] = bed[s - 1];
    }
    const cw0 = Math.max(rv.width / 2000, rv.tidal ? 0.06 : 0.026);
    const depth = rv.tidal ? 0 : rv.width >= 30 ? 1.8 : 0.8;
    // Estuary: the last `len` km widen into a drowned funnel below sea level.
    const L = (pts.length - 1) * g.c;
    const [eLen, eMouth] = rv.estuary || [0, 0];
    for (let s = 1; s < pts.length; s++) {
      const a = pts[s - 1], b = pts[s];
      const along = s * g.c;
      const et = eLen > 0 ? clamp((along - (L - eLen)) / eLen, 0, 1) : 0;
      const cw = lerp(cw0, eMouth / 2, Math.pow(et, 1.4));
      if (et > 0) { const sb = lerp(Math.min(bed[s], 0.5), -2.5 - 3 * et, et); if (sb < bed[s]) bed[s] = sb; }
      const fp = et > 0 ? 0.05 : Math.max(a[3] || 0, 0), wall = et > 0 ? 25 : a[4] || 200;
      const R = cw + fp + clamp(1100 / wall, 0.15, 1.8) * (et > 0 ? 0.2 : 1);
      forBox(g, Math.min(a[0], b[0]) - R, Math.min(a[1], b[1]) - R, Math.max(a[0], b[0]) + R, Math.max(a[1], b[1]) + R, (i, x, y) => {
        const [d, t] = segDist(x, y, a[0], a[1], b[0], b[1]);
        if (d > R) return;
        const bz = lerp(bed[s - 1], bed[s], t);
        let target;
        if (d <= cw) target = bz - depth;
        else if (d <= cw + fp) target = bz + 1.5 * ((d - cw) / fp);
        else target = bz + (fp > 0 ? 1.5 : 0) + (d - cw - fp) * wall * (1 + 0.35 * nz.fbm(x * 2.3, y * 2.3, 3));
        if (target < h[i]) h[i] -= (h[i] - target) * (1 - smoothstep(0.55 * R, R, d));
        if (d <= cw && island[i]) {
          const localW = rv.width * (0.3 + 0.7 * Math.min(1, along / Math.max(1, L * 0.8)));
          if (rv.tidal || bz < 0.2) water[i] = W.SEA;
          else if (localW >= 28 && d <= Math.max(0.026, localW / 2000)) { water[i] = W.RIVER; surface[i] = bz; }
        }
      });
    }
    riverProfiles.push({ id: rv.id, name: rv.name, pts, bed });
  }
  log('rivers done');

  // ---- 6b. Final summit pass (tight radius) so surveyed heights hold. -------
  for (let pass = 0; pass < 3; pass++) {
    const hNow = (x, y) => h[g.row(y) * g.nx + g.col(x)];
    for (const p of peakFix) {
      const d2 = p.z - hNow(p.at[0], p.at[1]);
      if (Math.abs(d2) < 3) continue;
      const R2 = clamp(Math.abs(d2) / 300, 0.35, 1.2);
      forBox(g, p.at[0] - R2, p.at[1] - R2, p.at[0] + R2, p.at[1] + R2, (i, x, y) => {
        if (!island[i] || water[i]) return;
        const u = Math.hypot(x - p.at[0], y - p.at[1]) / R2;
        if (u >= 1) return;
        h[i] += d2 * (1 - u * u) * (1 - u * u);
      });
      p.delta2 = d2;
    }
  }
  for (const b of BASINS) if (b.late) applyBasin(b);
  log('final summit pass done');

  // ---- 7. Lakes ---------------------------------------------------------------
  const lakeId = new Uint8Array(N); // 1-based index into LAKES
  const lakeInfo = [];
  LAKES.forEach((lk, k) => {
    let level = lk.level;
    if (lk.kind === 'reservoir') {
      // Flood upstream from the dam. The dam line is a barrier; water fills
      // every connected cell below the pool level. If the pool escapes (finds
      // the sea, or spreads beyond the search box) the level is above the
      // basin's lowest saddle, so it is lowered until the basin holds.
      const [d0, d1] = lk.dam;
      const mx = (d0[0] + d1[0]) / 2, my = (d0[1] + d1[1]) / 2;
      const up = lk.upstream || lk.at;
      const R = 7;
      const onDam = (x, y) => segDist(x, y, d0[0], d0[1], d1[0], d1[1])[0] < 0.045;
      let seed = -1, seedH = Infinity;
      forBox(g, up[0] - 0.25, up[1] - 0.25, up[0] + 0.25, up[1] + 0.25, (i, x, y) => {
        if (island[i] && !onDam(x, y) && h[i] < seedH) { seedH = h[i]; seed = i; }
      });
      const mark = new Uint8Array(N);
      const flood = (lev) => {
        mark.fill(0);
        const q = [seed], cells = [];
        mark[seed] = 1;
        while (q.length) {
          const i = q.pop();
          cells.push(i);
          if (water[i] === W.SEA || cells.length > 60000) return null;
          const c = i % g.nx, r = Math.floor(i / g.nx);
          if (Math.abs(g.X(c) - mx) > R || Math.abs(g.Y(r) - my) > R) return null;
          for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const j = (r + dr) * g.nx + c + dc;
            if (mark[j] || h[j] >= lev || !island[j]) continue;
            if (onDam(g.X(c + dc), g.Y(r + dr))) continue;
            mark[j] = 1; q.push(j);
          }
        }
        return cells;
      };
      let cells = null;
      while (seed >= 0 && level > seedH + 2) {
        cells = flood(level);
        if (cells) break;
        level -= 2;
      }
      if (level !== lk.level) log(`  ${lk.id}: pool lowered from ${lk.level} to ${level} m to stay below the basin saddle`);
      for (const i of cells || []) { water[i] = W.LAKE; surface[i] = level; lakeId[i] = k + 1; }
      // The dam itself: a crest 3 m above pool across the valley.
      const crest = level + 3;
      forBox(g, Math.min(d0[0], d1[0]) - 0.1, Math.min(d0[1], d1[1]) - 0.1, Math.max(d0[0], d1[0]) + 0.1, Math.max(d0[1], d1[1]) + 0.1, (i, x, y) => {
        const [d] = segDist(x, y, d0[0], d0[1], d1[0], d1[1]);
        if (d < 0.03 && h[i] < crest) { h[i] = crest; if (water[i] === W.RIVER) water[i] = W.LAND; }
      });
      lakeInfo.push({ id: lk.id, level, areaKm2: (cells || []).length * g.c * g.c, dam: lk.dam, crest });
      return;
    }
    if (lk.kind === 'arc') {
      const R = lk.r + lk.width;
      const ring = [];
      for (let a = lk.a0; a <= lk.a1; a += 10) ring.push(hRaw(lk.at[0] + Math.cos(a * Math.PI / 180) * R, lk.at[1] + Math.sin(a * Math.PI / 180) * R));
      level = Math.min(...ring) - 0.4;
      let area = 0;
      forBox(g, lk.at[0] - R, lk.at[1] - R, lk.at[0] + R, lk.at[1] + R, (i, x, y) => {
        const dx = x - lk.at[0], dy = y - lk.at[1];
        let ang = (Math.atan2(dy, dx) * 180) / Math.PI;
        while (ang < lk.a0) ang += 360;
        if (ang > lk.a1) return;
        const dr = Math.abs(Math.hypot(dx, dy) - lk.r);
        if (dr > lk.width / 2) return;
        h[i] = Math.min(h[i], level - lk.depth * (1 - (dr / (lk.width / 2)) ** 2));
        water[i] = W.LAKE; surface[i] = level; lakeId[i] = k + 1; area++;
      });
      lakeInfo.push({ id: lk.id, level, areaKm2: area * g.c * g.c });
      return;
    }
    // basin / quarry: ellipse
    const ring = [];
    for (let a = 0; a < 360; a += 15) {
      const rad = (a * Math.PI) / 180, rot = (lk.rot * Math.PI) / 180;
      const lx = Math.cos(rad) * lk.rx * 1.15, ly = Math.sin(rad) * lk.ry * 1.15;
      ring.push(hRaw(lk.at[0] + lx * Math.cos(rot) - ly * Math.sin(rot), lk.at[1] + lx * Math.sin(rot) + ly * Math.cos(rot)));
    }
    const rim = Math.min(...ring);
    level = typeof lk.level === 'number' ? lk.level : rim - (lk.kind === 'quarry' ? 5 : 0.4);
    const R = Math.max(lk.rx, lk.ry) * 1.2;
    let area = 0;
    forBox(g, lk.at[0] - R, lk.at[1] - R, lk.at[0] + R, lk.at[1] + R, (i, x, y) => {
      if (!island[i]) return;
      const rr = ellipseR(x, y, lk.at[0], lk.at[1], lk.rx, lk.ry, lk.rot);
      if (rr >= 1) return;
      const bottom = lk.kind === 'quarry'
        ? level - lk.depth * smoothstep(1.0, 0.8, rr)
        : level - lk.depth * (1 - rr * rr);
      if (bottom < h[i]) h[i] = bottom;
      if (h[i] < level) { water[i] = W.LAKE; surface[i] = level; lakeId[i] = k + 1; area++; }
    });
    lakeInfo.push({ id: lk.id, level, areaKm2: area * g.c * g.c });
  });
  log('lakes done');

  // ---- 8. Bathymetry -------------------------------------------------------------
  {
    const dep = new Float32Array(N), wgt = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      if (island[i]) continue;
      const wt = WATERS[region[i]];
      dep[i] = Math.min(wt.maxDepth, 0.4 + wt.slope * dSea[i]);
      wgt[i] = 1;
    }
    // Normalised box blur so region boundaries do not show as steps.
    const blur = (a, rad) => {
      const t = new Float32Array(N);
      for (let r = 0; r < g.ny; r++) {
        let acc = 0;
        const row = r * g.nx;
        for (let c = -rad; c < g.nx; c++) {
          if (c + rad < g.nx) acc += a[row + c + rad];
          if (c - rad - 1 >= 0) acc -= a[row + c - rad - 1];
          if (c >= 0) t[row + c] = acc;
        }
      }
      for (let c = 0; c < g.nx; c++) {
        let acc = 0;
        for (let r = -rad; r < g.ny; r++) {
          if (r + rad < g.ny) acc += t[(r + rad) * g.nx + c];
          if (r - rad - 1 >= 0) acc -= t[(r - rad - 1) * g.nx + c];
          if (r >= 0) a[r * g.nx + c] = acc;
        }
      }
    };
    const dw = new Float32Array(N);
    for (let i = 0; i < N; i++) dw[i] = dep[i] * wgt[i];
    for (let pass = 0; pass < 3; pass++) { blur(dw, 36); blur(wgt, 36); }
    for (let r = 0; r < g.ny; r++) {
      const y = g.Y(r);
      for (let c = 0; c < g.nx; c++) {
        const i = r * g.nx + c;
        if (island[i]) continue;
        const x = g.X(c);
        let depth = wgt[i] > 0 && WATERS[region[i]].id !== 'hollow-reach' ? dw[i] / wgt[i] : dep[i];
        // Near shore, honour the local recipe so beaches stay shallow.
        depth = Math.min(depth, 0.4 + WATERS[region[i]].slope * dSea[i] * 1.5);
        h[i] = -depth * (1 + 0.18 * nz.fbm(x * 0.7 + 30, y * 0.7, 3));
      }
    }
  }
  for (const bt of BATHY) {
    const pts = resample(bt.pts, g.c * 2);
    for (let k = 0; k < pts.length; k++) {
      // Natural troughs and shoals wander and swell along their length;
      // dredged channels stay straight.
      const p = pts[k], pa = pts[Math.max(0, k - 1)], pb = pts[Math.min(pts.length - 1, k + 1)];
      const tl = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]) || 1, tx = (pb[0] - pa[0]) / tl, ty = (pb[1] - pa[1]) / tl;
      const natural = bt.kind !== 'channel';
      const wob = natural ? nz.fbm(p[0] * 0.16 + 7.3, p[1] * 0.16 - 2.1, 3) : 0;
      const R = bt.w * (natural ? 0.55 + 1.1 * clamp(nz.fbm(p[0] * 0.22 - 4, p[1] * 0.22 + 9, 3) + 0.5, 0, 1) : 1);
      const px = p[0] - ty * wob * bt.w * 1.4, py = p[1] + tx * wob * bt.w * 1.4;
      forBox(g, px - R, py - R, px + R, py + R, (i, x, y) => {
        if (island[i]) return;
        const d = Math.hypot(x - px, y - py);
        if (d > R) return;
        if (bt.kind === 'trough') {
          const v = -p[2] * (1 - (d / R) ** 2);
          if (v < h[i]) h[i] = v;
        } else if (bt.kind === 'channel') {
          if (d <= R / 2 && -p[2] < h[i]) h[i] = -p[2];
        } else if (bt.kind === 'shoal') {
          const v = lerp(-p[2], h[i], (d / R) ** 2);
          if (v > h[i]) h[i] = v;
        }
      });
    }
  }
  // Tidal creeks cut below sea level become salt water; keep other land above
  // the waterline so the coastline stays crisp.
  for (let i = 0; i < N; i++) {
    if (island[i] && water[i] === W.LAND && h[i] < -0.2) { water[i] = W.SEA; continue; }
    if (island[i] && water[i] === W.LAND && h[i] < 0.3) h[i] = 0.3;
    if (!island[i] && h[i] > -0.4) h[i] = -0.4;
  }
  log('bathymetry done');

  // ---- 9. Infrastructure grading -----------------------------------------------
  // Runways are levelled, berths dredged, and every road and railway gets a
  // grade-limited alignment cut or filled into the ground. Spans that would
  // need deeper cuts become tunnels; higher fills become viaducts.
  const routeReports = [];
  {
    const hS = sampler(g, h);
    const isWet = (x, y) => {
      const c = g.col(x), r = g.row(y);
      if (c < 0 || r < 0 || c >= g.nx || r >= g.ny) return true;
      const i = r * g.nx + c;
      return water[i] === W.SEA || water[i] === W.LAKE || water[i] === W.RIVER;
    };
    // Airports first so roads meet the graded apron.
    for (const ap of AIRPORTS) {
      for (const rw of ap.runways) {
        const za = hS(...rw.a), zb = hS(...rw.b);
        const L = Math.hypot(rw.b[0] - rw.a[0], rw.b[1] - rw.a[1]);
        // Longitudinal grade capped at 1%.
        const zm = (za + zb) / 2, half = Math.min(Math.abs(zb - za) / 2, 0.005 * L * 1000);
        const z0 = zm - Math.sign(zb - za) * half, z1 = zm + Math.sign(zb - za) * half;
        const hw = rw.w / 2 + 0.11, mg = 0.25;
        let cutMax = 0, fillMax = 0;
        forBox(g, Math.min(rw.a[0], rw.b[0]) - hw - mg, Math.min(rw.a[1], rw.b[1]) - hw - mg, Math.max(rw.a[0], rw.b[0]) + hw + mg, Math.max(rw.a[1], rw.b[1]) + hw + mg, (i, x, y) => {
          if (!island[i] || water[i]) return;
          const [d, t] = segDist(x, y, rw.a[0], rw.a[1], rw.b[0], rw.b[1]);
          if (d > hw + mg) return;
          const target = lerp(z0, z1, t);
          const w = d <= hw ? 1 : 1 - smoothstep(0, mg, d - hw);
          if (d <= hw) { cutMax = Math.max(cutMax, h[i] - target); fillMax = Math.max(fillMax, target - h[i]); }
          h[i] = lerp(h[i], target, w);
        });
        routeReports.push({ kind: 'runway', id: `${ap.id}:${rw.id}`, name: `${ap.name} runway ${rw.id}`, lengthKm: L, z0, z1, gradePct: (Math.abs(z1 - z0) / (L * 1000)) * 100, cutMax, fillMax });
      }
    }
    for (const pt of PORTS) {
      const [a, b] = pt.berth;
      forBox(g, Math.min(a[0], b[0]) - 0.35, Math.min(a[1], b[1]) - 0.35, Math.max(a[0], b[0]) + 0.35, Math.max(a[1], b[1]) + 0.35, (i, x, y) => {
        if (water[i] !== W.SEA) return;
        const [d] = segDist(x, y, a[0], a[1], b[0], b[1]);
        if (d < 0.3 && h[i] > -pt.depth) h[i] = -pt.depth;
      });
    }
    const routes = [
      ...ROADS.map((r) => ({ ...r, kindOf: 'road', design: { ...(DESIGN[r.cls] || DESIGN.county), ...(r.grade ? { grade: r.grade } : {}) } })),
      ...RAILS.map((r) => ({ ...r, kindOf: 'rail', design: { ...(r.status === 'abandoned' ? DESIGN['rail-abandoned'] : DESIGN.rail), ...(r.grade ? { grade: r.grade } : {}), ...(r.viaductFill ? { viaductFill: r.viaductFill } : {}) } })),
    ];
    // Resolve waypoint lists: a vertex tagged 'r' is reached by a
    // grade-constrained search from the previous vertex; others are straight.
    const F = makeRouteField(g, h, water, island, 1);
    let nRouted = 0;
    for (const rt of routes) {
      if (!rt.pts.some((q) => q[2] === 'r')) continue;
      const out = [[rt.pts[0][0], rt.pts[0][1]]];
      for (let k = 1; k < rt.pts.length; k++) {
        const q = rt.pts[k], prev = out[out.length - 1];
        if (q[2] !== 'r') { out.push([q[0], q[1]]); continue; }
        const res = findRoute(F, prev, q, { gmax: (q[3] || rt.grade || rt.design.grade) * 0.92, waterMult: rt.waterMult || 14, box: rt.box || 3.5 });
        nRouted++;
        if (!res) { out.push([q[0], q[1]]); continue; }
        const sm = chaikin(simplify(res.path, 0.012), 1);
        for (let m = 1; m < sm.length; m++) out.push(sm[m]);
      }
      rt.pts = out;
    }
    log(`routed ${nRouted} legs`);
    const best = new Float32Array(N).fill(1e9);
    const target = new Float32Array(N);
    const blendW = new Float32Array(N);
    for (const rt of routes) {
      const pr = routeProfile(rt.pts, hS, isWet, rt.design);
      rt.profile = pr;
      const hw = rt.design.width / 2;
      for (const sg of pr.segs) {
        if (sg.kind !== 'grade') continue;
        for (let k = sg.i; k <= sg.j; k++) {
          const [px, py] = pr.P[k];
          const dz = Math.abs(pr.z[k] - pr.p[k]);
          const mg = Math.min(0.15, 0.012 + (dz * 2) / 1000);
          const R = hw + mg;
          forBox(g, px - R, py - R, px + R, py + R, (i, x, y) => {
            if (!island[i] || water[i]) return;
            const d = Math.hypot(x - px, y - py);
            if (d > R || d >= best[i]) return;
            best[i] = d; target[i] = pr.p[k];
            blendW[i] = d <= hw ? 1 : 1 - smoothstep(0, mg, d - hw);
          });
        }
      }
      routeReports.push({
        kind: rt.kindOf, id: rt.id, name: rt.name, ref: rt.ref, cls: rt.cls || rt.status, status: rt.status, use: rt.use, lengthKm: pr.length,
        maxGradePct: pr.maxGrade * 100, maxCut: pr.maxCut, maxFill: pr.maxFill,
        segs: pr.segs.filter((s) => s.kind !== 'grade').map((s) => ({ kind: s.kind, len: s.len, a: s.a, b: s.b, mid: s.mid, deck: s.deck, minWater: s.minWater })),
        profile: pr.P.map((q, k) => [q[0], q[1], pr.p[k], pr.wet[k]]).filter((_, k) => k % 4 === 0 || k === pr.P.length - 1),
      });
    }
    for (let i = 0; i < N; i++) if (best[i] < 1e8) h[i] = lerp(h[i], target[i], blendW[i]);
  }
  log('infrastructure grading done');

  // ---- 10. Drainage enforcement ----------------------------------------------
  // Priority-flood with a tiny gradient so every pit on the mountain, farm and
  // city islands drains to the sea or a lake. Swamp, karst, marsh and dune
  // swales keep their natural closed hollows (those are real wetlands).
  {
    const fillK = new Set(ISLANDS.map((s, k) => (['mountain', 'plain', 'urban', 'delta', 'mainland'].includes(s.base.kind) ? k + 1 : 0)).filter(Boolean));
    const done = new Uint8Array(N);
    const hk = [], hv = [];
    const push = (k, v) => { hk.push(k); hv.push(v); let i = hk.length - 1; while (i > 0) { const q = (i - 1) >> 1; if (hk[q] <= hk[i]) break; [hk[q], hk[i]] = [hk[i], hk[q]]; [hv[q], hv[i]] = [hv[i], hv[q]]; i = q; } };
    const pop = () => { const v = hv[0]; const lk = hk.pop(), lv = hv.pop(); if (hk.length) { hk[0] = lk; hv[0] = lv; let i = 0; for (;;) { let m = i; const l = 2 * i + 1, r2 = l + 1; if (l < hk.length && hk[l] < hk[m]) m = l; if (r2 < hk.length && hk[r2] < hk[m]) m = r2; if (m === i) break; [hk[m], hk[i]] = [hk[i], hk[m]]; [hv[m], hv[i]] = [hv[i], hv[m]]; i = m; } } return v; };
    // Seeds: every cell that is water or not on a fill island.
    for (let i = 0; i < N; i++) {
      if (!island[i] || water[i] || !fillK.has(island[i])) {
        const c = i % g.nx;
        // only boundary cells matter; push those adjacent to fill-island land
        const nb = [c > 0 ? i - 1 : -1, c < g.nx - 1 ? i + 1 : -1, i - g.nx, i + g.nx];
        done[i] = 1;
        if (nb.some((j) => j >= 0 && j < N && island[j] && !water[j] && fillK.has(island[j]))) push(water[i] === W.LAKE ? surface[i] : h[i], i);
      }
    }
    let raised = 0;
    while (hk.length) {
      const i = pop();
      const base = water[i] === W.LAKE ? surface[i] : h[i];
      const c = i % g.nx;
      const nb = [c > 0 ? i - 1 : -1, c < g.nx - 1 ? i + 1 : -1, i - g.nx, i + g.nx];
      for (const j of nb) {
        if (j < 0 || j >= N || done[j]) continue;
        done[j] = 1;
        if (h[j] <= base) { h[j] = base + 0.01; raised++; }
        push(h[j], j);
      }
    }
    log(`drainage: raised ${raised} cells`);
  }

  // ---- 11. Summits are the local high ground. ---------------------------------
  for (const p of peakFix) {
    const R = 0.4;
    forBox(g, p.at[0] - R, p.at[1] - R, p.at[0] + R, p.at[1] + R, (i, x, y) => {
      if (!island[i] || water[i]) return;
      const d = Math.hypot(x - p.at[0], y - p.at[1]);
      if (d < 0.03 || d > R) return;
      const cap = p.z - 4 - 55 * d;
      if (h[i] > cap) h[i] = cap;
    });
    const ci = g.row(p.at[1]) * g.nx + g.col(p.at[0]);
    h[ci] = p.z;
  }

  // ---- 12. Lake containment. --------------------------------------------------
  // Shore cells that later grading or erosion left below an adjacent lake's
  // surface would let the lake spill; they become a low natural rim instead.
  {
    let raised = 0, worst = 0;
    for (let pass = 0; pass < 2; pass++) {
      for (let r = 1; r < g.ny - 1; r++) for (let c = 1; c < g.nx - 1; c++) {
        const i = r * g.nx + c;
        if (water[i] !== W.LAND) continue;
        let s = -Infinity;
        for (const j of [i - 1, i + 1, i - g.nx, i + g.nx]) if (water[j] === W.LAKE) s = Math.max(s, surface[j]);
        if (s === -Infinity || h[i] >= s + 0.2) continue;
        worst = Math.max(worst, s + 0.3 - h[i]);
        h[i] = s + 0.3; raised++;
      }
    }
    log(`lake containment: raised ${raised} shore cells (largest ${worst.toFixed(1)} m)`);
  }

  return {
    g, h, island, water, surface, region, lakeId, dLand, dSea, dOpen,
    riverProfiles, lakeInfo, peakFix, islandIdx, routeReports,
  };
}
