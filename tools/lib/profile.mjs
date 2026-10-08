// Route profiles: sample ground along a polyline and fit a grade-limited
// vertical alignment. The alignment is the mean of the highest grade-limited
// line that stays at/below ground (all cut) and the lowest that stays
// at/above ground (all fill) — a cheap, balanced cut-and-fill design.
import { resample } from './geom.mjs';

export const DESIGN = {
  interstate: { grade: 0.05, width: 0.045, tunnelCut: 35, viaductFill: 18, speed: 110 },
  highway: { grade: 0.06, width: 0.032, tunnelCut: 35, viaductFill: 16, speed: 90 },
  state: { grade: 0.085, width: 0.014, tunnelCut: 40, viaductFill: 22, speed: 75 },
  parkway: { grade: 0.08, width: 0.012, tunnelCut: 35, viaductFill: 20, speed: 60 },
  arterial: { grade: 0.1, width: 0.018, tunnelCut: 40, viaductFill: 16, speed: 45 },
  county: { grade: 0.13, width: 0.01, tunnelCut: 45, viaductFill: 16, speed: 65 },
  rail: { grade: 0.022, width: 0.012, tunnelCut: 25, viaductFill: 14, speed: 80 },
  'rail-abandoned': { grade: 0.06, width: 0.008, tunnelCut: 25, viaductFill: 12, speed: 0 },
};

// Lipschitz envelopes in O(n).
function envelopes(z, g, ds) {
  const n = z.length, U = Float64Array.from(z), L = Float64Array.from(z);
  const k = g * ds;
  for (let i = 1; i < n; i++) { U[i] = Math.min(U[i], U[i - 1] + k); L[i] = Math.max(L[i], L[i - 1] - k); }
  for (let i = n - 2; i >= 0; i--) { U[i] = Math.min(U[i], U[i + 1] + k); L[i] = Math.max(L[i], L[i + 1] - k); }
  return [U, L];
}

// ground(x,y) -> elevation (m); isWater(x,y) -> bool. Water spans become
// bridges whose deck is carried at max(approach ends) with clearance.
export function routeProfile(pts, ground, isWater, design, step = 0.025) {
  const P = resample(pts, step);
  const n = P.length;
  const z = new Float64Array(n), wet = new Uint8Array(n);
  for (let i = 0; i < n; i++) { z[i] = ground(P[i][0], P[i][1]); wet[i] = isWater(P[i][0], P[i][1]) ? 1 : 0; }
  // Water spans: treat as unknown ground that the alignment may float over.
  const spans = [];
  for (let i = 0; i < n; i++) {
    if (!wet[i]) continue;
    let j = i;
    while (j + 1 < n && wet[j + 1]) j++;
    spans.push([i, j]);
    i = j;
  }
  // Fill water samples with a straight line between the banks so the
  // envelopes are not dragged to the sea floor.
  const zz = Float64Array.from(z);
  for (const [a, b] of spans) {
    const za = a > 0 ? z[a - 1] : z[b + 1 < n ? b + 1 : b];
    const zb = b + 1 < n ? z[b + 1] : za;
    for (let i = a; i <= b; i++) zz[i] = za + ((zb - za) * (i - a + 1)) / (b - a + 2);
  }
  const ds = step * 1000;
  // Iterate: humps that need a tunnel and hollows that need a viaduct are
  // replaced by a straight line between their portals/abutments, so they stop
  // dragging the rest of the alignment up or down.
  let p = new Float64Array(n);
  for (let pass = 0; pass < 4; pass++) {
    const [U, L] = envelopes(zz, design.grade, ds);
    for (let i = 0; i < n; i++) p[i] = (U[i] + L[i]) / 2;
    if (pass === 3) break;
    let changed = false;
    for (let i = 0; i < n; i++) {
      const isT = zz[i] - p[i] > design.tunnelCut, isV = p[i] - zz[i] > design.viaductFill;
      if (!isT && !isV) continue;
      let j = i;
      while (j + 1 < n && ((isT && zz[j + 1] - p[j + 1] > design.tunnelCut * 0.5) || (isV && p[j + 1] - zz[j + 1] > design.viaductFill * 0.5))) j++;
      let a = i;
      while (a > 0 && ((isT && zz[a - 1] - p[a - 1] > design.tunnelCut * 0.5) || (isV && p[a - 1] - zz[a - 1] > design.viaductFill * 0.5))) a--;
      const za = zz[Math.max(0, a - 1)], zb = zz[Math.min(n - 1, j + 1)];
      for (let k = a; k <= j; k++) zz[k] = za + ((zb - za) * (k - a + 1)) / (j - a + 2);
      changed = true;
      i = j;
    }
    if (!changed) break;
  }
  const segs = []; // classify contiguous runs: bridge / tunnel / viaduct / grade
  let maxCut = 0, maxFill = 0, maxGround = 0;
  for (let i = 0; i < n; i++) {
    const cut = z[i] - p[i], fill = p[i] - z[i];
    let kind = 'grade';
    if (wet[i]) kind = 'bridge';
    else if (cut > design.tunnelCut) kind = 'tunnel';
    else if (fill > design.viaductFill) kind = 'viaduct';
    if (!wet[i]) { maxCut = Math.max(maxCut, cut); maxFill = Math.max(maxFill, fill); }
    if (i > 0) maxGround = Math.max(maxGround, Math.abs(zz[i] - zz[i - 1]) / ds);
    const last = segs[segs.length - 1];
    if (last && last.kind === kind) last.j = i;
    else segs.push({ kind, i, j: i });
  }
  // Absorb tiny tunnel/viaduct blips (< 75 m) into grade.
  for (const s of segs) if ((s.kind === 'tunnel' || s.kind === 'viaduct') && (s.j - s.i + 1) * step < 0.075) s.kind = 'grade';
  const out = [];
  for (const s of segs) {
    const last = out[out.length - 1];
    if (last && last.kind === s.kind) last.j = s.j; else out.push({ ...s });
  }
  for (const s of out) {
    s.len = (s.j - s.i + 1) * step;
    s.mid = P[Math.floor((s.i + s.j) / 2)];
    s.a = P[s.i]; s.b = P[s.j];
    if (s.kind === 'bridge') {
      let mz = Infinity;
      for (let i = s.i; i <= s.j; i++) mz = Math.min(mz, z[i]);
      s.minWater = mz;
      s.deck = Math.max(p[Math.max(0, s.i - 1)], p[Math.min(n - 1, s.j + 1)]);
    }
  }
  let maxGrade = 0;
  for (let i = 1; i < n; i++) maxGrade = Math.max(maxGrade, Math.abs(p[i] - p[i - 1]) / ds);
  return { P, z, p, wet, segs: out, step, maxCut, maxFill, maxGrade, maxGround, length: (n - 1) * step };
}
