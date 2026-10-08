// Quick-look renderer: hillshade + hypsometric tint. Usage:
//   node tools/preview.mjs out.png [x0 y0 x1 y1] [scale]
import fs from 'node:fs';
import { buildTerrain, W } from './terrain.mjs';
import { encodePNG } from './lib/png.mjs';
import { clamp, lerp } from './lib/geom.mjs';

const [out = 'preview.png', ...rest] = process.argv.slice(2);
const t0 = Date.now();
const T = buildTerrain((m) => console.log(`${((Date.now() - t0) / 1000).toFixed(1)}s ${m}`));
const { g, h, water, surface } = T;

const box = rest.length >= 4 ? rest.slice(0, 4).map(Number) : [g.x0, g.y0, g.x1, g.y1];
const step = rest[4] ? Number(rest[4]) : 2; // cells per output pixel
const c0 = g.col(box[0]), c1 = g.col(box[2]) - 1, r0 = g.row(box[3]), r1 = g.row(box[1]) - 1;
const W_ = Math.floor((c1 - c0) / step), H_ = Math.floor((r1 - r0) / step);
const px = new Uint8Array(W_ * H_ * 3);

const ramp = [
  [0, [96, 128, 78]], [20, [120, 148, 88]], [100, [146, 160, 100]], [300, [168, 164, 112]],
  [700, [150, 132, 98]], [1200, [128, 112, 92]], [1700, [150, 140, 132]], [2100, [235, 232, 228]],
];
function tint(z) {
  for (let k = 1; k < ramp.length; k++) {
    if (z <= ramp[k][0]) {
      const t = (z - ramp[k - 1][0]) / (ramp[k][0] - ramp[k - 1][0]);
      return ramp[k - 1][1].map((v, j) => lerp(v, ramp[k][1][j], clamp(t, 0, 1)));
    }
  }
  return ramp[ramp.length - 1][1];
}

for (let y = 0; y < H_; y++) {
  for (let x = 0; x < W_; x++) {
    const c = c0 + x * step, r = r0 + y * step;
    const i = r * g.nx + c;
    const o = (y * W_ + x) * 3;
    const wk = water[i];
    if (wk === W.SEA) {
      const d = -h[i];
      const t = clamp(d / 40, 0, 1);
      px[o] = lerp(150, 30, t); px[o + 1] = lerp(205, 80, t); px[o + 2] = lerp(215, 140, t);
      continue;
    }
    if (wk === W.LAKE || wk === W.RIVER) { px[o] = 70; px[o + 1] = 120; px[o + 2] = 190; continue; }
    const zl = h[Math.max(0, i - 1)], zr = h[Math.min(g.nx * g.ny - 1, i + 1)];
    const zu = h[Math.max(0, i - g.nx)], zd = h[Math.min(g.nx * g.ny - 1, i + g.nx)];
    const dx = (zr - zl) / (2 * g.c * 1000), dy = (zu - zd) / (2 * g.c * 1000);
    // light from NW
    const nxv = -dx, nyv = -dy, nzv = 1;
    const l = Math.hypot(nxv, nyv, nzv);
    const shade = clamp(((nxv * -0.6 + nyv * 0.6 + nzv * 0.55) / l) * 1.25, 0.25, 1.35);
    const col = tint(h[i]);
    px[o] = clamp(col[0] * shade, 0, 255); px[o + 1] = clamp(col[1] * shade, 0, 255); px[o + 2] = clamp(col[2] * shade, 0, 255);
  }
}
fs.writeFileSync(out, encodePNG(W_, H_, px, 2));
console.log(`wrote ${out} ${W_}x${H_}`);
for (const p of T.peakFix) if (Math.abs(p.delta) > 250) console.log(`peak ${p.id} needed delta ${p.delta.toFixed(0)}`);
console.log(T.lakeInfo.map((l) => `${l.id}:${l.areaKm2.toFixed(2)}`).join(' '));
