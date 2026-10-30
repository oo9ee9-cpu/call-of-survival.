// Decode a GLB that uses KHR_draco_mesh_compression and/or KHR_texture_basisu into a plain GLB
// (float32/uint32 accessors, PNG images). usage: node gltfdecode.cjs in.glb out.glb
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const LIB = path.join(__dirname, '../dl/three-dev/examples/jsm/libs');

function readGLB(file) {
  const b = fs.readFileSync(file);
  if (b.toString('ascii', 0, 4) !== 'glTF') throw new Error('not glb');
  let off = 12, json = null, bin = null;
  while (off < b.length) {
    const L = b.readUInt32LE(off), T = b.readUInt32LE(off + 4), c = b.subarray(off + 8, off + 8 + L);
    if (T === 0x4E4F534A) json = JSON.parse(c.toString('utf8')); else if (T === 0x004E4942) bin = c;
    off += 8 + L;
  }
  return { json, bin };
}
function writeGLB(file, json, chunks) {
  const total = chunks.reduce((s, c) => s + c.length + ((4 - c.length % 4) % 4), 0);
  const bin = Buffer.alloc(total); let o = 0;
  for (const c of chunks) { c.copy(bin, o); o += c.length + ((4 - c.length % 4) % 4); }
  json.buffers = [{ byteLength: bin.length }];
  let js = Buffer.from(JSON.stringify(json), 'utf8'); const jp = (4 - js.length % 4) % 4; js = Buffer.concat([js, Buffer.alloc(jp, 0x20)]);
  const head = Buffer.alloc(12), h1 = Buffer.alloc(8), h2 = Buffer.alloc(8);
  head.write('glTF', 0, 'ascii'); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + js.length + 8 + bin.length, 8);
  h1.writeUInt32LE(js.length, 0); h1.writeUInt32LE(0x4E4F534A, 4); h2.writeUInt32LE(bin.length, 0); h2.writeUInt32LE(0x004E4942, 4);
  fs.writeFileSync(file, Buffer.concat([head, h1, js, h2, bin]));
}
function crc32(buf) { let c, crc = 0xffffffff; for (let n = 0; n < buf.length; n++) { c = (crc ^ buf[n]) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crc = (crc >>> 8) ^ c; } return (crc ^ 0xffffffff) >>> 0; }
function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1); }
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t, 'ascii'), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 6 })), chunk('IEND', Buffer.alloc(0))]);
}
const CT = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
const NC = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

async function main() {
  const [inp, out] = process.argv.slice(2);
  const { json, bin } = readGLB(inp);
  const used = new Set([...(json.extensionsUsed || [])]);
  let draco = null, basis = null;
  if (used.has('KHR_draco_mesh_compression')) {
    const DracoDecoderModule = require(path.join(LIB, 'draco/draco_decoder.js'));
    draco = await DracoDecoderModule({});
  }
  if (used.has('KHR_texture_basisu')) {
    const BASIS = require(path.join(LIB, 'basis/basis_transcoder.js'));
    basis = await BASIS({ wasmBinary: fs.readFileSync(path.join(LIB, 'basis/basis_transcoder.wasm')) });
    basis.initializeBasis();
  }
  const chunks = [], bufferViews = [], accessors = [];
  let boff = 0;
  const pushBV = (buf, target) => { const bl = buf.byteLength, pad = (4 - bl % 4) % 4; bufferViews.push({ buffer: 0, byteOffset: boff, byteLength: bl, ...(target ? { target } : {}) }); chunks.push(Buffer.from(buf.buffer, buf.byteOffset, bl)); boff += bl + pad; return bufferViews.length - 1; };
  const oldBV = (i) => { const v = json.bufferViews[i]; return bin.subarray(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength); };
  // copy a plain accessor (de-interleaving)
  const accCache = new Map();
  function copyAccessor(ai) {
    if (accCache.has(ai)) return accCache.get(ai);
    const a = json.accessors[ai], n = NC[a.type], T = CT[a.componentType];
    const out = new T(a.count * n);
    if (a.bufferView !== undefined) {
      const v = json.bufferViews[a.bufferView], src = bin, base = (v.byteOffset || 0) + (a.byteOffset || 0), stride = v.byteStride || T.BYTES_PER_ELEMENT * n;
      const dv = new DataView(src.buffer, src.byteOffset, src.byteLength);
      for (let i = 0; i < a.count; i++) for (let k = 0; k < n; k++) {
        const o = base + i * stride + k * T.BYTES_PER_ELEMENT;
        out[i * n + k] = T === Float32Array ? dv.getFloat32(o, true) : T === Uint16Array ? dv.getUint16(o, true) : T === Uint32Array ? dv.getUint32(o, true) : T === Int16Array ? dv.getInt16(o, true) : T === Uint8Array ? dv.getUint8(o) : dv.getInt8(o);
      }
    }
    if (a.sparse) console.warn('sparse accessor ignored', ai);
    const na = { ...a }; delete na.byteOffset; delete na.sparse;
    na.bufferView = pushBV(out); accessors.push(na); const id = accessors.length - 1; accCache.set(ai, id); return id;
  }
  function addAccessor(arr, type, componentType, normalized, extra = {}) {
    const n = NC[type], count = arr.length / n, acc = { bufferView: pushBV(arr), componentType, count, type, ...extra };
    if (normalized) acc.normalized = true;
    if (type === 'VEC3' && componentType === 5126 && extra.minmax) { const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9]; for (let i = 0; i < count; i++) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], arr[i * 3 + k]); mx[k] = Math.max(mx[k], arr[i * 3 + k]); } acc.min = mn; acc.max = mx; delete acc.minmax; }
    delete acc.minmax; accessors.push(acc); return accessors.length - 1;
  }
  for (const m of json.meshes || []) for (const p of m.primitives) {
    const ext = p.extensions && p.extensions.KHR_draco_mesh_compression;
    if (ext && draco) {
      const data = oldBV(ext.bufferView), dec = new draco.Decoder(), dbuf = new draco.DecoderBuffer(); dbuf.Init(new Int8Array(data.buffer, data.byteOffset, data.byteLength), data.byteLength);
      const mesh = new draco.Mesh(), st = dec.DecodeBufferToMesh(dbuf, mesh); if (!st.ok()) throw new Error('draco ' + st.error_msg());
      const nf = mesh.num_faces(), np = mesh.num_points(), idx = new Uint32Array(nf * 3);
      const ptr = draco._malloc(nf * 12); dec.GetTrianglesUInt32Array(mesh, nf * 12, ptr); idx.set(new Uint32Array(draco.HEAPU32.buffer, ptr, nf * 3)); draco._free(ptr);
      const attrs = {};
      for (const [name, uid] of Object.entries(ext.attributes)) {
        const att = dec.GetAttributeByUniqueId(mesh, uid), nc = att.num_components(), orig = json.accessors[p.attributes[name]];
        const len = np * nc, p2 = draco._malloc(len * 4); dec.GetAttributeDataArrayForAllPoints(mesh, att, draco.DT_FLOAT32, len * 4, p2);
        const f = new Float32Array(len); f.set(new Float32Array(draco.HEAPF32.buffer, p2, len)); draco._free(p2);
        const type = orig.type;
        if (name.startsWith('JOINTS')) { const u = new Uint16Array(len); for (let i = 0; i < len; i++) u[i] = Math.round(f[i]); attrs[name] = addAccessor(u, type, 5123, false); }
        else attrs[name] = addAccessor(f, type, 5126, false, name === 'POSITION' ? { minmax: true } : {});
      }
      p.attributes = attrs; p.indices = addAccessor(idx, 'SCALAR', 5125, false);
      delete p.extensions.KHR_draco_mesh_compression; if (!Object.keys(p.extensions).length) delete p.extensions;
      draco.destroy(mesh); draco.destroy(dbuf); draco.destroy(dec);
    } else {
      for (const k of Object.keys(p.attributes)) p.attributes[k] = copyAccessor(p.attributes[k]);
      if (p.indices !== undefined) p.indices = copyAccessor(p.indices);
    }
    if (p.targets) p.targets = p.targets.map((t) => Object.fromEntries(Object.entries(t).map(([k, v]) => [k, copyAccessor(v)])));
  }
  // skins & animations
  for (const s of json.skins || []) if (s.inverseBindMatrices !== undefined) s.inverseBindMatrices = copyAccessor(s.inverseBindMatrices);
  for (const a of json.animations || []) for (const smp of a.samplers) { smp.input = copyAccessor(smp.input); smp.output = copyAccessor(smp.output); }
  // images
  const newImages = [];
  for (const [i, im] of (json.images || []).entries()) {
    const data = im.bufferView !== undefined ? oldBV(im.bufferView) : null;
    if (data && im.mimeType === 'image/ktx2' && basis) {
      const k = new basis.KTX2File(new Uint8Array(data)); if (!k.isValid()) throw new Error('bad ktx2');
      const w = k.getWidth(), h = k.getHeight(); k.startTranscoding();
      const dst = new Uint8Array(k.getImageTranscodedSizeInBytes(0, 0, 0, 13)); // cTFRGBA32
      if (!k.transcodeImage(dst, 0, 0, 0, 13, 0, -1, -1)) throw new Error('transcode failed');
      k.close(); k.delete();
      newImages.push({ name: im.name, mimeType: 'image/png', bufferView: pushBV(png(w, h, dst)) });
    } else if (data) newImages.push({ name: im.name, mimeType: im.mimeType, bufferView: pushBV(Buffer.from(data)) });
    else newImages.push(im);
  }
  json.images = newImages;
  for (const t of json.textures || []) {
    const e = t.extensions || {};
    for (const key of ['KHR_texture_basisu', 'EXT_texture_webp', 'EXT_texture_avif']) if (e[key]) { if (t.source === undefined) t.source = e[key].source; delete e[key]; }
    if (t.extensions && !Object.keys(t.extensions).length) delete t.extensions;
  }
  json.bufferViews = bufferViews; json.accessors = accessors;
  json.extensionsUsed = (json.extensionsUsed || []).filter((e) => !['KHR_draco_mesh_compression', 'KHR_texture_basisu', 'EXT_texture_webp', 'EXT_meshopt_compression'].includes(e));
  json.extensionsRequired = (json.extensionsRequired || []).filter((e) => json.extensionsUsed.includes(e));
  if (!json.extensionsUsed.length) delete json.extensionsUsed; if (!json.extensionsRequired.length) delete json.extensionsRequired;
  writeGLB(out, json, chunks);
  console.log('wrote', out, fs.statSync(out).size);
}
main().catch((e) => { console.error(e); process.exit(1); });
