/* ═════════ the world: the chosen map's grids (height, water, biomes), smooth sampling, digging, spatial grids for collisions ═════════ */
const WN = MAPDEF.n, WSTEP = MAPDEF.step, WHALF = MAPDEF.half, PLAY = MAPDEF.play, HSC = MAPDEF.hs;
const WORLD = { ready: false, data: null, stats: null };
let HM = null, AMP = null, WLV = null, FLW = null, MOI = null, FOR = null, TMP = null, BIO = null, CLS = null, CROP = null;
const BIOME_AR = ['البحر', 'الشاطئ', 'الساحل', 'غابة البلّوط', 'غابة الصنوبر', 'الجبال الثلجية', 'الحقول', 'الصحراء', 'المستنقع', 'جزيرة النخيل', 'الجزر الصخرية', 'المراعي', 'بحيرة', 'نهر'];

/* ── PNG decoding that never goes through colour management: inflate + unfilter ourselves ── */
async function inflate(bytes) {
  const ds = new DecompressionStream('deflate');
  const stream = new Blob([bytes]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
async function decodePNG(buf) {
  const u = new Uint8Array(buf), dv = new DataView(buf);
  let off = 8, w = 0, h = 0, depth = 0, ctype = 0; const idat = [];
  while (off < u.length) {
    const len = dv.getUint32(off), type = String.fromCharCode(u[off + 4], u[off + 5], u[off + 6], u[off + 7]);
    if (type === 'IHDR') { w = dv.getUint32(off + 8); h = dv.getUint32(off + 12); depth = u[off + 16]; ctype = u[off + 17]; if (u[off + 20]) throw new Error('interlaced png'); }
    else if (type === 'IDAT') idat.push(u.subarray(off + 8, off + 8 + len));
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  if (depth !== 8) throw new Error('png depth ' + depth);
  const ch = { 0: 1, 2: 3, 4: 2, 6: 4 }[ctype]; if (!ch) throw new Error('png type ' + ctype);
  let tot = 0; for (const c of idat) tot += c.length;
  const z = new Uint8Array(tot); let o = 0; for (const c of idat) { z.set(c, o); o += c.length; }
  const raw = await inflate(z), stride = w * ch, out = new Uint8Array(w * h * ch);
  for (let y = 0; y < h; y++) {
    const ft = raw[y * (stride + 1)], src = y * (stride + 1) + 1, dst = y * stride, prev = dst - stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? out[dst + x - ch] : 0, b = y > 0 ? out[prev + x] : 0, c = (x >= ch && y > 0) ? out[prev + x - ch] : 0;
      let v = raw[src + x];
      if (ft === 1) v += a; else if (ft === 2) v += b; else if (ft === 3) v += (a + b) >> 1;
      else if (ft === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      out[dst + x] = v & 255;
    }
  }
  return { w, h, ch, data: out };
}
async function loadPNG(url) {
  const r = await fetch(url); if (!r.ok) throw new Error(url + ' ' + r.status);
  const buf = await r.arrayBuffer();
  if (typeof DecompressionStream !== 'undefined') { try { return await decodePNG(buf); } catch (e) { console.warn('png decoder fallback', e); } }
  const im = await createImageBitmap(new Blob([buf]), { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
  const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0);
  const d = g.getImageData(0, 0, im.width, im.height).data, n = im.width * im.height, out = new Uint8Array(n * 3);
  for (let i = 0; i < n; i++) { out[i * 3] = d[i * 4]; out[i * 3 + 1] = d[i * 4 + 1]; out[i * 3 + 2] = d[i * 4 + 2]; }
  return { w: im.width, h: im.height, ch: 3, data: out };
}
async function loadWorld(progress) {
  const D = MAPDEF.dir;
  const [hp, wp, sp, ip, js] = await Promise.all([loadPNG(D + '/height.png'), loadPNG(D + '/water.png'), loadPNG(D + '/surface.png'), loadPNG(D + '/ids.png'), fetchJSON(D + '/world.json')]);
  if (hp.w !== WN || hp.h !== WN) throw new Error('map grid ' + hp.w + ' ≠ ' + WN);
  progress && progress(0.5);
  const n = WN * WN, step = (p) => p.ch;
  HM = new Float32Array(n); AMP = new Float32Array(n); WLV = new Float32Array(n); FLW = new Uint8Array(n);
  MOI = new Uint8Array(n); FOR = new Uint8Array(n); TMP = new Uint8Array(n); BIO = new Uint8Array(n); CLS = new Uint8Array(n); CROP = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const a = i * step(hp); HM[i] = ((hp.data[a] << 8) | hp.data[a + 1]) / HSC - 100; AMP[i] = hp.data[a + 2] / 100;
    const b = i * step(wp); const wv = ((wp.data[b] << 8) | wp.data[b + 1]) / HSC - 100; WLV[i] = wv < -99 ? -1e9 : wv; FLW[i] = wp.data[b + 2];
    const c = i * step(sp); MOI[i] = sp.data[c]; FOR[i] = sp.data[c + 1]; TMP[i] = sp.data[c + 2];
    const d = i * step(ip); BIO[i] = ip.data[d]; CLS[i] = ip.data[d + 1]; CROP[i] = ip.data[d + 2];
  }
  WORLD.data = js; WORLD.stats = js.stats; WORLD.ready = true;
  return js;
}
/* ── sampling ── */
const cellOf = (x) => (x + WHALF) / WSTEP;
function cr(p0, p1, p2, p3, t) { const t2 = t * t, t3 = t2 * t; return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3); }
function hBase(x, z) {
  const fx = cellOf(x), fz = cellOf(z);
  if (fx < 1 || fz < 1 || fx >= WN - 2 || fz >= WN - 2) return -60;
  const i = fx | 0, j = fz | 0, u = fx - i, v = fz - j;
  let k = (j - 1) * WN + i - 1;
  const r0 = cr(HM[k], HM[k + 1], HM[k + 2], HM[k + 3], u); k += WN;
  const r1 = cr(HM[k], HM[k + 1], HM[k + 2], HM[k + 3], u); k += WN;
  const r2 = cr(HM[k], HM[k + 1], HM[k + 2], HM[k + 3], u); k += WN;
  const r3 = cr(HM[k], HM[k + 1], HM[k + 2], HM[k + 3], u);
  return cr(r0, r1, r2, r3, v);
}
function bil(arr, x, z, def = 0) {
  const fx = cellOf(x), fz = cellOf(z);
  if (fx < 0 || fz < 0 || fx >= WN - 1 || fz >= WN - 1) return def;
  const i = fx | 0, j = fz | 0, u = fx - i, v = fz - j, k = j * WN + i;
  return (arr[k] * (1 - u) + arr[k + 1] * u) * (1 - v) + (arr[k + WN] * (1 - u) + arr[k + WN + 1] * u) * v;
}
function near(arr, x, z, def = 0) { const i = Math.round(cellOf(x)), j = Math.round(cellOf(z)); return (i < 0 || j < 0 || i >= WN || j >= WN) ? def : arr[j * WN + i]; }
/* micro relief: a few centimetres to a metre of bumps where the land is wild, none on roads and in towns */
function micro(x, z) {
  const a = bil(AMP, x, z, 0); if (a < 0.01) return 0;
  return a * (vnoise(x * 0.153, z * 0.153) * 0.55 + vnoise(x * 0.37 + 11.3, z * 0.37 - 7.9) * 0.3 + vnoise(x * 0.81 - 3.1, z * 0.81 + 5.7) * 0.15 - 0.5) * 1.6;
}
/* craters dug by the player: a sparse list in a grid */
const DIG = { list: [], grid: new Map(), version: 0 };
const digKey = (i, j) => i * 100003 + j;
function digOffset(x, z) {
  const l = DIG.grid.get(digKey(Math.floor(x / 16), Math.floor(z / 16))); if (!l) return 0;
  let o = 0;
  for (const c of l) { const d2 = (x - c.x) ** 2 + (z - c.z) ** 2; if (d2 < c.r * c.r) { const t = 1 - d2 / (c.r * c.r); o -= c.d * t * t; } }
  return o;
}
function digGrid(c, add) {
  for (let i = Math.floor((c.x - c.r) / 16); i <= Math.floor((c.x + c.r) / 16); i++) for (let j = Math.floor((c.z - c.r) / 16); j <= Math.floor((c.z + c.r) / 16); j++) {
    const k = digKey(i, j); let a = DIG.grid.get(k);
    if (add) { if (!a) DIG.grid.set(k, a = []); a.push(c); }
    else if (a) { const q = a.indexOf(c); if (q >= 0) a.splice(q, 1); if (!a.length) DIG.grid.delete(k); }
  }
}
// a stroke where a hole already is makes it deeper (and wider as it goes down, so you can climb out): one record per hole, however deep
function addCrater(x, z, r, d, silent) {
  let c = null, best = 0.5;
  const l = DIG.grid.get(digKey(Math.floor(x / 16), Math.floor(z / 16)));
  if (l) for (const q of l) { const dd = Math.hypot(q.x - x, q.z - z); if (dd < best) { best = dd; c = q; } }
  if (c) {
    digGrid(c, false);
    c.d = +(c.d + d).toFixed(3); c.r = +Math.max(c.r, r, 0.7 + c.d * 0.42).toFixed(2);
    c.x = +(c.x + (x - c.x) * 0.25).toFixed(2); c.z = +(c.z + (z - c.z) * 0.25).toFixed(2);
  } else { c = { x: +x.toFixed(2), z: +z.toFixed(2), r, d }; DIG.list.push(c); }
  digGrid(c, true);
  DIG.version++;
  if (!silent && typeof TERRAIN !== 'undefined') TERRAIN.dirtyArea(c.x, c.z, c.r + 2);
  return c;
}
/* ── the world editor's changes to the land (41_editor) ──
   EDT: heights added to the ground on a grid of 2 m points, kept in 128 m chunks (only where something was changed);
   EDP: flat pads under the buildings placed there (the ground meets each pad, like it meets the scans);
   EDW: lakes, each a disc of water at its own level (the ground around holds it in) */
const EDT = { ch: new Map(), n: 0, ver: 0, lastK: -1, last: null, x0: 1e9, z0: 1e9, x1: -1e9, z1: -1e9 };
const edtKey = (ci, cj) => (ci + 4096) * 8192 + (cj + 4096);
function edtGet(i, j) {
  const k = edtKey(i >> 6, j >> 6); let a;
  if (k === EDT.lastK) a = EDT.last; else { a = EDT.ch.get(k); EDT.lastK = k; EDT.last = a; }
  return a ? a[(j & 63) * 64 + (i & 63)] : 0;
}
/* the chunk at grid point (i, j), made when asked to (a brush writing there) */
function edtChunk(i, j, make) {
  const k = edtKey(i >> 6, j >> 6); let a = EDT.ch.get(k);
  if (!a && make) {
    a = new Float32Array(4096); EDT.ch.set(k, a); EDT.n = EDT.ch.size; EDT.lastK = -1;
    const x0 = (i >> 6) * 128, z0 = (j >> 6) * 128;
    EDT.x0 = Math.min(EDT.x0, x0 - 4); EDT.z0 = Math.min(EDT.z0, z0 - 4); EDT.x1 = Math.max(EDT.x1, x0 + 132); EDT.z1 = Math.max(EDT.z1, z0 + 132);
  }
  return a;
}
function edtAt(x, z) {
  if (x < EDT.x0 || x > EDT.x1 || z < EDT.z0 || z > EDT.z1) return 0;
  const gx = x * 0.5, gz = z * 0.5, i = Math.floor(gx), j = Math.floor(gz), u = gx - i, v = gz - j;
  return (edtGet(i, j) * (1 - u) + edtGet(i + 1, j) * u) * (1 - v) + (edtGet(i, j + 1) * (1 - u) + edtGet(i + 1, j + 1) * u) * v;
}
// pads: { x, z, hx, hz, c, s (cos/sin of the turn), y, m (the width the ground takes to meet it) } in a 32 m grid
const EDP = { list: [], grid: new Map(), n: 0 };
const padKey = (i, j) => (i + 4096) * 8192 + (j + 4096);
function padGrid(p, add) {
  const e = Math.hypot(p.hx, p.hz) + p.m;
  for (let i = Math.floor((p.x - e) / 32); i <= Math.floor((p.x + e) / 32); i++) for (let j = Math.floor((p.z - e) / 32); j <= Math.floor((p.z + e) / 32); j++) {
    const k = padKey(i, j); let a = EDP.grid.get(k);
    if (add) { if (!a) EDP.grid.set(k, a = []); a.push(p); }
    else if (a) { const q = a.indexOf(p); if (q >= 0) a.splice(q, 1); if (!a.length) EDP.grid.delete(k); }
  }
}
function addPad(p) { p.c = Math.cos(p.ry || 0); p.s = Math.sin(p.ry || 0); EDP.list.push(p); padGrid(p, true); EDP.n = EDP.list.length; return p; }
function removePad(p) { const i = EDP.list.indexOf(p); if (i >= 0) EDP.list.splice(i, 1); padGrid(p, false); EDP.n = EDP.list.length; }
function padAt(x, z, h) {
  const a = EDP.grid.get(padKey(Math.floor(x / 32), Math.floor(z / 32))); if (!a) return h;
  for (const p of a) {
    const dx = x - p.x, dz = z - p.z, lx = dx * p.c - dz * p.s, lz = dx * p.s + dz * p.c;
    const ox = Math.max(0, Math.abs(lx) - p.hx), oz = Math.max(0, Math.abs(lz) - p.hz), d = Math.hypot(ox, oz);
    if (d <= 0) h = p.y; else if (d < p.m) { const k = d / p.m; h = lerp(p.y, h, k * k * (3 - 2 * k)); }
  }
  return h;
}
// lakes: { x, z, r, y } in a 64 m grid
const EDW = { list: [], grid: new Map() };
function lakeGrid(w, add) {
  for (let i = Math.floor((w.x - w.r) / 64); i <= Math.floor((w.x + w.r) / 64); i++) for (let j = Math.floor((w.z - w.r) / 64); j <= Math.floor((w.z + w.r) / 64); j++) {
    const k = padKey(i, j); let a = EDW.grid.get(k);
    if (add) { if (!a) EDW.grid.set(k, a = []); a.push(w); }
    else if (a) { const q = a.indexOf(w); if (q >= 0) a.splice(q, 1); if (!a.length) EDW.grid.delete(k); }
  }
}
function lakeLevel(x, z) {
  const a = EDW.grid.get(padKey(Math.floor(x / 64), Math.floor(z / 64))); if (!a) return -1e9;
  let best = -1e9; for (const w of a) if ((x - w.x) ** 2 + (z - w.z) ** 2 < w.r * w.r && w.y > best) best = w.y;
  return best;
}
// shapes the editor puts on the land as things you can move: mountains, hills, mesas, ranges, craters, basins under lakes.
// { t, x, z, w, d (the two diameters), h (height, or depth for the hollows), ry, seed } in a 64 m grid
const EDS = { list: [], grid: new Map(), n: 0 };
function shapeGrid(s, add) {
  const e = Math.max(s.w, s.d) * 0.5 + 2;
  for (let i = Math.floor((s.x - e) / 64); i <= Math.floor((s.x + e) / 64); i++) for (let j = Math.floor((s.z - e) / 64); j <= Math.floor((s.z + e) / 64); j++) {
    const k = padKey(i, j); let a = EDS.grid.get(k);
    if (add) { if (!a) EDS.grid.set(k, a = []); a.push(s); }
    else if (a) { const q = a.indexOf(s); if (q >= 0) a.splice(q, 1); if (!a.length) EDS.grid.delete(k); }
  }
}
function addShape(s) { s.c = Math.cos(s.ry || 0); s.s = Math.sin(s.ry || 0); EDS.list.push(s); shapeGrid(s, true); EDS.n = EDS.list.length; return s; }
function removeShape(s) { const i = EDS.list.indexOf(s); if (i >= 0) EDS.list.splice(i, 1); shapeGrid(s, false); EDS.n = EDS.list.length; }
// value noise for the shapes (its own, so a mountain looks the same on every device)
const shN = (x, z) => { const i = Math.floor(x), j = Math.floor(z), u = x - i, v = z - j, h = (a, b) => { const q = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return q - Math.floor(q); };
  const a = h(i, j), b = h(i + 1, j), c = h(i, j + 1), d = h(i + 1, j + 1), su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v); return a + (b - a) * su + (c - a) * sv + (a - b - c + d) * su * sv; };
function shapeH(s, x, z) {
  const dx = x - s.x, dz = z - s.z, lx = dx * s.c - dz * s.s, lz = dx * s.s + dz * s.c, ax = s.w * 0.5, az = s.d * 0.5;
  const k = Math.hypot(lx / ax, lz / az); if (k >= 1) return 0;
  const sm = (a, b, t) => { const q = Math.min(1, Math.max(0, (t - a) / (b - a))); return q * q * (3 - 2 * q); };
  const fall = 1 - sm(0, 1, k), sd = (s.seed || 1) * 17.31, f = 3.2 / Math.min(ax, az);
  switch (s.t) {
    case 'hill': return s.h * fall;
    case 'mesa': { const n = shN(lx * f * 1.6 + sd, lz * f * 1.6); return s.h * (1 - sm(0.55 + n * 0.12, 0.98, k)); }
    case 'bowl': return -s.h * (1 - sm(0.3, 1, k));
    case 'pool': return -s.h * (1 - sm(0.9, 1, k));        // straight walls, a flat floor
    case 'crater': return -s.h * (1 - sm(0.15, 0.72, k)) + s.h * 0.45 * Math.exp(-(((k - 0.8) / 0.13) ** 2));
    case 'valley': { const q = Math.abs(lz / az), along = 1 - sm(0.75, 1, Math.abs(lx / ax)); return -s.h * (1 - sm(0, 1, q)) * along; }
    default: {     // 'mount', 'range': ridged noise over a peaked dome
      let r = 0, a = 1, fr = f, tot = 0;
      for (let o = 0; o < 4; o++) { const n = 1 - Math.abs(shN(lx * fr + sd + o * 7.7, lz * fr - sd) * 2 - 1); r += n * n * a; tot += a; a *= 0.5; fr *= 2.03; }
      r /= tot;
      const peak = s.t === 'range' ? (1 - sm(0, 1, Math.abs(lz / az))) * (1 - sm(0.7, 1, Math.abs(lx / ax))) : Math.pow(fall, 1.25);
      return s.h * peak * (0.55 + 0.75 * r) * (s.t === 'range' ? 1 : 1 - 0.25 * (1 - fall));
    }
  }
}
function edsAt(x, z) {
  const a = EDS.grid.get(padKey(Math.floor(x / 64), Math.floor(z / 64))); if (!a) return 0;
  let h = 0; for (let i = 0; i < a.length; i++) h += shapeH(a[i], x, z);
  return h;
}
/* GP: the ground painted in the editor (45_gmat draws it). A point every 50 cm holds which of the world's eight painted
   materials lies there (id) and how much (w, 0–255); 64 m tiles of 128 × 128 points, only where something was painted.
   Coarser copies (2 m, 8 m, a tile's average) serve the far chunks, made when first asked for */
const GP = { tiles: new Map(), n: 0, ver: 0 };
const gpKey = (ti, tj) => (ti + 4096) * 8192 + (tj + 4096);
function gpTile(ti, tj, make) {
  const k = gpKey(ti, tj); let t = GP.tiles.get(k);
  if (!t && make) { t = { id: new Uint8Array(16384), w: new Uint8Array(16384), l1: null, l2: null, l3: null }; GP.tiles.set(k, t); GP.n = GP.tiles.size; }
  return t;
}
function gpAny(x0, z0, size) {
  for (let i = Math.floor(x0 / 64); i <= Math.floor((x0 + size) / 64); i++) for (let j = Math.floor(z0 / 64); j <= Math.floor((z0 + size) / 64); j++) if (GP.tiles.has(gpKey(i, j))) return true;
  return false;
}
function digAny(x0, z0, size) {
  for (let i = Math.floor((x0 - 8) / 16); i <= Math.floor((x0 + size + 8) / 16); i++) for (let j = Math.floor((z0 - 8) / 16); j <= Math.floor((z0 + size + 8) / 16); j++) if (DIG.grid.has(digKey(i, j))) return true;
  return false;
}
// a level of a tile: 0 the points themselves (as eight weights), 1 every 2 m, 2 every 8 m, 3 the whole tile
function gpLevel(t, lv) {
  const key = 'l' + lv; if (t[key]) return t[key];
  const n = 128 >> (lv * 2), f = 128 / n, out = new Float32Array(Math.max(1, n * n) * 8);
  if (lv === 3) { const a = gpLevel(t, 2); for (let i = 0; i < 64; i++) for (let q = 0; q < 8; q++) out[q] += a[i * 8 + q] / 64; }
  else if (lv === 2) { const a = gpLevel(t, 1); for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) for (let b = 0; b < 4; b++) for (let c = 0; c < 4; c++) { const s = ((j * 4 + b) * 32 + i * 4 + c) * 8, o = (j * 8 + i) * 8; for (let q = 0; q < 8; q++) out[o + q] += a[s + q] / 16; } }
  else for (let j = 0; j < 32; j++) for (let i = 0; i < 32; i++) {
    const o = (j * 32 + i) * 8;
    for (let b = 0; b < f; b++) for (let c = 0; c < f; c++) { const s = (j * f + b) * 128 + i * f + c, w = t.w[s]; if (w) out[o + t.id[s]] += w / (255 * f * f); }
  }
  return (t[key] = out);
}
function gpDirty(t) { t.l1 = t.l2 = t.l3 = null; }
// the weights at a point, as a chunk with vertices st apart sees them (bilinear on the level that suits st); false when none
function gpWeights(x, z, st, out) {
  out.fill(0);
  let any = false;
  if (st <= 1) {
    const gx = x * 2, gz = z * 2, i = Math.floor(gx), j = Math.floor(gz), u = gx - i, v = gz - j;
    for (let c = 0; c < 4; c++) {
      const ii = i + (c & 1), jj = j + (c >> 1), t = GP.tiles.get(gpKey(ii >> 7, jj >> 7)); if (!t) continue;
      const s = (jj & 127) * 128 + (ii & 127), w = t.w[s]; if (!w) continue;
      out[t.id[s]] += (w / 255) * (c & 1 ? u : 1 - u) * (c >> 1 ? v : 1 - v); any = true;
    }
    return any;
  }
  const lv = st <= 4 ? 1 : st <= 16 ? 2 : 3, cell = lv === 1 ? 2 : lv === 2 ? 8 : 64, per = 64 / cell, off = cell / 2 - 0.25;
  const gx = (x - off) / cell, gz = (z - off) / cell, i = Math.floor(gx), j = Math.floor(gz), u = gx - i, v = gz - j;
  for (let c = 0; c < 4; c++) {
    const ii = i + (c & 1), jj = j + (c >> 1), ti = Math.floor(ii / per), tj = Math.floor(jj / per), t = GP.tiles.get(gpKey(ti, tj)); if (!t) continue;
    const a = gpLevel(t, lv), o = ((jj - tj * per) * per + (ii - ti * per)) * 8, f = (c & 1 ? u : 1 - u) * (c >> 1 ? v : 1 - v);
    for (let q = 0; q < 8; q++) if (a[o + q]) { out[q] += a[o + q] * f; any = true; }
  }
  return any;
}
// the world editor's say in what the cells grow (set in 41_editor): veg(ci, cj, trees) and rocks(ci, cj, rocks) return the lists
const ED_HOOK = { veg: null, rocks: null, grass: null };     // grass(x, z): 8 lush grass, 16 flowers painted there
let LAND_ON = false;      // scanned landforms reshape the land around them (31_landforms)
/* the ground without the scanned landforms (what they are fitted to), and the ground */
function terrainBare(x, z) {
  let h = hBase(x, z) + micro(x, z) + (DIG.list.length ? digOffset(x, z) : 0);
  if (EDT.n) h += edtAt(x, z);
  if (EDP.n) h = padAt(x, z, h);
  return EDS.n ? h + edsAt(x, z) : h;      // (after the pads: a pool sinks into a flat plot)
}
function terrainAt(x, z) { const h = terrainBare(x, z); return LAND_ON ? landTerrain(x, z, h) : h; }
const slopeAt = (x, z) => Math.hypot(terrainAt(x + 1, z) - terrainAt(x - 1, z), terrainAt(x, z + 1) - terrainAt(x, z - 1)) / 2;
function waterAt(x, z) {
  const w = waterBase(x, z);
  if (!EDW.list.length) return w;
  const l = lakeLevel(x, z); return l > w ? l : w;
}
function waterBase(x, z) {
  const fx = cellOf(x), fz = cellOf(z);
  if (fx < 0 || fz < 0 || fx >= WN - 1 || fz >= WN - 1) return 0;   // open sea beyond the map
  const i = Math.round(fx), j = Math.round(fz), w = WLV[j * WN + i];
  if (w > -1e8) return w;
  // look at the 4 neighbours (the grid was grown 2 cells past the banks)
  let best = -1e9; for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const v = WLV[(j + b) * WN + i + a]; if (v > best) best = v; }
  return best;
}
const biomeAt = (x, z) => near(BIO, x, z, 0);
const classAt = (x, z) => near(CLS, x, z, 0);
const cropAt = (x, z) => near(CROP, x, z, 0);
const moistAt = (x, z) => bil(MOI, x, z, 0) / 255;
const forestAt = (x, z) => bil(FOR, x, z, 0) / 255;
const tempAt = (x, z) => bil(TMP, x, z, 128) / 255;
const inPlay = (x, z) => Math.abs(x) < PLAY && Math.abs(z) < PLAY;

/* ───────── spatial grid: walkable platforms, solid colliders, camera occluders — all looked up by 32 m cells ───────── */
class SGrid {
  constructor(cell = 32) { this.cell = cell; this.map = new Map(); this.stamp = 1; }
  k(i, j) { return (i + 4096) * 8192 + (j + 4096); }
  insert(o, x0, z0, x1, z1) {
    const c = this.cell, cells = [];
    for (let i = Math.floor(x0 / c); i <= Math.floor(x1 / c); i++) for (let j = Math.floor(z0 / c); j <= Math.floor(z1 / c); j++) {
      const key = this.k(i, j); let a = this.map.get(key); if (!a) { a = []; this.map.set(key, a); } a.push(o); cells.push(key);
    }
    o._cells = cells; return o;
  }
  remove(o) {
    if (!o._cells) return;
    for (const key of o._cells) { const a = this.map.get(key); if (!a) continue; const i = a.indexOf(o); if (i >= 0) { a[i] = a[a.length - 1]; a.pop(); } if (!a.length) this.map.delete(key); }
    o._cells = null;
  }
  at(x, z) { return this.map.get(this.k(Math.floor(x / this.cell), Math.floor(z / this.cell))); }
  /* visit everything overlapping a box once */
  each(x0, z0, x1, z1, fn) {
    const c = this.cell, st = ++this.stamp;
    for (let i = Math.floor(x0 / c); i <= Math.floor(x1 / c); i++) for (let j = Math.floor(z0 / c); j <= Math.floor(z1 / c); j++) {
      const a = this.map.get(this.k(i, j)); if (!a) continue;
      for (let n = 0; n < a.length; n++) { const o = a[n]; if (o._st === st) continue; o._st = st; if (fn(o) === false) return; }
    }
  }
}
const PGRID = new SGrid(32), CGRID = new SGrid(16), OGRID = new SGrid(32);
const STEP_UP = 0.6;
const UPDATERS = [], LIGHT_ANCHORS = [];
/* an oriented box (turned by ry about the vertical): c, s are its cos and sin; world ↔ its own frame */
const oLocal = (o, x, z, out) => { const dx = x - o.x, dz = z - o.z; out[0] = dx * o.c - dz * o.s; out[1] = dx * o.s + dz * o.c; return out; };
const _ol = [0, 0];
function addPlatform(p) {
  if (p.t === 'orect' || p.t === 'oramp' || p.t === 'g') { if (p.c === undefined) { p.c = Math.cos(p.ry || 0); p.s = Math.sin(p.ry || 0); } p.cx = p.x; p.cz = p.z; const e = Math.hypot(p.hx, p.hz); PGRID.insert(p, p.x - e, p.z - e, p.x + e, p.z + e); return p; }
  if (p.t === 'rect' || p.t === 'ramp') { p.cx = (p.x0 + p.x1) / 2; p.cz = (p.z0 + p.z1) / 2; PGRID.insert(p, p.x0, p.z0, p.x1, p.z1); }
  else { p.cx = p.x; p.cz = p.z; PGRID.insert(p, p.x - p.r1, p.z - p.r1, p.x + p.r1, p.z + p.r1); }
  return p;
}
const removePlatform = (p) => PGRID.remove(p);
function platY(p, x, z, y) {
  if (p.t === 'rect') return (x > p.x0 && x < p.x1 && z > p.z0 && z < p.z1) ? p.y : -Infinity;
  if (p.t === 'orect') { oLocal(p, x, z, _ol); return Math.abs(_ol[0]) < p.hx && Math.abs(_ol[1]) < p.hz ? p.y : -Infinity; }
  // a turned ramp (stairs, a slope for cars): ya at its back edge (−z in its frame), yb at its front
  if (p.t === 'oramp') { oLocal(p, x, z, _ol); return Math.abs(_ol[0]) < p.hx && Math.abs(_ol[1]) < p.hz ? lerp(p.ya, p.yb, (_ol[1] + p.hz) / (2 * p.hz)) : -Infinity; }
  if (p.t === 'g') return edGridY(p, x, z, y);
  if (p.t === 'ramp') {
    if (!(x > p.x0 && x < p.x1 && z > p.z0 && z < p.z1)) return -Infinity;
    return p.axis === 'x' ? lerp(p.ya, p.yb, (x - p.x0) / (p.x1 - p.x0)) : lerp(p.ya, p.yb, (z - p.z0) / (p.z1 - p.z0));
  }
  if (p.t === 'deck') {   // a bridge or pier deck: a strip along a polyline
    if (x < p.bx0 || x > p.bx1 || z < p.bz0 || z > p.bz1) return -Infinity;
    const dx = p.x1 - p.x0, dz = p.z1 - p.z0, L2 = dx * dx + dz * dz || 1, t = clamp(((x - p.x0) * dx + (z - p.z0) * dz) / L2, 0, 1);
    if (Math.hypot(x - p.x0 - dx * t, z - p.z0 - dz * t) > p.hw) return -Infinity;
    return lerp(p.ya, p.yb, t);
  }
  const d = Math.hypot(x - p.x, z - p.z);
  if (d < p.r0 || d > p.r1) return -Infinity;
  if (p.t === 'ring') return p.y;
  let a = Math.atan2(z - p.z, x - p.x) - p.a0; a = (a % TAU + TAU) % TAU;
  const base = p.y0 + (a / TAU) * p.pitch;
  const k = Math.min(Math.floor((y + STEP_UP - base) / p.pitch), Math.floor((p.y1 - base) / p.pitch));
  return k < 0 ? -Infinity : base + k * p.pitch;
}
function addDeck(x0, z0, ya, x1, z1, yb, hw) {
  const p = { t: 'deck', x0, z0, x1, z1, ya, yb, hw, bx0: Math.min(x0, x1) - hw, bx1: Math.max(x0, x1) + hw, bz0: Math.min(z0, z1) - hw, bz1: Math.max(z0, z1) + hw };
  p.cx = (x0 + x1) / 2; p.cz = (z0 + z1) / 2; PGRID.insert(p, p.bx0, p.bz0, p.bx1, p.bz1); return p;
}
function groundAt(x, z, y = 1e9) {
  let h = terrainAt(x, z);
  const a = PGRID.at(x, z);
  if (a) for (let i = 0; i < a.length; i++) { const v = platY(a[i], x, z, y); if (v > h && v <= y + STEP_UP) h = v; }
  if (LAND_ON) { const v = landTop(x, z, y); if (v > h && v <= y + STEP_UP) h = v; }
  return h;
}
const onPlatform = (x, z, y) => groundAt(x, z, y) > terrainAt(x, z) + 0.05;
const colExt = (c) => (c.t === 'b' ? Math.max(c.hx, c.hz) : c.t === 'o' || c.t === 'g' ? Math.hypot(c.hx, c.hz) : c.r);
function addCollider(c) {
  if ((c.t === 'o' || c.t === 'g') && c.c === undefined) { c.c = Math.cos(c.ry || 0); c.s = Math.sin(c.ry || 0); }
  const e = colExt(c); c.ext = e + 3;
  CGRID.insert(c, c.x - e, c.z - e, c.x + e, c.z + e); return c;
}
function removeCollider(c) { CGRID.remove(c); }
function moveCollider(c, x, z) { CGRID.remove(c); c.x = x; c.z = z; const e = colExt(c); CGRID.insert(c, x - e, z - e, x + e, z + e); }
function resolveCollision(p, R) {
  CGRID.each(p.x - R - 0.5, p.z - R - 0.5, p.x + R + 0.5, p.z + R + 0.5, (c) => {
    if (c.off) return;
    if ((c.y0 !== undefined && p.y < c.y0) || (c.y1 !== undefined && p.y > c.y1)) return;
    if (c.t === 'c') {
      const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), m = c.r + R;
      if (d < m && d > 1e-6) { p.x = c.x + dx / d * m; p.z = c.z + dz / d * m; }
    } else if (c.t === 'g') { edGridPush(c, p, R);
    } else if (c.t === 'o') {
      // an oriented box: into its frame, pushed out as from a box, and back
      oLocal(c, p.x, p.z, _ol); const lx = _ol[0], lz = _ol[1];
      const qx = clamp(lx, -c.hx, c.hx), qz = clamp(lz, -c.hz, c.hz), dx = lx - qx, dz = lz - qz, d = Math.hypot(dx, dz);
      if (d >= R) return;
      let nx, nz;
      if (d > 1e-6) { nx = qx + dx / d * R; nz = qz + dz / d * R; }
      else { const ex = c.hx - Math.abs(lx), ez = c.hz - Math.abs(lz); if (ex < ez) { nx = Math.sign(lx || 1) * (c.hx + R); nz = lz; } else { nx = lx; nz = Math.sign(lz || 1) * (c.hz + R); } }
      p.x = c.x + nx * c.c + nz * c.s; p.z = c.z - nx * c.s + nz * c.c;
    } else if (c.t === 'b') {
      const qx = clamp(p.x, c.x - c.hx, c.x + c.hx), qz = clamp(p.z, c.z - c.hz, c.z + c.hz);
      const dx = p.x - qx, dz = p.z - qz, d = Math.hypot(dx, dz);
      if (d >= R) return;
      if (d > 1e-6) { p.x = qx + dx / d * R; p.z = qz + dz / d * R; }
      else { const ex = c.hx - Math.abs(p.x - c.x), ez = c.hz - Math.abs(p.z - c.z); if (ex < ez) p.x = c.x + Math.sign(p.x - c.x || 1) * (c.hx + R); else p.z = c.z + Math.sign(p.z - c.z || 1) * (c.hz + R); }
    } else {
      const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), m = c.r - R;
      if (d > m && d < c.r + 1.2) { p.x = c.x + dx / d * m; p.z = c.z + dz / d * m; }
    }
  });
}
function addOccluder(o) {
  if (o.t === 'c') OGRID.insert(o, o.x - o.r, o.z - o.r, o.x + o.r, o.z + o.r); else OGRID.insert(o, o.x - o.hx, o.z - o.hz, o.x + o.hx, o.z + o.hz);
  return o;
}
const removeOccluder = (o) => OGRID.remove(o);
/* the edge of the world: the open sea past 4 km turns you back */
function worldEdge(p) { const m = PLAY - 2; if (p.x > m) p.x = m; if (p.x < -m) p.x = -m; if (p.z > m) p.z = m; if (p.z < -m) p.z = -m; }
