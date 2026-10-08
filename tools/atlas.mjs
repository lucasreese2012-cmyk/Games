// Atlas renderer: land cover + hillshade + water depth + vectors.
// Usage: node tools/atlas.mjs out.png [x0 y0 x1 y1] [cellsPerPixel] [--plain]
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadTerrain } from './cache.mjs';
import { classify, LC } from './landcover.mjs';
import { encodePNG } from './lib/png.mjs';
import { clamp, lerp } from './lib/geom.mjs';
import { W } from './terrain.mjs';
import { ROADS, RAILS } from '../world/transport.mjs';
import { SETTLEMENTS } from '../world/settlements.mjs';

export function renderAtlas(T, cover, box, step = 2, opts = {}) {
const { g, h, water } = T;
const c0 = g.col(box[0]), c1 = g.col(box[2]) - 1, r0 = g.row(box[3]), r1 = g.row(box[1]) - 1;
const PW = Math.floor((c1 - c0) / step), PH = Math.floor((r1 - r0) / step);
const px = new Uint8Array(PW * PH * 3);
const kmPerPx = g.c * step;

for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) {
  const i = (r0 + y * step) * g.nx + c0 + x * step;
  const o = (y * PW + x) * 3;
  if (water[i] === W.SEA) {
    const t = clamp(-h[i] / 45, 0, 1);
    const sh = Math.pow(t, 0.6);
    px[o] = lerp(150, 28, sh); px[o + 1] = lerp(206, 82, sh); px[o + 2] = lerp(214, 136, sh);
    continue;
  }
  if (water[i]) { px[o] = 64; px[o + 1] = 122; px[o + 2] = 168; continue; }
  const zl = h[i - 1], zr = h[i + 1], zu = h[i - g.nx], zd = h[i + g.nx];
  const dx = (zr - zl) / (2 * g.c * 1000), dy = (zu - zd) / (2 * g.c * 1000);
  const nx = -dx * 2.2, ny = -dy * 2.2, nzv = 1, l = Math.hypot(nx, ny, nzv);
  const shade = clamp(((nx * -0.55 + ny * 0.55 + nzv * 0.62) / l) * 1.32, 0.42, 1.28);
  const col = LC[cover[i]].color;
  const hz = clamp(h[i] / 2200, 0, 1) * 0.12;
  for (let k = 0; k < 3; k++) px[o + k] = clamp((col[k] * (1 - hz) + 235 * hz) * shade, 0, 255);
}
function put(x, y, col, a = 1) {
  if (x < 0 || y < 0 || x >= PW || y >= PH) return;
  const o = (y * PW + x) * 3;
  for (let k = 0; k < 3; k++) px[o + k] = px[o + k] * (1 - a) + col[k] * a;
}
const toPx = (x, y) => [(x - box[0]) / kmPerPx, (box[3] - y) / kmPerPx];
function line(pts, col, w = 1, a = 1, dash = 0) {
  let acc = 0;
  for (let k = 1; k < pts.length; k++) {
    const [ax, ay] = toPx(pts[k - 1][0], pts[k - 1][1]), [bx, by] = toPx(pts[k][0], pts[k][1]);
    const n = Math.ceil(Math.max(Math.abs(bx - ax), Math.abs(by - ay)) * 1.5) + 1;
    for (let s = 0; s <= n; s++) {
      acc++;
      if (dash && Math.floor(acc / dash) % 2) continue;
      const x = lerp(ax, bx, s / n), y = lerp(ay, by, s / n);
      const r = w / 2;
      for (let a2 = -Math.ceil(r); a2 <= Math.ceil(r); a2++) for (let b2 = -Math.ceil(r); b2 <= Math.ceil(r); b2++) {
        if (a2 * a2 + b2 * b2 > r * r + 0.25) continue;
        put(Math.round(x + a2), Math.round(y + b2), col, a);
      }
    }
  }
}
if (!opts.plain) {
  const routed = Object.fromEntries((T.routeReports || []).filter((r) => r.profile).map((r) => [r.id, r]));
  const geom = (r) => (routed[r.id] ? routed[r.id].profile : r.pts);
  const z = 0.05 / kmPerPx;
  for (const r of RAILS) line(geom(r), r.status === 'abandoned' ? [110, 100, 90] : [40, 40, 44], Math.max(1, 1.2 * z), r.status === 'abandoned' ? 0.6 : 0.9, r.status === 'abandoned' ? 3 : 0);
  const order = ['county', 'arterial', 'parkway', 'state', 'highway', 'interstate'];
  const style = { interstate: [[120, 40, 30], [214, 90, 60], 3.2], highway: [[130, 80, 30], [236, 160, 70], 2.6], state: [[120, 100, 40], [246, 214, 110], 2.0], parkway: [[50, 80, 40], [150, 190, 110], 1.8], county: [[120, 110, 100], [250, 248, 240], 1.4], arterial: [[110, 100, 96], [252, 244, 220], 1.6] };
  for (const pass of [0, 1]) for (const cls of order) for (const r of ROADS) {
    if (r.cls !== cls) continue;
    const [casing, fill, w] = style[cls];
    line(geom(r), pass ? fill : casing, Math.max(1, (pass ? w : w + 1.4) * z), 1);
  }
}
if (!opts.plain) for (const t of SETTLEMENTS) {
  const [x, y] = toPx(t.at[0], t.at[1]);
  const r = Math.max(1.5, Math.min(5, Math.sqrt(t.pop) / 60) * (0.1 / kmPerPx) ** 0.5 * 1.6);
  for (let a = -Math.ceil(r) - 1; a <= Math.ceil(r) + 1; a++) for (let b = -Math.ceil(r) - 1; b <= Math.ceil(r) + 1; b++) {
    const d = Math.hypot(a, b);
    if (d <= r + 1) put(Math.round(x + a), Math.round(y + b), d <= r ? [250, 250, 245] : [30, 30, 30], 1);
  }
}
return { png: encodePNG(PW, PH, px, 2), w: PW, h: PH };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const pos = args.filter((a) => !a.startsWith('--'));
  const out = pos[0] || 'atlas.png';
  const T = loadTerrain(() => {});
  const { cover } = classify(T);
  const box = pos.length >= 5 ? pos.slice(1, 5).map(Number) : [T.g.x0, T.g.y0, T.g.x1, T.g.y1];
  const r = renderAtlas(T, cover, box, pos[5] ? Number(pos[5]) : 2, { plain: args.includes('--plain') });
  fs.writeFileSync(out, r.png);
  console.log(`wrote ${out} ${r.w}x${r.h}`);
}
