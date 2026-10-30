/* ═════════ landforms scanned from the real world (Sketchfab, CC-BY 4.0, credited): a limestone peak by Metazeon set into the
   mountains, terraced fields by Metazeon on the hillsides. Each one is welded, simplified to three levels of detail with its own
   baked textures (tools/um_scan2.py); the land around it bends to meet its edge, and you can walk and climb on it ═════════ */
const LAND = { defs: {}, list: [], grid: new Map(), on: false, meshes: [], ready: false };
const LAND_CELL = 256;
function landGeo(L) {
  const g = new THREE.BufferGeometry(), n = L.n;
  g.setAttribute('position', new THREE.BufferAttribute(deq(L.pos, n, 3), 3));
  const nb = b64Bytes(L.nrm), ni = new Int8Array(nb.buffer, nb.byteOffset, nb.length), nr = new Float32Array(n * 3);
  for (let i = 0; i < n * 3; i++) nr[i] = ni[i] / 127;
  g.setAttribute('normal', new THREE.BufferAttribute(nr, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(deq(L.uv, n, 2), 2));
  const ib = b64Bytes(L.idx.data);
  g.setIndex(new THREE.BufferAttribute(L.idx.u32 ? new Uint32Array(ib.buffer, ib.byteOffset, ib.length / 4) : new Uint16Array(ib.buffer, ib.byteOffset, ib.length / 2), 1));
  g.computeBoundingSphere();
  return g;
}
/* a square-window minimum (or maximum) over the grid, one axis at a time, edges clamped */
function gridMinMax(A, n, r, max) {
  const T = new Float32Array(n * n), O = new Float32Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    let v = A[j * n + i]; const k1 = Math.min(n - 1, i + r);
    for (let k = Math.max(0, i - r); k <= k1; k++) { const w = A[j * n + k]; if (max ? w > v : w < v) v = w; }
    T[j * n + i] = v;
  }
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    let v = T[j * n + i]; const k1 = Math.min(n - 1, j + r);
    for (let k = Math.max(0, j - r); k <= k1; k++) { const w = T[k * n + i]; if (max ? w > v : w < v) v = w; }
    O[j * n + i] = v;
  }
  return O;
}
/* the height grid: the scan's top surface (and, outside it, the height of its nearest edge), plus the distance to the scan.
   For a building scanned from outside (the cathedral, the fortress) the top surface is its roofs and towers; the island's ground
   under it follows G instead: the same grid opened (a minimum then a maximum over a window wider than the buildings), which
   keeps the hill they stand on and drops the buildings, so the ground does not rise into cones around the towers. */
/* how far each cell lies inside the scan, in cells (0 outside): a two-pass chamfer distance */
function insideDist(D, n) {
  const d = new Float32Array(n * n);
  for (let k = 0; k < n * n; k++) d[k] = D[k] > 0 ? 0 : 1e9;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const k = j * n + i; let v = d[k]; if (!v) continue;
    if (i > 0) v = Math.min(v, d[k - 1] + 1);
    if (j > 0) { v = Math.min(v, d[k - n] + 1); if (i > 0) v = Math.min(v, d[k - n - 1] + 1.414); if (i < n - 1) v = Math.min(v, d[k - n + 1] + 1.414); }
    d[k] = v;
  }
  for (let j = n - 1; j >= 0; j--) for (let i = n - 1; i >= 0; i--) {
    const k = j * n + i; let v = d[k]; if (!v) continue;
    if (i < n - 1) v = Math.min(v, d[k + 1] + 1);
    if (j < n - 1) { v = Math.min(v, d[k + n] + 1); if (i < n - 1) v = Math.min(v, d[k + n + 1] + 1.414); if (i > 0) v = Math.min(v, d[k + n - 1] + 1.414); }
    d[k] = v;
  }
  return d;
}
function landField(hf, openM, erodeM) {
  const n = hf.n, hb = b64Bytes(hf.data), hq = new Uint16Array(hb.buffer, hb.byteOffset, n * n), H = new Float32Array(n * n);
  for (let i = 0; i < n * n; i++) H[i] = hq[i] / 65535 * hf.hmax;
  const db = b64Bytes(hf.dist), D = new Float32Array(n * n), ds = hf.dscale || 4; for (let i = 0; i < n * n; i++) D[i] = db[i] / ds;
  // the edge of the scan: cells inside with a neighbour outside, for fitting it to the land
  const edge = [];
  for (let j = 1; j < n - 1; j++) for (let i = 1; i < n - 1; i++) { const k = j * n + i; if (D[k] > 0) continue; if (D[k - 1] > 0 || D[k + 1] > 0 || D[k - n] > 0 || D[k + n] > 0) edge.push([hf.x0 + (i + 0.5) * hf.cell, hf.z0 + (j + 0.5) * hf.cell, H[k]]); }
  const step = Math.max(1, Math.floor(edge.length / 72));
  // the box the scan covers, in its own units (the terraced fields are a clean rectangle: their rim is hidden under grass, see landRim)
  let i0 = n, i1 = -1, j0 = n, j1 = -1;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) if (D[j * n + i] <= 0) { if (i < i0) i0 = i; if (i > i1) i1 = i; if (j < j0) j0 = j; if (j > j1) j1 = j; }
  const box = [hf.x0 + i0 * hf.cell, hf.z0 + j0 * hf.cell, hf.x0 + (i1 + 1) * hf.cell, hf.z0 + (j1 + 1) * hf.cell];
  // a building you walk into (the warehouse): its grid is the floor, and some cells are wall
  let W = null; if (hf.wall) { const wb = b64Bytes(hf.wall); W = new Uint8Array(n * n); for (let i = 0; i < n * n; i++) W[i] = (wb[i >> 3] >> (7 - (i & 7))) & 1; }
  let Tp = null; if (hf.top) { const tb = b64Bytes(hf.top), tq = new Uint16Array(tb.buffer, tb.byteOffset, n * n); Tp = new Float32Array(n * n); for (let i = 0; i < n * n; i++) Tp[i] = tq[i] / 65535 * hf.tmax; }
  const r = openM ? Math.max(1, Math.round(openM / hf.cell)) : 0; let G = r ? gridMinMax(gridMinMax(H, n, r, false), n, r, true) : null;
  // a scan with cliffs of its own (the fortress's rock): the ground under it also steps back from every drop by a few metres, so
  // the island's coarser ground cannot lean out in front of a cliff face; at the scan's edge it still meets the scan exactly
  if (erodeM) {
    const r2 = Math.max(1, Math.round(erodeM / hf.cell)), B = G || H, E = gridMinMax(B, n, r2, false), Di = insideDist(D, n);
    G = new Float32Array(n * n); for (let k = 0; k < n * n; k++) { const t = Math.min(1, Di[k] / (2 * r2)); G[k] = B[k] + (E[k] - B[k]) * t; }
  }
  return { n, x0: hf.x0, z0: hf.z0, cell: hf.cell, pad: hf.pad, H, G, D, W, T: Tp, box, edge: edge.filter((_, i) => i % step === 0) };
}
/* the roof over an interior cell (bilinear like the floor) */
function landRoof(F, lx, lz) {
  const gx = clamp((lx - F.x0) / F.cell - 0.5, 0, F.n - 1.001), gz = clamp((lz - F.z0) / F.cell - 0.5, 0, F.n - 1.001), i = gx | 0, j = gz | 0, u = gx - i, v = gz - j, k = j * F.n + i;
  return (F.T[k] * (1 - u) + F.T[k + 1] * u) * (1 - v) + (F.T[k + F.n] * (1 - u) + F.T[k + F.n + 1] * u) * v;
}
/* a wall cell of an interior (nearest cell) */
function landWall(F, lx, lz) { const i = Math.floor((lx - F.x0) / F.cell), j = Math.floor((lz - F.z0) / F.cell); return i >= 0 && j >= 0 && i < F.n && j < F.n && F.W[j * F.n + i] === 1; }
function landSample(F, lx, lz, ground) {
  const gx = (lx - F.x0) / F.cell - 0.5, gz = (lz - F.z0) / F.cell - 0.5;
  if (gx < 0 || gz < 0 || gx >= F.n - 1 || gz >= F.n - 1) return null;
  const i = gx | 0, j = gz | 0, u = gx - i, v = gz - j, k = j * F.n + i, H = ground && F.G ? F.G : F.H;
  const h = (H[k] * (1 - u) + H[k + 1] * u) * (1 - v) + (H[k + F.n] * (1 - u) + H[k + F.n + 1] * u) * v;
  const d = (F.D[k] * (1 - u) + F.D[k + 1] * u) * (1 - v) + (F.D[k + F.n] * (1 - u) + F.D[k + F.n + 1] * u) * v;
  return _ls.set(h, d);
}
const _ls = { h: 0, d: 0, set(h, d) { this.h = h; this.d = d; return this; } };
/* which landform covers a point: local coordinates of the point in it */
function landLocal(L, x, z) { const dx = (x - L.x) / L.s, dz = (z - L.z) / L.s; return [dx * L.c - dz * L.sn, dx * L.sn + dz * L.c]; }
function landsNear(x, z) { return LAND.grid.get(Math.floor(x / LAND_CELL) * 4096 + Math.floor(z / LAND_CELL)); }
/* a rim of the island's own ground over the edge of a rectangular scan (the terraced fields): how wide it is here, in metres,
   and how far a point lies inside the scan's box. The same wavy width is worked out in the scan's shader (landMaterial),
   which drops the scan where the grass has it, so the fields end in a ragged green edge instead of a straight cut. */
const landRim = (x, z) => 11 + 4.5 * Math.sin(x * 0.047 + 1.3) * Math.sin(z * 0.061 + 0.4) + 2.5 * Math.sin((x - z) * 0.093 + 2.1);
function landInside(L, lx, lz) { const b = L.def.F.box; return Math.min(lx - b[0], b[2] - lx, lz - b[1], b[3] - lz) * L.s; }
const RIM_UP = 0.12;
/* the land under and around a landform: hidden just under the scan, blended out to the natural ground beyond its edge */
function landTerrain(x, z, h) {
  const a = landsNear(x, z); if (!a) return h;
  for (const L of a) {
    const [lx, lz] = landLocal(L, x, z), q = landSample(L.def.F, lx, lz, true); if (!q) continue;
    const top = L.y + q.h * L.s;
    if (L.def.blend) {
      // the grass rim: just over the scan's surface where the scan is dropped, sliding under it a few metres further in
      if (q.d <= 0.35) {
        const e = landInside(L, lx, lz), rim = landRim(x, z);
        if (e < rim) return top + RIM_UP;
        return e < rim + 4 ? lerp(top + RIM_UP, top - 0.9, (e - rim) / 4) : top - 0.9;
      }
      const k = smooth(0.35, L.def.F.pad * 0.95, q.d);
      return lerp(top + RIM_UP, h, k * k * (3 - 2 * k));
    }
    // under the scan the ground stays just beneath it; around it the land bends, all the way out, to meet its edge
    if (q.d <= 0.35) return top - 0.9;
    const k = smooth(0.35, L.def.F.pad * 0.95, q.d), meet = top - 0.9 + Math.min(0.9, q.d * 0.6);
    return lerp(meet, h, k * k * (3 - 2 * k));
  }
  return h;
}
/* the scan's surface where you stand (−∞ off it or on its grass rim): walking, climbing, landing */
function landOn(L, x, z, lx, lz) { return !L.def.blend || landInside(L, lx, lz) >= landRim(x, z) + 1.5; }
function landTop(x, z, y) {
  const a = landsNear(x, z); if (!a) return -Infinity;
  for (const L of a) {
    const [lx, lz] = landLocal(L, x, z), F = L.def.F, q = landSample(F, lx, lz);
    if (!q || q.d > 0.5 || !landOn(L, x, z, lx, lz)) continue;
    // an interior: the floor inside, walls stop you, and whoever is up on the roof (or comes down on it) stands on the roof
    if (F.T && y !== undefined) { const roof = L.y + landRoof(F, lx, lz) * L.s; if (y > roof - 0.7) return roof; }
    return L.y + (q.h + (F.W && landWall(F, lx, lz) ? 3.2 : 0)) * L.s;
  }
  return -Infinity;
}
const inLandform = (x, z) => landTop(x, z) > -Infinity;
function landKindAt(x, z) {
  const a = landsNear(x, z); if (!a) return null;
  for (const L of a) { const [lx, lz] = landLocal(L, x, z), q = landSample(L.def.F, lx, lz); if (q && q.d <= 0.5 && landOn(L, x, z, lx, lz)) return L.kind; }
  return null;
}

const LAND_PLAN = {
  // count per map, scale range, spacing
  crag: { island: 6, desert: 3, snow: 6, forest: 4, water: 0, mega: 30, s: [0.27, 0.5], sMega: [0.34, 0.66], gap: 750 },
  terraces: { island: 2, desert: 0, snow: 0, forest: 2, water: 0, mega: 8, s: [0.55, 0.78], sMega: [0.6, 0.85], gap: 1600 },
  // the owner's scans of buildings (CC-BY 4.0): Ghazanchetsots Cathedral on its square by a town, Khertvisi Fortress on a ridge
  cathedral: { island: 1, desert: 1, snow: 1, forest: 1, water: 0, mega: 3, s: [1, 1], sMega: [1, 1], gap: 2400 },
  // Aurélien Martel's scenes: a rainy old-town street (CC-BY-NC 4.0) and an abandoned warehouse you can walk into (CC-BY 4.0)
  street: { island: 1, desert: 0, snow: 1, forest: 1, water: 0, mega: 2, s: [1, 1], sMega: [1, 1], gap: 3000 },
  warehouse: { island: 2, desert: 1, snow: 1, forest: 1, water: 1, mega: 6, s: [1, 1], sMega: [1, 1], gap: 900 },
  fortress: { island: 1, desert: 1, snow: 1, forest: 1, water: 0, mega: 4, s: [0.95, 1.05], sMega: [1, 1.15], gap: 2400 },
};
const LAND_NAMES = { cathedral: 'الكاتدرائية البيضاء', fortress: 'قلعة الصخرة', street: 'شارع ما بعد المطر', warehouse: 'المستودع المهجور' };
const LAND_BYTOWN = { cathedral: 1, street: 1, warehouse: 1 };
// half the width of the widest building, in metres (see landField); the street's houses are solid blocks with no floor inside,
// so its floor grid holds their roofs there and needs the same
const LAND_OPEN = { cathedral: 14, fortress: 12, street: 9 };
const LAND_ERODE = { fortress: 6 };
async function loadLandforms() {
  const want = Object.keys(LAND_PLAN).filter((k) => (LAND_PLAN[k][MAP_ID] ?? 3) > 0);
  if (!want.length) return;
  const defs = await Promise.all(want.map((k) => fetchJSON('assets/scans/' + k + '.json').then((d) => [k, d]).catch(() => null)));
  for (const e of defs) if (e) { const [k, d] = e; LAND.defs[k] = { d, F: landField(d.hf, LAND_OPEN[k] || 0, LAND_ERODE[k] || 0), size: d.size, blend: k === 'terraces', interior: !!d.interior }; }
  placeLandforms();
  // the textures and meshes come after; the land is already shaped
  loadLandMeshes().catch((e) => console.warn('landforms', e));
}
function placeLandforms() {
  const r = RNG(MAP_ID.length * 7919 + 17), taken = [];
  const farFromTowns = (x, z, R) => !SETTLEMENTS.some((S) => Math.hypot(S.x - x, S.z - z) < S.r + R + 140) && !(WORLD.data.poi || []).some((p) => Math.hypot(p.x - x, p.z - z) < R + 90);
  // the cathedral stands just outside a town, on its own square: close to the houses, clear of them
  const byTown = (x, z, R) => SETTLEMENTS.some((S) => S.kind !== 'poi' && S.kind !== 'military' && Math.hypot(S.x - x, S.z - z) < S.r + R + 170) && !SETTLEMENTS.some((S) => Math.hypot(S.x - x, S.z - z) < S.r + R + 25) && !(WORLD.data.poi || []).some((p) => Math.hypot(p.x - x, p.z - z) < R + 60);
  for (const [kind, plan] of Object.entries(LAND_PLAN)) {
    const D = LAND.defs[kind]; if (!D) continue;
    const count = plan[MAP_ID] ?? 3, [s0, s1] = MAP_ID === 'mega' ? plan.sMega : plan.s;
    // candidates on a grid: high, rough ground for the peak; gentle farmed hillsides for the terraces
    const cand = [], step = MAP_ID === 'mega' ? 220 : 120;
    for (let z = -PLAY + 300; z < PLAY - 300; z += step) for (let x = -PLAY + 300; x < PLAY - 300; x += step) {
      const px = x + (r() - 0.5) * step * 0.8, pz = z + (r() - 0.5) * step * 0.8, h = terrainAt(px, pz), b = biomeAt(px, pz), c = classAt(px, pz);
      if (h < 6 || waterAt(px, pz) > h - 3 || c === 2 || c === 7 || c === 8 || c === 9 || c === 10 || b === 0 || b === 12 || b === 13) continue;
      const sl = slopeAt(px, pz);
      let score;
      if (kind === 'crag') score = h + sl * 160 + (b === 5 || b === 4 || b === 10 ? 80 : 0) + r() * 40;
      else if (kind === 'fortress') { if (sl < 0.08 || sl > 0.7) continue; score = h * 0.6 + sl * 120 - Math.abs(sl - 0.3) * 80 + r() * 60; }
      else if (LAND_BYTOWN[kind]) { if (sl > (kind === 'warehouse' ? 0.09 : 0.07)) continue; score = 100 - sl * 600 + r() * 30; }
      else { if (sl < 0.04 || sl > 0.5 || !(b === 6 || b === 11 || b === 2 || b === 3 || b === 9)) continue; score = 100 - Math.abs(sl - 0.2) * 180 + r() * 40 + (b === 6 ? 30 : 0); }
      cand.push([score, px, pz]);
    }
    cand.sort((a, b) => b[0] - a[0]);
    let placed = 0, cold = 0;
    // the town buildings try the edge of a town first, then any open ground away from the towns (an outlying ruin)
    for (const nearTown of LAND_BYTOWN[kind] ? [true, false] : [false]) for (const [, x, z] of cand) {
      if (placed >= count) break;
      const isCold = tempAt(x, z) < 0.42;
      if (kind === 'crag' && MAP_ID !== 'snow' && isCold && cold >= Math.ceil(count / 3)) continue;
      const s = lerp(s0, s1, r()), F = D.F, R = (Math.hypot(D.size[0], D.size[2]) * 0.5 + F.pad * F.cell * 0.85) * s;
      // the spacing is between landforms of a kind; a building only keeps clear of the others (the 2–3 km gaps of the cathedral,
      // the street and the fortress counted against every crag and field left no room for them on the island)
      if (taken.some((t) => Math.hypot(t.x - x, t.z - z) < (t.kind === kind || !LAND_NAMES[kind] ? Math.max(plan.gap, t.R + R + 80) : t.R + R + 250))) continue;
      if (nearTown ? !byTown(x, z, R) : !farFromTowns(x, z, R)) continue;
      let wet = false, road = false;
      for (const f of [0, 0.5, 1]) for (let k = 0; k < (f ? 16 : 1) && !wet && !road; k++) {
        const a = k / 16 * TAU, px = x + Math.cos(a) * R * f, pz = z + Math.sin(a) * R * f;
        if (waterAt(px, pz) > terrainAt(px, pz) - 1) wet = true;
        if (roadDist(px, pz) < 26 || classAt(px, pz) === 2 || classAt(px, pz) === 7) road = true;
      }
      if (wet || road || Math.abs(x) + R > PLAY - 80 || Math.abs(z) + R > PLAY - 80) continue;
      // turn it until its edge meets the land best, then set its height from that edge
      let best = null;
      for (let k = 0; k < 36; k++) {
        const rot = k / 36 * TAU, c = Math.cos(rot), sn = Math.sin(rot), diffs = [];
        for (const [ex, ez, eh] of F.edge) {
          const wx = x + (ex * c + ez * sn) * s, wz = z + (-ex * sn + ez * c) * s;
          diffs.push(terrainAt(wx, wz) - eh * s);
        }
        diffs.sort((a, b) => a - b);
        const y = diffs[Math.floor(diffs.length * 0.5)];
        let cost = 0; for (const d of diffs) cost += Math.abs(d - y);
        if (!best || cost < best.cost) best = { cost, rot, y };
      }
      if (best.cost / F.edge.length > (kind === 'crag' ? 0.1 : kind === 'street' ? 0.05 : LAND_BYTOWN[kind] ? 0.03 : 0.08) * D.size[1] * s) continue;
      const sink = kind === 'crag' ? D.size[1] * s * 0.03 : kind === 'fortress' ? D.size[1] * s * 0.02 : LAND_BYTOWN[kind] ? 0.12 : 0.6;
      const L = { kind, def: D, x, z, s, rot: best.rot, c: Math.cos(best.rot), sn: Math.sin(best.rot), y: best.y - sink, R };
      LAND.list.push(L); taken.push(L); placed++; if (isCold) cold++;
    }
  }
  for (const L of LAND.list) {
    for (let i = Math.floor((L.x - L.R) / LAND_CELL); i <= Math.floor((L.x + L.R) / LAND_CELL); i++) for (let j = Math.floor((L.z - L.R) / LAND_CELL); j <= Math.floor((L.z + L.R) / LAND_CELL); j++) {
      const k = i * 4096 + j; if (!LAND.grid.has(k)) LAND.grid.set(k, []); LAND.grid.get(k).push(L);
    }
  }
  LAND.on = LAND_ON = LAND.list.length > 0;
  // terrain already built around the attract camera is rebuilt over them
  if (LAND.on && typeof TERRAIN !== 'undefined') for (const L of LAND.list) TERRAIN.dirtyArea(L.x, L.z, L.R);
  console.log('landforms', LAND.list.map((L) => L.kind + '@' + Math.round(L.x) + ',' + Math.round(L.z) + ' s' + L.s.toFixed(2)).join(' '));
}
function landMaterial(tex, kind) {
  const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.94, metalness: 0 });
  m.envMapIntensity = 0.35;
  m.customProgramCacheKey = () => 'land3';
  const D = LAND.defs[kind], box = D && D.F.box;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uClimate = CLIMATE_U; sh.uniforms.uSnowC = SNOWC_U; sh.uniforms.uDry = { value: MAP_ID === 'desert' ? 1 : 0 }; sh.uniforms.uWet = WET_U;
    sh.uniforms.uBox = { value: new THREE.Vector4(...(box || [0, 0, 0, 0])) }; sh.uniforms.uRim = { value: D && D.blend ? 1 : 0 };
    // the terraced fields were scanned in a pale dry season: graded towards the game's farmland so they sit in its green
    // (measured in game: graded this way the fields sit a shade lighter than the island's grass instead of glowing pale)
    sh.uniforms.uGrade = { value: kind === 'terraces' ? new THREE.Vector4(0.34, 0.53, 0.2, 0.5) : new THREE.Vector4(1, 1, 1, 0.9) };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vLW; varying vec3 vLN; varying vec2 vLoc; varying float vScl;')
      .replace('#include <fog_vertex>', `#include <fog_vertex>
        vLoc = transformed.xz;
        #ifdef USE_INSTANCING
          vLW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz; vLN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal); vScl = length(instanceMatrix[0].xyz);
        #else
          vLW = (modelMatrix * vec4(transformed, 1.0)).xyz; vLN = normalize(mat3(modelMatrix) * objectNormal); vScl = 1.0;
        #endif`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
        varying vec3 vLW; varying vec3 vLN; varying vec2 vLoc; varying float vScl; uniform float uDry, uWet, uRim; uniform vec4 uGrade, uBox;
        ${WINTER_GLSL}`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        if (uRim > 0.5) {
          // the grass rim (landRim in 31_landforms): the land's own ground lies over the scan here
          float e = min(min(vLoc.x - uBox.x, uBox.z - vLoc.x), min(vLoc.y - uBox.y, uBox.w - vLoc.y)) * vScl;
          float rim = 11.0 + 4.5 * sin(vLW.x * 0.047 + 1.3) * sin(vLW.z * 0.061 + 0.4) + 2.5 * sin((vLW.x - vLW.z) * 0.093 + 2.1);
          if (e < rim) discard;
        }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        {
          // the scan's light is baked in: lift its shadows a little so the sun of the game does the shading
          diffuseColor.rgb *= uGrade.w * uGrade.xyz; { float l = dot(diffuseColor.rgb, vec3(0.3, 0.5, 0.2)); diffuseColor.rgb = max(vec3(0.0), mix(vec3(l), diffuseColor.rgb, 1.3)); }
          float green = diffuseColor.g - max(diffuseColor.r, diffuseColor.b);
          if (uDry > 0.5) diffuseColor.rgb = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(0.35, 0.45, 0.2))) * vec3(1.18, 0.95, 0.7), smoothstep(-0.01, 0.04, green) * 0.85 + 0.25);
          float lum = dot(diffuseColor.rgb, vec3(0.3, 0.5, 0.2));
          float wnt = winterAt(vLW.xz) * smoothstep(0.62, 0.9, vLN.y) * smoothstep(0.08, 0.3, lum);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.8, 0.83, 0.88), wnt * 0.8);
          diffuseColor.rgb *= 1.0 - uWet * 0.3;
        }`);
  };
  ENV_MATS.push(m);
  return m;
}
// where a kind's files are: the scans, or (the two halls of the lobby, placed by the world editor) the rooms
const LAND_DIR = { kingshall: 'assets/rooms/', hintze: 'assets/rooms/' };
const landDir = (kind) => LAND_DIR[kind] || 'assets/scans/';
/* the meshes of a kind: one instanced mesh per level of detail, with room for the world editor's own copies */
async function landMeshes(kind, D, cap) {
  if (D.meshP) return D.meshP;
  D.meshP = (async () => {
    const hi = QUALITY.tier >= 2, lods = D.d.lods;
    for (let k = 0; k < lods.length; k++) {
      const L = lods[k], url = landDir(kind) + (k === 0 && hi && L.texHi ? L.texHi : L.tex);
      const im = await loadImage(url);
      const tex = new THREE.Texture(im); tex.flipY = false; tex.encoding = THREE.sRGBEncoding; tex.anisotropy = MAX_ANISO; tex.needsUpdate = true;
      const m = new THREE.InstancedMesh(landGeo(L), landMaterial(tex, kind), cap);
      m.count = 0; m.frustumCulled = false; m.receiveShadow = true; m.castShadow = QUALITY.shadows && k === 0;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(m);
      D['mesh' + k] = m;
    }
    D.cap = cap; LAND.lastX = 1e9;
  })();
  return D.meshP;
}
async function loadLandMeshes() {
  for (const [kind, D] of Object.entries(LAND.defs)) {
    const items = LAND.list.filter((L) => L.kind === kind); if (!items.length) continue;
    await landMeshes(kind, D, items.length + 24);
  }
  LAND.ready = true; LAND.lastX = 1e9;
}
/* ── the world editor's landforms: any kind, fetched the first time it is asked for, put down, moved, taken away ── */
const LAND_DEFP = {};
function landDef(kind) {
  if (LAND_DEFP[kind]) return LAND_DEFP[kind];
  LAND_DEFP[kind] = (async () => {
    let D = LAND.defs[kind];
    if (!D) { const d = await fetchJSON(landDir(kind) + kind + '.json'); D = LAND.defs[kind] = { d, F: landField(d.hf, LAND_OPEN[kind] || 0, LAND_ERODE[kind] || 0), size: d.size, blend: kind === 'terraces', interior: !!d.interior }; }
    await landMeshes(kind, D, LAND.list.filter((L) => L.kind === kind).length + 24);
    LAND.ready = true;
    return D;
  })().catch((e) => { LAND_DEFP[kind] = null; throw e; });
  return LAND_DEFP[kind];
}
function landGridSet(L, add) {
  for (let i = Math.floor((L.x - L.R) / LAND_CELL); i <= Math.floor((L.x + L.R) / LAND_CELL); i++) for (let j = Math.floor((L.z - L.R) / LAND_CELL); j <= Math.floor((L.z + L.R) / LAND_CELL); j++) {
    const k = i * 4096 + j; let a = LAND.grid.get(k);
    if (add) { if (!a) LAND.grid.set(k, a = []); a.push(L); }
    else if (a) { const q = a.indexOf(L); if (q >= 0) a.splice(q, 1); if (!a.length) LAND.grid.delete(k); }
  }
}
/* the height a landform sits at so its edge meets the land here (as placeLandforms fits them) */
function landFitY(D, x, z, rot, s) {
  const c = Math.cos(rot), sn = Math.sin(rot), F = D.F, diffs = [];
  for (const [ex, ez, eh] of F.edge) diffs.push(terrainBare(x + (ex * c + ez * sn) * s, z + (-ex * sn + ez * c) * s) - eh * s);
  diffs.sort((a, b) => a - b);
  return diffs.length ? diffs[diffs.length >> 1] : terrainBare(x, z);
}
function landRadius(D, s) { const F = D.F; return (Math.hypot(D.size[0], D.size[2]) * 0.5 + F.pad * F.cell * 0.85) * s; }
function landSet(L, x, z, rot, s, y) {
  const was = LAND.list.includes(L);
  if (was) { landGridSet(L, false); TERRAIN.dirtyArea(L.x, L.z, L.R); }
  Object.assign(L, { x, z, s, rot, c: Math.cos(rot), sn: Math.sin(rot), y, R: landRadius(L.def, s) });
  if (!was) LAND.list.push(L);
  landGridSet(L, true); LAND.on = LAND_ON = true;
  TERRAIN.dirtyArea(x, z, L.R); LAND.lastX = 1e9;
  return L;
}
function landRemove(L) {
  const i = LAND.list.indexOf(L); if (i < 0) return;
  LAND.list.splice(i, 1); landGridSet(L, false); TERRAIN.dirtyArea(L.x, L.z, L.R); LAND.lastX = 1e9;
  LAND.on = LAND_ON = LAND.list.length > 0;
}
const _lm = new THREE.Matrix4(), _lq = new THREE.Quaternion(), _lp = new THREE.Vector3(), _ls3 = new THREE.Vector3(), _le = new THREE.Euler();
/* the warehouse keeps a few crates of military loot on its floor, put down the first time you come near it */
function landLoot() {
  if (!started) return;
  const p = player.pos;
  for (const L of LAND.list) {
    if (L.kind !== 'warehouse' || L.looted || Math.hypot(L.x - p.x, L.z - p.z) > 70) continue;
    L.looted = true;
    const F = L.def.F, r = RNG((Math.round(L.x) * 13 + Math.round(L.z) * 7) | 0), spots = [], m = Math.ceil(1.0 / F.cell);
    for (let k = 0; k < 600 && spots.length < 5; k++) {
      const i = Math.floor(r() * F.n), j = Math.floor(r() * F.n), c = j * F.n + i;
      if (F.D[c] > 0 || (F.W && F.W[c])) continue;
      let near = false;
      for (let a = -m; a <= m && !near; a++) for (let b = -m; b <= m; b++) { const ii = i + a, jj = j + b; if (ii >= 0 && jj >= 0 && ii < F.n && jj < F.n && F.W && F.W[jj * F.n + ii]) { near = true; break; } }
      if (near) continue;
      const lx = F.x0 + (i + 0.5) * F.cell, lz = F.z0 + (j + 0.5) * F.cell;
      const wx = L.x + (lx * L.c + lz * L.sn) * L.s, wz = L.z + (-lx * L.sn + lz * L.c) * L.s;
      if (spots.some(([x, z]) => Math.hypot(x - wx, z - wz) < 4)) continue;
      spots.push([wx, wz]);
    }
    for (const [x, z] of spots) {
      // the barracks table, its coins kept in the crate (rollLoot would pay them out at once)
      const items = []; let coins = 0;
      for (const [id, pr, a, b] of LOOT.military) if (rand() < pr) { const n = a + Math.floor(rand() * (b - a + 1)); if (id === 'coins') coins += n; else items.push([id, n]); }
      lootExtras('military', items);
      makeCrate(x, z, items, { coins, name: 'صندوق المستودع', life: 1800, y: groundAt(x, z, L.y + 1.5) });
    }
  }
}
function updateLandforms() {
  if (!LAND.ready) return;
  const cp = camera.position;
  if (Math.hypot(cp.x - LAND.lastX, cp.z - LAND.lastZ) < 15) return;
  LAND.lastX = cp.x; LAND.lastZ = cp.z;
  landLoot();
  for (const D of Object.values(LAND.defs)) for (let k = 0; k < 3; k++) if (D['mesh' + k]) D['mesh' + k].count = 0;
  for (const L of LAND.list) {
    const d = Math.hypot(L.x - cp.x, L.z - cp.z) - L.R * 0.5;
    if (d > camera.far + L.R) continue;
    const near = L.kind === 'crag' || L.kind === 'fortress' ? 380 : L.kind === 'warehouse' ? 160 : LAND_BYTOWN[L.kind] ? 260 : 320, mid = L.kind === 'crag' || L.kind === 'fortress' ? 1300 : L.kind === 'warehouse' ? 600 : LAND_BYTOWN[L.kind] ? 900 : 1000;
    let k = d < near ? 0 : d < mid ? 1 : 2, m = L.def['mesh' + k];
    while (!m && k > 0) m = L.def['mesh' + --k];          // (the halls have one level only)
    if (!m || m.count >= (L.def.cap || 1e9)) continue;
    _le.set(0, L.rot, 0); _lq.setFromEuler(_le); _lm.compose(_lp.set(L.x, L.y, L.z), _lq, _ls3.setScalar(L.s));
    m.setMatrixAt(m.count++, _lm);
  }
  for (const D of Object.values(LAND.defs)) for (let k = 0; k < 3; k++) { const m = D['mesh' + k]; if (m) { m.visible = m.count > 0; m.instanceMatrix.needsUpdate = true; } }
}
