// Small 2D geometry toolkit. All coordinates are kilometres in world space
// (x east, y north). Shared by the builder and the browser explorer.

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

export function pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function bbox(pts, pad = 0) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pts) {
    if (p[0] < x0) x0 = p[0];
    if (p[1] < y0) y0 = p[1];
    if (p[0] > x1) x1 = p[0];
    if (p[1] > y1) y1 = p[1];
  }
  return [x0 - pad, y0 - pad, x1 + pad, y1 + pad];
}

// Distance from point to segment; returns [dist, t].
export function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let t = l2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const qx = ax + t * dx - px, qy = ay + t * dy - py;
  return [Math.sqrt(qx * qx + qy * qy), t];
}

export function polyLength(pts) {
  let L = 0;
  for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return L;
}

// Cumulative arc length at each vertex.
export function arcLengths(pts) {
  const out = [0];
  for (let i = 1; i < pts.length; i++) out.push(out[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return out;
}

// Resample a polyline at a fixed step (km). Extra per-vertex values (index >= 2)
// are linearly interpolated.
export function resample(pts, step) {
  const s = arcLengths(pts);
  const L = s[s.length - 1];
  const n = Math.max(2, Math.ceil(L / step) + 1);
  const out = [];
  let k = 0;
  for (let i = 0; i < n; i++) {
    const d = (L * i) / (n - 1);
    while (k < pts.length - 2 && s[k + 1] < d) k++;
    const seg = s[k + 1] - s[k] || 1;
    const t = clamp((d - s[k]) / seg, 0, 1);
    const a = pts[k], b = pts[k + 1];
    const p = [];
    for (let c = 0; c < Math.max(a.length, b.length); c++) {
      const va = a[c], vb = b[c];
      p.push(va === undefined ? vb : vb === undefined ? va : lerp(va, vb, t));
    }
    out.push(p);
  }
  return out;
}

// Build a polygon from a centreline whose vertices are [x, y, width].
export function strip(center) {
  const left = [], right = [];
  for (let i = 0; i < center.length; i++) {
    const p = center[i];
    const a = center[Math.max(0, i - 1)], b = center[Math.min(center.length - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    dx /= l; dy /= l;
    const w = p[2] / 2;
    left.push([p[0] - dy * w, p[1] + dx * w]);
    right.push([p[0] + dy * w, p[1] - dx * w]);
  }
  // Rounded caps.
  const capA = cap(center[0], center[1], center[0][2] / 2, true);
  const capB = cap(center[center.length - 1], center[center.length - 2], center[center.length - 1][2] / 2, false);
  return [...left, ...capB, ...right.reverse(), ...capA];
}

function cap(p, q, r, start) {
  const ang = Math.atan2(p[1] - q[1], p[0] - q[0]);
  const out = [];
  for (let i = 1; i < 6; i++) {
    const a = ang + Math.PI / 2 - (Math.PI * i) / 6;
    out.push([p[0] + Math.cos(a) * r, p[1] + Math.sin(a) * r]);
  }
  return start ? out : out;
}

export function ellipse(cx, cy, rx, ry, rotDeg = 0, n = 28) {
  const r = (rotDeg * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const x = Math.cos(a) * rx, y = Math.sin(a) * ry;
    out.push([cx + x * c - y * s, cy + x * s + y * c]);
  }
  return out;
}

// Local ellipse coordinate: returns normalised radius (1 = on the rim).
export function ellipseR(x, y, cx, cy, rx, ry, rotDeg = 0) {
  const r = (-rotDeg * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
  const dx = x - cx, dy = y - cy;
  const lx = dx * c - dy * s, ly = dx * s + dy * c;
  return Math.sqrt((lx / rx) ** 2 + (ly / ry) ** 2);
}

export function polyArea(poly) {
  let a = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) a += (poly[j][0] + poly[i][0]) * (poly[j][1] - poly[i][1]);
  return Math.abs(a / 2);
}

// Closed Catmull-Rom smoothing of a polygon's control points.
export function smoothPoly(pts, sub = 4) {
  const n = pts.length, out = [];
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    for (let k = 0; k < sub; k++) {
      const t = k / sub, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map((c) => 0.5 * ((2 * p1[c]) + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3)));
    }
  }
  return out;
}
