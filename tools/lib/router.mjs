// Grade-constrained route finder (A* on a coarse grid with 16 directions).
// Moves steeper than the design grade are heavily penalised, so climbing a
// steep mountainside produces contour-following switchbacks on its own.

// 48 directions: fine angular resolution lets a road traverse a steep slope
// almost along the contour, which is what a switchback grade does.
const DIRS = [];
for (let dx = -4; dx <= 4; dx++) for (let dy = -4; dy <= 4; dy++) {
  if (!dx && !dy) continue;
  const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
  if (gcd(Math.abs(dx), Math.abs(dy)) !== 1) continue;
  DIRS.push([dx, dy, Math.hypot(dx, dy)]);
}

class Heap {
  constructor() { this.k = []; this.v = []; }
  push(key, val) {
    const k = this.k, v = this.v;
    let i = k.length;
    k.push(key); v.push(val);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (k[p] <= key) break;
      k[i] = k[p]; v[i] = v[p]; i = p;
    }
    k[i] = key; v[i] = val;
  }
  pop() {
    const k = this.k, v = this.v;
    const top = v[0];
    const lk = k.pop(), lv = v.pop();
    if (k.length) {
      let i = 0;
      const n = k.length;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= n) break;
        if (c + 1 < n && k[c + 1] < k[c]) c++;
        if (k[c] >= lk) break;
        k[i] = k[c]; v[i] = v[c]; i = c;
      }
      k[i] = lk; v[i] = lv;
    }
    return top;
  }
  get size() { return this.k.length; }
}

// field: { nx, ny, x0, y1, c (km), z: Float32Array, wet: Uint8Array, land: Uint8Array }
export function makeRouteField(g, h, water, island, factor = 2) {
  const nx = Math.floor(g.nx / factor), ny = Math.floor(g.ny / factor);
  const z = new Float32Array(nx * ny), wet = new Uint8Array(nx * ny), land = new Uint8Array(nx * ny);
  for (let r = 0; r < ny; r++) for (let c = 0; c < nx; c++) {
    let s = 0, w = 0, l = 0;
    for (let a = 0; a < factor; a++) for (let b = 0; b < factor; b++) {
      const i = (r * factor + a) * g.nx + c * factor + b;
      s += h[i]; w += water[i] ? 1 : 0; l += island[i] ? 1 : 0;
    }
    z[r * nx + c] = s / (factor * factor);
    wet[r * nx + c] = w * 2 > factor * factor ? 1 : 0;
    land[r * nx + c] = l * 2 > factor * factor ? 1 : 0;
  }
  return { nx, ny, x0: g.x0, y1: g.y1, c: g.c * factor, z, wet, land };
}

export function findRoute(F, a, b, opt = {}) {
  const { gmax = 0.08, waterMult = 12, steepMult = 1500, gradeW = 6, maxNodes = 4e6, box = 6 } = opt;
  const col = (x) => Math.round((x - F.x0) / F.c - 0.5), row = (y) => Math.round((F.y1 - y) / F.c - 0.5);
  const X = (c) => F.x0 + (c + 0.5) * F.c, Y = (r) => F.y1 - (r + 0.5) * F.c;
  const sc = col(a[0]), sr = row(a[1]), ec = col(b[0]), er = row(b[1]);
  // Search window around the straight line (km padding) keeps legs local.
  const pad = Math.ceil(box / F.c);
  const c0 = Math.max(0, Math.min(sc, ec) - pad), c1 = Math.min(F.nx - 1, Math.max(sc, ec) + pad);
  const r0 = Math.max(0, Math.min(sr, er) - pad), r1 = Math.min(F.ny - 1, Math.max(sr, er) + pad);
  const W = c1 - c0 + 1, H = r1 - r0 + 1;
  const idx = (c, r) => (r - r0) * W + (c - c0);
  const gScore = new Float64Array(W * H).fill(Infinity);
  const from = new Int32Array(W * H).fill(-1);
  const closed = new Uint8Array(W * H);
  const step = F.c * 1000;
  const heur = (c, r) => Math.hypot(c - ec, r - er) * step;
  const open = new Heap();
  gScore[idx(sc, sr)] = 0;
  open.push(heur(sc, sr), idx(sc, sr));
  let expanded = 0;
  const goal = idx(ec, er);
  while (open.size) {
    const cur = open.pop();
    if (closed[cur]) continue;
    closed[cur] = 1;
    if (cur === goal) break;
    if (++expanded > maxNodes) break;
    const cc = (cur % W) + c0, cr = Math.floor(cur / W) + r0;
    const zc = F.z[cr * F.nx + cc];
    for (const [dx, dy, dl] of DIRS) {
      const nc = cc + dx, nr = cr + dy;
      if (nc < c0 || nc > c1 || nr < r0 || nr > r1) continue;
      const ni = idx(nc, nr);
      if (closed[ni]) continue;
      // Walk the move in unit sub-steps so long moves cannot jump terrain.
      const n = Math.max(Math.abs(dx), Math.abs(dy));
      const subL = (dl * step) / n;
      let cost = 0, zp = zc, wetAny = false;
      for (let k = 1; k <= n; k++) {
        const sc2 = Math.round(cc + (dx * k) / n), sr2 = Math.round(cr + (dy * k) / n);
        const fi = sr2 * F.nx + sc2;
        const wetN = F.wet[fi] || !F.land[fi];
        const zn = wetN ? zp : F.z[fi];
        const gr = Math.abs(zn - zp) / subL;
        let c = subL * (1 + gradeW * gr * gr);
        if (gr > gmax) c += subL * steepMult * (gr - gmax);
        if (wetN) { c *= waterMult; wetAny = true; }
        cost += c;
        zp = zn;
      }
      if (wetAny && n > 1) cost *= 1.05;
      const ng = gScore[cur] + cost;
      if (ng < gScore[ni]) {
        gScore[ni] = ng; from[ni] = cur;
        open.push(ng + heur(nc, nr), ni);
      }
    }
  }
  if (from[goal] < 0 && goal !== idx(sc, sr)) return null;
  const path = [];
  for (let k = goal; k >= 0; k = from[k]) {
    path.push([X((k % W) + c0), Y(Math.floor(k / W) + r0)]);
    if (k === idx(sc, sr)) break;
  }
  path.reverse();
  path[0] = [a[0], a[1]];
  path[path.length - 1] = [b[0], b[1]];
  return { path, expanded, cost: gScore[goal] };
}

// Douglas–Peucker then Chaikin smoothing.
export function simplify(pts, tol) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let md = -1, mi = -1;
    const [ax, ay] = pts[a], [bx, by] = pts[b];
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1e-12;
    for (let i = a + 1; i < b; i++) {
      const t = Math.max(0, Math.min(1, ((pts[i][0] - ax) * dx + (pts[i][1] - ay) * dy) / l2));
      const d = Math.hypot(pts[i][0] - (ax + t * dx), pts[i][1] - (ay + t * dy));
      if (d > md) { md = d; mi = i; }
    }
    if (md > tol) { keep[mi] = 1; stack.push([a, mi], [mi, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

export function chaikin(pts, iters = 2) {
  let p = pts;
  for (let k = 0; k < iters; k++) {
    if (p.length < 3) return p;
    const out = [p[0]];
    for (let i = 0; i < p.length - 1; i++) {
      const a = p[i], b = p[i + 1];
      out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    out.push(p[p.length - 1]);
    p = out;
  }
  return p;
}
