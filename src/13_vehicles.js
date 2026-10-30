/* ═════════ vehicles: a Ferrari 458, a milk truck, sedans, taxis, vans, buses, a police car, an ambulance, a tractor, a desert buggy,
   the v3 pickup, 4x4 and dirt bike, bicycles, boats and rafts, and horses you can ride; traffic drives the roads ═════════ */
const VEHICLES = [];
const VSPEC = {
  sports: { name: 'فيراري ٤٥٨', max: 58, rev: 8, acc: 13, brake: 22, wb: 2.65, track: 1.68, R: 1.15, wr: 0.36, seat: [0.38, 0.0, -0.1], cam: 6.2, fh: 1.6, low: true },
  truck: { name: 'شاحنة الحليب', max: 25, rev: 5, acc: 5.2, brake: 12, wb: 2.8, track: 1.8, R: 1.4, wr: 0.43, seat: [0.5, 0.45, 1.2], cam: 8.5, fh: 2.6 },
  sedan: { name: 'سيارة صالون', max: 42, rev: 7, acc: 8.8, brake: 17, wb: 2.7, track: 1.56, R: 1.1, wr: 0.34, seat: [0.38, 0.05, -0.15], cam: 6.2, fh: 1.8 },
  taxi: { name: 'سيارة أجرة', max: 40, rev: 7, acc: 8.4, brake: 17, wb: 2.7, track: 1.56, R: 1.1, wr: 0.34, seat: [0.38, 0.05, -0.15], cam: 6.2, fh: 1.8 },
  police: { name: 'سيارة الشرطة', max: 50, rev: 7, acc: 10.5, brake: 19, wb: 2.75, track: 1.6, R: 1.12, wr: 0.35, seat: [0.38, 0.05, -0.15], cam: 6.2, fh: 1.8, siren: true },
  suv: { name: 'سيارة رياضية متعددة', max: 40, rev: 7, acc: 8.6, brake: 16, wb: 2.8, track: 1.66, R: 1.2, wr: 0.4, seat: [0.4, 0.2, -0.1], cam: 6.6, fh: 2.0, offroad: true },
  van: { name: 'شاحنة صغيرة مغلقة', max: 33, rev: 6, acc: 6.8, brake: 14, wb: 3.0, track: 1.7, R: 1.3, wr: 0.38, seat: [0.42, 0.3, 1.1], cam: 7.4, fh: 2.4 },
  ambulance: { name: 'سيارة إسعاف', max: 38, rev: 6, acc: 7.6, brake: 15, wb: 3.0, track: 1.7, R: 1.3, wr: 0.38, seat: [0.42, 0.3, 1.1], cam: 7.4, fh: 2.4, siren: true },
  bus: { name: 'حافلة', max: 26, rev: 4, acc: 4.6, brake: 11, wb: 5.6, track: 2.0, R: 1.6, wr: 0.48, seat: [0.6, 0.6, 4.1], cam: 11, fh: 3.2 },
  tractor: { name: 'جرّار زراعي', max: 11, rev: 4, acc: 4, brake: 10, wb: 2.2, track: 1.5, R: 1.2, wr: 0.7, seat: [0, 0.65, -0.4], cam: 6.6, fh: 2.6, offroad: true },
  buggy: { name: 'سيارة رمال', max: 38, rev: 7, acc: 11, brake: 16, wb: 2.2, track: 1.6, R: 1.0, wr: 0.42, seat: [0, 0.35, -0.2], cam: 5.8, fh: 1.9, offroad: true },
  pickup: { name: 'شاحنة صغيرة', max: 33.4, rev: 8, acc: 8.4, brake: 16, wb: 2.6, track: 1.62, R: 1.1, wr: 0.42, seat: [0.42, 0.12, -0.25], cam: 6.3, fh: 2.0, offroad: true },
  jeep: { name: 'جيب ميداني', max: 33.4, rev: 8, acc: 8.8, brake: 16, wb: 2.48, track: 1.54, R: 1.1, wr: 0.404, seat: [0.4, 0.08, -0.18], cam: 6.6, fh: 2.1, offroad: true },
  bike: { name: 'دراجة نارية', max: 36, rev: 2.5, acc: 10, brake: 15, wb: 1.45, track: 0.3, R: 0.62, wr: 0.33, seat: [0, -0.02, -0.3], cam: 4.4, fh: 1.75, lean: true, ride: true },
  bicycle: { name: 'درّاجة هوائية', max: 9, rev: 1.5, acc: 3.2, brake: 8, wb: 1.1, track: 0.3, R: 0.5, wr: 0.34, seat: [0, 0.15, -0.3], cam: 4.2, fh: 1.75, lean: true, ride: true, pedal: true },
  horse: { name: 'حصان', max: 13, rev: 1.5, acc: 4, brake: 8, wb: 1.6, track: 0.5, R: 0.9, wr: 1, seat: [0, 0.32, 0.1], cam: 5.4, fh: 2.3, horse: true, ride: true, offroad: true },
  boat: { name: 'قارب الصيد', water: true, max: 15, rev: 3.5, acc: 3.6, brake: 5, wb: 4.6, track: 2.1, R: 1.7, seat: [0, 0.16, -2.05], cam: 7.5, fh: 2.2, len: 5.2, wid: 2.0 },
  craftboat: { name: 'قاربك الخشبي', water: true, max: 12, rev: 3, acc: 3.2, brake: 4.5, wb: 3.6, track: 1.7, R: 1.4, seat: [0, -0.12, -1.3], cam: 6.6, fh: 1.9, len: 4.2, wid: 1.6 },
  raft: { name: 'الطوف', water: true, max: 4.2, rev: 2, acc: 1.5, brake: 2.4, wb: 3, track: 2.2, R: 1.45, seat: [0, -0.42, -0.45], cam: 5.8, fh: 1.5, len: 3.2, wid: 2.3, paddle: true },
  train: { name: 'القطار', max: 26, rev: 9, acc: 2, brake: 6, wb: 9, track: 2.6, R: 1.7, seat: [0.6, 2.05, -2.7], cam: 13, fh: 3.4, rail: true },     // the locomotive (30_features)
};
const TIRE_MAT = new THREE.MeshStandardMaterial({ color: C(0x1c1d1e), roughness: 0.93, metalness: 0 });
const RIM_MAT = new THREE.MeshStandardMaterial({ color: C(0x8c9196), roughness: 0.42, metalness: 0.75 });
const LAMP_MAT = new THREE.MeshStandardMaterial({ color: C(0xe8e4d8), emissive: C(0xfff2d0), emissiveIntensity: 0, roughness: 0.2 });
const TAIL_MAT = new THREE.MeshStandardMaterial({ color: C(0x5a0e0a), emissive: C(0xff2a12), emissiveIntensity: 0, roughness: 0.4 });
const CAR_GLASS = new THREE.MeshStandardMaterial({ color: C(0x0c1216), roughness: 0.06, metalness: 0.3 });
ENV_MATS.push(TIRE_MAT, RIM_MAT, CAR_GLASS);
const RUST_PAINTS = [0x4a3326, 0x2a2522, 0x5e4a3a, 0x3a3a36];
function paintMat(hex) {
  // car paint: glossy clear coat look with the env map; one material per colour
  const key = 'paint' + hex; if (paintMat[key]) return paintMat[key];
  const rust = RUST_PAINTS.includes(hex);      // the wrecks of the dead city: no shine left
  const m = new THREE.MeshStandardMaterial({ color: C(hex), roughness: rust ? 0.93 : 0.22, metalness: rust ? 0.12 : 0.45 });
  m.onBeforeCompile = (sh) => { sh.uniforms.uWet = WET_U; sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uWet;').replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.08, uWet);'); };
  ENV_MATS.push(m); paintMat[key] = m; return m;
}
const TIRE_GEO = new THREE.CylinderGeometry(1, 1, 1, 22);
const _wheelGeo = new Map();
function wheel(r, w, parent, x, y, z) {
  const piv = new THREE.Group(), spin = new THREE.Group(); piv.position.set(x, y, z); parent.add(piv); piv.add(spin);
  const key = r.toFixed(3) + ',' + w.toFixed(3); let g = _wheelGeo.get(key);
  if (!g) {
    const b = new Builder(), Q = MATID;
    b.add(TIRE_GEO, M(0, 0, 0, 0, r, w, r, 0, Math.PI / 2), 0x1c1d1e, Q.plain);
    b.add(G.cyl8, M(0, 0, 0, 0, r * 0.62, w + 0.02, r * 0.62, 0, Math.PI / 2), 0x9a9fa4, Q.metal);
    for (let k = 0; k < 5; k++) b.add(G.box, M(0, 0, 0, 0, w + 0.04, r * 1.06, r * 0.1, k * Math.PI / 5), 0x8c9196, Q.metal);
    g = b.geometry(); g.userData.shared = true; _wheelGeo.set(key, g);
  }
  const m = new THREE.Mesh(g, UBER_OBJ); m.castShadow = true; m.receiveShadow = true; spin.add(m);
  return { piv, spin, front: false };
}
function finish(root) { root.traverse((o) => { if (o.isMesh) o.receiveShadow = true; }); return root; }
/* ── a car body from a side silhouette: extruded with bevels, a dark glass band, lights, bumpers, mirrors ── */
const BODY_STYLES = {
  sedan: { len: 4.6, wid: 1.8, prof: [[-2.3, 0.3], [-2.32, 0.78], [-2.15, 0.96], [-1.25, 1.0], [-0.75, 1.42], [0.45, 1.45], [1.05, 1.0], [2.15, 0.84], [2.32, 0.62], [2.3, 0.3]], glass: [[-1.18, 1.02], [-0.72, 1.36], [0.42, 1.39], [0.98, 1.02]], wb: 2.7, wr: 0.34 },
  hatch: { len: 4.1, wid: 1.75, prof: [[-2.05, 0.3], [-2.08, 1.0], [-1.85, 1.42], [0.35, 1.46], [0.95, 1.0], [1.95, 0.82], [2.08, 0.6], [2.05, 0.3]], glass: [[-1.92, 1.05], [-1.78, 1.36], [0.32, 1.4], [0.9, 1.02]], wb: 2.5, wr: 0.33 },
  suv: { len: 4.7, wid: 1.92, prof: [[-2.35, 0.42], [-2.38, 1.15], [-2.2, 1.8], [0.55, 1.84], [1.2, 1.2], [2.25, 1.05], [2.38, 0.75], [2.35, 0.42]], glass: [[-2.15, 1.2], [-2.05, 1.72], [0.52, 1.76], [1.12, 1.22]], wb: 2.8, wr: 0.4 },
  pickup: { len: 5.2, wid: 1.92, prof: [[-2.6, 0.45], [-2.62, 1.06], [-0.76, 1.06], [-0.72, 1.82], [0.22, 1.86], [0.86, 1.14], [2.35, 1.0], [2.62, 0.72], [2.6, 0.45]], glass: [[-0.64, 1.14], [-0.6, 1.73], [0.18, 1.77], [0.8, 1.16]], wb: 3.0, wr: 0.42 },
  van: { len: 5.1, wid: 1.95, prof: [[-2.55, 0.42], [-2.56, 2.15], [1.15, 2.2], [1.85, 1.35], [2.5, 1.15], [2.56, 0.7], [2.55, 0.42]], glass: [[0.6, 1.4], [0.65, 2.08], [1.12, 2.1], [1.75, 1.38]], wb: 3.0, wr: 0.38 },
  bus: { len: 11.5, wid: 2.5, prof: [[-5.75, 0.5], [-5.78, 3.1], [5.55, 3.1], [5.75, 2.5], [5.78, 0.5]], glass: [[-5.4, 1.6], [-5.4, 2.8], [5.55, 2.8], [5.7, 1.4]], wb: 5.6, wr: 0.48 },
};
/* soft normals across the bevels, sharp where panels really meet (non-indexed geometry, shared positions) */
function smoothNormals(g, creaseDeg) {
  g.computeVertexNormals();
  const P = g.attributes.position, N = g.attributes.normal, n = P.count, groups = new Map(), cosT = Math.cos(creaseDeg * Math.PI / 180);
  for (let i = 0; i < n; i++) { const k = Math.round(P.getX(i) * 400) + ',' + Math.round(P.getY(i) * 400) + ',' + Math.round(P.getZ(i) * 400); let a = groups.get(k); if (!a) groups.set(k, a = []); a.push(i); }
  const out = new Float32Array(n * 3);
  for (const idx of groups.values()) for (const i of idx) {
    let sx = 0, sy = 0, sz = 0; const nx = N.getX(i), ny = N.getY(i), nz = N.getZ(i);
    for (const j of idx) { const mx = N.getX(j), my = N.getY(j), mz = N.getZ(j); if (nx * mx + ny * my + nz * mz >= cosT) { sx += mx; sy += my; sz += mz; } }
    const l = Math.hypot(sx, sy, sz) || 1; out[i * 3] = sx / l; out[i * 3 + 1] = sy / l; out[i * 3 + 2] = sz / l;
  }
  g.setAttribute('normal', new THREE.BufferAttribute(out, 3));
  return g;
}
/* the body of a car from its side silhouette: wheel arches cut into the sill, extruded with round bevels, then pinched
   in at the roof (tumblehome), rounded at the nose and tail and tucked at the sill; the nose points to +z */
const TUMBLE = { sedan: 0.17, hatch: 0.15, suv: 0.1, pickup: 0.1, van: 0.05, bus: 0.025 };
const _bodyGeo = new Map();
function carBodyGeo(style) {
  let G2 = _bodyGeo.get(style); if (G2) return G2;
  const S = BODY_STYLES[style], L = S.len / 2, hw = S.wb / 2, R = S.wr + 0.06, yb = S.prof[0][1];
  const pts = S.prof.map(([z, y]) => new THREE.Vector2(z, y));
  // along the sill from the nose back to the tail, around each wheel
  const arches = style === 'bus' ? [hw, -hw, -hw - 1.2] : [hw, -hw];
  for (const c of arches) {
    if (c + R > L - 0.15 || c - R < -L + 0.15) continue;
    for (let k = 0; k <= 10; k++) { const a = k / 10 * Math.PI; pts.push(new THREE.Vector2(c + Math.cos(a) * R, Math.max(yb, S.wr + Math.sin(a) * R))); }
  }
  const belt = Math.min(...S.glass.map((p) => p[1])) - 0.03, roof = Math.max(...S.prof.map((p) => p[1])), tum = TUMBLE[style] || 0.1;
  const shapeIt = (g) => {
    g.rotateY(-Math.PI / 2);
    const P = g.attributes.position;
    for (let i = 0; i < P.count; i++) {
      const y = P.getY(i), z = P.getZ(i), t = clamp((y - belt) / Math.max(0.25, roof - belt), 0, 1), u = Math.abs(z) / L;
      P.setX(i, P.getX(i) * (1 - tum * t * t) * (1 - 0.085 * smooth(0.7, 1.02, u)) * (1 - 0.035 * smooth(0.55, 0.0, (y - yb) / 0.5)));
    }
    P.needsUpdate = true; return smoothNormals(g, 52);
  };
  const shape = new THREE.Shape(pts);
  const body = new THREE.ExtrudeGeometry(shape, { depth: S.wid - 0.2, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.08, bevelSegments: 3, curveSegments: 1, steps: 1 });
  body.translate(0, 0, -(S.wid - 0.2) / 2);
  const gs = new THREE.Shape(S.glass.map(([z, y]) => new THREE.Vector2(z, y)));
  const glass = new THREE.ExtrudeGeometry(gs, { depth: S.wid - 0.1, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.03, bevelSegments: 2, curveSegments: 1 });
  glass.translate(0, 0, -(S.wid - 0.1) / 2);
  G2 = { body: shapeIt(body), glass: shapeIt(glass), belt, roof, tum };
  G2.body.computeBoundingSphere(); G2.glass.computeBoundingSphere(); G2.body.userData.shared = G2.glass.userData.shared = true;
  _bodyGeo.set(style, G2); return G2;
}
function carModel2(style, paint, opts = {}) {
  const S = BODY_STYLES[style], root = new THREE.Group(), BG = carBodyGeo(style);
  const body = new THREE.Mesh(BG.body, paintMat(paint)); body.castShadow = true; body.receiveShadow = true; root.add(body);
  const glass = new THREE.Mesh(BG.glass, CAR_GLASS); root.add(glass);
  const b = new Builder(), Q = MATID, L = S.len / 2, W = S.wid / 2, DK = 0x1e2022, TRIM = 0x141516, top = BG.roof;
  // bumpers wrap the ends, a dark sill, grille, plates
  b.box(0, 0.38, L - 0.04, S.wid - 0.02, 0.2, 0.22, DK, 0, Q.plain); b.box(0, 0.38, -L + 0.04, S.wid - 0.02, 0.2, 0.22, DK, 0, Q.plain);
  b.box(0, 0.26, 0, S.wid - 0.3, 0.16, S.len - 0.7, DK, 0, Q.plain);
  if (style !== 'bus') { b.box(0, 0.58, L + 0.02, S.wid * 0.42, 0.14, 0.05, TRIM, 0, Q.metal); b.box(0, 0.43, L + 0.08, 0.5, 0.12, 0.02, 0xe8e8e2, 0, Q.plain); b.box(0, 0.62, -L - 0.03, 0.5, 0.12, 0.02, 0xe8e8e2, 0, Q.plain); }
  // door seams, handles and a black B-pillar (cars and the SUV); the van and bus keep their plain flanks
  const gz0 = S.glass[0][0], gz3 = S.glass[3][0], beltY = BG.belt;
  if (style === 'pickup') {
    for (const sd of [-1, 1]) {
      for (const z of [gz3 + 0.12, gz0 - 0.03]) b.box(sd * (W - 0.005), (0.5 + beltY) / 2 + 0.02, z, 0.012, beltY - 0.5, 0.012, TRIM, 0, Q.plain);
      b.box(sd * (W + 0.005), beltY - 0.12, gz0 + 0.28, 0.02, 0.035, 0.15, 0x9a9ea2, 0, Q.metal);
      b.box(sd * (W - 0.06), 1.08, -1.67, 0.1, 0.05, 1.82, paint, 0, Q.plain);      // bed rails
    }
    b.box(0, 1.065, -1.67, S.wid - 0.3, 0.02, 1.8, 0x1a1b1c, 0, Q.fabric);          // a tonneau cover over the bed
    b.box(0, 0.9, -L - 0.01, S.wid * 0.5, 0.05, 0.03, TRIM, 0, Q.metal);           // tailgate handle strip
  }
  if (style === 'sedan' || style === 'hatch' || style === 'suv') {
    const bz = (S.glass[1][0] + S.glass[2][0]) / 2, seams = [gz3 + 0.12, bz, style === 'hatch' ? null : gz0 - 0.02].filter((v) => v !== null);
    for (const sd of [-1, 1]) {
      for (const z of seams) b.box(sd * (W - 0.005), (0.45 + beltY) / 2 + 0.02, z, 0.012, beltY - 0.45, 0.012, TRIM, 0, Q.plain);
      for (const z of [bz + 0.32, seams.length > 2 ? gz0 + 0.3 : null].filter((v) => v !== null)) b.box(sd * (W + 0.005), beltY - 0.12, z, 0.02, 0.035, 0.15, 0x9a9ea2, 0, Q.metal);
      const xm = (W - 0.02) * (1 - BG.tum * 0.25) + 0.012;
      b.add(G.box, M(sd * xm, (beltY + top) / 2 - 0.02, bz, 0, 0.02, top - beltY - 0.06, 0.09, 0, sd * BG.tum * 0.55), TRIM, Q.plain);
    }
  }
  for (const s of [-1, 1]) { b.box(s * (W + 0.07), beltY + 0.1, gz3 - 0.12, 0.14, 0.1, 0.17, paint, 0, Q.plain); b.box(s * (W + 0.02), beltY + 0.06, gz3 - 0.1, 0.06, 0.03, 0.05, TRIM, 0, Q.plain); }   // mirrors
  if (opts.roofbar) b.box(0, top + 0.12, -0.2, 1.1, 0.1, 0.28, opts.roofbar, 0, Q.plain);
  if (opts.stripe) b.box(0, 0.76, 0, S.wid + 0.01, 0.12, S.len * 0.7, opts.stripe, 0, Q.plain);
  if (opts.cross) { b.box(W + 0.03, 1.4, -1.0, 0.01, 0.6, 0.18, 0xc8202a, 0, Q.plain); b.box(W + 0.03, 1.4, -1.0, 0.01, 0.18, 0.6, 0xc8202a, 0, Q.plain); b.box(-W - 0.03, 1.4, -1.0, 0.01, 0.6, 0.18, 0xc8202a, 0, Q.plain); b.box(-W - 0.03, 1.4, -1.0, 0.01, 0.18, 0.6, 0xc8202a, 0, Q.plain); }
  if (opts.taxiSign) b.box(0, top + 0.12, -0.1, 0.6, 0.18, 0.22, 0xe8c030, 0, Q.plain);
  if (style === 'bus') for (let k = 0; k < 6; k++) for (const s of [-1, 1]) b.box(s * (W + 0.005), 2.2, -4.6 + k * 1.8, 0.02, 0.05, 1.6, 0xd8d8d0, 0, Q.metal);
  const det = b.mesh(UBER, true); root.add(det);
  const lamp = LAMP_MAT.clone(), tail = TAIL_MAT.clone();
  // the nose sits low: lamps at the height of the profile near the front
  const nose = S.prof.filter((p) => p[0] > L * 0.75).reduce((m, p) => Math.max(m, p[1]), 0.6), fy = clamp(nose - 0.12, 0.55, 1.1);
  const tailY = clamp(S.prof.filter((p) => p[0] < -L * 0.75).reduce((m, p) => Math.max(m, p[1]), 0.8) - 0.16, 0.6, 1.4);
  for (const s of [-1, 1]) {
    const l = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.12), lamp); l.position.set(s * (W - 0.34), fy, L + 0.07); root.add(l);
    const tl = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.13), tail); tl.position.set(s * (W - 0.3), tailY, -L - 0.07); tl.rotation.y = Math.PI; root.add(tl);
  }
  let sirenL = null;
  if (opts.siren) { const sg = new THREE.Group(); const red = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.12, 0.2), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.2, 0.2) })), blue = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.12, 0.2), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 0.4, 3) })); red.position.x = -0.25; blue.position.x = 0.25; sg.add(red, blue); sg.position.set(0, top + 0.12, -0.2); root.add(sg); sirenL = { red, blue, g: sg }; }
  const wheels = [], hw = S.wb / 2;
  for (const [x, z, front] of [[W - 0.2, hw, true], [-W + 0.2, hw, true], [W - 0.2, -hw, false], [-W + 0.2, -hw, false]]) { const w = wheel(S.wr, 0.24, root, x, S.wr, z); w.front = front; wheels.push(w); }
  if (style === 'bus') { const w5 = wheel(S.wr, 0.24, root, W - 0.2, S.wr, -hw - 1.2), w6 = wheel(S.wr, 0.24, root, -W + 0.2, S.wr, -hw - 1.2); wheels.push(w5, w6); }
  return { root: finish(root), wheels, lamp, tail, siren: sirenL };
}
/* the v3 pickup and 4x4, the dirt bike, boats and rafts */
function carModel(paint, pickup) {
  const root = new THREE.Group(), b = new Builder(), Q = MATID, P = paint, DK = 0x26292b, MT = 0x6a6e70;
  b.box(0, 0.52, 0, 1.25, 0.16, 3.9, DK, 0, Q.metal);
  b.box(0, 0.8, -0.12, 1.86, 0.5, 3.7, P, 0, Q.plain);
  b.box(0, 1.1, 1.36, 1.8, 0.14, 1.28, P, 0, Q.plain); b.box(0, 0.86, 1.36, 1.82, 0.5, 1.3, P, 0, Q.plain); b.box(0, 1.12, 0.62, 1.84, 0.18, 0.26, P, 0, Q.plain);
  b.box(0, 0.86, 2.03, 1.42, 0.5, 0.06, DK, 0, Q.metal);
  for (let k = -3; k <= 3; k++) b.box(k * 0.17, 0.86, 2.06, 0.06, 0.44, 0.03, MT, 0, Q.metal);
  b.box(0, 0.56, 2.15, 2.0, 0.17, 0.16, DK, 0, Q.metal); b.box(0, 0.56, -2.02, 2.0, 0.16, 0.16, DK, 0, Q.metal);
  for (const s of [-1, 1]) { b.box(s * 0.97, 1.03, 1.34, 0.32, 0.07, 1.05, P, 0, Q.plain); b.box(s * 0.97, 1.03, -1.3, 0.32, 0.07, 1.0, P, 0, Q.plain); b.box(s * 0.93, 0.62, 0, 0.12, 0.08, 1.6, DK, 0, Q.metal); }
  b.box(0, 1.16, 0.46, 1.74, 0.18, 0.22, DK, 0, Q.plain);
  b.add(G.cyl8, M(0.42, 1.24, 0.37, 0, 0.025, 0.4, 0.025, -0.93), DK, Q.metal);
  b.add(G.torus, M(0.42, 1.36, 0.22, 0, 0.17, 0.17, 0.17, 0.64), DK, Q.plain);
  for (const s of [-1, 1]) { b.box(s * 0.42, 1.0, -0.25, 0.56, 0.14, 0.56, 0x3b342a, 0, Q.fabric); b.add(G.box, M(s * 0.42, 1.36, -0.55, 0, 0.56, 0.62, 0.12, -0.16), 0x3b342a, Q.fabric); }
  b.box(0, 1.06, -0.25, 0.22, 0.18, 0.5, DK, 0, Q.plain);
  for (const s of [-1, 1]) b.add(G.box, M(s * 0.88, 1.52, 0.6, 0, 0.06, 0.78, 0.06, -0.2), DK, Q.metal);
  b.add(G.box, M(0, 1.9, 0.53, 0, 1.82, 0.07, 0.07), DK, Q.metal);
  for (const s of [-1, 1]) { b.add(G.cyl8, M(s * 0.6, 1.0, 2.05, 0, 0.13, 0.08, 0.13, Math.PI / 2), MT, Q.metal); b.box(s * 1.0, 1.5, 0.66, 0.06, 0.14, 0.2, DK, 0, Q.metal); }
  if (pickup) {
    for (const s of [-1, 1]) { b.add(G.box, M(s * 0.88, 1.55, -0.7, 0, 0.07, 0.86, 0.07, 0.12), DK, Q.metal); b.box(s * 0.9, 1.25, -1.35, 0.06, 0.42, 1.3, P, 0, Q.plain); }
    b.box(0, 1.94, -0.08, 1.84, 0.07, 1.3, P, 0, Q.plain); b.box(0, 1.5, -0.74, 1.8, 0.8, 0.06, P, 0, Q.plain);
    b.box(0, 1.25, -1.98, 1.84, 0.42, 0.06, P, 0, Q.plain); b.box(0, 1.08, -1.35, 1.7, 0.05, 1.25, 0x5a4a3a, 0, Q.wood);
  } else {
    b.box(0, 1.0, -1.35, 1.6, 0.14, 0.5, 0x3b342a, 0, Q.fabric); b.add(G.box, M(0, 1.34, -1.62, 0, 1.6, 0.56, 0.12, -0.12), 0x3b342a, Q.fabric);
    for (const s of [-1, 1]) b.add(G.cyl8, M(s * 0.86, 1.5, -0.88, 0, 0.04, 0.95, 0.04), DK, Q.metal);
    b.box(0, 1.97, -0.88, 1.76, 0.08, 0.08, DK, 0, Q.metal);
    b.add(G.cyl14, M(0, 1.15, -2.14, 0, 0.38, 0.24, 0.38, Math.PI / 2), 0x1c1d1e, Q.plain); b.add(G.cyl8, M(0, 1.15, -2.27, 0, 0.2, 0.05, 0.2, Math.PI / 2), MT, Q.metal);
  }
  root.add(b.mesh(UBER, true));
  const lamp = LAMP_MAT.clone(), tail = TAIL_MAT.clone();
  for (const s of [-1, 1]) {
    const l = new THREE.Mesh(new THREE.CircleGeometry(0.1, 14), lamp); l.position.set(s * 0.6, 1.0, 2.095); root.add(l);
    const tl = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.1), tail); tl.position.set(s * 0.78, 0.86, -2.105); tl.rotation.y = Math.PI; root.add(tl);
  }
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.72, 0.7), GLASS_MAT); glass.position.set(0, 1.52, 0.6); glass.rotation.x = -0.2; root.add(glass);
  const wheels = [];
  for (const [x, z, front] of [[0.81, 1.3, true], [-0.81, 1.3, true], [0.81, -1.3, false], [-0.81, -1.3, false]]) { const w = wheel(0.42, 0.3, root, x, 0.42, z); w.front = front; wheels.push(w); }
  return { root: finish(root), wheels, lamp, tail };
}
function bikeModel(paint, bicycle) {
  const root = new THREE.Group(), b = new Builder(), f = new Builder(), Q = MATID, DK = 0x232527, MT = 0x8a8f94;
  if (bicycle) {
    b.limb(0, 0.36, -0.5, new THREE.Vector3(0, 0.5, 0.45).normalize(), 0.62, 0.02, 0.02, paint, 6, Q.metal);
    b.limb(0, 0.36, -0.5, new THREE.Vector3(0, 0, 1).normalize(), 0.62, 0.02, 0.02, paint, 6, Q.metal);
    b.limb(0, 0.8, -0.18, new THREE.Vector3(0, -0.15, 1).normalize(), 0.55, 0.02, 0.02, paint, 6, Q.metal);
    b.box(0, 0.86, -0.32, 0.12, 0.05, 0.26, 0x18191a, 0, Q.fabric); b.add(G.cyl14, M(0, 0.36, -0.04, 0, 0.09, 0.02, 0.09, 0, Math.PI / 2), MT, Q.metal);
  } else {
    for (const s of [-1, 1]) b.limb(s * 0.08, 0.33, -0.72, new THREE.Vector3(0, 0.16, 0.62).normalize(), 0.64, 0.025, 0.025, DK, 6, Q.metal);
    b.box(0, 0.5, 0.05, 0.26, 0.32, 0.42, 0x3a3d40, 0, Q.metal); b.add(G.cyl8, M(0.15, 0.48, 0.12, 0, 0.09, 0.12, 0.09, 0, Math.PI / 2), MT, Q.metal);
    b.limb(0, 0.55, -0.08, new THREE.Vector3(0, 0.45, 0.6).normalize(), 0.78, 0.035, 0.035, DK, 6, Q.metal);
    b.limb(0, 1.0, 0.5, new THREE.Vector3(0, -0.1, -1).normalize(), 0.82, 0.03, 0.03, DK, 6, Q.metal);
    b.add(G.sph, M(0, 0.98, 0.22, 0, 0.2, 0.15, 0.34), paint, Q.metal);
    b.box(0, 0.94, -0.32, 0.26, 0.09, 0.62, 0x18191a, 0, Q.fabric); b.box(0, 0.82, -0.45, 0.3, 0.16, 0.3, paint, 0, Q.metal);
    b.add(G.box, M(0, 0.8, -0.8, 0, 0.14, 0.03, 0.5, 0.25), paint, Q.metal);
    b.limb(0.15, 0.42, 0.12, new THREE.Vector3(0.02, 0.22, -1).normalize(), 0.92, 0.035, 0.045, MT, 8, Q.metal);
  }
  root.add(b.mesh(UBER, true));
  const fork = new THREE.Group(); fork.position.set(0, 0.33, bicycle ? 0.55 : 0.73); root.add(fork);
  for (const s of [-1, 1]) f.limb(s * 0.06, 0, 0, new THREE.Vector3(0, 0.95, -0.32).normalize(), bicycle ? 0.62 : 0.78, 0.02, 0.024, MT, 6, Q.metal);
  f.box(0, bicycle ? 0.6 : 0.76, -0.22, bicycle ? 0.55 : 0.7, 0.035, 0.035, DK, 0, Q.metal);
  fork.add(f.mesh(UBER, true));
  const lamp = LAMP_MAT.clone(), tail = TAIL_MAT.clone();
  const l = new THREE.Mesh(new THREE.CircleGeometry(0.06, 12), lamp); l.position.set(0, 0.55, -0.06); fork.add(l);
  const rw = wheel(bicycle ? 0.34 : 0.33, bicycle ? 0.05 : 0.13, root, 0, bicycle ? 0.34 : 0.33, bicycle ? -0.52 : -0.72), fw = wheel(bicycle ? 0.34 : 0.33, bicycle ? 0.05 : 0.11, fork, 0, bicycle ? 0.01 : 0, 0);
  return { root: finish(root), wheels: [rw, fw], fork, lamp, tail };
}
function tractorModel() {
  const root = new THREE.Group(), b = new Builder(), Q = MATID, G1 = 0x3a7a3a, DK = 0x1e2022;
  b.box(0, 1.0, 0.7, 0.9, 0.8, 1.8, G1, 0, Q.plain); b.box(0, 0.75, -0.6, 1.2, 0.5, 1.0, G1, 0, Q.plain);
  b.box(0, 1.55, -0.45, 1.25, 0.06, 1.2, DK, 0, Q.metal); for (const [x, z] of [[-0.6, -1.0], [0.6, -1.0], [-0.6, 0.1], [0.6, 0.1]]) b.add(G.cyl8, M(x, 1.95, z, 0, 0.03, 1.3, 0.03), DK, Q.metal);
  b.box(0, 2.6, -0.45, 1.3, 0.06, 1.25, G1, 0, Q.plain); b.add(G.cyl8, M(0.3, 2.0, 1.3, 0, 0.06, 1.2, 0.06), DK, Q.metal);
  b.box(0, 1.25, -0.6, 0.5, 0.12, 0.45, 0x2a2a2a, 0, Q.fabric); b.add(G.torus, M(0, 1.6, 0.0, 0, 0.18, 0.18, 0.18, 0.7), DK, Q.plain);
  root.add(b.mesh(UBER, true));
  const wheels = [];
  for (const [x, z, r, w, front] of [[0.62, 1.2, 0.42, 0.26, true], [-0.62, 1.2, 0.42, 0.26, true], [0.78, -0.8, 0.72, 0.45, false], [-0.78, -0.8, 0.72, 0.45, false]]) { const wh = wheel(r, w, root, x, r, z); wh.front = front; wheels.push(wh); }
  const lamp = LAMP_MAT.clone(), tail = TAIL_MAT.clone();
  return { root: finish(root), wheels, lamp, tail };
}
function buggyModel(paint) {
  const root = new THREE.Group(), b = new Builder(), Q = MATID, DK = 0x1e2022;
  b.box(0, 0.6, 0, 1.2, 0.18, 3.0, DK, 0, Q.metal);
  for (const s of [-1, 1]) { b.limb(s * 0.6, 0.65, -1.0, new THREE.Vector3(0, 0.75, 0.4).normalize(), 1.4, 0.035, 0.035, paint, 6, Q.metal); b.limb(s * 0.6, 0.65, 1.2, new THREE.Vector3(0, 0.55, -0.7).normalize(), 1.4, 0.035, 0.035, paint, 6, Q.metal); }
  b.box(0, 1.72, -0.15, 1.25, 0.06, 0.9, paint, 0, Q.metal);
  for (const s of [-1, 1]) b.box(s * 0.3, 0.95, -0.3, 0.45, 0.6, 0.12, 0x2a2a2a, 0, Q.fabric);
  b.box(0, 0.85, -1.25, 0.9, 0.5, 0.6, 0x3a3d40, 0, Q.metal); b.add(G.box, M(0, 0.82, 1.35, 0, 1.3, 0.2, 0.5, 0.2), paint, Q.plain);
  root.add(b.mesh(UBER, true));
  const wheels = [];
  for (const [x, z, front] of [[0.85, 1.1, true], [-0.85, 1.1, true], [0.85, -1.1, false], [-0.85, -1.1, false]]) { const w = wheel(0.42, 0.34, root, x, 0.42, z); w.front = front; wheels.push(w); }
  return { root: finish(root), wheels, lamp: LAMP_MAT.clone(), tail: TAIL_MAT.clone() };
}
function woodBoatModel() {
  const root = new THREE.Group(), b = new Builder(), Q = MATID, len = 4.2;
  const hg = new THREE.BoxGeometry(1.7, 0.75, len, 2, 1, 4), hp = hg.attributes.position;
  for (let i = 0; i < hp.count; i++) { const zz = hp.getZ(i); if (zz > len * 0.2) hp.setX(i, hp.getX(i) * (1 - (zz - len * 0.2) / (len * 0.3) * 0.92)); if (hp.getY(i) < 0) hp.setX(i, hp.getX(i) * 0.62); }
  hg.computeVertexNormals(); b.add(hg, M(0, 0.12, 0), 0x6e4e32, Q.wood); hg.dispose();
  b.box(0, 0.5, -0.25, 1.5, 0.03, len * 0.62, 0x9b7a52, 0, Q.wood);
  for (const s of [-1, 1]) b.add(G.box, M(s * 0.8, 0.56, -0.25, 0, 0.08, 0.1, len * 0.62), 0x4e3826, Q.wood);
  for (const z of [-0.95, 0.35]) b.box(0, 0.68, z, 1.5, 0.06, 0.32, 0x8a6a45, 0, Q.wood);
  b.box(0, 0.78, -len / 2 - 0.1, 0.3, 0.4, 0.32, 0x2a2d30, 0, Q.metal); b.box(0, 1.0, -len / 2 - 0.12, 0.32, 0.12, 0.36, 0xb8443a, 0, Q.metal);
  root.add(b.mesh(UBER, true));
  return { root: finish(root), wheels: [] };
}
const LOG_GEO = (() => { const g = new THREE.CylinderGeometry(1, 1, 1, 8, 1), uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 1.5, uv.getY(i) * 2.2); return g; })();
function raftModel() {
  const root = new THREE.Group(), w = new Builder(), Q = MATID;
  for (let k = -3; k <= 3; k++) w.add(LOG_GEO, M(k * 0.33, 0.1, rr(-0.08, 0.08), 0, 0.17, 3.2 + rr(-0.15, 0.15), 0.17, Math.PI / 2), 0x6e4a2c, Q.wood);
  for (const z of [-1.05, 1.05]) { w.box(0, 0.3, z, 2.45, 0.1, 0.16, 0x6b4a2c, 0, Q.wood); }
  w.box(0.6, 0.45, 0.6, 0.42, 0.3, 0.42, 0x8a6a45, 0.3, Q.wood);
  root.add(w.mesh(UBER, true));
  return { root: finish(root), wheels: [] };
}
function fishingBoatModel() { const m = new THREE.Group(), hull = new THREE.Mesh(boatGeo(0xf2efe8, 0x2f6a9a), UBER); hull.castShadow = hull.receiveShadow = true; m.add(hull); return { root: m, wheels: [] }; }
/* the field jeep: the UAZ-469 by zhe_kan (CC-BY 4.0). Its orange-and-white paint is recoloured in the shader so every jeep can
   wear its own colour (army olive all over at the bases), the lamps glow from their own texture, the wheels roll and steer */
const MIL_OLIVE = 0x4b5320, UAZ_PAINT = {};
function uazPaint(base, a, b, rust) {
  const key = base.name + ':' + a + ':' + b; if (UAZ_PAINT[key]) return UAZ_PAINT[key];
  const m = base.clone(), pa = C(a), pb = C(b);
  m.roughness = rust ? 0.93 : 0.36; m.metalness = rust ? 0.1 : 0.28;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uPA = { value: pa }; sh.uniforms.uPB = { value: pb }; sh.uniforms.uWet = WET_U;
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uPA, uPB; uniform float uWet;')
      .replace('#include <map_fragment>', `#include <map_fragment>
      { vec3 tc = texelColor.rgb; float mx = max(tc.r, max(tc.g, tc.b)), mn = min(tc.r, min(tc.g, tc.b)), sat = (mx - mn) / max(mx, 1e-4), lum = dot(tc, vec3(0.2126, 0.7152, 0.0722));
        float orange = smoothstep(0.6, 0.85, sat) * step(tc.b, tc.g) * smoothstep(0.015, 0.05, tc.r);
        float white = (1.0 - smoothstep(0.1, 0.28, sat)) * smoothstep(0.07, 0.16, lum);
        diffuseColor.rgb = mix(diffuseColor.rgb, uPA * clamp(lum / 0.068, 0.3, 1.5), orange);
        diffuseColor.rgb = mix(diffuseColor.rgb, uPB * clamp(lum / 0.29, 0.3, 1.25), white); }`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.08, uWet);');
  };
  m.customProgramCacheKey = () => 'uazpaint';
  ENV_MATS.push(m); UAZ_PAINT[key] = m; return m;
}
function uazLamp(base, rear) {
  // one per jeep: its own glow switches with its own lights
  const m = base.clone(); m.emissive = new THREE.Color(rear ? 0xffd0c8 : 0xfff4e0); m.emissiveMap = base.map; m.emissiveIntensity = 0; m.roughness = 0.15;
  return m;
}
function gltfCar(kind, paint) {
  const src = CAR_MODELS[kind]; if (!src) return null;
  const obj = src.scene.clone(true), root = new THREE.Group();
  // beyond 45 m the 5k-triangle far level stands in (same materials): a car park full of jeeps stays light on phones
  const farSrc = CAR_MODELS[kind + '_lo'];
  if (farSrc) { const lod = new THREE.LOD(); lod.addLevel(obj, 0); lod.addLevel(farSrc.scene.clone(true), 45); root.add(lod); } else root.add(obj);
  root.traverse((o) => { if (o.isMesh && o.geometry) o.geometry.userData.shared = true; });   // clones share the loaded buffers
  const wheels = [];
  if (kind === 'uaz') {
    const rust = RUST_PAINTS.includes(paint), mil = paint === MIL_OLIVE;
    const pa = paint, pb = rust || mil ? paint : 0xe2e0d8;
    root.traverse((o) => {
      if (!o.isMesh) return;
      const n = o.material.name;
      if (n === 'Paint_body' || n === 'Pain_bump') o.material = uazPaint(o.material, pa, pb, rust);
      else if (n === 'Light') o.material = root.userData.lamp || (root.userData.lamp = uazLamp(o.material, false));
      else if (n === 'LightRear') o.material = root.userData.tail || (root.userData.tail = uazLamp(o.material, true));
    });
    for (const nm of ['wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr']) { const w = obj.getObjectByName(nm); if (w) wheels.push({ spin: w, piv: obj.getObjectByName('piv_' + nm), front: nm[6] === 'f' }); }
  }
  return { root: finish(root), wheels, lamp: root.userData.lamp || LAMP_MAT.clone(), tail: root.userData.tail || TAIL_MAT.clone(), gltf: true };
}
const PAINTS = [0xb8202a, 0x1e3a6a, 0xe8e6e0, 0x1e1e20, 0x7a7f84, 0xc8a050, 0x2f6a4a, 0x8a3a2e, 0x3d7fa8, 0xd8702a, 0x5a3a6a];
function makeVehicleModel(kind, paint) {
  switch (kind) {
    case 'sports': return carModel2('sedan', paint);
    case 'truck': return carModel2('van', 0xf0f0ec);
    case 'sedan': return carModel2('sedan', paint);
    case 'taxi': return carModel2('sedan', 0xe8c030, { taxiSign: 0xe8c030, stripe: 0x1e1e20 });
    case 'police': return carModel2('sedan', 0xf0f0ec, { stripe: 0x1e3a8a, siren: true });
    case 'suv': return carModel2('suv', paint);
    case 'van': return carModel2('van', paint);
    case 'ambulance': return carModel2('van', 0xf4f4f0, { cross: true, stripe: 0xc8202a, siren: true });
    case 'bus': return carModel2('bus', paint);
    case 'tractor': return tractorModel();
    case 'buggy': return buggyModel(paint);
    case 'pickup': return carModel2('pickup', paint);
    case 'jeep': return gltfCar('uaz', paint) || carModel(paint, false);
    case 'bike': return bikeModel(paint, false);
    case 'bicycle': return bikeModel(paint, true);
    case 'boat': return fishingBoatModel();
    case 'craftboat': return woodBoatModel();
    case 'raft': return raftModel();
  }
  return carModel2('sedan', paint);
}
function addVehicle(kind, model, x, z, yaw, rec) {
  const spec = VSPEC[kind];
  const v = { kind, spec, root: model.root, wheels: model.wheels || [], fork: model.fork || null, lamp: model.lamp || null, tail: model.tail || null, siren: model.siren || null,
    pos: new THREE.Vector3(x, 0, z), vel: new THREE.Vector3(), yaw, speed: 0, steer: 0, vy: 0, pitch: 0, roll: 0, air: false, rpm: 0, gear: 0, rec: rec || null, cols: [], lastYaw: yaw, fxT: 0, brake: false, hp: 100, ai: null, sirenOn: false };
  v.pos.y = spec.water ? waveY(x, z, 0) - 0.1 : groundAt(x, z, terrainAt(x, z) + 1.5);
  v.root.position.copy(v.pos); v.root.rotation.set(0, yaw, 0, 'YXZ'); scene.add(v.root);
  for (let k = 0; k < (spec.lean || spec.horse ? 1 : 2); k++) v.cols.push(addCollider({ t: 'c', x, z, r: spec.R, y1: v.pos.y + 1.6 }));
  placeVehicleCols(v); VEHICLES.push(v); return v;
}
function removeVehicle(v) {
  const i = VEHICLES.indexOf(v); if (i >= 0) VEHICLES.splice(i, 1); for (const c of v.cols) removeCollider(c); scene.remove(v.root);
  // free what was built for this car alone (shared bodies, wheels and loaded models stay)
  v.root.traverse((o) => { if (o.isMesh && o.geometry && !o.geometry.userData.shared && !Object.values(G).includes(o.geometry)) o.geometry.dispose(); });
  for (const m of [v.lamp, v.tail]) if (m && m !== LAMP_MAT && m !== TAIL_MAT) m.dispose();
}
function spawnVehicle(kind, x, z, yaw, paint, rec) { return addVehicle(kind, makeVehicleModel(kind, paint !== undefined ? paint : pick(PAINTS)), x, z, yaw, rec); }
function placeVehicleCols(v) {
  const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw), n = v.cols.length;
  v.cols.forEach((c, i) => { const off = n === 1 ? 0 : (i === 0 ? 1 : -1) * v.spec.wb * 0.36; moveCollider(c, v.pos.x + fx * off, v.pos.z + fz * off); c.y1 = v.pos.y + 1.6; c.y0 = v.pos.y - 1.2; });
}
/* ── driving ── */
const _kp = { x: 0, y: 0, z: 0 }, _ks = new THREE.Vector3(), _kd = new THREE.Vector3();
function collideBody(v, offs, yOff) {
  const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw); let hit = 0, nx = 0, nz = 0;
  for (const off of offs) {
    _kp.x = v.pos.x + fx * off; _kp.z = v.pos.z + fz * off; _kp.y = v.pos.y + yOff;
    const bx = _kp.x, bz = _kp.z; resolveCollision(_kp, v.spec.R);
    const cx = _kp.x - bx, cz = _kp.z - bz;
    if (cx !== 0 || cz !== 0) { v.pos.x += cx; v.pos.z += cz; nx += cx; nz += cz; hit++; }
  }
  if (!hit) return 0;
  const nl = Math.hypot(nx, nz) || 1, vn = (v.vel.x * nx + v.vel.z * nz) / nl;
  if (vn >= 0) return 0;
  v.vel.x -= nx / nl * vn * 1.25; v.vel.z -= nz / nl * vn * 1.25;
  const imp = -vn; v.speed *= imp > 3 ? 0.4 : 0.9;
  return imp;
}
function updateCar(v, dt, t, driven) {
  const S = v.spec;
  let thr = 0, str = 0, hb = !driven && !v.ai;
  if (driven && player.alive) { thr = input.mz; str = -input.mx; hb = input.jumpHeld; }
  else if (v.ai) { thr = v.ai.thr; str = v.ai.str; hb = v.ai.hb; }
  const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw), lx = Math.cos(v.yaw), lz = -Math.sin(v.yaw);
  const h0 = terrainAt(v.pos.x, v.pos.z), wl = waterAt(v.pos.x, v.pos.z), wade = h0 < wl - 0.1 ? clamp((wl - h0) / 0.9, 0, 1) : 0;
  const road = roadDist(v.pos.x, v.pos.z) < 1 || classAt(v.pos.x, v.pos.z) === 2 || onPlatform(v.pos.x, v.pos.z, v.pos.y + 0.5);
  const vmax = S.max * (road || S.offroad ? 1 : 0.62) * (1 - wade * 0.65) * (S.horse ? (player.sprinting || input.sprint ? 1 : 0.55) : 1) * (driven ? upMul('engine') : 1);
  v.brake = false;
  if (!v.air) {
    if (thr > 0.05) { if (v.speed < -0.3) { v.speed = Math.min(0, v.speed + S.brake * thr * dt); v.brake = true; } else v.speed += S.acc * thr * Math.max(0, 1 - (v.speed / vmax) ** 2) * dt; }
    else if (thr < -0.05) { if (v.speed > 0.3) { v.speed = Math.max(0, v.speed + S.brake * thr * dt); v.brake = true; } else v.speed = Math.max(-S.rev, v.speed + S.acc * 0.7 * thr * dt); }
    else v.speed -= Math.sign(v.speed) * Math.min(Math.abs(v.speed), (0.9 + Math.abs(v.speed) * 0.035 + (S.horse ? 3 : 0)) * dt);
    if (hb) { v.speed -= Math.sign(v.speed) * Math.min(Math.abs(v.speed), (driven ? 7 : 20) * dt); v.brake = v.brake || driven; }
    if (v.speed > vmax) v.speed = damp(v.speed, vmax, 1.5, dt);
    if (!(hb || (Math.abs(v.speed) < 0.4 && Math.abs(thr) < 0.05)) && !S.horse) v.speed += 9.8 * Math.sin(v.pitch) * 0.55 * dt;
  }
  const smax = lerp(S.horse ? 1.2 : 0.62, S.horse ? 0.5 : 0.09, clamp(Math.abs(v.speed) / 30, 0, 1));
  v.steer = damp(v.steer, str * smax, driven ? 6 : 3, dt);
  let yr = S.horse ? v.steer * 1.6 * (Math.abs(v.speed) > 0.3 || Math.abs(str) > 0.1 ? 1 : 0) : v.speed * Math.tan(v.steer) / S.wb;
  if (hb && Math.abs(v.speed) > 5 && !S.horse) yr *= 1.45;
  if (!v.air) v.yaw += yr * dt;
  const grip = v.air ? 0.15 : hb ? 2.2 : S.lean ? 9 : 7;
  v.vel.x = damp(v.vel.x, Math.sin(v.yaw) * v.speed, grip, dt); v.vel.z = damp(v.vel.z, Math.cos(v.yaw) * v.speed, grip, dt);
  const ox = v.pos.x, oz = v.pos.z; v.pos.x += v.vel.x * dt; v.pos.z += v.vel.z * dt;
  if (terrainAt(v.pos.x, v.pos.z) < waterAt(v.pos.x, v.pos.z) - 1.05 && !onPlatform(v.pos.x, v.pos.z, v.pos.y + 0.5)) { v.pos.x = ox; v.pos.z = oz; v.speed *= -0.2; v.vel.set(0, 0, 0); }
  if (LAND_ON && landTop(v.pos.x + Math.sin(v.yaw) * S.wb * 0.5, v.pos.z + Math.cos(v.yaw) * S.wb * 0.5) > v.pos.y + 1.1) { const hit = Math.abs(v.speed); v.pos.x = ox; v.pos.z = oz; v.speed *= -0.15; v.vel.set(0, 0, 0); if (hit > 4) AUDIO.crash(hit, Math.hypot(v.pos.x - player.pos.x, v.pos.z - player.pos.z)); }
  worldEdge(v.pos);
  const imp = collideBody(v, S.lean || S.horse ? [0.25] : [S.wb * 0.38, -S.wb * 0.38], 0.55);
  if (imp > 4.5) { AUDIO.crash(imp, Math.hypot(v.pos.x - player.pos.x, v.pos.z - player.pos.z)); v.hp -= imp * 0.6; if (driven) { cam.shake = Math.min(0.6, cam.shake + imp * 0.025); if (imp > 17) damagePlayer((imp - 17) * 3, null, 'crash'); } }
  const hw = S.wb / 2, ht = Math.max(0.15, S.track / 2), qy = v.pos.y + 1.4, px = v.pos.x, pz = v.pos.z;
  const yFL = groundAt(px + fx * hw + lx * ht, pz + fz * hw + lz * ht, qy), yFR = groundAt(px + fx * hw - lx * ht, pz + fz * hw - lz * ht, qy);
  const yRL = groundAt(px - fx * hw + lx * ht, pz - fz * hw + lz * ht, qy), yRR = groundAt(px - fx * hw - lx * ht, pz - fz * hw - lz * ht, qy);
  const gy = (yFL + yFR + yRL + yRR) / 4;
  const pitchT = Math.atan2((yRL + yRR) - (yFL + yFR), 2 * S.wb), rollT = S.lean ? clamp(-v.steer * Math.abs(v.speed) * 0.09, -0.55, 0.55) : S.horse ? 0 : Math.atan2((yFL + yRL) - (yFR + yRR), 2 * S.track);
  const prevY = v.pos.y;
  if (v.air) {
    v.vy -= 22 * dt; v.pos.y += v.vy * dt;
    if (v.pos.y <= gy) {
      const hitV = -v.vy; v.pos.y = gy; v.vy = 0; v.air = false;
      if (hitV > 4) { AUDIO.land(hitV * 1.4); spawnPuff(px, gy + 0.1, pz, 0xa8957a, 8, 2.6, 0.25, -1, 1.2); if (driven) cam.shake = Math.min(0.5, cam.shake + hitV * 0.03); }
      if (hitV > 14 && driven) damagePlayer((hitV - 14) * 3, null, 'fall');
    }
  } else {
    const ballistic = prevY + v.vy * dt - 11 * dt * dt;
    if (gy < ballistic - 0.06 && Math.abs(v.speed) > 9 && !S.horse) { v.air = true; v.pos.y = ballistic; v.vy -= 22 * dt; }
    else { v.pos.y = damp(prevY, gy, gy > prevY ? 30 : 22, dt); v.vy = clamp((v.pos.y - prevY) / Math.max(dt, 1e-3), -20, 20); }
  }
  v.pitch = v.air ? v.pitch : damp(v.pitch, S.horse ? pitchT * 0.5 : pitchT, 10, dt); v.roll = damp(v.roll, v.air ? v.roll : rollT, S.lean ? 5 : 10, dt);
  for (const w of v.wheels) {
    if (w.axis) { w.spin.rotation[w.axis] += w.sign * v.speed / S.wr * dt; continue; }
    w.spin.rotation.x += v.speed / S.wr * dt; if (w.front && !v.fork && w.piv) w.piv.rotation.y = v.steer;
  }
  if (v.fork) v.fork.rotation.y = v.steer * 0.85;
  // zombies, animals and walkers in the way
  if (Math.abs(v.speed) > 4) for (const L of TARGET_LISTS) for (const z of L()) {
    if (!z.active || z.state === 'dead' || z === v.horseAnimal) continue;
    const dx = z.x - v.pos.x, dz = z.z - v.pos.z; if (Math.abs(dx) > 5 || Math.abs(dz) > 5) continue;
    const along = dx * fx + dz * fz, side = Math.abs(dx * lx + dz * lz);
    if (Math.abs(along) < S.wb * 0.5 + 0.9 && side < S.track * 0.5 + 0.55 && Math.abs(z.y - v.pos.y) < 1.6) {
      _kd.set(fx * Math.sign(v.speed), 0.2, fz * Math.sign(v.speed));
      hurtTarget(z, 60 + Math.abs(v.speed) * 9, false, _kd, driven ? 'player' : 'car'); z.x += _kd.x * 1.4; z.z += _kd.z * 1.4;
      spawnPuff(z.x, z.y + 1, z.z, 0x4a1210, 12, 3.2, 0.09, -9, 0.7); AUDIO.thud(); v.speed *= 0.88; if (driven) cam.shake = Math.min(0.4, cam.shake + 0.15);
    }
  }
  v.fxT -= dt;
  if (v.fxT <= 0 && Math.abs(v.speed) > 3 && !v.air) {
    v.fxT = 0.07;
    const rx = px - fx * hw, rz = pz - fz * hw;
    if (wade > 0.05) { spawnPuff(rx, v.pos.y + 0.2, rz, 0xe6f0f0, 3, 2.6, 0.12, -6, 0.6); if (rand() < 0.2) AUDIO.splash(0.5); }
    else if (!road && Math.abs(v.speed) > 9) spawnPuff(rx + lx * rr(-ht, ht), v.pos.y + 0.15, rz + lz * rr(-ht, ht), biomeAt(px, pz) === 7 ? 0xd8c49a : 0xb8a888, 1, 1.2, 0.4, -0.4, 1.3);
    else if (WEATHER.wet > 0.3 && Math.abs(v.speed) > 8) spawnPuff(rx, v.pos.y + 0.15, rz, 0xd0d8dc, 1, 1.5, 0.3, -2, 0.6);
  }
  const sp = Math.abs(v.speed), span = S.max / 5, gear = Math.min(4, Math.floor(sp / span));
  v.gear = sp < 0.5 ? (v.speed < -0.1 ? -1 : 0) : (v.speed < 0 ? -1 : gear + 1);
  v.rpm = damp(v.rpm, sp < 0.5 ? 0.1 + Math.max(0, thr) * 0.25 : 0.24 + (sp - gear * span) / span * 0.7 + Math.max(0, thr) * 0.06, 6, dt);
  if (driven) AUDIO.engine(true, v.rpm, thr, S.horse ? 'horse' : S.pedal ? 'raft' : S.lean ? 'bike' : 'car');
}
function updateBoat(v, dt, t, driven) {
  const S = v.spec;
  let thr = 0, str = 0;
  if (driven && player.alive) { thr = input.mz; str = -input.mx; }
  if (thr > 0.05) v.speed += S.acc * thr * Math.max(0, 1 - (v.speed / (S.max * (driven ? upMul('engine') : 1))) ** 2) * dt;
  else if (thr < -0.05) v.speed = Math.max(-S.rev, v.speed + (v.speed > 0 ? S.brake : S.acc * 0.6) * thr * dt);
  v.speed -= Math.sign(v.speed) * Math.min(Math.abs(v.speed), (0.35 + Math.abs(v.speed) * 0.05) * dt);
  const turn = str * (S.paddle ? 0.6 : 0.85) * clamp((Math.abs(v.speed) + 1.2) / 6, 0.25, 1) * (v.speed < -0.2 ? -1 : 1);
  v.steer = damp(v.steer, turn, 3, dt); v.yaw += v.steer * dt;
  const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw);
  v.vel.x = damp(v.vel.x, fx * v.speed, 2.5, dt); v.vel.z = damp(v.vel.z, fz * v.speed, 2.5, dt);
  const ox = v.pos.x, oz = v.pos.z; v.pos.x += v.vel.x * dt; v.pos.z += v.vel.z * dt;
  const dir = v.speed >= 0 ? 1 : -1, bx = v.pos.x + fx * S.len * 0.45 * dir, bz = v.pos.z + fz * S.len * 0.45 * dir;
  const wl = waterAt(v.pos.x, v.pos.z);
  if (terrainAt(v.pos.x, v.pos.z) > wl - 0.55 || terrainAt(bx, bz) > waterAt(bx, bz) - 0.35) { v.pos.x = ox; v.pos.z = oz; if (Math.abs(v.speed) > 2) AUDIO.thud(); v.speed *= -0.15; v.vel.set(0, 0, 0); }
  worldEdge(v.pos);
  const imp = collideBody(v, [S.wb * 0.3, -S.wb * 0.3], 0.3);
  if (imp > 3) AUDIO.crash(imp * 0.7, Math.hypot(v.pos.x - player.pos.x, v.pos.z - player.pos.z));
  const sea = wl === 0, cy = Math.cos(v.yaw), sy = Math.sin(v.yaw), at = (lx, lz) => (sea ? waveY(v.pos.x + lx * cy + lz * sy, v.pos.z - lx * sy + lz * cy, t) : 0) + wl;
  const hb = at(0, S.len / 2), hs = at(0, -S.len / 2), hp = at(-S.wid / 2, 0), hst = at(S.wid / 2, 0), plane = clamp(v.speed / S.max, 0, 1);
  v.pos.y = damp(v.pos.y, (hb + hs + hp + hst) / 4 - (S.paddle ? 0.05 : 0.12) + plane * 0.12, 3, dt);
  v.pitch = damp(v.pitch, Math.atan2(hs - hb, S.len) - plane * 0.07, 2.4, dt);
  v.roll = damp(v.roll, Math.atan2(hst - hp, S.wid) * 0.8 - v.steer * plane * 0.25, 2.4, dt);
  v.fxT -= dt;
  if (v.fxT <= 0 && Math.abs(v.speed) > 1.2) {
    v.fxT = S.paddle ? 0.6 : 0.06;
    if (S.paddle) { if (driven && Math.abs(thr) + Math.abs(str) > 0.1) { spawnPuff(v.pos.x - cy * 1.2, v.pos.y + 0.1, v.pos.z + sy * 1.2, 0xe6f0f0, 4, 1.5, 0.08, -6, 0.5); AUDIO.splash(0.35); } }
    else for (const s of [-1, 1]) spawnPuff(v.pos.x + fx * S.len * 0.3 + cy * s * S.wid * 0.5, v.pos.y + 0.1, v.pos.z + fz * S.len * 0.3 - sy * s * S.wid * 0.5, 0xf0f6f6, 1, 2 + plane * 3, 0.14, -7, 0.6);
  }
  v.rpm = damp(v.rpm, 0.15 + Math.abs(v.speed) / S.max * 0.75 + Math.max(0, thr) * 0.1, 4, dt); v.gear = v.speed < -0.1 ? -1 : 1;
  if (driven) AUDIO.engine(true, v.rpm, thr, S.paddle ? 'raft' : 'boat');
}
function seatPlayer(v, dt, t) {
  const S = v.spec;
  _ks.set(S.seat[0], S.seat[1] + (S.horse ? 1.25 : 0), S.seat[2]).applyQuaternion(v.root.quaternion).add(v.pos);
  player.root.position.copy(_ks); player.root.quaternion.copy(v.root.quaternion);
  player.pos.copy(v.pos); player.yaw = v.yaw; player.speed = Math.abs(v.speed); player.onGround = true; player.vel.set(0, 0, 0); player.inside = null;
  animateRig(dt, t, 0);
  const dyaw = angDiff(v.lastYaw, v.yaw); v.lastYaw = v.yaw;
  if (camMode === 'fpp') { cam.yaw += dyaw; cam.tyaw += dyaw; }
  else if (!cam.dragging && Math.abs(v.speed) > 1.5) { cam.tyaw = angLerp(cam.tyaw, v.yaw + Math.PI, 1 - Math.exp(-dt * 2.4)); cam.tpitch = damp(cam.tpitch, 0.2, 1.5, dt); }
}
let nearVeh = null;
function updateVehicles(dt, t) {
  for (const v of VEHICLES) {
    const driven = player.vehicle === v;
    if (v.spec.rail) { railVehicle(v, dt, driven); if (driven) trackDrive(Math.abs(v.speed) * dt); continue; }
    const far = !driven && !v.ai && Math.hypot(v.pos.x - player.pos.x, v.pos.z - player.pos.z) > 250;
    if (far && v.settled) continue;           // parked far away: nothing to do
    for (const c of v.cols) c.off = true;
    if (v.spec.water) updateBoat(v, dt, t, driven); else updateCar(v, dt, t, driven);
    if (driven) trackDrive(Math.abs(v.speed) * dt);
    if (v.spec.horse && v.horseAnimal) {
      const an = v.horseAnimal; an.x = v.pos.x; an.z = v.pos.z; an.y = v.pos.y; an.yaw = v.yaw; an.root.position.copy(v.pos); an.root.rotation.set(0, v.yaw, 0);
      an.main.timeScale = Math.abs(v.speed) > 0.3 ? clamp(Math.abs(v.speed) / 6, 0.3, 1.6) : 0; if (Math.abs(v.speed) < 0.3) an.main.time = 0.12; an.mixer.update(dt);
      v.root.visible = false;
    } else { v.root.position.copy(v.pos); v.root.rotation.set(v.pitch, v.yaw, v.roll, 'YXZ'); }
    placeVehicleCols(v); for (const c of v.cols) c.off = driven;
    v.settled = !driven && !v.ai && Math.abs(v.speed) < 0.05 && !v.air;
    const lights = (driven || v.ai) && (ENV.lamps > 0.25 || (driven && flashMode === 'on'));
    if (v.lamp) v.lamp.emissiveIntensity = lights ? 3.2 : 0;
    if (v.tail) v.tail.emissiveIntensity = (driven || v.ai) ? (v.brake ? 3 : lights ? 0.9 : 0) : 0;
    if (v.siren) { const on = v.sirenOn; v.siren.g.visible = true; const ph = Math.floor(t * 4) % 2; v.siren.red.material.color.setRGB(on && ph ? 4 : 0.4, 0.1, 0.1); v.siren.blue.material.color.setRGB(0.1, 0.2, on && !ph ? 4 : 0.4); }
  }
  for (let i = 0; i < VEHICLES.length; i++) for (let j = i + 1; j < VEHICLES.length; j++) {
    const a = VEHICLES[i], b = VEHICLES[j], dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
    if (Math.abs(dx) > 8 || Math.abs(dz) > 8) continue;
    const d = Math.hypot(dx, dz), m = a.spec.R + b.spec.R + 0.4;
    if (a.spec.rail || b.spec.rail) continue;
    if (d < m && d > 1e-3 && Math.abs(a.pos.y - b.pos.y) < 2) { const k = (m - d) / d * 0.5; a.pos.x -= dx * k; a.pos.z -= dz * k; b.pos.x += dx * k; b.pos.z += dz * k; a.speed *= 0.7; b.speed *= 0.7; a.settled = b.settled = false; }
  }
  if (player.vehicle) seatPlayer(player.vehicle, dt, t);
  nearVeh = null;
  if (!player.vehicle && player.alive) {
    let bd = 1e9;
    for (const v of VEHICLES) { if (v.ai || v.wreck) continue; const d = Math.hypot(v.pos.x - player.pos.x, v.pos.z - player.pos.z) - v.spec.R; if (d < 2.3 && d < bd && Math.abs(v.pos.y - player.pos.y) < 2.8) { bd = d; nearVeh = v; } }
    // a horse standing near you can be mounted
    if (!nearVeh) for (const an of ANIMALS) if (an.active && an.kind === 'horse' && an.state !== 'dead' && Math.hypot(an.x - player.pos.x, an.z - player.pos.z) < 2.2) { nearVeh = { horse: an, spec: VSPEC.horse, pos: new THREE.Vector3(an.x, an.y, an.z) }; break; }
  }
}
function enterVehicle(v) {
  if (!v || player.vehicle || !player.alive) return;
  if (v.horse) {          // saddle up: the horse becomes a vehicle while you ride
    const an = v.horse, nv = addVehicle('horse', { root: new THREE.Group(), wheels: [] }, an.x, an.z, an.yaw);
    nv.horseAnimal = an; an.rider = true; an.state = 'ridden'; v = nv;
  }
  if (typeof BUILD !== 'undefined' && BUILD.ghost) cancelBuild();
  player.vehicle = v; player.inside = null; player.swingT = 0; player.reloadT = 0; player.sprinting = false; input.act = false;
  v.lastYaw = v.yaw; showTool();
  if (camMode !== 'fpp') { cam.tyaw = v.yaw + Math.PI; cam.tpitch = 0.22; }
  AUDIO.door(); if (!v.spec.paddle && !v.spec.horse && !v.spec.pedal) AUDIO.engineStart(); if (v.spec.horse) AUDIO.animal('horse', 0); hudDirty = true;
  if (v.spec.rail) toast(v.spec.name, TOUCH ? 'العصا للأمام والخلف على السكة · زر القفز فرامل · زر النزول للخروج' : 'W للأمام · S للخلف · المسافة فرامل · E للنزول');
  else toast(v.spec.name, TOUCH ? 'العصا للقيادة · زر القفز فرامل · زر النزول للخروج' : 'W و S للسرعة · A و D للتوجيه · المسافة فرامل' + (v.spec.horse ? ' · Shift للعدو' : '') + ' · E للنزول');
}
function exitVehicle(force) {
  const v = player.vehicle; if (!v) return false;
  const S = v.spec, cy = Math.cos(v.yaw), sy = Math.sin(v.yaw);
  let spot = null;
  for (const [lx, lz] of [[S.R + 0.7, 0], [-(S.R + 0.7), 0], [0, -(S.wb / 2 + 1.3)], [0, S.wb / 2 + 1.3], [S.R + 1.6, 0], [-(S.R + 1.6), 0]]) {
    const x = v.pos.x + lx * cy + lz * sy, z = v.pos.z - lx * sy + lz * cy, g = groundAt(x, z, v.pos.y + 2.2);
    if (g < waterAt(x, z) - 0.9 || Math.abs(g - v.pos.y) > 2.6) continue;
    _kp.x = x; _kp.z = z; _kp.y = g; for (const c of v.cols) c.off = true; resolveCollision(_kp, PHYS.R);
    if (Math.hypot(_kp.x - x, _kp.z - z) > 0.6) continue;
    spot = [_kp.x, groundAt(_kp.x, _kp.z, g + 0.3), _kp.z]; break;
  }
  if (!spot) {
    if (!force) { toast('لا يمكنك النزول هنا', S.water ? 'اقترب من الشاطئ أو الرصيف' : 'المكان ضيّق'); return false; }
    spot = [v.pos.x, Math.max(groundAt(v.pos.x, v.pos.z), v.pos.y), v.pos.z];
  }
  player.vehicle = null; player.pos.set(spot[0], spot[1], spot[2]); player.vel.set(0, 0, 0); player.onGround = true; player.airT = 0;
  player.yaw = v.yaw; player.root.rotation.set(0, v.yaw, 0); player.root.position.copy(player.pos);
  for (const c of v.cols) c.off = false;
  if (v.horseAnimal) { const an = v.horseAnimal; an.rider = false; an.state = 'graze'; an.wT = 20; an.x = v.pos.x; an.z = v.pos.z; removeVehicle(v); }
  if (v.rec) { v.rec.x = +v.pos.x.toFixed(2); v.rec.z = +v.pos.z.toFixed(2); v.rec.ry = +v.yaw.toFixed(3); if (typeof saveSoon === 'function') saveSoon(); }
  AUDIO.engine(false); AUDIO.door(); showTool(); hudDirty = true;
  cam.focus.set(player.pos.x, player.pos.y + 1.62, player.pos.z);
  return true;
}

/* ── parked cars in the towns, and traffic on the roads ── */
function onSettlementReadyCars(S) {
  const src = S.src, list = [];
  if (S.vehicles) return;
  S.vehicles = [];
  const R0 = RNG(S.id.length * 31 + 7);
  for (const p of src.props || []) if (p.kind === 'rboat') list.push([p.boat || 'boat', p.x, p.z, p.ry || 0]);     // boats you can take, at the landings
  for (const p of src.parking || []) {
    if (R0() < 0.35) continue;
    const kind = p.kind === 'military' ? (R0() < 0.5 ? 'jeep' : 'pickup') : S.kind === 'city' ? ['sedan', 'taxi', 'suv', 'van', 'sedan', 'police', 'sedan', 'bus'][Math.floor(R0() * 8)] : ['pickup', 'sedan', 'tractor', 'suv'][Math.floor(R0() * 4)];
    if (kind === 'bus' && R0() < 0.6) continue;
    list.push([kind, p.x, p.z, p.ry || 0, p.kind === 'military' ? MIL_OLIVE : undefined]);     // army olive at the bases
  }
  if (S.kind === 'village' && S.buildings.length) {
    const n = 2 + Math.floor(R0() * 3);
    for (let k = 0; k < n; k++) {
      const o = S.buildings[Math.floor(R0() * S.buildings.length)], [dnx, dnz] = SIDE[o.door] || [0, 1];
      const x = o.x + dnx * (o.hx + 3.5) + dnz * 3, z = o.z + dnz * (o.hz + 3.5) + dnx * 3;
      if (terrainAt(x, z) < waterAt(x, z) + 0.3) continue;
      const st = (S.buildings[0] && S.buildings[0].style) || '';
      list.push([S.id === 'farm' || st === 'farm' ? pick(['tractor', 'pickup', 'truck']) : S.id === 'desert' || st === 'adobe' ? pick(['buggy', 'pickup', 'jeep']) : S.id === 'mountain' || st === 'chalet' ? pick(['suv', 'jeep', 'pickup']) : pick(['pickup', 'sedan', 'bike', 'bicycle']), x, z, Math.atan2(dnx, dnz) + Math.PI / 2]);
    }
  }
  if (S.id === 'city' && terrainAt(src.x + 26, src.z + 30) > waterAt(src.x + 26, src.z + 30) + 0.4) list.push(['sports', src.x + 26, src.z + 30, 1.2]);
  const dead = S.kind === 'ruin';      // the dead city keeps only rusted wrecks that will never start again
  for (const [kind, x, z, ry, paint] of list) {
    let ok = true; CGRID.each(x - 2, z - 2, x + 2, z + 2, (c) => { if (!c.off && c.t === 'b' && Math.abs(c.x - x) < c.hx + 1.4 && Math.abs(c.z - z) < c.hz + 1.4) { ok = false; return false; } });
    if (!ok) continue;
    const v = dead ? spawnVehicle(['sedan', 'van', 'pickup', 'sedan', 'bus'][Math.floor(R0() * 5)], x, z, ry + (R0() - 0.5) * 0.6, RUST_PAINTS[Math.floor(R0() * 4)]) : spawnVehicle(kind, x, z, ry, paint);
    v.town = S.id; if (dead) v.wreck = true; S.vehicles.push(v);
  }
}
function onSettlementUnloadCars(S) { if (!S.vehicles) return; for (const v of S.vehicles) if (player.vehicle !== v && !v.owned) removeVehicle(v); S.vehicles = null; }
const TRAFFIC = [];
function trafficSpawn() {
  // a car somewhere on a road 150–600 m away, heading along it
  for (let tries = 0; tries < 10; tries++) {
    const R = pick(ROADS); if (R.kind === 2 && rand() < 0.7) continue;
    const i = Math.floor(rand() * (R.pts.length - 2)) + 1, p = R.pts[i], d = Math.hypot(p[0] - player.pos.x, p[1] - player.pos.z);
    if (d < 150 || d > 600 || R.bridge[i]) continue;
    const dir = rand() < 0.5 ? 1 : -1, q = R.pts[i + dir] || R.pts[i - dir];
    const yaw = Math.atan2(q[0] - p[0], q[1] - p[1]);
    const kinds = R.kind === 2 ? ['pickup', 'jeep', 'tractor', 'bike'] : ['sedan', 'sedan', 'taxi', 'suv', 'van', 'pickup', 'truck', 'bus', 'police', 'ambulance', 'sports', 'bike'];
    const kind = pick(kinds);
    const lane = R.w * 0.5, lx = Math.cos(yaw), lz = -Math.sin(yaw);
    const v = spawnVehicle(kind, p[0] + lx * lane, p[1] + lz * lane, yaw);
    v.ai = { road: R, i, dir, thr: 0, str: 0, hb: false, lane, stuck: 0 };
    TRAFFIC.push(v); return;
  }
}
function updateTraffic(dt) {
  if (!ROADS.length) return;
  for (let i = TRAFFIC.length - 1; i >= 0; i--) {
    const v = TRAFFIC[i], A = v.ai;
    if (!A || Math.hypot(v.pos.x - player.pos.x, v.pos.z - player.pos.z) > 750 || v.hp <= 0) { if (player.vehicle !== v) { removeVehicle(v); TRAFFIC.splice(i, 1); } else v.ai = null; continue; }
    const R = A.road, pts = R.pts;
    // aim at a point a little ahead on our lane
    let j = A.i;
    for (let k = 0; k < 6; k++) { const n = j + A.dir; if (n < 0 || n >= pts.length) break; const q = pts[n]; if (Math.hypot(q[0] - v.pos.x, q[1] - v.pos.z) > 9 + Math.abs(v.speed) * 0.8) break; j = n; }
    if (j === A.i && (A.i + A.dir < 0 || A.i + A.dir >= pts.length)) { A.dir *= -1; }          // the end of the road: turn round
    A.i = j;
    const n = clamp(j + A.dir, 0, pts.length - 1), p = pts[j], q = pts[n];
    let tx = q[0], tz = q[1]; const yawR = Math.atan2(q[0] - p[0], q[1] - p[1]); tx += Math.cos(yawR) * A.lane; tz -= Math.sin(yawR) * A.lane;
    const want = Math.atan2(tx - v.pos.x, tz - v.pos.z), err = angDiff(v.yaw, want);
    A.str = clamp(err * 2.2, -1, 1);
    // speed: by road kind and curvature, slow for anything ahead
    const limit = (R.kind === 0 ? 22 : R.kind === 1 ? 15 : 8) * (1 - Math.min(0.6, Math.abs(err) * 1.5)) * (v.spec.max < 20 ? 0.6 : 1);
    let block = 1e9;
    const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw);
    for (const o of [...VEHICLES.filter((w) => w !== v && Math.abs(w.pos.x - v.pos.x) < 30 && Math.abs(w.pos.z - v.pos.z) < 30), player]) {
      const ox = (o.pos ? o.pos.x : o.x) - v.pos.x, oz = (o.pos ? o.pos.z : o.z) - v.pos.z, along = ox * fx + oz * fz, side = Math.abs(ox * fz - oz * fx);
      if (along > 0 && along < 26 && side < 2.6) block = Math.min(block, along);
    }
    const target = block < 9 ? 0 : block < 22 ? Math.min(limit, (block - 9) * 1.2) : limit;
    A.thr = v.speed < target - 0.5 ? 0.8 : v.speed > target + 1.5 ? -0.6 : 0.05;
    A.hb = target === 0 && v.speed < 2;
    if (block < 12 && player.vehicle && rand() < dt * 0.4) AUDIO.horn(Math.hypot(v.pos.x - player.pos.x, v.pos.z - player.pos.z));
    v.sirenOn = v.spec.siren && ENV.night > 0.3;
  }
  const want = QUALITY.traffic * (ENV.night > 0.5 ? 0.6 : 1);
  if (TRAFFIC.length < want && rand() < dt * 0.6) trafficSpawn();
}
