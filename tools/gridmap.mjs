// Coordinate reference map: hillshade + 5 km grid with labels, plus optional
// overlay of vector data (roads, rails, points). Usage:
//   node tools/gridmap.mjs out.png [x0 y0 x1 y1] [cellsPerPixel] [--overlay]
import fs from 'node:fs';
import { loadTerrain } from './cache.mjs';
import { encodePNG } from './lib/png.mjs';
import { clamp, lerp } from './lib/geom.mjs';
import { W } from './terrain.mjs';

const args = process.argv.slice(2);
const overlay = args.includes('--overlay');
const pos = args.filter((a) => !a.startsWith('--'));
const out = pos[0] || 'grid.png';
const T = loadTerrain(() => {});
const { g, h, water } = T;
const box = pos.length >= 5 ? pos.slice(1, 5).map(Number) : [g.x0, g.y0, g.x1, g.y1];
const step = pos[5] ? Number(pos[5]) : 2;
const c0 = g.col(box[0]), c1 = g.col(box[2]) - 1, r0 = g.row(box[3]), r1 = g.row(box[1]) - 1;
const PW = Math.floor((c1 - c0) / step), PH = Math.floor((r1 - r0) / step);
const px = new Uint8Array(PW * PH * 3);
const kmPerPx = g.c * step;

const FONT = {
  0: ['111', '101', '101', '101', '111'], 1: ['010', '110', '010', '010', '111'], 2: ['111', '001', '111', '100', '111'],
  3: ['111', '001', '111', '001', '111'], 4: ['101', '101', '111', '001', '001'], 5: ['111', '100', '111', '001', '111'],
  6: ['111', '100', '111', '101', '111'], 7: ['111', '001', '010', '010', '010'], 8: ['111', '101', '111', '101', '111'],
  9: ['111', '101', '111', '001', '111'], '-': ['000', '000', '111', '000', '000'], '.': ['000', '000', '000', '000', '010'],
};
function put(x, y, col) {
  if (x < 0 || y < 0 || x >= PW || y >= PH) return;
  const o = (y * PW + x) * 3;
  px[o] = col[0]; px[o + 1] = col[1]; px[o + 2] = col[2];
}
export function text(str, x, y, col = [0, 0, 0], s = 2) {
  let cx = x;
  for (const ch of String(str)) {
    const f = FONT[ch];
    if (f) for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) if (f[r][c] === '1') for (let a = 0; a < s; a++) for (let b = 0; b < s; b++) put(cx + c * s + a, y + r * s + b, col);
    cx += 4 * s;
  }
}
const toPx = (x, y) => [Math.round((x - box[0]) / kmPerPx), Math.round((box[3] - y) / kmPerPx)];

for (let y = 0; y < PH; y++) {
  for (let x = 0; x < PW; x++) {
    const i = (r0 + y * step) * g.nx + c0 + x * step;
    const o = (y * PW + x) * 3;
    if (water[i] === W.SEA) { const t = clamp(-h[i] / 40, 0, 1); px[o] = lerp(170, 60, t); px[o + 1] = lerp(210, 110, t); px[o + 2] = lerp(225, 170, t); continue; }
    if (water[i]) { px[o] = 60; px[o + 1] = 110; px[o + 2] = 200; continue; }
    const zl = h[i - 1], zr = h[i + 1], zu = h[i - g.nx], zd = h[i + g.nx];
    const dx = (zr - zl) / (100), dy = (zu - zd) / (100);
    const sh = clamp(1 + (dx * 0.6 - dy * 0.6) * 0.9 * -1, 0.35, 1.4);
    const t = clamp(h[i] / 2000, 0, 1);
    px[o] = clamp(lerp(150, 200, t) * sh, 0, 255); px[o + 1] = clamp(lerp(175, 170, t) * sh, 0, 255); px[o + 2] = clamp(lerp(120, 150, t) * sh, 0, 255);
  }
}
const gstep = kmPerPx > 0.06 ? 5 : 1;
for (let gx = Math.ceil(box[0] / gstep) * gstep; gx <= box[2]; gx += gstep) {
  const [X] = toPx(gx, 0);
  for (let y = 0; y < PH; y++) if (y % 3 !== 0) put(X, y, gx % 10 === 0 ? [200, 0, 0] : [120, 60, 60]);
  text(gx, X + 2, 2, [150, 0, 0]);
}
for (let gy = Math.ceil(box[1] / gstep) * gstep; gy <= box[3]; gy += gstep) {
  const [, Y] = toPx(0, gy);
  for (let x = 0; x < PW; x++) if (x % 3 !== 0) put(x, Y, gy % 10 === 0 ? [200, 0, 0] : [120, 60, 60]);
  text(gy, 2, Y + 2, [150, 0, 0]);
}

if (overlay) {
  const { ROADS = [], RAILS = [] } = await import('../world/transport.mjs').catch(() => ({}));
  const { SETTLEMENTS = [] } = await import('../world/settlements.mjs').catch(() => ({}));
  const line = (pts, col, wpx = 1) => {
    for (let k = 1; k < pts.length; k++) {
      const [ax, ay] = toPx(pts[k - 1][0], pts[k - 1][1]), [bx, by] = toPx(pts[k][0], pts[k][1]);
      const n = Math.max(Math.abs(bx - ax), Math.abs(by - ay)) + 1;
      for (let s = 0; s <= n; s++) {
        const x = Math.round(lerp(ax, bx, s / n)), y = Math.round(lerp(ay, by, s / n));
        for (let a = -wpx + 1; a < wpx; a++) for (let b = -wpx + 1; b < wpx; b++) put(x + a, y + b, col);
      }
    }
  };
  const RC = { interstate: [200, 30, 30], highway: [230, 120, 20], state: [240, 200, 40], parkway: [60, 140, 60], county: [255, 255, 255], local: [230, 230, 230], forest: [140, 100, 60], dirt: [150, 120, 90] };
  const routed = Object.fromEntries((T.routeReports || []).filter((r) => r.profile).map((r) => [r.id, r]));
  const geom = (r) => (routed[r.id] ? routed[r.id].profile : r.pts);
  for (const r of ROADS) line(geom(r), RC[r.cls] || [255, 0, 255], r.cls === 'interstate' ? 2 : 1);
  for (const r of RAILS) line(geom(r), r.status === 'abandoned' ? [120, 120, 120] : [20, 20, 20], 1);
  // Engineered segments: tunnels magenta, viaducts orange, bridges cyan.
  for (const r of T.routeReports || []) for (const sg of r.segs || []) {
    const col = sg.kind === 'tunnel' ? [255, 0, 255] : sg.kind === 'viaduct' ? [255, 140, 0] : [0, 220, 255];
    line([sg.a, sg.b], col, 2);
  }
  for (const s of SETTLEMENTS) {
    const [x, y] = toPx(s.at[0], s.at[1]);
    const rr = Math.max(2, Math.round((s.r || 0.5) / kmPerPx));
    for (let a = 0; a < 360; a += 4) put(Math.round(x + Math.cos(a * Math.PI / 180) * rr), Math.round(y + Math.sin(a * Math.PI / 180) * rr), [120, 0, 120]);
  }
}
fs.writeFileSync(out, encodePNG(PW, PH, px, 2));
console.log(`wrote ${out} ${PW}x${PH}`);
