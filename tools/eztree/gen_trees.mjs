// generates game tree species from ez-tree (MIT) at two levels of detail, in metres, quantised, as one JSON file
import { Tree } from './lib/index.js';
import { TreePreset } from './lib/presets/index.js';
import fs from 'fs';
import { execFileSync } from 'child_process';
import * as THREE from '../../dl/three-dev/build/three.module.js';
// simplify a geometry with meshoptimizer (position + normal + uv), returns a new indexed BufferGeometry
function simplify(g, ratio, err) {
  const n = g.attributes.position.count, st = 8, v = new Float32Array(n * st);
  const P = g.attributes.position.array, N = g.attributes.normal.array, U = g.attributes.uv.array;
  for (let i = 0; i < n; i++) { v.set([P[i * 3], P[i * 3 + 1], P[i * 3 + 2], N[i * 3], N[i * 3 + 1], N[i * 3 + 2], U[i * 2], U[i * 2 + 1]], i * st); }
  const idx = new Uint32Array(g.index.array);
  const head = new ArrayBuffer(24); const dv = new DataView(head);
  dv.setUint32(0, n, true); dv.setUint32(4, idx.length, true); dv.setUint32(8, st, true); dv.setFloat32(12, ratio, true); dv.setFloat32(16, err, true); dv.setUint32(20, 5, true);
  const w = new Float32Array([0.6, 0.6, 0.6, 0.15, 0.15]);
  fs.writeFileSync('/tmp/claude-0/-home-claude/e074db26-2f12-5b8f-9b8a-91abbda2e708/scratchpad/v4/build/ms_in.bin', Buffer.concat([Buffer.from(head), Buffer.from(w.buffer), Buffer.from(v.buffer), Buffer.from(idx.buffer)]));
  execFileSync('../msimp/msimplify', ['/tmp/claude-0/-home-claude/e074db26-2f12-5b8f-9b8a-91abbda2e708/scratchpad/v4/build/ms_in.bin', '/tmp/claude-0/-home-claude/e074db26-2f12-5b8f-9b8a-91abbda2e708/scratchpad/v4/build/ms_out.bin'], { stdio: 'pipe' });
  const o = fs.readFileSync('/tmp/claude-0/-home-claude/e074db26-2f12-5b8f-9b8a-91abbda2e708/scratchpad/v4/build/ms_out.bin'); const od = new DataView(o.buffer, o.byteOffset, o.length);
  const nv = od.getUint32(0, true), ni = od.getUint32(4, true);
  const vb = new Float32Array(o.buffer.slice(o.byteOffset + 12, o.byteOffset + 12 + nv * st * 4)); const ib = new Uint32Array(o.buffer.slice(o.byteOffset + 12 + nv * st * 4, o.byteOffset + 12 + nv * st * 4 + ni * 4));
  const pos = new Float32Array(nv * 3), nrm = new Float32Array(nv * 3), uv = new Float32Array(nv * 2);
  for (let i = 0; i < nv; i++) { pos.set(vb.subarray(i * st, i * st + 3), i * 3); nrm.set(vb.subarray(i * st + 3, i * st + 6), i * 3); uv.set(vb.subarray(i * st + 6, i * st + 8), i * 2); }
  const r = new THREE.BufferGeometry(); r.setAttribute('position', new THREE.BufferAttribute(pos, 3)); r.setAttribute('normal', new THREE.BufferAttribute(nrm, 3)); r.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); r.setIndex(new THREE.BufferAttribute(ib, 1));
  return r;
}

const OUT = process.argv[2] || '../../assets/veg/trees.json';
const clone = (o) => JSON.parse(JSON.stringify(o));
const base = (name) => clone(TreePreset[name]);

// species: preset, tweaks, target height (m), bark layer, leaf layer, leaf tint
const SPECIES = [];
function sp(id, preset, height, bark, leaf, tweak, variants = 2, lod0 = {}, lod1 = {}) { SPECIES.push({ id, preset, height, bark, leaf, tweak, variants, lod0, lod1 }); }
const L0 = { sectionStride: 3, segmentFactor: 0.5, leafStride: 4, leafScale: 1.75 };
const L1 = { sectionStride: 8, segmentFactor: 0.3, leafStride: 2, leafScale: 2.9, billboard: 'single' };
sp('oak', 'Oak Large', 17, 'oak', 'oak', (o) => { o.leaves.count = 9; }, 2);
sp('oak_m', 'Oak Medium', 12, 'oak', 'oak', (o) => {}, 1);
sp('ash', 'Ash Large', 18, 'ash', 'ash', (o) => {}, 2);
sp('birch', 'Aspen Large', 15, 'birch', 'aspen', (o) => { o.branch.radius[0] *= 0.8; }, 2);
sp('pine', 'Pine Large', 21, 'pine', 'pine', (o) => {}, 2, { sectionStride: 3, segmentFactor: 0.5, leafStride: 3, leafScale: 1.6 }, { sectionStride: 8, segmentFactor: 0.3, leafStride: 4, leafScale: 2.3, billboard: 'single' });
sp('spruce', 'Pine Medium', 19, 'pine', 'pine', (o) => { o.branch.children[0] = Math.round(o.branch.children[0] * 1.25); o.branch.length[1] *= 0.7; o.leaves.tint = 0x9fb59a; }, 2, { sectionStride: 3, segmentFactor: 0.5, leafStride: 3, leafScale: 1.6 }, { sectionStride: 8, segmentFactor: 0.3, leafStride: 4, leafScale: 2.3, billboard: 'single' });
sp('cypress', 'Pine Medium', 14, 'cedar', 'pine', (o) => { o.branch.length[1] *= 0.32; o.branch.angle[1] = 150; o.branch.children[0] = Math.round(o.branch.children[0] * 1.4); o.leaves.size *= 0.9; }, 1, { sectionStride: 3, segmentFactor: 0.5, leafStride: 3, leafScale: 1.6 }, { sectionStride: 8, segmentFactor: 0.3, leafStride: 4, leafScale: 2.3, billboard: 'single' });
sp('willow', 'Ash Large', 12, 'moss', 'ash', (o) => { o.branch.force = { direction: { x: 0, y: -1, z: 0 }, strength: 0.03 }; o.branch.length[0] *= 0.6; o.branch.length[2] *= 1.3; o.branch.length[3] *= 1.4; }, 1);
sp('olive', 'Oak Small', 7, 'olive', 'ash', (o) => { o.branch.length[0] *= 0.55; o.branch.gnarliness[0] = 0.2; o.branch.gnarliness[1] = 0.3; o.branch.angle[1] = 60; o.branch.radius[0] *= 1.25; o.leaves.size *= 0.75; }, 1);
sp('acacia', 'Ash Medium', 8, 'olive', 'ash', (o) => { o.branch.length[0] *= 0.5; o.branch.angle[1] = 70; o.branch.angle[2] = 75; o.branch.force = { direction: { x: 0, y: 1, z: 0 }, strength: -0.01 }; o.branch.length[1] *= 1.3; o.leaves.size *= 0.6; o.leaves.count = Math.max(4, o.leaves.count); }, 1);
sp('dead', 'Oak Medium', 11, 'dead', 'oak', (o) => { o.leaves.count = 0; o.branch.gnarliness[1] = 0.25; }, 1);
sp('bush', 'Bush 1', 2.4, 'ash', 'oak', (o) => {}, 1);
sp('bush2', 'Bush 2', 2.0, 'ash', 'ash', (o) => {}, 1);
sp('bush3', 'Bush 3', 2.6, 'ash', 'aspen', (o) => {}, 1);

function quant(arr, comps) {           // float -> int16 normalised by a per-component bound
  const n = arr.length / comps, mn = new Array(comps).fill(1e9), mx = new Array(comps).fill(-1e9);
  for (let i = 0; i < n; i++) for (let c = 0; c < comps; c++) { const v = arr[i * comps + c]; if (v < mn[c]) mn[c] = v; if (v > mx[c]) mx[c] = v; }
  const out = new Int16Array(arr.length);
  for (let i = 0; i < n; i++) for (let c = 0; c < comps; c++) { const r = mx[c] - mn[c] || 1; out[i * comps + c] = Math.round(((arr[i * comps + c] - mn[c]) / r) * 65534 - 32767); }
  return { data: Buffer.from(out.buffer).toString('base64'), min: mn, max: mx };
}
function q8(arr) { const out = new Int8Array(arr.length); for (let i = 0; i < arr.length; i++) out[i] = Math.round(Math.max(-1, Math.min(1, arr[i])) * 127); return Buffer.from(out.buffer).toString('base64'); }
function idx(g) { const a = g.index.array; const n = g.attributes.position.count; const out = n < 65536 ? new Uint16Array(a) : new Uint32Array(a); return { data: Buffer.from(out.buffer).toString('base64'), u32: n >= 65536 }; }
function pack(g, s, leaf, crown) {
  const p = g.attributes.position.array.slice(); for (let i = 0; i < p.length; i++) p[i] *= s;
  let nr = g.attributes.normal.array.slice();
  if (leaf) {   // foliage normals point out of the crown: soft, volumetric shading
    for (let i = 0; i < p.length; i += 3) {
      let dx = p[i] - crown[0], dy = (p[i + 1] - crown[1]) * 0.8, dz = p[i + 2] - crown[2]; const l = Math.hypot(dx, dy, dz) || 1;
      dx /= l; dy /= l; dz /= l; let nx = nr[i] * 0.25 + dx * 0.75, ny = nr[i + 1] * 0.25 + dy * 0.75 + 0.15, nz = nr[i + 2] * 0.25 + dz * 0.75; const m = Math.hypot(nx, ny, nz) || 1;
      nr[i] = nx / m; nr[i + 1] = ny / m; nr[i + 2] = nz / m;
    }
  }
  const uv = g.attributes.uv.array;
  if (leaf) return { n: g.attributes.position.count, quads: g.attributes.position.count / 4, pos: quant(p, 3), nrm: q8(nr), tris: g.index.count / 3 };
  return { n: g.attributes.position.count, pos: quant(p, 3), nrm: q8(nr), uv: quant(uv, 2), idx: idx(g), tris: g.index.count / 3 };
}
const out = { v: 1, species: {} };
let total = 0;
for (const s of SPECIES) {
  const vars = [];
  for (let k = 0; k < s.variants; k++) {
    const o = base(s.preset); o.seed = (o.seed || 1) + k * 7919; s.tweak(o);
    const t = new Tree(); t.options.copy(o);
    const g0 = t.createGeometry(s.lod0 && Object.keys(s.lod0).length ? s.lod0 : L0);
    // the far level: one branch level fewer (twigs are invisible at range), leaves fewer but larger
    const o1 = clone(o); if (o1.branch.levels > 1) { o1.branch.levels -= 1; o1.leaves.count = Math.round(o1.leaves.count * 1.0); }
    const t1 = new Tree(); t1.options.copy(o1);
    const g1 = t1.createGeometry(s.lod1 && Object.keys(s.lod1).length ? s.lod1 : L1);
    g0.branches = simplify(g0.branches, 0.55, 0.004);
    g1.branches = simplify(g1.branches, 0.18, 0.02);
    g0.branches.computeBoundingBox(); const bb = g0.branches.boundingBox;
    let H = bb.max.y - bb.min.y;
    let crown = [0, H * 0.65, 0], cr = 1;
    if (g0.leaves.attributes.position.count) {
      g0.leaves.computeBoundingBox(); const lb = g0.leaves.boundingBox; H = Math.max(H, lb.max.y);
      crown = [(lb.min.x + lb.max.x) / 2, (lb.min.y + lb.max.y) / 2, (lb.min.z + lb.max.z) / 2]; cr = Math.max(lb.max.x - lb.min.x, lb.max.z - lb.min.z) / 2;
    }
    const sc = s.height / H;
    // trunk radius at the base for collisions
    let r0 = 0; const pa = g0.branches.attributes.position.array;
    for (let i = 0; i < pa.length; i += 3) if (pa[i + 1] < H * 0.03) r0 = Math.max(r0, Math.hypot(pa[i], pa[i + 2]));
    const crownM = crown.map((v) => v * sc);
    const v = {
      height: +(H * sc).toFixed(2), crown: crownM.map((x) => +x.toFixed(2)), crownR: +(cr * sc).toFixed(2), trunkR: +(r0 * sc).toFixed(3),
      lod0: { trunk: pack(g0.branches, sc, false), leaves: g0.leaves.attributes.position.count ? pack(g0.leaves, sc, true, crownM) : null },
      lod1: { trunk: pack(g1.branches, sc, false), leaves: g1.leaves.attributes.position.count ? pack(g1.leaves, sc, true, crownM) : null },
    };
    const tris = v.lod0.trunk.tris + (v.lod0.leaves ? v.lod0.leaves.tris : 0), tris1 = v.lod1.trunk.tris + (v.lod1.leaves ? v.lod1.leaves.tris : 0);
    console.log(s.id, k, 'h', v.height, 'crownR', v.crownR, 'trunkR', v.trunkR, 'lod0 tris', tris, 'lod1 tris', tris1);
    vars.push(v);
  }
  out.species[s.id] = { bark: s.bark, leaf: s.leaf, variants: vars };
}
fs.mkdirSync(OUT.replace(/\/[^/]*$/, ''), { recursive: true });
const js = JSON.stringify(out); fs.writeFileSync(OUT, js); console.log('wrote', OUT, js.length);
