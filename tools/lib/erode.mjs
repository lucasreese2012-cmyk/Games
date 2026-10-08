// Droplet hydraulic erosion on a heightfield (heights in metres, cell size in
// metres). Only cells where mask[i] is true are eroded; droplets die when they
// leave the mask. Deterministic for a given seed.

export function erode(h, nx, ny, mask, opts = {}) {
  const {
    droplets = 100000, seed = 1, cellM = 50, radius = 2,
    inertia = 0.08, capacity = 6, minSlope = 0.01, erodeRate = 0.35,
    depositRate = 0.25, evaporate = 0.02, gravity = 9, maxSteps = 80,
    maxErodePerStep = 6,
  } = opts;

  let s = seed >>> 0;
  const rand = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  // Brush weights.
  const bOff = [], bW = [];
  let wsum = 0;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const d = Math.hypot(dx, dy);
      if (d > radius) continue;
      const w = 1 - d / (radius + 0.5);
      bOff.push([dx, dy]); bW.push(w); wsum += w;
    }
  }
  for (let k = 0; k < bW.length; k++) bW[k] /= wsum;

  // Candidate start cells.
  const starts = [];
  for (let i = 0; i < nx * ny; i++) if (mask[i]) starts.push(i);
  if (!starts.length) return;

  // Heights are converted to "cells" so gradients are dimensionless slopes.
  const inv = 1 / cellM;

  function heightGrad(px, py) {
    const cx = Math.floor(px), cy = Math.floor(py);
    const u = px - cx, v = py - cy;
    const i = cy * nx + cx;
    const hNW = h[i] * inv, hNE = h[i + 1] * inv, hSW = h[i + nx] * inv, hSE = h[i + nx + 1] * inv;
    const gx = (hNE - hNW) * (1 - v) + (hSE - hSW) * v;
    const gy = (hSW - hNW) * (1 - u) + (hSE - hNE) * u;
    const ht = hNW * (1 - u) * (1 - v) + hNE * u * (1 - v) + hSW * (1 - u) * v + hSE * u * v;
    return [ht, gx, gy];
  }

  for (let n = 0; n < droplets; n++) {
    const si = starts[Math.floor(rand() * starts.length)];
    let px = (si % nx) + rand(), py = Math.floor(si / nx) + rand();
    let dx = 0, dy = 0, speed = 1, water = 1, sed = 0;
    for (let step = 0; step < maxSteps; step++) {
      const cx = Math.floor(px), cy = Math.floor(py);
      if (cx < 1 || cy < 1 || cx >= nx - 2 || cy >= ny - 2) break;
      const ci = cy * nx + cx;
      if (!mask[ci]) break;
      const u = px - cx, v = py - cy;
      const [ht, gx, gy] = heightGrad(px, py);
      dx = dx * inertia - gx * (1 - inertia);
      dy = dy * inertia - gy * (1 - inertia);
      const len = Math.hypot(dx, dy);
      if (len < 1e-9) { const a = rand() * 6.283; dx = Math.cos(a); dy = Math.sin(a); } else { dx /= len; dy /= len; }
      px += dx; py += dy;
      const nxi = Math.floor(px), nyi = Math.floor(py);
      if (nxi < 1 || nyi < 1 || nxi >= nx - 2 || nyi >= ny - 2) break;
      const [nh] = heightGrad(px, py);
      const dh = nh - ht; // in cells
      const cap = Math.max(-dh, minSlope) * speed * water * capacity;
      if (sed > cap || dh > 0) {
        // Deposit (fill pits when going uphill).
        const amt = dh > 0 ? Math.min(dh, sed) : (sed - cap) * depositRate;
        sed -= amt;
        const a = amt * cellM;
        h[ci] += a * (1 - u) * (1 - v);
        h[ci + 1] += a * u * (1 - v);
        h[ci + nx] += a * (1 - u) * v;
        h[ci + nx + 1] += a * u * v;
      } else {
        const amt = Math.min((cap - sed) * erodeRate, -dh, maxErodePerStep * inv);
        for (let k = 0; k < bOff.length; k++) {
          const bx = cx + bOff[k][0], by = cy + bOff[k][1];
          if (bx < 0 || by < 0 || bx >= nx || by >= ny) continue;
          const bi = by * nx + bx;
          if (!mask[bi]) continue;
          h[bi] -= amt * bW[k] * cellM;
        }
        sed += amt;
      }
      speed = Math.sqrt(Math.max(0, speed * speed + -dh * gravity));
      water *= 1 - evaporate;
    }
  }
}
