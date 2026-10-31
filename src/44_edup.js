/* ═════════ وضع التطوير (4/4): your own models, straight from the phone. A .glb, a .gltf with its files, a Sketchfab .zip, an
   .obj (with its .mtl and pictures) or an .fbx is read here in the page: its pictures and shapes kept exactly as they came
   (only GIF or BMP pictures written again as PNG, every pixel kept), packed into one glTF and kept with the game (the
   artifact's own storage; on this device when the page runs on its own). A device whose graphics cannot hold a picture that
   big draws it at the size it can, from the whole file each time (a strong computer draws 8K). It joins the catalogue under «من جهازك» and stands in the world like everything
   else: moved, turned, sized, animated, solid as a box or exactly (walls you cannot pass, floors and stairs you walk on) ═════════ */
const UPL = { assets: null, idbOK: false, idb: null, recs: new Map(), cache: new Map(), urls: new Map(), busy: false, input: null, usage: null };
const UP_MAX_TEX = 16384, UP_CHUNK = 15 * 1024 * 1024, UP_CDN = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/';
const upErr = (msg) => Object.assign(new Error(msg), { ui: msg });
const upWait = (ms) => new Promise((r) => setTimeout(r, ms));

/* ── the readers three.js keeps apart (OBJ, MTL, FBX, Draco, the exporter): fetched the first time they are needed ── */
const UP_JS = {};
function upNeed(path, test) {
  if (test()) return Promise.resolve();
  if (UP_JS[path]) return UP_JS[path];
  return (UP_JS[path] = new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = UP_CDN + path; s.async = true;
    s.onload = () => (test() ? res() : rej(upErr('تعذّر تحميل أداة القراءة')));
    s.onerror = () => { delete UP_JS[path]; rej(upErr('تعذّر تحميل أداة القراءة، تحقّق من الاتصال')); };
    document.head.appendChild(s);
  }));
}
let UP_DRACO = null;
async function upDraco() {
  if (UP_DRACO) return UP_DRACO;
  await upNeed('loaders/DRACOLoader.js', () => !!THREE.DRACOLoader);
  UP_DRACO = new THREE.DRACOLoader(); UP_DRACO.setDecoderPath(UP_CDN + 'libs/draco/gltf/');
  return UP_DRACO;
}

/* ── where the files are kept: with the game (assets, for whoever may edit it) or in this device's IndexedDB ── */
function upIdb() {
  if (UPL.idb) return UPL.idb;
  return (UPL.idb = new Promise((res, rej) => {
    const r = indexedDB.open('cos-models', 2);
    r.onupgradeneeded = () => { const d = r.result; for (const n of ['blobs', 'recs', 'mats']) if (!d.objectStoreNames.contains(n)) d.createObjectStore(n); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  }));
}
async function upTx(store, mode, fn) {
  const d = await upIdb();
  return new Promise((res, rej) => { const t = d.transaction(store, mode), q = fn(t.objectStore(store)); t.oncomplete = () => res(q && q.result); t.onerror = t.onabort = () => rej(t.error); });
}
async function upPut(blob, type) {
  if (UPL.assets) {
    for (let tries = 0; ; tries++) {
      try { return (await UPL.assets.upload(blob, { type })).id; }
      catch (e) {
        const c = e && e.code;
        if ((c === 'store_unavailable' || c === 'rate_limited' || c === 'upstream_error') && tries < 3) { await upWait(1500 * (tries + 1)); continue; }
        throw upErr(c === 'quota_or_state' ? 'امتلأت مساحة اللعبة، احذف نماذج قديمة' : c === 'too_large' ? 'جزء من الملف كبير جداً' : c === 'not_granted' ? 'لم يُسمح بالرفع' : 'تعذّر الرفع' + (c ? ' (' + c + ')' : ''));
      }
    }
  }
  const id = 'L' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  await upTx('blobs', 'readwrite', (s) => s.put(blob, id));
  return id;
}
async function upBlob(ref) {
  if (ref[0] === 'L') { const b = await upTx('blobs', 'readonly', (s) => s.get(ref)); if (!b) throw new Error('missing ' + ref); return b; }
  const r = await fetch('/_blob/' + ref); if (!r.ok) throw new Error('asset ' + r.status); return await r.blob();
}
async function upText(ref) { return ref[0] === 'L' ? await (await upBlob(ref)).text() : await (await fetch('/_blob/' + ref).then((r) => { if (!r.ok) throw new Error('asset ' + r.status); return r; })).text(); }
async function upURL(ref) {
  if (ref[0] !== 'L') return '/_blob/' + ref;
  let u = UPL.urls.get(ref); if (u) return u;
  u = URL.createObjectURL(await upBlob(ref)); UPL.urls.set(ref, u); return u;
}
async function upDrop(ref) { try { if (ref[0] === 'L') await upTx('blobs', 'readwrite', (s) => s.delete(ref)); else if (UPL.assets) await UPL.assets.delete(ref); } catch (e) { console.warn('model file delete', e); } }
// the record of a model (its name, its parts, its size): a db document with the game, or a row on this device
async function upSaveRec(R) {
  const body = {}; for (const k of Object.keys(R)) if (k !== 'mid' && k !== 'src') body[k] = R[k];
  if (R.src === 'cloud') await EDIO.db.doc('devmodels/' + R.mid).set(body);
  else await upTx('recs', 'readwrite', (s) => s.put(body, R.mid));
}
async function upDelRec(R) { if (R.src === 'cloud') await EDIO.db.doc('devmodels/' + R.mid).delete(); else await upTx('recs', 'readwrite', (s) => s.delete(R.mid)); }
async function upLocalRecs() {
  const d = await upIdb();
  return new Promise((res) => {
    const out = [], t = d.transaction('recs', 'readonly'), c = t.objectStore('recs').openCursor();
    c.onsuccess = () => { const k = c.result; if (k) { out.push(Object.assign({ mid: String(k.key) }, k.value)); k.continue(); } };
    t.oncomplete = () => res(out); t.onerror = () => res(out);
  });
}
async function upDeflate(u8) { return new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer()); }
async function upInflate(u8, raw) { return new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(new DecompressionStream(raw ? 'deflate-raw' : 'deflate'))).arrayBuffer()); }

/* ── at the start: which models there are, and what this view may do with them ── */
async function upInit() {
  try {
    if (window.claude && typeof window.claude.use === 'function') UPL.assets = await withTimeout(window.claude.use('assets'), 6000);
  } catch (_) { UPL.assets = null; }
  try { if (typeof indexedDB !== 'undefined') { await withTimeout(upIdb(), 4000); UPL.idbOK = !!(await withTimeout(upIdb(), 10)); } } catch (_) { UPL.idbOK = false; }
  const list = [];
  if (EDIO.db) {
    try { const q = await withTimeout(EDIO.db.collection('devmodels').get(), 7000); if (q) for (const s of q.docs) if (s.exists) list.push(Object.assign({}, s.data(), { mid: s.id, src: 'cloud' })); }
    catch (e) { console.warn('models list', e); }
  }
  if (UPL.idbOK) { try { for (const r of await withTimeout(upLocalRecs(), 4000) || []) list.push(Object.assign(r, { src: 'local' })); } catch (_) {} }
  list.sort((a, b) => (a.t || 0) - (b.t || 0));
  for (const R of list) { try { upRegister(R); } catch (e) { console.warn('model', R.mid, e); } }
  if (list.length) console.log('models', list.length);
}
const upClean = (s) => String(s || '').replace(/\.[a-z0-9]{2,5}$/i, '').replace(/[_\-.]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40) || 'نموذج';
// its size where it stands (k turns it on its side: 0 as made, 1–2 about the width, 3–4 about the length, 5 upside down)
function upDims(R, k) { const u = R.u || 1, [w, h, d] = (R.sz || [2, 2, 2]).map((v) => v * u); return k === 1 || k === 2 ? [w, d, h] : k === 3 || k === 4 ? [h, w, d] : [w, h, d]; }
function upRegister(R) {
  UPL.recs.set(R.mid, R);
  const [w, h, d] = upDims(R, 0), an = Array.isArray(R.an) ? R.an : [];
  const vars = an.length ? ['بلا حركة'].concat(an.map((n, i) => (String(n || '').replace(/^(mixamo\.com|armature\|?)/i, '').replace(/[_|]+/g, ' ').trim().slice(0, 18) || 'حركة ' + toAr(i + 1)))) : null;
  const col0 = w >= 2.5 && d >= 2.5 && h >= 2 ? 2 : 1;
  edk('U_' + R.mid, { cat: 'upl', name: R.n || 'نموذج', type: 'umodel', mid: R.mid, s: 1, sc: [0.02, 50], col0, pad0: col0 === 2 && Math.max(w, d) <= 80 ? 1 : 0, big: Math.max(w, d) > 40, vars, c0: vars ? 1 : 0, thumb: null, src: R.src });
  if (R.th) upURL(R.th).then((u) => { const D = EDK['U_' + R.mid]; if (D) D.thumb = u; if (ED.on && EDUI.cat === 'upl' && !$('edCat').classList.contains('gone')) edCatGrid(); }).catch(() => {});
}

/* ── reading what was picked: zips opened, the model file found, its companions beside it ── */
async function upUnzip(file) {
  const buf = new Uint8Array(await file.arrayBuffer()), dv = new DataView(buf.buffer), out = [], dec = new TextDecoder();
  let e = buf.length - 22; while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw upErr('ملف مضغوط تالف');
  let n = dv.getUint16(e + 10, true), p = dv.getUint32(e + 16, true);
  if ((p === 0xffffffff || n === 0xffff) && e >= 20 && dv.getUint32(e - 20, true) === 0x07064b50) { const z = Number(dv.getBigUint64(e - 12, true)); n = Number(dv.getBigUint64(z + 32, true)); p = Number(dv.getBigUint64(z + 48, true)); }
  for (let i = 0; i < n && p + 46 <= buf.length && dv.getUint32(p, true) === 0x02014b50; i++) {
    const flags = dv.getUint16(p + 8, true), meth = dv.getUint16(p + 10, true), nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true);
    let csize = dv.getUint32(p + 20, true), usize = dv.getUint32(p + 24, true), lo = dv.getUint32(p + 42, true);
    const name = dec.decode(buf.subarray(p + 46, p + 46 + nl));
    if (csize === 0xffffffff || usize === 0xffffffff || lo === 0xffffffff) {
      for (let x = p + 46 + nl, xe = x + xl; x + 4 <= xe;) {
        const id = dv.getUint16(x, true), sz = dv.getUint16(x + 2, true);
        if (id === 1) { let q = x + 4; if (usize === 0xffffffff) { usize = Number(dv.getBigUint64(q, true)); q += 8; } if (csize === 0xffffffff) { csize = Number(dv.getBigUint64(q, true)); q += 8; } if (lo === 0xffffffff) lo = Number(dv.getBigUint64(q, true)); }
        x += 4 + sz;
      }
    }
    p += 46 + nl + xl + cl;
    if (name.endsWith('/') || flags & 1 || /(^|\/)(__MACOSX|\.)/.test(name)) continue;
    const ds = lo + 30 + dv.getUint16(lo + 26, true) + dv.getUint16(lo + 28, true);
    out.push({ name, meth, raw: buf.subarray(ds, ds + csize), usize });
  }
  return out;
}
async function upZipData(en) {
  if (en.meth === 0) return en.raw;
  if (en.meth !== 8) throw upErr('طريقة ضغط غير مدعومة داخل الملف');
  try { return await upInflate(en.raw, true); }
  catch (_) { await upNeed('libs/fflate.min.js', () => !!window.fflate); return window.fflate.inflateSync(en.raw); }
}
const UP_EXT = (n) => (String(n).toLowerCase().match(/\.([a-z0-9]+)$/) || [])[1] || '';
const UP_MODEL = ['glb', 'gltf', 'fbx', 'obj'];
const UP_KEEP = new Set(['glb', 'gltf', 'bin', 'fbx', 'obj', 'mtl', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'tga', 'ktx2', 'dds']);
// the picked files in groups, one model each: a zip is one model (its glTF before its FBX before its OBJ); loose files share their companions
async function upGroups(files) {
  const groups = [], loose = new Map(), looseModels = [];
  for (const f of files) {
    const ext = UP_EXT(f.name);
    if (ext === 'zip') {
      const ents = await upUnzip(f), map = new Map(); let best = null;
      for (const en of ents) {
        const ex = UP_EXT(en.name); if (!UP_KEEP.has(ex)) continue;
        const blob = new Blob([await upZipData(en)]); blob.path = en.name; map.set(en.name.toLowerCase(), blob);
        const rank = UP_MODEL.indexOf(ex);
        if (rank >= 0 && (!best || rank < best.rank || (rank === best.rank && blob.size > best.blob.size))) best = { rank, blob, ext: ex, path: en.name };
      }
      if (best) groups.push({ name: upClean(f.name), main: best.blob, ext: best.ext, base: best.path.includes('/') ? best.path.slice(0, best.path.lastIndexOf('/') + 1).toLowerCase() : '', files: map });
      continue;
    }
    if (!UP_KEEP.has(ext)) continue;
    loose.set(f.name.toLowerCase(), f);
    if (UP_MODEL.includes(ext)) looseModels.push(f);
  }
  for (const f of looseModels) groups.push({ name: upClean(f.name), main: f, ext: UP_EXT(f.name), base: '', files: loose });
  return groups;
}
// a file named inside a model (a texture, a .bin): by its path, then by its name alone
function upFind(files, uri, base) {
  let u = String(uri || ''); try { u = decodeURIComponent(u); } catch (_) {}
  u = u.replace(/\\/g, '/').replace(/^\.\//, '').toLowerCase();
  const tries = [(base || '') + u, u];
  for (const t of tries) { const f = files.get(t); if (f) return f; }
  const bn = u.slice(u.lastIndexOf('/') + 1);
  for (const [k, f] of files) if (k === bn || k.endsWith('/' + bn)) return f;
  return null;
}

/* ── a glTF in one piece: the JSON and a single binary holding every buffer ── */
function upGlbSplit(buf) {
  const dv = new DataView(buf); if (buf.byteLength < 20 || dv.getUint32(0, true) !== 0x46546C67) return null;
  let o = 12, json = null, bin = null;
  while (o + 8 <= buf.byteLength) {
    const len = dv.getUint32(o, true), type = dv.getUint32(o + 4, true);
    if (type === 0x4E4F534A) json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, o + 8, len)));
    else if (type === 0x004E4942) bin = new Uint8Array(buf, o + 8, len);
    o += 8 + len;
  }
  return json ? { json, bin } : null;
}
async function upFlat(json, G, glbBin) {
  const bufs = json.buffers || [], parts = [];
  for (const b of bufs) {
    let u8;
    if (b.uri === undefined) u8 = glbBin || new Uint8Array(0);
    else if (/^data:/i.test(b.uri)) u8 = new Uint8Array(await (await fetch(b.uri)).arrayBuffer());
    else { const f = upFind(G.files, b.uri, G.base); if (!f) throw upErr('ملف ناقص: ' + String(b.uri).slice(0, 40)); u8 = new Uint8Array(await f.arrayBuffer()); }
    parts.push(u8);
  }
  if (parts.length === 1 && bufs[0].uri === undefined) return parts[0];
  let total = 0; const offs = parts.map((p) => { total = (total + 3) & ~3; const o = total; total += p.length; return o; });
  const out = new Uint8Array(total); parts.forEach((p, i) => out.set(p, offs[i]));
  for (const bv of json.bufferViews || []) { bv.byteOffset = (bv.byteOffset || 0) + offs[bv.buffer || 0]; bv.buffer = 0; }
  json.buffers = [{ byteLength: total }];
  return out;
}
// the pictures (made lighter) back into the binary, each in a view of its own; everything else copied as it was
function upAssemble(json, bin, pics) {
  const views = json.bufferViews || (json.bufferViews = []), repl = new Map();
  (json.images || []).forEach((im, i) => {
    const p = pics[i]; if (!p) return;
    if (im.bufferView !== undefined && !repl.has(im.bufferView)) repl.set(im.bufferView, p.bytes);
    else if (im.bufferView === undefined) { views.push({ buffer: 0, byteLength: p.bytes.length }); im.bufferView = views.length - 1; repl.set(im.bufferView, p.bytes); }
    im.mimeType = p.type; delete im.uri;
  });
  // views nothing points at any more (the old pictures of a model whose pictures were files) keep no bytes
  const used = new Set(), walk = (v, top) => { if (Array.isArray(v)) { for (const x of v) walk(x); return; } if (!v || typeof v !== 'object') return; for (const k of Object.keys(v)) { if (top && k === 'bufferViews') continue; if (k === 'bufferView' && typeof v[k] === 'number') used.add(v[k]); else walk(v[k]); } };
  walk(json, true);
  const none = new Uint8Array(0), srcOf = (bv, i) => (repl.has(i) ? repl.get(i) : used.has(i) ? bin.subarray(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength) : none);
  let total = 0; const offs = views.map((bv, i) => { total = (total + 3) & ~3; const o = total; total += srcOf(bv, i).length; return o; });
  const out = new Uint8Array((total + 3) & ~3);
  views.forEach((bv, i) => { const src = srcOf(bv, i); out.set(src, offs[i]); bv.byteOffset = offs[i]; bv.byteLength = src.length; bv.buffer = 0; });
  json.buffers = [{ byteLength: out.length }];
  return out;
}
const UP_EXT_OK = new Set(['KHR_draco_mesh_compression', 'KHR_materials_pbrSpecularGlossiness', 'KHR_materials_unlit', 'KHR_materials_clearcoat', 'KHR_materials_transmission', 'KHR_texture_transform', 'KHR_mesh_quantization', 'KHR_lights_punctual', 'EXT_texture_webp']);
function upCheck(json) {
  for (const e of json.extensionsRequired || []) if (!UP_EXT_OK.has(e)) throw upErr(e === 'EXT_meshopt_compression' ? 'النموذج مضغوط بطريقة meshopt: صدّره من جديد بلا هذا الضغط' : e === 'KHR_texture_basisu' ? 'صور النموذج بصيغة KTX2: صدّره بصور PNG أو JPEG' : 'النموذج يحتاج ميزة غير مدعومة: ' + e);
}

/* ── a picture made lighter: at most 2048 px, WebP (JPEG or PNG where the browser cannot write WebP), kept as it was when that is smaller ── */
function upSniff(u8) {
  if (u8[0] === 0x89 && u8[1] === 0x50 && u8[2] === 0x4E) return 'image/png';
  if (u8[0] === 0xFF && u8[1] === 0xD8) return 'image/jpeg';
  if (u8[0] === 0x52 && u8[1] === 0x49 && u8[8] === 0x57 && u8[9] === 0x45) return 'image/webp';
  if (u8[0] === 0x47 && u8[1] === 0x49 && u8[2] === 0x46) return 'image/gif';
  if (u8[0] === 0x42 && u8[1] === 0x4D) return 'image/bmp';
  return '';
}
function upImgSize(u8, type) {
  const be = (o) => ((u8[o] << 24) | (u8[o + 1] << 16) | (u8[o + 2] << 8) | u8[o + 3]) >>> 0;
  if (type === 'image/png' && u8.length > 24) return [be(16), be(20)];
  if (type === 'image/jpeg') {
    for (let p = 2; p + 9 < u8.length;) {
      if (u8[p] !== 0xFF) { p++; continue; }
      const m = u8[p + 1];
      if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) return [(u8[p + 7] << 8) | u8[p + 8], (u8[p + 5] << 8) | u8[p + 6]];
      if (m === 0xD8 || m === 0x01 || (m >= 0xD0 && m <= 0xD7)) { p += 2; continue; }
      p += 2 + ((u8[p + 2] << 8) | u8[p + 3]);
    }
  }
  return null;
}
async function upDecode(blob, w, h) {
  if (typeof createImageBitmap === 'function') {
    if (w) { try { return await createImageBitmap(blob, { resizeWidth: w, resizeHeight: h, resizeQuality: 'high' }); } catch (_) {} }
    try { return await createImageBitmap(blob); } catch (_) {}
  }
  const url = URL.createObjectURL(blob);
  try { const im = new Image(); im.src = url; await im.decode(); return im; } finally { URL.revokeObjectURL(url); }
}
const upToBlob = (cv, type, q) => new Promise((res) => { try { cv.toBlob((b) => res(b), type, q); } catch (_) { res(null); } });
async function upPicture(blob) {
  const head = new Uint8Array(await blob.slice(0, 65536).arrayBuffer()), type = upSniff(head) || blob.type || '';
  if (/^image\/(png|jpeg|webp)$/.test(type)) return { bytes: new Uint8Array(await blob.arrayBuffer()), type };     // kept exactly as it came
  if (/^image\/(gif|bmp)$/.test(type)) {           // a format a glTF may not hold: written again as PNG, every pixel kept
    const bmp = await upDecode(blob, 0, 0), cv = document.createElement('canvas'); cv.width = bmp.width; cv.height = bmp.height;
    cv.getContext('2d').drawImage(bmp, 0, 0); if (bmp.close) bmp.close();
    const out = await upToBlob(cv, 'image/png'); cv.width = cv.height = 1; if (!out) throw new Error('picture encode');
    return { bytes: new Uint8Array(await out.arrayBuffer()), type: 'image/png' };
  }
  return upPictureOld(blob, head, type);
}
async function upPictureOld(blob, head, type) {
  if (!/^image\/(png|jpeg|webp|gif|bmp)$/.test(type)) throw new Error('picture type ' + (type || '?'));
  const sz = upImgSize(head, type);
  let tw = 0, th = 0;
  if (sz && Math.max(sz[0], sz[1]) > UP_MAX_TEX) { const k = UP_MAX_TEX / Math.max(sz[0], sz[1]); tw = Math.max(1, Math.round(sz[0] * k)); th = Math.max(1, Math.round(sz[1] * k)); }
  const bmp = await upDecode(blob, tw, th), w0 = bmp.width, h0 = bmp.height, k = Math.min(1, UP_MAX_TEX / Math.max(w0, h0));
  const w = Math.max(1, Math.round(w0 * k)), h = Math.max(1, Math.round(h0 * k));
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d'); g.drawImage(bmp, 0, 0, w, h); if (bmp.close) bmp.close();
  let alpha = false;
  if (type !== 'image/jpeg') { const d = g.getImageData(0, 0, w, h).data; for (let i = 3; i < d.length; i += 4) if (d[i] < 250) { alpha = true; break; } }
  let out = await upToBlob(cv, 'image/webp', alpha ? 0.9 : 0.86);
  if (!out || out.type !== 'image/webp') out = alpha ? await upToBlob(cv, 'image/png') : await upToBlob(cv, 'image/jpeg', 0.9);
  if (!out) throw new Error('picture encode');
  // already light and not too big: kept exactly as it was
  if (w === w0 && h === h0 && (type === 'image/jpeg' || type === 'image/webp' || type === 'image/png') && blob.size <= out.size * 1.08) out = new Blob([blob], { type });
  cv.width = cv.height = 1;
  return { bytes: new Uint8Array(await out.arrayBuffer()), type: out.type || type, w, h, alpha };
}
let UP_GREY = null;
async function upGrey() {
  if (!UP_GREY) { const cv = document.createElement('canvas'); cv.width = cv.height = 4; const g = cv.getContext('2d'); g.fillStyle = '#9a958c'; g.fillRect(0, 0, 4, 4); const b = await upToBlob(cv, 'image/png'); UP_GREY = { bytes: new Uint8Array(await b.arrayBuffer()), type: 'image/png', w: 4, h: 4, alpha: false }; }
  return UP_GREY;
}

/* ── OBJ and FBX: read by three.js, written out as one glTF by its exporter ── */
async function upThreeToGlb(G) {
  const urls = new Map(), mgr = new THREE.LoadingManager();
  mgr.setURLModifier((u) => { if (/^(blob:|data:)/i.test(u)) return u; const f = upFind(G.files, u, G.base); if (!f) return u; let b = urls.get(f); if (!b) urls.set(f, b = URL.createObjectURL(f)); return b; });
  let busy = 0; const idle = () => new Promise((res) => { const t0 = performance.now(); const tick = () => (busy <= 0 || performance.now() - t0 > 30000 ? res() : setTimeout(tick, 120)); tick(); });
  mgr.itemStart = ((f) => (u) => { busy++; f.call(mgr, u); })(mgr.itemStart); mgr.itemEnd = ((f) => (u) => { busy--; f.call(mgr, u); })(mgr.itemEnd); mgr.itemError = ((f) => (u) => { busy--; f.call(mgr, u); })(mgr.itemError);
  let obj;
  if (G.ext === 'obj') {
    await upNeed('loaders/OBJLoader.js', () => !!THREE.OBJLoader);
    const text = await G.main.text(), L = new THREE.OBJLoader(mgr), lib = (text.match(/^\s*mtllib\s+(.+?)\s*$/m) || [])[1];
    const mf = (lib && upFind(G.files, lib, G.base)) || [...G.files.values()].find((f) => /\.mtl$/i.test(f.path || f.name || ''));
    if (mf) { await upNeed('loaders/MTLLoader.js', () => !!THREE.MTLLoader); const M = new THREE.MTLLoader(mgr).parse(await mf.text(), ''); M.preload(); L.setMaterials(M); }
    obj = L.parse(text);
    obj.traverse((q) => { if (q.isMesh && q.geometry && !q.geometry.attributes.normal) q.geometry.computeVertexNormals(); });
  } else {
    await upNeed('libs/fflate.min.js', () => !!window.fflate);
    await upNeed('loaders/FBXLoader.js', () => !!THREE.FBXLoader);
    obj = new THREE.FBXLoader(mgr).parse(await G.main.arrayBuffer(), '');
  }
  await upWait(30); await idle();
  // pictures that never arrived are left out (the exporter cannot write an empty one)
  obj.traverse((q) => {
    if (!q.isMesh) return; q.visible = true;
    for (const m of Array.isArray(q.material) ? q.material : [q.material]) if (m) for (const k of ['map', 'normalMap', 'emissiveMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'bumpMap', 'specularMap', 'alphaMap', 'lightMap', 'displacementMap']) { const t = m[k]; if (t && !(t.image && (t.image.width || t.image.videoWidth))) m[k] = null; }
  });
  await upNeed('exporters/GLTFExporter.js', () => !!THREE.GLTFExporter);
  const run = (anims) => new Promise((res, rej) => { try { new THREE.GLTFExporter().parse(obj, res, { binary: true, animations: anims, maxTextureSize: 4096, onlyVisible: false, truncateDrawRange: true, embedImages: true }); } catch (e) { rej(e); } });
  let glb;
  try { glb = await run(obj.animations || []); } catch (e) { console.warn('export with motion', e); glb = await run([]); }
  for (const u of urls.values()) URL.revokeObjectURL(u);
  return glb;
}

/* ── the pictures as this device can draw them: one bigger than its graphics take is drawn smaller here, the file keeps it whole ── */
const upGpuCap = () => Math.min(renderer.capabilities.maxTextureSize || 4096, qsel(1024, 2048, 4096, 8192));
async function upFitGpu(u8) {
  const buf = u8 instanceof ArrayBuffer ? u8 : u8.byteOffset === 0 && u8.byteLength === u8.buffer.byteLength ? u8.buffer : u8.slice().buffer;
  const cap = upGpuCap(), s = upGlbSplit(buf); if (!s || !s.bin || !(s.json.images || []).length) return buf;
  const json = s.json, bin = s.bin, pics = []; let any = false;
  for (const im of json.images) {
    pics.push(null); if (im.bufferView === undefined) continue;
    const bv = json.bufferViews[im.bufferView], o = bv.byteOffset || 0, bytes = bin.subarray(o, o + bv.byteLength), type = upSniff(bytes) || im.mimeType || '', sz = upImgSize(bytes, type);
    if (!sz || Math.max(sz[0], sz[1]) <= cap) continue;
    const k = cap / Math.max(sz[0], sz[1]), w = Math.max(1, Math.round(sz[0] * k)), h = Math.max(1, Math.round(sz[1] * k));
    try {
      const bmp = await upDecode(new Blob([bytes], { type }), w, h), cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      cv.getContext('2d').drawImage(bmp, 0, 0, w, h); if (bmp.close) bmp.close();
      const out = await upToBlob(cv, type === 'image/jpeg' ? 'image/jpeg' : 'image/png', 0.95); cv.width = cv.height = 1;
      if (out) { pics[pics.length - 1] = { bytes: new Uint8Array(await out.arrayBuffer()), type: out.type }; any = true; }
    } catch (e) { console.warn('picture for this device', e); }
  }
  return any ? glbFrom(json, upAssemble(json, bin, pics)) : buf;
}

/* ── a GLB read as the game reads it, and measured ── */
async function upParse(buf) {
  const s = upGlbSplit(buf), used = (s && s.json.extensionsUsed) || [];
  const L = new THREE.GLTFLoader();
  if (used.includes('KHR_draco_mesh_compression')) L.setDRACOLoader(await upDraco());
  return await new Promise((res, rej) => L.parse(buf, '', res, (e) => rej(upErr('تعذّرت قراءة النموذج: ' + String((e && e.message) || e).slice(0, 80)))));
}
function upPrep(gltf, u) {
  const sc = gltf.scene || (gltf.scenes && gltf.scenes[0]); if (!sc) throw upErr('النموذج فارغ');
  const lights = []; let tris = 0, skinned = false;
  sc.traverse((q) => {
    if (q.isLight) { lights.push(q); return; }
    if (!q.isMesh) return;
    const g = q.geometry; tris += (g.index ? g.index.count : g.attributes.position ? g.attributes.position.count : 0) / 3;
    q.castShadow = true; q.receiveShadow = true;
    if (q.isSkinnedMesh) { skinned = true; q.frustumCulled = false; }
    for (const m of Array.isArray(q.material) ? q.material : [q.material]) {
      if (!m || m.userData.upSeen) continue; m.userData.upSeen = true;
      if (m.isMeshStandardMaterial) ENV_MATS.push(m);
      for (const k of ['map', 'emissiveMap']) if (m[k]) m[k].anisotropy = MAX_ANISO;
    }
  });
  for (const l of lights) if (l.parent) l.parent.remove(l);          // (the game lights its world itself)
  sc.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(sc);
  if (box.isEmpty()) throw upErr('النموذج فارغ، لا أشكال فيه');
  return { scene: sc, anims: gltf.animations || [], box, tris: Math.round(tris), skinned, u: u || 1, poses: [], grids: [] };
}
const UP_TURN = [[0, 0, 0], [-Math.PI / 2, 0, 0], [Math.PI / 2, 0, 0], [0, 0, Math.PI / 2], [0, 0, -Math.PI / 2], [Math.PI, 0, 0]];
// how it stands: turned (k), in metres (u), its middle over the spot and its lowest point on the ground
function upPose(M, k) {
  let P = M.poses[k]; if (P) return P;
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...UP_TURN[k])), b = M.box, box = new THREE.Box3(), v = new THREE.Vector3();
  for (let i = 0; i < 8; i++) box.expandByPoint(v.set(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).applyQuaternion(q).multiplyScalar(M.u));
  P = M.poses[k] = { q, off: new THREE.Vector3(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2), w: box.max.x - box.min.x, h: box.max.y - box.min.y, d: box.max.z - box.min.z };
  return P;
}
function upClone(M) { return M.skinned && THREE.SkeletonUtils ? THREE.SkeletonUtils.clone(M.scene) : M.scene.clone(true); }
function upModel(mid) {
  let P = UPL.cache.get(mid); if (P) return P;
  const R = UPL.recs.get(mid); if (!R) return Promise.reject(new Error('no model ' + mid));
  if (!THREE.GLTFLoader) return Promise.reject(new Error('GLTFLoader missing'));
  P = (async () => {
    const parts = await Promise.all((R.b || []).map(upText));
    let u8 = b64Bytes(parts.join(''));
    if (R.z) u8 = await upInflate(u8);
    return upPrep(await upParse(await upFitGpu(u8)), R.u);
  })();
  UPL.cache.set(mid, P); P.catch(() => { if (UPL.cache.get(mid) === P) UPL.cache.delete(mid); });
  return P;
}

/* ── its picture for the catalogue: the editor's studio (soft light, a shadow under it, a warm grey wall) ── */
let UP_ST = null;
async function upStudio(M) {
  if (!UP_ST) {
    const scn = new THREE.Scene();
    scn.background = canvasTex(4, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#e9eef2'); gr.addColorStop(0.62, '#d9d4ca'); gr.addColorStop(1, '#bfb7aa'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
    scn.add(new THREE.HemisphereLight(0xf2f5ff, 0x8a7a64, 0.95));
    const key = new THREE.DirectionalLight(0xfff0dc, 2.4), fill = new THREE.DirectionalLight(0xdfe8ff, 0.55); scn.add(key, key.target, fill, fill.target);
    const blob = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshBasicMaterial({ map: canvasTex(128, 128, (g) => { const gr = g.createRadialGradient(64, 64, 2, 64, 64, 64); gr.addColorStop(0, 'rgba(40,32,24,0.5)'); gr.addColorStop(0.6, 'rgba(40,32,24,0.18)'); gr.addColorStop(1, 'rgba(40,32,24,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); }, false), transparent: true, depthWrite: false }));
    blob.rotation.x = -Math.PI / 2; scn.add(blob);
    const rt = new THREE.WebGLRenderTarget(480, 360); rt.texture.encoding = THREE.sRGBEncoding;
    UP_ST = { scn, key, fill, blob, rt, cam: new THREE.PerspectiveCamera(30, 4 / 3, 0.05, 20000) };
  }
  const { scn, key, fill, blob, rt, cam } = UP_ST, P = upPose(M, 0), piv = new THREE.Group(), obj = upClone(M);
  scn.environment = scene.environment;
  piv.quaternion.copy(P.q); piv.position.copy(P.off); piv.scale.setScalar(M.u); piv.add(obj); scn.add(piv); piv.updateMatrixWorld(true);
  if (M.anims.length) { const mx = new THREE.AnimationMixer(obj); mx.clipAction(M.anims[0]).play(); mx.update(0.4); piv.updateMatrixWorld(true); }
  const c = new THREE.Vector3(0, P.h / 2, 0), r = Math.max(0.25, Math.hypot(P.w, P.h, P.d) / 2), yaw = 0.62, pitch = 0.32, d = r / Math.sin(cam.fov * Math.PI / 360);
  cam.position.set(c.x + Math.sin(yaw) * Math.cos(pitch) * d, c.y + Math.sin(pitch) * d, c.z + Math.cos(yaw) * Math.cos(pitch) * d);
  cam.near = d / 200; cam.far = d * 10; cam.updateProjectionMatrix(); cam.lookAt(c);
  blob.position.set(0, Math.min(0.02, r * 0.01), 0); blob.scale.setScalar(Math.max(P.w, P.d) * 0.62 + 0.2);
  key.position.set(c.x - 0.45 * d, c.y + 0.9 * d, c.z + 0.6 * d); key.target.position.copy(c); key.target.updateMatrixWorld();
  fill.position.set(c.x + 0.7 * d, c.y + 0.3 * d, c.z - 0.4 * d); fill.target.position.copy(c); fill.target.updateMatrixWorld();
  const cc = new THREE.Color(); renderer.getClearColor(cc); const ca = renderer.getClearAlpha(), prev = renderer.getRenderTarget(), px = new Uint8Array(480 * 360 * 4);
  try { renderer.setRenderTarget(rt); renderer.setClearColor(0xd8d2c8, 1); renderer.clear(); renderer.render(scn, cam); renderer.readRenderTargetPixels(rt, 0, 0, 480, 360, px); }
  finally { renderer.setRenderTarget(prev); renderer.setClearColor(cc, ca); scn.remove(piv); }
  const cv = document.createElement('canvas'); cv.width = 480; cv.height = 360; const g = cv.getContext('2d'), img = g.createImageData(480, 360);
  for (let y = 0; y < 360; y++) img.data.set(px.subarray((359 - y) * 1920, (360 - y) * 1920), y * 1920);
  g.putImageData(img, 0, 0);
  const sm = document.createElement('canvas'); sm.width = 280; sm.height = 210; const g2 = sm.getContext('2d'); g2.imageSmoothingQuality = 'high'; g2.drawImage(cv, 0, 0, 280, 210);
  let out = await upToBlob(sm, 'image/webp', 0.8); if (!out || out.type !== 'image/webp') out = await upToBlob(sm, 'image/jpeg', 0.85);
  return out;
}

/* ── one model, from the files to the catalogue ── */
async function upOne(G, tag) {
  const step = (msg, p) => upShow(G.name + tag, msg, p);
  step('تجهيز النموذج', 0.02);
  let json, bin;
  if (G.ext === 'glb') { const s = upGlbSplit(await G.main.arrayBuffer()); if (!s) throw upErr('ملف glb غير صالح'); json = s.json; bin = await upFlat(json, G, s.bin); }
  else if (G.ext === 'gltf') { try { json = JSON.parse(await G.main.text()); } catch (_) { throw upErr('ملف gltf غير صالح'); } bin = await upFlat(json, G, null); }
  else { step(G.ext === 'fbx' ? 'قراءة ملف FBX' : 'قراءة ملف OBJ', 0.05); const s = upGlbSplit(await upThreeToGlb(G)); if (!s) throw upErr('تعذّر تحويل النموذج'); json = s.json; bin = await upFlat(json, G, s.bin); }
  upCheck(json);
  // the pictures, lighter
  const imgs = json.images || [], pics = []; let missing = 0;
  for (let i = 0; i < imgs.length; i++) {
    step('تجهيز الصور ' + toAr(i + 1) + ' من ' + toAr(imgs.length), 0.06 + 0.32 * i / Math.max(1, imgs.length));
    const im = imgs[i]; let blob = null;
    if (im.bufferView !== undefined) { const bv = json.bufferViews[im.bufferView], o = bv.byteOffset || 0; blob = new Blob([bin.subarray(o, o + bv.byteLength)], { type: im.mimeType || '' }); }
    else if (im.uri && /^data:/i.test(im.uri)) blob = await (await fetch(im.uri)).blob();
    else if (im.uri) blob = upFind(G.files, im.uri, G.base);
    let p = null; if (blob) { try { p = await upPicture(blob); } catch (e) { console.warn('picture', i, e); } }
    if (!p) { missing++; p = await upGrey(); }
    pics.push(p);
  }
  bin = upAssemble(json, bin, pics);
  const glb = glbFrom(json, bin);
  // read back exactly as the game will, measured and pictured
  step('قراءة النموذج', 0.4);
  const raw = upPrep(await upParse(await upFitGpu(glb.slice(0))), 1), b = raw.box, sz = [b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z].map((v) => Math.round(v * 1000) / 1000), maxD = Math.max(...sz);
  // its units: glTF means metres, but a model far bigger than any building was made in centimetres (FBX and OBJ often are)
  let u = 1;
  if (((G.ext === 'fbx' || G.ext === 'obj') && maxD > 30) || maxD > 250) u = 0.01;
  if (maxD * u > 1500) u = 60 / maxD;
  if (maxD * u < 0.08) u = 1.5 / maxD;
  u = +u.toPrecision(4); raw.u = u;
  step('صورة المعاينة', 0.44);
  let thumb = null; try { thumb = await upStudio(raw); } catch (e) { console.warn('thumb', e); }
  // kept: the GLB packed (deflate, then base64 text in parts), its picture, its record
  step('ضغط النموذج', 0.47);
  let data = new Uint8Array(glb), z = 0;
  if (typeof CompressionStream !== 'undefined') { try { const d = await upDeflate(data); if (d.length < data.length) { data = d; z = 1; } } catch (_) {} }
  const b64 = edB64(data), refs = [], mid = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const R = { mid, n: G.name, b: [], z, th: null, by: glb.byteLength, tr: raw.tris, sz, u, an: raw.anims.map((a) => a.name || ''), ext: G.ext, t: Date.now(), v: 1, src: UPL.assets && EDIO.db ? 'cloud' : 'local' };
  if (G.cr) R.cr = G.cr;            // where it came from, by whom, under which licence (shown in the settings)
  if (R.src === 'local' && !UPL.idbOK) throw upErr('لا مكان لحفظ النماذج على هذا الجهاز');
  if (R.src === 'local') UPL.assets = null;
  try {
    const n = Math.ceil(b64.length / UP_CHUNK) || 1;
    for (let i = 0; i < n; i++) {
      step(R.src === 'cloud' ? 'رفع ' + toAr(Math.round((i / n) * 100)) + '٪' : 'حفظ على هذا الجهاز', 0.5 + 0.44 * i / n);
      const id = await upPut(new Blob([b64.slice(i * UP_CHUNK, (i + 1) * UP_CHUNK)], { type: 'text/plain' }), 'text/plain'); refs.push(id); R.b.push(id);
    }
    if (thumb) { step('رفع الصورة', 0.95); R.th = await upPut(thumb, thumb.type); refs.push(R.th); }
    step('تسجيل النموذج', 0.98);
    await upSaveRec(R);
  } catch (e) { for (const r of refs) upDrop(r); throw e; }
  UPL.cache.set(mid, Promise.resolve(raw));
  upRegister(R);
  if (thumb) { const D = EDK['U_' + mid]; if (D) D.thumb = URL.createObjectURL(thumb); }
  R.missing = missing;
  return R;
}
async function upFiles(files) {
  if (UPL.busy || !files.length) return;
  UPL.busy = true;
  const big = files.reduce((a, f) => a + (f.size || 0), 0);
  upShow('نموذجك', big > 150e6 ? 'ملف كبير جداً، قد يستغرق وقتاً' : 'قراءة الملفات', 0.01);
  try {
    if (!THREE.GLTFLoader) throw upErr('قارئ النماذج لم يُحمَّل، أعد فتح اللعبة');
    const groups = await upGroups(files);
    if (!groups.length) {
      // no model: ground pictures (a material's colour, normal, roughness…) become a ground material
      const mats = await gmFiles(files, true);
      if (mats && mats.length) { gmAfterImport(mats); return; }
      const ex = files.map((f) => UP_EXT(f.name));
      if (ex.some((e) => e === 'rar' || e === '7z')) throw upErr('ملفات RAR و 7z لا تُفتح هنا بعد: استخرجها في تطبيق الملفات ثم ارفع ما بداخلها (obj أو fbx أو glb أو zip)');
      if (ex.some((e) => e === 'blend' || e === 'max' || e === 'c4d' || e === 'ma' || e === 'mb' || e === 'skp')) throw upErr('هذه صيغة برنامج تصميم (blend أو max…): اختر من الموقع نسخة obj أو fbx أو glb');
      if (ex.some((e) => /^(mp3|wav|ogg|m4a|aac|flac)$/.test(e))) throw upErr('هذه ملفات صوت: الأصوات تُضاف للعبة مع تحديثاتها (ارفعها في مجلد uploads على GitHub)');
      throw upErr('لم أجد نموذجاً ثلاثي الأبعاد ولا صور خامة أرض (glb أو gltf أو obj أو fbx، أو zip فيه أحدها، أو صور Color و Normal و Roughness)');
    }
    const done = []; let fail = null;
    for (let i = 0; i < groups.length; i++) {
      try { done.push(await upOne(groups[i], groups.length > 1 ? ' (' + toAr(i + 1) + ' من ' + toAr(groups.length) + ')' : '')); }
      catch (e) { console.warn('model upload', groups[i].name, e); fail = e; if (groups.length === 1) throw e; }
    }
    upHide();
    if (!done.length) throw fail || upErr('تعذّر رفع النموذج');
    const R = done[done.length - 1], where = R.src === 'cloud' ? 'محفوظ مع لعبتك' : 'محفوظ على هذا الجهاز';
    if (done.length === 1) {
      edCatOpen(false); edPlace('U_' + R.mid);
      edToast('أُضيف «' + R.n + '»', R.missing ? toAr(R.missing) + ' من صوره ناقصة · ' + where : where);
    } else {
      EDUI.cat = 'upl'; EDUI.q = ''; $('edSearch').value = ''; edCatOpen(true);
      const n = done.length; edToast('رُفع ' + (n === 2 ? 'نموذجان' : toAr(n) + (n <= 10 ? ' نماذج' : ' نموذجاً')), (fail ? 'وتعذّر بعضها · ' : '') + where);
    }
    upUsage();
  } catch (e) {
    console.warn('upload', e);
    upFail(e && e.ui ? e.ui : 'تعذّر رفع النموذج', e && e.ui ? '' : String((e && e.message) || e).slice(0, 90));
  } finally { UPL.busy = false; }
}
async function upUsage() {
  if (!UPL.assets || typeof UPL.assets.list !== 'function') return;
  try { const r = await withTimeout(UPL.assets.list(), 6000); if (r && r.usage) UPL.usage = r.usage; } catch (_) {}
}

/* ── the screen: the upload card, the bar while it works, a model taken away ── */
function upCanUp() { return !!UPL.assets || UPL.idbOK; }
function upCanDel(d) { return d.src === 'local' ? UPL.idbOK : !!UPL.assets && EDIO.owner; }
const upMB = (n) => (n >= 1e9 ? toAr((n / 1e9).toFixed(1)) + ' غ.ب' : toAr(Math.max(1, Math.round(n / 1e6))) + ' م.ب');
function upCards() {
  const can = upCanUp(), where = UPL.assets ? 'تُحفظ مع لعبتك ويراها كل من يفتحها' : 'تُحفظ على هذا الجهاز فقط';
  const use = UPL.usage && UPL.usage.maxBytes ? ' · المساحة ' + upMB(UPL.usage.bytes) + ' من ' + upMB(UPL.usage.maxBytes) : '';
  return `<button type="button" class="edcard edup${can ? '' : ' off'}" data-up="1"${can ? '' : ' disabled'}><span class="edph">${edSvg('upl')}</span><span class="ednm">${can ? 'ارفع نموذجاً من جهازك' : 'الرفع غير متاح هنا'}</span></button>` +
    `<button type="button" class="edcard edup" data-net="model"><span class="edph">${edSvg('web')}</span><span class="ednm">مكتبات الإنترنت: Sketchfab · Poly Haven · free3d</span></button>` +
    `<p class="edupinfo">glb · gltf · zip من Sketchfab · obj · fbx · وخامات الأرض (zip أو صور) — بلا حدّ لعدد الملفات · كل شيء يُحفظ بدقته الأصلية · ${where}${use}</p>`;
}
function upCardImg(d) { return d.thumb ? `<img src="${d.thumb}" alt="" loading="lazy" decoding="async">` : ''; }
function upDelBtn(d) { return d.type === 'umodel' && upCanDel(d) ? `<span class="eddel" data-del="${d.key}" role="button" aria-label="حذف النموذج">${edSvg('del')}</span>` : ''; }
function upPick() {
  if (UPL.busy) { edToast('جارٍ رفع نموذج', 'انتظر حتى ينتهي'); return; }
  if (!upCanUp()) { edToast('الرفع غير متاح هنا', 'افتح اللعبة من حسابك'); return; }
  let inp = UPL.input;
  if (!inp) {
    inp = UPL.input = document.createElement('input'); inp.type = 'file'; inp.multiple = true; inp.style.display = 'none';
    document.body.appendChild(inp);
    inp.addEventListener('change', () => { const fs = [...inp.files]; inp.value = ''; if (fs.length) upFiles(fs); });
  }
  inp.click();
}
function upShow(title, msg, p) {
  let el = $('edUp');
  if (!el) {
    el = document.createElement('div'); el.id = 'edUp'; el.hidden = true;
    el.innerHTML = '<div class="edupc" role="status" aria-live="polite"><b></b><small></small><div class="edbar"><i></i></div><button type="button" class="edb" hidden>حسناً</button></div>';
    $('ed').appendChild(el); el.querySelector('button').addEventListener('click', () => { el.hidden = true; });
  }
  el.hidden = false; el.classList.remove('err');
  el.querySelector('b').textContent = title; el.querySelector('small').textContent = msg;
  el.querySelector('i').style.width = Math.round(clamp(p, 0, 1) * 100) + '%';
  el.querySelector('button').hidden = true;
}
function upHide() { const el = $('edUp'); if (el) el.hidden = true; }
function upFail(title, sub) { upShow(title, sub || '', 1); const el = $('edUp'); el.classList.add('err'); el.querySelector('button').hidden = false; }
// a question on the banner (dialogs of the browser may not open inside the game's frame)
function upAsk(text, yes, fn) {
  const el = $('edMsg'); el.hidden = false;
  el.innerHTML = '<span></span><button type="button" class="edb save dirty" data-m="yes"></button><button type="button" class="edb" data-m="no">إلغاء</button>';
  el.querySelector('span').textContent = text; el.querySelector('[data-m="yes"]').textContent = yes;
  el.onpointerdown = (e) => { const b = e.target.closest('[data-m]'); if (!b) return; e.preventDefault(); el.hidden = true; el.onpointerdown = null; if (b.dataset.m === 'yes') fn(); };
}
function upDelete(key) {
  const d = EDK[key]; if (!d || d.type !== 'umodel') return;
  const R = UPL.recs.get(d.mid); if (!R) return;
  const n = ED.objs.filter((o) => o.k === key).length;
  edCatOpen(false);
  upAsk('حذف «' + R.n + '» من نماذجك' + (n ? ' ومن العالم (' + toAr(n) + ')' : '') + '؟', 'احذف', async () => {
    try { await upDelRec(R); } catch (e) { console.warn('model delete', e); edToast('تعذّر الحذف', 'حاول مرة أخرى'); return; }
    for (const ref of (R.b || []).concat(R.th ? [R.th] : [])) upDrop(ref);
    for (const o of ED.objs.filter((q) => q.k === key)) edRemove(o);
    const has = (op) => JSON.stringify(op).includes('"k":"' + key + '"');
    ED.undo = ED.undo.filter((op) => !has(op)); ED.redo = ED.redo.filter((op) => !has(op));
    delete EDK[key]; UPL.recs.delete(R.mid); UPL.cache.delete(R.mid);
    if (n) ED.ver++;
    edFlush(true); edSelect(null); edStatus();
    edToast('حُذف «' + R.n + '»', n ? 'احفظ ليبقى العالم بدونه' : '');
    upUsage();
  });
}

/* ── in the world ── */
const UP_BOX = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), UP_PH_MAT = new THREE.LineBasicMaterial({ color: C(0xffd76a), transparent: true, opacity: 0.8 });
ED_T.umodel = {
  make(o, d) {
    const v = o.v, R = UPL.recs.get(d.mid); if (!R) return;
    const k = (o.up || 0) % 6, [w, h, dd] = upDims(R, k), s = o.s;
    if (o.pad) {          // the ground under it made level with its foot
      const y = terrainBare(o.x, o.z) + o.dy, p = addPad({ x: o.x, z: o.z, hx: w / 2 * s + 0.4, hz: dd / 2 * s + 0.4, ry: o.ry, y, m: clamp(Math.max(w, dd) * s * 0.15, 2, 12) });
      v.pads.push(p); o.y = y; edTouch(o.x, o.z, Math.hypot(p.hx, p.hz) + p.m, true, 7);
    } else o.y = edGround(o.x, o.z) + o.dy;
    if (w * dd * s * s > 4) { const zn = zoneAdd({ t: 'r', x: o.x, z: o.z, hx: w / 2 * s, hz: dd / 2 * s, ry: o.ry, m: 7 }); v.zones.push(zn); edTouch(o.x, o.z, Math.hypot(zn.hx, zn.hz), false, 7); }
    if (o.col === 1) {    // a box, and its top to stand on
      v.cols.push(addCollider({ t: 'o', x: o.x, z: o.z, hx: w / 2 * s, hz: dd / 2 * s, ry: o.ry, y0: o.y - 0.3, y1: o.y + h * s }));
      v.plats.push(addPlatform({ t: 'orect', x: o.x, z: o.z, hx: w / 2 * s, hz: dd / 2 * s, ry: o.ry, y: o.y + h * s }));
    }
    const root = new THREE.Group(); root.position.set(o.x, o.y, o.z); root.rotation.y = o.ry; root.scale.setScalar(s);
    scene.add(root); v.root = root; v.pick = root;
    // its frame while it is read
    const ph = new THREE.LineSegments(UP_BOX, UP_PH_MAT); ph.scale.set(Math.max(w, 0.05), Math.max(h, 0.05), Math.max(dd, 0.05)); ph.position.y = h / 2; ph.visible = ED.on; root.add(ph); v.ph = ph;
    v.sph = { x: o.x, y: o.y + h * s / 2, z: o.z, r: Math.max(0.6, Math.max(w, h, dd) * s / 2) };
    upModel(d.mid).then((M) => { if (o.v === v) upAttach(o, d, M, k); })
      .catch((e) => { console.warn('model', d.mid, e); if (o.v === v && ED.on) edToast('تعذّر تحميل «' + d.name + '»', 'تحقّق من الاتصال'); });
  },
  free(o) { const v = o.v; if (v.mix) ED_MIX.delete(v.mix); },
};
function upAttach(o, d, M, k) {
  const v = o.v, P = upPose(M, k);
  let I = o._inst;
  if (!I || I.mid !== d.mid) { I = o._inst = { mid: d.mid, obj: upClone(M), piv: new THREE.Group(), mixer: null }; I.piv.add(I.obj); }
  I.piv.quaternion.copy(P.q); I.piv.position.copy(P.off); I.piv.scale.setScalar(M.u);
  if (v.ph) { v.root.remove(v.ph); v.ph = null; }
  v.root.add(I.piv); v.sph = null;
  const nc = M.anims.length, ci = nc ? o.c % (nc + 1) : 0;
  if (ci > 0) { if (!I.mixer) I.mixer = new THREE.AnimationMixer(I.obj); I.mixer.stopAllAction(); I.mixer.clipAction(M.anims[ci - 1]).play(); v.mix = I; ED_MIX.add(I); }
  else if (I.mixer) { I.mixer.stopAllAction(); I.mixer.update(0); }
  if (o.col === 2) {    // solid exactly: its walls stop you, its floors, stairs and roofs carry you
    upGrid(M, k).then((G) => {
      if (o.v !== v || !G) return;
      const s = o.s, hx = G.nx * G.cell / 2 * s, hz = G.nz * G.cell / 2 * s;
      v.cols.push(addCollider({ t: 'g', x: o.x, z: o.z, ry: o.ry, hx, hz, G, k: s, oy: o.y, y0: o.y - 1, y1: o.y + P.h * s + 1 }));
      v.plats.push(addPlatform({ t: 'g', x: o.x, z: o.z, ry: o.ry, hx, hz, G, k: s, oy: o.y }));
    }).catch((e) => console.warn('model walls', e));
  }
  edTag(o); if (ED.sel === o) edOutline();
}

/* ── solid exactly: the model's triangles laid on a grid once (floors: the heights you can stand at; walls: the heights
   that stop you), then asked by the player's feet and body like any platform or wall ── */
function upGrid(M, k) {
  if (M.grids[k]) return M.grids[k];
  return (M.grids[k] = (async () => {
    const P = upPose(M, k), cell = Math.max(Math.max(P.w, P.d) / 150, 0.1), nx = Math.ceil(P.w / cell) + 3, nz = Math.ceil(P.d / cell) + 3, n = nx * nz;
    const G = { nx, nz, cell, x0: -nx * cell / 2, z0: -nz * cell / 2, LV: new Float32Array(n * 6), LN: new Uint8Array(n), WV: new Float32Array(n * 8), WN: new Uint8Array(n) };
    const piv = new THREE.Group(); piv.quaternion.copy(P.q); piv.position.copy(P.off); piv.scale.setScalar(M.u);
    const par = M.scene.parent; piv.add(M.scene); piv.updateMatrixWorld(true);
    const meshes = []; M.scene.traverse((q) => { if (q.isMesh && q.geometry && q.geometry.attributes.position) meshes.push({ m: q, mw: q.matrixWorld.clone() }); });
    piv.remove(M.scene); if (par) par.add(M.scene);
    const a = new THREE.Vector3(); let work = 0;
    for (const { m, mw } of meshes) {
      const pos = m.geometry.attributes.position, idx = m.geometry.index, wp = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) { a.fromBufferAttribute(pos, i).applyMatrix4(mw); wp[i * 3] = a.x; wp[i * 3 + 1] = a.y; wp[i * 3 + 2] = a.z; }
      const cnt = idx ? idx.count : pos.count;
      for (let t = 0; t + 2 < cnt; t += 3) {
        upTri(G, wp, idx ? idx.getX(t) : t, idx ? idx.getX(t + 1) : t + 1, idx ? idx.getX(t + 2) : t + 2);
        if (++work % 25000 === 0) await upWait(0);
      }
    }
    return G;
  })());
}
function upLevel(G, c, y) {
  const b = c * 6, n = G.LN[c];
  for (let l = 0; l < n; l++) if (Math.abs(G.LV[b + l] - y) < 0.12) { if (y > G.LV[b + l]) G.LV[b + l] = y; return; }
  if (n < 6) { G.LV[b + n] = y; G.LN[c] = n + 1; return; }
  let best = 0, bd = Infinity; for (let l = 0; l < 6; l++) { const dd = Math.abs(G.LV[b + l] - y); if (dd < bd) { bd = dd; best = l; } }
  if (y > G.LV[b + best]) G.LV[b + best] = y;
}
function upWall(G, c, y) {
  const b = c * 8, n = G.WN[c];
  for (let m = 0; m < n; m++) { const lo = G.WV[b + m * 2], hi = G.WV[b + m * 2 + 1]; if (y >= lo - 0.3 && y <= hi + 0.3) { if (y < lo) G.WV[b + m * 2] = y; if (y > hi) G.WV[b + m * 2 + 1] = y; return; } }
  if (n < 4) { G.WV[b + n * 2] = y; G.WV[b + n * 2 + 1] = y; G.WN[c] = n + 1; return; }
  let best = 0, bd = Infinity; for (let m = 0; m < 4; m++) { const lo = G.WV[b + m * 2], hi = G.WV[b + m * 2 + 1], dd = y < lo ? lo - y : y > hi ? y - hi : 0; if (dd < bd) { bd = dd; best = m; } }
  if (y < G.WV[b + best * 2]) G.WV[b + best * 2] = y; if (y > G.WV[b + best * 2 + 1]) G.WV[b + best * 2 + 1] = y;
}
function upTri(G, wp, i0, i1, i2) {
  const ax = wp[i0 * 3], ay = wp[i0 * 3 + 1], az = wp[i0 * 3 + 2], bx = wp[i1 * 3], by = wp[i1 * 3 + 1], bz = wp[i1 * 3 + 2], cx = wp[i2 * 3], cy = wp[i2 * 3 + 1], cz = wp[i2 * 3 + 2];
  const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az;
  const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, nl = Math.hypot(nx, ny, nz);
  if (!(nl > 1e-12)) return;
  const C = G.cell;
  if (Math.abs(ny) / nl > 0.7) {
    // a floor, a step, a roof: its height at the middle of every cell it covers
    const den = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz); if (Math.abs(den) < 1e-14) return;
    const i0c = Math.max(0, Math.ceil((Math.min(ax, bx, cx) - G.x0) / C - 0.5)), i1c = Math.min(G.nx - 1, Math.floor((Math.max(ax, bx, cx) - G.x0) / C - 0.5));
    const j0c = Math.max(0, Math.ceil((Math.min(az, bz, cz) - G.z0) / C - 0.5)), j1c = Math.min(G.nz - 1, Math.floor((Math.max(az, bz, cz) - G.z0) / C - 0.5));
    const d = nx * ax + ny * ay + nz * az; let any = false;
    for (let j = j0c; j <= j1c; j++) for (let i = i0c; i <= i1c; i++) {
      const px = G.x0 + (i + 0.5) * C, pz = G.z0 + (j + 0.5) * C;
      const l1 = ((bz - cz) * (px - cx) + (cx - bx) * (pz - cz)) / den, l2 = ((cz - az) * (px - cx) + (ax - cx) * (pz - cz)) / den;
      if (l1 < -1e-6 || l2 < -1e-6 || l1 + l2 > 1 + 1e-6) continue;
      upLevel(G, i + j * G.nx, (d - nx * px - nz * pz) / ny); any = true;
    }
    if (!any) { const mx = (ax + bx + cx) / 3, mz = (az + bz + cz) / 3, i = Math.floor((mx - G.x0) / C), j = Math.floor((mz - G.z0) / C); if (i >= 0 && j >= 0 && i < G.nx && j < G.nz) upLevel(G, i + j * G.nx, (ay + by + cy) / 3); }
    return;
  }
  // a wall: the heights it fills in every cell it passes through
  const L = Math.max(Math.hypot(ux, uz), Math.hypot(vx, vz), Math.hypot(cx - bx, cz - bz)), H = Math.max(Math.abs(uy), Math.abs(vy), Math.abs(cy - by));
  const n = Math.min(160, Math.max(1, Math.ceil(Math.max(L / (C * 0.7), H / 0.3))));
  for (let p = 0; p <= n; p++) for (let q = 0; q <= n - p; q++) {
    const s = p / n, t = q / n, x = ax + ux * s + vx * t, z = az + uz * s + vz * t;
    const i = Math.floor((x - G.x0) / C), j = Math.floor((z - G.z0) / C);
    if (i >= 0 && j >= 0 && i < G.nx && j < G.nz) upWall(G, i + j * G.nx, ay + uy * s + vy * t);
  }
}
// the floor under (x, z) that the feet at y can reach (the editor, asking from far above, gets the ground floor: things put
// inside a model stand on its floor, not on its roof)
function edGridY(p, x, z, y) {
  const G = p.G; if (!G) return -Infinity;
  oLocal(p, x, z, _ol);
  const k = p.k, fi = (_ol[0] / k - G.x0) / G.cell - 0.5, fj = (_ol[1] / k - G.z0) / G.cell - 0.5, lim = y > 5000 ? 1.2 / k : (y + STEP_UP - p.oy) / k;
  const at = (i, j) => { if (i < 0 || j < 0 || i >= G.nx || j >= G.nz) return -Infinity; const c = i + j * G.nx, n = G.LN[c]; let best = -Infinity; for (let l = 0; l < n; l++) { const v = G.LV[c * 6 + l]; if (v <= lim && v > best) best = v; } return best; };
  const h0 = at(Math.round(fi), Math.round(fj)); if (h0 === -Infinity) return -Infinity;
  // smooth across the cells of one surface (ramps, slopes)
  const i0 = Math.floor(fi), j0 = Math.floor(fj), tx = fi - i0, tz = fj - j0, h00 = at(i0, j0), h10 = at(i0 + 1, j0), h01 = at(i0, j0 + 1), h11 = at(i0 + 1, j0 + 1), tol = 0.35 / k;
  let h = h0;
  if (Math.abs(h00 - h0) < tol && Math.abs(h10 - h0) < tol && Math.abs(h01 - h0) < tol && Math.abs(h11 - h0) < tol) h = Math.min(lim, (h00 * (1 - tx) + h10 * tx) * (1 - tz) + (h01 * (1 - tx) + h11 * tx) * tz);
  return p.oy + h * k;
}
// out of the cells whose walls stand between the knees and the head
function edGridPush(c, p, R) {
  const G = c.G; if (!G || p.y === undefined) return;
  const k = c.k, lo = (p.y + 0.5 - c.oy) / k, hi = (p.y + 1.7 - c.oy) / k, r = R / k, C = G.cell;
  for (let it = 0; it < 2; it++) {
    oLocal(c, p.x, p.z, _ol);
    let lx = _ol[0] / k, lz = _ol[1] / k, moved = false;
    const i0 = Math.max(0, Math.floor((lx - r - G.x0) / C)), i1 = Math.min(G.nx - 1, Math.floor((lx + r - G.x0) / C)), j0 = Math.max(0, Math.floor((lz - r - G.z0) / C)), j1 = Math.min(G.nz - 1, Math.floor((lz + r - G.z0) / C));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const ci = i + j * G.nx, n = G.WN[ci]; if (!n) continue;
      let hit = false; for (let m = 0; m < n; m++) if (G.WV[ci * 8 + m * 2 + 1] > lo && G.WV[ci * 8 + m * 2] < hi) { hit = true; break; }
      if (!hit) continue;
      const bx0 = G.x0 + i * C, bz0 = G.z0 + j * C, qx = clamp(lx, bx0, bx0 + C), qz = clamp(lz, bz0, bz0 + C), dx = lx - qx, dz = lz - qz, d = Math.hypot(dx, dz);
      if (d >= r) continue;
      if (d > 1e-6) { lx = qx + dx / d * r; lz = qz + dz / d * r; }
      else { const e0 = lx - bx0, e1 = bx0 + C - lx, f0 = lz - bz0, f1 = bz0 + C - lz, m = Math.min(e0, e1, f0, f1); if (m === e0) lx = bx0 - r; else if (m === e1) lx = bx0 + C + r; else if (m === f0) lz = bz0 - r; else lz = bz0 + C + r; }
      moved = true;
    }
    if (!moved) return;
    const wx = lx * k, wz = lz * k; p.x = c.x + wx * c.c + wz * c.s; p.z = c.z - wx * c.s + wz * c.c;
  }
}

/* ── wiring: the catalogue's upload button, files dropped on the editor (a computer) ── */
(() => {
  ED_ICON.upl = '<path d="M12 15V4M7.5 8.5L12 4l4.5 4.5"/><path d="M4 14v4.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V14"/>';
  const s = $('edSearch');
  if (s && !$('edUpBtn')) {
    s.insertAdjacentHTML('beforebegin', `<button type="button" id="edUpBtn" class="edupb" aria-label="ارفع نموذجاً من جهازك">${edSvg('upl')}<span>رفع</span></button>`);
    $('edUpBtn').addEventListener('click', () => upPick());
  }
  addEventListener('dragover', (e) => { if (ED.on) e.preventDefault(); });
  addEventListener('drop', (e) => { if (!ED.on) return; e.preventDefault(); const fs = e.dataTransfer && e.dataTransfer.files ? [...e.dataTransfer.files] : []; if (fs.length) upFiles(fs); });
})();
