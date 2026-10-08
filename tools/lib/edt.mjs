// Exact Euclidean distance transform (Felzenszwalb & Huttenlocher).
// `isFeature(i)` marks source cells; returns distances in cell units.

const INF = 1e20;

function edt1d(f, n, d, v, z) {
  let k = 0;
  v[0] = 0; z[0] = -INF; z[1] = INF;
  for (let q = 1; q < n; q++) {
    let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) {
      k--;
      s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    }
    k++;
    v[k] = q; z[k] = s; z[k + 1] = INF;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
  }
}

export function distanceTransform(nx, ny, isFeature) {
  const out = new Float32Array(nx * ny);
  const n = Math.max(nx, ny);
  const f = new Float64Array(n), d = new Float64Array(n), z = new Float64Array(n + 1);
  const v = new Int32Array(n);
  const tmp = new Float64Array(nx * ny);
  for (let x = 0; x < nx; x++) {
    for (let y = 0; y < ny; y++) f[y] = isFeature(y * nx + x) ? 0 : INF;
    edt1d(f, ny, d, v, z);
    for (let y = 0; y < ny; y++) tmp[y * nx + x] = d[y];
  }
  for (let y = 0; y < ny; y++) {
    for (let x = 0; x < nx; x++) f[x] = tmp[y * nx + x];
    edt1d(f, nx, d, v, z);
    for (let x = 0; x < nx; x++) out[y * nx + x] = Math.sqrt(d[x]);
  }
  return out;
}
