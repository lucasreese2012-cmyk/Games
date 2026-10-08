// Game data export: terrain and land-cover rasters plus one world.json with
// every vector, register entry and measurement the explorer shows.
import fs from 'node:fs';
import path from 'node:path';
import { encodePNG } from './lib/png.mjs';
import { LC } from './landcover.mjs';
import { W } from './terrain.mjs';
import { WORLD, ISLANDS, PEAKS, WATERS, RIVERS } from '../world/geography.mjs';
import { SETTLEMENTS } from '../world/settlements.mjs';
import { ROADS, RAILS, AIRPORTS, PORTS, FERRIES, POWER, HELIPADS, UTILITIES } from '../world/transport.mjs';
import { LANDMARKS } from '../world/registers/landmarks.mjs';
import { DISTRICTS } from '../world/registers/districts.mjs';
import { FORESTS } from '../world/registers/forests.mjs';
import { locate } from './docgen.mjs';

const r3 = (v) => Math.round(v * 1000) / 1000;
const r1 = (v) => Math.round(v * 10) / 10;
const enc16 = (z) => Math.max(0, Math.min(65535, Math.round((z + 100) * 10)));

export function exportGame(T, A, outDir) {
  const { g, h, water, island, surface } = T;
  fs.mkdirSync(outDir, { recursive: true });
  const N = g.nx * g.ny;
  // terrain.png: R,G = (elevation + 100 m) × 10 as 16 bits; B = water code + 4 × island index.
  const tp = new Uint8Array(N * 3), cp = new Uint8Array(N * 3);
  for (let i = 0; i < N; i++) {
    const v = enc16(h[i]);
    tp[i * 3] = v >> 8; tp[i * 3 + 1] = v & 255; tp[i * 3 + 2] = water[i] + 4 * island[i];
    // cover.png: R = land-cover class; G,B = water surface (same encoding) on lakes and rivers.
    cp[i * 3] = A.cover[i];
    if (water[i] === W.LAKE || water[i] === W.RIVER) { const s = enc16(surface[i]); cp[i * 3 + 1] = s >> 8; cp[i * 3 + 2] = s & 255; }
  }
  fs.writeFileSync(path.join(outDir, 'terrain.png'), encodePNG(g.nx, g.ny, tp, 2));
  fs.writeFileSync(path.join(outDir, 'cover.png'), encodePNG(g.nx, g.ny, cp, 2));

  const routed = new Map(A.routes.map((r) => [r.id, r]));
  const line = (r) => (routed.get(r.id)?.profile || r.pts).map((p) => [r3(p[0]), r3(p[1]), p[2] == null || typeof p[2] === 'string' ? null : r1(p[2]), p[3] ? 1 : 0]);
  const txt = (e) => ({ desc: e.desc, why: e.why, look: e.look, near: e.near, memorable: e.memorable });
  const placed = new Map(A.placement.map((p) => [`${p.reg}:${p.id}`, p]));
  const ground = (reg, id) => { const p = placed.get(`${reg}:${id}`); return p && p.h != null ? r1(Math.max(0, p.h)) : null; };

  const world = {
    name: WORLD.name,
    grid: { x0: g.x0, y0: g.y0, x1: g.x1, y1: g.y1, cell: g.c, nx: g.nx, ny: g.ny, encoding: '(z + 100) * 10, 16-bit big-endian in R,G' },
    cover: LC.map((c) => ({ key: c.key, name: c.name, color: c.color })),
    islands: ISLANDS.filter((s) => !s.offworld).map((s, k) => ({ id: s.id, index: ISLANDS.indexOf(s) + 1, name: s.name, type: s.type, partOf: s.partOf || null, stats: A.stats[s.id] ? { landKm2: r1(A.stats[s.id].landKm2), coastKm: r1(A.stats[s.id].coastKm), maxZ: r1(A.stats[s.id].maxZ), lengthKm: r1(A.stats[s.id].lengthKm), meanZ: r1(A.stats[s.id].meanZ) } : null })),
    waters: WATERS.map((w) => ({ id: w.id, name: w.name, kind: w.kind, label: w.label, maxDepth: w.maxDepth })),
    peaks: Object.entries(PEAKS).map(([id, p]) => ({ id, name: p.name, island: p.island, at: p.at, z: p.z })),
    rivers: T.riverProfiles.map((rp) => {
      const def = RIVERS.find((r) => r.id === rp.id);
      const step = Math.max(1, Math.floor(rp.pts.length / 160));
      return { id: rp.id, name: rp.name, island: def?.island, tidal: !!def?.tidal, pts: rp.pts.filter((_, k) => k % step === 0 || k === rp.pts.length - 1).map((p) => [r3(p[0]), r3(p[1])]) };
    }),
    settlements: SETTLEMENTS.map((s) => ({ id: s.id, name: s.name, island: s.island, at: s.at, r: s.r, form: s.form, pop: s.pop, why: s.why })),
    roads: ROADS.map((r) => ({ id: r.id, name: r.name, ref: r.ref, cls: r.cls, len: r1(routed.get(r.id)?.lengthKm || 0), pts: line(r), segs: (routed.get(r.id)?.segs || []).map((s) => ({ kind: s.kind, a: s.a, b: s.b, deck: s.deck })) })),
    rails: RAILS.map((r) => ({ id: r.id, name: r.name, status: r.status, use: r.use, len: r1(routed.get(r.id)?.lengthKm || 0), pts: line(r), segs: (routed.get(r.id)?.segs || []).map((s) => ({ kind: s.kind, a: s.a, b: s.b, deck: s.deck })) })),
    bridges: A.bridges.map((b) => ({ name: b.name, route: b.route, routeName: b.routeName, ref: b.ref, type: b.type, clearance: b.clearance, len: r3(b.lengthKm), mid: b.mid.map(r3), deck: r1(b.deck || 0) })),
    structures: A.structures.map((s) => ({ kind: s.kind, route: s.route, routeName: s.routeName, len: r3(s.lengthKm), mid: s.mid.map(r3) })),
    ferries: FERRIES,
    airports: AIRPORTS.map((ap) => ({ ...ap, runways: ap.runways.map((rw) => { const rr = A.runways.find((q) => q.id === `${ap.id}:${rw.id}`); return { ...rw, z: rr ? r1((rr.z0 + rr.z1) / 2) : null, len: rr ? r3(rr.lengthKm) : null }; }) })),
    ports: PORTS.map((p) => ({ ...p, measuredDepth: r1(A.ports.find((q) => q.id === p.id)?.measuredDepth ?? 0) })),
    helipads: HELIPADS, utilities: UTILITIES, power: POWER,
    landmarks: LANDMARKS.map((l) => ({ id: l.id, name: l.name, island: l.island, at: l.at, tier: l.tier, kind: l.kind, h: l.h || 0, ground: ground('landmark', l.id), where: locate(l.at), share: A.viewshed.find((v) => v.id === l.id)?.share ?? null, ...txt(l) })),
    viewpoints: A.viewpoints.map((v) => ({ id: v.id, name: v.name, island: v.island, at: v.at, eye: v.eye || 2, facing: v.facing, ground: v.ground == null ? null : r1(Math.max(0, v.ground)), where: locate(v.at), seen: v.seen.map((s) => ({ name: s.name, tier: s.tier, dist: r1(s.dist) })), ...txt(v) })),
    beaches: A.beaches.map((b) => ({ id: b.id, name: b.name, island: b.island, at: b.snapped, len: b.len, sand: b.sand, where: locate(b.snapped), ...txt(b) })),
    lakes: A.lakes.map((l) => ({ id: l.id, name: l.name, island: l.island, at: l.at.map(r3), type: l.type || l.kind, where: l.where, level: l.level == null ? null : r1(l.level), area: r3(l.areaKm2), depth: r1(l.maxDepth), ...txt(l) })),
    forests: FORESTS.map((f) => ({ id: f.id, name: f.name, island: f.island, at: f.at, rx: f.rx, ry: f.ry, rot: f.rot, cover: f.cover, where: locate(f.at), ...txt(f) })),
    mountains: A.mountains.map((m) => ({ id: m.id, name: m.name, island: m.island, at: m.at, z: m.z, kind: m.kind, where: m.where, relief: Math.round(m.relief3km), ...txt(m) })),
    districts: DISTRICTS.map((d) => ({ id: d.id, name: d.name, island: d.island, at: d.at, r: d.r, form: d.form, bldg: d.bldg || null, where: locate(d.at), ...txt(d) })),
    drive: { majors: A.majors, table: Object.fromEntries(Object.entries(A.drive).map(([a, row]) => [a, Object.fromEntries(Object.entries(row).map(([b, v]) => [b, isFinite(v.min) ? [Math.round(v.min), r1(v.km)] : null]))])) },
  };
  fs.writeFileSync(path.join(outDir, 'world.json'), JSON.stringify(world));
  return world;
}
