/* ═════════ the ground's materials (45). Ground pictures (colour, normal, roughness, ambient occlusion, height), from a zip of
   ambientCG or Poly Haven or picked one by one, kept exactly as they came. The device draws them at the size it can hold
   (1K on a phone, 2K, 4K on a strong computer, «دقة خامات الأرض» in the settings): the originals stay untouched. In the
   editor they are painted on the ground with a brush that can also dig or raise the land under them, or put in place of one
   of the game's own grounds over the whole map. Layers on the GPU are filled one by one, copied when the array grows ═════════ */
const GM_LAYERS_AR = ['عشب', 'عشب كثيف', 'عشب يابس', 'أرض الغابة', 'إبر الصنوبر', 'تراب', 'أرض متشقّقة', 'رمل', 'صخر', 'حصى', 'ثلج', 'طين'];
const GMAT = {
  recs: new Map(),                 // id → { id, n, a, nm, r, ao, h, arm, dx, gloss, th, px, m, cr, t, src }
  pal: [null, null, null, null, null, null, null, null],   // the world's eight painted materials: 'b:L' (the game's layer L) or 'm:id'
  base: {},                        // the game's layers replaced everywhere: L → 'm:id'
  arr: null,                       // on the GPU: { a, n (arrays), S, cap, ids }
  busy: false, again: false, cur: 'b:7', mode: 'p', drag: true, pickL: -1, input: null, thumbs: new Map(), urls: new Map(),
};
const GM_BIG = 19.5 * 1048576;

/* ── the records: with the game (devmats) or on this device (IndexedDB «mats»), like the models ── */
async function gmInit() {
  const list = [];
  if (EDIO.db) {
    try { const q = await withTimeout(EDIO.db.collection('devmats').get(), 7000); if (q) for (const s of q.docs) if (s.exists) list.push(Object.assign({}, s.data(), { id: s.id, src: 'cloud' })); }
    catch (e) { console.warn('materials list', e); }
  }
  if (UPL.idbOK) {
    try {
      const d = await upIdb();
      if (d.objectStoreNames.contains('mats')) await new Promise((res) => {
        const t = d.transaction('mats', 'readonly'), c = t.objectStore('mats').openCursor();
        c.onsuccess = () => { const k = c.result; if (k) { list.push(Object.assign({}, k.value, { id: String(k.key), src: 'local' })); k.continue(); } };
        t.oncomplete = res; t.onerror = res;
      });
    } catch (e) { console.warn('local materials', e); }
  }
  list.sort((a, b) => (a.t || 0) - (b.t || 0));
  for (const R of list) GMAT.recs.set(R.id, R);
  if (list.length) console.log('ground materials', list.length);
}
async function gmSaveRec(R) {
  const body = {}; for (const k of Object.keys(R)) if (k !== 'id' && k !== 'src') body[k] = R[k];
  if (R.src === 'cloud') await EDIO.db.doc('devmats/' + R.id).set(body);
  else await upTx('mats', 'readwrite', (s) => s.put(body, R.id));
}
async function gmDelRec(R) { if (R.src === 'cloud') await EDIO.db.doc('devmats/' + R.id).delete(); else await upTx('mats', 'readwrite', (s) => s.delete(R.id)); }
// a file kept whole: a picture with the game's assets (or as text parts when it is bigger than they take), or on this device
async function gmPut(blob) {
  if (UPL.assets && blob.size > GM_BIG) {
    const b64 = edB64(new Uint8Array(await blob.arrayBuffer())), ids = [];
    try { for (let i = 0; i < b64.length; i += UP_CHUNK) ids.push(await upPut(new Blob([b64.slice(i, i + UP_CHUNK)], { type: 'text/plain' }), 'text/plain')); }
    catch (e) { for (const id of ids) upDrop(id); throw e; }
    return 'T:' + ids.join(',');
  }
  return upPut(blob, blob.type || 'image/jpeg');
}
async function gmBlob(ref) {
  if (ref.startsWith('T:')) { const parts = await Promise.all(ref.slice(2).split(',').map(upText)); return new Blob([b64Bytes(parts.join(''))]); }
  return upBlob(ref);
}
function gmDrop(ref) { if (!ref) return; if (ref.startsWith('T:')) for (const id of ref.slice(2).split(',')) upDrop(id); else upDrop(ref); }
const gmRefs = (R) => [R.a, R.nm, R.r, R.ao, R.h, R.arm, R.th].filter(Boolean);

/* ── on the GPU: two arrays of layers (colour + roughness; normal + height), filled and copied with WebGL itself ── */
function gmSize() {
  const gl = renderer.getContext(), max = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 4096;
  let S = SET.gmRes || qsel(512, 1024, 2048, max >= 16384 ? 4096 : 2048);
  return Math.max(256, Math.min(S, max, 4096));
}
function gmNewArr(S, cap) {
  const gl = renderer.getContext(), lv = Math.floor(Math.log2(S)) + 1;
  const mk = () => {
    const t = gl.createTexture(); renderer.state.bindTexture(gl.TEXTURE_2D_ARRAY, t);
    gl.texStorage3D(gl.TEXTURE_2D_ARRAY, lv, gl.RGBA8, S, S, cap);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.REPEAT);
    const ex = gl.getExtension('EXT_texture_filter_anisotropic'); if (ex) gl.texParameterf(gl.TEXTURE_2D_ARRAY, ex.TEXTURE_MAX_ANISOTROPY_EXT, MAX_ANISO);
    // three.js draws it as one of its own (version 0: it never uploads anything into it)
    // (its version and init marks match: three only binds it, never makes or fills one of its own in its place)
    const tx = new THREE.DataTexture2DArray(null, S, S, cap), pr = renderer.properties.get(tx);
    pr.__webglTexture = t; pr.__webglInit = true; pr.__version = tx.version;
    return { t, tx };
  };
  return { a: mk(), n: mk(), S, cap, ids: new Array(cap).fill(null) };
}
function gmFree(A) { const gl = renderer.getContext(); gl.deleteTexture(A.a.t); gl.deleteTexture(A.n.t); renderer.properties.remove(A.a.tx); renderer.properties.remove(A.n.tx); }
function gmLayer(T, i, S, data) {
  const gl = renderer.getContext(); renderer.state.bindTexture(gl.TEXTURE_2D_ARRAY, T.t);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
  gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, i, S, S, 1, gl.RGBA, gl.UNSIGNED_BYTE, data);
}
function gmMips(A) { const gl = renderer.getContext(); for (const T of [A.a, A.n]) { renderer.state.bindTexture(gl.TEXTURE_2D_ARRAY, T.t); gl.generateMipmap(gl.TEXTURE_2D_ARRAY); } }
// a bigger array: the layers already there copied across on the GPU (nothing read again)
function gmCopy(A, B) {
  const gl = renderer.getContext(), fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER, fb);
  for (const k of ['a', 'n']) {
    renderer.state.bindTexture(gl.TEXTURE_2D_ARRAY, B[k].t);
    for (let i = 0; i < A.cap; i++) if (A.ids[i]) { gl.framebufferTextureLayer(gl.READ_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, A[k].t, 0, i); gl.copyTexSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, i, 0, 0, A.S, A.S); }
  }
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null); gl.deleteFramebuffer(fb);
  for (let i = 0; i < A.cap; i++) B.ids[i] = A.ids[i];
  gmMips(B); renderer.resetState();
}
// a picture at the layer's size (the browser's own careful scaling), its pixels as they are in the file
async function gmPixels(ref, S, data) {
  const blob = await gmBlob(ref);
  let bmp = null;
  const o = { resizeWidth: S, resizeHeight: S, resizeQuality: 'high', premultiplyAlpha: 'none', colorSpaceConversion: data ? 'none' : 'default' };
  try { bmp = await createImageBitmap(blob, o); } catch (_) { bmp = await upDecode(blob, S, S); }
  const cv = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(S, S) : Object.assign(document.createElement('canvas'), { width: S, height: S });
  const g = cv.getContext('2d', { willReadFrequently: true }); g.drawImage(bmp, 0, 0, S, S); if (bmp.close) bmp.close();
  return g.getImageData(0, 0, S, S).data;
}
// one material as two layers: colour (with its ambient occlusion) + roughness; normal (OpenGL way up) + height
async function gmPack(R, S) {
  const n = S * S, A = new Uint8Array(n * 4), N = new Uint8Array(n * 4);
  const col = await gmPixels(R.a, S, false);
  const ao = R.ao ? await gmPixels(R.ao, S, true).catch(() => null) : null;
  const ro = R.r ? await gmPixels(R.r, S, true).catch(() => null) : null;
  const arm = !ro && R.arm ? await gmPixels(R.arm, S, true).catch(() => null) : null;
  for (let i = 0; i < n; i++) {
    const o = i * 4, k = ao ? 0.45 + 0.55 * ao[o] / 255 : arm ? 0.45 + 0.55 * arm[o] / 255 : 1;
    A[o] = col[o] * k; A[o + 1] = col[o + 1] * k; A[o + 2] = col[o + 2] * k;
    A[o + 3] = ro ? (R.gloss ? 255 - ro[o] : ro[o]) : arm ? arm[o + 1] : 215;
  }
  const nm = R.nm ? await gmPixels(R.nm, S, true).catch(() => null) : null;
  const hh = R.h ? await gmPixels(R.h, S, true).catch(() => null) : null;
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    if (nm) { N[o] = nm[o]; N[o + 1] = R.dx ? 255 - nm[o + 1] : nm[o + 1]; N[o + 2] = nm[o + 2]; } else { N[o] = 128; N[o + 1] = 128; N[o + 2] = 255; }
    N[o + 3] = hh ? hh[o] : (col[o] + col[o + 1] + col[o + 2]) / 3;
  }
  return { A, N };
}
// which of the owner's materials the world draws now
function gmWanted() {
  const out = [];
  const add = (k) => { if (k && k[0] === 'm') { const id = k.slice(2); if (GMAT.recs.has(id) && !out.includes(id)) out.push(id); } };
  GMAT.pal.forEach(add); for (const L of Object.keys(GMAT.base)) add(GMAT.base[L]);
  return out;
}
function gmUniforms() {
  const A = GMAT.arr, slot = (id) => (A ? A.ids.indexOf(id) : -1);
  const pal = TERR_U.uPal.value, rm = TERR_U.uRemap.value, us = TERR_U.uUS.value;
  for (let i = 0; i < 8; i++) {
    const k = GMAT.pal[i];
    pal[i] = !k ? -1 : k[0] === 'b' ? 100 + +k.slice(2) : slot(k.slice(2)) >= 0 ? slot(k.slice(2)) : 105;   // (until its pictures are in: earth)
  }
  for (let L = 0; L < 12; L++) { const k = GMAT.base[L]; rm[L] = !k ? -1 : k[0] === 'b' ? (+k.slice(2) === L ? -1 : 100 + +k.slice(2)) : slot(k.slice(2)); }
  if (A) for (let i = 0; i < A.cap && i < 20; i++) { const R = A.ids[i] && GMAT.recs.get(A.ids[i]); us[i] = 1 / clamp((R && R.m) || 2, 0.2, 40); }
}
async function gmRefresh(again) {
  if (GMAT.busy) { GMAT.again = true; return; }
  if (again && GMAT.arr) { gmFree(GMAT.arr); GMAT.arr = null; TERR_U.uUAlb.value = TERR_U.uUNrm.value = null; gmEmpty(); }
  const want = gmWanted(), S = gmSize();
  let A = GMAT.arr;
  if (!want.length && !A) { gmUniforms(); return; }
  if (A && want.every((id) => A.ids.includes(id))) { gmUniforms(); return; }
  GMAT.busy = true;
  try {
    const missing = want.filter((id) => !A || !A.ids.includes(id));
    const free = A ? A.ids.filter((id) => !id || !want.includes(id)).length : 0;
    if (!A || missing.length > free) {
      const keep = A ? A.ids.filter((id) => id && want.includes(id)).length : 0;
      const cap = Math.min(20, Math.max(4, Math.ceil((keep + missing.length) / 4) * 4));
      const B = gmNewArr(S, cap);
      if (A) { if (A.S === S && A.cap <= cap) gmCopy(A, B); gmFree(A); }
      GMAT.arr = A = B; TERR_U.uUAlb.value = A.a.tx; TERR_U.uUNrm.value = A.n.tx;
    }
    for (const id of missing) {
      const R = GMAT.recs.get(id); if (!R) continue;
      let i = A.ids.indexOf(null); if (i < 0) i = A.ids.findIndex((q) => !want.includes(q)); if (i < 0) break;
      try {
        const P = await gmPack(R, A.S);
        if (GMAT.arr !== A) break;
        gmLayer(A.a, i, A.S, P.A); gmLayer(A.n, i, A.S, P.N); A.ids[i] = id; gmMips(A);
      } catch (e) { console.warn('ground material', R.n, e); }
      gmUniforms();
    }
    gmUniforms();
  } catch (e) { console.warn('ground materials', e); }
  finally { GMAT.busy = false; if (GMAT.again) { GMAT.again = false; gmRefresh(); } }
}
function gmEmpty() { const e = () => { const t = new THREE.DataTexture2DArray(new Uint8Array([128, 128, 128, 230]), 1, 1, 1); t.needsUpdate = true; return t; }; TERR_U.uUAlb.value = e(); TERR_U.uUNrm.value = e(); }

/* ── pictures for the cards: the game's grounds from its own strip, the owner's from their thumbnails ── */
function gmBaseThumb(L) {
  const key = 'b:' + L; let u = GMAT.thumbs.get(key); if (u) return u;
  const T = TEXA.alb; if (!T || !T.image || !T.image.data) return '';
  const w = T.image.width, h = T.image.height, cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d'), img = g.createImageData(w, h); img.data.set(T.image.data.subarray(L * w * h * 4, (L + 1) * w * h * 4)); g.putImageData(img, 0, 0);
  const sm = document.createElement('canvas'); sm.width = sm.height = 112; const g2 = sm.getContext('2d'); g2.imageSmoothingQuality = 'high'; g2.drawImage(cv, 0, 0, 112, 112);
  u = sm.toDataURL('image/jpeg', 0.85); GMAT.thumbs.set(key, u); return u;
}
function gmThumb(k) {
  if (!k) return '';
  if (k[0] === 'b') return gmBaseThumb(+k.slice(2));
  const R = GMAT.recs.get(k.slice(2)); if (!R || !R.th) return '';
  if (R.th.startsWith('T:')) return '';
  if (R.th[0] !== 'L') return '/_blob/' + R.th;
  const u = GMAT.urls.get(R.th); if (u) return u;
  upURL(R.th).then((x) => { GMAT.urls.set(R.th, x); if (ED.on && !$('edCat').classList.contains('gone') && EDUI.cat === 'gmat') edCatGrid(); if (ED.on && ED.tool === 'paint') edCtx(); }).catch(() => {});
  return '';
}
const gmName = (k) => (!k ? '' : k[0] === 'b' ? GM_LAYERS_AR[+k.slice(2)] : (GMAT.recs.get(k.slice(2)) || { n: 'خامة' }).n);

/* ── the paint: a slot of the world's eight for a material; the brush; undo; kept with the world ── */
function gmSlot(k) {
  let i = GMAT.pal.indexOf(k); if (i >= 0) return i;
  i = GMAT.pal.indexOf(null);
  if (i < 0) {         // all eight taken: one that lies nowhere any more is free again
    const used = new Set(); for (const t of GP.tiles.values()) for (let s = 0; s < 16384; s++) if (t.w[s]) used.add(t.id[s]);
    i = GMAT.pal.findIndex((_, q) => !used.has(q));
  }
  if (i < 0) { edToast('ثماني خامات في العالم الواحد', 'امسح إحداها من الأرض أولاً لتحلّ محلها'); return -1; }
  GMAT.pal[i] = k; gmRefresh(); gmUniforms();
  return i;
}
const GPB = { snap: null, last: 0, x0: 1e9, z0: 1e9, x1: -1e9, z1: -1e9 };
function gpTake(key) { if (GPB.snap && !GPB.snap.has(key)) { const t = GP.tiles.get(key); GPB.snap.set(key, t ? { id: t.id.slice(), w: t.w.slice() } : null); } }
function gpPaint(px, pz, r, amt, slot) {
  const erase = slot < 0, i0 = Math.floor((px - r) * 2), i1 = Math.ceil((px + r) * 2), j0 = Math.floor((pz - r) * 2), j1 = Math.ceil((pz + r) * 2), seen = new Set();
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const dd = Math.hypot(i * 0.5 - px, j * 0.5 - pz); if (dd >= r) continue;
    const key = gpKey(i >> 7, j >> 7); gpTake(key);
    let t = GP.tiles.get(key); if (!t) { if (erase) continue; t = gpTile(i >> 7, j >> 7, true); }
    const s = (j & 127) * 128 + (i & 127), f = (1 - (dd / r) ** 2) ** 1.5, add = Math.floor(amt * f * 255 + Math.random());
    if (!add) continue;
    let w = t.w[s], id = t.id[s];
    if (erase) w = Math.max(0, w - add);
    else if (id === slot || !w) { id = slot; w = Math.min(255, w + add); }
    else { w -= add * 2; if (w < 0) { id = slot; w = Math.min(255, -w); } }
    t.w[s] = w; t.id[s] = w ? id : 0;
    if (!seen.has(key)) { seen.add(key); gpDirty(t); }
  }
  GP.ver++;
  GPB.x0 = Math.min(GPB.x0, px - r); GPB.z0 = Math.min(GPB.z0, pz - r); GPB.x1 = Math.max(GPB.x1, px + r); GPB.z1 = Math.max(GPB.z1, pz + r);
}
// painted with something other than grass: no grass grows there
const GP_W = new Float32Array(8);
function gpBare(x, z) {
  if (!gpWeights(x, z, 0.5, GP_W)) return false;
  let w = 0; for (let i = 0; i < 8; i++) { const k = GMAT.pal[i]; if (GP_W[i] && !(k === 'b:0' || k === 'b:1' || k === 'b:2')) w += GP_W[i]; }
  return w > 0.45;
}
function gpFlush() {
  if (GPB.x0 > GPB.x1) return;
  TERRAIN.dirtyArea((GPB.x0 + GPB.x1) / 2, (GPB.z0 + GPB.z1) / 2, Math.max(GPB.x1 - GPB.x0, GPB.z1 - GPB.z0) / 2 + 1);
  grassDirtyArea((GPB.x0 + GPB.x1) / 2, (GPB.z0 + GPB.z1) / 2, Math.max(GPB.x1 - GPB.x0, GPB.z1 - GPB.z0) / 2 + 1);
  GPB.x0 = GPB.z0 = 1e9; GPB.x1 = GPB.z1 = -1e9;
}
function gpSetTile(key, v) {
  if (v) { const ti = Math.floor(key / 8192) - 4096, tj = (key % 8192) - 4096, t = gpTile(ti, tj, true); t.id.set(v.id); t.w.set(v.w); gpDirty(t); }
  else { GP.tiles.delete(key); GP.n = GP.tiles.size; }
  GP.ver++;
  const ti = Math.floor(key / 8192) - 4096, tj = (key % 8192) - 4096;
  TERRAIN.dirtyArea(ti * 64 + 32, tj * 64 + 32, 46); grassDirtyArea(ti * 64 + 32, tj * 64 + 32, 46);
}
// undo steps of the ground tool (from edDoOp): paint tiles back or forward; a game ground put back
function gmDoOp(op, back) {
  if (op.t === 'gp') for (const [k, a, b] of op.ch) gpSetTile(k, back ? a : b);
  else if (op.t === 'gb') { const v = back ? op.a : op.b; if (v) GMAT.base[op.L] = v; else delete GMAT.base[op.L]; gmRefresh(); gmUniforms(); }
}
function gmBrushStart(g) {
  edBrushStart(g); GPB.snap = new Map(); GPB.last = 0;
  if (GMAT.mode !== 'e' && gmSlot(GMAT.cur) < 0) { EDB.on = false; GPB.snap = null; }
}
function gmBrushStep(dt) {
  if (!EDB.on || !EDB.have || !GPB.snap) return;
  const m = GMAT.mode, r = ED.br, k = ED.bk;
  if (m === 'd' || m === 'u' || m === 'f') edBrushStep(dt, m === 'd' ? 'lower' : m === 'u' ? 'raise' : 'flat');
  const slot = m === 'e' ? -1 : GMAT.pal.indexOf(GMAT.cur);
  if (m === 'e' || slot >= 0) gpPaint(EDB.x, EDB.z, r, Math.min(1, k * (m === 'p' || m === 'e' ? 3.2 : 5) * dt), slot);
  const now = performance.now(); if (now - GPB.last > 110) { GPB.last = now; gpFlush(); }
}
function gmBrushEnd() {
  if (!EDB.on) { GPB.snap = null; return; }
  EDB.on = false;
  const ops = [], ch = [];
  if (EDB.snap) { for (const [key, before] of EDB.snap) { const a = EDT.ch.get(key); ch.push([key, before, a ? a.slice() : null]); } EDB.snap = null; }
  if (ch.length) ops.push({ t: 'ter', ch });
  const gch = [];
  if (GPB.snap) for (const [key, before] of GPB.snap) { const t = GP.tiles.get(key); gch.push([key, before, t ? { id: t.id.slice(), w: t.w.slice() } : null]); }
  GPB.snap = null;
  if (gch.length) ops.push({ t: 'gp', ch: gch });
  if (ops.length) edOp(ops.length === 1 ? ops[0] : { t: 'multi', ops });
  gpFlush(); edFlush(true);
}
// kept with the world: the eight, the replaced grounds, and the painted tiles (runs of equal points)
function gpPack() {
  const p = {};
  for (const [key, t] of GP.tiles) {
    const out = []; let any = false;
    for (let i = 0; i < 16384;) { const w = t.w[i], id = w ? t.id[i] : 0; let n = 1; while (i + n < 16384 && n < 255 && t.w[i + n] === w && (w ? t.id[i + n] : 0) === id) n++; out.push(n, id, w); if (w) any = true; i += n; }
    if (any) p[key] = edB64(Uint8Array.from(out));
  }
  return { pal: GMAT.pal.slice(), base: Object.assign({}, GMAT.base), p };
}
function gpUnpack(G) {
  GP.tiles.clear(); GP.n = 0;
  GMAT.pal = [null, null, null, null, null, null, null, null]; GMAT.base = {};
  if (G) {
    (G.pal || []).slice(0, 8).forEach((k, i) => { GMAT.pal[i] = typeof k === 'string' ? k : null; });
    for (const [L, k] of Object.entries(G.base || {})) if (typeof k === 'string' && +L >= 0 && +L < 12) GMAT.base[+L] = k;
    for (const [ks, b] of Object.entries(G.p || {})) {
      const key = +ks, ti = Math.floor(key / 8192) - 4096, tj = (key % 8192) - 4096, u = b64Bytes(b), t = gpTile(ti, tj, true);
      for (let q = 0, i = 0; q + 2 < u.length && i < 16384; q += 3) { const n = u[q]; t.id.fill(u[q + 1] & 7, i, Math.min(16384, i + n)); t.w.fill(u[q + 2], i, Math.min(16384, i + n)); i += n; }
    }
  }
  GP.ver++;
  for (const key of GP.tiles.keys()) { const ti = Math.floor(key / 8192) - 4096, tj = (key % 8192) - 4096; TERRAIN.dirtyArea(ti * 64 + 32, tj * 64 + 32, 46); grassDirtyArea(ti * 64 + 32, tj * 64 + 32, 46); }
  gmRefresh(); gmUniforms();
}
function gpClear() { const had = [...GP.tiles.keys()]; GP.tiles.clear(); GP.n = 0; GP.ver++; for (const key of had) gpSetTile(key, null); GMAT.pal.fill(null); GMAT.base = {}; gmUniforms(); }

/* ── a material from files: a zip (ambientCG, Poly Haven, anywhere) or pictures picked together; its maps by their names ── */
const GM_MAPS = [
  ['skip', /(preview|sphere|thumb|_cube|swatch|render)/],
  ['nm', /(normal[ _-]?gl|nor[ _-]?gl|normal[ _-]?dx|nor[ _-]?dx|normal|nrm|_nor(?![a-z]))/],
  ['r', /(roughness|rough|_rgh)/], ['gloss', /(glossiness|gloss)/],
  ['ao', /(ambient[ _-]?occlusion|occlusion|[_ -]ao(?![a-z]))/], ['arm', /([_ -](arm|orm)(?![a-z]))/],
  ['h', /(displacement|_disp(?![a-z])|height|bump)/],
  ['metal', /(metalness|metallic|_metal)/], ['op', /(opacity|alpha|mask)/],
  ['a', /(albedo|base[ _-]?colou?r|diffuse|_diff(?![a-z])|_colou?r|_col(?![a-z])|_basecolor|_alb(?![a-z]))/],
];
const GM_IMG = new Set(['jpg', 'jpeg', 'png', 'webp', 'tif', 'tiff', 'bmp']);
function gmKind(name) {
  const n = name.toLowerCase().replace(/\.[a-z0-9]+$/, '');
  for (const [k, re] of GM_MAPS) { const m = n.match(re); if (m) return { k, base: (n.slice(0, m.index) + n.slice(m.index + m[0].length)).replace(/[_ -]?\d+k(?:[_ -](jpg|png|exr))?/g, '').replace(/[_ .-]+$/, '').replace(/^.*\//, '') }; }
  return { k: 'a?', base: n.replace(/^.*\//, '') };
}
// the picked files as materials: { name, maps: { a, nm, r, … } }
async function gmGroups(files) {
  const all = [];
  for (const f of files) {
    const ext = UP_EXT(f.name);
    if (ext === 'zip') { for (const en of await upUnzip(f)) { if (!GM_IMG.has(UP_EXT(en.name))) continue; all.push({ name: en.name, blob: new Blob([await upZipData(en)], { type: UP_EXT(en.name) === 'png' ? 'image/png' : 'image/jpeg' }), zip: f.name }); } }
    else if (GM_IMG.has(ext)) all.push({ name: f.name, blob: f, zip: '' });
  }
  const by = new Map();
  for (const it of all) {
    const q = gmKind(it.name); if (q.k === 'skip' || q.k === 'metal' || q.k === 'op') continue;
    const key = (it.zip ? it.zip.toLowerCase() + '|' : '') + q.base;
    let g = by.get(key); if (!g) by.set(key, g = { name: upClean(q.base || it.zip), maps: {}, size: {} });
    const k = q.k === 'a?' ? 'a' : q.k;
    if (k === 'nm' && /dx/.test(it.name.toLowerCase()) && g.maps.nm && !g.dx) continue;      // the OpenGL normal when both came
    if (k === 'nm') g.dx = /dx/.test(it.name.toLowerCase());
    if (!g.maps[k] || (k === 'a' && q.k === 'a' && g.loose)) { g.maps[k] = it.blob; if (q.k === 'a?') g.loose = true; else if (k === 'a') g.loose = false; }
  }
  // a zip whose names say nothing: one picture is its colour
  return [...by.values()].filter((g) => g.maps.a);
}
async function gmImport(G, tag, cr) {
  const step = (m, p) => upShow(G.name + tag, m, p);
  const R = { id: 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), n: G.name.slice(0, 40), m: G.m || 2, cr: cr || null, t: Date.now(), v: 1, src: UPL.assets && EDIO.db ? 'cloud' : 'local', dx: G.dx ? 1 : 0 };
  if (R.src === 'local' && !UPL.idbOK) throw upErr('لا مكان لحفظ الخامات على هذا الجهاز');
  const head = new Uint8Array(await G.maps.a.slice(0, 65536).arrayBuffer()), sz = upImgSize(head, upSniff(head)); R.px = sz ? Math.max(sz[0], sz[1]) : 0;
  const refs = [];
  try {
    const keys = ['a', 'nm', 'r', 'gloss', 'ao', 'arm', 'h'].filter((k) => G.maps[k]);
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i]; step((R.src === 'cloud' ? 'رفع ' : 'حفظ ') + ({ a: 'اللون', nm: 'التضاريس الدقيقة', r: 'الخشونة', gloss: 'اللمعان', ao: 'الظلال', arm: 'الخشونة', h: 'الارتفاع' })[k], 0.05 + 0.8 * i / keys.length);
      const ref = await gmPut(G.maps[k]); refs.push(ref);
      if (k === 'gloss') { R.r = ref; R.gloss = 1; } else R[k] = ref;
    }
    step('صورة المعاينة', 0.88);
    try {
      const bmp = await createImageBitmap(G.maps.a, { resizeWidth: 160, resizeHeight: 160, resizeQuality: 'high' }), cv = document.createElement('canvas'); cv.width = cv.height = 160;
      cv.getContext('2d').drawImage(bmp, 0, 0); if (bmp.close) bmp.close();
      let b = await upToBlob(cv, 'image/webp', 0.82); if (!b || b.type !== 'image/webp') b = await upToBlob(cv, 'image/jpeg', 0.85);
      R.th = await upPut(b, b.type); refs.push(R.th);
    } catch (e) { console.warn('material thumb', e); }
    step('تسجيل الخامة', 0.96);
    await gmSaveRec(R);
  } catch (e) { for (const r of refs) gmDrop(r); throw e; }
  GMAT.recs.set(R.id, R);
  return R;
}
async function gmFiles(files, quiet) {
  const groups = await gmGroups(files);
  if (!groups.length) return null;
  const done = [];
  for (let i = 0; i < groups.length; i++) {
    try { done.push(await gmImport(groups[i], groups.length > 1 ? ' (' + toAr(i + 1) + ' من ' + toAr(groups.length) + ')' : '')); }
    catch (e) { console.warn('material', groups[i].name, e); if (groups.length === 1) throw e; }
  }
  if (!quiet && done.length) gmAfterImport(done);
  return done;
}
function gmAfterImport(done) {
  upHide();
  const R = done[done.length - 1];
  GMAT.cur = 'm:' + R.id;
  if (ED.on) { EDUI.cat = 'gmat'; EDUI.q = ''; $('edSearch').value = ''; edCatOpen(true); }
  edToast(done.length === 1 ? 'أُضيفت خامة «' + R.n + '»' : 'أُضيفت ' + toAr(done.length) + ' خامات', 'اخترها وارسم بها على الأرض · ' + (R.src === 'cloud' ? 'محفوظة مع لعبتك' : 'محفوظة على هذا الجهاز'));
}
function gmPick() {
  if (UPL.busy) { edToast('جارٍ رفع ملف', 'انتظر حتى ينتهي'); return; }
  if (!upCanUp()) { edToast('الرفع غير متاح هنا', ''); return; }
  let inp = GMAT.input;
  if (!inp) {
    inp = GMAT.input = document.createElement('input'); inp.type = 'file'; inp.multiple = true; inp.accept = '.zip,image/*'; inp.style.display = 'none'; document.body.appendChild(inp);
    inp.addEventListener('change', async () => {
      const fs = [...inp.files]; inp.value = ''; if (!fs.length) return;
      UPL.busy = true; upShow('خامة أرض', 'قراءة الملفات', 0.02);
      try { const d = await gmFiles(fs); if (!d) throw upErr('لم أجد صورة لون في الملفات (Color أو Albedo أو Diffuse)'); }
      catch (e) { console.warn('material upload', e); upFail(e && e.ui ? e.ui : 'تعذّر حفظ الخامة', e && e.ui ? '' : String((e && e.message) || e).slice(0, 90)); }
      finally { UPL.busy = false; }
    });
  }
  inp.click();
}
function gmDelete(id) {
  const R = GMAT.recs.get(id); if (!R) return;
  const k = 'm:' + id, inUse = GMAT.pal.includes(k) || Object.values(GMAT.base).includes(k);
  edCatOpen(false);
  upAsk('حذف خامة «' + R.n + '»' + (inUse ? ' (مرسومة في العالم: تعود الأرض كما كانت)' : '') + '؟', 'احذف', async () => {
    try { await gmDelRec(R); } catch (e) { console.warn('material delete', e); edToast('تعذّر الحذف', ''); return; }
    for (const ref of gmRefs(R)) gmDrop(ref);
    GMAT.recs.delete(id);
    const i = GMAT.pal.indexOf(k); if (i >= 0) { for (const t of GP.tiles.values()) for (let s = 0; s < 16384; s++) if (t.w[s] && t.id[s] === i) t.w[s] = 0; GMAT.pal[i] = null; for (const key of [...GP.tiles.keys()]) gpSetTile(key, GP.tiles.get(key)); }
    for (const L of Object.keys(GMAT.base)) if (GMAT.base[L] === k) delete GMAT.base[L];
    if (GMAT.cur === k) GMAT.cur = 'b:7';
    if (inUse) { ED.ver++; edStatus(); }
    gmRefresh(); gmUniforms(); edToast('حُذفت الخامة', inUse ? 'احفظ ليبقى العالم بدونها' : '');
  });
}

/* ── the editor: the ground tool's panel, the materials in the catalogue, the whole map's grounds ── */
function gmCtx() {
  const k = GMAT.cur, th = gmThumb(k), esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  let h = `<button type="button" class="edc gmcur" data-act="gm:pick" aria-label="اختر الخامة">${th ? `<img src="${th}" alt="">` : edSvg('gmat')}<span>${esc(gmName(k))}</span></button>`;
  for (const [m, ic, lb] of [['p', 'paint', 'ارسم'], ['d', 'lower', 'احفر'], ['u', 'raise', 'ارفع'], ['f', 'flat', 'سوِّ'], ['e', 'erase', 'امسح الرسم']]) h += edBtn('gm:m:' + m, ic, lb, { on: GMAT.mode === m });
  const R = k[0] === 'm' && GMAT.recs.get(k.slice(2));
  if (R && upCanDel({ src: R.src })) h += edStep('gm:t', 'width', 'حجم الصورة على الأرض', edAr(R.m || 2) + 'م');
  h += `<label class="edrng"><span>الحجم <b data-rv="br">${edAr(ED.br)}م</b></span><input type="range" data-rng="br" min="1" max="80" step="0.5" value="${ED.br}"></label>`;
  h += `<label class="edrng"><span>القوة <b data-rv="bk">${toAr(Math.round(ED.bk * 100))}٪</b></span><input type="range" data-rng="bk" min="0.1" max="1" step="0.05" value="${ED.bk}"></label>`;
  h += edBtn('gm:drag', GMAT.drag ? 'paint' : 'sel', GMAT.drag ? 'السحب يرسم' : 'السحب يحرّك الدائرة', { on: !GMAT.drag });
  if (!GMAT.drag) h += edBtn('gm:go', 'play', 'طبّق هنا', { hold: true });
  h += edBtn('gm:base', 'land', 'أرضية الخريطة');
  return h;
}
function gmAct(act) {
  if (act === 'gm:t+' || act === 'gm:t-') {
    const R = GMAT.cur[0] === 'm' && GMAT.recs.get(GMAT.cur.slice(2)); if (!R) return;
    R.m = +clamp((R.m || 2) * (act === 'gm:t+' ? 1.12 : 1 / 1.12), 0.25, 40).toPrecision(3); gmUniforms(); edCtx();
    clearTimeout(GMAT.saveT); GMAT.saveT = setTimeout(() => gmSaveRec(R).catch((e) => console.warn('material size', e)), 900);
    return;
  }
  if (act === 'gm:pick') { EDUI.cat = 'gmat'; EDUI.q = ''; $('edSearch').value = ''; edCatOpen(true); return; }
  if (act.startsWith('gm:m:')) { GMAT.mode = act.slice(5); edCtx(); return; }
  if (act === 'gm:drag') { GMAT.drag = !GMAT.drag; edCtx(); edToast(GMAT.drag ? 'اسحب على الأرض لترسم' : 'اسحب لتحريك الدائرة', GMAT.drag ? '' : 'ثم اضغط «طبّق هنا» مطوّلاً'); return; }
  if (act === 'gm:go') {
    if (EDB.on) return;
    const x = EP.hover ? EP.hover[0] : EDC.x, z = EP.hover ? EP.hover[1] : EDC.z;
    gmBrushStart({ x, z }); edBrushRing(x, z); ED_LINE.brush.visible = true;
    const end = () => { removeEventListener('pointerup', end, true); removeEventListener('pointercancel', end, true); gmBrushEnd(); };
    addEventListener('pointerup', end, true); addEventListener('pointercancel', end, true);
    return;
  }
  if (act === 'gm:base') { GMAT.pickL = -1; EDUI.cat = 'gmat'; EDUI.q = ''; $('edSearch').value = ''; edCatOpen(true); setTimeout(() => { const el = document.querySelector('#edGrid .edsec[data-sec="base"]'); if (el) el.scrollIntoView({ block: 'start' }); }, 30); return; }
}
// the catalogue's «خامات الأرض»: upload, the internet's libraries, the owner's materials, the game's grounds, the whole map's grounds
function gmCards() {
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const card = (k, extra = '') => { const th = gmThumb(k), on = GMAT.cur === k; return `<button type="button" class="edcard gmcard${on ? ' on' : ''}" data-gm="${k}">${th ? `<img src="${th}" alt="" loading="lazy" decoding="async">` : `<span class="edph">${edSvg('gmat')}</span>`}<span class="ednm">${esc(gmName(k))}</span>${extra}</button>`; };
  const can = upCanUp();
  let h = `<p class="edupinfo">${GMAT.pickL >= 0 ? 'اختر خامة تحلّ محلّ «' + GM_LAYERS_AR[GMAT.pickL] + '» في كل الخريطة، أو الخامة نفسها لإرجاعها' : 'اختر خامة ثم ارسم بها على الأرض، احفر أو ارفع بها · الملفات الأصلية تُحفظ كما هي بدقتها الكاملة'}</p>`;
  h += `<button type="button" class="edcard edup${can ? '' : ' off'}" data-gmup="1"${can ? '' : ' disabled'}><span class="edph">${edSvg('upl')}</span><span class="ednm">ارفع خامة من جهازك (zip أو صور)</span></button>`;
  h += `<button type="button" class="edcard edup" data-net="mat"><span class="edph">${edSvg('web')}</span><span class="ednm">مكتبات الإنترنت: ambientCG · Poly Haven</span></button>`;
  const mine = [...GMAT.recs.values()];
  if (mine.length) { h += '<p class="edsec">خاماتك</p>'; for (const R of mine) h += card('m:' + R.id, upCanDel({ src: R.src }) ? `<span class="eddel" data-gmdel="${R.id}" role="button" aria-label="حذف الخامة">${edSvg('del')}</span>` : ''); }
  h += '<p class="edsec">أرضيات اللعبة</p>';
  for (let L = 0; L < 12; L++) h += card('b:' + L);
  h += '<p class="edsec" data-sec="base">أرضية الخريطة كلها: المس أرضاً ثم اختر خامتها</p>';
  for (let L = 0; L < 12; L++) {
    const k = GMAT.base[L] || 'b:' + L, th = gmThumb(k);
    h += `<button type="button" class="edcard gmcard gmbase${GMAT.pickL === L ? ' on' : ''}" data-gmb="${L}">${th ? `<img src="${th}" alt="" loading="lazy">` : `<span class="edph">${edSvg('gmat')}</span>`}<span class="ednm">${GM_LAYERS_AR[L]}${GMAT.base[L] ? ' ← ' + esc(gmName(k)) : ''}</span></button>`;
  }
  return h;
}
function gmCardTap(k) {
  if (GMAT.pickL >= 0) {
    const L = GMAT.pickL, a = GMAT.base[L] || null, b = k === 'b:' + L ? null : k;
    GMAT.pickL = -1;
    if (a !== b) { if (b) GMAT.base[L] = b; else delete GMAT.base[L]; edOp({ t: 'gb', L, a, b }); gmRefresh(); gmUniforms(); }
    edCatGrid(); edToast(b ? '«' + GM_LAYERS_AR[L] + '» صار «' + gmName(b) + '» في كل الخريطة' : 'عاد «' + GM_LAYERS_AR[L] + '» كما كان', 'احفظ ليراه الجميع');
    return;
  }
  GMAT.cur = k; edCatOpen(false); edTool('paint');
  edToast('«' + gmName(k) + '»', GMAT.mode === 'p' ? 'اسحب على الأرض لترسم بها' : GMAT.mode === 'd' ? 'اسحب لتحفر بها' : 'اسحب على الأرض');
}
function gmBaseTap(L) { GMAT.pickL = GMAT.pickL === L ? -1 : L; edCatGrid(); if (GMAT.pickL >= 0) { const el = document.querySelector('#edGrid .edsec'); if (el) el.scrollIntoView({ block: 'start' }); } }
