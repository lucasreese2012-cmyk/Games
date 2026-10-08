// Cassena Islands explorer: a 2D atlas and a 3D free-roam view of the
// generated world. Data: data/terrain.png (elevation, water, island),
// data/cover.png (land cover, lake/river surface) and data/world.json.
'use strict';
(() => {
  const $ = (s) => document.querySelector(s);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const fmt = (v) => Math.round(v).toLocaleString('en-US');
  const DIRS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const bearingName = (deg) => DIRS[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];

  let W; // world.json
  let nx, ny, cell, x0, y1, x1, y0;
  let H, WT, ISL, COV, SURF;
  const CX = 45, CY = 46; // scene origin (km)
  const coarse = matchMedia('(pointer: coarse)').matches;
  if (coarse) document.body.classList.add('coarse');

  // -------------------------------------------------------------- loading
  const setLoad = (p, msg) => { $('#loadbar').style.width = `${Math.round(p * 100)}%`; if (msg) $('#loadstep').textContent = msg; };

  async function decodePNG(buf) {
    const dv = new DataView(buf);
    let p = 8, w = 0, h = 0, ct = 2;
    const idat = [];
    while (p < buf.byteLength) {
      const len = dv.getUint32(p);
      const type = String.fromCharCode(dv.getUint8(p + 4), dv.getUint8(p + 5), dv.getUint8(p + 6), dv.getUint8(p + 7));
      if (type === 'IHDR') { w = dv.getUint32(p + 8); h = dv.getUint32(p + 12); ct = dv.getUint8(p + 17); }
      else if (type === 'IDAT') idat.push(new Uint8Array(buf, p + 8, len));
      else if (type === 'IEND') break;
      p += 12 + len;
    }
    const raw = new Uint8Array(await new Response(new Blob(idat).stream().pipeThrough(new DecompressionStream('deflate'))).arrayBuffer());
    const bpp = ct === 6 ? 4 : ct === 0 ? 1 : 3;
    const stride = w * bpp, out = new Uint8Array(w * h * bpp);
    for (let y = 0; y < h; y++) {
      const f = raw[y * (stride + 1)], src = y * (stride + 1) + 1, o = y * stride;
      for (let x = 0; x < stride; x++) {
        const a = x >= bpp ? out[o + x - bpp] : 0, b = y ? out[o - stride + x] : 0, c = x >= bpp && y ? out[o - stride + x - bpp] : 0;
        let v = raw[src + x];
        if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
        else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
        out[o + x] = v & 255;
      }
    }
    return { w, h, bpp, data: out };
  }
  async function loadRaster(url) {
    const buf = await (await fetch(url)).arrayBuffer();
    if (typeof DecompressionStream !== 'undefined') {
      try { return await decodePNG(buf); } catch (e) { console.warn('PNG decode fallback', e); }
    }
    const bmp = await createImageBitmap(new Blob([buf]), { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
    const cv = document.createElement('canvas'); cv.width = bmp.width; cv.height = bmp.height;
    const ctx = cv.getContext('2d'); ctx.drawImage(bmp, 0, 0);
    const d = ctx.getImageData(0, 0, bmp.width, bmp.height).data, out = new Uint8Array(bmp.width * bmp.height * 3);
    for (let i = 0, j = 0; i < d.length; i += 4, j += 3) { out[j] = d[i]; out[j + 1] = d[i + 1]; out[j + 2] = d[i + 2]; }
    return { w: bmp.width, h: bmp.height, bpp: 3, data: out };
  }

  // ------------------------------------------------------------- grid helpers
  const colOf = (x) => Math.floor((x - x0) / cell), rowOf = (y) => Math.floor((y1 - y) / cell);
  const idxAt = (x, y) => { const c = colOf(x), r = rowOf(y); return c < 0 || r < 0 || c >= nx || r >= ny ? -1 : r * nx + c; };
  const cx2x = (c) => x0 + (c + 0.5) * cell, cr2y = (r) => y1 - (r + 0.5) * cell;
  function hAt(x, y) {
    const fx = (x - x0) / cell - 0.5, fy = (y1 - y) / cell - 0.5;
    const c = clamp(Math.floor(fx), 0, nx - 2), r = clamp(Math.floor(fy), 0, ny - 2);
    const tx = clamp(fx - c, 0, 1), ty = clamp(fy - r, 0, 1), i = r * nx + c;
    const a = H[i] + (H[i + 1] - H[i]) * tx, b = H[i + nx] + (H[i + nx + 1] - H[i + nx]) * tx;
    return a + (b - a) * ty;
  }
  // Walkable surface: ground, or the water surface over lakes, rivers and sea.
  function surfaceAt(x, y) {
    const i = idxAt(x, y), g = hAt(x, y);
    if (i < 0) return { z: Math.max(0, g), water: true, depth: 10 };
    const w = WT[i];
    if (w === 1) return { z: Math.max(0, g), water: g < 0, depth: -g };
    if (w >= 2) return { z: Math.max(SURF[i], g), water: true, depth: SURF[i] - g };
    return { z: g, water: false, depth: 0 };
  }
  const islandById = {};
  let islandByIndex = [];
  const islandName = (id) => islandById[id]?.name || id;
  function islandAt(x, y) {
    const i = idxAt(x, y);
    if (i < 0 || !ISL[i]) return null;
    const isl = islandByIndex[ISL[i]];
    return isl ? (isl.partOf ? islandById[isl.partOf] : isl) : null;
  }
  function locate(x, y) {
    let best = null;
    for (const s of W.settlements) {
      const d = Math.hypot(x - s.at[0], y - s.at[1]), score = d / (s.pop > 5000 ? 1.6 : 1);
      if (!best || score < best.score) best = { s, d, score };
    }
    if (!best) return '';
    if (best.d < 0.6) return `in ${best.s.name}`;
    const deg = (Math.atan2(x - best.s.at[0], y - best.s.at[1]) * 180) / Math.PI;
    return `${best.d.toFixed(1)} km ${bearingName(deg)} of ${best.s.name}`;
  }

  // ------------------------------------------------------------- the index
  const TYPES = {
    town: { label: 'Towns', one: 'Settlement', color: '#3e6a3b', glyph: 'T' },
    landmark: { label: 'Landmarks', one: 'Landmark', color: '#c4402a', glyph: 'L' },
    viewpoint: { label: 'Viewpoints', one: 'Viewpoint', color: '#7a4fb0', glyph: 'V' },
    beach: { label: 'Beaches', one: 'Beach', color: '#c08a2b', glyph: 'B' },
    lake: { label: 'Lakes', one: 'Lake', color: '#1f6aa8', glyph: 'W' },
    forest: { label: 'Forests', one: 'Forest', color: '#2f6f4a', glyph: 'F' },
    mountain: { label: 'Mountains', one: 'Summit', color: '#6b5a4a', glyph: 'M' },
    district: { label: 'Districts', one: 'District', color: '#5a6170', glyph: 'D' },
  };
  let INDEX = [];
  function buildIndex() {
    const add = (type, list, f = (e) => e) => list.forEach((e) => INDEX.push({ type, id: `${type}:${e.id}`, name: e.name, island: e.island, at: f(e).at || e.at, e }));
    add('town', W.settlements);
    add('landmark', W.landmarks);
    add('viewpoint', W.viewpoints);
    add('beach', W.beaches);
    add('lake', W.lakes);
    add('forest', W.forests);
    add('mountain', W.mountains);
    add('district', W.districts);
  }

  // ================================================================ ATLAS
  const A = { s: 8, cx: 45, cy: 46, base: null, hits: [], sel: null, filter: 'all', layers: { roads: true, rails: true, ferries: true, power: false, labels: true, places: true } };
  const mapCv = $('#map'), mctx = mapCv.getContext('2d');

  function buildBase() {
    const cv = document.createElement('canvas'); cv.width = nx; cv.height = ny;
    const ctx = cv.getContext('2d'), img = ctx.createImageData(nx, ny), d = img.data;
    const pal = W.cover.map((c) => c.color);
    const k = 1 / (2 * cell * 1000);
    for (let r = 0; r < ny; r++) for (let c = 0; c < nx; c++) {
      const i = r * nx + c, o = i * 4;
      d[o + 3] = 255;
      if (WT[i] === 1) {
        const t = Math.pow(clamp(-H[i] / 45, 0, 1), 0.6);
        d[o] = lerp(150, 28, t); d[o + 1] = lerp(206, 82, t); d[o + 2] = lerp(214, 136, t);
        continue;
      }
      if (WT[i] >= 2) { d[o] = 64; d[o + 1] = 122; d[o + 2] = 168; continue; }
      const zl = H[c > 0 ? i - 1 : i], zr = H[c < nx - 1 ? i + 1 : i], zu = H[r > 0 ? i - nx : i], zd = H[r < ny - 1 ? i + nx : i];
      const dx = (zr - zl) * k, dy = (zu - zd) * k;
      const nX = -dx * 2.2, nY = -dy * 2.2, l = Math.hypot(nX, nY, 1);
      const shade = clamp(((nX * -0.55 + nY * 0.55 + 0.62) / l) * 1.32, 0.42, 1.28);
      const col = pal[COV[i]] || pal[17], hz = clamp(H[i] / 2200, 0, 1) * 0.12;
      d[o] = clamp((col[0] * (1 - hz) + 235 * hz) * shade, 0, 255);
      d[o + 1] = clamp((col[1] * (1 - hz) + 235 * hz) * shade, 0, 255);
      d[o + 2] = clamp((col[2] * (1 - hz) + 235 * hz) * shade, 0, 255);
    }
    ctx.putImageData(img, 0, 0);
    return cv;
  }

  const ROAD_STYLE = {
    interstate: ['#7a2a1e', '#d9573c', 3.4, 0], highway: ['#7d4d1e', '#ec9f45', 2.8, 0], state: ['#7a6428', '#f4d36c', 2.2, 4],
    parkway: ['#35502a', '#9cc27a', 2.0, 6], arterial: ['#5d5650', '#f3ecdc', 1.8, 8], county: ['#6e665c', '#fbf8ef', 1.5, 10],
  };
  const ROAD_ORDER = ['county', 'arterial', 'parkway', 'state', 'highway', 'interstate'];
  const toS = (x, y) => [(x - A.cx) * A.s + mapCv.clientWidth / 2, (A.cy - y) * A.s + mapCv.clientHeight / 2];
  const fromS = (px, py) => [A.cx + (px - mapCv.clientWidth / 2) / A.s, A.cy - (py - mapCv.clientHeight / 2) / A.s];

  function path(pts) {
    mctx.beginPath();
    let first = true;
    for (const p of pts) { const [sx, sy] = toS(p[0], p[1]); if (first) { mctx.moveTo(sx, sy); first = false; } else mctx.lineTo(sx, sy); }
  }
  function drawAtlas() {
    const dpr = Math.min(devicePixelRatio || 1, 2), w = mapCv.clientWidth, h = mapCv.clientHeight;
    if (mapCv.width !== Math.round(w * dpr) || mapCv.height !== Math.round(h * dpr)) { mapCv.width = Math.round(w * dpr); mapCv.height = Math.round(h * dpr); }
    mctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    mctx.fillStyle = 'rgb(40,96,146)';
    mctx.fillRect(0, 0, w, h);
    const [ax, ay] = toS(x0, y1), iw = (x1 - x0) * A.s, ih = (y1 - y0) * A.s, bw = A.base.width, bh = A.base.height;
    mctx.imageSmoothingEnabled = A.s < 22;
    mctx.drawImage(A.base, ax, ay, iw, ih);
    // Feather the frame edge into the open sea beyond the surveyed area.
    const band = Math.min(60, 5 * A.s), sea = 'rgba(40,96,146,1)', clear = 'rgba(40,96,146,0)';
    for (const [gx0, gy0, gx1, gy1, rx, ry, rw, rh] of [[ax, 0, ax + band, 0, ax, ay, band, ih], [ax + iw, 0, ax + iw - band, 0, ax + iw - band, ay, band, ih], [0, ay, 0, ay + band, ax, ay, iw, band], [0, ay + ih, 0, ay + ih - band, ax, ay + ih - band, iw, band]]) {
      const gr = mctx.createLinearGradient(gx0, gy0, gx1, gy1); gr.addColorStop(0, sea); gr.addColorStop(1, clear);
      mctx.fillStyle = gr; mctx.fillRect(rx, ry, rw, rh);
    }
    A.hits = [];
    const z = A.s;
    mctx.lineJoin = 'round'; mctx.lineCap = 'round';
    if (A.layers.power) {
      mctx.setLineDash([4, 4]); mctx.strokeStyle = 'rgba(60,60,70,0.7)'; mctx.lineWidth = 1;
      for (const ln of W.power.lines) { path(ln.pts); mctx.stroke(); }
      mctx.setLineDash([]);
    }
    if (A.layers.ferries) {
      mctx.setLineDash([6, 5]); mctx.strokeStyle = 'rgba(16,40,80,0.85)'; mctx.lineWidth = 1.5;
      for (const f of W.ferries) { path(f.pts); mctx.stroke(); }
      mctx.setLineDash([]);
    }
    if (A.layers.rails) {
      for (const r of W.rails) {
        const dead = r.status === 'abandoned';
        if (dead && z < 10) continue;
        path(r.pts);
        mctx.strokeStyle = dead ? 'rgba(110,95,80,0.75)' : '#2b2b30'; mctx.lineWidth = dead ? 1.2 : Math.max(1.2, z / 14);
        mctx.setLineDash(dead ? [4, 4] : []); mctx.stroke();
        if (!dead && z > 14) { mctx.setLineDash([1, 5]); mctx.lineWidth = Math.max(3, z / 6); mctx.stroke(); }
        mctx.setLineDash([]);
      }
    }
    if (A.layers.roads) {
      for (const pass of [0, 1]) for (const cls of ROAD_ORDER) {
        const [casing, fill, base, minZ] = ROAD_STYLE[cls];
        if (z < minZ) continue;
        const wpx = Math.max(1, base * clamp(z / 12, 0.45, 2.2));
        for (const r of W.roads) {
          if (r.cls !== cls) continue;
          path(r.pts);
          mctx.strokeStyle = pass ? fill : casing; mctx.lineWidth = pass ? wpx : wpx + 1.6; mctx.stroke();
        }
      }
    }
    // Places
    const mark = (item, sx, sy) => A.hits.push({ item, sx, sy });
    const vis = (sx, sy) => sx > -40 && sy > -40 && sx < w + 40 && sy < h + 40;
    const show = A.filter;
    if (A.layers.places) {
      for (const it of INDEX) {
        const t = it.type;
        if (show !== 'all' && t !== show) continue;
        if (show === 'all' && !['town', 'landmark', 'viewpoint', 'mountain'].includes(t)) continue;
        const [sx, sy] = toS(it.at[0], it.at[1]);
        if (!vis(sx, sy)) continue;
        const e = it.e;
        if (t === 'town') {
          const r = clamp(Math.sqrt(e.pop) / 90, 2, 7) * clamp(z / 10, 0.7, 1.6);
          const minPop = z < 6 ? 20000 : z < 11 ? 2000 : z < 20 ? 500 : 0;
          if (show === 'all' && e.pop < minPop && e.form !== 'city') continue;
          mctx.beginPath(); mctx.arc(sx, sy, r, 0, 7); mctx.fillStyle = '#fff'; mctx.fill(); mctx.lineWidth = 1.5; mctx.strokeStyle = '#1c2725'; mctx.stroke();
          mark(it, sx, sy);
        } else if (t === 'landmark') {
          const need = { primary: 0, secondary: 9, local: 18, micro: 34 }[e.tier];
          if (show === 'all' && z < need) continue;
          const s = e.tier === 'primary' ? 6 : e.tier === 'secondary' ? 4.5 : 3.2;
          mctx.beginPath(); mctx.moveTo(sx, sy - s); mctx.lineTo(sx + s, sy); mctx.lineTo(sx, sy + s); mctx.lineTo(sx - s, sy); mctx.closePath();
          mctx.fillStyle = e.tier === 'primary' ? '#c4402a' : e.tier === 'secondary' ? '#e2803a' : '#f1c35a'; mctx.fill();
          mctx.lineWidth = 1.2; mctx.strokeStyle = '#2a1a12'; mctx.stroke();
          mark(it, sx, sy);
        } else if (t === 'mountain') {
          if (show === 'all' && (z < 7 || (e.z < 1000 && z < 16))) continue;
          mctx.beginPath(); mctx.moveTo(sx, sy - 5); mctx.lineTo(sx + 4.5, sy + 3); mctx.lineTo(sx - 4.5, sy + 3); mctx.closePath();
          mctx.fillStyle = '#4a3b2e'; mctx.fill();
          mark(it, sx, sy);
        } else {
          if (show === 'all' && z < 14) continue;
          mctx.beginPath(); mctx.arc(sx, sy, 4, 0, 7); mctx.fillStyle = TYPES[t].color; mctx.fill(); mctx.lineWidth = 1.2; mctx.strokeStyle = '#fff'; mctx.stroke();
          mark(it, sx, sy);
        }
      }
    }
    // Selection ring
    if (A.sel) {
      const [sx, sy] = toS(A.sel.at[0], A.sel.at[1]);
      mctx.beginPath(); mctx.arc(sx, sy, 11, 0, 7); mctx.lineWidth = 3; mctx.strokeStyle = '#fff'; mctx.stroke();
      mctx.beginPath(); mctx.arc(sx, sy, 11, 0, 7); mctx.lineWidth = 1.5; mctx.strokeStyle = '#c4402a'; mctx.stroke();
    }
    if (A.layers.labels) drawLabels(w, h);
    // Scale bar
    const km = [0.5, 1, 2, 5, 10, 20].find((k) => k * z > 60) || 20;
    $('#scalebar').style.width = `${km * z}px`;
    $('#scaletxt').textContent = km < 1 ? `${km * 1000} m` : `${km} km`;
  }
  const placed = [];
  function label(text, sx, sy, font, fill, stroke = 'rgba(255,255,255,0.9)', align = 'left') {
    mctx.font = font; mctx.textAlign = align; mctx.textBaseline = 'middle';
    const tw = mctx.measureText(text).width, x = align === 'center' ? sx - tw / 2 : sx;
    const box = [x - 2, sy - 8, x + tw + 2, sy + 8];
    for (const b of placed) if (box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1]) return false;
    placed.push(box);
    mctx.lineWidth = 3.5; mctx.strokeStyle = stroke; mctx.strokeText(text, sx, sy);
    mctx.fillStyle = fill; mctx.fillText(text, sx, sy);
    return true;
  }
  function drawLabels(w, h) {
    placed.length = 0;
    const z = A.s;
    if (z < 30) for (const isl of W.islands) {
      if (isl.partOf || !isl.label) continue;
      const [sx, sy] = toS(isl.label[0], isl.label[1]);
      label(isl.name.toUpperCase().split('').join(' '), sx, sy, `800 ${clamp(z * 1.3, 10, 18)}px Overpass, Arial`, '#1c2725', 'rgba(255,255,255,0.75)', 'center');
    }
    if (z > 4) for (const wt of W.waters) {
      if (!wt.label) continue;
      const [sx, sy] = toS(wt.label[0], wt.label[1]);
      label(wt.name, sx, sy, `italic 600 ${clamp(z * 0.9, 10, 14)}px Overpass, Arial`, '#e8f3ff', 'rgba(20,50,90,0.75)', 'center');
    }
    const items = A.hits.slice().sort((a, b) => rank(b.item) - rank(a.item));
    for (const { item, sx, sy } of items) {
      const e = item.e;
      let text = item.name, font = '600 12px Overpass, Arial';
      if (item.type === 'town') font = `${e.pop > 10000 ? 800 : 600} ${e.pop > 100000 ? 15 : e.pop > 10000 ? 13 : 12}px Overpass, Arial`;
      if (item.type === 'mountain') text = `${item.name} ${fmt(e.z)}`;
      label(text, sx + 8, sy, font, '#1c2725');
    }
  }
  const rank = (it) => (it.type === 'town' ? 1e6 + it.e.pop : it.type === 'landmark' ? { primary: 9e5, secondary: 5e5, local: 1e4, micro: 1 }[it.e.tier] : it.type === 'mountain' ? 2e5 + it.e.z : 1e3);

  let atlasQueued = false;
  const redraw = () => { if (!atlasQueued) { atlasQueued = true; requestAnimationFrame(() => { atlasQueued = false; if (state.mode === 'atlas') drawAtlas(); }); } };

  function fitAll() {
    const w = mapCv.clientWidth, h = mapCv.clientHeight;
    const panelW = innerWidth > 720 ? 380 : 0, panelH = innerWidth > 720 ? 0 : panel.classList.contains('min') ? 76 : h * 0.44;
    A.s = Math.min((w - panelW) / (x1 - x0), (h - panelH) / (y1 - y0)) * 0.97;
    A.cx = (x0 + x1) / 2 - panelW / 2 / A.s;
    A.cy = (y0 + y1) / 2 - panelH / 2 / A.s;
  }
  function centerOn(x, y, s) {
    const panelW = innerWidth > 720 ? 380 : 0, panelH = innerWidth > 720 ? 0 : mapCv.clientHeight * 0.44;
    if (s) A.s = s;
    A.cx = x - panelW / 2 / A.s; A.cy = y - panelH / 2 / A.s;
    redraw();
  }

  // Pan, zoom, pinch, click.
  const ptrs = new Map();
  let downAt = null, pinch = null;
  mapCv.addEventListener('pointerdown', (ev) => {
    mapCv.setPointerCapture(ev.pointerId);
    ptrs.set(ev.pointerId, [ev.offsetX, ev.offsetY]);
    if (ptrs.size === 1) downAt = { x: ev.offsetX, y: ev.offsetY, cx: A.cx, cy: A.cy, moved: false };
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), s: A.s, mid: fromS((a[0] + b[0]) / 2, (a[1] + b[1]) / 2) }; }
  });
  mapCv.addEventListener('pointermove', (ev) => {
    if (!ptrs.has(ev.pointerId)) { hover(ev.offsetX, ev.offsetY); return; }
    ptrs.set(ev.pointerId, [ev.offsetX, ev.offsetY]);
    if (ptrs.size === 2 && pinch) {
      const [a, b] = [...ptrs.values()];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      A.s = clamp(pinch.s * (d / pinch.d), 3, 400);
      const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      A.cx = pinch.mid[0] - (mx - mapCv.clientWidth / 2) / A.s; A.cy = pinch.mid[1] + (my - mapCv.clientHeight / 2) / A.s;
      if (downAt) downAt.moved = true;
      redraw(); return;
    }
    if (downAt) {
      const dx = ev.offsetX - downAt.x, dy = ev.offsetY - downAt.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) downAt.moved = true;
      A.cx = downAt.cx - dx / A.s; A.cy = downAt.cy + dy / A.s;
      redraw();
    }
  });
  const endPtr = (ev) => {
    if (!ptrs.has(ev.pointerId)) return;
    ptrs.delete(ev.pointerId);
    if (ptrs.size < 2) pinch = null;
    if (ptrs.size === 0 && downAt) {
      if (!downAt.moved) click(ev.offsetX, ev.offsetY);
      downAt = null;
    }
  };
  mapCv.addEventListener('pointerup', endPtr);
  mapCv.addEventListener('pointercancel', endPtr);
  mapCv.addEventListener('wheel', (ev) => {
    ev.preventDefault();
    const [wx, wy] = fromS(ev.offsetX, ev.offsetY);
    A.s = clamp(A.s * Math.exp(-ev.deltaY * 0.0015), 3, 400);
    A.cx = wx - (ev.offsetX - mapCv.clientWidth / 2) / A.s; A.cy = wy + (ev.offsetY - mapCv.clientHeight / 2) / A.s;
    redraw();
  }, { passive: false });
  function nearestHit(px, py, r = 14) {
    let best = null, bd = r;
    for (const h of A.hits) { const d = Math.hypot(h.sx - px, h.sy - py); if (d < bd) { bd = d; best = h; } }
    return best;
  }
  function hover(px, py) {
    const tip = $('#tip'), h = nearestHit(px, py);
    if (!h || coarse) { tip.hidden = true; mapCv.style.cursor = 'grab'; return; }
    tip.hidden = false; mapCv.style.cursor = 'pointer';
    tip.textContent = `${h.item.name} · ${TYPES[h.item.type].one}`;
    tip.style.left = `${Math.min(px + 14, mapCv.clientWidth - tip.offsetWidth - 8)}px`; tip.style.top = `${py + 10}px`;
  }
  function click(px, py) {
    const h = nearestHit(px, py, coarse ? 22 : 14);
    if (h) select(h.item);
    else {
      const [x, y] = fromS(px, py);
      const isl = islandAt(x, y);
      $('#tip').hidden = true;
      if (isl) showSpot(x, y);
    }
  }

  // ============================================================== PANEL
  const panel = $('#panel'), list = $('#list'), card = $('#card');
  function renderChips() {
    const chips = $('#chips');
    chips.innerHTML = '';
    for (const [k, label] of [['all', 'All'], ...Object.entries(TYPES).map(([k, v]) => [k, v.label])]) {
      const b = document.createElement('button');
      b.textContent = label; b.setAttribute('aria-pressed', String(A.filter === k));
      b.onclick = () => { A.filter = k; renderChips(); renderList(); redraw(); };
      chips.appendChild(b);
    }
  }
  function renderLayers() {
    const el = $('#layers');
    el.innerHTML = '';
    for (const [k, label] of [['roads', 'Roads'], ['rails', 'Railways'], ['ferries', 'Ferries'], ['power', 'Power lines'], ['places', 'Places'], ['labels', 'Labels']]) {
      const l = document.createElement('label');
      const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = A.layers[k]; cb.id = `layer-${k}`;
      cb.onchange = () => { A.layers[k] = cb.checked; redraw(); };
      l.append(cb, label); el.appendChild(l);
    }
  }
  function matches(q) {
    const s = q.trim().toLowerCase();
    let items = INDEX.filter((it) => A.filter === 'all' || it.type === A.filter);
    if (s) items = items.filter((it) => it.name.toLowerCase().includes(s) || islandName(it.island).toLowerCase().includes(s) || (it.e.kind || it.e.type || it.e.form || '').toLowerCase().includes(s));
    items.sort((a, b) => {
      if (s) { const ia = a.name.toLowerCase().indexOf(s), ib = b.name.toLowerCase().indexOf(s); if ((ia === 0) !== (ib === 0)) return ia === 0 ? -1 : 1; }
      return rank(b) - rank(a);
    });
    return items;
  }
  function renderList() {
    const items = matches($('#q').value);
    $('#count').textContent = `${items.length} ${items.length === 1 ? 'place' : 'places'}`;
    list.innerHTML = '';
    const frag = document.createDocumentFragment();
    for (const it of items.slice(0, 200)) {
      const d = document.createElement('div');
      d.className = 'item'; d.tabIndex = 0; d.setAttribute('role', 'option');
      const g = document.createElement('div'); g.className = 'glyph'; g.style.background = TYPES[it.type].color; g.textContent = TYPES[it.type].glyph;
      const t = document.createElement('div');
      const sub = it.type === 'town' ? `${it.e.form} · ${fmt(it.e.pop)} people` : it.type === 'landmark' ? `${it.e.tier} landmark · ${it.e.kind}` : it.type === 'mountain' ? `${fmt(it.e.z)} m · ${it.e.kind}` : it.e.type || it.e.form || it.e.sand || TYPES[it.type].one;
      t.innerHTML = `<div class="t"></div><div class="s"></div>`;
      t.children[0].textContent = it.name; t.children[1].textContent = `${islandName(it.island)} · ${sub}`;
      d.append(g, t);
      d.onclick = () => select(it, true);
      d.onkeydown = (ev) => { if (ev.key === 'Enter') select(it, true); };
      frag.appendChild(d);
    }
    list.appendChild(frag);
  }
  $('#q').addEventListener('input', () => { panel.classList.remove('detail', 'min'); renderList(); });
  $('#q').addEventListener('focus', () => panel.classList.remove('min'));

  function fact(dl, k, v) { if (v == null || v === '') return; const dt = document.createElement('dt'); dt.textContent = k; const dd = document.createElement('dd'); dd.textContent = v; dl.append(dt, dd); }
  function section(title, text) {
    if (!text) return null;
    const f = document.createDocumentFragment();
    const h = document.createElement('h3'); h.textContent = title;
    const p = document.createElement('p'); p.textContent = text;
    f.append(h, p); return f;
  }
  function select(it, recenter) {
    A.sel = it;
    panel.classList.add('detail'); panel.classList.remove('min');
    const e = it.e;
    card.innerHTML = '';
    const back = document.createElement('button'); back.className = 'back'; back.textContent = '← All places';
    back.onclick = () => { panel.classList.remove('detail'); A.sel = null; redraw(); };
    const kick = document.createElement('div'); kick.className = 'kicker';
    const tag = document.createElement('span'); tag.className = 'tag'; tag.textContent = it.type === 'landmark' ? `${e.tier} landmark` : TYPES[it.type].one;
    const isl = document.createElement('span'); isl.textContent = islandName(it.island);
    kick.append(tag, isl);
    const h2 = document.createElement('h2'); h2.textContent = it.name;
    const where = document.createElement('div'); where.className = 'where';
    where.textContent = e.where || locate(it.at[0], it.at[1]);
    const dl = document.createElement('dl'); dl.className = 'facts';
    const g = hAt(it.at[0], it.at[1]);
    if (it.type === 'town') { fact(dl, 'Population', fmt(e.pop)); fact(dl, 'Form', e.form); fact(dl, 'Elevation', `${fmt(Math.max(0, g))} m`); }
    if (it.type === 'landmark') { fact(dl, 'Type', e.kind); if (e.ground != null) fact(dl, 'Ground', `${fmt(e.ground)} m`); if (e.h) fact(dl, 'Height', `${fmt(e.h)} m`); if (e.share != null) fact(dl, 'Visible from', `${Math.round(e.share * 100)}% of all land`); }
    if (it.type === 'viewpoint') { fact(dl, 'Ground', `${fmt(e.ground || 0)} m`); fact(dl, 'Eye height', `${e.eye} m`); if (e.facing != null) fact(dl, 'Faces', bearingName(e.facing)); fact(dl, 'Can see', `${e.seen.length} landmarks, summits and towns`); }
    if (it.type === 'beach') { fact(dl, 'Length', `${e.len} km`); fact(dl, 'Sand', e.sand); }
    if (it.type === 'lake') { fact(dl, 'Type', e.type); if (e.level != null) fact(dl, 'Surface', `${e.level} m`); fact(dl, 'Area', `${e.area} km²`); fact(dl, 'Deepest', `${e.depth} m`); }
    if (it.type === 'forest') { fact(dl, 'Cover', (W.cover.find((c) => c.key === e.cover) || {}).name); fact(dl, 'Extent', `about ${(Math.PI * e.rx * e.ry).toFixed(1)} km²`); }
    if (it.type === 'mountain') { fact(dl, 'Elevation', `${fmt(e.z)} m`); fact(dl, 'Relief within 3 km', `${fmt(e.relief)} m`); fact(dl, 'Form', e.kind); }
    if (it.type === 'district') { fact(dl, 'Form', e.form); if (e.bldg && e.bldg[1]) fact(dl, 'Buildings', `${e.bldg[0]}–${e.bldg[1]} m`); }
    fact(dl, 'Grid', `${it.at[0].toFixed(1)} E · ${it.at[1].toFixed(1)} N`);
    const acts = document.createElement('div'); acts.className = 'actions';
    const go = document.createElement('button'); go.className = 'btn'; go.textContent = it.type === 'viewpoint' ? 'Stand here in 3D' : 'See it in 3D';
    go.onclick = () => roamToItem(it);
    const ctr = document.createElement('button'); ctr.className = 'btn ghost'; ctr.textContent = 'Center map';
    ctr.onclick = () => centerOn(it.at[0], it.at[1], Math.max(A.s, 24));
    acts.append(go, ctr);
    card.append(back, kick, h2, where, dl, acts);
    for (const [t, k] of [['Description', 'desc'], ['Geographic reason', 'why'], ['Visual identity', 'look'], ['Nearby', 'near'], ['Why it stays with you', 'memorable']]) { const s = section(t, e[k]); if (s) card.append(s); }
    if (it.type === 'viewpoint' && e.seen.length) {
      const h = document.createElement('h3'); h.textContent = 'Visible from here';
      const p = document.createElement('p'); p.className = 'seen';
      p.textContent = e.seen.slice(0, 18).map((s) => `${s.name} (${s.dist} km)`).join(' · ') + (e.seen.length > 18 ? ` · and ${e.seen.length - 18} more` : '');
      card.append(h, p);
    }
    card.scrollTop = 0;
    if (recenter) centerOn(it.at[0], it.at[1], Math.max(A.s, it.type === 'town' && it.e.pop > 100000 ? 14 : 24));
    else redraw();
  }
  function showSpot(x, y) {
    const isl = islandAt(x, y), s = surfaceAt(x, y);
    A.sel = { at: [x, y] };
    panel.classList.add('detail');
    card.innerHTML = '';
    const back = document.createElement('button'); back.className = 'back'; back.textContent = '← All places';
    back.onclick = () => { panel.classList.remove('detail'); A.sel = null; redraw(); };
    const h2 = document.createElement('h2'); h2.textContent = isl ? isl.name : 'Open water';
    const where = document.createElement('div'); where.className = 'where'; where.textContent = locate(x, y);
    const dl = document.createElement('dl'); dl.className = 'facts';
    const i = idxAt(x, y);
    fact(dl, s.water ? 'Water depth' : 'Elevation', s.water ? `${fmt(s.depth)} m` : `${fmt(s.z)} m`);
    if (i >= 0 && !WT[i]) fact(dl, 'Land cover', W.cover[COV[i]].name);
    fact(dl, 'Grid', `${x.toFixed(2)} E · ${y.toFixed(2)} N`);
    const acts = document.createElement('div'); acts.className = 'actions';
    const go = document.createElement('button'); go.className = 'btn'; go.textContent = 'Fly here in 3D';
    go.onclick = () => enterRoam({ x, y, alt: Math.max(s.z, 0) + 250, yaw: 0, pitch: -0.25, move: 'fly' });
    acts.append(go);
    card.append(back, h2, where, dl, acts);
    redraw();
  }

  // ================================================================ ROAM
  let R = null;
  const state = { mode: 'atlas' };

  function mulberry(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const hash2 = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const sx = (x) => (x - CX) * 1000, sz = (y) => (CY - y) * 1000;
  const kx = (X) => X / 1000 + CX, ky = (Z) => CY - Z / 1000;

  function detailTexture() {
    const N = 256, cv = document.createElement('canvas'); cv.width = cv.height = N;
    const ctx = cv.getContext('2d'), img = ctx.createImageData(N, N);
    const rnd = mulberry(7);
    const octs = [8, 16, 32, 64, 128].map((L) => ({ L, g: Array.from({ length: L * L }, rnd) }));
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      let v = 0, amp = 0.5, tot = 0;
      for (const { L, g } of octs) {
        const fx = (x / N) * L, fy = (y / N) * L, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
        const s = (t) => t * t * (3 - 2 * t);
        const a = g[(iy % L) * L + (ix % L)], b = g[(iy % L) * L + ((ix + 1) % L)], c = g[((iy + 1) % L) * L + (ix % L)], d = g[((iy + 1) % L) * L + ((ix + 1) % L)];
        v += amp * lerp(lerp(a, b, s(tx)), lerp(c, d, s(tx)), s(ty)); tot += amp; amp *= 0.62;
      }
      const g8 = clamp(Math.round((0.7 + 0.3 * (v / tot)) * 255), 0, 255), o = (y * N + x) * 4;
      img.data[o] = img.data[o + 1] = img.data[o + 2] = g8; img.data[o + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }

  function initRoam() {
    const canvas = $('#gl');
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: !coarse, logarithmicDepthBuffer: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, coarse ? 1.25 : 1.5));
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(62, 1, 0.5, 140000);
    camera.rotation.order = 'YXZ';
    scene.fog = new THREE.Fog(0xb8c8d0, 3000, 45000);
    const hemi = new THREE.HemisphereLight(0xd7e6ff, 0x4f5a3c, 0.55);
    const sun = new THREE.DirectionalLight(0xffffff, 1);
    scene.add(hemi, sun, sun.target);
    const detail = detailTexture();
    detail.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const terrainMat = new THREE.MeshLambertMaterial({ vertexColors: true, map: detail });
    const waterMat = new THREE.MeshPhongMaterial({ color: 0x2a6c8a, specular: 0x8fb6c8, shininess: 70, transparent: true, opacity: 0.74 });
    const lakeMat = new THREE.MeshPhongMaterial({ color: 0x2c5b66, specular: 0x6f9aa8, shininess: 60, transparent: true, opacity: 0.86 });
    const skyTint = { value: new THREE.Color(0xc5dbe9) };
    // Fresnel: water reflects the horizon at grazing angles.
    for (const m of [waterMat, lakeMat]) {
      m.onBeforeCompile = (sh) => {
        sh.uniforms.skyTint = skyTint;
        sh.fragmentShader = 'uniform vec3 skyTint;\n' + sh.fragmentShader.replace('#include <fog_fragment>', `
          float fres = pow(1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0), 4.0);
          gl_FragColor.rgb = mix(gl_FragColor.rgb, skyTint, fres * 0.8);
          gl_FragColor.a = mix(gl_FragColor.a, 1.0, fres);
          #include <fog_fragment>`);
      };
    }
    R = {
      renderer, scene, camera, hemi, sun, terrainMat, waterMat, lakeMat, chunks: new Map(),
      skyTint, pos: new THREE.Vector3(), yaw: 0, pitch: -0.15, move: 'fly', speed: 0, cruise: null,
      time: 16.5, keys: new Set(), stick: { x: 0, y: 0 }, up: 0, down: 0, clock: performance.now(), hudT: 0, lblT: 0, treeAt: null,
    };
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(300000, 300000, 60, 60), waterMat);
    sea.rotation.x = -Math.PI / 2; sea.renderOrder = 1;
    scene.add(sea);
    R.sea = sea;
    buildSky();
    buildRoads();
    buildDams();
    buildRunways();
    buildBuildings();
    buildLandmarks();
    buildFerries();
    initTrees();
    initControls();
    setTime(R.time);
    const vp = $('#vpsel');
    const groups = {};
    for (const v of W.viewpoints) (groups[v.island] ||= []).push(v);
    vp.innerHTML = '<option value="">Viewpoint…</option>';
    for (const [isl, vs] of Object.entries(groups)) {
      const og = document.createElement('optgroup'); og.label = islandName(isl);
      for (const v of vs) { const o = document.createElement('option'); o.value = v.id; o.textContent = v.name; og.appendChild(o); }
      vp.appendChild(og);
    }
    vp.onchange = () => { const v = W.viewpoints.find((q) => q.id === vp.value); if (v) roamToViewpoint(v); vp.blur(); };
    const mm = $('#minimap'), mctx2 = mm.getContext('2d');
    R.mini = { cv: mm, ctx: mctx2 };
    requestAnimationFrame(loop);
  }

  // ------------------------------------------------------------ sky & time
  function buildSky() {
    const geo = new THREE.SphereGeometry(100000, 32, 16);
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 3), 3));
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false });
    const sky = new THREE.Mesh(geo, mat);
    sky.renderOrder = -1;
    R.scene.add(sky);
    R.sky = sky;
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const c = cv.getContext('2d'), gr = c.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,240,1)'); gr.addColorStop(0.18, 'rgba(255,245,210,0.95)'); gr.addColorStop(0.4, 'rgba(255,220,160,0.25)'); gr.addColorStop(1, 'rgba(255,200,140,0)');
    c.fillStyle = gr; c.fillRect(0, 0, 128, 128);
    const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), fog: false, depthWrite: false, transparent: true }));
    sunSprite.scale.set(9000, 9000, 1);
    R.scene.add(sunSprite);
    R.sunSprite = sunSprite;
  }
  const C3 = (hex) => new THREE.Color(hex);
  const PAL = {
    night: { zen: C3(0x060a17), hor: C3(0x18233a), light: C3(0x8aa2d8), ground: C3(0x101418) },
    dusk: { zen: C3(0x34497a), hor: C3(0xf0a062), light: C3(0xffb070), ground: C3(0x3b3328) },
    day: { zen: C3(0x3b78c6), hor: C3(0xc5dbe9), light: C3(0xfff4e2), ground: C3(0x5b6648) },
  };
  function mixPal(a, b, t) { const o = {}; for (const k of ['zen', 'hor', 'light', 'ground']) o[k] = a[k].clone().lerp(b[k], t); return o; }
  function setTime(t) {
    R.time = ((t % 24) + 24) % 24;
    const el = Math.sin(((R.time - 6) / 12) * Math.PI) * (62 * Math.PI / 180);
    const az = ((90 + ((R.time - 6) / 12) * 180) * Math.PI) / 180;
    const dir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
    R.sunDir = dir;
    const e = Math.sin(el);
    const p = e < -0.12 ? PAL.night : e < 0 ? mixPal(PAL.night, PAL.dusk, (e + 0.12) / 0.12) : e < 0.25 ? mixPal(PAL.dusk, PAL.day, e / 0.25) : PAL.day;
    R.pal = p;
    R.sun.color.copy(p.light);
    R.sun.intensity = e > -0.05 ? clamp(e * 2.4 + 0.15, 0, 1.05) : 0.12;
    if (e <= -0.05) R.sun.position.set(0.3, 1, 0.2); // moonlight from high up
    R.hemi.color.copy(p.zen).lerp(C3(0xffffff), 0.45);
    R.hemi.groundColor.copy(p.ground);
    R.hemi.intensity = 0.28 + 0.42 * clamp(e + 0.15, 0, 1);
    R.scene.fog.color.copy(p.hor);
    R.skyTint.value.copy(p.hor).lerp(p.zen, 0.25);
    R.renderer.setClearColor(p.hor);
    const pos = R.sky.geometry.attributes.position, col = R.sky.geometry.attributes.color, v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).normalize();
      const up = Math.max(0, v.y);
      const c = p.hor.clone().lerp(p.zen, Math.pow(up, 0.55));
      if (v.y < 0) c.copy(p.hor).multiplyScalar(0.92);
      const s = Math.max(0, v.dot(dir));
      if (e > -0.1) c.lerp(C3(0xffe6b8), Math.pow(s, 24) * 0.7 * clamp(1 - e * 1.5, 0.25, 1));
      col.setXYZ(i, c.r, c.g, c.b);
    }
    col.needsUpdate = true;
    R.sunSprite.visible = e > -0.03;
    R.sunSprite.material.color.copy(p.light);
    if (R.lights) R.lights.visible = e < 0.06;
    if (R.redLights) R.redLights.visible = e < 0.15;
    const hh = Math.floor(R.time), mm = Math.floor((R.time - hh) * 60);
    $('#clocktxt').textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    $('#clock').value = String(R.time);
  }

  // ------------------------------------------------------------ terrain chunks
  const CH = 128;
  let NCX = 0, NCY = 0;
  let TERRAIN_COL = null;
  function terrainColors() {
    const pal = W.cover.map((c) => c.color.map((v) => Math.min(1, (v / 255) * 1.12)));
    TERRAIN_COL = pal;
  }
  function colorAt(i, out) {
    const w = WT[i], h = H[i];
    if (w === 1 || (w === 0 && ISL[i] === 0)) {
      const t = clamp(-h / 14, 0, 1);
      out[0] = lerp(0.62, 0.12, t); out[1] = lerp(0.56, 0.2, t); out[2] = lerp(0.38, 0.17, t);
      return;
    }
    if (w >= 2) { out[0] = 0.18; out[1] = 0.17; out[2] = 0.11; return; }
    const c = TERRAIN_COL[COV[i]] || TERRAIN_COL[17];
    const n = 0.9 + 0.2 * hash2(i % nx, (i / nx) | 0);
    out[0] = c[0] * n; out[1] = c[1] * n; out[2] = c[2] * n;
  }
  function buildChunk(cx, cy, s) {
    const n = CH / s, vn = n + 1, c0 = cx * CH, r0 = cy * CH;
    const main = vn * vn, total = main + 4 * vn;
    const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), col = new Float32Array(total * 3), uv = new Float32Array(total * 2);
    const tmp = [0, 0, 0];
    const at = (c, r) => clamp(r, 0, ny - 1) * nx + clamp(c, 0, nx - 1);
    for (let j = 0; j < vn; j++) for (let i = 0; i < vn; i++) {
      const c = Math.min(c0 + i * s, nx - 1), r = Math.min(r0 + j * s, ny - 1), k = j * vn + i, id = r * nx + c;
      const X = sx(cx2x(c)), Z = sz(cr2y(r));
      pos[k * 3] = X; pos[k * 3 + 1] = H[id]; pos[k * 3 + 2] = Z;
      const d = Math.max(1, s), hx = (H[at(c + d, r)] - H[at(c - d, r)]) / (2 * d * 50), hz = (H[at(c, r + d)] - H[at(c, r - d)]) / (2 * d * 50);
      const l = Math.hypot(hx, 1, hz);
      nor[k * 3] = -hx / l; nor[k * 3 + 1] = 1 / l; nor[k * 3 + 2] = -hz / l;
      colorAt(id, tmp);
      col[k * 3] = tmp[0]; col[k * 3 + 1] = tmp[1]; col[k * 3 + 2] = tmp[2];
      uv[k * 2] = X / 22; uv[k * 2 + 1] = Z / 22;
    }
    // Skirts hide cracks between neighbouring chunks at different detail.
    const edges = [[...Array(vn).keys()].map((i) => i), [...Array(vn).keys()].map((i) => n * vn + i), [...Array(vn).keys()].map((j) => j * vn), [...Array(vn).keys()].map((j) => j * vn + n)];
    const drop = 15 + s * 18;
    let k = main;
    const skirt = [];
    for (const e of edges) {
      const start = k;
      for (const src of e) {
        pos[k * 3] = pos[src * 3]; pos[k * 3 + 1] = pos[src * 3 + 1] - drop; pos[k * 3 + 2] = pos[src * 3 + 2];
        for (let q = 0; q < 3; q++) { nor[k * 3 + q] = nor[src * 3 + q]; col[k * 3 + q] = col[src * 3 + q]; }
        uv[k * 2] = uv[src * 2]; uv[k * 2 + 1] = uv[src * 2 + 1];
        k++;
      }
      skirt.push([e, start]);
    }
    const idx = new Uint16Array(n * n * 6 + 4 * n * 6);
    let q = 0;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const a = j * vn + i, b = a + 1, c = a + vn, d = c + 1;
      idx[q++] = a; idx[q++] = c; idx[q++] = b; idx[q++] = b; idx[q++] = c; idx[q++] = d;
    }
    for (const [e, start] of skirt) for (let m = 0; m < n; m++) {
      const a = e[m], b = e[m + 1], c = start + m, d = start + m + 1;
      idx[q++] = a; idx[q++] = b; idx[q++] = c; idx[q++] = b; idx[q++] = d; idx[q++] = c;
      idx[q++] = a; idx[q++] = c; idx[q++] = b; idx[q++] = b; idx[q++] = c; idx[q++] = d;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(new THREE.BufferAttribute(idx.subarray(0, q), 1));
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, R.terrainMat);
    // Lakes and rivers: quads at the water surface.
    const wv = [], wi = [];
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const c = Math.min(c0 + i * s + (s >> 1), nx - 1), r = Math.min(r0 + j * s + (s >> 1), ny - 1), id = r * nx + c;
      if (WT[id] < 2) continue;
      const y = SURF[id] + 0.15, b = wv.length / 3;
      const xa = sx(cx2x(Math.min(c0 + i * s, nx - 1))), xb = sx(cx2x(Math.min(c0 + (i + 1) * s, nx - 1)));
      const za = sz(cr2y(Math.min(r0 + j * s, ny - 1))), zb = sz(cr2y(Math.min(r0 + (j + 1) * s, ny - 1)));
      wv.push(xa - 12, y, za - 12, xb + 12, y, za - 12, xa - 12, y, zb + 12, xb + 12, y, zb + 12);
      wi.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
    }
    let water = null;
    if (wv.length) {
      const wg = new THREE.BufferGeometry();
      wg.setAttribute('position', new THREE.Float32BufferAttribute(wv, 3));
      wg.setIndex(wi); wg.computeVertexNormals(); wg.computeBoundingSphere();
      water = new THREE.Mesh(wg, R.lakeMat);
      water.renderOrder = 1;
    }
    return { mesh, water };
  }
  function updateChunks(maxBuilds) {
    const px = kx(R.pos.x), py = ky(R.pos.z), alt = Math.max(0, R.pos.y - Math.max(0, hAt(px, py)));
    const view = clamp(32 + (alt / 1000) * 14, 32, 95);
    const wanted = [];
    for (let cy = 0; cy < NCY; cy++) for (let cx = 0; cx < NCX; cx++) {
      const ax = x0 + cx * CH * cell, bx = ax + CH * cell, by = y1 - cy * CH * cell, ay = by - CH * cell;
      const dx = Math.max(ax - px, 0, px - bx), dy = Math.max(ay - py, 0, py - by);
      const d = Math.hypot(dx, dy, (alt / 1000) * 0.6);
      const key = `${cx},${cy}`, cur = R.chunks.get(key);
      if (d > view) { if (cur) { R.scene.remove(cur.mesh); cur.mesh.geometry.dispose(); if (cur.water) { R.scene.remove(cur.water); cur.water.geometry.dispose(); } R.chunks.delete(key); } continue; }
      const lod = d < 2.2 ? 1 : d < 6 ? 2 : d < 13 ? 4 : d < 26 ? 8 : 16;
      if (!cur || cur.lod !== lod) wanted.push({ cx, cy, lod, d, key, cur });
    }
    wanted.sort((a, b) => a.d - b.d);
    for (const w of wanted.slice(0, maxBuilds)) {
      const { mesh, water } = buildChunk(w.cx, w.cy, w.lod);
      if (w.cur) { R.scene.remove(w.cur.mesh); w.cur.mesh.geometry.dispose(); if (w.cur.water) { R.scene.remove(w.cur.water); w.cur.water.geometry.dispose(); } }
      R.scene.add(mesh); if (water) R.scene.add(water);
      R.chunks.set(w.key, { mesh, water, lod: w.lod });
    }
    R.scene.fog.far = view * 1000 * 0.95; R.scene.fog.near = Math.min(4000, view * 200);
    return wanted.length;
  }

  // ------------------------------------------------------------ roads & rails
  const ROAD_W = { interstate: 26, highway: 18, state: 9, parkway: 8, arterial: 15, county: 7 };
  const ROAD_COL = { interstate: 0x3b3d40, highway: 0x404244, state: 0x47484a, parkway: 0x4a4944, arterial: 0x434446, county: 0x55534e };
  let ROAD_SEGS = []; // for driving: [ax, ay, az, bx, by, bz, half-width, roadIndex, segIndex]
  const segGrid = new Map();
  function structureFlags(route) {
    const P = route.pts, flags = new Uint8Array(P.length); // 1 bridge/viaduct, 2 tunnel
    for (const sg of route.segs || []) {
      if (!sg.a || !sg.b) continue;
      const near = (q) => { let bi = 0, bd = Infinity; P.forEach((p, i) => { const d = Math.hypot(p[0] - q[0], p[1] - q[1]); if (d < bd) { bd = d; bi = i; } }); return bi; };
      let ia = near(sg.a), ib = near(sg.b);
      if (ia > ib) [ia, ib] = [ib, ia];
      for (let i = ia; i <= ib; i++) flags[i] = sg.kind === 'tunnel' ? 2 : 1;
    }
    P.forEach((p, i) => { if (p[3] && flags[i] !== 2) flags[i] = 1; });
    return flags;
  }
  function buildRoads() {
    const surf = { p: [], c: [], i: [] }, lines = { p: [], c: [], i: [] }, sides = { p: [], c: [], i: [] };
    const piers = [];
    const tc = new THREE.Color();
    const addRibbon = (P, flags, width, lift, color, target, opts = {}) => {
      let strip = null;
      for (let k = 0; k < P.length; k++) {
        if (flags && flags[k] === 2) { strip = null; continue; }
        const a = P[Math.max(0, k - 1)], b = P[Math.min(P.length - 1, k + 1)];
        let dx = sx(b[0]) - sx(a[0]), dz = sz(b[1]) - sz(a[1]);
        const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
        const nx2 = -dz, nz2 = dx, X = sx(P[k][0]), Z = sz(P[k][1]), Y = P[k][2] + lift + (opts.dy || 0);
        const base = target.p.length / 3;
        target.p.push(X + nx2 * width / 2, Y, Z + nz2 * width / 2, X - nx2 * width / 2, Y, Z - nz2 * width / 2);
        tc.set(color); target.c.push(tc.r, tc.g, tc.b, tc.r, tc.g, tc.b);
        if (strip != null) target.i.push(strip, base, strip + 1, strip + 1, base, base + 1);
        strip = base;
        if (opts.structure && flags && flags[k] === 1 && k > 0 && flags[k - 1] === 1) {
          // deck edges: concrete faces 2.5 m deep on both sides
          for (const side of [1, -1]) {
            const s0 = sides.p.length / 3, pa = P[k - 1], Xa = sx(pa[0]), Za = sz(pa[1]), Ya = pa[2] + lift;
            const ox = nx2 * side * width / 2, oz = nz2 * side * width / 2;
            sides.p.push(Xa + ox, Ya, Za + oz, X + ox, Y, Z + oz, Xa + ox, Ya - 2.5, Za + oz, X + ox, Y - 2.5, Z + oz);
            for (let q = 0; q < 4; q++) sides.c.push(0.62, 0.61, 0.58);
            sides.i.push(s0, s0 + 2, s0 + 1, s0 + 1, s0 + 2, s0 + 3, s0, s0 + 1, s0 + 2, s0 + 1, s0 + 3, s0 + 2);
          }
          if (k % 2 === 0) {
            const g = hAt(P[k][0], P[k][1]);
            if (Y - 2.5 - g > 3) piers.push([X, g - 2, Z, Y - 2.5, Math.max(2.5, width * 0.18)]);
          }
        }
      }
    };
    W.roads.forEach((r, ri) => {
      const flags = structureFlags(r), w = ROAD_W[r.cls] || 7;
      addRibbon(r.pts, flags, w, 0.9, ROAD_COL[r.cls] || 0x4a4a4a, surf, { structure: true });
      if (['state', 'county', 'parkway'].includes(r.cls)) addRibbon(r.pts, flags, 0.35, 0.95, 0xd8b84a, lines);
      else addRibbon(r.pts, flags, 0.4, 0.95, 0xe8e8e0, lines);
      const P = r.pts;
      for (let k = 1; k < P.length; k++) {
        if (flags[k] === 2 || flags[k - 1] === 2) continue;
        const seg = [P[k - 1][0], P[k - 1][1], P[k - 1][2] + 0.9, P[k][0], P[k][1], P[k][2] + 0.9, w / 2000 + 0.004, ri, k];
        ROAD_SEGS.push(seg);
        const key = `${Math.floor(P[k][0])},${Math.floor(P[k][1])}`;
        if (!segGrid.has(key)) segGrid.set(key, []);
        segGrid.get(key).push(seg);
        const key2 = `${Math.floor(P[k - 1][0])},${Math.floor(P[k - 1][1])}`;
        if (key2 !== key) { if (!segGrid.has(key2)) segGrid.set(key2, []); segGrid.get(key2).push(seg); }
      }
    });
    for (const r of W.rails) {
      const dead = r.status === 'abandoned';
      const flags = structureFlags(r);
      addRibbon(r.pts, flags, dead ? 3 : 4.2, dead ? 0.4 : 0.8, dead ? 0x6b6450 : 0x5a5048, surf, { structure: !dead });
      if (!dead) { addRibbon(r.pts, flags, 1.6, 0.86, 0x2c2a2a, lines); }
    }
    const mk = (t) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(t.p, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(t.c, 3)); g.setIndex(t.i); g.computeVertexNormals(); return g; };
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    const roads = new THREE.Mesh(mk(surf), mat); roads.renderOrder = 2;
    const marks = new THREE.Mesh(mk(lines), new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })); marks.renderOrder = 3;
    const deck = new THREE.Mesh(mk(sides), mat);
    R.scene.add(roads, marks, deck);
    const pm = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0x9a978f }), piers.length);
    const m4 = new THREE.Matrix4();
    piers.forEach(([X, g, Z, top, w], i) => { const h = top - g; m4.makeScale(w, h, w); m4.setPosition(X, g + h / 2, Z); pm.setMatrixAt(i, m4); });
    R.scene.add(pm);
    // Gate Bridge: suspension towers and main cables.
    const gb = W.bridges.find((b) => b.name === 'Gate Bridge');
    if (gb) {
      const r = W.roads.find((q) => q.id === gb.route);
      const wet = r.pts.map((p, i) => [p, i]).filter(([p]) => p[3]);
      if (wet.length > 2) {
        const a = wet[0][0], b = wet[wet.length - 1][0], deckY = (a[2] + b[2]) / 2;
        const tm = new THREE.MeshLambertMaterial({ color: 0x8c8f93 });
        const tops = [];
        for (const p of [a, b]) {
          const X = sx(p[0]), Z = sz(p[1]), g = hAt(p[0], p[1]), top = deckY + 110;
          for (const side of [-1, 1]) {
            const dir = new THREE.Vector2(sx(b[0]) - sx(a[0]), sz(b[1]) - sz(a[1])).normalize();
            const ox = -dir.y * side * 7, oz = dir.x * side * 7;
            const leg = new THREE.Mesh(new THREE.BoxGeometry(4, top - g, 4), tm);
            leg.position.set(X + ox, (top + g) / 2, Z + oz); R.scene.add(leg);
            tops.push([X + ox, top, Z + oz, side]);
          }
          const beam = new THREE.Mesh(new THREE.BoxGeometry(18, 5, 5), tm);
          beam.position.set(X, top - 3, Z); beam.lookAt(sx(b[0]), top - 3, sz(b[1])); beam.rotateY(Math.PI / 2); R.scene.add(beam);
        }
        for (const side of [-1, 1]) {
          const [p0, p1] = tops.filter((t) => t[3] === side);
          const pts = [];
          for (let t = 0; t <= 1.0001; t += 0.05) pts.push(new THREE.Vector3(lerp(p0[0], p1[0], t), lerp(p0[1], p1[1], t) - 100 * 4 * t * (1 - t), lerp(p0[2], p1[2], t)));
          R.scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x5f6266 })));
        }
      }
    }
  }
  function roadAt(x, y) {
    let best = null, bd = Infinity;
    const cx0 = Math.floor(x), cy0 = Math.floor(y);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const s of segGrid.get(`${cx0 + a},${cy0 + b}`) || []) {
      const dx = s[3] - s[0], dy = s[4] - s[1], l2 = dx * dx + dy * dy || 1e-9;
      const t = clamp(((x - s[0]) * dx + (y - s[1]) * dy) / l2, 0, 1);
      const d = Math.hypot(x - (s[0] + dx * t), y - (s[1] + dy * t));
      if (d < bd) { bd = d; best = { seg: s, t, d, z: lerp(s[2], s[5], t) }; }
    }
    return best;
  }

  // ------------------------------------------------------------ dams, runways
  function buildDams() {
    const mat = new THREE.MeshLambertMaterial({ color: 0xb9b6ad });
    for (const lk of W.lakes) {
      if (!lk.dam || lk.crest == null) continue;
      const [a, b] = lk.dam;
      let low = Infinity;
      for (let t = 0; t <= 1; t += 0.02) for (const o of [-0.08, 0.08]) {
        const x = lerp(a[0], b[0], t), y = lerp(a[1], b[1], t), dx = b[1] - a[1], dy = -(b[0] - a[0]), l = Math.hypot(dx, dy);
        low = Math.min(low, hAt(x + (dx / l) * o, y + (dy / l) * o));
      }
      const L = Math.hypot(sx(b[0]) - sx(a[0]), sz(b[1]) - sz(a[1])), hgt = lk.crest - low;
      const m = new THREE.Mesh(new THREE.BoxGeometry(L, hgt, 22), mat);
      m.position.set(sx((a[0] + b[0]) / 2), low + hgt / 2, sz((a[1] + b[1]) / 2));
      m.rotation.y = -Math.atan2(sz(b[1]) - sz(a[1]), sx(b[0]) - sx(a[0]));
      R.scene.add(m);
    }
  }
  function buildRunways() {
    const asph = new THREE.MeshLambertMaterial({ color: 0x36383a }), paint = new THREE.MeshBasicMaterial({ color: 0xe8e8e2 });
    for (const ap of W.airports) for (const rw of ap.runways) {
      const [a, b] = [rw.a, rw.b];
      const L = Math.hypot(sx(b[0]) - sx(a[0]), sz(b[1]) - sz(a[1])), w = rw.w * 1000;
      const ang = -Math.atan2(sz(b[1]) - sz(a[1]), sx(b[0]) - sx(a[0]));
      const y = (rw.z ?? hAt((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)) + 0.6;
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(L, w), asph);
      strip.rotation.set(-Math.PI / 2, 0, ang); strip.position.set(sx((a[0] + b[0]) / 2), y, sz((a[1] + b[1]) / 2));
      const line = new THREE.Mesh(new THREE.PlaneGeometry(L * 0.9, 1.2), paint);
      line.rotation.copy(strip.rotation); line.position.copy(strip.position); line.position.y += 0.08;
      R.scene.add(strip, line);
    }
  }

  // ------------------------------------------------------------ buildings
  function buildBuildings() {
    const K = (k) => W.cover.findIndex((c) => c.key === k);
    const T = { [K('urban-core')]: [3, [25, 45], [30, 110], 0xb8b9bd], [K('urban')]: [3, [14, 28], [8, 26], 0xb7a894], [K('suburban')]: [3, [9, 14], [4, 8], 0xd6cfc0], [K('industrial')]: [2, [30, 70], [8, 22], 0xa4a7ab], [K('airport')]: [1, [40, 90], [8, 14], 0xc9c9c4] };
    const rnd = mulberry(1907), step = coarse ? 4 : 3;
    const inst = [];
    for (let r = 0; r < ny; r += step) for (let c = 0; c < nx; c += step) {
      const i = r * nx + c, t = T[COV[i]];
      if (!t || WT[i]) continue;
      const x = cx2x(c), y = cr2y(r);
      let hr = t[2], cov = 1;
      for (const d of W.districts) {
        if (!d.bldg || !d.bldg[1]) continue;
        if (Math.hypot(x - d.at[0], y - d.at[1]) < d.r * 1.15) { hr = [d.bldg[0], d.bldg[1]]; cov = d.bldg[2] * 1.2; break; }
      }
      for (let k = 0; k < t[0]; k++) {
        if (rnd() > cov) continue;
        const bx = x + (rnd() - 0.5) * cell * step * 0.9, by = y + (rnd() - 0.5) * cell * step * 0.9;
        const ii = idxAt(bx, by);
        if (ii < 0 || WT[ii]) continue;
        const fw = lerp(t[1][0], t[1][1], rnd()), fd = fw * lerp(0.6, 1.3, rnd());
        const skew = Math.pow(rnd(), hr[1] > 60 ? 3 : 1.4);
        const hh = lerp(hr[0], hr[1], skew);
        inst.push([sx(bx), H[ii], sz(by), Math.min(fw, hh > 60 ? 45 : fw), hh, Math.min(fd, hh > 60 ? 45 : fd), rnd() * Math.PI, t[3], rnd()]);
      }
    }
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), new THREE.MeshLambertMaterial(), inst.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), col = new THREE.Color();
    const light = [];
    inst.forEach(([X, Y, Z, w, h, d, rot, base, v], i) => {
      q.setFromEuler(e.set(0, rot, 0));
      m4.compose(new THREE.Vector3(X, Y - 1, Z), q, new THREE.Vector3(w, h + 1, d));
      mesh.setMatrixAt(i, m4);
      col.set(base).multiplyScalar(0.82 + 0.3 * v);
      if (h > 60) col.lerp(new THREE.Color(0x7d93a8), 0.45);
      mesh.setColorAt(i, col);
      if (i % 2 === 0) light.push(X, Y + Math.min(h, 30) * 0.6, Z);
    });
    R.scene.add(mesh);
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(light, 3));
    R.lights = new THREE.Points(lg, new THREE.PointsMaterial({ color: 0xffcf86, size: 2.2, sizeAttenuation: false, fog: true }));
    R.scene.add(R.lights);
  }

  // ------------------------------------------------------------ landmarks
  function buildLandmarks() {
    const g = new THREE.Group(), red = [];
    const M = (c) => new THREE.MeshLambertMaterial({ color: c });
    const concrete = M(0xc9c6bd), white = M(0xf2f1ec), steel = M(0x8a8f96), dark = M(0x2a2c30), redm = M(0xc0392b);
    const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
    R.turbines = [];
    for (const l of W.landmarks) {
      const [x, y] = l.at, X = sx(x), Z = sz(y), base = Math.max(0, hAt(x, y)), h = l.h || 0;
      switch (l.kind) {
        case 'tower': {
          add(new THREE.CylinderGeometry(3.5, 5.5, h - 0.3, 10).translate(0, (h - 0.3) / 2, 0), concrete, X, base, Z);
          add(new THREE.CylinderGeometry(3.6, 3.2, 0.6, 16), M(0x8f8c85), X, base + h - 0.3, Z);
          break;
        }
        case 'mast': add(new THREE.CylinderGeometry(1.2, 2.5, h, 6).translate(0, h / 2, 0), redm, X, base, Z); for (let k = 1; k <= 4; k++) red.push(X, base + (h * k) / 4, Z); break;
        case 'skyscraper': {
          add(new THREE.BoxGeometry(48, h * 0.8, 48).translate(0, h * 0.4, 0), M(0x6f8aa3), X, base, Z);
          add(new THREE.BoxGeometry(34, h * 0.12, 34).translate(0, h * 0.86, 0), M(0x7d95ab), X, base, Z);
          add(new THREE.CylinderGeometry(0.6, 2.5, h * 0.12, 6).translate(0, h * 0.98, 0), steel, X, base, Z);
          red.push(X, base + h * 1.04, Z); break;
        }
        case 'radome': add(new THREE.CylinderGeometry(9, 9, 22, 12).translate(0, 11, 0), white, X, base, Z); add(new THREE.SphereGeometry(13, 16, 12), white, X, base + 30, Z); red.push(X, base + 44, Z); break;
        case 'stacks': for (const o of [-45, 45]) { add(new THREE.CylinderGeometry(6, 9, 180, 16).translate(0, 90, 0), concrete, X + o, base, Z); for (const b of [150, 168]) add(new THREE.CylinderGeometry(6.4, 6.6, 9, 16), redm, X + o, base + b, Z); red.push(X + o, base + 182, Z); } break;
        case 'cooling-towers': {
          const pts = []; for (let t = 0; t <= 1.0001; t += 0.1) pts.push(new THREE.Vector2(lerp(62, 40, t) + 14 * Math.pow(t - 0.75, 2) * (t > 0.75 ? 6 : 0) - 10 * Math.sin(t * Math.PI) * 0.0, t * 165));
          const prof = []; for (let t = 0; t <= 1.0001; t += 0.1) { const r0 = 62 - 34 * Math.sin(Math.min(t / 0.78, 1) * Math.PI / 2) + (t > 0.78 ? (t - 0.78) * 40 : 0); prof.push(new THREE.Vector2(r0, t * 165)); }
          for (const o of [-85, 85]) add(new THREE.LatheGeometry(prof, 24), new THREE.MeshLambertMaterial({ color: 0xd9d6cf, side: THREE.DoubleSide }), X + o, base, Z);
          break;
        }
        case 'lighthouse': {
          const checker = l.id === 'cape-merrin-light';
          const n = 8;
          for (let k = 0; k < n; k++) add(new THREE.CylinderGeometry(lerp(6, 4, (k + 1) / n), lerp(6, 4, k / n), h / n, 12).translate(0, h / n / 2, 0), checker ? (k % 2 ? dark : white) : k === n - 1 ? dark : white, X, base + (k * h) / n, Z);
          add(new THREE.CylinderGeometry(3.4, 3.4, 4, 10), M(0xfff3b0), X, base + h + 2, Z); add(new THREE.ConeGeometry(4, 3, 10), dark, X, base + h + 5.5, Z); red.push(X, base + h + 2, Z);
          break;
        }
        case 'wind-farm': {
          const tm = white;
          for (let r = 0; r < 4; r++) for (let c = 0; c < 7; c++) {
            const tx = X + (c - 3) * 700, tz = Z + (r - 1.5) * 800;
            add(new THREE.CylinderGeometry(2, 3, 110, 8).translate(0, 55, 0), tm, tx, 0, tz);
            const hub = new THREE.Group(); hub.position.set(tx, 112, tz);
            for (let b = 0; b < 3; b++) { const bl = new THREE.Mesh(new THREE.BoxGeometry(1.5, 60, 0.6).translate(0, 30, 0), tm); bl.rotation.z = (b * 2 * Math.PI) / 3; hub.add(bl); }
            hub.rotation.y = 0.6; g.add(hub); R.turbines.push(hub); red.push(tx, 115, tz);
          }
          break;
        }
        case 'cranes': for (let k = 0; k < 8; k++) { const cxk = X + (k - 3.5) * 110; add(new THREE.BoxGeometry(14, 60, 3), M(0xe0773a), cxk, base + 30, Z); add(new THREE.BoxGeometry(14, 4, 110), M(0xe0773a), cxk, base + 62, Z - 20); } break;
        case 'crane': add(new THREE.BoxGeometry(6, 90, 6).translate(0, 45, 0), M(0xd9b13a), X - 80, base, Z); add(new THREE.BoxGeometry(6, 90, 6).translate(0, 45, 0), M(0xd9b13a), X + 80, base, Z); add(new THREE.BoxGeometry(170, 10, 10), M(0xd9b13a), X, base + 92, Z); break;
        case 'pylons': for (const o of [-650, 650]) { const ty = Math.max(0, hAt(x, y + o / 1000)); add(new THREE.CylinderGeometry(1.5, 9, h || 150, 4).translate(0, (h || 150) / 2, 0), steel, X, ty, Z - o); red.push(X, ty + (h || 150), Z - o); } break;
        case 'water-tower': add(new THREE.CylinderGeometry(1.5, 1.5, 30, 6).translate(0, 15, 0), steel, X, base, Z); add(new THREE.SphereGeometry(9, 14, 10), M(0xc9a067), X, base + 36, Z); break;
        case 'elevator': for (let k = 0; k < 4; k++) add(new THREE.CylinderGeometry(6, 6, 38, 12).translate(0, 19, 0), concrete, X + (k - 1.5) * 12.5, base, Z); add(new THREE.BoxGeometry(10, 52, 10).translate(0, 26, 0), concrete, X + 30, base, Z); break;
        case 'steeples': for (const [ox, oz] of [[-60, 20], [40, -50], [90, 60]]) { add(new THREE.BoxGeometry(7, 20, 7).translate(0, 10, 0), white, X + ox, base, Z + oz); add(new THREE.ConeGeometry(5, 25, 4).translate(0, 32, 0), white, X + ox, base, Z + oz); } break;
        case 'clock-tower': add(new THREE.BoxGeometry(12, 50, 12).translate(0, 25, 0), M(0xa8a39a), X, base, Z); add(new THREE.ConeGeometry(9, 14, 4).translate(0, 57, 0), M(0x5e6a5c), X, base, Z); break;
        case 'stadium': add(new THREE.CylinderGeometry(120, 110, 32, 28, 1, true).translate(0, 16, 0), new THREE.MeshLambertMaterial({ color: 0xbdbab3, side: THREE.DoubleSide }), X, base, Z); break;
        case 'flare': add(new THREE.CylinderGeometry(1.2, 1.6, 70, 6).translate(0, 35, 0), steel, X, base, Z); add(new THREE.SphereGeometry(4, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffb347 }), X, base + 73, Z); break;
        case 'pier': {
          // deck from the nearest shore out past the landmark point
          let best = null;
          for (let a = 0; a < 16; a++) {
            const ang = (a / 16) * Math.PI * 2;
            for (let d = 0.05; d < 1.2; d += 0.025) { const qx = x + Math.cos(ang) * d, qy = y + Math.sin(ang) * d, qi = idxAt(qx, qy); if (qi >= 0 && !WT[qi] && H[qi] > 0.5) { if (!best || d < best.d) best = { d, ang }; break; } }
          }
          if (best) {
            const len = (best.d + 0.22) * 1000, mx = x + Math.cos(best.ang) * (best.d - 0.22) / 2 / 1, my = y + Math.sin(best.ang) * (best.d - 0.22) / 2;
            const deck = add(new THREE.BoxGeometry(len, 1.2, 8), M(0xb8b2a6), sx(mx), 5.5, sz(my));
            deck.rotation.y = best.ang;
            for (let k = 0; k <= len; k += 24) { const px2 = x + Math.cos(best.ang) * (best.d - k / 1000) - Math.cos(best.ang) * 0.22 + Math.cos(best.ang) * 0.22, py2 = y + Math.sin(best.ang) * (best.d - k / 1000); add(new THREE.BoxGeometry(1, 9, 1), concrete, sx(px2), 1, sz(py2)); }
          }
          break;
        }
        case 'lift-bridge': for (const o of [-45, 45]) add(new THREE.BoxGeometry(10, 70, 10).translate(0, 35, 0), M(0x7a5a4a), X + o, Math.max(0, base), Z); break;
        default: break;
      }
    }
    R.scene.add(g);
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(red, 3));
    R.redLights = new THREE.Points(rg, new THREE.PointsMaterial({ color: 0xff3b2f, size: 3.5, sizeAttenuation: false, fog: false }));
    R.scene.add(R.redLights);
  }

  // ------------------------------------------------------------ ferries
  function buildFerries() {
    R.boats = [];
    const hull = new THREE.MeshLambertMaterial({ color: 0xf0f0ea }), top = new THREE.MeshLambertMaterial({ color: 0x2f4f7a });
    for (const f of W.ferries) {
      const pts = f.pts.map((p) => new THREE.Vector3(sx(p[0]), 0, sz(p[1])));
      let L = 0; const acc = [0]; for (let i = 1; i < pts.length; i++) { L += pts[i].distanceTo(pts[i - 1]); acc.push(L); }
      const big = /vehicle/.test(f.kind) && !/small|free/.test(f.kind);
      const b = new THREE.Group();
      b.add(new THREE.Mesh(new THREE.BoxGeometry(big ? 16 : 10, 6, big ? 80 : 34).translate(0, 2, 0), hull));
      b.add(new THREE.Mesh(new THREE.BoxGeometry(big ? 12 : 7, 5, big ? 26 : 10).translate(0, 7.5, big ? -10 : -4), top));
      R.scene.add(b);
      R.boats.push({ b, pts, acc, L, v: f.knots * 0.514, phase: Math.random() * L * 2 });
    }
  }
  function moveBoats(t) {
    for (const bt of R.boats) {
      const s = (bt.phase + t * bt.v) % (2 * bt.L), d = s < bt.L ? s : 2 * bt.L - s;
      let i = 1; while (i < bt.acc.length - 1 && bt.acc[i] < d) i++;
      const a = bt.pts[i - 1], b = bt.pts[i], u = (d - bt.acc[i - 1]) / (bt.acc[i] - bt.acc[i - 1] || 1);
      bt.b.position.set(lerp(a.x, b.x, u), 0, lerp(a.z, b.z, u));
      bt.b.rotation.y = Math.atan2(b.x - a.x, b.z - a.z) + (s < bt.L ? 0 : Math.PI);
    }
  }

  // ------------------------------------------------------------ trees
  const TREE = {
    'spruce-fir': ['c', 0.9, 7, 14, 0x1d3326], 'northern-hardwood': ['b', 0.8, 12, 20, 0x56703c], 'cove-hardwood': ['b', 0.95, 18, 30, 0x3e6131],
    'oak-hickory': ['b', 0.8, 12, 22, 0x5b713a], 'mixed-forest': ['m', 0.85, 12, 24, 0x4c6a37], longleaf: ['c', 0.3, 18, 26, 0x587540],
    flatwoods: ['c', 0.5, 14, 22, 0x4d6c3a], 'pine-plantation': ['c', 0.85, 10, 18, 0x3d5c31], 'maritime-forest': ['b', 0.75, 8, 14, 0x4c6236],
    bottomland: ['b', 0.85, 18, 26, 0x48693a], 'cypress-swamp': ['b', 0.7, 16, 26, 0x55683a], 'bay-forest': ['b', 0.8, 6, 12, 0x3b5634],
    scrub: ['b', 0.5, 2, 5, 0x77774c], mangrove: ['b', 0.8, 3, 6, 0x355a35], 'heath-bald': ['b', 0.4, 1.5, 3, 0x6c6548], orchard: ['b', 0.45, 4, 6, 0x5c7a3a],
    park: ['b', 0.25, 10, 18, 0x507b3d], suburban: ['b', 0.1, 8, 14, 0x507b3d], pasture: ['b', 0.02, 10, 16, 0x507b3d], 'grassy-bald': ['b', 0.02, 4, 8, 0x5b6a3e],
  };
  let TREE_BY_COV = [];
  const CLEAR = new Set();
  function initTrees() {
    TREE_BY_COV = W.cover.map((c) => TREE[c.key] || null);
    // Clearings around viewpoints and landmarks.
    for (const p of [...W.viewpoints, ...W.landmarks]) {
      const cx0 = Math.round(p.at[0] / 0.05), cy0 = Math.round(p.at[1] / 0.05);
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) CLEAR.add(`${cx0 + a},${cy0 + b}`);
    }
    const mat = new THREE.MeshLambertMaterial();
    const cone = new THREE.ConeGeometry(1, 1, 6).translate(0, 0.5, 0), blob = new THREE.IcosahedronGeometry(1, 0);
    const CAP = coarse ? 9000 : 18000;
    R.cones = new THREE.InstancedMesh(cone, mat, CAP); R.blobs = new THREE.InstancedMesh(blob, mat, CAP);
    R.cones.count = 0; R.blobs.count = 0;
    R.cones.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CAP * 3), 3);
    R.blobs.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(CAP * 3), 3);
    R.trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 5).translate(0, 0.5, 0), new THREE.MeshLambertMaterial({ color: 0x4a3b2c }), CAP * 2);
    R.trunks.count = 0;
    R.cones.frustumCulled = false; R.blobs.frustumCulled = false; R.trunks.frustumCulled = false;
    R.treeCap = CAP;
    R.scene.add(R.cones, R.blobs, R.trunks);
  }
  function placeTrees(px, py) {
    const RAD = coarse ? 0.9 : 1.3, STEP = 0.02;
    const m4 = new THREE.Matrix4(), col = new THREE.Color();
    let nc = 0, nb = 0, nt = 0;
    const gx0 = Math.floor((px - RAD) / STEP), gx1 = Math.ceil((px + RAD) / STEP), gy0 = Math.floor((py - RAD) / STEP), gy1 = Math.ceil((py + RAD) / STEP);
    for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) {
      const r1 = hash2(gx, gy), r2 = hash2(gy + 17, gx - 9), r3 = hash2(gx * 3 + 1, gy * 7 - 2);
      const x = (gx + r1) * STEP, y = (gy + r2) * STEP;
      if ((x - px) ** 2 + (y - py) ** 2 > RAD * RAD) continue;
      const i = idxAt(x, y);
      if (i < 0 || WT[i]) continue;
      const t = TREE_BY_COV[COV[i]];
      if (!t || r3 > t[1]) continue;
      const rd = roadAt(x, y);
      if (rd && rd.d < 0.012) continue;
      if (CLEAR.has(`${Math.round(x / 0.05)},${Math.round(y / 0.05)}`)) continue;
      const hh = lerp(t[2], t[3], hash2(gx - 5, gy + 3)), g = hAt(x, y);
      let kind = t[0];
      if (kind === 'm') kind = r1 > 0.5 ? 'c' : 'b';
      col.set(t[4]).multiplyScalar(0.8 + 0.4 * r2);
      if (kind === 'c' && nc < R.treeCap) {
        const rr = hh * (t[0] === 'c' && COV[i] === TREE_BY_COV.indexOf(TREE.longleaf) ? 0.16 : 0.24);
        m4.makeScale(rr, hh * 0.85, rr); m4.setPosition(sx(x), g + hh * 0.15, sz(y));
        R.cones.setMatrixAt(nc, m4); R.cones.setColorAt(nc, col); nc++;
        m4.makeScale(rr * 0.12, hh * 0.25, rr * 0.12); m4.setPosition(sx(x), g - 0.3, sz(y)); R.trunks.setMatrixAt(nt++, m4);
      } else if (kind === 'b' && nb < R.treeCap) {
        const rr = hh * 0.36;
        m4.makeScale(rr, rr * 1.05, rr); m4.setPosition(sx(x), g + hh - rr, sz(y));
        R.blobs.setMatrixAt(nb, m4); R.blobs.setColorAt(nb, col); nb++;
        m4.makeScale(Math.max(0.15, rr * 0.09), hh - rr * 1.2, Math.max(0.15, rr * 0.09)); m4.setPosition(sx(x), g - 0.3, sz(y)); R.trunks.setMatrixAt(nt++, m4);
      }
    }
    R.cones.count = nc; R.blobs.count = nb; R.trunks.count = nt;
    R.cones.instanceMatrix.needsUpdate = true; R.blobs.instanceMatrix.needsUpdate = true; R.trunks.instanceMatrix.needsUpdate = true;
    R.cones.instanceColor.needsUpdate = true; R.blobs.instanceColor.needsUpdate = true;
  }

  // ------------------------------------------------------------ controls
  function initControls() {
    const cv = $('#gl');
    let look = null;
    cv.addEventListener('pointerdown', (ev) => {
      if (ev.pointerType === 'touch' && ev.clientX < innerWidth * 0.4 && ev.clientY > innerHeight * 0.5) return;
      cv.setPointerCapture(ev.pointerId);
      look = { id: ev.pointerId, x: ev.clientX, y: ev.clientY };
    });
    cv.addEventListener('pointermove', (ev) => {
      if (!look || ev.pointerId !== look.id) return;
      const k = ev.pointerType === 'touch' ? 0.006 : 0.0042;
      R.yaw += (ev.clientX - look.x) * k; R.pitch = clamp(R.pitch - (ev.clientY - look.y) * k, -1.45, 1.35);
      look.x = ev.clientX; look.y = ev.clientY;
    });
    const end = (ev) => { if (look && ev.pointerId === look.id) look = null; };
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
    addEventListener('keydown', (ev) => {
      if (state.mode !== 'roam' || ev.target.tagName === 'INPUT' || ev.target.tagName === 'SELECT') return;
      const k = ev.key.toLowerCase();
      R.keys.add(k);
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k) && R.cruise) stopCruise();
      if (k === '1') setMove('fly'); if (k === '2') setMove('drive'); if (k === '3') setMove('walk');
      if (k === 'c') toggleCruise();
      if (k === 'm') setMode('atlas');
      if (k === '[') setTime(R.time - 0.5); if (k === ']') setTime(R.time + 0.5);
      if (k.startsWith('arrow') || k === ' ') ev.preventDefault();
    });
    addEventListener('keyup', (ev) => R.keys.delete(ev.key.toLowerCase()));
    addEventListener('blur', () => R.keys.clear());
    // Touch joystick
    const stick = $('#stick'), knob = stick.querySelector('i');
    let sid = null;
    const setStick = (ev) => {
      const r = stick.getBoundingClientRect(), dx = ev.clientX - (r.left + r.width / 2), dy = ev.clientY - (r.top + r.height / 2);
      const l = Math.min(1, Math.hypot(dx, dy) / (r.width / 2)), a = Math.atan2(dy, dx);
      R.stick.x = Math.cos(a) * l; R.stick.y = Math.sin(a) * l;
      knob.style.transform = `translate(${R.stick.x * 35}px, ${R.stick.y * 35}px)`;
      if (R.cruise) stopCruise();
    };
    stick.addEventListener('pointerdown', (ev) => { sid = ev.pointerId; stick.setPointerCapture(sid); setStick(ev); });
    stick.addEventListener('pointermove', (ev) => { if (ev.pointerId === sid) setStick(ev); });
    const stickEnd = (ev) => { if (ev.pointerId !== sid) return; sid = null; R.stick.x = R.stick.y = 0; knob.style.transform = ''; };
    stick.addEventListener('pointerup', stickEnd); stick.addEventListener('pointercancel', stickEnd);
    for (const [id, key] of [['#up', 'up'], ['#down', 'down']]) {
      const b = $(id);
      b.addEventListener('pointerdown', (ev) => { b.setPointerCapture(ev.pointerId); R[key] = 1; });
      const off = () => { R[key] = 0; };
      b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off);
    }
    document.querySelectorAll('[data-move]').forEach((b) => { b.onclick = () => setMove(b.dataset.move); });
    $('#cruise').onclick = toggleCruise;
    $('#clock').oninput = (ev) => setTime(Number(ev.target.value));
  }
  function setMove(m) {
    R.move = m;
    document.querySelectorAll('[data-move]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.move === m)));
    if (m !== 'fly') {
      const s = groundAt(kx(R.pos.x), ky(R.pos.z));
      R.pos.y = s + (m === 'walk' ? 1.7 : 1.4);
      R.pitch = clamp(R.pitch, -0.5, 0.4);
    } else if (R.cruise) stopCruise();
    R.speed = 0;
  }
  function groundAt(x, y) {
    const s = surfaceAt(x, y), rd = roadAt(x, y);
    if (rd && rd.d < rd.seg[6] + 0.002 && (s.water || Math.abs(rd.z - s.z) < 25)) return rd.z;
    return s.z;
  }
  function toggleCruise() { if (R.cruise) stopCruise(); else startCruise(); }
  function startCruise() {
    const x = kx(R.pos.x), y = ky(R.pos.z), rd = roadAt(x, y);
    if (!rd || rd.d > 0.6) { flashHud('No road within 600 m — fly or drive closer to a road.'); return; }
    if (R.move === 'fly') setMove('drive');
    const road = W.roads[rd.seg[7]], k = rd.seg[8];
    const P = road.pts, hx = Math.sin(R.yaw), hy = Math.cos(R.yaw);
    const dx = P[k][0] - P[k - 1][0], dy = P[k][1] - P[k - 1][1];
    const dir = dx * hx + dy * hy >= 0 ? 1 : -1;
    R.cruise = { road, P, i: dir > 0 ? k - 1 : k, t: dir > 0 ? rd.t : 1 - rd.t, dir, v: Math.max(R.speed, 8), vmax: { interstate: 110, highway: 90, state: 75, parkway: 60, arterial: 45, county: 60 }[road.cls] / 3.6 };
    $('#cruise').setAttribute('aria-pressed', 'true');
    flashHud(`Cruising ${road.ref ? `${road.ref} ` : ''}${road.name}`);
  }
  function stopCruise() { R.cruise = null; $('#cruise').setAttribute('aria-pressed', 'false'); }
  let flashUntil = 0;
  function flashHud(msg) { $('#hudsub').textContent = msg; flashUntil = performance.now() + 2600; }

  function stepCruise(dt) {
    const c = R.cruise, P = c.P;
    const segPt = (i) => P[clamp(i, 0, P.length - 1)];
    // curvature ahead limits speed
    const a = segPt(c.i + c.dir), b = segPt(c.i + 2 * c.dir), o = segPt(c.i);
    const h1 = Math.atan2(a[0] - o[0], a[1] - o[1]), h2 = Math.atan2(b[0] - a[0], b[1] - a[1]);
    const turn = Math.abs(((h2 - h1 + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);
    const vt = c.vmax * clamp(1 - turn * 1.6, 0.35, 1);
    c.v += clamp(vt - c.v, -6 * dt, 2.5 * dt);
    let dist = c.v * dt;
    while (dist > 0) {
      const p0 = segPt(c.i), p1 = segPt(c.i + c.dir);
      const L = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) * 1000 || 0.001;
      const remain = (1 - c.t) * L;
      if (dist < remain) { c.t += dist / L; dist = 0; }
      else {
        dist -= remain; c.i += c.dir; c.t = 0;
        if (c.i + c.dir < 0 || c.i + c.dir >= P.length) { stopCruise(); flashHud('End of the road'); return; }
      }
    }
    const p0 = segPt(c.i), p1 = segPt(c.i + c.dir);
    const x = lerp(p0[0], p1[0], c.t), y = lerp(p0[1], p1[1], c.t), z = lerp(p0[2], p1[2], c.t);
    R.pos.set(sx(x), z + 0.9 + 1.4, sz(y));
    // look ahead ~70 m
    let j = c.i + c.dir * 2;
    j = clamp(j, 0, P.length - 1);
    const la = P[j];
    const want = Math.atan2(la[0] - x, la[1] - y);
    let d = ((want - R.yaw + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;
    R.yaw += d * clamp(dt * 2.2, 0, 1);
    R.speed = c.v;
  }

  function stepMove(dt) {
    const K = R.keys, fast = K.has('shift');
    let fwd = (K.has('w') || K.has('arrowup') ? 1 : 0) - (K.has('s') || K.has('arrowdown') ? 1 : 0) - R.stick.y;
    let side = (K.has('d') || K.has('arrowright') ? 1 : 0) - (K.has('a') || K.has('arrowleft') ? 1 : 0) + R.stick.x;
    const vert = (K.has('r') || K.has(' ') || R.up ? 1 : 0) - (K.has('f') || R.down ? 1 : 0);
    fwd = clamp(fwd, -1, 1); side = clamp(side, -1, 1);
    const x = kx(R.pos.x), y = ky(R.pos.z);
    if (R.cruise) { stepCruise(dt); return; }
    if (R.move === 'fly') {
      const g = Math.max(0, surfaceAt(x, y).z), alt = Math.max(1, R.pos.y - g);
      const v = clamp(alt * 0.9, 25, 1400) * (fast ? 3 : 1);
      const cp = Math.cos(R.pitch);
      R.pos.x += (Math.sin(R.yaw) * cp * fwd + Math.cos(R.yaw) * side) * v * dt;
      R.pos.z += (-Math.cos(R.yaw) * cp * fwd + Math.sin(R.yaw) * side) * v * dt;
      R.pos.y += (Math.sin(R.pitch) * fwd + vert) * v * dt;
      const g2 = Math.max(0, groundAt(kx(R.pos.x), ky(R.pos.z)));
      R.pos.y = clamp(R.pos.y, g2 + 3, 9000);
      R.speed = v * Math.min(1, Math.hypot(fwd, side, vert));
      return;
    }
    if (R.move === 'walk') {
      const v = fast ? 6 : 1.8;
      const nxp = R.pos.x + (Math.sin(R.yaw) * fwd + Math.cos(R.yaw) * side) * v * dt;
      const nzp = R.pos.z + (-Math.cos(R.yaw) * fwd + Math.sin(R.yaw) * side) * v * dt;
      const s = surfaceAt(kx(nxp), ky(nzp)), rd = roadAt(kx(nxp), ky(nzp));
      const onDeck = rd && rd.d < rd.seg[6] + 0.002;
      if (!(s.water && s.depth > 1.2 && !onDeck)) { R.pos.x = nxp; R.pos.z = nzp; }
      const gz = groundAt(kx(R.pos.x), ky(R.pos.z)) + 1.7;
      R.pos.y = lerp(R.pos.y, gz, clamp(dt * 10, 0, 1));
      R.speed = v * Math.min(1, Math.hypot(fwd, side));
      return;
    }
    // drive
    const top = fast ? 50 : 33;
    if (fwd > 0) R.speed += 5.5 * fwd * dt; else if (fwd < 0) R.speed += (R.speed > 0 ? 9 : 3) * fwd * dt; else R.speed *= 1 - 0.35 * dt;
    R.speed = clamp(R.speed, -8, top);
    R.yaw += side * clamp(Math.abs(R.speed) / 10, 0, 1) * 0.75 * dt * Math.sign(R.speed || 1);
    const nxp = R.pos.x + Math.sin(R.yaw) * R.speed * dt, nzp = R.pos.z - Math.cos(R.yaw) * R.speed * dt;
    const s = surfaceAt(kx(nxp), ky(nzp)), rd = roadAt(kx(nxp), ky(nzp));
    const onRoad = rd && rd.d < rd.seg[6] + 0.003;
    if (s.water && s.depth > 0.6 && !onRoad) { R.speed = 0; }
    else { R.pos.x = nxp; R.pos.z = nzp; }
    const gz = groundAt(kx(R.pos.x), ky(R.pos.z)) + 1.4;
    R.pos.y = lerp(R.pos.y, gz, clamp(dt * 8, 0, 1));
  }

  // ------------------------------------------------------------ labels & HUD
  let LBL = [];
  function initLabels() {
    LBL = [
      ...W.settlements.map((s) => ({ name: s.name, at: s.at, h: 30, cls: 'lbl town', max: s.pop > 20000 ? 45 : s.pop > 2000 ? 18 : 7, w: s.pop })),
      ...W.landmarks.filter((l) => l.tier !== 'micro').map((l) => ({ name: l.name, at: l.at, h: (l.h || 0) + 25, cls: `lbl ${l.tier}`, max: { primary: 50, secondary: 16, local: 4 }[l.tier], w: { primary: 5e5, secondary: 1e4, local: 100 }[l.tier] })),
      ...W.mountains.map((m) => ({ name: m.name, sub: `${fmt(m.z)} m`, at: m.at, h: 20, cls: 'lbl', max: 6 + (m.z / 1000) * 22, w: m.z * 10 })),
    ];
  }
  const lblPool = [];
  function updateLabels() {
    const host = $('#labels'), cam = R.camera, w = host.clientWidth, h = host.clientHeight;
    const px = kx(R.pos.x), py = ky(R.pos.z);
    const v = new THREE.Vector3(), out = [];
    for (const L of LBL) {
      const d = Math.hypot(L.at[0] - px, L.at[1] - py);
      if (d > L.max || d < 0.05) continue;
      const gz = Math.max(0, hAt(L.at[0], L.at[1])) + L.h;
      v.set(sx(L.at[0]), gz, sz(L.at[1])).project(cam);
      if (v.z > 1 || v.x < -1.1 || v.x > 1.1 || v.y < -1.1 || v.y > 1.2) continue;
      // terrain occlusion
      let hidden = false;
      const n = 16;
      for (let k = 1; k < n; k++) {
        const t = k / n, qx = lerp(px, L.at[0], t), qy = lerp(py, L.at[1], t), qz = lerp(R.pos.y, gz, t);
        if (hAt(qx, qy) > qz + 4) { hidden = true; break; }
      }
      if (hidden) continue;
      out.push({ L, x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * h, d, score: L.w / (1 + d) });
    }
    out.sort((a, b) => b.score - a.score);
    const boxes = [];
    let used = 0;
    for (const o of out) {
      if (used >= 26) break;
      const bw = o.L.name.length * 7 + 20, box = [o.x - bw / 2, o.y - 22, o.x + bw / 2, o.y];
      if (boxes.some((b) => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1])) continue;
      boxes.push(box);
      let el = lblPool[used];
      if (!el) { el = document.createElement('div'); lblPool.push(el); host.appendChild(el); }
      el.className = o.L.cls; el.hidden = false;
      el.textContent = o.L.name;
      if (o.L.sub) { const s = document.createElement('small'); s.textContent = o.L.sub; el.appendChild(s); }
      el.style.left = `${o.x}px`; el.style.top = `${o.y}px`;
      used++;
    }
    for (let k = used; k < lblPool.length; k++) lblPool[k].hidden = true;
  }
  function updateHud() {
    const x = kx(R.pos.x), y = ky(R.pos.z), isl = islandAt(x, y), s = surfaceAt(x, y);
    const rd = roadAt(x, y), onRoad = rd && rd.d < rd.seg[6] + 0.004 && Math.abs(R.pos.y - rd.z) < 6;
    const road = onRoad ? W.roads[rd.seg[7]] : null;
    const wname = () => {
      const inPoly = (pts) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
      let b = null, ba = Infinity;
      for (const wt of W.waters) {
        if (!wt.poly || !inPoly(wt.poly)) continue;
        let a2 = 0; for (let i = 0, j = wt.poly.length - 1; i < wt.poly.length; j = i++) a2 += (wt.poly[j][0] + wt.poly[i][0]) * (wt.poly[j][1] - wt.poly[i][1]);
        if (Math.abs(a2) < ba) { ba = Math.abs(a2); b = wt; }
      }
      return b ? b.name : 'Atlantic Ocean';
    };
    $('#hudplace').textContent = road ? `${road.ref && !road.name.startsWith(road.ref) ? `${road.ref} · ` : ''}${road.name}` : isl ? isl.name : wname();
    if (performance.now() > flashUntil) {
      const elev = R.move === 'fly' ? `${fmt(R.pos.y)} m altitude` : `${fmt(Math.max(0, R.pos.y - (R.move === 'walk' ? 1.7 : 1.4)))} m`;
      const sp = R.move === 'walk' ? `${(R.speed * 3.6).toFixed(0)} km/h` : `${Math.round(Math.abs(R.speed) * 3.6)} km/h`;
      $('#hudsub').textContent = `${locate(x, y)} · ${elev} · ${sp}${s.water && R.move !== 'fly' ? ' · on the water' : ''}`;
    }
    const deg = (((R.yaw * 180) / Math.PI) % 360 + 360) % 360;
    $('#compass').textContent = `${bearingName(deg)} ${Math.round(deg)}°`;
    // minimap
    const { cv, ctx } = R.mini, sc = cv.width / (x1 - x0);
    ctx.drawImage(A.base, 0, 0, cv.width, (y1 - y0) * sc);
    const mx = (x - x0) * sc, my = (y1 - y) * sc;
    ctx.save(); ctx.translate(mx, my); ctx.rotate(R.yaw);
    ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(7, 8); ctx.lineTo(0, 4); ctx.lineTo(-7, 8); ctx.closePath();
    ctx.fillStyle = '#c4402a'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
    ctx.restore();
  }

  // ------------------------------------------------------------ main loop
  let frames = 0;
  function loop(now) {
    requestAnimationFrame(loop);
    if (state.mode !== 'roam') { R.clock = now; return; }
    const dt = Math.min(0.1, (now - R.clock) / 1000); R.clock = now;
    const { renderer, camera } = R;
    const cv = renderer.domElement, w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== Math.round(w * renderer.getPixelRatio()) || cv.height !== Math.round(h * renderer.getPixelRatio())) { renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
    stepMove(dt);
    camera.position.copy(R.pos);
    camera.rotation.set(R.pitch, -R.yaw, 0);
    R.sky.position.copy(R.pos);
    R.sunSprite.position.copy(R.pos).addScaledVector(R.sunDir, 60000);
    R.sun.position.copy(R.pos).addScaledVector(R.sunDir.y > -0.05 ? R.sunDir : new THREE.Vector3(0.3, 1, 0.2), 10000);
    R.sun.target.position.copy(R.pos);
    R.sea.position.x = R.pos.x; R.sea.position.z = R.pos.z;
    updateChunks(frames < 3 ? 400 : 3);
    const px = kx(R.pos.x), py = ky(R.pos.z), alt = R.pos.y - Math.max(0, hAt(px, py));
    const showTrees = alt < 1600;
    R.cones.visible = R.blobs.visible = R.trunks.visible = showTrees;
    if (showTrees && (!R.treeAt || Math.hypot(px - R.treeAt[0], py - R.treeAt[1]) > 0.28)) { placeTrees(px, py); R.treeAt = [px, py]; }
    for (const t of R.turbines) t.rotation.z += dt * 1.1;
    moveBoats(now / 1000);
    if (now - R.hudT > 200) { R.hudT = now; updateHud(); }
    if (now - R.lblT > 120) { R.lblT = now; updateLabels(); }
    renderer.render(R.scene, camera);
    frames++;
  }

  function placeCamera(x, y, z, yaw, pitch, move) {
    if (!R) { initRoam(); }
    R.pos.set(sx(x), z, sz(y));
    R.yaw = yaw; R.pitch = pitch;
    R.treeAt = null; stopCruise();
    setMove(move);
    if (move === 'fly') R.pos.y = z;
  }
  function roamToViewpoint(v) {
    const g = Math.max(0, hAt(v.at[0], v.at[1]));
    let yaw = v.facing != null ? (v.facing * Math.PI) / 180 : 2.6;
    if (v.facing == null && v.seen.length) {
      const far = v.seen.find((s) => s.tier === 'primary') || v.seen[Math.floor(v.seen.length / 2)];
      const t = INDEX.find((q) => q.name === far.name);
      if (t) yaw = Math.atan2(t.at[0] - v.at[0], t.at[1] - v.at[1]);
    }
    setMode('roam');
    let px = v.at[0], py = v.at[1], z = g + v.eye + 1.7;
    // Bridge-deck viewpoints stand on the deck itself.
    const rd = v.eye >= 15 ? roadAt(px, py) : null;
    if (rd && rd.d < 0.4) {
      const s = rd.seg;
      px = lerp(s[0], s[3], rd.t); py = lerp(s[1], s[4], rd.t); z = rd.z + 1.7;
    }
    placeCamera(px, py, z, yaw, -0.05, 'fly');
    R.pos.y = z;
    flashHud(v.name);
  }
  function roamToItem(it) {
    if (it.type === 'viewpoint') { roamToViewpoint(it.e); return; }
    const [x, y] = it.at, g = Math.max(0, hAt(x, y));
    const big = it.type === 'town' ? clamp(Math.sqrt(it.e.pop) * 6, 500, 3500) : it.type === 'mountain' ? 2500 : it.type === 'district' ? 900 : it.type === 'forest' || it.type === 'lake' ? 1800 : 900;
    const yaw = 0.4, bx = x - Math.sin(yaw) * big / 1000, by = y - Math.cos(yaw) * big / 1000;
    const alt = Math.max(g + big * 0.35 + (it.e.h || 0) * 0.6, Math.max(0, hAt(bx, by)) + 120);
    setMode('roam');
    placeCamera(bx, by, alt, yaw, -Math.atan2(alt - g - (it.e.h || 0) * 0.5, big), 'fly');
    flashHud(it.name);
  }
  function enterRoam(o) {
    setMode('roam');
    placeCamera(o.x, o.y, o.alt, o.yaw, o.pitch, o.move || 'fly');
  }


  // ============================================================ WORLD BIBLE
  const DOC_TREE = [
    ['Foundations', [['00-research-principles.md', 'Research principles'], ['01-master-framework.md', 'Master framework']]],
    ['Islands', [['islands/halcomb.md', 'Halcomb'], ['islands/graystone.md', 'Graystone'], ['islands/calder.md', 'Calder'], ['islands/corliss.md', 'Corliss'], ['islands/bellamy.md', 'Bellamy'], ['islands/mirabel.md', 'Mirabel'], ['islands/saint-ambrose.md', 'Saint Ambrose'], ['islands/wickham.md', 'Wickham'], ['islands/ossahatchee.md', 'Ossahatchee'], ['islands/gannet.md', 'Gannet Banks'], ['islands/sabal.md', 'Sabal Keys']]],
    ['Systems', [['12-landmark-generation.md', 'Landmark generation'], ['13-world-scale.md', 'World scale'], ['14-exploration-density.md', 'Exploration density'], ['15-realism-audit.md', 'Realism audit'], ['16-atmospheric-pass.md', 'Atmospheric pass'], ['17-exploration-psychology.md', 'Exploration psychology'], ['18-writing-standard.md', 'Writing standard'], ['19-inspiration-matrix.md', 'Inspiration matrix'], ['20-master-map.md', 'Master map']]],
    ['Registers', [['registers/landmarks.md', 'Landmarks'], ['registers/viewpoints.md', 'Viewpoints'], ['registers/beaches.md', 'Beaches'], ['registers/lakes.md', 'Lakes'], ['registers/forests.md', 'Forests'], ['registers/mountains.md', 'Mountains'], ['registers/districts.md', 'Districts']]],
  ];
  let DOC_BASE = null, docCur = null;
  const docCache = new Map();
  const normPath = (dir, rel) => {
    const parts = (dir ? `${dir}/${rel}` : rel).split('/'), out = [];
    for (const q of parts) { if (q === '..') out.pop(); else if (q && q !== '.') out.push(q); }
    return out.join('/');
  };
  async function fetchDoc(path) {
    if (docCache.has(path)) return docCache.get(path);
    for (const b of DOC_BASE ? [DOC_BASE] : ['docs/', '../docs/']) {
      try { const r = await fetch(b + path); if (r.ok) { DOC_BASE = b; const t = await r.text(); docCache.set(path, t); return t; } } catch (e) { /* try next */ }
    }
    throw new Error(`${path} is not available`);
  }
  function mdRender(src, dir) {
    src = src.replace(/<!--[\s\S]*?-->/g, '');
    const lines = src.split('\n');
    const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const inline = (t) => {
      let o = esc(t).replace(/&lt;br&gt;/g, '<br>');
      o = o.replace(/`([^`]+)`/g, '<code>$1</code>');
      o = o.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (m, a, u) => `<img alt="${a}" loading="lazy" src="${DOC_BASE}${normPath(dir, u)}">`);
      o = o.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, t2, u) => (/^https?:/.test(u) ? `<a href="${u}" target="_blank" rel="noopener">${t2}</a>` : `<a href="#" data-doc="${normPath(dir, u)}">${t2}</a>`));
      o = o.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      o = o.replace(/(^|[\s(>])\*([^*\s][^*]*?)\*(?=[\s).,;:!?<]|$)/g, '$1<em>$2</em>');
      o = o.replace(/(^|[\s(>])_([^_\s][^_]*?)_(?=[\s).,;:!?<]|$)/g, '$1<em>$2</em>');
      return o;
    };
    const block = /^(#{1,4}\s|\||\s*[-*]\s+|\s*\d+\.\s+|```|---+\s*$)/;
    let html = '', i = 0;
    while (i < lines.length) {
      const l = lines[i];
      let m;
      if (/^\s*$/.test(l)) { i++; continue; }
      if ((m = l.match(/^(#{1,4})\s+(.*)$/))) { const n = m[1].length; html += `<h${n}>${inline(m[2])}</h${n}>`; i++; continue; }
      if (/^---+\s*$/.test(l)) { html += '<hr>'; i++; continue; }
      if (/^```/.test(l)) { const buf = []; i++; while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]); i++; html += `<pre><code>${esc(buf.join('\n'))}</code></pre>`; continue; }
      if (/^\|/.test(l)) {
        const rows = []; while (i < lines.length && /^\|/.test(lines[i])) rows.push(lines[i++]);
        const cells = (r) => r.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|').replace(/\\\\/g, '\\'));
        const head = cells(rows[0]), body = rows.slice(2).map(cells);
        html += `<div class="tbl"><table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
        continue;
      }
      if ((m = l.match(/^\s*([-*]|\d+\.)\s+/))) {
        const ordered = /\d/.test(m[1]), items = [];
        while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
          let t = lines[i].replace(/^\s*([-*]|\d+\.)\s+/, ''); i++;
          while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*([-*]|\d+\.)\s+/.test(lines[i])) t += ` ${lines[i++].trim()}`;
          items.push(t);
        }
        html += `<${ordered ? 'ol' : 'ul'}>${items.map((t) => `<li>${inline(t)}</li>`).join('')}</${ordered ? 'ol' : 'ul'}>`;
        continue;
      }
      const buf = [l]; i++;
      while (i < lines.length && !/^\s*$/.test(lines[i]) && !block.test(lines[i])) buf.push(lines[i++]);
      html += `<p>${inline(buf.join(' '))}</p>`;
    }
    return html;
  }
  function renderDocNav() {
    const nav = $('#docnav');
    nav.innerHTML = '';
    for (const [group, docs] of DOC_TREE) {
      const h = document.createElement('h4'); h.textContent = group; nav.appendChild(h);
      for (const [path, label] of docs) {
        const b = document.createElement('button'); b.textContent = label; b.dataset.path = path;
        b.onclick = () => openDoc(path);
        nav.appendChild(b);
      }
    }
  }
  async function openDoc(path) {
    const art = $('#doc');
    docCur = path;
    document.querySelectorAll('#docnav button').forEach((b) => b.setAttribute('aria-current', String(b.dataset.path === path)));
    const active = document.querySelector('#docnav button[aria-current="true"]');
    if (active && innerWidth <= 720) active.scrollIntoView({ inline: 'center', block: 'nearest' });
    art.innerHTML = '<p class="docmeta">Loading…</p>';
    try {
      const text = await fetchDoc(path);
      if (docCur !== path) return;
      const dir = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
      art.innerHTML = mdRender(text, dir);
      art.scrollTop = 0;
      art.querySelectorAll('a[data-doc]').forEach((a) => {
        a.onclick = (ev) => {
          ev.preventDefault();
          const target = a.dataset.doc;
          if (target.endsWith('.md')) openDoc(target);
          else if (target.startsWith('registers')) openDoc('registers/landmarks.md');
        };
      });
    } catch (e) {
      art.innerHTML = '';
      const p = document.createElement('p'); p.className = 'docmeta'; p.textContent = `${e.message}. The documents are published with the explorer; when running locally, serve the repository root and open /game/.`;
      art.appendChild(p);
    }
  }

  // ------------------------------------------------------------ modes
  function setMode(m) {
    state.mode = m;
    document.body.classList.toggle('roam', m === 'roam');
    document.body.classList.toggle('docs', m === 'docs');
    $('#tab-atlas').setAttribute('aria-pressed', String(m === 'atlas'));
    $('#tab-roam').setAttribute('aria-pressed', String(m === 'roam'));
    $('#tab-docs').setAttribute('aria-pressed', String(m === 'docs'));
    if (m === 'docs' && !docCur) { renderDocNav(); openDoc('01-master-framework.md'); }
    if (m === 'roam' && !R) {
      initRoam();
      const v = W.viewpoints.find((q) => q.id === 'vp-ledford-dome');
      placeCamera(v.at[0], v.at[1], hAt(v.at[0], v.at[1]) + v.eye + 1.7, 2.55, -0.08, 'fly');
    }
    if (m === 'atlas') redraw();
    try { history.replaceState(null, '', `#${m === 'docs' ? 'bible' : m}`); } catch (e) { /* sandboxed */ }
  }
  $('#tab-atlas').onclick = () => setMode('atlas');
  $('#tab-roam').onclick = () => setMode('roam');
  $('#tab-docs').onclick = () => setMode('docs');
  addEventListener('resize', () => { if (state.mode === 'atlas') redraw(); });

  // ------------------------------------------------------------ boot
  async function main() {
    setLoad(0.05, 'Fetching terrain, land cover and world data…');
    const [wj, tp, cp] = await Promise.all([
      fetch('data/world.json').then((r) => r.json()),
      loadRaster('data/terrain.png').then((r) => { setLoad(0.55, 'Decoding terrain…'); return r; }),
      loadRaster('data/cover.png'),
    ]);
    W = wj;
    ({ nx, ny, cell, x0, y1, x1, y0 } = W.grid);
    const N = nx * ny;
    H = new Float32Array(N); WT = new Uint8Array(N); ISL = new Uint8Array(N); COV = new Uint8Array(N); SURF = new Float32Array(N);
    const td = tp.data, cd = cp.data;
    const sums = {};
    for (let i = 0; i < N; i++) {
      const o = i * 3, b = td[o + 2];
      H[i] = ((td[o] << 8) | td[o + 1]) / 10 - 100;
      WT[i] = b & 3; ISL[i] = b >> 2; COV[i] = cd[o];
      if (WT[i] >= 2) SURF[i] = ((cd[o + 1] << 8) | cd[o + 2]) / 10 - 100;
      if (ISL[i] && !WT[i] && (i & 7) === 0) { const s = (sums[ISL[i]] ||= [0, 0, 0]); s[0] += i % nx; s[1] += (i / nx) | 0; s[2]++; }
    }
    for (const isl of W.islands) {
      islandById[isl.id] = isl;
      islandByIndex[isl.index] = isl;
    }
    for (const isl of W.islands) {
      if (isl.partOf) continue;
      const parts = W.islands.filter((q) => q.id === isl.id || q.partOf === isl.id).map((q) => sums[q.index]).filter(Boolean);
      const t = parts.reduce((a, s) => [a[0] + s[0], a[1] + s[1], a[2] + s[2]], [0, 0, 0]);
      if (t[2]) isl.label = [cx2x(t[0] / t[2]), cr2y(t[1] / t[2])];
    }
    NCX = Math.ceil((nx - 1) / CH); NCY = Math.ceil((ny - 1) / CH);
    setLoad(0.8, 'Shading the atlas…');
    await new Promise((r) => setTimeout(r, 0));
    A.base = buildBase();
    terrainColors();
    buildIndex();
    initLabels();
    renderChips(); renderLayers(); renderList();
    if (innerWidth <= 720) panel.classList.add('min');
    fitAll();
    setLoad(1, 'Ready');
    $('#loading').hidden = true;
    const hash = location.hash.slice(1);
    if (hash.startsWith('vp-') || W.viewpoints.some((v) => v.id === hash)) { const v = W.viewpoints.find((q) => q.id === hash); if (v) { roamToViewpoint(v); return; } }
    if (hash === 'roam') { setMode('roam'); return; }
    if (hash === 'bible') { setMode('docs'); return; }
    setMode('atlas');
    drawAtlas();
  }
  main().catch((e) => { console.error(e); $('#loadstep').textContent = `Could not load the world data: ${e.message}`; });
})();
