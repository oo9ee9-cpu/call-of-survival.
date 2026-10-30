/* ═════════ settlements: 287 buildings in eleven places, built in full when you come near and folded into simple blocks far away;
   streets, squares, lamps, piers, boats, shops you can walk into ═════════ */
const GLASS_MAT = new THREE.MeshStandardMaterial({ color: C(0x9fb6c0), roughness: 0.04, metalness: 0, transparent: true, opacity: 0.34, depthWrite: false });
const WINDOW_LIT_MAT = new THREE.MeshStandardMaterial({ color: C(0x2a2f33), emissive: C(0xffb868), emissiveIntensity: 0, roughness: 0.3 });
const BULB_MAT = new THREE.MeshBasicMaterial({ color: C(0x8a8a80) });
const GLOW_MAT = new THREE.MeshBasicMaterial({ color: C(0xffffff), vertexColors: true });     // lit day and night, in its own colours (screens, specimen tanks)
const BULB_OFF = C(0x6a6a64), BULB_ON = new THREE.Color(4.0, 3.2, 2.2);
ENV_MATS.push(GLASS_MAT, WINDOW_LIT_MAT);
ENV_HOOKS.push((env) => { WINDOW_LIT_MAT.emissiveIntensity = env.lamps * 1.6; BULB_MAT.color.copy(BULB_OFF).lerp(BULB_ON, env.lamps); });
const BUILDINGS = [], BGRID = new SGrid(32), LOOT_SPOTS = [], SHOP_SPOTS = [], BEDS = [];
const SIDE = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };

/* ── shop and building signs: one atlas painted from the names in the world file ── */
const SIGNS = { slots: new Map(), canvas: null, tex: null, mat: null, cols: 4, rows: 8 };
function paintSigns() {
  const c = SIGNS.canvas, g = c.getContext('2d'); if (!g) return;
  for (const [text, { slot, bg }] of SIGNS.slots) {
    const x = (slot % SIGNS.cols) * 512, y = Math.floor(slot / SIGNS.cols) * 128;
    g.fillStyle = bg; g.fillRect(x, y, 512, 128);
    const r0 = RNG(slot * 77 + 5); for (let k = 0; k < 700; k++) { g.fillStyle = `rgba(0,0,0,${r0() * 0.08})`; g.fillRect(x + r0() * 512, y + r0() * 128, 2, 2); }
    g.strokeStyle = 'rgba(255,240,210,.85)'; g.lineWidth = 6; g.strokeRect(x + 8, y + 8, 496, 112);
    g.fillStyle = '#fff6e2'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = 'rtl';
    let fs = 64; g.font = `700 ${fs}px 'Aref Ruqaa','Amiri',serif`; while (g.measureText(text).width > 470 && fs > 30) { fs -= 4; g.font = `700 ${fs}px 'Aref Ruqaa','Amiri',serif`; }
    g.fillText(text, x + 256, y + 70);
  }
  SIGNS.tex.needsUpdate = true;
}
function initSigns(texts) {
  const c = SIGNS.canvas = document.createElement('canvas'); c.width = 2048; c.height = 1024;
  SIGNS.tex = new THREE.CanvasTexture(c); SIGNS.tex.encoding = THREE.sRGBEncoding; SIGNS.tex.anisotropy = 4;
  const BG = ['#2b8c86', '#c27a2c', '#2f7d4c', '#6b4a2f', '#a8453a', '#3d5a8f', '#22313a', '#2d6f8f', '#7a3a5a', '#4a6a2a'];
  texts.forEach((t, i) => { if (!SIGNS.slots.has(t) && SIGNS.slots.size < SIGNS.cols * SIGNS.rows) SIGNS.slots.set(t, { slot: SIGNS.slots.size, bg: BG[i % BG.length] }); });
  paintSigns();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(paintSigns).catch(() => {});
  SIGNS.mat = new THREE.MeshStandardMaterial({ map: SIGNS.tex, emissive: 0xffffff, emissiveMap: SIGNS.tex, emissiveIntensity: 0, roughness: 0.7 });
  ENV_MATS.push(SIGNS.mat); ENV_HOOKS.push((env) => { SIGNS.mat.emissiveIntensity = env.lamps * 0.6; });
}
class SignBuilder {
  constructor() { this.p = []; this.n = []; this.uv = []; }
  add(text, x, y, z, nx, nz, w = 3.2, h = 0.8) {
    const s = SIGNS.slots.get(text); if (!s) return;
    const u0 = (s.slot % SIGNS.cols) / SIGNS.cols, du = 1 / SIGNS.cols, v1 = 1 - Math.floor(s.slot / SIGNS.cols) / SIGNS.rows, v0 = v1 - 1 / SIGNS.rows, tx = nz, tz = -nx;
    const c = [[-w / 2, -h / 2, u0, v0], [w / 2, -h / 2, u0 + du, v0], [w / 2, h / 2, u0 + du, v1], [-w / 2, h / 2, u0, v1]];
    // the canvas is drawn top-down, CanvasTexture flips it: v as above
    const P = c.map(([a, b]) => [x + nx * 0.2 - tx * a, y + b, z + nz * 0.2 - tz * a]);
    for (const k of [0, 2, 1, 0, 3, 2]) { this.p.push(...P[k]); this.n.push(nx, 0, nz); this.uv.push(c[k][2], c[k][3]); }
  }
  mesh() { if (!this.p.length) return null; const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2)); g.computeBoundingSphere(); return new THREE.Mesh(g, SIGNS.mat); }
}

/* ── styles: every place builds in its own way ── */
const STYLES = {
  city: { walls: [0xf1ece2, 0xe9dfca, 0xe2d4b8, 0xeedfc8, 0xdbe2df, 0xe9d2bb, 0xe4ddd0, 0xd8c3a5], wallK: K.plaster, roof: 'flat', h: 3.2, tanks: true, balcony: true },
  port: { walls: [0xd8cfc0, 0xc9b896, 0xbfb6a6], wallK: K.plaster, roof: 'flat', h: 4.4 },
  farm: { walls: [0xc7b39a, 0xd9c6a8, 0xb8a58a, 0xe2d6c0, 0x9a5a3e], wallK: K.plaster, roof: 'pitched', roofC: [0x8a3a2a, 0x6e4a32, 0x5a5a5a, 0x7a3e2c], h: 3.0 },
  chalet: { walls: [0x8a6440, 0x7a5a3a, 0x9a7650, 0x6e4e32], wallK: K.wood, roof: 'steep', roofC: [0x3a3a3c, 0x4a3a2e, 0x2e3438], snow: true, h: 3.0, baseC: 0x8d8174 },
  adobe: { walls: [0xd8b98a, 0xcfae7c, 0xe0c49a, 0xc9a070], wallK: K.plaster, roof: 'parapet', h: 3.0 },
  stilt: { walls: [0x7a6a52, 0x6e5e48, 0x857256], wallK: K.wood, roof: 'thatch', roofC: [0x9a8458, 0x8a7448], stilts: 1.7, h: 2.8 },
  mining: { walls: [0x9aa0a6, 0x8a8478, 0xa89a84, 0x7d7a72], wallK: K.metal, roof: 'pitched', roofC: [0x6a6f74, 0x7a6a5a], h: 3.0 },
  military: { walls: [0x7d8466, 0x8a8a7a, 0x6f7560], wallK: K.stone, roof: 'flat', h: 3.4 },
  hut: { walls: [0xc9a878, 0xb89868, 0xd8b888], wallK: K.wood, roof: 'thatch', roofC: [0xb09858, 0xa08848], stilts: 0.9, h: 2.8 },
  fisher: { walls: [0x6f8fa0, 0xa85a46, 0xd9c49a, 0x5f7a5a, 0xe9e2d6], wallK: K.wood, roof: 'pitched', roofC: [0x5a4a3e, 0x3d4a52, 0x7a3a2a], h: 2.9 },
  // a city nobody lives in any more: grey stained walls, empty windows, roofs fallen in, no lights at night
  ruin: { walls: [0x8a8478, 0x7a756c, 0x6e6a62, 0x9a9488, 0x847a6c], wallK: K.stone, roof: 'broken', h: 3.2, ruin: true },
};
const TRIMS = [0x2f6a9a, 0x2b8c86, 0x3f7a4a, 0x6b4a2f, 0x2d5f86, 0x8b4b3a, 0x4a4a4a];

/* ── per-settlement context: geometry builders and the colliders it registered, so it can be folded away again ── */
class Ctx {
  constructor(S) { this.S = S; this.ext = new Map(); this.glass = new Builder(); this.lit = new Builder(); this.bulbs = new Builder(); this.glow = new Builder(); this.signs = new SignBuilder(); this.inter = []; this.cols = []; this.plats = []; this.occs = []; this.anchors = []; this.meshes = []; this.spots = []; }
  at(x, z) { const k = Math.floor(x / 48) * 1000 + Math.floor(z / 48); let b = this.ext.get(k); if (!b) { b = new Builder(); this.ext.set(k, b); } return b; }
  col(c) { addCollider(c); this.cols.push(c); return c; }
  plat(p) { addPlatform(p); this.plats.push(p); return p; }
  deck(...a) { const p = addDeck(...a); this.plats.push(p); return p; }
  occ(o) { addOccluder(o); this.occs.push(o); return o; }
  light(a) { LIGHT_ANCHORS.push(a); this.anchors.push(a); return a; }
}

/* ── furniture ── */
function furniture(ctx, b, kind, x, y, z, ry, colA, R) {
  const L = (a, c) => [x + Math.cos(ry) * a + Math.sin(ry) * c, z - Math.sin(ry) * a + Math.cos(ry) * c];
  const put = (geo, a, yy, c, sx, sy, sz, col, mk, rx = 0) => { const [px, pz] = L(a, c); b.add(geo, M(px, y + yy, pz, ry, sx, sy, sz, rx), col, mk); };
  const solid = (r, h) => ctx.col({ t: 'c', x, z, r, y0: y - 0.3, y1: y + h });
  const pk = (arr) => arr[Math.floor(R() * arr.length)];
  if (kind === 'bed') {
    put(G.box, 0, 0.22, 0, 1.5, 0.3, 2.1, 0x6b4a2f, K.wood); put(G.box, 0, 0.45, 0.05, 1.4, 0.2, 1.95, 0xe9e4da, K.fabric);
    put(G.box, 0, 0.58, 0.25, 1.42, 0.08, 1.5, colA || 0x5b6e8a, K.fabric); put(G.box, 0, 0.6, -0.78, 1.1, 0.14, 0.38, 0xf4f1ea, K.fabric);
    put(G.box, 0, 0.6, -1.02, 1.5, 0.9, 0.08, 0x5a3e28, K.wood); solid(1.0, 0.8);
    BEDS.push({ x, y, z });
  } else if (kind === 'sofa') {
    put(G.box, 0, 0.25, 0, 2.0, 0.4, 0.85, colA || 0x7a5a4a, K.fabric); put(G.box, 0, 0.62, -0.36, 2.0, 0.55, 0.18, colA || 0x7a5a4a, K.fabric);
    for (const s of [-1, 1]) put(G.box, s * 0.95, 0.45, 0, 0.16, 0.5, 0.85, colA || 0x6e5040, K.fabric);
    for (const s of [-0.5, 0.5]) put(G.box, s, 0.5, 0.02, 0.9, 0.12, 0.7, 0xa48a78, K.fabric); solid(0.95, 0.8);
  } else if (kind === 'table') {
    put(G.box, 0, 0.74, 0, 1.4, 0.06, 0.85, 0x7a5232, K.wood);
    for (const [a, c] of [[-0.62, -0.36], [0.62, -0.36], [-0.62, 0.36], [0.62, 0.36]]) put(G.box, a, 0.37, c, 0.06, 0.72, 0.06, 0x5a3e28, K.wood);
    for (const [a, c, r] of [[-0.35, -0.7, 0], [0.35, -0.7, 0], [-0.35, 0.7, Math.PI], [0.35, 0.7, Math.PI]]) {
      const [px, pz] = L(a, c); b.add(G.box, M(px, y + 0.45, pz, ry + r, 0.42, 0.05, 0.42), 0x6b4a2f, K.wood); b.add(G.box, M(px + Math.sin(ry + r) * -0.19, y + 0.72, pz + Math.cos(ry + r) * -0.19, ry + r, 0.42, 0.5, 0.05), 0x6b4a2f, K.wood);
    }
    solid(0.9, 0.8);
  } else if (kind === 'wardrobe') {
    put(G.box, 0, 1.0, 0, 1.2, 2.0, 0.6, 0x6b4a2f, K.wood); put(G.box, 0, 1.0, 0.31, 0.02, 1.9, 0.01, 0x3a281a, K.wood);
    for (const s of [-0.06, 0.06]) put(G.box, s, 1.05, 0.32, 0.03, 0.18, 0.03, 0xb8b2a4, K.metal); solid(0.7, 2.0);
  } else if (kind === 'kitchen') {
    put(G.box, 0, 0.45, 0, 2.4, 0.9, 0.62, 0xd9d2c4, K.wood); put(G.box, 0, 0.92, 0, 2.45, 0.05, 0.66, 0x6d6a66, K.stone);
    put(G.box, -0.6, 0.93, 0.02, 0.5, 0.04, 0.38, 0x9aa0a6, K.metal); put(G.box, 0.6, 0.95, 0, 0.55, 0.03, 0.5, 0x222426, K.metal);
    put(G.box, 1.6, 0.92, 0, 0.7, 1.84, 0.66, 0xe8e8e4, K.metal); solid(1.3, 1.9);
  } else if (kind === 'tv') {
    put(G.box, 0, 0.28, 0, 1.4, 0.5, 0.42, 0x3a2a1e, K.wood); put(G.box, 0, 0.9, 0, 1.15, 0.66, 0.06, 0x111214, K.metal); solid(0.7, 1.2);
  } else if (kind === 'shelf') {
    put(G.box, 0, 0.95, 0, 1.0, 1.9, 0.35, 0x6b4a2f, K.wood);
    for (let lv = 0; lv < 4; lv++) for (let k = 0; k < 6; k++) put(G.box, -0.38 + k * 0.15, 0.32 + lv * 0.45, 0.02, 0.1, 0.3, 0.24, pk([0x8a3a2e, 0x2f5f7a, 0xd9c35a, 0x3f7a4a, 0xe9e2d6]), K.fabric);
    solid(0.6, 1.9);
  } else if (kind === 'rug') {
    put(G.box, 0, 0.012, 0, 2.2, 0.02, 1.5, colA || 0x8a3a2e, K.fabric); put(G.box, 0, 0.016, 0, 1.7, 0.02, 1.0, 0xd9b55a, K.fabric);
  } else if (kind === 'rack') {        // clothes rail with hanging garments
    put(G.box, 0, 1.55, 0, 2.0, 0.04, 0.04, 0x8a8f94, K.metal);
    for (const s of [-0.95, 0.95]) put(G.box, s, 0.78, 0, 0.04, 1.56, 0.5, 0x8a8f94, K.metal);
    for (let k = 0; k < 9; k++) put(G.box, -0.8 + k * 0.2, 1.08, 0, 0.05, 0.85, 0.48, pk([0x2f4a6a, 0x8a3a2e, 0x3f5a3a, 0xd9c9a6, 0x2a2a2a, 0x6a5a8a, 0xb88a3a]), K.fabric);
    solid(1.0, 1.7);
  } else if (kind === 'mirror') {
    put(G.box, 0, 1.0, 0, 0.8, 1.8, 0.06, 0x3a2a1e, K.wood); put(G.box, 0, 1.0, 0.035, 0.7, 1.7, 0.01, 0xd8e4ea, K.glass);
  } else if (kind === 'counter') {
    put(G.box, 0, 0.55, 0, 2.6, 1.1, 0.7, colA || 0x7a4a2b, K.wood); put(G.box, 0, 1.12, 0, 2.7, 0.05, 0.78, 0x3a3f44, K.stone);
    put(G.box, 0.8, 1.3, 0, 0.4, 0.3, 0.35, 0x2a2e31, K.metal); solid(1.3, 1.2);
  } else if (kind === 'hay') {
    for (let k = 0; k < 6; k++) put(G.box, (k % 3 - 1) * 1.25, 0.45 + Math.floor(k / 3) * 0.9, 0, 1.2, 0.9, 0.9, 0xc8a85a, K.fabric); solid(1.9, 1.8);
  } else if (kind === 'desk') {
    put(G.box, 0, 0.74, 0, 1.6, 0.05, 0.8, 0x6b5a4a, K.wood); put(G.box, -0.6, 0.37, 0, 0.4, 0.72, 0.75, 0x5a4a3a, K.wood); put(G.box, 0.75, 0.37, 0, 0.05, 0.72, 0.75, 0x5a4a3a, K.wood);
    put(G.box, 0.2, 0.98, -0.15, 0.6, 0.4, 0.05, 0x111214, K.metal); put(G.box, 0, 0.45, 0.6, 0.5, 0.06, 0.5, 0x2a2a2a, K.fabric); solid(0.9, 1.0);
  } else if (kind === 'crates') {
    for (let k = 0; k < 4; k++) { const s = 0.7 + R() * 0.5; put(G.box, (R() - 0.5) * 1.6, s / 2 + (k > 2 ? 0.8 : 0), (R() - 0.5) * 1.2, s, s, s, pk([0x9a7448, 0x8a6a45, 0x55603f]), K.wood); }
    solid(1.2, 1.6);
  } else if (kind === 'labbench') {     // a white bench: a sink, flasks of coloured liquid, a microscope
    put(G.box, 0, 0.45, 0, 2.4, 0.9, 0.7, 0xe4e6e8, K.metal); put(G.box, 0, 0.92, 0, 2.45, 0.04, 0.74, 0x2a2e31, K.stone);
    put(G.box, -0.8, 0.94, 0, 0.5, 0.02, 0.4, 0x9aa0a6, K.metal);
    for (let k = 0; k < 5; k++) { const [px, pz] = L(-0.3 + k * 0.26, (k % 2) * 0.18 - 0.08); ctx.glow.add(G.cyl8, M(px, y + 1.03, pz, 0, 0.055, 0.17, 0.055), pk([0x6aff9a, 0x5ac8ff, 0xffd060, 0xff6a8a])); }
    put(G.box, 0.95, 1.1, 0, 0.16, 0.32, 0.2, 0x33383c, K.metal); put(G.cyl8, 0.95, 1.3, 0.05, 0.03, 0.14, 0.03, 0x1a1c1e, K.metal);
    solid(1.25, 1.1);
  } else if (kind === 'tank') {         // a specimen tank: green light through the glass
    put(G.cyl8, 0, 0.15, 0, 0.55, 0.3, 0.55, 0x3a3f44, K.metal); put(G.cyl8, 0, 2.05, 0, 0.55, 0.22, 0.55, 0x3a3f44, K.metal);
    for (const s of [-1, 1]) put(G.cyl8, s * 0.5, 1.1, 0, 0.035, 1.8, 0.035, 0x55595e, K.metal);
    ctx.glow.add(G.cyl8, M(x, y + 1.1, z, 0, 0.45, 1.6, 0.45), 0x6affb0);
    solid(0.6, 2.2);
  } else if (kind === 'console') {      // a bank of computers, the screens still on
    put(G.box, 0, 0.5, 0, 2.2, 1.0, 0.6, 0x4a5056, K.metal); put(G.box, 0, 1.01, 0.05, 2.2, 0.03, 0.5, 0x2a2e31, K.metal);
    for (let k = 0; k < 3; k++) {
      const [px, pz] = L(-0.7 + k * 0.7, -0.18), [qx, qz] = L(-0.7 + k * 0.7, -0.15);
      b.add(G.box, M(px, y + 1.32, pz, ry, 0.6, 0.44, 0.05), 0x15181a, K.metal); ctx.glow.add(G.box, M(qx, y + 1.32, qz, ry, 0.52, 0.36, 0.01), pk([0x5ac8ff, 0x6aff9a, 0x9adfff]));
    }
    solid(1.15, 1.6);
  }
}

/* ── windows ── */
function windowAt(ctx, b, px, py, pz, nx, nz, w, h, trim, glass, R, shutters) {
  const along = nz !== 0;
  const box = (dx, dy, sx, sy, sz, col, mk) => b.box(px + (along ? dx : 0) + nx * 0.04, py + dy, pz + (along ? 0 : dx) + nz * 0.04, along ? sx : sz, sy, along ? sz : sx, col, 0, mk);
  box(0, -h / 2 - 0.05, w + 0.3, 0.1, 0.3, 0xd8cdb8, K.stone);
  box(-w / 2 - 0.04, 0, 0.08, h, 0.16, trim, K.wood); box(w / 2 + 0.04, 0, 0.08, h, 0.16, trim, K.wood);
  box(0, h / 2 + 0.04, w + 0.16, 0.08, 0.16, trim, K.wood); box(0, 0, 0.05, h, 0.08, trim, K.wood);
  if (glass) { const tgt = R() < 0.4 ? ctx.lit : ctx.glass; tgt.box(px, py, pz, along ? w : 0.03, h, along ? 0.03 : w, 0xffffff); }
  if (shutters) for (const s of [-1, 1]) if (R() < 0.55) box(s * (w * 0.5 + 0.3), 0, w * 0.5, h, 0.05, trim, K.wood);
}
/* a wall with door and window openings; solid parts collide, everything occludes the camera */
function wallRun(ctx, b, o, nx, nz, half, y0, H, openings, T) {
  const cx = o.x + nx * (o.hx - T / 2), cz = o.z + nz * (o.hz - T / 2), along = nz !== 0;
  const seg = (a0, a1, ya, yb, solid) => {
    const L = a1 - a0; if (L <= 0.02 || yb - ya <= 0.02) return;
    const c = (a0 + a1) / 2, px = cx + (along ? c : 0), pz = cz + (along ? 0 : c);
    b.box(px, (ya + yb) / 2, pz, along ? L : T, yb - ya, along ? T : L, o.wallC, 0, o.wallK);
    if (solid) ctx.col({ t: 'b', x: px, z: pz, hx: along ? L / 2 : T / 2 + 0.02, hz: along ? T / 2 + 0.02 : L / 2, y0: ya - 0.5, y1: yb + 0.3 });
    ctx.occ({ t: 'b', x: px, z: pz, hx: along ? L / 2 : T / 2, hz: along ? T / 2 : L / 2, bot: ya, top: yb });
  };
  const ops = openings.slice().sort((a, b2) => a.t - b2.t);
  let a = -half;
  for (const op of ops) {
    seg(a, op.t - op.w / 2, y0, y0 + H, true);
    seg(op.t - op.w / 2, op.t + op.w / 2, y0, y0 + op.y0, !op.door);
    seg(op.t - op.w / 2, op.t + op.w / 2, y0 + op.y1, y0 + H, false);
    if (!op.door) ctx.col({ t: 'b', x: cx + (along ? op.t : 0), z: cz + (along ? 0 : op.t), hx: along ? op.w / 2 : T / 2, hz: along ? T / 2 : op.w / 2, y0: y0 - 0.5, y1: y0 + H + 0.3 });
    a = op.t + op.w / 2;
  }
  seg(a, half, y0, y0 + H, true);
}
/* the ground under a footprint */
function footprint(x, z, hx, hz) {
  let lo = 1e9, hi = -1e9;
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const h = terrainAt(x + i * hx, z + j * hz); lo = Math.min(lo, h); hi = Math.max(hi, h); }
  return [lo, hi];
}
/* houses over the sea stand on posts: their floor sits a few steps above the boardwalks */
const WALK_Y = 2.0;
function footprintO(o) {
  const r = footprint(o.x, o.z, o.hx, o.hz);
  if (o.water) r[1] = Math.max(r[1], WALK_Y + 0.6 - ((STYLES[o.style] || STYLES.city).stilts || 0));
  return r;
}
const outsideY = (o, x, z) => o.water ? Math.max(terrainAt(x, z), WALK_Y) : terrainAt(x, z);

/* ── roofs ── */
function roofOn(ctx, b, o, top) {
  const { x, z, hx, hz } = o, st = o.st, R = o.R, WK = o.wallK;
  const kind = o.roof || st.roof;
  if (kind === 'pitched' || kind === 'steep' || kind === 'thatch') {
    const alongX = hx >= hz, span = alongX ? hz : hx, rise = span * (kind === 'steep' ? 1.0 : kind === 'thatch' ? 0.85 : 0.6);
    const ang = Math.atan2(rise, span), len = Math.hypot(rise, span) + (kind === 'thatch' ? 0.7 : 0.4);
    const rc = C(o.roofC), thick = kind === 'thatch' ? 0.32 : 0.14, rk = kind === 'thatch' ? K.fabric : st.roofK !== undefined ? st.roofK : K.stone;
    b.box(x, top + 0.1, z, hx * 2 + 0.2, 0.2, hz * 2 + 0.2, o.wallC, 0, WK);
    for (const s of [-1, 1]) {
      const px = alongX ? x : x + s * span / 2, pz = alongX ? z + s * span / 2 : z;
      b.add(G.box, M(px, top + 0.2 + rise / 2, pz, alongX ? 0 : Math.PI / 2, (alongX ? hx : hz) * 2 + 0.6, thick, len, s * ang), rc, rk);
      if (st.snow) b.add(G.box, M(px, top + 0.32 + rise / 2, pz, alongX ? 0 : Math.PI / 2, (alongX ? hx : hz) * 2 + 0.62, 0.08, len * 0.92, s * ang), 0xf4f6f8, K.plaster);
    }
    for (const s of [-1, 1]) {
      const gx = alongX ? x + s * hx : x, gz = alongX ? z : z + s * hz, prism = new THREE.CylinderGeometry(1, 1, 1, 3);
      b.add(prism, M(gx, top + 0.2 + rise / 3, gz, alongX ? Math.PI / 2 : 0, span * 1.15, 0.24, rise / 1.5, -Math.PI / 2, 0), o.wallC, WK); prism.dispose();
    }
    if (kind !== 'thatch' && R() < 0.5) { const cx2 = x + (alongX ? hx * 0.5 : span * 0.3), cz2 = z + (alongX ? span * 0.3 : hz * 0.5); b.box(cx2, top + rise * 0.7 + 0.5, cz2, 0.5, 1.4, 0.5, 0x8a6a5a, 0, K.stone); }
    ctx.occ({ t: 'b', x, z, hx, hz, bot: top, top: top + rise + 0.3 });
    return top + rise;
  }
  const roofT = top + 0.22;
  if (kind === 'broken') {           // the roof has fallen in: a slab over part of it, the rest open to the sky, rubble and broken parapets
    const f = 0.35 + R() * 0.4, side = R() < 0.5 ? -1 : 1, alongX = hx >= hz;
    if (alongX) b.box(x + side * hx * (1 - f), roofT, z, hx * 2 * f, 0.4, hz * 2 + 0.2, o.wallC.clone().multiplyScalar(0.8), 0, WK);
    else b.box(x, roofT, z + side * hz * (1 - f), hx * 2 + 0.2, 0.4, hz * 2 * f, o.wallC.clone().multiplyScalar(0.8), 0, WK);
    for (const [px, pz, sx, sz] of [[x, z - hz, hx * 2, 0.24], [x, z + hz, hx * 2, 0.24], [x - hx, z, 0.24, hz * 2], [x + hx, z, 0.24, hz * 2]]) {
      const hgt = 0.2 + R() * 1.1; b.box(px + (sx > 1 ? (R() - 0.5) * hx * 0.4 : 0), roofT + hgt / 2, pz + (sz > 1 ? (R() - 0.5) * hz * 0.4 : 0), sx * (0.5 + R() * 0.5), hgt, sz * (0.5 + R() * 0.5), o.wallC, 0, WK);
    }
    for (let k = 0; k < 6; k++) b.add(G.dodec, M(x + (R() - 0.5) * hx * 2.4, (o.fy || roofT - 3) + 0.2, z + (R() - 0.5) * hz * 2.4, R() * 3, 0.3 + R() * 0.5, 0.2 + R() * 0.3, 0.3 + R() * 0.5), 0x6e6a62, K.stone);
    ctx.occ({ t: 'b', x, z, hx, hz, bot: top, top: top + 0.6 });
    return top + 0.4;
  }
  b.box(x, roofT, z, hx * 2 + 0.3, 0.44, hz * 2 + 0.3, o.wallC.clone().multiplyScalar(0.93), 0, WK);
  if (kind === 'parapet') {          // adobe: thick rounded parapets, rain spouts
    for (const [px, pz, sx, sz] of [[x, z - hz, hx * 2 + 0.4, 0.4], [x, z + hz, hx * 2 + 0.4, 0.4], [x - hx, z, 0.4, hz * 2 + 0.4], [x + hx, z, 0.4, hz * 2 + 0.4]]) b.box(px, roofT + 0.55, pz, sx, 0.75, sz, o.wallC, 0, WK);
    for (let k = 0; k < 3; k++) { const px = x - hx * 0.6 + k * hx * 0.6; b.add(G.cyl8, M(px, roofT + 0.35, z + hz + 0.35, 0, 0.08, 0.7, 0.08, Math.PI / 2), 0x8a6a4a, K.wood); }
  } else {
    for (const [px, pz, sx, sz] of [[x, z - hz - 0.02, hx * 2 + 0.3, 0.22], [x, z + hz + 0.02, hx * 2 + 0.3, 0.22], [x - hx - 0.02, z, 0.22, hz * 2 + 0.3], [x + hx + 0.02, z, 0.22, hz * 2 + 0.3]]) b.box(px, roofT + 0.5, pz, sx, 0.6, sz, o.wallC, 0, WK);
    const r = R();
    if (st.tanks && r < 0.55) {                 // black water tanks on frames: every roof in the city has one
      const tx = x + (R() - 0.5) * hx, tz = z + (R() - 0.5) * hz;
      for (const [dx, dz] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) b.box(tx + dx, roofT + 0.6, tz + dz, 0.06, 1.0, 0.06, 0x55595e, 0, K.metal);
      b.add(G.cyl14, M(tx, roofT + 1.6, tz, 0, 0.62, 1.1, 0.62), 0x1e2022, K.plain);
    }
    if (r < 0.3) b.add(G.cyl8, M(x + hx * 0.45, roofT + 0.9, z - hz * 0.4, 0, 0.6, 1.4, 0.6), 0x8a8f94, K.metal);
    else if (r < 0.5) { b.add(G.cyl8, M(x - hx * 0.5, roofT + 0.5, z, 0, 0.05, 1.0, 0.05), 0x55595e, K.metal); b.add(G.dome, M(x - hx * 0.5, roofT + 1.05, z, 0, 0.45, 0.16, 0.45, 1.2), 0xdfe3e6, K.metal); }
    else if (r < 0.7) b.box(x + hx * 0.3, roofT + 0.6, z + hz * 0.3, 0.9, 0.7, 0.6, 0xd9dcdf, 0, K.metal);
  }
  ctx.occ({ t: 'b', x, z, hx: hx + 0.15, hz: hz + 0.15, bot: top - 0.05, top: roofT + 0.8 });
  return roofT + 0.8;
}

/* ── one builder for every enterable house: real walls with door and window openings, floors, stairs, furniture ── */
function makeBuilding(ctx, o) {
  const { x, z, hx, hz } = o, st = o.st, T = 0.26, R = o.R;
  const b = ctx.at(x, z), ib = o.ib;          // exterior builder, interior builder
  const [lo, hi] = footprintO(o);
  const floors = o.floors || 1, H1 = o.h || st.h || 3.2, stilts = st.stilts || 0, fy = hi + 0.3 + stilts, top = fy + H1 * floors;
  o.wallC = C(o.wall); o.wallK = st.wallK; const trim = C(o.trim);
  Object.assign(o, { fy, top });
  if (stilts) {          // a deck on posts, a ladder of steps to the door
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const px = x + i * (hx - 0.2), pz = z + j * (hz - 0.2), g = terrainAt(px, pz); b.add(G.cyl8, M(px, (g - 0.5 + fy) / 2, pz, 0, 0.16, fy - g + 0.5, 0.16), 0x5a4430, K.wood); }
    b.box(x, fy - 0.1, z, hx * 2 + 1.2, 0.2, hz * 2 + 1.2, 0x7a5a3c, 0, K.wood);
    ctx.plat({ t: 'rect', x0: x - hx - 0.6, x1: x + hx + 0.6, z0: z - hz - 0.6, z1: z + hz + 0.6, y: fy });
  } else b.box(x, (lo - 0.8 + fy) / 2, z, hx * 2 + 0.1, fy - lo + 0.8, hz * 2 + 0.1, st.baseC !== undefined ? C(st.baseC) : o.wallC.clone().multiplyScalar(0.72), 0, K.stone);
  ib.box(x, fy - 0.03, z, hx * 2 - T * 2, 0.06, hz * 2 - T * 2, o.floorC || 0x8a6a4a, 0, o.tiles ? K.stone : K.wood);
  const DW = o.doorW || 1.5;
  for (const [k, [nx, nz]] of Object.entries(SIDE)) {
    const half = nx !== 0 ? hz : hx, n = Math.max(0, Math.floor((half * 2 - 1.2) / 2.6));
    for (let fl = 0; fl < floors; fl++) {
      const ops = [];
      if (fl === 0 && k === o.door) ops.push({ t: 0, w: DW, y0: 0, y1: 2.45, door: true });
      for (let i = 0; i < n; i++) {
        const t = -half + 0.6 + (half * 2 - 1.2) * (i + 0.5) / n;
        if (ops.some((q) => Math.abs(q.t - t) < (q.w / 2 + 0.8))) continue;
        ops.push({ t, w: o.shopfront && fl === 0 ? 1.8 : 1.0, y0: o.shopfront && fl === 0 ? 0.5 : 0.95, y1: 2.2 });
      }
      wallRun(ctx, b, o, nx, nz, half, fy + fl * H1, H1, ops, T);
      for (const op of ops) if (!op.door) {
        const px = x + nx * (hx - T / 2) + (nz !== 0 ? op.t : 0), pz = z + nz * (hz - T / 2) + (nx !== 0 ? op.t : 0);
        windowAt(ctx, b, px, fy + fl * H1 + (op.y0 + op.y1) / 2, pz, nx, nz, op.w, op.y1 - op.y0, trim, !st.ruin, R, st.wallK !== K.metal && !o.shopfront && !st.ruin);
      }
      // city balconies on upper floors
      if (st.balcony && fl > 0 && R() < 0.35 && half > 2.5) {
        const bx = x + nx * (hx + 0.6), bz = z + nz * (hz + 0.6), along = nz !== 0, by = fy + fl * H1;
        b.box(bx, by, bz, along ? 2.4 : 1.2, 0.14, along ? 1.2 : 2.4, 0xd8d0c0, 0, K.stone);
        for (let q = -2; q <= 2; q++) b.box(bx + (along ? q * 0.55 : nx * 0.55), by + 0.5, bz + (along ? nz * 0.55 : q * 0.55), 0.04, 0.9, 0.04, 0x2c3135, 0, K.metal);
        b.box(bx + (along ? 0 : nx * 0.55), by + 0.95, bz + (along ? nz * 0.55 : 0), along ? 2.4 : 0.05, 0.05, along ? 0.05 : 2.4, 0x2c3135, 0, K.metal);
      }
    }
    if (k === o.door) {
      const fx = x + nx * (hx + 0.02), fz = z + nz * (hz + 0.02), along = nz !== 0;
      if (along) b.box(x - DW / 2 + 0.06, fy + 1.2, fz - nz * (T + DW * 0.45), 0.06, 2.35, DW * 0.9, trim, 0, K.wood);
      else b.box(fx - nx * (T + DW * 0.45), fy + 1.2, z - DW / 2 + 0.06, DW * 0.9, 2.35, 0.06, trim, 0, K.wood);
      b.box(fx + nx * 0.18, fy + 2.62, fz + nz * 0.18, along ? DW + 0.6 : 0.4, 0.12, along ? 0.4 : DW + 0.6, trim, 0, K.wood);
      if (o.sign) ctx.signs.add(o.sign, fx, fy + 3.15, fz, nx, nz, Math.min(3.6, half * 1.3), 0.85);
      if (o.awning) { b.add(G.box, M(fx + nx * 0.9, fy + 2.9, fz + nz * 0.9, along ? 0 : Math.PI / 2, Math.min(half * 1.8, 5), 0.06, 1.8, 0.25 * (along ? -nz : nx)), o.awning, K.fabric); }
      const g = outsideY(o, fx + nx * 2.6, fz + nz * 2.6);
      if (fy - g > 0.3) {
        const run = Math.max(2.8, (fy - g) * 1.4);
        const p = nx !== 0 ? { t: 'ramp', axis: 'x', x0: Math.min(fx, fx + nx * run), x1: Math.max(fx, fx + nx * run), z0: fz - DW / 2 - 0.2, z1: fz + DW / 2 + 0.2 }
          : { t: 'ramp', axis: 'z', x0: fx - DW / 2 - 0.2, x1: fx + DW / 2 + 0.2, z0: Math.min(fz, fz + nz * run), z1: Math.max(fz, fz + nz * run) };
        const outY = outsideY(o, fx + nx * run, fz + nz * run) + 0.04;
        if (p.axis === 'x') { p.ya = nx > 0 ? fy : outY; p.yb = nx > 0 ? outY : fy; } else { p.ya = nz > 0 ? fy : outY; p.yb = nz > 0 ? outY : fy; }
        ctx.plat(p);
        const steps = Math.max(2, Math.round((fy - outY) / 0.18));
        for (let s2 = 0; s2 < steps; s2++) { const t = (s2 + 0.5) / steps, sy = lerp(fy, outY, t); b.box(fx + nx * run * t, (sy + outY) / 2 - 0.05, fz + nz * run * t, along ? DW + 0.4 : run / steps + 0.02, sy - outY + 0.1, along ? run / steps + 0.02 : DW + 0.4, stilts ? 0x6a5038 : 0xb8b0a0, 0, stilts ? K.wood : K.stone); }
      }
    }
  }
  ctx.plat({ t: 'rect', x0: x - hx + 0.02, x1: x + hx - 0.02, z0: z - hz + 0.02, z1: z + hz - 0.02, y: fy });
  const [dnx, dnz] = SIDE[o.door], fX = -dnx, fZ = -dnz, rX = fZ, rZ = -fX;
  const at = (a, c) => [x + fX * a + rX * c, z + fZ * a + rZ * c];
  const faceDoor = Math.atan2(-fX, -fZ), faceIn = (s) => Math.atan2(-rX * s, -rZ * s);
  const depth = (dnx !== 0 ? hx : hz) - T, width = (dnx !== 0 ? hz : hx) - T;
  const boxAC = (a0, a1, c0, c1, y0, y1, col, kind) => { const [px, pz] = at((a0 + a1) / 2, (c0 + c1) / 2), la = Math.abs(a1 - a0), lc = Math.abs(c1 - c0); ib.box(px, (y0 + y1) / 2, pz, dnx !== 0 ? la : lc, y1 - y0, dnx !== 0 ? lc : la, col, 0, kind); };
  const rectAC = (a0, a1, c0, c1) => { const [ax, az] = at(a0, c0), [bx, bz] = at(a1, c1); return [Math.min(ax, bx), Math.max(ax, bx), Math.min(az, bz), Math.max(az, bz)]; };
  o.roofTop = roofOn(ctx, b, o, top);
  const ceil = fy + H1, CEIL_C = o.ceilC !== undefined ? o.ceilC : 0xf0ece4;
  const lampAt = (lx, ly, lz) => { if (st.ruin) return; ib.box(lx, ly - 0.25, lz, 0.5, 0.12, 0.5, 0x3a3f44, 0, K.metal); ctx.bulbs.box(lx, ly - 0.36, lz, 0.36, 0.06, 0.36, 0xffffff); ctx.light({ x: lx, y: ly - 0.6, z: lz, color: 0xffd9a0, range: Math.max(hx, hz) * 2.6, kind: 'interior', bid: o.id }); };
  const pk = (arr) => arr[Math.floor(R() * arr.length)];
  if (floors > 1) {
    // a real staircase along one side wall up through a hole in the slab
    const SW = 1.05, c0 = -width, c1 = -width + SW, a0 = -depth + 0.3, run = Math.min(4.6, depth * 2 - 0.6), a1 = a0 + run, rise = H1 + 0.1, n = Math.round(rise / 0.2), sy = fy + H1;
    for (let k = 0; k < n; k++) boxAC(a0 + k * run / n, a0 + (k + 1) * run / n, c0, c1, fy, fy + (k + 1) * rise / n, 0x8a6a4a, K.wood);
    const [rx0, rx1, rz0, rz1] = rectAC(a0, a1, c0, c1), axis = dnx !== 0 ? 'x' : 'z', lowAtMin = axis === 'x' ? fX > 0 : fZ > 0;
    ctx.plat({ t: 'ramp', axis, x0: rx0, x1: rx1, z0: rz0, z1: rz1, ya: lowAtMin ? fy : fy + rise, yb: lowAtMin ? fy + rise : fy });
    { const [ux0, ux1, uz0, uz1] = rectAC(a0 + run * 0.42, a1, c0, c1); ctx.col({ t: 'b', x: (ux0 + ux1) / 2, z: (uz0 + uz1) / 2, hx: (ux1 - ux0) / 2, hz: (uz1 - uz0) / 2, y0: fy - 0.5, y1: fy + rise * 0.4 }); }
    const ang = Math.atan2(rise, run), [mx, mz] = at((a0 + a1) / 2, c1 - 0.04);
    ib.add(G.box, M(mx, fy + rise / 2 + 0.9, mz, Math.atan2(fX, fZ), 0.05, 0.05, Math.hypot(run, rise), -ang), 0x3a2a1e, K.wood);
    for (let k = 0; k <= 4; k++) { const [px, pz] = at(a0 + run * k / 4, c1 - 0.04); ib.box(px, fy + rise * k / 4 + 0.45, pz, 0.04, 0.9, 0.04, 0x3a2a1e, 0, K.wood); }
    // every upper floor gets a slab with the stair hole (only the first flight is walkable; upper floors are storage)
    for (let fl = 1; fl < floors; fl++) {
      const y = fy + fl * H1, ha0 = a0 + run * 0.3, Ao = (dnx !== 0 ? hx : hz) - 0.05, Co = (dnx !== 0 ? hz : hx) - 0.05;
      boxAC(-Ao, Ao, c1, Co, y - 0.1, y + 0.1, CEIL_C, o.wallK);
      if (fl === 1) { boxAC(-Ao, ha0, -Co, c1, y - 0.1, y + 0.1, CEIL_C, o.wallK); if (a1 < Ao - 0.05) boxAC(a1, Ao, -Co, c1, y - 0.1, y + 0.1, CEIL_C, o.wallK); }
      else boxAC(-Ao, Ao, -Co, c1, y - 0.1, y + 0.1, CEIL_C, o.wallK);
      if (fl === 1) for (const [q0, q1, q2, q3] of [rectAC(-depth, depth, c1, width), rectAC(-depth, ha0, -width, c1), a1 < depth - 0.05 ? rectAC(a1, depth, -width, c1) : null].filter(Boolean)) ctx.plat({ t: 'rect', x0: q0, x1: q1, z0: q2, z1: q3, y: y + 0.1 });
      ctx.occ({ t: 'b', x, z, hx, hz, bot: y - 0.1, top: y + 0.25 });
      if (fl === 1) {
        const ra1 = Math.max(ha0 + 0.3, a1 - 1.1), up = y + 0.1;
        boxAC(ha0, ra1, c1 - 0.02, c1 + 0.04, up + 0.85, up + 0.9, 0x3a2a1e, K.wood);
        for (let k = 0; k <= 3; k++) { const [px, pz] = at(lerp(ha0, ra1, k / 3), c1 + 0.01); ib.box(px, up + 0.45, pz, 0.04, 0.9, 0.04, 0x3a2a1e, 0, K.wood); }
        { const [q0, q1, q2, q3] = rectAC(ha0, ra1, c1 - 0.05, c1 + 0.07); ctx.col({ t: 'b', x: (q0 + q1) / 2, z: (q2 + q3) / 2, hx: (q1 - q0) / 2, hz: (q3 - q2) / 2, y0: up - 0.35, y1: up + 1.1 }); }
        { const [px, pz] = at(depth - 1.1, width - 0.85); furniture(ctx, ib, 'bed', px, up, pz, faceDoor + Math.PI, pk([0x5b6e8a, 0x8a5a4a, 0x5a6a4a]), R); }
        { const [px, pz] = at(-depth + 0.45, width - 0.75); furniture(ctx, ib, 'wardrobe', px, up, pz, faceDoor + Math.PI, 0, R); }
        { const [px, pz] = at(0.2, width * 0.35); furniture(ctx, ib, 'rug', px, up, pz, faceDoor, pk([0x8a3a2e, 0x3d4f6f, 0x6f5a2e]), R); }
        lampAt(x, y + H1, z);
        if (R() < 0.5) { const [px, pz] = at(depth * 0.2, width * 0.6); LOOT_SPOTS.push({ x: px, y: up, z: pz, kind: 'home', bid: o.id, owner: ctx.S.id }); }
      }
    }
  } else ib.box(x, ceil - 0.02, z, hx * 2 - T * 2, 0.04, hz * 2 - T * 2, CEIL_C, 0, o.wallK);
  lampAt(x, ceil, z);
  // what is inside depends on what the building is
  const kinds = o.furnish || (floors > 1 ? pk([['sofa', 'rug', 'shelf'], ['table', 'rug', 'shelf'], ['sofa', 'table', 'shelf']]) : pk([['sofa', 'tv', 'rug', 'shelf'], ['bed', 'wardrobe', 'rug'], ['kitchen', 'table'], ['bed', 'table', 'rug']]));
  for (const f of kinds) {
    const P = (a, c) => at(a, c);
    if (f === 'sofa') { const [px, pz] = P(depth - 0.55, 0); furniture(ctx, ib, 'sofa', px, fy, pz, faceDoor, pk([0x6e5a7a, 0x7a5a4a, 0x4a5a6a]), R); }
    if (f === 'tv') { const [px, pz] = P(Math.max(0.6, depth * 0.1), -width + 0.3); furniture(ctx, ib, 'tv', px, fy, pz, faceIn(-1), 0, R); }
    if (f === 'rug') { const [px, pz] = P(depth * 0.3, 0); furniture(ctx, ib, 'rug', px, fy, pz, faceDoor, pk([0x8a3a2e, 0x3d4f6f, 0x6f5a2e]), R); }
    if (f === 'shelf') { const [px, pz] = P(depth * 0.45, width - 0.25); furniture(ctx, ib, 'shelf', px, fy, pz, faceIn(1), 0, R); }
    if (f === 'bed') { const [px, pz] = P(depth - 1.1, width - 0.85); furniture(ctx, ib, 'bed', px, fy, pz, faceDoor + Math.PI, 0, R); }
    if (f === 'wardrobe') { const [px, pz] = P(depth * 0.35, -width + 0.35); furniture(ctx, ib, 'wardrobe', px, fy, pz, faceIn(-1), 0, R); }
    if (f === 'kitchen') { const [px, pz] = P(depth - 0.4, -0.3); furniture(ctx, ib, 'kitchen', px, fy, pz, faceDoor, 0, R); }
    if (f === 'table') { const [px, pz] = P(depth * 0.35, width * 0.25); furniture(ctx, ib, 'table', px, fy, pz, faceDoor, 0, R); }
    if (f === 'desk') { const [px, pz] = P(depth * 0.4, -width * 0.4); furniture(ctx, ib, 'desk', px, fy, pz, faceDoor, 0, R); }
    if (f === 'crates') { const [px, pz] = P(depth * 0.5, width * 0.4); furniture(ctx, ib, 'crates', px, fy, pz, 0, 0, R); }
    if (f === 'hay') { const [px, pz] = P(depth * 0.55, width * 0.5); furniture(ctx, ib, 'hay', px, fy, pz, faceIn(1), 0, R); }
    // a lab: benches along both walls and an island down the middle, specimen tanks along the back, computer banks by the door
    if (f === 'labbench') {
      const rows = Math.max(1, Math.min(4, Math.floor(depth * 2 / 3.4)));
      for (let r = 0; r < rows; r++) {
        const a = -depth + 1.9 + (r + 0.5) * (depth * 2 - 3.8) / rows;
        for (const s of [-1, 1]) { const [px, pz] = P(a, s * (width - 0.45)); furniture(ctx, ib, 'labbench', px, fy, pz, faceIn(s), 0, R); }
        if (width > 4.5 && Math.abs(a) < depth - 2.6) for (const s of [-1, 1]) { const [px, pz] = P(a, s * 0.4); furniture(ctx, ib, 'labbench', px, fy, pz, faceIn(-s), 0, R); }
      }
    }
    if (f === 'tank') { const n = Math.max(1, Math.min(7, Math.floor((width * 2 - 2) / 2.3))); for (let k = 0; k < n; k++) { const [px, pz] = P(depth - 0.75, (k - (n - 1) / 2) * 2.3); furniture(ctx, ib, 'tank', px, fy, pz, faceDoor, 0, R); } }
    if (f === 'console') for (const s of [-1, 1]) { const [px, pz] = P(-depth + 0.45, s * (width - 1.6)); furniture(ctx, ib, 'console', px, fy, pz, faceDoor + Math.PI, 0, R); }
  }
  if (o.shop) {           // a counter facing the door, goods along the walls, the shopkeeper's spot
    const [cx2, cz2] = at(depth - 1.2, 0); furniture(ctx, ib, 'counter', cx2, fy, cz2, faceDoor, o.trimHex, R);
    if (o.shop === 'clothes') { for (const s of [-1, 1]) { const [px, pz] = at(depth * 0.1, s * (width - 0.55)); furniture(ctx, ib, 'rack', px, fy, pz, faceIn(s), 0, R); } const [mx2, mz2] = at(-depth + 0.4, width - 0.6); furniture(ctx, ib, 'mirror', mx2, fy, mz2, faceDoor + Math.PI, 0, R); }
    else for (const s of [-1, 1]) { const [px, pz] = at(depth * 0.1, s * (width - 0.3)); furniture(ctx, ib, 'shelf', px, fy, pz, faceIn(s), 0, R); }
    const [kx, kz] = at(depth - 0.55, 0);
    SHOP_SPOTS.push({ x: cx2, z: cz2, y: fy, kx, kz, ry: faceDoor, kind: o.shop, name: o.name || o.sign, bid: o.id, owner: ctx.S.id });
  } else if (o.loot !== false && (o.lootSure || R() < 0.55)) { const [px, pz] = at(depth * 0.55, -width * 0.4); LOOT_SPOTS.push({ x: px, y: fy, z: pz, kind: o.lootKind || 'home', bid: o.id, owner: ctx.S.id }); }
  Object.assign(o, { inner: { x0: x - hx + T, x1: x + hx - T, z0: z - hz + T, z1: z + hz - T } });
  return o;
}
/* buildings you cannot enter (apartment blocks, some houses): solid shells with windows, cheap */
function makeShell(ctx, o) {
  const { x, z, hx, hz } = o, st = o.st, R = o.R, b = ctx.at(x, z);
  const [lo, hi] = footprintO(o), floors = o.floors || 1, H1 = o.h || st.h || 3.2, fy = hi + 0.3 + (st.stilts || 0), top = fy + H1 * floors;
  o.wallC = C(o.wall); o.wallK = st.wallK; const trim = C(o.trim);
  Object.assign(o, { fy, top });
  if (st.stilts) { for (let i = -1; i <= 1; i += 2) for (let j = -1; j <= 1; j += 2) { const px = x + i * (hx - 0.2), pz = z + j * (hz - 0.2), g = terrainAt(px, pz); b.add(G.cyl8, M(px, (g - 0.5 + fy) / 2, pz, 0, 0.16, fy - g + 0.5, 0.16), 0x5a4430, K.wood); } }
  else b.box(x, (lo - 0.8 + fy) / 2, z, hx * 2 + 0.1, fy - lo + 0.8, hz * 2 + 0.1, st.baseC !== undefined ? C(st.baseC) : o.wallC.clone().multiplyScalar(0.72), 0, K.stone);
  b.box(x, (fy + top) / 2, z, hx * 2, top - fy, hz * 2, o.wallC, 0, o.wallK);
  for (let fl = 1; fl < floors; fl++) b.box(x, fy + fl * H1, z, hx * 2 + 0.16, 0.14, hz * 2 + 0.16, o.wallC.clone().multiplyScalar(0.86), 0, K.stone);
  ctx.col({ t: 'b', x, z, hx, hz, y0: lo - 1, y1: top + 0.5 });
  ctx.occ({ t: 'b', x, z, hx, hz, bot: lo - 1, top });
  for (const [k, [nx, nz]] of Object.entries(SIDE)) {
    const half = nx !== 0 ? hz : hx, n = Math.max(0, Math.floor((half * 2 - 1.2) / 2.6));
    for (let fl = 0; fl < floors; fl++) for (let i = 0; i < n; i++) {
      const t = -half + 0.6 + (half * 2 - 1.2) * (i + 0.5) / n;
      if (fl === 0 && k === o.door && Math.abs(t) < 1.3) continue;
      const px = x + nx * (hx + 0.005) + (nz !== 0 ? t : 0), pz = z + nz * (hz + 0.005) + (nx !== 0 ? t : 0);
      windowAt(ctx, b, px, fy + fl * H1 + 1.575, pz, nx, nz, 1.0, 1.25, trim, !st.ruin, R, st.wallK !== K.metal && !st.ruin);
      if (st.balcony && fl > 0 && R() < 0.12) { b.box(px + nx * 0.55, fy + fl * H1, pz + nz * 0.55, nz !== 0 ? 1.8 : 1.1, 0.12, nz !== 0 ? 1.1 : 1.8, 0xd8d0c0, 0, K.stone); b.box(px + nx * 1.05, fy + fl * H1 + 0.5, pz + nz * 1.05, nz !== 0 ? 1.8 : 0.05, 0.9, nz !== 0 ? 0.05 : 1.8, 0x2c3135, 0, K.metal); }
    }
    if (k === o.door) { const fx = x + nx * (hx + 0.03), fz = z + nz * (hz + 0.03); b.box(fx, fy + 1.15, fz, nz !== 0 ? 1.4 : 0.06, 2.3, nz !== 0 ? 0.06 : 1.4, trim, 0, K.wood); if (o.sign) ctx.signs.add(o.sign, fx, fy + 3.1, fz, nx, nz, Math.min(3.6, half * 1.3), 0.85); }
  }
  o.roofTop = roofOn(ctx, b, o, top);
  return o;
}

/* ── landmarks with their own shapes ── */
function makeSpecial(ctx, o) {
  const { x, z, hx, hz } = o, R = o.R, b = ctx.at(x, z), g = footprint(x, z, hx, hz)[1];
  if (o.kind === 'mosque') {
    o.furnish = ['rug']; o.floors = 1; o.h = 6; o.wall = 0xf4efe6; o.trim = 0x2f7d4c; o.roof = 'flat'; o.loot = false; o.floorC = 0x8a3a2e; o.tiles = true;
    makeBuilding(ctx, o);
    const top = o.top + 0.44;
    b.add(G.cyl14, M(x, top + 0.6, z, 0, hx * 0.62, 1.2, hz * 0.62), 0xf4efe6, K.plaster);
    b.add(G.dome, M(x, top + 1.2, z, 0, hx * 0.6, hx * 0.55, hz * 0.6), 0x3d8f88, K.metal);
    b.add(G.cone, M(x, top + 1.2 + hx * 0.55 + 0.6, z, 0, 0.12, 1.2, 0.12), 0xd8a838, K.metal);
    const mx = x + hx + 2.2, mz = z - hz + 2.2, mg = terrainAt(mx, mz);
    b.add(G.cyl8, M(mx, mg + 9, mz, 0, 1.2, 18, 1.2), 0xf1ece2, K.plaster); b.add(G.cyl14, M(mx, mg + 17.4, mz, 0, 1.6, 0.4, 1.6), 0xd8cdb8, K.stone);
    b.add(G.cyl8, M(mx, mg + 19.2, mz, 0, 0.9, 3.2, 0.9), 0xf1ece2, K.plaster); b.add(G.cone, M(mx, mg + 22, mz, 0, 1.0, 2.6, 1.0), 0x3d8f88, K.metal);
    ctx.col({ t: 'c', x: mx, z: mz, r: 1.3 }); ctx.occ({ t: 'c', x: mx, z: mz, r: 1.2, top: mg + 23 });
    ctx.light({ x: mx, y: mg + 17.8, z: mz, color: 0x9fe0c8, range: 22, kind: 'lamp' });
    return o;
  }
  if (o.kind === 'clocktower') {
    const X = x, Z = z, gg = g - 0.4;
    b.box(X, gg + 2.5, Z, 4.6, 5, 4.6, 0xd9cfbb, 0, K.stone); b.box(X, gg + 12, Z, 3.0, 14, 3.0, 0xe8dfcc, 0, K.plaster);
    for (const [nx, nz] of Object.values(SIDE)) {
      b.add(G.cyl14, M(X + nx * 1.52, gg + 16.6, Z + nz * 1.52, 0, 0.95, 0.06, 0.95, nz !== 0 ? Math.PI / 2 : 0, nx !== 0 ? Math.PI / 2 : 0), 0xfaf7ef, K.plain);
      b.box(X + nx * 1.6, gg + 16.85, Z + nz * 1.6, nx !== 0 ? 0.05 : 0.08, 0.6, nx !== 0 ? 0.08 : 0.05, 0x22262a, 0, K.metal);
      b.box(X + nx * 1.6 + (nz !== 0 ? 0.22 : 0), gg + 16.6, Z + nz * 1.6 + (nx !== 0 ? 0.22 : 0), nx !== 0 ? 0.05 : 0.45, 0.07, nx !== 0 ? 0.45 : 0.05, 0x22262a, 0, K.metal);
    }
    b.box(X, gg + 19.2, Z, 3.6, 0.4, 3.6, 0xd8c9a8, 0, K.stone); b.add(G.dome, M(X, gg + 19.4, Z, 0, 1.5, 1.6, 1.5), 0x3d7fa8, K.metal);
    b.add(G.cone, M(X, gg + 21.6, Z, 0, 0.16, 1.4, 0.16), 0xd8a838, K.metal);
    ctx.col({ t: 'b', x: X, z: Z, hx: 2.4, hz: 2.4 }); ctx.occ({ t: 'b', x: X, z: Z, hx: 2.3, hz: 2.3, top: gg + 21 });
    o.fy = g; o.top = gg + 21; o.noInside = true; return o;
  }
  if (o.kind === 'lighthouse') {
    const gg = terrainAt(x, z);
    for (let k = 0; k < 6; k++) b.add(G.cyl14, M(x, gg + 2.5 + k * 4.2, z, 0, 2.6 - k * 0.22, 4.2, 2.6 - k * 0.22), k % 2 ? 0xc9483a : 0xf4f1ea, K.plaster);
    const top = gg + 25.6;
    b.add(G.cyl14, M(x, top + 0.2, z, 0, 2.2, 0.4, 2.2), 0x2c3135, K.metal); b.add(G.cyl14, M(x, top + 1.4, z, 0, 1.3, 2.0, 1.3), 0x22262a, K.metal);
    ctx.lit.add(G.cyl14, M(x, top + 1.4, z, 0, 1.2, 1.6, 1.2), 0xffffff); b.add(G.cone, M(x, top + 3.0, z, 0, 1.5, 1.2, 1.5), 0xc9483a, K.metal);
    ctx.col({ t: 'c', x, z, r: 2.7 }); ctx.occ({ t: 'c', x, z, r: 2.6, top: top + 3 });
    ctx.light({ x, y: top + 1.4, z, color: 0xfff0c0, range: 60, kind: 'lamp' });
    LIGHTHOUSE.x = x; LIGHTHOUSE.z = z; LIGHTHOUSE.y = top + 1.4;
    o.fy = gg; o.top = top + 3; o.noInside = true; return o;
  }
  if (o.kind === 'silo') {
    b.add(G.cyl14, M(x, g + 7, z, 0, hx * 0.95, 14, hx * 0.95), 0xb8bcc0, K.metal); b.add(G.dome, M(x, g + 14, z, 0, hx * 0.95, 2.2, hx * 0.95), 0xa8acb0, K.metal);
    for (let k = 0; k < 14; k++) b.add(G.cyl14, M(x, g + 0.5 + k, z, 0, hx * 0.97, 0.06, hx * 0.97), 0x8a8e92, K.metal);
    ctx.col({ t: 'c', x, z, r: hx }); ctx.occ({ t: 'c', x, z, r: hx, top: g + 16 });
    o.fy = g; o.top = g + 16; o.noInside = true; return o;
  }
  if (o.kind === 'mineshaft') {
    // a timber headframe over a dark adit into the hill
    const gg = terrainAt(x, z);
    for (const [dx, dz] of [[-2.5, -2.5], [2.5, -2.5], [-2.5, 2.5], [2.5, 2.5]]) b.add(G.box, M(x + dx * 0.7, gg + 6, z + dz * 0.7, 0, 0.35, 12, 0.35, dz * 0.04, -dx * 0.04), 0x5a4430, K.wood);
    for (let y = 2; y < 12; y += 3) b.box(x, gg + y, z, 4.2, 0.25, 4.2, 0x6b4a2f, 0, K.wood);
    b.add(G.cyl14, M(x, gg + 12.4, z, 0, 1.4, 0.3, 1.4, Math.PI / 2), 0x3a3f44, K.metal);
    b.box(x, gg + 1.4, z + 4, 4.2, 2.8, 0.4, 0x4a3828, 0, K.wood); b.box(x, gg + 1.2, z + 4.05, 3.0, 2.4, 0.3, 0x0a0a0a, 0, K.plain);
    for (let k = 0; k < 8; k++) b.box(x + (k - 3.5) * 0.6, gg + 0.06, z + 6 + k * 0.2, 0.08, 0.06, 9, 0x55595e, 0, K.metal);
    ctx.col({ t: 'b', x, z, hx: 2.2, hz: 2.2 }); ctx.occ({ t: 'b', x, z, hx: 2.2, hz: 2.2, top: gg + 12 });
    MINE.x = x; MINE.z = z + 4;
    o.fy = gg; o.top = gg + 12; o.noInside = true; return o;
  }
  if (o.kind === 'hangar') {
    o.floors = 1; o.h = 8; o.roof = 'flat'; o.wall = 0x6f7560; o.trim = 0x3a3f44; o.doorW = 6; o.furnish = ['crates', 'crates']; o.lootKind = 'military'; o.tiles = true; o.floorC = 0x6a6a66;
    makeBuilding(ctx, o); const top = o.top;
    b.add(new THREE.CylinderGeometry(1, 1, 1, 16, 1, false, 0, Math.PI), M(x, top, z, o.hx > o.hz ? 0 : Math.PI / 2, o.hz, o.hx * 2, o.hz * 0.5, 0, Math.PI / 2), 0x7a806a, K.metal);
    return o;
  }
  if (o.kind === 'caravanserai') {
    // four wings around a courtyard with a well
    const wing = 5, W = o.hx;
    const wings = [[x, z - W + wing / 2, W, wing / 2, 's'], [x, z + W - wing / 2, W, wing / 2, 'n'], [x - W + wing / 2, z, wing / 2, W - wing, 'e'], [x + W - wing / 2, z, wing / 2, W - wing, 'w']];
    wings.forEach(([wx, wz, whx, whz, door], i) => {
      const w = Object.assign({}, o, { id: o.id + 'w' + i, x: wx, z: wz, hx: whx, hz: whz, door, floors: 1, h: 3.4, sign: i === 0 ? o.name : null, furnish: i % 2 ? ['rug', 'table'] : ['bed', 'rug'], ib: o.ib, R: RNG(o.seed + i) });
      makeBuilding(ctx, w);
    });
    const gg = terrainAt(x, z); b.add(G.cyl14, M(x, gg + 0.5, z, 0, 1.4, 1.0, 1.4), 0xb89a70, K.stone); b.add(G.cyl14, M(x, gg + 1.0, z, 0, 1.15, 0.05, 1.15), 0x1e3a40, K.plain);
    ctx.col({ t: 'c', x, z, r: 1.5 });
    o.fy = gg; o.top = gg + 4; o.inner = null; return o;
  }
  return null;
}

/* ── props ── */
function lampPost(ctx, x, z, ax, az, style) {
  if (ctx.S.kind === 'ruin') {       // the dead city: bent poles, no light
    const g = terrainAt(x, z), b = ctx.at(x, z); b.add(G.cyl8, M(x, g + 2.2, z, 0, 0.08, 4.4, 0.08, 0.25, 0.1), 0x3a3836, K.metal); return;
  }
  const g = terrainAt(x, z), b = ctx.at(x, z);
  if (style === 'post') {      // a wooden post with a lantern, for villages
    b.add(G.cyl8, M(x, g + 1.6, z, 0, 0.09, 3.2, 0.09), 0x4a3828, K.wood); b.box(x, g + 3.3, z, 0.3, 0.42, 0.3, 0x2c3135, 0, K.metal);
    ctx.bulbs.box(x, g + 3.25, z, 0.22, 0.28, 0.22, 0xffffff); ctx.col({ t: 'c', x, z, r: 0.15 });
    ctx.light({ x, y: g + 3.1, z, color: 0xffc070, range: 14, kind: 'lamp' }); return;
  }
  b.add(G.cyl8, M(x, g + 0.2, z, 0, 0.17, 0.4, 0.17), 0x2c3135, K.metal); b.add(G.cyl8, M(x, g + 2.3, z, 0, 0.07, 4.2, 0.07), 0x2c3135, K.metal);
  b.box(x + ax * 0.45, g + 4.35, z + az * 0.45, ax !== 0 ? 0.9 : 0.07, 0.07, az !== 0 ? 0.9 : 0.07, 0x2c3135, 0, K.metal);
  b.box(x + ax * 0.9, g + 4.25, z + az * 0.9, 0.42, 0.2, 0.42, 0x2c3135, 0, K.metal);
  ctx.bulbs.box(x + ax * 0.9, g + 4.12, z + az * 0.9, 0.3, 0.07, 0.3, 0xffffff);
  ctx.col({ t: 'c', x, z, r: 0.22 });
  ctx.light({ x: x + ax * 0.9, y: g + 3.9, z: z + az * 0.9, color: 0xffc98a, range: 18, kind: 'lamp' });
}
function boatGeo(hull, stripe, len = 5.6) {
  const b = new Builder();
  const hg = new THREE.BoxGeometry(2.2, 1.0, len, 2, 1, 4), hp = hg.attributes.position;
  for (let i = 0; i < hp.count; i++) { const zz = hp.getZ(i); if (zz > len * 0.18) hp.setX(i, hp.getX(i) * (1 - (zz - len * 0.18) / (len * 0.36) * 0.9)); if (hp.getY(i) < 0) hp.setX(i, hp.getX(i) * 0.68); }
  hg.computeVertexNormals(); b.add(hg, M(0, 0.15, 0), hull, K.wood); hg.dispose();
  b.box(0, 0.68, -0.6, 2.0, 0.08, len * 0.64, 0x9b7a52, 0, K.wood); b.box(0, 0.6, -len / 2 + 0.05, 2.25, 0.3, 0.12, stripe, 0, K.wood);
  b.box(0, 0.42, 0, 2.24, 0.12, len * 0.7, stripe, 0, K.wood);
  b.box(0, 1.25, -1.0, 1.3, 1.1, 1.5, 0xf1ece2, 0, K.wood); b.box(0, 1.86, -1.0, 1.5, 0.12, 1.7, stripe, 0, K.wood);
  for (const s of [-1, 1]) b.box(s * 0.66, 1.35, -1.0, 0.02, 0.45, 1.0, 0x1d2a30, 0, K.metal);
  b.add(G.cyl8, M(0, 2.4, 0.9, 0, 0.06, 3.4, 0.06), 0x5a4430, K.wood);
  b.add(G.dodec, M(0.5, 0.85, 1.2, 0, 0.45, 0.25, 0.5), 0x3a5a4a, K.fabric); b.add(G.torus, M(-0.7, 0.85, 1.4, 0, 0.25, 0.25, 0.25, Math.PI / 2), 0xd8582c, K.fabric);
  return b.geometry();
}
const BOAT_GEOS = [];
const MOORED = [];      // floating boats near you
const LIGHTHOUSE = { x: 0, z: 0, y: 0 }, MINE = { x: 0, z: 0 };
/* ── the water world: boardwalks on posts, floating decks, and ships whose decks you can walk ── */
function seaPost(b, x, z, top, r = 0.16) { const yb = Math.min(terrainAt(x, z), -0.5) - 0.6; if (yb < top - 0.2) b.add(G.cyl8, M(x, (yb + top) / 2, z, 0, r, top - yb, r), 0x4a3828, K.wood); }
function waterProp(ctx, p, R) {
  const b = ctx.at(p.x, p.z), pk = (arr) => arr[Math.floor(R() * arr.length)], Y = WALK_Y;
  if (p.kind === 'walk') {            // a boardwalk: planks across, posts down to the sea floor, rope rails
    const dx = p.x1 - p.x0, dz = p.z1 - p.z0, L = Math.hypot(dx, dz) || 1, ux = dx / L, uz = dz / L, hw = (p.w || 2.6) / 2, ry = Math.atan2(dx, dz);
    for (let t = 0.25; t < L; t += 0.55) b.add(G.box, M(p.x0 + ux * t, Y - 0.06, p.z0 + uz * t, ry, hw * 2, 0.1, 0.5), pk([0x8b6a46, 0x7f6040, 0x94704a, 0x87674a]), K.wood);
    for (let t = 0; t <= L; t += 3) for (const sd of [-1, 1]) {
      const px = p.x0 + ux * t + uz * sd * (hw - 0.1), pz = p.z0 + uz * t - ux * sd * (hw - 0.1);
      seaPost(b, px, pz, Y - 0.1, 0.12); b.add(G.cyl8, M(px, Y + 0.45, pz, 0, 0.05, 0.9, 0.05), 0x5a4430, K.wood);
    }
    for (const sd of [-1, 1]) b.add(G.box, M(p.x0 + dx / 2 + uz * sd * (hw - 0.1), Y + 0.88, p.z0 + dz / 2 - ux * sd * (hw - 0.1), ry, 0.05, 0.05, L), 0xb8a070, K.fabric);
    ctx.deck(p.x0, p.z0, Y, p.x1, p.z1, Y, hw);
    return;
  }
  if (p.kind === 'deck') {            // a square platform on posts: a market, a landing, a lookout
    const { x, z, hx, hz } = p;
    for (let t = -hx + 0.25; t < hx; t += 0.55) b.add(G.box, M(x + t, Y - 0.06, z, 0, 0.5, 0.1, hz * 2), pk([0x8b6a46, 0x7f6040, 0x94704a, 0x87674a]), K.wood);
    for (let i = -hx; i <= hx + 0.01; i += Math.max(2, hx / 2)) for (let j = -hz; j <= hz + 0.01; j += Math.max(2, hz / 2)) seaPost(b, x + i * 0.95, z + j * 0.95, Y - 0.1, 0.18);
    ctx.plat({ t: 'rect', x0: x - hx, x1: x + hx, z0: z - hz, z1: z + hz, y: Y });
    if (p.lamp !== false) { ctx.light({ x: x + hx - 0.6, y: Y + 3, z: z + hz - 0.6, color: 0xffc98a, range: 18, kind: 'lamp' }); b.add(G.cyl8, M(x + hx - 0.6, Y + 1.5, z + hz - 0.6, 0, 0.07, 3, 0.07), 0x2c3135, K.metal); ctx.bulbs.box(x + hx - 0.6, Y + 3.05, z + hz - 0.6, 0.3, 0.12, 0.3, 0xffffff); }
    if (p.crates) { furniture(ctx, b, 'crates', x - hx * 0.4, Y, z - hz * 0.4, R() * TAU, 0, R); LOOT_SPOTS.push({ x: x - hx * 0.4 + 1.2, y: Y, z: z - hz * 0.4, kind: p.loot || 'home', owner: ctx.S.id }); }
    return;
  }
  if (p.kind === 'ship') ship(ctx, b, p, R);
}
/* a ship at anchor, along x (ry 0) or z (ry π/2): a hull you cannot swim through, a deck you can walk, a gangway down to the sea */
function ship(ctx, b, p, R) {
  const war = !!p.war, L = p.len || (war ? 70 : 46), Bm = war ? 11 : 9, fb = war ? 4.6 : 3.6, dr = war ? 4.5 : 3.2, along = Math.abs(Math.sin(p.ry || 0)) < 0.5;
  const ax = along ? 1 : 0, az = along ? 0 : 1, ry = along ? Math.PI / 2 : 0, x = p.x, z = p.z, deckY = fb;
  const at = (u, v, y, sx, sy, sz, c, k, ry2 = ry) => b.add(G.box, M(x + ax * u + az * v, y, z + az * u - ax * v, ry2, sx, sy, sz), c, k);
  const hullC = war ? 0x6c747c : pk2(R, [0x2f4a6a, 0x8a2e26, 0x2b6a5a, 0x3a3a40]), redC = 0x7a2a22, deckC = war ? 0x8a9096 : 0x8b6a46;
  // the hull: a long box, a tapered bow and a rounded stern, a red waterline
  at(0, 0, (deckY - dr) / 2, Bm, deckY + dr, L * 0.82, hullC, K.metal);
  for (let k = 0; k < 4; k++) { const t = k / 4, w = Bm * (1 - t * 0.85), l = L * 0.045; at(L * 0.41 + l * (k + 0.5), 0, (deckY - dr) / 2 + t * 0.5, w, deckY + dr - t * 1.2, l + 0.05, hullC, K.metal); }
  at(-L * 0.41 - 1.2, 0, (deckY - dr) / 2 + 0.3, Bm * 0.92, deckY + dr - 0.6, 2.4, hullC, K.metal);
  at(0, 0, 0.15, Bm + 0.06, 0.6, L * 0.82 + 0.06, redC, K.metal);
  at(0, 0, deckY + 0.04, Bm - 0.3, 0.1, L * 0.86, deckC, war ? K.metal : K.wood);
  for (const sd of [-1, 1]) at(0, sd * (Bm / 2 - 0.08), deckY + 0.55, 0.08, 1.0, L * 0.8, war ? 0x4a5056 : 0xe8e2d6, K.metal);
  if (war) {
    // the bridge tower, the funnel, the mast with radar, and the guns
    at(-L * 0.08, 0, deckY + 3.2, Bm * 0.62, 6.4, L * 0.18, 0x7a828a, K.metal);
    at(-L * 0.08, 0, deckY + 5.6, Bm * 0.64, 0.9, L * 0.185, 0x1e2226, K.glass);
    at(-L * 0.08, 0, deckY + 7.5, Bm * 0.4, 2.6, L * 0.1, 0x7a828a, K.metal);
    b.add(G.cyl8, M(x - ax * L * 0.2, deckY + 5, z - az * L * 0.2, 0, 1.4, 6, 1.4), 0x5a6066, K.metal);
    b.add(G.cyl8, M(x - ax * L * 0.08, deckY + 12, z - az * L * 0.08, 0, 0.2, 9, 0.2), 0x4a5056, K.metal);
    b.add(G.box, M(x - ax * L * 0.08, deckY + 15.5, z - az * L * 0.08, ry, 3.2, 0.5, 0.12), 0xd8dde2, K.metal);
    for (const u of [L * 0.3, L * 0.18, -L * 0.33]) {
      b.add(G.cyl14, M(x + ax * u, deckY + 0.7, z + az * u, 0, 2.6, 1.3, 2.6), 0x6a7278, K.metal);
      at(u, 0, deckY + 1.6, 3.4, 1.4, 3.8, 0x737b82, K.metal);
      const dir = u > 0 ? 1 : -1;
      for (const sd of [-0.5, 0.5]) at(u + dir * 4.2, sd, deckY + 1.75, 0.34, 0.34, 6.2, 0x3e4448, K.metal);
    }
  } else {
    // a cargo or fishing ship: the wheelhouse aft, a mast, hatches and crates
    at(-L * 0.3, 0, deckY + 2.2, Bm * 0.7, 4.4, L * 0.16, 0xe8e2d6, K.metal);
    at(-L * 0.3, 0, deckY + 3.6, Bm * 0.72, 0.9, L * 0.165, 0x1e2226, K.glass);
    b.add(G.cyl8, M(x + ax * L * 0.1, deckY + 6, z + az * L * 0.1, 0, 0.18, 12, 0.18), 0x4a4038, K.metal);
    b.add(G.cyl8, M(x - ax * L * 0.38, deckY + 5.5, z - az * L * 0.38, 0, 0.6, 2.2, 0.6), 0x2a2a2a, K.metal);
    for (const u of [L * 0.22, -L * 0.02]) at(u, 0, deckY + 0.45, Bm * 0.5, 0.8, L * 0.12, 0x5a4a3a, K.wood);
    for (let k = 0; k < 5; k++) { const u = L * (0.05 + R() * 0.3), v = (R() - 0.5) * Bm * 0.5; furniture(ctx, b, 'crates', x + ax * u + az * v, deckY + 0.1, z + az * u - ax * v, R() * TAU, 0, R); }
    LOOT_SPOTS.push({ x: x + ax * L * 0.15, y: deckY + 0.1, z: z + az * L * 0.15, kind: 'home', owner: ctx.S.id });
  }
  // walkable: the deck, the hull keeps swimmers out, a gangway from the water up to the deck
  const hx = along ? L * 0.43 : Bm / 2, hz = along ? Bm / 2 : L * 0.43;
  ctx.plat({ t: 'rect', x0: x - hx, x1: x + hx, z0: z - hz, z1: z + hz, y: deckY + 0.1 });
  ctx.col({ t: 'b', x, z, hx: hx + 0.1, hz: hz + 0.1, y0: -dr - 2, y1: deckY - 0.35 });
  if (war) ctx.col({ t: 'b', x: x - ax * L * 0.08, z: z - az * L * 0.08, hx: along ? L * 0.09 : Bm * 0.31, hz: along ? Bm * 0.31 : L * 0.09, y0: deckY, y1: deckY + 9 });
  else ctx.col({ t: 'b', x: x - ax * L * 0.3, z: z - az * L * 0.3, hx: along ? L * 0.08 : Bm * 0.35, hz: along ? Bm * 0.35 : L * 0.08, y0: deckY, y1: deckY + 4.5 });
  const gw = 1.3, gl = 9, gu = L * 0.1, gx = x + ax * gu + az * (Bm / 2 + gl / 2), gz = z + az * gu - ax * (Bm / 2 + gl / 2);
  const ramp = along ? { t: 'ramp', axis: 'z', x0: gx - gw, x1: gx + gw, z0: z - Bm / 2 - gl, z1: z - Bm / 2, ya: 0.25, yb: deckY + 0.1 }
    : { t: 'ramp', axis: 'x', x0: x + Bm / 2, x1: x + Bm / 2 + gl, z0: gz - gw, z1: gz + gw, ya: deckY + 0.1, yb: 0.25 };
  ctx.plat(ramp);
  const steps = 14; for (let k = 0; k < steps; k++) { const t = (k + 0.5) / steps, y = lerp(0.25, deckY + 0.1, t); if (along) b.box(gx, y - 0.05, z - Bm / 2 - gl * (1 - t), gw * 2, 0.08, gl / steps + 0.05, 0x7a5a3c, 0, K.wood); else b.box(x + Bm / 2 + gl * (1 - t), y - 0.05, gz, gl / steps + 0.05, 0.08, gw * 2, 0x7a5a3c, 0, K.wood); }
  ctx.light({ x: x + ax * L * 0.38, y: deckY + 4, z: z + az * L * 0.38, color: 0xffd7a0, range: 22, kind: 'lamp' });
  SHIPS.push({ x, z, war, hx, hz, deckY, owner: ctx.S.id });
}
const SHIPS = [];
const pk2 = (R, arr) => arr[Math.floor(R() * arr.length)];
function prop(ctx, p, R) {
  if (p.kind === 'walk' || p.kind === 'deck' || p.kind === 'ship') { waterProp(ctx, p, R); return; }
  if (p.kind === 'rboat') return;      // a boat you can take: the vehicles bring it
  const b = ctx.at(p.x, p.z), g = terrainAt(p.x, p.z), pk = (arr) => arr[Math.floor(R() * arr.length)];
  if (p.kind === 'lamp') { lampPost(ctx, p.x, p.z, p.axis === 'x' ? 0 : (p.side || 1), p.axis === 'x' ? (p.side || 1) : 0, ctx.S.kind === 'city' ? 'street' : 'post'); return; }
  if (p.kind === 'fountain') {
    b.add(G.cyl14, M(p.x, g + 0.35, p.z, 0, 3.8, 1.0, 3.8), 0xcdbb98, K.stone); b.add(G.cyl14, M(p.x, g + 0.82, p.z, 0, 3.4, 0.06, 3.4), 0x2f7f7a, K.glass);
    b.add(G.cyl8, M(p.x, g + 1.8, p.z, 0, 0.45, 2.4, 0.45), 0xd9c9a6, K.stone); b.add(G.cyl14, M(p.x, g + 3.05, p.z, 0, 1.35, 0.3, 1.35), 0xd9c9a6, K.stone);
    b.add(G.dome, M(p.x, g + 3.2, p.z, 0, 0.6, 0.5, 0.6), 0x3f9f98, K.metal);
    ctx.col({ t: 'c', x: p.x, z: p.z, r: 4.1, y1: g + 3.5 }); return;
  }
  if (p.kind === 'stall') {
    const ry = p.ry, x = p.x, z = p.z, lx = (dx, dz) => x + Math.cos(ry) * dx + Math.sin(ry) * dz, lz = (dx, dz) => z - Math.sin(ry) * dx + Math.cos(ry) * dz;
    b.add(G.box, M(x, g + 0.45, z, ry, 2.6, 0.9, 1.3), 0x9a6e45, K.wood);
    for (const [dx, dz] of [[-1.25, -0.6], [1.25, -0.6], [-1.25, 0.6], [1.25, 0.6]]) b.add(G.cyl8, M(lx(dx, dz), g + 1.2, lz(dx, dz), 0, 0.06, 2.4, 0.06), 0x5a4430, K.wood);
    b.add(G.box, M(x, g + 2.45, z, ry, 3.0, 0.08, 1.9, 0.2), pk([0xc8553d, 0xe0a030, 0x2f8f8a, 0x3d4f8f]), K.fabric);
    for (let n = 0; n < 7; n++) b.add(G.sph, M(lx(-1.0 + n * 0.33, 0.1), g + 1.0, lz(-1.0 + n * 0.33, 0.1), 0, 0.14, 0.13, 0.14), pk([0xe8892b, 0x6a9a3a, 0xd9c35a, 0xb8443a]), K.fabric);
    ctx.col({ t: 'c', x, z, r: 1.6, y1: g + 2.5 }); return;
  }
  if (p.kind === 'pier') {
    const L = p.len || 60, W = (p.w || 5) / 2, c = Math.cos(p.ry || 0), s = Math.sin(p.ry || 0);
    // the pier runs from the shore out to sea along -z of its frame (south to north); find its direction from the terrain
    let dir = [0, -1], best = 1e9;
    for (const d of [[0, -1], [0, 1], [1, 0], [-1, 0]]) { const h = terrainAt(p.x + d[0] * L * 0.8, p.z + d[1] * L * 0.8); if (h < best) { best = h; dir = d; } }
    const x0 = p.x, z0 = p.z, x1 = p.x + dir[0] * L, z1 = p.z + dir[1] * L, y = 2.0;
    const along = dir[0] === 0;
    for (let t = 0.3; t < L; t += 0.62) { const px = x0 + dir[0] * t, pz = z0 + dir[1] * t; b.box(px, y - 0.06, pz, along ? W * 2 : 0.58, 0.12, along ? 0.58 : W * 2, pk([0x8b6a46, 0x7f6040, 0x94704a]), 0, K.wood); }
    for (let t = 0.5; t < L; t += 4) for (const sd of [-1, 1]) {
      const px = x0 + dir[0] * t + (along ? sd * (W - 0.2) : 0), pz = z0 + dir[1] * t + (along ? 0 : sd * (W - 0.2)), yb = terrainAt(px, pz) - 0.6;
      if (yb < y - 0.3) b.add(G.cyl8, M(px, (yb + y - 0.3) / 2, pz, 0, 0.22, y - 0.3 - yb, 0.22), 0x4a3828, K.wood);
    }
    ctx.deck(x0, z0, y, x1, z1, y, W);
    ctx.light({ x: x1 - dir[0] * 2, y: y + 3, z: z1 - dir[1] * 2, color: 0xffc98a, range: 16, kind: 'lamp' });
    b.add(G.cyl8, M(x1 - dir[0] * 2, y + 1.5, z1 - dir[1] * 2, 0, 0.07, 3, 0.07), 0x2c3135, K.metal); ctx.bulbs.box(x1 - dir[0] * 2, y + 3.05, z1 - dir[1] * 2, 0.3, 0.12, 0.3, 0xffffff);
    PIERS.push({ x0, z0, x1, z1, y, W, owner: ctx.S.id });
    return;
  }
  if (p.kind === 'boat') {
    if (!BOAT_GEOS.length) for (const [h, s] of [[0xf2efe8, 0x2f6a9a], [0x2b8c86, 0xf2efe8], [0xc8553d, 0xf6f1e8], [0xe0c26a, 0x2f6a9a], [0x3d7fa8, 0xf2efe8]]) BOAT_GEOS.push(boatGeo(h, s));
    const m = new THREE.Mesh(BOAT_GEOS[Math.floor(R() * BOAT_GEOS.length)], UBER); m.castShadow = true; m.receiveShadow = true; scene.add(m); ctx.meshes.push(m);
    const bt = { m, x: p.x, z: p.z, ry: p.ry || 0, ph: R() * 6, y: 0, rx: 0, rz: 0, owner: ctx.S.id };
    MOORED.push(bt); ctx.boats = (ctx.boats || []); ctx.boats.push(bt);
    bt.col = ctx.col({ t: 'c', x: p.x, z: p.z, r: 1.6, y1: 1.5 });
    return;
  }
  if (p.kind === 'watchtower') {
    for (const [dx, dz] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]]) b.add(G.box, M(p.x + dx, g + 4, p.z + dz, 0, 0.2, 8, 0.2), 0x5a4430, K.wood);
    b.box(p.x, g + 8, p.z, 3.6, 0.2, 3.6, 0x6b4a2f, 0, K.wood); for (const [dx, dz, sx, sz] of [[0, -1.75, 3.6, 0.1], [0, 1.75, 3.6, 0.1], [-1.75, 0, 0.1, 3.6], [1.75, 0, 0.1, 3.6]]) b.box(p.x + dx, g + 8.6, p.z + dz, sx, 1.0, sz, 0x6b4a2f, 0, K.wood);
    b.add(G.cone5, M(p.x, g + 10.3, p.z, Math.PI / 4, 2.9, 1.4, 2.9), 0x4a5038, K.fabric); b.add(G.cyl8, M(p.x, g + 9.3, p.z, 0, 0.05, 2.6, 0.05), 0x3a2a1e, K.wood);
    ctx.col({ t: 'b', x: p.x, z: p.z, hx: 1.6, hz: 1.6, y1: g + 8 }); ctx.plat({ t: 'rect', x0: p.x - 1.7, x1: p.x + 1.7, z0: p.z - 1.7, z1: p.z + 1.7, y: g + 8.1 });
    // a ladder you climb by walking into it
    ctx.plat({ t: 'ramp', axis: 'z', x0: p.x - 0.5, x1: p.x + 0.5, z0: p.z + 1.7, z1: p.z + 3.4, ya: g + 8.1, yb: g });
    for (let k = 0; k < 16; k++) b.box(p.x, g + 0.5 * k + 0.3, p.z + 3.4 - k * 0.106, 1.0, 0.06, 0.06, 0x5a4430, 0, K.wood);
    ctx.light({ x: p.x, y: g + 9.5, z: p.z, color: 0xfff0d0, range: 24, kind: 'lamp' });
    return;
  }
  if (p.kind === 'helipad') { b.add(G.cyl14, M(p.x, g + 0.08, p.z, 0, 9, 0.16, 9), 0x4a4d50, K.stone); b.add(G.torus, M(p.x, g + 0.17, p.z, 0, 7.5, 7.5, 0.4, Math.PI / 2), 0xe8e2d0, K.plain); for (const s of [-1, 1]) b.box(p.x + s * 2, g + 0.18, p.z, 0.6, 0.04, 5, 0xe8e2d0, 0, K.plain); b.box(p.x, g + 0.18, p.z, 3.4, 0.04, 0.6, 0xe8e2d0, 0, K.plain); return; }
  if (p.kind === 'tent') {
    const ry = p.ry || R() * TAU;
    b.add(new THREE.CylinderGeometry(0.01, 3.2, 2.6, 4, 1), M(p.x, g + 1.3, p.z, ry + Math.PI / 4, 1, 1, 1.4), 0x5a6044, K.fabric);
    ctx.col({ t: 'b', x: p.x, z: p.z, hx: 2, hz: 2, y1: g + 2.4 }); if (R() < 0.6) LOOT_SPOTS.push({ x: p.x, y: g, z: p.z + 2.4, kind: 'military', owner: ctx.S.id }); return;
  }
  if (p.kind === 'crates') { furniture(ctx, b, 'crates', p.x, g, p.z, R() * TAU, 0, R); if (R() < 0.5) LOOT_SPOTS.push({ x: p.x + 1.2, y: g, z: p.z, kind: 'military', owner: ctx.S.id }); return; }
}
const PIERS = [];
function bench(ctx, x, z, ry) {
  const g = terrainAt(x, z), b = ctx.at(x, z), c = Math.cos(ry), s = Math.sin(ry), L = (dx, dz) => [x + c * dx + s * dz, z - s * dx + c * dz];
  for (let k = 0; k < 4; k++) { const [px, pz] = L(0, -0.2 + k * 0.13); b.add(G.box, M(px, g + 0.48, pz, ry, 1.9, 0.04, 0.11), 0x8b5a33, K.wood); }
  for (let k = 0; k < 3; k++) { const [px, pz] = L(0, -0.3); b.add(G.box, M(px, g + 0.68 + k * 0.14, pz, ry, 1.9, 0.1, 0.035, -0.18), 0x8b5a33, K.wood); }
  for (const dx of [-0.8, 0.8]) { const [lx, lz] = L(dx, 0); b.add(G.box, M(lx, g + 0.24, lz, ry, 0.06, 0.48, 0.5), 0x2c3135, K.metal); }
  ctx.col({ t: 'c', x, z, r: 0.7, y1: g + 0.9 });
}

/* ── streets: paved ribbons with kerbs that follow the ground, squares as paved discs ── */
function streetRibbon(ctx, st) {
  const pts = st.pts, w = st.w / 2, city = ctx.S.kind === 'city';
  const col = st.kind === 'boulevard' ? 0x5d5e60 : city ? 0x66676a : ctx.S.kind === 'military' ? 0x6a6a66 : 0x8a7a62;
  for (let s = 0; s < pts.length - 1; s++) {
    const [x0, z0] = pts[s], [x1, z1] = pts[s + 1], L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.ceil(L / 3)), dx = (x1 - x0) / L, dz = (z1 - z0) / L;
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n, x = lerp(x0, x1, t), z = lerp(z0, z1, t), g = terrainAt(x, z), b = ctx.at(x, z);
      b.add(G.box, M(x, g + 0.02, z, Math.atan2(dx, dz), w * 2, 0.12, L / n + 0.05), col, K.stone);
      if (city) for (const sd of [-1, 1]) { const kx = x + dz * sd * (w + 0.9), kz = z - dx * sd * (w + 0.9); b.add(G.box, M(kx, terrainAt(kx, kz) + 0.1, kz, Math.atan2(dx, dz), 1.8, 0.2, L / n + 0.05), 0xb8b2a4, K.stone); }
      if (st.kind === 'boulevard' && k % 2 === 0) b.add(G.box, M(x, g + 0.085, z, Math.atan2(dx, dz), 0.14, 0.02, L / n * 0.5), 0xe8e2c8, K.plain);
    }
  }
}
function square(ctx, sq) {
  const b = ctx.at(sq.x, sq.z), g = terrainAt(sq.x, sq.z);
  b.add(G.cyl14, M(sq.x, g - 0.1, sq.z, 0, sq.r, 0.3, sq.r), sq.park ? 0x6a7a4a : 0xc9bda5, sq.park ? K.fabric : K.stone);
  if (!sq.park) b.add(G.cyl14, M(sq.x, g + 0.02, sq.z, 0, sq.r * 0.62, 0.08, sq.r * 0.62), 0xa99f8c, K.stone);
  if (sq.r > 12) for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.4, x = sq.x + Math.cos(a) * sq.r * 0.55, z = sq.z + Math.sin(a) * sq.r * 0.55; bench(ctx, x, z, Math.atan2(sq.x - x, sq.z - z)); }
}

/* ── the far view: every building as a simple block with its roof colour ── */
function farBlocks(S) {
  const b = new Builder();
  for (const o of S.buildings) {
    const st = STYLES[o.style] || STYLES.city, h = (o.floors || 1) * (st.h || 3.2), g = footprintO(o)[1] + 0.3 + (st.stilts || 0);
    const wall = C(o.wall || st.walls[0]), roofC = st.roof === 'flat' || st.roof === 'parapet' ? wall.clone().multiplyScalar(0.9) : C((st.roofC || [0x8a3a2a])[0]);
    if (o.kind === 'lighthouse') { b.add(G.cyl8, M(o.x, terrainAt(o.x, o.z) + 14, o.z, 0, 2.4, 28, 2.4), 0xe8e2d8, K.plaster); continue; }
    if (o.kind === 'silo') { b.add(G.cyl8, M(o.x, g + 7, o.z, 0, o.hx, 14, o.hx), 0xb8bcc0, K.metal); continue; }
    b.box(o.x, g + h / 2 - 1, o.z, o.hx * 2, h + 2, o.hz * 2, wall, 0, st.wallK);
    if (st.roof === 'pitched' || st.roof === 'steep' || st.roof === 'thatch') { const alongX = o.hx >= o.hz, span = alongX ? o.hz : o.hx, rise = span * (st.roof === 'steep' ? 1 : 0.65); b.add(G.cyl3, M(o.x, g + h + rise / 3, o.z, alongX ? Math.PI / 2 : 0, span * 1.15, alongX ? o.hx * 2 + 0.4 : o.hz * 2 + 0.4, rise / 1.5, -Math.PI / 2, 0), st.snow ? 0xe8ecf0 : roofC, K.stone); }
    else b.box(o.x, g + h + 0.3, o.z, o.hx * 2 + 0.3, 0.6, o.hz * 2 + 0.3, roofC, 0, K.stone);
    if (o.kind === 'mosque') b.add(G.cyl8, M(o.x + o.hx + 2.2, g + 10, o.z - o.hz + 2.2, 0, 1.2, 22, 1.2), 0xf1ece2, K.plaster);
  }
  if (b.empty) return null;
  const m = b.mesh(UBER, false); m.receiveShadow = false; return m;
}

/* ── settlement records and streaming ── */
const SETTLEMENTS = [];
const TOWN_R_IN = qsel(650, 900, 1100, 1300), TOWN_R_OUT = TOWN_R_IN + 350;
function initSettlements() {
  const W = WORLD.data, texts = [];
  for (const s of W.settlements) for (const o of s.buildings) { if (o.sign) texts.push(o.sign); }
  initSigns(texts);
  for (const s of W.settlements) {
    const S = { id: s.id, name: s.name, kind: s.kind, x: s.x, z: s.z, r: s.r || 60, src: s, buildings: s.buildings, state: 'far', ctx: null, job: null, far: null };
    s.buildings.forEach((o, i) => { o.id = s.id + ':' + i; o.st = STYLES[o.style] || STYLES.city;
      if (o.st.ruin) { o.wall = o.st.walls[(o.seed || i) % o.st.walls.length]; o.trim = [0x4a443c, 0x3a3631, 0x5a5048][((o.seed || i) >> 2) % 3]; }   // the dead city: soot-grey walls, dull frames
      if (!o.wall) o.wall = o.st.walls[(o.seed || i) % o.st.walls.length]; if (!o.trim) o.trim = TRIMS[(o.seed || i) % TRIMS.length]; if (!o.roofC) o.roofC = (o.st.roofC || [0x8a3a2a])[((o.seed || i) >> 3) % (o.st.roofC || [0]).length]; BUILDINGS.push(o); BGRID.insert(o, o.x - o.hx, o.z - o.hz, o.x + o.hx, o.z + o.hz); o.settlement = S; });
    S.far = farBlocks(S); if (S.far) scene.add(S.far);
    SETTLEMENTS.push(S);
  }
}
function* buildJob(S) {
  const ctx = S.ctx = new Ctx(S), src = S.src;
  if (src.poi && typeof poiBuild === 'function') { poiBuild(ctx, src.poi); yield; }
  for (const st of src.streets || []) { streetRibbon(ctx, st); yield; }
  for (const sq of src.squares || []) square(ctx, sq);
  if (src.fence) {           // the base: a chain-link fence with a gate
    const f = src.fence, gate = f.gate;
    for (const [nx, nz] of Object.values(SIDE)) {
      const along = nz !== 0, half = along ? f.hx : f.hz, cx = f.x + nx * f.hx, cz = f.z + nz * f.hz;
      for (let t = -half; t < half; t += 3) {
        const isGate = (SIDE[gate][0] === nx && SIDE[gate][1] === nz) && Math.abs(t + 1.5) < 6; if (isGate) continue;
        const px = cx + (along ? t + 1.5 : 0), pz = cz + (along ? 0 : t + 1.5), g = terrainAt(px, pz), b = ctx.at(px, pz);
        b.box(px, g + 1.2, pz, along ? 3 : 0.04, 2.4, along ? 0.04 : 3, 0x8a8f94, 0, K.metal);
        b.add(G.cyl8, M(px - (along ? 1.5 : 0), g + 1.3, pz - (along ? 0 : 1.5), 0, 0.05, 2.6, 0.05), 0x55595e, K.metal);
        ctx.col({ t: 'b', x: px, z: pz, hx: along ? 1.5 : 0.1, hz: along ? 0.1 : 1.5, y1: g + 2.4 });
      }
    }
    yield;
  }
  const R0 = RNG(S.id.length * 977 + 13);
  for (const o of S.buildings) {
    o.R = RNG(o.seed || 7); o.ib = new Builder();
    const enter = o.enter !== false;
    if (o.shop) { o.furnish = []; o.loot = false; o.tiles = true; o.floorC = 0xb8b2a4; o.trimHex = o.trim; }
    if (o.kind === 'shopfront') { o.shopfront = true; if (!o.st.ruin) o.awning = [0xc8553d, 0xe0a030, 0x2f8f8a, 0x3d4f8f][(o.seed || 0) % 4]; }
    if (o.kind === 'police' || o.kind === 'hq') o.furnish = ['desk', 'shelf', 'table'];
    if (o.kind === 'clinic') { o.furnish = ['bed', 'shelf', 'desk']; o.lootKind = 'med'; }
    if (o.kind === 'barracks') { o.furnish = ['bed', 'crates', 'shelf']; o.lootKind = 'military'; }
    if (o.kind === 'hq' && o.armory) o.lootKind = 'armory';
    if (o.lab) { o.furnish = ['labbench', 'tank', 'console']; o.lootKind = 'armory'; o.lootSure = true; }   // the sunken labs of the continent
    if (o.kind === 'warehouse' || o.kind === 'fishmarket') { o.furnish = ['crates', 'shelf']; o.h = 4.4; o.doorW = 2.6; o.floors = 1; }
    if (o.kind === 'barn') { o.furnish = ['hay', 'crates']; o.h = 5.5; o.floors = 1; o.doorW = 3.2; o.roof = 'pitched'; o.wall = 0x9a3e2c; o.lootKind = 'farm'; }
    if (o.kind === 'lodge' || o.kind === 'hotel') o.furnish = ['sofa', 'table', 'rug', 'shelf'];
    if (o.kind === 'apartment' && (o.floors || 1) < 3) o.floors = 3 + (o.seed % 3);
    const special = makeSpecial(ctx, o);
    if (!special) { if (enter) makeBuilding(ctx, o); else makeShell(ctx, o); }
    if (!o.ib.empty) { const m = o.ib.mesh(UBER_IN, QUALITY.shadows); m.visible = false; m.userData.bx = o.x; m.userData.bz = o.z; m.userData.br = Math.max(o.hx, o.hz) + 30; ctx.inter.push(m); scene.add(m); }
    o.ib = null;
    yield;
  }
  for (const p of src.props || []) prop(ctx, p, R0);
  yield;
  // merge into meshes
  for (const b of ctx.ext.values()) if (!b.empty) { const m = b.mesh(UBER, QUALITY.shadows); scene.add(m); ctx.meshes.push(m); }
  for (const [bb, mat, sh] of [[ctx.glass, GLASS_MAT, false], [ctx.lit, WINDOW_LIT_MAT, false], [ctx.bulbs, BULB_MAT, false], [ctx.glow, GLOW_MAT, false]]) if (!bb.empty) { const m = bb.mesh(mat, sh); m.castShadow = false; if (mat === GLASS_MAT) m.renderOrder = 3; scene.add(m); ctx.meshes.push(m); }
  const sm = ctx.signs.mesh(); if (sm) { scene.add(sm); ctx.meshes.push(sm); }
  ctx.ext.clear(); ctx.glass = ctx.lit = ctx.bulbs = ctx.glow = null;
}
function unloadSettlement(S) {
  const ctx = S.ctx; if (!ctx) return;
  for (const m of [...ctx.meshes, ...ctx.inter]) { scene.remove(m); if (!BOAT_GEOS.includes(m.geometry)) m.geometry.dispose(); }
  for (const c of ctx.cols) removeCollider(c);
  for (const p of ctx.plats) removePlatform(p);
  for (const o of ctx.occs) removeOccluder(o);
  for (const a of ctx.anchors) { const i = LIGHT_ANCHORS.indexOf(a); if (i >= 0) LIGHT_ANCHORS.splice(i, 1); }
  for (let i = MOORED.length - 1; i >= 0; i--) if (MOORED[i].owner === S.id) MOORED.splice(i, 1);
  for (const L of [LOOT_SPOTS, SHOP_SPOTS, PIERS, SHIPS]) for (let i = L.length - 1; i >= 0; i--) if (L[i].owner === S.id) L.splice(i, 1);
  if (typeof onSettlementUnload === 'function') onSettlementUnload(S);
  S.ctx = null; S.state = 'far'; if (S.far) S.far.visible = true;
}
let townT = 0;
function updateSettlements(dt, cx, cz, force) {
  townT -= dt;
  if (force || townT <= 0) {
    townT = 1;
    for (const S of SETTLEMENTS) {
      const d = Math.hypot(S.x - cx, S.z - cz) - S.r;
      if (S.state === 'far' && d < TOWN_R_IN) { S.state = 'building'; S.job = buildJob(S); S.dist = d; }
      else if (S.state === 'near' && d > TOWN_R_OUT) unloadSettlement(S);
      else S.dist = d;
    }
  }
  // keep building whatever is in progress (nearest first), within a time budget
  const t0 = nowMs(), budget = force ? 1e9 : 4;
  const jobs = SETTLEMENTS.filter((S) => S.state === 'building').sort((a, b) => a.dist - b.dist);
  for (const S of jobs) {
    while (nowMs() - t0 < budget) { let r; try { r = S.job.next(); } catch (e) { console.warn('town build', S.id, e); r = { done: true }; } if (r.done) { S.state = 'near'; S.job = null; if (S.far) S.far.visible = false; if (typeof onSettlementReady === 'function') onSettlementReady(S); break; } }
    if (nowMs() - t0 >= budget) break;
  }
  interiorsVisible(cx, cz);
}
function interiorsVisible(cx, cz) {
  for (const S of SETTLEMENTS) { if (!S.ctx) continue; for (const m of S.ctx.inter) { const u = m.userData; m.visible = Math.abs(u.bx - cx) < u.br && Math.abs(u.bz - cz) < u.br; } }
}
/* which building is the point inside of */
function buildingAt(x, z, y) {
  const a = BGRID.at(x, z); if (!a) return null;
  for (const o of a) { const r = o.inner; if (r && x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1 && (o.top === undefined || (y < o.top - 0.2 && y > o.fy - 1.5))) return o; }
  return null;
}
/* floating boats near you */
function floatBody(b, t, dt, len = 4.8, wid = 2.0) {
  const cy = Math.cos(b.ry), sy = Math.sin(b.ry), at = (lx, lz) => waveY(b.x + lx * cy + lz * sy, b.z - lx * sy + lz * cy, t);
  const hb = at(0, len / 2), hs = at(0, -len / 2), hp = at(-wid / 2, 0), hst = at(wid / 2, 0);
  b.y = damp(b.y, (hb + hs + hp + hst) / 4 - 0.12, 3, dt);
  b.rx = damp(b.rx, Math.atan2(hs - hb, len), 2.4, dt);
  b.rz = damp(b.rz, Math.atan2(hst - hp, wid) * 0.8, 2.4, dt);
}
UPDATERS.push((t, dt) => {
  for (const b of MOORED) { floatBody(b, t, dt); b.m.position.set(b.x + Math.sin(t * 0.3 + b.ph) * 0.15, b.y, b.z); b.m.rotation.set(b.rx, b.ry + Math.sin(t * 0.25 + b.ph) * 0.05, b.rz, 'YXZ'); }
});
