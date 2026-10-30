/* ═════════ building: foundations, walls, floors, roofs and stairs that snap to a 3 m grid and stack up to four storeys;
   furniture, work stations, lamps and decorations placed by hand; farm plots and saplings; stashes, doors and gates ═════════ */
const BUILD = { it: null, ghost: null, ok: false, why: '', x: 0, y: 0, z: 0, ry: 0, turn: 0, latch: true, plan: null };
const BUILT = [], SLOTS = new Map(), PLOTS = [], PLANTED = [];
let builtUid = 1;
const BMAT_K = { wood: K.wood, log: K.wood, stone: K.stone, brick: K.stone, adobe: K.plaster, metal: K.metal, concrete: K.plaster };
const GHOST = new THREE.MeshBasicMaterial({ color: C(0x7fe08a), transparent: true, opacity: 0.32, depthWrite: false });
const GHOST_EDGE = new THREE.LineBasicMaterial({ color: C(0xd8ffd8), transparent: true, opacity: 0.85 });
const FIRE_MAT = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 1.3, 0.35), transparent: true, opacity: 0.92, depthWrite: false });
const shadeC = (hex, k) => { const c = C(hex).clone(); c.r *= k; c.g *= k; c.b *= k; return c; };
const EDGE_OF = { n: [0, -1], e: [1, 0], s: [0, 1], w: [-1, 0] };
const EDGE_ORDER = ['n', 'e', 's', 'w'];
const EDGE_PIECES = new Set(['wall', 'wall_door', 'wall_window', 'half_wall', 'fence', 'gate']);
/* canonical edge: every shared edge is stored once, as the north or west edge of a cell */
function canonEdge(i, j, e) { if (e === 's') return [i, j + 1, 'n']; if (e === 'e') return [i + 1, j, 'w']; return [i, j, e]; }
const cellC = (i) => i * 3 + 1.5;
function edgeCenter(i, j, e) { return e === 'n' ? [cellC(i), j * 3, true] : [i * 3, cellC(j), false]; }
/* the floor height of a structure at a cell: its foundation, a neighbour's, or the ground */
function baseY(i, j) {
  const f = SLOTS.get('F,' + i + ',' + j); if (f) return f.y;
  for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) { const g = SLOTS.get('F,' + (i + a) + ',' + (j + b)); if (g) return g.y; }
  return null;
}
function groundBase(x, z) { return terrainAt(x, z) + 0.02; }

/* ── geometry of the pieces ── */
const LOG_CYL = new THREE.CylinderGeometry(1, 1, 1, 8);
function wallBoxes(b, k, col, ex, ez, along, y, parts, mat) {
  // parts: [[u0, u1, y0, y1]] in wall-local units (u along the wall from -1.5 to 1.5)
  for (const [u0, u1, a, c] of parts) {
    const u = (u0 + u1) / 2, L = u1 - u0, h = c - a;
    if (mat === 'log') {
      for (let yy = a; yy < c - 0.05; yy += 0.3) { const r = 0.16; b.add(LOG_CYL, M(ex + (along ? u : 0), y + yy + 0.15, ez + (along ? 0 : u), 0, r, L + (L > 2.9 ? 0.25 : 0), r, along ? 0 : Math.PI / 2, along ? Math.PI / 2 : 0), shadeC(col, 0.92 + ((yy * 7) % 3) * 0.04), k); }
    } else b.box(ex + (along ? u : 0), y + a + h / 2, ez + (along ? 0 : u), along ? L : 0.2, h, along ? 0.2 : L, col, 0, k);
  }
}
function drawPiece(r, b, gb) {
  const it = ITEMS[r.id]; if (!it || !it.build) return;
  const P = it.build, col = shadeC(P.color, 0.94 + hash(r.i * 3 + r.L, r.j * 5) * 0.12), k = BMAT_K[P.mat] || K.wood, cx = cellC(r.i), cz = cellC(r.j), y = r.y, piece = P.piece;
  if (piece === 'foundation') { b.box(cx, (y + r.bot) / 2, cz, 3, Math.max(0.2, y - r.bot), 3, shadeC(P.color, 0.8), 0, k); b.box(cx, y - 0.04, cz, 3.04, 0.08, 3.04, col, 0, k); return; }
  if (piece === 'floor') { b.box(cx, y - 0.1, cz, 3, 0.2, 3, col, 0, k); return; }
  if (piece === 'roof') { b.box(cx, y - 0.12, cz, 3.24, 0.24, 3.24, col, 0, k); return; }
  if (piece === 'roof_slope') { b.add(G.box, M(cx, y + 0.75, cz, r.ry, 3.12, 0.2, 3.4, -0.4636), col, k); return; }
  if (piece === 'stairs') {
    const s = Math.sin(r.ry), c = Math.cos(r.ry);
    for (let q = 0; q < 10; q++) { const lz = -1.35 + q * 0.3, h = (q + 1) * 0.3; b.add(G.box, M(cx + s * lz, y + h / 2, cz + c * lz, r.ry, 1.4, h, 0.3), q % 2 ? col : shadeC(P.color, 0.88), k); }
    return;
  }
  if (piece === 'pillar') { b.box(r.px, y + 1.5, r.pz, 0.32, 3, 0.32, col, 0, k); return; }
  const [ex, ez, along] = edgeCenter(r.i, r.j, r.e);
  if (piece === 'wall') wallBoxes(b, k, col, ex, ez, along, y, [[-1.5, 1.5, 0, 3]], P.mat);
  else if (piece === 'half_wall') wallBoxes(b, k, col, ex, ez, along, y, [[-1.5, 1.5, 0, 1.5]], P.mat);
  else if (piece === 'wall_window') {
    wallBoxes(b, k, col, ex, ez, along, y, [[-1.5, 1.5, 0, 1.0], [-1.5, 1.5, 2.2, 3], [-1.5, -0.6, 1.0, 2.2], [0.6, 1.5, 1.0, 2.2]], P.mat);
    b.box(ex, y + 0.98, ez, along ? 1.3 : 0.32, 0.06, along ? 0.32 : 1.3, shadeC(P.color, 0.7), 0, k);
    if (SLOTS.get('G,' + r.i + ',' + r.j + ',' + r.L + ',' + r.e)) gb.box(ex, y + 1.6, ez, along ? 1.2 : 0.03, 1.2, along ? 0.03 : 1.2, 0xffffff, 0, K.glass);
  } else if (piece === 'wall_door') wallBoxes(b, k, col, ex, ez, along, y, [[-1.5, -0.55, 0, 3], [0.55, 1.5, 0, 3], [-0.55, 0.55, 2.2, 3]], P.mat);
  else if (piece === 'fence' || piece === 'gate') {
    for (const u of piece === 'gate' ? [-1.45, 1.45] : [-1.45, 0, 1.45]) b.box(ex + (along ? u : 0), y + 0.6, ez + (along ? 0 : u), 0.14, 1.25, 0.14, shadeC(P.color, 0.8), 0, k);
    if (piece === 'fence') for (const hy of [0.45, 0.95]) b.box(ex, y + hy, ez, along ? 3 : 0.06, 0.1, along ? 0.06 : 3, col, 0, k);
    else gateLeaf(b, k, col, ex, ez, along, y, r.open, 2.7, 1.05);
  } else if (piece === 'door') {
    gateLeaf(b, k, col, ex, ez, along, y, r.open, 1.06, 2.16, true);
  } else if (piece === 'window') { /* the glass itself is drawn by its wall */ }
}
function gateLeaf(b, k, col, ex, ez, along, y, open, w, h, door) {
  // hinge at one end of the opening; the leaf swings a quarter turn when open
  const hx = along ? ex - w / 2 : ex, hz = along ? ez : ez - w / 2, th = (along ? 0 : -Math.PI / 2) + (open ? -Math.PI / 2 : 0);
  const dx = Math.cos(th), dz = -Math.sin(th), cx = hx + dx * w / 2, cz = hz + dz * w / 2;
  if (door) { b.add(G.box, M(cx, y + h / 2, cz, th, w, h, 0.06), col, k); b.add(G.box, M(hx + dx * w * 0.88, y + 1.05, hz + dz * w * 0.88, th, 0.04, 0.12, 0.14), 0xb8b2a4, K.metal); }
  else for (const hy of [0.3, 0.7, 1.0]) b.add(G.box, M(cx, y + hy, cz, th, w, 0.1, 0.05), col, k);
}

/* ── placed things: stations, furniture, lamps, decorations, farm buildings ── */
const FOOT = {
  workbench: [0.9, 1.0], gunbench: [0.9, 1.0], furnace: [0.8, 1.7], anvil: [0.5, 0.8], loom: [0.8, 1.8], tailor: [0.8, 1.1], campfire: [0.8, 0.5], stove: [0.6, 1.4], bed: [1.1, 0.8], sleeping_bag: [0.9, 0.2],
  chair: [0.35, 0.9], stool: [0.25, 0.5], bench: [0.8, 0.5], table: [0.9, 0.8], desk: [0.9, 1.0], sofa: [1.0, 0.9], wardrobe: [0.7, 2.0], shelf: [0.6, 1.9], chest_small: [0.45, 0.5], chest_big: [0.7, 0.7],
  barrel: [0.4, 1.0], crate: [0.45, 0.8], cabinet: [0.6, 0.9], rug_small: [0.9, 0.02], mirror: [0.4, 1.8], clock: [0.3, 2.0], bookcase: [0.6, 2.0], lantern: [0.3, 1.6], candle: [0.15, 0.3], oil_lamp: [0.2, 0.4],
  street_lamp: [0.25, 4.2], fireplace: [1.0, 1.6], torch_wall: [0.2, 1.8], pot: [0.25, 0.6], rug: [1.1, 0.02], banner: [0.3, 2.4], curtain: [0.8, 2.2], cushion: [0.3, 0.2], statue_lion: [0.8, 1.6], statue_horse: [0.8, 1.9],
  statue_eagle: [0.6, 1.8], fountain: [1.6, 1.6], vase: [0.25, 0.6], amphora: [0.3, 0.8], globe: [0.35, 1.1], chandelier: [0.5, 2.6], wind_chime: [0.25, 2.0], flag_pole: [0.25, 6], snowman: [0.6, 1.7], sandcastle: [0.8, 0.9],
  painting_sea: [0.5, 1.6], painting_desert: [0.5, 1.6], painting_forest: [0.5, 1.6], painting_city: [0.5, 1.6], scarecrow: [0.5, 2.0], planter: [1.2, 0.5], beehive: [0.5, 1.0], coop: [1.2, 1.8], well: [1.1, 2.4],
  compost: [0.7, 1.0], trough: [1.1, 0.6], fence: [1.5, 1.1], cart: [0.8, 0.9],
};
const STORE_CAP = { chest_small: 60, chest_big: 160, barrel: 80, crate: 50, cabinet: 70, cart: 120 };
const PRODUCE = { coop: ['egg', 180, 6, 'اجمع البيض'], beehive: ['honey', 240, 4, 'اجمع العسل'], compost: ['fertilizer', 300, 3, 'خذ السماد'] };
function placeKind(it) { return it.place ? it.place.kind : it.vehicle === 'cart' ? 'cart' : null; }
function drawPlace(r, b, gb, lb, fb) {
  const it = ITEMS[r.id]; if (!it) return;
  const kind = placeKind(it), x = r.x, y = r.y, z = r.z, ry = r.ry, cs = Math.cos(ry), sn = Math.sin(ry);
  const L = (a, c) => [x + cs * a + sn * c, z - sn * a + cs * c];
  const P = (geo, a, yy, c, sx, sy, sz, col, k = K.wood, rx = 0, rz = 0, B = b) => { const [px, pz] = L(a, c); B.add(geo, M(px, y + yy, pz, ry, sx, sy, sz, rx, rz), col, k); };
  const col = (it.place && it.place.color) || it.color || 0x8a6a45, W = 0x6b4a2f, D = 0x3a2a1e, ST = 0x8d8478, MT = 0x55595e;
  const fake = { col: () => null };
  switch (kind) {
    case 'workbench': P(G.box, 0, 0.88, 0, 1.7, 0.08, 0.8, 0x9a7650); for (const [a, c] of [[-0.75, -0.32], [0.75, -0.32], [-0.75, 0.32], [0.75, 0.32]]) P(G.box, a, 0.43, c, 0.08, 0.86, 0.08, W); P(G.box, 0, 0.3, 0, 1.5, 0.05, 0.7, W); P(G.box, 0.6, 1.0, -0.2, 0.18, 0.16, 0.14, MT, K.metal); P(G.box, -0.4, 0.94, 0.1, 0.5, 0.04, 0.12, 0xb8b2a4, K.metal); P(G.cyl8, -0.1, 0.95, -0.2, 0.03, 0.12, 0.03, 0x2a1d14); break;
    case 'furnace': P(G.box, 0, 0.7, 0, 1.3, 1.4, 1.2, ST, K.stone); P(G.box, 0, 1.6, -0.2, 0.45, 0.6, 0.45, shadeC(ST, 0.8), K.stone); P(G.box, 0, 0.45, 0.61, 0.5, 0.42, 0.02, 0x1a1210, K.stone); P(G.box, 0, 0.42, 0.6, 0.38, 0.28, 0.04, 0xffffff, K.plain, 0, 0, fb); break;
    case 'gunbench': {
      // a steel bench with a vice, a pegboard of tools and a rifle half-built on it
      P(G.box, 0, 0.9, 0, 1.8, 0.07, 0.85, 0x5a5e62, K.metal); for (const [a, c] of [[-0.82, -0.36], [0.82, -0.36], [-0.82, 0.36], [0.82, 0.36]]) P(G.box, a, 0.44, c, 0.07, 0.88, 0.07, 0x2e3236, K.metal);
      P(G.box, 0, 0.32, 0, 1.6, 0.04, 0.75, 0x3a3e42, K.metal); P(G.box, 0, 1.55, -0.42, 1.8, 1.2, 0.04, 0x6a5a44, K.wood);
      for (let q = 0; q < 6; q++) P(G.box, -0.7 + q * 0.28, 1.6 + (q % 2) * 0.15, -0.38, 0.04, 0.3, 0.03, 0x2a2c2e, K.metal);
      P(G.box, 0.65, 1.0, 0.1, 0.2, 0.14, 0.16, 0x2e5a8a, K.metal); P(G.box, -0.2, 0.96, 0.12, 0.9, 0.05, 0.07, 0x1d1f20, K.metal); P(G.box, -0.45, 0.96, 0.12, 0.28, 0.07, 0.08, 0x6e4428, K.wood); P(G.box, 0.05, 0.92, 0.18, 0.05, 0.1, 0.03, 0x1d1f20, K.metal);
      break;
    }
    case 'anvil': P(G.cyl8, 0, 0.3, 0, 0.32, 0.6, 0.32, W); P(G.box, 0, 0.7, 0, 0.25, 0.2, 0.62, MT, K.metal); P(G.cone, 0, 0.7, 0.42, 0.1, 0.25, 0.1, MT, K.metal, Math.PI / 2); break;
    case 'loom': for (const a of [-0.7, 0.7]) P(G.box, a, 0.9, 0, 0.08, 1.8, 0.08, W); P(G.box, 0, 1.75, 0, 1.5, 0.08, 0.1, W); P(G.box, 0, 0.6, 0, 1.4, 0.08, 0.5, W); P(G.box, 0, 1.15, 0, 1.3, 1.1, 0.01, 0xd8d0c0, K.fabric); break;
    case 'tailor': P(G.box, 0, 0.78, 0, 1.4, 0.06, 0.7, 0x9a7650); for (const [a, c] of [[-0.6, -0.28], [0.6, -0.28], [-0.6, 0.28], [0.6, 0.28]]) P(G.box, a, 0.38, c, 0.06, 0.76, 0.06, W); P(G.box, 0.2, 0.95, 0, 0.45, 0.28, 0.18, 0x2a2a2a, K.metal); P(G.box, -0.35, 0.83, 0.05, 0.4, 0.04, 0.3, 0x8a3a3a, K.fabric); break;
    case 'campfire': for (let q = 0; q < 9; q++) { const a = q / 9 * TAU; P(G.ico, Math.cos(a) * 0.62, 0.08, Math.sin(a) * 0.62, 0.17, 0.12, 0.14, ST, K.stone); } for (let q = 0; q < 4; q++) P(LOG_CYL, 0, 0.14, 0, 0.07, 0.95, 0.07, 0x4a3424, K.wood, Math.PI / 2 - 0.4, q * Math.PI / 4); for (const [a, c, h] of [[0, 0, 0.7], [0.12, 0.06, 0.45], [-0.1, -0.08, 0.5]]) P(G.cone, a, 0.25 + h / 2, c, 0.16, h, 0.16, 0xffffff, K.plain, 0, 0, fb); break;
    case 'stove': P(G.box, 0, 0.45, 0, 0.9, 0.9, 0.6, 0x3a3a3a, K.metal); P(G.cyl8, 0.25, 1.15, -0.15, 0.08, 1.0, 0.08, MT, K.metal); P(G.box, 0, 0.4, 0.31, 0.3, 0.2, 0.02, 0xffffff, K.plain, 0, 0, fb); break;
    case 'bed': P(G.box, 0, 0.22, 0, 1.5, 0.3, 2.1, W); P(G.box, 0, 0.45, 0.05, 1.4, 0.2, 1.95, 0xe9e4da, K.fabric); P(G.box, 0, 0.58, 0.25, 1.42, 0.08, 1.5, 0x5b6e8a, K.fabric); P(G.box, 0, 0.6, -0.78, 1.1, 0.14, 0.38, 0xf4f1ea, K.fabric); P(G.box, 0, 0.6, -1.02, 1.5, 0.9, 0.08, 0x5a3e28); break;
    case 'sleeping_bag': P(G.box, 0, 0.08, 0, 0.8, 0.14, 1.9, 0x3f5a3a, K.fabric); P(G.box, 0, 0.12, -0.8, 0.6, 0.1, 0.3, 0xd8d0c0, K.fabric); break;
    case 'chair': P(G.box, 0, 0.45, 0, 0.45, 0.05, 0.45, col); P(G.box, 0, 0.72, -0.2, 0.45, 0.5, 0.05, col); for (const [a, c] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) P(G.box, a, 0.22, c, 0.04, 0.44, 0.04, shadeC(col, 0.8)); break;
    case 'stool': P(G.cyl8, 0, 0.45, 0, 0.2, 0.05, 0.2, col); for (let q = 0; q < 3; q++) { const a = q / 3 * TAU; P(G.box, Math.cos(a) * 0.14, 0.22, Math.sin(a) * 0.14, 0.04, 0.44, 0.04, shadeC(col, 0.8)); } break;
    case 'bench': P(G.box, 0, 0.45, 0, 1.6, 0.06, 0.42, col); for (const a of [-0.65, 0.65]) P(G.box, a, 0.22, 0, 0.06, 0.44, 0.38, shadeC(col, 0.8)); break;
    case 'clock': P(G.box, 0, 1.0, 0, 0.45, 2.0, 0.3, col); P(G.cyl14, 0, 1.6, 0.16, 0.16, 0.02, 0.16, 0xf0ece0, K.plain, Math.PI / 2); P(G.box, 0, 0.8, 0.16, 0.02, 0.5, 0.01, 0xd8b04a, K.metal); break;
    case 'bookcase': P(G.box, 0, 1.0, 0, 1.0, 2.0, 0.35, col); for (let lv = 0; lv < 4; lv++) for (let q = 0; q < 6; q++) P(G.box, -0.38 + q * 0.15, 0.32 + lv * 0.45, 0.03, 0.1, 0.3, 0.24, [0x8a3a2e, 0x2f5f7a, 0xd9c35a, 0x3f7a4a, 0xe9e2d6][(q + lv) % 5], K.fabric); break;
    case 'rug_small': P(G.box, 0, 0.012, 0, 1.6, 0.02, 1.0, 0x8a3a2e, K.fabric); P(G.box, 0, 0.016, 0, 1.2, 0.02, 0.6, 0xd9b55a, K.fabric); break;
    case 'chest_small': case 'chest_big': case 'crate': case 'cabinet': {
      const s = kind === 'chest_big' ? 1.35 : kind === 'cabinet' ? 1.2 : 1;
      if (kind === 'cabinet') { P(G.box, 0, 0.45, 0, 1.2, 0.9, 0.6, col); P(G.box, 0, 0.92, 0, 1.24, 0.04, 0.64, 0x6d6a66, K.stone); }
      else { P(G.box, 0, 0.25 * s, 0, 0.9 * s, 0.5 * s, 0.55 * s, kind === 'crate' ? 0x9a7448 : col); P(G.box, 0, 0.5 * s, 0, 0.92 * s, 0.06, 0.57 * s, shadeC(col, 0.8)); if (kind !== 'crate') for (const a of [-0.3, 0.3]) P(G.box, a * s, 0.25 * s, 0, 0.05, 0.52 * s, 0.57 * s, MT, K.metal); }
      break;
    }
    case 'barrel': P(G.cyl14, 0, 0.5, 0, 0.38, 1.0, 0.38, 0x7a5232); for (const h of [0.15, 0.85]) P(G.cyl14, 0, h, 0, 0.395, 0.05, 0.395, MT, K.metal); break;
    case 'cart': P(G.box, 0, 0.6, 0, 1.0, 0.4, 0.7, 0x7a5232); P(TIRE_GEO, 0, 0.25, 0.42, 0.25, 0.08, 0.25, 0x2a2a2a, K.plain, 0, Math.PI / 2); for (const a of [-0.35, 0.35]) P(G.box, a, 0.6, -0.6, 0.04, 0.04, 0.8, W); break;
    case 'lantern': P(G.cyl8, 0, 0.75, 0, 0.04, 1.5, 0.04, D); P(G.box, 0, 1.55, 0, 0.22, 0.28, 0.22, MT, K.metal); P(G.box, 0, 1.55, 0, 0.16, 0.2, 0.16, 0xffffff, K.plain, 0, 0, lb); break;
    case 'candle': P(G.cyl8, 0, 0.1, 0, 0.05, 0.2, 0.05, 0xf0e8d0, K.plain); P(G.cone, 0, 0.25, 0, 0.025, 0.07, 0.025, 0xffffff, K.plain, 0, 0, fb); break;
    case 'oil_lamp': P(G.sph, 0, 0.12, 0, 0.14, 0.1, 0.1, 0xa86a4a, K.stone); P(G.cone, 0.12, 0.2, 0, 0.03, 0.08, 0.03, 0xffffff, K.plain, 0, 0, fb); break;
    case 'street_lamp': P(G.cyl8, 0, 2.1, 0, 0.07, 4.2, 0.07, 0x3a3f44, K.metal); P(G.box, 0, 4.2, 0.3, 0.12, 0.08, 0.7, 0x3a3f44, K.metal); P(G.box, 0, 4.12, 0.55, 0.3, 0.06, 0.3, 0xffffff, K.plain, 0, 0, lb); break;
    case 'fireplace': P(G.box, 0, 0.8, 0, 1.8, 1.6, 0.8, ST, K.stone); P(G.box, 0, 0.5, 0.3, 0.9, 0.7, 0.3, 0x1a1210, K.stone); P(G.box, 0, 1.65, 0, 2.0, 0.12, 0.9, shadeC(ST, 0.85), K.stone); P(G.cone, 0, 0.45, 0.32, 0.25, 0.5, 0.15, 0xffffff, K.plain, 0, 0, fb); break;
    case 'torch_wall': P(G.cyl8, 0, 0.8, 0, 0.05, 1.6, 0.05, D); P(G.cyl8, 0, 1.6, 0, 0.07, 0.15, 0.07, 0x3a2a1e, K.fabric); P(G.cone, 0, 1.82, 0, 0.09, 0.3, 0.09, 0xffffff, K.plain, 0, 0, fb); break;
    case 'pot': P(G.cyl8, 0, 0.18, 0, 0.2, 0.36, 0.2, it.place.pot || 0xa85a3a, K.stone); P(G.cyl8, 0, 0.45, 0, 0.02, 0.3, 0.02, 0x3a6a2a, K.plain); P(G.ico1, 0, 0.62, 0, 0.17, 0.12, 0.17, col, K.fabric); P(G.ico, 0, 0.48, 0, 0.18, 0.08, 0.18, 0x3f7a3a, K.fabric); break;
    case 'rug': P(G.box, 0, 0.012, 0, 2.2, 0.02, 1.5, col, K.fabric); P(G.box, 0, 0.016, 0, 1.7, 0.02, 1.0, shadeC(col, 1.25), K.fabric); break;
    case 'banner': P(G.cyl8, 0, 1.2, 0, 0.04, 2.4, 0.04, D); P(G.box, 0, 2.3, 0, 0.9, 0.04, 0.04, D); P(G.box, 0, 1.8, 0.03, 0.8, 1.0, 0.01, col, K.fabric); break;
    case 'curtain': P(G.box, 0, 2.2, 0, 1.7, 0.04, 0.04, D, K.metal); for (let q = 0; q < 6; q++) P(G.box, -0.7 + q * 0.28, 1.1, (q % 2) * 0.05, 0.3, 2.15, 0.02, col, K.fabric); break;
    case 'cushion': P(G.box, 0, 0.09, 0, 0.5, 0.18, 0.5, col, K.fabric); break;
    case 'painting_sea': case 'painting_desert': case 'painting_forest': case 'painting_city': {
      const pc = { painting_sea: 0x3a7aa8, painting_desert: 0xd8b070, painting_forest: 0x3f6a3a, painting_city: 0x8a8a8a }[kind];
      for (const a of [-0.4, 0.4]) P(G.box, a, 0.65, 0.15, 0.04, 1.3, 0.04, D); P(G.box, 0, 1.3, 0, 1.0, 0.75, 0.05, 0x8a6a2a); P(G.box, 0, 1.3, 0.03, 0.88, 0.62, 0.01, pc, K.fabric); P(G.box, 0, 1.18, 0.035, 0.88, 0.2, 0.01, shadeC(pc, 0.7), K.fabric); break;
    }
    case 'statue_lion': case 'statue_horse': case 'statue_eagle': {
      P(G.box, 0, 0.3, 0, 1.2, 0.6, 0.8, shadeC(ST, 1.1), K.stone);
      if (kind === 'statue_eagle') { P(G.sph, 0, 1.05, 0, 0.25, 0.4, 0.25, ST, K.stone); P(G.box, 0, 1.2, 0, 1.2, 0.08, 0.35, ST, K.stone, 0, 0.3); P(G.sph, 0, 1.5, 0.05, 0.13, 0.13, 0.13, ST, K.stone); }
      else { const hz = kind === 'statue_horse'; P(G.box, 0, hz ? 1.15 : 0.95, 0, 0.35, 0.4, 1.0, ST, K.stone); for (const [a, c] of [[-0.12, -0.35], [0.12, -0.35], [-0.12, 0.35], [0.12, 0.35]]) P(G.box, a, hz ? 0.78 : 0.7, c, 0.1, hz ? 0.38 : 0.22, 0.1, ST, K.stone); P(G.box, 0, hz ? 1.55 : 1.15, 0.55, 0.22, hz ? 0.55 : 0.35, 0.3, ST, K.stone, hz ? -0.5 : 0); }
      break;
    }
    case 'fountain': P(G.cyl14, 0, 0.3, 0, 1.6, 0.6, 1.6, ST, K.stone); P(G.cyl14, 0, 0.58, 0, 1.4, 0.05, 1.4, 0x3a6a8a, K.glass); P(G.cyl8, 0, 1.0, 0, 0.18, 1.2, 0.18, ST, K.stone); P(G.cyl14, 0, 1.55, 0, 0.5, 0.12, 0.5, ST, K.stone); break;
    case 'vase': P(G.sph, 0, 0.3, 0, 0.18, 0.3, 0.18, 0x2f6a9a, K.glass); P(G.cyl8, 0, 0.58, 0, 0.07, 0.1, 0.07, 0x2f6a9a, K.glass); break;
    case 'amphora': P(G.sph, 0, 0.4, 0, 0.24, 0.38, 0.24, 0xa85a3a, K.stone); P(G.cyl8, 0, 0.78, 0, 0.08, 0.14, 0.08, 0xa85a3a, K.stone); break;
    case 'globe': P(G.cyl8, 0, 0.4, 0, 0.05, 0.8, 0.05, D); P(G.sph, 0, 0.95, 0, 0.28, 0.28, 0.28, 0x2f6a9a, K.plain); P(G.torus, 0, 0.95, 0, 0.31, 0.31, 0.04, 0xd8b04a, K.metal, Math.PI / 2); break;
    case 'chandelier': P(G.cyl8, 0, 1.3, 0, 0.03, 2.6, 0.03, 0xd8b04a, K.metal); P(G.torus, 0, 2.0, 0, 0.45, 0.45, 0.1, 0xd8b04a, K.metal, Math.PI / 2); for (let q = 0; q < 6; q++) { const a = q / 6 * TAU; P(G.sph, Math.cos(a) * 0.45, 2.1, Math.sin(a) * 0.45, 0.06, 0.08, 0.06, 0xffffff, K.plain, 0, 0, lb); } break;
    case 'wind_chime': P(G.cyl8, 0, 1.0, 0, 0.03, 2.0, 0.03, D); for (let q = 0; q < 5; q++) P(G.cyl8, -0.2 + q * 0.1, 1.6, 0.1, 0.012, 0.3 + q * 0.04, 0.012, 0xb8733a, K.metal); break;
    case 'flag_pole': P(G.cyl8, 0, 3, 0, 0.05, 6, 0.05, 0xb8b2a4, K.metal); P(G.box, 0.55, 5.4, 0, 1.0, 0.65, 0.02, 0x2f8a4a, K.fabric); P(G.box, 0.55, 5.4, 0.012, 1.0, 0.22, 0.01, 0xf0f0f0, K.fabric); break;
    case 'snowman': P(G.sph, 0, 0.45, 0, 0.5, 0.45, 0.5, 0xf4f8fa, K.plain); P(G.sph, 0, 1.08, 0, 0.36, 0.33, 0.36, 0xf4f8fa, K.plain); P(G.sph, 0, 1.55, 0, 0.24, 0.24, 0.24, 0xf4f8fa, K.plain); P(G.cone, 0, 1.55, 0.3, 0.04, 0.18, 0.04, 0xe8782a, K.plain, Math.PI / 2); break;
    case 'sandcastle': P(G.box, 0, 0.2, 0, 1.2, 0.4, 1.2, 0xd8c49a, K.plaster); for (const [a, c] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) P(G.cyl8, a, 0.45, c, 0.18, 0.9, 0.18, 0xd8c49a, K.plaster); P(G.cone, 0, 0.6, 0, 0.3, 0.5, 0.3, 0xd8c49a, K.plaster); break;
    case 'scarecrow': P(G.cyl8, 0, 1.0, 0, 0.04, 2.0, 0.04, D); P(G.box, 0, 1.45, 0, 1.3, 0.05, 0.05, D); P(G.box, 0, 1.3, 0, 0.5, 0.6, 0.25, 0x8a3a2e, K.fabric); P(G.sph, 0, 1.8, 0, 0.17, 0.2, 0.17, 0xd8c070, K.fabric); P(G.cone, 0, 2.02, 0, 0.3, 0.25, 0.3, 0x6b4a2f, K.fabric); break;
    case 'planter': P(G.box, 0, 0.22, 0, 2.3, 0.44, 2.3, 0x7a5232); P(G.box, 0, 0.43, 0, 2.1, 0.04, 2.1, 0x4a3424, K.plaster); break;
    case 'beehive': P(G.box, 0, 0.15, 0, 0.6, 0.3, 0.5, D); for (let q = 0; q < 3; q++) P(G.box, 0, 0.42 + q * 0.22, 0, 0.55, 0.2, 0.45, q % 2 ? 0xe8c070 : 0xf0e0a0); P(G.box, 0, 1.1, 0, 0.66, 0.06, 0.56, 0x8a6a45); break;
    case 'coop': P(G.box, 0, 0.75, 0, 2.0, 1.1, 1.4, 0x9a7448); P(G.box, 0, 1.45, 0, 2.2, 0.1, 1.6, 0x6b4a2f); P(G.box, 0.4, 0.5, 0.71, 0.4, 0.5, 0.02, 0x2a1d14); for (const a of [-0.9, 0.9]) P(G.box, a, 0.3, 0.6, 0.08, 0.6, 0.08, W); break;
    case 'well': P(G.cyl14, 0, 0.45, 0, 1.0, 0.9, 1.0, ST, K.stone); P(G.cyl14, 0, 0.9, 0, 0.82, 0.02, 0.82, 0x1a2a3a, K.glass); for (const a of [-0.85, 0.85]) P(G.box, a, 1.5, 0, 0.12, 1.9, 0.12, W); P(G.cone, 0, 2.55, 0, 1.2, 0.6, 1.2, 0x8a3a2e, K.wood); P(G.cyl8, 0, 1.75, 0, 0.08, 1.6, 0.08, D, K.wood, 0, Math.PI / 2); break;
    case 'compost': P(G.box, 0, 0.5, 0, 1.2, 1.0, 1.0, 0x7a5a3a); P(G.box, 0, 0.98, 0, 1.0, 0.04, 0.8, 0x3a2a1a, K.plaster); break;
    case 'trough': P(G.box, 0, 0.35, 0, 2.0, 0.5, 0.6, 0x7a5232); P(G.box, 0, 0.55, 0, 1.8, 0.04, 0.45, 0x3a6a8a, K.glass); break;
    case 'fence': for (const a of [-1.45, 0, 1.45]) P(G.box, a, 0.6, 0, 0.12, 1.2, 0.12, D); for (const h of [0.45, 0.95]) P(G.box, 0, h, 0, 3, 0.09, 0.05, 0x8a6a45); break;
    default:
      if (['sofa', 'table', 'wardrobe', 'shelf', 'desk', 'mirror'].includes(kind)) furniture(fake, b, kind, x, y, z, ry, null, RNG(r.uid || 1));
      else P(G.box, 0, 0.4, 0, 0.8, 0.8, 0.8, col);
  }
}
/* lamps and fires light the night; things that produce, store or serve get a use button */
const LIGHTING = { lantern: [1.6, 12, 'interior'], candle: [0.4, 6, 'fire'], oil_lamp: [0.4, 7, 'fire'], street_lamp: [4.0, 20, 'lamp'], fireplace: [0.8, 12, 'fire'], torch_wall: [1.9, 10, 'fire'], campfire: [0.6, 14, 'fire'], furnace: [0.6, 7, 'fire'], stove: [0.5, 6, 'fire'], chandelier: [2.0, 12, 'interior'] };

/* ── records: add, physics, remove ── */
const BCHUNK = 24, BCHUNKS = new Map();
const chunkOf = (x, z) => Math.floor(x / BCHUNK) * 10000 + Math.floor(z / BCHUNK);
function recXZ(r) { if (r.kind !== 'piece') return [r.x, r.z]; const it = ITEMS[r.id]; if (it.build.piece === 'pillar') return [r.px, r.pz]; if (r.e) { const [ex, ez] = edgeCenter(r.i, r.j, r.e); return [ex, ez]; } return [cellC(r.i), cellC(r.j)]; }
function slotKeyOf(r) {
  const p = ITEMS[r.id].build.piece;
  if (p === 'foundation') return 'F,' + r.i + ',' + r.j;
  if (p === 'floor' || p === 'roof' || p === 'roof_slope') return 'f,' + r.i + ',' + r.j + ',' + r.L;
  if (p === 'stairs') return 'C,' + r.i + ',' + r.j + ',' + r.L;
  if (p === 'pillar') return 'P,' + Math.round(r.px / 1.5) + ',' + Math.round(r.pz / 1.5) + ',' + r.L;
  if (p === 'door') return 'D,' + r.i + ',' + r.j + ',' + r.L + ',' + r.e;
  if (p === 'window') return 'G,' + r.i + ',' + r.j + ',' + r.L + ',' + r.e;
  return 'E,' + r.i + ',' + r.j + ',' + r.L + ',' + r.e;
}
function addRec(r, quiet) {
  r.uid = r.uid || builtUid++; builtUid = Math.max(builtUid, r.uid + 1);
  const ph = r._ph = { cols: [], plats: [], occs: [], anchors: [] };
  const col = (c) => { addCollider(c); ph.cols.push(c); SLOTS_COL.add(c); return c; }, plat = (p) => { addPlatform(p); ph.plats.push(p); return p; }, occ = (o) => { addOccluder(o); ph.occs.push(o); return o; };
  if (r.kind === 'piece') {
    const P = ITEMS[r.id].build, piece = P.piece, cx = cellC(r.i), cz = cellC(r.j), y = r.y;
    SLOTS.set(slotKeyOf(r), r);
    if (piece === 'foundation') { plat({ t: 'rect', x0: cx - 1.5, x1: cx + 1.5, z0: cz - 1.5, z1: cz + 1.5, y }); col({ t: 'b', x: cx, z: cz, hx: 1.5, hz: 1.5, y0: r.bot - 2, y1: y - STEP_UP + 0.03 }); occ({ t: 'b', x: cx, z: cz, hx: 1.5, hz: 1.5, bot: r.bot, top: y }); for (let i = Math.floor((cx - 2) / 8); i <= Math.floor((cx + 2) / 8); i++) for (let j = Math.floor((cz - 2) / 8); j <= Math.floor((cz + 2) / 8); j++) GBLOCK.add(i * 100000 + j); if (!quiet) grassDirtyArea(cx, cz, 3); }
    else if (piece === 'floor' || piece === 'roof') { plat({ t: 'rect', x0: cx - 1.5, x1: cx + 1.5, z0: cz - 1.5, z1: cz + 1.5, y }); occ({ t: 'b', x: cx, z: cz, hx: 1.5, hz: 1.5, bot: y - 0.25, top: y }); }
    else if (piece === 'roof_slope' || piece === 'stairs') {
      const q = Math.round(r.ry / (Math.PI / 2)) & 3, rise = piece === 'stairs' ? 3 : 1.5, wHalf = piece === 'stairs' ? 0.7 : 1.5;
      const alongZ = q === 0 || q === 2, up = q === 0 || q === 1;    // 0: rises to +z, 1: +x, 2: −z, 3: −x
      plat({ t: 'ramp', axis: alongZ ? 'z' : 'x', x0: cx - (alongZ ? wHalf : 1.5), x1: cx + (alongZ ? wHalf : 1.5), z0: cz - (alongZ ? 1.5 : wHalf), z1: cz + (alongZ ? 1.5 : wHalf), ya: up ? y : y + rise, yb: up ? y + rise : y });
    } else if (piece === 'pillar') { col({ t: 'c', x: r.px, z: r.pz, r: 0.2, y0: y - 0.2, y1: y + 3 }); }
    else if (EDGE_PIECES.has(piece) || piece === 'door') {
      const [ex, ez, along] = edgeCenter(r.i, r.j, r.e), h = piece === 'half_wall' ? 1.5 : piece === 'fence' || piece === 'gate' ? 1.15 : 3;
      const box = (u0, u1, top) => { const u = (u0 + u1) / 2, L = (u1 - u0) / 2; return col({ t: 'b', x: ex + (along ? u : 0), z: ez + (along ? 0 : u), hx: along ? L : 0.12, hz: along ? 0.12 : L, y0: y - 0.3, y1: y + top }); };
      if (piece === 'wall_door') { box(-1.5, -0.55, 3); box(0.55, 1.5, 3); }
      else if (piece === 'door') { ph.door = box(-0.55, 0.55, 2.2); ph.door.off = !!r.open; }
      else if (piece === 'gate') { ph.door = box(-1.4, 1.4, 1.15); ph.door.off = !!r.open; box(-1.55, -1.4, 1.2); box(1.4, 1.55, 1.2); }
      else box(-1.5, 1.5, h);
      if (piece !== 'fence' && piece !== 'gate' && piece !== 'door') occ({ t: 'b', x: ex, z: ez, hx: along ? 1.5 : 0.1, hz: along ? 0.1 : 1.5, bot: y, top: y + h });
    }
  } else if (r.kind === 'place') {
    const it = ITEMS[r.id], kind = placeKind(it), f = FOOT[kind] || [0.5, 1];
    if (f[1] > 0.3 && !['rug', 'rug_small', 'curtain', 'cushion', 'sleeping_bag', 'candle', 'oil_lamp'].includes(kind)) col({ t: 'c', x: r.x, z: r.z, r: Math.min(f[0], 1.2) * 0.85, y0: r.y - 0.3, y1: r.y + Math.min(f[1], 2.2) });
    const li = LIGHTING[kind]; if (li) { const a = { x: r.x, y: r.y + li[0], z: r.z, color: it.place.light || (li[2] === 'fire' ? 0xff9a50 : 0xffc98a), range: li[1], kind: li[2] === 'lamp' ? 'street' : li[2] }; LIGHT_ANCHORS.push(a); ph.anchors.push(a); }
    if (kind === 'bed' || kind === 'sleeping_bag') { const bd = { x: r.x, y: r.y, z: r.z, rec: r }; BEDS.push(bd); ph.bed = bd; }
    if (kind === 'planter') { r.plot = r.plot || { crop: null, grow: 0, water: 0 }; PLOTS.push(r); }
    if (STORE_CAP[kind]) r.items = r.items || {};
    if (PRODUCE[kind]) { r.made = r.made || 0; r.pt = r.pt || 0; }
  } else if (r.kind === 'plot') { PLOTS.push(r); for (let i = Math.floor((r.x - 2) / 8); i <= Math.floor((r.x + 2) / 8); i++) for (let j = Math.floor((r.z - 2) / 8); j <= Math.floor((r.z + 2) / 8); j++) GBLOCK.add(i * 100000 + j); if (!quiet) grassDirtyArea(r.x, r.z, 2.5); }
  else if (r.kind === 'tree') { PLANTED.push(r); plantInCell(r); }
  BUILT.push(r);
  if (r.kind !== 'tree') { r._ck = chunkOf(...recXZ(r)); markChunk(r._ck); }
  plotsDirty = true;
  return r;
}
function removeRec(r) {
  const i = BUILT.indexOf(r); if (i >= 0) BUILT.splice(i, 1);
  const ph = r._ph;
  if (ph) { for (const c of ph.cols) { removeCollider(c); SLOTS_COL.delete(c); } for (const p of ph.plats) removePlatform(p); for (const o of ph.occs) removeOccluder(o); for (const a of ph.anchors) { const k = LIGHT_ANCHORS.indexOf(a); if (k >= 0) LIGHT_ANCHORS.splice(k, 1); } if (ph.bed) { const k = BEDS.indexOf(ph.bed); if (k >= 0) BEDS.splice(k, 1); } }
  if (r.kind === 'piece' && SLOTS.get(slotKeyOf(r)) === r) SLOTS.delete(slotKeyOf(r));
  for (const L of [PLOTS, PLANTED]) { const k = L.indexOf(r); if (k >= 0) L.splice(k, 1); }
  if (r.kind === 'tree' && r._t) { const c = VCELLS.get(vkey(Math.floor(r.x / VCELL), Math.floor(r.z / VCELL))); if (c) { const k = c.trees.indexOf(r._t); if (k >= 0) c.trees.splice(k, 1); if (r._t.col) { removeCollider(r._t.col); const q = c.colliders ? c.colliders.indexOf(r._t.col) : -1; if (q >= 0) c.colliders.splice(q, 1); } } vegDirty(); }
  if (r._ck !== undefined) markChunk(r._ck);
  plotsDirty = true;
}
/* one merged mesh per 24 m chunk; rebuilt when something in it changes */
const chunkQueue = new Set();
function markChunk(k) { chunkQueue.add(k); }
function rebuildChunks() {
  if (!chunkQueue.size) return;
  for (const k of chunkQueue) {
    const old = BCHUNKS.get(k); if (old) for (const m of old) { scene.remove(m); m.geometry.dispose(); }
    // walls, roofs and fences weather and gather snow; floors, stairs and everything you place inside stay clean
    const b = new Builder(), ib = new Builder(), gb = new Builder(), lb = new Builder(), fb = new Builder();
    for (const r of BUILT) if (r._ck === k) {
      if (r.kind === 'piece') { const P = ITEMS[r.id] && ITEMS[r.id].build, sheltered = P && (P.piece === 'floor' || P.piece === 'foundation' || P.piece === 'stairs'); drawPiece(r, sheltered ? ib : b, gb); }
      else if (r.kind === 'place') drawPlace(r, ib, gb, lb, fb); else if (r.kind === 'plot') drawPlotSoil(r, b);
    }
    const ms = [];
    if (!b.empty) ms.push(b.mesh(UBER, QUALITY.shadows));
    if (!ib.empty) ms.push(ib.mesh(UBER_IN, QUALITY.shadows));
    if (!gb.empty) { const m = gb.mesh(GLASS_MAT, false); m.renderOrder = 3; ms.push(m); }
    if (!lb.empty) ms.push(lb.mesh(BULB_MAT, false));
    if (!fb.empty) { const m = fb.mesh(FIRE_MAT, false); m.renderOrder = 4; ms.push(m); }
    for (const m of ms) scene.add(m);
    if (ms.length) BCHUNKS.set(k, ms); else BCHUNKS.delete(k);
  }
  chunkQueue.clear();
}
function builtBlocksGrass(x, z) {
  const f = SLOTS.get('F,' + Math.floor(x / 3) + ',' + Math.floor(z / 3)); if (f) return true;
  for (const p of PLOTS) if (p.kind === 'plot' && Math.abs(p.x - x) < 1.25 && Math.abs(p.z - z) < 1.25) return true;
  return false;
}

/* ── the ghost and the plan: where would this go ── */
function ghostGeo(it) {
  if (it.build) {
    const p = it.build.piece;
    if (p === 'foundation') return new THREE.BoxGeometry(3, 0.6, 3).translate(0, -0.3, 0);
    if (p === 'floor' || p === 'roof') return new THREE.BoxGeometry(3, 0.2, 3).translate(0, -0.1, 0);
    if (p === 'roof_slope') { const g = new THREE.BoxGeometry(3.1, 0.2, 3.4); g.rotateX(-0.4636); g.translate(0, 0.75, 0); return g; }
    if (p === 'stairs') { const g = new THREE.BoxGeometry(1.4, 0.2, 4.2); g.rotateX(-Math.PI / 4); g.translate(0, 1.5, 0); return g; }
    if (p === 'pillar') return new THREE.BoxGeometry(0.32, 3, 0.32).translate(0, 1.5, 0);
    const h = p === 'half_wall' ? 1.5 : p === 'fence' || p === 'gate' ? 1.15 : p === 'door' ? 2.2 : p === 'window' ? 1.2 : 3, w = p === 'door' ? 1.1 : p === 'window' ? 1.2 : 3;
    return new THREE.BoxGeometry(w, h, 0.22).translate(0, p === 'window' ? 1.6 : h / 2, 0);
  }
  if (it.seed) return new THREE.BoxGeometry(2.2, 0.12, 2.2).translate(0, 0.06, 0);
  if (it.sapling) return new THREE.ConeGeometry(0.4, 1.2, 8).translate(0, 0.6, 0);
  if (it.vehicle && it.vehicle !== 'cart') { const s = VSPEC[it.vehicle]; return new THREE.BoxGeometry(s.wid || s.track + 0.3, 1.0, s.len || s.wb + 1.2).translate(0, 0.5, 0); }
  const f = FOOT[placeKind(it)] || [0.5, 1];
  if (placeKind(it) === 'fence') return new THREE.BoxGeometry(3, 1.1, 0.15).translate(0, 0.55, 0);
  return new THREE.CylinderGeometry(f[0], f[0], Math.max(0.05, f[1]), 16).translate(0, Math.max(0.05, f[1]) / 2, 0);
}
function startPlace(id) {
  const it = ITEMS[id]; if (!it || invCount(id) <= 0) return false;
  if (player.vehicle) { toast('انزل من المركبة أولاً', ''); return false; }
  cancelBuild();
  BUILD.it = it; BUILD.turn = 0; BUILD.latch = true;
  const geo = ghostGeo(it), g = new THREE.Group(), m = new THREE.Mesh(geo, GHOST); m.renderOrder = 3; g.add(m);
  const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo), GHOST_EDGE); g.add(e);
  BUILD.ghost = g; scene.add(g);
  if (it.build) { const h = INV.slots.find((s) => s.startsWith('hammer_') && ownsTool(s)); if (h) equip(h); }
  hudDirty = true; if (typeof closeCraft === 'function') closeCraft();
  toast('ضع ' + it.name, it.build ? 'وجّه نحو المكان · R للتدوير · اضغط للبناء · يلتصق بالقطع المجاورة' : it.vehicle && VSPEC[it.vehicle] && VSPEC[it.vehicle].water ? 'وجّه نحو الماء القريب' : 'وجّه نحو المكان ثم اضغط زر البناء');
  return true;
}
function cancelBuild() { if (BUILD.ghost) { scene.remove(BUILD.ghost); BUILD.ghost.traverse((o) => o.geometry && o.geometry.dispose()); } BUILD.ghost = null; BUILD.it = null; BUILD.plan = null; hudDirty = true; }
function rotateBuild() { if (BUILD.ghost) { BUILD.turn = (BUILD.turn + 1) % 4; AUDIO.equip(); } }
const _aim = new THREE.Vector3(), _aimD = new THREE.Vector3();
function aimPoint(maxD) {
  // march along the view from the camera until we meet the ground or a floor
  camera.getWorldDirection(_aimD); _aim.copy(camera.position);
  const p = player.pos, start = Math.max(0, (p.x - _aim.x) * _aimD.x + (p.y + 1.4 - _aim.y) * _aimD.y + (p.z - _aim.z) * _aimD.z - 0.5);
  for (let t = start; t < start + maxD; t += 0.25) {
    const x = _aim.x + _aimD.x * t, y = _aim.y + _aimD.y * t, z = _aim.z + _aimD.z * t;
    const g = groundAt(x, z, y + 0.3);
    if (y <= g + 0.02) return [x, g, z];
  }
  const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw), x = p.x + fx * 4, z = p.z + fz * 4;
  return [x, groundAt(x, z, p.y + 1), z];
}
function planPiece(it, ax, ay, az) {
  const piece = it.build.piece, i = Math.floor(ax / 3), j = Math.floor(az / 3), cx = cellC(i), cz = cellC(j);
  const y0 = baseY(i, j), base = y0 === null ? groundBase(cx, cz) : y0;
  const Lmin = clamp(Math.floor((ay - base + 0.6) / 3), 0, 3);
  const plan = { i, j, L: 0, e: '', y: base, ry: 0, x: cx, z: cz, why: '' };
  const free = (k) => !SLOTS.has(k);
  if (piece === 'foundation') {
    if (SLOTS.has('F,' + i + ',' + j)) return Object.assign(plan, { why: 'يوجد أساس هنا' });
    let lo = 1e9, hi = -1e9; for (const [a, c] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5], [0, 0]]) { const h = terrainAt(cx + a, cz + c); lo = Math.min(lo, h); hi = Math.max(hi, h); }
    let y = hi + 0.25;
    const nb = baseY(i, j); if (nb !== null && Math.abs(nb - y) < 1.4 && nb > lo + 0.1) y = nb;
    Object.assign(plan, { y, bot: lo - 0.5 });
    if (hi - lo > 2.2) plan.why = 'الأرض شديدة الانحدار هنا';
    else if (lo < waterAt(cx, cz) + 0.1) plan.why = 'لا يمكن البناء في الماء';
    else if (roadDist(cx, cz) < 3.2) plan.why = 'لا تبنِ فوق الطريق';
    else if (Math.abs(player.pos.x - cx) < 1.9 && Math.abs(player.pos.z - cz) < 1.9 && player.pos.y < y + 0.3) plan.why = 'ابتعد قليلاً عن المكان';
    else { let t0 = null; treesNear(cx, cz, 2.6, (t) => { if (!t.bush) { t0 = t; return false; } }); if (t0) plan.why = 'شجرة في المكان: اقطعها أولاً'; }
    if (!plan.why) { let rk = null; rocksNear(cx, cz, 1.6, (r) => { if (r.kind !== 'cliff' && r.r > 0.5) { rk = r; return false; } }); if (rk) plan.why = 'صخرة في المكان: اكسرها أولاً'; }
    if (!plan.why) CGRID.each(cx - 2, cz - 2, cx + 2, cz + 2, (c) => { if (c.off || c.t !== 'b' || SLOTS_COL.has(c)) return; if (Math.abs(c.x - cx) < c.hx + 1.4 && Math.abs(c.z - cz) < c.hz + 1.4 && (c.y1 === undefined || c.y1 > lo)) { plan.why = 'المكان مشغول'; return false; } });
    return plan;
  }
  if (piece === 'floor' || piece === 'roof' || piece === 'roof_slope') {
    const q = (Math.round((player.yaw) / (Math.PI / 2)) + BUILD.turn) & 3; plan.ry = q * Math.PI / 2;
    for (let L = Math.max(1, Lmin); L <= 4; L++) {
      if (!free('f,' + i + ',' + j + ',' + L)) continue;
      let sup = false;
      for (const e of EDGE_ORDER) { const [a, b, c] = canonEdge(i, j, e); if (SLOTS.has('E,' + a + ',' + b + ',' + (L - 1) + ',' + c)) sup = true; }
      for (const [a, c] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (SLOTS.has('f,' + (i + a) + ',' + (j + c) + ',' + L)) sup = true;
      for (const [a, c] of [[0, 0], [1, 0], [0, 1], [1, 1]]) if (SLOTS.has('P,' + (i * 2 + a * 2) + ',' + (j * 2 + c * 2) + ',' + (L - 1))) sup = true;
      if (!sup) return Object.assign(plan, { L, y: base + 3 * L, why: 'تحتاج جدراناً أو أعمدة تحمل ' + it.name });
      return Object.assign(plan, { L, y: base + 3 * L });
    }
    return Object.assign(plan, { why: 'لا مكان أعلى من هذا' });
  }
  if (piece === 'stairs') {
    const q = (Math.round((player.yaw) / (Math.PI / 2)) + BUILD.turn) & 3; plan.ry = q * Math.PI / 2;
    for (let L = Lmin; L <= 3; L++) { if (!free('C,' + i + ',' + j + ',' + L)) continue; if (L > 0 && !SLOTS.has('f,' + i + ',' + j + ',' + L)) return Object.assign(plan, { L, y: base + 3 * L, why: 'الدرج يحتاج أرضية تحته' }); return Object.assign(plan, { L, y: base + 3 * L }); }
    return Object.assign(plan, { why: 'لا مكان للدرج هنا' });
  }
  if (piece === 'pillar') {
    const gx = Math.round(ax / 1.5), gz = Math.round(az / 1.5);
    for (let L = Lmin; L <= 3; L++) if (free('P,' + gx + ',' + gz + ',' + L)) return Object.assign(plan, { L, y: base + 3 * L, px: gx * 1.5, pz: gz * 1.5, x: gx * 1.5, z: gz * 1.5 });
    return Object.assign(plan, { why: 'لا مكان للعمود هنا' });
  }
  // edge pieces, doors and windows
  const dx = ax - cx, dz = az - cz;
  let e = Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 'e' : 'w') : (dz > 0 ? 's' : 'n');
  e = EDGE_ORDER[(EDGE_ORDER.indexOf(e) + BUILD.turn) % 4];
  const [ci, cj, ce] = canonEdge(i, j, e);
  const [ex, ez] = edgeCenter(ci, cj, ce);
  Object.assign(plan, { i: ci, j: cj, e: ce, x: ex, z: ez, ry: ce === 'n' ? 0 : Math.PI / 2 });
  const eb = baseY(ci, cj) ?? baseY(ci - (ce === 'w' ? 1 : 0), cj - (ce === 'n' ? 1 : 0)), b2 = eb === null ? groundBase(ex, ez) : eb;
  if (piece === 'door' || piece === 'window') {
    const need = piece === 'door' ? 'wall_door' : 'wall_window', pre = piece === 'door' ? 'D,' : 'G,';
    for (let L = 0; L <= 3; L++) { const w = SLOTS.get('E,' + ci + ',' + cj + ',' + L + ',' + ce); if (w && ITEMS[w.id].build.piece === need && free(pre + ci + ',' + cj + ',' + L + ',' + ce)) return Object.assign(plan, { L, y: w.y }); }
    return Object.assign(plan, { y: b2, why: piece === 'door' ? 'ضع الباب في جدار له فتحة باب' : 'ضع النافذة في جدار له فتحة نافذة' });
  }
  for (let L = Lmin; L <= 3; L++) {
    if (!free('E,' + ci + ',' + cj + ',' + L + ',' + ce)) continue;
    const y = b2 + 3 * L;
    if (L > 0) {
      const [oi, oj] = ce === 'n' ? [ci, cj - 1] : [ci - 1, cj];
      if (!SLOTS.has('f,' + ci + ',' + cj + ',' + L) && !SLOTS.has('f,' + oi + ',' + oj + ',' + L) && !SLOTS.has('E,' + ci + ',' + cj + ',' + (L - 1) + ',' + ce)) return Object.assign(plan, { L, y, why: 'الطابق العلوي يحتاج أرضية' });
    } else {
      if (terrainAt(ex, ez) < waterAt(ex, ez) - 0.2) return Object.assign(plan, { L, y, why: 'لا يمكن البناء في الماء' });
      if (eb === null && roadDist(ex, ez) < 2) return Object.assign(plan, { L, y, why: 'لا تبنِ فوق الطريق' });
    }
    const along = ce === 'n', px = player.pos.x, pz = player.pos.z;
    if (Math.abs(px - ex) < (along ? 1.6 : 0.5) && Math.abs(pz - ez) < (along ? 0.5 : 1.6) && Math.abs(player.pos.y - y - 1) < 1.6) return Object.assign(plan, { L, y, why: 'ابتعد قليلاً عن المكان' });
    return Object.assign(plan, { L, y });
  }
  return Object.assign(plan, { why: 'لا مكان أعلى من هذا' });
}
const SLOTS_COL = new Set();
function planFree(it, ax, ay, az) {
  const plan = { x: ax, y: ay, z: az, ry: Math.round((player.yaw + Math.PI) / (Math.PI / 4)) * (Math.PI / 4) + BUILD.turn * Math.PI / 2, why: '' };
  const p = player.pos, dP = Math.hypot(ax - p.x, az - p.z);
  if (it.vehicle && it.vehicle !== 'cart') {
    const s = VSPEC[it.vehicle];
    if (s.water) { if (waterAt(ax, az) - terrainAt(ax, az) < 0.9) plan.why = 'يحتاج ماءً أعمق: وجّه نحو البحر أو البحيرة'; plan.y = waterAt(ax, az); }
    else if (terrainAt(ax, az) < waterAt(ax, az) + 0.1) plan.why = 'لا يمكن وضعها في الماء';
    else if (slopeAt(ax, az) > 0.35) plan.why = 'الأرض مائلة جداً';
    for (const v of VEHICLES) if (Math.hypot(v.pos.x - ax, v.pos.z - az) < v.spec.R + 2.6) plan.why = 'مركبة أخرى قريبة';
    plan.ry = player.yaw; return plan;
  }
  if (dP < 0.9) plan.why = 'ابتعد قليلاً عن المكان';
  const kind = it.seed ? 'plot' : it.sapling ? 'sapling' : placeKind(it), f = FOOT[kind] || [kind === 'plot' ? 1.2 : 0.5, 1];
  const onFloor = onPlatform(ax, az, ay + 0.3);
  if (!onFloor) {
    if (terrainAt(ax, az) < waterAt(ax, az) + 0.05) plan.why = 'لا يمكن الوضع في الماء';
    else if (slopeAt(ax, az) > (kind === 'plot' ? 0.45 : 0.7)) plan.why = 'الأرض مائلة جداً';
    if ((kind === 'plot' || kind === 'sapling') && (roadDist(ax, az) < 1.5 || classAt(ax, az) === 2)) plan.why = 'يحتاج تربة: ابتعد عن الطريق';
  } else if (kind === 'plot' || kind === 'sapling') plan.why = 'يحتاج تربة لا أرضية';
  if (kind === 'sapling') { let t0 = null; treesNear(ax, az, 3, (t) => { t0 = t; return false; }); if (t0) plan.why = 'قريبة جداً من شجرة أخرى'; }
  if (kind === 'plot') { for (const q of PLOTS) if (Math.hypot(q.x - ax, q.z - az) < 2.3) plan.why = 'حوض زراعة آخر قريب'; if (PLOTS.length >= 160) plan.why = 'لديك أحواض كثيرة'; }
  if (!plan.why) CGRID.each(ax - f[0] - 1, az - f[0] - 1, ax + f[0] + 1, az + f[0] + 1, (c) => {
    if (c.off || c.t === 'in' || (c.y1 !== undefined && c.y1 < ay + 0.1) || (c.y0 !== undefined && c.y0 > ay + 1.8)) return;
    const ex = c.t === 'b' ? c.hx : c.r, ez = c.t === 'b' ? c.hz : c.r;
    if (Math.abs(c.x - ax) < ex + f[0] * 0.7 && Math.abs(c.z - az) < ez + f[0] * 0.7) { plan.why = 'المكان مشغول'; return false; }
  });
  if (kind === 'fence') plan.ry = Math.round(player.yaw / (Math.PI / 2)) * (Math.PI / 2) + BUILD.turn * Math.PI / 2;
  return plan;
}
function updateBuild() {
  if (!BUILD.ghost) return;
  if (player.vehicle || !player.alive) { cancelBuild(); return; }
  const it = BUILD.it;
  const [ax, ay, az] = aimPoint(it.build ? 9 : 7);
  const plan = it.build ? planPiece(it, ax, ay, az) : planFree(it, ax, ay, az);
  if (!plan.why && Math.hypot(plan.x - player.pos.x, plan.z - player.pos.z) > 9) plan.why = 'بعيد جداً';
  if (!plan.why && invCount(it.id) <= 0) plan.why = 'لم يبقَ معك';
  BUILD.plan = plan; BUILD.ok = !plan.why; BUILD.why = plan.why; BUILD.x = plan.x; BUILD.y = plan.y; BUILD.z = plan.z; BUILD.ry = plan.ry;
  const g = BUILD.ghost;
  if (it.build && it.build.piece !== 'foundation' && it.build.piece !== 'floor' && it.build.piece !== 'roof' && it.build.piece !== 'roof_slope' && it.build.piece !== 'stairs' && it.build.piece !== 'pillar') g.rotation.set(0, plan.e === 'n' ? 0 : Math.PI / 2, 0);
  else g.rotation.set(0, plan.ry || 0, 0);
  if (it.build && (it.build.piece === 'floor' || it.build.piece === 'roof' || it.build.piece === 'foundation')) g.rotation.set(0, 0, 0);
  g.position.set(plan.x, plan.y, plan.z);
  GHOST.color.set(BUILD.ok ? 0x7fe08a : 0xff6a5a); GHOST_EDGE.color.set(BUILD.ok ? 0xd8ffd8 : 0xffd0c8);
}
function placeBuild() {
  const it = BUILD.it, plan = BUILD.plan; if (!it || !plan) return;
  if (!BUILD.ok) { toast('لا يمكن الوضع هنا', BUILD.why); AUDIO.dry(); return; }
  if (!invTake(it.id, 1)) { cancelBuild(); return; }
  let rec;
  if (it.build) rec = { kind: 'piece', id: it.id, i: plan.i, j: plan.j, L: plan.L, e: plan.e, y: +plan.y.toFixed(3), bot: plan.bot !== undefined ? +plan.bot.toFixed(2) : undefined, ry: +(plan.ry || 0).toFixed(4), px: plan.px, pz: plan.pz };
  else if (it.vehicle && it.vehicle !== 'cart') { buyVehicle(it.vehicle, plan.x, plan.z, plan.ry); rec = null; }
  else if (it.seed) { rec = { kind: 'plot', x: +plan.x.toFixed(2), z: +plan.z.toFixed(2), y: +plan.y.toFixed(2), crop: it.seed, grow: 0, water: 0 }; }
  else if (it.sapling) rec = { kind: 'tree', sp: it.sapling, x: +plan.x.toFixed(2), z: +plan.z.toFixed(2), y: +terrainAt(plan.x, plan.z).toFixed(2), t0: T_GAME };
  else rec = { kind: 'place', id: it.id, x: +plan.x.toFixed(2), y: +plan.y.toFixed(3), z: +plan.z.toFixed(2), ry: +plan.ry.toFixed(3) };
  if (rec) { addRec(rec); HOOK.built(rec); }
  if (typeof saveSoon === 'function') saveSoon(); hudDirty = true;
  AUDIO.build(); cam.shake = Math.min(0.2, cam.shake + 0.06);
  spawnPuff(plan.x, plan.y + 0.3, plan.z, it.vehicle && VSPEC[it.vehicle] && VSPEC[it.vehicle].water ? 0xdfeeee : 0xb3a184, 10, 2.4, 0.18, -1.5, 1.2);
  STATS.built = (STATS.built || 0) + 1; track('built');
  if (invCount(it.id) <= 0 || it.vehicle) { toast('تمّ: ' + it.name, it.vehicle ? 'اقترب منها واضغط «اركب»' : ''); cancelBuild(); }
}
/* the hammer takes back what you placed (all of it, nothing lost) */
function hammerPick() {
  const p = player.pos, fx = Math.sin(player.yaw), fz = Math.cos(player.yaw);
  let best = null, bd = 2.8;
  for (const r of BUILT) {
    if (r.kind === 'tree') continue;
    const [x, z] = recXZ(r), y = r.y !== undefined ? r.y : terrainAt(x, z), dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz);
    if (d > bd || y > p.y + 3.2 || y < p.y - 2) continue;
    if (d > 0.6 && (dx * fx + dz * fz) / d < 0.3) continue;
    if (r.kind === 'piece' && ITEMS[r.id].build.piece === 'foundation' && BUILT.some((o) => o !== r && o.kind === 'piece' && o.i === r.i && o.j === r.j && ITEMS[o.id].build.piece !== 'foundation')) continue;
    best = r; bd = d;
  }
  if (!best) return false;
  if (best.kind === 'piece' && ITEMS[best.id].build.piece === 'wall_door') { const d = SLOTS.get('D,' + best.i + ',' + best.j + ',' + best.L + ',' + best.e); if (d) best = d; }
  if (best.kind === 'piece' && ITEMS[best.id].build.piece === 'wall_window') { const g = SLOTS.get('G,' + best.i + ',' + best.j + ',' + best.L + ',' + best.e); if (g) best = g; }
  removeRec(best); HOOK.unbuilt(best);
  if (best.items) for (const [id, n] of Object.entries(best.items)) if (n > 0) { const k = invAdd(id, n, true); if (k < n) dropItems(p.x, p.y, p.z, [[id, n - k]]); }
  if (best.kind === 'piece' || best.kind === 'place') { invAdd(best.id, 1, true); toast('أعدت ' + ITEMS[best.id].name + ' إلى الحقيبة', ''); }
  else if (best.kind === 'plot') toast('أزلت حوض الزراعة', '');
  AUDIO.build(); spawnPuff(p.x + fx * 1.5, p.y + 1, p.z + fz * 1.5, 0xb3a184, 8, 2, 0.12, -2, 1);
  if (typeof saveSoon === 'function') saveSoon();
  return true;
}
function buyVehicle(kind, x, z, ry, paint) {
  const rec = { kind, x: +x.toFixed(2), z: +z.toFixed(2), ry: +ry.toFixed(3), paint: paint !== undefined ? paint : pick(PAINTS) };
  OWNED_V.push(rec); const v = spawnVehicle(kind, x, z, ry, rec.paint, rec); v.owned = true; return v;
}
const OWNED_V = [];

/* ── stations near you: your own, or a town's ── */
function stationNear(st, x, z, r) {
  for (const rec of BUILT) { if (rec.kind !== 'place') continue; const s = ITEMS[rec.id].place && ITEMS[rec.id].place.station; if (!s) continue; if ((s === st || (st === 'campfire' && s === 'stove')) && Math.hypot(rec.x - x, rec.z - z) < r) return true; }
  if (st === 'campfire') for (const a of LIGHT_ANCHORS) if (a.kind === 'fire' && Math.hypot(a.x - x, a.z - z) < r) return true;
  const shopFor = { workbench: ['tools', 'cars'], gunbench: ['guns'], anvil: ['tools', 'ores', 'guns'], furnace: ['ores', 'bakery'], tailor: ['clothes'], loom: ['clothes'], campfire: ['cafe', 'bakery'] }[st];
  if (shopFor) for (const s of SHOP_SPOTS) if (shopFor.includes(s.kind) && Math.hypot(s.x - x, s.z - z) < r + 8) return true;
  return false;
}

/* ── farming: plots, seeds, water and the harvest ── */
const GROW_SEC = 420, CROP_COLOR = { wheat: 0xd8b048, barley: 0xc8a858, corn: 0xe8c040, sunflower: 0xe8c030, cotton: 0xf4f2ee, potato: 0xb8905a, tomato: 0xd83a2a, carrot: 0xe8782a, pumpkin: 0xe8882a };
let plotsDirty = true, plotT = 0;
function plotAt(x, z, r) { let best = null, bd = r; for (const p of PLOTS) { const d = Math.hypot(p.x - x, p.z - z); if (d < bd) { bd = d; best = p; } } return best; }
const plotOf = (p) => p.kind === 'place' ? p.plot : p;
function tillPlot(x, z) {
  const why = digWhy(x, z) || (slopeAt(x, z) > 0.45 ? 'الأرض مائلة جداً' : '');
  if (why) { toast(why, ''); AUDIO.dry(); return; }
  if (PLOTS.some((q) => Math.hypot(q.x - x, q.z - z) < 2.3)) { toast('حوض زراعة قريب', 'ازرع فيه بذوراً من الحقيبة'); return; }
  addRec({ kind: 'plot', x: +x.toFixed(2), z: +z.toFixed(2), y: +terrainAt(x, z).toFixed(2), crop: null, grow: 0, water: 0 });
  AUDIO.dig(0.7); spawnPuff(x, terrainAt(x, z) + 0.2, z, 0x6a5238, 10, 2, 0.07, -8, 0.8);
  toast('حرثت حوضاً للزراعة', 'ازرع فيه بذوراً: من الحقيبة اختر البذور ثم «ازرع»');
  if (typeof saveSoon === 'function') saveSoon();
}
function plantSeed(id) {
  const it = ITEMS[id], p = player.pos;
  const pl = PLOTS.find((q) => !plotOf(q).crop && Math.hypot(q.x - p.x, q.z - p.z) < 3.5);
  if (!pl) return startPlace(id);
  if (!invTake(id, 1)) return false;
  const P = plotOf(pl); P.crop = it.seed; P.grow = 0; P.water = 0; plotsDirty = true;
  AUDIO.plant(); toast('زرعت ' + ITEMS[it.seed].name, 'اسقه أو انتظر المطر · ينضج في سبع دقائق تقريباً');
  if (typeof saveSoon === 'function') saveSoon(); if (typeof closeCraft === 'function') closeCraft();
  return true;
}
function plotWork(pl, tool) {
  const P = plotOf(pl);
  if (P.crop && P.grow >= 1) { harvestPlot(pl); return; }
  if (player.toolItem === 'watering_can') { waterPlot(pl); return; }
  if (!P.crop) {
    const seed = [...INV.items.keys()].find((k) => ITEMS[k] && ITEMS[k].seed);
    if (seed) { plantSeed(seed); return; }
    toast('الحوض فارغ', 'اجمع بذوراً من الحقول أو اشترِها من دكّان القرية'); return;
  }
  HARV.name = ITEMS[P.crop].name + ' · ' + toAr(Math.round(P.grow * 100)) + '٪'; HARV.frac = P.grow; HARV.t = 1.6;
}
function waterPlot(pl) { const P = plotOf(pl); P.water = 150; AUDIO.splash(0.4); spawnPuff(pl.x, (pl.y || 0) + 0.6, pl.z, 0x9fc8e0, 10, 1.6, 0.05, -8, 0.6); toast('سقيت الحوض', 'ينمو أسرع'); plotsDirty = true; }
function waterHere(x, z) { const pl = plotAt(x, z, 2.2); if (pl) waterPlot(pl); else if (waterAt(x, z) > terrainAt(x, z)) { AUDIO.splash(0.5); toast('ملأت المرشّة', ''); } else toast('لا حوض هنا', 'اقترب من حوض مزروع'); }
function harvestPlot(pl) {
  const P = plotOf(pl), id = P.crop, n = 3 + Math.floor(rand() * 3) + (P.fert ? 2 : 0);
  gain(id, n); gain('seed_' + id, 1 + Math.floor(rand() * 2));
  P.crop = null; P.grow = 0; P.fert = false; plotsDirty = true; STATS.harvest = (STATS.harvest || 0) + 1; track('harvest');
  AUDIO.reap(); spawnPuff(pl.x, (pl.y || 0) + 0.5, pl.z, CROP_COLOR[id] || 0x8a9a4a, 10, 1.8, 0.06, -6, 0.8);
  if (typeof saveSoon === 'function') saveSoon();
}
function drawPlotSoil(r, b) {
  b.box(r.x, r.y + 0.03, r.z, 2.3, 0.1, 2.3, 0x4a3424, K.plaster);
  for (let q = -1; q <= 1; q++) b.box(r.x + q * 0.7, r.y + 0.09, r.z, 0.32, 0.08, 2.1, 0x5a4230, K.plaster);
}
const PLANT_MAX = 160 * 9;
const PLANT_LEAF = (() => { const b = new Builder(); b.add(G.cyl8, M(0, 0.25, 0, 0, 0.015, 0.5, 0.015), 0x4a7a32, K.plain); for (let q = 0; q < 5; q++) { const a = q / 5 * TAU; b.add(G.box, M(Math.cos(a) * 0.12, 0.2 + q * 0.05, Math.sin(a) * 0.12, -a, 0.24, 0.015, 0.07, 0, 0.5), 0x4f8a34, K.plain); } return b.geometry(); })();
const PLANT_FRUIT = new THREE.SphereGeometry(0.07, 8, 6);
const plantLeaves = new THREE.InstancedMesh(PLANT_LEAF, UBER, PLANT_MAX), plantFruit = new THREE.InstancedMesh(PLANT_FRUIT, new THREE.MeshStandardMaterial({ roughness: 0.6 }), PLANT_MAX);
for (const m of [plantLeaves, plantFruit]) { m.count = 0; m.frustumCulled = false; m.castShadow = QUALITY.shadows; m.receiveShadow = true; m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(PLANT_MAX * 3), 3); scene.add(m); }
const CROP_H = { corn: 2.6, sunflower: 2.4, wheat: 1.4, barley: 1.3, cotton: 1.4, tomato: 1.3, potato: 0.9, carrot: 0.8, pumpkin: 0.9 };
function drawPlants() {
  let n = 0, f = 0;
  for (const pl of PLOTS) {
    const P = plotOf(pl); if (!P.crop) continue;
    const h = CROP_H[P.crop] || 1, g = 0.15 + 0.85 * P.grow, y0 = (pl.y || terrainAt(pl.x, pl.z)) + (pl.kind === 'place' ? 0.44 : 0.1), ripe = P.grow >= 1;
    for (let a = -1; a <= 1; a++) for (let c = -1; c <= 1; c++) {
      if (n >= PLANT_MAX) break;
      const x = pl.x + a * 0.7 + Math.sin(c * 3 + a) * 0.06, z = pl.z + c * 0.7 + Math.cos(a * 5 + c) * 0.06;
      _jq.setFromAxisAngle(UP, a * 1.7 + c * 2.3);
      plantLeaves.setMatrixAt(n, _jm.compose(_jp.set(x, y0, z), _jq, _js.set(g, g * h, g))); plantLeaves.setColorAt(n, _hc.setRGB(0.8 + (ripe && (P.crop === 'wheat' || P.crop === 'barley') ? 0.5 : 0), 1, 0.8 - (P.water > 0 ? 0 : 0.1))); n++;
      if (P.grow > 0.55) { const fs = (P.grow - 0.4) * (P.crop === 'pumpkin' ? 3.4 : 1.4), fy = P.crop === 'pumpkin' || P.crop === 'potato' || P.crop === 'carrot' ? 0.08 : h * g * 0.5; plantFruit.setMatrixAt(f, _jm.compose(_jp.set(x, y0 + fy, z), _jq, _js.set(fs, fs * (P.crop === 'corn' ? 2.2 : 1), fs))); plantFruit.setColorAt(f, _hc.set(ripe ? CROP_COLOR[P.crop] || 0xd84a3a : 0x6a9a3a)); f++; }
    }
  }
  plantLeaves.count = n; plantFruit.count = f;
  for (const m of [plantLeaves, plantFruit]) { m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; }
}
function updatePlots(dt) {
  plotT -= dt; if (plotT > 0 && !plotsDirty) return;
  const step = Math.max(0, 1 - plotT); plotT = 1;
  for (const pl of PLOTS) {
    const P = plotOf(pl); if (!P.crop) continue;
    if (WEATHER.rain > 0.2) P.water = Math.max(P.water, 60);
    const b = biomeAt(pl.x, pl.z), cold = tempAt(pl.x, pl.z) < 0.3 ? 0.6 : 1, dry = b === 7 ? 0.6 : 1;
    const before = P.grow;
    P.grow = Math.min(1, P.grow + step / GROW_SEC * (P.water > 0 ? 1.7 : 1) * cold * dry * (P.fert ? 1.4 : 1));
    P.water = Math.max(0, P.water - step);
    if (before < 1 && P.grow >= 1 && Math.hypot(pl.x - player.pos.x, pl.z - player.pos.z) < 60) toast(ITEMS[P.crop].name + ' نضج', 'احصده من الحوض');
  }
  plotsDirty = false; drawPlants();
}
/* saplings become trees in the vegetation cells */
const SAPLING_SP = { oak: ['oak', null], pine: ['pine', null], birch: ['birch', null], olive: ['olive', 'olive'], palm: ['palm', 'dates'], apple: ['oak', 'apple'], orange: ['olive', 'orange'], lemon: ['olive', 'lemon'] };
function treeFor(r) {
  const [sp, fruit] = SAPLING_SP[r.sp] || ['oak', null]; if (!VEG.species[sp]) return null;
  const t = { id: sp, v: (r.uid || 0) % VEG.species[sp].variants.length, x: r.x, z: r.z, y: r.y - 0.05, s: 1, rot: (r.uid || 0) * 1.3 % TAU, tint: 0.5, bush: false, key: 'p' + r.uid, hp: SP_INFO[sp].hp, grow: 0.15, planted: r, fruit };
  return t;
}
function plantInCell(r) { const c = VCELLS.get(vkey(Math.floor(r.x / VCELL), Math.floor(r.z / VCELL))); if (!c) return; const t = treeFor(r); if (t) { c.trees.push(t); r._t = t; vegDirty(); } }
function plantedIn(ci, cj, keep) { for (const r of PLANTED) if (Math.floor(r.x / VCELL) === ci && Math.floor(r.z / VCELL) === cj) { const t = treeFor(r); if (t) { keep.push(t); r._t = t; } } }
let saplingT = 0;
function updateSaplings(dt) {
  saplingT -= dt; if (saplingT > 0) return; saplingT = 4;
  let ch = false;
  for (const r of PLANTED) {
    const g = clamp(0.15 + (T_GAME - r.t0) / 900, 0.15, 1);
    if (r._t && Math.abs((r._t.grow || 0) - g) > 0.015) { r._t.grow = g; ch = true; }
    if (g >= 1 && r._t && r._t.fruit) { r.fruitN = Math.min(6, (r.fruitN || 0) + 4 / 75); }
  }
  if (ch) vegDirty();
}

/* ── the use button for built things ── */
function builtUseNear(p, cand) {
  for (const r of BUILT) {
    let x, z; if (r.kind === 'piece') { const pc = ITEMS[r.id].build.piece; if (pc !== 'door' && pc !== 'gate') continue; [x, z] = recXZ(r); }
    else { x = r.x; z = r.z; }
    if (Math.abs(x - p.x) > 3 || Math.abs(z - p.z) > 3) continue;
    const d = Math.hypot(x - p.x, z - p.z), y = r.y !== undefined ? r.y : terrainAt(x, z);
    if (Math.abs(y - p.y) > 2.2) continue;
    if (r.kind === 'piece') { if (d < 2.0) cand('door', r.open ? 'أغلق' : 'افتح', r, d); continue; }
    if (r.kind === 'tree') { if (r.fruitN >= 1 && d < 2.5) cand('fruit', 'اقطف الثمار', r, d); continue; }
    if (r.kind === 'plot' || (r.kind === 'place' && r.plot)) { const P = plotOf(r); if (d < 1.9) { if (P.crop && P.grow >= 1) cand('harvest', 'احصد ' + ITEMS[P.crop].name, r, d); else if (!P.crop && [...INV.items.keys()].some((k) => ITEMS[k] && ITEMS[k].seed)) cand('sow', 'ازرع', r, d + 0.2); } continue; }
    if (r.kind !== 'place' || d > 2.0) continue;
    const kind = placeKind(ITEMS[r.id]);
    if (STORE_CAP[kind]) cand('stash', 'افتح ' + ITEMS[r.id].name, r, d);
    else if (kind === 'wardrobe' || kind === 'mirror') cand('wardrobe', 'غيّر ملابسك', r, d);
    else if (kind === 'well') cand('well', 'املأ الماء', r, d);
    else if (PRODUCE[kind] && r.made >= 1) cand('collect', PRODUCE[kind][3], r, d);
    else if (kind === 'workbench' || kind === 'gunbench' || kind === 'anvil' || kind === 'furnace' || kind === 'loom' || kind === 'tailor' || kind === 'campfire' || kind === 'stove') cand('station', 'اصنع هنا', r, d + 0.3);
    else if ((kind === 'chair' || kind === 'stool' || kind === 'bench' || kind === 'sofa') && d < 1.4) cand('sit', 'اجلس', r, d + 0.4);
  }
}
let wellT = 0;
function builtUse(k, r) {
  if (k === 'door') { r.open = !r.open; if (r._ph.door) r._ph.door.off = r.open; markChunk(r._ck); AUDIO.door(); if (typeof saveSoon === 'function') saveSoon(); }
  else if (k === 'stash') { if (typeof openCraft === 'function') openCraft('inv', r); }
  else if (k === 'wardrobe') { if (typeof openCraft === 'function') openCraft('wear'); }
  else if (k === 'station') { if (typeof openCraft === 'function') openCraft('craft'); }
  else if (k === 'well') { if (T - wellT < 20) { toast('الدلو يمتلئ…', ''); return; } wellT = T; gain('water', 5); AUDIO.splash(0.5); }
  else if (k === 'collect') { const pr = PRODUCE[placeKind(ITEMS[r.id])], n = Math.floor(r.made); gain(pr[0], n); r.made -= n; if (typeof saveSoon === 'function') saveSoon(); }
  else if (k === 'harvest') harvestPlot(r);
  else if (k === 'sow') { const seed = [...INV.items.keys()].find((q) => ITEMS[q] && ITEMS[q].seed); if (seed) plantSeed(seed); }
  else if (k === 'fruit') { const n = Math.floor(r.fruitN); gain(r._t.fruit, n); r.fruitN -= n; AUDIO.pickup(false); }
  else if (k === 'sit') { player.sitT = 6; toast('تستريح', 'الطاقة تعود أسرع'); }
}
let produceT = 0;
function updateBuilt(dt) {
  rebuildChunks(); updatePlots(dt); updateSaplings(dt);
  produceT -= dt;
  if (produceT <= 0) { produceT = 2; for (const r of BUILT) if (r.kind === 'place') { const pr = PRODUCE[placeKind(ITEMS[r.id])]; if (pr) r.made = Math.min(pr[2], (r.made || 0) + 2 / pr[1]); } }
  // fires flicker
  FIRE_MAT.color.setRGB(3.2 * (0.85 + 0.15 * Math.sin(T * 13) * Math.sin(T * 7.3)), 1.3 * (0.9 + 0.1 * Math.sin(T * 9.1)), 0.35);
  if (player.sitT > 0) { player.sitT -= dt; player.stamina = Math.min(100, player.stamina + 20 * dt); if (player.speed > 0.5) player.sitT = 0; }
}
