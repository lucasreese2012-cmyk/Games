// World analysis: placement validation, visibility, hydrology, engineering
// and scale statistics. Everything here is measured from the generated
// terrain, so the documents quote numbers the map actually has.
import { ISLANDS, PEAKS, LAKES, RIVERS, WATERS } from '../world/geography.mjs';
import { SETTLEMENTS } from '../world/settlements.mjs';
import { ROADS, RAILS, AIRPORTS, PORTS, FERRIES, POWER, BRIDGE_NAMES } from '../world/transport.mjs';
import { MOUNTAINS } from '../world/registers/mountains.mjs';
import { LAKE_TEXT } from '../world/registers/lakes.mjs';
import { BEACHES } from '../world/registers/beaches.mjs';
import { FORESTS } from '../world/registers/forests.mjs';
import { VIEWPOINTS } from '../world/registers/viewpoints.mjs';
import { DISTRICTS } from '../world/registers/districts.mjs';
import { LANDMARKS } from '../world/registers/landmarks.mjs';
import { W } from './terrain.mjs';
import { DESIGN } from './lib/profile.mjs';
import { classify, LC, C } from './landcover.mjs';
import { clamp, segDist } from './lib/geom.mjs';

const KM_DROP = 0.0683; // metres of curvature-plus-refraction drop per km² of distance

export function analyze(T, log = console.log) {
  const { g, h, island, water, dLand } = T;
  const N = g.nx * g.ny;
  const cellIdx = (x, y) => {
    const c = g.col(x), r = g.row(y);
    if (c < 0 || r < 0 || c >= g.nx || r >= g.ny) return -1;
    return r * g.nx + c;
  };
  const islandIdOf = (i) => (i >= 0 && island[i] ? ISLANDS[island[i] - 1].id : null);
  const partOf = (id) => {
    const isl = ISLANDS.find((s) => s.id === id);
    return isl && isl.partOf ? isl.partOf : id;
  };
  const issues = [];

  // ---------------------------------------------------------------------------
  // 1. Beaches: snap to the nearest shoreline cell on the right island.
  const beaches = BEACHES.map((b) => {
    let best = null;
    const R = 2.5;
    for (let r = g.row(b.at[1] + R); r <= g.row(b.at[1] - R); r++) {
      for (let c = g.col(b.at[0] - R); c <= g.col(b.at[0] + R); c++) {
        const i = r * g.nx + c;
        if (!island[i] || water[i]) continue;
        if (partOf(islandIdOf(i)) !== partOf(b.island)) continue;
        // shoreline: a water neighbour
        const nb = [i - 1, i + 1, i - g.nx, i + g.nx];
        if (!nb.some((j) => j >= 0 && j < N && (water[j] === W.SEA || water[j] === W.LAKE))) continue;
        const d = Math.hypot(g.X(c) - b.at[0], g.Y(r) - b.at[1]);
        if (!best || d < best.d) best = { d, x: g.X(c), y: g.Y(r) };
      }
    }
    if (!best) issues.push({ kind: 'beach', id: b.id, msg: 'no shoreline found within 2.5 km' });
    return { ...b, snapped: best ? [+best.x.toFixed(3), +best.y.toFixed(3)] : b.at, moved: best ? best.d : null };
  });

  // Land cover with register zones (forests, parks) and beaches painted on.
  const zones = { list: [...FORESTS.map((f) => ({ at: f.at, rx: f.rx, ry: f.ry, rot: f.rot, cover: f.cover, only: f.only })), ...DISTRICTS.filter((d) => d.cover).map((d) => ({ at: d.at, r: d.r, cover: d.cover }))] };
  const { cover, slope } = classify(T, zones);
  for (const b of beaches) {
    const L = b.len / 2;
    for (let r = g.row(b.snapped[1] + L); r <= g.row(b.snapped[1] - L); r++) for (let c = g.col(b.snapped[0] - L); c <= g.col(b.snapped[0] + L); c++) {
      const i = r * g.nx + c;
      if (!island[i] || water[i] || dLand[i] > 0.08) continue;
      if (Math.hypot(g.X(c) - b.snapped[0], g.Y(r) - b.snapped[1]) > L) continue;
      cover[i] = C.beach;
    }
  }
  log('land cover classified');

  // ---------------------------------------------------------------------------
  // 2. Point placement checks.
  const placement = [];
  const check = (reg, e, wantWater = false) => {
    const i = cellIdx(e.at[0], e.at[1]);
    const isl = islandIdOf(i);
    const wet = i >= 0 && water[i] !== W.LAND;
    const allowWet = wantWater || e.inWater || e.onStructure;
    const ok = (partOf(isl) === partOf(e.island) || (allowWet && wet)) && (allowWet || !wet);
    const rec = { reg, id: e.id, name: e.name || e.id, island: e.island, at: e.at, h: i >= 0 ? h[i] : null, onIsland: isl, wet, ok };
    placement.push(rec);
    if (!ok) issues.push({ kind: reg, id: e.id, msg: `placed on ${isl || 'water'} (expected ${e.island})` });
    return rec;
  };
  for (const s of SETTLEMENTS) check('settlement', s);
  for (const d of DISTRICTS) check('district', d);
  for (const v of VIEWPOINTS) check('viewpoint', v);
  for (const l of LANDMARKS) check('landmark', l, ['wind-farm', 'wreck', 'lighthouse', 'bridge', 'lift-bridge', 'viaduct', 'pylons'].includes(l.kind));
  // Mountains: surveyed height and local-maximum test.
  const mountains = MOUNTAINS.map((m) => {
    const p = PEAKS[m.id];
    const i = cellIdx(p.at[0], p.at[1]);
    let hmax = -1e9;
    const R = 0.3;
    for (let r = g.row(p.at[1] + R); r <= g.row(p.at[1] - R); r++) for (let c = g.col(p.at[0] - R); c <= g.col(p.at[0] + R); c++) {
      const j = r * g.nx + c;
      if (Math.hypot(g.X(c) - p.at[0], g.Y(r) - p.at[1]) <= R) hmax = Math.max(hmax, h[j]);
    }
    // Prominence-like relief: lowest ground within 3 km.
    let hmin = 1e9;
    for (let r = g.row(p.at[1] + 3); r <= g.row(p.at[1] - 3); r += 2) for (let c = g.col(p.at[0] - 3); c <= g.col(p.at[0] + 3); c += 2) {
      const j = r * g.nx + c;
      if (j >= 0 && j < N && island[j]) hmin = Math.min(hmin, h[j]);
    }
    const measured = i >= 0 ? h[i] : null;
    const localMax = hmax <= measured + 6;
    if (!localMax || Math.abs(measured - p.z) > 15) issues.push({ kind: 'mountain', id: m.id, msg: `measured ${measured?.toFixed(0)} m vs ${p.z}, local max ${localMax}` });
    return { ...m, ...p, measured, localMax, relief3km: measured - hmin };
  });

  // ---------------------------------------------------------------------------
  // 3. Lakes.
  const lakeByIdx = new Map();
  for (let i = 0; i < N; i++) if (T.lakeId[i]) lakeByIdx.set(T.lakeId[i], (lakeByIdx.get(T.lakeId[i]) || 0) + 1);
  const lakes = LAKES.map((lk, k) => {
    const txt = LAKE_TEXT.find((t) => t.id === lk.id) || {};
    const info = T.lakeInfo.find((q) => q.id === lk.id) || {};
    const cells = lakeByIdx.get(k + 1) || 0;
    let maxDepth = 0;
    if (cells) for (let i = 0; i < N; i++) if (T.lakeId[i] === k + 1) maxDepth = Math.max(maxDepth, info.level - h[i]);
    if (!cells) issues.push({ kind: 'lake', id: lk.id, msg: 'lake holds no water' });
    const at = lk.at || [lk.region.reduce((a, q) => a + q[0], 0) / lk.region.length, lk.region.reduce((a, q) => a + q[1], 0) / lk.region.length];
    return { ...txt, id: lk.id, name: lk.name, island: lk.island, kind: lk.kind, at, level: info.level, areaKm2: cells * g.c * g.c, maxDepth };
  });

  // ---------------------------------------------------------------------------
  // 4. Visibility (curvature + refraction + haze limit 60 km).
  const losFrom = (ax, ay, eye, bx, by, tgtH) => {
    const ia = cellIdx(ax, ay), ib = cellIdx(bx, by);
    if (ia < 0 || ib < 0) return false;
    const za = Math.max(0, h[ia]) + eye, zb = Math.max(0, h[ib]) + tgtH;
    const D = Math.hypot(bx - ax, by - ay);
    if (D > 60) return false;
    const n = Math.max(2, Math.ceil(D / 0.05));
    for (let s = 1; s < n; s++) {
      const t = s / n;
      const x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
      const i = cellIdx(x, y);
      if (i < 0) continue;
      const d0 = D * Math.min(t, 1 - t);
      const forest = !water[i] && cover[i] >= C['bottomland'] && cover[i] <= C['spruce-fir'] && cover[i] !== C.cropland && cover[i] !== C.pasture;
      const ground = Math.max(0, h[i]) + (forest && d0 > 0.35 ? 18 : 0);
      const d1 = D * t, d2 = D * (1 - t);
      const sight = za + (zb - za) * t;
      const drop = KM_DROP * d1 * d2; // bulge of the earth between the two points
      if (ground + drop > sight + 1) return false;
    }
    return true;
  };
  const targets = [
    ...LANDMARKS.filter((l) => l.tier === 'primary' || l.tier === 'secondary').map((l) => ({ id: l.id, name: l.name, tier: l.tier, at: l.at, h: Math.max(l.h || 0, 2) })),
    ...MOUNTAINS.filter((m) => PEAKS[m.id].z > 1000 || ['grayback', 'iron-mountain', 'kestrel-hill'].includes(m.id)).map((m) => ({ id: m.id, name: PEAKS[m.id].name, tier: 'summit', at: PEAKS[m.id].at, h: 5 })),
    ...SETTLEMENTS.filter((s) => s.pop > 10000).map((s) => ({ id: s.id, name: s.name, tier: 'town', at: s.at, h: s.form === 'city' ? 120 : 20 })),
  ];
  const viewpoints = VIEWPOINTS.map((v) => {
    const seen = [];
    for (const t of targets) {
      if (Math.hypot(t.at[0] - v.at[0], t.at[1] - v.at[1]) < 0.4) continue;
      if (losFrom(v.at[0], v.at[1], v.eye || 2, t.at[0], t.at[1], t.h)) seen.push({ id: t.id, name: t.name, tier: t.tier, dist: Math.hypot(t.at[0] - v.at[0], t.at[1] - v.at[1]) });
    }
    seen.sort((a, b) => a.dist - b.dist);
    const i = cellIdx(v.at[0], v.at[1]);
    return { ...v, ground: i >= 0 ? h[i] : null, seen };
  });
  // Landmark chaining: what each primary landmark can see of the others.
  const chains = LANDMARKS.filter((l) => l.tier === 'primary').map((l) => ({
    id: l.id, name: l.name,
    sees: targets.filter((t) => t.id !== l.id && (t.tier === 'primary' || t.tier === 'summit') && losFrom(l.at[0], l.at[1], Math.max(2, (l.h || 0) * 0.8), t.at[0], t.at[1], t.h)).map((t) => t.name),
  }));
  // Viewshed share: fraction of land (1 km sample grid) from which each primary landmark is visible.
  const samples = [];
  for (let y = g.y0 + 0.5; y < g.y1; y += 1) for (let x = g.x0 + 0.5; x < g.x1; x += 1) {
    const i = cellIdx(x, y);
    if (i >= 0 && island[i] && !water[i] && !ISLANDS[island[i] - 1].offworld) samples.push([x, y]);
  }
  const viewshed = LANDMARKS.filter((l) => l.tier === 'primary').map((l) => {
    let n = 0;
    for (const [x, y] of samples) if (losFrom(x, y, 1.8, l.at[0], l.at[1], Math.max(2, l.h || 0))) n++;
    return { id: l.id, name: l.name, h: l.h, share: n / samples.length };
  }).sort((a, b) => b.share - a.share);
  log('visibility done');

  // ---------------------------------------------------------------------------
  // 5. Rivers and watersheds.
  const rivers = T.riverProfiles.map((rp) => {
    const def = RIVERS.find((r) => r.id === rp.id);
    let rises = 0, maxRise = 0;
    for (let k = 1; k < rp.bed.length; k++) {
      const d = rp.bed[k] - rp.bed[k - 1];
      if (d > 0.01) { rises++; maxRise = Math.max(maxRise, d); }
    }
    // Final terrain along the channel must not rise above the water surface.
    let blocked = 0;
    for (let k = 0; k < rp.pts.length; k++) {
      const i = cellIdx(rp.pts[k][0], rp.pts[k][1]);
      if (i >= 0 && water[i] === W.LAND && h[i] > rp.bed[k] + 4) blocked++;
    }
    const last = rp.pts[rp.pts.length - 1];
    let mouth = 'land';
    for (let r = -6; r <= 6; r++) for (let c = -6; c <= 6; c++) {
      const i = cellIdx(last[0] + c * g.c, last[1] + r * g.c);
      if (i >= 0 && water[i] === W.SEA) mouth = 'sea';
      else if (i >= 0 && water[i] === W.LAKE && mouth !== 'sea') mouth = 'lake';
    }
    const L = (rp.pts.length - 1) * g.c;
    const drop = rp.bed[0] - rp.bed[rp.bed.length - 1];
    if (rises || mouth === 'land' || blocked > rp.pts.length * 0.06) issues.push({ kind: 'river', id: rp.id, msg: `rises ${rises}, mouth ${mouth}, blocked ${blocked}` });
    return { id: rp.id, name: rp.name, island: def?.island, tidal: !!def?.tidal, lengthKm: L, source: rp.bed[0], mouthZ: rp.bed[rp.bed.length - 1], drop, gradient: drop / (L * 1000), rises, blocked, mouth };
  });
  // D8 drainage on a 200 m grid: fill sinks (priority flood) and measure
  // closed depressions that are not lakes, karst or swamp.
  const f = 4, cx = Math.floor(g.nx / f), cy = Math.floor(g.ny / f);
  const zc = new Float32Array(cx * cy), landc = new Uint8Array(cx * cy), kindc = new Uint8Array(cx * cy);
  for (let r = 0; r < cy; r++) for (let c = 0; c < cx; c++) {
    let mn = Infinity, land = 0, k = 0;
    for (let a = 0; a < f; a++) for (let b = 0; b < f; b++) {
      const i = (r * f + a) * g.nx + c * f + b;
      mn = Math.min(mn, water[i] ? -1 : h[i]);
      if (island[i] && !water[i]) { land++; k = island[i]; }
    }
    zc[r * cx + c] = mn; landc[r * cx + c] = land === f * f ? 1 : 0; kindc[r * cx + c] = k;
  }
  const filled = Float32Array.from(zc);
  {
    const done = new Uint8Array(cx * cy);
    const heapK = [], heapV = [];
    const push = (k, v) => { heapK.push(k); heapV.push(v); let i = heapK.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heapK[p] <= heapK[i]) break; [heapK[p], heapK[i]] = [heapK[i], heapK[p]]; [heapV[p], heapV[i]] = [heapV[i], heapV[p]]; i = p; } };
    const pop = () => { const v = heapV[0]; const lk = heapK.pop(), lv = heapV.pop(); if (heapK.length) { heapK[0] = lk; heapV[0] = lv; let i = 0; for (;;) { let m = i; const l = 2 * i + 1, rr = l + 1; if (l < heapK.length && heapK[l] < heapK[m]) m = l; if (rr < heapK.length && heapK[rr] < heapK[m]) m = rr; if (m === i) break; [heapK[m], heapK[i]] = [heapK[i], heapK[m]]; [heapV[m], heapV[i]] = [heapV[i], heapV[m]]; i = m; } } return v; };
    for (let i = 0; i < cx * cy; i++) if (!landc[i]) { done[i] = 1; push(filled[i], i); }
    while (heapK.length) {
      const i = pop();
      const c = i % cx, r = Math.floor(i / cx);
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nc = c + dc, nr = r + dr;
        if (nc < 0 || nr < 0 || nc >= cx || nr >= cy) continue;
        const j = nr * cx + nc;
        if (done[j]) continue;
        done[j] = 1;
        if (filled[j] < filled[i]) filled[j] = filled[i];
        push(filled[j], j);
      }
    }
  }
  const depressionByIsland = {};
  for (let i = 0; i < cx * cy; i++) {
    if (!landc[i]) continue;
    const d = filled[i] - zc[i];
    if (d < 1.5) continue;
    const id = ISLANDS[kindc[i] - 1]?.id || '?';
    depressionByIsland[id] = depressionByIsland[id] || { cells: 0, maxDepth: 0 };
    depressionByIsland[id].cells++;
    depressionByIsland[id].maxDepth = Math.max(depressionByIsland[id].maxDepth, d);
  }
  for (const k of Object.keys(depressionByIsland)) depressionByIsland[k].areaKm2 = depressionByIsland[k].cells * (g.c * f) ** 2;
  log('hydrology done');

  // ---------------------------------------------------------------------------
  // 6. Engineering: routes, bridges, airports, ports, power.
  const routes = T.routeReports.filter((r) => r.kind !== 'runway');
  const runways = T.routeReports.filter((r) => r.kind === 'runway');
  const bridges = [];
  for (const r of routes) for (const s of r.segs) if (s.kind === 'bridge' && s.len >= 0.12) {
    const named = BRIDGE_NAMES.find((b) => (b.road === r.id || b.rail === r.id) && Math.hypot(b.near[0] - s.mid[0], b.near[1] - s.mid[1]) < 1.6);
    bridges.push({ route: r.id, routeName: r.name, ref: r.ref, name: named?.name || null, type: named?.type || null, year: named?.year || null, clearance: named?.clearance || null, lengthKm: s.len, mid: s.mid, deck: s.deck, minWater: s.minWater });
  }
  const structures = [];
  for (const r of routes) for (const s of r.segs) if ((s.kind === 'tunnel' || s.kind === 'viaduct') && s.len >= 0.1) structures.push({ route: r.id, routeName: r.name, kind: s.kind, lengthKm: s.len, mid: s.mid });
  const approaches = AIRPORTS.flatMap((ap) => ap.runways.map((rw) => {
    let worst = Infinity, worstAt = null;
    for (const [a, b] of [[rw.a, rw.b], [rw.b, rw.a]]) {
      const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
      const ux = -dx / L, uy = -dy / L;
      const i0 = cellIdx(a[0], a[1]);
      const z0 = h[i0];
      for (let d = 0.3; d <= 4; d += 0.05) {
        const x = a[0] + ux * d, y = a[1] + uy * d;
        const i = cellIdx(x, y);
        if (i < 0) continue;
        const cv = cover[i];
        const tall = water[i] ? 0 : (cv >= C['bottomland'] && cv <= C['spruce-fir'] && cv !== C.cropland && cv !== C.pasture) ? 18 : cv === C['urban-core'] ? 60 : cv === C.urban ? 15 : cv === C.suburban ? 9 : 0;
        const obstacle = Math.max(0, h[i]) + tall;
        const surface = z0 + d * 1000 * 0.02;
        const clr = surface - obstacle;
        if (clr < worst) { worst = clr; worstAt = [+x.toFixed(2), +y.toFixed(2)]; }
      }
    }
    return { airport: ap.name, runway: rw.id, worstClearance: worst, at: worstAt };
  }));
  for (const a of approaches) if (a.worstClearance < 0) issues.push({ kind: 'airport', id: `${a.airport} ${a.runway}`, msg: `approach surface penetrated by ${(-a.worstClearance).toFixed(0)} m at ${a.at}` });
  const ports = PORTS.map((p) => {
    const [a, b] = p.berth;
    let minD = Infinity;
    for (let t = 0; t <= 1; t += 0.05) {
      const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
      let best = -Infinity;
      for (let r = g.row(y + 0.25); r <= g.row(y - 0.25); r++) for (let c = g.col(x - 0.25); c <= g.col(x + 0.25); c++) {
        const i = r * g.nx + c;
        if (water[i] === W.SEA || water[i] === W.LAKE) best = Math.max(best, -(h[i] - (water[i] === W.LAKE ? T.surface[i] : 0)));
      }
      if (best > -Infinity) minD = Math.min(minD, best);
    }
    return { ...p, measuredDepth: minD, ok: minD >= p.depth - 0.5 };
  });
  const nodes = Object.fromEntries([...POWER.plants, ...POWER.substations].map((n) => [n.id, n]));
  const power = POWER.lines.map((ln) => {
    const okFrom = ln.from === 'mainland' || nodes[ln.from];
    const okTo = nodes[ln.to];
    let wet = 0, run = 0, longest = 0;
    for (let k = 1; k < ln.pts.length; k++) {
      const a = ln.pts[k - 1], b = ln.pts[k];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      for (let t = 0; t < 1; t += 0.05 / Math.max(L, 0.05)) {
        const i = cellIdx(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t);
        if (i >= 0 && water[i] === W.SEA) { wet += 0.05; run += 0.05; longest = Math.max(longest, run); } else run = 0;
      }
    }
    const lenKm = ln.pts.reduce((s, p, k) => (k ? s + Math.hypot(p[0] - ln.pts[k - 1][0], p[1] - ln.pts[k - 1][1]) : 0), 0);
    if (!okFrom || !okTo) issues.push({ kind: 'power', id: `${ln.from}->${ln.to}`, msg: 'unconnected endpoint' });
    return { ...ln, lenKm, waterKm: wet, longestWaterSpan: longest, connected: !!(okFrom && okTo) };
  });

  // ---------------------------------------------------------------------------
  // 7. Road network graph: drive times between settlements.
  const speedOf = (r) => (DESIGN[r.cls] || DESIGN.county).speed;
  const gn = []; // nodes: [x, y]
  const adj = [];
  const nodeAt = new Map();
  const key = (x, y) => `${Math.round(x / 0.06)},${Math.round(y / 0.06)}`;
  const addNode = (x, y) => {
    const k = key(x, y);
    if (nodeAt.has(k)) return nodeAt.get(k);
    gn.push([x, y]); adj.push([]);
    nodeAt.set(k, gn.length - 1);
    return gn.length - 1;
  };
  const link = (a, b, minutes, km, what) => { adj[a].push([b, minutes, km, what]); adj[b].push([a, minutes, km, what]); };
  const nodeRoad = [];
  for (const r of routes.filter((q) => q.kind === 'road')) {
    const src = ROADS.find((q) => q.id === r.id);
    const P = r.profile;
    let prev = addNode(P[0][0], P[0][1]);
    nodeRoad[prev] = nodeRoad[prev] || r.id;
    for (let k = 1; k < P.length; k++) {
      const a = P[k - 1], b = P[k];
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      // Curvature slows mountain roads: turn angle at this vertex.
      let turn = 0;
      if (k + 1 < P.length) {
        const c = P[k + 1];
        const a1 = Math.atan2(b[1] - a[1], b[0] - a[0]), a2 = Math.atan2(c[1] - b[1], c[0] - b[0]);
        turn = Math.abs(((a2 - a1 + 3 * Math.PI) % (2 * Math.PI)) - Math.PI) * 180 / Math.PI;
      }
      const grade = Math.abs(b[2] - a[2]) / (L * 1000 || 1);
      const v = speedOf(src) * clamp(1 - turn / 70, 0.35, 1) * clamp(1 - Math.max(0, grade - 0.05) * 4, 0.6, 1);
      const nb = addNode(b[0], b[1]);
      nodeRoad[nb] = nodeRoad[nb] || r.id;
      if (nb !== prev) link(prev, nb, (L / v) * 60, L, src.ref);
      prev = nb;
    }
  }
  // Junctions: join nodes of different roads that lie within 120 m.
  {
    const bucket = new Map();
    const bk = (x, y) => `${Math.floor(x / 0.12)},${Math.floor(y / 0.12)}`;
    gn.forEach((p, k) => { const kk = bk(p[0], p[1]); if (!bucket.has(kk)) bucket.set(kk, []); bucket.get(kk).push(k); });
    let joins = 0;
    gn.forEach((p, k) => {
      const bx = Math.floor(p[0] / 0.12), by = Math.floor(p[1] / 0.12);
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const j of bucket.get(`${bx + a},${by + b}`) || []) {
        if (j <= k || nodeRoad[j] === nodeRoad[k]) continue;
        const d = Math.hypot(gn[j][0] - p[0], gn[j][1] - p[1]);
        if (d < 0.12) { link(k, j, (d / 30) * 60, d, 'junction'); joins++; }
      }
    });
    // Road ends that stop short of another road are joined to it (up to 500 m).
    const ends = [];
    for (const r of routes.filter((q) => q.kind === 'road')) {
      const P = r.profile;
      for (const p of [P[0], P[P.length - 1]]) ends.push([nodeAt.get(key(p[0], p[1])), r.id]);
    }
    for (const [k, rid] of ends) {
      let best = -1, bd = 0.5;
      for (let j = 0; j < gn.length; j++) {
        if (nodeRoad[j] === rid) continue;
        const d = Math.hypot(gn[j][0] - gn[k][0], gn[j][1] - gn[k][1]);
        if (d < bd) { bd = d; best = j; }
      }
      if (best >= 0) { link(k, best, (bd / 30) * 60, bd, 'junction'); joins++; }
    }
    log(`road graph: ${gn.length} nodes, ${joins} junction links`);
  }
  for (const fy of FERRIES) {
    const L = fy.pts.reduce((s, p, k) => (k ? s + Math.hypot(p[0] - fy.pts[k - 1][0], p[1] - fy.pts[k - 1][1]) : 0), 0);
    const nearest = (p) => {
      let best = -1, bd = 1e9;
      for (let k = 0; k < gn.length; k++) { const d = Math.hypot(gn[k][0] - p[0], gn[k][1] - p[1]); if (d < bd) { bd = d; best = k; } }
      return [best, bd];
    };
    const [a, da] = nearest(fy.pts[0]), [b, db] = nearest(fy.pts[fy.pts.length - 1]);
    if (a >= 0 && b >= 0 && da < 2 && db < 2) link(a, b, (L / (fy.knots * 1.852)) * 60 + 15, L, fy.name);
  }
  // Connect each settlement to its nearest road node by a short local street.
  const settleNode = {};
  for (const s of SETTLEMENTS) {
    let best = -1, bd = 1e9;
    for (let k = 0; k < gn.length; k++) { const d = Math.hypot(gn[k][0] - s.at[0], gn[k][1] - s.at[1]); if (d < bd) { bd = d; best = k; } }
    settleNode[s.id] = { node: best, access: bd };
  }
  const dijkstra = (src) => {
    const dist = new Float64Array(gn.length).fill(Infinity), km = new Float64Array(gn.length).fill(Infinity);
    dist[src] = 0; km[src] = 0;
    const H = [[0, src]];
    while (H.length) {
      let mi = 0;
      for (let k = 1; k < H.length; k++) if (H[k][0] < H[mi][0]) mi = k;
      const [d, u] = H[mi];
      H[mi] = H[H.length - 1]; H.pop();
      if (d > dist[u]) continue;
      for (const [v, w, l] of adj[u]) if (d + w < dist[v]) { dist[v] = d + w; km[v] = km[u] + l; H.push([dist[v], v]); }
    }
    return { dist, km };
  };
  const majors = ['calder', 'tennalee-falls', 'coldwater', 'narrows-landing', 'ledford', 'graystone', 'fallon', 'whitlock', 'bellamy', 'mirabel-beach', 'haversham', 'ambrose-beach', 'ossahatchee', 'kestrel', 'merrin', 'wickham', 'sabal', 'corliss', 'port-serena', 'hickory-flat'];
  const drive = {};
  for (const a of majors) {
    const { dist, km } = dijkstra(settleNode[a].node);
    drive[a] = {};
    for (const b of majors) {
      const n = settleNode[b].node;
      drive[a][b] = { min: dist[n] + (settleNode[a].access + settleNode[b].access) / 40 * 60, km: km[n] + settleNode[a].access + settleNode[b].access };
    }
  }
  log('road graph done');

  // ---------------------------------------------------------------------------
  // 8. Island statistics.
  const stats = {};
  const coverByIsland = {};
  for (const isl of ISLANDS) stats[isl.id] = { id: isl.id, name: isl.name, type: isl.type, landKm2: 0, lakeKm2: 0, coastKm: 0, maxZ: -Infinity, maxAt: null, sumZ: 0, n: 0, lowKm2: 0, steepKm2: 0 };
  for (let r = 1; r < g.ny - 1; r++) for (let c = 1; c < g.nx - 1; c++) {
    const i = r * g.nx + c;
    if (!island[i]) continue;
    const s = stats[ISLANDS[island[i] - 1].id];
    if (water[i] === W.LAKE || water[i] === W.RIVER) { s.lakeKm2 += g.c * g.c; continue; }
    if (water[i]) continue;
    s.landKm2 += g.c * g.c;
    s.sumZ += h[i]; s.n++;
    if (h[i] > s.maxZ) { s.maxZ = h[i]; s.maxAt = [g.X(c), g.Y(r)]; }
    if (h[i] < 3) s.lowKm2 += g.c * g.c;
    if (slope[i] > 0.4) s.steepKm2 += g.c * g.c;
    // shoreline edges
    for (const j of [i - 1, i + 1, i - g.nx, i + g.nx]) if (water[j] === W.SEA) s.coastKm += g.c * 0.785;
    const k = ISLANDS[island[i] - 1].id;
    coverByIsland[k] = coverByIsland[k] || new Array(LC.length).fill(0);
    coverByIsland[k][cover[i]] += g.c * g.c;
  }
  for (const s of Object.values(stats)) {
    s.meanZ = s.n ? s.sumZ / s.n : 0;
    const pts = [];
    for (let r = 0; r < g.ny; r += 4) for (let c = 0; c < g.nx; c += 4) { const i = r * g.nx + c; if (island[i] && ISLANDS[island[i] - 1].id === s.id) pts.push([g.X(c), g.Y(r)]); }
    let maxD = 0;
    for (let a = 0; a < pts.length; a += 7) for (let b = a + 1; b < pts.length; b += 7) maxD = Math.max(maxD, Math.hypot(pts[a][0] - pts[b][0], pts[a][1] - pts[b][1]));
    s.lengthKm = maxD;
    s.pop = SETTLEMENTS.filter((t) => partOf(t.island) === s.id).reduce((a, t) => a + t.pop, 0);
  }
  // Longest drive between settlements on each island.
  const islandDrive = {};
  for (const isl of ISLANDS) {
    const towns = SETTLEMENTS.filter((t) => partOf(t.island) === isl.id && !isl.offworld);
    let best = null;
    for (const a of towns) {
      const { dist, km } = dijkstra(settleNode[a.id].node);
      for (const b of towns) {
        const n = settleNode[b.id].node;
        if (dist[n] < Infinity && (!best || km[n] > best.km)) best = { from: a.name, to: b.name, km: km[n], min: dist[n] };
      }
    }
    islandDrive[isl.id] = best;
  }
  log('statistics done');

  return {
    issues, beaches, mountains, lakes, viewpoints, chains, viewshed, placement, rivers, depressionByIsland,
    routes, runways, bridges, structures, approaches, ports, power, drive, majors, stats, coverByIsland, islandDrive, cover,
  };
}
